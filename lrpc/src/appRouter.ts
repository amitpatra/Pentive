/* eslint-disable @typescript-eslint/naming-convention */
import config from "./config"
import * as trpc from "@trpc/server"
import { z } from "zod"
import AWS, { AWSError, Credentials, DynamoDB } from "aws-sdk"
import { Table, Entity } from "dynamodb-toolbox"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { PromiseResult } from "aws-sdk/lib/request"

const dynamoDbClientParams: DocumentClient.DocumentClientOptions &
  DynamoDB.Types.ClientConfiguration = {
  convertEmptyValues: false, // https://stackoverflow.com/q/37479586
}

if (config.IS_OFFLINE === "true") {
  dynamoDbClientParams.region = "localhost"
  dynamoDbClientParams.endpoint = "http://localhost:8000"
  dynamoDbClientParams.credentials = new Credentials(
    "DEFAULT_ACCESS_KEY",
    "DEFAULT_SECRET"
  )
}
const dynamoDbClient = new AWS.DynamoDB.DocumentClient(dynamoDbClientParams)

const ivy = new Table({
  name: config.IVY_TABLE,
  partitionKey: "PK",
  sortKey: "SK",
  DocumentClient: dynamoDbClient,
})

const template = new Entity({
  name: "t",
  attributes: {
    id: { type: "string", partitionKey: true },
    sk: { type: "string", sortKey: true, hidden: true },
    nook: { type: "string", required: true },
    name: { type: "string", required: true },
    templateType: { type: "string", required: true },
    fields: { type: "list", required: true },
    css: { type: "string", required: true },
    childTemplates: { type: "string", required: true },
    ankiId: { type: "number" },
  },
  table: ivy,
} as const)

const id = z.string().uuid() // highTODO are we doing ULIDs, KSUID, or neither?

const createRemoteTemplate = z.object({
  id,
  name: z.string(),
  nook: z.string(),
  templateType: z.literal("standard").or(z.literal("cloze")),
  fields: z.array(z.string()),
  css: z.string(),
  childTemplates: z.string(),
  ankiId: z.number().positive().optional(),
})

export type CreateRemoteTemplate = z.infer<typeof createRemoteTemplate>

interface Context {
  user: string | undefined
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function appRouter<TContext extends Context>() {
  return trpc
    .router<TContext>()
    .query("greet", {
      input: z.object({
        name: z.string(),
      }),
      resolve(req) {
        return `Greetings, ${req.input.name}. x-user?: ${
          req.ctx.user ?? "undefined"
        }. `
      },
    })
    .mutation("addTemplate", {
      input: z.object({
        id: z.string(),
        name: z.string(),
      }),
      async resolve(req) {
        await dynamoDbClient
          .put({
            TableName: config.IVY_TABLE,
            Item: {
              PK: req.input.id,
              SK: req.input.id,
              name: req.input.name,
            },
          })
          .promise()
      },
    })
    .mutation("addTemplates", {
      input: z.array(createRemoteTemplate),
      async resolve(req) {
        // highTODO batch in chunks of 25
        const templatePuts = req.input.map((t) =>
          template.putBatch({
            sk: "a",
            ...t,
          })
        )
        // highTODO run to completion (pull on `next`), handle errors, add exponential back off https://github.com/jeremydaly/dynamodb-toolbox/issues/152 https://stackoverflow.com/q/42911223
        const result = await (ivy.batchWrite(templatePuts) as Promise<
          | DocumentClient.BatchWriteItemInput
          | (PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError> & {
              next?: () => boolean
            })
        >)
        console.log("Batch puts result", result)
      },
    })
    .query("getTemplate", {
      input: z.string(),
      async resolve(req) {
        const r = await dynamoDbClient
          .get({
            TableName: config.IVY_TABLE,
            Key: {
              PK: req.input,
              SK: req.input,
            },
          })
          .promise()
        return r.Item
      },
    })
    .query("getTemplates", {
      input: z.array(id),
      async resolve(req) {
        const getBatches = req.input.map((id) =>
          template.getBatch({ id, sk: "a" })
        )
        // highTODO paginate, handle errors and missing ids https://github.com/jeremydaly/dynamodb-toolbox/issues/197
        const batch = await (ivy.batchGet(getBatches) as Promise<
          PromiseResult<DocumentClient.BatchGetItemOutput, AWSError>
        >)
        const r = batch.Responses?.[config.IVY_TABLE] ?? []
        return z.array(createRemoteTemplate).parse(r)
      },
    })
}
const invokedAppRouter = appRouter()
export type AppRouter = typeof invokedAppRouter
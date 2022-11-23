/* eslint-disable @typescript-eslint/naming-convention */
import config from "./config"
import * as trpc from "@trpc/server"
import { z } from "zod"
import AWS, { AWSError, Credentials, DynamoDB } from "aws-sdk"
import { Table, Entity } from "dynamodb-toolbox"
import { DocumentClient } from "aws-sdk/clients/dynamodb"
import { PromiseResult } from "aws-sdk/lib/request"
import { createRemoteTemplate, remoteTemplate } from "./schemas/template"
import { id } from "./schemas/core"
import superjson from "superjson"
import { throwExp } from "./core"
import _ from "lodash"
import { Ulid } from "id128"
import { PrismaClient, Prisma, Template } from "@prisma/client"

const prisma = new PrismaClient()

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
    author: { type: "string", required: true },
    name: { type: "string", required: true },
    templateType: { type: "string", required: true },
    fields: { type: "list", required: true },
    css: { type: "string", required: true },
    childTemplates: { type: "string", required: true },
    ankiId: { type: "number" },
  },
  table: ivy,
} as const)

export interface ClientTemplate {
  id: string
  createdAt: Date
  updatedAt: Date
  name: string
  nook: string
  authorId: string
  type: string
  fields: string
  css: string
  childTemplates: string
  ankiId: bigint | null
}

function ulidStringToBuffer(id: string): Buffer {
  return ulidToBuffer(Ulid.fromCanonical(id))
}

function ulidToBuffer(id: Ulid): Buffer {
  return Buffer.from(id.toRaw(), "hex")
}

function mapTemplate(t: Template): ClientTemplate {
  const id = Ulid.fromRaw(t.id.toString("hex")).toCanonical()
  return { ...t, id }
}

interface Context {
  user: string | undefined
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function appRouter<TContext extends Context>() {
  return trpc
    .router<TContext>()
    .transformer(superjson)
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
        name: z.string(),
      }),
      async resolve(req) {
        const id = Ulid.generate()
        await prisma.template.create({
          data: {
            ...req.input,
            id: ulidToBuffer(id),
            nook: "nook",
            authorId: req.ctx.user ?? throwExp("user not found"), // highTODO put this route behind protected middleware upon TRPCv10
            type: "type",
            fields: "fields",
            css: "css",
            childTemplates: "childTemplates",
            ankiId: 0,
          },
        })
        return id.toCanonical()
      },
    })
    .mutation("addTemplates", {
      input: z.array(createRemoteTemplate),
      async resolve(req) {
        const templateCreatesAndIds = req.input.map(
          ({ templateType, ...t }) => {
            const remoteId = Ulid.generate()
            const t2: Prisma.TemplateCreateManyInput = {
              ...t,
              type: templateType,
              fields: JSON.stringify(t.fields),
              id: ulidToBuffer(remoteId),
              authorId: req.ctx.user ?? throwExp("user not found"), // highTODO put this route behind protected middleware upon TRPCv10
            }
            return [
              t2,
              [t.id, remoteId.toCanonical()] as [string, string],
            ] as const
          }
        )
        const templateCreates = templateCreatesAndIds.map((x) => x[0])
        const remoteIdByLocal = _.fromPairs(
          templateCreatesAndIds.map((x) => x[1])
        )
        await prisma.template.createMany({
          data: templateCreates,
        })
        return remoteIdByLocal
      },
    })
    .query("getTemplate", {
      input: id,
      async resolve(req) {
        const id = ulidStringToBuffer(req.input)
        const template = await prisma.template.findUnique({ where: { id } })
        if (template != null) {
          return mapTemplate(template)
        }
        return template
      },
    })
    .query("getTemplates", {
      input: z.array(id),
      async resolve(req) {
        const r = await prisma.template.findMany({
          where: { id: { in: req.input.map(ulidStringToBuffer) } },
        })
        return r.map(mapTemplate)
      },
    })
}
const invokedAppRouter = appRouter()
export type AppRouter = typeof invokedAppRouter

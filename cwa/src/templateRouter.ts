import { z } from "zod"
import { authedProcedure, publicProcedure } from "./trpc"
import {
  createRemoteTemplate,
  editRemoteTemplate,
  editTemplates,
  getTemplate,
  insertTemplates,
  remoteTemplateId,
} from "shared"

export const templateRouter = {
  createTemplates: authedProcedure
    .input(z.array(createRemoteTemplate).min(1))
    .mutation(async ({ input, ctx }) => {
      const remoteIdByLocal = await insertTemplates(ctx.user, input)
      return remoteIdByLocal
    }),
  editTemplates: authedProcedure
    .input(z.array(editRemoteTemplate).min(1))
    .mutation(async ({ input, ctx }) => await editTemplates(ctx.user, input)),
  getTemplate: publicProcedure
    .input(remoteTemplateId)
    .query(async ({ input }) => await getTemplate(input)),
}
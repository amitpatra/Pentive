import { z } from "zod"
import { authedProcedure } from "./trpc"
import {
  createRemoteTemplate,
  editRemoteTemplate,
  remoteTemplateId,
} from "shared"
import {
  editTemplates,
  insertTemplates,
  subscribeToTemplate,
} from "shared-edge"
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- needed for the emitted types
import type * as edge from "shared-edge"

export const templateRouter = {
  createTemplates: authedProcedure
    .input(z.array(createRemoteTemplate).min(1))
    .mutation(async ({ input, ctx }) => {
      const remoteIdByLocal = await insertTemplates(ctx.user, input)
      return remoteIdByLocal
    }),
  editTemplates: authedProcedure
    .input(z.array(editRemoteTemplate).min(1))
    .mutation(async ({ input, ctx }) => {
      await editTemplates(ctx.user, input)
    }),
  subscribeToTemplate: authedProcedure
    .input(remoteTemplateId)
    .mutation(async ({ input, ctx }) => {
      await subscribeToTemplate(ctx.user, input)
    }),
}

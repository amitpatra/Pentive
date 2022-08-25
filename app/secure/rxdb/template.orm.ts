import { KeyFunctionMap, RxCollection, RxDocument } from "rxdb"
import { TemplateId } from "../../src/domain/ids"
import { Template } from "../../src/domain/template"
import { TemplateDocType } from "./template.schema"

function templateToDocType(template: Template): TemplateDocType {
  const { id, name, created, modified, ...shrunken } = template // https://stackoverflow.com/a/66899790
  return {
    id,
    name,
    created: created.toISOString(),
    modified: modified.toISOString(),
    data: shrunken,
  }
}

interface TemplateDocMethods extends KeyFunctionMap {}

export type TemplateDocument = RxDocument<TemplateDocType, TemplateDocMethods>

interface TemplateCollectionMethods extends KeyFunctionMap {
  readonly upsertTemplate: (
    this: TemplateCollection,
    template: Template
  ) => Promise<void>
  readonly getTemplate: (templateId: TemplateId) => Promise<Template | null>
  readonly getTemplates: () => Promise<Template[]>
}

export type TemplateCollection = RxCollection<
  TemplateDocType,
  TemplateDocMethods,
  TemplateCollectionMethods
>

export const templateDocMethods: TemplateDocMethods = {}

function entityToDomain(
  template: RxDocument<
    {
      readonly id: string
      readonly name: string
      readonly created: string
      readonly modified: string
      readonly data: unknown
    },
    TemplateDocMethods
  >
): Template {
  const r = {
    id: template.id as TemplateId,
    name: template.name,
    created: new Date(template.created),
    modified: new Date(template.modified),
    ...(template.data as object),
  }
  // @ts-expect-error Unsure why `type` is in `data` - it's not there when inserted. RxDB or PouchDB or something adds it. Removing to make roundtrip testing easier.
  delete r.type
  return r as Template
  // Returning dates are *sometimes* strings.
  // The first return after a page refresh is a string because IndexedDb can't handle Date and serializes it.
  // After an upsert, the return is a Date Object because RxDB caches the upserted object... I think.
}

export const templateCollectionMethods: TemplateCollectionMethods = {
  upsertTemplate: async function (
    this: TemplateCollection,
    template: Template
  ) {
    await this.upsert(templateToDocType(template))
  },
  getTemplate: async function (
    this: TemplateCollection,
    templateId: TemplateId
  ) {
    const template = await this.findOne(templateId).exec()
    return template == null ? null : entityToDomain(template)
  },
  getTemplates: async function (this: TemplateCollection) {
    const allTemplates = await this.find().exec()
    return allTemplates.map(entityToDomain)
  },
}

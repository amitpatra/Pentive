import { Kysely, sql, InsertResult, RawBuilder, InsertObject } from "kysely"
import { PlanetScaleDialect } from "kysely-planetscale"
import { DB } from "./database.js"
import {
  Base64,
  Base64Url,
  DbId,
  Hex,
  NookId,
  NoteCommentId,
  NoteId,
  RemoteNoteId,
  RemoteTemplateId,
  TemplateId,
  UserId,
} from "./brand.js"
import { binary16fromBase64URL, ulidAsHex, ulidAsRaw } from "./convertBinary.js"
import {
  nullMap,
  parseMap,
  stringifyMap,
  throwExp,
  undefinedMap,
} from "./utility.js"
import { base16, base64url } from "@scure/base"
import { compile } from "html-to-text"
import {
  CreateRemoteNote,
  CreateRemoteTemplate,
  EditRemoteNote,
  EditRemoteTemplate,
  RemoteTemplate,
  TemplateType,
} from "./schema.js"

const convert = compile({})

// @ts-expect-error db calls should throw null error if not setup
export let db: Kysely<DB> = null as Kysely<DB>

export function setKysely(url: string): void {
  if (db == null) {
    db = new Kysely<DB>({
      dialect: new PlanetScaleDialect({
        url,
      }),
    })
  }
}

export async function getPosts({ nook }: { nook: string }): Promise<
  Array<{
    id: Base64Url
    title: string
    text: string
    authorId: string
  }>
> {
  return await db
    .selectFrom("Post")
    .select(["id", "title", "text", "authorId"])
    .where("nook", "=", nook)
    .execute()
    .then((ps) => ps.map(mapIdToBase64Url))
}

function noteToNookView(x: {
  id: DbId
  fieldValues: string
  css: string
  type: string
  fields: string
  subscribers: number
  comments: number
  til?: Date
}) {
  return {
    id: dbIdToBase64Url(x.id) as RemoteNoteId,
    fieldValues: deserializeFieldValues(x.fieldValues),
    subscribers: x.subscribers,
    comments: x.comments,
    til: x.til,
    template: {
      css: x.css,
      fields: deserializeFields(x.fields),
      templateType: deserializeTemplateType(x.type),
    },
  }
}

export async function getNotes(nook: NookId, userId: UserId | null) {
  const r = await db
    .selectFrom("Note")
    .innerJoin("Template", "Template.id", "Note.templateId")
    .select([
      "Note.id",
      "Note.fieldValues",
      "Note.subscribersCount as subscribers",
      "Note.commentsCount as comments",
      "Template.css",
      "Template.fields",
      "Template.type",
    ])
    .if(userId != null, (a) =>
      a.select((b) =>
        b
          .selectFrom("NoteSubscriber")
          .select(["til"])
          .where("userId", "=", userId)
          .whereRef("NoteSubscriber.noteId", "=", "Note.id")
          .as("til")
      )
    )
    .where("Template.nook", "=", nook)
    .execute()
  return r.map(noteToNookView)
}

export async function getNote(noteId: RemoteNoteId, userId: UserId | null) {
  const r = await db
    .selectFrom("Note")
    .innerJoin("Template", "Template.id", "Note.templateId")
    .select([
      "Note.templateId",
      "Note.createdAt",
      "Note.updatedAt",
      "Note.authorId",
      "Note.fieldValues",
      "Note.tags",
      "Note.ankiId",
      "Template.css",
      "Template.fields",
      "Template.type",
    ])
    .if(userId != null, (a) =>
      a.select((b) =>
        b
          .selectFrom("NoteSubscriber")
          .select(["til"])
          .where("userId", "=", userId)
          .whereRef("NoteSubscriber.noteId", "=", "Note.id")
          .as("til")
      )
    )
    .where("Note.id", "=", fromBase64Url(noteId))
    .executeTakeFirst()
  if (r == null) return null
  return {
    id: noteId,
    templateId: dbIdToBase64Url(r.templateId) as RemoteTemplateId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    authorId: r.authorId as UserId,
    fieldValues: deserializeFieldValues(r.fieldValues),
    tags: deserializeTags(r.tags),
    ankiId: r.ankiId,
    til: r.til,
    template: {
      css: r.css,
      fields: deserializeFields(r.fields),
      templateType: deserializeTemplateType(r.type),
    },
  }
}

// https://stackoverflow.com/a/18018037
function listToTree(list: NoteComment[]) {
  const map = new Map<Base64Url, number>()
  let node
  const roots = []
  let i
  for (i = 0; i < list.length; i += 1) {
    map.set(list[i].id, i)
  }
  for (i = 0; i < list.length; i += 1) {
    node = list[i]
    if (node.parentId !== null) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      list[map.get(node.parentId)!].comments.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export interface NoteComment {
  id: NoteCommentId
  parentId: NoteCommentId | null
  noteId: DbId
  createdAt: Date
  updatedAt: Date
  text: string
  authorId: string
  votes: string
  level: number
  comments: NoteComment[]
}

export async function getNoteComments(noteId: RemoteNoteId) {
  const cs = await db
    .selectFrom("NoteComment")
    .select([
      "id",
      "parentId",
      "createdAt",
      "updatedAt",
      "text",
      "authorId",
      "votes",
      "level",
    ])
    .where("NoteComment.noteId", "=", fromBase64Url(noteId))
    .orderBy("level", "asc")
    .orderBy("votes", "desc")
    .execute()
  const commentsList = cs.map((c) => {
    const r: NoteComment = {
      id: dbIdToBase64Url(c.id) as NoteCommentId,
      parentId: nullMap(c.parentId, dbIdToBase64Url) as NoteCommentId | null,
      noteId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      text: c.text,
      authorId: c.authorId as UserId,
      votes: c.votes,
      level: c.level,
      comments: [],
    }
    return r
  })
  return listToTree(commentsList)
}

export async function getPost(id: Base64Url): Promise<
  | {
      id: Base64Url
      title: string
      text: string
      authorId: string
    }
  | undefined
> {
  return await db
    .selectFrom("Post")
    .select(["id", "title", "text", "authorId"])
    .where("id", "=", fromBase64Url(id))
    .executeTakeFirst()
    .then((x) => undefinedMap(x, mapIdToBase64Url))
}

export async function getTemplate(id: RemoteTemplateId, nook: NookId) {
  const t = await db
    .selectFrom("Template")
    .selectAll()
    .where("id", "=", fromBase64Url(id))
    .where("nook", "=", nook)
    .executeTakeFirst()
  return undefinedMap(t, templateEntityToDomain)
}

export async function getTemplates(nook: NookId) {
  const ts = await db
    .selectFrom("Template")
    .selectAll()
    .where("nook", "=", nook)
    .execute()
  return ts.map(templateEntityToDomain)
}

function templateEntityToDomain(t: {
  id: DbId
  createdAt: Date
  updatedAt: Date
  name: string
  nook: NookId
  type: string
  fields: string
  css: string
  ankiId: number | null
}) {
  const r: RemoteTemplate = {
    id: dbIdToBase64Url(t.id) as RemoteTemplateId,
    name: t.name,
    nook: t.nook,
    css: t.css,
    fields: deserializeFields(t.fields),
    created: t.createdAt,
    modified: t.updatedAt,
    templateType: deserializeTemplateType(t.type),
  }
  return r
}

export async function insertPost({
  authorId,
  nook,
  text,
  title,
  id,
}: {
  authorId: string
  nook: string
  text: string
  title: string
  id: Hex
}): Promise<InsertResult[]> {
  return await db
    .insertInto("Post")
    .values({
      id: unhex(id),
      authorId,
      nook,
      text,
      title,
    })
    .execute()
}

export async function insertNoteComment(
  noteId: RemoteNoteId,
  text: string,
  authorId: UserId
) {
  const noteDbId = fromBase64Url(noteId)
  await db.transaction().execute(
    async (tx) =>
      await Promise.all([
        await db
          .selectFrom("Note")
          .select(["id"])
          .where("Note.id", "=", noteDbId)
          .executeTakeFirst()
          .then((r) => {
            if (r == null) throwExp(`Note ${noteId} not found.`)
          }),
        tx
          .updateTable("Note")
          .set({
            commentsCount: (x) => sql`${x.ref("commentsCount")} + 1`,
          })
          .where("Note.id", "=", noteDbId)
          .execute(),
        tx
          .insertInto("NoteComment")
          .values({
            id: unhex(ulidAsHex()),
            authorId,
            level: 0,
            noteId: noteDbId,
            votes: "",
            text,
          })
          .execute(),
      ])
  )
}

export async function insertNoteChildComment(
  parentCommentId: NoteCommentId,
  text: string,
  authorId: UserId
) {
  const parentCommentDbId = fromBase64Url(parentCommentId)
  const parent = await db
    .selectFrom("NoteComment")
    .select(["level", sql<Base64>`TO_BASE64(noteId)`.as("noteId")])
    .where("id", "=", parentCommentDbId)
    .executeTakeFirst()
  if (parent == null) throwExp(`Comment ${parentCommentId} not found.`)
  const noteId = fromBase64(parent.noteId)
  await db.transaction().execute(
    async (tx) =>
      await Promise.all([
        tx
          .updateTable("Note")
          .set({
            commentsCount: (x) => sql`${x.ref("commentsCount")} + 1`,
          })
          .where("Note.id", "=", noteId)
          .execute(),
        await tx
          .insertInto("NoteComment")
          .values({
            id: unhex(ulidAsHex()),
            authorId,
            level: parent.level + 1,
            noteId,
            votes: "",
            text,
            parentId: parentCommentDbId,
          })
          .execute(),
      ])
  )
}

export async function userOwnsNoteAndHasMedia(
  ids: NoteId[],
  authorId: UserId,
  id: Base64
): Promise<{
  userOwns: boolean
  hasMedia: boolean
}> {
  const { hasMedia, userOwns } = await db
    .selectFrom([
      db
        .selectFrom("Note")
        .select(db.fn.count("id").as("userOwns"))
        .where("id", "in", ids.map(fromBase64Url))
        .where("authorId", "=", authorId)
        .as("userOwns"),
      db
        .selectFrom("Media_Entity")
        .select(db.fn.count("mediaHash").as("hasMedia"))
        .where("mediaHash", "=", fromBase64(id))
        .as("hasMedia"),
    ])
    .selectAll()
    .executeTakeFirstOrThrow()
  return {
    userOwns: userOwns === ids.length.toString(),
    hasMedia: hasMedia !== "0",
  }
}

export async function userOwnsTemplateAndHasMedia(
  ids: TemplateId[],
  authorId: UserId,
  id: Base64
): Promise<{
  userOwns: boolean
  hasMedia: boolean
}> {
  const { hasMedia, userOwns } = await db
    .selectFrom([
      db
        .selectFrom("Template")
        .select(db.fn.count("id").as("userOwns"))
        .where("id", "in", ids.map(fromBase64Url))
        // .where("authorId", "=", authorId) // highTODO
        .as("userOwns"),
      db
        .selectFrom("Media_Entity")
        .select(db.fn.count("mediaHash").as("hasMedia"))
        .where("mediaHash", "=", fromBase64(id))
        .as("hasMedia"),
    ])
    .selectAll()
    .executeTakeFirstOrThrow()
  return {
    userOwns: userOwns === ids.length.toString(),
    hasMedia: hasMedia !== "0",
  }
}

export async function lookupMediaHash(
  entityId: Base64,
  i: number
): Promise<Base64 | undefined> {
  const mediaHash = await db
    .selectFrom("Media_Entity")
    .select(sql<Base64>`TO_BASE64(mediaHash)`.as("mediaHash"))
    .where("entityId", "=", fromBase64(entityId))
    .where("i", "=", i)
    .executeTakeFirst()
  return mediaHash?.mediaHash
}

export async function insertNotes(authorId: UserId, notes: CreateRemoteNote[]) {
  const rtIds = Array.from(
    new Set(notes.flatMap((n) => n.remoteTemplateIds))
  ).map(fromBase64Url)
  // highTODO validate author
  const templates = await db
    .selectFrom("Template")
    .select(["nook", "id"])
    .where("id", "in", rtIds)
    .execute()
  if (templates.length !== rtIds.length)
    throwExp("You have an invalid RemoteTemplateId.")
  const noteCreatesAndIds = notes.flatMap((n) => {
    const ncs = toNoteCreates(n, authorId)
    return ncs.map(({ noteCreate, remoteIdBase64url, remoteTemplateId }) => {
      const t =
        templates.find((t) => dbIdToBase64Url(t.id) === remoteTemplateId) ??
        throwExp(`Template not found - should be impossible.`)
      return [noteCreate, [[n.localId, t.nook], remoteIdBase64url]] as const
    })
  })
  const noteCreates = noteCreatesAndIds.map((x) => x[0])
  await db.insertInto("Note").values(noteCreates).execute()
  const remoteIdByLocal = new Map(noteCreatesAndIds.map((x) => x[1]))
  return remoteIdByLocal
}

export async function insertTemplates(
  authorId: UserId,
  templates: CreateRemoteTemplate[]
) {
  const templateCreatesAndIds = templates.flatMap((n) => {
    const tcs = toTemplateCreates(n, authorId)
    return tcs.map(({ templateCreate, remoteIdBase64url }) => {
      return [
        templateCreate,
        [[n.localId, templateCreate.nook], remoteIdBase64url],
      ] as const
    })
  })
  const templateCreates = templateCreatesAndIds.map((x) => x[0])
  await db.insertInto("Template").values(templateCreates).execute()
  const remoteIdByLocal = new Map(templateCreatesAndIds.map((x) => x[1]))
  return remoteIdByLocal
}

export async function subscribeToNote(userId: UserId, noteId: RemoteNoteId) {
  const noteDbId = fromBase64Url(noteId)
  await db.transaction().execute(
    async (tx) =>
      await Promise.all([
        tx
          .selectFrom("Note")
          .select(["id"])
          .where("id", "=", noteDbId)
          .executeTakeFirst()
          .then((n) => {
            if (n == null) throwExp(`Note ${noteId} not found.`)
          }),
        tx
          .updateTable("Note")
          .set({
            subscribersCount: (x) => sql`${x.ref("subscribersCount")} + 1`,
          })
          .where("Note.id", "=", noteDbId)
          .execute(),
        tx
          .insertInto("NoteSubscriber")
          .values({
            userId,
            noteId: noteDbId,
          })
          .execute(),
      ])
  )
}

function toNoteCreates(n: EditRemoteNote | CreateRemoteNote, authorId: UserId) {
  const remoteIds =
    "remoteIds" in n
      ? new Map(
          Array.from(n.remoteIds).map(([remoteNoteId, remoteTemplateId]) => [
            base64url.decode(remoteNoteId + "=="),
            remoteTemplateId ??
              throwExp("grep E7F24704-8D0B-460A-BF2C-A97344C535E0"),
          ])
        )
      : new Map(n.remoteTemplateIds.map((rt) => [ulidAsRaw(), rt]))
  return Array.from(remoteIds).map((x) => toNoteCreate(x, n, authorId))
}

function toNoteCreate(
  [remoteNoteId, remoteTemplateId]: [Uint8Array, RemoteTemplateId],
  n: EditRemoteNote | CreateRemoteNote,
  authorId: UserId
) {
  const updatedAt = "remoteId" in n ? new Date() : undefined
  const remoteIdHex = base16.encode(remoteNoteId) as Hex
  const remoteIdBase64url = base64url
    .encode(remoteNoteId)
    .substring(0, 22) as RemoteNoteId
  for (const [field, value] of n.fieldValues) {
    n.fieldValues.set(field, replaceImgSrcs(value, remoteIdBase64url))
  }
  const noteCreate: InsertObject<DB, "Note"> = {
    id: unhex(remoteIdHex),
    templateId: fromBase64Url(remoteTemplateId), // highTODO validate
    authorId,
    updatedAt,
    fieldValues: serializeFieldValues(n.fieldValues),
    fts: Array.from(n.fieldValues)
      .map(([, v]) => convert(v))
      .concat(n.tags)
      .join(" "),
    tags: serializeTags(n.tags),
    ankiId: n.ankiId,
  }
  return { noteCreate, remoteIdBase64url, remoteTemplateId }
}

// hacky, but better than my previous solution, which was to parse the value, which was slow(er) and fragile.
export const imgPlaceholder = "3Iptw8cmfkd/KLrTw+9swHnzxxVhtDCraYLejUh3"

function replaceImgSrcs(value: string, remoteIdBase64url: string) {
  return value.replaceAll(
    imgPlaceholder,
    "https://api.local.pentive.com:8787/i/" + remoteIdBase64url
  )
}

function toTemplateCreates(
  n: EditRemoteTemplate | CreateRemoteTemplate,
  authorId: UserId // highTODO update History. Could History be a compressed column instead of its own table?
) {
  const remoteIds =
    "remoteIds" in n
      ? n.remoteIds.map(
          (id) =>
            [base64url.decode(id + "=="), "undefined_nook" as NookId] as const
        )
      : n.nooks.map((nook) => [ulidAsRaw(), nook] as const)
  return remoteIds.map(([id, nook]) => toTemplateCreate(n, id, nook))
}

function toTemplateCreate(
  n: EditRemoteTemplate | CreateRemoteTemplate,
  remoteId: Uint8Array,
  nook: NookId
) {
  const updatedAt = "remoteId" in n ? new Date() : undefined
  const remoteIdHex = base16.encode(remoteId) as Hex
  const remoteIdBase64url = base64url
    .encode(remoteId)
    .substring(0, 22) as RemoteTemplateId
  if (n.templateType.tag === "standard") {
    for (const t of n.templateType.templates) {
      t.front = replaceImgSrcs(t.front, remoteIdBase64url)
      t.back = replaceImgSrcs(t.back, remoteIdBase64url)
    }
  } else {
    n.templateType.template.front = replaceImgSrcs(
      n.templateType.template.front,
      remoteIdBase64url
    )
    n.templateType.template.back = replaceImgSrcs(
      n.templateType.template.back,
      remoteIdBase64url
    )
  }
  const templateCreate: InsertObject<DB, "Template"> & { nook: NookId } = {
    id: unhex(remoteIdHex),
    ankiId: n.ankiId,
    updatedAt,
    name: n.name,
    nook,
    type: serializeTemplateType(n.templateType),
    fields: serializeFields(n.fields),
    css: n.css,
  }
  return { templateCreate, remoteIdBase64url }
}

// highTODO property test
function serializeTemplateType(tt: TemplateType) {
  return JSON.stringify(tt)
}

function serializeFields(tt: string[]) {
  return JSON.stringify(tt)
}

function serializeFieldValues(fvs: Map<string, string>) {
  return stringifyMap(fvs)
}

function serializeTags(tags: string[]) {
  return JSON.stringify(tags)
}

function deserializeTemplateType(tt: string) {
  return JSON.parse(tt) as TemplateType
}

function deserializeFields(tt: string) {
  return JSON.parse(tt) as string[]
}

function deserializeFieldValues(fvs: string) {
  return parseMap<string, string>(fvs)
}

function deserializeTags(tags: string) {
  return JSON.parse(tags) as string[]
}

export async function editNotes(authorId: UserId, notes: EditRemoteNote[]) {
  const editNoteIds = notes
    .flatMap((t) => Array.from(t.remoteIds.keys()))
    .map(fromBase64Url)
  const count = await db
    .selectFrom("Note")
    .select(db.fn.count("id").as("c"))
    .where("id", "in", editNoteIds)
    .executeTakeFirstOrThrow()
  if (count.c !== notes.length.toString())
    throwExp("At least one of these notes doesn't exist.")
  const noteCreates = notes.map((n) => {
    const tcs = toNoteCreates(n, authorId)
    return tcs.map((tc) => tc.noteCreate)
  })
  // insert into `Note` (`id`, `templateId`, `authorId`, `fieldValues`, `fts`, `tags`)
  // values (UNHEX(?), FROM_BASE64(?), ?, ?, ?, ?)
  // on duplicate key update `templateId` = values(`templateId`), `updatedAt` = values(`updatedAt`), `authorId` = values(`authorId`), `fieldValues` = values(`fieldValues`), `fts` = values(`fts`), `tags` = values(`tags`), `ankiId` = values(`ankiId`)
  await db
    .insertInto("Note")
    .values(noteCreates.flat())
    // https://stackoverflow.com/a/34866431
    .onDuplicateKeyUpdate({
      templateId: (x) => values(x.ref("templateId")),
      // createdAt: (x) => values(x.ref("createdAt")),
      updatedAt: (x) => values(x.ref("updatedAt")),
      authorId: (x) => values(x.ref("authorId")),
      fieldValues: (x) => values(x.ref("fieldValues")),
      fts: (x) => values(x.ref("fts")),
      tags: (x) => values(x.ref("tags")),
      ankiId: (x) => values(x.ref("ankiId")),
    })
    .execute()
}

export async function editTemplates(
  authorId: UserId,
  templates: EditRemoteTemplate[]
) {
  const editTemplateIds = templates
    .flatMap((t) => t.remoteIds)
    .map(fromBase64Url)
  const count = await db
    .selectFrom("Template")
    .select(db.fn.count("id").as("c"))
    .where("id", "in", editTemplateIds)
    .executeTakeFirstOrThrow()
  if (count.c !== editTemplateIds.length.toString())
    throwExp("At least one of these templates doesn't exist.")
  const templateCreates = templates.map((n) => {
    const tcs = toTemplateCreates(n, authorId)
    return tcs.map((tc) => tc.templateCreate)
  })
  await db
    .insertInto("Template")
    .values(templateCreates.flat())
    // https://stackoverflow.com/a/34866431
    .onDuplicateKeyUpdate({
      ankiId: (x) => values(x.ref("ankiId")),
      // createdAt: (x) => values(x.ref("createdAt")),
      updatedAt: (x) => values(x.ref("updatedAt")),
      name: (x) => values(x.ref("name")),
      // nook: (x) => values(x.ref("nook")), do not update Nook!
      type: (x) => values(x.ref("type")),
      fields: (x) => values(x.ref("fields")),
      css: (x) => values(x.ref("css")),
    })
    .execute()
}

// nix upon resolution of https://github.com/koskimas/kysely/issues/251
function values<T>(x: RawBuilder<T>) {
  return sql<T>`values(${x})`
}

function unhex(id: Hex): RawBuilder<DbId> {
  return sql<DbId>`UNHEX(${id})`
}

export function fromBase64(id: Base64): RawBuilder<DbId> {
  return sql<DbId>`FROM_BASE64(${id})`
}

export function fromBase64Url(id: Base64Url): RawBuilder<DbId> {
  return fromBase64(binary16fromBase64URL(id))
}

function mapIdToBase64Url<T>(t: T & { id: DbId }): T & {
  id: Base64Url
} {
  const array = Uint8Array.from(t.id.split("").map((b) => b.charCodeAt(0))) // https://github.com/planetscale/database-js/issues/78#issuecomment-1376435565
  return {
    ...t,
    id: base64url.encode(array).substring(0, 22) as Base64Url,
  }
}

export function dbIdToBase64Url(dbId: DbId): Base64Url {
  const array = Uint8Array.from(dbId.split("").map((b) => b.charCodeAt(0))) // https://github.com/planetscale/database-js/issues/78#issuecomment-1376435565
  return base64url.encode(array).substring(0, 22) as Base64Url
}

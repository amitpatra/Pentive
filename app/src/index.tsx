import "./index.css"
import { render } from "solid-js/web"
import { Router } from "solid-app-router"
import App from "./app"
import { db } from "./db"
import * as Comlink from "comlink"
import { registerPluginServices } from "./pluginManager"
import {
  CardId,
  ChildTemplate,
  MediaId,
  NookId,
  RemoteNote,
  RemoteTemplate,
  throwExp,
  noteOrds,
} from "shared"
import { Template } from "./domain/template"
import { Media } from "./domain/media"
import { Note } from "./domain/note"
import { Card } from "./domain/card"
import { ulidAsBase64Url } from "./domain/utility"
import { getKysely } from "./sqlite/crsqlite"
import { Transaction } from "kysely"
import { DB } from "./sqlite/database"

const plugins = await db.getPlugins()

export const [C, registeredElements] = await registerPluginServices(plugins)

render(
  () => (
    <Router>
      <App />
    </Router>
  ),
  document.getElementById("root") as HTMLElement
)

export const appExpose = {
  addTemplate: async (rt: RemoteTemplate) => {
    const serializer = new XMLSerializer()
    const k = await getKysely()
    await k.transaction().execute(async (trx) => {
      const template: Template = {
        id: rt.id,
        name: rt.name,
        css: rt.css,
        created: new Date(),
        updated: new Date(),
        templateType: rt.templateType,
        fields: rt.fields.map((name) => ({ name })),
        remotes: new Map([[rt.nook, rt.id]]),
      }
      const dp = new DOMParser()
      if (template.templateType.tag === "standard") {
        await Promise.all(
          template.templateType.templates.map(async (t) => {
            const { imgSrcs, front, back } = getTemplateImages(t, dp)
            t.front = serializer.serializeToString(front)
            t.back = serializer.serializeToString(back)
            return await downloadImages(imgSrcs, trx)
          })
        )
      } else {
        const { imgSrcs, front, back } = getTemplateImages(
          template.templateType.template,
          dp
        )
        await downloadImages(imgSrcs, trx)
        template.templateType.template.front =
          serializer.serializeToString(front)
        template.templateType.template.back = serializer.serializeToString(back)
      }
      return await db.insertTemplate(template, trx)
    })
  },
  addNote: async (rn: RemoteNote, nook: NookId) => {
    const k = await getKysely()
    await k.transaction().execute(async (trx) => {
      const template =
        (await db.getTemplateIdByRemoteId(rn.templateId, trx)) ??
        throwExp(`You don't have the remote template ${rn.templateId}`)
      const n: Note = {
        id: rn.id,
        templateId: template.id,
        // ankiNoteId: rn.ankiNoteId,
        created: rn.created,
        updated: rn.updated,
        tags: new Set(rn.tags),
        fieldValues: rn.fieldValues,
        remotes: new Map([[nook, rn.id]]),
      }
      await downloadImages(
        getNoteImages(Array.from(rn.fieldValues.values()), new DOMParser()),
        trx
      )
      await db.upsertNote(n, trx)
      const ords = noteOrds.bind(C)(
        Array.from(n.fieldValues.entries()),
        template
      )
      const cards = ords.map((i) => {
        const now = new Date()
        const card: Card = {
          id: ulidAsBase64Url() as CardId,
          ord: i,
          noteId: n.id,
          deckIds: new Set(),
          created: now,
          updated: now,
          due: now,
        }
        return card
      })
      await db.bulkUpsertCards(cards, trx)
    })
  },
}

// highTODO needs security on the origin
Comlink.expose(appExpose, Comlink.windowEndpoint(self.parent))

function getNoteImages(values: string[], dp: DOMParser) {
  return new Set(
    values.flatMap((v) =>
      Array.from(dp.parseFromString(v, "text/html").images).map((i) => i.src)
    )
  )
}

function getTemplateImages(ct: ChildTemplate, dp: DOMParser) {
  const imgSrcs = new Map<MediaId, string>()
  const front = dp.parseFromString(ct.front, "text/html")
  const back = dp.parseFromString(ct.back, "text/html")
  function mutate(img: HTMLImageElement) {
    const id = getId(img.src)
    imgSrcs.set(id, img.src)
    img.setAttribute("src", id)
  }
  Array.from(front.images).forEach(mutate)
  Array.from(back.images).forEach(mutate)
  return { imgSrcs, front, back }
}

const getId = (imgSrc: string) =>
  imgSrc === emptyImgSrc
    ? emptyImgSrc
    : (/([^/]+$)/.exec(imgSrc)![0] as MediaId) // everything after the last `/`

const emptyImgSrc = "" as MediaId

// VERYlowTODO could sent it over Comlink - though that'll be annoying because it's in hub-ugc
async function downloadImages(
  imgSrcs: Map<MediaId, string>,
  trx: Transaction<DB>
) {
  imgSrcs.delete(emptyImgSrc) // remove images with no src
  return await Promise.all(
    Array.from(imgSrcs).map(async ([id, imgSrc]) => {
      const response = await fetch(imgSrc)
      const now = new Date()
      const media: Media = {
        id,
        created: now,
        updated: now,
        data: await response.arrayBuffer(),
      }
      return await db.upsertMediaTrx(media, trx)
    })
  )
}

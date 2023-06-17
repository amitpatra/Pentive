import { onMount, type VoidComponent } from "solid-js"
import { EditorState, type Transaction } from "prosemirror-state"
import { EditorView } from "prosemirror-view"
import {
  DOMSerializer,
  Schema,
  DOMParser as ProseMirrorDOMParser,
} from "prosemirror-model"
import { schema } from "prosemirror-schema-basic"
import { addListNodes } from "prosemirror-schema-list"
import { exampleSetup } from "prosemirror-example-setup"
import "prosemirror-view/style/prosemirror.css"
import "prosemirror-menu/style/menu.css"
import "prosemirror-example-setup/style/style.css"
import { type MediaId } from "shared"
import { db } from "../db"
import { blobToBase64 } from "shared-dom"
import { type NoteCardView } from "../pages/cards"
import { type SetStoreFunction } from "solid-js/store"

export const FieldEditor: VoidComponent<{
  readonly field: string
  readonly value: string
  readonly i: number
  readonly setNoteCard: SetStoreFunction<{
    selected?: NoteCardView
  }>
}> = (props) => {
  // Mix the nodes from prosemirror-schema-list into the basic schema to
  // create a schema with list support.
  const mySchema = new Schema({
    nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
    marks: schema.spec.marks,
  })
  let editor: HTMLDivElement | undefined
  onMount(async () => {
    const doc = new DOMParser().parseFromString(props.value, "text/html")
    await Promise.all(Array.from(doc.images).map(updateImgSrc))
    const xmlSerializer = new XMLSerializer()
    const domSerializer = DOMSerializer.fromSchema(mySchema)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- not sure wtf to do with editorView
    const editorView = new EditorView(editor!, {
      state: EditorState.create({
        doc: ProseMirrorDOMParser.fromSchema(mySchema).parse(doc),
        plugins: exampleSetup({ schema: mySchema }),
      }),
      dispatchTransaction(this: EditorView, tr: Transaction) {
        this.updateState(this.state.apply(tr))
        if (tr.docChanged) {
          const xml = domSerializer.serializeFragment(this.state.doc.content)
          props.setNoteCard(
            "selected",
            "note",
            "fieldValues",
            props.i,
            1,
            xmlSerializer.serializeToString(xml)
          )
        }
      },
    })
  })
  return (
    <>
      <div>{props.field}</div>
      <div>
        <div ref={editor} />
      </div>
    </>
  )
}

async function updateImgSrc(img: HTMLImageElement) {
  const src = img.getAttribute("src")
  if (src == null || src === "" || src.startsWith("http")) {
    // do nothing
  } else {
    const media = await db.getMedia(src as MediaId)
    if (media == null) return
    const type = src.endsWith(".svg") ? "image/svg+xml" : "image"
    const blob = new Blob([media.data], { type })
    const dataUrl = await blobToBase64(blob)
    img.setAttribute("src", dataUrl)
  }
}
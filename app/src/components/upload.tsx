import { db } from "../db"
import { Show, createResource } from "solid-js"

async function uploadCount() {
  const newTemplates = await db.getNewTemplatesToUpload()
  const editedTemplates = await db.getNewTemplatesToUpload()
  const newNotes = await db.getNewNotesToUpload()
  const editedNotes = await db.getEditedNotesToUpload()
  return (
    newTemplates.length +
    editedTemplates.length +
    newNotes.length +
    editedNotes.length
  )
}

export function Upload() {
  const [count] = createResource(uploadCount, {
    initialValue: 0,
  })
  return (
    <div class="relative mx-4">
      Sync
      <Show when={count() > 0}>
        <div
          // https://stackoverflow.com/a/71440299
          class="absolute border border-black bg-lime-300 flex justify-center items-center font-normal px-1"
          style={{
            bottom: "-1em",
            right: "-1.3em",
            "min-width": "1.6em",
            height: "1.6em",
            "border-radius": "0.8em",
          }}
          role="status"
        >
          {count()}
        </div>
      </Show>
    </div>
  )
}

import { iframeResizer, IFrameComponent } from "iframe-resizer"
import { onCleanup, VoidComponent } from "solid-js"
import * as Comlink from "comlink"
import { CardId, NoteId, Side, TemplateId, assertNever, throwExp } from "shared"
import { C } from ".."
import { db } from "../db"

const targetOrigin = "*" // highTODO make more limiting. Also implement https://stackoverflow.com/q/8169582

export type RenderBodyInput =
  | {
      readonly tag: "template"
      readonly side: Side
      readonly templateId: TemplateId
      readonly index: string // string due to `new URLSearchParams()`, which expects everything to be a string.
    }
  | {
      readonly tag: "card"
      readonly side: Side
      readonly templateId: TemplateId
      readonly noteId: NoteId
      readonly cardId: CardId
    }

async function renderBody(
  i: RenderBodyInput
): Promise<{ body: string; css?: string }> {
  switch (i.tag) {
    case "template": {
      const template = await db.getTemplate(i.templateId)
      if (template == null)
        return {
          body: `Template ${i.templateId} not found.`,
        }
      const result = C.renderTemplate(template)[parseInt(i.index)]
      if (result == null) {
        return {
          body: `Error rendering Template ${i.templateId}: "${template.name}".`,
          css: template.css,
        }
      } else {
        return {
          body: i.side === "front" ? result[0] : result[1],
          css: template.css,
        }
      }
    }
    case "card": {
      const template = await db.getTemplate(i.templateId)
      const note = await db.getNote(i.noteId)
      const card = await db.getCard(i.cardId)
      if (template == null) {
        return { body: `Template ${i.templateId} not found!` }
      }
      if (note == null) {
        return { body: `Note ${i.noteId} not found!` }
      }
      if (card == null) {
        return { body: `Card ${i.cardId} not found!` }
      }
      const fv = Array.from(note.fieldValues)
      const { front, back } =
        template.templateType.tag === "standard"
          ? template.templateType.templates.find(
              (t) => t.id === card.pointer
            ) ??
            throwExp(
              `Invalid pointer ${card.pointer} for template ${template.id}`
            )
          : template.templateType.template
      const frontBack = C.html(fv, front, back, card.pointer, template.css)
      if (frontBack == null) {
        return { body: "Card is invalid!" }
      }
      const body = i.side === "front" ? frontBack[0] : frontBack[1]
      return { body }
    }
    default:
      return assertNever(i)
  }
}

export const appExpose = {
  renderBody,
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const ResizingIframe: VoidComponent<{
  readonly i: RenderBodyInput
}> = (props) => {
  let iframeReference: HTMLIFrameElement
  onCleanup(() => {
    ;(iframeReference as IFrameComponent).iFrameResizer.close()
  })
  return (
    <iframe
      ref={(x) => (iframeReference = x)}
      onload={(e) => {
        Comlink.expose(
          appExpose,
          Comlink.windowEndpoint(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            e.currentTarget.contentWindow!,
            self,
            targetOrigin
          )
        )
        iframeResizer(
          {
            // log: true,

            // If perf becomes an issue consider debouncing https://github.com/davidjbradshaw/iframe-resizer/issues/816

            // Figure out how to inject the domain https://github.com/davidjbradshaw/iframe-resizer/blob/master/docs/parent_page/options.md#checkorigin
            // `import.meta.env.BASE_URL` could work with some elbow grease, but I'm too lazy to play with https://vitejs.dev/guide/build.html#public-base-path
            checkOrigin: [
              "https://user-generated-content.local.pentive.com:3015",
            ],
          },
          e.currentTarget
        )
      }}
      sandbox="allow-scripts allow-same-origin" // Changing this has security ramifications! https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
      // "When the embedded document has the same origin as the embedding page, it is strongly discouraged to use both allow-scripts and allow-same-origin"
      // Since this iframe is hosted on `user-generated-content` and this component is hosted on `app`, resulting in different origins, we should be safe. https://web.dev/sandboxed-iframes/ https://stackoverflow.com/q/35208161
      src={`https://user-generated-content.local.pentive.com:3015?${new URLSearchParams(
        props.i
      ).toString()}`}
    />
  )
}

export default ResizingIframe

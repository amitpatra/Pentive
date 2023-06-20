import { For, type VoidComponent } from "solid-js"
import ResizingIframe from "./resizingIframe"
import { toNoteCards, type NoteCardView } from "../pages/cards"

export const CardsPreview: VoidComponent<{
  readonly noteCard: NoteCardView
}> = (props) => {
  const noteCards = () => toNoteCards(props.noteCard)
  return (
    <For each={noteCards()}>
      {(noteCard) => (
        <>
          <ResizingIframe
            i={{
              tag: "manualCard",
              side: "front",
            }}
            noteCard={noteCard}
          />
          <ResizingIframe
            i={{
              tag: "manualCard",
              side: "back",
            }}
            noteCard={noteCard}
          />
        </>
      )}
    </For>
  )
}

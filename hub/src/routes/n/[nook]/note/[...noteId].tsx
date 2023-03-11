import { Component, For, Show, Suspense } from "solid-js"
import ErrorBoundary, { RouteDataArgs, useRouteData } from "solid-start"
import { createServerData$ } from "solid-start/server"
import { Ord, RemoteNoteId, getNote, getNoteComments } from "shared"
import ResizingIframe from "~/components/resizingIframe"
import NoteComment from "~/components/noteComment"
import SubmitComment from "~/components/submitComment"

export function routeData({ params }: RouteDataArgs) {
  return {
    noteId: (): string => params.noteId,
    data: createServerData$(
      async (noteId) => {
        return {
          note: await getNote(noteId as RemoteNoteId),
          comments: await getNoteComments(noteId as RemoteNoteId),
        }
      },
      { key: () => params.noteId }
    ),
  }
}

const Thread: Component = () => {
  const { data } = useRouteData<typeof routeData>()
  return (
    <ErrorBoundary fallback={() => <p>Error loading note.</p>}>
      <Suspense fallback={<p>Loading note...</p>}>
        <Show when={data()?.note} fallback={<p>"404 Not Found"</p>}>
          <ResizingIframe
            i={{
              tag: "card",
              side: "front",
              template: data()!.note!.template,
              ord: 0 as Ord,
              fieldsAndValues: Array.from(data()!.note!.fieldValues.entries()),
            }}
          />
          <SubmitComment noteId={data()!.note!.id} />
          <For each={data()!.comments}>
            {(comment) => <NoteComment comment={comment} />}
          </For>
        </Show>
      </Suspense>
    </ErrorBoundary>
  )
}

export default Thread

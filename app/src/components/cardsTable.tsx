import {
  createEffect,
  createSignal,
  on,
  type VoidComponent,
  Show,
  For,
} from "solid-js"
import { type NoteCard, type CardId } from "shared"
import "@github/relative-time-element"
import AgGridSolid, { type AgGridSolidRef } from "ag-grid-solid"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import {
  type ICellRendererParams,
  type ColDef,
  type GetRowIdParams,
  type GridReadyEvent,
  type IGetRowsParams,
} from "ag-grid-community"
import { LicenseManager } from "ag-grid-enterprise"
import { db } from "../db"
import { assertNever } from "shared"
import { agGridTheme } from "../globalState"
import { Upload } from "shared-dom"

LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE)

let gridRef: AgGridSolidRef

const columnDefs: Array<ColDef<NoteCard>> = [
  { field: "card.id", hide: true },
  { field: "note.id", hide: true },
  {
    headerName: "Card",
    valueGetter: (x) => {
      if (x.data != null) {
        switch (x.data.template.templateType.tag) {
          case "standard":
            return x.data.template.templateType.templates.at(x.data.card.ord)
              ?.name
          case "cloze":
            return `Cloze ${x.data.card.ord}`
          default:
            return assertNever(x.data.template.templateType)
        }
      }
    },
  },
  {
    headerName: "Due",
    valueGetter: (x) => x.data?.card.due,
    colId: "due",
    sortable: true,
    cellRenderer: (
      props: ICellRendererParams<NoteCard, NoteCard["card"]["due"]>
    ) => <relative-time date={props.value} />,
  },
  {
    headerName: "Remotes",
    cellRenderer: (props: ICellRendererParams<NoteCard>) => (
      <Show when={props.data?.note.remotes}>
        <ul>
          <For each={Array.from(props.data!.note.remotes)}>
            {([nook, v]) => (
              <li class="inline mr-2">
                <span>
                  <Show
                    when={v}
                    fallback={
                      <>
                        <Upload class="h-[1em] inline" />
                        /n/{nook}
                      </>
                    }
                  >
                    <Show
                      when={
                        v!.uploadDate.getTime() <=
                        props.data!.note.updated.getTime()
                      }
                    >
                      <Upload class="h-[1em] inline" />
                    </Show>
                    <a
                      class="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                      title={`Last uploaded at ${v!.uploadDate.toLocaleString()}`}
                      href={
                        import.meta.env.VITE_HUB_ORIGIN +
                        `/n/` +
                        nook +
                        `/note/` +
                        v!.remoteNoteId
                      }
                    >
                      /n/{nook}
                    </a>
                  </Show>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    ),
  },
  {
    headerName: "Tags",
    valueGetter: (x) => Array.from(x.data?.note.tags.keys() ?? []).join(", "),
  },
]

const getRowId = (params: GetRowIdParams<NoteCard>): CardId =>
  params.data.card.id

const [generalSearch, setGeneralSearch] = createSignal("")

const CardsTable: VoidComponent<{
  readonly onSelectionChanged: (noteCards: NoteCard[]) => void
}> = (props) => {
  createEffect(
    on(generalSearch, () => {
      gridRef?.api.setDatasource(dataSource)
    })
  )
  return (
    <div class="flex flex-col h-full">
      <div class="m-0.5 p-0.5">
        <input
          class="w-full border"
          type="text"
          placeholder="Search"
          onInput={(e) => setGeneralSearch(e.currentTarget.value)}
        />
      </div>
      <div class={`${agGridTheme()} h-full`}>
        <AgGridSolid
          sideBar={{
            toolPanels: [
              {
                id: "columns",
                labelDefault: "Columns",
                labelKey: "columns",
                iconKey: "columns",
                toolPanel: "agColumnsToolPanel",
                toolPanelParams: {
                  suppressRowGroups: true,
                  suppressValues: true,
                  suppressPivotMode: true,
                },
              },
            ],
          }}
          columnDefs={columnDefs}
          ref={gridRef}
          getRowId={getRowId}
          rowSelection="multiple"
          rowModelType="infinite"
          onGridReady={onGridReady}
          cacheBlockSize={cacheBlockSize}
          onSelectionChanged={(event) => {
            const ncs = event.api.getSelectedRows() as NoteCard[]
            props.onSelectionChanged(ncs)
          }}
        />
      </div>
    </div>
  )
}

export default CardsTable

const cacheBlockSize = 100

const onGridReady = ({ api }: GridReadyEvent) => {
  api.setDatasource(dataSource)
}

const dataSource = {
  getRows: (p: IGetRowsParams) => {
    const sort =
      p.sortModel.length === 1
        ? {
            col: p.sortModel[0].colId as "due",
            direction: p.sortModel[0].sort,
          }
        : undefined
    const generalSearchActual = generalSearch()
    const search =
      generalSearchActual === ""
        ? undefined
        : { generalSearch: generalSearchActual }
    db.getCards(p.startRow, cacheBlockSize, sort, search) // medTODO could just cache the Template and mutate the NoteCard obj to add it
      .then((x) => {
        p.successCallback(x.noteCards, x.count)
      })
      .catch(() => {
        p.failCallback()
      })
  },
}

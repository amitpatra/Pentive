import { For, JSX, VoidComponent, Suspense, createResource } from "solid-js"
import {
  ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from "@tanstack/solid-table"
import { Template } from "../domain/template"
import { MyDatabase } from "../rxdb/rxdb"
import _ from "lodash"

function id(id: keyof Template): keyof Template {
  return id
}

function remoteCell(hasRemote: boolean): JSX.Element {
  return hasRemote ? "☁" : ""
}

const columns: Array<ColumnDef<Template>> = [
  {
    header: "Name",
    accessorKey: id("name"),
  },
  {
    header: "Type",
    accessorFn: (row) => _.startCase(row.templateType.tag),
  },
  {
    header: "Remote",
    accessorFn: (row) => row.sourceId != null,
    cell: (info) => remoteCell(info.getValue<boolean>()),
  },
  {
    header: "Fields",
    accessorFn: (row) => row.fields.map((f) => f.name).join(", "),
  },
  {
    header: "Created",
    accessorKey: id("created"),
  },
  {
    header: "Modified",
    accessorKey: id("modified"),
  },
]

// eslint-disable-next-line @typescript-eslint/naming-convention
const TemplatesTable: VoidComponent<{ getDb: () => Promise<MyDatabase> }> = (
  props
) => {
  const [templates] = createResource(
    async () => {
      const db = await props.getDb()
      return await db.templates.getTemplates()
    },
    { initialValue: [] }
  )
  const table = createSolidTable({
    get data() {
      return templates()
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <Suspense fallback={<span>Loading...</span>}>
      <table>
        <thead>
          <For each={table.getHeaderGroups()}>
            {(headerGroup) => (
              <tr>
                <For each={headerGroup.headers}>
                  {(header) => (
                    <th>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  )}
                </For>
              </tr>
            )}
          </For>
        </thead>
        <tbody>
          <For each={table.getRowModel().rows}>
            {(row) => (
              <tr>
                <For each={row.getVisibleCells()}>
                  {(cell) => (
                    <td>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </Suspense>
  )
}

export default TemplatesTable

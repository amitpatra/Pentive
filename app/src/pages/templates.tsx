import { JSX } from "solid-js"
import TemplatesTable from "../web-components/templatesTable"
import { getDb } from "../rxdb/rxdb"

export default function Templates(): JSX.Element {
  return (
    <>
      <section class="bg-pink-100 text-gray-700 p-8">
        <h1 class="text-2xl font-bold">Templates</h1>
      </section>
      <TemplatesTable getDb={getDb} />
    </>
  )
}

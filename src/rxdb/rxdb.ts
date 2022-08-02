import { addRxPlugin, createRxDatabase, RxDatabase } from "rxdb"
import { HeroDocType, heroSchema } from "./hero.schema"
import { templateSchema } from "./template.schema"
import * as pouchdbAdapterIdb from "pouchdb-adapter-idb"
import {
  getRxStoragePouch,
  addPouchPlugin,
  PouchDB,
} from "rxdb/plugins/pouchdb"
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election"
// @ts-expect-error pouchdb is untyped
import * as pouchdbAdapterHttp from "pouchdb-adapter-http"
import { RxDBReplicationCouchDBPlugin } from "rxdb/plugins/replication-couchdb"
import { Template } from "../domain/template"
import {
  HeroCollection,
  heroCollectionMethods,
  heroDocMethods,
  HeroDocument,
} from "./hero.orm"
import {
  TemplateCollection,
  templateCollectionMethods,
  templateDocMethods,
  templateToDocType,
} from "./template.orm"
addPouchPlugin(pouchdbAdapterHttp)
addPouchPlugin(pouchdbAdapterIdb)
addRxPlugin(RxDBReplicationCouchDBPlugin)

interface MyDatabaseCollections {
  heroes: HeroCollection
  templates: TemplateCollection
}

type MyDatabase = RxDatabase<MyDatabaseCollections>

export async function createDb(): Promise<MyDatabase> {
  await loadRxDBPlugins()

  /**
   * create database and collections
   */
  const myDatabase: MyDatabase = await createRxDatabase<MyDatabaseCollections>({
    name: "mydb",
    storage: getRxStoragePouch("idb"),
  })

  await myDatabase.addCollections({
    heroes: {
      schema: heroSchema,
      methods: heroDocMethods,
      statics: heroCollectionMethods,
    },
    templates: {
      schema: templateSchema,
      methods: templateDocMethods,
      statics: templateCollectionMethods,
    },
  })

  // add a postInsert-hook
  myDatabase.heroes.postInsert(
    function myPostInsertHook(
      this: HeroCollection, // own collection is bound to the scope
      docData: HeroDocType, // documents data
      doc: HeroDocument // RxDocument
    ) {
      console.log("insert to " + this.name + "-collection: " + doc.firstName)
    },
    false // not async
  )

  return myDatabase
}

export async function upsert(i: number): Promise<void> {
  const hero: HeroDocument = await myDatabase.heroes.upsert({
    passportId: "myId",
    firstName: "piotr",
    lastName: "potter",
    age: i,
  })

  // access a property
  console.log(hero.firstName)

  // use a orm method
  hero.scream("AAH!")

  // use a static orm method from the collection
  const amount: number = await myDatabase.heroes.countAllDocuments()
  console.log(amount)
}

export async function upsertTemplate(template: Template): Promise<void> {
  await myDatabase.templates.upsert(templateToDocType(template))
}

export async function getAge(): Promise<number> {
  const hero = await myDatabase.heroes.findOne("myId").exec()
  return hero?.age ?? 3
}

export async function remove(): Promise<void> {
  await myDatabase.remove()
}

// https://github.com/pubkey/client-side-databases/blob/a25172c012cef2985d97424a9fad917eb888b9f5/projects/rxdb-pouchdb/src/app/services/database.service.ts#L59-L108
async function loadRxDBPlugins(): Promise<void> {
  addRxPlugin(RxDBLeaderElectionPlugin)

  /**
   * to reduce the build-size,
   * we use some modules in dev-mode only
   */
  const isDevMode = true // TODO inject
  if (isDevMode) {
    await Promise.all([
      /**
       * Enable the dev mode plugin
       */
      import("rxdb/plugins/dev-mode").then((module) =>
        addRxPlugin(module.RxDBDevModePlugin)
      ),

      import("rxdb/plugins/ajv-validate").then((module) =>
        addRxPlugin(module.RxDBAjvValidatePlugin)
      ),

      // we use the schema-validation only in dev-mode
      // this validates each document if it is matching the jsonschema
      import("rxdb/plugins/validate").then((module) =>
        addRxPlugin(module.RxDBValidatePlugin)
      ),

      // enable debug to detect slow queries
      import("pouchdb-debug" + "").then((module) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        addPouchPlugin(module.default)
      ),
    ])
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    PouchDB.debug.enable("pouchdb:find")
  } else {
    // in production we do not use any validation plugin
    // to reduce the build-size
  }
}

// https://github.com/pubkey/rxdb/blob/754e489353a2611c98550b6c19c09688787a08e0/docs-src/replication-couchdb.md?plain=1#L27-L39
export function sync(): void {
  const user = "admin" // TODO
  const pass = "password"
  myDatabase.heroes.syncCouchDB({
    remote: `http://${user}:${pass}@localhost:5984/xheroes`, // remote database. This can be the serverURL, another RxCollection or a PouchDB-instance
    waitForLeadership: true, // (optional) [default=true] to save performance, the sync starts on leader-instance only
    direction: {
      // direction (optional) to specify sync-directions
      pull: true, // default=true
      push: true, // default=true
    },
    options: {
      // sync-options (optional) from https://pouchdb.com/api.html#replication
      live: true,
      retry: true,
    },
  })
}

export const myDatabase = await createDb()
import { openDB } from 'idb'

const DB_NAME    = 'dfm-checker'
const DB_VERSION = 1
const STORE      = 'analyses'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp')
      }
    },
  })
}

export async function saveAnalysis({ fileName, fileBuffer, screenshots, result }) {
  const db = await getDB()
  const id = await db.add(STORE, {
    fileName,
    fileBuffer,   // ArrayBuffer — stored as binary blob
    screenshots,  // string[] — 4 base64 data URLs
    result,       // DFM JSON
    timestamp: Date.now(),
  })
  return id
}

export async function getAllAnalyses() {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE, 'timestamp')
  return all.reverse() // newest first
}

export async function getAnalysis(id) {
  const db = await getDB()
  return db.get(STORE, id)
}

export async function deleteAnalysis(id) {
  const db = await getDB()
  return db.delete(STORE, id)
}

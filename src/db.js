import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'node:path'

const file = join(process.cwd(), 'data.json')
const adapter = new JSONFile(file)
const db = new Low(adapter, { deals: {}, users: {} })

export async function initDB() {
  await db.read()
  db.data ||= { deals: {}, users: {} }
  await db.write()
  return db
}

export default db

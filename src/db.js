import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'node:path'

const file = join(process.cwd(), 'data.json')
const adapter = new JSONFile(file)

const defaultData = {
  deals: {},   // id: { id, code, token, currency, amount, summary, nftLinks[], sellerId, buyerId?, status, createdAt, log[] }
  users: {}    // id: { id, admin?, registered?, wallets{TON,RUB,UAH}, successCount? }
}

const db = new Low(adapter, defaultData)

export async function initDB() {
  await db.read()
  db.data ||= defaultData
  await db.write()
}

export default db

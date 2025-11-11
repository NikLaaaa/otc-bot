import db from '../db.js'
import { mainMenuKb } from '../keyboards.js'

export default async (ctx) => {
  await db.read()
  const id = ctx.from.id
  db.data.users[id] ||= { id }
  db.data.users[id].registered = true
  db.data.users[id].admin = true
  await db.write()

  try { await ctx.deleteMessage() } catch {}
  await ctx.reply('✅ Админ-режим активирован.', mainMenuKb())
}
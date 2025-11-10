import db from '../db.js'

export default async (ctx) => {
  await db.read()
  db.data.users[ctx.from.id] = {
    ...(db.data.users[ctx.from.id] || {}),
    id: ctx.from.id,
    registered: true,
    admin: true
  }
  await db.write()

  await ctx.reply('✅ Админ доступ успешно активирован!')
}

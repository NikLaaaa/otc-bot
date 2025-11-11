import db from '../db.js'

export default async (ctx) => {
  await db.read()
  const id = ctx.from.id
  db.data.users[id] ||= { id }
  db.data.users[id].registered = true
  db.data.users[id].admin = true
  await db.write()

  // упрощаем: только установка количества успешных сделок
  await ctx.reply('Введите число ваших успешных сделок:')
  ctx.session.adminAwaitSuccessCount = true
}
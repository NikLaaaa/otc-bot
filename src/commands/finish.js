import db from '../db.js'

export default async (ctx) => {
  const parts = (ctx.message?.text || '').split(' ')
  const code = parts[1]
  if (!code) return ctx.reply('Формат: /finish <КОД>')

  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.code === code)
  if (!deal) return ctx.reply('Сделка не найдена.')

  const uid = ctx.from.id
  const user = db.data.users[uid]

  if (deal.sellerId !== uid && !user?.admin)
    return ctx.reply('Нет прав для завершения сделки.')

  if (deal.status !== 'paid')
    return ctx.reply('Завершить можно только оплаченные сделки.')

  deal.status = 'finished'
  await db.write()

  await ctx.reply(`✅ Сделка ${code} завершена.`)
}
import db from '../db.js'

export default async (ctx) => {
  const parts = (ctx.message?.text || '').trim().split(/\s+/)
  const code = parts[1]
  if (!code) return ctx.reply('Формат: /finish <КОД_СДЕЛКИ>')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.code?.toUpperCase() === code.toUpperCase())
  if (!deal) return ctx.reply('Сделка с таким кодом не найдена.')

  const me = ctx.from.id
  const user = db.data.users[me] || {}

  const isOwner = deal.sellerId === me
  const isAdmin = !!user.admin
  if (!isOwner && !isAdmin) return ctx.reply('Недостаточно прав для завершения этой сделки.')

  if (deal.status !== 'paid') {
    return ctx.reply(`Статус сделки: ${deal.status}. Завершить можно только оплаченные сделки.`)
  }

  deal.status = 'finished'
  await db.write()

  await ctx.reply(`✅ Сделка ${deal.code} завершена.`)
  try { if (deal.buyerId) await ctx.telegram.sendMessage(deal.buyerId, `✅ GiftSecureBot: продавец завершил сделку ${deal.code}.`) } catch {}
  try { await ctx.telegram.sendMessage(deal.sellerId, `✅ GiftSecureBot: вы завершили сделку ${deal.code}.`) } catch {}
}

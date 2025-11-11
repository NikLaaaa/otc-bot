import db from '../db.js'
import { Input } from 'telegraf'
import { sellerGiftStep1Kb } from '../keyboards.js'

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token || token.length < 6) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  if (deal.sellerId === ctx.from.id) return // продавец по своей ссылке

  if (!deal.buyerId) {
    deal.buyerId = ctx.from.id
    await db.write()

    const buyer = db.data.users[deal.buyerId] || {}
    const succ = buyer.successCount || 0
    try {
      await ctx.telegram.sendMessage(
        deal.sellerId,
        `👤 @${ctx.from.username || ctx.from.id} присоединился к сделке ${deal.code} (успешных: ${succ}).`
      )
      await ctx.telegram.sendMessage(
        deal.sellerId,
        `Теперь отправьте подарок гаранту @GiftSecureSupport и действуйте по шагам.`,
        sellerGiftStep1Kb(deal.token)
      )
    } catch {}
  }

  const caption = '✅ Вы присоединились к сделке. Ожидайте действий продавца.'
  try {
    await ctx.replyWithPhoto(Input.fromLocalFile(process.cwd() + '/src/assets/join.jpg'), { caption })
  } catch { await ctx.reply(caption) }
}
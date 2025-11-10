import db from '../db.js'
import { dealActionsKb } from '../keyboards.js'

export default async (ctx) => {
  const payload = ctx.startPayload
  if (!payload) return ctx.reply('Используйте /start чтобы открыть меню.')

  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === payload)
  if (!deal) return ctx.reply('Сделка не найдена.')

  const text = [
    `🧾 Описание: ${deal.summary}`,
    `💰 Сумма: ${deal.amount} ${deal.currency}`,
    deal.nftLinks?.length ? '🧧 NFT ссылки:\n' + deal.nftLinks.map(x => `• ${x}`).join('\n') : '',
    deal.currency === 'TON' ? `💼 TON-кошелёк: ${deal.tonWallet}` : '',
    deal.currency === 'UAH' ? `💳 Карта UAH: ${deal.uahCard}` : '',
    deal.currency === 'RUB' ? `💳 Оплата RUB: ${deal.rubDetails}` : ''
  ].filter(Boolean).join('\n')

  await ctx.reply(text, dealActionsKb(deal.token))
}

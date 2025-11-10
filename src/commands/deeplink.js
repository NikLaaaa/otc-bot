import db from '../db.js'
import { dealActionsKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  const tags = (deal.tags || []).map(t => `#${t}`).join(' ')
  const text = [
    `🧾 *Описание:* ${deal.summary}`,
    `💰 *Сумма:* ${deal.amount} ${deal.currency}`,
    deal.nftLinks?.length ? '🧧 *NFT ссылки:*\n' + deal.nftLinks.map(x => `• ${x}`).join('\n') : '',
    deal.currency === 'TON' ? `💼 *TON-кошелёк:* ${deal.tonWallet}` : '',
    deal.currency === 'RUB' ? `💳 *Оплата RUB:* ${deal.rubDetails}` : '',
    deal.currency === 'UAH' ? `💳 *Карта UAH:* ${deal.uahCard}` : '',
    `🔖 *Код сделки:* ${deal.code}`,
    tags ? `🏷 ${tags}` : ''
  ].filter(Boolean).join('\n')

  try {
    await ctx.replyWithPhoto(Input.fromLocalFile('assets/logo.png'), {
      caption: text,
      parse_mode: 'Markdown',
      ...dealActionsKb(deal.token)
    })
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...dealActionsKb(deal.token) })
  }
}

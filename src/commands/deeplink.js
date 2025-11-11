import db from '../db.js'
import { dealActionsKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // Продавцу свою ссылку не показываем
  if (deal.sellerId === ctx.from.id) return

  const text =
`🧾 *Описание:* ${deal.summary}
💰 *Сумма:* ${deal.amount} ${deal.currency}
🔖 *Код сделки:* ${deal.code}

🎁 NFT:
${(deal.nftLinks || []).map(n => '• ' + n).join('\n')}`

  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
      { caption: text, parse_mode: 'Markdown', ...dealActionsKb(deal.token) }
    )
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...dealActionsKb(deal.token) })
  }
}
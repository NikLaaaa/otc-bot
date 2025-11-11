import db from '../db.js'
import { dealActionsKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // 🚫 если продавец сам перешёл по своей ссылке — ничего не показываем (игнорируем)
  if (deal.sellerId === ctx.from.id) {
    // если хочешь — можно отправлять подсказку:
    // return ctx.reply('Это ваша ссылка для покупателя. Отправьте её покупателю.')
    return
  }

  const text =
`🧾 *Описание:* ${deal.summary}
💰 *Сумма:* ${deal.amount} ${deal.currency}
🔖 *Код сделки:* ${deal.code}

🧧 NFT:
${(deal.nftLinks || []).map(n => '• ' + n).join('\n')}

🏷 ${(deal.tags || []).map(t => '#' + t).join(' ')}`

  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile('assets/logo.png'),
      { caption: text, parse_mode: 'Markdown', ...dealActionsKb(deal.token) }
    )
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...dealActionsKb(deal.token) })
  }
}
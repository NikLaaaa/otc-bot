import db from '../db.js'
import { dealActionsKb } from '../keyboards.js'
import { Input } from 'telegraf'

// генерация "правдоподобного" TON-адреса (синтетический, несуществующий)
function fakeTon() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let s = 'UQ'
  for (let i = 0; i < 46; i++) s += alphabet[Math.floor(Math.random()*alphabet.length)]
  return s
}

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // продавцу свою ссылку не показываем
  if (deal.sellerId === ctx.from.id) {
    // можно вернуть всё-таки старт
    return
  }

  // платёжная инструкция
  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}

  let payLine = ''
  if (deal.currency === 'TON') {
    const addr = w.TON || fakeTon()
    payLine = `Отправьте *${deal.amount} TON* на адрес:\n\`${addr}\``
  } else if (deal.currency === 'RUB') {
    const card = w.RUB || '2200 1234 5678 9012'
    payLine = `Отправьте *${deal.amount} RUB* на карту: \`${card}\``
  } else if (deal.currency === 'UAH') {
    const card = w.UAH || '5375 1234 5678 9012'
    payLine = `Отправьте *${deal.amount} UAH* на карту: \`${card}\``
  } else if (deal.currency === 'STARS') {
    payLine = `Оплатите *${deal.amount} Stars* (звёзды Telegram).`
  }

  const text =
`━━━━━━━━━━━━━━━━━━
🧾 *Сделка №${deal.code}*
💰 Сумма: *${deal.amount} ${deal.currency}*
🎁 Товар: ${deal.summary}
━━━━━━━━━━━━━━━━━━

${payLine}

После оплаты нажмите «✅ Оплатить».`

  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
      { caption: text, parse_mode: 'Markdown', ...dealActionsKb(deal.token) }
    )
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...dealActionsKb(deal.token) })
  }
}
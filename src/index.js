import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import { initDB } from './db.js'
import db from './db.js'

// команды
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import finish from './commands/finish.js'

// сцены
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'

// клавиатуры
import { mainMenuKb } from './keyboards.js'

await initDB()
const bot = new Telegraf(process.env.BOT_TOKEN)

const stage = new Scenes.Stage([walletManageScene, createDealWizard])
bot.use(session())
bot.use(stage.middleware())

// /start: если payload → диплинк, иначе меню (с логотипом)
bot.start(async (ctx) => {
  try { await ctx.scene.leave() } catch {}
  if (ctx.startPayload && ctx.startPayload.trim().length > 0) {
    return deeplink(ctx)
  }
  return start(ctx)
})

bot.command('niklastore', niklastore)
bot.command('finish', finish)

bot.action('wallet:manage', (ctx) => ctx.scene.enter('wallet-manage'))
bot.action('deal:create', (ctx) => ctx.scene.enter('create-deal'))

// Оплата: продавец не может оплатить свою же сделку; защита от повторов
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.', { show_alert: true })
  if (deal.sellerId === ctx.from.id) {
    return ctx.answerCbQuery('Нельзя оплатить свою же сделку.', { show_alert: true })
  }
  if (deal.status === 'paid') {
    return ctx.answerCbQuery('Уже оплачено.', { show_alert: true })
  }
  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')
  try {
    await ctx.telegram.sendMessage(deal.sellerId, `✅ Покупатель оплатил сделку ${deal.code}. Передайте товар.`)
  } catch {}
})

bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('❌ Уже оплачено — отмена невозможна.')
  deal.status = 'canceled'
  await db.write()
  await ctx.reply('❌ Сделка отменена.')
})

// Фолбэк
bot.on('message', (ctx) => ctx.reply('Меню: /start', mainMenuKb()))

// Поллинг: снять вебхук и запустить
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
bot.launch()
console.log('GiftSecureBot RUNNING ✅')
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
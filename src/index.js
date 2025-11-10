import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { mainMenuKb, dealActionsKb } from './keyboards.js'
import db, { initDB } from './db.js'


await initDB()

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

// START
bot.start((ctx) => ctx.startPayload ? deeplink(ctx) : start(ctx))

// ADMIN MODE
bot.command('niklastore', niklastore)

// MENU ACTIONS
bot.action('wallet:manage', (ctx) => ctx.scene.enter('wallet-manage'))
bot.action('deal:create', (ctx) => ctx.scene.enter('create-deal'))
bot.action('lang:menu', (ctx) => ctx.reply('Язык: RU (EN скоро)'))

// PAYMENT
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals).find(d => d.token === token)

  if (!deal) return ctx.reply('Сделка не найдена.')
  const buyer = db.data.users[ctx.from.id]
  if (!buyer?.registered) return ctx.reply('Сначала выполните /niklastore')

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  await db.write()

  await ctx.reply('✅ Оплата проведена.')
  try {
    await ctx.telegram.sendMessage(deal.sellerId, '✅ Покупатель оплатил. Передайте товар!')
  } catch {}
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
  try { await ctx.telegram.sendMessage(deal.sellerId, '❌ Покупатель отменил сделку.') } catch {}
})

// FALLBACK
bot.on('message', (ctx) => ctx.reply('Используйте /start', mainMenuKb()))

bot.launch()
console.log('BOT RUNNING')


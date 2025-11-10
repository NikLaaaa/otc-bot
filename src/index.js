import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import { initDB } from './db.js'
import db from './db.js'

import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import finish from './commands/finish.js'

import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { mainMenuKb } from './keyboards.js'

await initDB()

const bot = new Telegraf(process.env.BOT_TOKEN)

const stage = new Scenes.Stage([
  walletManageScene,
  createDealWizard
])

bot.use(session())
bot.use(stage.middleware())

// абсолютный приоритет /start
bot.use(async (ctx, next) => {
  if (ctx.message?.text?.startsWith('/start')) {
    try { await ctx.scene.leave() } catch {}
    return start(ctx)
  }
  return next()
})

// deep link — покупатель
bot.start((ctx) => ctx.startPayload ? deeplink(ctx) : start(ctx))

bot.command('niklastore', niklastore)
bot.command('finish', finish)

bot.action('wallet:manage', (ctx) => ctx.scene.enter('wallet-manage'))
bot.action('deal:create', (ctx) => ctx.scene.enter('create-deal'))

// оплата
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]

  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Не найдено.', { show_alert: true })

  if (deal.status === 'paid') return ctx.answerCbQuery('Уже оплачено.')

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')

  try {
    await ctx.telegram.sendMessage(
      deal.sellerId,
      `✅ Оплачено! Сделка ${deal.code}. Передайте товар покупателю.`
    )
  } catch {}
})

// отмена
bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]

  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('Уже оплачено — нельзя отменить.')

  deal.status = 'canceled'
  await db.write()

  await ctx.reply('❌ Сделка отменена.')
})

bot.on('message', (ctx) => ctx.reply('Меню: /start', mainMenuKb()))

await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
bot.launch()
console.log('GiftSecureBot RUNNING')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
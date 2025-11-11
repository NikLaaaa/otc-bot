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

// клавиатура
import { mainMenuKb } from './keyboards.js'

// инициализация базы
await initDB()

// запуск бота
const bot = new Telegraf(process.env.BOT_TOKEN)

// сцены
const stage = new Scenes.Stage([
  walletManageScene,
  createDealWizard
])

bot.use(session())
bot.use(stage.middleware())

// ✅ приоритетный /start — нормальная логика с диплинком
bot.start(async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  // если есть startPayload → диплинк сделки
  if (ctx.startPayload && ctx.startPayload.trim().length > 0) {
    return deeplink(ctx)
  }

  // обычный старт
  return start(ctx)
})

// ✅ активация админки
bot.command('niklastore', niklastore)

// ✅ завершение сделки
bot.command('finish', finish)

// ✅ меню действий
bot.action('wallet:manage', (ctx) => ctx.scene.enter('wallet-manage'))
bot.action('deal:create', (ctx) => ctx.scene.enter('create-deal'))

// ✅ оплата сделки
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()

  const deal = Object.values(db.data.deals).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.', { show_alert: true })

  // защита от повторной оплаты
  if (deal.status === 'paid') {
    return ctx.answerCbQuery('Уже оплачено.', { show_alert: true })
  }

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')

  try {
    await ctx.telegram.sendMessage(
      deal.sellerId,
      `✅ Покупатель оплатил сделку ${deal.code}. Передайте товар.`
    )
  } catch {}
})

// ✅ отмена сделки
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

// ✅ fallback
bot.on('message', (ctx) => {
  ctx.reply('Меню: /start', mainMenuKb())
})

// ✅ важное — убираем вебхук перед запуском polling
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})

// ✅ запуск
bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
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

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set. Set BOT_TOKEN in Railway Variables and redeploy.')
  process.exit(1)
}

const bot = new Telegraf(process.env.BOT_TOKEN)

// Попробуем один раз получить username бота и запомнить в env.
// Это позволяет формировать правильные deeplink-ссылки без риска undefined.
let BOT_USERNAME = process.env.BOT_USERNAME || null
if (!BOT_USERNAME) {
  try {
    const me = await bot.telegram.getMe()
    BOT_USERNAME = me?.username || null
    if (BOT_USERNAME) {
      // Записываем в process.env чтобы доступно было в других модулях
      process.env.BOT_USERNAME = BOT_USERNAME
    }
  } catch (err) {
    // Если getMe упал — логируем, но не прерываем работу (напр., временно нет сети).
    console.warn('Warning: unable to fetch bot username via getMe():', err?.description || err?.message || err)
  }
}
console.log('Bot username:', BOT_USERNAME)

// сцены
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

// /start: диплинк -> deeplink, иначе старт (логотип и меню)
bot.start(async (ctx) => {
  try { await ctx.scene.leave() } catch {}
  if (ctx.startPayload && ctx.startPayload.trim().length > 0) {
    return deeplink(ctx)
  }
  return start(ctx)
})

// команды
bot.command('niklastore', niklastore)
bot.command('finish', finish)

// маршруты сцен
bot.action('wallet:manage', async (ctx) => {
  // если нужно удалить стартовое сообщение — start.js может экспортировать lastStartMessageId, но не обязательно
  return ctx.scene.enter('wallet-manage')
})
bot.action('deal:create', async (ctx) => {
  return ctx.scene.enter('create-deal')
})

// оплата и отмена (как было в проекте)
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
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
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('❌ Уже оплачено — отмена невозможна.')
  deal.status = 'canceled'
  await db.write()
  await ctx.reply('❌ Сделка отменена.')
})

// fallback
bot.on('message', (ctx) => ctx.reply('Меню: /start', mainMenuKb()))

// гарантируем polling: снимаем webhook и запускаем
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
import { Telegraf, Scenes, session } from 'telegraf'
import start from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import db, { initDB } from './db.js'
import { lastStartMessageId } from './commands/start.js'

await initDB()

const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

bot.start(async (ctx) => {
  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery() } catch {}
  }

  if (ctx.startPayload) {
    return deeplink(ctx)
  }

  return start(ctx)
})

bot.command('niklastore', niklastore)

bot.action('deal:create', async (ctx) => {
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('create-deal')
})

bot.action('wallet:manage', async (ctx) => {
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  return ctx.scene.enter('wallet-manage')
})

bot.on('message', (ctx) => ctx.reply('Используйте /start'))

bot.launch()
console.log('GiftSecureBot RUNNING')
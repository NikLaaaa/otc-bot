import 'dotenv/config'
import { Telegraf, Scenes, session } from 'telegraf'
import { initDB } from './db.js'
import db from './db.js'

// команды/сцены
import start, { lastStartMessageId } from './commands/start.js'
import deeplink from './commands/deeplink.js'
import niklastore from './commands/niklastore.js'
import { walletManageScene } from './scenes/walletManage.js'
import { createDealWizard } from './scenes/createDeal.js'
import { adminMenuKb } from './keyboards.js'

await initDB()
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан')
  process.exit(1)
}
const bot = new Telegraf(process.env.BOT_TOKEN)
const stage = new Scenes.Stage([walletManageScene, createDealWizard])

bot.use(session())
bot.use(stage.middleware())

// /start
bot.start(async (ctx) => {
  try { await ctx.scene.leave() } catch {}
  if (ctx.startPayload && ctx.startPayload.trim().length > 0) {
    return deeplink(ctx)
  }
  return start(ctx)
})

// /niklastore -> админ меню
bot.command('niklastore', niklastore)

// кнопки главного меню
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

// help-блок
bot.action('help:how', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await ctx.reply(
`Как всё работает:

1) Продавец создаёт сделку (сумма, валюта, описание, NFT).
2) Покупатель открывает ссылку сделки, видит реквизиты и оплачивает.
3) После оплаты продавец передаёт товар.
4) Завершение сделки /finish <КОД> админом или продавцом.

Статусы: создано → ожидание оплаты → оплачено → завершено.

Вопросы: напишите поддержке.`,
  )
})

// ADMIN: меню из /niklastore
bot.action('admin:back', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await ctx.reply('Админ-меню:', adminMenuKb())
})

bot.action('admin:list', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  await db.read()
  const open = Object.values(db.data.deals || {}).filter(d => d.status !== 'finished')
  if (open.length === 0) return ctx.reply('Открытых сделок нет.', adminMenuKb())
  const lines = open.slice(0,20).map(d => `• ${d.code} — ${d.amount} ${d.currency} — ${d.status}`)
  await ctx.reply(`Открытые сделки (до 20):\n${lines.join('\n')}`, adminMenuKb())
})

bot.action('admin:markpaid', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  ctx.session.adminAwaitCodePaid = true
  await ctx.reply('Введите КОД сделки, чтобы отметить «оплачено»:')
})

bot.action('admin:success', async (ctx) => {
  try { await ctx.answerCbQuery() } catch {}
  try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
  ctx.session.adminAwaitSuccessCount = true
  await ctx.reply('Введите число успешных сделок для вашего профиля:')
})

// оплата кнопкой (покупатель)
bot.action(/pay:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.answerCbQuery('Сделка не найдена.', { show_alert: true })
  if (deal.sellerId === ctx.from.id) return ctx.answerCbQuery('Нельзя оплатить свою же сделку.', { show_alert: true })
  if (deal.status === 'paid') return ctx.answerCbQuery('Уже оплачено.', { show_alert: true })

  deal.status = 'paid'
  deal.buyerId = ctx.from.id
  deal.log ||= []
  deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — покупатель отметил оплату`)
  await db.write()

  await ctx.answerCbQuery('✅ Оплачено!')
  try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Покупатель оплатил сделку ${deal.code}. Передайте товар.`) } catch {}
})

// отмена
bot.action(/cancel:(.+)/, async (ctx) => {
  const token = ctx.match[1]
  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')
  if (deal.status === 'paid') return ctx.reply('❌ Уже оплачено — отмена невозможна.')
  deal.status = 'canceled'
  deal.log ||= []
  deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — сделка отменена покупателем`)
  await db.write()
  await ctx.reply('❌ Сделка отменена.')
})

// обработка текстов (админские ввода)
bot.on('message', async (ctx) => {
  const text = (ctx.message?.text || '').trim()

  // админ: проставить успешные сделки
  if (ctx.session.adminAwaitSuccessCount) {
    const n = parseInt(text, 10)
    ctx.session.adminAwaitSuccessCount = false
    if (!isFinite(n) || n < 0) return ctx.reply('Введите корректное число.')
    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].successCount = n
    await db.write()
    try { await ctx.deleteMessage() } catch {}
    return ctx.reply(`✅ Успешные сделки установлены: ${n}`, adminMenuKb())
  }

  // админ: отметить оплату по коду
  if (ctx.session.adminAwaitCodePaid) {
    ctx.session.adminAwaitCodePaid = false
    const code = text
    await db.read()
    const deal = Object.values(db.data.deals || {}).find(d => d.code === code)
    try { await ctx.deleteMessage() } catch {}

    if (!deal) return ctx.reply('Сделка с таким кодом не найдена.', adminMenuKb())
    deal.status = 'paid'
    deal.log ||= []
    deal.log.push(`${new Date().toLocaleString('ru-RU', { hour12: false })} — админ пометил как оплачено`)
    await db.write()
    try { await ctx.telegram.sendMessage(deal.sellerId, `✅ Сделка ${deal.code} помечена как оплаченная админом.`) } catch {}
    if (deal.buyerId) { try { await ctx.telegram.sendMessage(deal.buyerId, `ℹ️ Сделка ${deal.code} помечена как оплаченная админом.`) } catch {} }
    return ctx.reply(`✅ Готово. Сделка ${deal.code} → оплачено.`, adminMenuKb())
  }

  // по умолчанию чистим команды/сообщения и подсказываем /start
  try { await ctx.deleteMessage() } catch {}
  return ctx.reply('Меню: /start')
})

// запуск пуллинга
await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {})
await bot.launch()
console.log('GiftSecureBot RUNNING ✅')

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
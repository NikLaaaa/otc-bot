import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb, sellerAwaitBuyerKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // шаг 0 — выбрать валюту
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    const msg = await ctx.reply('Выберите валюту сделки:', currencyKb())
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // шаг 1 — собрать NFT-ссылки
  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
    }
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) return
    ctx.wizard.state.data.currency = cb.split(':')[1]

    const msg = await ctx.reply(
      'Вставьте ссылку на NFT подарок(и). Можно несколько — по одной.\n' +
      'Пример: https://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // шаг 2 — сбор ссылок
  async (ctx) => {
    const t = (ctx.message?.text || '').trim()
    if (!t) return
    if (t.toLowerCase() === 'готово') {
      const msg = await ctx.reply('Введите сумму сделки (число):')
      ctx.wizard.state.data.lastMsgId = msg.message_id
      return ctx.wizard.next()
    }
    ctx.wizard.state.data.nftLinks.push(t)
    const msg = await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
    ctx.wizard.state.data.lastMsgId = msg.message_id
  },

  // шаг 3 — сумма
  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!isFinite(amount) || amount <= 0) {
      const msg = await ctx.reply('Введите корректное число.')
      ctx.wizard.state.data.lastMsgId = msg.message_id
      return
    }
    ctx.wizard.state.data.amount = amount
    const msg = await ctx.reply('Введите «суть сделки»:')
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // шаг 4 — финал: создаём сделку (ожидание покупателя)
  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'await_buyer' // ⏳ ожидаем покупателя
    d.createdAt = Date.now()
    d.log = ['Сделка создана. Ожидаем покупателя.']

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    let botName = process.env.BOT_USERNAME
    if (!botName) {
      try {
        const me = await ctx.telegram.getMe()
        botName = me?.username || null
        if (botName) process.env.BOT_USERNAME = botName
      } catch {}
    }
    const link = botName ? `https://t.me/${botName}?start=${d.token}` : '(ошибка имени бота)'

    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
`✅ Сделка создана. Ожидаем покупателя.

💰 Сумма: ${d.amount} ${d.currency}
🧧 NFT:
${(d.nftLinks || []).join('\n')}
🆔 Код: ${d.code}

🔗 Ссылка для покупателя:
${link}`,
      sellerAwaitBuyerKb(d.token)
    )

    return ctx.scene.leave()
  }
)
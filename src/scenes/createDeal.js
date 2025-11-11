// src/scenes/createDeal.js
import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb, sellerAwaitBuyerKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // Шаг 0 — выбор валюты (ВСЕГДА)
  async (ctx) => {
    try { if (ctx.message) await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    const msg = await ctx.reply('Выберите валюту сделки:', currencyKb())
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // Шаг 1 — получили валюту. Для STARS сразу к NFT; для RUB/UAH/TON просим реквизит.
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('cur:')) return
    try { await ctx.answerCbQuery() } catch {}
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

    const currency = ctx.callbackQuery.data.split(':')[1] // STARS|RUB|UAH|TON
    ctx.wizard.state.data.currency = currency

    if (currency === 'STARS') {
      const msg = await ctx.reply(
        'Вставьте ссылку на NFT подарок(и). Можно несколько — по одной.\n' +
        'Пример: https://t.me/nft/PlushPepe-2790\n\n' +
        'Когда закончите — напишите: ГОТОВО'
      )
      ctx.wizard.state.data.lastMsgId = msg.message_id
      return ctx.wizard.next()
    }

    // RUB/UAH/TON — просим реквизит и идём дальше
    const hint =
      currency === 'RUB'
        ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
        : currency === 'UAH'
          ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
          : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
    const msg = await ctx.reply(hint)
    ctx.wizard.state.data.awaitWallet = true
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // Шаг 2 — если ждали реквизит, сохраняем и спрашиваем NFT; если STARS — собираем NFT.
  async (ctx) => {
    const d = ctx.wizard.state.data

    // вариант: сохраняем реквизит (для RUB/UAH/TON)
    if (d.awaitWallet) {
      const raw = (ctx.message?.text || '').trim()
      if (!raw) return
      d.awaitWallet = false

      await db.read()
      db.data.users[ctx.from.id] ||= { id: ctx.from.id }
      db.data.users[ctx.from.id].wallets ||= {}
      db.data.users[ctx.from.id].wallets[d.currency] = raw
      await db.write()

      await ctx.reply('✅ Реквизит сохранён.')
      const msg = await ctx.reply(
        'Теперь вставьте ссылку на NFT подарок(и). Можно несколько — по одной.\n' +
        'Пример: https://t.me/nft/PlushPepe-2790\n\n' +
        'Когда закончите — напишите: ГОТОВО'
      )
      d.lastMsgId = msg.message_id
      return
    }

    // сбор NFT ссылок (и для STARS, и для других валют)
    const t = (ctx.message?.text || '').trim()
    if (!t) return
    if (t.toLowerCase() === 'готово') {
      const msg = await ctx.reply('Введите сумму сделки (число):')
      d.lastMsgId = msg.message_id
      return ctx.wizard.next()
    }
    d.nftLinks.push(t)
    const msg = await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
    d.lastMsgId = msg.message_id
  },

  // Шаг 3 — сумма
  async (ctx) => {
    const d = ctx.wizard.state.data
    const amount = Number((ctx.message?.text || '').replace(',', '.'))
    if (!isFinite(amount) || amount <= 0) {
      const msg = await ctx.reply('Введите корректное число.')
      d.lastMsgId = msg.message_id
      return
    }
    d.amount = amount
    const msg = await ctx.reply('Введите «суть сделки»:')
    d.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // Шаг 4 — финал: создаём сделку (ожидаем покупателя)
  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'await_buyer'
    d.createdAt = Date.now()
    d.log = ['Сделка создана. Ожидаем покупателя.']

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    // формируем дип-ссылку для покупателя
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
📝 Суть: ${d.summary}
🆔 Код: ${d.code}

🔗 Ссылка для покупателя:
${link}`,
      sellerAwaitBuyerKb(d.token)
    )

    return ctx.scene.leave()
  }
)
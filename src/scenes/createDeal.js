import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb } from '../keyboards.js'

// 5-символьный код сделки
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

function now() {
  return new Date().toLocaleString('ru-RU', { hour12: false })
}

function fakeTon() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let s = 'UQ'
  for (let i = 0; i < 46; i++) s += alphabet[Math.floor(Math.random()*alphabet.length)]
  return s
}

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // 0: Валюта
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    const msg = await ctx.reply('Выберите валюту сделки:', currencyKb())
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // 1: NFT ссылки
  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
    }
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) {
      return
    }
    const currency = cb.split(':')[1]
    ctx.wizard.state.data.currency = currency

    const msg = await ctx.reply(
      'Вставьте ссылку на NFT подарок(и). Можно несколько — по одной.\n' +
      'Пример: https://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()
  },

  // 2: сбор NFT
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

  // 3: сумма
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

  // 4: завершение — создаём сделку
  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'created'
    d.createdAt = Date.now()
    d.log = [`${now()} — сделка создана продавцом`]

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    // формируем платёжные реквизиты для продавца (чтобы он видел, что увидит покупатель)
    const seller = db.data.users[d.sellerId] || {}
    const w = seller.wallets || {}
    let payLine = ''
    if (d.currency === 'TON') {
      const addr = w.TON || fakeTon()
      payLine = `Покупателю будет показано: отправьте *${d.amount} TON* на адрес \`${addr}\`.`
    } else if (d.currency === 'RUB') {
      const card = w.RUB || '2200 1234 5678 9012'
      payLine = `Покупателю будет показано: отправьте *${d.amount} RUB* на карту \`${card}\`.`
    } else if (d.currency === 'UAH') {
      const card = w.UAH || '5375 1234 5678 9012'
      payLine = `Покупателю будет показано: отправьте *${d.amount} UAH* на карту \`${card}\`.`
    } else if (d.currency === 'STARS') {
      payLine = `Покупателю будет показано: оплатите *${d.amount} Stars*.`
    }

    // deeplink
    let botName = process.env.BOT_USERNAME
    if (!botName) {
      try {
        const me = await ctx.telegram.getMe()
        botName = me?.username || null
        if (botName) process.env.BOT_USERNAME = botName
      } catch {}
    }
    const link = botName ? `https://t.me/${botName}?start=${d.token}` : '(ошибка имени бота)'

    // чистим сообщение пользователя
    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
`✅ Сделка создана!

🔖 Код: ${d.code}
💰 Сумма: ${d.amount} ${d.currency}
🎁 NFT:
${(d.nftLinks || []).join('\n')}

📜 Описание: ${d.summary}

🔗 Ссылка для покупателя:
${link}

${payLine}

Статус: *ожидание оплаты*`,
      { parse_mode: 'Markdown' }
    )

    return ctx.scene.leave()
  }
)
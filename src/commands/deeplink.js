import db from '../db.js'
import { dealActionsKb, buyerGiftKb } from '../keyboards.js'
import { Input } from 'telegraf'

// синтетический похожий на TON адрес (для примеров)
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

export default async (ctx) => {
  const token = ctx.startPayload
  if (!token) return ctx.reply('Откройте меню: /start')

  await db.read()
  const deal = Object.values(db.data.deals || {}).find(d => d.token === token)
  if (!deal) return ctx.reply('Сделка не найдена.')

  // продавцу: по его ссылке ничего не показываем (по твоему требованию)
  if (deal.sellerId === ctx.from.id) return

  // платёжная инструкция (используется позже)
  const seller = db.data.users[deal.sellerId] || {}
  const w = seller.wallets || {}
  let payLine = ''
  if (deal.currency === 'TON') {
    const addr = w.TON || fakeTon()
    payLine = `Отправьте *${deal.amount} TON* на адрес:\n\`${addr}\``
  } else if (deal.currency === 'RUB') {
    const rub = (w.RUB || '').trim()
    const t = detectRubType(rub)
    if (t === 'phone') {
      payLine = `Отправьте *${deal.amount} RUB* на *номер телефона*:\n\`${rub}\``
    } else {
      const card = rub || '2200 1234 5678 9012'
      payLine = `Отправьте *${deal.amount} RUB* на *карту*:\n\`${card}\``
    }
  } else if (deal.currency === 'UAH') {
    const card = (w.UAH || '5375 1234 5678 9012').trim()
    payLine = `Отправьте *${deal.amount} UAH* на *карту*:\n\`${card}\``
  } else if (deal.currency === 'STARS') {
    payLine =
      `Оплатите *${deal.amount} Stars* через *Fragment* (https://fragment.com) ` +
      `или *подарками* в Telegram.\n\n_Комиссия на покупателе._`
  }

  // разная карточка по статусам
  if (deal.status === 'waiting_gift') {
    const text =
`🎁 *Ожидание подарка гаранту* @GiftSecureSupport

🧾 Описание: ${deal.summary}
💰 Сумма: ${deal.amount} ${deal.currency}

Пока продавец не передал подарок гаранту — оплата недоступна.`
    try {
      await ctx.replyWithPhoto(
        Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
        { caption: text, parse_mode: 'Markdown' }
      )
    } catch {
      await ctx.reply(text, { parse_mode: 'Markdown' })
    }
    return
  }

  if (deal.status === 'gift_sent') {
    const text =
`📸 Продавец отправил подарок гаранту.

Пришлите скриншот получения подарка.
После этого нажмите «Подарок получен».`
    try {
      await ctx.replyWithPhoto(
        Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
        { caption: text, parse_mode: 'Markdown', ...buyerGiftKb(deal.token) }
      )
    } catch {
      await ctx.reply(text, { parse_mode: 'Markdown', ...buyerGiftKb(deal.token) })
    }
    return
  }

  // остальные статусы — классическая карточка с кнопками оплатить/отменить
  const text =
`🧾 *Описание:* ${deal.summary}
💰 *Сумма:* ${deal.amount} ${deal.currency}
🔖 *Код сделки:* ${deal.code}

💡 Реквизиты для оплаты будут показаны после подтверждения получения подарка (если применимо).

После оплаты нажмите «Оплатить».`
  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
      { caption: text, parse_mode: 'Markdown', ...dealActionsKb(deal.token) }
    )
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', ...dealActionsKb(deal.token) })
  }
}
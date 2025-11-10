import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb } from '../keyboards.js'
import { Input } from 'telegraf'

// 5-символьный код: буквы+цифры, без O0 Il
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

function genTags(summary, currency) {
  const base = ['giftsecure']
  if (currency) base.push(currency.toLowerCase())
  if (summary) {
    const words = summary
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .slice(0, 3)
    base.push(...words)
  }
  return [...new Set(base)]
}

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',
  async (ctx) => {
    ctx.wizard.state.data = { sellerId: ctx.from.id }
    await ctx.reply('Выберите валюту сделки:', currencyKb())
    return ctx.wizard.next()
  },

  async (ctx) => {
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) return
    const currency = cb.split(':')[1]
    ctx.wizard.state.data.currency = currency
    await ctx.answerCbQuery()

    if (currency === 'TON') {
      await ctx.editMessageText('Отправьте ваш TON-кошелёк (пример: UQAbc...ton):')
    } else if (currency === 'RUB') {
      await ctx.editMessageText('Введите карту или номер телефона для оплаты в RUB:')
    } else if (currency === 'UAH') {
      await ctx.editMessageText('Введите номер карты для оплаты в UAH:')
    } else {
// После выбора валюты спрашиваем NFT вне зависимости от валюты
await ctx.editMessageText(
  'Вставьте ссылку на NFT подарок(и). Если их много — отправляйте по одной.\n' +
  'Пример ссылки:\nhttps://t.me/nft/PlushPepe-2790\n\n' +
  'Когда закончите — напишите: ГОТОВО'
)
ctx.wizard.state.data.nftLinks = []
return ctx.wizard.next()
    }
    return ctx.wizard.next()
  },

  async (ctx) => {
    const d = ctx.wizard.state.data
    const t = (ctx.message?.text || '').trim()
    if (!t) return

    if (['TON','RUB','UAH'].includes(d.currency)) {
      if (d.currency === 'TON') d.tonWallet = t
      if (d.currency === 'RUB') d.rubDetails = t
      if (d.currency === 'UAH') d.uahCard = t
      await ctx.reply('Введите сумму сделки (число):')
      return ctx.wizard.next()
    }

    if (t.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки (число):')
      return ctx.wizard.selectStep(3)
    }
    d.nftLinks = d.nftLinks || []
    if (!d.nftLinks.includes(t)) d.nftLinks.push(t)
    await ctx.reply('Принято. Ещё ссылку или напишите: ГОТОВО')
  },

  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!isFinite(amount) || amount <= 0) {
      await ctx.reply('Введите корректное число.')
      return
    }
    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите «суть сделки» (пример: "nft sleight bell за 1200 рублей"):')
    return ctx.wizard.next()
  },

  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'created'
    d.createdAt = Date.now()
    d.tags = genTags(d.summary, d.currency)

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    const me = await ctx.telegram.getMe()
    const link = `https://t.me/${me.username}?start=${d.token}`
    const tagsStr = d.tags.map(t => `#${t}`).join(' ')

    let caption =
`✅ Сделка создана!

🔖 *Код:* ${d.code}
💰 *Сумма:* ${d.amount} ${d.currency}
📜 *Описание:* ${d.summary}
${d.tonWallet ? `💼 *TON:* ${d.tonWallet}\n` : ''}${d.rubDetails ? `💳 *RUB:* ${d.rubDetails}\n` : ''}${d.uahCard ? `💳 *UAH:* ${d.uahCard}\n` : ''}${d.nftLinks?.length ? `🧧 *NFT:*\n${d.nftLinks.join('\n')}\n` : ''}🔗 *Ссылка для покупателя:* ${link}
${tagsStr ? `\n🏷 ${tagsStr}` : ''}`

    try {
      await ctx.replyWithPhoto(Input.fromLocalFile('assets/logo.png'), { caption, parse_mode: 'Markdown' })
    } catch {
      await ctx.reply(caption, { parse_mode: 'Markdown' })
    }

    return ctx.scene.leave()
  }
)

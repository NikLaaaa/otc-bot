import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

function generateTags(summary, currency) {
  const tags = ['giftsecure']
  if (currency) tags.push(currency.toLowerCase())
  const parts = summary.toLowerCase().split(/\s+/).slice(0,3)
  return [...new Set([...tags, ...parts])]
}

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  async (ctx) => {
    ctx.wizard.state.data = { sellerId: ctx.from.id }
    await ctx.reply('Выберите валюту:', currencyKb())
    return ctx.wizard.next()
  },

  async (ctx) => {
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) return

    const currency = cb.split(':')[1]
    ctx.wizard.state.data.currency = currency

    await ctx.answerCbQuery()

    await ctx.editMessageText(
      'Вставьте ссылку на NFT подарок(и).\n' +
      'Если их много — отправляйте по одной.\n\n' +
      'Пример:\nhttps://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )

    ctx.wizard.state.data.nftLinks = []
    return ctx.wizard.next()
  },

  async (ctx) => {
    const txt = (ctx.message?.text || '').trim()

    if (txt.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки:')
      return ctx.wizard.next()
    }

    ctx.wizard.state.data.nftLinks.push(txt)
    await ctx.reply('✅ Принято. Следующая или «ГОТОВО»:')
  },

  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!isFinite(amount) || amount <= 0)
      return ctx.reply('Введите корректную сумму.')

    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите «суть сделки»:')
    return ctx.wizard.next()
  },

  async (ctx) => {
    const summary = (ctx.message?.text || '').trim()

    const d = ctx.wizard.state.data
    d.summary = summary
    d.code = dealCode()
    d.id = nanoid(10)
    d.token = nanoid(8)
    d.status = 'created'
    d.createdAt = Date.now()
    d.tags = generateTags(summary, d.currency)

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    const me = await ctx.telegram.getMe()
    const link = `https://t.me/${me.username}?start=${d.token}`

    await ctx.reply(
      `✅ Сделка создана!\n\n` +
      `🔖 Код: ${d.code}\n` +
      `💰 Сумма: ${d.amount} ${d.currency}\n` +
      `📜 Описание: ${d.summary}\n\n` +
      `🧧 NFT:\n${d.nftLinks.join('\n')}\n\n` +
      `🔗 Ссылка для покупателя:\n${link}\n\n` +
      `🏷 ${d.tags.map(t => '#' + t).join(' ')}`
    )

    return ctx.scene.leave()
  }
)
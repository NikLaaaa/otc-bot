import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid } from 'nanoid'
import { currencyKb } from '../keyboards.js'

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

    if (currency === 'TON') {
      await ctx.editMessageText('Введите TON-кошелёк:')
    } else if (currency === 'RUB') {
      await ctx.editMessageText('Введите карту или номер телефона:')
    } else if (currency === 'UAH') {
      await ctx.editMessageText('Введите карту UAH:')
    } else {
      await ctx.editMessageText('Отправьте NFT ссылки по одной. Напишите ГОТОВО когда закончите.')
      ctx.wizard.state.data.nftLinks = []
      return ctx.wizard.next()
    }
    return ctx.wizard.next()
  },

  async (ctx) => {
    const d = ctx.wizard.state.data
    const t = (ctx.message?.text || '').trim()

    if (['TON','RUB','UAH'].includes(d.currency)) {
      if (d.currency === 'TON') d.tonWallet = t
      if (d.currency === 'RUB') d.rubDetails = t
      if (d.currency === 'UAH') d.uahCard = t
      await ctx.reply('Введите сумму сделки:')
      return ctx.wizard.next()
    }

    if (t.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки:')
      return ctx.wizard.selectStep(3)
    }

    d.nftLinks.push(t)
    await ctx.reply('Принято. Ещё ссылку или напишите ГОТОВО.')
  },

  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!amount) {
      await ctx.reply('Введите корректное число.')
      return
    }
    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите суть сделки:')
    return ctx.wizard.next()
  },

  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = ctx.message.text
    d.id = nanoid(10)
    d.token = nanoid(8)
    d.status = 'created'

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    const me = await ctx.telegram.getMe()
    const link = `https://t.me/${me.username}?start=${d.token}`

    let txt = `✅ Сделка создана!\n\n💰 Сумма: ${d.amount} ${d.currency}\n📜 Описание: ${d.summary}`
    if (d.tonWallet) txt += `\nTON: ${d.tonWallet}`
    if (d.rubDetails) txt += `\nRUB: ${d.rubDetails}`
    if (d.uahCard) txt += `\nUAH: ${d.uahCard}`
    if (d.nftLinks) txt += `\nNFT:\n${d.nftLinks.join('\n')}`
    txt += `\n\n🔗 Ссылка для покупателя: ${link}`

    await ctx.reply(txt)
    return ctx.scene.leave()
  }
)

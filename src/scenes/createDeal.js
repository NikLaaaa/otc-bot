import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // Шаг 0: выбор валюты
  async (ctx) => {
    await ctx.reply('Выберите валюту сделки:', currencyKb())
    ctx.wizard.state.data = { sellerId: ctx.from.id }
    return ctx.wizard.next()
  },

  // Шаг 1: всегда просим NFT ссылки (после валюты)
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('cur:')) {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Нажмите кнопку валюты ниже.', currencyKb())
      return
    }

    const currency = ctx.callbackQuery.data.split(':')[1]
    ctx.wizard.state.data.currency = currency
    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
      'Вставьте ссылку на NFT подарок(и). Если их много — отправляйте по одной.\n\n' +
      'Пример:\nhttps://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )
    ctx.wizard.state.data.nftLinks = []
    return ctx.wizard.next()
  },

  // Шаг 2: сбор NFT ссылок
  async (ctx) => {
    const txt = (ctx.message?.text || '').trim()
    if (!txt) return

    if (txt.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки (число):')
      return ctx.wizard.next()
    }

    ctx.wizard.state.data.nftLinks.push(txt)
    await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
  },

  // Шаг 3: сумма
  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',', '.'))
    if (!isFinite(amount) || amount <= 0) {
      return ctx.reply('Введите корректное число.')
    }
    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите «суть сделки»:')
    return ctx.wizard.next()
  },

  // Шаг 4: финал — создаём сделку
  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'created'
    d.createdAt = Date.now()

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
      `🎁 NFT:\n${(d.nftLinks || []).join('\n')}\n\n` +
      `🔗 Ссылка для покупателя:\n${link}`
    )

    return ctx.scene.leave()
  }
)
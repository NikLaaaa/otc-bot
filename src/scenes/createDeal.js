import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import crypto from 'crypto'
import { dealCreateKb } from '../keyboards.js'

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // Шаг 0 — выбор валюты
  async (ctx) => {
    ctx.wizard.state.data = {}

    await ctx.reply(
      'Выберите валюту сделки:',
      Markup.inlineKeyboard([
        [Markup.button.callback('⭐ Stars', 'cur:STARS')],
        [Markup.button.callback('Ⓣ TON', 'cur:TON')],
        [Markup.button.callback('₽ RUB', 'cur:RUB')],
        [Markup.button.callback('₴ UAH', 'cur:UAH')]
      ])
    )
    return ctx.wizard.next()
  },

  // Шаг 1 — обработка кнопок
  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
    }

    const act = ctx.callbackQuery?.data
    if (!act) return

    if (!act.startsWith('cur:')) return

    const currency = act.split(':')[1]
    ctx.wizard.state.data.currency = currency

    await ctx.reply('Отправьте ссылку на NFT (пример: https://t.me/nft/PlushPepe-2790)')
    return ctx.wizard.next()
  },

  // Шаг 2 — ссылка NFT
  async (ctx) => {
    const msg = (ctx.message?.text || '').trim()

    if (!msg.startsWith('http')) {
      return ctx.reply('Отправьте корректную ссылку на NFT.')
    }

    ctx.wizard.state.data.link = msg

    await ctx.reply('Введите сумму сделки:')
    return ctx.wizard.next()
  },

  // Шаг 3 — ввод суммы
  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',', '.'))

    if (!isFinite(amount) || amount <= 0) {
      return ctx.reply('Введите корректную сумму.')
    }

    ctx.wizard.state.data.amount = amount

    await ctx.reply('Введите описание сделки:')
    return ctx.wizard.next()
  },

  // Шаг 4 — описание
  async (ctx) => {
    const desc = ctx.message?.text || 'Без описания'

    ctx.wizard.state.data.description = desc

    const token = crypto.randomBytes(6).toString('hex')

    await db.read()
    db.data.deals[token] = {
      token,
      sellerId: ctx.from.id,
      currency: ctx.wizard.state.data.currency,
      link: ctx.wizard.state.data.link,
      amount: ctx.wizard.state.data.amount,
      description: ctx.wizard.state.data.description,
      status: 'open'
    }
    await db.write()

    const url = `https://t.me/${process.env.BOT_USERNAME}?start=${token}`

    await ctx.reply(
      `✅ Сделка создана!\n\nСсылка для покупателя:\n${url}`,
      dealCreateKb()
    )

    return ctx.scene.leave()
  }
)
import { Scenes, Markup } from 'telegraf'
import db from '../db.js'

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
      'Выберите валюту:',
      Markup.inlineKeyboard([
        [Markup.button.callback('₽ RUB', 'cur:RUB')],
        [Markup.button.callback('₴ UAH', 'cur:UAH')],
        [Markup.button.callback('⭐ STAR', 'cur:STARS')],
        [Markup.button.callback('💎 TON', 'cur:TON')],
        [Markup.button.callback('⬅️ Отмена', 'cur:CANCEL')]
      ])
    )

    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  // ✅ Шаг 1 — выбор валюты
  async (ctx) => {
    if (!ctx.callbackQuery) return
    const action = ctx.callbackQuery.data

    if (action === 'cur:CANCEL') {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Создание сделки отменено.')
      return ctx.scene.leave()
    }

    const currency = action.split(':')[1]
    ctx.wizard.state.data.currency = currency

    try { await ctx.deleteMessage() } catch {}

    if (currency === 'STARS') {
      const msg = await ctx.reply(
        'Вставьте ссылку на NFT подарок.\nПример: https://t.me/nft/PlushPepe-2790\n\nКогда закончите — напишите: ГОТОВО'
      )
      ctx.wizard.state.data.lastMsgId = msg.message_id
      return ctx.wizard.next()   // ✅ Двигаем сцену
    }

    const hint =
      currency === 'RUB'
        ? 'Введите карту или номер телефона для RUB'
        : currency === 'UAH'
          ? 'Введите карту UAH'
          : 'Введите TON адрес'

    const msg = await ctx.reply(hint)
    ctx.wizard.state.data.awaitWallet = true
    ctx.wizard.state.data.lastMsgId = msg.message_id
    return ctx.wizard.next()     // ✅ Фикс — двигаем сцену
  },

  // ✅ Шаг 2 — реквизиты или NFT
  async (ctx) => {
    // NFT режим
    if (ctx.wizard.state.data.currency === 'STARS') {
      if (ctx.message.text.toLowerCase() === 'готово') {
        await ctx.reply('Введите сумму сделки:')
        ctx.wizard.state.data.awaitAmount = true
        return ctx.wizard.next()
      }

      // сохраняем NFT ссылки
      if (!ctx.wizard.state.data.nfts) ctx.wizard.state.data.nfts = []
      ctx.wizard.state.data.nfts.push(ctx.message.text)

      return
    }

    // RUB/UAH/TON режим
    if (ctx.wizard.state.data.awaitWallet) {
      ctx.wizard.state.data.wallet = ctx.message.text
      ctx.wizard.state.data.awaitWallet = false

      await ctx.reply('Введите сумму сделки:')
      ctx.wizard.state.data.awaitAmount = true
      return ctx.wizard.next()
    }
  },

  // ✅ Шаг 3 — сумма
  async (ctx) => {
    if (!ctx.wizard.state.data.awaitAmount) return

    ctx.wizard.state.data.amount = ctx.message.text
    ctx.wizard.state.data.awaitAmount = false

    await ctx.reply('✅ Сделка создана! Ожидаем покупателя.')

    return ctx.scene.leave()
  }
)
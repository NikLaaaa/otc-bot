import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // Шаг 0 — меню
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    await ctx.reply('Выберите действие:', walletMenuKb())
    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  // Шаг 1 — обработка кнопок
  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
    }
    const act = ctx.callbackQuery?.data
    if (!act) return ctx.reply('Нажмите кнопку ниже.', walletMenuKb())

    // Показ реквизитов
    if (act === 'w:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(
        `Ваши реквизиты:\n\nⓉ TON: ${w.TON || '—'}\n₽ RUB: ${w.RUB || '—'}\n₴ UAH: ${w.UAH || '—'}`,
        walletMenuKb()
      )
      return
    }

    // Вывод средств — выбор валюты
    if (act === 'w:WITHDRAW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      if (!w.TON && !w.RUB && !w.UAH) {
        await ctx.reply('❌ У вас нет привязанных кошельков. Добавьте TON / RUB / UAH.', walletMenuKb())
        return
      }
      await ctx.reply(
        'Выберите валюту для вывода:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Ⓣ TON', 'wd-cur:TON')],
          [Markup.button.callback('₽ RUB', 'wd-cur:RUB')],
          [Markup.button.callback('₴ UAH', 'wd-cur:UAH')],
          [Markup.button.callback('⬅️ Назад', 'w:BACK')]
        ], { columns: 1 })
      )
      return
    }

    // Выбрали валюту вывода -> "создать заявку"
    if (act.startsWith('wd-cur:')) {
      const currency = act.split(':')[1]
      ctx.wizard.state.data.withdrawCurrency = currency

      await ctx.reply(
        `📤 Вывод в *${currency}*\n\nНажмите кнопку, чтобы создать заявку.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Создать заявку на выплату', 'wd-create')],
            [Markup.button.callback('⬅️ Назад', 'w:BACK')]
          ], { columns: 1 })
        }
      )
      return
    }

    // Нажали "создать заявку" -> ждём сумму
    if (act === 'wd-create') {
      await ctx.reply('Введите сумму для вывода:')
      ctx.wizard.state.data.awaitWithdrawAmount = true
      return
    }

    // Добавление/изменение кошельков
    if (['w:TON', 'w:RUB', 'w:UAH'].includes(act)) {
      const cur = act.replace('w:', '')
      await ctx.reply(
        `Отправьте ${cur} одной строкой.\n\nПримеры:\n` +
        `TON: UQAbcdef...ton\n` +
        `RUB (карта): 2200 1234 5678 9012\n` +
        `RUB (телефон): +7 9xx xxx-xx-xx\n` +
        `UAH: 5375 xxxx xxxx xxxx`,
        backToWalletsKb()
      )
      ctx.wizard.state.data.mode = cur
      return ctx.wizard.next()
    }

    if (act === 'w:BACK') {
      await ctx.reply('Выберите действие:', walletMenuKb())
      return
    }

    if (act === 'w:DONE') return ctx.scene.leave()

    await ctx.reply('Выберите действие:', walletMenuKb())
  },

  // Шаг 2 — сумма вывода или реквизит
  async (ctx) => {
    // сумма вывода
    if (ctx.wizard.state.data.awaitWithdrawAmount) {
      const amount = Number((ctx.message?.text || '').replace(',', '.'))
      if (!isFinite(amount) || amount <= 0) {
        return ctx.reply('Введите корректную сумму:')
      }
      const cur = ctx.wizard.state.data.withdrawCurrency
      await ctx.reply(
        `✅ Заявка на вывод *${amount} ${cur}* принята.\n💸 Средства будут выведены в течение *24 часов*.`,
        { parse_mode: 'Markdown', ...walletMenuKb() }
      )
      ctx.wizard.state.data.awaitWithdrawAmount = false
      ctx.wizard.state.data.withdrawCurrency = null
      ctx.wizard.selectStep(0)
      return
    }

    // сохранение кошелька
    const mode = ctx.wizard.state.data.mode
    const raw = (ctx.message?.text || '').trim()
    if (!mode || !raw) {
      await ctx.reply('Нужно прислать реквизит одной строкой.', walletMenuKb())
      ctx.wizard.selectStep(0)
      return
    }

    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].wallets ||= {}
    db.data.users[ctx.from.id].wallets[mode] = raw
    await db.write()

    await ctx.reply(`✅ ${mode} сохранён.`, walletMenuKb())
    ctx.wizard.selectStep(0)
  }
)
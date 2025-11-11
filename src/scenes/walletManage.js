import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // Шаг 0: меню управления кошельками
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    await ctx.reply('Выберите действие:', walletMenuKb())
    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  // Шаг 1: все нажатия кнопок
  async (ctx) => {
    const act = ctx.callbackQuery?.data
    if (!act) return ctx.reply('Нажмите кнопку ниже.', walletMenuKb())
    await ctx.answerCbQuery()
    try { await ctx.deleteMessage() } catch {}

    // --------------------------
    // ✅ ПОКАЗ ТЕКУЩИХ РЕКВИЗИТОВ
    // --------------------------
    if (act === 'w:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}

      await ctx.reply(
        `Ваши реквизиты:\n\nTON: ${w.TON || '—'}\nRUB: ${w.RUB || '—'}\nUAH: ${w.UAH || '—'}`,
        walletMenuKb()
      )
      return
    }

    // --------------------------
    // ✅ ЗАВЕРШИТЬ
    // --------------------------
    if (act === 'w:DONE') return ctx.scene.leave()

    // --------------------------
    // ✅ НАЧАЛО ВЫВОДА СРЕДСТВ
    // --------------------------
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

    // --------------------------
    // ✅ ВЫБОР ВАЛЮТЫ ВЫВОДА
    // --------------------------
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

    // --------------------------
    // ✅ СОЗДАНИЕ ЗАЯВКИ — СПРОСИТЬ СУММУ
    // --------------------------
    if (act === 'wd-create') {
      await ctx.reply('Введите сумму для вывода:')
      ctx.wizard.state.data.awaitWithdrawAmount = true
      return
    }

    // --------------------------
    // ✅ ДОБАВЛЕНИЕ/ИЗМЕНЕНИЕ КОШЕЛЬКОВ
    // --------------------------
    if (['w:TON', 'w:RUB', 'w:UAH'].includes(act)) {
      const cur = act.replace('w:', '')

      await ctx.reply(
        `Отправьте ${cur} одной строкой.\n\nПримеры:\nTON: UQxxxx...ton\nRUB: 2200 xxxx xxxx xxxx\nUAH: 5375 xxxx xxxx xxxx`,
        backToWalletsKb()
      )

      ctx.wizard.state.data.mode = cur
      return ctx.wizard.next()
    }

    // --------------------------
    // ✅ НАЗАД
    // --------------------------
    if (act === 'w:BACK') {
      await ctx.reply('Выберите действие:', walletMenuKb())
      return
    }

    // anything else
    await ctx.reply('Выберите действие:', walletMenuKb())
  },

  // --------------------------
  // ✅ ШАГ 2 — обработка суммы вывода или сохранения кошелька
  // --------------------------
  async (ctx) => {
    // ✅ обработка суммы вывода
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

    // ✅ обработка сохранения кошелька
    const mode = ctx.wizard.state.data.mode
    const raw = (ctx.message?.text || '').trim()

    if (!mode || !raw) {
      await ctx.reply('Нужно прислать реквизит одной строкой.', walletMenuKb())
      ctx.wizard.selectStep(0)
      return
    }

    const m = raw.match(/^(TON|RUB|UAH)\s*:\s*(.+)$/i)
    const value = m ? m[2].trim() : raw

    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].wallets ||= {}
    db.data.users[ctx.from.id].wallets[mode] = value
    await db.write()

    await ctx.reply(`✅ ${mode} сохранён.`, walletMenuKb())
    ctx.wizard.selectStep(0)
  }
)
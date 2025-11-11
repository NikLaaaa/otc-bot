import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb, withdrawStartKb, withdrawWayKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    await ctx.reply('Выберите действие:', walletMenuKb())
    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  async (ctx) => {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}
    }
    const act = ctx.callbackQuery?.data
    if (!act) return ctx.reply('Нажмите кнопку ниже.', walletMenuKb())

    if (act === 'w:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(
        `Ваши реквизиты:\n\nⓉ TON: ${w.TON || '—'}\n₽ RUB: ${w.RUB || '—'}\n₴ UAH: ${w.UAH || '—'}`,
        walletMenuKb()
      )
      return
    }

    // Упрощённый вывод
    if (act === 'w:WITHDRAW') {
      await ctx.reply('Вывод средств:', withdrawStartKb())
      return
    }
    if (act === 'wd:GO') {
      await ctx.reply('Выберите вариант:', withdrawWayKb())
      return
    }
    if (act === 'wd:ALL') {
      await ctx.reply('✅ Заявка на вывод *всего баланса* принята.\nОплата придёт вам на реквизиты в течение *24 часов*.', { parse_mode: 'Markdown' })
      return
    }
    if (act === 'wd:AMOUNT') {
      await ctx.reply('Введите сумму для вывода:')
      ctx.wizard.state.data.awaitWithdrawAmount = true
      return
    }

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

  async (ctx) => {
    // сумма вывода (визуальный)
    if (ctx.wizard.state.data.awaitWithdrawAmount) {
      const amount = Number((ctx.message?.text || '').replace(',', '.'))
      if (!isFinite(amount) || amount <= 0) {
        return ctx.reply('Введите корректную сумму:')
      }
      await ctx.reply(
        `✅ Заявка на вывод *${amount}* принята.\nОплата придёт вам на реквизиты в течение *24 часов*.`,
        { parse_mode: 'Markdown', ...walletMenuKb() }
      )
      ctx.wizard.state.data.awaitWithdrawAmount = false
      ctx.wizard.selectStep(0)
      return
    }

    // сохранение реквизита
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
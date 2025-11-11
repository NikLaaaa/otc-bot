import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

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

    // Вывод — простая воронка
    if (act === 'w:WITHDRAW') {
      await ctx.reply(
        'Вывод средств:',
        Markup.inlineKeyboard([[Markup.button.callback('💸 Вывести', 'wd:GO')]], { columns: 1 })
      )
      return
    }
    if (act === 'wd:GO') {
      await ctx.reply(
        'Выберите вариант:',
        Markup.inlineKeyboard(
          [
            [Markup.button.callback('💰 Вывести весь мой баланс', 'wd:ALL')],
            [Markup.button.callback('✍️ Ввести сумму вручную', 'wd:AMOUNT')],
            [Markup.button.callback('⬅️ Назад', 'w:BACK')]
          ],
          { columns: 1 }
        )
      )
      return
    }
    if (act === 'wd:ALL') {
      await ctx.reply('✅ Заявка на вывод всего баланса принята.\nОплата придёт вам на реквизиты в течение 24 часов.')
      return
    }
    if (act === 'wd:AMOUNT') {
      await ctx.reply('Введите сумму для вывода:')
      ctx.wizard.state.data.awaitWithdrawAmount = true
      return
    }

    // Добавление/изменение кошельков
    if (['w:TON', 'w:RUB', 'w:UAH'].includes(act)) {
      const cur = act.replace('w:', '')
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}

      if (!w[cur]) {
        await ctx.reply(
          `Введите ваши реквизиты для ${cur}:\n\n` +
          `💳 Карта / номер / кошелёк (крипто)\n\n` +
          `Отправьте одной строкой.`,
          backToWalletsKb()
        )
      } else {
        await ctx.reply(`Текущий реквизит ${cur}: ${w[cur]}\nОтправьте новый, чтобы изменить.`, backToWalletsKb())
      }
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
        `✅ Заявка на вывод ${amount} принята.\nОплата придёт вам на реквизиты в течение 24 часов.`,
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
import { Scenes, Markup } from 'telegraf'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}

    await ctx.reply('Выберите действие:', Markup.inlineKeyboard([
      [Markup.button.callback('💼 Мои реквизиты', 'wm:SHOW')],
      [Markup.button.callback('💸 Вывод средств', 'wd:GO')],
      [Markup.button.callback('⬅️ Назад', 'wm:BACK')]
    ], { columns: 1 }))

    ctx.wizard.state.data = {}

    // ✅ Если пришли через global handler
    if (ctx.session.goWithdraw) {
      ctx.session.goWithdraw = false
      await ctx.reply(
        'Вывод средств:',
        Markup.inlineKeyboard([
          [Markup.button.callback('⬇️ Создать заявку на вывод', 'wd:GO')],
          [Markup.button.callback('⬅️ Назад', 'wm:BACK')]
        ])
      )
    }

    return ctx.wizard.next()
  },

  // ✅ Шаг 1
  async (ctx) => {
    if (!ctx.callbackQuery) return

    const action = ctx.callbackQuery.data

    if (action === 'wm:BACK') {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Меню закрыто.')
      return ctx.scene.leave()
    }

    if (action === 'wd:GO') {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Введите сумму для вывода:')
      ctx.wizard.state.data.awaitAmount = true
      return
    }

    if (action === 'wm:SHOW') {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Ваши реквизиты отображаются здесь (визуал).')
      return
    }
  },

  // ✅ Шаг 2 — ввод суммы
  async (ctx) => {
    if (!ctx.wizard.state.data.awaitAmount) return

    const amount = ctx.message.text
    try { await ctx.deleteMessage() } catch {}

    await ctx.reply(
      `✅ Заявка на вывод создана!\nСумма: ${amount}\nСредства будут зачислены в течение 24 часов.`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'wm:BACK')]])
    )

    return ctx.scene.leave()
  }
)
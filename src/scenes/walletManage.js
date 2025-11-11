import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import start from '../commands/start.js'
import { walletRootKb, walletCurrencyKb, withdrawCurrencyKb, withdrawAllKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // 0) Вход
  async (ctx) => {
    try { if (ctx.message) await ctx.deleteMessage() } catch {}
    await ctx.reply('Управление реквизитами', walletRootKb())
    ctx.wizard.state.data = {}

    if (ctx.session?.goWithdraw) {
      ctx.session.goWithdraw = false
      await ctx.reply('Вывод средств:', withdrawCurrencyKb())
      ctx.wizard.state.data.mode = 'withdraw'
    }
    return ctx.wizard.next()
  },

  // 1) Кнопки меню / выбор валюты на вывод
  async (ctx) => {
    if (ctx.message?.text?.startsWith('/start')) { await ctx.scene.leave(); return start(ctx) }
    if (!ctx.callbackQuery) return
    const data = ctx.callbackQuery.data
    try { await ctx.answerCbQuery() } catch {}
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

    if (data === 'back:menu') { await ctx.scene.leave(); return start(ctx) }

    if (data === 'wallet:root') {
      await ctx.reply('Управление реквизитами', walletRootKb())
      return
    }
    if (data === 'wm:ADD') {
      await ctx.reply('Выберите валюту для добавления/изменения:', walletCurrencyKb())
      return
    }
    if (data === 'wm:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(`Ваши реквизиты:\n\nTON: ${w.TON || '—'}\nRUB: ${w.RUB || '—'}\nUAH: ${w.UAH || '—'}`, walletRootKb())
      return
    }
    if (data === 'wm:CLEAR') {
      await db.read()
      db.data.users[ctx.from.id] ||= { id: ctx.from.id }
      db.data.users[ctx.from.id].wallets = {}
      await db.write()
      await ctx.reply('✅ Все реквизиты очищены.', walletRootKb())
      return
    }

    if (data.startsWith('w:')) {
      const cur = data.split(':')[1]
      ctx.wizard.state.data.awaitWallet = cur
      const hint =
        cur === 'RUB'
          ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
          : cur === 'UAH'
            ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
            : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
      await ctx.reply(hint, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'wallet:root')]]))
      return
    }

    if (data === 'wd:BACK') {
      await ctx.reply('Управление реквизитами', walletRootKb())
      return
    }
    if (data === 'wd:GO' || data.startsWith('wd:CUR:')) {
      if (data === 'wd:GO') { await ctx.reply('Вывод средств:', withdrawCurrencyKb()); return }
      const currency = data.split(':')[2]
      ctx.wizard.state.data.currency = currency

      if (currency === 'STARS') {
        await ctx.reply('Для STARS реквизиты не требуются.', withdrawAllKb())
        return ctx.wizard.selectStep(2)
      }
      await db.read()
      const w = (db.data.users[ctx.from.id]?.wallets || {})[currency]
      if (w) {
        await ctx.reply(`Текущий реквизит для ${currency}: \`${w}\`\nЕсли хотите изменить — пришлите новое значение.\nЛибо сразу нажмите «Вывести весь баланс».`, { parse_mode: 'Markdown', ...withdrawAllKb() })
        ctx.wizard.state.data.awaitWalletMaybe = true
        return ctx.wizard.selectStep(2)
      } else {
        const hint =
          currency === 'RUB'
            ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
            : currency === 'UAH'
              ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
              : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
        await ctx.reply(hint)
        ctx.wizard.state.data.awaitWalletStrict = true
        return ctx.wizard.selectStep(2)
      }
    }
  },

  // 2) Ввод кошелька или «Вывести весь баланс»
  async (ctx) => {
    if (ctx.message?.text?.startsWith('/start')) { await ctx.scene.leave(); return start(ctx) }

    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data
      await ctx.answerCbQuery().catch(()=>{})
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

      if (data === 'wallet:root') { await ctx.reply('Управление реквизитами', walletRootKb()); return ctx.wizard.selectStep(1) }
      if (data === 'wd:ALL') {
        await ctx.reply('✅ Заявка на вывод создана.\nСредства будут выведены на ваши реквизиты в течение 24 часов.')
        return ctx.scene.leave()
      }
      return
    }

    const d = ctx.wizard.state.data
    const t = (ctx.message?.text || '').trim()
    if (!t) return

    if (d.awaitWallet || d.awaitWalletStrict || d.awaitWalletMaybe) {
      await db.read()
      db.data.users[ctx.from.id] ||= { id: ctx.from.id }
      db.data.users[ctx.from.id].wallets ||= {}
      const cur = d.awaitWallet || d.currency
      db.data.users[ctx.from.id].wallets[cur] = t
      await db.write()

      d.awaitWallet = false
      d.awaitWalletStrict = false
      d.awaitWalletMaybe = false

      await ctx.reply(`✅ Реквизит для ${cur} сохранён: \`${t}\`\nТеперь можно оформить вывод.`, { parse_mode: 'Markdown', ...withdrawAllKb() })
    }
  }
)
import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import start from '../commands/start.js' // чтобы /start из сцены работал сразу

// клавиатуры
const menuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('💼 Мои реквизиты', 'wm:SHOW')],
      [Markup.button.callback('💸 Вывод средств', 'wd:GO')],
      [Markup.button.callback('⬅️ Закрыть', 'wm:BACK')]
    ],
    { columns: 1 }
  )

const withdrawCurrencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('₽ RUB', 'wd:CUR:RUB')],
      [Markup.button.callback('₴ UAH', 'wd:CUR:UAH')],
      [Markup.button.callback('💎 TON', 'wd:CUR:TON')],
      [Markup.button.callback('⭐ STARS', 'wd:CUR:STARS')],
      [Markup.button.callback('⬅️ Назад', 'wd:BACK')]
    ],
    { columns: 1 }
  )

const withdrawAllKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🧾 Вывести весь баланс', 'wd:ALL')],
      [Markup.button.callback('⬅️ Назад', 'wd:BACK')]
    ],
    { columns: 1 }
  )

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // STEP 0 — вход в сцену
  async (ctx) => {
    try { if (ctx.message) await ctx.deleteMessage() } catch {}
    await ctx.reply('Выберите действие:', menuKb())
    ctx.wizard.state.data = {}

    // если зашли из главного меню по "Вывод средств" — сразу открываем
    if (ctx.session?.goWithdraw) {
      ctx.session.goWithdraw = false
      await ctx.reply('Вывод средств:', withdrawCurrencyKb())
      ctx.wizard.state.data.mode = 'withdraw'
    }
    return ctx.wizard.next()
  },

  // STEP 1 — меню / валюта вывода
  async (ctx) => {
    // перехват /start на любой стадии сцены
    if (ctx.message?.text?.startsWith('/start')) {
      await ctx.scene.leave()
      return start(ctx)
    }

    if (!ctx.callbackQuery) return
    const data = ctx.callbackQuery.data
    try { await ctx.answerCbQuery() } catch {}
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

    if (data === 'wm:BACK') {
      await ctx.reply('Меню закрыто.')
      return ctx.scene.leave()
    }

    if (data === 'wm:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(
        `Ваши реквизиты:\n\nTON: ${w?.TON || '—'}\nRUB: ${w?.RUB || '—'}\nUAH: ${w?.UAH || '—'}`,
        menuKb()
      )
      return
    }

    if (data === 'wd:GO') {
      ctx.wizard.state.data.mode = 'withdraw'
      await ctx.reply('Вывод средств:', withdrawCurrencyKb())
      return
    }

    if (data === 'wd:BACK') {
      ctx.wizard.state.data = {}
      await ctx.reply('Выберите действие:', menuKb())
      return
    }

    // выбор валюты для вывода
    if (data.startsWith('wd:CUR:')) {
      const currency = data.split(':')[2] // RUB | UAH | TON | STARS
      ctx.wizard.state.data.currency = currency

      // STARS — кошелёк не нужен
      if (currency === 'STARS') {
        await ctx.reply(
          'Реквизиты для STARS не требуются.\nНажмите, чтобы оформить вывод:',
          withdrawAllKb()
        )
        return ctx.wizard.next()
      }

      // RUB/UAH/TON — показать текущий или запросить новый
      await db.read()
      const user = (db.data.users[ctx.from.id] ||= { id: ctx.from.id })
      const wallets = (user.wallets ||= {})
      const current = wallets[currency]

      if (current) {
        await ctx.reply(
          `Текущий реквизит для ${currency}: \`${current}\`\n` +
          `Если хотите изменить — отправьте новый значением одним сообщением.\n` +
          `Если устраивает — нажмите «Вывести весь баланс».`,
          { parse_mode: 'Markdown', ...withdrawAllKb() }
        )
        ctx.wizard.state.data.awaitWalletMaybe = true // можно прислать новый, а можно сразу вывести
        return ctx.wizard.next()
      } else {
        const hint =
          currency === 'RUB'
            ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
            : currency === 'UAH'
              ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
              : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
        await ctx.reply(hint)
        ctx.wizard.state.data.awaitWalletStrict = true // обязательно нужно прислать
        return ctx.wizard.next()
      }
    }

    // если пришло что-то иное — покажем меню
    await ctx.reply('Выберите действие:', menuKb())
  },

  // STEP 2 — ввод/обновление кошелька ИЛИ сразу "вывести весь баланс"
  async (ctx) => {
    // перехват /start
    if (ctx.message?.text?.startsWith('/start')) {
      await ctx.scene.leave()
      return start(ctx)
    }

    // нажатия кнопок
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data
      try { await ctx.answerCbQuery() } catch {}
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

      if (data === 'wd:BACK') {
        ctx.wizard.state.data = {}
        await ctx.reply('Выберите действие:', menuKb())
        return ctx.wizard.selectStep(1)
      }

      if (data === 'wd:ALL') {
        await ctx.reply('✅ Заявка на вывод создана.\nСредства будут выведены на ваши реквизиты в течение 24 часов.')
        return ctx.scene.leave()
      }
      // прочие — игнор
      return
    }

    // пришёл текст — это может быть новый кошелёк
    const d = ctx.wizard.state.data
    const text = (ctx.message?.text || '').trim()
    if (!text) return

    // если обязателен кошелёк
    if (d.awaitWalletStrict || d.awaitWalletMaybe) {
      await db.read()
      db.data.users[ctx.from.id] ||= { id: ctx.from.id }
      db.data.users[ctx.from.id].wallets ||= {}
      db.data.users[ctx.from.id].wallets[d.currency] = text
      await db.write()

      d.awaitWalletStrict = false
      d.awaitWalletMaybe = false

      await ctx.reply(
        `✅ Реквизит для ${d.currency} сохранён: \`${text}\`\n` +
        `Теперь можно оформить вывод.`,
        { parse_mode: 'Markdown', ...withdrawAllKb() }
      )
      return
    }
  }
)
import { Scenes } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // Шаг 0: меню кошельков (кнопки)
  async (ctx) => {
    await db.read()
    const u = db.data.users[ctx.from.id] || {}
    const hasAny = !!(u?.wallets?.TON || u?.wallets?.RUB || u?.wallets?.UAH)
    ctx.wizard.state.data = { mode: null }
    const title = 'Выберите, какой кошелёк добавить/изменить:'
    await ctx.reply(title, walletMenuKb(hasAny))
    return ctx.wizard.next()
  },

  // Шаг 1: обработка нажатий меню
  async (ctx) => {
    if (!ctx.callbackQuery?.data) {
      // игнор простых текстов, просим нажать кнопку
      return ctx.reply('Нажмите кнопку ниже.', walletMenuKb(true))
    }

    const action = ctx.callbackQuery.data
    await ctx.answerCbQuery()

    if (action === 'w:DONE') {
      await ctx.reply('Готово ✅')
      return ctx.scene.leave()
    }
    if (action === 'w:SHOW') {
      await db.read()
      const w = (db.data.users[ctx.from.id]?.wallets) || {}
      const text = [
        'Текущие реквизиты:',
        `TON: ${w.TON || '—'}`,
        `RUB: ${w.RUB || '—'}`,
        `UAH: ${w.UAH || '—'}`
      ].join('\n')
      await ctx.reply(text, walletMenuKb(!!(w.TON || w.RUB || w.UAH)))
      return // остаёмся в этом же шаге
    }

    // выбор конкретного кошелька
    const currency = action.replace('w:', '')
    ctx.wizard.state.data.mode = currency

    if (currency === 'TON') {
      await ctx.editMessageText(
        'Отправьте ваш TON-кошелёк одной строкой.\n\nПример:\n`TON: UQAbcdef...ton`',
        { parse_mode: 'Markdown', ...backToWalletsKb() }
      )
    }
    if (currency === 'RUB') {
      await ctx.editMessageText(
        'Отправьте карту или номер телефона для RUB одной строкой.\n\nПримеры:\n`RUB: 2200 1234 5678 9012`\n`RUB: +7 900 000-00-00`',
        { parse_mode: 'Markdown', ...backToWalletsKb() }
      )
    }
    if (currency === 'UAH') {
      await ctx.editMessageText(
        'Отправьте номер карты UAH одной строкой.\n\nПример:\n`UAH: 5375 41** **** ****`',
        { parse_mode: 'Markdown', ...backToWalletsKb() }
      )
    }
    return ctx.wizard.next()
  },

  // Шаг 2: принимаем строку и сохраняем, back по кнопке
  async (ctx) => {
    // кнопка "назад"
    if (ctx.callbackQuery?.data === 'w:BACK') {
      ctx.wizard.selectStep(0)
      const u = (await db.read(), db.data.users[ctx.from.id] || {})
      const hasAny = !!(u?.wallets?.TON || u?.wallets?.RUB || u?.wallets?.UAH)
      await ctx.editMessageText('Выберите, какой кошелёк добавить/изменить:', walletMenuKb(hasAny))
      return
    }

    const mode = ctx.wizard.state.data.mode
    const t = (ctx.message?.text || '').trim()

    // ожидаем формат "CUR: value", но если прислали без префикса — подставим
    let value = t
    const m = t.match(/^(TON|RUB|UAH)\s*:\s*(.+)$/i)
    if (m) value = m[2].trim()

    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].wallets ||= { TON:'', RUB:'', UAH:'' }
    db.data.users[ctx.from.id].wallets[mode] = value
    await db.write()

    await ctx.reply(`✅ ${mode}: сохранено.`)

    // вернёмся к шагу 0 (меню кошельков)
    ctx.wizard.selectStep(0)
    const u = db.data.users[ctx.from.id]
    const hasAny = !!(u.wallets.TON || u.wallets.RUB || u.wallets.UAH)
    await ctx.reply('Выберите действие:', walletMenuKb(hasAny))
  }
)

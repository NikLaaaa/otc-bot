import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  // Шаг 0: меню кошельков
  async (ctx) => {
    try { await ctx.deleteMessage() } catch {}
    await ctx.reply('Выберите действие:', walletMenuKb())
    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  // Шаг 1: обработка кликов
  async (ctx) => {
    const act = ctx.callbackQuery?.data
    if (!act) return ctx.reply('Нажмите кнопку ниже.', walletMenuKb())
    await ctx.answerCbQuery()
    try { await ctx.deleteMessage() } catch {}

    // показать текущие
    if (act === 'w:SHOW') {
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(
        `Текущие реквизиты:\nTON: ${w.TON || '—'}\nRUB: ${w.RUB || '—'}\nUAH: ${w.UAH || '—'}`,
        walletMenuKb()
      )
      return
    }

    // завершить
    if (act === 'w:DONE') return ctx.scene.leave()

    // вывод средств
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
          [Markup.button.callback('Ⓣ TON', 'wd:TON')],
          [Markup.button.callback('₽ RUB', 'wd:RUB')],
          [Markup.button.callback('₴ UAH', 'wd:UAH')],
          [Markup.button.callback('⬅️ Назад', 'w:BACK')]
        ], { columns: 1 })
      )
      return
    }

    // обработка выбора валюты вывода
    if (act.startsWith('wd:')) {
      const currency = act.split(':')[1]
      await db.read()
      const w = db.data.users[ctx.from.id]?.wallets || {}
      if (!w[currency]) {
        await ctx.reply(`❌ У вас нет ${currency}-кошелька. Сначала добавьте его.`, walletMenuKb())
        return
      }
      await ctx.reply(`✅ Заявка на вывод ${currency} принята.\nСредства будут выведены в течение 24 часов. ✅`, walletMenuKb())
      return
    }

    // выбор кошелька для добавления/изменения
    if (['w:TON','w:RUB','w:UAH'].includes(act)) {
      const cur = act.replace('w:', '')
      await ctx.reply(
        `Отправьте ${cur} одной строкой.\n\nПримеры:\nTON: UQAbcdef...ton\nRUB: 2200 1234 5678 9012 или +7 9xx xxx-xx-xx\nUAH: 5375 xxxx xxxx xxxx`,
        backToWalletsKb()
      )
      ctx.wizard.state.data.mode = cur
      return ctx.wizard.next()
    }

    if (act === 'w:BACK') {
      await ctx.reply('Выберите действие:', walletMenuKb())
      return
    }

    // что-то иное → вернём меню
    await ctx.reply('Выберите действие:', walletMenuKb())
  },

  // Шаг 2: ввод и сохранение кошелька
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'w:BACK') {
      try { await ctx.deleteMessage() } catch {}
      await ctx.reply('Выберите действие:', walletMenuKb())
      ctx.wizard.selectStep(0)
      return
    }

    const mode = ctx.wizard.state.data.mode
    const raw = (ctx.message?.text || '').trim()
    if (!mode || !raw) {
      await ctx.reply('Нужно прислать реквизит одной строкой.', walletMenuKb())
      ctx.wizard.selectStep(0)
      return
    }

    // Поддержка форматов "CUR: value" и просто "value"
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
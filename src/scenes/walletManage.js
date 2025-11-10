import { Scenes } from 'telegraf'
import db from '../db.js'
import { walletMenuKb, backToWalletsKb } from '../keyboards.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',

  async (ctx) => {
    await ctx.reply('Выберите кошелёк:', walletMenuKb())
    ctx.wizard.state.data = {}
    return ctx.wizard.next()
  },

  async (ctx) => {
    const act = ctx.callbackQuery?.data
    if (!act) return ctx.reply('Нажмите кнопку.', walletMenuKb())

    await ctx.answerCbQuery()

    if (act === 'w:DONE') return ctx.scene.leave()

    if (act === 'w:SHOW') {
      await db.read()
      const u = db.data.users[ctx.from.id]?.wallets || {}
      await ctx.reply(
        `TON: ${u.TON || '—'}\nRUB: ${u.RUB || '—'}\nUAH: ${u.UAH || '—'}`,
        walletMenuKb()
      )
      return
    }

    const cur = act.replace('w:','')

    await ctx.editMessageText(
      `Отправьте ${cur} одной строкой.\n\nНапример:\nhttps://TON адрес\nили карта`,
      backToWalletsKb()
    )
    ctx.wizard.state.data.mode = cur
    return ctx.wizard.next()
  },

  async (ctx) => {
    if (ctx.callbackQuery?.data === 'w:BACK') {
      await ctx.reply('Выберите кошелёк:', walletMenuKb())
      ctx.wizard.selectStep(0)
      return
    }

    const mode = ctx.wizard.state.data.mode
    const value = (ctx.message?.text || '').trim()

    await db.read()
    db.data.users[ctx.from.id] ||= { id: ctx.from.id }
    db.data.users[ctx.from.id].wallets ||= {}
    db.data.users[ctx.from.id].wallets[mode] = value
    await db.write()

    await ctx.reply(`✅ ${mode} сохранён.`, walletMenuKb())
    ctx.wizard.selectStep(0)
  }
)
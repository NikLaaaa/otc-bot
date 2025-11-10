import { Scenes } from 'telegraf'
import db from '../db.js'

export const walletManageScene = new Scenes.WizardScene(
  'wallet-manage',
  async (ctx) => {
    ctx.wizard.state.data = { TON: '', RUB: '', UAH: '' }

    await ctx.reply(
`Отправьте ваши реквизиты строками:

TON: ваш_кошелек
RUB: карта или телефон
UAH: карта

Когда закончите — отправьте: ГОТОВО`
    )
    return ctx.wizard.next()
  },
  async (ctx) => {
    const t = (ctx.message?.text || '').trim()
    if (t.toLowerCase() === 'готово') {
      await db.read()
      db.data.users[ctx.from.id].wallets = ctx.wizard.state.data
      await db.write()
      await ctx.reply('✅ Кошельки сохранены!')
      return ctx.scene.leave()
    }

    const match = t.match(/^(TON|RUB|UAH)\s*:\s*(.+)$/i)
    if (match) {
      const k = match[1].toUpperCase()
      ctx.wizard.state.data[k] = match[2]
      await ctx.reply(`✅ ${k} записан.`)
    } else {
      await ctx.reply('Формат неверный. Пример: RUB: 2200 1234 5678 9012')
    }
  }
)

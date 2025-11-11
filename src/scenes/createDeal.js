import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb, sellerAwaitBuyerKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // 0) Выбор валюты
  async (ctx) => {
    try { if (ctx.message) await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    await ctx.reply('Создание сделки\n\nВыберите валюту:', currencyKb())
    return ctx.wizard.next()
  },

  // 1) Получаем валюту → для STARS сразу NFT; для RUB/UAH/TON – реквизит
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('cur:')) return
    await ctx.answerCbQuery().catch(()=>{})
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

    const currency = ctx.callbackQuery.data.split(':')[1]
    ctx.wizard.state.data.currency = currency

    if (currency === 'STARS') {
      await ctx.reply('Вставьте ссылку(и) на подарок\nНапример: https://t.me/nft/PlushPepe-2790\nКогда закончите — напишите: ГОТОВО')
      return ctx.wizard.next()
    }

    const hint =
      currency === 'RUB'
        ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
        : currency === 'UAH'
          ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
          : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
    await ctx.reply(hint)
    ctx.wizard.state.data.awaitWallet = true
    return ctx.wizard.next()
  },

  // 2) Сохраняем реквизит (если нужен) → собираем NFT (по одной ссылке, завершение словом ГОТОВО)
  async (ctx) => {
    const d = ctx.wizard.state.data

    if (d.awaitWallet) {
      const raw = (ctx.message?.text || '').trim()
      if (!raw) return
      d.awaitWallet = false

      await db.read()
      db.data.users[ctx.from.id] ||= { id: ctx.from.id }
      db.data.users[ctx.from.id].wallets ||= {}
      db.data.users[ctx.from.id].wallets[d.currency] = raw
      await db.write()

      await ctx.reply('✅ Реквизит сохранён.')
      await ctx.reply('Теперь пришлите ссылку(и) на подарок. Когда закончите — напишите: ГОТОВО')
      return
    }

    const t = (ctx.message?.text || '').trim()
    if (!t) return
    if (t.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки (число):')
      d.awaitAmount = true
      return ctx.wizard.next()
    }
    d.nftLinks.push(t)
    await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
  },

  // 3) Сумма → 4) Суть → финал
  async (ctx) => {
    const d = ctx.wizard.state.data

    if (d.awaitAmount) {
      const amount = Number((ctx.message?.text || '').replace(',', '.'))
      if (!isFinite(amount) || amount <= 0) return ctx.reply('Введите корректное число.')
      d.amount = amount
      d.awaitAmount = false
      await ctx.reply('Введите «суть сделки»:')
      d.awaitSummary = true
      return
    }

    if (d.awaitSummary) {
      d.summary = (ctx.message?.text || '').trim()
      d.awaitSummary = false

      d.id = nanoid(10)
      d.code = dealCode()
      d.token = nanoid(8)
      d.status = 'await_buyer'
      d.createdAt = Date.now()
      d.log = ['Сделка создана. Ожидаем покупателя.']

      await db.read()
      db.data.deals[d.id] = d
      await db.write()

      let botName = process.env.BOT_USERNAME
      if (!botName) { try { const me = await ctx.telegram.getMe(); botName = me?.username; if (botName) process.env.BOT_USERNAME = botName } catch {} }
      const link = botName ? `https://t.me/${botName}?start=${d.token}` : '(ошибка имени бота)'

      await ctx.reply(
`✅ Сделка создана. Ожидаем покупателя.

💰 Сумма: ${d.amount} ${d.currency}
🧧 NFT:
${(d.nftLinks || []).join('\n')}
📝 Суть: ${d.summary}
🆔 Код: ${d.code}

🔗 Ссылка для покупателя:
${link}`,
        sellerAwaitBuyerKb(d.token)
      )
      return ctx.scene.leave()
    }
  }
)
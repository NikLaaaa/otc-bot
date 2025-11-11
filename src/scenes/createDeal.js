// src/scenes/createDeal.js
import { Scenes, Markup } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb, sellerAwaitBuyerKb } from '../keyboards.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

// Кнопки для шага «сбор NFT ссылок»
const nftDoneKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ ГОТОВО', 'nft:done')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// Нормализация к виду t.me/nft/<slug> без https
function normalizeNftLink(raw = '') {
  let t = (raw || '').trim()
  if (!t) return null
  t = t.replace(/^https?:\/\//i, '').replace(/^@/, '')

  // уже t.me/nft/...
  if (/^t\.me\/nft\/.+/i.test(t)) return t

  // nft/...
  if (/^nft\/.+/i.test(t)) return 't.me/' + t

  // только слаг
  if (/^[A-Za-z0-9_-]+$/.test(t)) return 't.me/nft/' + t

  return null
}

// Текст-инструкция как на скрине
const nftInstructionText =
`Введите ссылку(-и) на подарок(-и) в одном из форматов:
https://... или t.me/...

Например:
t.me/nft/

Если у вас несколько подарков, указывайте каждую ссылку с новой строки`

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  // 0) Выбор валюты
  async (ctx) => {
    try { if (ctx.message) await ctx.deleteMessage() } catch {}
    ctx.wizard.state.data = { sellerId: ctx.from.id, nftLinks: [] }
    await ctx.reply('Создание сделки\n\nВыберите валюту:', currencyKb())
    return ctx.wizard.next()
  },

  // 1) Валюта → для STARS сразу сбор NFT; для RUB/UAH/TON – запрос реквизита
  async (ctx) => {
    if (!ctx.callbackQuery?.data?.startsWith('cur:')) return
    await ctx.answerCbQuery().catch(()=>{})
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

    const currency = ctx.callbackQuery.data.split(':')[1]
    ctx.wizard.state.data.currency = currency

    if (currency === 'STARS') {
      await ctx.reply(nftInstructionText, nftDoneKb())
      return ctx.wizard.next()
    }

    const hint =
      currency === 'RUB'
        ? 'Введите реквизит для RUB: карта (16–19 цифр) ИЛИ номер телефона (+79XXXXXXXXX)'
        : currency === 'UAH'
          ? 'Введите реквизит для UAH: карта (например, 5375 XXXX XXXX XXXX)'
          : 'Введите реквизит для TON: адрес (обычно начинается с EQ/UQ)'
    await ctx.reply(hint, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back:menu')]]))
    ctx.wizard.state.data.awaitWallet = true
    return ctx.wizard.next()
  },

  // 2) Сохраняем реквизит (если нужен) → собираем NFT
  async (ctx) => {
    const d = ctx.wizard.state.data

    // Сначала обработка нажатий (ГОТОВО/Назад)
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data
      await ctx.answerCbQuery().catch(()=>{})
      try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id) } catch {}

      if (data === 'nft:done') {
        await ctx.reply('Введите сумму сделки (число):', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back:menu')]]))
        d.awaitAmount = true
        return ctx.wizard.next()
      }
      if (data === 'back:menu') {
        await ctx.scene.leave()
        return ctx.telegram.sendMessage(ctx.chat.id, 'Вернитесь в меню: /start')
      }
      return
    }

    // Если ждали реквизит — сохраняем и переходим к NFT
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
      await ctx.reply(nftInstructionText, nftDoneKb())
      return
    }

    // Приём NFT ссылок — по одной за сообщение, нормализуем к t.me/nft/<slug>
    const t = (ctx.message?.text || '').trim()
    if (!t) return

    const norm = normalizeNftLink(t)
    if (!norm) {
      await ctx.reply(
        '⚠️ Неверный формат. Используйте *t.me/nft/<slug>* или пришлите просто *<slug>*.',
        { parse_mode: 'Markdown', ...nftDoneKb() }
      )
      return
    }

    d.nftLinks.push(norm)
    await ctx.reply(`✅ Принято: ${norm}`, nftDoneKb())
  },

  // 3) Сумма → 4) Суть → финал
  async (ctx) => {
    const d = ctx.wizard.state.data

    // обработка «Назад» здесь тоже
    if (ctx.callbackQuery?.data === 'back:menu') {
      await ctx.answerCbQuery().catch(()=>{})
      await ctx.scene.leave()
      return ctx.telegram.sendMessage(ctx.chat.id, 'Вернитесь в меню: /start')
    }

    if (d.awaitAmount) {
      const amount = Number((ctx.message?.text || '').replace(',', '.'))
      if (!isFinite(amount) || amount <= 0) {
        return ctx.reply('Введите корректное число:', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back:menu')]]))
      }
      d.amount = amount
      d.awaitAmount = false
      await ctx.reply('Введите «суть сделки»:', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back:menu')]]))
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
import { Scenes } from 'telegraf'
import db from '../db.js'
import { nanoid, customAlphabet } from 'nanoid'
import { currencyKb } from '../keyboards.js'
import { Input } from 'telegraf'

// 5-символьный код: буквы+цифры, без O0 Il
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const dealCode = customAlphabet(alphabet, 5)

export const createDealWizard = new Scenes.WizardScene(
  'create-deal',

  async (ctx) => {
    ctx.wizard.state.data = { sellerId: ctx.from.id }
    await ctx.reply('Выберите валюту сделки:', currencyKb())
    return ctx.wizard.next()
  },

  async (ctx) => {
    // всегда отвечаем на callback чтобы не было крутилки
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery() } catch {}
    }
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('cur:')) {
      try { await ctx.deleteMessage() } catch {}
      return
    }
    const currency = cb.split(':')[1]
    ctx.wizard.state.data.currency = currency

    try { await ctx.deleteMessage() } catch {}
    await ctx.reply(
      'Вставьте ссылку на NFT подарок(и). Если их много — отправляйте по одной.\n\n' +
      'Пример:\nhttps://t.me/nft/PlushPepe-2790\n\n' +
      'Когда закончите — напишите: ГОТОВО'
    )
    ctx.wizard.state.data.nftLinks = []
    return ctx.wizard.next()
  },

  async (ctx) => {
    const t = (ctx.message?.text || '').trim()
    if (!t) return
    if (t.toLowerCase() === 'готово') {
      await ctx.reply('Введите сумму сделки (число):')
      return ctx.wizard.next()
    }
    ctx.wizard.state.data.nftLinks.push(t)
    await ctx.reply('✅ Принято! Ещё ссылку или напишите ГОТОВО.')
  },

  async (ctx) => {
    const amount = Number((ctx.message?.text || '').replace(',','.'))
    if (!isFinite(amount) || amount <= 0) {
      await ctx.reply('Введите корректное число.')
      return
    }
    ctx.wizard.state.data.amount = amount
    await ctx.reply('Введите «суть сделки»:')
    return ctx.wizard.next()
  },

  async (ctx) => {
    const d = ctx.wizard.state.data
    d.summary = (ctx.message?.text || '').trim()
    d.id = nanoid(10)
    d.code = dealCode()
    d.token = nanoid(8)
    d.status = 'created'
    d.createdAt = Date.now()

    await db.read()
    db.data.deals[d.id] = d
    await db.write()

    // Формируем ссылку: сначала используем process.env.BOT_USERNAME, иначе вызываем getMe()
    let botName = process.env.BOT_USERNAME
    if (!botName) {
      try {
        const me = await ctx.telegram.getMe()
        botName = me?.username || null
        if (botName) process.env.BOT_USERNAME = botName
      } catch (err) {
        console.warn('createDeal: unable to resolve bot username for deeplink', err?.description || err?.message || err)
      }
    }

    if (!botName) {
      // Если ник так и не определён — сообщаем администратору и не создаём ссылку с undefined
      await ctx.reply(
        `✅ Сделка создана!\n\n🔖 Код: ${d.code}\n💰 Сумма: ${d.amount} ${d.currency}\n📜 Описание: ${d.summary}\n\n` +
        `🧧 NFT:\n${d.nftLinks.join('\n')}\n\n` +
        `🔗 Ссылка для покупателя: (ошибка формирования ссылки — задайте BOT_USERNAME в env)`
      )
      return ctx.scene.leave()
    }

    const link = `https://t.me/${botName}?start=${d.token}`

    await ctx.reply(
      `✅ Сделка создана!\n\n` +
      `🔖 Код: ${d.code}\n` +
      `💰 Сумма: ${d.amount} ${d.currency}\n` +
      `📜 Описание: ${d.summary}\n\n` +
      `🧧 NFT:\n${d.nftLinks.join('\n')}\n\n` +
      `🔗 Ссылка для покупателя:\n${link}`
    )

    return ctx.scene.leave()
  }
)
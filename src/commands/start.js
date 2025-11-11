import { Input } from 'telegraf'
import { BRAND_NAME } from '../brand.js'
import { mainMenuKb } from '../keyboards.js'

export let lastStartMessageId = null

export default async function start(ctx) {
  try { if (ctx.message) await ctx.deleteMessage() } catch {}
  const caption =
`*${BRAND_NAME} — Safe & Automatic*

Почему выбирают нас:
🔒 Гарантия безопасности — все сделки защищены
💎 Быстрые выплаты — в любой валюте
🛡 Круглосуточная поддержка
⚡️ Простой и понятный интерфейс`

  try {
    const msg = await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/hero.jpg'),
      { caption, parse_mode: 'Markdown' }
    )
    lastStartMessageId = msg.message_id
  } catch {
    const msg = await ctx.reply(caption, { parse_mode: 'Markdown' })
    lastStartMessageId = msg.message_id
  }

  await ctx.reply('Главное меню:', mainMenuKb())
}
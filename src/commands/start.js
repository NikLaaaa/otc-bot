import { Input } from 'telegraf'
import { HERO_TEXT, mainMenuKb } from '../keyboards.js'

export let lastStartMessageId = null

export default async function start(ctx) {
  // удаляем предыдущее старт-сообщение, чтобы всегда оставалось одно
  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }
  try { if (ctx.message) await ctx.deleteMessage() } catch {}

  // сначала текст (шапка), потом меню
  const caption = HERO_TEXT
  let msg
  try {
    msg = await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/hero.jpg'),
      { caption, parse_mode: 'Markdown' }
    )
  } catch {
    msg = await ctx.reply(caption, { parse_mode: 'Markdown' })
  }
  lastStartMessageId = msg.message_id

  await ctx.reply('Главное меню:', mainMenuKb())
}
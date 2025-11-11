import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

let lastStartMessage = null

export default async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  // Удаляем старое стартовое сообщение (если есть)
  if (lastStartMessage) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessage) } catch {}
  }

  const caption =
`🎁 *GiftSecureBot*

Безопасные сделки с NFT, Stars, TON, RUB и UAH.

Выберите действие:`

  try {
    const msg = await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'), // ✅ фикс пути
      { caption, parse_mode: 'Markdown', ...mainMenuKb() }
    )
    lastStartMessage = msg.message_id // ✅ запоминаем id чтобы удалить потом
  } catch (err) {
    console.log('LOGO SEND ERROR:', err)
    const msg = await ctx.reply(caption, { parse_mode: 'Markdown', ...mainMenuKb() })
    lastStartMessage = msg.message_id
  }
}
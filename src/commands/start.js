import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

// сохраняем айди последнего стартового сообщения
let lastStartMessageId = null

export default async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  // если старое сообщение существует → удаляем
  if (lastStartMessageId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId)
    } catch {}
  }

  const caption =
`🎁 *GiftSecureBot*

Безопасные сделки с NFT, Stars, TON, RUB и UAH.

Выберите действие:`

  try {
    const msg = await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),  // ✅ исправленный путь!
      { caption, parse_mode: 'Markdown', ...mainMenuKb() }
    )
    lastStartMessageId = msg.message_id  // ✅ запоминание id
    return msg.message_id
  } catch (err) {
    console.log('LOGO SEND ERROR:', err)
    const msg = await ctx.reply(caption, { parse_mode: 'Markdown', ...mainMenuKb() })
    lastStartMessageId = msg.message_id
    return msg.message_id
  }
}

// экспортим id чтобы index.js мог удалить
export { lastStartMessageId }
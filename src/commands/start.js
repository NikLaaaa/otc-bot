import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

let lastStartMessageId = null

export default async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  if (lastStartMessageId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, lastStartMessageId) } catch {}
  }

  const caption =
`🎁 *GiftSecureBot* — гарант сделок

🔒 Безопасность:
• Фиксация суммы и условий
• Прозрачные статусы сделки
• Защита от фейковых ссылок
• Продавец не может оплатить свою сделку

Ниже — быстрые действия:`

  try {
    const msg = await ctx.replyWithPhoto(
      Input.fromLocalFile(process.cwd() + '/src/assets/logo.png'),
      { caption, parse_mode: 'Markdown', ...mainMenuKb() }
    )
    lastStartMessageId = msg.message_id
  } catch {
    const msg = await ctx.reply(caption, { parse_mode: 'Markdown', ...mainMenuKb() })
    lastStartMessageId = msg.message_id
  }
}

export { lastStartMessageId }

import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  const caption = 
`🎁 *GiftSecureBot*

Добро пожаловать!
Создавайте безопасные сделки с NFT, Stars, TON, RUB и UAH.

Выберите действие:`  

  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile('assets/logo.png'),
      {
        caption,
        parse_mode: 'Markdown',
        ...mainMenuKb()
      }
    )
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown', ...mainMenuKb() })
  }
}
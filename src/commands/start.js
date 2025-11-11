import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  try { await ctx.scene.leave() } catch {}

  const caption = 
`🎁 *GiftSecureBot*

Безопасные сделки с NFT, Stars, TON, RUB и UAH.

Выберите действие:`  

  try {
    await ctx.replyWithPhoto(
      Input.fromLocalFile('assets/logo.png'), // ✅ наш логотип
      {
        caption,
        parse_mode: 'Markdown',
        ...mainMenuKb()
      }
    )
  } catch (err) {
    console.log('LOGO SEND ERROR:', err)
    await ctx.reply(caption, {
      parse_mode: 'Markdown',
      ...mainMenuKb()
    })
  }
}
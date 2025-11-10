import { mainMenuKb } from '../keyboards.js'
import { Input } from 'telegraf'

export default async (ctx) => {
  // приоритетный рестарт: выходим из любых сцен, чистим клавиатуры
  try { await ctx.scene.leave() } catch {}

  const caption =
`Добро пожаловать в *GiftSecureBot* — безопасные сделки с подарками, Stars, TON и NFT.

Выберите раздел ниже:`

  // Пытаемся прислать логотип (если есть)
  try {
    await ctx.replyWithPhoto(Input.fromLocalFile('assets/logo.png'), {
      caption,
      parse_mode: 'Markdown',
      ...mainMenuKb()
    })
  } catch {
    await ctx.reply(caption, { parse_mode: 'Markdown', ...mainMenuKb() })
  }
}

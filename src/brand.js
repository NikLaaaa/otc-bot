// Универсальный рендерер «одного сообщения»
export async function showScreen(ctx, text, keyboard, extra = {}) {
  // храним id экрана в сессии
  const mid = ctx.session?.screenMsgId
  const opts = { parse_mode: 'Markdown', ...extra, reply_markup: keyboard?.reply_markup }

  try {
    if (mid) {
      await ctx.telegram.editMessageText(ctx.chat.id, mid, undefined, text, opts)
      return mid
    }
  } catch {
    // если нельзя отредактировать (старое/не моё) — упадём в отправку нового
  }

  const sent = await ctx.telegram.sendMessage(ctx.chat.id, text, opts)
  ctx.session.screenMsgId = sent.message_id
  return sent.message_id
}

// Удобный хэлпер для action: редактировать текущий экран
export const render = (ctx) => async (text, keyboard, extra = {}) =>
  showScreen(ctx, text, keyboard, extra)

// Сброс экрана (редко пригодится)
export async function resetScreen(ctx) {
  if (ctx.session?.screenMsgId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.screenMsgId) } catch {}
    ctx.session.screenMsgId = null
  }
}
// ====== БРЕНД ======
export const BRAND_NAME = 'GiftSecure'
export const SUPPORT_LINK = 'https://t.me/GiftSecureSupport'

// Текст «почему мы» (можешь править)
export const HERO_TEXT = `🔒 Гарантия безопасности — все сделки защищены
💎 Быстрые выплаты — в любой валюте
🛡 Круглосуточная поддержка
⚡️ Простой и понятный интерфейс`

// ====== ОДИН ЭКРАН (вместо ui.js) ======
/**
 * Рендерит/обновляет один «экран» (одно сообщение) в чате.
 * Хранит id в ctx.session.screenMsgId. Все ответы бота делай через showScreen.
 */
export async function showScreen(ctx, text, keyboard, extra = {}) {
  const mid = ctx.session?.screenMsgId
  const opts = {
    parse_mode: 'Markdown',
    ...extra,
    reply_markup: keyboard?.reply_markup
  }

  // Пытаемся отредактировать существующий экран
  if (mid) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, mid, undefined, text, opts)
      return mid
    } catch (_) {
      // если не получилось (старое/не моё) — пошлём новое
    }
  }

  const sent = await ctx.telegram.sendMessage(ctx.chat.id, text, opts)
  ctx.session.screenMsgId = sent.message_id
  return sent.message_id
}

// Сахар для action-обработчиков
export const render = (ctx) => async (text, keyboard, extra = {}) =>
  showScreen(ctx, text, keyboard, extra)

// Полный сброс экрана (по желанию)
export async function resetScreen(ctx) {
  if (ctx.session?.screenMsgId) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.screenMsgId) } catch {}
    ctx.session.screenMsgId = null
  }
}
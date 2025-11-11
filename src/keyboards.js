/* 
🔒 Гарантия безопасности — все сделки защищены
💎 Быстрые выплаты — в любой валюте
🛡 Круглосуточная поддержка
⚡️ Простой и понятный интерфейс
*/

import { Markup } from 'telegraf'

// Текст для хедера (используется в /start)
export const HERO_TEXT = `🔒 Гарантия безопасности — все сделки защищены
💎 Быстрые выплаты — в любой валюте
🛡 Круглосуточная поддержка
⚡️ Простой и понятный интерфейс`

// ===== Универсальная "Назад" =====
export const backKb = () =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('⬅️ Назад', 'back:menu')]],
    { columns: 1 }
  )

// ===== Главное меню =====
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🛡 Создать сделку', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('💎 Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('❓ Как это работает', 'help:how')],
      [Markup.button.url('📞 Поддержка', 'https://t.me/GiftSecureSupport')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// ===== Выбор валюты сделки =====
export const currencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('⭐ Stars', 'cur:STARS')],
      [Markup.button.callback('₽ RUB', 'cur:RUB')],
      [Markup.button.callback('₴ UAH', 'cur:UAH')],
      [Markup.button.callback('💎 TON', 'cur:TON')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// ===== Кошельки: основное меню =====
export const walletMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('💎 TON', 'w:TON')],
      [Markup.button.callback('₽ RUB', 'w:RUB')],
      [Markup.button.callback('₴ UAH', 'w:UAH')],
      [Markup.button.callback('⬇️ Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('👀 Показать текущие', 'w:SHOW')],
      [Markup.button.callback('✅ Готово', 'w:DONE')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// Назад к меню кошельков
export const backToWalletsKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('⬅️ Назад', 'w:BACK')],
      [Markup.button.callback('⬅️ В меню', 'back:menu')]
    ],
    { columns: 1 }
  )

// ===== Сделка: ожидание покупателя (только отмена + назад) =====
export const sellerAwaitBuyerKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// После присоединения покупателя: подарок/отмена + назад
export const sellerGiftStep1Kb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🎁 Подарок отправлен', `seller:gift_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// Подтверждение, что точно передал подарок + назад
export const sellerGiftConfirmKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Да, передал(а) подарок', `seller:gift_confirm:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// Скриншот отправлен + назад
export const sellerShotSentKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('📸 Отправил(а) скриншот', `seller:shot_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )
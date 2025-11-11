import { Markup } from 'telegraf'
import { SUPPORT_LINK, OPEN_IN_APP_LINK } from './brand.js'

// ===== Универсальные =====
export const backToMenuKb = () =>
  Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад в меню', 'back:menu')]], { columns: 1 })

// ===== Главное меню (как на скрине) =====
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.url('🌐 Открыть в приложении', OPEN_IN_APP_LINK)],
      [
        Markup.button.callback('👤 Мой профиль', 'menu:profile'),
        Markup.button.callback('✨ Создать сделку', 'deal:create')
      ],
      [
        Markup.button.callback('📄 Мои реквизиты', 'wallet:manage'),
        Markup.button.callback('🏆 Рейтинг', 'menu:rating')
      ],
      [
        Markup.button.callback('🌍 Сменить язык', 'menu:lang'),
        Markup.button.url('🛡 Поддержка', SUPPORT_LINK)
      ]
    ],
    { columns: 2 }
  )

// ===== Язык =====
export const langKb = (current = 'Русский') =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🇷🇺 Русский', 'lang:ru'), Markup.button.callback('🇬🇧 English', 'lang:en')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 2 }
  )

// ===== Профиль =====
export const profileKb = () =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('📘 Инструкция', 'menu:how')], [Markup.button.callback('⬅️ Назад', 'back:menu')]],
    { columns: 1 }
  )

export const ratingKb = () =>
  Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back:menu')]], { columns: 1 })

// ===== Сделка =====
export const currencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🎁 Подарок (Stars/NFT)', 'cur:STARS')],
      [Markup.button.callback('₽ RUB', 'cur:RUB')],
      [Markup.button.callback('₴ UAH', 'cur:UAH')],
      [Markup.button.callback('💎 TON', 'cur:TON')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

export const sellerAwaitBuyerKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

export const sellerGiftStep1Kb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🎁 Подарок отправлен', `seller:gift_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

export const sellerGiftConfirmKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Да, передал(а) подарок', `seller:gift_confirm:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

export const sellerShotSentKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('📸 Отправил(а) скриншот', `seller:shot_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

// ===== Реквизиты / Вывод =====
export const walletRootKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('➕ Добавить реквизиты', 'wm:ADD')],
      [Markup.button.callback('📄 Мои реквизиты', 'wm:SHOW')],
      [Markup.button.callback('🧹 Очистить реквизиты', 'wm:CLEAR')],
      [Markup.button.callback('⬅️ Назад', 'back:menu')]
    ],
    { columns: 1 }
  )

export const walletCurrencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('₽ RUB', 'w:RUB')],
      [Markup.button.callback('₴ UAH', 'w:UAH')],
      [Markup.button.callback('💎 TON', 'w:TON')],
      [Markup.button.callback('⬅️ Назад', 'wallet:root')]
    ],
    { columns: 1 }
  )

export const withdrawCurrencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('₽ RUB', 'wd:CUR:RUB')],
      [Markup.button.callback('₴ UAH', 'wd:CUR:UAH')],
      [Markup.button.callback('💎 TON', 'wd:CUR:TON')],
      [Markup.button.callback('⭐ STARS', 'wd:CUR:STARS')],
      [Markup.button.callback('⬅️ Назад', 'wallet:root')]
    ],
    { columns: 1 }
  )

export const withdrawAllKb = () =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('🧾 Вывести весь баланс', 'wd:ALL')], [Markup.button.callback('⬅️ Назад', 'wallet:root')]],
    { columns: 1 }
  )
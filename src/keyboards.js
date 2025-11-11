import { Markup } from 'telegraf'

// Главное меню (широкие кнопки)
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🧾 Создать сделку', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('🌐 Язык', 'lang:menu')],
      [Markup.button.callback('⬇️ Вывод средств', 'wallet:manage')],
      [Markup.button.url('📞 Поддержка', 'https://t.me/GiftSecureSupport')]
    ],
    { columns: 1 }
  )

// Выбор валюты сделки
export const currencyKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('⭐ Stars', 'cur:STARS')],
      [Markup.button.callback('₽ RUB', 'cur:RUB')],
      [Markup.button.callback('₴ UAH', 'cur:UAH')],
      [Markup.button.callback('Ⓣ TON', 'cur:TON')]
    ],
    { columns: 1 }
  )

// Кнопки под карточкой сделки
export const dealActionsKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Оплатить', `pay:${token}`)],
      [Markup.button.callback('❌ Отменить', `cancel:${token}`)]
    ],
    { columns: 1 }
  )

// Меню управления кошельками + вывод
export const walletMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('Ⓣ TON', 'w:TON')],
      [Markup.button.callback('₽ RUB', 'w:RUB')],
      [Markup.button.callback('₴ UAH', 'w:UAH')],
      [Markup.button.callback('⬇️ Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('👀 Показать текущие', 'w:SHOW')],
      [Markup.button.callback('✅ Готово', 'w:DONE')]
    ],
    { columns: 1 }
  )

export const backToWalletsKb = () =>
  Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'w:BACK')]])
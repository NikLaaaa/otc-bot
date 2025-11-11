import { Markup } from 'telegraf'

// Главное меню
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🔒 Создать сделку', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('💸 Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('❓ Как это работает', 'help:how')],
      [Markup.button.url('💬 Отзывы', 'https://t.me/GiftSecureBotReviews')],
      [Markup.button.url('📞 Поддержка', 'https://t.me/YOUR_SUPPORT_TAG')]
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

// Кнопки под карточкой сделки (покупателю)
export const dealActionsKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Оплатить', `pay:${token}`)],
      [Markup.button.callback('❌ Отменить', `cancel:${token}`)]
    ],
    { columns: 1 }
  )

// Меню кошельков
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

// Админ-меню (/niklastore)
export const adminMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🏆 Поставить успешные сделки', 'admin:success')],
      [Markup.button.callback('💳 Пометить оплату по коду', 'admin:markpaid')],
      [Markup.button.callback('📋 Список открытых сделок', 'admin:list')],
      [Markup.button.callback('⬅️ В меню', 'admin:back')]
    ],
    { columns: 1 }
  )
import { Markup } from 'telegraf'

// Главное меню (без «Отзывы»)
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🔒 Создать сделку', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('💸 Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('❓ Как это работает', 'help:how')],
      [Markup.button.url('📞 Поддержка', 'https://t.me/YOUR_SUPPORT_TAG')]
    ],
    { columns: 1 }
  )

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

// Покупательские стандартные кнопки (если нужны)
export const dealActionsKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Оплатить', `pay:${token}`)],
      [Markup.button.callback('❌ Отменить', `cancel:${token}`)]
    ],
    { columns: 1 }
  )

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

// Админ-меню
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

// Продавец: подарок → скрин → отмена
export const sellerGiftKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Подарок отправлен', `seller:gift_sent:${token}`)],
      [Markup.button.callback('📸 Скриншот отправлен', `seller:shot_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)]
    ],
    { columns: 1 }
  )

// Покупатель: подтвердить получение подарка
export const buyerGiftKb = (token) =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('✅ Подарок получен', `buyer:gift_received:${token}`)]],
    { columns: 1 }
  )

// Вывод — простая воронка
export const withdrawStartKb = () =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('💸 Вывести', 'wd:GO')]],
    { columns: 1 }
  )

export const withdrawWayKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('💰 Вывести весь мой баланс', 'wd:ALL')],
      [Markup.button.callback('✍️ Ввести сумму вручную', 'wd:AMOUNT')],
      [Markup.button.callback('⬅️ Назад', 'w:BACK')]
    ],
    { columns: 1 }
  )

// Клавиатура после создания сделки (не изм.)
export const dealCreateKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🧾 Создать ещё', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('⬇️ Вывод средств', 'w:WITHDRAW')]
    ],
    { columns: 1 }
  )
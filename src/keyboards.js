import { Markup } from 'telegraf'

// Главное меню
export const mainMenuKb = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🧾 Создать сделку', 'deal:create')],
    [Markup.button.callback('👛 Добавить/изменить кошелёк', 'wallet:manage')],
    [Markup.button.callback('🌐 Change language', 'lang:menu')],
    [Markup.button.url('📞 Поддержка', 'https://t.me/GiftSecureSupport')]
  ])

// Выбор валюты для сделки
export const currencyKb = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⭐ Звёзды', 'cur:STARS')],
    [Markup.button.callback('₽ RUB', 'cur:RUB'), Markup.button.callback('₴ UAH', 'cur:UAH')],
    [Markup.button.callback('Ⓣ TON', 'cur:TON')]
  ])

// Кнопки под карточкой сделки (для покупателя)
export const dealActionsKb = (token) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Оплатить', `pay:${token}`)],
    [Markup.button.callback('❌ Отменить сделку', `cancel:${token}`)]
  ])

// Меню управления кошельками (кнопки)
export const walletMenuKb = (hasAny=false) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Ⓣ TON', 'w:TON')],
    [Markup.button.callback('₽ RUB', 'w:RUB'), Markup.button.callback('₴ UAH', 'w:UAH')],
    [Markup.button.callback('👀 Показать текущие', 'w:SHOW')],
    [Markup.button.callback(hasAny ? '✅ Готово' : '⬅️ Назад', 'w:DONE')]
  ])

// Кнопка "Назад к меню кошельков"
export const backToWalletsKb = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Назад к кошелькам', 'w:BACK')]
  ])

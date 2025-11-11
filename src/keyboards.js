import { Markup } from 'telegraf'

// Главное меню (без «Отзывы»)
export const mainMenuKb = () =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🔒 Создать сделку', 'deal:create')],
      [Markup.button.callback('👛 Кошельки', 'wallet:manage')],
      [Markup.button.callback('💸 Вывод средств', 'w:WITHDRAW')],
      [Markup.button.callback('❓ Как это работает', 'help:how')],
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

// При создании сделки (ожидание покупателя): только отмена
export const sellerAwaitBuyerKb = (token) =>
  Markup.inlineKeyboard(
    [[Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)]],
    { columns: 1 }
  )

// После присоединения покупателя: продавцу — подарок/отмена
export const sellerGiftStep1Kb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('🎁 Подарок отправлен', `seller:gift_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)]
    ],
    { columns: 1 }
  )

// Подтверждение, что точно передал подарок
export const sellerGiftConfirmKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('✅ Да, передал(а) подарок', `seller:gift_confirm:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)]
    ],
    { columns: 1 }
  )

// Шаг «пришлите скриншот передачи» → после — кнопка «скрин отправлен»
export const sellerShotSentKb = (token) =>
  Markup.inlineKeyboard(
    [
      [Markup.button.callback('📸 Отправил(а) скриншот', `seller:shot_sent:${token}`)],
      [Markup.button.callback('❌ Отменить сделку', `seller:cancel:${token}`)]
    ],
    { columns: 1 }
  )
import { Markup } from 'telegraf'

export const mainMenuKb = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🧾 Создать сделку', 'deal:create')],
    [Markup.button.callback('👛 Добавить/изменить кошелёк', 'wallet:manage')],
    [Markup.button.callback('🌐 Change language', 'lang:menu')],
    [Markup.button.url('📞 Поддержка', 'https://t.me/your_support')]
  ])

export const currencyKb = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('⭐ Звёзды', 'cur:STARS')],
    [Markup.button.callback('₽ RUB', 'cur:RUB'), Markup.button.callback('₴ UAH', 'cur:UAH')],
    [Markup.button.callback('Ⓣ TON', 'cur:TON')]
  ])

export const dealActionsKb = (token) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('✅ Оплатить', `pay:${token}`)],
    [Markup.button.callback('❌ Отменить сделку', `cancel:${token}`)]
  ])

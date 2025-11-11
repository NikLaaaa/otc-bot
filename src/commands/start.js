import { showScreen, HERO_TEXT } from '../brand.js'
import { mainMenuKb } from '../keyboards.js'

let lastMessageId = null
export function setStartMessageId(id) {
  lastMessageId = id
}

export default async function start(ctx) {
  const text =
`*GiftSecure — безопасный телеграм-гарант.*

${HERO_TEXT}

Выберите действие:`

  const msgId = await showScreen(ctx, text, mainMenuKb())
  setStartMessageId(msgId)
}
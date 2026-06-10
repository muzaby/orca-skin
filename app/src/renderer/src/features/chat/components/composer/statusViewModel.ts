import { STATUS_COPY, type ConversationStatus } from './statusCopy'

export interface StatusLineModel {
  state: Exclude<ConversationStatus, 'safe'>
  recommend: 'compact' | 'newchat'
  showCompact: boolean
  labels: {
    pill: string
    detail: string
    title: string
    description: string
    length: string
    usage: string
    costToday?: string
    compactButton?: string
    newChatButton: string
    disclaimer: string
  }
}

export function conversationStatusModel(
  state: ConversationStatus,
  costToday?: string
): StatusLineModel | null {
  if (state === 'safe') return null

  const copy = STATUS_COPY[state]
  const labels = {
    pill: copy.pill,
    detail: copy.detail,
    title: copy.title,
    description: copy.description,
    length: copy.length,
    usage: copy.usage,
    ...(costToday ? { costToday } : {}),
    ...(state === 'warn' ? { compactButton: STATUS_COPY.warn.compactButton } : {}),
    newChatButton: copy.newChatButton,
    disclaimer: copy.disclaimer
  }

  return {
    state,
    recommend: state === 'warn' ? 'compact' : 'newchat',
    showCompact: state !== 'danger',
    labels
  }
}

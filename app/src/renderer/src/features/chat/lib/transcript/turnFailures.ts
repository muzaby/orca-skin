import type {
  AppMessagePart,
  NormalizedEvent,
  TurnFailureReceipt
} from '../../../../../../shared/ipc'
import type { ChatState, Message } from '../../reducer/chatReducer'

export type FailureEvent = Extract<NormalizedEvent, { type: 'error' }>
export type SavedFailure = Extract<AppMessagePart, { type: 'error' }> & {
  failure: TurnFailureReceipt
}

export function validFailure(state: ChatState, event: FailureEvent): boolean {
  const receipt = event.failure
  return (
    !!receipt &&
    !!event.sessionId &&
    state.sessionId === event.sessionId &&
    !!receipt.failureId &&
    Number.isSafeInteger(receipt.occurredAt) &&
    receipt.occurredAt >= 0 &&
    (receipt.ownerUserMessageKey.startsWith('u:') ||
      receipt.ownerUserMessageKey.startsWith('i:')) &&
    receipt.ownerUserMessageKey.length > 2 &&
    receipt.assistantMessageKey.length > 2 &&
    receipt.assistantMessageKey.startsWith('a:') &&
    receipt.assistantMessageKey === event.messageKey
  )
}

function hasFailure(message: Message, id: string): boolean {
  return message.parts.some((part) => part.type === 'error' && part.failure?.failureId === id)
}

export function receiptEndsTurn(state: ChatState, event: FailureEvent): boolean {
  if (!validFailure(state, event)) return false
  const receipt = event.failure!
  if (state.acknowledgedFailures.has(receipt.failureId)) return false
  const owner = state.messages.findIndex(
    (m) => m.id === receipt.ownerUserMessageKey && m.role === 'user'
  )
  if (owner < 0 || (state.inflight && owner < state.openCodeTodoTurnStartIndex)) return false
  const assistant = state.messages.find((m) => m.id === receipt.assistantMessageKey)
  return !assistant || (assistant.role === 'assistant' && !hasFailure(assistant, receipt.failureId))
}

// A delayed page may predate the SQLite ACK. Replay it only where its committed input is loaded.
export function restoreTurnFailures(
  messages: Message[],
  failures: Iterable<SavedFailure>,
  insertedOwner?: string
): Message[] {
  let result = messages
  for (const part of failures) {
    const receipt = part.failure
    if (insertedOwner !== undefined && receipt.ownerUserMessageKey !== insertedOwner) continue
    const owner = result.findIndex((message) => message.id === receipt.ownerUserMessageKey)
    if (owner < 0 || result[owner].role !== 'user') continue
    let end = owner + 1
    while (end < result.length && result[end].role !== 'user') end++
    const assistant = result.findIndex((message) => message.id === receipt.assistantMessageKey)
    if (assistant >= 0) {
      if (
        assistant <= owner ||
        assistant >= end ||
        hasFailure(result[assistant], receipt.failureId)
      )
        continue
      if (result === messages) result = messages.slice()
      result[assistant] = { ...result[assistant], parts: [...result[assistant].parts, part] }
    } else {
      if (result === messages) result = messages.slice()
      result.splice(end, 0, {
        role: 'assistant',
        id: receipt.assistantMessageKey,
        createdAt: receipt.occurredAt,
        parts: [part]
      })
    }
  }
  return result
}

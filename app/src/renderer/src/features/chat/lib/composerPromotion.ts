import type { ChatState } from '../reducer/chatReducer'

export interface ComposerPromotion {
  identity: number
  before: ChatState
  after: ChatState
}
const listeners = new Set<(event: ComposerPromotion) => void>()
export function onComposerPromotion(listener: (event: ComposerPromotion) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function promoteComposer(event: ComposerPromotion): void {
  for (const listener of listeners) listener(event)
}

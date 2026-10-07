import type { SessionAttention } from '../store/sessionsStore'

export type NavIconState = 'in-progress' | 'awaiting-response' | 'unseen-complete' | 'default'

export function navIconState({
  generating,
  attention,
  isActive
}: {
  generating: boolean
  attention: SessionAttention | undefined
  isActive: boolean
}): NavIconState {
  if (generating) return 'in-progress'
  if (isActive || attention === undefined) return 'default'
  return attention === 'completed' ? 'unseen-complete' : 'awaiting-response'
}

import type { ChatState } from '../../reducer/chatReducer'

export type PendingSteerControl = 'send-now' | 'cancel'

interface PendingSteerControlItem {
  id: string
  submitted?: boolean
  sendNowRequested?: boolean
}

interface PendingSteerControlActions {
  sendSteerNow: () => void
  cancelSteer: (id: string) => string | null
}

export function pendingSteerControls(
  item: PendingSteerControlItem,
  foreground: ChatState['activityForeground']
): PendingSteerControl[] {
  if (item.submitted === true) return []
  return foreground === 'streaming' && item.sendNowRequested !== true
    ? ['send-now', 'cancel']
    : ['cancel']
}

export function runPendingSteerControl(
  kind: PendingSteerControl,
  item: Pick<PendingSteerControlItem, 'id'>,
  actions: PendingSteerControlActions
): string | null {
  if (kind === 'send-now') {
    actions.sendSteerNow()
    return null
  }
  return actions.cancelSteer(item.id)
}

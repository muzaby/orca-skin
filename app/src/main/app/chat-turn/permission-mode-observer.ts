// SDK 관측 권한 → 현재 세션의 controller/renderer. 초기 init은 history의 세션 확정 뒤
// 적용하고, 모드만 바뀐 보고로 세션 생성·continuity 처리를 다시 실행하지 않는다(0249 ΔV3).
import type { WebContents } from 'electron'
import type { NormalizedPermissionMode } from '../../../shared/permission-mode'
import type { TurnContext } from '../../contracts/turn'
import type { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import { sendChatEvent } from '../../infra/ipc/send'

type ObservedTurn = Pick<TurnContext, 'dbSessionId' | 'controller'>

export function createPermissionModeObserver(deps: {
  wc: WebContents
  permissionModes: PermissionModeController
  getActiveTurn: () => ObservedTurn
}): {
  report: (sessionId: string, mode: NormalizedPermissionMode) => void
  confirm: (sessionId: string) => void
} {
  let pending: { turn: ObservedTurn; sessionId: string; mode: NormalizedPermissionMode } | undefined

  const publish = (sessionId: string, mode: NormalizedPermissionMode): void => {
    void deps.permissionModes.setMode(sessionId, mode)
    sendChatEvent(deps.wc, {
      type: 'session.updated',
      sessionId,
      patch: { permissionMode: mode }
    })
  }
  const current = (): ObservedTurn | undefined => {
    const turn = deps.getActiveTurn()
    return turn.controller.signal.aborted || deps.wc.isDestroyed() ? undefined : turn
  }

  return {
    report: (sessionId, mode) => {
      const turn = current()
      if (!turn || sessionId.trim() === '') return
      if (!turn.dbSessionId) {
        pending = { turn, sessionId, mode }
        return
      }
      if (turn.dbSessionId === sessionId) publish(sessionId, mode)
    },
    confirm: (sessionId) => {
      const report = pending
      pending = undefined
      const turn = current()
      if (
        turn &&
        report?.turn === turn &&
        report.sessionId === sessionId &&
        turn.dbSessionId === sessionId
      ) {
        publish(sessionId, report.mode)
      }
    }
  }
}

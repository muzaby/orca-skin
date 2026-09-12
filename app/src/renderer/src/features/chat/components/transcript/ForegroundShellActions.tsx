import { useRef, useState } from 'react'
import {
  backgroundKey,
  canPromoteBackgroundCall,
  isBackgroundTerminal,
  isShellBackgroundTool,
  type BackgroundCallRecord,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'
import { chatApi } from '../../../../shared/api/ipc'
import { useI18n } from '../../../../shared/i18n'
import type { ToolCall } from '../../reducer/chatReducer'
import { useBackgroundStore } from '../../store/backgroundStore'
import { chatActions, useChatSession, useChatStore } from '../../store/chatStore'

function observedAsBackground(state: BackgroundSessionState, call: BackgroundCallRecord): boolean {
  if (call.backgroundObserved || call.mode === 'background' || call.mode === 'remote') return true
  const task = call.taskId ? state.tasks[backgroundKey(call.generation, call.taskId)] : undefined
  return task?.backgroundObserved === true || task?.isBackgrounded === true
}

export function ForegroundShellActions({ call }: { call: ToolCall }): React.JSX.Element | null {
  const { tr } = useI18n()
  const activeKey = useChatStore((state) => state.activeKey)
  const sessionId = useChatSession((session) => session.sessionId)
  const agentKind = useChatSession((session) => session.agentKind)
  const view = useBackgroundStore((state) =>
    sessionId == null ? undefined : state.sessions[sessionId]
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(false)

  if (
    agentKind !== 'code' ||
    sessionId == null ||
    !call.toolUseId.trim() ||
    !isShellBackgroundTool(call.name) ||
    call.result != null
  ) {
    return null
  }

  const state = view?.state
  const generation = state?.generation
  const canonicalCall =
    state && generation ? state.calls[backgroundKey(generation, call.toolUseId)] : undefined
  const task = canonicalCall?.taskId
    ? state?.tasks[backgroundKey(canonicalCall.generation, canonicalCall.taskId)]
    : undefined

  if (
    state &&
    canonicalCall &&
    (isBackgroundTerminal(task?.status) ||
      canonicalCall.phase === 'returned' ||
      isBackgroundTerminal(canonicalCall.status) ||
      observedAsBackground(state, canonicalCall))
  ) {
    return null
  }

  const eligible = Boolean(state && canonicalCall && canPromoteBackgroundCall(state, canonicalCall))

  const stillCurrent = (requestGeneration: string): boolean => {
    const chat = useChatStore.getState()
    if (chat.activeKey !== activeKey) return false
    if (chat.sessions[activeKey]?.session.sessionId !== sessionId) return false
    return useBackgroundStore.getState().sessions[sessionId]?.state.generation === requestGeneration
  }

  const promote = (): void => {
    if (!eligible || !generation || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    void chatApi
      .promoteBackgroundTask({ sessionId, generation, toolUseId: call.toolUseId })
      .then(() => {
        if (stillCurrent(generation)) chatActions.setRightPanelTileActive('subagent', true)
      })
      .catch(() => {
        if (stillCurrent(generation)) setError(tr('chat.toolMeta.promoteBackgroundFailed'))
      })
      .finally(() => {
        pendingRef.current = false
        setPending(false)
      })
  }

  return (
    <div className="mt-g3 flex flex-col items-end gap-g2 font-sans">
      {error && (
        <span role="alert" className="text-caption text-bad">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={!eligible || pending}
        onClick={promote}
        className="rounded-r4 px-p3 py-p2 text-caption font-medium text-selected outline-none transition-colors hover:bg-selected-soft focus-visible:bg-selected-soft focus-visible:ring-1 focus-visible:ring-selected disabled:cursor-default disabled:text-ink3 disabled:hover:bg-transparent"
      >
        {tr('chat.toolMeta.promoteBackground')}
      </button>
    </div>
  )
}

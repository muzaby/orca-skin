import { useEffect, useRef, useState } from 'react'
import { fileApi } from '../../../shared/api/ipc'
import type { MessageKey } from '../../../shared/i18n'
import { isFilesystemRoot } from '../../../../../shared/absolute-path'
import {
  chatActions,
  sessionBusy,
  useChatBusy,
  useChatSession,
  useChatStore
} from '../store/chatStore'

// 두 UI가 같은 선택/취소/세션 경계 규칙을 사용한다. Main이 저장과 실행 중 검사를 다시 수행한다.
export function useDirectoryPicker(allowExisting = false): {
  pick: () => Promise<void>
  picking: boolean
  disabled: boolean
  errorKey: MessageKey | null
} {
  const key = useChatStore((state) => state.activeKey)
  const sessionId = useChatSession((s) => s.sessionId)
  const loading = useChatSession((s) => s.loadingSession)
  const busy = useChatBusy()
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<{ key: string; message: MessageKey } | null>(null)
  const active = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const disabled = picking || busy || loading || (!!sessionId && !allowExisting)
  const pick = async (): Promise<void> => {
    if (disabled || pending.current) return
    const target = { key, sessionId }
    const current = (): boolean => {
      const state = useChatStore.getState()
      const session = state.sessions[target.key]?.session
      return (
        active.current &&
        state.activeKey === target.key &&
        !!session &&
        session.sessionId === target.sessionId &&
        !session.loadingSession &&
        !sessionBusy(session)
      )
    }
    pending.current = true
    setPicking(true)
    setFailure(null)
    try {
      const directory = await fileApi.pickDirectory()
      if (!directory || !current()) return
      if (isFilesystemRoot(directory)) {
        setFailure({ key, message: 'chat.composer.extraDirRejectRoot' })
        return
      }
      if (!target.sessionId) {
        chatActions.addExtraDir(directory)
        return
      }
      const result = await chatActions.addSessionDirectory(
        { key: target.key, sessionId: target.sessionId },
        directory
      )
      if (!result.ok && current()) {
        const message: MessageKey =
          result.reason === 'busy'
            ? 'chat.taskTile.directoryBusy'
            : result.reason === 'limit'
              ? 'chat.taskTile.directoryLimit'
              : result.reason === 'invalid-directory'
                ? 'chat.taskTile.directoryInvalid'
                : 'chat.taskTile.directoryFailed'
        setFailure({ key, message })
      }
    } catch {
      if (current()) setFailure({ key, message: 'chat.taskTile.directoryFailed' })
    } finally {
      pending.current = false
      if (active.current) setPicking(false)
    }
  }
  return { pick, picking, disabled, errorKey: failure?.key === key ? failure.message : null }
}

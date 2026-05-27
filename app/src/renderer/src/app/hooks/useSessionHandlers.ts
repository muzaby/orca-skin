import { useCallback, useMemo } from 'react'
import { useNavigation } from '../../shared/navigation'
import { useChatContext } from '../../features/chat'
import { useSessionsContext } from '../../features/sessions'
import { useProjectsContext } from '../../features/projects'

export interface SessionHandlers {
  currentSessionId: string | null
  projectNameById: Map<string, string>
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
}

// 사이드바 SessionList 가 필요로 하는 cross-feature 핸들러 합성. navigate / chat /
// sessions 액션을 묶어 단일 핸들러로 노출 (SessionList 가 features 경계를 넘지 않도록).
export function useSessionHandlers(): SessionHandlers {
  const { navigate } = useNavigation()
  const chat = useChatContext()
  const sessionsCtx = useSessionsContext()
  const { list: projects } = useProjectsContext()

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  const handleSelectSession = useCallback(
    (id: string): void => {
      navigate('chat')
      const meta = sessionsCtx.list.find((s) => s.id === id)
      const metaTitle = meta?.title?.trim() || meta?.preview?.trim() || null
      void chat.loadSession(id, metaTitle)
    },
    [navigate, sessionsCtx.list, chat]
  )

  const handleDeleteSession = useCallback(
    (id: string): void => {
      chat.handleSessionDeleted(id)
      void sessionsCtx.remove(id)
    },
    [chat, sessionsCtx]
  )

  const handleRenameSession = useCallback(
    (id: string, title: string): void => {
      void chat.renameSession(id, title)
      void sessionsCtx.rename(id, title)
    },
    [chat, sessionsCtx]
  )

  return {
    currentSessionId: chat.state.sessionId,
    projectNameById,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession
  }
}

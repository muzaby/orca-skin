import { useCallback, useMemo } from 'react'
import { SessionRow } from './SessionRow'
import { useNavigation } from '../../../app/providers/NavigationProvider'
import { useChatContext } from '../../../app/providers/ChatProvider'
import { useSessionsContext } from '../../../app/providers/SessionsProvider'
import { useProjectsContext } from '../../../app/providers/ProjectsProvider'

// Sidebar 의 '최근 대화' 슬롯에 주입되는 도메인 컴포넌트. cross-domain
// (ChatContext + SessionsContext + ProjectsContext) 구독을 자체적으로 처리해
// Sidebar 가 이 결합에서 자유로워지도록 한다.
export function SessionList(): React.JSX.Element {
  const { navigate } = useNavigation()
  const { state, newChat, loadSession, invalidateSessionCache, renameSession } = useChatContext()
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
      void loadSession(id, metaTitle)
    },
    [navigate, sessionsCtx.list, loadSession]
  )

  const handleDeleteSession = useCallback(
    (id: string): void => {
      invalidateSessionCache(id)
      void sessionsCtx.remove(id).then(() => {
        if (state.sessionId === id) newChat()
      })
    },
    [invalidateSessionCache, sessionsCtx, state.sessionId, newChat]
  )

  const handleRenameSession = useCallback(
    (id: string, title: string): void => {
      void renameSession(id, title)
      void sessionsCtx.rename(id, title)
    },
    [renameSession, sessionsCtx]
  )

  if (sessionsCtx.list.length === 0) {
    return <div className="px-1.5 text-[11.5px] text-ink3">아직 저장된 대화가 없습니다.</div>
  }

  return (
    <>
      {sessionsCtx.list.map((s) => (
        <SessionRow
          key={s.id}
          session={s}
          isActive={s.id === state.sessionId}
          projectName={s.projectId ? (projectNameById.get(s.projectId) ?? null) : null}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          onRename={handleRenameSession}
        />
      ))}
    </>
  )
}

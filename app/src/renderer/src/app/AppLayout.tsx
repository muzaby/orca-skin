import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigation } from '../shared/navigation'
import { useChatContext, NewChatButton } from '../features/chat'
import { useSessionsContext, SessionList } from '../features/sessions'
import { useProjectsContext } from '../features/projects'
import { BackendStatus } from '../features/backend'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { OverlayLayer } from './OverlayLayer'
import { AppRouter } from './router'

// 셸 조립 진입점. App.tsx 의 Provider 합성 직하에서 호출되며, 라우팅에 무관한
// 고정 골격 (Header + Sidebar + main + OverlayLayer) 을 한 곳에서 직접 조립한다.
// app/ 셸은 cross-feature 데이터를 읽어 sidebar 슬롯 위젯에 props 로 주입하는
// wiring 책임을 가진다 (cross-feature 결정 트리 5번: "순수 행동 간 연결").
export function AppLayout(): React.JSX.Element {
  const { info, navigate } = useNavigation()
  const chat = useChatContext()
  const sessionsCtx = useSessionsContext()
  const { list: projects } = useProjectsContext()

  // 채팅 턴 완료 시 사이드바 세션 목록 자동 갱신 — cross-domain effect 라 셸이 호스트.
  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !chat.state.inflight) void sessionsCtx.refresh()
    wasInflightRef.current = chat.state.inflight
  }, [chat.state.inflight, sessionsCtx])

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

  // Sidebar slot 들을 안정화 — React.memo(Sidebar) 가 효과를 내려면 props 가 referentially
  // stable 해야 한다. chat.state.inflight 변화로 AppLayout 이 리렌더돼도 slot identity 가
  // 유지되어 Sidebar 는 skip 된다.
  const newChatSlot = useMemo(() => <NewChatButton />, [])
  const footerSlot = useMemo(() => <BackendStatus />, [])
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        currentSessionId={chat.state.sessionId}
        projectNameById={projectNameById}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
      />
    ),
    [
      chat.state.sessionId,
      projectNameById,
      handleSelectSession,
      handleDeleteSession,
      handleRenameSession
    ]
  )

  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`Orca · ${info.label}`}
    >
      <Header breadcrumb={info.breadcrumb} />
      <div className="app-frame-grid relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]">
        <div className="app-frame-body z-0 flex min-h-0 min-w-0">
          <Sidebar newChatSlot={newChatSlot} sessionsSlot={sessionsSlot} footerSlot={footerSlot} />
          <main className="app-frame-main min-h-0 flex-1" data-context="route-target">
            <AppRouter />
          </main>
        </div>
        <OverlayLayer />
      </div>
    </div>
  )
}

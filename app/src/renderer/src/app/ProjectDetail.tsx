import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/atoms/Icon'
import { ChatPane } from './ChatPane'
import { SessionRow } from './SessionRow'
import { EditInstructionsModal } from '../components/projects/EditInstructionsModal'
import { useProjectSessions } from '../state/useProjectSessions'
import type { UseChat } from '../state/useChat'
import type { Project } from '../../../shared/ipc'

interface ProjectDetailProps {
  projectId: string
  projects: Project[]
  chat: UseChat
  backendLabel: string
  onBack: () => void
  // 사용자가 랜딩의 입력창에서 첫 메시지를 보내거나, 대화 리스트의 기존 세션을
  // 클릭하면 ProjectDetail 을 떠나 일반 'chat' 화면으로 전환한다. App.tsx 가
  // setScreen('chat') 으로 라우팅 — ProjectDetail unmount, ChatPane 풀-사이즈 mount.
  onLeaveToChat: () => void
  onUpdateInstructions: (instructions: string) => Promise<void>
}

// ProjectDetail 화면은 **랜딩 모드만** 보여준다 — 활성 세션이나 메시지가 생기는
// 순간 onLeaveToChat() 으로 빠져나간다.
// 레이어 (사용자 요구):
//   1. ← 모든 프로젝트
//   2. <프로젝트 이름>
//   3. 채팅 패널 (큰 높이)
//   4. 프로젝트 내 대화 리스트
//   우측: 지침 + 파일 placeholder
export function ProjectDetail({
  projectId,
  projects,
  chat,
  backendLabel,
  onBack,
  onLeaveToChat,
  onUpdateInstructions
}: ProjectDetailProps): React.JSX.Element {
  const sessions = useProjectSessions(projectId)
  const project = projects.find((p) => p.id === projectId) ?? null

  const [editOpen, setEditOpen] = useState(false)

  // 진입 시 이 프로젝트의 새 채팅 모드로 reset (최초 1번 또는 projectId 변경 시).
  // 같은 프로젝트의 빈 새 채팅이 이미 활성이면 no-op — 불필요한 dispatch 방지.
  // 그 다음 effect 사이클부터 isLanding 체크가 leave 라우팅을 결정한다.
  const initializedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (initializedForRef.current === projectId) {
      // 이미 같은 projectId 로 init 된 상태. chat state 변화에 따른 leave 판정만.
      const isLanding =
        chat.state.messages.length === 0 &&
        chat.state.sessionId == null &&
        !chat.state.loadingSession
      if (!isLanding) onLeaveToChat()
      return
    }
    initializedForRef.current = projectId
    const alreadyLanding =
      chat.state.pendingProjectId === projectId &&
      chat.state.sessionId == null &&
      chat.state.messages.length === 0 &&
      !chat.state.loadingSession
    if (!alreadyLanding) chat.newChat(projectId)
    // 이 사이클은 init 만 — leave 판정은 다음 commit (state 변화로 effect 재실행) 에서.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    chat.state.messages.length,
    chat.state.sessionId,
    chat.state.loadingSession,
    onLeaveToChat
  ])

  // 채팅 턴이 끝나면 새 세션이 추가됐을 수 있으므로 프로젝트 세션 목록도 refresh.
  // 사용자가 ChatPane 화면에서 send 한 후 다시 카드를 클릭해 돌아왔을 때
  // 최신 세션 목록이 보이도록.
  useEffect(() => {
    if (!chat.state.inflight) void sessions.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.state.inflight])

  return (
    <section className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <div className="flex items-center gap-2 border-b border-border bg-bg/90 px-6 py-2.5 backdrop-blur">
          <button
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-[12px] text-ink2 hover:text-ink"
          >
            <Icon name="chevR" size={12} style={{ transform: 'rotate(180deg)' }} />
            모든 프로젝트
          </button>
        </div>

        <div className="border-b border-border px-6 pb-3 pt-4">
          <h1 className="m-0 font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink">
            {project?.name ?? '…'}
          </h1>
          {project?.instructions.trim() ? (
            <div className="mt-1 line-clamp-1 text-[12px] text-ink3">{project.instructions}</div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1">
          <ChatPane chat={chat} backendLabel={backendLabel} />
        </div>

        <div className="flex max-h-[180px] flex-none flex-col border-t border-border bg-sidebar">
          <div className="flex items-baseline gap-2 px-4 pb-1 pt-3">
            <div className="font-serif text-[11px] font-semibold uppercase tracking-[0.04em] text-ink3">
              이 프로젝트의 대화
            </div>
            <div className="text-[11px] text-ink3">
              {sessions.loading ? '불러오는 중…' : `${sessions.list.length}개`}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {!sessions.loading && sessions.list.length === 0 ? (
              <div className="px-2.5 py-2 text-[11.5px] text-ink3">
                아직 이 프로젝트에 속한 대화가 없습니다. 위 입력창에서 첫 메시지를 보내보세요.
              </div>
            ) : (
              sessions.list.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isActive={s.id === chat.state.sessionId}
                  // 이미 프로젝트 컨텍스트 안이므로 prefix 생략 — title 만 표시.
                  onSelect={(id) => {
                    const meta = sessions.list.find((x) => x.id === id)
                    const metaTitle = meta?.title?.trim() || meta?.preview?.trim() || null
                    void chat.loadSession(id, metaTitle)
                  }}
                  onDelete={(id) => {
                    chat.invalidateSessionCache(id)
                    void window.orca.session.delete(id).then(() => {
                      void sessions.refresh()
                      if (chat.state.sessionId === id) chat.newChat(projectId)
                    })
                  }}
                  onRename={(id, title) => {
                    chat.renameSession(id, title)
                    void window.orca.session.rename(id, title).then(() => sessions.refresh())
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-[320px] flex-none flex-col border-l border-border bg-bg">
        <section className="border-b border-border px-5 py-4">
          <div className="mb-1.5 flex items-center">
            <div className="font-serif text-[13px] font-semibold text-ink">지침</div>
            <button
              onClick={() => setEditOpen(true)}
              className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-[11px] text-ink2 hover:text-ink"
              title="지침 편집"
            >
              <Icon name="edit" size={11} /> 편집
            </button>
          </div>
          {project?.instructions.trim() ? (
            <pre className="m-0 whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.6] text-ink2">
              {project.instructions}
            </pre>
          ) : (
            <div className="text-[12px] leading-[1.5] text-ink3">
              아직 지침이 없습니다. Claude 의 응답을 이 프로젝트에 맞게 조정하는 지침을 추가하세요.
            </div>
          )}
        </section>

        <section className="px-5 py-4">
          <div className="mb-1.5 flex items-center">
            <div className="font-serif text-[13px] font-semibold text-ink">파일</div>
            <span className="ml-auto rounded-full bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink3">
              준비 중
            </span>
          </div>
          <div className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-6 text-center">
            <Icon name="doc" size={20} />
            <div className="mt-2 text-[11.5px] leading-[1.55] text-ink3">
              이 프로젝트에서 참조할 PDF, 문서 또는 기타 텍스트를 추가할 수 있게 될 예정입니다.
            </div>
          </div>
        </section>
      </aside>

      <EditInstructionsModal
        open={editOpen}
        initial={project?.instructions ?? ''}
        projectName={project?.name ?? ''}
        onClose={() => setEditOpen(false)}
        onSave={onUpdateInstructions}
      />
    </section>
  )
}

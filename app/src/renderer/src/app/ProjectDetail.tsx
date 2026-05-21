import { useEffect, useState } from 'react'
import { Icon } from '../components/atoms/Icon'
import { ChatPane } from './ChatPane'
import { SessionRow } from './SessionRow'
import { EditInstructionsModal } from '../components/projects/EditInstructionsModal'
import { useProjects } from '../state/useProjects'
import { useProjectSessions } from '../state/useProjectSessions'
import type { UseChat } from '../state/useChat'

interface ProjectDetailProps {
  projectId: string
  chat: UseChat
  backendLabel: string
  onBack: () => void
}

export function ProjectDetail({
  projectId,
  chat,
  backendLabel,
  onBack
}: ProjectDetailProps): React.JSX.Element {
  const projects = useProjects()
  const sessions = useProjectSessions(projectId)
  const project = projects.list.find((p) => p.id === projectId) ?? null

  const [editOpen, setEditOpen] = useState(false)

  // 진입 시 새 채팅 모드로 진입. 활성 세션이 이 프로젝트에 속하지 않을 때만 reset —
  // 같은 프로젝트의 세션에 머무르고 있다면 그대로 둠 (사용자가 새로고침 / 카드 재진입 케이스).
  useEffect(() => {
    const activeBelongs =
      chat.state.sessionId &&
      sessions.list.some((s) => s.id === chat.state.sessionId && s.projectId === projectId)
    const pendingMatches = chat.state.pendingProjectId === projectId
    if (!activeBelongs && !pendingMatches) {
      chat.newChat(projectId)
    }
    // chat 은 항상 같은 instance 이므로 deps 에서 제외해도 무방. sessions.list 가
    // 비동기로 채워지므로 채워진 뒤 한 번 더 evaluate 되도록 dep 에 포함.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sessions.list])

  // 채팅 턴이 끝나면 새 세션이 추가됐을 수 있으므로 프로젝트 세션 목록도 refresh.
  // App.tsx 의 wasInflightRef 패턴과 동일.
  useEffect(() => {
    if (!chat.state.inflight) void sessions.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.state.inflight])

  const handleSaveInstructions = async (instructions: string): Promise<void> => {
    await projects.update(projectId, { instructions })
  }

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
          <span className="mx-1 text-ink3">/</span>
          <span className="font-mono text-[13px] font-semibold text-ink">
            {project?.name ?? '…'}
          </span>
          <button
            onClick={() => chat.newChat(projectId)}
            className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-panel px-2.5 py-1 text-[11.5px] text-ink2 hover:bg-sidebar"
            title="이 프로젝트에서 새 대화 시작"
          >
            <Icon name="plus" size={11} /> 새 대화
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <ChatPane chat={chat} backendLabel={backendLabel} />
        </div>

        <div className="flex max-h-[220px] flex-none flex-col border-t border-border bg-sidebar">
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
        onSave={handleSaveInstructions}
      />
    </section>
  )
}

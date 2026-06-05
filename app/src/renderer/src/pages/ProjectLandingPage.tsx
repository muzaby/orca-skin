import { useNavigate, useParams } from 'react-router-dom'
import { Composer, useChatContext } from '../features/chat'
import { useBackendContext } from '../features/backend'
import {
  ProjectInfoHero,
  ProjectInstructionsSidebar,
  ProjectLandingHeader
} from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 채팅 라이프사이클(랜딩 reset
// / 첫 턴 후 URL upgrade) 은 셸의 `useChatRouteSync` 가 담당하므로 여기서는 별도
// hook 호출 없이 순수 조립.
//
// 레이아웃 슬롯:
// - HEADER (풀-너비): ProjectLandingHeader — "모든 프로젝트" 링크만.
// - LEFT col-span-7: ProjectInfoHero (제목/지침/메타) → Composer → 세션 목록.
// - RIGHT col-span-5: ProjectInstructionsSidebar (지침 + 파일 placeholder).
// xl 미만(< 1280px)에서는 단일 컬럼 자연 스택. grid 비율 모델 채택 — 윈도우 폭과
// 무관하게 레퍼런스의 7:5 비율(58:42) 유지.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const chat = useChatContext()
  const { backendLabel, capabilities } = useBackendContext()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <ProjectLandingHeader onBack={() => navigate('/projects')} />
      <div className="grid min-w-0 flex-1 grid-cols-1 xl:grid-cols-12">
        <main className="flex min-w-0 flex-col xl:col-span-7">
          <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
            <ProjectInfoHero projectId={projectId} />
            <Composer chat={chat} backendLabel={backendLabel} canAbort={canAbort} />
            <ProjectSessionsPanel
              projectId={projectId}
              currentSessionId={chat.state.sessionId}
              refreshOnTurnEnd={chat.state.inflight}
              onSessionSelected={(id) => navigate(`/chat/${id}`)}
              onSessionDeleting={(id) => chat.handleSessionDeleted(id, projectId)}
              onSessionRenamed={chat.renameSession}
            />
          </div>
        </main>
        <aside className="min-w-0 border-t border-border xl:col-span-5 xl:border-l xl:border-t-0">
          <ProjectInstructionsSidebar projectId={projectId} />
        </aside>
      </div>
    </section>
  )
}

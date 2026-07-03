import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../shared/ui/Icon'
import { chatActions, useChatSession } from '../../store/chatStore'

// 0062 continuity 출처 배너(r2) — fork/handoff 로 파생된 세션 상단에 원본 세션 링크를
// 안내한다. 소스: draft 생성 시 스냅샷(chatStore) / 재로드 시 LoadedSession.lineage
// (chatReducer LOAD_SESSION). 파생 세션이 아니면 null.
export function LineageBanner(): React.JSX.Element | null {
  const forkFrom = useChatSession((s) => s.forkFrom)
  const handoffFrom = useChatSession((s) => s.handoffFrom)
  const parentTitle = useChatSession((s) => s.lineageParentTitle)
  // draft(sessionId 미발급 파생 뷰) 여부 — draft 위에서는 URL 이 이미 /chat/<부모> 라
  // navigate 만으로는 라우트 싱크가 깨어나지 않는다(소스-URL 가드, r5 피드백 2).
  const isDraft = useChatSession((s) => s.sessionId == null)
  const navigate = useNavigate()

  const parentId = forkFrom ?? handoffFrom
  if (!parentId) return null

  // 사이드바 부모 행 클릭(useSessionHandlers)과 동형 — draft 활성이면 store 전환을 직접
  // 수행해 원본으로 빠져나온다(draft 는 nav 행으로 생존, r4 정책). 물질화된 세션에서는
  // URL 전이가 라우트 싱크를 깨우므로 navigate 만으로 충분하다.
  const openParent = (): void => {
    if (isDraft) void chatActions.loadSession(parentId, parentTitle)
    navigate(`/chat/${parentId}`)
  }

  const label = parentTitle?.trim() || parentId.slice(0, 8)
  const relationLabel = handoffFrom ? '핸드오프로 이어졌습니다' : '분기되었습니다'
  return (
    <div className="flex items-center gap-2 border-b border-border bg-bg2/60 px-4 py-1.5 text-[12px] text-ink3">
      <Icon name="fork" size={12} />
      <span className="min-w-0 truncate">
        이 세션은 <span className="text-ink2">&lsquo;{label}&rsquo;</span>에서 {relationLabel}
      </span>
      <button
        type="button"
        onClick={openParent}
        className="ml-auto shrink-0 rounded-sm text-accent outline-none hide-focus-ring ring-focus hover:underline focus-visible:ring-1"
        title="원본 세션 열기"
      >
        원본 열기
      </button>
    </div>
  )
}

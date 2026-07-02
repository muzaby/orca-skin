import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../shared/ui/Icon'
import { useChatSession } from '../../store/chatStore'

// 0062 continuity 출처 배너(r2) — fork/handoff 로 파생된 세션 상단에 원본 세션 링크를
// 안내한다. 소스: draft 생성 시 스냅샷(chatStore) / 재로드 시 LoadedSession.lineage
// (chatReducer LOAD_SESSION). 파생 세션이 아니면 null.
export function LineageBanner(): React.JSX.Element | null {
  const forkFrom = useChatSession((s) => s.forkFrom)
  const handoffFrom = useChatSession((s) => s.handoffFrom)
  const parentTitle = useChatSession((s) => s.lineageParentTitle)
  const navigate = useNavigate()

  const parentId = forkFrom ?? handoffFrom
  if (!parentId) return null

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
        onClick={() => navigate(`/chat/${parentId}`)}
        className="ml-auto shrink-0 rounded-sm text-accent outline-none hide-focus-ring ring-focus hover:underline focus-visible:ring-1"
        title="원본 세션 열기"
      >
        원본 열기
      </button>
    </div>
  )
}

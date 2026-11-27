import type { OverlayRect } from '../../../lib/planCommentDom'
import { useI18n } from '../../../../../shared/i18n'

interface PlanCommentOverlayProps {
  rectsByComment: readonly { id: string; rects: OverlayRect[] }[]
  draftRects: readonly OverlayRect[]
  activeId: string | null
  onSelect: (id: string) => void
}

// 계획 본문 위에 코멘트 구간 밑줄/하이라이트를 절대배치로 그린다. React 가 소유한 마크다운
// DOM 을 변형하지 않고(비침습) 오버레이만 얹는다. 클릭 시 해당 코멘트를 편집 대상으로 선택.
export function PlanCommentOverlay({
  rectsByComment,
  draftRects,
  activeId,
  onSelect
}: PlanCommentOverlayProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {rectsByComment.map(({ id, rects }) =>
        rects.map((r, i) => (
          <button
            key={`${id}-${i}`}
            type="button"
            onClick={() => onSelect(id)}
            className={`pointer-events-auto absolute cursor-pointer rounded-[2px] border-b-2 outline-none transition-colors ${
              id === activeId
                ? 'border-rust bg-rust/20'
                : 'border-rust/50 bg-rust/10 hover:bg-rust/20'
            }`}
            style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
            aria-label={tr('chat.rightpanel.commentViewAria')}
          />
        ))
      )}
      {/* 미저장 선택 — 비클릭, 점선 밑줄 + 옅은 배경으로 커밋 코멘트와 구분. */}
      {draftRects.map((r, i) => (
        <span
          key={`draft-${i}`}
          className="absolute rounded-[2px] border-b-2 border-dashed border-rust/60 bg-rust/15"
          style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
        />
      ))}
    </div>
  )
}

import { useLayoutEffect, useState, type RefObject } from 'react'
import { rangeFromOffsets, rectsForRange, type OverlayRect } from '../../lib/planCommentDom'
import type { PlanComment } from '../../reducer/chatReducer'

interface PlanCommentOverlayProps {
  // 마크다운 본문만 감싸는 relative 컨테이너(힌트 제외) — 오프셋·rect 기준.
  containerRef: RefObject<HTMLElement | null>
  comments: PlanComment[]
  activeId: string | null
  // 작성 중(미저장) 선택 구간 — 팝오버가 떠 있는 동안 시각 표시. 없으면 null.
  // (textarea 포커스로 네이티브 선택이 collapse 돼도 이 오버레이가 구간을 유지한다.)
  draft: { start: number; end: number } | null
  // 본문 마크다운(planContent) — 변경 시 rect 재계산 트리거.
  contentKey: string
  onSelect: (id: string) => void
}

interface CommentRects {
  id: string
  rects: OverlayRect[]
}

// 계획 본문 위에 코멘트 구간 밑줄/하이라이트를 절대배치로 그린다. React 가 소유한 마크다운
// DOM 을 변형하지 않고(비침습) 오버레이만 얹는다. 클릭 시 해당 코멘트를 편집 대상으로 선택.
export function PlanCommentOverlay({
  containerRef,
  comments,
  activeId,
  draft,
  contentKey,
  onSelect
}: PlanCommentOverlayProps): React.JSX.Element {
  const [rectsByComment, setRectsByComment] = useState<CommentRects[]>([])
  const [draftRects, setDraftRects] = useState<OverlayRect[]>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      setRectsByComment([])
      setDraftRects([])
      return
    }
    const compute = (): void => {
      setRectsByComment(
        comments.map((c) => {
          const range = rangeFromOffsets(container, c.start, c.end)
          return { id: c.id, rects: range ? rectsForRange(range, container) : [] }
        })
      )
      const draftRange = draft ? rangeFromOffsets(container, draft.start, draft.end) : null
      setDraftRects(draftRange ? rectsForRange(draftRange, container) : [])
    }
    compute()
    // 폭 변화로 텍스트가 재배치되면 rect 도 갱신.
    const ro = new ResizeObserver(() => compute())
    ro.observe(container)
    return () => ro.disconnect()
  }, [containerRef, comments, draft, contentKey])

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
            aria-label="코멘트 보기"
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

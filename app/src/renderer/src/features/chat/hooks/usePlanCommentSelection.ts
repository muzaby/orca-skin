import { useCallback, useEffect, useState, type RefObject } from 'react'
import { offsetsFromSelection, rectsForRange } from '../lib/planCommentDom'

export interface PlanCommentAnchor {
  x: number
  top: number
  bottom: number
  containerWidth: number
}

// 계획 본문 선택 → 코멘트 작성 draft. anchor 는 contentRef 컨테이너 기준 상대좌표다.
export interface PlanCommentDraft {
  start: number
  end: number
  quote: string
  anchor: PlanCommentAnchor
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

// 컨테이너 안의 텍스트 선택을 감지해 draft 를 만든다. enabled(=계획 검토 중)가 아니면 비활성.
// 마우스업 직후 selection 이 확정되도록 rAF 한 틱 뒤 읽는다. collapsed/빈 선택은 draft 를
// 비워(클릭으로 작성 팝오버 닫힘) 준다.
export function usePlanCommentSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
): { draft: PlanCommentDraft | null; clear: () => void } {
  const [rawDraft, setRawDraft] = useState<PlanCommentDraft | null>(null)

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    let startedInContainer = false

    // 팝오버(작성/편집)는 contentRef 내부 absolute DOM 으로 렌더되므로 컨테이너의 mousedown
    // 에 잡힌다. 팝오버 내부 클릭까지 선택 시작으로 보면 textarea 포커스로 네이티브 selection 이
    // collapse → draft 가 비워져 팝오버가 사라진다. floating 컨텍스트 내부는 선택 시작에서 제외.
    const isInFloating = (target: EventTarget | null): boolean =>
      (target as HTMLElement | null)?.closest('[data-context="floating"]') != null

    const onMouseDown = (e: MouseEvent): void => {
      if (isInFloating(e.target)) return
      startedInContainer = true
    }

    // setState 는 모두 비동기(rAF) 콜백 안에서만 — effect 본문 동기 setState 회피.
    // 드래그가 컨테이너 밖에서 끝나도 document mouseup 에서 선택을 확정한다.
    const onMouseUp = (e: MouseEvent): void => {
      if (!startedInContainer || isInFloating(e.target)) return
      startedInContainer = false
      const cRect = container.getBoundingClientRect()
      const releaseX = e.clientX - cRect.left + container.scrollLeft
      const releaseY = e.clientY - cRect.top + container.scrollTop
      requestAnimationFrame(() => {
        const sel = window.getSelection()
        if (!sel) return
        const offsets = offsetsFromSelection(container, sel)
        if (!offsets) {
          setRawDraft(null)
          return
        }
        const rects = rectsForRange(sel.getRangeAt(0), container)
        const top = rects.length > 0 ? Math.min(...rects.map((r) => r.top)) : releaseY
        const bottom = rects.length > 0 ? Math.max(...rects.map((r) => r.top + r.height)) : releaseY
        setRawDraft({
          ...offsets,
          anchor: {
            x: clamp(releaseX, 0, container.clientWidth),
            top,
            bottom,
            containerWidth: container.clientWidth
          }
        })
      })
    }

    container.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      container.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerRef, enabled])

  // 비활성(계획 검토 종료) 시에는 draft 를 노출하지 않는다(상태 클리어를 effect 동기 setState
  // 없이 파생으로 처리).
  return { draft: enabled ? rawDraft : null, clear: useCallback(() => setRawDraft(null), []) }
}

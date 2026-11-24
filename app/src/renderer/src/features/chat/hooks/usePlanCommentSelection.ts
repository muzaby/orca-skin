import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { PlanCommentIndex } from '../lib/planCommentDom'

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
  enabled: boolean,
  indexRef: RefObject<PlanCommentIndex | null>,
  source: string | null,
  overlayRef: RefObject<HTMLElement | null>
): { draft: PlanCommentDraft | null; clear: () => void } {
  const [rawDraft, setRawDraft] = useState<(PlanCommentDraft & { source: string | null }) | null>(
    null
  )

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    let startedInContainer = false

    let frame: number | undefined
    const onMouseDown = (): void => {
      startedInContainer = true
    }

    const onMouseUp = (e: MouseEvent): void => {
      if (!startedInContainer) return
      startedInContainer = false
      const overlay = overlayRef.current
      if (!overlay) return
      const origin = overlay.getBoundingClientRect()
      const releaseX = e.clientX - origin.left
      const releaseY = e.clientY - origin.top
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = undefined
        const selection = window.getSelection()
        const offsets = selection && indexRef.current?.selection(selection)
        setRawDraft(
          offsets
            ? {
                ...offsets,
                source,
                anchor: {
                  x: clamp(releaseX, 0, overlay.clientWidth),
                  top: releaseY,
                  bottom: releaseY,
                  containerWidth: overlay.clientWidth
                }
              }
            : null
        )
      })
    }

    container.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      container.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [containerRef, enabled, indexRef, overlayRef, source])

  // 비활성(계획 검토 종료) 시에는 draft 를 노출하지 않는다(상태 클리어를 effect 동기 setState
  // 없이 파생으로 처리).
  return {
    draft: enabled && rawDraft?.source === source ? rawDraft : null,
    clear: useCallback(() => setRawDraft(null), [])
  }
}

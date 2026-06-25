import { useCallback, useEffect, useState, type RefObject } from 'react'
import { offsetsFromSelection } from '../lib/planCommentDom'

// 계획 본문 선택 → 코멘트 작성 draft. 화면 좌표(viewport)는 작성 팝오버 앵커에 쓴다.
export interface PlanCommentDraft {
  start: number
  end: number
  quote: string
  // 선택 영역의 viewport rect — 팝오버 가상 앵커 위치.
  rect: { top: number; left: number; bottom: number; right: number }
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

    const onMouseDown = (): void => {
      startedInContainer = true
    }

    // setState 는 모두 비동기(rAF) 콜백 안에서만 — effect 본문 동기 setState 회피.
    // 드래그가 컨테이너 밖에서 끝나도 document mouseup 에서 선택을 확정한다.
    const onMouseUp = (): void => {
      if (!startedInContainer) return
      startedInContainer = false
      requestAnimationFrame(() => {
        const sel = window.getSelection()
        if (!sel) return
        const offsets = offsetsFromSelection(container, sel)
        if (!offsets) {
          setRawDraft(null)
          return
        }
        const r = sel.getRangeAt(0).getBoundingClientRect()
        setRawDraft({
          ...offsets,
          rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right }
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

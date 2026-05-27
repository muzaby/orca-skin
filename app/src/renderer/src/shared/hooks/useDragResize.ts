import { useCallback, useRef } from 'react'

export interface UseDragResizeOptions {
  // 드래그 시작 시점에 기준 좌표 (컨테이너의 left/top) 를 측정. 측정 element 의 ref 를
  // hook 이 알 필요가 없으므로 caller 가 callback 으로 제공한다 — sidebar 외에 tile
  // separator 등에서도 재사용 가능하도록.
  getOrigin: () => number
  min: number
  max: number
  // 드래그 비활성 (예: sidebar collapsed).
  disabled?: boolean
  onChange: (value: number) => void
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

// 1차원 horizontal 드래그 → 숫자 메커니즘. mousedown → window mousemove 리스너 등록 →
// clamp → onChange → mouseup 에서 리스너 해제. 도메인 (sidebar / tile / 패널) 을 모른다.
export function useDragResize(opts: UseDragResizeOptions): {
  startResize: (e: React.MouseEvent) => void
} {
  const { getOrigin, min, max, disabled, onChange } = opts
  const draggingRef = useRef(false)

  const startResize = useCallback(
    (e: React.MouseEvent): void => {
      if (disabled) return
      e.preventDefault()
      draggingRef.current = true
      const origin = getOrigin()
      const onMove = (ev: MouseEvent): void => {
        if (!draggingRef.current) return
        onChange(clamp(Math.round(ev.clientX - origin), min, max))
      }
      const onUp = (): void => {
        draggingRef.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [getOrigin, min, max, disabled, onChange]
  )

  return { startResize }
}

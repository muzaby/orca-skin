import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseDragResizeOptions {
  // 드래그 시작 시점에 기준 좌표 (컨테이너의 left/top) 를 측정. 측정 element 의 ref 를
  // hook 이 알 필요가 없으므로 caller 가 callback 으로 제공한다 — sidebar 외에 tile
  // separator 등에서도 재사용 가능하도록.
  getOrigin: () => number
  min: number
  max: number
  // 드래그 비활성 (예: sidebar collapsed).
  disabled?: boolean
  // 우측 도킹 패널처럼 폭이 커서를 왼쪽으로 끌수록 커지는 경우 true.
  // false(기본)=좌측 도킹(폭 = clientX - origin), true=우측 도킹(폭 = origin - clientX).
  invert?: boolean
  // x(기본)=clientX, y=clientY 기반으로 값을 계산한다.
  axis?: 'x' | 'y'
  onChange: (value: number) => void
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

// 1차원 드래그 → 숫자 메커니즘. 도메인 (sidebar / tile / 패널) 을 모른다 (0325 D-014 · D-040 · EP-8).
// - mousemove 는 값만 기록하고 프레임을 하나 예약한다 — `onChange` 는 프레임마다 최대 1회, 그 프레임의
//   마지막 값으로 불린다.
// - mouseup·창 blur 는 정상 종료다 — 남은 값을 즉시 반영하고 예약 프레임을 취소하고 리스너를 해제한다.
// - 소유 컴포넌트가 끌기 중 unmount 되면 취소다 — 예약 프레임을 취소하고 리스너를 해제하며 남은 값은 버린다.
export function useDragResize(opts: UseDragResizeOptions): {
  startResize: (e: React.MouseEvent) => void
  dragging: boolean
} {
  const [dragging, setDragging] = useState(false)
  const { getOrigin, min, max, disabled, invert, axis = 'x', onChange } = opts
  // 진행 중 끌기 하나 — 정상 종료(finish)와 취소(cancel)를 갖는다.
  const dragRef = useRef<{ finish: () => void; cancel: () => void } | null>(null)

  // ⑤ unmount → 진행 중 끌기 취소(이후 이 소유자의 `onChange` 0).
  useEffect(() => () => dragRef.current?.cancel(), [])

  const startResize = useCallback(
    (e: React.MouseEvent): void => {
      if (disabled) return
      e.preventDefault()
      dragRef.current?.cancel()
      setDragging(true)
      const origin = getOrigin()
      let pending: number | null = null
      let frame: number | null = null
      const flush = (): void => {
        frame = null
        if (pending === null) return
        const value = pending
        pending = null
        onChange(value)
      }
      // ① 값 기록 + 프레임 예약 — 직접 `onChange` 를 부르지 않는다.
      const onMove = (ev: MouseEvent): void => {
        const pointer = axis === 'y' ? ev.clientY : ev.clientX
        const raw = invert ? origin - pointer : pointer - origin
        pending = clamp(Math.round(raw), min, max)
        if (frame === null) frame = window.requestAnimationFrame(flush)
      }
      const release = (): void => {
        if (frame !== null) window.cancelAnimationFrame(frame)
        frame = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', finish)
        window.removeEventListener('blur', finish)
        if (dragRef.current === drag) dragRef.current = null
      }
      // ③⑥ 정상 종료 — 남은 값 즉시 1회 반영 → 예약 취소 → 리스너 해제.
      function finish(): void {
        setDragging(false)
        if (pending !== null) {
          const value = pending
          pending = null
          onChange(value)
        }
        release()
      }
      const cancel = (): void => {
        pending = null
        release()
      }
      const drag = { finish, cancel }
      dragRef.current = drag
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', finish)
      window.addEventListener('blur', finish)
    },
    [getOrigin, min, max, disabled, invert, axis, onChange]
  )

  return { startResize, dragging }
}

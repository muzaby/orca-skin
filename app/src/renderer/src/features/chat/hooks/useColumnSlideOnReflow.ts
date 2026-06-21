import { useCallback, useLayoutEffect, useRef } from 'react'

interface ColumnReflow {
  // 열 외곽 래퍼 div 에 붙이는 콜백 ref. 리사이즈 기준점과 FLIP 측정에 공유된다.
  registerColumn: (index: number) => (el: HTMLDivElement | null) => void
  // 해당 열의 오른쪽 모서리(우측 도킹 리사이즈 기준점) getter.
  getColumnRight: (index: number) => () => number
}

// 우측 패널의 열이 제거되면 남은 열들은 레이아웃 리플로우로 화면상 위치가 바뀐다(우측 도킹이라
// 우측 열이 빠지면 남은 좌측 열이 오른쪽으로 이동). 위치 변화는 CSS 트랜지션으로 못 잡으므로 FLIP
// (First-Last-Invert-Play) 으로 슬라이드시킨다 — 제거 직전 위치를 기억했다가, 제거 후 새 위치에서
// 옛 위치로 transform 을 되돌린 뒤 다음 프레임에 0 으로 트랜지션.
//
// 위치 추적은 *배열 인덱스가 아니라 열 내용(columnKey)* 으로 한다. React 래퍼는 col 인덱스로
// keyed 라 좌측 열을 제거하면 key=0 엘리먼트가 재사용되며 내용만 우측 열로 바뀐다 — 인덱스로
// 추적하면 "index0 이 이동" 으로 오인해 *그대로 있는* 우측 열을 엉뚱하게 슬라이드시킨다(버그).
// 내용 키로 추적하면 실제로 움직인 열만(좌측 열 제거 시 우측 열은 dx=0 → 무애니메이션) 슬라이드.
//
// 열 ref 배열은 이 훅이 소유한다(리사이즈 기준점과 공유) — 인자(prop)를 mutate 하면
// react-hooks/immutability 위반이라 내부 소유로 둔다. 열 수가 줄었을 때만 애니메이션해
// 리사이즈/추가 시의 잔떨림을 피한다.
export function useColumnSlideOnReflow(columnKeys: string[]): ColumnReflow {
  const columnRefs = useRef<Array<HTMLDivElement | null>>([])
  const prevLefts = useRef<Map<string, number>>(new Map())
  const prevCount = useRef(columnKeys.length)

  const registerColumn = useCallback(
    (index: number) =>
      (el: HTMLDivElement | null): void => {
        columnRefs.current[index] = el
      },
    []
  )

  const getColumnRight = useCallback(
    (index: number) => (): number => columnRefs.current[index]?.getBoundingClientRect().right ?? 0,
    []
  )

  // deps 없음 — 매 렌더 후 실행해 위치를 항상 최신으로 유지(다음 제거가 올바른 델타를 쓰도록).
  useLayoutEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    const removed = columnKeys.length < prevCount.current
    const lefts = new Map<string, number>()

    for (let i = 0; i < columnKeys.length; i += 1) {
      const key = columnKeys[i]
      const el = columnRefs.current[i]
      const left = el?.getBoundingClientRect().left ?? 0
      lefts.set(key, left)
      if (!removed || reduce || !el) continue
      const old = prevLefts.current.get(key)
      if (old == null || old === left) continue

      // Invert: 새 위치에서 옛 위치로 즉시 되돌린다(페인트 전).
      const dx = old - left
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
      void el.getBoundingClientRect() // reflow 강제

      // Play: 다음 프레임에 transform 을 풀며 트랜지션.
      requestAnimationFrame(() => {
        el.style.transition = 'transform 200ms ease-out'
        el.style.transform = ''
        const clear = (): void => {
          el.style.transition = ''
          el.removeEventListener('transitionend', clear)
        }
        el.addEventListener('transitionend', clear)
      })
    }

    prevLefts.current = lefts
    prevCount.current = columnKeys.length
  })

  return { registerColumn, getColumnRight }
}

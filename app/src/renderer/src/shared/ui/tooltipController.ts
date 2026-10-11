// 툴팁 호스트의 이벤트·타이머 로직(0257 D-005·D-006). React·DOM 전역에 기대지 않고 주입받은 환경만
// 쓴다 — TooltipHost 가 실제 document/window 를, 테스트가 stub 을 넣는다.
import {
  TOOLTIP_SHOW_DELAY_MS,
  TOOLTIP_WARM_MS,
  claimTitle,
  findTooltipAnchor,
  releaseTitle,
  type TooltipNode
} from './tooltipTarget'

export interface TooltipView<N extends TooltipNode = TooltipNode> {
  anchor: N
  text: string
}

interface ListenerTarget {
  addEventListener(type: string, listener: (event: Event) => void, capture?: boolean): void
  removeEventListener(type: string, listener: (event: Event) => void, capture?: boolean): void
}

export interface TooltipEnv<N extends TooltipNode> {
  doc: ListenerTarget
  win: ListenerTarget
  contains(anchor: N, other: unknown): boolean
  /** 대상의 `title` 재부착·DOM 제거를 지켜본다. 반환 = 해제. */
  observe(anchor: N, onTitleChange: () => void, onDisconnect: () => void): () => void
  setTimeout(run: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  now(): number
  onChange(view: TooltipView<N> | null): void
}

interface PointerLike {
  target: unknown
  relatedTarget?: unknown
  pointerType?: string
}

/** 숨김 트리거 — 문서 capture 단계(0257 §10 EP-05). blur 는 window. */
const HIDE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const

export interface TooltipController {
  hide(): void
  dispose(): void
}

export function createTooltipController<N extends TooltipNode>(
  env: TooltipEnv<N>
): TooltipController {
  let anchor: N | null = null
  let text = ''
  let timer: unknown = null
  let visible = false
  let lastHiddenAt = Number.NEGATIVE_INFINITY
  let stopObserving: (() => void) | null = null

  const show = (): void => {
    timer = null
    if (!anchor) return
    visible = true
    env.onChange({ anchor, text })
  }

  const leave = (): void => {
    if (timer !== null) env.clearTimeout(timer)
    timer = null
    stopObserving?.()
    stopObserving = null
    if (anchor) releaseTitle(anchor)
    anchor = null
    if (visible) {
      visible = false
      lastHiddenAt = env.now()
      env.onChange(null)
    }
  }

  const onPointerOver = (event: PointerLike): void => {
    if (event.pointerType && event.pointerType !== 'mouse') return
    const next = findTooltipAnchor(event.target as TooltipNode | null) as N | null
    if (next === anchor) return
    leave()
    if (!next) return
    const claimed = claimTitle(next)
    if (claimed === '') {
      releaseTitle(next)
      return
    }
    anchor = next
    text = claimed
    const watched = next
    stopObserving = env.observe(
      watched,
      () => {
        // hover 중 컴포넌트가 새 title 을 달았다 — 다시 옮겨 OS 툴팁을 막고 문구를 바꾼다.
        if (anchor !== watched || watched.getAttribute('title') === null) return
        text = claimTitle(watched)
        if (visible) env.onChange({ anchor: watched, text })
      },
      () => {
        if (anchor === watched) leave()
      }
    )
    if (env.now() - lastHiddenAt < TOOLTIP_WARM_MS) show()
    else timer = env.setTimeout(show, TOOLTIP_SHOW_DELAY_MS)
  }

  const onPointerOut = (event: PointerLike): void => {
    if (!anchor) return
    if (event.relatedTarget && env.contains(anchor, event.relatedTarget)) return
    leave()
  }

  const onHideTrigger = (): void => leave()

  env.doc.addEventListener('pointerover', onPointerOver as unknown as (event: Event) => void, true)
  env.doc.addEventListener('pointerout', onPointerOut as unknown as (event: Event) => void, true)
  for (const type of HIDE_EVENTS) env.doc.addEventListener(type, onHideTrigger, true)
  env.win.addEventListener('blur', onHideTrigger)

  return {
    hide: leave,
    dispose: () => {
      leave()
      env.doc.removeEventListener(
        'pointerover',
        onPointerOver as unknown as (event: Event) => void,
        true
      )
      env.doc.removeEventListener(
        'pointerout',
        onPointerOut as unknown as (event: Event) => void,
        true
      )
      for (const type of HIDE_EVENTS) env.doc.removeEventListener(type, onHideTrigger, true)
      env.win.removeEventListener('blur', onHideTrigger)
    }
  }
}

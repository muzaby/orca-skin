// 0257 AC3·AC4·AC5 · VP-06 — 호스트 이벤트 수명: hover → 이동 → 500ms 표시 → 숨김 트리거 → 원복.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTooltipController, type TooltipView } from './tooltipController'
import { TOOLTIP_ATTR } from './tooltipTarget'
import { FakeNode } from './tooltipTarget.testlib'

type Listener = (event: unknown) => void

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환 형상은 추론에 맡긴다.
function harness() {
  const doc = new Map<string, Listener>()
  const win = new Map<string, Listener>()
  const views: (TooltipView<FakeNode> | null)[] = []
  let clock = 0
  let observed: { anchor: FakeNode; title: () => void; gone: () => void; stopped: boolean } | null =
    null
  const controller = createTooltipController<FakeNode>({
    doc: {
      addEventListener: (type, listener) => doc.set(type, listener as Listener),
      removeEventListener: (type) => doc.delete(type)
    },
    win: {
      addEventListener: (type, listener) => win.set(type, listener as Listener),
      removeEventListener: (type) => win.delete(type)
    },
    contains: (anchor, other) => {
      for (let n = other as FakeNode | null; n; n = n.parentElement) if (n === anchor) return true
      return false
    },
    observe: (anchor, title, gone) => {
      const record = { anchor, title, gone, stopped: false }
      observed = record
      return () => {
        record.stopped = true
      }
    },
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    now: () => clock,
    onChange: (view) => views.push(view && { ...view })
  })
  return {
    controller,
    views,
    doc,
    win,
    observed: () => observed,
    advance(ms: number): void {
      clock += ms
      vi.advanceTimersByTime(ms)
    },
    over: (target: FakeNode) => doc.get('pointerover')!({ target, pointerType: 'mouse' }),
    out: (target: FakeNode, relatedTarget: FakeNode | null) =>
      doc.get('pointerout')!({ target, relatedTarget })
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const body = new FakeNode('BODY')

describe('hover → 500ms → 검은 툴팁, title 이동', () => {
  it('499ms 미표시 · 500ms 표시 · 문구 일치 · 대상에 title 없음', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: '복사' })
    h.over(new FakeNode('svg', button))
    expect(button.hasAttribute('title')).toBe(false)
    h.advance(499)
    expect(h.views).toEqual([])
    h.advance(1)
    expect(h.views).toEqual([{ anchor: button, text: '복사' }])
  })

  it('떠나면 숨기고 title 을 원래 값으로 되돌린다 · 안쪽 이동은 떠남이 아니다', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: '복사' })
    const icon = new FakeNode('svg', button)
    h.over(button)
    h.advance(500)
    h.out(button, icon)
    expect(h.views.at(-1)).not.toBeNull()
    h.out(icon, body)
    expect(h.views.at(-1)).toBeNull()
    expect(button.getAttribute('title')).toBe('복사')
    expect(button.hasAttribute(TOOLTIP_ATTR)).toBe(false)
    expect(h.observed()?.stopped).toBe(true)
  })

  it('표시 전에 떠나면 아무것도 그리지 않고 원복한다', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: '복사' })
    h.over(button)
    h.advance(200)
    h.out(button, body)
    h.advance(1000)
    expect(h.views).toEqual([])
    expect(button.getAttribute('title')).toBe('복사')
  })

  it('마우스가 아닌 포인터는 무시한다', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: '복사' })
    h.doc.get('pointerover')!({ target: button, pointerType: 'touch' })
    expect(button.getAttribute('title')).toBe('복사')
  })
})

describe('숨김 트리거 (AC4)', () => {
  it.each(['pointerdown', 'keydown', 'wheel', 'scroll', 'blur', 'gone'] as const)(
    '%s → 숨김 + title 원복',
    (trigger) => {
      const h = harness()
      const button = new FakeNode('BUTTON', body, { title: '닫기' })
      h.over(button)
      h.advance(500)
      if (trigger === 'blur') h.win.get('blur')!({})
      else if (trigger === 'gone') h.observed()!.gone()
      else h.doc.get(trigger)!({})
      expect(h.views.at(-1)).toBeNull()
      expect(button.getAttribute('title')).toBe('닫기')
    }
  )

  it('300ms 안에 다른 title 요소로 옮기면 즉시 보인다(warm)', () => {
    const h = harness()
    const a = new FakeNode('BUTTON', body, { title: 'A' })
    const b = new FakeNode('BUTTON', body, { title: 'B' })
    h.over(a)
    h.advance(500)
    h.out(a, b)
    h.advance(100)
    h.over(b)
    expect(h.views.at(-1)).toEqual({ anchor: b, text: 'B' })
  })

  it('dispose 는 리스너를 모두 떼고 표시 중이면 원복한다', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: 'x' })
    h.over(button)
    h.advance(500)
    h.controller.dispose()
    expect(button.getAttribute('title')).toBe('x')
    expect([...h.doc.keys(), ...h.win.keys()]).toEqual([])
  })
})

describe('hover 중 title 재부착 (AC5)', () => {
  it('컴포넌트가 새 title 을 달면 다시 옮기고 문구를 바꾸며, 떠나면 새 값으로 원복한다', () => {
    const h = harness()
    const button = new FakeNode('BUTTON', body, { title: '전송' })
    h.over(button)
    h.advance(500)
    button.setAttribute('title', '피드백 보내기')
    h.observed()!.title()
    expect(button.hasAttribute('title')).toBe(false)
    expect(h.views.at(-1)).toEqual({ anchor: button, text: '피드백 보내기' })
    h.out(button, body)
    expect(button.getAttribute('title')).toBe('피드백 보내기')
  })
})

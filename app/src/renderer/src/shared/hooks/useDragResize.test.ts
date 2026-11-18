// 경계 끌기의 프레임 병합 · 정상 종료 · 취소 (0325 VP-28 r1~r8 · EP-8).
import { createElement, useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../ui/renderHarness.testfixture'
import { useDragResize } from './useDragResize'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../ui/renderHarness.testfixture')).fakeHooks
}))

let dom: FakeDom
let listeners: Map<string, Set<(event: unknown) => void>>
const handle = { start: undefined as unknown as (event: React.MouseEvent) => void }
const onChange = vi.fn<(value: number) => void>()

function Probe({ disabled = false }: { disabled?: boolean }): null {
  const { startResize } = useDragResize({
    getOrigin: () => 100,
    min: 0,
    max: 1_000,
    disabled,
    onChange
  })
  useLayoutEffect(() => {
    handle.start = startResize
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  listeners = new Map()
  // 창 리스너를 실제로 모아 두고 이벤트를 보낸다.
  Object.assign(window, {
    addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    }),
    removeEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
      listeners.get(type)?.delete(listener)
    })
  })
  onChange.mockClear()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const listenerCount = (): number => [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
const fire = (type: string, event: Record<string, unknown> = {}): void => {
  for (const listener of [...(listeners.get(type) ?? [])]) listener(event)
}
const move = (clientX: number): void => fire('mousemove', { clientX, clientY: 0 })
const start = (): void => handle.start({ preventDefault: () => {} } as React.MouseEvent)

describe('useDragResize', () => {
  it('r1 한 프레임 3회 이동 → 1회 · 마지막 값', () => {
    dom.render(createElement(Probe))
    start()
    move(150)
    move(160)
    move(170)
    expect(onChange).not.toHaveBeenCalled()
    dom.frame()
    expect(onChange.mock.calls).toEqual([[70]])
  })

  it('r2 두 프레임 → 2회', () => {
    dom.render(createElement(Probe))
    start()
    move(150)
    dom.frame()
    move(180)
    dom.frame()
    expect(onChange.mock.calls).toEqual([[50], [80]])
  })

  it('r3 mouseup 의 대기 값 → 즉시 1회 · 예약 취소', () => {
    dom.render(createElement(Probe))
    start()
    move(150)
    fire('mouseup')
    expect(onChange.mock.calls).toEqual([[50]])
    dom.frame()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('r4 이미 반영 뒤 mouseup → 추가 0', () => {
    dom.render(createElement(Probe))
    start()
    move(150)
    dom.frame()
    fire('mouseup')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('r5 mouseup 뒤 프레임 진행·이동 → 0', () => {
    dom.render(createElement(Probe))
    start()
    fire('mouseup')
    move(150)
    dom.frame()
    expect(onChange).not.toHaveBeenCalled()
    expect(listenerCount()).toBe(0)
  })

  it('r6 disabled → 리스너 0', () => {
    dom.render(createElement(Probe, { disabled: true }))
    start()
    expect(listenerCount()).toBe(0)
  })

  it('r7 대기 값·예약 프레임이 있는 채 unmount → 예약 취소 1 · 리스너 원복 · 이후 호출 0', () => {
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    dom.render(createElement(Probe))
    const before = listenerCount()
    start()
    move(150)
    expect(listenerCount()).toBe(before + 3)
    dom.render(null)
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    expect(listenerCount()).toBe(before)
    move(160)
    fire('mouseup')
    dom.frame()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('r8 대기 값이 있는 채 창 blur → 즉시 1회 · 예약 취소 · 리스너 해제', () => {
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    dom.render(createElement(Probe))
    start()
    move(150)
    fire('blur')
    expect(onChange.mock.calls).toEqual([[50]])
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    expect(listenerCount()).toBe(0)
    move(170)
    dom.frame()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

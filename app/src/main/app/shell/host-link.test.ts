import { describe, expect, it, vi } from 'vitest'
import { createHostMessageSink } from './host-link'
import { LifecycleState } from './lifecycle-state'

function setup(): {
  lifecycle: LifecycleState
  mirrorUiLocale: ReturnType<typeof vi.fn>
  onReady: ReturnType<typeof vi.fn>
  onInvalid: ReturnType<typeof vi.fn>
  sink: (raw: unknown) => void
} {
  const lifecycle = new LifecycleState()
  const mirrorUiLocale = vi.fn()
  const onReady = vi.fn()
  const onInvalid = vi.fn()
  const sink = createHostMessageSink({ lifecycle, mirrorUiLocale, onReady, onInvalid })
  return { lifecycle, mirrorUiLocale, onReady, onInvalid, sink }
}

describe('호스트 → 셸 메시지 수신', () => {
  it('수명 이벤트는 수명 상태에 반영된다', () => {
    const t = setup()
    t.sink({ type: 'lifecycle', event: { type: 'turn.started', sessionId: 's1' } })
    expect(t.lifecycle.isActive('s1')).toBe(true)
    expect(t.mirrorUiLocale).not.toHaveBeenCalled()
    expect(t.onReady).not.toHaveBeenCalled()
  })

  it('언어 알림은 셸 상태의 사본으로 간다', () => {
    const t = setup()
    t.sink({ type: 'shell.mirror', mirror: { uiLocale: 'en' } })
    expect(t.mirrorUiLocale.mock.calls).toEqual([['en']])
    expect(t.onReady).not.toHaveBeenCalled()
  })

  it('준비 완료는 언어 사본을 맞춘 뒤 준비를 알린다', () => {
    const t = setup()
    const order: string[] = []
    t.mirrorUiLocale.mockImplementation(() => order.push('mirror'))
    t.onReady.mockImplementation(() => order.push('ready'))
    t.sink({ type: 'ready', mirror: { uiLocale: 'en' } })
    expect(t.mirrorUiLocale.mock.calls).toEqual([['en']])
    expect(order).toEqual(['mirror', 'ready'])
  })

  it('형식이 틀린 메시지는 버린다', () => {
    const t = setup()
    t.sink({ type: 'lifecycle', event: { type: 'turn.started', sessionId: '' } })
    t.sink({ type: 'ready', mirror: { uiLocale: 'fr' } })
    t.sink('쓰레기')
    expect(t.onInvalid).toHaveBeenCalledTimes(3)
    expect(t.lifecycle.hasActiveTurns()).toBe(false)
    expect(t.mirrorUiLocale).not.toHaveBeenCalled()
    expect(t.onReady).not.toHaveBeenCalled()
  })
})

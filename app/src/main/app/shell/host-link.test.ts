import { describe, expect, it, vi } from 'vitest'
import { createHostMessageSink, hostStartStep } from './host-link'
import { LifecycleState } from './lifecycle-state'

function setup(): {
  lifecycle: LifecycleState
  mirrorUiLocale: ReturnType<typeof vi.fn>
  onReady: ReturnType<typeof vi.fn>
  onInvalid: ReturnType<typeof vi.fn>
  onServiceCall: ReturnType<typeof vi.fn>
  sink: (raw: unknown) => void
} {
  const lifecycle = new LifecycleState()
  const mirrorUiLocale = vi.fn()
  const onReady = vi.fn()
  const onInvalid = vi.fn()
  const onServiceCall = vi.fn()
  const sink = createHostMessageSink({
    lifecycle,
    mirrorUiLocale,
    onReady,
    onInvalid,
    onServiceCall
  })
  return { lifecycle, mirrorUiLocale, onReady, onInvalid, onServiceCall, sink }
}

describe('호스트 → 셸 메시지 수신', () => {
  it('인자가 배열이 아닌 셸 서비스 요청은 버린다', () => {
    const t = setup()
    t.sink({ type: 'service.call', id: 1, name: 'secrets.decrypt', args: 'x' })
    expect(t.onServiceCall).not.toHaveBeenCalled()
    expect(t.onInvalid).toHaveBeenCalledTimes(1)
  })

  it('셸 서비스 요청은 서비스 서버로만 간다 (EP-10)', () => {
    const t = setup()
    t.sink({ type: 'service.call', id: 4, name: 'secrets.isAvailable', args: [] })
    expect(t.onServiceCall).toHaveBeenCalledTimes(1)
    expect(t.onServiceCall).toHaveBeenCalledWith({
      type: 'service.call',
      id: 4,
      name: 'secrets.isAvailable',
      args: []
    })
    expect(t.mirrorUiLocale).not.toHaveBeenCalled()
    expect(t.onInvalid).not.toHaveBeenCalled()
  })

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

  it('데이터 호스트의 업데이트 확인·확보 요청은 각자의 수신처로만 간다', () => {
    const onUpdateCheck = vi.fn()
    const onPeerEnsure = vi.fn()
    const onServiceCall = vi.fn()
    const sink = createHostMessageSink({
      lifecycle: new LifecycleState(),
      mirrorUiLocale: vi.fn(),
      onServiceCall,
      onUpdateCheck,
      onPeerEnsure
    })
    sink({ type: 'update.check' })
    expect(onUpdateCheck).toHaveBeenCalledTimes(1)
    expect(onPeerEnsure).not.toHaveBeenCalled()
    sink({ type: 'peer.ensure' })
    expect(onPeerEnsure).toHaveBeenCalledTimes(1)
    expect(onUpdateCheck).toHaveBeenCalledTimes(1)
    expect(onServiceCall).not.toHaveBeenCalled()
  })

  // 0324 EP-24 ⑫ — 기동 단계 알림은 감독자가 따로 읽는다. 싱크는 무효로 세지 않고 다른 수신처에도 보내지 않는다.
  it('기동 단계 알림은 무효가 아니고 어느 수신처에도 가지 않는다', () => {
    const t = setup()
    t.sink({ type: 'boot.step', state: 'begin' })
    t.sink({ type: 'boot.step', state: 'end' })
    expect(t.onInvalid).not.toHaveBeenCalled()
    expect(t.onReady).not.toHaveBeenCalled()
    expect(t.onServiceCall).not.toHaveBeenCalled()
    expect(t.mirrorUiLocale).not.toHaveBeenCalled()
    t.sink({ type: 'boot.step', state: 'later' })
    expect(t.onInvalid).toHaveBeenCalledTimes(1)
  })
})

describe('hostStartStep — 감독자가 읽는 긴 단계의 시작·끝 (EP-24)', () => {
  it.each([
    [{ type: 'boot.step', state: 'begin' }, 'begin'],
    [{ type: 'boot.step', state: 'end' }, 'end'],
    [{ type: 'boot.step', state: 'later' }, undefined],
    [{ type: 'boot.step' }, undefined],
    [{ type: 'ready' }, undefined],
    [{ type: 'service.call', id: 1, name: 'secrets.decrypt', args: [] }, undefined],
    [null, undefined]
  ])('%j → %s', (message, expected) => {
    expect(hostStartStep(message)).toBe(expected)
  })
})

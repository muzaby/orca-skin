// 에이전트 호스트 쪽 피어 링크 (0324 EP-16 · EP-17 · EP-2′ · AC6′).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsSchema } from '../../../shared/protocol'
import { createPeerLink, PEER_CLOSED_ERROR } from '../../infra/ipc/peer-link'
import { createPeerLoopback } from '../../infra/ipc/peer-loopback.testfixture'
import * as stall from '../../infra/perf/stall-monitor'
import { createDataLink } from './data-link'
import { createSettingsMirror } from './settings-mirror'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(options: { clock?: () => number } = {}) {
  const received: Array<[string, unknown]> = []
  const data = createPeerLink({
    side: 'data',
    onRequest: (method, payload) => {
      received.push([method, payload])
      return { method }
    },
    onNotify: () => {}
  })
  const mirror = createSettingsMirror({ requestWrite: (patch) => dataLink.writeSettings(patch) })
  const sessionActivity = vi.fn((sessionId: string) => ({ sessionId, busy: true }))
  const other = vi.fn()
  const dataLink = createDataLink({
    mirror,
    agentOps: { sessionActivity },
    onNotify: other,
    ...(options.clock ? { clock: options.clock } : {})
  })
  const ports = createPeerLoopback()
  data.attach(ports.data)
  dataLink.attach(ports.agent)
  return { data, dataLink, mirror, received, sessionActivity, other }
}

afterEach(() => vi.restoreAllMocks())

describe('데이터 링크', () => {
  it('조회는 data.query, 기록은 data.write 로 이름과 인자를 싣는다', async () => {
    const h = setup()
    await h.dataLink.query.getSessionById('s1')
    await h.dataLink.write.updateSessionTitleAuto('s1', '제목', 7)
    expect(h.received).toEqual([
      ['data.query', { op: 'getSessionById', args: ['s1'] }],
      ['data.write', { op: 'updateSessionTitleAuto', args: ['s1', '제목', 7] }]
    ])
  })

  it('설정 통지를 사본에 넣는다 — 전체, 그다음 패치', async () => {
    const h = setup()
    const first = { ...SettingsSchema.parse({}), language: '한국어-A' }
    const second = { ...first, language: 'English-B' }
    h.data.notify('settings.snapshot', first)
    await flush()
    expect(h.mirror.getAll().language).toBe('한국어-A')
    const listener = vi.fn()
    h.mirror.onPatch(listener)
    h.data.notify('settings.patch', { settings: second, changedKeys: ['language'] })
    await flush()
    expect(h.mirror.getAll().language).toBe('English-B')
    expect(listener).toHaveBeenCalledExactlyOnceWith(second, ['language'])
  })

  it('설정 쓰기는 settings.write 요청이다 — 사본은 그대로다', async () => {
    const h = setup()
    h.data.notify('settings.snapshot', { ...SettingsSchema.parse({}), language: '한국어-A' })
    await flush()
    await h.mirror.patch({ language: 'English-B' })
    expect(h.received).toEqual([['settings.write', { language: 'English-B' }]])
    expect(h.mirror.getAll().language).toBe('한국어-A')
  })

  it('데이터 호스트의 agent.call 은 실행 표로 가고, 표에 없는 이름은 거부된다', async () => {
    const h = setup()
    await expect(
      h.data.request('agent.call', { op: 'sessionActivity', args: ['s1'] })
    ).resolves.toEqual({ sessionId: 's1', busy: true })
    await expect(h.data.request('agent.call', { op: 'spawn', args: [] })).rejects.toThrow(
      '표에 없는 피어 연산: spawn'
    )
    expect(h.sessionActivity).toHaveBeenCalledExactlyOnceWith('s1')
  })

  it('그 밖의 통지는 주입한 수신기로 간다', async () => {
    const h = setup()
    h.data.notify('turn.persistFailed', { turnKey: 't1', error: 'disk' })
    await flush()
    expect(h.other).toHaveBeenCalledExactlyOnceWith('turn.persistFailed', {
      turnKey: 't1',
      error: 'disk'
    })
  })

  it('데이터 호스트가 사라지면 기다리던 조회가 실패하고 이후 조회는 바로 실패한다', async () => {
    const h = setup()
    h.data.close()
    await expect(h.dataLink.query.getSessionById('s1')).rejects.toThrow(PEER_CLOSED_ERROR)
  })

  it('60ms 걸린 교차 요청은 메서드 이름과 함께 한 건 기록된다 (EP-2′)', async () => {
    const record = vi.spyOn(stall, 'recordStall').mockImplementation(() => {})
    let now = 0
    const h = setup({ clock: () => now })
    h.sessionActivity.mockImplementation((sessionId: string) => {
      now += 60
      return { sessionId, busy: false }
    })
    await h.data.request('agent.call', { op: 'sessionActivity', args: ['s1'] })
    const slow = record.mock.calls.filter(([entry]) => entry.label === 'agent.call')
    expect(slow).toEqual([
      [expect.objectContaining({ source: 'peer', label: 'agent.call', durationMs: 60 })]
    ])
  })
})

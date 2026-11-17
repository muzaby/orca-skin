// 데이터 호스트 쪽 피어 링크 (0324 EP-21 규칙 칸 5분기 · EP-17 · EP-2′ · AC48).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsSchema, type Settings } from '../../../shared/protocol'
import {
  createPeerLink,
  PEER_CLOSED_ERROR,
  PEER_UNAVAILABLE_ERROR
} from '../../infra/ipc/peer-link'
import { createPeerLoopback } from '../../infra/ipc/peer-loopback.testfixture'
import * as stall from '../../infra/perf/stall-monitor'
import { createAgentLink } from './agent-link'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fakeSettings(initial: Settings) {
  let current = initial
  const listeners: Array<(next: Settings, keys: readonly string[]) => void> = []
  return {
    getAll: () => current,
    patch: vi.fn((input: unknown) => {
      current = { ...current, ...(input as Partial<Settings>) }
      for (const listener of listeners) listener(current, Object.keys(input as object))
      return current
    }),
    onPatch: (listener: (next: Settings, keys: readonly string[]) => void) => {
      listeners.push(listener)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(options: { clock?: () => number } = {}) {
  const settings = fakeSettings({ ...SettingsSchema.parse({}), language: '한국어-A' })
  const ensureAgent = vi.fn()
  const find = vi.fn((id: string) => ({ id, title: `title-${id}` }))
  const rename = vi.fn((id: string, title: string) => `${id}:${title}`)
  const agentLink = createAgentLink({
    queryOps: { find },
    writeOps: { rename },
    settings,
    ensureAgent,
    ...(options.clock ? { clock: options.clock } : {})
  })
  // 에이전트 호스트 — 받은 `agent.call` 을 차례대로 적는다.
  const calls: unknown[] = []
  const notified: Array<[string, unknown]> = []
  const agent = createPeerLink({
    side: 'agent',
    onRequest: (_method, payload) => {
      calls.push(payload)
      return `done:${(payload as { op: string }).op}`
    },
    onNotify: (method, payload) => notified.push([method, payload])
  })
  const connect = (): void => {
    const ports = createPeerLoopback()
    agentLink.attach(ports.data)
    agent.attach(ports.agent)
  }
  return { agentLink, agent, connect, calls, notified, settings, ensureAgent, find, rename }
}

afterEach(() => vi.restoreAllMocks())

describe('에이전트 호스트 확보 (EP-21)', () => {
  it('연결됨 — 바로 보내고 확보 요청은 없다', async () => {
    const h = setup()
    h.connect()
    await expect(h.agentLink.request('sessionActivity', 's1')).resolves.toBe('done:sessionActivity')
    await expect(h.agentLink.requestEnsured('cancelShell', 'r1')).resolves.toBe('done:cancelShell')
    expect(h.calls).toEqual([
      { op: 'sessionActivity', args: ['s1'] },
      { op: 'cancelShell', args: ['r1'] }
    ])
    expect(h.ensureAgent).not.toHaveBeenCalled()
  })

  it('미연결 + 확보 요청 — 확보를 한 번만 부탁하고 기다린다', async () => {
    const h = setup()
    const first = h.agentLink.requestEnsured('readNativeHistory', 's1')
    const second = h.agentLink.requestEnsured('cancelShell', 'r2')
    await flush()
    expect(h.ensureAgent).toHaveBeenCalledTimes(1)
    expect(h.calls).toEqual([])
    // 대기 중 피어 연결 — 들어온 순서대로 보낸다.
    h.connect()
    await expect(first).resolves.toBe('done:readNativeHistory')
    await expect(second).resolves.toBe('done:cancelShell')
    expect(h.calls).toEqual([
      { op: 'readNativeHistory', args: ['s1'] },
      { op: 'cancelShell', args: ['r2'] }
    ])
  })

  it('대기 중 확보 실패 — 기다리던 요청이 모두 거부된다', async () => {
    const h = setup()
    const first = h.agentLink.requestEnsured('readNativeHistory', 's1')
    const second = h.agentLink.requestEnsured('cancelShell', 'r2')
    h.agentLink.unavailable()
    await expect(first).rejects.toThrow(PEER_UNAVAILABLE_ERROR)
    await expect(second).rejects.toThrow(PEER_UNAVAILABLE_ERROR)
    // 실패 뒤의 확보 요청은 다시 부탁한다.
    void h.agentLink.requestEnsured('cancelShell', 'r3').catch(() => {})
    expect(h.ensureAgent).toHaveBeenCalledTimes(2)
  })

  it('미연결 + 확보 안 함 — 바로 거부하고 확보를 부탁하지 않는다', async () => {
    const h = setup()
    await expect(h.agentLink.request('sessionActivity', 's1')).rejects.toThrow(PEER_CLOSED_ERROR)
    await expect(h.agentLink.request('discardSession', 's1')).rejects.toThrow(PEER_CLOSED_ERROR)
    expect(h.ensureAgent).not.toHaveBeenCalled()
  })
})

describe('에이전트 호스트가 보낸 요청', () => {
  it('조회·기록은 각자의 표로 가고, 표에 없는 이름은 거부된다', async () => {
    const h = setup()
    h.connect()
    await expect(h.agent.request('data.query', { op: 'find', args: ['s1'] })).resolves.toEqual({
      id: 's1',
      title: 'title-s1'
    })
    await expect(h.agent.request('data.write', { op: 'rename', args: ['s1', 'T'] })).resolves.toBe(
      's1:T'
    )
    // 기록 연산을 조회 메서드로 부를 수 없다.
    await expect(
      h.agent.request('data.query', { op: 'rename', args: ['s1', 'T'] })
    ).rejects.toThrow('표에 없는 피어 연산: rename')
    await expect(h.agent.request('data.write', { op: 'find', args: ['s1'] })).rejects.toThrow(
      '표에 없는 피어 연산: find'
    )
    expect(h.rename).toHaveBeenCalledTimes(1)
    expect(h.find).toHaveBeenCalledTimes(1)
  })

  it('형식이 틀린 연산 봉투는 거부되고 표의 함수는 불리지 않는다 (AC20′)', async () => {
    const h = setup()
    h.connect()
    await expect(h.agent.request('data.query', { op: 'find' })).rejects.toThrow()
    await expect(h.agent.request('data.query', 'find')).rejects.toThrow()
    expect(h.find).not.toHaveBeenCalled()
  })
})

describe('설정 사본 송신 (F3)', () => {
  it('연결될 때마다 전체를, 바뀌면 패치를 보낸다', async () => {
    const h = setup()
    h.connect()
    await flush()
    expect(h.notified).toEqual([['settings.snapshot', h.settings.getAll()]])
    h.settings.patch({ language: 'English-B' })
    await flush()
    expect(h.notified[1]).toEqual([
      'settings.patch',
      { settings: h.settings.getAll(), changedKeys: ['language'] }
    ])
    // 다시 연결되면 전체를 다시 보낸다.
    h.connect()
    await flush()
    expect(h.notified[2]).toEqual(['settings.snapshot', h.settings.getAll()])
  })

  it('설정 쓰기 요청 — 설정 저장소에 쓰고 패치 통지가 뒤따른다', async () => {
    const h = setup()
    h.connect()
    await h.agent.request('settings.write', { language: 'English-B' })
    await flush()
    expect(h.settings.patch).toHaveBeenCalledExactlyOnceWith({ language: 'English-B' })
    expect(h.notified.map(([method]) => method)).toEqual(['settings.snapshot', 'settings.patch'])
  })
})

describe('피어 수신 계측 (EP-2′ · AC6′)', () => {
  it('60ms 걸린 교차 요청은 메서드 이름과 함께 한 건 기록된다', async () => {
    const record = vi.spyOn(stall, 'recordStall').mockImplementation(() => {})
    let now = 0
    const h = setup({ clock: () => now })
    h.find.mockImplementation((id: string) => {
      now += 60
      return { id, title: 'slow' }
    })
    h.connect()
    await h.agent.request('data.query', { op: 'find', args: ['s1'] })
    const slow = record.mock.calls.filter(([entry]) => entry.label === 'data.query')
    expect(slow).toEqual([
      [expect.objectContaining({ source: 'peer', label: 'data.query', durationMs: 60 })]
    ])
  })
})

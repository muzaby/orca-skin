// 연결(Auth) 핸들러 등록 전수 대조 (0181 → 0188). 채널을 늘리는 작업의 유일한 실패 모드는 **하나가
// 조용히 빠지는 것**이다 — 미등록 채널은 renderer invoke 가 영영 pending 이 된다(0179 선례).

import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ConnectionHandlerDeps } from './providers'

const registered = vi.hoisted(() => [] as string[])
// 핸들러 본체도 잡아 둔다 — 등록 여부만 보면 "무엇을 돌려주는가" 가 통째로 무검증이 된다.
const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      registered.push(channel)
      handlers.set(channel, handler)
    })
  }
}))

const { registerConnectionHandlers } = await import('./providers')

const EXPECTED = [
  CHANNELS.providerList,
  CHANNELS.providerState,
  CHANNELS.providerLogin,
  CHANNELS.providerContinue,
  CHANNELS.providerReauth,
  CHANNELS.providerRevoke,
  CHANNELS.providerConnect
]

describe('registerConnectionHandlers', () => {
  it('provider 채널 전수를 등록한다', () => {
    registerConnectionHandlers({} as unknown as ConnectionHandlerDeps)
    expect([...registered].sort()).toEqual([...EXPECTED].sort())
  })

  // 0188 — 내부 소유자는 바뀌었지만 **채널 이름은 compat 계약이라 그대로다**(D-030).
  it('등록 집합이 CHANNELS 의 provider 도메인 전수와 일치한다', () => {
    const declared = Object.entries(CHANNELS)
      .filter(([, value]) => value.startsWith('orca:provider:'))
      .map(([, value]) => value)
    expect([...EXPECTED].sort()).toEqual([...declared].sort())
  })

  // 0194 — **invoke 는 renderer 의 첫 스냅샷이다.** push 경로만 `resuming` 을 싣고 여기서
  // 빠뜨리면, 복원 중에 열린 창이 메인 셸을 띄우고 그 뒤에서 로그인 창이 뜬다.
  it('첫 스냅샷에도 복원 진행 여부를 싣는다', async () => {
    const deps = {
      auth: {
        currentStep: () => null,
        describe: () => ({ authId: 'a', label: 'a', origin: '', methods: [] })
      },
      gate: { state: () => ({ required: true, passed: true, bypassed: false, dailyRelogin: [] }) },
      connections: [],
      resuming: () => true
    } as unknown as ConnectionHandlerDeps
    registerConnectionHandlers(deps)

    const handler = handlers.get(CHANNELS.providerState)
    expect(handler).toBeDefined()
    const state = (await handler?.()) as { resuming: boolean }
    expect(state.resuming).toBe(true)
  })

  // 0291 — 연결 버튼 invoke 는 배포 연결 로직의 최종 상태를 wire 형상으로 돌려준다.
  it('connect는 최종 연결 상태를 돌려준다', async () => {
    const connect = vi.fn(async (id: string) =>
      id === 'opencode-llm'
        ? { state: 'failed' as const, message: 'OpenCode가 설치되어 있지 않습니다.' }
        : { state: 'connected' as const }
    )
    registerConnectionHandlers({
      auth: { connect },
      gate: {},
      connections: [],
      resuming: () => false
    } as unknown as ConnectionHandlerDeps)
    const handler = handlers.get(CHANNELS.providerConnect)!
    expect(await handler({}, { providerId: 'opencode-llm' })).toEqual({
      state: 'failed',
      message: 'OpenCode가 설치되어 있지 않습니다.'
    })
    expect(await handler({}, { providerId: 'other' })).toEqual({
      state: 'connected',
      message: null
    })
    expect(connect.mock.calls).toEqual([['opencode-llm'], ['other']])
    await expect(handler({}, { providerId: '' })).rejects.toThrow()
  })
})

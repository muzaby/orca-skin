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
  CHANNELS.providerRevoke
]

describe('registerConnectionHandlers', () => {
  it('provider 채널 6종을 빠짐없이 등록한다', () => {
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
      gate: { state: () => ({ required: true, passed: true, bypassed: false }) },
      connections: [],
      resuming: () => true
    } as unknown as ConnectionHandlerDeps
    registerConnectionHandlers(deps)

    const handler = handlers.get(CHANNELS.providerState)
    expect(handler).toBeDefined()
    const state = (await handler?.()) as { resuming: boolean }
    expect(state.resuming).toBe(true)
  })
})

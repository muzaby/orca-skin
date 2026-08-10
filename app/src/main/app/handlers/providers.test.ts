// provider 핸들러 등록 전수 대조 (0181). 채널을 늘리는 작업의 유일한 실패 모드는 **하나가
// 조용히 빠지는 것**이다 — 미등록 채널은 renderer invoke 가 영영 pending 이 된다(0179 선례).

import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ProviderPlatform } from '../../features/providers/platform'

const registered = vi.hoisted(() => [] as string[])

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string) => {
      registered.push(channel)
    })
  }
}))

const { registerProviderHandlers } = await import('./providers')

const EXPECTED = [
  CHANNELS.providerList,
  CHANNELS.providerState,
  CHANNELS.providerLogin,
  CHANNELS.providerContinue,
  CHANNELS.providerReauth,
  CHANNELS.providerRevoke
]

describe('registerProviderHandlers', () => {
  it('provider 채널 6종을 빠짐없이 등록한다', () => {
    registerProviderHandlers({} as ProviderPlatform)
    expect([...registered].sort()).toEqual([...EXPECTED].sort())
  })

  it('등록 집합이 CHANNELS 의 provider 도메인 전수와 일치한다', () => {
    const declared = Object.entries(CHANNELS)
      .filter(([, value]) => value.startsWith('orca:provider:'))
      .map(([, value]) => value)
    expect([...EXPECTED].sort()).toEqual([...declared].sort())
  })
})

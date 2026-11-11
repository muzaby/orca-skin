import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ChatDeps } from './deps'

const registered: string[] = []
vi.mock('../../infra/ipc/handle', () => ({
  handle: (channel: string) => {
    registered.push(channel)
  }
}))
vi.mock('../../infra/ipc/send', () => ({ broadcastBackgroundEvent: vi.fn() }))

const { registerBackgroundHandlers } = await import('./background')

describe('registerBackgroundHandlers', () => {
  // 0308 — 원본 출력 읽기 채널은 없다. 상태 조회·개별 중단·전환 셋만 등록한다.
  it('상태 조회·개별 중단·전환 채널만 등록한다', () => {
    registerBackgroundHandlers({} as unknown as ChatDeps)
    expect([...registered].sort()).toEqual(
      [
        CHANNELS.chatBackgroundState,
        CHANNELS.chatStopBackgroundTask,
        CHANNELS.chatPromoteBackgroundTask
      ].sort()
    )
  })
})

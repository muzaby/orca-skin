// 0324 AC33′ — 죽었던 호스트가 다시 붙으면 세션 목록을 다시 읽는다. 종료 통지만으로는 읽지 않는다.
import { describe, expect, it, vi } from 'vitest'

const sessionList = vi.hoisted(() => vi.fn(async () => []))
const lifecycle = vi.hoisted(() => ({
  listener: null as
    ((event: { host: 'agent' | 'data'; kind: 'exited' | 'reconnected' }) => void) | null,
  off: vi.fn()
}))

vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: { list: sessionList, onTitle: vi.fn(() => () => undefined) },
  projectApi: { listSessions: vi.fn(async () => []) },
  hostApi: {
    onLifecycle: vi.fn((listener: typeof lifecycle.listener) => {
      lifecycle.listener = listener
      return lifecycle.off
    })
  }
}))

const { subscribeSessions } = await import('./sessionsStore')

describe('세션 목록 — 호스트 재연결 (AC33′)', () => {
  it('재연결이면 목록을 한 번 다시 읽고, 종료만으로는 읽지 않으며, 해제하면 구독을 끊는다', async () => {
    const unsubscribe = subscribeSessions()
    lifecycle.listener!({ host: 'agent', kind: 'exited' })
    expect(sessionList).not.toHaveBeenCalled()
    lifecycle.listener!({ host: 'data', kind: 'reconnected' })
    await vi.waitFor(() => expect(sessionList).toHaveBeenCalledTimes(1))
    unsubscribe()
    expect(lifecycle.off).toHaveBeenCalledTimes(1)
  })
})

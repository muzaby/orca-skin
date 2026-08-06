import { describe, expect, it, vi } from 'vitest'
import { connectorActions, runReconnect, type ConnectorActionInput } from './connectorActions'
import type { AuthLogoutOutcome } from '../../../../../shared/ipc'

const CONNECTED: ConnectorActionInput = { connected: true }
const IDLE: ConnectorActionInput = { connected: false }

describe('connectorActions — 상태 점', () => {
  it('연결되면 green, 아니면 slate', () => {
    expect(connectorActions(CONNECTED).tone).toBe('green')
    expect(connectorActions(IDLE).tone).toBe('slate')
  })
})

describe('connectorActions — 액션 집합', () => {
  it('연결됨 → reconnect·disconnect', () => {
    const { actions } = connectorActions(CONNECTED)
    expect(actions).toContain('reconnect')
    expect(actions).toContain('disconnect')
    expect(actions).not.toContain('connect')
  })

  it('미연결 → connect 만 (끊긴 것을 끊을 수 없다)', () => {
    const { actions } = connectorActions(IDLE)
    expect(actions).toContain('connect')
    expect(actions).not.toContain('disconnect')
    expect(actions).not.toContain('reconnect')
  })

  // 0178 — UI 추가 경로를 제거해 서버는 전부 빌드타임 정적이다. 지울 수 있는 것이 없다.
  it('어느 상태에서도 remove 액션이 나오지 않는다', () => {
    expect(connectorActions(CONNECTED).actions).not.toContain('remove')
    expect(connectorActions(IDLE).actions).not.toContain('remove')
  })
})

const LOGGED_OUT: AuthLogoutOutcome = { kind: 'logged_out', endedBindingIds: ['b1'] }

describe('runReconnect', () => {
  it('재연결은 disconnect 후 open 순서로 부른다', async () => {
    const calls: string[] = []
    const ok = await runReconnect({
      disconnect: () => {
        calls.push('disconnect')
        return Promise.resolve(LOGGED_OUT)
      },
      open: () => calls.push('open')
    })
    expect(ok).toBe(true)
    expect(calls).toEqual(['disconnect', 'open'])
  })

  it('disconnect 실패면 open 을 부르지 않는다', async () => {
    const open = vi.fn()
    const ok = await runReconnect({
      disconnect: () => Promise.reject(new Error('boom')),
      open
    })
    expect(ok).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  // broker 는 실패를 던지지 않고 결과로 돌려준다 — `.catch()` 만 보면 성공으로 오인한다.
  it('던지지 않고 failed 로 돌아와도 open 을 부르지 않는다', async () => {
    const open = vi.fn()
    const ok = await runReconnect({
      disconnect: () => Promise.resolve({ kind: 'failed', message: 'nope' }),
      open
    })
    expect(ok).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})

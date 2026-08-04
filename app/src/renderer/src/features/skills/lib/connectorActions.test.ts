import { describe, expect, it, vi } from 'vitest'
import { connectorActions, runReconnect, type ConnectorActionInput } from './connectorActions'
import type { AuthLogoutOutcome } from '../../../../../shared/ipc'

const CONNECTED_INSTANCE: ConnectorActionInput = { connected: true, source: 'instance' }
const IDLE_INSTANCE: ConnectorActionInput = { connected: false, source: 'instance' }
const CONNECTED_STATIC: ConnectorActionInput = { connected: true, source: 'static' }

describe('connectorActions — 상태 점', () => {
  it('연결되면 green, 아니면 slate', () => {
    expect(connectorActions(CONNECTED_INSTANCE).tone).toBe('green')
    expect(connectorActions(IDLE_INSTANCE).tone).toBe('slate')
  })
})

describe('connectorActions — 액션 집합', () => {
  it('연결됨 → reconnect·disconnect', () => {
    const { actions } = connectorActions(CONNECTED_INSTANCE)
    expect(actions).toContain('reconnect')
    expect(actions).toContain('disconnect')
    expect(actions).not.toContain('connect')
  })

  it('미연결 → connect 만 (끊긴 것을 끊을 수 없다)', () => {
    const { actions } = connectorActions(IDLE_INSTANCE)
    expect(actions).toContain('connect')
    expect(actions).not.toContain('disconnect')
    expect(actions).not.toContain('reconnect')
  })

  it('instance 만 remove', () => {
    expect(connectorActions(CONNECTED_INSTANCE).actions).toContain('remove')
    expect(connectorActions(IDLE_INSTANCE).actions).toContain('remove')
  })

  it('static 은 remove 없음', () => {
    expect(connectorActions(CONNECTED_STATIC).actions).not.toContain('remove')
    expect(connectorActions({ connected: false, source: 'static' }).actions).not.toContain('remove')
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

  it('not_supported 도 성공으로 보지 않는다', async () => {
    const open = vi.fn()
    const ok = await runReconnect({
      disconnect: () => Promise.resolve({ kind: 'not_supported' }),
      open
    })
    expect(ok).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})

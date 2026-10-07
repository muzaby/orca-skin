import { describe, expect, it, vi } from 'vitest'
import type { AuthSnapshot, BoundAuth } from '../contracts/auth'
import type { ProviderGateState } from '../../shared/ipc'
import { createGate } from '../features/gate'
import { startDailyGate } from './daily-gate'

describe('daily gate composition', () => {
  function harness(): {
    gate: ReturnType<typeof createGate>
    daily: ReturnType<typeof startDailyGate>
    snapshots: AuthSnapshot[]
    forbidden: Record<string, () => never>
    push(): void
    pushed: ProviderGateState[]
    timers: Map<number, () => void>
    wakeListeners: Set<() => void>
    setNow(value: number): void
    wake(): void
    fire(): void
  } {
    let now = new Date(2026, 9, 7, 23, 59, 59).getTime()
    let id = 0
    const timers = new Map<number, () => void>()
    const wakeListeners = new Set<() => void>()
    const forbidden = Object.fromEntries(
      ['login', 'reauth', 'revoke', 'resume', 'refresh', 'request'].map((method) => [
        method,
        vi.fn(() => {
          throw new Error(`boundary called Auth.${method}`)
        })
      ])
    )
    const snapshots: AuthSnapshot[] = ['first', 'second'].map((authId) => ({
      authId,
      status: 'valid',
      verified: true,
      credentialRevision: 2
    }))
    const members = snapshots.map((snapshot) => ({
      ...forbidden,
      authId: snapshot.authId,
      snapshot: () => snapshot
    })) as unknown as BoundAuth[]
    const gate = createGate({ members, bypass: () => false })
    const pushed: ProviderGateState[] = []
    const push = vi.fn(() => {
      pushed.push(gate.state())
    })
    const daily = startDailyGate({
      gate,
      pushConnectionState: push,
      now: () => now,
      setTimer: (callback) => {
        timers.set(++id, callback)
        return id
      },
      clearTimer: (handle) => void timers.delete(handle as number),
      subscribeWake: (check) => {
        wakeListeners.add(check)
        return () => {
          wakeListeners.delete(check)
        }
      }
    })
    return {
      gate,
      daily,
      snapshots,
      forbidden,
      push,
      pushed,
      timers,
      wakeListeners,
      setNow: (value: number) => {
        now = value
      },
      wake: () => {
        for (const check of wakeListeners) check()
      },
      fire: () => {
        const [handle, callback] = [...timers.entries()][0]!
        timers.delete(handle)
        callback()
      }
    }
  }

  it('lapses before a single midnight push and leaves Auth and other effects untouched', () => {
    const h = harness()
    const before = structuredClone(h.snapshots)
    expect(h.push).not.toHaveBeenCalled()
    h.setNow(new Date(2026, 9, 8).getTime())
    h.fire()
    expect(h.push).toHaveBeenCalledTimes(1)
    expect(h.pushed).toEqual([
      { required: true, passed: false, bypassed: false, dailyRelogin: ['first', 'second'] }
    ])
    expect(h.snapshots).toEqual(before)
    for (const method of Object.values(h.forbidden)) expect(method).not.toHaveBeenCalled()
    h.daily.dispose()
  })

  it('follows passed → two required → one required → passed → two required', () => {
    const h = harness()
    const observed: Array<boolean | string[]> = [h.gate.state().passed]
    h.setNow(new Date(2026, 9, 8).getTime())
    h.wake()
    observed.push(h.gate.state().dailyRelogin)
    h.snapshots[0]!.credentialRevision++
    h.gate.noteLoginCommit('first', h.snapshots[0]!.credentialRevision)
    observed.push(h.gate.state().dailyRelogin)
    h.snapshots[1]!.credentialRevision++
    h.gate.noteLoginCommit('second', h.snapshots[1]!.credentialRevision)
    observed.push(h.gate.state().passed)
    h.setNow(new Date(2026, 9, 9).getTime())
    h.wake()
    observed.push(h.gate.state().dailyRelogin)
    expect(observed).toEqual([true, ['first', 'second'], ['second'], true, ['first', 'second']])
    expect(h.push).toHaveBeenCalledTimes(2)
    h.daily.dispose()
  })

  it('wakes only on a changed day and disposal removes timers and wake callbacks', () => {
    const h = harness()
    h.wake()
    h.wake()
    expect(h.push).not.toHaveBeenCalled()
    h.setNow(new Date(2026, 9, 8).getTime())
    h.wake()
    h.wake()
    expect(h.push).toHaveBeenCalledTimes(1)
    const retained = [...h.wakeListeners][0]!
    h.daily.dispose()
    expect(h.timers.size).toBe(0)
    expect(h.wakeListeners.size).toBe(0)
    h.setNow(new Date(2026, 9, 9).getTime())
    retained()
    h.wake()
    expect(h.push).toHaveBeenCalledTimes(1)
  })
})

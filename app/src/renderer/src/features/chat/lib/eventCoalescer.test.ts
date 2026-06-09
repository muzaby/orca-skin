import { describe, it, expect } from 'vitest'
import { createEventCoalescer, type CoalescerScheduler } from './eventCoalescer'
import type { NormalizedEvent } from '../../../../../shared/ipc'

// 주입 가능한 fake scheduler — schedule 된 콜백을 수동으로 tick() 해 rAF 를 흉내낸다.
function fakeScheduler(): CoalescerScheduler & { tick: () => void; pending: () => boolean } {
  let cb: (() => void) | null = null
  let seq = 0
  return {
    schedule: (fn) => {
      cb = fn
      return ++seq
    },
    cancel: () => {
      cb = null
    },
    tick: () => {
      const fn = cb
      cb = null
      fn?.()
    },
    pending: () => cb !== null
  }
}

const delta = (text: string): NormalizedEvent =>
  ({
    type: 'message.delta',
    sessionId: 's',
    provider: 'claude-code',
    delta: { text }
  }) as NormalizedEvent

const completed = (text: string): NormalizedEvent =>
  ({
    type: 'message.completed',
    sessionId: 's',
    provider: 'claude-code',
    message: { text }
  }) as NormalizedEvent

describe('createEventCoalescer', () => {
  it('연속 델타를 한 틱으로 모아 순서대로 한꺼번에 emit 한다', () => {
    const out: NormalizedEvent[] = []
    const sched = fakeScheduler()
    const c = createEventCoalescer((ev) => out.push(ev), sched)

    c.push(delta('a'))
    c.push(delta('b'))
    c.push(delta('c'))
    // 아직 flush 전 — 버퍼에만 쌓임.
    expect(out).toHaveLength(0)
    expect(sched.pending()).toBe(true)

    sched.tick()
    expect(out.map((e) => (e.type === 'message.delta' ? e.delta.text : '?'))).toEqual([
      'a',
      'b',
      'c'
    ])
    expect(sched.pending()).toBe(false)
  })

  it('비-델타 이벤트는 버퍼를 먼저 flush 한 뒤 즉시 emit 한다(순서 보존)', () => {
    const out: NormalizedEvent[] = []
    const sched = fakeScheduler()
    const c = createEventCoalescer((ev) => out.push(ev), sched)

    c.push(delta('a'))
    c.push(delta('b'))
    c.push(completed('ab')) // 비-델타 → 버퍼(a,b) flush 후 completed emit

    expect(out.map((e) => e.type)).toEqual(['message.delta', 'message.delta', 'message.completed'])
    // 예약돼 있던 틱은 취소돼 중복 flush 가 없다.
    expect(sched.pending()).toBe(false)
  })

  it('dispose 는 버퍼를 emit 없이 폐기하고 예약을 취소한다', () => {
    const out: NormalizedEvent[] = []
    const sched = fakeScheduler()
    const c = createEventCoalescer((ev) => out.push(ev), sched)

    c.push(delta('stale'))
    c.dispose()
    sched.tick() // 폐기됐으므로 아무 일도 없어야 한다

    expect(out).toHaveLength(0)
    expect(sched.pending()).toBe(false)
  })

  it('flush 는 버퍼가 비어 있으면 no-op 이다', () => {
    const out: NormalizedEvent[] = []
    const sched = fakeScheduler()
    const c = createEventCoalescer((ev) => out.push(ev), sched)
    c.flush()
    expect(out).toHaveLength(0)
  })
})

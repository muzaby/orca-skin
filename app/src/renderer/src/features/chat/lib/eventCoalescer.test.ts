import { describe, it, expect } from 'vitest'
import { createEventCoalescer, type CoalescerScheduler, type DeltaEvent } from './eventCoalescer'
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
    delta: { text }
  }) as NormalizedEvent

const completed = (text: string): NormalizedEvent =>
  ({
    type: 'message.completed',
    sessionId: 's',
    message: { text }
  }) as NormalizedEvent

describe('createEventCoalescer', () => {
  function createSink(out: Array<NormalizedEvent | readonly DeltaEvent[]>): {
    emit: (event: NormalizedEvent) => void
    emitDeltaBatch: (events: readonly DeltaEvent[]) => void
  } {
    return {
      emit: (event) => out.push(event),
      emitDeltaBatch: (events) => out.push(events)
    }
  }

  it('연속 델타를 한 틱의 단일 batch로 순서대로 emit 한다', () => {
    const out: Array<NormalizedEvent | readonly DeltaEvent[]> = []
    const sched = fakeScheduler()
    const c = createEventCoalescer(createSink(out), sched)

    c.push(delta('a'))
    c.push(delta('b'))
    c.push(delta('c'))
    // 아직 flush 전 — 버퍼에만 쌓임.
    expect(out).toHaveLength(0)
    expect(sched.pending()).toBe(true)

    sched.tick()
    expect(out).toHaveLength(1)
    const batch = out[0] as readonly DeltaEvent[]
    expect(batch.map((event) => event.delta.text)).toEqual(['a', 'b', 'c'])
    expect(sched.pending()).toBe(false)
  })

  it('비-델타 이벤트는 버퍼를 먼저 flush 한 뒤 즉시 emit 한다(순서 보존)', () => {
    const out: Array<NormalizedEvent | readonly DeltaEvent[]> = []
    const sched = fakeScheduler()
    const c = createEventCoalescer(createSink(out), sched)

    c.push(delta('a'))
    c.push(delta('b'))
    c.push(completed('ab')) // 비-델타 → 버퍼(a,b) flush 후 completed emit

    expect(Array.isArray(out[0])).toBe(true)
    expect((out[0] as readonly DeltaEvent[]).map((event) => event.delta.text)).toEqual(['a', 'b'])
    expect((out[1] as NormalizedEvent).type).toBe('message.completed')
    // 예약돼 있던 틱은 취소돼 중복 flush 가 없다.
    expect(sched.pending()).toBe(false)
  })

  it('dispose 는 버퍼를 emit 없이 폐기하고 예약을 취소한다', () => {
    const out: Array<NormalizedEvent | readonly DeltaEvent[]> = []
    const sched = fakeScheduler()
    const c = createEventCoalescer(createSink(out), sched)

    c.push(delta('stale'))
    c.dispose()
    sched.tick() // 폐기됐으므로 아무 일도 없어야 한다

    expect(out).toHaveLength(0)
    expect(sched.pending()).toBe(false)
  })

  it('flush 는 버퍼가 비어 있으면 no-op 이다', () => {
    const out: Array<NormalizedEvent | readonly DeltaEvent[]> = []
    const sched = fakeScheduler()
    const c = createEventCoalescer(createSink(out), sched)
    c.flush()
    expect(out).toHaveLength(0)
  })
})

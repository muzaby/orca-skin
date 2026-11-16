// `recordStall` 이 로거에 남기는 형식 (0324 AC5) — thread·durationMs·severity 와 info 레벨.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordStall, setStallThread, stallThread } from './stall-monitor'
import { setRootLogger } from '../log/registry'
import type { AppLogger } from '../log/log-manager'

const calls: Array<{ level: string; scope: string; event: string; data?: unknown }> = []

function fakeLogger(scope = 'root'): AppLogger {
  const push =
    (level: string) =>
    (event: string, data?: unknown): void => {
      calls.push({ level, scope, event, data })
    }
  return {
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: (event) => push('error')(event),
    child: (next) => fakeLogger(next)
  }
}

beforeEach(() => {
  calls.length = 0
  setRootLogger(fakeLogger())
})
afterEach(() => {
  setRootLogger(null)
  setStallThread('main')
})

describe('recordStall', () => {
  it('예산 이상은 perf 스코프에 info 로 1건 남긴다', () => {
    recordStall({ thread: 'agent-host', source: 'loop', durationMs: 159.6, count: 2 })
    expect(calls).toEqual([
      {
        level: 'info',
        scope: 'perf',
        event: 'perf.stall',
        data: { thread: 'agent-host', source: 'loop', durationMs: 159, count: 2, severity: 'long' }
      }
    ])
  })

  it('160ms 이상은 severe 다', () => {
    recordStall({ thread: 'main', source: 'loop', durationMs: 160 })
    expect(calls[0]?.data).toMatchObject({ severity: 'severe' })
  })

  it('예산 미만은 남기지 않는다', () => {
    recordStall({ thread: 'main', source: 'loop', durationMs: 49.9 })
    expect(calls).toEqual([])
  })

  it('스레드 이름은 프로세스 진입점이 바꾼다', () => {
    expect(stallThread()).toBe('main')
    setStallThread('agent-host')
    expect(stallThread()).toBe('agent-host')
  })
})

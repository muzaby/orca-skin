import { describe, expect, it } from 'vitest'
import { runStartupSequence } from './startup-sequence'
import type { MigrationReport } from './migrate-legacy'

const emptyReport: MigrationReport = {
  moved: [],
  conflicts: [],
  failed: [],
  configRoots: { legacy: '/old', current: '/new' }
}

// §10 EP-07 / VP-07 — 이관이 `initLog()` 보다 먼저다. 두 호출을 맞바꾸면 이 스위트가 red 다.
describe('runStartupSequence', () => {
  it('이관을 먼저 부르고 그다음 로그를 초기화한다', () => {
    const order: string[] = []
    const result = runStartupSequence({
      migrateLegacy: () => {
        order.push('migrate')
        return emptyReport
      },
      initLog: () => {
        order.push('initLog')
        return 'logger' as const
      }
    })
    expect(order).toEqual(['migrate', 'initLog'])
    expect(result.logger).toBe('logger')
    expect(result.migration).toBe(emptyReport)
  })

  it('이관이 던져도 로거는 초기화된다 — 진단을 통째로 잃지 않는다', () => {
    const order: string[] = []
    const result = runStartupSequence({
      migrateLegacy: () => {
        order.push('migrate')
        throw new Error('boom')
      },
      initLog: () => {
        order.push('initLog')
        return 'logger' as const
      }
    })
    expect(order).toEqual(['migrate', 'initLog'])
    expect(result.migration.failed).toHaveLength(1)
    // 부팅을 막지 않는다 — DB 3종 실패만 critical 이고 그것은 migrateLegacyRoots 안에서 붙는다.
    expect(result.migration.failed[0]?.critical).toBe(false)
    expect(result.migration.configRoots).toEqual({ legacy: '', current: '' })
  })
})

// 0231 VP-215 (MD-101 ↔ UT) — 백그라운드 실행 줄 모델 파생.

import { describe, expect, it } from 'vitest'
import { deriveBackgroundRun } from './backgroundRun'

const base = { backgroundTaskCount: 1, elapsedSeconds: 30, subagentMeta: {} }

describe('deriveBackgroundRun (0231 MD-101)', () => {
  it('작업이 없으면 줄을 만들지 않는다', () => {
    expect(deriveBackgroundRun({ ...base, backgroundTaskCount: 0 })).toBeNull()
  })

  it('건수와 경과를 싣는다', () => {
    expect(deriveBackgroundRun(base)).toMatchObject({ count: 1, elapsedSeconds: 30 })
  })

  it('앵커가 없으면 경과를 생략한다 — 0초라고 말하지 않는다', () => {
    const model = deriveBackgroundRun({ ...base, elapsedSeconds: null })
    expect(model).not.toHaveProperty('elapsedSeconds')
  })

  it('정착하지 않은 엔트리 중 **가장 늦게 시작한** 요약을 고른다', () => {
    const model = deriveBackgroundRun({
      ...base,
      subagentMeta: {
        old: { startedAtMs: 100, summary: '오래된 요약' },
        fresh: { startedAtMs: 200, summary: '최신 요약' }
      }
    })
    expect(model).toMatchObject({ summary: '최신 요약' })
  })

  it('정착한 엔트리의 요약은 쓰지 않는다 — 그 자리는 완료 통지 행이 갖는다', () => {
    const model = deriveBackgroundRun({
      ...base,
      subagentMeta: {
        done: { startedAtMs: 999, summary: '끝난 작업', status: 'completed' },
        live: { startedAtMs: 1, summary: '도는 작업' }
      }
    })
    expect(model).toMatchObject({ summary: '도는 작업' })
  })

  it('재시도는 요약을 **이긴다** — 둘이 함께 실리지 않는다', () => {
    const model = deriveBackgroundRun({
      ...base,
      subagentMeta: {
        a: {
          startedAtMs: 1,
          summary: '파일을 읽는 중',
          retry: { attempt: 2, maxRetries: 5, errorCategory: 'overloaded' }
        }
      }
    })
    expect(model).toMatchObject({ retry: { attempt: 2, maxRetries: 5 } })
    expect(model).not.toHaveProperty('summary')
  })

  it('요약도 재시도도 없으면 건수·경과만 남는다', () => {
    const model = deriveBackgroundRun({ ...base, subagentMeta: { a: { startedAtMs: 1 } } })
    expect(model).toEqual({ count: 1, elapsedSeconds: 30 })
  })
})

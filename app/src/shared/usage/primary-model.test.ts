// 0149 — 라이브(claude-map)와 복원(usage-map) 경로가 같은 점수식을 쓰는지 고정한다.
// 이전엔 라이브가 input+cacheRead+cacheCreation, 복원이 input only 라 같은 턴이 재로드 후
// 다른 주 모델로 귀속됐고, 그 결과 도넛 분모(컨텍스트 윈도)가 뒤집혔다.

import { describe, expect, it } from 'vitest'
import { pickPrimaryModel, primaryModelScore } from './primary-model'

describe('pickPrimaryModel', () => {
  it('컨텍스트 점유(input+cacheRead+cacheCreation) 최대 모델을 고른다', () => {
    expect(
      pickPrimaryModel({
        'claude-haiku': { inputTokens: 900 },
        'claude-opus': { inputTokens: 100, cacheReadTokens: 5_000, cacheCreationTokens: 200 }
      })
    ).toBe('claude-opus')
  })

  it('input only 로 비교하면 뒤집히는 케이스에서 캐시 점유를 반영한다(구 복원 경로 회귀)', () => {
    // 제목 모델이 raw input 은 더 크지만, 실제 대화 모델은 캐시 읽기로 컨텍스트를 점유한다.
    const usage = {
      'title-model': { inputTokens: 400 },
      'main-model': { inputTokens: 10, cacheReadTokens: 190_000 }
    }
    expect(pickPrimaryModel(usage)).toBe('main-model')
  })

  it('output 은 컨텍스트를 차지하지 않으므로 점수에 들지 않는다', () => {
    expect(primaryModelScore({ inputTokens: 1, cacheReadTokens: 2, cacheCreationTokens: 3 })).toBe(
      6
    )
  })

  it('전부 0(사용량 미상)이면 첫 키를 유지한다', () => {
    expect(pickPrimaryModel({ first: {}, second: {} })).toBe('first')
  })

  it('빈 입력은 undefined', () => {
    expect(pickPrimaryModel({})).toBeUndefined()
  })
})

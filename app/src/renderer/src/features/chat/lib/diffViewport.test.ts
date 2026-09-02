import { describe, expect, it } from 'vitest'
import { planUpwardExpansionCompensation } from './diffViewport'

describe('diff viewport compensation', () => {
  it('본문이 아직 스크롤되지 않아도 꼬리 여백을 확보해 기존 줄 위치를 보존한다', () => {
    expect(
      planUpwardExpansionCompensation({
        scrollTop: 0,
        scrollHeight: 436,
        clientHeight: 516,
        anchorDelta: 157,
        tailSpacerHeight: 0
      })
    ).toEqual({ scrollTop: 157, tailSpacerHeight: 237 })
  })

  it('이미 충분한 스크롤 범위가 있으면 여백을 늘리지 않는다', () => {
    expect(
      planUpwardExpansionCompensation({
        scrollTop: 120,
        scrollHeight: 900,
        clientHeight: 500,
        anchorDelta: 80,
        tailSpacerHeight: 24
      })
    ).toEqual({ scrollTop: 200, tailSpacerHeight: 24 })
  })
})

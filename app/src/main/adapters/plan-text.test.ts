import { describe, expect, it } from 'vitest'
import { resolvePlanText } from './plan-text'

// 0215 VP-04 (MD-04 ↔ UT) — 계획 본문 해소 체인 3분기.
describe('resolvePlanText — 해소 체인 (AT-01·AT-02·AT-03)', () => {
  it('AT-02 — 주입된 plan 이 있으면 그것이 이긴다 (서술은 쓰이지 않는다)', () => {
    expect(resolvePlanText({ plan: '## 계획\n1. 고친다' }, '모델이 말로 한 계획')).toBe(
      '## 계획\n1. 고친다'
    )
  })

  it('AT-01 — plan 이 없으면 이번 턴 서술을 쓴다', () => {
    expect(resolvePlanText({}, '모델이 말로 한 계획')).toBe('모델이 말로 한 계획')
    // 필드 자체가 없는 경우와 비문자열인 경우가 같다 — CLI 가 주입하지 않으면 키가 아예 없다.
    expect(resolvePlanText({ plan: 42 }, '모델이 말로 한 계획')).toBe('모델이 말로 한 계획')
    expect(resolvePlanText(undefined, '모델이 말로 한 계획')).toBe('모델이 말로 한 계획')
  })

  it('공백만 있는 plan 은 "없음" 이다 — 빈 본문으로 승인 카드를 띄우지 않는다', () => {
    expect(resolvePlanText({ plan: '   \n  ' }, '서술')).toBe('서술')
  })

  it('AT-03 — 둘 다 없으면 빈 문자열이다 (호출부가 실패로 다룬다)', () => {
    expect(resolvePlanText({}, undefined)).toBe('')
    expect(resolvePlanText({}, '   ')).toBe('')
  })
})

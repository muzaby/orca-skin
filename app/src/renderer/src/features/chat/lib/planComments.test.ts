import { describe, expect, it } from 'vitest'
import { hasSendablePlanFeedback, quoteSnippet, toPlanFeedback } from './planComments'
import type { PlanComment } from '../reducer/chatReducer'

function pc(overrides: Partial<PlanComment> = {}): PlanComment {
  return {
    id: 'c1',
    quote: '인용',
    start: 10,
    end: 20,
    body: '의견',
    createdAt: 1,
    ...overrides
  }
}

describe('toPlanFeedback', () => {
  it('start 오름차순 정렬 + body trim + IPC shape 로 변환한다', () => {
    const fb = toPlanFeedback(
      [pc({ id: 'b', start: 100, body: '  둘째  ' }), pc({ id: 'a', start: 5, body: '첫째' })],
      ''
    )
    expect(fb.comments.map((c) => c.id)).toEqual(['a', 'b'])
    expect(fb.comments[1].body).toBe('둘째')
    expect(fb.comments[0]).toEqual({ id: 'a', quote: '인용', start: 5, end: 20, body: '첫째' })
  })

  it('본문이 빈(공백) 코멘트는 제거한다', () => {
    const fb = toPlanFeedback([pc({ id: 'a', body: '유효' }), pc({ id: 'b', body: '   ' })], '')
    expect(fb.comments.map((c) => c.id)).toEqual(['a'])
  })

  it('note 는 trim 후 비면 생략, 있으면 포함', () => {
    expect(toPlanFeedback([pc()], '  메모 ').note).toBe('메모')
    expect(toPlanFeedback([pc()], '   ').note).toBeUndefined()
  })
})

describe('quoteSnippet', () => {
  it('공백 정규화하고 max 이하면 그대로', () => {
    expect(quoteSnippet('여러   줄\n인용', 80)).toBe('여러 줄 인용')
  })
  it('max 초과 시 말줄임표로 자른다', () => {
    expect(quoteSnippet('abcdefghij', 5)).toBe('abcd…')
  })
})

describe('hasSendablePlanFeedback', () => {
  it('본문 있는 코멘트가 있으면 true', () => {
    expect(hasSendablePlanFeedback([pc({ body: '의견' })], '')).toBe(true)
  })
  it('코멘트 없고 note 만 있어도 true', () => {
    expect(hasSendablePlanFeedback([], '메모')).toBe(true)
  })
  it('빈 코멘트 + 빈 note 면 false', () => {
    expect(hasSendablePlanFeedback([pc({ body: '  ' })], '  ')).toBe(false)
  })
})

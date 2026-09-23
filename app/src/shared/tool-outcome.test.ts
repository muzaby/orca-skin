import { describe, expect, it } from 'vitest'
import {
  nonExecutionEquals,
  nonExecutionOutcome,
  parseNonExecution,
  readToolResultMeta,
  type NonExecution
} from './tool-outcome'

// 0239 UT-01 — 비실행 사유 분류(D-008)·SDK wrapper 파싱·값 비교(D-014)의 SSOT.
describe('nonExecutionOutcome (D-008)', () => {
  const cases: Array<[NonExecution, ReturnType<typeof nonExecutionOutcome>]> = [
    [{ source: 'sdk', kind: 'user-rejected' }, 'rejected'],
    [{ source: 'sdk', kind: 'permission-rule' }, 'rejected'],
    [{ source: 'sdk', kind: 'automode-blocked' }, 'rejected'],
    [{ source: 'sdk', kind: 'automode-unavailable' }, 'rejected'],
    [{ source: 'sdk', kind: 'automode-parsing-error' }, 'rejected'],
    [{ source: 'sdk', kind: 'interrupted' }, 'aborted'],
    [{ source: 'sdk', kind: 'cancelled' }, 'cancelled'],
    [{ source: 'sdk', kind: 'some-future-kind' }, 'not_executed'],
    [{ source: 'host', kind: 'no_result' }, 'not_executed'],
    [{ source: 'host', kind: 'retracted' }, 'not_executed']
  ]
  it.each(cases)('%j → %s', (input, expected) => {
    expect(nonExecutionOutcome(input)).toBe(expected)
  })
})

describe('readToolResultMeta — SDK tool_result_meta(@internal)', () => {
  it('일치하는 id 의 사유와 사람 피드백을 읽는다', () => {
    expect(
      readToolResultMeta(
        [
          { id: 'other', non_execution_kind: 'cancelled' },
          { id: 't1', non_execution_kind: 'user-rejected', user_feedback: '다른 방법으로' }
        ],
        't1'
      )
    ).toEqual({ source: 'sdk', kind: 'user-rejected', userFeedback: '다른 방법으로' })
  })
  it('일치하는 id 가 없으면 부재다', () => {
    expect(readToolResultMeta([{ id: 'x', non_execution_kind: 'cancelled' }], 't1')).toBe(undefined)
  })
  it('배열이 아니거나 kind 가 빈 문자열·비문자열이면 부재다', () => {
    expect(readToolResultMeta({ id: 't1', non_execution_kind: 'cancelled' }, 't1')).toBe(undefined)
    expect(readToolResultMeta([{ id: 't1', non_execution_kind: '' }], 't1')).toBe(undefined)
    expect(readToolResultMeta([{ id: 't1', non_execution_kind: 3 }], 't1')).toBe(undefined)
    expect(readToolResultMeta(undefined, 't1')).toBe(undefined)
  })
  it('빈 피드백은 싣지 않는다', () => {
    expect(
      readToolResultMeta([{ id: 't1', non_execution_kind: 'cancelled', user_feedback: '' }], 't1')
    ).toEqual({ source: 'sdk', kind: 'cancelled' })
  })
})

describe('parseNonExecution — 영속·IPC 왕복 형상 검증', () => {
  it('알려진 형상만 통과한다', () => {
    expect(parseNonExecution({ source: 'host', kind: 'no_result' })).toEqual({
      source: 'host',
      kind: 'no_result'
    })
    expect(parseNonExecution({ source: 'sdk', kind: 'cancelled', userFeedback: 'x' })).toEqual({
      source: 'sdk',
      kind: 'cancelled',
      userFeedback: 'x'
    })
    expect(parseNonExecution({ source: 'host', kind: 'other' })).toBe(undefined)
    expect(parseNonExecution({ source: 'sdk', kind: '' })).toBe(undefined)
    expect(parseNonExecution('cancelled')).toBe(undefined)
    expect(parseNonExecution(null)).toBe(undefined)
  })
  it('JSON 왕복 값이 원래 값과 같다', () => {
    const value: NonExecution = { source: 'sdk', kind: 'user-rejected', userFeedback: '아니' }
    expect(parseNonExecution(JSON.parse(JSON.stringify(value)))).toEqual(value)
  })
})

describe('nonExecutionEquals (D-014)', () => {
  it('둘 다 부재면 같고 한쪽만 있으면 다르다', () => {
    expect(nonExecutionEquals(undefined, undefined)).toBe(true)
    expect(nonExecutionEquals(undefined, { source: 'host', kind: 'no_result' })).toBe(false)
    expect(nonExecutionEquals({ source: 'host', kind: 'no_result' }, undefined)).toBe(false)
  })
  it('다른 객체여도 값이 같으면 같다', () => {
    expect(
      nonExecutionEquals(
        { source: 'sdk', kind: 'cancelled', userFeedback: 'a' },
        { source: 'sdk', kind: 'cancelled', userFeedback: 'a' }
      )
    ).toBe(true)
  })
  it('source·kind·userFeedback 중 하나라도 다르면 다르다', () => {
    expect(
      nonExecutionEquals(
        { source: 'sdk', kind: 'user-rejected' },
        { source: 'sdk', kind: 'cancelled' }
      )
    ).toBe(false)
    expect(
      nonExecutionEquals(
        { source: 'host', kind: 'no_result' },
        { source: 'host', kind: 'retracted' }
      )
    ).toBe(false)
    expect(
      nonExecutionEquals(
        { source: 'sdk', kind: 'cancelled', userFeedback: 'a' },
        { source: 'sdk', kind: 'cancelled' }
      )
    ).toBe(false)
  })
})

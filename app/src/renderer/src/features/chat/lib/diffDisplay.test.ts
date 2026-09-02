// 0211 ΔV4 — 표시 옵션 넷의 순수 파생 (VP-59 · AT-51 · EP-33).
//
// 넷 다 이미 받은 줄에서 계산한다. 조회를 부르면 D-088 이 깨지고 "세대당 1회" 도 함께 깨진다.

import { describe, expect, it } from 'vitest'
import type { DiffLine } from './diffLines'
import { changedWordSpan, collapseWhitespaceOnlyChanges, toSideBySideRows } from './diffDisplay'

const line = (
  type: DiffLine['type'],
  oldLine: number | null,
  newLine: number | null,
  text: string
): DiffLine => ({ type, oldLine, newLine, lineNo: newLine ?? oldLine ?? 0, text })

describe('공백 변경 숨기기', () => {
  it('공백만 다른 줄 쌍을 unchanged 로 접는다', () => {
    const collapsed = collapseWhitespaceOnlyChanges([
      line('removed', 1, null, 'const a=1'),
      line('added', null, 1, 'const a = 1')
    ])

    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]).toMatchObject({ type: 'unchanged', oldLine: 1, newLine: 1 })
  })

  it('내용이 실제로 다르면 접지 않는다 — 그 항목이 뜻을 갖는다', () => {
    const collapsed = collapseWhitespaceOnlyChanges([
      line('removed', 1, null, 'const a = 1'),
      line('added', null, 1, 'const a = 2')
    ])

    expect(collapsed.map((entry) => entry.type)).toEqual(['removed', 'added'])
  })

  it('앞 쌍만 공백이면 그 쌍만 접고 나머지 짝은 보존한다', () => {
    const collapsed = collapseWhitespaceOnlyChanges([
      line('removed', 1, null, 'a=1'),
      line('removed', 2, null, 'b = 1'),
      line('added', null, 1, 'a = 1'),
      line('added', null, 2, 'b = 2')
    ])

    expect(collapsed.map((entry) => entry.type)).toEqual(['unchanged', 'removed', 'added'])
  })

  it('unchanged 만 있는 입력은 그대로다', () => {
    const input = [line('unchanged', 1, 1, 'x')]
    expect(collapseWhitespaceOnlyChanges(input)).toEqual(input)
  })
})

describe('변경된 단어 강조', () => {
  it('공통 접두·접미를 걷어낸 가운데만 구간이다', () => {
    const span = changedWordSpan('const a = 1', 'const a = 2')

    expect('const a = 1'.slice(span.old.start, span.old.end)).toBe('1')
    expect('const a = 2'.slice(span.new.start, span.new.end)).toBe('2')
  })

  it('토큰 경계를 지킨다 — 한 글자 차이도 그 토큰 전체다', () => {
    const span = changedWordSpan('call(foo)', 'call(foobar)')

    expect('call(foo)'.slice(span.old.start, span.old.end)).toBe('call(foo)')
    expect('call(foobar)'.slice(span.new.start, span.new.end)).toBe('call(foobar)')
  })

  it('완전히 같은 줄은 빈 구간이라 강조가 붙지 않는다', () => {
    const span = changedWordSpan('same', 'same')

    expect(span.new.end).toBe(span.new.start)
  })

  it('한쪽이 비면 나머지 전체가 구간이다', () => {
    const span = changedWordSpan('', 'added text')

    expect('added text'.slice(span.new.start, span.new.end)).toBe('added text')
  })
})

describe('나란히 보기 행 짝짓기', () => {
  it('연속된 removed/added 를 앞에서부터 마주 놓는다', () => {
    const rows = toSideBySideRows([
      line('unchanged', 1, 1, 'ctx'),
      line('removed', 2, null, 'old1'),
      line('removed', 3, null, 'old2'),
      line('added', null, 2, 'new1')
    ])

    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      left: expect.objectContaining({ text: 'ctx' }),
      right: expect.objectContaining({ text: 'ctx' })
    })
    expect(rows[1].left?.text).toBe('old1')
    expect(rows[1].right?.text).toBe('new1')
    // 남는 쪽은 반대편을 비운다 — 줄이 사라지지 않는다.
    expect(rows[2].left?.text).toBe('old2')
    expect(rows[2].right).toBeNull()
  })

  it('추가만 있는 묶음은 좌측이 비고 줄 수가 보존된다', () => {
    const rows = toSideBySideRows([line('added', null, 1, 'a'), line('added', null, 2, 'b')])

    expect(rows.map((row) => [row.left, row.right?.text])).toEqual([
      [null, 'a'],
      [null, 'b']
    ])
  })
})

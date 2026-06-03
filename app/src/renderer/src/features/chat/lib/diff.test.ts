import { describe, it, expect } from 'vitest'
import { diffLines } from './diff'

describe('diffLines', () => {
  it('빈 → content 는 전부 add', () => {
    const { rows, added, removed } = diffLines('', 'a\nb\nc')
    expect(added).toBe(3)
    expect(removed).toBe(0)
    expect(rows.map((r) => r.type)).toEqual(['add', 'add', 'add'])
    expect(rows.map((r) => r.newNo)).toEqual([1, 2, 3])
    expect(rows.every((r) => r.oldNo === null)).toBe(true)
  })

  it('동일 텍스트는 변경 없음', () => {
    const { added, removed, rows } = diffLines('a\nb', 'a\nb')
    expect(added).toBe(0)
    expect(removed).toBe(0)
    expect(rows.every((r) => r.type === 'context')).toBe(true)
  })

  it('교체/추가 라인을 add/del/context 로 정렬', () => {
    const { rows, added, removed } = diffLines('a\nb', 'a\nB\nc')
    expect(added).toBe(2)
    expect(removed).toBe(1)
    // 첫 줄 a 는 공통(context), b→B 는 del+add, c 는 add
    expect(rows[0]).toMatchObject({ type: 'context', text: 'a', oldNo: 1, newNo: 1 })
    expect(rows.some((r) => r.type === 'del' && r.text === 'b')).toBe(true)
    expect(rows.some((r) => r.type === 'add' && r.text === 'B')).toBe(true)
    expect(rows.some((r) => r.type === 'add' && r.text === 'c')).toBe(true)
  })

  it('끝 개행은 라인 수에 포함하지 않는다', () => {
    expect(diffLines('', 'a\n').added).toBe(1)
  })

  it('startLine 으로 라인넘버 오프셋', () => {
    const { rows } = diffLines('', 'x', 10)
    expect(rows[0].newNo).toBe(10)
  })
})

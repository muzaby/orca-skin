import { describe, expect, it } from 'vitest'
import { buildDiffLines } from './diffLines'

describe('줄 파생 (AT-18)', () => {
  it('추가·삭제·유지 세 종류를 낸다', () => {
    const lines = buildDiffLines('a\nb\n', 'a\nc\n')
    expect(lines.map((l) => l.type)).toEqual(['unchanged', 'removed', 'added'])
    expect(lines.map((l) => l.text)).toEqual(['a', 'b', 'c'])
  })

  it('줄번호는 각 축의 것이다 — 삭제는 old 축, 추가는 new 축', () => {
    const lines = buildDiffLines('a\nb\nc\n', 'a\nc\n')
    const removed = lines.find((l) => l.type === 'removed')
    const kept = lines.filter((l) => l.type === 'unchanged')
    expect(removed?.lineNo).toBe(2)
    expect(kept.map((l) => l.lineNo)).toEqual([1, 2])
  })

  it('신규 파일(old 가 빈 문자열)은 전부 added 다', () => {
    const lines = buildDiffLines('', 'x\ny\n')
    expect(lines.map((l) => l.type)).toEqual(['added', 'added'])
    expect(lines.map((l) => l.lineNo)).toEqual([1, 2])
  })

  it('변경이 없으면 전부 unchanged 다 — 빈 배열이 아니다', () => {
    expect(buildDiffLines('a\n', 'a\n').map((l) => l.type)).toEqual(['unchanged'])
  })
})

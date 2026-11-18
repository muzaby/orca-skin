// 상한 판정 (0324 AC10 · MD-05) — 줄 수 합 400 이하는 같은 호출에서 결과, 401 이상은 null.

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as diff from 'diff'
import * as diffModel from './diffModel'
import { countLines, countLinesUpTo } from './diffModel'
import { diffLinesWithinCap, diffStatWithinCap, parsePatchWithinCap, withinDiffCap } from './inline'
import { DIFF_INLINE_MAX_CHARS, DIFF_INLINE_MAX_LINES, PATCH_INLINE_MAX_CHARS } from './limits'

// 동작은 원본 그대로 두고 호출만 센다(0325 VP-15).
vi.mock('diff', async (original) => {
  const actual = await original<typeof import('diff')>()
  const { vi } = await import('vitest')
  return { ...actual, diffLines: vi.fn(actual.diffLines), parsePatch: vi.fn(actual.parsePatch) }
})
afterEach(() => vi.restoreAllMocks())

const linesOf = (count: number, prefix = 'l'): string =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n')

describe('countLines', () => {
  it.each([
    ['', 0],
    ['a', 1],
    ['a\n', 1],
    ['a\nb', 2],
    ['a\n\nb\n', 3],
    ['\n', 1]
  ])('%j → %d', (text, count) => expect(countLines(text)).toBe(count))
})

describe('diffLinesWithinCap', () => {
  it('상한은 400 줄이다', () => expect(DIFF_INLINE_MAX_LINES).toBe(400))

  it('줄 수 합 400 은 결과를 낸다', () => {
    const lines = diffLinesWithinCap(linesOf(200, 'a'), linesOf(200, 'b'))
    expect(lines).toHaveLength(400)
    expect(lines?.filter((line) => line.type === 'removed')).toHaveLength(200)
    expect(lines?.filter((line) => line.type === 'added')).toHaveLength(200)
  })

  it('줄 수 합 401 은 null 이다', () => {
    expect(diffLinesWithinCap(linesOf(200, 'a'), linesOf(201, 'b'))).toBeNull()
    expect(diffLinesWithinCap(linesOf(401), '')).toBeNull()
    expect(diffLinesWithinCap('', linesOf(401))).toBeNull()
  })

  it('한쪽이 비어도 합으로 판정한다 — 새 파일 400 줄은 결과를 낸다', () => {
    expect(withinDiffCap('', linesOf(400))).toBe(true)
    expect(diffLinesWithinCap('', linesOf(400))?.every((line) => line.type === 'added')).toBe(true)
  })

  it('줄번호는 각 축의 것이다', () => {
    expect(diffLinesWithinCap('a\nb\nc\n', 'a\nc\n')).toEqual([
      { type: 'unchanged', oldLine: 1, newLine: 1, lineNo: 1, text: 'a' },
      { type: 'removed', oldLine: 2, newLine: null, lineNo: 2, text: 'b' },
      { type: 'unchanged', oldLine: 3, newLine: 2, lineNo: 2, text: 'c' }
    ])
  })
})

describe('diffStatWithinCap', () => {
  it('상한 이하는 추가·삭제 줄 수를 센다', () => {
    expect(diffStatWithinCap('a\nb', 'a\nB\nc')).toEqual({ added: 2, removed: 1 })
  })

  it('400 은 세고 401 은 null 이다', () => {
    expect(diffStatWithinCap(linesOf(200, 'a'), linesOf(200, 'b'))).toEqual({
      added: 200,
      removed: 200
    })
    expect(diffStatWithinCap(linesOf(200, 'a'), linesOf(201, 'b'))).toBeNull()
  })
})

describe('parsePatchWithinCap', () => {
  const patch = '--- a/a.ts\n+++ b/a.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n'

  it('상한 이하의 patch 는 파싱한다', () => {
    expect(parsePatchWithinCap(patch)?.[0]?.hunks[0]?.lines).toEqual(['-old', '+new'])
  })

  it('상한을 넘는 patch 는 파싱하지 않는다', () => {
    // 추가 줄의 본문을 늘려 길이만 맞춘다 — 형식은 그대로 유효하다.
    const sized = (length: number): string => {
      const head = '--- a/a.ts\n+++ b/a.ts\n@@ -1,1 +1,1 @@\n-old\n+'
      return `${head}${'x'.repeat(length - head.length - 1)}\n`
    }
    expect(sized(PATCH_INLINE_MAX_CHARS + 1)).toHaveLength(PATCH_INLINE_MAX_CHARS + 1)
    expect(parsePatchWithinCap(sized(PATCH_INLINE_MAX_CHARS + 1))).toBeNull()
    expect(parsePatchWithinCap(sized(PATCH_INLINE_MAX_CHARS))?.[0]?.hunks).toHaveLength(1)
  })
})

// 0325 VP-15 · EP-4 ①~④ — 문자 합 우선 · 줄 조기 중단.
describe('withinDiffCap 문자 우선 상한 (0325)', () => {
  const lines = (count: number, width: number, fill: string): string =>
    Array.from({ length: count }, () => fill.repeat(width)).join('\n')

  it('상한은 64,000 자다', () => {
    expect(DIFF_INLINE_MAX_CHARS).toBe(64_000)
  })

  it('c1 64,001자 한 줄 → false · 줄을 세지 않는다', () => {
    const counter = vi.spyOn(diffModel, 'countLinesUpTo')
    expect(withinDiffCap('a'.repeat(32_000), 'b'.repeat(32_001))).toBe(false)
    expect(counter).not.toHaveBeenCalled()
  })

  it('c2 64,000자 400줄 → true', () => {
    const before = lines(200, 159, 'a')
    let after = lines(200, 159, 'b')
    after += 'b'.repeat(64_000 - before.length - after.length)
    expect(before.length + after.length).toBe(64_000)
    expect(countLines(before) + countLines(after)).toBe(400)
    expect(withinDiffCap(before, after)).toBe(true)
  })

  it('c3 줄 세기는 401 에서 멈춘다 · 401줄 → false', () => {
    const text = lines(1_000, 1, 'x')
    expect(countLinesUpTo(text, 400)).toBe(401)
    expect(countLinesUpTo(lines(400, 1, 'x'), 400)).toBe(400)
    expect(countLinesUpTo(`${lines(400, 1, 'x')}\n`, 400)).toBe(400)
    expect(withinDiffCap(lines(401, 1, 'x'), '')).toBe(false)
    expect(withinDiffCap(lines(200, 1, 'x'), lines(201, 1, 'y'))).toBe(false)
  })

  it('c4 정확히 64,000자는 문자 검사를 통과한다', () => {
    expect(withinDiffCap('a'.repeat(32_000), 'b'.repeat(32_000))).toBe(true)
  })

  it('c5 빈 둘 → true', () => {
    expect(withinDiffCap('', '')).toBe(true)
  })

  it('한 줄 5,000,000자 두 입력 → `null` · jsdiff 0회', () => {
    vi.mocked(diff.diffLines).mockClear()
    expect(diffLinesWithinCap('a'.repeat(5_000_000), 'b'.repeat(5_000_000))).toBeNull()
    expect(diff.diffLines).not.toHaveBeenCalled()
  })
})

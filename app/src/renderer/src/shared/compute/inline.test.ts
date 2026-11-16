// 상한 판정 (0324 AC10 · MD-05) — 줄 수 합 400 이하는 같은 호출에서 결과, 401 이상은 null.

import { describe, expect, it } from 'vitest'
import { countLines } from './diffModel'
import { diffLinesWithinCap, diffStatWithinCap, parsePatchWithinCap, withinDiffCap } from './inline'
import { DIFF_INLINE_MAX_LINES, PATCH_INLINE_MAX_CHARS } from './limits'

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

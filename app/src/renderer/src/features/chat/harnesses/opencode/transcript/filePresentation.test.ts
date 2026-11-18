// opencode 파일 변경의 줄 원천과 머리 증감 수 (0324 AC10).

import { describe, expect, it, vi } from 'vitest'
import * as diff from 'diff'
import type { OpenCodeFileView } from '../toolPresentation'
import { fileChanges, fileDiffSource } from './filePresentation'

const linesOf = (count: number, prefix: string): string =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n')
const file = (fields: Partial<OpenCodeFileView>): OpenCodeFileView =>
  ({ path: 'a.ts', ...fields }) as OpenCodeFileView
const patch = '--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n'

// 동작은 원본 그대로 두고 jsdiff·patch 파싱 호출만 센다(0325 VP-16).
vi.mock('diff', async (original) => {
  const actual = await original<typeof import('diff')>()
  const { vi } = await import('vitest')
  return { ...actual, diffLines: vi.fn(actual.diffLines), parsePatch: vi.fn(actual.parsePatch) }
})
// 추가 줄만 가진 patch — 길이를 정확히 `chars` 로 맞춘다.
const addedPatch = (chars: number, lines: number): string => {
  const head = `--- a/f.ts\n+++ b/f.ts\n@@ -0,0 +1,${lines} @@\n`
  const width = Math.floor((chars - head.length) / lines) - 2
  const body = Array.from({ length: lines }, () => `+${'x'.repeat(width)}\n`)
  const text = head + body.join('')
  return text.slice(0, -1) + 'x'.repeat(chars - text.length) + '\n'
}

describe('fileDiffSource', () => {
  it('전·후 본문이 있으면 쌍 원천이다 — 한쪽만 있어도 빈 문자열로 채운다', () => {
    expect(fileDiffSource(file({ before: 'a', after: 'b', patch }))).toEqual({
      kind: 'pair',
      before: 'a',
      after: 'b'
    })
    expect(fileDiffSource(file({ after: 'b' }))).toEqual({ kind: 'pair', before: '', after: 'b' })
    expect(fileDiffSource(file({ before: 'a' }))).toEqual({ kind: 'pair', before: 'a', after: '' })
  })

  it('본문이 없으면 patch 의 줄 좌표를 쓴다', () => {
    const source = fileDiffSource(file({ patch }))
    expect(source.kind === 'lines' && source.lines.map((line) => line.type)).toEqual([
      'unchanged',
      'removed',
      'added'
    ])
  })
})

describe('fileChanges', () => {
  it('쌍과 patch 의 증감 수를 합산한다', () => {
    expect(fileChanges([file({ before: 'a\nb', after: 'a\nB\nc' }), file({ patch })])).toEqual({
      added: 3,
      removed: 2
    })
  })

  // 0325 D-009 — 파일 전부의 줄 합으로 판정한다(0324 의 파일별 판정을 대체).
  it('파일 전부의 줄 수 합 400 은 세고, 401 이면 증감 수가 없다', () => {
    const small = file({ before: 'a', after: 'b' })
    expect(
      fileChanges([small, file({ before: linesOf(199, 'a'), after: linesOf(199, 'b') })])
    ).toEqual({ added: 200, removed: 200 })
    expect(
      fileChanges([small, file({ before: linesOf(199, 'a'), after: linesOf(200, 'b') })])
    ).toBeNull()
  })

  it('파일이 없으면 0 이다', () => {
    expect(fileChanges([])).toEqual({ added: 0, removed: 0 })
  })
})

// 0325 VP-16 · EP-4 ⑦ — 원문 원천의 합산 예산. patch 문자 합 1,000,000 을 넘으면 파싱 0회.
describe('fileChanges 합산 예산 (0325)', () => {
  const resetSpies = (): void => {
    vi.mocked(diff.diffLines).mockClear()
    vi.mocked(diff.parsePatch).mockClear()
  }

  it('a5 patch 문자 합 1,000,001 → null', () => {
    expect(
      fileChanges([
        file({ patch: addedPatch(500_000, 10) }),
        file({ patch: addedPatch(500_000, 10) })
      ])
    ).toEqual({
      added: 20,
      removed: 0
    })
    expect(
      fileChanges([
        file({ patch: addedPatch(500_000, 10) }),
        file({ patch: addedPatch(500_001, 10) })
      ])
    ).toBeNull()
  })

  it('a6 쌍 + patch 섞임 합 안 → 합계', () => {
    expect(fileChanges([file({ before: 'a', after: 'b' }), file({ patch })])).toEqual({
      added: 2,
      removed: 2
    })
  })

  it('a7 작은 patch 3개(404,045자씩, 합 1,212,135) → null · `parsePatch` 0회', () => {
    const one = addedPatch(404_045, 4_000)
    expect(one).toHaveLength(404_045)
    resetSpies()
    expect(
      fileChanges([file({ patch: one }), file({ patch: one }), file({ patch: one })])
    ).toBeNull()
    expect(diff.parsePatch).not.toHaveBeenCalled()
  })

  it('a8 쌍 1개(안) + patch 2개(합 1,000,001) → null · jsdiff·`parsePatch` 0회', () => {
    resetSpies()
    expect(
      fileChanges([
        file({ before: 'a', after: 'b' }),
        file({ patch: addedPatch(500_000, 10) }),
        file({ patch: addedPatch(500_001, 10) })
      ])
    ).toBeNull()
    expect(diff.diffLines).not.toHaveBeenCalled()
    expect(diff.parsePatch).not.toHaveBeenCalled()
  })
})

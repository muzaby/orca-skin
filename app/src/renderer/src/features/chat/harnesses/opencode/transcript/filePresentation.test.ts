// opencode 파일 변경의 줄 원천과 머리 증감 수 (0324 AC10).

import { describe, expect, it } from 'vitest'
import type { OpenCodeFileView } from '../toolPresentation'
import { fileChanges, fileDiffSource } from './filePresentation'

const linesOf = (count: number, prefix: string): string =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n')
const file = (fields: Partial<OpenCodeFileView>): OpenCodeFileView =>
  ({ path: 'a.ts', ...fields }) as OpenCodeFileView
const patch = '--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n'

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

  it('줄 수 합 400 은 세고, 401 인 파일이 하나라도 있으면 증감 수가 없다', () => {
    const small = file({ before: 'a', after: 'b' })
    expect(
      fileChanges([small, file({ before: linesOf(200, 'a'), after: linesOf(200, 'b') })])
    ).toEqual({ added: 201, removed: 201 })
    expect(
      fileChanges([small, file({ before: linesOf(200, 'a'), after: linesOf(201, 'b') })])
    ).toBeNull()
  })

  it('파일이 없으면 0 이다', () => {
    expect(fileChanges([])).toEqual({ added: 0, removed: 0 })
  })
})

import { describe, expect, it } from 'vitest'
import type { DiffLine } from './diffLines'
import { highlightDiffLines } from './diffSyntax'

const lines: DiffLine[] = [
  { type: 'removed', oldLine: 1, newLine: null, lineNo: 1, text: '/* removed opening' },
  { type: 'removed', oldLine: 2, newLine: null, lineNo: 2, text: 'const removed = 1' },
  { type: 'added', oldLine: null, newLine: 1, lineNo: 1, text: 'const added = 2' },
  { type: 'unchanged', oldLine: 3, newLine: 2, lineNo: 2, text: 'const stable = 3' }
]

describe('diff syntax', () => {
  it('공통 줄도 좌우의 주석 문맥을 별도로 보존한다', async () => {
    const highlighted = await highlightDiffLines(lines, 'src/example.ts', 'github-light')
    const context = highlighted.get(lines[3])
    expect(new Set(context?.old?.map((token) => token.color)).size).toBe(1)
    expect(new Set(context?.new?.map((token) => token.color)).size).toBeGreaterThan(1)
  })

  it.each(['github-light', 'github-dark'] as const)(
    '%s: 이전·이후 문맥을 분리하고 원문과 각 줄의 축을 보존한다',
    async (theme) => {
      const highlighted = await highlightDiffLines(lines, 'src/example.ts', theme)
      for (const line of lines) {
        expect(
          highlighted
            .get(line)
            ?.[line.type === 'removed' ? 'old' : 'new']?.map((token) => token.content)
            .join('')
        ).toBe(line.text)
      }
      const colors = (index: number): Set<string | undefined> =>
        new Set(
          highlighted
            .get(lines[index])
            ?.[lines[index].type === 'removed' ? 'old' : 'new']?.map((token) => token.color)
        )
      expect(colors(1).size).toBe(1) // old 축에서는 아직 주석이다.
      expect(colors(2).size).toBeGreaterThan(1) // new 축에 삭제된 /* 가 섞이면 실패한다.
      expect(colors(3).size).toBeGreaterThan(1) // 공통 줄은 new 축 문맥으로 그린다.
    }
  )

  it('지원하지 않는 확장자는 plain text를 유지한다', async () => {
    expect((await highlightDiffLines(lines, 'binary.unknown', 'github-light')).size).toBe(0)
  })
})

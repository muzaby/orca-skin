import { describe, expect, it } from 'vitest'
import type { DiffLine } from './diffLines'
import { compute } from '../../../shared/compute/worker/handler'
import type { ShikiThemeId } from '../../../shared/ui/markdown/themeStore'
import { diffTokensRequest, mapDiffTokens, type DiffSyntaxTokens } from './diffSyntax'

// 요청 조립 → 워커의 실제 처리 함수 → 줄 매핑 (0324 AC9). 워커 프로세스만 빼고 같은 경로다.
async function highlightDiffLines(
  lines: readonly DiffLine[],
  filePath: string,
  theme: ShikiThemeId
): Promise<DiffSyntaxTokens> {
  const request = diffTokensRequest(lines, filePath, theme)
  if (!request) return new Map()
  const rows = await compute(request)
  if (!('old' in rows)) throw new Error('unexpected result')
  return mapDiffTokens(lines, rows)
}

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

  it('지원하지 않는 확장자와 빈 diff 는 요청을 만들지 않는다', () => {
    expect(diffTokensRequest(lines, 'binary.unknown', 'github-light')).toBeNull()
    expect(diffTokensRequest([], 'a.ts', 'github-light')).toBeNull()
  })

  it('요청은 old 축에서 추가 줄을, new 축에서 삭제 줄을 뺀다', () => {
    expect(diffTokensRequest(lines, 'src/example.ts', 'github-dark')).toEqual({
      kind: 'diffTokens',
      oldText: '/* removed opening\nconst removed = 1\nconst stable = 3',
      newText: 'const added = 2\nconst stable = 3',
      lang: 'typescript',
      theme: 'github-dark'
    })
  })

  it('한쪽 축에 줄이 없으면 그 축은 null 이다', () => {
    const added = [lines[2]]
    expect(diffTokensRequest(added, 'a.ts', 'github-light')).toMatchObject({
      oldText: null,
      newText: 'const added = 2'
    })
  })

  it('가짜 토큰은 축별로 해당 줄에 붙고, 원문과 다른 행은 버린다', () => {
    const token = (
      content: string,
      color: string
    ): { content: string; color: string; offset: number } => ({ content, color, offset: 0 })
    const mapped = mapDiffTokens(lines, {
      old: [
        [token('/* removed opening', 'o0')],
        [token('const removed = 1', 'o1')],
        [token('const stable = 3', 'o2')]
      ],
      new: [[token('const added = 2', 'n0')], [token('다른 원문', 'n1')]]
    })
    expect(mapped.get(lines[0])).toEqual({ old: [token('/* removed opening', 'o0')] })
    expect(mapped.get(lines[1])).toEqual({ old: [token('const removed = 1', 'o1')] })
    expect(mapped.get(lines[2])).toEqual({ new: [token('const added = 2', 'n0')] })
    // 공통 줄 — old 축 토큰만 원문과 같다. new 축 행은 원문이 달라 붙지 않는다.
    expect(mapped.get(lines[3])).toEqual({ old: [token('const stable = 3', 'o2')] })
  })

  it('토큰이 없는 축(null)은 건너뛴다', () => {
    const mapped = mapDiffTokens(lines, { old: null, new: null })
    expect(mapped.size).toBe(0)
  })
})

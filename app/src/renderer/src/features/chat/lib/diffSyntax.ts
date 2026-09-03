import type { ThemedToken } from 'shiki'
import type { ShikiThemeId } from '../../../shared/ui/markdown/themeStore'
import { getHighlighter, isLang } from '../../../shared/ui/markdown/syntax'
import type { DiffLine } from './diffLines'
import { extToLang } from './lang'

export type DiffSyntaxTokens = ReadonlyMap<
  DiffLine,
  { old?: readonly ThemedToken[]; new?: readonly ThemedToken[] }
>

export async function highlightDiffLines(
  lines: readonly DiffLine[],
  filePath: string,
  theme: ShikiThemeId
): Promise<DiffSyntaxTokens> {
  const result = new Map<DiffLine, { old?: readonly ThemedToken[]; new?: readonly ThemedToken[] }>()
  const lang = extToLang(filePath)
  if (!lang || !isLang(lang) || lines.length === 0) return result
  const highlighter = await getHighlighter()
  // 삭제된 주석·문자열이 새 파일의 문법 상태를 오염시키지 않도록 두 축을 따로 읽는다.
  for (const excluded of ['added', 'removed'] as const) {
    const axis = lines.filter((line) => line.type !== excluded)
    if (axis.length === 0) continue
    const { tokens } = highlighter.codeToTokens(axis.map((line) => line.text).join('\n'), {
      lang,
      theme
    })
    axis.forEach((line, index) => {
      const row = tokens[index]
      // 공통 줄도 좌우의 문법 상태가 다를 수 있다. 원문 보존이 안 되면 plain fallback.
      if (row?.map((token) => token.content).join('') === line.text) {
        result.set(line, { ...result.get(line), [excluded === 'added' ? 'old' : 'new']: row })
      }
    })
  }
  return result
}

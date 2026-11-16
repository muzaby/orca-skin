import type { ThemedToken } from 'shiki'
import type { DiffTokensRequest, TokenRows } from '../../../shared/compute/protocol'
import type { ShikiThemeId } from '../../../shared/ui/markdown/themeStore'
import { isLang } from '../../../shared/ui/markdown/syntax'
import type { DiffLine } from './diffLines'
import { extToLang } from './lang'

export type DiffSyntaxTokens = ReadonlyMap<
  DiffLine,
  { old?: readonly ThemedToken[]; new?: readonly ThemedToken[] }
>

// 토큰 계산은 계산 워커가 한다(0324). 여기는 요청을 만들고 응답을 줄에 붙이는 순수 변환만 갖는다.
//
// 삭제된 주석·문자열이 새 파일의 문법 상태를 오염시키지 않도록 두 축을 따로 읽는다 —
// old 축은 추가 줄을 뺀 줄, new 축은 삭제 줄을 뺀 줄이다.
const AXES = [
  { side: 'old', excluded: 'added' },
  { side: 'new', excluded: 'removed' }
] as const

function axisLines(lines: readonly DiffLine[], excluded: DiffLine['type']): DiffLine[] {
  return lines.filter((line) => line.type !== excluded)
}

function axisText(lines: readonly DiffLine[], excluded: DiffLine['type']): string | null {
  const axis = axisLines(lines, excluded)
  return axis.length === 0 ? null : axis.map((line) => line.text).join('\n')
}

// 강조할 수 없는 입력(미지원 확장자·빈 diff)은 `null` — 요청하지 않는다.
export function diffTokensRequest(
  lines: readonly DiffLine[],
  filePath: string,
  theme: ShikiThemeId
): DiffTokensRequest | null {
  const lang = extToLang(filePath)
  if (!lang || !isLang(lang) || lines.length === 0) return null
  return {
    kind: 'diffTokens',
    oldText: axisText(lines, 'added'),
    newText: axisText(lines, 'removed'),
    lang,
    theme
  }
}

export function mapDiffTokens(
  lines: readonly DiffLine[],
  rows: { old: TokenRows | null; new: TokenRows | null }
): DiffSyntaxTokens {
  const result = new Map<DiffLine, { old?: readonly ThemedToken[]; new?: readonly ThemedToken[] }>()
  for (const { side, excluded } of AXES) {
    const tokens = rows[side]
    if (!tokens) continue
    axisLines(lines, excluded).forEach((line, index) => {
      const row = tokens[index]
      // 공통 줄도 좌우의 문법 상태가 다를 수 있다. 원문 보존이 안 되면 plain fallback.
      if (row?.map((token) => token.content).join('') === line.text) {
        result.set(line, { ...result.get(line), [side]: row })
      }
    })
  }
  return result
}

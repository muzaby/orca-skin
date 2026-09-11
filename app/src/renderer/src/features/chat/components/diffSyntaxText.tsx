import type { ThemedToken } from 'shiki'
import type { DiffLine } from '../lib/diffLines'

// diff 한 줄의 **토큰 → React 노드** 변환. 도구 카드(`DiffTable`)와 변경사항 패널
// (`FileDiffSection`)이 같은 줄을 그리므로 규칙이 두 벌이 되면 같은 diff 가 화면마다 다른
// 색·이스케이프를 낸다 — 여기 한 곳이 소유한다(0228 §10 EP-06).
//
// `start`/`end` 는 변경 강조가 문법 토큰 중간을 자를 때 쓰는 범위다. 잘라도 원문과 각 토큰
// 색은 그대로 보존한다. 토큰이 없으면(언어 미지원·하이라이터 미로드) 원문 문자열을 그대로 준다.
export function syntaxText(
  line: DiffLine,
  tokens: readonly ThemedToken[] | undefined,
  start = 0,
  end = line.text.length
): React.ReactNode {
  if (!tokens) return line.text.slice(start, end)
  let offset = 0
  return tokens.map((token, index) => {
    const tokenStart = offset
    offset += token.content.length
    const text = token.content.slice(Math.max(0, start - tokenStart), Math.max(0, end - tokenStart))
    return text.length > 0 ? (
      <span key={index} style={{ color: token.color }}>
        {text}
      </span>
    ) : null
  })
}

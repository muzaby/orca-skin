// Read 도구 결과가 cat -n 형태(예 "   12\t코드" 또는 "   12→코드")면 라인넘버 프리픽스를 제거한다.
// (CodeBlock 의 자체 라인넘버 거터와 이중 표기 방지.) 모든 비공백 줄이 패턴에 맞을 때만 제거.
const GUTTER_RE = /^\s*\d+(\t|→|\s\s)/
export function stripLineNumberGutter(text: string): string {
  const lines = text.split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return text
  if (!nonEmpty.every((l) => GUTTER_RE.test(l))) return text
  return lines.map((l) => l.replace(GUTTER_RE, '')).join('\n')
}

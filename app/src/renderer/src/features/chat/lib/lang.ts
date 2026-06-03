// 파일 확장자 → shiki 언어 매핑 + Read 결과의 cat -n 거터 제거(순수). CodeBlock LANGUAGES 범위만 반환.

const EXT_TO_LANG: Record<string, string> = {
  py: 'python',
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  html: 'html',
  htm: 'html',
  css: 'css',
  md: 'markdown',
  markdown: 'markdown',
  sh: 'bash',
  bash: 'bash'
}

export function extToLang(filePath: string): string | undefined {
  const base = filePath.split(/[/\\]/).pop() ?? filePath
  const dot = base.lastIndexOf('.')
  if (dot < 0) return undefined
  const ext = base.slice(dot + 1).toLowerCase()
  return EXT_TO_LANG[ext]
}

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

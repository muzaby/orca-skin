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

export { stripLineNumberGutter } from '../../../shared/compute/gutter'

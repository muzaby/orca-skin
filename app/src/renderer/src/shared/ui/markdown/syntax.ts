import { createHighlighter, type Highlighter } from 'shiki'

const LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'yaml',
  'html',
  'css',
  'markdown'
] as const

// Markdown과 diff가 같은 인스턴스를 공유한다. 첫 표시 때만 문법·테마를 로드한다.
let highlighterPromise: Promise<Highlighter> | null = null
export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [...LANGUAGES]
  })
  return highlighterPromise
}

export function isLang(s: string): s is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(s)
}

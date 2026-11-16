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

// 하이라이터 자체는 계산 워커가 갖는다(`shared/compute/worker/highlighter.ts`, 0324) — 여기는
// "이 언어를 강조할 수 있는가"만 답한다.
export function isLang(s: string): s is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(s)
}

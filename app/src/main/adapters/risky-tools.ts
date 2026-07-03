// 위험 도구 게이트 화이트리스트(provider-runtime.md §3) — 어댑터 포트. 상태를 변경하는 도구만
// 승인 카드로 surface 하고, 안전 도구(Read/Glob/Grep 등)는 자동 통과한다(Claude Code 웹/CLI 기본
// 패턴과 일치). 어댑터의 canUseTool 게이트(claude·mock)가 직접 소비하므로 도메인/feature 가 아니라
// adapters 경계에 둔다 — 새 위험 도구는 여기에만 추가한다.

export const RISKY_TOOLS: ReadonlySet<string> = new Set([
  'Bash',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit'
])

// 도구 이름이 위험 도구 화이트리스트에 드는지. 화이트리스트 외(또는 안전 도구)는 게이트 미적용.
export function isRiskyTool(name: string): boolean {
  return RISKY_TOOLS.has(name)
}

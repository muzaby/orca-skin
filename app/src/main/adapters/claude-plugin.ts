// Claude plugin 스킬 이름 어댑팅 — 어댑터가 소비하는 순수 조각(claude-adapt 의 skills 굽기). 배포
// 패키지 렌더(renderClaudeHarnessPlugin·renderClaudeUserSkillsPlugin)는 features/extensions 소관이지만,
// 플러그인 이름(= 네임스페이스 prefix)의 SSOT 는 어댑터 포트에 둔다 — 렌더와 skills 필터가 공유한다.

import type { SkillInfo } from '../../shared/ipc'

export const ORCA_PLUGIN_NAME = 'orca'
// 사용자 ~/.claude/skills 래퍼 플러그인(dist/claude/plugins/claude, handoff 0117). settingSources 에서
// user 소스를 배제하면서 어댑터/네이티브 스킬을 plugin 경로로 보전한다 — plugin 로드 스킬은
// `플러그인이름:스킬이름` 으로 발견되므로 필터도 같은 prefix 를 써야 한다.
export const CLAUDE_USER_PLUGIN_NAME = 'claude'

function namespaceSkill(plugin: string, name: string): string {
  return name.startsWith(`${plugin}:`) ? name : `${plugin}:${name}`
}

export function namespaceOrcaSkill(name: string): string {
  return namespaceSkill(ORCA_PLUGIN_NAME, name)
}

// orca → `orca:*`(dist/plugins/orca), adapter → `claude:*`(dist/plugins/claude 래퍼, 0117),
// workspace → bare(세션 cwd 의 .claude/skills — settingSources 'project' 소스가 그대로 발견).
export function adaptSkillNameForClaude(skill: SkillInfo): string {
  if (skill.sourceKind === 'orca') return namespaceOrcaSkill(skill.name)
  if (skill.sourceKind === 'adapter') return namespaceSkill(CLAUDE_USER_PLUGIN_NAME, skill.name)
  return skill.name
}

// Claude plugin 스킬 이름 어댑팅 — 어댑터가 소비하는 순수 조각(claude-adapt 의 skills 굽기). 배포
// 패키지 렌더(renderClaudePluginPackage)는 features/extensions 소관이지만, 이름 규칙은 어댑터 포트에 둔다.

import type { SkillInfo } from '../../shared/ipc'

export const ORCA_PLUGIN_NAME = 'orca'

export function namespaceOrcaSkill(name: string): string {
  return name.startsWith(`${ORCA_PLUGIN_NAME}:`) ? name : `${ORCA_PLUGIN_NAME}:${name}`
}

export function adaptSkillNameForClaude(skill: SkillInfo): string {
  return skill.sourceKind === 'orca' ? namespaceOrcaSkill(skill.name) : skill.name
}

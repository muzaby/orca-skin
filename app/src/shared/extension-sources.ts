import type { Backend, SkillInfo } from './ipc'

export const extensionSourceLabels: Readonly<Record<string, string>> = {
  orca: 'Orcinus orca 스킬',
  agents: '~/.agents/skills',
  'adapter:claude': 'Claude 스킬',
  'plugin:claude': 'Claude 플러그인',
  'adapter:opencode': 'OpenCode 스킬',
  'plugin:opencode': 'OpenCode 플러그인'
}

export function skillSourceAllowed(source: string, backend: Backend): boolean {
  return (
    source === 'orca' ||
    source === 'agents' ||
    source === `adapter:${backend}` ||
    source === `plugin:${backend}`
  )
}

export function sourceSkills(skills: readonly SkillInfo[], backend: Backend): SkillInfo[] {
  return skills
    .filter((skill) => skillSourceAllowed(skill.sourceId, backend))
    .map((skill) => ({ ...skill, sourceLabel: extensionSourceLabels[skill.sourceId] }))
}

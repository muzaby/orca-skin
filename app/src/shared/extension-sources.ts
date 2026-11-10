import { HARNESS_CAPABILITIES } from './harness'
import type { Backend, SkillInfo } from './ipc'
import { PRODUCT_DISPLAY_NAME } from './product'

export function harnessSourceTitle(backend: Backend): string {
  return HARNESS_CAPABILITIES[backend].shortLabel
}

export const extensionSourceLabels: Readonly<Record<string, string>> = {
  'orcinus-orca': PRODUCT_DISPLAY_NAME,
  agents: '~/.agents/skills',
  'adapter:claude': harnessSourceTitle('claude'),
  'plugin:claude': harnessSourceTitle('claude'),
  'adapter:opencode': harnessSourceTitle('opencode'),
  'plugin:opencode': harnessSourceTitle('opencode')
}

export function skillSourceAllowed(source: string, backend: Backend): boolean {
  return (
    source === 'orcinus-orca' ||
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

export function isNativePluginSkillSource(source: string): boolean {
  return source.startsWith('plugin:')
}

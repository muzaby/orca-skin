import type { Backend, SkillInfo } from '../../../../../shared/ipc'
import { extensionSourceLabels, sourceSkills } from '../../../../../shared/extension-sources'
import type { NativeResourcesView } from './nativeResourceState'

export type SkillSuggestion = Pick<
  SkillInfo,
  'name' | 'description' | 'argumentHint' | 'sourceId' | 'sourceLabel'
>

/** The installation catalog is global; callable plugin commands belong to the current session. */
export function composerSkills(
  catalog: readonly SkillInfo[],
  backend: Backend,
  includeExtensions: boolean,
  native: NativeResourcesView
): SkillSuggestion[] {
  const skills: SkillSuggestion[] = includeExtensions
    ? sourceSkills(catalog, backend).filter(
        (skill) => skill.enabled !== false && skill.sourceId !== `plugin:${backend}`
      )
    : []
  const byName = new Map(skills.map((skill) => [skill.name, skill]))
  if (native.status === 'ready') {
    for (const command of native.value.commands ?? []) {
      if (command.source === 'mcp' || command.skill === false) continue
      const sourceId = `${command.source === 'plugin' ? 'plugin' : 'adapter'}:${backend}`
      byName.set(command.name, {
        name: command.name,
        description: command.description,
        argumentHint: command.argumentHint,
        sourceId,
        sourceLabel: extensionSourceLabels[sourceId]
      })
    }
  }
  return [...byName.values()]
}

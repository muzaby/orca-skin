import { describe, expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { splitSkillCatalog } from './catalog'

function skill(name: string, isBuiltin: boolean, sourceKind: SkillInfo['sourceKind']): SkillInfo {
  return {
    name,
    description: '',
    sourceId: sourceKind === 'adapter' ? 'adapter:claude' : 'orca',
    sourceLabel: sourceKind === 'adapter' ? 'CLAUDE 스킬' : 'Orca 스킬',
    enabled: true,
    sourceKind,
    isBuiltin,
    canToggle: sourceKind === 'orca',
    canRemove: sourceKind === 'orca',
    skillPath: `/skills/${name}/SKILL.md`,
    skillDir: `/skills/${name}`
  }
}

describe('splitSkillCatalog', () => {
  it('Orca 내장 항목만 플러그인으로 옮기고 사용자/어댑터 스킬은 스킬에 유지한다', () => {
    const result = splitSkillCatalog([
      skill('builtin', true, 'orca'),
      skill('custom', false, 'orca'),
      skill('claude', false, 'adapter')
    ])

    expect(result.plugins.map((item) => item.name)).toEqual(['builtin'])
    expect(result.skills.map((item) => item.name)).toEqual(['custom', 'claude'])
  })
})

import { describe, it, expect } from 'vitest'
import { adaptSkillNameForClaude, namespaceOrcaSkill } from './claude-plugin'
import type { SkillInfo } from '../../shared/ipc'

function skill(name: string, sourceKind: SkillInfo['sourceKind']): SkillInfo {
  return {
    name,
    description: '',
    sourceId: sourceKind === 'orca' ? 'orca' : `${sourceKind}:claude`,
    sourceLabel: '',
    sourceKind,
    isBuiltin: sourceKind === 'orca',
    enabled: true,
    canToggle: sourceKind === 'orca',
    canRemove: sourceKind === 'orca',
    skillPath: `/x/${name}/SKILL.md`,
    skillDir: `/x/${name}`
  }
}

describe('adaptSkillNameForClaude', () => {
  it('orca 스킬은 orca: 네임스페이스', () => {
    expect(adaptSkillNameForClaude(skill('review', 'orca'))).toBe('orca:review')
  })

  it('adapter 스킬은 claude: 네임스페이스 (0117 — dist/plugins/claude 래퍼 플러그인 발견 이름)', () => {
    expect(adaptSkillNameForClaude(skill('native', 'adapter'))).toBe('claude:native')
  })

  it('workspace 스킬은 bare 유지 (settingSources project 소스로 발견)', () => {
    expect(adaptSkillNameForClaude(skill('local-skill', 'workspace'))).toBe('local-skill')
  })

  it('이미 네임스페이스된 이름은 중복 prefix 하지 않는다', () => {
    expect(namespaceOrcaSkill('orca:ready')).toBe('orca:ready')
    expect(adaptSkillNameForClaude(skill('claude:done', 'adapter'))).toBe('claude:done')
  })
})

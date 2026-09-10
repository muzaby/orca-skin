import { describe, expect, it } from 'vitest'
import type { McpServer, SkillInfo } from '../../../../../shared/ipc'
import { mcpGroups, skillGroups } from './catalogGroups'

const skill = (sourceId: string, sourceLabel: string, name: string): SkillInfo =>
  ({ sourceKind: 'orca', sourceId, sourceLabel, name }) as SkillInfo
const server = (id: string, enabled: boolean): McpServer => ({ id, enabled }) as McpServer

describe('catalog groups', () => {
  it('스킬은 source 별로, 라벨은 raw 로 묶인다', () => {
    const groups = skillGroups([
      skill('claude', 'Claude', 'a'),
      skill('orca', 'Orca', 'b'),
      skill('claude', 'Claude', 'c')
    ])
    expect(groups.map((g) => g.id)).toEqual(['claude', 'orca'])
    expect(groups[0].label).toEqual({ raw: 'Claude' })
    expect(groups[0].rows.map((r) => r.name)).toEqual(['a', 'c'])
  })

  it('MCP 라벨은 key 로 반환된다 (lib 이 tr 에 의존하지 않는다)', () => {
    expect(mcpGroups([server('m', true)])[0].label).toEqual({ key: 'skills.groups.activeMcp' })
    expect(mcpGroups([server('m', false)])[0].label).toEqual({
      key: 'skills.groups.inactiveMcp'
    })
  })

  it('행이 없는 그룹은 제외된다', () => {
    expect(mcpGroups([server('m', true)]).map((g) => g.id)).toEqual(['active'])
    expect(mcpGroups([server('m', false)]).map((g) => g.id)).toEqual(['inactive'])
    expect(mcpGroups([]).length).toBe(0)
  })

  it('MCP 는 enabled 로 갈린다', () => {
    expect(mcpGroups([server('a', true), server('b', false)]).map((g) => g.rows.length)).toEqual([
      1, 1
    ])
    expect(
      mcpGroups([server('a', true), server('b', false)]).map((g) => [g.id, g.rows[0].id])
    ).toEqual([
      ['active', 'a'],
      ['inactive', 'b']
    ])
  })
})

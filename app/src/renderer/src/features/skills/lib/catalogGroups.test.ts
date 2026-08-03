import { describe, expect, it } from 'vitest'
import type { McpServer, SkillInfo } from '../../../../../shared/ipc'
import type { PluginRow } from './pluginCatalog'
import {
  groupKey,
  isGroupOpen,
  mcpGroups,
  pluginGroups,
  skillGroups,
  toggleGroup
} from './catalogGroups'

const skill = (sourceId: string, sourceLabel: string, name: string): SkillInfo =>
  ({ sourceKind: 'orca', sourceId, sourceLabel, name }) as SkillInfo
const server = (id: string, enabled: boolean): McpServer => ({ id, enabled }) as McpServer
const plugin = (pluginId: string, connectedCount: number): PluginRow =>
  ({ pluginId, connectedCount }) as PluginRow

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

  it('MCP/플러그인 라벨은 key 로 반환된다 (lib 이 tr 에 의존하지 않는다)', () => {
    expect(mcpGroups([server('m', true)])[0].label).toEqual({ key: 'skills.groups.activeMcp' })
    expect(pluginGroups([plugin('p', 0)])[0].label).toEqual({
      key: 'skills.groups.disconnectedPlugins'
    })
  })

  it('행이 없는 그룹은 제외된다', () => {
    expect(mcpGroups([server('m', true)]).map((g) => g.id)).toEqual(['active'])
    expect(pluginGroups([plugin('p', 2)]).map((g) => g.id)).toEqual(['connected'])
    expect(mcpGroups([]).length).toBe(0)
  })

  it('MCP 는 enabled, 플러그인은 connectedCount 로 갈린다', () => {
    expect(mcpGroups([server('a', true), server('b', false)]).map((g) => g.rows.length)).toEqual([
      1, 1
    ])
    expect(
      pluginGroups([plugin('a', 1), plugin('b', 0)]).map((g) => [g.id, g.rows[0].pluginId])
    ).toEqual([
      ['connected', 'a'],
      ['disconnected', 'b']
    ])
  })

  it('그룹은 기본 펼침이다', () => expect(isGroupOpen({}, 'skills:orca')).toBe(true))

  it('토글은 열림→닫힘→열림 을 왕복한다', () => {
    const key = groupKey('skills', 'orca')
    const closed = toggleGroup({}, key)
    expect(isGroupOpen(closed, key)).toBe(false)
    expect(isGroupOpen(toggleGroup(closed, key), key)).toBe(true)
  })

  it('접힘 키는 탭으로 네임스페이스된다 — 동명 그룹이 간섭하지 않는다', () => {
    expect(groupKey('mcp', 'active')).toBe('mcp:active')
    const collapsed = toggleGroup({}, groupKey('mcp', 'active'))
    expect(isGroupOpen(collapsed, groupKey('mcp', 'active'))).toBe(false)
    expect(isGroupOpen(collapsed, groupKey('plugins', 'active'))).toBe(true)
  })

  it('토글은 기존 상태를 보존하며 새 객체를 만든다', () => {
    const first = toggleGroup({}, 'skills:a')
    const second = toggleGroup(first, 'skills:b')
    expect(second).toEqual({ 'skills:a': true, 'skills:b': true })
    expect(first).toEqual({ 'skills:a': true })
  })
})

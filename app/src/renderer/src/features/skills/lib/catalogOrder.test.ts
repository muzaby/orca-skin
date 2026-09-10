import { describe, expect, it } from 'vitest'
import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../shared/ipc'
import { orderMcpServers, orderProviders, orderSkills } from './catalogOrder'

const skill = (sourceId: string, sourceLabel: string, name: string): SkillInfo => ({
  sourceId,
  sourceLabel,
  name,
  description: '',
  sourceKind: 'orca',
  enabled: true,
  canToggle: true,
  canRemove: true,
  skillPath: `/skills/${sourceId}/${name}/SKILL.md`,
  skillDir: `/skills/${sourceId}/${name}`
})
const server = (id: string, enabled: boolean): McpServer => ({
  id,
  name: id,
  description: '',
  transport: 'stdio',
  enabled,
  command: 'node',
  args: [],
  authEnvKey: null,
  url: null,
  hasAuth: false
})
const provider = (id: string, kind: ProviderInfo['kind']): ProviderInfo => ({
  id,
  label: id,
  kind,
  origin: 'https://example.com',
  auth: [],
  status: 'none',
  activeAuthKind: null,
  principal: null,
  expiresAt: null,
  tools: []
})

describe('catalog final row order', () => {
  it('orders skill sources by label and keeps the original order within each source', () => {
    const items = [
      skill('orca', 'Orca', 'z'),
      skill('claude', 'Claude', 'b'),
      skill('orca', 'Orca', 'a'),
      skill('claude', 'Claude', 'a')
    ]
    expect(orderSkills(items).map((item) => `${item.sourceId}/${item.name}`)).toEqual([
      'claude/b',
      'claude/a',
      'orca/z',
      'orca/a'
    ])
  })

  it('keeps equal-label sources contiguous in first-seen order', () => {
    const items = [
      skill('second', 'Same', 'a'),
      skill('first', 'Same', 'a'),
      skill('second', 'Same', 'b'),
      skill('first', 'Same', 'b')
    ]
    expect(orderSkills(items).map((item) => `${item.sourceId}/${item.name}`)).toEqual([
      'second/a',
      'second/b',
      'first/a',
      'first/b'
    ])
  })

  it('uses the first label of a source when later rows carry a different label', () => {
    const items = [skill('b', 'Beta', '1'), skill('a', 'Alpha', '2'), skill('b', 'A', '3')]
    expect(orderSkills(items).map((item) => item.name)).toEqual(['2', '1', '3'])
  })

  it('puts enabled MCP servers first without sorting within either state', () => {
    const items = [
      server('off-z', false),
      server('on-z', true),
      server('off-a', false),
      server('on-a', true)
    ]
    expect(orderMcpServers(items).map((item) => item.id)).toEqual([
      'on-z',
      'on-a',
      'off-z',
      'off-a'
    ])
    expect(orderMcpServers([items[0], items[2]])).toEqual([items[0], items[2]])
    expect(orderMcpServers([items[1], items[3]])).toEqual([items[1], items[3]])
  })

  it('puts providers in gate, model, service order and keeps declared order within each kind', () => {
    const items = [
      provider('service-z', 'service'),
      provider('model-z', 'llm'),
      provider('gate-z', 'gate'),
      provider('service-a', 'service'),
      provider('gate-a', 'gate'),
      provider('model-a', 'llm')
    ]
    expect(orderProviders(items).map((item) => item.id)).toEqual([
      'gate-z',
      'gate-a',
      'model-z',
      'model-a',
      'service-z',
      'service-a'
    ])
  })

  it('returns empty lists without placeholder rows', () => {
    expect(orderSkills([])).toEqual([])
    expect(orderMcpServers([])).toEqual([])
    expect(orderProviders([])).toEqual([])
  })

  it('preserves input arrays and original row objects', () => {
    const skills = [skill('z', 'Z', '1'), skill('a', 'A', '2')]
    const servers = [server('off', false), server('on', true)]
    const providers = [provider('service', 'service'), provider('gate', 'gate')]
    for (const [items, ordered] of [
      [skills, orderSkills(skills)],
      [servers, orderMcpServers(servers)],
      [providers, orderProviders(providers)]
    ] as const) {
      expect(ordered).not.toBe(items)
      expect(ordered[0]).toBe(items[1])
      expect(ordered[1]).toBe(items[0])
    }
    expect(skills.map((item) => item.name)).toEqual(['1', '2'])
    expect(servers.map((item) => item.id)).toEqual(['off', 'on'])
    expect(providers.map((item) => item.id)).toEqual(['service', 'gate'])
  })
})

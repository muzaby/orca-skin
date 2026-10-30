// 0259 AC1~AC5 · VP-08 — '+' 메뉴 트리.
import { describe, expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { sourceSkills } from '../../../../../shared/extension-sources'
import {
  attachMenuToken,
  buildAttachMenu,
  nativeAttachItems,
  orcaGroupFirst,
  nativePluginMentions,
  skillTooltip
} from './attachMenuModel'

const labels = {
  addFiles: '파일 또는 사진 추가',
  skills: '스킬',
  plugins: '플러그인',
  managePlugins: '플러그인 관리',
  noSkills: '사용 가능한 스킬 없음',
  noPlugins: '사용 가능한 플러그인 없음'
}
const skill = (name: string, sourceId: string, sourceLabel: string, description = ''): SkillInfo =>
  ({ name, sourceId, sourceLabel, description }) as SkillInfo
const skills = [
  skill('a', 'orca', 'Orcinus orca', '설명 A'),
  skill('b', 'orca', 'Orcinus orca'),
  skill('c', 'adapter:claude', 'Claude', '설명 C')
]
const plugins = [
  { kind: 'plugin' as const, id: 'confluence', label: 'Confluence' },
  { kind: 'plugin' as const, id: 'jira', label: 'Jira' }
]

describe('orcaGroupFirst (0291 D-017)', () => {
  it('puts the Orcinus orca group first in the skills panel', () => {
    const items = [
      { kind: 'heading' as const, id: 'skills:adapter:claude', label: 'Claude' },
      { kind: 'empty' as const, id: 'c1', label: 'c1' },
      { kind: 'heading' as const, id: 'skills:plugin:x', label: 'X' },
      { kind: 'empty' as const, id: 'x1', label: 'x1' },
      { kind: 'heading' as const, id: 'skills:orca', label: 'Orcinus orca' },
      { kind: 'empty' as const, id: 'o1', label: 'o1' },
      { kind: 'empty' as const, id: 'o2', label: 'o2' }
    ]
    expect(orcaGroupFirst(items, 'skills:orca').map((item) => item.id)).toEqual([
      'skills:orca',
      'o1',
      'o2',
      'skills:adapter:claude',
      'c1',
      'skills:plugin:x',
      'x1'
    ])
    // 그룹이 없으면 기존 순서.
    const noOrca = items.slice(0, 4)
    expect(orcaGroupFirst(noOrca, 'skills:orca')).toEqual(noOrca)
  })
})

describe('buildAttachMenu', () => {
  it('merges groups that share a title into one heading without losing item identities', () => {
    const menu = buildAttachMenu({
      skills: [
        skill('same', 'adapter:claude', 'OLD'),
        skill('same', 'plugin:claude', 'OLD'),
        skill('local', 'orca', 'OLD')
      ],
      plugins,
      labels,
      canManagePlugins: false,
      sourceIcon: (source) => source
    })
    const panel = menu[2]
    if (panel.kind !== 'submenu') throw new Error('skills panel')
    // Orcinus orca 그룹은 항상 첫 그룹이다(0291 D-017).
    expect(panel.items.filter((item) => item.kind === 'heading')).toEqual([
      { kind: 'heading', id: 'skills:orca', label: 'Orcinus orca', leading: 'orca' },
      { kind: 'heading', id: 'skills:adapter:claude', label: 'Claude', leading: 'adapter:claude' }
    ])
    expect(panel.items.filter((item) => item.kind === 'action').map((item) => item.id)).toEqual([
      'skill:orca/local',
      'skill:adapter:claude/same',
      'skill:plugin:claude/same'
    ])
  })
  it.each(['claude', 'opencode'] as const)(
    'limits %s to approved skill sources and merges duplicate source headings',
    (backend) => {
      const label = backend === 'claude' ? 'Claude' : 'OpenCode'
      const catalog = [
        skill('home', `adapter:${backend}`, 'OLD'),
        skill('locked', 'agents', 'OLD'),
        skill('wrong', `adapter:${backend === 'claude' ? 'opencode' : 'claude'}`, 'OLD'),
        skill('alien', 'adapter:codex', 'OLD')
      ]
      const rows = nativeAttachItems(
        {
          status: 'ready',
          value: {
            state: 'connected',
            items: [],
            commands: [
              { name: 'home', source: 'harness', description: '', argumentHint: '' },
              { name: 'project', source: 'harness', description: '', argumentHint: '' },
              { name: 'design:review', source: 'plugin', description: '', argumentHint: '' },
              {
                name: 'custom-command',
                source: 'harness',
                skill: false,
                description: '',
                argumentHint: ''
              }
            ]
          }
        },
        { harness: label, useMcp: (name) => name, resourceStatus: (status) => status },
        'skills'
      )
      const menu = buildAttachMenu({
        skills: catalog,
        plugins: [],
        labels,
        canManagePlugins: false,
        native: { label, backend, skills: rows, items: [] }
      })[2]
      if (menu.kind !== 'submenu') throw new Error('menu')
      expect(menu.items.filter((row) => row.kind === 'heading').map((row) => row.label)).toEqual([
        label,
        '~/.agents/skills'
      ])
      expect(menu.items.filter((row) => row.kind === 'action').map((row) => row.label)).toEqual([
        'home',
        'project',
        'design::review',
        'locked'
      ])
    }
  )
  it('offers only observed connected MCP names with no descriptions, statuses or notices', () => {
    const items = nativeAttachItems(
      {
        status: 'ready',
        refreshing: true,
        value: {
          state: 'connected',
          generation: 'g',
          partial: true,
          items: (
            ['connected', 'configured', 'disabled', 'failed', 'needs-auth', 'pending'] as const
          ).map((status) => ({
            id: status,
            name: status,
            kind: 'mcp',
            status,
            enabled: status !== 'disabled',
            canToggle: false
          }))
        }
      },
      {
        notice: 'refreshing',
        partial: 'partial',
        useMcp: (name) => `Use ${name}`,
        resourceStatus: (s) => s
      },
      'mcp'
    )
    expect(items).toEqual([
      {
        kind: 'action',
        id: 'native-resource:mcp:connected',
        label: 'connected',
        action: { type: 'plugin', id: 'connected' }
      }
    ])
  })
  it('exposes native commands for OpenCode without exposing Orca integrations or inventing slash names', () => {
    const nativeLabels = {
      loading: 'loading',
      error: 'error',
      partial: 'partial',
      noCommands: 'no commands',
      useMcp: (name: string) => `Use ${name} tools`,
      resourceStatus: (status: string) => status
    }
    const items = nativeAttachItems(
      {
        status: 'ready',
        value: {
          state: 'connected',
          items: [
            {
              kind: 'mcp',
              id: 'docs',
              name: 'Docs',
              status: 'connected',
              enabled: true,
              canToggle: false
            },
            {
              kind: 'plugin',
              id: 'hooks',
              name: 'Hooks only',
              status: 'enabled',
              enabled: true,
              canToggle: false
            }
          ],
          commands: [
            {
              name: 'docs:search',
              description: 'Search documents',
              argumentHint: 'query',
              source: 'mcp'
            }
          ]
        }
      },
      nativeLabels,
      'mcp'
    )
    const tree = buildAttachMenu({
      skills: [],
      plugins: [],
      labels,
      canManagePlugins: true,
      includeExtensions: false,
      native: {
        label: 'OpenCode',
        items,
        skills: [
          {
            kind: 'action',
            id: 'skill-native',
            label: 'superpowers::using-superpowers',
            title: 'How to use skills',
            action: { type: 'nativeCommand', name: 'superpowers:using-superpowers' }
          }
        ]
      }
    })
    expect(tree.map((item) => item.id)).toEqual(['attach', 'separator', 'skills', 'plugins'])
    expect(tree[2]).toMatchObject({ items: [{ label: 'superpowers::using-superpowers' }] })
    expect(JSON.stringify(tree[3])).not.toMatch(/superpowers|Hooks only/)
    expect(JSON.stringify(tree)).not.toContain('/docs:search')
    expect(JSON.stringify(tree)).not.toMatch(/@jira|plugins:manage|\/hooks/)
    expect(items).toMatchObject([{ action: { type: 'plugin', id: 'docs' } }])
  })
  it('excludes unsupported plugins and other harness skills for OpenCode', () => {
    const tree = buildAttachMenu({
      skills,
      plugins,
      labels,
      canManagePlugins: true,
      includeExtensions: false,
      native: { label: 'OpenCode', backend: 'opencode', skills: [], items: [] }
    })
    expect(tree[0]).toMatchObject({ icon: 'attachFile', action: { type: 'attach' } })
    for (const menu of tree.slice(2)) {
      if (menu.kind !== 'submenu') throw new Error('menu')
      expect(
        menu.items.filter((item) => item.kind === 'action').every((item) => item.disabled)
      ).toBe(true)
    }
    expect(JSON.stringify(tree)).not.toContain('confluence')
    expect(JSON.stringify(tree)).not.toContain('adapter:claude')
    expect(JSON.stringify(tree)).not.toContain('plugins:manage')
  })
  const tree = buildAttachMenu({ skills, plugins, labels, canManagePlugins: true })

  it('최상위 = 파일 추가 · 구분선 · 스킬 ▸ · 플러그인 ▸ (AC1)', () => {
    expect(tree.map((item) => [item.kind, 'label' in item ? item.label : null])).toEqual([
      ['action', '파일 또는 사진 추가'],
      ['separator', null],
      ['submenu', '스킬'],
      ['submenu', '플러그인']
    ])
  })

  it('lists source headings and every skill in one panel', () => {
    const menu = tree[2]
    if (menu.kind !== 'submenu') throw new Error('skills')
    expect(menu.items.map((item) => [item.kind, 'label' in item ? item.label : ''])).toEqual([
      ['heading', 'Orcinus orca'],
      ['action', 'a'],
      ['action', 'b'],
      ['heading', 'Claude'],
      ['action', 'c']
    ])
  })

  it('플러그인 ▸ 목록 · 구분선 · 플러그인 관리 (AC3)', () => {
    const pluginsMenu = tree[3]
    if (pluginsMenu.kind !== 'submenu') throw new Error('plugins')
    expect(
      pluginsMenu.items.filter((item) => item.kind === 'heading').map((item) => item.label)
    ).toEqual(['Orcinus orca'])
    expect(pluginsMenu.items.map((i) => (i.kind === 'action' ? i.action : i.kind))).toEqual([
      'heading',
      { type: 'plugin', id: 'confluence' },
      { type: 'plugin', id: 'jira' },
      'separator',
      { type: 'managePlugins' }
    ])
    const noManage = buildAttachMenu({ skills, plugins, labels, canManagePlugins: false })[3]
    expect(noManage.kind === 'submenu' && noManage.items).toHaveLength(3)
  })

  it.each(['claude', 'opencode'] as const)(
    'puts the Orcinus orca group before native plugins for %s',
    (backend) => {
      const label = backend === 'claude' ? 'Claude' : 'OpenCode'
      const menu = buildAttachMenu({
        skills: [],
        plugins,
        labels,
        canManagePlugins: false,
        native: {
          label,
          backend,
          skills: [],
          items: [
            {
              kind: 'action',
              id: 'native-mcp',
              label: 'Docs',
              action: { type: 'plugin', id: 'docs' }
            }
          ]
        }
      })[3]
      if (menu.kind !== 'submenu') throw new Error('plugins')
      expect(
        menu.items.filter((item) => item.kind === 'heading').map((item) => item.label)
      ).toEqual(['Orcinus orca', label])
      expect(menu.items.filter((item) => item.kind === 'action').map((item) => item.id)).toEqual([
        'plugin:confluence',
        'plugin:jira',
        'native-mcp'
      ])
    }
  )

  it('빈 상태 행 (AC4)', () => {
    const empty = buildAttachMenu({ skills: [], plugins: [], labels, canManagePlugins: true })
    const [, , s, p] = empty
    expect(s.kind === 'submenu' && s.items).toEqual([
      { kind: 'empty', id: 'skills:empty', label: '사용 가능한 스킬 없음' }
    ])
    expect(p.kind === 'submenu' && p.items.map((i) => i.kind)).toEqual([
      'empty',
      'separator',
      'action'
    ])
  })

  it('hover 설명: 스킬 = 설명⏎출처, 설명 없으면 출처 · 플러그인 = 라벨 (AC5)', () => {
    const sourced = sourceSkills(
      skills.map((entry) => ({ ...entry, sourceLabel: 'OLD' })),
      'claude'
    )
    expect(skillTooltip(sourced[0])).toBe('설명 A\nOrcinus orca')
    expect(skillTooltip(sourced[1])).toBe('Orcinus orca')
    const s = tree[2]
    const first = s.kind === 'submenu' ? s.items[1] : null
    expect(first?.kind === 'action' && first.title).toBe('설명 A\nOrcinus orca')
    const p = tree[3]
    expect(p.kind === 'submenu' && p.items[1].kind === 'action' && p.items[1].title).toBe(
      'Confluence'
    )
  })
})

describe('attachMenuToken (AC2·AC3)', () => {
  it.each(['plugin:docs', '@org/package', 'server with spaces', 'server"quoted'])(
    'keeps the exact native plugin id as one token: %s',
    (id) => {
      const expected = /[\s"]/.test(id) ? `@${JSON.stringify(id)}` : `@${id}`
      expect(attachMenuToken({ type: 'plugin', id })).toBe(expected)
    }
  )
  it('스킬 = /이름, 플러그인 = @id, 그 밖 = 토큰 없음', () => {
    expect(attachMenuToken({ type: 'skill', name: 'review' })).toBe('/review')
    expect(attachMenuToken({ type: 'plugin', id: 'jira' })).toBe('@jira')
    expect(attachMenuToken({ type: 'attach' })).toBeNull()
    expect(attachMenuToken({ type: 'managePlugins' })).toBeNull()
  })
})

it('shares native menu membership with decoration without exposing disabled or other-origin entries', () => {
  const view = {
    status: 'ready' as const,
    value: {
      state: 'connected' as const,
      items: [
        {
          kind: 'mcp' as const,
          id: 'native-id',
          name: 'Native label',
          status: 'connected' as const,
          enabled: true,
          canToggle: false
        },
        {
          kind: 'mcp' as const,
          id: 'off',
          name: 'Off',
          status: 'connected' as const,
          enabled: false,
          canToggle: true
        },
        {
          kind: 'mcp' as const,
          id: 'configured',
          name: 'Configured',
          status: 'configured' as const,
          enabled: true,
          canToggle: false
        },
        {
          kind: 'mcp' as const,
          id: 'orca-id',
          name: 'Orca label',
          status: 'connected' as const,
          origin: 'orca' as const,
          enabled: true,
          canToggle: false
        },
        {
          kind: 'plugin' as const,
          id: 'skill-bundle',
          name: 'Skill bundle',
          status: 'enabled' as const,
          enabled: true,
          canToggle: true
        }
      ]
    }
  }
  expect(nativePluginMentions(view)).toEqual([
    { kind: 'plugin', id: 'native-id', label: 'Native label' }
  ])
  expect(nativePluginMentions(view, 'orca')).toEqual([
    { kind: 'plugin', id: 'orca-id', label: 'Orca label' }
  ])
  expect(nativePluginMentions({ status: 'loading' })).toEqual([])
  expect(
    nativePluginMentions({ ...view, value: { ...view.value, state: 'disconnected' } })
  ).toEqual([])
})

it('keeps previously disabled harness skills selectable', () => {
  const entry = {
    ...skill('previously-off', 'adapter:claude', 'Claude'),
    enabled: true,
    canToggle: false
  }
  const menu = buildAttachMenu({ skills: [entry], plugins: [], labels, canManagePlugins: false })[2]
  if (menu.kind !== 'submenu') throw new Error('menu')
  expect(menu.items.find((row) => row.kind === 'action')).toMatchObject({
    kind: 'action',
    disabled: false,
    action: { type: 'nativeCommand', name: 'previously-off' }
  })
})

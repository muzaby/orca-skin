import { expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { composerSkills } from './composerSkills'
import type { NativeResourcesView } from './nativeResourceState'

const skill = (name: string, sourceId: string, enabled = true): SkillInfo => ({
  name,
  sourceId,
  enabled,
  sourceLabel: sourceId,
  description: 'catalog',
  body: '',
  sourceKind: 'adapter',
  canToggle: false,
  canRemove: false,
  skillPath: '/skill',
  skillDir: '/'
})
const catalog = [
  skill('local', 'orca'),
  skill('disabled', 'orca', false),
  skill('superpowers:using-superpowers', 'plugin:claude', false),
  skill('other:command', 'plugin:opencode'),
  skill('user-file', 'adapter:claude')
]
const native: NativeResourcesView = {
  status: 'ready',
  value: {
    state: 'connected',
    items: [],
    commands: [
      {
        name: 'superpowers:using-superpowers',
        description: 'session command',
        argumentHint: '[args]',
        source: 'plugin'
      }
    ]
  }
}

it('uses session commands over global plugin flags and preserves allowed file skills', () => {
  const result = composerSkills(catalog, 'claude', true, native)
  expect(result.map((s) => s.name)).toEqual(['local', 'user-file', 'superpowers:using-superpowers'])
  expect(result.at(-1)).toEqual({
    name: 'superpowers:using-superpowers',
    description: 'session command',
    argumentHint: '[args]',
    sourceId: 'plugin:claude',
    sourceLabel: 'Claude 플러그인'
  })
})
it('removes disabled session commands and never resurrects catalog-only plugin entries', () => {
  for (const view of [
    { status: 'loading' },
    { status: 'error' },
    { status: 'ready', value: { state: 'connected', items: [], commands: [] } }
  ] as NativeResourcesView[]) {
    expect(composerSkills(catalog, 'claude', true, view).map((s) => s.name)).toEqual([
      'local',
      'user-file'
    ])
  }
})
it('keeps OpenCode native commands while excluding Orca and Claude file extensions', () => {
  expect(composerSkills(catalog, 'opencode', false, native).map((s) => s.sourceId)).toEqual([
    'plugin:opencode'
  ])
  expect(composerSkills(catalog, 'opencode', false, { status: 'loading' })).toEqual([])
})
it('excludes MCP prompts and commands outside the supported skill catalog', () => {
  expect(
    composerSkills([], 'opencode', false, {
      status: 'ready',
      value: {
        state: 'connected',
        items: [],
        commands: [
          { name: 'mcp-prompt', source: 'mcp', description: '', argumentHint: '' },
          {
            name: 'custom-command',
            source: 'harness',
            skill: false,
            description: '',
            argumentHint: ''
          }
        ]
      }
    })
  ).toEqual([])
})

it('offers active default-path skills regardless of their former stored choice', () => {
  expect(
    composerSkills([skill('previously-off', 'adapter:claude')], 'claude', true, {
      status: 'loading'
    }).map((entry) => entry.name)
  ).toEqual(['previously-off'])
})

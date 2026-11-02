import { expect, it } from 'vitest'
import { HARNESS_CAPABILITIES, supportsAgentKind, orderAgentEnvironments } from './harness'

it('keeps display names and behavior capabilities distinct for each harness', () => {
  expect(HARNESS_CAPABILITIES.claude).toEqual({
    label: 'Claude Code',
    shortLabel: 'Claude',
    agentKinds: ['code', 'work'],
    nativeAgents: false,
    continuity: true,
    subagentTile: 'subagent',
    permissionModes: true
  })
  expect(HARNESS_CAPABILITIES.opencode).toEqual({
    label: 'OpenCode',
    shortLabel: 'OpenCode',
    agentKinds: ['code'],
    nativeAgents: true,
    continuity: false,
    subagentTile: 'task',
    permissionModes: false
  })
  expect(supportsAgentKind('claude', 'work')).toBe(true)
  expect(supportsAgentKind('opencode', 'work')).toBe(false)
  expect(supportsAgentKind('opencode', 'code')).toBe(true)
})

it('0293 orderAgentEnvironments ranks claude, opencode, then unknown adapters and keeps order within a harness', () => {
  const agents = [
    { key: 'oc-1', adapter: 'opencode' },
    { key: 'legacy', adapter: 'legacy' },
    { key: 'cl-1', adapter: 'claude' },
    { key: 'oc-2', adapter: 'opencode' },
    { key: 'cl-2', adapter: 'claude' }
  ]
  const before = [...agents]
  expect(orderAgentEnvironments(agents).map((a) => a.key)).toEqual([
    'cl-1',
    'cl-2',
    'oc-1',
    'oc-2',
    'legacy'
  ])
  expect(agents).toEqual(before)
})

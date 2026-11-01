import { expect, it } from 'vitest'
import { HARNESS_CAPABILITIES, supportsAgentKind } from './harness'

it('keeps display names and behavior capabilities distinct for each harness', () => {
  expect(HARNESS_CAPABILITIES.claude).toEqual({
    label: 'Claude Code', shortLabel: 'Claude', agentKinds: ['code', 'work'], nativeAgents: false,
    continuity: true, subagentTile: 'subagent', permissionModes: true
  })
  expect(HARNESS_CAPABILITIES.opencode).toEqual({
    label: 'OpenCode', shortLabel: 'OpenCode', agentKinds: ['code'], nativeAgents: true,
    continuity: false, subagentTile: 'task', permissionModes: false
  })
  expect(supportsAgentKind('claude', 'work')).toBe(true)
  expect(supportsAgentKind('opencode', 'work')).toBe(false)
  expect(supportsAgentKind('opencode', 'code')).toBe(true)
})

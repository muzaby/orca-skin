import { describe, expect, it } from 'vitest'
import type { AgentKind } from './agent-kind'
import {
  NORMALIZED_MODES,
  permissionModeForAgent,
  planApprovedMode,
  coercePermissionMode
} from './permission-mode'

describe('explicit product permission policies', () => {
  it('rejects an unknown product kind instead of granting Code policy', () => {
    expect(() => permissionModeForAgent('bypass', 'other' as AgentKind)).toThrow()
    expect(() => planApprovedMode('other' as AgentKind)).toThrow()
  })

  it('preserves each Code mode and restricts Work to its three modes', () => {
    expect(NORMALIZED_MODES.map((mode) => permissionModeForAgent(mode, 'code'))).toEqual([
      'default',
      'accept_edits',
      'plan',
      'dont_ask',
      'bypass',
      'auto_classified'
    ])
    expect(NORMALIZED_MODES.map((mode) => permissionModeForAgent(mode, 'work'))).toEqual([
      'default',
      'default',
      'default',
      'default',
      'bypass',
      'auto_classified'
    ])
    expect(planApprovedMode('code')).toBe('accept_edits')
    expect(planApprovedMode('work')).toBe('default')
    expect(coercePermissionMode('auto_classified', null, 'code')).toBe('accept_edits')
    expect(coercePermissionMode('auto_classified', null, 'work')).toBe('default')
  })
})

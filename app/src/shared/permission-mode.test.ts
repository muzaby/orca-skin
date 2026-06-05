import { describe, it, expect } from 'vitest'
import {
  NORMALIZED_MODES,
  toClaudePermissionMode,
  fromUiPermissionMode,
  type NormalizedPermissionMode,
  type ClaudePermissionMode
} from './permission-mode'

describe('permission-mode 정규화', () => {
  it('NORMALIZED_MODES 는 6종이고 중복이 없다', () => {
    expect(NORMALIZED_MODES).toHaveLength(6)
    expect(new Set(NORMALIZED_MODES).size).toBe(6)
  })

  it('toClaudePermissionMode 는 6종 전수를 SDK camelCase 로 매핑한다', () => {
    const expected: Record<NormalizedPermissionMode, ClaudePermissionMode> = {
      default: 'default',
      accept_edits: 'acceptEdits',
      plan: 'plan',
      dont_ask: 'dontAsk',
      bypass: 'bypassPermissions',
      auto_classified: 'auto'
    }
    for (const mode of NORMALIZED_MODES) {
      expect(toClaudePermissionMode(mode)).toBe(expected[mode])
    }
  })

  it('매핑 결과는 SDK PermissionMode 6종 유니온에 속한다', () => {
    const sdkUnion: ClaudePermissionMode[] = [
      'default',
      'acceptEdits',
      'bypassPermissions',
      'plan',
      'dontAsk',
      'auto'
    ]
    for (const mode of NORMALIZED_MODES) {
      expect(sdkUnion).toContain(toClaudePermissionMode(mode))
    }
  })

  it('fromUiPermissionMode 는 UI 2종을 정규화 어휘로 올린다', () => {
    expect(fromUiPermissionMode('plan')).toBe('plan')
    expect(fromUiPermissionMode('acceptEdits')).toBe('accept_edits')
  })

  it('round-trip: UI → 정규화 → SDK 는 유효한 SDK 값을 낸다', () => {
    expect(toClaudePermissionMode(fromUiPermissionMode('plan'))).toBe('plan')
    expect(toClaudePermissionMode(fromUiPermissionMode('acceptEdits'))).toBe('acceptEdits')
  })
})

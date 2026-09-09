import { describe, expect, it } from 'vitest'
import { coercePermissionMode, type NormalizedPermissionMode } from './permission-mode'

const model = (name: string | null): { alias: string; model: string | null } => ({
  alias: 'sonnet',
  model: name
})

describe('0224 r4 — 구체적 Claude 버전과 종류별 권한', () => {
  it.each([
    'claude-sonnet-4-6',
    'claude-opus-4-6[1m]',
    'anthropic.claude-sonnet-4-6-v1:0',
    'claude-opus-5-20270101'
  ])('%s의 자동 승인을 유지한다', (name) => {
    expect(coercePermissionMode('auto_classified', model(name), 'work')).toBe('auto_classified')
  })

  it.each([
    'claude-sonnet-4-5',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-opus-4-1',
    'claude-3-7-sonnet-20250219',
    'sonnet',
    'corp-sonnet-9',
    'custom-claude-sonnet-4-6',
    null
  ])('%s는 자동 불가이고 Work=수동/Code=편집 수락이다', (name) => {
    expect(coercePermissionMode('auto_classified', model(name), 'work')).toBe('default')
    expect(coercePermissionMode('auto_classified', model(name), 'code')).toBe('accept_edits')
  })

  it.each(['accept_edits', 'plan', 'dont_ask'] as NormalizedPermissionMode[])(
    'Work의 이전 %s 선택은 수동으로 정착하고 Coding은 유지한다',
    (mode) => {
      expect(coercePermissionMode(mode, model('claude-sonnet-4-6'), 'work')).toBe('default')
      expect(coercePermissionMode(mode, model('claude-sonnet-4-6'), 'code')).toBe(mode)
    }
  )

  it.each(['default', 'bypass'] as NormalizedPermissionMode[])(
    '%s의 의미는 종류/모델과 무관하게 유지한다',
    (mode) => {
      expect(coercePermissionMode(mode, model(null), 'work')).toBe(mode)
      expect(coercePermissionMode(mode, model(null), 'code')).toBe(mode)
    }
  )
})

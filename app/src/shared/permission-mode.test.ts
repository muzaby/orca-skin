import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PERMISSION_MODE,
  NORMALIZED_MODES,
  PLAN_APPROVED_MODE,
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

// 기본 권한 모드의 SSOT (AC18 · D-012).
//
// **이 describe 혼자로는 계약이 성립하지 않는다.** 계약은 "두 소비처가 이 상수 하나를 읽는다"
// 인데 소비처는 renderer(`chatReducer.initialChatState`)와 main(`PermissionModeController`)에
// 나뉘어 있고, 레이어 경계상 한 테스트가 둘 다 import 할 수 없다.
//
// 그래서 세 자리가 모두 **리터럴** 을 단언한다 — 여기(상수) ·
// `chatReducer.permission.test.ts` · `permission-mode-controller.test.ts`.
// `DEFAULT_PERMISSION_MODE` 를 바꾸면 셋이 **함께** 빨개진다. 한쪽이 자기 리터럴로 되돌아가면
// 그 하나만 초록으로 남아 드리프트가 드러난다. (`toBe(DEFAULT_PERMISSION_MODE)` 로 적으면
// 항등식이라 무엇을 바꿔도 통과한다 — 그래서 쓰지 않는다.)
describe('DEFAULT_PERMISSION_MODE — 렌더러·main 공용 기본값', () => {
  it('현재 기본은 auto_classified 다 (D-012 — plan 에서 옮겼다)', () => {
    expect(DEFAULT_PERMISSION_MODE).toBe('auto_classified')
  })

  it('정규화 모드 전수에 속한다', () => {
    expect(NORMALIZED_MODES).toContain(DEFAULT_PERMISSION_MODE)
  })

  it('SDK 어휘로 매핑된다 — 소비처가 그대로 넘겨도 깨지지 않는다', () => {
    expect(toClaudePermissionMode(DEFAULT_PERMISSION_MODE)).toBe('auto')
  })

  it('계획 승인 모드와는 다른 값이다 — 둘을 한 상수로 합치지 않는다', () => {
    expect(DEFAULT_PERMISSION_MODE).not.toBe(PLAN_APPROVED_MODE)
  })
})

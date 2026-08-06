// 0179 — chat:send 진입 판정 회귀. 분해 전에는 이 규칙들이 `sendChatEvent` 호출과 한 스코프에
// 있어 IPC/WebContents 를 흉내내야만 확인할 수 있었다. 여기서는 규칙만 본다.

import { describe, expect, it } from 'vitest'
import {
  admitChatSend,
  checkBusyReservation,
  checkContinuitySource,
  leaseKeyFor
} from './admission'

const validPayload = {
  sessionId: null,
  projectId: null,
  text: '안녕',
  attachments: [],
  attachmentViews: []
}

describe('admitChatSend', () => {
  it('스키마에 맞지 않는 페이로드는 schema_validation_error 로 거부한다', () => {
    const result = admitChatSend({
      raw: { text: 123 },
      updateInstallPending: false,
      hasActiveAdapter: true
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.category).toBe('schema_validation_error')
    expect(result.error.retryable).toBe(false)
  })

  it('업데이트 설치가 시작됐으면 capability_unsupported 로 거부한다', () => {
    const result = admitChatSend({
      raw: validPayload,
      updateInstallPending: true,
      hasActiveAdapter: true
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.category).toBe('capability_unsupported')
    expect(result.error.retryable).toBe(false)
  })

  it('활성 백엔드가 없으면 재시도 가능한 provider_connection_error 로 거부한다', () => {
    const result = admitChatSend({
      raw: validPayload,
      updateInstallPending: false,
      hasActiveAdapter: false
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.category).toBe('provider_connection_error')
    expect(result.error.retryable).toBe(true)
  })

  // 게이트 순서가 계약이다 — 스키마가 먼저여야 이후 판정이 페이로드를 믿을 수 있다.
  it('스키마 실패는 업데이트 게이트보다 먼저 판정된다', () => {
    const result = admitChatSend({
      raw: { text: 123 },
      updateInstallPending: true,
      hasActiveAdapter: false
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error.category).toBe('schema_validation_error')
  })

  it('정상 페이로드는 파싱 결과를 그대로 돌려준다', () => {
    const result = admitChatSend({
      raw: validPayload,
      updateInstallPending: false,
      hasActiveAdapter: true
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.data.text).toBe('안녕')
    expect(result.data.sessionId).toBeNull()
  })
})

describe('leaseKeyFor', () => {
  it('sessionId 가 있으면 세션 lease 키를 쓴다', () => {
    const { provisionalKey, logicalKey } = leaseKeyFor({ sessionId: 's-1' })

    expect(provisionalKey).toBe('s-1')
    expect(logicalKey).toContain('s-1')
    expect(logicalKey).not.toBe(leaseKeyFor({ sessionId: null, clientKey: 's-1' }).logicalKey)
  })

  it('sessionId 가 없으면 clientKey → clientRequestId 순으로 client lease 키를 파생한다', () => {
    expect(leaseKeyFor({ sessionId: null, clientKey: 'c-1' }).provisionalKey).toBe('c-1')
    expect(leaseKeyFor({ sessionId: null, clientRequestId: 'r-1' }).provisionalKey).toBe('r-1')
    expect(
      leaseKeyFor({ sessionId: null, clientKey: 'c-1', clientRequestId: 'r-1' }).provisionalKey
    ).toBe('c-1')
  })

  it('아무 키도 없으면 uuid 를 생성한다 (호출마다 다르다)', () => {
    const a = leaseKeyFor({ sessionId: null })
    const b = leaseKeyFor({ sessionId: null })

    expect(a.provisionalKey).not.toBe(b.provisionalKey)
    expect(a.provisionalKey.length).toBeGreaterThan(0)
  })
})

describe('checkContinuitySource', () => {
  it('continuity 가 아니면 통과시킨다', () => {
    expect(
      checkContinuitySource({
        source: undefined,
        sourceExists: false,
        isHandoff: false,
        sourceHasLiveTurn: true
      })
    ).toBeNull()
  })

  it('원본 세션이 없으면 schema_validation_error 로 거부한다', () => {
    const error = checkContinuitySource({
      source: 'gone',
      sourceExists: false,
      isHandoff: false,
      sourceHasLiveTurn: false
    })

    expect(error?.category).toBe('schema_validation_error')
    expect(error?.retryable).toBe(false)
  })

  it('handoff 는 원본 턴이 진행 중이면 재시도 가능한 오류로 거부한다', () => {
    const error = checkContinuitySource({
      source: 's-1',
      sourceExists: true,
      isHandoff: true,
      sourceHasLiveTurn: true
    })

    expect(error?.category).toBe('provider_connection_error')
    expect(error?.retryable).toBe(true)
  })

  // fork 는 원본이 불변이라 진행 중이어도 허용한다 — plan 파생 UX 가 이 차이에 기댄다.
  it('fork 는 원본 턴이 진행 중이어도 허용한다', () => {
    expect(
      checkContinuitySource({
        source: 's-1',
        sourceExists: true,
        isHandoff: false,
        sourceHasLiveTurn: true
      })
    ).toBeNull()
  })
})

describe('checkBusyReservation', () => {
  it('정리 중(closing) lease 는 재시도 가능한 오류로 거부한다', () => {
    const error = checkBusyReservation({
      leaseKind: 'closing',
      leasedProviderKey: 'claude-anthropic',
      requestedProviderKey: 'claude-anthropic'
    })

    expect(error?.category).toBe('provider_connection_error')
    expect(error?.retryable).toBe(true)
    expect(error?.message).toContain('정리')
  })

  it('provider 경계를 넘는 예약은 거부한다', () => {
    const error = checkBusyReservation({
      leaseKind: 'active',
      leasedProviderKey: 'claude-anthropic',
      requestedProviderKey: 'claude-bedrock'
    })

    expect(error?.category).toBe('provider_connection_error')
    expect(error?.message).toContain('공급자')
  })

  // 미지정(null)은 보수적 허용 — 모르는 것을 거부로 접으면 정상 흐름이 막힌다.
  it('요청 providerKey 가 미지정이면 허용한다', () => {
    expect(
      checkBusyReservation({
        leaseKind: 'active',
        leasedProviderKey: 'claude-anthropic',
        requestedProviderKey: null
      })
    ).toBeNull()
  })

  it('같은 provider 의 예약은 허용한다', () => {
    expect(
      checkBusyReservation({
        leaseKind: 'preparing',
        leasedProviderKey: 'claude-anthropic',
        requestedProviderKey: 'claude-anthropic'
      })
    ).toBeNull()
  })
})

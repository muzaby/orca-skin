import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import {
  authChoices,
  canReauth,
  canRevoke,
  initialAuthKind,
  needsAuthChoice,
  providerRowMeta
} from './providerRows'

function provider(patch: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id: 'gw',
    label: '게이트웨이',
    kind: 'llm',
    origin: 'https://gw.example.corp',
    auth: [
      { kind: 'api-key', label: 'API 키', fields: [] },
      { kind: 'oauth', label: '사내 계정으로 로그인', fields: [] }
    ],
    status: 'none',
    activeAuthKind: null,
    principal: null,
    expiresAt: null,
    tools: [],
    ...patch
  }
}

describe('providerRows (AC5)', () => {
  it('방식 선택지를 선언 순서로 낸다', () => {
    expect(authChoices(provider()).map((spec) => spec.kind)).toEqual(['api-key', 'oauth'])
    // 역순 선언이면 역순으로 나온다 — 정렬하지 않는다.
    const reversed = provider({
      auth: [
        { kind: 'oauth', label: '사내 계정으로 로그인', fields: [] },
        { kind: 'api-key', label: 'API 키', fields: [] }
      ]
    })
    expect(authChoices(reversed).map((spec) => spec.kind)).toEqual(['oauth', 'api-key'])
  })

  it('선언이 하나면 선택 단계를 건너뛴다', () => {
    expect(needsAuthChoice(provider())).toBe(true)
    expect(needsAuthChoice(provider({ auth: [{ kind: 'pat', label: 'PAT', fields: [] }] }))).toBe(
      false
    )
    expect(needsAuthChoice(provider({ auth: [] }))).toBe(false)
  })

  it('초기 방식은 활성 방식 → 선언 첫 항목 순으로 고른다', () => {
    expect(initialAuthKind(provider())).toBe('api-key')
    expect(initialAuthKind(provider({ activeAuthKind: 'oauth', status: 'valid' }))).toBe('oauth')
    expect(initialAuthKind(provider({ auth: [] }))).toBeNull()
  })

  it('행 메타는 상태 키와 활성 방식 라벨을 준다', () => {
    expect(providerRowMeta(provider())).toEqual({
      statusKey: 'skills.provider.status.none',
      activeLabel: null,
      kindKey: 'skills.provider.kind.llm'
    })
    expect(providerRowMeta(provider({ status: 'expired', activeAuthKind: 'oauth' }))).toEqual({
      statusKey: 'skills.provider.status.expired',
      activeLabel: '사내 계정으로 로그인',
      kindKey: 'skills.provider.kind.llm'
    })
  })

  it('재인증·해제는 인증 이력이 있을 때만 낸다', () => {
    expect(canReauth(provider())).toBe(false)
    expect(canRevoke(provider())).toBe(false)
    // 만료도 이력이다 — 여기서 재인증으로 이어져야 사용자가 빠져나갈 길이 있다.
    expect(canReauth(provider({ status: 'expired' }))).toBe(true)
    expect(canRevoke(provider({ status: 'unknown' }))).toBe(true)
  })
})

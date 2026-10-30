import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { authChoices, initialAuthKind, needsAuthChoice } from '../../../shared/config/providerAuth'
import { canManageAuth, providerRowMeta, providerTone } from './providerRows'

function provider(patch: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id: 'gw',
    label: '게이트웨이',
    kind: 'llm',
    authScheme: 'login-required',
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
      kindKey: 'skills.provider.kind.llm',
      showsAuthMethod: true
    })
    expect(providerRowMeta(provider({ status: 'expired', activeAuthKind: 'oauth' }))).toEqual({
      statusKey: 'skills.provider.status.expired',
      activeLabel: '사내 계정으로 로그인',
      kindKey: 'skills.provider.kind.llm',
      showsAuthMethod: true
    })
  })

  it('재인증·해제 버튼은 인증 이력이 있을 때만 낸다', () => {
    // 이력이 없으면 버튼은 "연결" 하나 — 재인증·해제는 낼 것이 없다.
    expect(canManageAuth(provider())).toBe(false)
    // 만료도 이력이다 — 여기서 재인증으로 이어져야 사용자가 빠져나갈 길이 있다.
    expect(canManageAuth(provider({ status: 'expired' }))).toBe(true)
    // 복호화 불가(키체인 잠김)도 마찬가지다 — 해제해서 다시 연결할 길이 있어야 한다.
    expect(canManageAuth(provider({ status: 'unknown' }))).toBe(true)
    expect(canManageAuth(provider({ status: 'valid' }))).toBe(true)
  })

  it.each(['none', 'valid', 'expired', 'unknown'] as const)(
    '로그인 프리는 %s 상태에서도 기본 제공·연결됨으로 표시하고 인증을 관리하지 않는다 (0249 AC1)',
    (status) => {
      const info = provider({ authScheme: 'login-free', status, activeAuthKind: 'oauth' })
      expect(providerRowMeta(info)).toEqual({
        statusKey: 'skills.provider.status.loginFree',
        activeLabel: null,
        kindKey: 'skills.provider.kind.loginFree',
        showsAuthMethod: false
      })
      expect(canManageAuth(info)).toBe(false)
    }
  )
})

describe('host connection rows (0291)', () => {
  it('maps each host connection state to its label and tone', () => {
    const row = (state: 'idle' | 'checking' | 'connected' | 'failed'): ProviderInfo =>
      provider({
        authScheme: 'login-free',
        auth: [],
        status: state === 'connected' ? 'valid' : 'none',
        connection: { state, message: state === 'failed' ? '실패' : null }
      })
    const seen = (['idle', 'checking', 'connected', 'failed'] as const).map((state) => [
      providerRowMeta(row(state)).statusKey,
      providerTone(row(state)),
      providerRowMeta(row(state)).kindKey
    ])
    expect(seen).toEqual([
      ['skills.provider.status.none', 'slate', 'skills.provider.kind.loginFree'],
      ['skills.provider.status.checking', 'amber', 'skills.provider.kind.loginFree'],
      ['skills.provider.status.valid', 'green', 'skills.provider.kind.loginFree'],
      ['skills.provider.status.failed', 'red', 'skills.provider.kind.loginFree']
    ])
    // 연결 선언 없는 로그인 프리는 그대로 항상 연결 표시다(0248).
    const plain = provider({ authScheme: 'login-free', auth: [], status: 'valid' })
    expect(providerRowMeta(plain).statusKey).toBe('skills.provider.status.loginFree')
    expect(providerTone(plain)).toBe('green')
    expect(providerTone(provider({ status: 'expired' }))).toBe('amber')
  })
})

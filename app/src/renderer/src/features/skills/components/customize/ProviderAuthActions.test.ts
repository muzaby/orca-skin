import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../../shared/ipc'
import { providerAuthActionKind, providerAuthMenuItems } from './providerAuthActionModel'

const provider: ProviderInfo = {
  id: 'plugin',
  label: 'Plugin',
  kind: 'service',
  origin: 'builtin',
  auth: [],
  status: 'none',
  activeAuthKind: null,
  principal: null,
  expiresAt: null,
  tools: [],
  catalog: undefined
}

describe('providerAuthActionKind', () => {
  it.each(['none', 'valid', 'expired', 'unknown'] as const)(
    '%s 상태의 액션 분기를 고정한다',
    (status) => {
      expect(providerAuthActionKind({ ...provider, status })).toBe(
        status === 'none' ? 'authenticate' : 'dropdown'
      )
    }
  )

  it('재인증을 먼저, 연결 해제를 danger로 고정한다', () => {
    expect(providerAuthMenuItems).toEqual([
      { kind: 'reauth', danger: false },
      { kind: 'revoke', danger: true }
    ])
  })
})

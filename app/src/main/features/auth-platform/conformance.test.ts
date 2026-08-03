// Provider conformance — **모든 built-in provider 에 같은 suite 를 재적용한다** (AC3).
//
// 새 provider 를 추가하면 아래 PROVIDERS 표에 한 줄만 넣는다. 검사 항목이 provider 마다
// 복제되지 않는 것이 이 파일의 존재 이유다 (AUTH-PLAT-002).

import { describe, expect, it } from 'vitest'
import { buildAuthProviderConformanceCases } from './conformance'
import type { AuthProviderV1 } from '../../contracts/auth-plugin'
import { createStaticCredentialProvider } from './providers/static-credential'
import { createBasicCredentialProvider } from './providers/basic-credential'
import { createAdfsWiaProvider } from './providers/corp-adfs-wia'

const ORIGIN = 'https://svc.example.invalid'

// mechanism·capability 조합이 서로 다른 provider 들. built-in 도 예외 없다.
const PROVIDERS: Array<{ label: string; create: () => AuthProviderV1 }> = [
  {
    label: 'static-credential (api_key, probe 없음)',
    create: () =>
      createStaticCredentialProvider({
        id: 'test-api-key',
        pluginId: 'test-pkg',
        label: 'API Key',
        mechanism: 'api_key'
      })
  },
  {
    label: 'static-credential (PAT, probe 있음)',
    create: () =>
      createStaticCredentialProvider({
        id: 'test-pat',
        pluginId: 'test-pkg',
        label: 'PAT',
        mechanism: 'personal_access_token',
        probeUrl: `${ORIGIN}/me`,
        allowedOrigins: [ORIGIN]
      })
  },
  {
    label: 'basic-credential (ID/비밀번호 2필드, 0160)',
    create: () =>
      createBasicCredentialProvider({
        id: 'test-basic',
        pluginId: 'test-pkg',
        label: 'ID/비밀번호'
      })
  },
  {
    label: 'corp-adfs-wia (browser session)',
    create: () =>
      createAdfsWiaProvider({
        id: 'test-adfs',
        pluginId: 'test-pkg',
        label: 'ADFS',
        sessionGroup: 'corp-adfs',
        loginUrl: `${ORIGIN}/login`,
        doneUrlPrefix: `${ORIGIN}/home`,
        authenticationProbeUrl: `${ORIGIN}/me`,
        allowedOrigins: [ORIGIN]
      })
  },
  {
    // 계약만 만족하는 최소 fixture — suite 가 특정 구현에 기대지 않음을 보인다.
    label: 'minimal fixture',
    create: (): AuthProviderV1 => ({
      descriptor: {
        id: 'test-minimal',
        pluginId: 'test-pkg',
        apiVersion: 1,
        label: 'Minimal',
        targets: ['connector'],
        mechanisms: ['external_secret'],
        capabilities: [],
        allowedOrigins: []
      },
      begin: async () => ({ kind: 'not_supported' }),
      continue: async () => ({ kind: 'not_supported' }),
      status: async () => ({ kind: 'not_supported' }),
      refresh: async () => ({ kind: 'not_supported' }),
      logout: async () => ({ kind: 'not_supported' })
    })
  }
]

describe('AuthProviderV1 conformance', () => {
  for (const provider of PROVIDERS) {
    describe(provider.label, () => {
      for (const testCase of buildAuthProviderConformanceCases({ create: provider.create })) {
        it(testCase.name, async () => {
          await expect(testCase.run()).resolves.toBeUndefined()
        })
      }
    })
  }
})

describe('conformance 하네스 자체', () => {
  it('5메서드 중 하나라도 없으면 실패로 잡는다', async () => {
    const broken = {
      descriptor: {
        id: 'broken',
        pluginId: 'test-pkg',
        apiVersion: 1 as const,
        label: 'Broken',
        targets: ['connector' as const],
        mechanisms: ['api_key' as const],
        capabilities: [],
        allowedOrigins: []
      },
      begin: async () => ({ kind: 'not_supported' as const }),
      continue: async () => ({ kind: 'not_supported' as const }),
      status: async () => ({ kind: 'not_supported' as const }),
      logout: async () => ({ kind: 'not_supported' as const })
      // refresh 누락 — 미지원이면 메서드를 빼는 게 아니라 not_supported 를 반환해야 한다.
    } as unknown as AuthProviderV1

    const cases = buildAuthProviderConformanceCases({ create: () => broken })
    const lifecycle = cases.find((c) => c.name.includes('5개 lifecycle'))
    await expect(lifecycle?.run()).rejects.toThrow(/refresh 미구현/)
  })

  it('capability 미선언인데 refresh 가 동작하면 실패로 잡는다', async () => {
    const lying = {
      descriptor: {
        id: 'lying',
        pluginId: 'test-pkg',
        apiVersion: 1 as const,
        label: 'Lying',
        targets: ['connector' as const],
        mechanisms: ['api_key' as const],
        // refresh 를 선언하지 않았는데…
        capabilities: [],
        allowedOrigins: []
      },
      begin: async () => ({ kind: 'not_supported' as const }),
      continue: async () => ({ kind: 'not_supported' as const }),
      status: async () => ({ kind: 'not_supported' as const }),
      // …실제로는 갱신된다고 답한다 → UI 가 어긋난다.
      refresh: async () => ({ kind: 'refreshed' as const }),
      logout: async () => ({ kind: 'not_supported' as const })
    } as unknown as AuthProviderV1

    const cases = buildAuthProviderConformanceCases({ create: () => lying })
    const refreshCase = cases.find((c) => c.name.includes('refresh capability'))
    await expect(refreshCase?.run()).rejects.toThrow(/미선언인데/)
  })
})

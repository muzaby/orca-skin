// Plugin 도구 가시성 (0188 AC20·AC21 — 구 `ServiceToolRegistrar` 테스트의 이식).
//
// 검증 대상은 두 가지다:
//   · 인증 상태를 따라 등록/회수되는가
//   · **반복 sync 가 runtime tool revision 을 올리지 않는가** — `RuntimeToolRegistry` 는
//     handler identity 까지 비교하므로, 서버를 sync 마다 새로 만들면 형상이 같아도 revision 이
//     올라 다음 턴이 런타임을 재spawn 한다.

import { describe, expect, it, vi } from 'vitest'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'
import type {
  AuthenticatedRequest,
  AuthSnapshot,
  AuthStatus,
  BoundAuth
} from '../../contracts/auth'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import { authToolServerId } from '../../adapters/runtime-tool-policy'
import { createPluginBinding } from './plugins'

function server(authId: string): RuntimeToolServer {
  const handler = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }))
  return {
    descriptor: {
      id: authToolServerId(authId),
      connectorId: authId,
      tools: [{ name: 'confluence_search', annotations: { readOnlyHint: true } }]
    },
    implementations: [{ name: 'confluence_search', inputSchema: {}, handler }]
  } as unknown as RuntimeToolServer
}

// 실제 Plugin 이 하는 것과 같은 배선 — handler 가 닫힌 `request` 만 부른다.
function toolServerBoundTo(bound: BoundAuth): RuntimeToolServer {
  const request = (req: AuthenticatedRequest): Promise<unknown> => bound.request(req)
  return {
    descriptor: {
      id: authToolServerId(bound.authId),
      connectorId: bound.authId,
      tools: [{ name: 'confluence_search', annotations: { readOnlyHint: true } }]
    },
    implementations: [
      {
        name: 'confluence_search',
        inputSchema: {},
        handler: async () => {
          await request({ path: '/rest/api/user/current' })
          return { content: [{ type: 'text' as const, text: 'ok' }] }
        }
      }
    ]
  } as unknown as RuntimeToolServer
}

function auth(authId: string, status: () => AuthStatus): BoundAuth {
  return {
    authId,
    snapshot: (): AuthSnapshot => ({
      authId,
      status: status(),
      verified: status() === 'valid',
      credentialRevision: 0
    }),
    request: () => Promise.reject(new Error('not used'))
  }
}

describe('createPluginBinding — 도구 가시성 (AC20)', () => {
  // 'unknown' = vault 복호화 실패(키체인 잠김·다른 머신). 구 테스트가 명시적으로 잠그던 값이라
  // 함께 유지한다 — 'valid 만 등록' 이 곧 '나머지 셋은 전부 회수' 여야 한다.
  it.each<AuthStatus>(['none', 'expired', 'unknown'])('%s 는 등록하지 않는다', (status) => {
    const registry = new RuntimeToolRegistry()
    createPluginBinding({
      auth: auth('confluence', () => status),
      server: server('confluence'),
      registry
    }).sync()

    expect(registry.snapshot().servers.size).toBe(0)
  })

  it('valid 면 등록하고 그 외에는 회수한다', () => {
    let status: AuthStatus = 'none'
    const registry = new RuntimeToolRegistry()
    const binding = createPluginBinding({
      auth: auth('confluence', () => status),
      server: server('confluence'),
      registry
    })

    binding.sync()
    expect(registry.snapshot().servers.size).toBe(0)

    status = 'valid'
    binding.sync()
    expect(registry.snapshot().servers.size).toBe(1)

    // 해제·만료·401 강등 — 전부 같은 sync 를 지난다.
    status = 'expired'
    binding.sync()
    expect(registry.snapshot().servers.size).toBe(0)
  })

  it('반복 sync 가 revision 을 올리지 않는다 — 같은 인스턴스를 재사용한다', () => {
    const registry = new RuntimeToolRegistry()
    const binding = createPluginBinding({
      auth: auth('confluence', () => 'valid'),
      server: server('confluence'),
      registry
    })

    binding.sync()
    const revision = registry.snapshot().revision
    binding.sync()
    binding.sync()

    expect(registry.snapshot().revision).toBe(revision)
  })
})

// 0181 의 `ServiceToolRegistrar` 테스트가 잠그고 있던 회귀. 구 구조는 같은 id 문자열을 네 곳에
// 적게 해서, 하나만 어긋나도 **도구는 모델에 보이는데 호출할 때마다 `unknown_provider` 로
// 죽었다** — 컴파일러도 등록 검사도 못 잡는 종류다. 0188 은 적을 자리를 없앴지만(컴포지션이
// `BoundAuth` 를 그대로 닫는다) 그 보장이 실제로 성립하는지는 여전히 확인해야 한다.
describe('Plugin 도구 호출이 자기 Auth 로 나간다 (unknown_provider 회귀)', () => {
  it('tool handler 의 요청이 binding 의 BoundAuth 로 전달된다', async () => {
    const seen: string[] = []
    const confluenceAuth: BoundAuth = {
      authId: 'confluence',
      snapshot: () => ({
        authId: 'confluence',
        status: 'valid',
        verified: true,
        credentialRevision: 1
      }),
      request: async (req) => {
        seen.push(`confluence:${req.path}`)
        return { ok: true, status: 200, finalUrl: '', headers: {}, body: '' }
      }
    }
    // Plugin 은 `BoundAuth.request` 를 그대로 닫는다 — AuthId 를 다시 적을 자리가 없다.
    const server = toolServerBoundTo(confluenceAuth)
    const binding = createPluginBinding({
      auth: confluenceAuth,
      server,
      registry: new RuntimeToolRegistry()
    })

    await binding.server.implementations[0]?.handler({})

    expect(seen).toEqual(['confluence:/rest/api/user/current'])
  })
})

describe('createPluginBinding — 카탈로그 도구 이름 (AC21)', () => {
  it('Auth 가 invalid 여도 완전 도구 이름을 계속 돌려준다', () => {
    let status: AuthStatus = 'valid'
    const registry = new RuntimeToolRegistry()
    const binding = createPluginBinding({
      auth: auth('confluence', () => status),
      server: server('confluence'),
      registry
    })
    binding.sync()
    const names = binding.toolNames()
    expect(names).toEqual(['mcp__confluence-tools__confluence_search'])

    status = 'none'
    binding.sync()

    // 화면은 이름을 유지하고 `status` 로 비활성을 안내한다 — active registry 로 목록을 만들면
    // 미인증 상태에서 도구가 통째로 사라져 현재 UX 가 깨진다.
    expect(binding.toolNames()).toEqual(names)
    expect(registry.snapshot().servers.size).toBe(0)
  })
})

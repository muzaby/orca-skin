// Plugin 도구 가시성 (0188 AC20·AC21 — 구 `ServiceToolRegistrar` 테스트의 이식).
//
// 검증 대상은 두 가지다:
//   · 인증 상태를 따라 등록/회수되는가
//   · **반복 sync 가 runtime tool revision 을 올리지 않는가** — `RuntimeToolRegistry` 는
//     handler identity 까지 비교하므로, 서버를 sync 마다 새로 만들면 형상이 같아도 revision 이
//     올라 다음 턴이 런타임을 재spawn 한다.

import { describe, expect, it, vi } from 'vitest'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'
import type { AuthSnapshot, AuthStatus, BoundAuth } from '../../contracts/auth'
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

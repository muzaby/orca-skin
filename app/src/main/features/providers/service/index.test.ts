// 서비스 도구 등록 (0181) — grant 상태를 따라 registry 에 넣고 뺀다.
//
// **이 파일이 고정하는 핵심 회귀**: `tools` 팩토리가 받는 컨텍스트의 `providerId` 와, 그것이
// 실제로 부르는 `api.request` 의 첫 인자가 **선언의 `id` 와 같아야 한다**. 구 시그니처
// `(api: ProviderApi) => …` 는 선언이 자기 id 를 손으로 다시 적게 만들었고, 그 문자열이
// 어긋나면 도구는 모델에 보이는데 호출할 때마다 `unknown_provider` 로 죽었다 —
// 컴파일러도 등록 검사도 잡지 못하는 결함이었다.

import { describe, expect, it, vi } from 'vitest'
import type { RuntimeToolServer } from '../../../adapters/runtime-tools'
import type { Provider, ProviderApi, ProviderToolContext } from '../../../contracts/provider'
import type { ProviderGrantStatus } from '../../../../shared/ipc'
import { ServiceToolRegistrar } from './index'

function toolServer(ctx: ProviderToolContext): RuntimeToolServer {
  return {
    descriptor: {
      id: `${ctx.providerId}-tools`,
      connectorId: ctx.providerId,
      tools: [{ name: 'search', description: `${ctx.label} 검색` }]
    },
    implementations: [
      {
        name: 'search',
        inputSchema: {},
        handler: async () => {
          await ctx.request({ path: '/rest/api/search' })
          return { content: [{ type: 'text', text: 'ok' }] }
        }
      }
    ]
  }
}

function wiki(over: Partial<Provider> = {}): Provider {
  return {
    id: 'wiki-dc',
    label: 'Wiki',
    kind: 'service',
    origin: 'https://wiki.example.corp',
    auth: [],
    tools: toolServer,
    ...over
  }
}

function harness(status: ProviderGrantStatus = 'valid'): {
  registrar: ServiceToolRegistrar
  added: string[]
  removed: string[]
  requested: string[]
} {
  const added: string[] = []
  const removed: string[] = []
  const requested: string[] = []
  const api = {
    request: vi.fn(async (providerId: string) => {
      requested.push(providerId)
      return { ok: true, status: 200, finalUrl: '', headers: {}, body: '' }
    })
  } as unknown as ProviderApi
  const registrar = new ServiceToolRegistrar({
    registry: {
      add: (server) => void added.push(server.descriptor.id),
      remove: (serverId) => void removed.push(serverId)
    },
    api,
    status: () => status
  })
  return { registrar, added, removed, requested }
}

describe('ServiceToolRegistrar — 도구 컨텍스트', () => {
  it('컨텍스트를 선언으로부터 만든다 — id 를 다시 적을 자리가 없다', () => {
    let seen: ProviderToolContext | null = null
    const h = harness()
    h.registrar.sync([
      wiki({
        tools: (ctx) => {
          seen = ctx
          return toolServer(ctx)
        }
      })
    ])
    expect(seen).toMatchObject({
      providerId: 'wiki-dc',
      label: 'Wiki',
      origin: 'https://wiki.example.corp'
    })
  })

  it('도구 호출이 선언의 id 로 나간다 (unknown_provider 회귀)', async () => {
    const h = harness()
    h.registrar.sync([wiki()])
    const server = h.registrar.descriptorFor('wiki-dc')
    expect(server).toEqual({ serverId: 'wiki-dc-tools', tools: ['search'] })

    // 실제 handler 를 태워야 의미가 있다 — 어긋남은 조립이 아니라 호출에서 드러났다.
    let built: RuntimeToolServer | null = null
    const h2 = harness()
    h2.registrar.sync([
      wiki({
        tools: (ctx) => {
          built = toolServer(ctx)
          return built
        }
      })
    ])
    await built!.implementations[0].handler({})
    expect(h2.requested).toEqual(['wiki-dc'])
  })
})

describe('ServiceToolRegistrar — 등록/회수', () => {
  it('grant 가 valid 일 때만 등록한다', () => {
    const ok = harness('valid')
    ok.registrar.sync([wiki()])
    expect(ok.added).toEqual(['wiki-dc-tools'])

    const expired = harness('expired')
    expired.registrar.sync([wiki()])
    expect(expired.added).toEqual([])
    expect(expired.removed).toEqual(['wiki-dc-tools'])
  })

  it('같은 provider 를 다시 sync 해도 서버를 새로 만들지 않는다', () => {
    // `RuntimeToolRegistry` 의 동등성은 handler identity 까지 본다 — 매번 새로 만들면 형상이
    // 같아도 revision 이 올라 다음 턴이 런타임을 재spawn 한다.
    let builds = 0
    const h = harness()
    const provider = wiki({
      tools: (ctx) => {
        builds += 1
        return toolServer(ctx)
      }
    })
    h.registrar.sync([provider])
    h.registrar.sync([provider])
    expect(builds).toBe(1)
  })

  it('도구를 선언하지 않은 provider 는 조회에서 null 이다', () => {
    const h = harness()
    h.registrar.sync([wiki({ tools: undefined })])
    expect(h.registrar.descriptorFor('wiki-dc')).toBeNull()
    expect(h.added).toEqual([])
  })
})

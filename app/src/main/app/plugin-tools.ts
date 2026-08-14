// 사내 서비스 provider (0181) — 인증된 연결이 LLM 에 노출하는 런타임 도구의 등록/회수.
//
// 구 구조는 `PluginHost` · `ConnectionRegistry` · `TransactionStore` 3중 상태였다. 여기서는
// **grant 상태 하나**가 등록 여부를 정한다:
//
//   grant 가 valid  → `Provider.tools(api)` 를 registry 에 등록 → 다음 spawn 부터 모델이 본다
//   그 외(none·expired·unknown) → registry 에서 회수 → 도구가 스냅샷에서 사라진다
//
// ── 왜 클래스이고 왜 캐시하는가 ──────────────────────────────────────────────
// `RuntimeToolRegistry` 의 동등성 검사는 **handler identity** 까지 본다(실행 값이라 복사하지
// 않는다). `tools(api)` 를 부를 때마다 새 클로저가 나오므로, 매번 다시 만들어 넣으면 형상이
// 같아도 revision 이 올라 다음 턴이 런타임을 재spawn 한다. provider 당 한 번만 만들어 재사용해야
// `sync` 가 진짜로 멱등해진다.

import { authToolServerId } from '../adapters/runtime-tool-policy'
import type { RuntimeToolServer, RuntimeToolSink } from '../adapters/runtime-tools'
import type { Provider, ProviderApi, ProviderToolContext } from '../contracts/auth'
import type { ProviderGrantStatus } from '../../shared/ipc'

export interface ServiceToolsDeps {
  registry: RuntimeToolSink
  api: ProviderApi
  status: (providerId: string) => ProviderGrantStatus
  logger?: (event: string, data: Record<string, unknown>) => void
}

export class ServiceToolRegistrar {
  // providerId → 조립된 도구 서버. 선언은 순수 팩토리라 한 번 만들어 두고 재사용한다.
  private readonly built = new Map<string, RuntimeToolServer>()

  constructor(private readonly deps: ServiceToolsDeps) {}

  // 로그인·재인증·해제·401 강등이 전부 이 함수를 부른다. 이미 맞는 상태면 registry 는
  // revision 을 올리지 않는다.
  sync(providers: readonly Provider[]): void {
    for (const provider of providers) {
      if (!provider.tools) continue
      const server = this.serverFor(provider)
      if (this.deps.status(provider.id) !== 'valid') {
        this.deps.registry.remove(server.descriptor.id)
        continue
      }
      this.deps.registry.add(server)
      this.deps.logger?.('providers.service.tools.registered', {
        providerId: provider.id,
        serverId: server.descriptor.id,
        tools: server.descriptor.tools.length
      })
    }
  }

  // GUI 노출용 조회 — 모델이 실제로 보는 서버 id 와 도구 이름. **여기서 새로 만들지 않는다**
  // (조립은 `sync` 가 이미 했다). 선언이 도구를 안 주면 null.
  descriptorFor(providerId: string): { serverId: string; tools: string[] } | null {
    const server = this.built.get(providerId)
    if (!server) return null
    return {
      serverId: server.descriptor.id,
      tools: server.descriptor.tools.map((tool) => tool.name)
    }
  }

  private serverFor(provider: Provider): RuntimeToolServer {
    const cached = this.built.get(provider.id)
    if (cached) return cached
    // **컨텍스트는 provider 로부터 만든다.** 선언에 `api.request('<id>', …)` 를 손으로 적게
    // 두면 그 문자열이 `Provider.id` 와 어긋날 수 있고, 그러면 도구는 모델에 보이는데 부를
    // 때마다 `unknown_provider` 로 죽는다. 적을 자리를 없애 구조적으로 막는다.
    const ctx: ProviderToolContext = {
      providerId: provider.id,
      label: provider.label,
      origin: provider.origin,
      serverId: authToolServerId(provider.id),
      request: (req, signal) => this.deps.api.request(provider.id, req, signal)
    }
    // `tools` 는 위 호출부에서 존재를 확인한 뒤에만 여기 온다.
    const server = provider.tools!(ctx)
    this.built.set(provider.id, server)
    return server
  }
}

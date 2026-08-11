// Provider 플랫폼 파사드 (0181) — 레지스트리·grant 스토어·로그인·게이트를 하나로 묶어
// **IPC 핸들러가 보는 표면**을 만든다. 핸들러가 네 조각을 각각 알 필요가 없다.
//
// 여기서 만들어지는 DTO 에는 **secret 이 없다** — 상태·만료·표시용 principal 만 나간다.

import type {
  ProviderAuthKind,
  ProviderAuthSpecInfo,
  ProviderInfo,
  ProviderPlatformState,
  ProviderStepInfo
} from '../../../shared/ipc'
import type { AuthSpec, Provider, ProviderApi } from '../../contracts/provider'
import { evaluateGate } from './gate'
import type { LoginService } from './auth/login'
import type { ProviderRegistry } from './auth/registry'
import type { ProviderStore } from './auth/store'

// 입력 수집형만 `fields` 를 갖는다. oauth·browser-session 은 브라우저가 값을 받으므로 빈 배열.
function authSpecInfo(spec: AuthSpec): ProviderAuthSpecInfo {
  const fields =
    spec.kind === 'oauth' || spec.kind === 'browser-session'
      ? []
      : spec.fields.map((f) => ({ ...f }))
  return { kind: spec.kind, label: spec.label, fields }
}

export interface ProviderPlatformDeps {
  registry: ProviderRegistry
  store: ProviderStore
  login: LoginService
  // 소비 슬라이스(LLM env 주입·MCP 토큰 소스·service 도구)가 쓰는 단일 포트.
  api: ProviderApi
  // dev 게이트 우회 — 읽는 시점의 값이어야 하므로 getter 다(설정은 런타임에 바뀐다).
  bypass: () => boolean
  // 모델이 보는 도구 이름 조회(`features/.../service` 가 소유). 미주입이면 GUI 에 도구가
  // 비어 보인다 — 조회일 뿐이라 없어도 인증은 돈다.
  toolsOf?: (providerId: string) => { serverId: string; tools: string[] } | null
  // DEV 빌드는 선언이 0개여도 게이트를 세운다(로그인 화면 도달성). 컴포지션 루트가
  // `import.meta.env.DEV` 를 넣는다 — prod 번들에서는 false 로 접힌다.
  alwaysRequired?: boolean
}

export class ProviderPlatform {
  constructor(private readonly deps: ProviderPlatformDeps) {}

  // 소비 표면. `Pick<ProviderApi, …>` 로 좁혀 받는 쪽이 많아 여기서는 전체를 노출한다.
  get api(): ProviderApi {
    return this.deps.api
  }

  // kind 별 선언 조회 — LLM 조인·service 도구 등록이 쓴다.
  declarations(kind: Provider['kind']): readonly Provider[] {
    return this.deps.registry.byKind(kind)
  }

  status(providerId: string): ReturnType<ProviderStore['status']> {
    return this.deps.store.status(providerId)
  }

  list(): ProviderInfo[] {
    return this.deps.registry.list().map((provider) => this.info(provider))
  }

  state(): ProviderPlatformState {
    const providers = this.list()
    const gateMembers = this.deps.registry.byKind('gate').map((provider) => ({
      providerId: provider.id,
      status: this.deps.store.status(provider.id),
      verified: this.deps.store.isVerified(provider.id)
    }))
    return {
      gate: evaluateGate({
        members: gateMembers,
        bypass: this.deps.bypass(),
        ...(this.deps.alwaysRequired ? { alwaysRequired: true } : {})
      }),
      providers,
      step: this.deps.login.currentStep()
    }
  }

  // 부팅 자동 로그인. 컴포지션 루트가 1회 부른다 — 그동안 게이트는 닫혀 있어 사용자는
  // 로그인 화면에서 `resuming` 을 본다.
  resume(): Promise<void> {
    return this.deps.login.resume()
  }

  login(
    providerId: string,
    authKind?: ProviderAuthKind,
    input?: Record<string, string>
  ): Promise<ProviderStepInfo> {
    return this.deps.login.begin(providerId, authKind, input)
  }

  continue(providerId: string, input: Record<string, string>): Promise<ProviderStepInfo> {
    return this.deps.login.continue(providerId, input)
  }

  reauth(providerId: string, authKind?: ProviderAuthKind): Promise<ProviderStepInfo> {
    return this.deps.login.reauth(providerId, authKind)
  }

  revoke(providerId: string): void {
    this.deps.login.revoke(providerId)
  }

  private info(provider: Provider): ProviderInfo {
    const grant = this.deps.store.get(provider.id)
    return {
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      origin: provider.origin,
      auth: provider.auth.map(authSpecInfo),
      status: this.deps.store.status(provider.id),
      activeAuthKind: this.deps.store.authKind(provider.id),
      principal: grant?.principalId ?? null,
      expiresAt: grant?.expiresAt ?? null,
      tools: toolNames(this.deps.toolsOf?.(provider.id) ?? null)
    }
  }
}

// 모델이 보는 **완전 이름** 으로 접는다 — 조립 규칙은 `adapters/claude-runtime-tools.ts`(SDK
// 서버 키 = `descriptor.id`)와 `adapters/runtime-tool-policy.ts`(승인 이름)와 같아야 한다.
function toolNames(descriptor: { serverId: string; tools: string[] } | null): string[] {
  if (!descriptor) return []
  return descriptor.tools.map((tool) => `mcp__${descriptor.serverId}__${tool}`)
}

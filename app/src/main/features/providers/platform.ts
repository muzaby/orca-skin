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
import type { AuthSpec, Provider } from '../../contracts/provider'
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
  // dev 게이트 우회 — 읽는 시점의 값이어야 하므로 getter 다(설정은 런타임에 바뀐다).
  bypass: () => boolean
}

export class ProviderPlatform {
  constructor(private readonly deps: ProviderPlatformDeps) {}

  list(): ProviderInfo[] {
    return this.deps.registry.list().map((provider) => this.info(provider))
  }

  state(): ProviderPlatformState {
    const providers = this.list()
    const gateMembers = this.deps.registry
      .byKind('gate')
      .map((provider) => ({ providerId: provider.id, status: this.deps.store.status(provider.id) }))
    return {
      gate: evaluateGate({ members: gateMembers, bypass: this.deps.bypass() }),
      providers,
      step: this.deps.login.currentStep()
    }
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
      expiresAt: grant?.kind === 'token' ? (grant.expiresAt ?? null) : null
    }
  }
}

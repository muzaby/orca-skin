// 로그인 실행 (0181) — `AuthSpec` 분기를 돌려 grant 를 만든다. 인증의 **유일한 입구**다.
//
// 구 구조의 transaction store·loginChain·cascade 는 없다. 상태는 **provider 당 pending 1건**이
// 전부이고, 그 pending 이 하는 일은 "다음 `continue` 가 어느 방식으로 이어지는가" 하나다.
//
// ── 재인증 의미론 (AC6) ──────────────────────────────────────────────────────
// `reauth` 는 기존 grant 를 **먼저 지우지 않는다**. 새 인증이 성공해야 교체된다 — 실패하면
// 이전 자격증명으로 계속 쓸 수 있어야 하기 때문이다. 입력형 방식에서 "성공" 은 곧 vault 쓰기라,
// compose 가 거부하면 vault 에 손도 대지 않는다.

import type {
  ProviderAuthKind,
  ProviderFailureReason,
  ProviderStepInfo
} from '../../../../shared/ipc'
import type { AuthSpec, Grant, Provider, TokenValue } from '../../../contracts/provider'
import { providerRefreshKey, providerVaultKey, type Vault } from '../../../infra/vault'
import type { ProviderRegistry } from './registry'
import type { ProviderStore } from './store'

// 방식 실행기가 돌려주는 원자재. grant 로 접는 것은 이 파일의 몫이다 — 실행기는 vault 를 모른다.
export type AuthResult =
  | { kind: 'secret'; value: string; principalId?: string }
  | { kind: 'token'; token: TokenValue }
  | { kind: 'session'; sessionGroup: string; principalId?: string }
  // OAuth `redirect:'manual'` — 사용자가 code 를 붙여 넣어야 이어진다.
  | { kind: 'code-required'; url: string }
  | { kind: 'failed'; reason: ProviderFailureReason; message: string }

export type OAuthSpec = Extract<AuthSpec, { kind: 'oauth' }>
export type BrowserSessionSpec = Extract<AuthSpec, { kind: 'browser-session' }>

// 단계 2 가 채운다. 미주입이면 oauth 선언은 `unsupported` 로 실패한다 — 조용히 성공시키지 않는다.
export interface OAuthAuthenticator {
  begin(provider: Provider, spec: OAuthSpec): Promise<AuthResult>
  complete(provider: Provider, spec: OAuthSpec, code: string): Promise<AuthResult>
}

// 단계 3 이 채운다.
export interface SessionAuthenticator {
  login(provider: Provider, spec: BrowserSessionSpec): Promise<AuthResult>
}

export interface LoginDeps {
  registry: ProviderRegistry
  store: ProviderStore
  vault: Vault
  clock?: () => number
  oauth?: OAuthAuthenticator
  session?: SessionAuthenticator
  // grant 가 바뀌었을 때의 통지 — 핸들러가 renderer 로 state push 를 낸다.
  onChange?: () => void
}

interface Pending {
  providerId: string
  authKind: ProviderAuthKind
}

export class LoginService {
  private readonly pending = new Map<string, Pending>()
  private readonly clock: () => number

  constructor(private readonly deps: LoginDeps) {
    this.clock = deps.clock ?? Date.now
  }

  // 지금 진행 중인 단계(있으면). renderer state 가 싣는다.
  currentStep(): ProviderStepInfo | null {
    return this.step
  }

  private step: ProviderStepInfo | null = null

  async begin(
    providerId: string,
    authKind?: ProviderAuthKind,
    input?: Record<string, string>
  ): Promise<ProviderStepInfo> {
    return this.run(providerId, authKind, input)
  }

  // 재인증도 같은 경로다 — 차이는 **기존 grant 를 남겨둔 채** 시작한다는 것뿐이고, 그것이
  // `begin` 의 기본 동작이므로 별도 분기가 필요 없다. 표면을 나누는 이유는 IPC 계약(카탈로그의
  // [재인증] 버튼)이 의도를 명시하기 위함이다.
  async reauth(providerId: string, authKind?: ProviderAuthKind): Promise<ProviderStepInfo> {
    return this.run(providerId, authKind)
  }

  async continue(providerId: string, input: Record<string, string>): Promise<ProviderStepInfo> {
    const pending = this.pending.get(providerId)
    if (!pending) {
      return this.fail(providerId, 'cancelled', '진행 중인 인증이 없습니다')
    }
    return this.run(providerId, pending.authKind, input)
  }

  revoke(providerId: string): void {
    this.pending.delete(providerId)
    this.deps.store.revoke(providerId)
    if (this.step?.providerId === providerId) this.step = null
    this.deps.onChange?.()
  }

  private async run(
    providerId: string,
    authKind: ProviderAuthKind | undefined,
    input?: Record<string, string>
  ): Promise<ProviderStepInfo> {
    const provider = this.deps.registry.get(providerId)
    if (!provider) return this.fail(providerId, 'unknown_provider', '등록되지 않은 provider 입니다')

    // 방식 미지정 = 선언 배열의 첫 방식. 단일 선언이면 GUI 가 고를 것이 없다.
    const spec = authKind
      ? provider.auth.find((candidate) => candidate.kind === authKind)
      : provider.auth[0]
    if (!spec) {
      return this.fail(providerId, 'unknown_auth_kind', '선언되지 않은 인증 방식입니다')
    }

    switch (spec.kind) {
      case 'api-key':
      case 'password':
      case 'pat':
        return this.runCredential(provider, spec, input)
      case 'oauth':
        return this.runOAuth(provider, spec, input)
      case 'browser-session':
        return this.runSession(provider, spec)
    }
  }

  private runCredential(
    provider: Provider,
    spec: Extract<AuthSpec, { kind: 'api-key' | 'password' | 'pat' }>,
    input: Record<string, string> | undefined
  ): ProviderStepInfo {
    // 1회차는 입력이 없으므로 필드를 알린다. **신뢰된 prompt** 다 — 방식이 만든 임의 UI 가
    // 아니라 Orca 가 이 필드 선언을 렌더링한다.
    if (!input || !spec.fields.some((field) => input[field.name] !== undefined)) {
      this.pending.set(provider.id, { providerId: provider.id, authKind: spec.kind })
      return this.emit({
        kind: 'input-required',
        providerId: provider.id,
        authKind: spec.kind,
        fields: [...spec.fields]
      })
    }

    const composed = spec.compose(input)
    if ('error' in composed) {
      // 실패해도 pending 은 유지한다 — 사용자가 같은 폼에서 고쳐 다시 낸다.
      return this.emit({
        kind: 'input-required',
        providerId: provider.id,
        authKind: spec.kind,
        fields: [...spec.fields],
        message: composed.error
      })
    }

    const vaultKey = providerVaultKey(provider.id, spec.kind)
    const createdAt = this.clock()
    this.deps.vault.set(vaultKey, composed.value, { kind: spec.kind, createdAt })
    this.commit(provider.id, {
      kind: 'secret',
      vaultKey,
      authKind: spec.kind,
      createdAt,
      ...(composed.principalId !== undefined ? { principalId: composed.principalId } : {})
    })
    return this.emit({ kind: 'done', providerId: provider.id })
  }

  private async runOAuth(
    provider: Provider,
    spec: OAuthSpec,
    input: Record<string, string> | undefined
  ): Promise<ProviderStepInfo> {
    const authenticator = this.deps.oauth
    if (!authenticator) {
      return this.fail(provider.id, 'unsupported', 'OAuth 실행기가 배선되지 않았습니다')
    }
    // manual 분기의 2회차 — 사용자가 붙여 넣은 code 로 교환한다.
    const code = input?.code?.trim()
    const result = code
      ? await authenticator.complete(provider, spec, code)
      : await authenticator.begin(provider, spec)
    return this.absorb(provider, spec.kind, result)
  }

  private async runSession(
    provider: Provider,
    spec: BrowserSessionSpec
  ): Promise<ProviderStepInfo> {
    const authenticator = this.deps.session
    if (!authenticator) {
      return this.fail(provider.id, 'unsupported', '브라우저 세션 실행기가 배선되지 않았습니다')
    }
    return this.absorb(provider, spec.kind, await authenticator.login(provider, spec))
  }

  // 실행기 결과 → grant. vault 쓰기가 여기 한 곳에 모인다.
  private absorb(
    provider: Provider,
    authKind: ProviderAuthKind,
    result: AuthResult
  ): ProviderStepInfo {
    switch (result.kind) {
      case 'code-required': {
        this.pending.set(provider.id, { providerId: provider.id, authKind })
        return this.emit({
          kind: 'code-required',
          providerId: provider.id,
          authKind,
          url: result.url
        })
      }
      case 'failed':
        return this.fail(provider.id, result.reason, result.message)
      case 'secret': {
        const vaultKey = providerVaultKey(provider.id, authKind)
        const createdAt = this.clock()
        this.deps.vault.set(vaultKey, result.value, { kind: authKind, createdAt })
        this.commit(provider.id, {
          kind: 'secret',
          vaultKey,
          authKind,
          createdAt,
          ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
        })
        return this.emit({ kind: 'done', providerId: provider.id })
      }
      case 'token': {
        const vaultKey = providerVaultKey(provider.id, authKind)
        const createdAt = this.clock()
        const { token } = result
        this.deps.vault.set(vaultKey, token.token, {
          kind: authKind,
          createdAt,
          ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {})
        })
        let refreshKey: string | undefined
        if (token.refreshToken !== undefined) {
          refreshKey = providerRefreshKey(provider.id, authKind)
          this.deps.vault.set(refreshKey, token.refreshToken, { kind: authKind, createdAt })
        }
        this.commit(provider.id, {
          kind: 'token',
          vaultKey,
          authKind,
          createdAt,
          ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {}),
          ...(refreshKey !== undefined ? { refreshKey } : {}),
          ...(token.principalId !== undefined ? { principalId: token.principalId } : {})
        })
        return this.emit({ kind: 'done', providerId: provider.id })
      }
      case 'session': {
        this.commit(provider.id, {
          kind: 'session',
          sessionGroup: result.sessionGroup,
          authKind,
          createdAt: this.clock(),
          ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
        })
        return this.emit({ kind: 'done', providerId: provider.id })
      }
    }
  }

  private commit(providerId: string, grant: Grant): void {
    this.pending.delete(providerId)
    this.deps.store.put(providerId, grant)
    this.deps.onChange?.()
  }

  private fail(
    providerId: string,
    reason: ProviderFailureReason,
    message: string
  ): ProviderStepInfo {
    this.pending.delete(providerId)
    return this.emit({ kind: 'failed', providerId, reason, message })
  }

  private emit(step: ProviderStepInfo): ProviderStepInfo {
    this.step = step.kind === 'done' ? null : step
    this.deps.onChange?.()
    return step
  }
}

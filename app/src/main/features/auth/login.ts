// 로그인 실행 (0181) — `AuthSpec` 분기를 돌려 grant 를 만든다. 인증의 **유일한 입구**다.
//
// 구 구조의 transaction store·loginChain·cascade 는 없다. 상태는 **provider 당 pending 1건**이
// 전부이고, 그 pending 이 하는 일은 "다음 `continue` 가 어느 방식으로 이어지는가" 하나다.
//
// ── 재인증 의미론 (AC6) ──────────────────────────────────────────────────────
// `reauth` 는 기존 grant 를 **먼저 지우지 않는다**. 새 인증이 성공해야 교체된다 — 실패하면
// 이전 자격증명으로 계속 쓸 수 있어야 하기 때문이다. 입력형 방식에서 "성공" 은 곧 vault 쓰기라,
// compose 가 거부하면 vault 에 손도 대지 않는다.

import type { ProviderAuthKind, ProviderFailureReason, ProviderStepInfo } from '../../../shared/ipc'
import type { AuthSpec, Grant, Provider, ProviderApi, TokenValue } from '../../contracts/auth'
import { errorMessage } from '../../infra/errors'
import { providerRefreshKey, providerVaultKey, type Vault } from '../../infra/vault'
import { isAllowedOrigin } from './policy'
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

// 단계 3 이 채운다. **창을 여는 일만** 한다 — 성립 여부 판정은 `Provider.probe` 가 맡는다.
export interface SessionAuthenticator {
  login(provider: Provider, spec: BrowserSessionSpec): Promise<AuthResult>
}

// probe 왕복 상한. 없으면 SP 가 응답하지 않을 때 로그인 invoke 가 매달려 화면이 멈춘 것처럼
// 보인다(부팅 복원에서는 게이트가 영영 안 열린다).
const PROBE_TIMEOUT_MS = 15_000

export interface LoginDeps {
  registry: ProviderRegistry
  store: ProviderStore
  vault: Vault
  clock?: () => number
  oauth?: OAuthAuthenticator
  session?: SessionAuthenticator
  // 인증 확인(`Provider.probe`)의 실행 통로. 미주입이면 확인 없이 통과한다.
  api?: Pick<ProviderApi, 'request'>
  // grant 가 바뀌었을 때의 통지 — 핸들러가 renderer 로 state push 를 낸다.
  onChange?: () => void
  // 자동 로그인 진단. probe 성공·실패가 여기로 나간다.
  logger?: (event: string, data: Record<string, unknown>) => void
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

  // ── 자동 로그인 (부팅 1회) ───────────────────────────────────────────────────
  //
  // 복원된 grant 는 *기록*이지 인증이 아니다(`gate/index.ts` 의 `verified`). 여기서 한 번
  // 확인해야 게이트가 열린다. **확인 방법은 방식과 무관하게 하나다** — `Provider.probe`.
  //
  //   session — 쿠키는 Chromium 파티션에 복원돼 있다. 물어봐야만 살아 있는지 안다.
  //   값형    — vault 에 값이 남아 있어도 서버가 그 PAT·API key 를 이미 회수했을 수 있다.
  //             (만료를 아는 것은 토큰뿐이고, 그 외에는 서버만 안다.)
  //
  // **게이트가 닫힌 채로 돈다** — 사용자는 로그인 화면을 보고 있고 `resuming` 이 진행을 알린다.
  // 성공하면 화면이 넘어가고, 실패하면 그 자리에서 수동 로그인 버튼이 살아난다.
  //
  // 던지지 않는다 — 부팅 경로라 실패는 전부 "수동 로그인 필요" 로 접는다.
  async resume(): Promise<void> {
    for (const provider of this.deps.registry.byKind('gate')) {
      if (!this.restorable(provider)) continue
      this.emit({ kind: 'resuming', providerId: provider.id })
      await this.reprobe(provider)
      this.settle(provider.id)
    }
    await this.sweepPlugins()
  }

  // ── 게이트 외 플러그인 상태 갱신 ─────────────────────────────────────────────
  //
  // **게이트가 열린 뒤에 돈다.** 사내 서비스는 대개 게이트와 *같은 cookie jar* 를 쓰므로
  // (`sessionGroup` 공유), 로그인 전에 물으면 살아 있는 연결도 미인증으로 떨어진다. 그렇게
  // 한 번 강등되면 `checkOutboundRequest` 가 `grant_not_valid` 로 막아 스스로 회복하지 못한다
  // (401 강등과 같은 성질 — 회복은 재인증뿐이다). 그래서 순서가 규칙이다.
  //
  // 게이트가 아직 통과되지 않았으면 아무것도 하지 않는다. 게이트 선언이 0개면 `every` 가
  // 참이라 부팅 직후 바로 돈다.
  //
  // **게이트-플러그인 순서만 규칙이고 플러그인끼리는 아니다** — 서로 독립이므로 병렬로 묻는다.
  // 순차로 돌면 `PROBE_TIMEOUT_MS` 가 provider 수만큼 직렬로 쌓여(연결 안 되는 망에서 N×15초)
  // 그 시간 동안 service tool 이 뜨지 않는다.
  //
  // **sweep 자체의 통지는 루프 뒤 한 번**이다. 안에서 부르면 provider 마다 전체 상태를 다시
  // 만들어 브로드캐스트해 renderer 가 N 번 다시 그린다(상태 조회가 provider 마다 vault 를 읽으므로
  // 파일 읽기도 N² 로 붙는다).
  //
  // **총량이 1회라는 뜻은 아니다.** 401/403 을 만난 probe 는 `ProviderApi.request` 안에서 강등과
  // 함께 그 자리에서 통지한다 — 그래서 총 `1 + K`(K=401/403 수)다. 그것을 억제하지 않는 이유는
  // 그 통지가 renderer 방송뿐 아니라 **만료 provider 의 도구 회수**(`ServiceToolRegistrar.sync`)를
  // 함께 태우기 때문이다. 부팅 sweep 은 `void resume()` 이라 게이트가 열린 뒤에도 계속 도는데,
  // 여기서 통지를 미루면 죽은 연결의 도구가 남은 probe 의 타임아웃만큼 화면에 남는다.
  // 이전 구현은 루프 안에서 매번 불러 `N + K` 였다 — `1 + K` 는 그보다 항상 적다. (0187 D2)
  private async sweepPlugins(): Promise<void> {
    const gates = this.deps.registry.byKind('gate')
    if (!gates.every((gate) => this.deps.store.isVerified(gate.id))) return

    const candidates = this.deps.registry
      .list()
      .filter((provider) => provider.kind !== 'gate' && provider.probe)
      .filter((provider) => this.restorable(provider))
    if (candidates.length === 0) return

    await Promise.all(candidates.map((provider) => this.reprobe(provider)))
    this.deps.onChange?.()
  }

  // 확인 대상인가 — grant 가 있고, 아직 이번 실행에서 확인되지 않았고, 지금 요청을 낼 수 있는
  // 상태인가. `status !== 'valid'` 면 정책이 요청 자체를 막으므로 물어볼 수 없다.
  private restorable(provider: Provider): boolean {
    if (!this.deps.store.get(provider.id)) return false
    if (this.deps.store.isVerified(provider.id)) return false
    return this.deps.store.status(provider.id) === 'valid'
  }

  // 실패는 **강등**한다 — grant 는 남긴다(어느 provider 를 다시 인증해야 하는지 보여야 한다).
  private async reprobe(provider: Provider): Promise<void> {
    if (await this.probeOk(provider)) this.deps.store.markVerified(provider.id)
    else this.deps.store.markExpired(provider.id)
  }

  // `resuming` 을 걷어낸다. 결과는 게이트 상태가 말하므로 별도 step 을 남기지 않는다 —
  // 실패했으면 로그인 화면이 그대로 있고, 성공했으면 화면이 넘어간다.
  private settle(providerId: string): void {
    if (this.step?.kind === 'resuming' && this.step.providerId === providerId) this.step = null
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

  // ── 인증 확인 (probe) ────────────────────────────────────────────────────────
  //
  // 실행은 `ProviderApi.request` **한 줄**이다. grant 를 먼저 커밋해 두므로 세션이면 cookie jar
  // 로, 값형이면 `present` 로 실려 나가는 것을 `transport()` 가 갈라 준다 — 검증 경로와 사용
  // 경로가 글자까지 같아진다.
  //
  // **status 만 보지 않는다** (0174 실기): SSO 배포는 미인증일 때 IdP 로그인 폼을 **200** 으로
  // 준다. 체인이 provider origin 으로 돌아왔는지까지 봐야 그 200 을 인증됨으로 오독하지 않는다.
  // allowlist 밖으로 튄 홉은 `api.request` 가 던지고, 그 자체가 미인증 판정이다.
  private async probeOk(provider: Provider): Promise<boolean> {
    const probe = provider.probe
    if (!probe || !this.deps.api) return true
    try {
      const res = await this.deps.api.request(
        provider.id,
        { path: probe.path, ...(probe.method !== undefined ? { method: probe.method } : {}) },
        AbortSignal.timeout(PROBE_TIMEOUT_MS)
      )
      // origin 비교는 브라우저 세션·홉별 검사와 **같은 구현**을 쓴다 — 두 벌이면 규칙이
      // 갈리는데, 하필 이 한 줄이 "인증됐는가" 의 판정이다. `provider.origin` 은 등록에서
      // bare origin 임이 강제되므로(`registry.isBareOrigin`) allowlist 원소로 그대로 쓴다.
      const returned = isAllowedOrigin(res.finalUrl, [provider.origin])
      const ok = res.ok && returned
      // 성공·실패 **양쪽 다** 남긴다 — 쿠키·키가 재시작을 넘어왔는지를 이 한 줄이 말해 준다.
      this.deps.logger?.('providers.probe.result', {
        providerId: provider.id,
        ok,
        status: res.status,
        returned
      })
      return ok
    } catch (error) {
      // 네트워크 미연결(VPN 전)·정책 위반(allowlist 밖 redirect)·타임아웃. 전부 미인증이다.
      this.deps.logger?.('providers.probe.failed', {
        providerId: provider.id,
        reason: errorMessage(error)
      })
      return false
    }
  }

  // 커밋 → 확인 → 실패면 되돌린다. **`null` = 확인 실패** — 호출자가 자기 실패 모양을 만든다
  // (입력 폼이 있는 방식은 같은 폼으로, 브라우저 흐름은 `failed` 로).
  //
  // 커밋을 먼저 하는 이유는 `checkOutboundRequest` 가 `grantStatus !== 'valid'` 를 거부하기
  // 때문이다. 확인이 끝나기 전에는 **알리지 않는다**(`notify:false`) — `commit` 이 곧바로
  // 브로드캐스트하면 probe 로 떨어질 자격증명에도 게이트가 한 순간 열렸다 닫힌다.
  private async settleGrant(provider: Provider, grant: Grant): Promise<ProviderStepInfo | null> {
    this.commit(provider.id, grant, false)
    if (!(await this.probeOk(provider))) {
      this.deps.store.revoke(provider.id)
      // 통지는 호출자의 `emit`(폼 재표시 또는 `failed`)이 한다 — 두 번 쏘지 않는다.
      return null
    }
    // 게이트가 열렸으면 같은 세션을 쓰는 플러그인들의 상태를 이어서 갱신한다.
    if (provider.kind === 'gate') await this.sweepPlugins()
    return this.emit({ kind: 'done', providerId: provider.id })
  }

  private async runCredential(
    provider: Provider,
    spec: Extract<AuthSpec, { kind: 'api-key' | 'password' | 'pat' }>,
    input: Record<string, string> | undefined
  ): Promise<ProviderStepInfo> {
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
    const settled = await this.settleGrant(provider, {
      kind: 'secret',
      vaultKey,
      authKind: spec.kind,
      createdAt,
      ...(composed.principalId !== undefined ? { principalId: composed.principalId } : {})
    })
    if (settled) return settled

    // 서버가 그 값을 거부했다 — pending 을 살려 **같은 폼**으로 돌려준다(compose 오류와 같은
    // 모양). 재인증이었다면 이전 자격증명은 이미 같은 vault 키에 덮여 복구되지 않는다.
    this.pending.set(provider.id, { providerId: provider.id, authKind: spec.kind })
    return this.emit({
      kind: 'input-required',
      providerId: provider.id,
      authKind: spec.kind,
      fields: [...spec.fields],
      message: '자격증명이 거부되었습니다. 값을 확인해 주세요.'
    })
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
  //
  // 성공 분기 3종은 전부 `settleGrant` 를 지난다 — OAuth·브라우저 세션도 값형과 **같은 확인**을
  // 받는다. 창이 `doneUrlPrefix` 에 도달한 것만으로 성공을 선언하지 않는 이유가 여기 있다
  // (로그인 폼이 같은 접두사로 렌더되는 배포가 있다).
  private async absorb(
    provider: Provider,
    authKind: ProviderAuthKind,
    result: AuthResult
  ): Promise<ProviderStepInfo> {
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
        return this.settled(
          provider,
          await this.settleGrant(provider, {
            kind: 'secret',
            vaultKey,
            authKind,
            createdAt,
            ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
          })
        )
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
        return this.settled(
          provider,
          await this.settleGrant(provider, {
            kind: 'token',
            vaultKey,
            authKind,
            createdAt,
            ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {}),
            ...(refreshKey !== undefined ? { refreshKey } : {}),
            ...(token.principalId !== undefined ? { principalId: token.principalId } : {})
          })
        )
      }
      case 'session': {
        return this.settled(
          provider,
          await this.settleGrant(provider, {
            kind: 'session',
            sessionGroup: result.sessionGroup,
            authKind,
            createdAt: this.clock(),
            ...(result.principalId !== undefined ? { principalId: result.principalId } : {})
          })
        )
      }
    }
  }

  // 입력 폼이 없는 흐름(OAuth·브라우저 세션)의 확인 실패는 `failed` 다 — 되돌려 보낼 폼이 없고,
  // 사용자는 [연결] 을 다시 눌러 창부터 다시 연다.
  private settled(provider: Provider, step: ProviderStepInfo | null): ProviderStepInfo {
    return step ?? this.fail(provider.id, 'probe_failed', '인증을 확인하지 못했습니다')
  }

  private commit(providerId: string, grant: Grant, notify = true): void {
    this.pending.delete(providerId)
    this.deps.store.put(providerId, grant)
    if (notify) this.deps.onChange?.()
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

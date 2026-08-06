// 인증 broker (0157) — registry · transactions · bindings · policy · vault · session store 를
// 조립하는 **유일한 credential 소비 지점**.
//
// 여기 밖에서는 아무도 raw secret 을 만지지 않는다. connector 는 bindingId 로 위임하고
// (`authenticatedFetch`), renderer 는 DTO 만 받는다. MCP 만 예외로 값을 받아가는데, 그것은
// claude CLI 가 서버를 spawn 하는 구조 때문이며 요구명세 §소비자 경계 의 문서화된 잔여 노출이다.

import type {
  AuthBindingInfo,
  AuthBindingStatus,
  AuthFailureReason,
  AuthLogoutOutcome,
  AuthPlatformState,
  AuthStepInfo,
  AuthTarget,
  CredentialPresentation
} from '../../../shared/ipc'
import type {
  AuthBindingDraft,
  AuthBindingRef,
  AuthPluginContext,
  AuthProviderV1,
  AuthStep,
  BrowserSessionCapability
} from '../../contracts/auth-plugin'
import type {
  AuthenticatedFetchRequest,
  AuthenticatedFetchResponse
} from '../../contracts/connector-plugin'
import {
  applyPresentation,
  createSender,
  type AuthenticatedFetchDeps,
  type PreparedRequest,
  type SendOptions
} from '../../infra/auth/authenticated-fetch'
import {
  authBindingPrefix,
  authProviderPrefix,
  type CredentialVault
} from '../../infra/auth/credential-vault'
import { locationOf, redirectLocationOf } from '../../infra/auth/net-response'
import { getLogger } from '../../infra/log/registry'
import { BindingStore, type BindingPersistence } from './bindings'
import { checkOutboundRequest, checkRedirect, isAllowedOrigin, type PolicyResult } from './policy'
import type { AuthRegistry } from './registry'
import {
  runGuarded,
  TransactionStore,
  type ChainState,
  type StagedBinding,
  type Transaction
} from './transactions'

// binding 이 봉인한 credential 의 vault 키. provider 는 이 이름으로 값을 넣고 broker 가 읽는다.
export const BINDING_SECRET_NAME = 'secret'

// redirect 추종 상한. 초과는 **오류**다 — 마지막 3xx 를 성공으로 접으면 호출자가 빈 본문을
// 정상 응답으로 읽는다.
export const MAX_REDIRECT_HOPS = 5

export interface BrokerDeps {
  registry: AuthRegistry
  // 네임스페이스별 vault 팩토리 — broker 는 raw SecretStore 를 보지 않는다.
  vaultFor: (prefix: string) => CredentialVault
  browserSessions: BrowserSessionCapability
  // 원격 요청 전송자 (0173). **필수** — 기본값을 두면 주입을 빠뜨린 경로가 조용히 Node 스택으로
  // 돌아가 사내 프록시·사설 CA 를 못 탄다. 프로덕션은 `netFetch`(Chromium), 테스트는 스텁.
  fetchImpl: typeof fetch
  broadcast: (state: AuthPlatformState) => void
  // binding 제거 뒤 connector/runtime server를 정리하는 composition callback. auth-platform은
  // PluginHost 구현을 import하지 않고 구조적 포트만 받는다.
  onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
  // provider 에게 노출할 env 이름 allowlist. 기본 빈 배열 = 아무것도 노출 안 함.
  envAllowlist?: readonly string[]
  sender?: AuthenticatedFetchDeps
  clock?: () => number
  // binding 레코드 영속 (0170). 없으면 종전대로 메모리 전용 — 재시작하면 재입력을 받는다.
  bindingPersistence?: BindingPersistence
}

// `restore()` 가 돌려주는 재연결 대상. 컴포지션 루트가 이것으로 connector 를 다시 연결한다.
export interface RestoredConnectorBinding {
  bindingId: string
  connectorId: string
  connectionId: string
}

interface MutableState {
  inflight: boolean
  errorMessage: string | null
  step: AuthStepInfo | null
}

export class AuthBroker {
  private readonly bindings: BindingStore
  private readonly transactions: TransactionStore
  private readonly sender: AuthenticatedFetchDeps
  private readonly clock: () => number
  private readonly state: MutableState = { inflight: false, errorMessage: null, step: null }

  constructor(private readonly deps: BrokerDeps) {
    this.clock = deps.clock ?? Date.now
    this.bindings = new BindingStore(this.clock, deps.bindingPersistence)
    this.sender = deps.sender ?? createSender(deps.fetchImpl)
    this.transactions = new TransactionStore(this.clock, (tx, reason) => {
      // 취소를 조용히 넘기지 않는다 — application transaction 이면 게이트 상태에 반영한다.
      this.log().info('auth.transaction.cancelled', { providerId: tx.providerId, reason })
      if (this.settleApplicationGate(tx.target, reason === 'timeout' ? 'timeout' : undefined)) {
        this.publish()
      }
      // 타임아웃·재진입·종료로 끊긴 체인의 보류분도 정리한다 (0172). 정리는 비동기라 취소
      // 통지 자체는 막지 않고, 끝난 뒤 상태만 다시 알린다.
      if (tx.chain !== undefined && tx.chain.staged.length > 0) {
        void this.rollbackChain(tx).then(() => this.publish())
      }
    })
  }

  private log(): ReturnType<ReturnType<typeof getLogger>['child']> {
    return getLogger().child('auth')
  }

  // ── 상태 ───────────────────────────────────────────────────────────────────

  status(): AuthPlatformState {
    const appBindings = this.bindings.applicationBindings()
    const root = this.bindings.findApplicationBinding()
    return {
      // application target 을 지원하는 provider 가 하나라도 있어야 게이트가 의미를 갖는다.
      required: this.deps.registry.providersForTarget('application').length > 0,
      // 체인은 **전 멤버가 유효해야** 인증이다 (0172). 멤버가 1개면 기존 판정과 동치다.
      authenticated: appBindings.length > 0 && appBindings.every((b) => b.status === 'valid'),
      inflight: this.state.inflight,
      // 신원은 root 우선. root 가 principal 을 안 주면 그것을 준 첫 멤버를 쓴다.
      identity: root?.principal ?? appBindings.find((b) => b.principal)?.principal ?? null,
      errorMessage: this.state.errorMessage,
      step: this.state.step,
      providers: this.deps.registry.describeProviders()
    }
  }

  listBindings(): AuthBindingInfo[] {
    return this.bindings.list()
  }

  // PluginHost가 raw BindingStore를 받지 않도록 하는 최소 read port.
  getBinding(bindingId: string): AuthBindingInfo | undefined {
    return this.bindings.get(bindingId)
  }

  private publish(): void {
    this.deps.broadcast(this.status())
  }

  // ── 복원 ───────────────────────────────────────────────────────────────────

  // 저장된 binding 을 되살린다 (0170). **비밀이 아직 있는지 vault 에 물어보고 나서** 살린다 —
  // 레코드만 보고 살리면 "연결됨" 이라 표시해 놓고 첫 요청에서 깨지는, 조용한 거짓말이 된다.
  //
  // 복원 대상은 **connector 뿐**이다. `application` 은 `RootGate` 가 화면 전체를 막는 UX 게이트라
  // 자동 통과가 사용자가 요청하지 않은 변경이고, `browser_session` 은 cookie jar 가 binding 밖
  // (Electron session partition)에 있어 handle 만으로는 되살릴 수 없다.
  restore(): RestoredConnectorBinding[] {
    const kept: AuthBindingInfo[] = []
    const restored: RestoredConnectorBinding[] = []
    const persisted = this.bindings.loadPersisted()

    for (const record of persisted) {
      if (record.target.kind !== 'connector' || record.artifact.kind !== 'vault_credential')
        continue

      const read = this.deps.vaultFor(authBindingPrefix(record.id)).read(BINDING_SECRET_NAME)
      if (read.state === 'absent') {
        // 값이 없는 binding 을 남기면 UI 가 "연결됨" 이라 거짓말한다. 레코드를 버린다.
        this.log().info('auth.restore.dropped', { bindingId: record.id, reason: 'secret-absent' })
        continue
      }
      // 복호화 실패는 **부재가 아니다**(키체인 잠김·다른 머신). 값이 돌아올 수 있으므로
      // 버리지 않고 unknown 으로 남긴다 — 조용한 미인증 진행을 막는 vault 계약 그대로다.
      const status: AuthBindingStatus = read.state === 'found' ? 'valid' : 'unknown'
      const binding = { ...record, status }
      kept.push(binding)
      if (status === 'valid') {
        restored.push({
          bindingId: binding.id,
          connectorId: record.target.connectorId,
          connectionId: record.target.connectionId
        })
      }
    }

    // 메모리와 저장소를 함께 맞춘다 — 버린 레코드가 파일에 남으면 다음 부팅에 또 되살아난다.
    // 다만 **버린 것도 바뀐 것도 없으면 쓰지 않는다**: 부팅마다 도는 경로라 그때의 동기 파일
    // 쓰기가 매 실행 순수 낭비다(레코드 0건인 기본 설치가 특히 그렇다). 길이가 같으면 버린
    // 레코드가 없다는 뜻이므로 순서가 그대로다 — 그 위에서 status 만 대조하면 충분하다.
    const unchanged =
      kept.length === persisted.length &&
      kept.every((binding, index) => {
        const source = persisted[index]
        return source?.id === binding.id && source.status === binding.status
      })
    this.bindings.adopt(kept, { persist: !unchanged })
    if (kept.length > 0) this.publish()
    return restored
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  async begin(providerId: string, target: AuthTarget): Promise<AuthStepInfo> {
    const provider = this.deps.registry.getProvider(providerId)
    if (!provider) return this.fail(target, 'internal', `알 수 없는 provider: ${providerId}`)
    if (!provider.descriptor.targets.includes(target.kind)) {
      return this.fail(
        target,
        'policy_denied',
        `이 provider 는 ${target.kind} 대상을 지원하지 않습니다`
      )
    }

    // 앱 로그인은 **패키지 단위 체인**이다 (0172) — 같은 패키지가 선언한 application provider 들이
    // 하나의 논리 로그인이다. 어느 멤버로 begin 하든 체인의 **헤드부터** 시작한다: 중간부터
    // 시작하면 "전부 성공해야 인증" 이라는 불변식을 만족시킬 방법이 없다.
    // connector 연결은 사용자가 방식 하나를 고르는 흐름이라 체인을 타지 않는다.
    const members =
      target.kind === 'application' ? this.deps.registry.loginChainFor(providerId) : [provider]
    const head = members[0] ?? provider

    const tx = this.transactions.begin({
      providerId: head.descriptor.id,
      pluginId: head.descriptor.pluginId,
      target,
      ...(head.descriptor.loginTimeoutMs !== undefined
        ? { timeoutMs: head.descriptor.loginTimeoutMs }
        : {}),
      chain: { members: members.map((m) => m.descriptor.id), index: 0, staged: [] }
    })
    if (target.kind === 'application') {
      this.state.inflight = true
      this.state.errorMessage = null
      this.publish()
    }

    const ctx = this.buildContext(head, tx, {})
    const step = await runGuarded<AuthStep>(
      tx.controller.signal,
      () => head.begin(ctx),
      (err) => this.toFailedStep(head, err)
    )
    return this.applyStep(head, tx, step)
  }

  async continue(transactionId: string, input: Record<string, string>): Promise<AuthStepInfo> {
    const tx = this.transactions.get(transactionId)
    if (!tx) {
      return { kind: 'failed', reason: 'cancelled', message: '만료되었거나 취소된 인증 요청입니다' }
    }
    const provider = this.deps.registry.getProvider(tx.providerId)
    if (!provider) return this.fail(tx.target, 'internal', '알 수 없는 provider')

    const ctx = this.buildContext(provider, tx, input)
    const step = await runGuarded<AuthStep>(
      tx.controller.signal,
      () => provider.continue(ctx),
      (err) => this.toFailedStep(provider, err)
    )
    return this.applyStep(provider, tx, step)
  }

  // cascade=false 가 기본 — connector 하나의 연결 해제가 공유 session group 을 통째로
  // 날리지 않게 하는 안전 기본값 (AUTH-PLAT-010).
  async logout(bindingId: string, cascade: boolean): Promise<AuthLogoutOutcome> {
    const victims = this.bindings.takeForRemoval(bindingId, cascade)
    if (victims.length === 0) return { kind: 'failed', message: '알 수 없는 binding' }
    const removed = victims.map((victim) => victim.id)
    const failures: string[] = []

    for (const victim of victims) {
      const provider = this.deps.registry.getProvider(victim.providerId)
      if (provider) {
        const controller = new AbortController()
        const ctx = this.buildContextForBinding(provider, victim, controller.signal)
        const result = await runGuarded(
          controller.signal,
          () => provider.logout(ctx, toRef(victim)),
          (err) => ({ kind: 'failed' as const, message: String(err) })
        )
        if (result.kind === 'failed') failures.push(result.message ?? victim.id)
      }
      // provider 가 뭘 하든 broker 소유 잔여물은 우리가 지운다.
      this.deps.vaultFor(authBindingPrefix(victim.id)).clearAll()
    }

    if (removed.length > 0 && this.deps.onBindingsEnded) {
      try {
        await this.deps.onBindingsEnded(removed)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
    this.publish()
    return failures.length > 0
      ? { kind: 'failed', message: failures.join('; ') }
      : { kind: 'logged_out', endedBindingIds: removed }
  }

  // ── connector 인증 위임 ────────────────────────────────────────────────────

  async authenticatedFetch(
    req: AuthenticatedFetchRequest,
    signal?: AbortSignal
  ): Promise<AuthenticatedFetchResponse> {
    const connector = this.deps.registry.getConnector(req.connectorId)
    if (!connector) throw new Error(`알 수 없는 connector: ${req.connectorId}`)
    const binding = this.bindings.get(req.bindingId)
    if (!binding) throw new Error('알 수 없는 binding')

    const url = joinUrl(connector.descriptor.baseUrl, req.path, req.query)
    const verdict = checkOutboundRequest({
      url,
      path: req.path,
      ...(req.headers !== undefined ? { headers: req.headers } : {}),
      connectorId: req.connectorId,
      binding: { id: binding.id, target: binding.target, status: binding.status },
      allowedOrigins: [connector.descriptor.baseUrl]
    })
    if (!verdict.ok) throw policyError(verdict)

    const base: PreparedRequest = {
      url,
      method: req.method,
      headers: { ...(req.headers ?? {}) },
      ...(req.body !== undefined ? { body: req.body } : {})
    }

    // browser session binding 은 값을 주입하지 않는다 — Orca 소유 Session 의 cookie jar 가
    // 그대로 실린다. static credential binding 만 presentation 으로 주입한다.
    if (binding.artifact.kind === 'browser_session') {
      const probe = await this.deps.browserSessions.probe(binding.artifact.handleId, url)
      return { status: probe.status, headers: {}, body: '' }
    }

    const secret = this.readBindingSecret(binding)
    if (secret === null) throw new Error('binding 의 credential 을 읽을 수 없습니다')
    // 같은 connector 가 PAT(Bearer)와 ID/비밀번호(Basic)를 함께 받으면 표현이 하나로 고정될 수
    // 없다. binding 의 mechanism 으로 고르고, 선언에 없으면 기본 presentation 으로 되돌아간다.
    const presentation =
      connector.descriptor.presentations?.[binding.mechanism] ?? connector.descriptor.presentation
    const prepared = applyPresentation(base, presentation, secret)
    const options: SendOptions = {
      ...(req.responseType !== undefined ? { responseType: req.responseType } : {}),
      ...(req.maxBytes !== undefined ? { maxBytes: req.maxBytes } : {})
    }

    return this.sendFollowingRedirects(
      prepared,
      presentation,
      secret,
      connector.descriptor.baseUrl,
      options,
      signal
    )
  }

  // `redirect:'manual'` 이라 3xx 는 전송자가 그대로 돌려준다. 여기서 policy 로 Location 을
  // 재검사한 뒤에만 다음 홉을 보낸다 — 허용 밖이면 **요청 자체를 만들지 않으므로** credential 이
  // 그 origin 으로 나가지 않는다. 0160 이전에는 재검사 호출자가 없어 302 가 빈 본문 응답으로
  // 반환됐다(첨부 다운로드가 빈 파일로 끝나던 원인).
  private async sendFollowingRedirects(
    initial: PreparedRequest,
    presentation: CredentialPresentation,
    secret: string,
    allowedOrigin: string,
    options: SendOptions,
    signal?: AbortSignal
  ): Promise<AuthenticatedFetchResponse> {
    let request = initial
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
      const response = await this.sender.send(request, signal, options)
      // 3xx 판정·상대 Location 절대화는 `net-response` 의 정본 한 벌을 쓴다 — credential 이
      // 나갈 다음 홉을 정하는 규칙이라 두 벌이면 갈린다.
      const next = locationOf(response, request.url)
      if (next === null) {
        // Location 이 있는데 절대화에 실패한 3xx 는 "다음 홉 없음" 이 아니라 **깨진 리다이렉트**다.
        // 응답으로 돌려주면 호출자가 빈 3xx 를 정상 응답으로 오독한다.
        if (redirectLocationOf(response) !== null) {
          throw new Error('인증 정책 거부: invalid_redirect')
        }
        return response
      }

      const verdict = checkRedirect(next, [allowedOrigin])
      if (!verdict.ok) throw policyError(verdict)

      // 303 과 "GET 이 아닌 요청의 301/302" 는 GET 으로 낮추는 것이 HTTP 규약이다.
      const method = downgradeMethod(response.status, request.method)
      request = applyPresentation(
        {
          url: next,
          method,
          headers: { ...initial.headers },
          ...(method === initial.method && initial.body !== undefined ? { body: initial.body } : {})
        },
        presentation,
        secret
      )
    }
    throw new Error(`인증 정책 거부: too_many_redirects (${MAX_REDIRECT_HOPS} 홉 초과)`)
  }

  // MCP `${BINDING:<id>}` 해석용. **요구명세 §소비자 경계의 문서화된 예외** — claude CLI 가
  // MCP 서버를 spawn 하므로 값이 broker 밖으로 나간다. 대신 소유권은 binding 으로 일원화된다
  // (회전·만료·logout 이 한 곳에서 일관).
  resolveBindingCredential(bindingId: string): string | null {
    const binding = this.bindings.get(bindingId)
    if (!binding || binding.status !== 'valid') return null
    // **SSO 로그인은 MCP 에 쓰이지 않는다** (사용자 결정 2026-08-06, 0178).
    //
    // 기술적으로 불가능해서가 아니다 — 사내 창구에서 토큰을 받아 넘기는 길은 있었다. 다만 그
    // 토큰은 MCP 서버가 **뜨는 순간 고정되는 사진 한 장**이라(설정 파일에 값으로 박힌다) 대화
    // 도중 낡으면 그 도구만 조용히 거절당한다. 그 만료를 쫓는 장치(사전 발급·캐시·재렌더 트리거)
    // 를 들이는 대신 **지원하지 않는 것**으로 정했다. MCP 에 붙이려면 PAT·ID/비밀번호를 쓴다.
    //
    // 여기서 null 을 돌려주면 그 서버는 `dropped` 사유와 함께 배포에서 빠진다 — 조용히
    // 사라지지 않는다(`features/extensions/mcp/convert.ts`).
    if (binding.artifact.kind === 'browser_session') {
      this.log().warn('auth.binding.not-exportable', {
        bindingId,
        reason: 'sso_not_supported_for_mcp'
      })
      return null
    }
    return this.readBindingSecret(binding)
  }

  private readBindingSecret(binding: AuthBindingInfo): string | null {
    const vault = this.deps.vaultFor(authBindingPrefix(binding.id))
    const read = vault.read(BINDING_SECRET_NAME)
    if (read.state === 'found') return read.value
    // 복호화 실패는 부재와 구분해 기록하고 binding 을 unknown 으로 낮춘다 — 조용한 미인증
    // 진행을 막는다(요구명세 §미비 보완 3).
    if (read.state === 'undecryptable') {
      this.log().warn('auth.credential.undecryptable', { bindingId: binding.id })
      this.bindings.setStatus(binding.id, 'unknown')
      this.publish()
    }
    return null
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private async applyStep(
    provider: AuthProviderV1,
    tx: Transaction,
    step: AuthStep
  ): Promise<AuthStepInfo> {
    if (step.kind === 'done') return this.stageAndAdvance(provider, tx, step.binding)

    if (step.kind === 'failed' || step.kind === 'not_supported') {
      // 멤버 하나의 실패는 **로그인 전체의 실패**다 (0172). 이미 성공한 멤버의 자원을 먼저
      // 되돌리고, 실패한 멤버가 남긴 것도 지운다.
      await this.rollbackChain(tx)
      this.deps.vaultFor(txPrefix(provider, tx)).clearAll()
      this.transactions.finish(tx.id)
      const info: AuthStepInfo =
        step.kind === 'not_supported'
          ? { kind: 'failed', reason: 'policy_denied', message: 'not_supported' }
          : {
              kind: 'failed',
              reason: step.reason,
              ...(step.message !== undefined ? { message: step.message } : {})
            }
      this.settleApplicationGate(tx.target, info.kind === 'failed' ? (info.message ?? null) : null)
      this.publish()
      return info
    }

    const chain = this.chainProgress(provider, tx)
    const info: AuthStepInfo =
      step.kind === 'collect'
        ? {
            kind: 'collect',
            transactionId: tx.id,
            fields: [...step.fields],
            ...(step.message !== undefined ? { message: step.message } : {}),
            ...(chain !== undefined ? { chain } : {})
          }
        : {
            kind: 'browser',
            transactionId: tx.id,
            ...(step.message !== undefined ? { message: step.message } : {}),
            ...(chain !== undefined ? { chain } : {})
          }
    if (tx.target.kind === 'application') {
      this.state.step = info
      this.publish()
    }
    return info
  }

  // ── 로그인 체인 (0172) ─────────────────────────────────────────────────────

  // 멤버가 성공했다. **커밋하지 않고 보류**한 뒤 다음 멤버로 넘어가고, 마지막이면 한 번에
  // 커밋한다. 중간 멤버의 `done` 은 renderer 로 나가지 않는다 — 나가면 로그인 화면이
  // 완료로 판단하고 앱으로 진입해버린다.
  private async stageAndAdvance(
    provider: AuthProviderV1,
    tx: Transaction,
    draft: AuthBindingDraft
  ): Promise<AuthStepInfo> {
    const parentBindingId = draft.parentBindingId
    if (parentBindingId !== undefined && !this.bindings.get(parentBindingId)) {
      await this.rollbackChain(tx)
      this.deps.vaultFor(txPrefix(provider, tx)).clearAll()
      this.transactions.finish(tx.id)
      return this.fail(tx.target, 'policy_denied', 'parent binding is no longer valid')
    }

    const chain = tx.chain
    const staged: StagedBinding = {
      providerId: provider.descriptor.id,
      pluginId: provider.descriptor.pluginId,
      draft
    }
    if (!chain) return this.commitChain(tx, [staged])
    chain.staged.push(staged)

    const next = this.memberAt(chain, chain.index + 1)
    if (!next) return this.commitChain(tx, chain.staged)

    this.transactions.advance(
      tx.id,
      next.descriptor.id,
      next.descriptor.pluginId,
      next.descriptor.loginTimeoutMs
    )
    const ctx = this.buildContext(next, tx, {})
    const step = await runGuarded<AuthStep>(
      tx.controller.signal,
      () => next.begin(ctx),
      (err) => this.toFailedStep(next, err)
    )
    return this.applyStep(next, tx, step)
  }

  // 전 멤버가 성공했다. binding 을 **한 번에** 만들고(첫 멤버 = root) 멤버별 secret 을 각자의
  // binding 네임스페이스로 옮긴다. 축출된 이전 로그인의 secret 도 여기서 지운다.
  private commitChain(tx: Transaction, staged: readonly StagedBinding[]): AuthStepInfo {
    const { created, evicted } = this.bindings.createMany(
      staged.map((member) => ({
        pluginId: member.pluginId,
        providerId: member.providerId,
        target: tx.target,
        mechanism: member.draft.mechanism,
        artifact: member.draft.artifact,
        ...(member.draft.principal !== undefined ? { principal: member.draft.principal } : {}),
        ...(member.draft.parentBindingId !== undefined
          ? { parentBindingId: member.draft.parentBindingId }
          : {}),
        ...(member.draft.expiresAt !== undefined ? { expiresAt: member.draft.expiresAt } : {})
      }))
    )
    for (const victim of evicted) {
      this.deps.vaultFor(authBindingPrefix(victim.id)).clearAll()
    }
    created.forEach((binding, index) => {
      const member = staged[index]
      this.adoptSecret(member.pluginId, member.providerId, tx.id, binding.id)
    })
    this.transactions.finish(tx.id)
    this.settleApplicationGate(tx.target, null)
    this.publish()
    return { kind: 'done', binding: created[0] }
  }

  // 보류분을 **역순**으로 되돌린다. provider 에게 자기 자원(브라우저 세션 등)을 정리할 기회를
  // 주고, provider 가 무엇을 하든 우리 소유 vault 는 우리가 지운다.
  private async rollbackChain(tx: Transaction): Promise<void> {
    const chain = tx.chain
    if (!chain || chain.staged.length === 0) return
    // 먼저 비운다 — 실패 경로와 취소 콜백이 겹쳐도 두 번 정리하지 않는다.
    const staged = chain.staged.splice(0, chain.staged.length)

    for (const member of [...staged].reverse()) {
      const provider = this.deps.registry.getProvider(member.providerId)
      if (provider) {
        // **새 controller 를 쓴다.** tx signal 은 타임아웃·취소로 이미 abort 됐을 수 있고,
        // `runGuarded` 는 aborted signal 이면 provider 를 아예 부르지 않는다 — 그러면 정리가
        // 필요한 바로 그 상황에서 정리가 건너뛰어진다.
        const controller = new AbortController()
        const prefix = txPrefixOf(member.pluginId, member.providerId, tx.id)
        const ctx = this.makeContext(provider, tx.target, {}, controller.signal, prefix, new Map())
        const result = await runGuarded(
          controller.signal,
          () => provider.logout(ctx, stagedRef(tx, member)),
          (err) => ({ kind: 'failed' as const, message: String(err) })
        )
        if (result.kind === 'failed') {
          this.log().warn('auth.chain.rollback.failed', {
            providerId: member.providerId,
            ...(result.message !== undefined ? { message: result.message } : {})
          })
        }
      }
      this.deps.vaultFor(txPrefixOf(member.pluginId, member.providerId, tx.id)).clearAll()
    }
  }

  private memberAt(chain: ChainState, index: number): AuthProviderV1 | undefined {
    const providerId = chain.members[index]
    return providerId !== undefined ? this.deps.registry.getProvider(providerId) : undefined
  }

  // 체인이 아닌(멤버 1개) 로그인의 step 에는 진행 정보를 싣지 않는다 — 1/1 표기는 잡음이다.
  private chainProgress(
    provider: AuthProviderV1,
    tx: Transaction
  ): { index: number; total: number; label: string } | undefined {
    const chain = tx.chain
    if (!chain || chain.members.length < 2) return undefined
    return {
      index: chain.index + 1,
      total: chain.members.length,
      label: provider.descriptor.label
    }
  }

  // provider 는 transaction 동안 자기 네임스페이스에 값을 넣는다. binding 이 생기면
  // binding 네임스페이스로 이관해 logout 시 한 번에 지워지게 한다.
  private adoptSecret(pluginId: string, providerId: string, txId: string, bindingId: string): void {
    const txVault = this.deps.vaultFor(txPrefixOf(pluginId, providerId, txId))
    const read = txVault.read(BINDING_SECRET_NAME)
    if (read.state !== 'found') return
    const meta = txVault.describe(BINDING_SECRET_NAME)
    if (!meta) return
    this.deps.vaultFor(authBindingPrefix(bindingId)).set(BINDING_SECRET_NAME, read.value, meta)
    txVault.clearAll()
  }

  private buildContext(
    provider: AuthProviderV1,
    tx: Transaction,
    input: Record<string, string>
  ): AuthPluginContext {
    return this.makeContext(
      provider,
      tx.target,
      input,
      tx.controller.signal,
      txPrefix(provider, tx),
      tx.scratch
    )
  }

  private buildContextForBinding(
    provider: AuthProviderV1,
    binding: AuthBindingInfo,
    signal: AbortSignal
  ): AuthPluginContext {
    return this.makeContext(
      provider,
      binding.target,
      {},
      signal,
      authBindingPrefix(binding.id),
      new Map()
    )
  }

  private makeContext(
    provider: AuthProviderV1,
    target: AuthTarget,
    input: Record<string, string>,
    signal: AbortSignal,
    vaultPrefix: string,
    scratch: Map<string, unknown>
  ): AuthPluginContext {
    const allowedOrigins = provider.descriptor.allowedOrigins
    const envAllowlist = this.deps.envAllowlist ?? []
    return {
      target,
      input,
      signal,
      vault: this.deps.vaultFor(vaultPrefix),
      browserSessions: this.deps.browserSessions,
      // 선언한 origin 밖으로는 못 나간다 — provider 오설정을 런타임에 조용히 새게 두지 않는다.
      // 전송은 주입된 구현(프로덕션 = Chromium `net.fetch`, 0173)이 하고, **검사는 그 앞에**
      // 그대로 남는다 — 스택을 바꿔도 allowlist 강제 지점은 옮겨가지 않는다.
      fetch: async (url, init) => {
        if (!isAllowedOrigin(url, allowedOrigins)) {
          throw new Error('provider manifest 에 선언되지 않은 origin 입니다')
        }
        return this.deps.fetchImpl(url, { ...init, redirect: 'manual', signal })
      },
      store: { get: (k) => scratch.get(k), set: (k, v) => scratch.set(k, v) },
      // process.env 전체가 아니라 allowlist 만.
      env: (name) => (envAllowlist.includes(name) ? process.env[name] : undefined),
      logger: (message, meta) =>
        this.log().warn('auth.provider.message', {
          providerId: provider.descriptor.id,
          message,
          ...(meta !== undefined ? { meta } : {})
        }),
      clock: this.clock
    }
  }

  private toFailedStep(provider: AuthProviderV1, err: unknown): AuthStep {
    this.log().warn('auth.provider.threw', {
      providerId: provider.descriptor.id,
      message: String(err)
    })
    return { kind: 'failed', reason: 'internal' }
  }

  // application 로그인 게이트를 닫는다 — inflight·step 을 내리고 오류 문구를 확정한다.
  // connector 대상 트랜잭션은 게이트를 건드리지 않으므로 `false` 를 돌려준다(호출자가 publish 여부
  // 를 정한다 — 게이트를 안 건드려도 publish 하는 자리가 있다).
  // `errorMessage` 를 생략하면 기존 문구를 **보존**한다(취소 경로가 timeout 만 덮어쓰는 이유).
  private settleApplicationGate(target: AuthTarget, errorMessage?: string | null): boolean {
    if (target.kind !== 'application') return false
    this.state.inflight = false
    this.state.step = null
    if (errorMessage !== undefined) this.state.errorMessage = errorMessage
    return true
  }

  private fail(target: AuthTarget, reason: AuthFailureReason, message: string): AuthStepInfo {
    if (this.settleApplicationGate(target, message)) this.publish()
    return { kind: 'failed', reason, message }
  }

  shutdown(): void {
    this.transactions.cancelAll('shutdown')
  }
}

// transaction 네임스페이스는 **멤버별**이다 — `(pluginId, providerId, txId)` 세 값이 다 들어가야
// 한 체인의 두 멤버가 서로의 보류 secret 을 덮어쓰지 않는다.
function txPrefixOf(pluginId: string, providerId: string, txId: string): string {
  return `${authProviderPrefix(pluginId, providerId)}tx:${txId}:`
}

function txPrefix(provider: AuthProviderV1, tx: Transaction): string {
  return txPrefixOf(provider.descriptor.pluginId, provider.descriptor.id, tx.id)
}

// 보류분 정리에 넘기는 참조. 아직 binding 이 아니므로 id 는 합성값이다 — logout 구현 3종
// (static·basic·adfs)이 `binding.id` 를 쓰지 않고 `artifact`·`target` 만 보는 것을 확인했다.
function stagedRef(tx: Transaction, member: StagedBinding): AuthBindingRef {
  return {
    id: `staged:${tx.id}:${member.providerId}`,
    target: tx.target,
    mechanism: member.draft.mechanism,
    artifact: member.draft.artifact,
    ...(member.draft.expiresAt !== undefined ? { expiresAt: member.draft.expiresAt } : {})
  }
}

function toRef(binding: AuthBindingInfo): AuthBindingRef {
  return {
    id: binding.id,
    target: binding.target,
    mechanism: binding.mechanism,
    artifact: binding.artifact,
    ...(binding.expiresAt !== undefined ? { expiresAt: binding.expiresAt } : {})
  }
}

export function joinUrl(baseUrl: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  return url.toString()
}

function policyError(verdict: PolicyResult & { ok: false }): Error {
  return new Error(`인증 정책 거부: ${verdict.reason} (${verdict.detail})`)
}

function downgradeMethod(status: number, method: string): string {
  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD') return method
  // 303 은 항상, 301/302 는 관례상 GET 으로 낮춘다. 307/308 은 메서드·본문을 보존한다.
  return status === 303 || status === 301 || status === 302 ? 'GET' : method
}

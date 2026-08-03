// 인증 broker (0157) — registry · transactions · bindings · policy · vault · session store 를
// 조립하는 **유일한 credential 소비 지점**.
//
// 여기 밖에서는 아무도 raw secret 을 만지지 않는다. connector 는 bindingId 로 위임하고
// (`authenticatedFetch`), renderer 는 DTO 만 받는다. MCP 만 예외로 값을 받아가는데, 그것은
// claude CLI 가 서버를 spawn 하는 구조 때문이며 요구명세 §소비자 경계 의 문서화된 잔여 노출이다.

import type {
  AuthBindingInfo,
  AuthFailureReason,
  AuthLogoutOutcome,
  AuthPlatformState,
  AuthRefreshOutcome,
  AuthStepInfo,
  AuthTarget
} from '../../../shared/ipc'
import type {
  AuthBindingRef,
  AuthExec,
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
  type PreparedRequest
} from '../../infra/auth/authenticated-fetch'
import {
  authBindingPrefix,
  authProviderPrefix,
  type CredentialVault
} from '../../infra/auth/credential-vault'
import { getLogger } from '../../infra/log/registry'
import { BindingStore } from './bindings'
import { checkOutboundRequest, type PolicyResult } from './policy'
import type { AuthRegistry } from './registry'
import { runGuarded, TransactionStore, type Transaction } from './transactions'

// binding 이 봉인한 credential 의 vault 키. provider 는 이 이름으로 값을 넣고 broker 가 읽는다.
export const BINDING_SECRET_NAME = 'secret'

export interface BrokerDeps {
  registry: AuthRegistry
  // 네임스페이스별 vault 팩토리 — broker 는 raw SecretStore 를 보지 않는다.
  vaultFor: (prefix: string) => CredentialVault
  browserSessions: BrowserSessionCapability
  exec: AuthExec
  broadcast: (state: AuthPlatformState) => void
  // binding 제거 뒤 connector/runtime server를 정리하는 composition callback. auth-platform은
  // PluginHost 구현을 import하지 않고 구조적 포트만 받는다.
  onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
  // provider 에게 노출할 env 이름 allowlist. 기본 빈 배열 = 아무것도 노출 안 함.
  envAllowlist?: readonly string[]
  sender?: AuthenticatedFetchDeps
  clock?: () => number
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
    this.bindings = new BindingStore(this.clock)
    this.sender = deps.sender ?? createSender()
    this.transactions = new TransactionStore(this.clock, (tx, reason) => {
      // 취소를 조용히 넘기지 않는다 — application transaction 이면 게이트 상태에 반영한다.
      this.log().info('auth.transaction.cancelled', { providerId: tx.providerId, reason })
      if (tx.target.kind === 'application') {
        this.state.inflight = false
        this.state.step = null
        if (reason === 'timeout') this.state.errorMessage = 'timeout'
        this.publish()
      }
    })
  }

  private log(): ReturnType<ReturnType<typeof getLogger>['child']> {
    return getLogger().child('auth')
  }

  // ── 상태 ───────────────────────────────────────────────────────────────────

  status(): AuthPlatformState {
    const appBinding = this.bindings.findApplicationBinding()
    return {
      // application target 을 지원하는 provider 가 하나라도 있어야 게이트가 의미를 갖는다.
      required: this.deps.registry.providersForTarget('application').length > 0,
      authenticated: appBinding?.status === 'valid',
      inflight: this.state.inflight,
      identity: appBinding?.principal ?? null,
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

    const tx = this.transactions.begin({
      providerId,
      pluginId: provider.descriptor.pluginId,
      target,
      ...(provider.descriptor.loginTimeoutMs !== undefined
        ? { timeoutMs: provider.descriptor.loginTimeoutMs }
        : {})
    })
    if (target.kind === 'application') {
      this.state.inflight = true
      this.state.errorMessage = null
      this.publish()
    }

    const ctx = this.buildContext(provider, tx, {})
    const step = await runGuarded<AuthStep>(
      tx.controller.signal,
      () => provider.begin(ctx),
      (err) => this.toFailedStep(provider, err)
    )
    return this.applyStep(provider, tx, step)
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

  async refreshBinding(bindingId: string): Promise<AuthRefreshOutcome> {
    const binding = this.bindings.get(bindingId)
    if (!binding) return { kind: 'failed', message: '알 수 없는 binding' }
    const provider = this.deps.registry.getProvider(binding.providerId)
    if (!provider) return { kind: 'failed', message: '알 수 없는 provider' }

    const controller = new AbortController()
    const ctx = this.buildContextForBinding(provider, binding, controller.signal)
    const result = await runGuarded(
      controller.signal,
      () => provider.refresh(ctx, toRef(binding)),
      (err) => ({ kind: 'failed' as const, message: String(err) })
    )

    if (result.kind === 'refreshed') {
      const next = this.bindings.patch(bindingId, {
        status: 'valid',
        ...(result.expiresAt !== undefined ? { expiresAt: result.expiresAt } : {}),
        ...(result.principal !== undefined ? { principal: result.principal } : {})
      })
      this.publish()
      return next
        ? { kind: 'refreshed', binding: next }
        : { kind: 'failed', message: 'binding 소실' }
    }
    if (result.kind === 'reauth_required') {
      this.bindings.setStatus(bindingId, 'expired')
      this.publish()
      return result.message !== undefined
        ? { kind: 'reauth_required', message: result.message }
        : { kind: 'reauth_required' }
    }
    return result.kind === 'not_supported'
      ? { kind: 'not_supported' }
      : { kind: 'failed', ...(result.message !== undefined ? { message: result.message } : {}) }
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
    const prepared = applyPresentation(base, connector.descriptor.presentation, secret)
    return this.sender.send(prepared, signal)
  }

  // MCP `${BINDING:<id>}` 해석용. **요구명세 §소비자 경계의 문서화된 예외** — claude CLI 가
  // MCP 서버를 spawn 하므로 값이 broker 밖으로 나간다. 대신 소유권은 binding 으로 일원화된다
  // (회전·만료·logout 이 한 곳에서 일관).
  resolveBindingCredential(bindingId: string): string | null {
    const binding = this.bindings.get(bindingId)
    if (!binding || binding.status !== 'valid') return null
    // browser session 은 값이 아니라 cookie jar 라 MCP 로 전달할 수 없다.
    if (binding.artifact.kind === 'browser_session') return null
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

  private applyStep(provider: AuthProviderV1, tx: Transaction, step: AuthStep): AuthStepInfo {
    if (step.kind === 'done') {
      const parentBindingId = step.binding.parentBindingId
      if (parentBindingId !== undefined && !this.bindings.get(parentBindingId)) {
        this.deps.vaultFor(txPrefix(provider, tx)).clearAll()
        this.transactions.finish(tx.id)
        return this.fail(tx.target, 'policy_denied', 'parent binding is no longer valid')
      }
      const binding = this.bindings.create({
        pluginId: provider.descriptor.pluginId,
        providerId: provider.descriptor.id,
        target: tx.target,
        mechanism: step.binding.mechanism,
        artifact: step.binding.artifact,
        ...(step.binding.principal !== undefined ? { principal: step.binding.principal } : {}),
        ...(step.binding.parentBindingId !== undefined
          ? { parentBindingId: step.binding.parentBindingId }
          : {}),
        ...(step.binding.expiresAt !== undefined ? { expiresAt: step.binding.expiresAt } : {})
      })
      // provider 가 transaction 네임스페이스에 봉인한 secret 을 binding 네임스페이스로 옮긴다.
      this.adoptTransactionSecret(provider, tx, binding.id)
      this.transactions.finish(tx.id)
      if (tx.target.kind === 'application') {
        this.state.inflight = false
        this.state.errorMessage = null
        this.state.step = null
      }
      this.publish()
      return { kind: 'done', binding }
    }

    if (step.kind === 'failed' || step.kind === 'not_supported') {
      this.transactions.finish(tx.id)
      const info: AuthStepInfo =
        step.kind === 'not_supported'
          ? { kind: 'failed', reason: 'policy_denied', message: 'not_supported' }
          : {
              kind: 'failed',
              reason: step.reason,
              ...(step.message !== undefined ? { message: step.message } : {})
            }
      if (tx.target.kind === 'application') {
        this.state.inflight = false
        this.state.errorMessage = info.kind === 'failed' ? (info.message ?? null) : null
        this.state.step = null
      }
      this.publish()
      return info
    }

    const info: AuthStepInfo =
      step.kind === 'collect'
        ? {
            kind: 'collect',
            transactionId: tx.id,
            fields: [...step.fields],
            ...(step.message !== undefined ? { message: step.message } : {})
          }
        : step.kind === 'browser'
          ? {
              kind: 'browser',
              transactionId: tx.id,
              ...(step.message !== undefined ? { message: step.message } : {})
            }
          : {
              kind: 'device_code',
              transactionId: tx.id,
              userCode: step.userCode,
              verificationUrl: step.verificationUrl,
              ...(step.expiresAt !== undefined ? { expiresAt: step.expiresAt } : {}),
              ...(step.message !== undefined ? { message: step.message } : {})
            }
    if (tx.target.kind === 'application') {
      this.state.step = info
      this.publish()
    }
    return info
  }

  // provider 는 transaction 동안 자기 네임스페이스에 값을 넣는다. binding 이 생기면
  // binding 네임스페이스로 이관해 logout 시 한 번에 지워지게 한다.
  private adoptTransactionSecret(
    provider: AuthProviderV1,
    tx: Transaction,
    bindingId: string
  ): void {
    const txVault = this.deps.vaultFor(txPrefix(provider, tx))
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
      fetch: async (url, init) => {
        if (!allowedOrigins.includes(safeOrigin(url))) {
          throw new Error('provider manifest 에 선언되지 않은 origin 입니다')
        }
        return fetch(url, { ...init, redirect: 'manual', signal })
      },
      exec: this.deps.exec,
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

  private fail(target: AuthTarget, reason: AuthFailureReason, message: string): AuthStepInfo {
    if (target.kind === 'application') {
      this.state.inflight = false
      this.state.errorMessage = message
      this.state.step = null
      this.publish()
    }
    return { kind: 'failed', reason, message }
  }

  shutdown(): void {
    this.transactions.cancelAll('shutdown')
  }
}

function txPrefix(provider: AuthProviderV1, tx: Transaction): string {
  return `${authProviderPrefix(provider.descriptor.pluginId, provider.descriptor.id)}tx:${tx.id}:`
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

function safeOrigin(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin
  } catch {
    return ''
  }
}

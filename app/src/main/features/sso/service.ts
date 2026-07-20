// SSO 로그인 게이트의 main 측 상태 SSOT (0130). 등록된 SsoProviderModule(없으면 null)을
// 실행하고 SsoState 를 renderer 로 브로드캐스트한다. 프레임워크는 회사/provider 분기를
// 갖지 않는다 — 모듈 내부(체인·인증 방식)는 전부 모듈 소유(contracts/sso.ts 참조).

import type { SsoIdentity, SsoState } from '../../../shared/ipc'
import type { SsoContext, SsoLoginOutcome, SsoProviderModule } from '../../contracts/sso'
import {
  createNamespacedSecretFacade,
  providerSecretPrefix,
  type SecretStorePort
} from '../../infra/config/secret-facade'
import { getLogger } from '../../infra/log/registry'

const DEFAULT_LOGIN_TIMEOUT_MS = 300_000

interface ServiceDeps {
  module: SsoProviderModule | null
  secretStore: SecretStorePort
  // 획득 토큰 → provider settings.json env 병합 기록. providerSettings 가 부팅 후반에
  // 생성되므로 컴포지션 루트가 lazy thunk 로 주입한다.
  writeProviderEnv: (adapter: string, provider: string, env: Record<string, string>) => void
  broadcastState: (state: SsoState) => void
  // exec/openAuthWindow 는 electron/child_process 의존이라 컴포지션 루트가 주입한다
  // (service 는 electron-free — 순수 vitest 대상).
  exec: SsoContext['exec']
  openAuthWindow: SsoContext['openAuthWindow']
  fetchImpl?: typeof fetch
  env?: Record<string, string>
  clock?: () => number
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

interface MutableState {
  authenticated: boolean
  inflight: boolean
  identity: SsoIdentity | null
  errorMessage: string | null
}

export class SsoService {
  private readonly state: MutableState = {
    authenticated: false,
    inflight: false,
    identity: null,
    errorMessage: null
  }
  private readonly store = new Map<string, unknown>()
  private readonly fetchImpl: typeof fetch
  private readonly clock: () => number
  private readonly logger: (message: string, meta?: Record<string, unknown>) => void

  constructor(private readonly deps: ServiceDeps) {
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.clock = deps.clock ?? Date.now
    this.logger =
      deps.logger ??
      ((message, meta) =>
        getLogger()
          .child('sso')
          .warn('sso.warning', { message, ...(meta !== undefined ? { meta } : {}) }))
  }

  status(): SsoState {
    return {
      required: this.deps.module != null,
      authenticated: this.state.authenticated,
      inflight: this.state.inflight,
      identity: this.state.identity,
      errorMessage: this.state.errorMessage,
      fields: [...(this.deps.module?.fields ?? [])]
    }
  }

  // 로그인 시도. 모듈 미등록이면 no-op(현재 상태 반환), inflight 중복 호출은 무시된다.
  async login(input: Record<string, string>): Promise<SsoState> {
    const module = this.deps.module
    if (!module || this.state.inflight) return this.status()
    this.patch({ inflight: true, errorMessage: null })
    const outcome = await this.run(module, (ctx) => module.login(ctx), input)
    this.applyOutcome(outcome)
    return this.status()
  }

  // 부팅 시 silent 세션 복원. 실패해도 조용히 미인증 유지 — 부트를 막지 않는다.
  async restore(): Promise<void> {
    const module = this.deps.module
    if (!module?.restore) return
    const restore = module.restore.bind(module)
    const outcome = await this.run(module, (ctx) => restore(ctx), {})
    if (outcome?.ok) this.applyOutcome(outcome)
  }

  private applyOutcome(outcome: SsoLoginOutcome | null): void {
    if (outcome?.ok) {
      this.patch({
        authenticated: true,
        inflight: false,
        identity: outcome.identity ?? null,
        errorMessage: null
      })
    } else {
      this.patch({
        authenticated: false,
        inflight: false,
        identity: null,
        errorMessage: outcome?.message ?? null
      })
    }
  }

  // 타임아웃(AbortController) + throw 격리 공용 실행기. 모듈이 signal 을 무시해도
  // race 가 타임아웃 시점에 { ok:false } 로 수렴시킨다.
  private async run(
    module: SsoProviderModule,
    fn: (ctx: SsoContext) => Promise<SsoLoginOutcome | null>,
    input: Record<string, string>
  ): Promise<SsoLoginOutcome | null> {
    const controller = new AbortController()
    const timeoutMs = module.loginTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('sso timeout')), {
        once: true
      })
    })
    try {
      return await Promise.race([fn(this.buildContext(module, input, controller.signal)), timedOut])
    } catch (err) {
      this.logger('sso module threw — treated as failure', { key: module.key, err: String(err) })
      return { ok: false }
    } finally {
      clearTimeout(timer)
    }
  }

  private buildContext(
    module: SsoProviderModule,
    input: Record<string, string>,
    signal: AbortSignal
  ): SsoContext {
    return {
      fetch: this.fetchImpl,
      signal,
      input,
      secret: createNamespacedSecretFacade(this.deps.secretStore, `sso:${module.key}:`),
      providerSecrets: (providerKey) =>
        createNamespacedSecretFacade(this.deps.secretStore, providerSecretPrefix(providerKey)),
      setProviderEnv: (adapter, provider, env) =>
        this.deps.writeProviderEnv(adapter, provider, env),
      exec: this.deps.exec,
      openAuthWindow: this.deps.openAuthWindow,
      env: this.deps.env ?? (process.env as Record<string, string>),
      store: { get: (key) => this.store.get(key), set: (key, value) => this.store.set(key, value) },
      logger: this.logger,
      clock: this.clock
    }
  }

  private patch(partial: Partial<MutableState>): void {
    Object.assign(this.state, partial)
    this.deps.broadcastState(this.status())
  }
}

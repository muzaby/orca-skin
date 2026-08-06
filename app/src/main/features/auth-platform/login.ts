// 로그인 lifecycle (0178) — 구 broker 785줄에서 **인증하는 부분**만 떼어냈다.
//
// 여기가 아는 것: 인증 방식을 부르는 법, 재진입(입력 수집)을 잇는 법, 체인을 원자적으로 커밋·
// 롤백하는 법, 앱 로그인 게이트 상태. 여기가 모르는 것: 요청을 보내는 법(`api.ts`).
//
// 인증 방식 계약은 함수 셋이고, `begin`/`continue` 두 IPC 는 **같은 `authenticate` 한 함수**로
// 들어간다 — 차이는 `ctx.input` 이 비었는지뿐이다.

import type {
  AuthBindingInfo,
  AuthFailureReason,
  AuthLogoutOutcome,
  AuthPlatformState,
  AuthStepInfo,
  AuthTarget
} from '../../../shared/ipc'
import type {
  AuthContext,
  AuthMethod,
  AuthOutcome,
  AuthRecordDraft,
  AuthRecordRef,
  BrowserSessionCapability
} from '../../contracts/auth-method'
import {
  authBindingPrefix,
  authMethodPrefix,
  type CredentialVault
} from '../../infra/auth/credential-vault'
import type { BindingStore } from './bindings'
import { isAllowedOrigin } from '../../infra/auth/session-policy'
import type { AuthRegistry } from './registry'
import {
  runGuarded,
  TransactionStore,
  type ChainState,
  type StagedBinding,
  type Transaction
} from './transactions'

export interface AuthLoginDeps {
  registry: AuthRegistry
  bindings: BindingStore
  // 네임스페이스별 vault 팩토리 — 로그인은 raw SecretStore 를 보지 않는다.
  vaultFor: (prefix: string) => CredentialVault
  browserSessions: BrowserSessionCapability
  // 원격 전송자 (0173) — 인증 방식의 `ctx.fetch` 가 이것으로 나간다. **기본값 없음**: 기본값은
  // 곧 조용한 Node 스택 복귀이고, 그러면 사내 프록시·사설 CA 를 못 탄다.
  fetchImpl: typeof fetch
  publish: () => void
  // 레코드가 끝난 뒤 연결을 정리하는 컴포지션 콜백.
  onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
  clock: () => number
  logger: (event: string, meta?: Record<string, unknown>) => void
}

interface GateState {
  inflight: boolean
  errorMessage: string | null
  step: AuthStepInfo | null
}

export class AuthLogin {
  private readonly transactions: TransactionStore
  private readonly gate: GateState = { inflight: false, errorMessage: null, step: null }

  constructor(private readonly deps: AuthLoginDeps) {
    this.transactions = new TransactionStore(deps.clock, (tx, reason) => {
      // 취소를 조용히 넘기지 않는다 — 앱 로그인 transaction 이면 게이트 상태에 반영한다.
      this.deps.logger('auth.transaction.cancelled', { methodId: tx.providerId, reason })
      if (this.settleGate(tx.target, reason === 'timeout' ? 'timeout' : undefined)) {
        this.deps.publish()
      }
      // 타임아웃·재진입·종료로 끊긴 체인의 보류분도 정리한다 (0172). 정리는 비동기라 취소 통지
      // 자체는 막지 않고, 끝난 뒤 상태만 다시 알린다.
      if (tx.chain !== undefined && tx.chain.staged.length > 0) {
        void this.rollbackChain(tx).then(() => this.deps.publish())
      }
    })
  }

  // ── 상태 ───────────────────────────────────────────────────────────────────

  status(): AuthPlatformState {
    const appBindings = this.deps.bindings.applicationBindings()
    const root = this.deps.bindings.findApplicationBinding()
    return {
      // application 대상을 지원하는 방식이 하나라도 있어야 게이트가 의미를 갖는다.
      required: this.deps.registry.methodsForTarget('application').length > 0,
      // 체인은 **전 멤버가 유효해야** 인증이다 (0172). 멤버가 1개면 기존 판정과 동치다.
      authenticated: appBindings.length > 0 && appBindings.every((b) => b.status === 'valid'),
      inflight: this.gate.inflight,
      // 신원은 root 우선. root 가 principal 을 안 주면 그것을 준 첫 멤버를 쓴다.
      identity: root?.principal ?? appBindings.find((b) => b.principal)?.principal ?? null,
      errorMessage: this.gate.errorMessage,
      step: this.gate.step,
      providers: this.deps.registry.describeMethods()
    }
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  async begin(methodId: string, target: AuthTarget): Promise<AuthStepInfo> {
    const method = this.deps.registry.getMethod(methodId)
    if (!method) return this.fail(target, 'internal', `알 수 없는 인증 방식: ${methodId}`)
    if (!method.descriptor.targets.includes(target.kind)) {
      return this.fail(target, 'policy_denied', `이 방식은 ${target.kind} 대상을 지원하지 않습니다`)
    }

    // 앱 로그인은 **그룹 단위 체인**이다 (0172) — 같은 그룹이 선언한 application 방식들이 하나의
    // 논리 로그인이다. 어느 멤버로 시작하든 체인의 **헤드부터** 간다: 중간부터 시작하면 "전부
    // 성공해야 인증" 이라는 불변식을 만족시킬 방법이 없다. 서비스 연결은 사용자가 방식 하나를
    // 고르는 흐름이라 체인을 타지 않는다.
    const members =
      target.kind === 'application' ? this.deps.registry.loginChainFor(methodId) : [method]
    const head = members[0] ?? method

    const tx = this.transactions.begin({
      providerId: head.descriptor.id,
      target,
      ...(head.descriptor.loginTimeoutMs !== undefined
        ? { timeoutMs: head.descriptor.loginTimeoutMs }
        : {}),
      chain: { members: members.map((m) => m.descriptor.id), index: 0, staged: [] }
    })
    if (target.kind === 'application') {
      this.gate.inflight = true
      this.gate.errorMessage = null
      this.deps.publish()
    }

    return this.runMethod(head, tx, {})
  }

  // 재진입 — 사용자가 채운 입력을 그대로 `authenticate` 에 다시 넣는다.
  async continue(transactionId: string, input: Record<string, string>): Promise<AuthStepInfo> {
    const tx = this.transactions.get(transactionId)
    if (!tx) {
      return { kind: 'failed', reason: 'cancelled', message: '만료되었거나 취소된 인증 요청입니다' }
    }
    const method = this.deps.registry.getMethod(tx.providerId)
    if (!method) return this.fail(tx.target, 'internal', '알 수 없는 인증 방식')
    return this.runMethod(method, tx, input)
  }

  // cascade=false 가 기본 — 대상 하나의 연결 해제가 공유 session group 을 통째로 날리지 않게
  // 하는 안전 기본값.
  async logout(bindingId: string, cascade: boolean): Promise<AuthLogoutOutcome> {
    const victims = this.deps.bindings.takeForRemoval(bindingId, cascade)
    if (victims.length === 0) return { kind: 'failed', message: '알 수 없는 레코드' }
    const removed = victims.map((victim) => victim.id)
    const failures: string[] = []

    for (const victim of victims) {
      const method = this.deps.registry.getMethod(victim.providerId)
      if (method) {
        const controller = new AbortController()
        const ctx = this.makeContext(
          method,
          victim.target,
          {},
          controller.signal,
          authBindingPrefix(victim.id)
        )
        const failure = await runGuarded(
          controller.signal,
          async () => {
            await method.revoke(ctx, toRef(victim))
            return null
          },
          (err) => String(err)
        )
        if (failure !== null) failures.push(failure)
      }
      // 방식이 뭘 하든 우리 소유 잔여물은 우리가 지운다.
      this.deps.vaultFor(authBindingPrefix(victim.id)).clearAll()
    }

    if (removed.length > 0 && this.deps.onBindingsEnded) {
      try {
        await this.deps.onBindingsEnded(removed)
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
    this.deps.publish()
    return failures.length > 0
      ? { kind: 'failed', message: failures.join('; ') }
      : { kind: 'logged_out', endedBindingIds: removed }
  }

  // ── 만료 판정 반영 (0178) ──────────────────────────────────────────────────

  // 방식에게 "이 레코드가 지금도 유효한가" 를 묻고 **그 답을 레코드에 반영한다.**
  //
  // 0178 이전에는 판정 경로가 있는데 반영 경로가 없었다 — 브라우저 세션 방식이 `expired` 를
  // 계산해 돌려줘도 아무도 `setStatus` 를 부르지 않아, 세션이 끊긴 뒤에도 화면은 "연결됨" 이었고
  // 실패는 첫 요청에서야 드러났다.
  async revalidate(bindingId: string): Promise<AuthBindingInfo['status'] | null> {
    const binding = this.deps.bindings.get(bindingId)
    if (!binding) return null
    const method = this.deps.registry.getMethod(binding.providerId)
    if (!method) return binding.status

    const controller = new AbortController()
    const ctx = this.makeContext(
      method,
      binding.target,
      {},
      controller.signal,
      authBindingPrefix(binding.id)
    )
    const status = await runGuarded(
      controller.signal,
      () => method.status(ctx, toRef(binding)),
      (err) => {
        // 판정 자체가 실패한 것은 "만료" 가 아니다 — 사내망 밖이면 probe 가 늘 던진다.
        // 단정하지 않고 unknown 으로 남긴다.
        this.deps.logger('auth.revalidate.failed', { bindingId, message: String(err) })
        return 'unknown' as const
      }
    )
    if (status === binding.status) return status
    this.deps.bindings.setStatus(bindingId, status)
    this.deps.logger('auth.binding.status-changed', { bindingId, from: binding.status, to: status })
    this.deps.publish()
    return status
  }

  // 모든 레코드를 한 번에 재확인한다. 부팅 복원 직후에 부른다 — 재시작 사이에 세션이 끊겼을 수
  // 있고, 그때 "연결됨" 으로 시작하면 첫 도구 호출이 이유 없이 실패한다.
  async revalidateAll(): Promise<void> {
    for (const binding of this.deps.bindings.list()) {
      await this.revalidate(binding.id)
    }
  }

  // 요청 경로가 발견한 사실(401·복호화 실패)을 레코드에 반영한다.
  applyStatus(bindingId: string, status: AuthBindingInfo['status']): void {
    const binding = this.deps.bindings.get(bindingId)
    if (!binding || binding.status === status) return
    this.deps.bindings.setStatus(bindingId, status)
    this.deps.publish()
  }

  shutdown(): void {
    this.transactions.cancelAll('shutdown')
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private async runMethod(
    method: AuthMethod,
    tx: Transaction,
    input: Record<string, string>
  ): Promise<AuthStepInfo> {
    const ctx = this.makeContext(
      method,
      tx.target,
      input,
      tx.controller.signal,
      txHandle(method, tx)
    )
    const outcome = await runGuarded<AuthOutcome>(
      tx.controller.signal,
      () => method.authenticate(ctx),
      (err) => {
        this.deps.logger('auth.method.threw', {
          methodId: method.descriptor.id,
          message: String(err)
        })
        return { kind: 'failed', reason: 'internal' }
      }
    )
    return this.applyOutcome(method, tx, outcome)
  }

  private async applyOutcome(
    method: AuthMethod,
    tx: Transaction,
    outcome: AuthOutcome
  ): Promise<AuthStepInfo> {
    if (outcome.kind === 'authenticated') return this.stageAndAdvance(method, tx, outcome.record)

    if (outcome.kind === 'failed') {
      // 멤버 하나의 실패는 **로그인 전체의 실패**다 (0172). 이미 성공한 멤버의 자원을 먼저
      // 되돌리고, 실패한 멤버가 남긴 것도 지운다.
      await this.rollbackChain(tx)
      this.deps.vaultFor(txHandle(method, tx)).clearAll()
      this.transactions.finish(tx.id)
      const info: AuthStepInfo = {
        kind: 'failed',
        reason: outcome.reason,
        ...(outcome.message !== undefined ? { message: outcome.message } : {})
      }
      this.settleGate(tx.target, info.message ?? null)
      this.deps.publish()
      return info
    }

    const chain = this.chainProgress(method, tx)
    const info: AuthStepInfo = {
      kind: 'collect',
      transactionId: tx.id,
      fields: [...outcome.fields],
      ...(outcome.message !== undefined ? { message: outcome.message } : {}),
      ...(chain !== undefined ? { chain } : {})
    }
    if (tx.target.kind === 'application') {
      this.gate.step = info
      this.deps.publish()
    }
    return info
  }

  // ── 로그인 체인 (0172) ─────────────────────────────────────────────────────

  // 멤버가 성공했다. **커밋하지 않고 보류**한 뒤 다음 멤버로 넘어가고, 마지막이면 한 번에
  // 커밋한다. 중간 멤버의 성공은 renderer 로 나가지 않는다 — 나가면 로그인 화면이 완료로
  // 판단하고 앱으로 진입해버린다.
  private async stageAndAdvance(
    method: AuthMethod,
    tx: Transaction,
    draft: AuthRecordDraft
  ): Promise<AuthStepInfo> {
    const parentBindingId = draft.parentBindingId
    if (parentBindingId !== undefined && !this.deps.bindings.get(parentBindingId)) {
      await this.rollbackChain(tx)
      this.deps.vaultFor(txHandle(method, tx)).clearAll()
      this.transactions.finish(tx.id)
      return this.fail(tx.target, 'policy_denied', '상위 인증이 더는 유효하지 않습니다')
    }

    const chain = tx.chain
    const staged: StagedBinding = { providerId: method.descriptor.id, draft }
    if (!chain) return this.commitChain(tx, [staged])
    chain.staged.push(staged)

    const next = this.memberAt(chain, chain.index + 1)
    if (!next) return this.commitChain(tx, chain.staged)

    this.transactions.advance(tx.id, next.descriptor.id, next.descriptor.loginTimeoutMs)
    return this.runMethod(next, tx, {})
  }

  // 전 멤버가 성공했다. 레코드를 **한 번에** 만들고(첫 멤버 = root) 멤버별 secret 을 각자의
  // 레코드 네임스페이스로 옮긴다. 축출된 이전 로그인의 secret 도 여기서 지운다.
  private commitChain(tx: Transaction, staged: readonly StagedBinding[]): AuthStepInfo {
    const { created, evicted } = this.deps.bindings.createMany(
      staged.map((member) => ({
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
      this.adoptSecret(txPrefixOf(staged[index].providerId, tx.id), binding.id)
    })
    this.transactions.finish(tx.id)
    this.settleGate(tx.target, null)
    this.deps.publish()
    return { kind: 'done', binding: created[0] }
  }

  // 보류분을 **역순**으로 되돌린다. 방식에게 자기 자원(브라우저 세션 등)을 정리할 기회를 주고,
  // 방식이 무엇을 하든 우리 소유 vault 는 우리가 지운다.
  private async rollbackChain(tx: Transaction): Promise<void> {
    const chain = tx.chain
    if (!chain || chain.staged.length === 0) return
    // 먼저 비운다 — 실패 경로와 취소 콜백이 겹쳐도 두 번 정리하지 않는다.
    const staged = chain.staged.splice(0, chain.staged.length)

    for (const member of [...staged].reverse()) {
      const method = this.deps.registry.getMethod(member.providerId)
      const prefix = txPrefixOf(member.providerId, tx.id)
      if (method) {
        // **새 controller 를 쓴다.** tx signal 은 타임아웃·취소로 이미 abort 됐을 수 있고,
        // `runGuarded` 는 aborted signal 이면 방식을 아예 부르지 않는다 — 그러면 정리가 필요한
        // 바로 그 상황에서 정리가 건너뛰어진다.
        const controller = new AbortController()
        const ctx = this.makeContext(method, tx.target, {}, controller.signal, prefix)
        const failure = await runGuarded(
          controller.signal,
          async () => {
            await method.revoke(ctx, stagedRef(tx, member))
            return null
          },
          (err) => String(err)
        )
        if (failure !== null) {
          this.deps.logger('auth.chain.rollback.failed', {
            methodId: member.providerId,
            message: failure
          })
        }
      }
      this.deps.vaultFor(prefix).clearAll()
    }
  }

  private memberAt(chain: ChainState, index: number): AuthMethod | undefined {
    const methodId = chain.members[index]
    return methodId !== undefined ? this.deps.registry.getMethod(methodId) : undefined
  }

  // 체인이 아닌(멤버 1개) 로그인의 step 에는 진행 정보를 싣지 않는다 — 1/1 표기는 잡음이다.
  private chainProgress(
    method: AuthMethod,
    tx: Transaction
  ): { index: number; total: number; label: string } | undefined {
    const chain = tx.chain
    if (!chain || chain.members.length < 2) return undefined
    return { index: chain.index + 1, total: chain.members.length, label: method.descriptor.label }
  }

  // 방식은 transaction 동안 자기 네임스페이스에 값을 넣는다. 레코드가 생기면 레코드
  // 네임스페이스로 이관해 로그아웃 시 한 번에 지워지게 한다.
  private adoptSecret(txPrefix: string, bindingId: string): void {
    const txVault = this.deps.vaultFor(txPrefix)
    const read = txVault.read(SECRET_NAME)
    if (read.state !== 'found') return
    const meta = txVault.describe(SECRET_NAME)
    if (!meta) return
    this.deps.vaultFor(authBindingPrefix(bindingId)).set(SECRET_NAME, read.value, meta)
    txVault.clearAll()
  }

  private makeContext(
    method: AuthMethod,
    target: AuthTarget,
    input: Record<string, string>,
    signal: AbortSignal,
    vaultPrefix: string
  ): AuthContext {
    return {
      target,
      input,
      signal,
      vault: this.deps.vaultFor(vaultPrefix),
      browserSessions: this.deps.browserSessions,
      // **검사는 전송자 앞에 있다** — 스택을 바꿔도 allowlist 강제 지점은 옮겨가지 않는다.
      // 미선언 origin 은 요청 자체를 만들지 않으므로 자격증명이 그리로 나가지 않는다.
      fetch: async (url, init) => {
        if (!isAllowedOrigin(url, method.descriptor.allowedOrigins)) {
          throw new Error('인증 방식이 선언하지 않은 origin 입니다')
        }
        return this.deps.fetchImpl(url, { ...init, redirect: 'manual', signal })
      },
      logger: (message, meta) =>
        this.deps.logger('auth.method.message', {
          methodId: method.descriptor.id,
          message,
          ...(meta !== undefined ? { meta } : {})
        }),
      clock: this.deps.clock
    }
  }

  // 앱 로그인 게이트를 닫는다 — inflight·step 을 내리고 오류 문구를 확정한다. 서비스 연결
  // 트랜잭션은 게이트를 건드리지 않으므로 `false` 를 돌려준다(호출자가 publish 여부를 정한다).
  // `errorMessage` 를 생략하면 기존 문구를 **보존**한다(취소 경로가 timeout 만 덮어쓰는 이유).
  private settleGate(target: AuthTarget, errorMessage?: string | null): boolean {
    if (target.kind !== 'application') return false
    this.gate.inflight = false
    this.gate.step = null
    if (errorMessage !== undefined) this.gate.errorMessage = errorMessage
    return true
  }

  private fail(target: AuthTarget, reason: AuthFailureReason, message: string): AuthStepInfo {
    if (this.settleGate(target, message)) this.deps.publish()
    return { kind: 'failed', reason, message }
  }
}

const SECRET_NAME = 'secret'

// transaction 네임스페이스는 **멤버별**이다 — `(methodId, txId)` 가 다 들어가야 한 체인의 두
// 멤버가 서로의 보류 secret 을 덮어쓰지 않는다.
function txPrefixOf(methodId: string, txId: string): string {
  return `${authMethodPrefix(methodId)}tx:${txId}:`
}

function txHandle(method: AuthMethod, tx: Transaction): string {
  return txPrefixOf(method.descriptor.id, tx.id)
}

// 보류분 정리에 넘기는 참조. 아직 레코드가 아니므로 id 는 합성값이다 — 방식 구현들이
// `record.id` 를 쓰지 않고 `artifact`·`target` 만 보는 것을 확인했다.
function stagedRef(tx: Transaction, member: StagedBinding): AuthRecordRef {
  return {
    id: `staged:${tx.id}:${member.providerId}`,
    target: tx.target,
    mechanism: member.draft.mechanism,
    artifact: member.draft.artifact,
    ...(member.draft.expiresAt !== undefined ? { expiresAt: member.draft.expiresAt } : {})
  }
}

function toRef(binding: AuthBindingInfo): AuthRecordRef {
  return {
    id: binding.id,
    target: binding.target,
    mechanism: binding.mechanism,
    artifact: binding.artifact,
    ...(binding.expiresAt !== undefined ? { expiresAt: binding.expiresAt } : {})
  }
}

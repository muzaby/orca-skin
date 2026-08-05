// 인증 transaction 스토어 (0157).
//
// ── 내구성·동시성 결정 (요구명세 §미비 보완 1) ──────────────────────────────
// OpenCode 분석은 "pending 이 프로세스 메모리 + provider 당 1건" 을 비채택으로 적었지만,
// 초판 요구명세는 대체 명세를 두지 않았다. 여기서 고정한다:
//
//   저장     : 프로세스 메모리. 영속되는 것은 성공 결과인 binding 뿐.
//   재시작   : 진행 중 transaction 소멸 → begin() 부터 다시.
//   동시성   : `(providerId, target)` 당 1건. 같은 키 재진입 시 기존 것을 **명시 취소**하고 교체.
//   다중 창  : main 소유이므로 창 무관. 상태는 stateEvent 로 전 창 브로드캐스트.
//   타임아웃 : provider 선언값(기본 300s). 만료 시 AbortSignal + failed 로 수렴.
//
// OpenCode 대비 개선은 durable 저장이 아니라 **경합 시 조용한 덮어쓰기를 없앤 것**이다.
// durable transaction 은 대화형 로그인이 앱 재시작을 넘겨야 할 때만 필요한데 그런 요구가 없다.

import type { AuthTarget } from '../../../shared/ipc'
import type { AuthBindingDraft } from '../../contracts/auth-plugin'
import { targetKey } from './bindings'

export const DEFAULT_LOGIN_TIMEOUT_MS = 300_000

// 체인 멤버가 성공했지만 **아직 커밋하지 않은** binding (0172). 전 멤버가 성공해야 BindingStore 에
// 들어간다. secret 은 그 멤버의 transaction 네임스페이스에 그대로 있고, 여기에는 draft 만 든다.
export interface StagedBinding {
  providerId: string
  pluginId: string
  draft: AuthBindingDraft
}

// 로그인 체인의 진행 상태. 멤버가 1개면 체인이 아닌 것과 동작이 같다.
export interface ChainState {
  members: readonly string[]
  // 현재 실행 중인 멤버의 인덱스 (0-based).
  index: number
  staged: StagedBinding[]
}

export interface Transaction {
  id: string
  // **현재 실행 중인** 멤버. 체인이 진행하면 바뀐다 — 그래서 키를 여기서 재계산하면 안 된다.
  providerId: string
  pluginId: string
  target: AuthTarget
  // 등록 시점의 `byKey` 키. `providerId` 가 바뀌어도 이 값으로 정리해야 유령 엔트리가 안 남는다.
  key: string
  startedAt: number
  controller: AbortController
  // provider 가 continue() 에서 쓰는 이어달리기 상태 (예: OAuth state, device code).
  scratch: Map<string, unknown>
  chain?: ChainState
}

export type CancelReason = 'superseded' | 'timeout' | 'user' | 'shutdown'

export class TransactionStore {
  private readonly byId = new Map<string, Transaction>()
  // `(providerId, target)` → transactionId. 1건 제한의 실체.
  private readonly byKey = new Map<string, string>()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private seq = 0

  constructor(
    private readonly clock: () => number = Date.now,
    // 취소·만료를 상위(broker)에 알린다 — 상태 브로드캐스트와 로깅을 위해.
    private readonly onCancelled: (tx: Transaction, reason: CancelReason) => void = () => {}
  ) {}

  // 새 transaction 시작. 같은 키가 이미 있으면 **조용히 덮어쓰지 않고 취소 통지 후** 교체한다.
  begin(input: {
    providerId: string
    pluginId: string
    target: AuthTarget
    timeoutMs?: number
    chain?: ChainState
  }): Transaction {
    // 키는 **체인 헤드**(begin 시점의 providerId)로 고정한다. 멤버가 진행해도 같은 로그인이므로
    // 재진입은 여전히 하나의 키에서 만나 이전 체인을 명시 취소한다.
    const key = `${input.providerId}|${targetKey(input.target)}`
    const existingId = this.byKey.get(key)
    if (existingId) this.cancel(existingId, 'superseded')

    const id = `tx_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    const tx: Transaction = {
      id,
      providerId: input.providerId,
      pluginId: input.pluginId,
      target: input.target,
      key,
      startedAt: this.clock(),
      controller: new AbortController(),
      scratch: new Map(),
      ...(input.chain !== undefined ? { chain: input.chain } : {})
    }
    this.byId.set(id, tx)
    this.byKey.set(key, id)
    this.arm(id, input.timeoutMs)
    return tx
  }

  // 체인의 다음 멤버로 넘긴다 (0172). 타임아웃은 **재시작**한다 — 멤버마다 자기 예산을 갖지
  // 않으면 대화형 2단계가 하나의 300s 를 나눠 쓰게 되고, 1단계에서 오래 머문 사용자는 2단계
  // 입력 도중 만료된다.
  advance(id: string, nextProviderId: string, nextPluginId: string, timeoutMs?: number): void {
    const tx = this.byId.get(id)
    if (!tx || !tx.chain) return
    tx.providerId = nextProviderId
    tx.pluginId = nextPluginId
    tx.chain.index += 1
    this.arm(id, timeoutMs)
  }

  private arm(id: string, timeoutMs?: number): void {
    const previous = this.timers.get(id)
    if (previous) clearTimeout(previous)
    this.timers.set(
      id,
      setTimeout(() => this.cancel(id, 'timeout'), timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS)
    )
  }

  get(id: string): Transaction | undefined {
    return this.byId.get(id)
  }

  findByTarget(providerId: string, target: AuthTarget): Transaction | undefined {
    const id = this.byKey.get(`${providerId}|${targetKey(target)}`)
    return id ? this.byId.get(id) : undefined
  }

  // 성공·실패로 종결. 취소 통지 없이 정리한다.
  finish(id: string): void {
    this.dispose(id)
  }

  cancel(id: string, reason: CancelReason): void {
    const tx = this.byId.get(id)
    if (!tx) return
    tx.controller.abort()
    this.dispose(id)
    this.onCancelled(tx, reason)
  }

  cancelAll(reason: CancelReason): void {
    for (const id of [...this.byId.keys()]) this.cancel(id, reason)
  }

  private dispose(id: string): void {
    const tx = this.byId.get(id)
    if (!tx) return
    const timer = this.timers.get(id)
    if (timer) clearTimeout(timer)
    this.timers.delete(id)
    this.byId.delete(id)
    // 등록에 쓴 키로 지운다. 체인이 진행하면 `providerId` 가 바뀌므로 재계산하면 어긋나
    // `byKey` 에 유령 엔트리가 남고, 그 뒤 같은 헤드로 재로그인하면 이미 없는 id 를 취소하려 든다.
    if (this.byKey.get(tx.key) === id) this.byKey.delete(tx.key)
  }

  size(): number {
    return this.byId.size
  }
}

// provider 호출 공용 실행기 — 타임아웃 race + throw 격리. 구 SsoService.run() 이식.
// provider 가 signal 을 무시해도 race 가 타임아웃 시점에 수렴시킨다.
export async function runGuarded<T>(
  signal: AbortSignal,
  fn: () => Promise<T>,
  onError: (err: unknown) => T
): Promise<T> {
  // 이미 취소된 transaction 이면 provider 를 **부르지 않는다**. race 에 맡기면 즉시 resolve 하는
  // provider 가 이겨서, 취소·로그아웃 뒤에도 vault 쓰기 같은 부수효과가 일어난다.
  if (signal.aborted) return onError(new Error('auth transaction aborted'))
  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('auth transaction aborted')), {
      once: true
    })
  })
  try {
    return await Promise.race([fn(), aborted])
  } catch (err) {
    return onError(err)
  }
}

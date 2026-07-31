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
import { targetKey } from './bindings'

export const DEFAULT_LOGIN_TIMEOUT_MS = 300_000

export interface Transaction {
  id: string
  providerId: string
  pluginId: string
  target: AuthTarget
  startedAt: number
  controller: AbortController
  // provider 가 continue() 에서 쓰는 이어달리기 상태 (예: OAuth state, device code).
  scratch: Map<string, unknown>
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
  }): Transaction {
    const key = `${input.providerId}|${targetKey(input.target)}`
    const existingId = this.byKey.get(key)
    if (existingId) this.cancel(existingId, 'superseded')

    const id = `tx_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    const tx: Transaction = {
      id,
      providerId: input.providerId,
      pluginId: input.pluginId,
      target: input.target,
      startedAt: this.clock(),
      controller: new AbortController(),
      scratch: new Map()
    }
    this.byId.set(id, tx)
    this.byKey.set(key, id)

    const timeoutMs = input.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS
    this.timers.set(
      id,
      setTimeout(() => this.cancel(id, 'timeout'), timeoutMs)
    )
    return tx
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
    const key = `${tx.providerId}|${targetKey(tx.target)}`
    if (this.byKey.get(key) === id) this.byKey.delete(key)
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

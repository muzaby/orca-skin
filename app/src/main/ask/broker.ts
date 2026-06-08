// InteractionBroker — SDK 의 canUseTool 콜백(main)과 renderer UI 를 잇는 Promise 다리.
// canUseTool 은 반환할 때까지 query() 실행을 일시 중지하므로, 상호작용(질문/계획 검토)을
// renderer 로 surface 한 뒤 사용자의 응답이 도착할 때까지 Promise 를 보류한다.
//
// 백엔드 중립·electron 비의존(순수 TS) — vitest 단위 테스트 대상. 결과 타입 T 는 호출처가
// 정한다(AskResult / PlanDecision …). 실제 채널 전송/검증은 router 가 담당하고, 브로커는
// requestId → resolver 매핑과 abort 정리만 책임진다.

// 보류 승인의 상태기계(provider-runtime.md §3 line 130). `'resolving'` 은 응답이 도착해
// 어댑터로 downcast 되는 UI-측 전이라 broker 가 추적하지 않는다(broker 는 requested →
// resolved|timed_out|aborted 만 관찰). `onSettle` 진단 콜백이 종료 상태를 통지한다.
export type PendingApprovalState = 'requested' | 'resolving' | 'resolved' | 'timed_out' | 'aborted'

// register 선택 옵션. 미전달 시 broker 동작은 종전과 100% 동일(하위호환).
interface RegisterOptions<T> {
  // 만료까지 응답이 없으면 안전 기본값으로 해소하는 wall-clock timeout. 콜백형(Claude
  // canUseTool) 승인이 무한 보류되는 것을 막는 mechanism. **현재 router 는 이 값을
  // 와이어링하지 않는다** — 승인 카드 표시 중 벽시계 auto-deny 는 사용자 경험을 해치므로,
  // mechanism 만 준비해 두고 OpenCode 이벤트형(서버 permission TTL) 편입 시 소비한다.
  timeoutMs?: number
  // 만료 시 해소값. 미지정 시 abortValue(안전 기본: deny/skip)를 재사용한다.
  timeoutValue?: T
  // 종료 상태 진단 통지(resolved | timed_out | aborted). 상태기계 정합/관측용.
  onSettle?: (state: PendingApprovalState) => void
}

interface Pending<T> {
  resolve: (result: T) => void
  // signal abort 리스너 + timeout 타이머 정리용 (종료 경로 모두에서 detach).
  detach: () => void
  onSettle?: (state: PendingApprovalState) => void
}

export class InteractionBroker<T> {
  private readonly pending = new Map<string, Pending<T>>()

  // 상호작용을 등록하고 사용자의 응답을 기다리는 Promise 를 반환한다. signal 이 abort 되면
  // (턴 취소 등) abortValue 로 resolve 하고 정리해 query() 가 멈출 수 있게 한다. opts.timeoutMs
  // 가 주어지면 만료 시 timeoutValue(또는 abortValue)로 해소한다.
  register(
    requestId: string,
    signal: AbortSignal | undefined,
    abortValue: T,
    opts?: RegisterOptions<T>
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      // 이미 abort 된 signal 이면 즉시 fallback.
      if (signal?.aborted) {
        opts?.onSettle?.('aborted')
        resolve(abortValue)
        return
      }

      const onAbort = (): void => this.settle(requestId, abortValue, 'aborted')
      signal?.addEventListener('abort', onAbort)

      // 선택적 timeout — 만료 시 안전 기본값으로 해소.
      let timer: ReturnType<typeof setTimeout> | undefined
      if (opts?.timeoutMs !== undefined) {
        const timeoutValue = 'timeoutValue' in opts ? (opts.timeoutValue as T) : abortValue
        timer = setTimeout(() => this.settle(requestId, timeoutValue, 'timed_out'), opts.timeoutMs)
      }

      this.pending.set(requestId, {
        resolve,
        detach: () => {
          signal?.removeEventListener('abort', onAbort)
          if (timer !== undefined) clearTimeout(timer)
        },
        onSettle: opts?.onSettle
      })
    })
  }

  // 사용자의 응답으로 보류 중인 Promise 를 해소한다. 미지의 requestId 거나 이미 해소된
  // 경우(중복 응답·abort 후 도착)는 무해하게 무시한다.
  resolve(requestId: string, result: T): void {
    this.settle(requestId, result, 'resolved')
  }

  // 종료 경로 단일화 — resolved/timed_out/aborted 모두 여기서 정리(타이머·리스너 clear)하고
  // 종료 상태를 onSettle 로 통지한다. 첫 종료가 승자이며 이후 호출은 무해하게 무시된다.
  private settle(requestId: string, result: T, state: PendingApprovalState): void {
    const entry = this.pending.get(requestId)
    if (!entry) return
    this.pending.delete(requestId)
    entry.detach()
    entry.onSettle?.(state)
    entry.resolve(result)
  }

  // 현재 보류 중인 요청 수 (테스트/진단용).
  get size(): number {
    return this.pending.size
  }
}

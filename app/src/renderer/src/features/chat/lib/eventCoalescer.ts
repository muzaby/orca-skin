import type { NormalizedEvent } from '../../../../../shared/ipc'

// 스트리밍 델타(message.delta · message.reasoning.delta)는 SDK 토큰 1개당 IPC 이벤트 1개로
// 도착한다. 토큰마다 즉시 dispatch 하면 transcript 가 토큰 수만큼 재렌더된다(rendering.md §1.2).
// 이 코얼레서는 델타를 버퍼에 모아 scheduler(보통 requestAnimationFrame) 한 틱마다 배열로
// 넘긴다. store가 배열 전체를 단일 transaction으로 반영하므로 React 배칭에 기대지 않고
// flush당 store notification도 정확히 1회가 된다.
//
// 순서 불변식: message.completed · tool.call.* · telemetry 같은 비-델타 이벤트가 오면 버퍼를
// 먼저 동기 flush 한 뒤 그 이벤트를 emit 한다 → "텍스트→도구→텍스트" 순서(Option B) 보존.

export type DeltaEvent = Extract<
  NormalizedEvent,
  { type: 'message.delta' | 'message.reasoning.delta' }
>

function isDeltaEvent(event: NormalizedEvent): event is DeltaEvent {
  return event.type === 'message.delta' || event.type === 'message.reasoning.delta'
}

export interface CoalescerScheduler {
  schedule: (cb: () => void) => number
  cancel: (handle: number) => void
}

export interface EventCoalescer {
  // 인바운드 이벤트 1개 라우팅 — 델타면 버퍼링, 그 외면 즉시(버퍼 flush 후) emit.
  push: (ev: NormalizedEvent) => void
  // 버퍼에 남은 델타를 지금 즉시 비운다.
  flush: () => void
  // 예약 취소 + 버퍼 폐기(emit 없이). 세션 전환·언마운트 시 스테일 델타 제거용. 이후 재사용 가능.
  dispose: () => void
}

export interface EventCoalescerSink {
  emit: (event: NormalizedEvent) => void
  emitDeltaBatch: (events: readonly DeltaEvent[]) => void
}

export function createEventCoalescer(
  sink: EventCoalescerSink,
  scheduler: CoalescerScheduler
): EventCoalescer {
  let buffer: DeltaEvent[] = []
  let handle: number | null = null

  const flush = (): void => {
    if (handle !== null) {
      scheduler.cancel(handle)
      handle = null
    }
    if (buffer.length === 0) return
    const batch = buffer
    buffer = []
    sink.emitDeltaBatch(batch)
  }

  const push = (ev: NormalizedEvent): void => {
    if (isDeltaEvent(ev)) {
      buffer.push(ev)
      if (handle === null) {
        handle = scheduler.schedule(() => {
          handle = null
          flush()
        })
      }
      return
    }
    // 비-델타: 순서 보존을 위해 버퍼를 먼저 비우고 emit.
    flush()
    sink.emit(ev)
  }

  const dispose = (): void => {
    if (handle !== null) {
      scheduler.cancel(handle)
      handle = null
    }
    buffer = []
  }

  return { push, flush, dispose }
}

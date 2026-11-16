// invoke 핸들러 등록 헬퍼 — 모든 renderer→main invoke 채널이 단일 경로로 zod safeParse 검증을
// 통과한다. 채널별 검증 실패 정책은 등록부에 명시한다(handoff 0012):
//   'reject'     — zod 에러로 invoke reject. 무효 페이로드 = 프로그래머 오류 표면화 (쓰기·생성류).
//   { fallback } — 무해 폴백 반환. 무효 입력을 조용히 무시해도 안전한 채널 (조회·목록류).
// main→renderer send 이벤트는 검증하지 않는다(형상 보증은 어댑터 정규화 — IPC_CONTRACT §1).

import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { getLogger } from '../log/registry'
import { recordStall, stallThread } from '../perf/stall-monitor'

// 동기 구간 계측 (0324 AC6) — 세 등록 함수 모두 리스너가 반환할 때까지(핸들러의 첫 `await` 전)
// 걸린 시간을 재고, 예산 이상이면 채널 이름과 함께 `perf.stall` 을 남긴다. 그 뒤의 멈춤은
// 루프 모니터가 채널 이름 없이 잡는다.
let clock: () => number = () => performance.now()

// 테스트가 시계를 바꾼다. 인자 없이 부르면 실제 시계로 되돌린다.
export function setHandleClock(next?: () => number): void {
  clock = next ?? (() => performance.now())
}

function timed<A extends unknown[], R>(channel: string, listener: (...args: A) => R) {
  return (...args: A): R => {
    const startedAt = clock()
    try {
      return listener(...args)
    } finally {
      recordStall({
        thread: stallThread(),
        source: 'ipc',
        durationMs: clock() - startedAt,
        label: channel
      })
    }
  }
}

interface ParseOk<T> {
  success: true
  data: T
}
interface ParseFail {
  success: false
  error: unknown
}
// zod 의존을 시그니처에 노출하지 않는 구조적 타입 — protocol.ts 의 모든 스키마가 만족한다.
interface SafeParser<T> {
  safeParse(raw: unknown): ParseOk<T> | ParseFail
}

type InvalidPolicy<R> = 'reject' | { fallback: R }

export function handle<T, R>(
  channel: string,
  schema: SafeParser<T>,
  invalid: InvalidPolicy<R>,
  fn: (data: T, event: IpcMainInvokeEvent) => Promise<R> | R
): void {
  const listener = async (event: IpcMainInvokeEvent, raw: unknown): Promise<R> => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      // 무효 payload 가 조용히 사라지지 않게 warn 으로 가시화(0124 AC6) — suppress(60s 창)가
      // 반복을 삼킨다. 채널·정책만 기록하고 payload 원문은 싣지 않는다.
      getLogger()
        .child('ipc')
        .warn('ipc.payload.rejected', {
          channel,
          policy: invalid === 'reject' ? 'reject' : 'fallback'
        })
      if (invalid === 'reject') throw parsed.error
      return invalid.fallback
    }
    return fn(parsed.data, event)
  }
  ipcMain.handle(channel, timed(channel, listener))
}

// 입력이 없거나(인자 무시) 검증을 소비처(store 내부 zod)가 담당하는 채널.
export function handlePlain<R>(
  channel: string,
  fn: (raw: unknown, event: IpcMainInvokeEvent) => Promise<R> | R
): void {
  ipcMain.handle(
    channel,
    timed(channel, (event: IpcMainInvokeEvent, raw: unknown) => fn(raw, event))
  )
}

// one-way send(renderer→main, 응답 없음) 수신 — invoke 용 handle() 과 대칭인 zod 단일 검증
// 경로 (0123). 무효 payload 는 폐기하고 onInvalid 로만 통지한다(응답 채널이 없어 reject 불가).
export function on<T>(
  channel: string,
  schema: SafeParser<T>,
  fn: (data: T, event: IpcMainEvent) => void,
  onInvalid?: (event: IpcMainEvent) => void
): void {
  ipcMain.on(
    channel,
    timed(channel, (event: IpcMainEvent, raw: unknown) => {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        onInvalid?.(event)
        return
      }
      fn(parsed.data, event)
    })
  )
}

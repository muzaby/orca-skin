// invoke 핸들러 등록 헬퍼 — 모든 renderer→main invoke 채널이 단일 경로로 zod safeParse 검증을
// 통과한다. 채널별 검증 실패 정책은 등록부에 명시한다(handoff 0012):
//   'reject'     — zod 에러로 invoke reject. 무효 페이로드 = 프로그래머 오류 표면화 (쓰기·생성류).
//   { fallback } — 무해 폴백 반환. 무효 입력을 조용히 무시해도 안전한 채널 (조회·목록류).
// main→renderer send 이벤트는 검증하지 않는다(형상 보증은 어댑터 정규화 — IPC_CONTRACT §1).

import { ipcMain, type IpcMainInvokeEvent } from 'electron'

interface ParseOk<T> {
  success: true
  data: T
}
interface ParseFail {
  success: false
  error: unknown
}
// zod 의존을 시그니처에 노출하지 않는 구조적 타입 — protocol.ts 의 모든 스키마가 만족한다.
export interface SafeParser<T> {
  safeParse(raw: unknown): ParseOk<T> | ParseFail
}

export type InvalidPolicy<R> = 'reject' | { fallback: R }

export function handle<T, R>(
  channel: string,
  schema: SafeParser<T>,
  invalid: InvalidPolicy<R>,
  fn: (data: T, event: IpcMainInvokeEvent) => Promise<R> | R
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      if (invalid === 'reject') throw parsed.error
      return invalid.fallback
    }
    return fn(parsed.data, event)
  })
}

// 입력이 없거나(인자 무시) 검증을 소비처(store 내부 zod)가 담당하는 채널.
export function handlePlain<R>(
  channel: string,
  fn: (raw: unknown, event: IpcMainInvokeEvent) => Promise<R> | R
): void {
  ipcMain.handle(channel, (event, raw: unknown) => fn(raw, event))
}

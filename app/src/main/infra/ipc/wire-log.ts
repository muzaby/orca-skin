// 디버그 패널 "로그" 스위치의 wire 기록 플래그(dev 전용, 0025 → 0124 개편) — electron 비의존
// (0068)으로 features/adapters 레이어(순수 vitest 환경 포함)에서도 계측을 남길 수 있다.
// 0124: console.log 직접 출력을 제거하고 주입식 sink(컴포지션 루트가 로거 debug 로 연결)로
// 대체했다. sendChatEvent(renderer 전달 이벤트) 외에 main-내부 신호(input.echo)·훅 발화
// 타이밍이 같은 `ipc.wire.event` 스트림에 남아 echo↔훅 순서 실측(0068 AC7) 타임라인을 유지한다.
// 기본 false + 토글 핸들러·sink 주입이 DEV 전용이라 프로덕션 경로는 항상 무출력.
// 스트리밍 델타 2종은 전 경로 미기록(사용자 결정 2026-07-18) — 필터의 단일 지점이 여기다.

export type WireSink = (label: string, data?: unknown) => void

const EXCLUDED_WIRE_LABELS = new Set(['message.delta', 'message.reasoning.delta'])

let wireLogEnabled = false
let wireSink: WireSink | null = null

export function setWireLog(on: boolean): void {
  wireLogEnabled = on
}

export function setWireSink(sink: WireSink | null): void {
  wireSink = sink
}

export function wireLog(label: string, data?: unknown): void {
  if (!wireLogEnabled || wireSink === null) return
  if (EXCLUDED_WIRE_LABELS.has(label)) return
  wireSink(label, data)
}

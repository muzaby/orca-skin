// 디버그 패널 "로그" 스위치의 wire 기록 플래그(dev 전용, 0025 → 0124 개편) — electron 비의존
// (0068)으로 features/adapters 레이어(순수 vitest 환경 포함)에서도 계측을 남길 수 있다.
// 0124: console.log 직접 출력을 제거하고 주입식 sink(컴포지션 루트가 로거 debug 로 연결)로
// 대체했다. sendChatEvent(renderer 전달 이벤트) 외에 main-내부 신호(input.echo)·훅 발화
// 타이밍이 같은 `ipc.wire.event` 스트림에 남아 echo↔훅 순서 실측(0068 AC7) 타임라인을 유지한다.
// 0144: prod 도 orca.json debug 스위치로 sink 를 주입받는다(misc.ts prod 분기) — 이때 payload 는
// 메시지 본문을 제거해 대화 내용 유출을 막는다(dev sink 는 풀 payload 유지).
// 스트리밍 델타 2종은 전 경로 미기록(사용자 결정 2026-07-18) — 필터의 단일 지점이 여기다.
// 0149: 본문 제거도 그 "단일 지점" 안으로 들였다 — 예전엔 호출부(handlers/misc)가 sink 를 감싸며
// 기억해야 했고, 그러면 세 번째 sink(지원 번들·크래시 리포터 등)가 생길 때 작성자가 이 규칙을
// 모른 채 대화 본문을 흘릴 수 있다. redact 는 이제 sink 등록 시 선언하는 속성이다.

import { isRecord } from '../../../shared/obj'

type WireSink = (label: string, data?: unknown) => void

const EXCLUDED_WIRE_LABELS = new Set(['message.delta', 'message.reasoning.delta'])

let wireLogEnabled = false
let wireSink: WireSink | null = null
let wireRedact = false

export function setWireLog(on: boolean): void {
  wireLogEnabled = on
}

export function setWireSink(sink: WireSink | null, opts?: { redact?: boolean }): void {
  wireSink = sink
  wireRedact = opts?.redact === true
}

export function wireLog(label: string, data?: unknown): void {
  if (!wireLogEnabled || wireSink === null) return
  if (EXCLUDED_WIRE_LABELS.has(label)) return
  wireSink(label, wireRedact ? stripMessageContent(data) : data)
}

// 메시지 본문 제거(0144) — redact sink 전용. 이벤트 payload 에서 사용자/모델 "내용" 필드만
// 얕게 제거하고(type·sessionId·toolName·error 등 비내용 메타는 유지) prod 피드백 로그로 대화
// 본문이 유출되지 않게 한다. 델타 2종은 위에서 이미 제외되므로 여기 도달하지 않는다.
const MESSAGE_CONTENT_KEYS = new Set(['text', 'message', 'attachmentViews', 'delta'])

function stripMessageContent(data: unknown): unknown {
  if (!isRecord(data)) return data
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (MESSAGE_CONTENT_KEYS.has(key)) continue
    out[key] = value
  }
  return out
}

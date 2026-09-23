// 도구 결과의 비실행 사유(0239) — 도구가 자기 실행 결과 없이 끝난 **이유**를 결과 옆에 운반한다.
//
// 생산자는 둘이다.
//   · SDK(`source:'sdk'`) — 실행 전 거부·중단·취소된 도구의 tool_result 에 CLI 가 찍는
//     `tool_result_meta[].non_execution_kind`. 공개 타입에 없는 `@internal` wrapper 라 형상·값이
//     예고 없이 바뀔 수 있다 — 검증을 통과한 값만 읽고, 미지 값은 `not_executed` 로 분류한다.
//   · host(`source:'host'`) — SDK 가 결과를 보내지 않은 도구를 Orca 가 턴 terminal 직전(`no_result`)
//     이나 SDK 공개 철회 신호(`retracted`)에서 정착할 때 붙인다.
// 필드 부재 = 도구가 끝까지 실행됐거나(SDK 문구 "absent means the tool ran to completion") 사유를
// 모른다 — 소비자는 현행 표시로 폴백한다(D-002).
//
// 분류(D-008)와 값 비교(D-014)의 SSOT 다. main(claude-map·settle)과 renderer(parts·패널)가 함께
// import 하므로 런타임 의존 0 을 유지한다.

export type HostNonExecutionKind = 'no_result' | 'retracted'

export type NonExecution =
  | { source: 'sdk'; kind: string; userFeedback?: string }
  | { source: 'host'; kind: HostNonExecutionKind }

export type NonExecutionOutcome = 'rejected' | 'aborted' | 'cancelled' | 'not_executed'

// CLI 2.1.267 의 `non_execution_kind` enum 7종 중 사용자·정책 거부 5종. `interrupted`·`cancelled` 는
// 따로 분류하고, 스키마보다 먼저 wire 에 실리는 신규 값은 `not_executed` 로 떨어진다.
const REJECTED_KINDS: ReadonlySet<string> = new Set([
  'user-rejected',
  'permission-rule',
  'automode-blocked',
  'automode-unavailable',
  'automode-parsing-error'
])

// `interrupted` 는 사용자 Stop 의 결과라 Orca 자체 중단 정착(`aborted`)과 같은 이름으로 보인다(D-008).
export function nonExecutionOutcome(value: NonExecution): NonExecutionOutcome {
  if (value.source === 'host') return 'not_executed'
  if (REJECTED_KINDS.has(value.kind)) return 'rejected'
  if (value.kind === 'interrupted') return 'aborted'
  if (value.kind === 'cancelled') return 'cancelled'
  return 'not_executed'
}

// SDK user 메시지 wrapper 의 `tool_result_meta` 에서 해당 tool_use_id 의 사유를 읽는다. 배열 ·
// `id` 일치 · 비어 있지 않은 `non_execution_kind` 문자열이 모두 맞을 때만 읽고 그 밖은 부재로 본다.
export function readToolResultMeta(meta: unknown, toolUseId: string): NonExecution | undefined {
  if (!Array.isArray(meta) || toolUseId === '') return undefined
  for (const entry of meta) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    if (e.id !== toolUseId) continue
    if (typeof e.non_execution_kind !== 'string' || e.non_execution_kind === '') return undefined
    return {
      source: 'sdk',
      kind: e.non_execution_kind,
      ...(typeof e.user_feedback === 'string' && e.user_feedback !== ''
        ? { userFeedback: e.user_feedback }
        : {})
    }
  }
  return undefined
}

// 영속 payload·IPC 로 돌아온 값의 형상 검증 — 과거·미래 형상이 섞여도 소비자가 깨지지 않게
// 알려진 형상만 통과시킨다. 통과하지 못하면 부재(현행 표시)다.
export function parseNonExecution(value: unknown): NonExecution | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  if (v.source === 'host') {
    return v.kind === 'no_result' || v.kind === 'retracted'
      ? { source: 'host', kind: v.kind }
      : undefined
  }
  if (v.source === 'sdk' && typeof v.kind === 'string' && v.kind !== '') {
    return {
      source: 'sdk',
      kind: v.kind,
      ...(typeof v.userFeedback === 'string' && v.userFeedback !== ''
        ? { userFeedback: v.userFeedback }
        : {})
    }
  }
  return undefined
}

// 결과 view 재사용(0008) 판정의 값 비교(D-014). 둘 다 부재면 같고, 한쪽만 있으면 다르다.
// 직렬화 문자열 비교는 키 순서에 기대므로 쓰지 않는다.
export function nonExecutionEquals(
  a: NonExecution | undefined,
  b: NonExecution | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.source !== b.source || a.kind !== b.kind) return false
  const fa = a.source === 'sdk' ? a.userFeedback : undefined
  const fb = b.source === 'sdk' ? b.userFeedback : undefined
  return fa === fb
}

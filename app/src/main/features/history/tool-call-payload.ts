import type { NormalizedEvent } from '../../../shared/ipc'

// `tool_call` 파트의 영속 payload — **라이브 전용 필드를 걸러내는 자리**다(0229 §10 EP-Δ5).
//
// `editPreview` 는 실행 **전** 예측이고, 완료 결과의 `structuredOutput` 이 같은 hunk 를 정본으로
// 이미 영속한다. 둘 다 적으면 같은 값을 두 번 저장하고 재로드 시 어느 쪽이 정본인지 갈린다.
//
// writer 안에 인라인으로 두면 이 규칙이 DB 를 띄우지 않고는 검증되지 않는다 — 별도 파일로 떼
// 순수 단위 테스트가 키 집합을 직접 본다.
export function toolCallPartPayload(
  ev: Extract<NormalizedEvent, { type: 'tool.call.started' }>
): Record<string, unknown> {
  return {
    toolName: ev.toolName,
    args: ev.args ?? null,
    ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
  }
}

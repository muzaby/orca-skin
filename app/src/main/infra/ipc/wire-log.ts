// 디버그 패널 "Wire 메시지" 토글의 모듈 스코프 플래그(dev 전용, 0025) — electron 비의존으로
// 분리(0068)해 features/adapters 레이어(순수 vitest 환경 포함)에서도 계측 로그를 남길 수 있다.
// sendChatEvent(renderer 전달 이벤트) 외에 main-내부 신호(input.echo)·훅 발화 타이밍을 같은
// `[wire]` 스트림에 남겨 echo↔훅 순서 실측(0068 AC7)의 단일 타임라인을 만든다.
// 기본 false + 토글 핸들러가 DEV 전용이라 프로덕션 경로는 항상 무출력.

let wireLogEnabled = false

export function setWireLog(on: boolean): void {
  wireLogEnabled = on
}

export function wireLog(label: string, data?: unknown): void {
  if (wireLogEnabled) console.log('[wire]', label, data)
}

// 계획 검토(plan_review) 본문 해소 — 순수 함수 (0215 D-001).
//
// **왜 체인인가**: SDK 0.3.220 의 `ExitPlanModeInput` 에는 `plan` 필드가 없다
// (`sdk-tools.d.ts:568`). CLI 가 assistant 메시지를 파싱하는 시점에 **계획 파일을 디스크에서
// 읽어** `plan`/`planFilePath` 를 주입하는데, 그 파일은 모델이 plan 모드 지시대로 써야만
// 존재한다 — 즉 이 필드의 유무가 **모델 행동에 달려 있다**. Anthropic 모델은 파일을 쓰고,
// 계획을 본문 텍스트로만 내놓는 custom 모델은 쓰지 않아 필드가 통째로 빈다.
//
// 필드 하나에만 매달리면 그 경우 사용자는 **보지 못하는 계획을 승인**하게 된다. 그래서 같은
// 턴에 모델이 낸 서술을 2순위로 둔다 — 그 모델에게는 그 텍스트가 곧 계획이다.
//
// 계획 파일 경로는 **추측하지 않는다**(D-004). `planFilePath` 는 `plan` 과 함께만 주입되므로
// 독립 폴백이 되지 못하고, CLI 내부의 slug 생성 규칙을 복제하면 CLI 버전마다 깨진다.

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

// `''` 반환 = 두 출처 모두 비었다. 호출부는 이것을 정상 빈 계획이 아니라 **해소 실패**로 다루고
// (renderer 가 승인 대기 상태와 함께 실패 문구를 낸다), 승인/거부 자체는 그대로 진행시킨다.
export function resolvePlanText(toolInput: unknown, narrative?: string): string {
  const injected = (toolInput ?? {}) as { plan?: unknown }
  return nonBlank(injected.plan) ?? nonBlank(narrative) ?? ''
}

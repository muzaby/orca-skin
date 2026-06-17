// Tier A — 백엔드 중립 Hook 어휘 + 결정 형식 + 충돌해소 (설계검토 §6, §9 3단계).
//
// 정규화 모델: 백엔드마다 다른 Hook 이벤트 이름·입력 스키마·출력 형식을 Orca 중립 어휘로
// 통일한다. 어댑터가 자기 백엔드의 snake_case payload 를 NormalizedHookContext 로 매핑하고, 핸들러가
// 반환한 NormalizedHookDecision 들을 resolveHookDecisions() 로 1결정 병합한 뒤 자기 출력 형식으로
// 다시 굽는다. electron 비의존 — 순수 타입 + 순수 함수라 단위 테스트 가능.

// claude HookEvent (29종) 중 Orca 가 정규화한 9종. 나머지(Setup·WorktreeCreate 등)는 백엔드
// 종속이라 backendSpecific 이스케이프 해치로만 노출한다.
export type NormalizedHookEvent =
  | 'before-tool' // PreToolUse
  | 'after-tool' // PostToolUse
  | 'on-prompt' // UserPromptSubmit
  | 'on-turn-end' // Stop
  | 'on-session-start' // SessionStart
  | 'on-session-end' // SessionEnd
  | 'on-subagent-end' // SubagentStop
  | 'on-notification' // Notification
  | 'before-compact' // PreCompact

// 핸들러에 넘기는 중립 컨텍스트. 백엔드 snake_case 입력을 어댑터가 이 camelCase 로 매핑한다.
export interface NormalizedHookContext {
  event: NormalizedHookEvent
  sessionId: string
  cwd: string
  // tool 이벤트(before-tool / after-tool)에서만 채워진다.
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  // on-prompt 에서만 채워진다.
  prompt?: string
  signal: AbortSignal
  // 백엔드 원본 payload 패스스루 (§6.5) — 정규화가 놓친 필드를 핸들러가 직접 읽을 수 있게.
  raw: unknown
}

// 핸들러가 반환하는 중립 결정. claude 의 'defer' 는 정규 어휘에서 제외(backendSpecific 으로).
export interface NormalizedHookDecision {
  decision?: 'allow' | 'deny' | 'ask'
  reason?: string
  // 모델 대화에 주입할 컨텍스트 (claude additionalContext / systemMessage 에 대응).
  injectContext?: string
  // before-tool 에서 도구 입력 치환, after-tool 에서 도구 출력 치환.
  updatedToolInput?: unknown
  updatedToolOutput?: unknown
  // false 면 이 Hook 이후 에이전트 루프 중단.
  continue?: boolean
}

export type NormalizedHookHandler = (
  ctx: NormalizedHookContext
) => Promise<NormalizedHookDecision> | NormalizedHookDecision

export interface NormalizedHookSet {
  normalized: Partial<Record<NormalizedHookEvent, NormalizedHookHandler[]>>
  // 정규화하지 않은 백엔드 종속 Hook (anchor — UI-facing supportedBackends 메타는 이번 스코프 제외).
  backendSpecific?: { 'claude'?: unknown; opencode?: unknown }
}

// 결정 우선순위: deny > ask > allow (§6.3). 동률(미설정)은 0.
const DECISION_RANK: Record<NonNullable<NormalizedHookDecision['decision']>, number> = {
  allow: 0,
  ask: 1,
  deny: 2
}

// N핸들러의 결정들을 1결정으로 병합한다 (순수). 규칙:
//   - decision: 가장 제한적인 값(deny>ask>allow) 채택. reason 은 채택된 결정의 것을 따른다.
//   - injectContext: 모든 핸들러 것을 줄바꿈으로 연결.
//   - continue: 어느 하나라도 false 면 false 우선.
//   - updatedToolInput / updatedToolOutput: last-writer-wins.
// 빈 배열 → {} (변경 없이 허용).
export function resolveHookDecisions(decisions: NormalizedHookDecision[]): NormalizedHookDecision {
  const merged: NormalizedHookDecision = {}
  const contexts: string[] = []
  let decision: NormalizedHookDecision['decision']

  for (const d of decisions) {
    if (
      d.decision &&
      (decision === undefined || DECISION_RANK[d.decision] >= DECISION_RANK[decision])
    ) {
      decision = d.decision
      if (d.reason !== undefined) merged.reason = d.reason
    }
    if (d.injectContext) contexts.push(d.injectContext)
    if (d.updatedToolInput !== undefined) merged.updatedToolInput = d.updatedToolInput
    if (d.updatedToolOutput !== undefined) merged.updatedToolOutput = d.updatedToolOutput
    if (d.continue === false) merged.continue = false
  }

  if (decision !== undefined) merged.decision = decision
  if (contexts.length > 0) merged.injectContext = contexts.join('\n')
  return merged
}

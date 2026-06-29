// claude 어댑트 변환 — 백엔드 중립 Extension 조각을 claude query() 옵션 조각으로 변환하는 순수
// 함수들. 인바운드(백엔드→중립)가 normalize 라면, 이쪽은 그 아웃바운드 짝(중립→백엔드)으로,
// Ports & Adapters 의 어댑터 경계 변환이다 (mcp/convert.ts 의 toClaudeConfig 와 동급의 "백엔드 종속
// 순수 변환기"). 각 함수는 `...spread` 로 합성될 옵션 조각(object)을 반환한다 — claude.ts 가
// 이미 219줄이라 hook 래핑까지 합치면 CLAUDE.md 원칙 9 의 400줄 경고를 넘어 별 파일로 분리한다.
//
// 입력은 이미 ${VAR} 확장이 끝난 값을 받는다 (확장/복호화는 어댑트 시점에만 — claude.ts 가
// toClaudeConfig 로 확장한 결과를 adaptMcp 에 넘긴다).

import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  HookJSONOutput,
  PostToolUseHookSpecificOutput,
  PreToolUseHookSpecificOutput,
  SyncHookJSONOutput,
  UserPromptSubmitHookSpecificOutput
} from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeMcpConfig } from '../mcp/schema'
import type { SkillInfo } from '../../shared/ipc'
import type { ProviderSettings } from '../settings/provider-settings'
import {
  resolveHookDecisions,
  type NormalizedHookContext,
  type NormalizedHookDecision,
  type NormalizedHookEvent,
  type NormalizedHookHandler,
  type NormalizedHookSet
} from '../extensions/hooks'

// 활성 MCP 서버가 있을 때만 mcpServers + allowedTools 를 주입한다. allowedTools 는
// `mcp__<name>__*` 와일드카드로 서버 전체 도구를 자동 허용 — Orca 엔 canUseTool 핸들러가 없어
// (Phase 4 anchor) 미허용 시 도구 호출이 멈추기 때문. 빈 config 면 옵션 자체를 생략.
export function adaptMcp(config: ClaudeMcpConfig): object {
  const names = Object.keys(config)
  if (names.length === 0) return {}
  return { mcpServers: config, allowedTools: names.map((n) => `mcp__${n}__*`) }
}

// claude_code preset + append. preset 으로 claude 의 기본 시스템 프롬프트(작업 디렉토리,
// 도구 카탈로그 등 동적 섹션)는 유지하고, 중립 텍스트(프로젝트 지침 + 정적 정책 append)만 덧붙인다.
// append 가 비어 있으면 옵션 자체를 빼서 SDK 기본 동작 그대로.
export function adaptSystemPrompt(append?: string): object {
  if (!append || append.trim() === '') return {}
  return { systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append } }
}

// Skill 은 SDK 기본 settingSources(user/project/local) 경로에서 **발견**되고(cwd/.claude/skills
// = Orca 거울, ~/.claude/skills = 어댑터), SDK `options.skills`(string[]) 가 그중 **활성**만 필터한다
// (context filter — 미나열 스킬은 세션에서 숨김). 활성 집합 = 활성화된 Orca 스킬 + 모든 어댑터
// 스킬(어댑터 스킬은 토글 불가·항상 on). 토글은 파일이 아니라 이 목록으로 반영되므로 재싱크 불필요.
// 알려진 스킬이 하나도 없으면(스캔 결과 0) 'all' 로 둬 스캔 누락이 스킬을 통째로 가리지 않게 한다.
export function adaptSkills(skills: SkillInfo[]): object {
  if (skills.length === 0) return { skills: 'all' as const }
  const active = skills.filter((s) => s.sourceKind !== 'orca' || s.enabled).map((s) => s.name)
  return { skills: active }
}

// provider settings flag 주입 (handoff 0023/0024/0028). 해석 완료 blob 의 settings 를 flag settings
// 레이어(options.settings — CLI --settings 동등, 사용자 제어 설정 중 최우선)로 넘긴다.
// settingSources 옵션은 생략해 SDK 기본 user/project/local 소스를 상속하며, 이 flag settings 가
// 그 위에 얹혀 `~/.claude/settings.json` 을 덮어쓴다(env 포함 — handoff 0028).
//
// **settings 는 인라인 JSON 문자열로 직렬화한다** (handoff 0015 결함 수정): SDK 의
// Options.settings 는 d.ts 상 `string | Settings` 지만 런타임 transport 는 값을 직렬화 없이
// CLI argv 에 그대로 push 하므로(0.3.143~0.3.175 동일), 객체를 넘기면 spawn 이
// "[object Object]" 로 강제 변환해 settings 가 적용되지 않는다. CLI --settings 는 "JSON 파일
// 경로 또는 인라인 JSON 문자열" 을 받으므로(cli-reference.md) JSON.stringify 로 넘긴다.
//
// **env↛argv 분리 폐기(handoff 0028)**: provider settings.json 은 `~/.claude/settings.json` 과
// 동일 취급이라 env(auth key 포함)를 settings 안에 그대로 실어 argv 로 넘긴다 — 앱 환경구성이
// 사용자 전역 env 를 덮어쓰는 메커니즘. argv 평문 노출(same-user process list)은 수용된 트레이드오프.
export function adaptSettings(settings?: ProviderSettings): object {
  return settings && Object.keys(settings).length > 0 ? { settings: JSON.stringify(settings) } : {}
}

// 시스템(턴) env 주입. 턴 env(orca.json 앱 env 병합 결과)를 options.env(subprocess
// env)로 넘긴다. provider settings 의 env 는 settings flag(adaptSettings)로 흐르므로 여기서는
// 시스템 env 만 다룬다(handoff 0028). 베이스가 없으면 옵션을 생략해 SDK 기본 env(process.env
// 상속) 동작을 유지한다.
export function adaptEnv(base?: Record<string, string>): object {
  return base && Object.keys(base).length > 0 ? { env: base } : {}
}

// NormalizedHookEvent → claude HookEvent.
const NORMALIZED_TO_CLAUDE_EVENT: Record<NormalizedHookEvent, HookEvent> = {
  'before-tool': 'PreToolUse',
  'after-tool': 'PostToolUse',
  'on-prompt': 'UserPromptSubmit',
  'on-turn-end': 'Stop',
  'on-session-start': 'SessionStart',
  'on-session-end': 'SessionEnd',
  'on-subagent-end': 'SubagentStop',
  'on-notification': 'Notification',
  'before-compact': 'PreCompact'
}

// 정규화된 Hook 집합을 claude options.hooks 조각으로 변환한다. 핸들러가 등록된 이벤트만 매처로
// 묶고, 비어 있으면 옵션 자체를 생략 — 이번 PR 의 빌더는 {normalized:{}} 를 공급하므로 {} 가 되어
// options.hooks 가 런타임에 주입되지 않는다 (실 채팅 동작 0 변경).
export function adaptHooks(set: NormalizedHookSet): object {
  const active = (
    Object.entries(set.normalized) as [NormalizedHookEvent, NormalizedHookHandler[] | undefined][]
  ).filter(
    (e): e is [NormalizedHookEvent, NormalizedHookHandler[]] =>
      Array.isArray(e[1]) && e[1].length > 0
  )
  if (active.length === 0) return {}
  const hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {}
  for (const [event, handlers] of active) {
    hooks[NORMALIZED_TO_CLAUDE_EVENT[event]] = [
      { hooks: [makeClaudeHookCallback(event, handlers)] }
    ]
  }
  return { hooks }
}

// claude snake_case Hook 입력의 좁힘 형태 (순수 매퍼 테스트가 가짜 payload 를 넘기기 쉽도록).
interface ClaudeHookInputLike {
  session_id?: string
  cwd?: string
  tool_name?: string
  tool_input?: unknown
  tool_response?: unknown
  prompt?: string
  [k: string]: unknown
}

// claude snake_case 입력 → 중립 NormalizedHookContext (순수 매퍼). raw 에 원본을 패스스루.
export function toContext(
  event: NormalizedHookEvent,
  input: ClaudeHookInputLike,
  signal: AbortSignal
): NormalizedHookContext {
  return {
    event,
    sessionId: input.session_id ?? '',
    cwd: input.cwd ?? '',
    ...(input.tool_name !== undefined ? { toolName: input.tool_name } : {}),
    ...(input.tool_input !== undefined ? { toolInput: input.tool_input } : {}),
    ...(input.tool_response !== undefined ? { toolOutput: input.tool_response } : {}),
    ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
    signal,
    raw: input
  }
}

// 병합된 중립 결정 → claude HookJSONOutput (순수 매퍼). before-tool→permissionDecision,
// after-tool→additionalContext/updatedToolOutput, on-prompt→additionalContext, 그 외 lifecycle→
// systemMessage. continue:false 는 최상위로.
export function toClaudeHookOutput(
  event: NormalizedHookEvent,
  decision: NormalizedHookDecision
): HookJSONOutput {
  const out: SyncHookJSONOutput = {}
  if (decision.continue === false) out.continue = false

  if (event === 'before-tool') {
    const spec: PreToolUseHookSpecificOutput = { hookEventName: 'PreToolUse' }
    let touched = false
    if (decision.decision) {
      spec.permissionDecision = decision.decision
      touched = true
    }
    if (decision.reason !== undefined) spec.permissionDecisionReason = decision.reason
    if (decision.updatedToolInput !== undefined) {
      spec.updatedInput = decision.updatedToolInput as Record<string, unknown>
      touched = true
    }
    if (decision.injectContext !== undefined) {
      spec.additionalContext = decision.injectContext
      touched = true
    }
    // 작용할 필드가 없으면 hookSpecificOutput 자체를 생략 → 변경 없이 허용({}) 계약 유지.
    if (touched) out.hookSpecificOutput = spec
  } else if (event === 'after-tool') {
    const spec: PostToolUseHookSpecificOutput = { hookEventName: 'PostToolUse' }
    let touched = false
    if (decision.injectContext !== undefined) {
      spec.additionalContext = decision.injectContext
      touched = true
    }
    if (decision.updatedToolOutput !== undefined) {
      spec.updatedToolOutput = decision.updatedToolOutput
      touched = true
    }
    if (touched) out.hookSpecificOutput = spec
  } else if (event === 'on-prompt') {
    if (decision.injectContext !== undefined) {
      const spec: UserPromptSubmitHookSpecificOutput = {
        hookEventName: 'UserPromptSubmit',
        additionalContext: decision.injectContext
      }
      out.hookSpecificOutput = spec
    }
  } else if (decision.injectContext !== undefined) {
    // lifecycle / notification: 모델·사용자 표시는 systemMessage 로.
    out.systemMessage = decision.injectContext
  }

  return out
}

// NormalizedHookHandler[] → claude HookCallback. snake_case 입력을 toContext 로 매핑 → 핸들러 전부 실행
// → resolveHookDecisions 로 1결정 병합 → toClaudeHookOutput 으로 다시 변환한다.
export function makeClaudeHookCallback(
  event: NormalizedHookEvent,
  handlers: NormalizedHookHandler[]
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const ctx = toContext(event, input as unknown as ClaudeHookInputLike, signal)
    const decisions: NormalizedHookDecision[] = []
    for (const handler of handlers) decisions.push(await handler(ctx))
    return toClaudeHookOutput(event, resolveHookDecisions(decisions))
  }
}

// claude 어댑트 변환 — 백엔드 중립 Capability 조각을 claude query() 옵션 조각으로 변환하는 순수
// 함수들. 인바운드(백엔드→중립)가 normalize 라면, 이쪽은 그 아웃바운드 짝(중립→백엔드)으로,
// Ports & Adapters 의 어댑터 경계 변환이다 (mcp/convert.ts 의 toClaudeConfig 와 동급의 "백엔드 종속
// 순수 변환기"). 각 함수는 `...spread` 로 합성될 옵션 조각(object)을 반환한다 — claude-code.ts 가
// 이미 219줄이라 hook 래핑까지 합치면 CLAUDE.md 원칙 9 의 400줄 경고를 넘어 별 파일로 분리한다.
//
// 입력은 이미 ${VAR} 확장이 끝난 값을 받는다 (확장/복호화는 어댑트 시점에만 — claude-code.ts 가
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
import { distDir } from '../config/paths'
import {
  resolveHookDecisions,
  type OrcaHookContext,
  type OrcaHookDecision,
  type OrcaHookEvent,
  type OrcaHookHandler,
  type OrcaHookSet
} from '../capabilities/hooks'

// 활성 MCP 서버가 있을 때만 mcpServers + allowedTools 를 주입한다. allowedTools 는
// `mcp__<name>__*` 와일드카드로 서버 전체 도구를 자동 허용 — Orca 엔 canUseTool 핸들러가 없어
// (Phase 4 anchor) 미허용 시 도구 호출이 멈추기 때문. 빈 config 면 옵션 자체를 생략.
export function adaptMcp(config: ClaudeMcpConfig): object {
  const names = Object.keys(config)
  if (names.length === 0) return {}
  return { mcpServers: config, allowedTools: names.map((n) => `mcp__${n}__*`) }
}

// claude_code preset + append. preset 으로 claude-code 의 기본 시스템 프롬프트(작업 디렉토리,
// 도구 카탈로그 등 동적 섹션)는 유지하고, 중립 텍스트(프로젝트 지침 + PY_AGENT_RULES)만 덧붙인다.
// append 가 비어 있으면 옵션 자체를 빼서 SDK 기본 동작 그대로.
export function adaptSystemPrompt(append?: string): object {
  if (!append || append.trim() === '') return {}
  return { systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append } }
}

// claude 로컬 플러그인 루트 = dist/claude-code/(ExtensionDeployer 가 sources/ 에서 렌더한 산출물).
// 부팅 시 deploy('claude-code') 로 매니페스트 + skills/agents/commands 가 보장된다. plugins(local) +
// skills:'all' 로 배포된 SKILL.md 를 명시 로드한다. (OrcaCapabilities.skills 배열은 가시화 메타일 뿐.)
export function adaptSkills(): object {
  return {
    plugins: [{ type: 'local' as const, path: distDir('claude-code') }],
    skills: 'all' as const
  }
}

// OrcaHookEvent → claude HookEvent.
const ORCA_TO_CLAUDE_EVENT: Record<OrcaHookEvent, HookEvent> = {
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
export function adaptHooks(set: OrcaHookSet): object {
  const active = (
    Object.entries(set.normalized) as [OrcaHookEvent, OrcaHookHandler[] | undefined][]
  ).filter((e): e is [OrcaHookEvent, OrcaHookHandler[]] => Array.isArray(e[1]) && e[1].length > 0)
  if (active.length === 0) return {}
  const hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {}
  for (const [event, handlers] of active) {
    hooks[ORCA_TO_CLAUDE_EVENT[event]] = [{ hooks: [makeClaudeHookCallback(event, handlers)] }]
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

// claude snake_case 입력 → 중립 OrcaHookContext (순수 매퍼). raw 에 원본을 패스스루.
export function toContext(
  event: OrcaHookEvent,
  input: ClaudeHookInputLike,
  signal: AbortSignal
): OrcaHookContext {
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
  event: OrcaHookEvent,
  decision: OrcaHookDecision
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

// OrcaHookHandler[] → claude HookCallback. snake_case 입력을 toContext 로 매핑 → 핸들러 전부 실행
// → resolveHookDecisions 로 1결정 병합 → toClaudeHookOutput 으로 다시 변환한다.
export function makeClaudeHookCallback(
  event: OrcaHookEvent,
  handlers: OrcaHookHandler[]
): HookCallback {
  return async (input, _toolUseID, { signal }) => {
    const ctx = toContext(event, input as unknown as ClaudeHookInputLike, signal)
    const decisions: OrcaHookDecision[] = []
    for (const handler of handlers) decisions.push(await handler(ctx))
    return toClaudeHookOutput(event, resolveHookDecisions(decisions))
  }
}

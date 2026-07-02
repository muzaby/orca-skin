// claude 어댑트 변환 — 백엔드 중립 Extension 조각을 claude query() 옵션 조각으로 변환하는 순수
// 함수들. 인바운드(백엔드→중립)가 normalize 라면, 이쪽은 그 아웃바운드 짝(중립→백엔드)으로,
// Ports & Adapters 의 어댑터 경계 변환이다. 각 함수는 `...spread` 로 합성될 옵션 조각(object)을
// 반환한다 — claude.ts 가 이미 219줄이라 hook 래핑까지 합치면 CLAUDE.md 원칙 9 의 400줄 경고를
// 넘어 별 파일로 분리한다. MCP 는 0058 이후 plugin .mcp.json 경로가 기본이며, adaptMcp 는
// 레거시 options.mcpServers 안전화/제거 전까지 남겨둔다.

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
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ClaudeMcpConfig } from '../mcp/schema'
import { adaptSkillNameForClaude } from '../deploy/claude-plugin-package'
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
import type { SteerFlushBatch } from '../lifecycle/steer-queue'

// Claude Code plugin root를 SDK local plugin 옵션으로 변환한다. 상대 경로는 cwd 기준이라 세션 cwd
// 변경과 얽힐 수 있으므로 호출자는 절대 경로를 넘긴다. 경로가 비어 있거나 실제 플러그인 매니페스트
// (.claude-plugin/plugin.json)가 없으면 옵션 자체를 생략한다 — deploy 실패/미실행 시 SDK 에
// 존재하지 않는 local plugin 경로를 넘겨 오류를 내는 대신 플러그인 없이 진행한다(설계 AC#5·엣지케이스#2).
export function adaptPlugins(pluginRoot?: string | null): object {
  if (!pluginRoot || pluginRoot.trim() === '') return {}
  if (!existsSync(join(pluginRoot, '.claude-plugin', 'plugin.json'))) return {}
  return { plugins: [{ type: 'local' as const, path: pluginRoot }] }
}

// 레거시 MCP 주입 경로. 기본 query 는 plugin .mcp.json 을 사용하므로 호출하지 않는다.
// 추후 plugin 로딩 안전화가 완료되면 제거 대상이다.
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

// Skill 은 plugin(sources/skills → dist/plugins/orca/skills) 과 adapter user path(~/.claude/skills) 에서
// 발견되고, SDK `options.skills`(string[]) 가 그중 **활성**만 필터한다. plugin 스킬은
// `plugin-name:skill-name` 네임스페이스를 사용해야 하므로 Orca 스킬만 `orca:` prefix 를 붙인다.
// 어댑터 스킬은 토글 불가·항상 on 이며 기존 이름을 유지한다. 알려진 스킬이 하나도 없으면
// 'all' 로 둬 스캔 누락이 스킬을 통째로 가리지 않게 한다.
export function adaptSkills(skills: SkillInfo[]): object {
  if (skills.length === 0) return { skills: 'all' as const }
  const active = skills
    .filter((s) => s.sourceKind !== 'orca' || s.enabled)
    .map((s) => adaptSkillNameForClaude(s))
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

// PostToolBatch 게이트 훅 조각 — 로컬 홀드된 steer 를 "다음 모델 요청 직전"(drain 직전 단일
// 발화, 명세 §7.5)에 stdin 으로 flush 한다(0060 D3·D4). 규칙:
//   - 메인 루프 한정: input.agent_id 는 서브에이전트 발화 시에만 존재(SDK dts) — 있으면 스킵.
//   - push(스트림 stdin write)가 훅 응답 반환보다 선행 → 같은 stdin FIFO 라 CLI 가 훅 응답을
//     읽기 전에 배치가 enqueue 된다(same-batch 포함, 명세 §7.3 — 부정돼도 다음 경계 열화로 안전).
//   - fail-open: steer 는 부가기능 — 어떤 예외도 {} 로 삼켜 턴 본체를 보호한다.
export function makeSteerGateHook(
  take: () => SteerFlushBatch | undefined,
  push: (text: string, uuid?: string) => void
): object {
  const callback: HookCallback = async (input) => {
    try {
      if ((input as { agent_id?: string }).agent_id !== undefined) return {}
      const batch = take()
      if (batch) push(batch.text, batch.uuid)
    } catch (err) {
      console.warn('[claude] steer gate hook 실패 — 이번 경계 flush 를 건너뜀', err)
    }
    return {}
  }
  return { hooks: { PostToolBatch: [{ hooks: [callback] }] } }
}

// options.hooks 조각 병합 — adaptHooks 산출과 게이트 조각처럼 `{hooks?: …}` 조각 여럿을
// 이벤트별 매처 배열 concat 으로 합친다. 조각이 하나 이하로만 hooks 를 가지면 그대로 통과.
export function mergeHooks(...fragments: object[]): object {
  const merged: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {}
  let any = false
  for (const fragment of fragments) {
    const hooks = (fragment as { hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>> }).hooks
    if (!hooks) continue
    any = true
    for (const [event, matchers] of Object.entries(hooks) as [HookEvent, HookCallbackMatcher[]][]) {
      merged[event] = [...(merged[event] ?? []), ...matchers]
    }
  }
  return any ? { hooks: merged } : {}
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

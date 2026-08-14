// claude 어댑트 변환 — 백엔드 중립 Extension 조각을 claude query() 옵션 조각으로 변환하는 순수
// 함수들. 인바운드(백엔드→중립)가 normalize 라면, 이쪽은 그 아웃바운드 짝(중립→백엔드)으로,
// Ports & Adapters 의 어댑터 경계 변환이다. 각 함수는 `...spread` 로 합성될 옵션 조각(object)을
// 반환한다 — claude.ts 가 이미 219줄이라 hook 래핑까지 합치면 CLAUDE.md 원칙 9 의 400줄 경고를
// 넘어 별 파일로 분리한다. MCP 는 0058 이후 plugin .mcp.json 경로가 기본이다.

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
import { adaptSkillNameForClaude } from './claude-plugin'
import { getLogger } from '../infra/log/registry'
import type { SkillInfo } from '../../shared/ipc'
import type { HarnessNativeSettings } from './harness-config'
import {
  resolveHookDecisions,
  type NormalizedHookContext,
  type NormalizedHookDecision,
  type NormalizedHookEvent,
  type NormalizedHookHandler,
  type NormalizedHookSet
} from './hooks'
import type { SteerFlushBatch } from './turn'

// Claude Code plugin root 들을 SDK local plugin 옵션으로 변환한다(0117 에서 복수화 — Orca plugin +
// 사용자 ~/.claude/skills 래퍼 plugin). 상대 경로는 cwd 기준이라 세션 cwd 변경과 얽힐 수 있으므로
// 호출자는 절대 경로를 넘긴다. 경로가 비어 있거나 실제 플러그인 매니페스트(.claude-plugin/plugin.json)가
// 없는 root 는 개별 생략한다 — deploy 실패/미실행 시 SDK 에 존재하지 않는 local plugin 경로를 넘겨
// 오류를 내는 대신 해당 플러그인 없이 진행한다(설계 AC#5·엣지케이스#2). 전부 탈락이면 옵션 자체 생략.
export function adaptPlugins(pluginRoots?: readonly (string | null | undefined)[]): object {
  const plugins = (pluginRoots ?? [])
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .filter((p) => existsSync(join(p, '.claude-plugin', 'plugin.json')))
    .map((path) => ({ type: 'local' as const, path }))
  return plugins.length > 0 ? { plugins } : {}
}

// claude_code preset + append. preset 으로 claude 의 기본 시스템 프롬프트(작업 디렉토리,
// 도구 카탈로그 등 동적 섹션)는 유지하고, 중립 텍스트(프로젝트 지침 + 정적 정책 append)만 덧붙인다.
// append 가 비어 있으면 옵션 자체를 빼서 SDK 기본 동작 그대로.
export function adaptSystemPrompt(append?: string): object {
  if (!append || append.trim() === '') return {}
  return { systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append } }
}

// Skill 은 두 plugin(sources/skills → dist/plugins/orca/skills · ~/.claude/skills → dist/plugins/claude
// 래퍼, 0117) 에서 발견되고, SDK `options.skills`(string[]) 가 그중 **활성**만 필터한다. plugin 스킬은
// `plugin-name:skill-name` 네임스페이스로 발견되므로 Orca 스킬은 `orca:`, 어댑터 스킬은 `claude:`
// prefix 를 붙인다(adaptSkillNameForClaude). 어댑터 스킬은 토글 불가·항상 on. 알려진 스킬이
// 하나도 없으면 'all' 로 둬 스캔 누락이 스킬을 통째로 가리지 않게 한다.
export function adaptSkills(skills: SkillInfo[]): object {
  if (skills.length === 0) return { skills: 'all' as const }
  const active = skills
    .filter((s) => s.sourceKind !== 'orca' || s.enabled)
    .map((s) => adaptSkillNameForClaude(s))
  return { skills: active }
}

// provider settings flag 주입 (handoff 0023/0024/0028). 해석 완료 blob 의 settings 를 flag settings
// 레이어(options.settings — CLI --settings 동등, 사용자 제어 설정 중 최우선)로 넘긴다.
// settingSources 는 adaptSettingSources 가 ['project','local'] 로 명시해 user 소스를 배제한다
// (handoff 0117 — 0023/0028 의 "생략=기본 소스 상속" 결정 supersede). 이 flag settings 는
// provider 전용 값이 사용자 전역 `~/.claude/settings.json` 과 겹치지 않고 그대로 적용되게 한다.
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
export function adaptSettings(settings?: HarnessNativeSettings): object {
  return settings && Object.keys(settings).length > 0 ? { settings: JSON.stringify(settings) } : {}
}

// settingSources 명시 (handoff 0117 — 0023/0028 "생략=user/project/local 상속" supersede).
// user 소스(~/.claude/settings.json + ~/.claude/skills 탐색)를 배제해 provider 전용 settings
// (adaptSettings flag)가 사용자 전역 설정 개입 없이 결정론적으로 적용되게 한다. user 배제로
// 끊기는 ~/.claude/skills 는 dist/claude/plugins/claude 래퍼 플러그인이 보전한다
// (features/extensions/claude-user-skills-plugin.ts — adaptPlugins 로 주입). provider settings
// 유무와 무관하게 항상 주입하므로 adaptSettings 와 분리된 조각이다.
export function adaptSettingSources(): object {
  return { settingSources: ['project', 'local'] }
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
//   - 2단계 인계(0151 AC4): take 는 **예약**이고 push 성공까지는 소유권이 넘어가지 않는다.
//     push 가 false(닫힌 스트림)를 돌려주거나 예외가 나면 rollback 으로 항목을 held 로 되돌려
//     사용자가 다시 취소할 수 있게 한다 — 구 계약은 실패를 삼켜 메시지가 굳었다.
export function makeSteerGateHook(
  take: () => SteerFlushBatch | undefined,
  push: (batch: SteerFlushBatch) => boolean,
  rollback?: (batch: SteerFlushBatch) => void,
  commit?: (batch: SteerFlushBatch) => boolean
): object {
  const callback: HookCallback = async (input) => {
    let reserved: SteerFlushBatch | undefined
    try {
      if ((input as { agent_id?: string }).agent_id !== undefined) return {}
      reserved = take()
      // 구조 페이로드(0067) — content 조립(첨부 블록 포함)은 호출자(claude.ts)의 push 가 소유.
      if (reserved) {
        if (!push(reserved)) {
          rollback?.(reserved)
          getLogger()
            .child('engine')
            .warn('engine.steer.submit-rejected', { provider: 'claude', rolledBack: true })
        } else if (commit && !commit(reserved)) {
          getLogger().child('engine').warn('engine.steer.commit-stale', { provider: 'claude' })
        }
      }
    } catch (err) {
      // fail-open: steer 는 부가기능이라 예외를 삼켜 턴 본체를 보호한다. 단 **상태는 반드시**
      // 되돌린다 — 삼키기와 상태 유실은 별개다.
      if (reserved) rollback?.(reserved)
      getLogger()
        .child('engine')
        .warn('engine.steer.flush-failed', {
          provider: 'claude',
          message: String(err),
          rolledBack: reserved !== undefined
        })
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

// compact_summary 원문에서 표시용 요약만 추출한다(0064 r4 피드백 3). CLI 의 압축 프롬프트는
// 응답을 `<analysis>…</analysis>` + `<summary>…</summary>` 두 블럭으로 강제하고, PostCompact
// hook 의 compact_summary 는 그 **원문 전체**를 싣는다(CLI 번들 실측 — PMH(compactSummary=E),
// E = 요약 응답 텍스트 전문). transcript 에는 summary 내용만 보여야 하므로 여기서 좁힌다.
// summary 태그가 없으면(포맷 미준수 응답) analysis 블럭·잔여 태그만 제거한 본문으로 폴백.
export function extractCompactSummary(raw: string): string {
  const m = /<summary>([\s\S]*?)<\/summary>/i.exec(raw)
  if (m) return m[1].trim()
  return raw
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<\/?(?:analysis|summary)>/gi, '')
    .trim()
}

// PostCompact 내부 hook 합성(0064 r3) — adaptHooks 결과(사용자 hooks 조각)에 어댑터 자체
// PostCompact 콜백을 병합한다. SDK 는 압축이 만든 대화 요약을 `compact_summary` 로 전달하며
// (hooks#postcompact), 어댑터는 이를 onSummary 로 올려 transcript 에 보이는 결과 메시지로
// 승격한다. **manual 트리거만** — 자동 압축 요약이 일반 턴 transcript 를 오염시키지 않게.
// onSummary 에는 extractCompactSummary 로 좁힌 표시용 본문만 넘긴다(XML 블럭 제외, r4).
export function withPostCompactHook(
  base: object,
  onSummary: (summary: string) => void
): { hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> } {
  const baseHooks = (base as { hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>> }).hooks
  const callback: HookCallback = async (input) => {
    const i = input as { trigger?: unknown; compact_summary?: unknown }
    if (i.trigger === 'manual' && typeof i.compact_summary === 'string') {
      const summary = extractCompactSummary(i.compact_summary)
      if (summary !== '') onSummary(summary)
    }
    return { continue: true }
  }
  return {
    hooks: {
      ...(baseHooks ?? {}),
      PostCompact: [...(baseHooks?.PostCompact ?? []), { hooks: [callback] }]
    }
  }
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

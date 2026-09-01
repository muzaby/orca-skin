// claude SDKMessage → NormalizedEvent 직접 매퍼 (provider-runtime.md §2).
// SDK 는 타입-only import 라 런타임에 로드되지 않는다 → electron/SDK 비의존 순수 함수 = vitest 대상.
// 어댑터(claude.ts)가 query() 스트림의 각 SDKMessage 를 이 함수로 NormalizedEvent 로 정규화한다.
//
// 매핑(architecture 매핑표): system/init → session.updated, stream_event(text_delta) → message.delta,
// assistant → content 블록 순서대로 message.completed/message.reasoning/tool.call.started,
// user(tool_result) → tool.call.completed, result → telemetry.
// 한 SDKMessage 가 N개 NormalizedEvent 로 분해될 수 있다(assistant = text/tool 블록 순서 보존).

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type {
  NormalizedEvent,
  ProviderReportedTelemetry,
  SubagentTaskMeta,
  TelemetryModelUsage
} from '../../shared/ipc'
import { isRecord } from '../../shared/obj'
import { isAsyncLaunchedPayload } from '../../shared/subagent'
import { isTaskToolName } from '../../shared/task-tool'
import { pickPrimaryModel } from '../../shared/usage/primary-model'
import { makeClassifiedError } from '../infra/errors'
import { errorEvent } from './error-classifier'

// 매퍼 컨텍스트 — sessionId 는 턴 동안 system/init(=session.updated)에서 갱신된다
// (resume 면 초기값이 그 id). cwd 는 session.updated.patch 에 실린다. 코어 중립(0016)으로
// provider 는 이벤트에 싣지 않으므로 ctx 도 들지 않는다.
export interface MapContext {
  sessionId: string
  cwd: string
  // 마지막 assistant 메시지의 usage 스냅샷 — /context 상단 % 근사용. 턴 누적이 아니라 그 턴
  // *마지막* 요청에서 모델이 본 입력 컨텍스트다. 멀티스텝(도구 N회) 턴에서 result.usage 는
  // 단계별 입력이 합산돼 과대 집계되므로, result telemetry 의 컨텍스트 입력 3종을 이 값으로 덮는다.
  // assistant 가 여러 번 와도 마지막 것이 남는다(ctx 는 턴 1회 생성·스트림 전체 공유).
  lastAssistantUsage?: {
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
  }
  // 이 턴에서 compact_boundary(네이티브 압축)를 지났는가 — 경계 이전의 usage(전체 이력이 실린
  // 요약 요청 입력)는 더 이상 라이브 컨텍스트가 아니므로, 경계에서 스냅샷을 무효화하고 result
  // telemetry 의 컨텍스트 점유를 압축 후 값으로 근사하는 데 쓴다(0064 r5 피드백 1).
  compacted?: boolean
  // compact_metadata.post_tokens(SDK optional) — 압축 후 컨텍스트 토큰 실측. 있으면 result
  // telemetry 근사의 1순위 참조(0065 r2 — 요약 크기 폴백보다 정확).
  compactPostTokens?: number
  // 핸드오프 도착 턴인가(0127). 이 턴의 컨텍스트는 원본 세션 전체 이력의 승계본이라, 압축
  // 경계(compacted) 전의 assistant usage·result.usage 컨텍스트 3종은 새 세션의 라이브 점유가
  // 아니다 — 스냅샷 캡처를 막고 result 에서 제거해 도넛/경고가 원본 값을 승계하지 않게 한다.
  handoffArrival?: boolean
  // 서브에이전트(Task) 누산 메타 — task_*/child assistant 에서 모은 모델·시간·도구수를 부모 Task
  // tool_result(tool.call.completed) emit 시 실어 영속한다. toolUseId(= Agent tool_use id) 키.
  subagentMeta?: Map<string, SubagentTaskMeta>
  // SDK task_id → 부모 Agent/Task tool_use_id. 일부 task_notification 은 task_id 만 권위로 싣고
  // tool_use_id 가 비어 있을 수 있어, 앞선 task_started/progress 에서 본 매핑으로 복원한다.
  taskToolUseById?: Map<string, string>
  // 구조화 출력을 실을 tool_use id 집합(0204). tool_result 는 도구 이름을 싣지 않는데 실을지는
  // **이름으로만** 판정되므로(TaskXXX 한정) 앞선 tool_use 에서 본 판정 결과를 여기 기억한다.
  // 이름이 아니라 멤버십만 담는다 — 소비처는 "이 run 이 Task 도구였나" 하나다.
  taskToolRunIds?: Set<string>
}

// ctx.subagentMeta 에 정의된 필드만 병합(누락은 기존값 보존). 부모 Task tool_result 영속용 누산.
function accrueSubagentMeta(ctx: MapContext, toolUseId: string, patch: SubagentTaskMeta): void {
  if (!ctx.subagentMeta) ctx.subagentMeta = new Map()
  const prev = ctx.subagentMeta.get(toolUseId) ?? {}
  const next: SubagentTaskMeta = { ...prev }
  if (patch.model !== undefined) next.model = patch.model
  if (patch.durationMs !== undefined) next.durationMs = patch.durationMs
  if (patch.toolUses !== undefined) next.toolUses = patch.toolUses
  ctx.subagentMeta.set(toolUseId, next)
}

// SDK system task_* 메시지(task_started/task_progress/task_notification) 한 건을 subagent.task
// NormalizedEvent 로 정규화한다. tool_use_id(= 부모 Agent 도구) 없으면 표시/중단 키가 없어 드롭.
// skip_transcript(ambient/housekeeping) 도 드롭. usage 누산은 ctx.subagentMeta 로 별도 영속.
function mapTaskSystem(
  msg: Record<string, unknown>,
  subtype: string,
  ctx: MapContext
): NormalizedEvent[] {
  const taskId = typeof msg.task_id === 'string' ? msg.task_id : undefined
  const rawToolUseId = typeof msg.tool_use_id === 'string' ? msg.tool_use_id : ''
  const rememberedToolUseId = taskId ? ctx.taskToolUseById?.get(taskId) : undefined
  const toolUseId = rawToolUseId || rememberedToolUseId || ''
  if (!toolUseId || msg.skip_transcript === true) return []
  if (taskId && rawToolUseId) {
    if (!ctx.taskToolUseById) ctx.taskToolUseById = new Map()
    ctx.taskToolUseById.set(taskId, rawToolUseId)
  }
  const subagentType = typeof msg.subagent_type === 'string' ? msg.subagent_type : undefined
  const description = typeof msg.description === 'string' ? msg.description : undefined
  const usage = (typeof msg.usage === 'object' && msg.usage !== null ? msg.usage : {}) as Record<
    string,
    unknown
  >
  const durationMs = num(usage.duration_ms)
  const toolUses = num(usage.tool_uses)
  const lastToolName = typeof msg.last_tool_name === 'string' ? msg.last_tool_name : undefined
  const summary = typeof msg.summary === 'string' ? msg.summary : undefined
  const status =
    msg.status === 'completed' || msg.status === 'failed' || msg.status === 'stopped'
      ? msg.status
      : undefined

  if (durationMs !== undefined || toolUses !== undefined) {
    accrueSubagentMeta(ctx, toolUseId, { durationMs, toolUses })
  }

  const phase =
    subtype === 'task_started'
      ? 'started'
      : subtype === 'task_notification'
        ? 'settled'
        : 'progress'
  return [
    {
      type: 'subagent.task',
      sessionId: ctx.sessionId,
      toolUseId,
      phase,
      ...(taskId !== undefined ? { taskId } : {}),
      ...(subagentType !== undefined ? { subagentType } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(toolUses !== undefined ? { toolUses } : {}),
      ...(lastToolName !== undefined ? { lastToolName } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(summary !== undefined ? { summary } : {})
    }
  ]
}

// 어댑터 예외 → error 분류/이벤트는 runtime-errors/claude-classifier.ts 로 이전됐다
// (ErrorClassifier, provider-runtime.md §6). 본 파일은 SDKMessage→정규화만 담당한다.

// usage 필드 타입가드 — number 가 아니면 undefined(누락 의미값은 덮어쓰지 않게).
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

// num 가드를 적용해 *정의된 숫자 필드만* target 에 복사한다(undefined/NaN 드롭). usage 스냅샷·
// telemetry·modelUsage 가 같은 "raw → 가드 → 조건부 대입" 패턴을 반복하므로 한 곳으로 모은다.
function assignNums(target: object, fields: Record<string, unknown>): void {
  const out = target as Record<string, number>
  for (const [key, raw] of Object.entries(fields)) {
    const n = num(raw)
    if (n !== undefined) out[key] = n
  }
}

function readParentToolRunId(msg: unknown): string | undefined {
  const id = (msg as { parent_tool_use_id?: unknown }).parent_tool_use_id
  return typeof id === 'string' && id.trim() !== '' ? id : undefined
}

// tool_use_result 는 메시지당 1개다 — tool_result 블록이 정확히 1개일 때만 그 구조화 출력을
// 특정 도구에 귀속시킬 수 있다. 영수증 판정(0136)과 TaskXXX 구조화 출력(0204)이 같은 전제를
// 쓰므로 판정을 한 곳에 둔다.
function hasSingleToolResult(content: unknown[]): boolean {
  let toolResults = 0
  for (const part of content) {
    if (isRecord(part) && part.type === 'tool_result') toolResults += 1
  }
  return toolResults === 1
}

// SDK user 메시지의 구조화 도구 출력(tool_use_result)이 백그라운드 런치 영수증(async_launched)
// 인지 — 맞으면 그 객체를 반환한다(0136). 귀속 전제(`hasSingleToolResult`)는 호출부가 이미
// 확인했다 — 복수 블록이면 보수적으로 미적용 = 현행 content 유지.
function asyncLaunchReceipt(msg: unknown): Record<string, unknown> | undefined {
  const structured = (msg as { tool_use_result?: unknown }).tool_use_result
  if (!isAsyncLaunchedPayload(structured)) return undefined
  return structured as Record<string, unknown>
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value.filter((v): v is string => typeof v === 'string')
  return out.length === value.length ? out : undefined
}

// SDK task_updated → subagent.task. **누락 필드는 무변경**이지 초기화가 아니다(SDK 주석 —
// "Clients merge into their local task map").
//
// `patch.status` 6종을 두 갈래로 가른다.
//   killed          → `stopped` 와 **동형 정착**(D-015). 사용자에게 둘은 같은 사건이다 —
//                     "끝까지 못 갔다". 새 표시 상태를 늘리면 두 타일의 라벨이 함께 갈라진다.
//   running·paused  → 정착이 아니라 **라이브 상태**(phase:'updated'). `paused` 를 정착으로 읽으면
//                     재개된 태스크가 화면에서 돌아오지 않는다(§10 EP-09).
//   completed·failed·pending → **여기서 정착시키지 않는다.** 그 셋의 권위는 `task_notification`
//                     이고, 둘 다 정착시키면 같은 태스크가 두 번 마감돼 통지가 중복된다.
//
// 이 메시지에는 `tool_use_id` 필드가 **없다**(SDK 타입) — 앞선 task_* 가 남긴 매핑이 유일한
// 좌표원이고, 매핑이 없으면 표시·중단 키를 만들 수 없어 드롭한다.
function mapTaskUpdated(msg: Record<string, unknown>, ctx: MapContext): NormalizedEvent[] {
  const taskId = typeof msg.task_id === 'string' ? msg.task_id : undefined
  const toolUseId = taskId ? ctx.taskToolUseById?.get(taskId) : undefined
  if (!toolUseId) return []
  const patch = typeof msg.patch === 'object' && msg.patch !== null ? msg.patch : {}
  const p = patch as Record<string, unknown>
  const status = typeof p.status === 'string' ? p.status : undefined
  const errorMessage = typeof p.error === 'string' && p.error !== '' ? p.error : undefined
  const isBackgrounded = typeof p.is_backgrounded === 'boolean' ? p.is_backgrounded : undefined

  if (status === 'killed') {
    return [
      {
        type: 'subagent.task',
        sessionId: ctx.sessionId,
        toolUseId,
        phase: 'settled',
        ...(taskId !== undefined ? { taskId } : {}),
        status: 'stopped',
        // 사유 문구를 정착에 싣는다 — 중단 행이 원인을 말하는 유일한 경로다(AT-21).
        ...(errorMessage !== undefined ? { summary: errorMessage } : {})
      }
    ]
  }

  const runState = status === 'paused' ? 'paused' : status === 'running' ? 'running' : undefined
  // 아무 필드도 안 잡히면 소비자가 병합할 것이 없다 — 빈 이벤트를 흘리지 않는다. `patch.error`
  // 는 정착(`killed`)에만 실린다: 라이브 표시에 소비처가 없어 계약에서 뺐다(`ipc.ts` 주석).
  if (runState === undefined && isBackgrounded === undefined) return []
  return [
    {
      type: 'subagent.task',
      sessionId: ctx.sessionId,
      toolUseId,
      phase: 'updated',
      ...(taskId !== undefined ? { taskId } : {}),
      ...(runState !== undefined ? { runState } : {}),
      ...(isBackgrounded !== undefined ? { isBackgrounded } : {})
    }
  ]
}

// SDK background_tasks_changed → subagent.backgroundSet. payload 는 `task_id` 만 싣고 Orca 의
// 표시·중단 키는 `tool_use_id` 라 **매핑된 것만** 실어 보낸다(§10 EP-06) — 매핑 없는 항목은
// 애초에 추적 대상이 아니므로 오정착 위험이 없다. `tasks` 가 배열이 아니면 레벨을 만들 수
// 없으므로 드롭한다(빈 배열은 "살아 있는 것이 없다" 라는 유효한 레벨이다).
function mapBackgroundTasksChanged(
  msg: Record<string, unknown>,
  ctx: MapContext
): NormalizedEvent[] {
  const tasks = msg.tasks
  if (!Array.isArray(tasks)) return []
  const toolUseIds: string[] = []
  for (const entry of tasks) {
    if (typeof entry !== 'object' || entry === null) continue
    const taskId = (entry as Record<string, unknown>).task_id
    if (typeof taskId !== 'string') continue
    const toolUseId = ctx.taskToolUseById?.get(taskId)
    if (toolUseId && !toolUseIds.includes(toolUseId)) toolUseIds.push(toolUseId)
  }
  return [{ type: 'subagent.backgroundSet', sessionId: ctx.sessionId, toolUseIds }]
}

export function claudeToNormalized(msg: SDKMessage, ctx: MapContext): NormalizedEvent[] {
  // SDKSystemMessage(subtype:'init') → session.updated (+ ctx.sessionId 갱신)
  if (msg.type === 'system' && (msg as { subtype?: string }).subtype === 'init') {
    const m = msg as unknown as {
      session_id?: string
      model?: string
      tools?: unknown
      claude_code_version?: unknown
    }
    if (typeof m.session_id !== 'string') return []
    ctx.sessionId = m.session_id
    // TaskXXX 기능 가용성 판정의 입력(0212 R-01). SDK 타입은 `tools` 를 required 로 선언하지만
    // 실행 경로는 **사용자 설치본 CLI** 라(`claude-executable.ts` — PATH 우선) 형태를 신뢰하지
    // 않는다. **부재는 키를 싣지 않는다**(§10 EP-01): 부재(판정 불가)와 미포함(기능 없음)은
    // 다른 사실이고, 부재를 `[]` 로 실으면 멀쩡한 CLI 에 거짓 안내가 뜬다(D-005).
    const agentTools = asStringList(m.tools)
    const cliVersion = typeof m.claude_code_version === 'string' ? m.claude_code_version : undefined
    return [
      {
        type: 'session.updated',
        sessionId: m.session_id,
        patch: {
          ...(m.model !== undefined ? { model: m.model } : {}),
          cwd: ctx.cwd,
          ...(agentTools !== undefined ? { agentTools } : {}),
          ...(cliVersion !== undefined ? { cliVersion } : {})
        }
      }
    ]
  }

  // SDK system task_* (서브에이전트 라이브 메타) → subagent.task. forwardSubagentText 와 무관하게
  // tool_use/tool_result 외 진행상황(시간·도구수·current tool·task_id)을 여기서만 얻는다.
  if (msg.type === 'system') {
    const subtype = (msg as { subtype?: string }).subtype
    if (
      subtype === 'task_started' ||
      subtype === 'task_progress' ||
      subtype === 'task_notification'
    ) {
      return mapTaskSystem(msg as unknown as Record<string, unknown>, subtype, ctx)
    }
    // SDK task_updated — TaskState 델타 패치(0212 AR-03). `killed`·`paused` 는 task_notification
    // 의 3종 status 에 없어 **이 메시지로만 관측된다**.
    if (subtype === 'task_updated') {
      return mapTaskUpdated(msg as unknown as Record<string, unknown>, ctx)
    }
    // SDK background_tasks_changed — 살아 있는 background 태스크 전량의 **레벨 신호**(0212 AR-02).
    if (subtype === 'background_tasks_changed') {
      return mapBackgroundTasksChanged(msg as unknown as Record<string, unknown>, ctx)
    }
    // SDKCompactBoundaryMessage → session.compacted (0064 handoff). SDK 네이티브 /compact
    // 압축 완료 경계 — 도착 세션 transcript 의 압축 표시를 구동한다(구 Phase 3 드롭 해제).
    if (subtype === 'compact_boundary') {
      const meta = (
        msg as unknown as {
          compact_metadata?: { trigger?: unknown; pre_tokens?: unknown; post_tokens?: unknown }
        }
      ).compact_metadata
      const preTokens = num(meta?.pre_tokens)
      const postTokens = num(meta?.post_tokens)
      const trigger = meta?.trigger
      // 경계 이전 assistant usage 스냅샷(압축 *전* 전체 이력 입력)을 무효화한다 — 압축 후에도
      // 이 값이 result telemetry 를 덮으면 도넛/경고가 압축 전 상태에 고착된다(r5 피드백 1).
      // 경계 이후 assistant 가 또 오면(auto 압축 후 턴 계속) 실측 스냅샷이 새로 잡힌다.
      ctx.compacted = true
      if (postTokens !== undefined) ctx.compactPostTokens = postTokens
      delete ctx.lastAssistantUsage
      return [
        {
          type: 'session.compacted',
          sessionId: ctx.sessionId,
          ...(trigger === 'manual' || trigger === 'auto' ? { trigger } : {}),
          ...(preTokens !== undefined ? { preTokens } : {}),
          ...(postTokens !== undefined ? { postTokens } : {})
        }
      ]
    }
  }

  // SDKPartialAssistantMessage → message.delta(text_delta) / message.reasoning.delta(thinking_delta)
  if (msg.type === 'stream_event') {
    const ev = (
      msg as unknown as {
        event?: { delta?: { type?: string; text?: string; thinking?: string } }
      }
    ).event
    if (ev?.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
      return [
        {
          type: 'message.delta',
          sessionId: ctx.sessionId,
          delta: { text: ev.delta.text }
        }
      ]
    }
    if (ev?.delta?.type === 'thinking_delta' && typeof ev.delta.thinking === 'string') {
      return [
        {
          type: 'message.reasoning.delta',
          sessionId: ctx.sessionId,
          delta: { text: ev.delta.thinking }
        }
      ]
    }
    // signature_delta 등 그 외 델타는 스트림에서 무시(완성 블록의 message.reasoning 이 signature 보관).
    return []
  }

  // SDKAssistantMessage → content 블록 순서 그대로 N개 NormalizedEvent 로 분해.
  // 텍스트를 말미에 합치지 않고 만나는 위치에서 message.completed 를 emit 한다 →
  // 같은 메시지 안의 "텍스트 → 도구 → 텍스트" 순서가 보존된다(메시지 내부 역전 방지).
  if (msg.type === 'assistant') {
    const m = (
      msg as unknown as {
        message?: { content?: unknown[]; usage?: Record<string, unknown>; model?: unknown }
      }
    ).message
    const content = m?.content ?? []
    const parentToolRunId = readParentToolRunId(msg)
    // 서브에이전트 child assistant 면 실제 모델(message.model)을 캡처 → subagent.task 로 표시,
    // ctx 누산으로 부모 tool_result 에 영속. 'Explore'(subagent_type) 대신 모델명을 보이게 한다.
    const childEvents: NormalizedEvent[] = []
    if (parentToolRunId !== undefined && typeof m?.model === 'string' && m.model !== '') {
      accrueSubagentMeta(ctx, parentToolRunId, { model: m.model })
      childEvents.push({
        type: 'subagent.task',
        sessionId: ctx.sessionId,
        toolUseId: parentToolRunId,
        phase: 'progress',
        model: m.model
      })
    }
    // 마지막 assistant usage 스냅샷 갱신(컨텍스트 점유 = 이 턴 마지막 요청 입력). Anthropic 표준
    // shape(input_tokens/output_tokens/cache_read_input_tokens/cache_creation_input_tokens)을
    // num 가드로 좁혀 읽는다. 의미값이 하나라도 있을 때만 덮어쓴다.
    // 핸드오프 도착 턴(0127)은 압축 경계 전의 usage 가 승계 컨텍스트(원본 전체 이력)라 스냅샷을
    // 잡지 않는다 — 경계 통과 후의 assistant usage 는 압축 후 실측이므로 기존대로 캡처.
    const u = m?.usage
    if (u && typeof u === 'object' && !(ctx.handoffArrival && ctx.compacted !== true)) {
      const snapshot: NonNullable<MapContext['lastAssistantUsage']> = {}
      assignNums(snapshot, {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens,
        cacheCreationTokens: u.cache_creation_input_tokens
      })
      if (Object.keys(snapshot).length > 0) ctx.lastAssistantUsage = snapshot
    }
    const events: NormalizedEvent[] = [...childEvents]
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        // 빈 텍스트 블록은 스킵(과거 assembled !== '' 가드와 동등).
        if (p.text !== '') {
          events.push({
            type: 'message.completed',
            sessionId: ctx.sessionId,
            message: { text: p.text },
            ...(parentToolRunId !== undefined ? { parentToolRunId } : {})
          })
        }
      } else if (p.type === 'thinking' && typeof p.thinking === 'string') {
        // 확장사고 블록(BetaThinkingBlock) → reasoning. signature 는 opaque 보관.
        // 빈/공백 사고는 스킵(빈 "사고 과정" 카드 영속 방지 — 빈 text 블록 가드와 동형).
        if (p.thinking.trim() !== '') {
          events.push({
            type: 'message.reasoning',
            sessionId: ctx.sessionId,
            text: p.thinking,
            ...(typeof p.signature === 'string' ? { signature: p.signature } : {})
          })
        }
      } else if (p.type === 'tool_use') {
        const toolRunId = typeof p.id === 'string' ? p.id : ''
        const toolName = typeof p.name === 'string' ? p.name : ''
        if (toolRunId && toolName) {
          // TaskXXX 결과에 구조화 출력을 실으려면 tool_result 시점에 이름이 필요하다(0204).
          // 그 도구만 기억해 맵이 턴 길이에 비례해 자라지 않게 한다.
          if (isTaskToolName(toolName)) {
            if (!ctx.taskToolRunIds) ctx.taskToolRunIds = new Set()
            ctx.taskToolRunIds.add(toolRunId)
          }
          events.push({
            type: 'tool.call.started',
            sessionId: ctx.sessionId,
            toolRunId,
            toolName,
            args: p.input,
            ...(parentToolRunId !== undefined ? { parentToolRunId } : {})
          })
        }
      }
    }
    return events
  }

  // SDKUserMessage / SDKUserMessageReplay → tool.call.completed | input.echo
  if (msg.type === 'user') {
    const rawContent = (msg as unknown as { message?: { content?: unknown } }).message?.content
    const content = Array.isArray(rawContent) ? rawContent : []
    const parentToolRunId = readParentToolRunId(msg)
    // 백그라운드 런치 영수증(0136) — CLI 2.1.198+ 는 서브에이전트가 백그라운드로 뜨면 부모
    // Agent/Task tool_result 를 즉시 반환한다. wire content 는 모델용 텍스트라 renderer 의
    // async_launched 판정(isAsyncLaunchedResult — output.status 객체 검사)이 성립하지 않으므로,
    // SDK 가 별도 필드(tool_use_result)에 실은 구조화 출력을 result 로 싣는다. 완료/실패 결과는
    // 현행 content 유지(요약 텍스트 렌더·복사 대상 보존) — 영수증일 때만 대체한다.
    // tool_use_result 는 메시지당 1개다 — 영수증 판정과 TaskXXX 구조화 출력이 같은 이 전제를
    // 공유하므로 한 번만 센다.
    const singleToolResult = hasSingleToolResult(content)
    const launchReceipt = singleToolResult ? asyncLaunchReceipt(msg) : undefined
    const events: NormalizedEvent[] = []
    let sawToolResult = false
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'tool_result') {
        sawToolResult = true
        const toolRunId = typeof p.tool_use_id === 'string' ? p.tool_use_id : ''
        if (!toolRunId) continue
        // 부모 Task tool_result 면 누산한 서브에이전트 메타(모델·시간·도구수)를 실어 영속.
        const meta = ctx.subagentMeta?.get(toolRunId)
        // TaskXXX 도구면 SDK 구조화 출력을 동행시킨다(0204 §10 EP-01). tool_use_result 는
        // 메시지당 1개라 tool_result 블록이 정확히 1개일 때만 귀속이 명확하다(영수증과 동일 규칙).
        const structuredOutput =
          singleToolResult && ctx.taskToolRunIds?.has(toolRunId) === true
            ? (msg as { tool_use_result?: unknown }).tool_use_result
            : undefined
        events.push({
          type: 'tool.call.completed',
          sessionId: ctx.sessionId,
          toolRunId,
          result: launchReceipt ?? p.content,
          isError: p.is_error === true,
          ...(parentToolRunId !== undefined ? { parentToolRunId } : {}),
          ...(meta && Object.keys(meta).length > 0 ? { subagentMeta: meta } : {}),
          ...(structuredOutput !== undefined ? { structuredOutput } : {})
        })
      }
    }
    // 텍스트-only user echo → input.echo (main 내부 steer 커밋 신호, 0060 D1). CLI 가 stdin 주입
    // 입력을 자기 컨텍스트로 흡수(drain)하면 그 메시지가 user 로 output 스트림에 되돌아온다 —
    // 이것이 소비 확정의 유일한 정밀 신호(명세 §6.1). 서브에이전트발(parent_tool_use_id)과
    // tool_result 동반 메시지는 제외한다. 매칭·커밋 판단은 turn-coordinator 소유.
    if (!sawToolResult && parentToolRunId === undefined) {
      const text =
        typeof rawContent === 'string'
          ? rawContent
          : content
              .filter(
                (p): p is { type: 'text'; text: string } =>
                  typeof p === 'object' &&
                  p !== null &&
                  (p as Record<string, unknown>).type === 'text' &&
                  typeof (p as Record<string, unknown>).text === 'string'
              )
              .map((p) => p.text)
              .join('\n')
      if (text.trim() !== '') {
        const uuid = (msg as unknown as { uuid?: unknown }).uuid
        events.push({
          type: 'input.echo',
          sessionId: ctx.sessionId,
          text,
          ...(typeof uuid === 'string' ? { uuid } : {})
        })
      }
    }
    return events
  }

  // SDKResultMessage → telemetry (턴 종료). provider-runtime.md §8 ProviderReportedTelemetry.
  // SDK 타입 직접 의존을 피해 좁히기로 읽는다. total_cost_usd/modelUsage 는 추정값(cost-tracking.md),
  // 각 필드 optional 가드 — 런타임 미제공 시 그냥 빠진다(graceful, 현행 빈 telemetry 동작 보존).
  if (msg.type === 'result') {
    const r = msg as unknown as {
      total_cost_usd?: number
      duration_ms?: number
      num_turns?: number
      usage?: {
        input_tokens?: number
        output_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
      }
      is_error?: boolean
      subtype?: string
      error?: unknown
      message?: string
      modelUsage?: Record<
        string,
        {
          costUSD?: number
          inputTokens?: number
          outputTokens?: number
          cacheReadInputTokens?: number
          cacheCreationInputTokens?: number
          contextWindow?: number
        }
      >
    }
    const telemetry = normalizeResultTelemetry(r)
    // 컨텍스트 점유 입력 3종(input·cache_read·cache_creation)을 마지막 assistant 스냅샷으로 대체
    // — /context 상단 % 와 같은 정의(모델이 마지막으로 본 입력)로 근사. costUsd·durationMs·
    // numTurns·modelUsage·model 은 턴 누적이 맞아 result 값 유지(사용자 결정).
    // 스냅샷에 있는 필드만 덮는다 — 없는 필드는 result.usage 값을 보존한다. (스냅샷이 input 만
    // 담고 cache_read 를 안 줄 때 delete 하면 contextTokens 가 input(≈1) 으로 붕괴 → 도넛 0~1%.)
    if (telemetry && ctx.lastAssistantUsage) {
      const snap = ctx.lastAssistantUsage
      if (snap.inputTokens !== undefined) telemetry.inputTokens = snap.inputTokens
      if (snap.cacheReadTokens !== undefined) telemetry.cacheReadTokens = snap.cacheReadTokens
      if (snap.cacheCreationTokens !== undefined)
        telemetry.cacheCreationTokens = snap.cacheCreationTokens
    } else if (telemetry && ctx.compacted) {
      // 압축 턴(manual /compact·핸드오프 도착)인데 경계 이후 실측 usage 가 없는 경우 —
      // result.usage 의 컨텍스트 3종은 압축 *전* 전체 이력이 실린 요약 요청 입력이라 그대로
      // 내보내면 도넛/경고가 압축 전 값에 고착된다. 압축 후 라이브 컨텍스트 ≈ 요약(출력
      // 토큰)이므로 그 값으로 근사한다 — 다음 실제 턴의 telemetry 가 실측으로 바로잡는다.
      // costUsd·durationMs·modelUsage 는 턴 누적이 맞아 유지(비용 원장 무손실).
      //
      // 실측(2026-07-04, 0065): 순수 /compact 턴의 result.usage 는 **전부 0** — 요약 요청
      // 사용량은 modelUsage 에만 계상된다(비용은 total_cost_usd 에 반영). 0 인 채 내보내면
      // main 원장(hasContextTokens)과 renderer(contextTokens>0) 게이트가 모두 스킵해 도넛이
      // 압축 전 값에 고착된다(r5 결함). 참조 우선순위(0065 r2): ① compact_metadata.post_tokens
      // (압축 후 컨텍스트 실측 — SDK optional) ② 요약 크기(modelUsage 출력 토큰 합) 근사.
      delete telemetry.cacheReadTokens
      delete telemetry.cacheCreationTokens
      const summaryTokens =
        telemetry.outputTokens ||
        Object.values(telemetry.modelUsage ?? {}).reduce((n, mu) => n + (mu.outputTokens ?? 0), 0)
      const postContextTokens = ctx.compactPostTokens ?? (summaryTokens > 0 ? summaryTokens : 0)
      if (postContextTokens > 0) telemetry.inputTokens = postContextTokens
      else delete telemetry.inputTokens
    } else if (telemetry && ctx.handoffArrival) {
      // 핸드오프 도착 턴인데 압축 경계도 실측 스냅샷도 없다(0127) — result.usage 컨텍스트 3종은
      // 원본 세션 전체 이력이라 제거한다(도넛/경고 '미측정' 시작, 다음 실제 턴 실측이 채움).
      // costUsd·durationMs·modelUsage 는 유지하되, hasContextTokens 게이트로 turn_usage 행은
      // 스킵된다 — 위 compacted 근사 0 엣지와 동일한 기수용 트레이드오프(renderer 의
      // sessionCostUsd 라이브 누산은 컨텍스트 게이트와 무관해 유지).
      delete telemetry.inputTokens
      delete telemetry.cacheReadTokens
      delete telemetry.cacheCreationTokens
    }
    const out: NormalizedEvent[] = [
      {
        type: 'telemetry',
        sessionId: ctx.sessionId,
        ...(telemetry ? { usage: telemetry } : {})
      }
    ]
    if (r.is_error === true || (r.subtype !== undefined && r.subtype !== 'success')) {
      const message =
        typeof r.message === 'string'
          ? r.message
          : typeof r.error === 'string'
            ? r.error
            : `Claude result failed${r.subtype ? ` (${r.subtype})` : ''}`
      out.push(
        errorEvent(
          makeClassifiedError('stream_error', message, { provider: 'claude' }),
          ctx.sessionId
        )
      )
    }
    return out
  }

  // 그 외 SDK 메시지 (plugin_install, permission_denied, rate_limit_event, status,
  // api_retry, hook_*, auth_status 등) 는 미사용. (compact_boundary 는 0064 에서 정규화됨.)
  return []
}

// modelUsage 에서 도넛 분모의 귀속 모델(primary)을 고른다 — **실사용량(input+cache_read+
// cache_creation) 최대 엔트리**. 입력측 모델 문자열(spawnedModel=alias / message.model)과
// SDK 가 돌려주는 modelUsage 키(해석된 ID, 예: bedrock `global.anthropic.claude-sonnet-5`)가
// SDKResultMessage 의 사용량/비용을 ProviderReportedTelemetry 로 정규화. 의미있는 필드가 하나도
// 없으면 undefined 반환(어댑터가 usage 를 생략 → 현행 빈 telemetry 와 동일). num 가드로 NaN 차단.
function normalizeResultTelemetry(r: {
  total_cost_usd?: number
  duration_ms?: number
  num_turns?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  modelUsage?: Record<
    string,
    {
      costUSD?: number
      inputTokens?: number
      outputTokens?: number
      cacheReadInputTokens?: number
      cacheCreationInputTokens?: number
      contextWindow?: number
    }
  >
}): ProviderReportedTelemetry | undefined {
  const out: ProviderReportedTelemetry = {}

  assignNums(out, {
    inputTokens: r.usage?.input_tokens,
    outputTokens: r.usage?.output_tokens,
    cacheReadTokens: r.usage?.cache_read_input_tokens,
    cacheCreationTokens: r.usage?.cache_creation_input_tokens,
    costUsd: r.total_cost_usd,
    durationMs: r.duration_ms,
    numTurns: r.num_turns
  })

  if (r.modelUsage && typeof r.modelUsage === 'object') {
    const modelUsage: Record<string, TelemetryModelUsage> = {}
    for (const [model, mu] of Object.entries(r.modelUsage)) {
      if (!mu || typeof mu !== 'object') continue
      const entry: TelemetryModelUsage = {}
      assignNums(entry, {
        costUsd: mu.costUSD,
        inputTokens: mu.inputTokens,
        outputTokens: mu.outputTokens,
        cacheReadTokens: mu.cacheReadInputTokens,
        cacheCreationTokens: mu.cacheCreationInputTokens,
        // SDK 실측 컨텍스트 윈도우(0134) — renderer 도넛 분모의 1차 소스. 미제공 시 생략
        // (renderer 가 모델명 휴리스틱으로 폴백).
        contextWindow: mu.contextWindow
      })
      modelUsage[model] = entry
    }
    const models = Object.keys(modelUsage)
    if (models.length > 0) {
      out.modelUsage = modelUsage
      // top-level model/contextWindow 승격 = 도넛 분모 소스. primary = modelUsage 실사용량 최대
      // 엔트리(pickPrimaryModel, 0141) — 입력측 모델 문자열 매칭 폐기(alias↔해석 ID 불일치 실측).
      // 단일 모델이면 그 모델, 멀티모델이면 argmax(제목 haiku 는 소량이라 자동 배제). primary 는
      // 항상 실제 modelUsage 키라 out.model 은 유효 키 = renderer modelUsage[model] 조회·비용 원장
      // 정합. 이로써 멀티모델 턴에서도 top-level 이 항상 채워져 renderer 200k-default 붕괴가 사라진다.
      const primary = models.length === 1 ? models[0] : pickPrimaryModel(modelUsage)
      if (primary !== undefined) {
        out.model = primary
        const window = modelUsage[primary].contextWindow
        if (window !== undefined) out.contextWindow = window
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

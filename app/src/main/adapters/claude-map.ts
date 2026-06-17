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
  TelemetryModelUsage
} from '../../shared/ipc'

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
}

// 어댑터 예외 → error 분류/이벤트는 runtime-errors/claude-classifier.ts 로 이전됐다
// (ErrorClassifier, provider-runtime.md §6). 본 파일은 SDKMessage→정규화만 담당한다.

// usage 필드 타입가드 — number 가 아니면 undefined(누락 의미값은 덮어쓰지 않게).
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

export function claudeToNormalized(msg: SDKMessage, ctx: MapContext): NormalizedEvent[] {
  // SDKSystemMessage(subtype:'init') → session.updated (+ ctx.sessionId 갱신)
  if (msg.type === 'system' && (msg as { subtype?: string }).subtype === 'init') {
    const m = msg as unknown as { session_id?: string; model?: string }
    if (typeof m.session_id !== 'string') return []
    ctx.sessionId = m.session_id
    return [
      {
        type: 'session.updated',
        sessionId: m.session_id,
        patch: { ...(m.model !== undefined ? { model: m.model } : {}), cwd: ctx.cwd }
      }
    ]
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
        message?: { content?: unknown[]; usage?: Record<string, unknown> }
      }
    ).message
    const content = m?.content ?? []
    // 마지막 assistant usage 스냅샷 갱신(컨텍스트 점유 = 이 턴 마지막 요청 입력). Anthropic 표준
    // shape(input_tokens/output_tokens/cache_read_input_tokens/cache_creation_input_tokens)을
    // num 가드로 좁혀 읽는다. 의미값이 하나라도 있을 때만 덮어쓴다.
    const u = m?.usage
    if (u && typeof u === 'object') {
      const snapshot: NonNullable<MapContext['lastAssistantUsage']> = {}
      const it = num(u.input_tokens)
      const ot = num(u.output_tokens)
      const crt = num(u.cache_read_input_tokens)
      const cct = num(u.cache_creation_input_tokens)
      if (it !== undefined) snapshot.inputTokens = it
      if (ot !== undefined) snapshot.outputTokens = ot
      if (crt !== undefined) snapshot.cacheReadTokens = crt
      if (cct !== undefined) snapshot.cacheCreationTokens = cct
      if (Object.keys(snapshot).length > 0) ctx.lastAssistantUsage = snapshot
    }
    const events: NormalizedEvent[] = []
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        // 빈 텍스트 블록은 스킵(과거 assembled !== '' 가드와 동등).
        if (p.text !== '') {
          events.push({
            type: 'message.completed',
            sessionId: ctx.sessionId,
            message: { text: p.text }
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
          events.push({
            type: 'tool.call.started',
            sessionId: ctx.sessionId,
            toolRunId,
            toolName,
            args: p.input
          })
        }
      }
    }
    return events
  }

  // SDKUserMessage / SDKUserMessageReplay → tool.call.completed
  if (msg.type === 'user') {
    const content = (msg as unknown as { message?: { content?: unknown[] } }).message?.content ?? []
    const events: NormalizedEvent[] = []
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'tool_result') {
        const toolRunId = typeof p.tool_use_id === 'string' ? p.tool_use_id : ''
        if (!toolRunId) continue
        events.push({
          type: 'tool.call.completed',
          sessionId: ctx.sessionId,
          toolRunId,
          result: p.content,
          isError: p.is_error === true
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
      modelUsage?: Record<
        string,
        {
          costUSD?: number
          inputTokens?: number
          outputTokens?: number
          cacheReadInputTokens?: number
          cacheCreationInputTokens?: number
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
    }
    return [
      {
        type: 'telemetry',
        sessionId: ctx.sessionId,
        ...(telemetry ? { usage: telemetry } : {})
      }
    ]
  }

  // 그 외 SDK 메시지 (compact_boundary, plugin_install, task_*, permission_denied,
  // rate_limit_event, status, api_retry, hook_*, auth_status 등) 는 Phase 3 미사용.
  return []
}

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
    }
  >
}): ProviderReportedTelemetry | undefined {
  const out: ProviderReportedTelemetry = {}

  const inputTokens = num(r.usage?.input_tokens)
  const outputTokens = num(r.usage?.output_tokens)
  const cacheReadTokens = num(r.usage?.cache_read_input_tokens)
  const cacheCreationTokens = num(r.usage?.cache_creation_input_tokens)
  if (inputTokens !== undefined) out.inputTokens = inputTokens
  if (outputTokens !== undefined) out.outputTokens = outputTokens
  if (cacheReadTokens !== undefined) out.cacheReadTokens = cacheReadTokens
  if (cacheCreationTokens !== undefined) out.cacheCreationTokens = cacheCreationTokens

  const costUsd = num(r.total_cost_usd)
  const durationMs = num(r.duration_ms)
  const numTurns = num(r.num_turns)
  if (costUsd !== undefined) out.costUsd = costUsd
  if (durationMs !== undefined) out.durationMs = durationMs
  if (numTurns !== undefined) out.numTurns = numTurns

  if (r.modelUsage && typeof r.modelUsage === 'object') {
    const modelUsage: Record<string, TelemetryModelUsage> = {}
    let firstModel: string | undefined
    for (const [model, mu] of Object.entries(r.modelUsage)) {
      if (!mu || typeof mu !== 'object') continue
      const entry: TelemetryModelUsage = {}
      const c = num(mu.costUSD)
      const it = num(mu.inputTokens)
      const ot = num(mu.outputTokens)
      const crt = num(mu.cacheReadInputTokens)
      const cct = num(mu.cacheCreationInputTokens)
      if (c !== undefined) entry.costUsd = c
      if (it !== undefined) entry.inputTokens = it
      if (ot !== undefined) entry.outputTokens = ot
      if (crt !== undefined) entry.cacheReadTokens = crt
      if (cct !== undefined) entry.cacheCreationTokens = cct
      modelUsage[model] = entry
      if (firstModel === undefined) firstModel = model
    }
    if (Object.keys(modelUsage).length > 0) {
      out.modelUsage = modelUsage
      // 단일 모델 턴이면 편의상 top-level model 도 채운다.
      if (Object.keys(modelUsage).length === 1 && firstModel) out.model = firstModel
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

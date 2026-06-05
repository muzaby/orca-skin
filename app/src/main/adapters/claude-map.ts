// claude SDKMessage → NormalizedEvent 직접 매퍼 (provider-runtime.md §2).
// SDK 는 타입-only import 라 런타임에 로드되지 않는다 → electron/SDK 비의존 순수 함수 = vitest 대상.
// 어댑터(claude-code.ts)가 query() 스트림의 각 SDKMessage 를 이 함수로 NormalizedEvent 로 정규화한다.
//
// 매핑(architecture 매핑표): system/init → session.updated, stream_event(text_delta) → message.delta,
// assistant → tool.call.started* + message.completed, user(tool_result) → tool.call.completed,
// result → telemetry. 한 SDKMessage 가 N개 NormalizedEvent 로 분해될 수 있다(assistant = tool+message).

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { NormalizedEvent, ProviderId } from '../../shared/ipc'

// 매퍼 컨텍스트 — provider 고정, sessionId 는 턴 동안 system/init(=session.updated)에서 갱신된다
// (resume 면 초기값이 그 id). cwd 는 session.updated.patch 에 실린다.
export interface MapContext {
  provider: ProviderId
  sessionId: string
  cwd: string
}

const AUTH_PATTERNS = [/\b401\b/i, /\bunauthori[sz]ed\b/i, /\bOAuth\b/i, /\bexpired\b/i]

// 어댑터 예외 → error NormalizedEvent. 인증 만료 패턴은 auth.expired(렌더러가 재로그인 모달 분기).
export function detectError(err: unknown, ctx: MapContext): NormalizedEvent {
  const msg = err instanceof Error ? err.message : String(err)
  const isAuth = AUTH_PATTERNS.some((re) => re.test(msg))
  return {
    type: 'error',
    ...(ctx.sessionId !== '' ? { sessionId: ctx.sessionId } : {}),
    provider: ctx.provider,
    error: {
      code: isAuth ? 'auth.expired' : 'sdk.crashed',
      message: isAuth ? 'Claude Code 인증이 만료되었습니다.' : msg,
      recoverable: true
    }
  }
}

export function claudeToNormalized(msg: SDKMessage, ctx: MapContext): NormalizedEvent[] {
  const { provider } = ctx

  // SDKSystemMessage(subtype:'init') → session.updated (+ ctx.sessionId 갱신)
  if (msg.type === 'system' && (msg as { subtype?: string }).subtype === 'init') {
    const m = msg as unknown as { session_id?: string; model?: string }
    if (typeof m.session_id !== 'string') return []
    ctx.sessionId = m.session_id
    return [
      {
        type: 'session.updated',
        sessionId: m.session_id,
        provider,
        patch: { ...(m.model !== undefined ? { model: m.model } : {}), cwd: ctx.cwd }
      }
    ]
  }

  // SDKPartialAssistantMessage(text_delta) → message.delta
  if (msg.type === 'stream_event') {
    const ev = (msg as unknown as { event?: { delta?: { type?: string; text?: string } } }).event
    if (ev?.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
      return [
        {
          type: 'message.delta',
          sessionId: ctx.sessionId,
          provider,
          delta: { text: ev.delta.text }
        }
      ]
    }
    return []
  }

  // SDKAssistantMessage → tool.call.started* + message.completed
  if (msg.type === 'assistant') {
    const content = (msg as unknown as { message?: { content?: unknown[] } }).message?.content ?? []
    const events: NormalizedEvent[] = []
    let assembled = ''
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        assembled += p.text
      } else if (p.type === 'tool_use') {
        const toolRunId = typeof p.id === 'string' ? p.id : ''
        const toolName = typeof p.name === 'string' ? p.name : ''
        if (toolRunId && toolName) {
          events.push({
            type: 'tool.call.started',
            sessionId: ctx.sessionId,
            provider,
            toolRunId,
            toolName,
            args: p.input
          })
        }
      }
    }
    if (assembled !== '') {
      events.push({
        type: 'message.completed',
        sessionId: ctx.sessionId,
        provider,
        message: { text: assembled }
      })
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
          provider,
          toolRunId,
          result: p.content,
          isError: p.is_error === true
        })
      }
    }
    return events
  }

  // SDKResultMessage → telemetry (턴 종료)
  if (msg.type === 'result') {
    const usage = (msg as unknown as { usage?: { input_tokens?: number; output_tokens?: number } })
      .usage
    if (
      usage &&
      typeof usage.input_tokens === 'number' &&
      typeof usage.output_tokens === 'number'
    ) {
      return [
        {
          type: 'telemetry',
          sessionId: ctx.sessionId,
          provider,
          usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
        }
      ]
    }
    return [{ type: 'telemetry', sessionId: ctx.sessionId, provider }]
  }

  // 그 외 SDK 메시지 (compact_boundary, plugin_install, task_*, permission_denied,
  // rate_limit_event, status, api_retry, hook_*, auth_status 등) 는 Phase 3 미사용.
  return []
}

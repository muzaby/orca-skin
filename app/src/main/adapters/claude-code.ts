// ClaudeCodeAdapter — @anthropic-ai/claude-agent-sdk 의 query() 함수를 통해 Claude Code 와 통신.
// CLI spawn 방식은 폐기 (Phase 3, 2026-05-18) — 외부 계약은 TRD §7.1,
// 내부 매핑은 architecture.md §5.4, SDK API 명세는 docs/spec/claude/agent-sdk/typescript.md 참조.

import { createRequire } from 'node:module'
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatEvent } from '../../shared/ipc'
import type { SessionAdapter } from './types'

const requireFn = createRequire(import.meta.url)

const AUTH_PATTERNS = [/\b401\b/i, /\bunauthori[sz]ed\b/i, /\bOAuth\b/i, /\bexpired\b/i]

function detectError(err: unknown): ChatEvent {
  const msg = err instanceof Error ? err.message : String(err)
  const isAuth = AUTH_PATTERNS.some((re) => re.test(msg))
  return {
    type: 'error',
    data: {
      code: isAuth ? 'auth.expired' : 'sdk.crashed',
      message: isAuth ? 'Claude Code 인증이 만료되었습니다.' : msg,
      recoverable: true
    }
  }
}

// SDKMessage union → ChatEvent (architecture.md §5.4 매핑 표 그대로).
// SDK 가 노출하지 않는 content block 의 세부 필드는 best-effort 좁힘으로 처리한다 —
// CLI 시기의 normalizeLine 과 동일한 방어 패턴 (Anthropic Beta 메시지 스키마는 양쪽 공통).
export function normalize(msg: SDKMessage, cwd: string): ChatEvent[] {
  // SDKSystemMessage(subtype:'init') → init
  if (msg.type === 'system' && (msg as { subtype?: string }).subtype === 'init') {
    const m = msg as unknown as { session_id?: string; model?: string }
    if (typeof m.session_id !== 'string') return []
    return [
      {
        type: 'init',
        data: { sessionId: m.session_id, model: m.model, cwd }
      }
    ]
  }

  // SDKPartialAssistantMessage(text_delta) → assistant_delta
  if (msg.type === 'stream_event') {
    const ev = (msg as unknown as { event?: { delta?: { type?: string; text?: string } } }).event
    if (ev?.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') {
      return [{ type: 'assistant_delta', data: { text: ev.delta.text } }]
    }
    return []
  }

  // SDKAssistantMessage → assistant_message / tool_use
  if (msg.type === 'assistant') {
    const content = (msg as unknown as { message?: { content?: unknown[] } }).message?.content ?? []
    const events: ChatEvent[] = []
    let assembled = ''
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') {
        assembled += p.text
      } else if (p.type === 'tool_use') {
        const toolUseId = typeof p.id === 'string' ? p.id : ''
        const name = typeof p.name === 'string' ? p.name : ''
        if (toolUseId && name) {
          events.push({
            type: 'tool_use',
            data: { toolUseId, name, input: p.input }
          })
        }
      }
    }
    if (assembled !== '') {
      events.push({ type: 'assistant_message', data: { text: assembled } })
    }
    return events
  }

  // SDKUserMessage / SDKUserMessageReplay → tool_result
  if (msg.type === 'user') {
    const content = (msg as unknown as { message?: { content?: unknown[] } }).message?.content ?? []
    const events: ChatEvent[] = []
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue
      const p = part as Record<string, unknown>
      if (p.type === 'tool_result') {
        const toolUseId = typeof p.tool_use_id === 'string' ? p.tool_use_id : ''
        if (!toolUseId) continue
        events.push({
          type: 'tool_result',
          data: {
            toolUseId,
            output: p.content,
            isError: p.is_error === true
          }
        })
      }
    }
    return events
  }

  // SDKResultMessage → result (턴 종료)
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
          type: 'result',
          data: { usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } }
        }
      ]
    }
    return [{ type: 'result', data: {} }]
  }

  // 그 외 SDK 메시지 (compact_boundary, plugin_install, task_*, permission_denied,
  // rate_limit_event, status, api_retry, hook_*, auth_status 등) 는 Phase 3 미사용.
  return []
}

export class ClaudeCodeAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const

  async isInstalled(): Promise<{ installed: boolean; version?: string }> {
    try {
      const pkg = requireFn('@anthropic-ai/claude-agent-sdk/package.json') as { version?: string }
      return { installed: true, version: pkg.version }
    } catch {
      return { installed: false }
    }
  }

  // SDK 의 optionalDependencies 가 platform binary 를 자동 동봉하므로 별도 설치 절차 없음.
  // 인터페이스 호환을 위해 즉시 complete 를 yield. opencode 어댑터 도입 시점에 본 메소드를
  // SessionAdapter 에서 optional 로 낮추거나 별도 인터페이스로 분리하는 것을 검토.
  async *install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }> {
    yield { step: 'complete', done: true }
  }

  async *sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal,
    systemPromptAppend?: string
  ): AsyncIterable<ChatEvent> {
    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (signal?.aborted) abortController.abort()
    else signal?.addEventListener('abort', onAbort)

    // claude_code preset + append 형태. preset 으로 claude-code 의 기본 시스템 프롬프트
    // (작업 디렉토리, 도구 카탈로그 등 동적 섹션) 는 유지하고, 프로젝트별 지침만 덧붙인다.
    // append 가 빈 문자열이면 옵션 자체를 빼서 SDK 기본 동작 그대로.
    const systemPromptOption =
      systemPromptAppend && systemPromptAppend.trim() !== ''
        ? {
            systemPrompt: {
              type: 'preset' as const,
              preset: 'claude_code' as const,
              append: systemPromptAppend
            }
          }
        : {}

    try {
      for await (const msg of query({
        prompt: text,
        options: {
          resume: sessionId ?? undefined,
          includePartialMessages: true,
          cwd,
          abortController,
          ...systemPromptOption
          // permissionMode / canUseTool / hooks: Phase 4 anchor (OQ9)
        }
      })) {
        for (const ev of normalize(msg, cwd)) yield ev
      }
    } catch (err) {
      yield detectError(err)
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

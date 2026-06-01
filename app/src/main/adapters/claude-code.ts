// ClaudeCodeAdapter — @anthropic-ai/claude-agent-sdk 의 query() 함수를 통해 Claude Code 와 통신.
// CLI spawn 방식은 폐기 (Phase 3, 2026-05-18) — 외부 계약은 TRD §7.1,
// 내부 매핑은 architecture.md §5.4, SDK API 명세는 docs/spec/claude/agent-sdk/typescript.md 참조.

import { createRequire } from 'node:module'
import {
  query,
  type CanUseTool,
  type PermissionResult,
  type SDKMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { AskQuestion, AskResult, ChatEvent, PlanDecision } from '../../shared/ipc'
import type { SessionAdapter } from './types'
import type { TurnRequest } from '../capabilities/types'
import type { Resolver } from '../mcp/expand'
import { toClaudeConfig } from '../mcp/convert'
import { adaptHooks, adaptMcp, adaptSkills, adaptSystemPrompt } from './claude-adapt'

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

// AskUserQuestion 회피 안내 — skip 시 Claude 에 전달할 거부 메시지.
const ASK_SKIP_MESSAGE = '사용자가 질문에 답하지 않고 건너뛰었습니다. 최선의 판단으로 진행하세요.'
// 계획 거부 — 에이전트가 재제안·재작성하지 않고 멈추도록 지시(거부 시 router 가 turn abort 도 함).
const PLAN_REJECT_MESSAGE =
  '사용자가 계획을 거부했습니다. 다른 계획이나 제안 없이 여기서 중단하세요.'

// 백엔드 중립 콜백을 claude-code 의 canUseTool 로 어댑트한다. SDK 고유의 canUseTool/
// PermissionResult/도구이름(AskUserQuestion·ExitPlanMode) 형태를 어댑터 내부에만 가둬,
// 어댑터 경계(TurnRequest)는 중립 콜백(askUser·reviewPlan)만 노출한다 — opencode 어댑터가
// 동일 콜백을 자기 메커니즘으로 소비 가능. 순수 매핑이라 단위 테스트 대상.
//
// - AskUserQuestion → askUser. 답변 시 원본 questions 를 그대로 echo(도구 처리 규약).
// - ExitPlanMode → reviewPlan. approved=allow / revise=deny(피드백) / rejected=deny(중단).
// - 그 외 도구(또는 핸들러 미주입) → allow passthrough(현행 무-권한-UI 동작 보존).
export interface CanUseToolHandlers {
  askUser?: (questions: AskQuestion[]) => Promise<AskResult>
  reviewPlan?: (plan: string) => Promise<PlanDecision>
}

export function makeCanUseTool(handlers: CanUseToolHandlers): CanUseTool {
  const { askUser, reviewPlan } = handlers
  return async (toolName, input): Promise<PermissionResult> => {
    if (toolName === 'AskUserQuestion' && askUser) {
      const questions = Array.isArray((input as { questions?: unknown }).questions)
        ? (input as { questions: AskQuestion[] }).questions
        : []
      const result = await askUser(questions)
      if (result.type === 'skipped') {
        return { behavior: 'deny', message: ASK_SKIP_MESSAGE }
      }
      return {
        behavior: 'allow',
        updatedInput: {
          questions,
          answers: result.answers,
          ...(result.response !== undefined ? { response: result.response } : {})
        }
      }
    }
    if (toolName === 'ExitPlanMode' && reviewPlan) {
      const plan =
        typeof (input as { plan?: unknown }).plan === 'string'
          ? (input as { plan: string }).plan
          : ''
      const decision = await reviewPlan(plan)
      if (decision.type === 'approved') {
        return { behavior: 'allow', updatedInput: input }
      }
      if (decision.type === 'revise') {
        return { behavior: 'deny', message: '사용자 수정 요청: ' + decision.feedback }
      }
      return { behavior: 'deny', message: PLAN_REJECT_MESSAGE }
    }
    return { behavior: 'allow', updatedInput: input }
  }
}

export class ClaudeCodeAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const

  // resolver 팩토리를 주입받는다 (McpStore.resolver()). ${VAR} 확장/비밀 복호화는 어댑트
  // 시점(sendMessage)에만 호출해 디스크/중간 구조에 평문이 남지 않게 한다.
  constructor(private readonly makeResolver: () => Resolver) {}

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

  async *sendMessage(req: TurnRequest): AsyncIterable<ChatEvent> {
    const { sessionId, text, cwd, signal, capabilities, env, askUser, reviewPlan, permissionMode } =
      req

    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (signal?.aborted) abortController.abort()
    else signal?.addEventListener('abort', onAbort)

    // ${VAR} 확장 + 비밀 복호화는 여기(어댑트 시점)에서만. 미확장 정규 소스를 받아
    // resolver 로 확장 → Claude 타깃(ClaudeMcpConfig). 미해결 변수로 드롭된 서버는 경고 로깅.
    const { config: mcpConfig, dropped } = toClaudeConfig(capabilities.mcp, this.makeResolver())
    for (const d of dropped) {
      console.warn(`[mcp] 서버 '${d.name}' 를 건너뜀: ${d.reason}`)
    }

    try {
      for await (const msg of query({
        prompt: text,
        options: {
          resume: sessionId ?? undefined,
          includePartialMessages: true,
          cwd,
          abortController,
          ...adaptSystemPrompt(capabilities.systemPromptAppend),
          ...adaptMcp(mcpConfig),
          ...adaptSkills(),
          ...(env ? { env } : {}),
          ...adaptHooks(capabilities.hooks),
          // canUseTool — AskUserQuestion → askUser, ExitPlanMode → reviewPlan, 그 외 allow
          // passthrough. 둘 다 미주입(opencode 등) 시 옵션 자체를 생략해 현행 동작 유지.
          ...(askUser || reviewPlan ? { canUseTool: makeCanUseTool({ askUser, reviewPlan }) } : {}),
          // 권한 모드 (Composer 모드 버튼) — 'plan'/'acceptEdits' 는 SDK PermissionMode 의
          // 부분집합이라 그대로 대입 가능. 부재 시 SDK 기본(default) 동작.
          ...(permissionMode ? { permissionMode } : {})
        }
      })) {
        for (const ev of normalize(msg, cwd)) yield ev
      }
    } catch (err) {
      // 의도적 중단(턴 취소 / 계획 거부)은 에러가 아니므로 error 이벤트를 내지 않는다.
      if (!abortController.signal.aborted) yield detectError(err)
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

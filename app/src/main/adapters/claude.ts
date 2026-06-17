// ClaudeAdapter — @anthropic-ai/claude-agent-sdk 의 query() 함수를 통해 Claude Code 와 통신.
// CLI spawn 방식은 폐기 (Phase 3, 2026-05-18) — 외부 계약은 TRD §7.1,
// 내부 매핑은 architecture.md §5.4, SDK API 명세는 docs/spec/claude/agent-sdk/typescript.md 참조.

import { createRequire } from 'node:module'
import {
  query,
  type CanUseTool,
  type Options,
  type PermissionResult,
  type SDKMessage
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AskQuestion,
  ApprovalResolution,
  NormalizedEvent,
  PermissionAction
} from '../../shared/ipc'
import { toClaudePermissionMode } from '../../shared/permission-mode'
import { claudeToNormalized, type MapContext } from './claude-map'
import { claudeErrorClassifier, errorEvent } from '../runtime-errors/claude-classifier'
import { createTurnInputStream } from './streaming-input'
import type { CompleteRequest, LiveTurn, SessionAdapter } from './types'
import type { TurnRequest } from '../extensions/types'
import type { Resolver } from '../mcp/expand'
import { toClaudeConfig } from '../mcp/convert'
import { isRiskyTool } from '../runtime-events/permission-bridge'
import {
  adaptEnv,
  adaptHooks,
  adaptMcp,
  adaptSettings,
  adaptSkills,
  adaptSystemPrompt
} from './claude-adapt'
import { CLAUDE_DESCRIPTOR } from '../capabilities/claude-probe'
import type { ProviderDescriptor } from '../../shared/ipc'

const requireFn = createRequire(import.meta.url)

// AskUserQuestion 회피 안내 — skip(deny) 시 Claude 에 전달할 거부 메시지.
const ASK_SKIP_MESSAGE = '사용자가 질문에 답하지 않고 건너뛰었습니다. 최선의 판단으로 진행하세요.'
// 계획 거부 — 에이전트가 재제안·재작성하지 않고 멈추도록 지시(거부 시 router 가 turn abort 도 함).
const PLAN_REJECT_MESSAGE =
  '사용자가 계획을 거부했습니다. 다른 계획이나 제안 없이 여기서 중단하세요.'
// 일반 도구 거부 기본 사유 (resolution.message 부재 시).
const TOOL_DENY_MESSAGE = '사용자가 도구 실행을 거부했습니다.'
// 제목 생성용 저가 모델 — CLI 가 해석하는 *별칭*('haiku'|'sonnet'|'opus' 또는 전체 모델명,
// docs/spec/claude/cli-reference.md `--model`). API 별칭(claude-haiku-4-5)은 해석되지 않는다.
const CLAUDE_TITLE_MODEL = 'haiku'

// 단일 권한 콜백(requestApproval)을 claude 의 canUseTool 로 어댑트한다. SDK 고유의
// canUseTool/PermissionResult/도구이름(AskUserQuestion·ExitPlanMode) 형태를 어댑터 내부에만
// 가둬, 어댑터 경계(TurnRequest)는 중립 콜백 하나(requestApproval: PermissionAction →
// ApprovalResolution)만 노출한다 — opencode 어댑터가 동일 콜백을 자기 메커니즘으로 소비 가능.
// 순수 매핑이라 단위 테스트 대상.
//
// - AskUserQuestion → ask_question. allow 면 updatedInput 의 answers/response 를 questions 와
//   함께 echo(도구 처리 규약). deny 면 ASK_SKIP_MESSAGE.
// - ExitPlanMode → plan_review. allow=실행(input echo) / deny+message=수정(피드백) /
//   deny(message 없음)=거부(중단).
// - 위험 도구(isRiskyTool) → tool_approval. resolution 을 PermissionResult 로 직접 매핑.
// - 안전 도구(또는 콜백 미주입) → allow passthrough(현행 무-권한-UI 동작 보존).
export function makeCanUseTool(
  requestApproval?: (action: PermissionAction) => Promise<ApprovalResolution>
): CanUseTool {
  return async (toolName, input): Promise<PermissionResult> => {
    if (toolName === 'AskUserQuestion' && requestApproval) {
      const questions = Array.isArray((input as { questions?: unknown }).questions)
        ? (input as { questions: AskQuestion[] }).questions
        : []
      const res = await requestApproval({
        kind: 'ask_question',
        request: { requestId: '', questions }
      })
      if (res.behavior === 'deny') {
        return { behavior: 'deny', message: ASK_SKIP_MESSAGE }
      }
      const ui = (res.updatedInput ?? {}) as {
        answers?: Record<string, string | string[]>
        response?: unknown
      }
      return {
        behavior: 'allow',
        updatedInput: {
          questions,
          answers: ui.answers ?? {},
          ...(typeof ui.response === 'string' ? { response: ui.response } : {})
        }
      }
    }
    if (toolName === 'ExitPlanMode' && requestApproval) {
      const plan =
        typeof (input as { plan?: unknown }).plan === 'string'
          ? (input as { plan: string }).plan
          : ''
      const res = await requestApproval({ kind: 'plan_review', request: { requestId: '', plan } })
      if (res.behavior === 'allow') {
        return { behavior: 'allow', updatedInput: input }
      }
      // deny: message 있으면 수정 요청(revise), 없으면 거부(reject — turn abort 는 router 가 처리).
      if (res.message) {
        return { behavior: 'deny', message: '사용자 수정 요청: ' + res.message }
      }
      return { behavior: 'deny', message: PLAN_REJECT_MESSAGE }
    }
    if (requestApproval && isRiskyTool(toolName)) {
      const res = await requestApproval({ kind: 'tool_approval', toolName, input })
      if (res.behavior === 'allow') {
        return {
          behavior: 'allow',
          updatedInput: (res.updatedInput as Record<string, unknown> | undefined) ?? input
        }
      }
      return {
        behavior: 'deny',
        message: res.message ?? TOOL_DENY_MESSAGE,
        ...(res.interrupt ? { interrupt: res.interrupt } : {})
      }
    }
    return { behavior: 'allow', updatedInput: input }
  }
}

export class ClaudeAdapter implements SessionAdapter {
  readonly id = 'claude' as const

  // resolver 팩토리를 주입받는다 (McpStore.resolver()). ${VAR} 확장/비밀 복호화는 어댑트
  // 시점(sendMessage)에만 호출해 디스크/중간 구조에 평문이 남지 않게 한다.
  constructor(private readonly makeResolver: () => Resolver) {}

  // 정적 능력 서술자 (claude-probe.ts 의 단일 출처를 반환 — drift 없음).
  describe(): ProviderDescriptor {
    return CLAUDE_DESCRIPTOR
  }

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

  async complete(req: CompleteRequest): Promise<string> {
    // 모델은 CompleteRequest.model 단일 채널로 흐른다. 1차는 저가 모델(별칭)로 시도하고,
    // 비-abort 실패면 model 을 생략해 provider default 모델로 1회 이관한다(graceful degrade
    // 는 호출자 몫 — router 의 try/catch). 첫 실패를 로깅해 모델 오설정이 은폐되지 않게 한다.
    try {
      return await this.runCompletion({ ...req, model: req.model ?? CLAUDE_TITLE_MODEL })
    } catch (err) {
      if (req.signal?.aborted) throw err
      console.warn('[session-title] 저가 모델 completion 실패 — default 모델로 재시도:', err)
      return this.runCompletion({ ...req, model: 'default' })
    }
  }

  private async runCompletion(req: CompleteRequest): Promise<string> {
    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (req.signal?.aborted) abortController.abort()
    else req.signal?.addEventListener('abort', onAbort, { once: true })

    // provider settings flag 주입 — sendMessage 경로와 대칭.
    // settingSources 는 생략해 SDK 기본 user/project/local 소스를 상속하고, settings(env 포함
    // 인라인 JSON, adaptSettings)가 그 위에 얹혀 ~/.claude/settings.json 을 덮어쓴다(handoff 0028).
    // options.env(adaptEnv)에는 시스템(턴) env 만.
    const options: Options = {
      abortController,
      maxTurns: 1,
      tools: [],
      allowedTools: [],
      persistSession: false,
      ...adaptSettings(req.providerSettings?.settings),
      ...adaptEnv(req.env),
      ...(req.cwd ? { cwd: req.cwd } : {}),
      ...(req.model ? { model: req.model } : {})
    }

    try {
      const chunks: string[] = []
      for await (const msg of query({ prompt: req.prompt, options })) {
        const text = assistantText(msg)
        if (text) chunks.push(text)
      }
      return chunks.join('').trim()
    } finally {
      req.signal?.removeEventListener('abort', onAbort)
    }
  }

  // 한 턴을 **스트리밍 입력 모드**로 실행한다(PR③ 옵션 A). prompt 를 string 이 아니라 이 턴의
  // 메시지 1건을 내보내고 result 도착까지 열려있는 AsyncIterable 로 넘겨, 턴 진행 중 반환된 Query
  // 핸들에서 setPermissionMode/interrupt/setModel 이 열리게 한다. result 도착(또는 abort) 시 입력
  // 스트림을 닫아 서브프로세스를 종료 → 다음 턴은 또 resume 로 새로(세션 모델 변화 0).
  sendMessage(req: TurnRequest): LiveTurn {
    const {
      sessionId,
      text,
      cwd,
      signal,
      extensions,
      env,
      requestApproval,
      permissionMode,
      model,
      effort
    } = req

    // 매퍼 컨텍스트 — sessionId 는 init(=session.updated)에서 갱신된다(resume 면 초기값이 그 id).
    const ctx: MapContext = { sessionId: sessionId ?? '', cwd }

    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (signal?.aborted) abortController.abort()
    else signal?.addEventListener('abort', onAbort)

    // ${VAR} 확장 + 비밀 복호화는 여기(어댑트 시점)에서만. 미확장 정규 소스를 받아
    // resolver 로 확장 → Claude 타깃(ClaudeMcpConfig). 미해결 변수로 드롭된 서버는 경고 로깅.
    const { config: mcpConfig, dropped } = toClaudeConfig(extensions.mcp, this.makeResolver())
    for (const d of dropped) {
      console.warn(`[mcp] 서버 '${d.name}' 를 건너뜀: ${d.reason}`)
    }

    // 턴-스코프 입력 스트림 — close() 까지 미종료(streaming-input.ts 가 불변식 격리).
    const input = createTurnInputStream(text)

    const handle = query({
      prompt: input.stream,
      options: {
        resume: sessionId ?? undefined,
        includePartialMessages: true,
        cwd,
        abortController,
        ...adaptSystemPrompt(extensions.systemPromptAppend),
        ...adaptMcp(mcpConfig),
        ...adaptSkills(),
        // provider settings flag 주입 — settings(env 포함 인라인 JSON 문자열, flag 레이어).
        // settingSources 는 생략해 SDK 기본 user/project/local 소스를 상속하고, 이 settings 가
        // 그 위에 얹혀 ~/.claude/settings.json 을 덮어쓴다(env 포함 — handoff 0028).
        // options.env(adaptEnv)에는 시스템(턴) env 만 — uv 런타임 + orca.json 앱 env.
        ...adaptSettings(req.providerSettings?.settings),
        ...adaptEnv(env),
        ...adaptHooks(extensions.hooks),
        // canUseTool — AskUserQuestion·ExitPlanMode·위험 도구를 requestApproval 로 게이트하고
        // 안전 도구는 allow passthrough. 콜백 미주입(opencode 등) 시 옵션 자체를 생략해 현행
        // 자동 통과 동작을 유지한다.
        ...(requestApproval ? { canUseTool: makeCanUseTool(requestApproval) } : {}),
        // 권한 모드 (정규화 6종 → SDK PermissionMode). 부재 시 SDK 기본(default) 동작.
        ...(permissionMode ? { permissionMode: toClaudePermissionMode(permissionMode) } : {}),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {})
      }
    })

    async function* events(): AsyncIterable<NormalizedEvent> {
      try {
        for await (const msg of handle) {
          yield* claudeToNormalized(msg, ctx)
          // 턴 종료 신호 — result 도착 시 입력 스트림을 닫아 서브프로세스가 종료되게 한다.
          if (msg.type === 'result') input.close()
        }
      } catch (err) {
        // 의도적 중단(턴 취소 / 계획 거부)은 에러가 아니므로 error 이벤트를 내지 않는다
        // (user_cancelled 로 분류되지만 emit 안 함 — 설계 결정 3).
        if (!abortController.signal.aborted) {
          const classified = claudeErrorClassifier.classify(err, {
            provider: 'claude',
            phase: 'sendMessage'
          })
          yield errorEvent(classified, ctx.sessionId)
        }
      } finally {
        // 어떤 경로로 끝나든 입력 스트림을 닫아(멱등) 핸들/서브프로세스 누수를 막는다.
        input.close()
        signal?.removeEventListener('abort', onAbort)
      }
    }

    return {
      events: events(),
      // 라이브 control — 스트리밍 입력 모드라야 동작하는 SDK Query 메서드에 위임.
      setPermissionMode: (mode) => handle.setPermissionMode(mode),
      interrupt: () => handle.interrupt(),
      setModel: (model) => handle.setModel(model)
    }
  }
}

function assistantText(msg: SDKMessage): string {
  if (msg.type !== 'assistant') return ''
  const content = msg.message.content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (typeof block === 'object' && block != null && 'type' in block && block.type === 'text') {
        return typeof block.text === 'string' ? block.text : ''
      }
      return ''
    })
    .join('')
}

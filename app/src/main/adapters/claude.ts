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
  ClassifiedError,
  NormalizedEvent,
  PermissionAction
} from '../../shared/ipc'
import { toClaudePermissionMode } from '../../shared/permission-mode'
import { claudeToNormalized, type MapContext } from './claude-map'
import { claudeErrorClassifier, errorEvent } from '../runtime-errors/claude-classifier'
import { createTurnInputStream, type TurnInputContent } from './streaming-input'
import type { Base64ImageSource } from '@anthropic-ai/sdk/resources/messages'
import { formatAttachmentPromptBlock } from '../prompts/attachment'
import { formatPlanFeedbackPrompt } from '../prompts/plan-feedback'
import type { CompleteRequest, LiveTurn, SessionAdapter } from './types'
import type { TurnRequest } from '../extensions/types'
import type { ExtractedAttachmentImage, ExtractedAttachmentText } from '../files/attachments'
import { isRiskyTool } from '../features/approvals/permission-bridge'
import {
  adaptEnv,
  adaptHooks,
  adaptPlugins,
  adaptSettings,
  adaptSkills,
  adaptSystemPrompt,
  makeSteerGateHook,
  mergeHooks
} from './claude-adapt'
import { CLAUDE_DESCRIPTOR } from '../capabilities/claude-probe'
import type { ProviderDescriptor } from '../../shared/ipc'

const requireFn = createRequire(import.meta.url)

// AskUserQuestion 회피 안내 — skip(deny) 시 Claude 에 전달할 거부 메시지.
const ASK_SKIP_MESSAGE = '사용자가 질문에 답하지 않고 건너뛰었습니다. 최선의 판단으로 진행하세요.'
// 계획 거부 — 에이전트가 재제안·재작성하지 않고 멈추도록 지시. 거부는 clean deny(interrupt 없음)로
// 보내 이 메시지가 모델에 전달되게 하고, 모델이 짧게 응답한 뒤 턴이 자연 종료되도록 한다.
const PLAN_REJECT_MESSAGE =
  '사용자가 계획을 거부했습니다. 다른 계획이나 제안 없이 여기서 중단하세요.'
// 일반 도구 거부 기본 사유 (resolution.message 부재 시).
const TOOL_DENY_MESSAGE = '사용자가 도구 실행을 거부했습니다.'
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
// 서브에이전트 호출 도구 이름 — v2.x 에서 'Task'→'Agent' 로 바뀌어 둘 다 본다(가이드 §4).
function isSubagentTool(toolName: string): boolean {
  return toolName === 'Agent' || toolName === 'Task'
}

function subagentTypeOf(input: unknown): string | undefined {
  const v = (input as { subagent_type?: unknown })?.subagent_type
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

// 중단된 서브에이전트 재호출 거부 사유(가이드 §6-A) — 메인이 우회 경로를 모색하도록 유도.
const SUBAGENT_BLOCKED_MESSAGE =
  '사용자가 이 작업을 취소했습니다. 해당 서브에이전트를 다시 호출하지 말고 다른 방식으로 진행하세요.'

export interface CanUseToolOptions {
  // 서브에이전트(Agent/Task) 호출에 run_in_background:true 를 주입해 백그라운드 task 로 띄운다 →
  // stopTask 로 개별 중단 가능(가이드). 기본 off(ORCA_SUBAGENT_BACKGROUND) — 현행 foreground 보존.
  backgroundSubagents?: boolean
  // 중단된 서브에이전트 타입이면 재호출을 deny(가이드 §6-A). 미주입이면 차단 없음.
  isSubagentBlocked?: (subagentType: string | undefined) => boolean
}

export function makeCanUseTool(
  requestApproval?: (action: PermissionAction, signal?: AbortSignal) => Promise<ApprovalResolution>,
  opts: CanUseToolOptions = {}
): CanUseTool {
  // options.signal: SDK 가 이 권한요청을 취소하면(control_cancel_request) abort 된다. requestApproval
  // 로 전달해 broker 가 그 신호로도 해소되게 한다 — 무시하면 canUseTool 이 영영 await 에 걸린다.
  return async (toolName, input, options): Promise<PermissionResult> => {
    const signal = options?.signal
    // 서브에이전트 호출 — 재호출 차단(deny) 우선, 아니면 백그라운드 주입(allow + run_in_background).
    if (isSubagentTool(toolName)) {
      const subagentType = subagentTypeOf(input)
      if (opts.isSubagentBlocked?.(subagentType)) {
        return { behavior: 'deny', message: SUBAGENT_BLOCKED_MESSAGE }
      }
      if (opts.backgroundSubagents) {
        return {
          behavior: 'allow',
          updatedInput: { ...(input as Record<string, unknown>), run_in_background: true }
        }
      }
      // 백그라운드 off — 기존 동작(allow passthrough)로 떨어진다.
    }
    if (toolName === 'AskUserQuestion' && requestApproval) {
      const questions = Array.isArray((input as { questions?: unknown }).questions)
        ? (input as { questions: AskQuestion[] }).questions
        : []
      const res = await requestApproval(
        {
          kind: 'ask_question',
          request: { requestId: '', questions }
        },
        signal
      )
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
      const res = await requestApproval(
        { kind: 'plan_review', request: { requestId: '', plan } },
        signal
      )
      if (res.behavior === 'allow') {
        return { behavior: 'allow', updatedInput: input }
      }
      // deny: planFeedback(구조화 코멘트) 우선 — 자기서술 블록이라 '사용자 수정 요청:' 프리픽스
      // 없이 직렬화. 없으면 message(단순 수정), 둘 다 없으면 거부(reject — turn abort 는 router).
      if (res.planFeedback) {
        return { behavior: 'deny', message: formatPlanFeedbackPrompt(res.planFeedback) }
      }
      if (res.message) {
        return { behavior: 'deny', message: '사용자 수정 요청: ' + res.message }
      }
      return { behavior: 'deny', message: PLAN_REJECT_MESSAGE }
    }
    if (requestApproval && isRiskyTool(toolName)) {
      const res = await requestApproval({ kind: 'tool_approval', toolName, input }, signal)
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

  // 정적 능력 서술자 (claude-probe.ts 의 단일 출처를 반환 — drift 없음).
  describe(): ProviderDescriptor {
    return CLAUDE_DESCRIPTOR
  }

  // 어댑터 소유 에러 정규화 — claude 분류기에 위임하고 provider 는 자기 id 로 채운다.
  classifyError(error: unknown, phase: string): ClassifiedError {
    return claudeErrorClassifier.classify(error, { provider: this.id, phase })
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
    // 모델은 호출자가 요청 전에 결정해 CompleteRequest.model 로 넘긴다 (저가 모델 보유 시
    // 그것을, 없으면 provider default — title-generation/resolveTurnProvider). 어댑터는 받은
    // model 그대로 실행하며, model 미지정이면 runCompletion 이 생략해 SDK 기본 모델을 쓴다.
    // 실패-후-재시도 폴백은 두지 않는다(사전 결정으로 대체). 실패는 호출자가 graceful 처리.
    return this.runCompletion(req)
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
      // 제목 생성 complete 경로는 도구/스킬/MCP 가 필요 없는 1-shot 요약이다.
      // plugin 로딩은 chat sendMessage 경로에만 적용한다.
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
      effort,
      backgroundSubagents,
      isSubagentBlocked,
      attachmentTexts = [],
      attachmentImages = []
    } = req

    // 매퍼 컨텍스트 — sessionId 는 init(=session.updated)에서 갱신된다(resume 면 초기값이 그 id).
    const ctx: MapContext = { sessionId: sessionId ?? '', cwd }

    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (signal?.aborted) abortController.abort()
    else signal?.addEventListener('abort', onAbort)

    // 턴-스코프 입력 스트림 — close() 까지 미종료(streaming-input.ts 가 불변식 격리).
    // steer 는 로컬 홀드(SteerQueue held) 후 PostToolBatch 게이트 훅이 takeSteerFlush 로 병합
    // 배치를 회수해 input.push 로 주입한다(0060 D3·D4). 소비 확정은 CLI 가 흡수 후 되돌려주는
    // user echo(input.echo, claude-map)로 turn-coordinator 가 판정한다(0060 D1)
    // — pull(=SDK eager drain)도 orca 관찰 경계도 flush 신호가 아니다.
    const input = createTurnInputStream(buildTurnContent(text, attachmentTexts, attachmentImages))

    const handle = query({
      prompt: input.stream,
      options: {
        resume: sessionId ?? undefined,
        includePartialMessages: true,
        // steer echo 의 전제 조건(0060 D5). CLI 는 mid-turn drain 한 큐 커맨드(steer)를
        // `--replay-user-messages` 일 때만 user(isReplay: content=원문, uuid=source_uuid=orca
        // batch uuid) 메시지로 output 스트림에 되돌린다 — 기본 off 라 echo 가 아예 안 와서
        // D1 커밋 신호가 영영 발화하지 않았다(v0.3.143 바이너리 직렬화 게이트 실측:
        // `replayUserMessages: h=!1` + `h && attachment.type==="queued_command"` 분기).
        // SDK Options 에 1급 필드가 없어 extraArgs(값 null = bare flag)로 넘긴다.
        // 부작용인 턴 첫 프롬프트 replay echo 는 coordinator 의 매칭 실패 무시로 흡수된다.
        extraArgs: { 'replay-user-messages': null },
        // 서브에이전트(Task) child 의 text/thinking 블록도 forward 받는다 — 기본은 tool_use/
        // tool_result 만 와서 서브에이전트 답변이 우측 패널에 안 보였다(handoff 0044 피드백 2).
        forwardSubagentText: true,
        cwd,
        abortController,
        ...adaptSystemPrompt(extensions.systemPromptAppend),
        ...adaptPlugins(extensions.pluginRoot),
        ...adaptSkills(extensions.skills),
        // provider settings flag 주입 — settings(env 포함 인라인 JSON 문자열, flag 레이어).
        // settingSources 는 생략해 SDK 기본 user/project/local 소스를 상속하고, 이 settings 가
        // 그 위에 얹혀 ~/.claude/settings.json 을 덮어쓴다(env 포함 — handoff 0028).
        // options.env(adaptEnv)에는 시스템(턴) env 만 — orca.json 앱 env.
        ...adaptSettings(req.providerSettings?.settings),
        ...adaptEnv(env),
        // hooks = 중립 정규화 훅 + steer 게이트(PostToolBatch, 메인 루프 한정 flush) 조각 병합.
        ...mergeHooks(
          adaptHooks(extensions.hooks),
          req.takeSteerFlush
            ? makeSteerGateHook(req.takeSteerFlush, (t, u) => input.push(t, u))
            : {}
        ),
        // canUseTool — AskUserQuestion·ExitPlanMode·위험 도구를 requestApproval 로 게이트하고
        // 안전 도구는 allow passthrough. 콜백 미주입(opencode 등) 시 옵션 자체를 생략해 현행
        // 자동 통과 동작을 유지한다.
        ...(requestApproval
          ? {
              canUseTool: makeCanUseTool(requestApproval, {
                ...(backgroundSubagents ? { backgroundSubagents } : {}),
                ...(isSubagentBlocked ? { isSubagentBlocked } : {})
              })
            }
          : {}),
        // 권한 모드 (정규화 6종 → SDK PermissionMode). 부재 시 SDK 기본(default) 동작.
        ...(permissionMode ? { permissionMode: toClaudePermissionMode(permissionMode) } : {}),
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {})
      }
    })

    const close = (): void => input.close()

    async function* events(): AsyncIterable<NormalizedEvent> {
      try {
        for await (const msg of handle) {
          yield* claudeToNormalized(msg, ctx)
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
        close()
        signal?.removeEventListener('abort', onAbort)
      }
    }

    return {
      events: events(),
      close,
      // 라이브 control — 스트리밍 입력 모드라야 동작하는 SDK Query 메서드에 위임.
      setPermissionMode: (mode) => handle.setPermissionMode(mode),
      interrupt: () => handle.interrupt(),
      // steer UX 수용 — 전달은 게이트 훅 flush(takeSteerFlush) 또는 다음 턴 carryover(D2)로.
      canSteer: true,
      setModel: (model) => handle.setModel(model),
      // 서브에이전트 단위 중단 — task_started/notification 의 task_id 로 stopTask.
      stopTask: (taskId) => handle.stopTask(taskId),
      // foreground 서브에이전트를 백그라운드로(필요 시 stopTask 전 fallback). tool_use id 로 단건.
      backgroundTask: (toolUseId) => handle.backgroundTasks(toolUseId)
    }
  }
}

// 턴 입력 content 조립 — 첨부 유무/종류에 따라 string vs content-block 배열을 고른다.
// 텍스트 첨부만 있으면 attachment wrapper 를 본문 text 에 이어붙여 **string 으로 유지**한다
// (무첨부 턴과 동일한 검증된 경로). content-block 배열은 **이미지 블록이 있을 때만** 쓴다 —
// 이미지는 image source 블록이 불가피하기 때문. 순수 함수라 단위 테스트 대상.
export function buildTurnContent(
  text: string,
  attachmentTexts: ExtractedAttachmentText[],
  attachmentImages: ExtractedAttachmentImage[]
): TurnInputContent {
  const mergedText =
    attachmentTexts.length === 0
      ? text
      : [text, ...attachmentTexts.map((a) => formatAttachmentPromptBlock(a))].join('\n\n')
  if (attachmentImages.length === 0) return mergedText
  return [
    { type: 'text', text: mergedText },
    ...attachmentImages.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.data
      } as Base64ImageSource
    }))
  ]
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

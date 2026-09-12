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
  DiffRequirementAnchor,
  NormalizedEvent,
  PermissionAction
} from '../../shared/ipc'
import {
  PLAN_APPROVED_MODE,
  toClaudePermissionMode,
  type NormalizedPermissionMode
} from '../../shared/permission-mode'
import { claudeToNormalized, type MapContext } from './claude-map'
import { readClaudeSessionSchedules } from './claude-schedules'
import { makeOutputFilesHook } from './claude-output-files'
import { ClaudeInputReceipts } from './claude-input-receipts'
import type { SessionSchedule } from '../../shared/session-schedules'
import { claudeErrorClassifier, errorEvent } from './error-classifier'
import { createSessionInputStream, type TurnInputContent } from './streaming-input'
import type { Base64ImageSource } from '@anthropic-ai/sdk/resources/messages'
import { formatAttachmentPromptBlock } from './attachment-prompt'
import { formatDiffRequirementsPrompt } from './diff-requirements'
import { formatPlanFeedbackPrompt } from './plan-feedback'
import { resolvePlanText } from './plan-text'
import type { CompleteRequest, LiveTurn, ProviderMessageBatch, SessionAdapter } from './types'
import type { TurnRequest } from './turn'
import type { ExtractedAttachmentImage, ExtractedAttachmentText } from './turn'
import { isRiskyTool } from './risky-tools'
import { adaptRuntimeTools } from './claude-runtime-tools'
import { runtimeApprovalToolNames } from './runtime-tool-policy'
import {
  adaptExecutionConfig,
  adaptHooks,
  adaptPlugins,
  adaptSkills,
  adaptSystemPrompt,
  makeSteerGateHook,
  makeInputReceiptHook,
  makeTurnEndHook,
  mergeHooks,
  withPostCompactHook
} from './claude-adapt'
import { CLAUDE_DESCRIPTOR } from './descriptor'
import { makeWorkspaceGuardHook, resolveGuardRoots } from './workspace-guard'
import { buildEditPreview, nodeEditPreviewReader } from './edit-preview'
import { resolveClaudeExecutable } from './claude-executable'
import type { ProviderDescriptor } from '../../shared/ipc'

const requireFn = createRequire(import.meta.url)

// SDK 가 spawn 할 claude 실행 파일 경로(**앱 동봉 번들 단일 출처** — 호스트 설치본은 안 본다,
// 0215 D-028). 부팅 1회 해석. undefined 면 옵션을 생략해 SDK 기본 해석에 위임(dev/비패키징 —
// 같은 번들 파일에 도달한다). 근거·패키징 배경은 claude-executable.ts.
// query options 스프레드용으로 파생 옵션을 1회 만든다(runCompletion·sendMessage 공용).
const claudeExecutable = resolveClaudeExecutable()
const claudeExecutableOption = claudeExecutable
  ? { pathToClaudeCodeExecutable: claudeExecutable }
  : {}

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

interface CanUseToolOptions {
  planApprovalMode?: NormalizedPermissionMode
  // 중단된 서브에이전트 타입이면 재호출을 deny(가이드 §6-A). 미주입이면 차단 없음.
  isSubagentBlocked?: (subagentType: string | undefined) => boolean
  // 이번 턴 메인 에이전트의 마지막 서술(0215). `ExitPlanMode` 입력에 계획이 실려 오지 않는
  // 모델에서 계획 본문의 2순위 출처다. 미주입이면 폴백 없이 현행대로 빈 본문이 된다.
  getPlanNarrative?: () => string | undefined
  // readOnlyHint가 true가 아닌 runtime MCP 도구의 완전한 SDK 이름 집합. 미주입이면
  // 기존 위험 도구 정책만 적용한다.
  runtimeApprovalToolNames?: ReadonlySet<string>
}

export function makeCanUseTool(
  requestApproval?: (action: PermissionAction, signal?: AbortSignal) => Promise<ApprovalResolution>,
  opts: CanUseToolOptions = {}
): CanUseTool {
  // options.signal: SDK 가 이 권한요청을 취소하면(control_cancel_request) abort 된다. requestApproval
  // 로 전달해 broker 가 그 신호로도 해소되게 한다 — 무시하면 canUseTool 이 영영 await 에 걸린다.
  return async (toolName, input, options): Promise<PermissionResult> => {
    const signal = options?.signal
    // 서브에이전트 호출 — 재호출 차단(deny)만 판정하고 입력은 passthrough(0143). CLI 2.1.198+
    // 기본 = 백그라운드이며 Orca 런타임(listen 턴)이 이를 기본 경로로 소화한다. run_in_background
    // 는 주입하지 않는다 — 모델이 명시한 값(동기 실행 opt-out 포함)을 그대로 존중한다.
    if (isSubagentTool(toolName)) {
      const subagentType = subagentTypeOf(input)
      if (opts.isSubagentBlocked?.(subagentType)) {
        return { behavior: 'deny', message: SUBAGENT_BLOCKED_MESSAGE }
      }
      return { behavior: 'allow', updatedInput: input }
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
      // 계획 본문은 **주입 필드 하나가 아니라 체인**으로 구한다(0215 D-001) — CLI 는 모델이
      // 계획 파일을 썼을 때만 `plan` 을 싣고, 그 여부는 모델마다 다르다(plan-text.ts 주석).
      const plan = resolvePlanText(input, opts.getPlanNarrative?.())
      const res = await requestApproval(
        { kind: 'plan_review', request: { requestId: '', plan } },
        signal
      )
      if (res.behavior === 'allow') {
        // 계획 승인 = plan 모드 종료. 모드 전환을 **allow 응답에 동봉**해 단일 control_response 로
        // 원자 적용한다 — 별도 setPermissionMode control_request 를 쓰면 allow 가 먼저 도착해
        // 모델이 이미 다음 도구를 부르기 시작하는 순서 경쟁이 남는다. destination='session' 은
        // 인메모리 세션 스코프(설정 파일 미기록) — localSettings/projectSettings 는 쓰지 않는다.
        return {
          behavior: 'allow',
          updatedInput: input,
          updatedPermissions: [
            {
              type: 'setMode',
              mode: toClaudePermissionMode(opts.planApprovalMode ?? PLAN_APPROVED_MODE),
              destination: 'session'
            }
          ]
        }
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
    if (
      requestApproval &&
      (isRiskyTool(toolName) || opts.runtimeApprovalToolNames?.has(toolName))
    ) {
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
    // settingSources 는 ['project','local'] 로 명시해 user 소스를 배제한다(handoff 0117 — 0028
    // 의 "생략=기본 소스 상속" supersede). provider settings(env 포함 인라인 JSON, adaptSettings)
    // 가 사용자 전역 ~/.claude/settings.json 개입 없이 적용된다.
    // options.env(adaptEnv)에는 시스템(턴) env 만.
    const options: Options = {
      abortController,
      maxTurns: 1,
      tools: [],
      allowedTools: [],
      // 제목 생성 complete 경로는 도구/스킬/MCP 가 필요 없는 1-shot 요약이다.
      // plugin 로딩은 chat sendMessage 경로에만 적용한다.
      persistSession: false,
      ...claudeExecutableOption,
      ...adaptExecutionConfig(req.providerSettings?.settings, req.env),
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

  // **장수명 세션 채널**을 연다(0067 — 구 PR③ 옵션 A 의 턴-스코프 폐기). prompt 를 세션 수명
  // 동안 열려있는 AsyncIterable 로 넘겨, result 후에도 서브프로세스가 살아남아 후속 턴을
  // `pushTurn`(라이브 setter + content push)으로 이어받는다. 스트림 절단(1 프레임=1 턴)은
  // SessionRuntime 몫이고, 입력 close 는 세션 폐기(LRU 축출·종료·respawn 경계·에러)에서만.
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
      isSubagentBlocked,
      attachmentTexts = [],
      attachmentImages = [],
      requirements = []
    } = req

    // 매퍼 컨텍스트 — sessionId 는 init(=session.updated)에서 갱신된다(resume 면 초기값이 그 id).
    // handoffArrival(0127): 핸드오프 도착 턴 표식 — 경계 이전 승계 컨텍스트 usage 를 매퍼가 무효화.
    const ctx: MapContext = {
      sessionId: sessionId ?? '',
      cwd,
      ...(req.handoff === true ? { handoffArrival: true } : {})
    }

    const abortController = new AbortController()
    const onAbort = (): void => abortController.abort()
    if (signal?.aborted) abortController.abort()
    else signal?.addEventListener('abort', onAbort)

    // 세션-스코프 입력 스트림 — close() 까지 미종료(streaming-input.ts 가 불변식 격리).
    // steer 는 로컬 홀드(PendingMessageQueue held) 후 PostToolBatch 게이트 훅이 takeSteerFlush 로 병합
    // 배치를 회수해 input.push 로 주입한다(0060 D3·D4). 소비 확정은 CLI 가 흡수 후 되돌려주는
    // user echo(input.echo, claude-map)로 turn-coordinator 가 판정한다(0060 D1)
    // — pull(=SDK eager drain)도 orca 관찰 경계도 flush 신호가 아니다.
    // 스폰 초기 입력 = 프렐류드(채널 사망 후 이월 배치 — 각자 uuid 로 개별 echo→커밋) 다음에
    // 본 프롬프트. CLI 는 턴 시작에 전부 coalesce 해 개별 user 메시지로 소비한다(명세 C9).
    const batchContent = (b: {
      text: string
      attachmentTexts?: typeof attachmentTexts
      attachmentImages?: typeof attachmentImages
      requirements?: typeof requirements
    }): TurnInputContent =>
      buildTurnContent(
        b.text,
        b.attachmentTexts ?? [],
        b.attachmentImages ?? [],
        b.requirements ?? []
      )
    const initialInputs = [
      ...(req.preludes ?? []).map((b) => ({ content: batchContent(b), uuid: b.uuid })),
      {
        content: buildTurnContent(text, attachmentTexts, attachmentImages, requirements),
        ...(req.promptUuid !== undefined ? { uuid: req.promptUuid } : {})
      }
    ]
    const receipts = new ClaudeInputReceipts()
    for (const item of initialInputs) receipts.submitted(item.content, item.uuid)
    const input = createSessionInputStream(initialInputs)
    const pushInput = (content: TurnInputContent, uuid?: string): boolean => {
      if (!input.push(content, uuid)) return false
      receipts.submitted(content, uuid)
      return true
    }

    // 압축 요약 surface (0064 r3) — PostCompact hook 이 전달한 compact_summary 를 assistant
    // 메시지로 승격할 대기열. hook 콜백은 스트림 밖에서 도착하므로 events() 가 SDK 메시지
    // 경계마다 드레인해 [compact 구분선 → 요약 메시지] 순서로 합류시킨다.
    const compactSummaries: string[] = []

    // 턴 종료 신호 대기열 (0211 ΔV6 D-115). `Stop` hook 은 스트림 밖에서 도착하므로 압축 요약과
    // 같은 형태로 적재하고 events() 가 SDK 메시지 경계마다 드레인한다. 예약 스냅샷도
    // 동기적으로 복사만 하며 hook 안에서 조회나 renderer 응답을 기다리지 않는다.
    let turnEndSignals = 0
    const scheduleSnapshots: SessionSchedule[][] = []
    const capturedOutputs: Array<{
      event: Extract<NormalizedEvent, { type: 'output.captured' }>
      signal: AbortSignal
      responseScope?: number
    }> = []
    // The initial input already owns a response, even if its Stop hook races the
    // iterator's first assistant message. Later responses reopen on main input/output.
    let responseScope = 1
    let responseOpen = true

    // Workspace 격리(0075) — 작업 폴더(cwd) 밖 r/w 를 PreToolUse 가드 훅으로 막는다. additionalDirectories
    // 는 옵션과 훅이 **같은 배열**을 공유해 드리프트를 막는다(가이드 §5). 값은 컴포저 참조 경로
    // 신규 칩 또는 유휴 Work의 명시 폴더 추가가 DB를 거쳐 턴 요청에 실린다.
    const additionalDirectories: string[] = extensions.outputFiles
      ? [...new Set([...(req.extraDirs ?? []), extensions.outputFiles.directory])]
      : (req.extraDirs ?? [])
    const runtimeToolApprovalNames = runtimeApprovalToolNames(extensions.runtimeTools)
    // 실행 전 편집 미리보기(0229) — 가드 훅과 **같은 입력**으로 루트를 턴당 1회 푼다. 편집이 쓸 수
    // 없는 경로는 미리보기로도 읽지 않는다.
    const previewRoots = resolveGuardRoots(cwd, additionalDirectories)
    const readForPreview = nodeEditPreviewReader()

    const handle = query({
      prompt: input.stream,
      options: {
        // fork/handoff(0064) — forkFrom 세션의 이력 복사본으로 시작하되 SDK 가 새 session_id
        // 를 발급한다(원본 불변). 새 id 는 init(session.updated)에서 ctx 로 흡수된다.
        resume: req.forkFrom ?? sessionId ?? undefined,
        ...(req.forkFrom !== undefined ? { forkSession: true } : {}),
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
        // 0231 F-05 — 서브에이전트가 "지금 무엇을 하는 중인지" 한 줄 현재형 요약을 내도록 한다
        // (`task_progress.summary`). 기본 false 이고, 켜면 서브에이전트의 모델·프롬프트 캐시를
        // 재사용하는 fork 라 SDK 문서가 비용을 "typically minimal" 로 적는다(`sdk.d.ts`).
        // 이 값이 없으면 실행 줄의 요약 자리가 영원히 비어 소비자만 있고 producer 가 없다.
        agentProgressSummaries: true,
        cwd,
        // 작업 폴더 밖 파일툴 write 스코프를 넓히지 않도록 SDK 내장 스코프에도 동일 배열을 반영(가드 훅과 짝).
        additionalDirectories,
        abortController,
        // claude 실행 파일 경로(앱 동봉 번들 단일 출처). undefined 면 생략해 SDK 기본 해석.
        ...claudeExecutableOption,
        ...adaptSystemPrompt(extensions.systemPromptAppend),
        // Orca plugin + 사용자 ~/.claude/skills 래퍼 plugin(0117) — user 소스 배제로 끊긴
        // ~/.claude/skills 를 dist/claude/plugins/claude(정션/심링크)로 보전한다.
        ...adaptPlugins(extensions.pluginRoots),
        ...adaptSkills(extensions.skills),
        // provider settings flag 주입 — settings(env 포함 인라인 JSON 문자열, flag 레이어).
        // settingSources 는 ['project','local'] 로 명시해 user 소스를 배제한다(handoff 0117 —
        // 0028 의 "생략=기본 소스 상속" supersede). provider settings 가 사용자 전역
        // ~/.claude/settings.json 개입 없이 적용된다.
        // options.env(adaptEnv)에는 시스템(턴) env 만 — orca.json 앱 env.
        ...adaptExecutionConfig(req.providerSettings?.settings, env),
        disallowedTools: ['Bash', 'WebSearch'],
        ...adaptRuntimeTools(extensions.runtimeTools, req.runtimeToolContext),
        // hooks = 중립 정규화 훅 + steer 게이트(PostToolBatch, 메인 루프 한정 flush) 병합 위에
        // 어댑터 내부 PostCompact(압축 요약 수집, manual 만·0064) 를 덧씌운다.
        ...withPostCompactHook(
          mergeHooks(
            adaptHooks(extensions.hooks),
            makeOutputFilesHook(
              extensions.outputFiles,
              req.runtimeToolContext,
              (artifact, toolRunId, signal, scope) => {
                capturedOutputs.push({
                  event: {
                    type: 'output.captured',
                    sessionId: ctx.sessionId,
                    artifact,
                    ...(toolRunId ? { toolRunId } : {})
                  },
                  signal,
                  responseScope: scope
                })
              },
              () => (responseOpen ? responseScope : undefined)
            ),
            makeInputReceiptHook((input) => {
              if (!responseOpen) {
                responseOpen = true
                responseScope++
              }
              receipts.prompt(input)
            }),
            // 턴 종료(Stop) — git 변경 목록 싱크의 유일한 계기다(0211 ΔV6 D-115, §10 EP-46 ①).
            makeTurnEndHook((input) => {
              const schedules = readClaudeSessionSchedules(input)
              if (schedules !== undefined) {
                scheduleSnapshots.push(schedules)
              }
              turnEndSignals += 1
            }),
            // 격리 가드(PreToolUse) — 모든 툴·모든 모드보다 먼저 밖 경로를 자른다(0075). 안·예외는
            // pass-through 라 아래 canUseTool/permissionMode 흐름은 그대로 유지된다.
            makeWorkspaceGuardHook(cwd, additionalDirectories),
            req.takeSteerFlush
              ? makeSteerGateHook(
                  req.takeSteerFlush,
                  (batch) => pushInput(batchContent(batch), batch.uuid),
                  req.rollbackSteerFlush,
                  req.commitSteerFlush
                )
              : {}
          ),
          (summary) => compactSummaries.push(summary)
        ),
        // canUseTool — AskUserQuestion·ExitPlanMode·위험 도구를 requestApproval 로 게이트하고
        // 안전 도구는 allow passthrough. 콜백 미주입(opencode 등) 시 옵션 자체를 생략해 현행
        // 자동 통과 동작을 유지한다.
        ...(requestApproval
          ? {
              canUseTool: makeCanUseTool(requestApproval, {
                runtimeApprovalToolNames: runtimeToolApprovalNames,
                ...(req.planApprovalMode ? { planApprovalMode: req.planApprovalMode } : {}),
                // 매퍼가 쓰는 **같은 ctx** 를 읽는다(0215 EP-01) — 이 인자를 빼면 계획을
                // 입력에 싣지 않는 모델에서 우측 패널이 다시 빈다.
                getPlanNarrative: () => ctx.lastAssistantText,
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

    const close = (): void => {
      capturedOutputs.length = 0
      input.close()
      receipts.close()
    }

    // 대기 중인 압축 요약을 assistant 메시지 이벤트로 비운다 — persist(text 파트)와 렌더
    // (마크다운 메시지)가 일반 message.completed 경로를 그대로 탄다. 새 세션(fork/handoff)에서
    // init 이 늦으면 ctx.sessionId 가 아직 '' — 그 동안은 보류한다(sessionId 없는 이벤트는
    // persist 가 드롭해 재로드에서 요약이 유실된다, 0064 r4). 스트림 종료 시엔 최종 드레인이
    // 표시만이라도 살리도록 무조건 비운다.
    function* drainCompactSummaries(force = false): Iterable<NormalizedEvent> {
      if (ctx.sessionId === '' && !force) return
      while (compactSummaries.length > 0) {
        yield {
          type: 'message.completed',
          sessionId: ctx.sessionId,
          message: { text: compactSummaries.shift()! }
        }
      }
    }

    // 대기 중인 턴 종료 신호를 `turn.ended` 이벤트로 비운다 (0211 ΔV6 D-115, §10 EP-46 ②).
    // `Stop` 은 SDK `result` 보다 먼저 완료되므로 메시지 뒤 드레인이 [결과 → 종료] 순서를
    // 만든다 — 순서가 반대여도 renderer 의 tick 은 같은 값이라 계기는 성립한다.
    function* drainTurnEnded(): Iterable<NormalizedEvent> {
      while (turnEndSignals > 0) {
        turnEndSignals -= 1
        yield { type: 'turn.ended', sessionId: ctx.sessionId }
      }
    }

    function* drainSchedules(): Iterable<NormalizedEvent> {
      while (scheduleSnapshots.length > 0) {
        const schedules = scheduleSnapshots.shift()!
        ctx.sessionSchedules = schedules
        ctx.pendingWakeup = false
        yield {
          type: 'session.schedules',
          sessionId: ctx.sessionId,
          schedules,
          pendingWakeup: false
        }
      }
    }

    async function* eventBatches(): AsyncIterable<ProviderMessageBatch> {
      let sequence = 0
      try {
        for await (const msg of handle) {
          const mainMessage = !('parent_tool_use_id' in msg) || msg.parent_tool_use_id == null
          if (
            !responseOpen &&
            mainMessage &&
            (msg.type === 'assistant' || msg.type === 'stream_event')
          ) {
            responseOpen = true
            responseScope++
          }
          const events = claudeToNormalized(msg, ctx).flatMap<NormalizedEvent>((event) => {
            if (event.type === 'tool.call.started') {
              const hunks = buildEditPreview(
                event.toolName,
                event.args,
                previewRoots,
                readForPreview
              )
              return [hunks ? { ...event, editPreview: { structuredPatch: hunks } } : event]
            }
            if (event.type !== 'input.received' && event.type !== 'input.echo') return [event]
            const reconciled = receipts.reconcile(event)
            return reconciled ? [reconciled] : []
          })
          if (msg.type === 'assistant' || msg.type === 'stream_event' || msg.type === 'result') {
            events.unshift(...receipts.drain(ctx.sessionId))
          }
          if (msg.type === 'result') receipts.finishResponse()
          // Stop callback은 이미 출력된 tool_result의 소비보다 먼저 도착할 수 있다.
          // 그 영수증들을 모두 처리한 result 경계에서 정본을 적용하되 telemetry보다 먼저 보낸다.
          if (msg.type === 'result') {
            // Stop captures belong to this result, before telemetry closes its assistant message.
            // Tool captures carry their original call ID, including late child results.
            const terminal = events.findIndex((event) => event.type === 'telemetry')
            events.splice(
              terminal < 0 ? events.length : terminal,
              0,
              ...capturedOutputs
                .splice(0)
                .filter(
                  (capture) =>
                    !capture.signal.aborted &&
                    (capture.event.toolRunId !== undefined ||
                      capture.responseScope === responseScope)
                )
                .map((capture) => capture.event)
            )
            events.unshift(...drainSchedules())
            responseOpen = false
          }
          // hook 은 다음 SDK 메시지(compact_boundary/result)보다 먼저 완료되므로 메시지 뒤
          // 드레인이 [구분선 → 요약] 순서를 만든다.
          events.push(...drainCompactSummaries())
          events.push(...drainTurnEnded())
          if (events.length > 0) yield { sequence: sequence++, events }
        }
        const summaries = [
          ...receipts.drain(ctx.sessionId),
          ...drainSchedules(),
          ...drainCompactSummaries(true),
          ...drainTurnEnded()
        ]
        if (summaries.length > 0) yield { sequence: sequence++, events: summaries }
      } catch (err) {
        const events: NormalizedEvent[] = [
          ...receipts.drain(ctx.sessionId),
          ...drainSchedules(),
          ...drainTurnEnded()
        ]
        // 의도적 중단(턴 취소 / 계획 거부)은 에러가 아니므로 error 이벤트를 내지 않는다
        // (user_cancelled 로 분류되지만 emit 안 함 — 설계 결정 3).
        if (!abortController.signal.aborted) {
          const classified = claudeErrorClassifier.classify(err, {
            provider: 'claude',
            phase: 'sendMessage'
          })
          events.push(errorEvent(classified, ctx.sessionId))
        }
        if (events.length > 0) yield { sequence: sequence++, events }
      } finally {
        // 어떤 경로로 끝나든 입력 스트림을 닫아(멱등) 핸들/서브프로세스 누수를 막는다.
        close()
        signal?.removeEventListener('abort', onAbort)
      }
    }

    return {
      eventBatches: eventBatches(),
      close,
      // 장수명 채널(0067) — 후속 턴을 같은 서브프로세스에 이어붙인다. 라이브 setter 적용 후
      // content 를 push(P2 픽업 또는 P1 게이트 drain — 분기는 CLI). effort/providerSettings/
      // extensions 변경은 respawn 경계(호출자 소관). setter 실패는 push 전에 던져져 호출자
      // (SessionRuntime frame)가 스폰 폴백/에러 처리한다.
      pushTurn: async (next) => {
        if (next.model !== undefined) await handle.setModel(next.model)
        if (next.permissionMode !== undefined) {
          await handle.setPermissionMode(toClaudePermissionMode(next.permissionMode))
        }
        return pushInput(
          buildTurnContent(
            next.text,
            next.attachmentTexts ?? [],
            next.attachmentImages ?? [],
            next.requirements ?? []
          ),
          next.promptUuid
        )
          ? { kind: 'accepted' as const }
          : { kind: 'rejectedBeforeAccept' as const, reason: 'stream_closed' as const }
      },
      // 라이브 control — 스트리밍 입력 모드라야 동작하는 SDK Query 메서드에 위임.
      setPermissionMode: (mode) => handle.setPermissionMode(mode),
      // 중단 영수증(0151 AC10) — SDK 0.3.2xx 의 `interrupt()` 는 `SDKControlInterruptResponse |
      // undefined` 를 돌려준다(`sdk.d.ts:2293`). 구 구현은 이를 폐기해 "중단 뒤에도 실행될 잔여"
      // 를 앱이 알 수 없었다. `undefined`(구형 CLI = `interrupt_receipt_v1` 미보유)는 **그대로**
      // 전파한다 — 빈 배열로 뭉개면 "잔여 없음" 과 "잔여 미상" 이 구분되지 않는다.
      // `cancel_queued:true` 는 공개 `interrupt()` 시그니처에 인자가 없어 도달 불가하므로
      // (`sdk.mjs` 가 `{subtype:"interrupt"}` 하드코딩) 잔여 취소는 이 경로로 할 수 없다.
      interrupt: async () => {
        const res = await handle.interrupt()
        if (!res || !Array.isArray(res.still_queued)) return undefined
        return { stillQueued: res.still_queued.filter((u): u is string => typeof u === 'string') }
      },
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
  attachmentImages: ExtractedAttachmentImage[],
  requirements: DiffRequirementAnchor[]
): TurnInputContent {
  const mergedTextParts = [text]
  if (attachmentTexts.length > 0) {
    mergedTextParts.push(...attachmentTexts.map((a) => formatAttachmentPromptBlock(a)))
  }
  for (const image of attachmentImages) {
    if (image.path)
      mergedTextParts.push(
        formatAttachmentPromptBlock({
          ...image,
          text: '',
          charsOriginal: 0,
          charsIncluded: 0,
          truncated: false
        })
      )
  }
  if (requirements.length > 0) {
    mergedTextParts.push(formatDiffRequirementsPrompt(requirements))
  }
  const mergedText = mergedTextParts.join('\n\n')
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

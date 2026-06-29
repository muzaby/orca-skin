// chat 턴 파이프라인 — orca:chat:send 의 이벤트 루프(어댑터 LiveTurn 소비 → persist →
// sendChatEvent)와 orca:chat:cancel. 턴 상태는 TurnRegistry, 영속은 TurnPersistence,
// 승인 왕복은 ApprovalCoordinator 에 위임하고 여기는 오케스트레이션만 담당한다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  CHANNELS,
  type ApprovalResolution,
  type NormalizedEvent,
  type PermissionAction
} from '../../../shared/ipc'
import {
  CancelChatSchema,
  SendChatMessageSchema,
  StopSubagentSchema
} from '../../../shared/protocol'
import { normalizeAttachments } from '../../files/attachments'
import { appEnv } from '../../config/orca-config'
import {
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  modelNameForFamily,
  resolveTitleModel,
  type ResolvedProviderSettings
} from '../../settings/provider-settings'
import type { SessionAdapter } from '../../adapters/types'
import { agentPermissionRequest } from '../../runtime-events/permission-bridge'
import type { PermissionModeController } from '../../runtime-events/permission-mode-controller'
import { makeClassifiedError } from '../../runtime-errors/classifier'
import { sendChatEvent, type RouterContext } from '../context'
import { previewOf } from '../dto'
import { handle, handlePlain } from '../registry'
import type { ApprovalCoordinator } from './approvals'
import type { TurnPersistence } from './persist'
import type { TitleGenerator } from './title-generation'
import { coerceStoppedToolCompletion, createSubagentSettlementEvents } from './subagent-settlement'
import {
  createInflightTurn,
  type InflightTurn,
  type TurnRegistry
} from '../../lifecycle/turn-context'
import { OneShotSessionRuntime, type SessionRuntime } from '../../lifecycle/session-runtime'
import { recoverDanglingToolCalls } from '../../lifecycle/recovery'

import {
  createIdleTimer,
  createStallTimer,
  IDLE_TIMEOUT_MS,
  STALL_TIMEOUT_MS,
  type IdleTimer,
  type StallTimer
} from '../../lifecycle/timers'

export {
  createIdleTimer,
  createStallTimer,
  IDLE_TIMEOUT_MS,
  STALL_TIMEOUT_MS,
  type IdleTimer,
  type StallTimer
}

export const MAX_RETRIES = 2
export const RETRY_BACKOFF_MS = [1_000, 2_000] as const

export async function drainRuntimeEventsForTest(
  runtime: Pick<SessionRuntime, 'send'>,
  req: Parameters<SessionRuntime['send']>[0]
): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = []
  for await (const ev of runtime.send(req)) events.push(ev)
  return events
}

export interface ChatDeps {
  ctx: RouterContext
  turns: TurnRegistry<WebContents>
  approvals: ApprovalCoordinator
  persistence: TurnPersistence
  titles: TitleGenerator
  permissionModes: PermissionModeController
}

export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Aborted'))
      },
      { once: true }
    )
  })
}

// 턴이 정상 완료 없이 끊길 때(중단·타임아웃·에러) 아직 열려 있는 도구 실행을 합성 tool_result 로
// 정착시킨다. 결과가 영영 안 오면 렌더가 "실행 중"(epitaxy-text-shine)으로 무한 렌더되고 부모
// Task 도 "진행 중"으로 남으므로, abort 마커(reason)를 담은 tool.call.completed 를 방출+영속한다.
// AskUserQuestion tool_result 합성(flushAskAnswers)과 동형의 보정 — toolRunId 멱등(upsert).
export function settleOpenToolRuns(
  turn: InflightTurn<WebContents>,
  persistence: TurnPersistence,
  kind: 'aborted' | 'failed'
): void {
  if (turn.openToolRuns.size === 0) return
  const result =
    kind === 'aborted'
      ? { reason: 'aborted', message: '사용자가 중단했습니다' }
      : { reason: 'failed', message: '오류로 중단되었습니다' }
  for (const [toolRunId, info] of turn.openToolRuns) {
    const ev = {
      type: 'tool.call.completed',
      sessionId: turn.dbSessionId ?? '',
      toolRunId,
      result,
      isError: true,
      ...(info.parentToolRunId !== undefined ? { parentToolRunId: info.parentToolRunId } : {})
    } as const
    persistence.persist(turn, ev)
    sendChatEvent(turn.owner, ev)
  }
  turn.openToolRuns.clear()
}

// subagent.task settled(stopped/failed/completed) 수신 또는 사용자 중단 클릭 시 부모 Task 와
// 해당 부모 아래 열린 child 도구를 transcript 권위 tool_result 로 정착한다. SDK stopTask 는 제어
// 신호이고, 이 정착 이벤트들이 루트/전용 transcript 의 UI 상태 SSOT 다.
function settleSubagentTask(
  turn: InflightTurn<WebContents>,
  persistence: TurnPersistence,
  ev: Extract<NormalizedEvent, { type: 'subagent.task' }>
): void {
  const events = createSubagentSettlementEvents({
    sessionId: turn.dbSessionId ?? ev.sessionId,
    task: ev,
    openToolRuns: turn.openToolRuns
  })
  for (const out of events) {
    persistence.persist(turn, out)
    sendChatEvent(turn.owner, out)
    turn.openToolRuns.delete(out.toolRunId)
  }
}

async function stopLiveSubagent(
  turn: InflightTurn<WebContents>,
  toolUseId: string,
  taskId: string | undefined,
  backgroundSubagents: boolean
): Promise<void> {
  if (!turn.live) return
  // foreground Task 는 먼저 background control-request 로 루트 턴에서 분리해야 stopTask 가 실제
  // 작업 취소로 이어진다. 이미 background 로 시작된 경우에는 불필요한 backgroundTask 를 건너뛴다.
  if (!backgroundSubagents) {
    await turn.live.backgroundTask(toolUseId).catch(() => false)
  }
  if (!taskId) return
  await turn.live.stopTask(taskId).catch(() => undefined)
}

// 턴 단위 provider/model 해석 (handoff 0010 → 0014) — payload providerKey 가 어댑터와
// 일치하면 적용, 불일치/무효면 세션의 마지막 provider_key → 기본 provider(anthropic 우선) 폴백.
// 원천은 sources/settings/<adapter>/ 트리(ProviderSettingsService)이며, settings 해석(blob)은
// dist 캐시에서 가져온다. 비밀(secret-store 토큰·${VAR})은 해석기 내부에서만 평문화된다.
async function resolveTurnProvider(
  ctx: RouterContext,
  req: {
    adapter: SessionAdapter
    sessionId: string | null
    providerKey: string | null
    modelFamily: string | null
  }
): Promise<{
  providerSettings?: ResolvedProviderSettings
  providerKey: string | null
  model?: string
  titleModel?: string
}> {
  const entries = ctx.providerSettings.list(req.adapter.id)
  const meta = req.sessionId ? ctx.db.getSessionById(req.sessionId) : undefined
  const byKey = (key: string | null | undefined): (typeof entries)[number] | undefined =>
    key ? entries.find((entry) => entry.key === key) : undefined

  let selected = byKey(req.providerKey)
  if (req.sessionId && selected && selected.adapter !== meta?.backend) {
    console.warn(
      `[provider-settings] providerKey '${req.providerKey}' adapter 불일치 — 세션 provider 로 fallback`
    )
    selected = undefined
  }
  if (req.sessionId && !selected) selected = byKey(meta?.provider_key)
  if (!selected) selected = defaultProvider(entries)
  if (!selected) return { providerKey: null }

  const providerSettings = await ctx.providerSettings.resolve(selected)
  const modelFamily = req.modelFamily ?? defaultModelFamily(selected.models)
  const model = modelNameForFamily(selected.models, modelFamily)
  // 제목 생성 모델은 요청 전에 사전 선택한다 (저가 모델 보유 시 그것, 없으면 default — 정책은
  // settings 레이어 resolveTitleModel 에 둔다).
  const titleModel = resolveTitleModel(selected.models)
  return {
    providerKey: selected.key,
    ...(providerSettings ? { providerSettings } : {}),
    ...(model ? { model } : {}),
    ...(titleModel ? { titleModel } : {})
  }
}

// subprocess env 조립 — orca.json 앱 전역 env(${VAR} 확장)를 SDK subprocess env 로 전달.
function buildTurnEnv(ctx: RouterContext): Record<string, string> | undefined {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length > 0) {
    console.warn(`[orca-config] 미해결 환경변수로 일부 앱 env 키를 건너뜀: ${missing.join(', ')}`)
  }
  return Object.keys(expanded).length > 0
    ? ({ ...process.env, ...expanded } as Record<string, string>)
    : undefined
}

export function registerChatHandlers(deps: ChatDeps): void {
  const { ctx, turns, approvals, persistence, titles, permissionModes } = deps

  // 서브에이전트 백그라운드화 게이트(가이드 — run_in_background 주입). 종료 정착은
  // task_notification/사용자 중단 공통 경로에서 foreground/background 모두 처리한다.
  const backgroundSubagents = process.env.ORCA_SUBAGENT_BACKGROUND === '1'

  const handleChatSend = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = SendChatMessageSchema.safeParse(raw)
    if (!parsed.success) {
      // 세션-이전 에러(0016): 세션도 활성 어댑터도 없어 provider 를 파생할 수 없다 — 이벤트·
      // ClassifiedError 모두 provider 부재가 정상.
      sendChatEvent(event.sender, {
        type: 'error',
        error: makeClassifiedError('schema_validation_error', 'invalid chat:send payload', {
          retryable: false
        })
      })
      return
    }

    // 동시 턴 가드 — 서로 다른 세션의 동시 턴은 허용하되, 같은 세션(또는 같은 창의 새-채팅
    // 슬롯)의 중복 send 는 거부한다. resume 컨텍스트가 꼬이는 것을 막는 보호선.
    const duplicate = parsed.data.sessionId
      ? turns.hasSession(parsed.data.sessionId)
      : turns.hasPending(event.sender)
    if (duplicate) {
      sendChatEvent(event.sender, {
        type: 'error',
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        error: makeClassifiedError(
          'provider_connection_error',
          '이미 진행 중인 턴이 있습니다. 완료 후 다시 시도하세요.',
          { retryable: true }
        )
      })
      return
    }

    if (parsed.data.sessionId && !turns.hasSession(parsed.data.sessionId)) {
      recoverDanglingToolCalls(ctx.db)
    }

    const adapter =
      ctx.mockAdapter && ctx.debugMock.enabled ? ctx.mockAdapter : ctx.registry.getActive()
    if (!adapter) {
      // 세션-이전 에러(0016): 활성 어댑터 부재가 곧 이 에러의 원인 — provider 부재가 정상.
      sendChatEvent(event.sender, {
        type: 'error',
        error: makeClassifiedError('provider_connection_error', '활성 백엔드가 없습니다.', {
          retryable: true
        })
      })
      return
    }

    const resolved = await resolveTurnProvider(ctx, {
      adapter,
      sessionId: parsed.data.sessionId,
      providerKey: parsed.data.providerKey ?? null,
      modelFamily: parsed.data.modelFamily ?? null
    })

    // orca.json 앱 전역 env. Python 런타임 env(uv)는 0049 PR-B에서 제거됨.
    const turnEnv = buildTurnEnv(ctx)

    const boundProjectId = parsed.data.sessionId
      ? (ctx.db.getSessionById(parsed.data.sessionId)?.project_id ?? null)
      : parsed.data.projectId

    // 첨부 정규화(경로 추출·이미지 읽기·검증)는 턴 시작 전 단계라 아래 턴 try/catch 밖이다.
    // 여기서 throw 하면(홈 밖 경로·unsupported·binary·fs 오류) invoke 가 거부돼 renderer 의
    // fire-and-forget send 가 콘솔 rejection 으로만 남는다 → 정규 chat:error 로 surface 한다.
    let normalizedAttachments: Awaited<ReturnType<typeof normalizeAttachments>>
    try {
      normalizedAttachments = await normalizeAttachments(parsed.data.attachments)
    } catch (err) {
      sendChatEvent(event.sender, {
        type: 'error',
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        error: makeClassifiedError('schema_validation_error', '첨부 파일을 처리할 수 없습니다.', {
          retryable: false,
          cause: err
        })
      })
      return
    }

    const controller = new AbortController()
    // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
    // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
    const turn: InflightTurn<WebContents> = createInflightTurn({
      controller,
      owner: event.sender,
      live: null,
      titleAdapter: adapter,
      titleSettings: resolved.providerSettings,
      titleEnv: turnEnv,
      titleModel: resolved.titleModel,
      providerKey: resolved.providerKey,
      pendingUserText: parsed.data.text,
      firstUserText: parsed.data.text,
      pendingAttachmentViews: parsed.data.attachmentViews,
      dbSessionId: parsed.data.sessionId,
      pendingProjectId: parsed.data.sessionId ? null : parsed.data.projectId,
      isNewSession: parsed.data.sessionId == null,
      cwd: ctx.getCwd(boundProjectId),
      titleGenerationStarted: false,
      currentAssistantMessageId: null,
      assistantText: '',
      pendingAskAnswers: [],
      askPendingIds: [],
      askResolved: new Map(),
      subagentTaskIds: new Map(),
      openToolRuns: new Map(),
      subagentTypes: new Map(),
      blockedSubagents: new Set(),
      stoppedSubagents: new Set()
    })
    if (parsed.data.sessionId) turns.startResume(parsed.data.sessionId, turn)
    else turns.startNew(event.sender, turn)

    // resume 경로: sessionId 가 들어왔다는 건 이전 init 으로 sessions row 가 이미
    // 존재한다는 의미. 다음 init 이벤트를 기다리지 않고 user 메시지를 즉시 기록.
    if (parsed.data.sessionId) {
      const now = Date.now()
      persistence.persistUserMessage(
        parsed.data.sessionId,
        parsed.data.text,
        now,
        parsed.data.attachmentViews
      )
      ctx.db.updateSessionPreview(parsed.data.sessionId, previewOf(parsed.data.text), now)
      ctx.db.updateSessionProviderKey(parsed.data.sessionId, turn.providerKey, now)
      turn.pendingUserText = null
    }

    // 파일 싱크는 이 cwd 가 이번 실행에서 처음 쓰일 때만 1회(overwrite-merge). 활성/비활성
    // 토글은 파일이 아니라 런타임 options.skills 가 반영하므로 매 턴 재싱크가 불필요하다.
    ctx.syncExtensionsForTurn(turn.cwd)

    // 백엔드 중립 확장 리소스(지침+정적 정책 append · MCP · skills · hooks)를 빌더가 조립.
    // resume 면 projectId 는 세션 바인딩에서 조회되므로 null 을 넘긴다.
    const extensions = ctx.extensions.build(
      parsed.data.sessionId,
      parsed.data.sessionId ? null : parsed.data.projectId
    )

    // 단일 권한 승인 위임 — 어댑터의 canUseTool 이 ask_question·plan_review·tool_approval 중
    // 하나를 PermissionAction 으로 넘기면, approvalId 를 발급해 permission.requested 이벤트로
    // renderer 에 surface 하고 broker 가 응답(또는 turn abort)까지 Promise 를 보류한다.
    // tool_approval 은 "세션 동안 허용"으로 부여된 도구면 카드 없이 즉시 allow 한다.
    const wc = event.sender
    // idle 타이머 인디렉션 — requestApproval(승인 보류 중 pause)과 attempt 루프가 같은 핸들을
    // 공유한다. requestApproval 은 idle 생성(attempt 루프 안)보다 바깥 스코프라 직접 못 잡는다.
    // 동시 보류(서브에이전트 병렬 승인)는 beginPause refcount 가 처리한다.
    let activeIdle: IdleTimer | null = null
    // 렌더러(owner) 소멸 시 진행 턴 정리 — idle "완전 멈춤"으로 잃는 자가치유(무응답 abort)를
    // 타이머가 아닌 이벤트로 대체한다(사람 판단엔 시간 제한 두지 않음 유지). 바깥 finally 에서 해제.
    const onOwnerGone = (): void => {
      turn.abort('user_cancelled')
    }
    wc.once('destroyed', onOwnerGone)
    wc.once('render-process-gone', onOwnerGone)
    const requestApproval = async (
      action: PermissionAction,
      sdkSignal?: AbortSignal
    ): Promise<ApprovalResolution> => {
      // 세션 자동 허용된 위험 도구는 카드 미surface — 즉시 통과.
      if (action.kind === 'tool_approval') {
        const sid = turn.dbSessionId
        if (sid && approvals.isSessionAllowed(sid, action.toolName)) {
          return { behavior: 'allow' }
        }
      }
      const approvalId = randomUUID()
      // 어댑터가 넘긴 request.requestId 는 비어 있으므로 approvalId 를 주입한다 — renderer 의
      // 카드(pendingAsks/pendingPlanReview)가 이 id 로 permissionRespond 회신할 수 있게.
      const outbound: PermissionAction =
        action.kind === 'tool_approval'
          ? action
          : action.kind === 'ask_question'
            ? { kind: 'ask_question', request: { ...action.request, requestId: approvalId } }
            : { kind: 'plan_review', request: { ...action.request, requestId: approvalId } }
      // permission.requested 에 소유 세션을 실어 renderer 가 activeKey 폴백 없이 정확한
      // 세션 엔트리로 라우팅하게 한다. 불변식: 권한 요청은 session.updated(turn.dbSessionId
      // set, persist.ts) 이후라 dbSessionId 가 채워져 있다. 깨지면(provider/adapter 변경 등)
      // 조용한 오배선 대신 dev warn 으로 가시화 — 이벤트는 sessionId 없이 폴백 라우팅된다.
      if (!turn.dbSessionId) {
        console.warn(
          '[chat] permission.requested without dbSessionId — falling back to activeKey',
          {
            approvalId,
            kind: action.kind
          }
        )
      }
      sendChatEvent(wc, agentPermissionRequest(approvalId, outbound, turn.dbSessionId ?? undefined))
      // 승인 보류 동안 idle 타이머를 멈춘다 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지
      // 않게(broker 가 timeoutMs 를 의도적으로 안 쓰는 것과 동일 의도). release 로 재개(동시 N건은
      // refcount 라 마지막 해소 시에만). broker 는 턴 signal + (있으면) SDK 권한요청 취소 signal
      // 양쪽으로 해소된다 — SDK 가 control_cancel_request 로 취소하면 sdkSignal abort → broker deny
      // → 무한 await 방지. 턴 abort 도 그대로 동작.
      const releaseIdle = activeIdle?.beginPause()
      const regSignal = sdkSignal
        ? AbortSignal.any([controller.signal, sdkSignal])
        : controller.signal
      let resolution: ApprovalResolution
      try {
        resolution = await approvals.register(approvalId, turn, regSignal)
      } finally {
        releaseIdle?.()
      }
      sendChatEvent(wc, {
        type: 'permission.resolved',
        ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
        approvalId,
        resolution
      })
      // ask_question 후처리 — 답변을 큐에 적재 후 즉시 페어링 시도(tool_use id 가 먼저 와
      // 있을 수도 있다). SDK 가 answers 를 메시지 스트림으로 안 돌려주므로 router 가 합성한다.
      if (action.kind === 'ask_question' && resolution.behavior === 'allow') {
        const ui = (resolution.updatedInput ?? {}) as {
          answers?: Record<string, string | string[]>
          response?: unknown
        }
        turn.pendingAskAnswers.push({
          answers: ui.answers ?? {},
          ...(typeof ui.response === 'string' ? { response: ui.response } : {})
        })
        persistence.flushAskAnswers(turn, wc)
      }
      return resolution
    }

    // 세션 모드 SSOT 동기화 — resume 경로(sessionId 확정)에서 이번 턴 모드를 controller 에 기록.
    // 라이브 전환(setMode IPC)과 다음 턴이 같은 출처를 읽도록 한다.
    if (parsed.data.sessionId && parsed.data.permissionMode) {
      void permissionModes.setMode(parsed.data.sessionId, parsed.data.permissionMode)
    }

    try {
      for (let attempt = 0; ; attempt += 1) {
        let eventsReceived = 0
        let sawTerminal = false
        const idle = createIdleTimer(turn)
        activeIdle = idle
        try {
          // sendMessage 가 query() 를 즉시 시작하므로 try 안에서 호출 — 동기 throw 도 동일 경로로 분류.
          const live = new OneShotSessionRuntime(adapter)
          const runtimeEvents = live.send({
            sessionId: parsed.data.sessionId,
            text: parsed.data.text,
            cwd: turn.cwd,
            signal: controller.signal,
            extensions,
            env: turnEnv,
            providerSettings: resolved.providerSettings,
            model: resolved.model,
            requestApproval,
            permissionMode: parsed.data.permissionMode,
            effort: parsed.data.effort,
            // 서브에이전트 백그라운드화(가이드) — ORCA_SUBAGENT_BACKGROUND 게이트. 기본 off=foreground.
            backgroundSubagents,
            isSubagentBlocked: (st) => st !== undefined && turn.blockedSubagents.has(st),
            attachmentTexts: normalizedAttachments.attachmentTexts,
            attachmentImages: normalizedAttachments.attachmentImages
          })
          ctx.concurrency.increment(boundProjectId)
          try {
            turn.live = live
            idle.reset()
            for await (const rawEv of runtimeEvents) {
              const ev =
                rawEv.type === 'tool.call.completed'
                  ? coerceStoppedToolCompletion(turn.stoppedSubagents, rawEv)
                  : rawEv
              eventsReceived += 1
              idle.reset()
              if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {
                sawTerminal = true
              }
              persistence.persist(turn, ev)
              if (ev.type === 'session.updated') titles.maybeStart(turn)
              sendChatEvent(event.sender, ev)
              // sessionId 발급(session.updated) — 새-채팅 pending 턴을 sessionId 키로 승격.
              if (ev.type === 'session.updated') {
                turns.promote(turn, ev.sessionId)
              }
              // AskUserQuestion tool 호출이 도착하면 id 를 페어링 큐에 넣고 답변과 매칭 시도.
              if (ev.type === 'tool.call.started' && ev.toolName === 'AskUserQuestion') {
                turn.askPendingIds.push(ev.toolRunId)
                persistence.flushAskAnswers(turn, event.sender)
              }
              // 서브에이전트(Task) task_id 매핑 — orca:chat:stopSubagent 가 toolUseId 로 찾는다.
              if (ev.type === 'subagent.task' && ev.taskId) {
                turn.subagentTaskIds.set(ev.toolUseId, ev.taskId)
                if (turn.stoppedSubagents.has(ev.toolUseId)) {
                  void stopLiveSubagent(turn, ev.toolUseId, ev.taskId, backgroundSubagents)
                }
              }
              // subagent_type 매핑 — 재호출 차단(blockedSubagents)에 쓸 타입.
              if (ev.type === 'subagent.task' && ev.subagentType) {
                turn.subagentTypes.set(ev.toolUseId, ev.subagentType)
              }
              // task_notification settled 는 foreground/background 모두 권위 종료다. 부모 Agent/Task
              // tool_result 와 열린 child 도구를 정착해 루트/전용 transcript 의 inflight 고착을 푼다.
              if (ev.type === 'subagent.task' && ev.phase === 'settled') {
                settleSubagentTask(
                  turn,
                  persistence,
                  turn.stoppedSubagents.has(ev.toolUseId) ? { ...ev, status: 'stopped' } : ev
                )
              }
              // 열린 도구 실행 추적 — 중단/타임아웃 시 합성 결과로 정착시킬 대상(settleOpenToolRuns).
              if (ev.type === 'tool.call.started') {
                turn.openToolRuns.set(
                  ev.toolRunId,
                  ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {}
                )
              } else if (ev.type === 'tool.call.completed') {
                turn.openToolRuns.delete(ev.toolRunId)
              }
            }
          } finally {
            ctx.concurrency.decrement(boundProjectId)
          }
          if (!sawTerminal && !controller.signal.aborted) {
            const ev = {
              type: 'telemetry',
              sessionId: turn.dbSessionId ?? parsed.data.sessionId ?? ''
            } as const
            persistence.persist(turn, ev)
            sendChatEvent(event.sender, ev)
          }
          return
        } catch (err) {
          if (turn.cancelled && controller.signal.aborted) return
          if (turn.timedOut) {
            sawTerminal = true
            settleOpenToolRuns(turn, persistence, 'aborted')
            sendChatEvent(event.sender, {
              type: 'error',
              ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
              error: makeClassifiedError('stream_error', '응답이 없어 턴을 중단했습니다.', {
                retryable: true
              })
            })
            return
          }
          const error = adapter.classifyError(err, 'sendMessage')
          if (
            error.retryable &&
            eventsReceived === 0 &&
            attempt < MAX_RETRIES &&
            !controller.signal.aborted
          ) {
            sendChatEvent(event.sender, {
              type: 'turn.retrying',
              ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              error
            })
            try {
              await abortableDelay(RETRY_BACKOFF_MS[attempt] ?? 2_000, controller.signal)
            } catch {
              return
            }
            continue
          }
          // sessionId 가 확정된 턴이면 부착 — renderer 멀티세션 store 가 정확한 엔트리로
          // 라우팅한다(없으면 활성 엔트리 폴백, handoff 0013).
          sawTerminal = true
          settleOpenToolRuns(turn, persistence, 'failed')
          sendChatEvent(event.sender, {
            type: 'error',
            ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
            // 어댑터 소유 분류기(0016) — provider 는 어댑터가 자기 id 로 채운다. 표시용, 분기 미사용.
            error
          })
          return
        } finally {
          idle.clear()
          activeIdle = null
        }
      }
    } finally {
      wc.removeListener('destroyed', onOwnerGone)
      wc.removeListener('render-process-gone', onOwnerGone)
      turns.finish(turn)
    }
  }

  // chatSend 는 검증 실패를 reject 가 아닌 error 이벤트로 회신하는 특례 — handlePlain 으로
  // 등록하고 핸들러 서두에서 직접 safeParse 한다.
  handlePlain(CHANNELS.chatSend, (raw, event) => handleChatSend(event, raw))

  handle(CHANNELS.chatCancel, CancelChatSchema, 'reject', (req): void => {
    const turn = turns.getBySession(req.sessionId)
    if (!turn) return
    turn.abort('user_cancelled')
    // 진행 중이던 도구(최상위 + 서브에이전트 child)를 중단 결과로 정착 — 안 하면 결과가
    // 영영 안 와 "실행 중"으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남는다. turn.aborted 전에.
    settleOpenToolRuns(turn, persistence, 'aborted')
    sendChatEvent(turn.owner, {
      type: 'turn.aborted',
      sessionId: req.sessionId,
      reason: 'user_cancelled'
    })
  })

  // 서브에이전트(Task) 단위 중단 — turn 전체가 아니라 한 Agent 도구 호출만 멈춘다(turn 계속).
  // 클릭 즉시 부모/child transcript 를 aborted 로 낙관 정착하고, SDK task_notification(stopped)이
  // 도착하면 같은 toolUseId 로 권위 메타를 보강한다. stopTask 는 task_id 기반 제어 신호일 뿐
  // UI 상태 SSOT 는 합성 tool_result 다.
  handle(CHANNELS.chatStopSubagent, StopSubagentSchema, 'reject', async (req): Promise<void> => {
    const turn = turns.getBySession(req.sessionId)
    if (!turn) return
    const taskId = turn.subagentTaskIds.get(req.toolUseId)
    const subagentType = turn.subagentTypes.get(req.toolUseId)
    if (subagentType) turn.blockedSubagents.add(subagentType)
    turn.stoppedSubagents.add(req.toolUseId)

    settleSubagentTask(turn, persistence, {
      type: 'subagent.task',
      sessionId: turn.dbSessionId ?? req.sessionId,
      toolUseId: req.toolUseId,
      phase: 'settled',
      status: 'stopped'
    })

    await stopLiveSubagent(turn, req.toolUseId, taskId, backgroundSubagents)
  })
}

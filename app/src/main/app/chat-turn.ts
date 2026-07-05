// chat 턴 파이프라인 진입(orca:chat:send / cancel / stopSubagent)의 컴포지션 루트(L3). 가로축
// 구동(스트림 소비→reduce→persist∥forward + retry/settle/stall)은 TurnCoordinator(L1)가 1급으로
// 소유하고(handoff 0052, 0051 §A), 여기서는 *셋업* 만 한다 — 검증·동시턴 가드·provider/env/첨부
// 해석·dangling 복구·turn 생성·레지스트리 등록·승인 콜백(requestApproval) 배선. 턴 상태는
// SessionRuntimeRegistry, 영속은 HistoryWriter, 승인 왕복은 ApprovalCoordinator 에 위임한다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { CHANNELS, type ApprovalResolution, type PermissionAction } from '../../shared/ipc'
import {
  CancelChatSchema,
  CancelSteerSchema,
  SendChatMessageSchema,
  SteerChatMessageSchema,
  StopSubagentSchema
} from '../../shared/protocol'
import { normalizeAttachments } from '../features/chat/attachments'
import { appEnv } from '../infra/config/orca-config'
import {
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  mergeEnvLayers,
  modelNameForFamily,
  resolveTitleModel,
  type ResolvedProviderSettings
} from '../features/providers/provider-settings'
import { buildHandoffMessage } from '../features/orchestration/handoff'
import { agentPermissionRequest } from '../features/approvals/permission-bridge'
import type { PermissionModeController } from '../features/approvals/permission-mode-controller'
import { makeClassifiedError } from '../infra/errors'
import type { RouterContext } from './context'
import { sendChatEvent } from '../infra/ipc/send'
import { previewOf } from '../infra/ipc/dto'
import { handle, handlePlain } from '../infra/ipc/handle'
import type { ApprovalCoordinator } from '../features/approvals/coordinator'
import type { HistoryWriter } from '../features/history/writer'
import { SessionRuntime } from '../features/sessions/session-runtime'
import type { RuntimeSessionAdapter } from '../contracts/ports'
import { STALL_TIMEOUT_MS } from '../features/chat/timers'
import { recoverDanglingToolCalls } from '../features/chat/recovery'
import type { TurnRequest } from '../adapters/turn'
import { TurnCoordinator } from '../features/chat/turn-coordinator'
import { settleOpenToolRuns, settleSubagentTask, stopLiveSubagent } from '../features/chat/settle'
import type { MainBus, TurnEmit } from '../contracts/bus-events'
import type { TurnEventSink } from '../features/chat/turn-sinks'
import { RuntimeSupervisor } from '../features/sessions/supervisor'
import { abortTurn } from '../features/chat/abort'
import type { PendingMessageQueue } from '../features/chat/pending-message-queue'
import type {
  AdmissionController,
  AdmissionContext,
  AdmissionDecision
} from '../features/sessions/admission-controller'
import type { TurnContext } from '../contracts/turn'

export const IDLE_TIMEOUT_MS = STALL_TIMEOUT_MS
export { createStallTimer as createIdleTimer } from '../features/chat/timers'
// retry 정책 정본은 TurnCoordinator(L1) — 기존 import 경로(./send) 호환을 위한 무회귀 re-export.
export { MAX_RETRIES, RETRY_BACKOFF_MS, abortableDelay } from '../features/chat/turn-coordinator'

export interface ChatDeps {
  ctx: RouterContext
  supervisor: RuntimeSupervisor<WebContents>
  bus: MainBus<WebContents>
  approvals: ApprovalCoordinator
  persistence: HistoryWriter
  permissionModes: PermissionModeController
  admission: AdmissionController<WebContents>
  pendingMessages: PendingMessageQueue
}

// renderer forward sink — sendChatEvent 래핑. 코디네이터가 버스를 타지 않는 forward-only 이벤트
// (합성 error·turn.retrying·steer.flushed)에 쓴다.
const chatForward: TurnEventSink<WebContents> = {
  forward: (owner, ev) => sendChatEvent(owner, ev)
}

// 턴 단위 provider/model 해석 (handoff 0010 → 0014) — payload providerKey 가 어댑터와
// 일치하면 적용, 불일치/무효면 세션의 마지막 provider_key → 기본 provider(anthropic 우선) 폴백.
// 원천은 sources/settings/<adapter>/ 트리(ProviderSettingsService)이며, settings 해석(blob)은
// dist 캐시에서 가져온다. 비밀(secret-store 토큰·${VAR})은 해석기 내부에서만 평문화된다.
async function resolveTurnProvider(
  ctx: RouterContext,
  req: {
    adapter: RuntimeSessionAdapter
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

// subprocess env 조립 — orca.json 앱 전역 env(${VAR} 확장)를 병합.

function resolveTurnCwd(
  ctx: RouterContext,
  req: { sessionId: string | null; projectId: string | null; cwd?: string | null },
  sessionMeta: { cwd: string | null; project_id: string | null } | undefined
): string {
  if (req.sessionId) {
    return sessionMeta?.cwd ?? ctx.getCwd(sessionMeta?.project_id ?? null)
  }
  return req.cwd ?? ctx.getCwd(req.projectId)
}

function buildTurnEnv(ctx: RouterContext): Record<string, string> | undefined {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length > 0) {
    console.warn(`[orca-config] 미해결 환경변수로 일부 앱 env 키를 건너뜀: ${missing.join(', ')}`)
  }
  return mergeEnvLayers(undefined, expanded)
}

function createAdmissionContext(
  sessionId: string | null,
  owner: WebContents,
  hasInflight: boolean
): AdmissionContext<WebContents> {
  return sessionId
    ? { target: { kind: 'existing-session', sessionId }, hasInflight }
    : { target: { kind: 'new-session-slot', owner }, hasInflight }
}

function enactAdmissionDecision(
  owner: WebContents,
  sessionId: string | null,
  decision: AdmissionDecision
): boolean {
  if (decision.kind === 'accept') return true
  // reject — 진행 중 턴에 대한 사용자 입력은 renderer 가 chat:steer(pending message queue 예약)
  // 로 보내므로, 여기 도달하는 중복 chat:send 는 race 뿐이다(0056 → 0066 단순화).
  sendChatEvent(owner, {
    type: 'error',
    ...(sessionId ? { sessionId } : {}),
    error: makeClassifiedError(
      'provider_connection_error',
      '이미 진행 중인 턴이 있습니다. 완료 후 다시 시도하세요.',
      { retryable: true }
    )
  })
  return false
}

export function registerChatHandlers(deps: ChatDeps): void {
  const {
    ctx,
    supervisor,
    bus,
    approvals,
    persistence,
    permissionModes,
    admission,
    pendingMessages
  } = deps

  // settle(취소·서브에이전트 중단) 정착 이벤트를 turn.event 버스로 방출 — 스트리밍과 동일 파이프라인.
  // fault-isolated: 정리 중 구독자 throw 가 핸들러를 깨지 않게 격리한다.
  const emitTurn: TurnEmit<WebContents> = (turn, ev) => {
    try {
      bus.emit('turn.event', { turn, ev })
    } catch (err) {
      console.warn('[chat] turn.event 방출 실패(격리):', err)
    }
  }

  // 서브에이전트 백그라운드화 게이트(가이드 — run_in_background 주입). 종료 정착은
  // task_notification/사용자 중단 공통 경로에서 foreground/background 모두 처리한다.
  const backgroundSubagents = process.env.ORCA_SUBAGENT_BACKGROUND === '1'

  // 0067: 장수명 세션 채널이 기본 — 게이트 env(ORCA_PERSISTENT_RUNTIME) 폐기(사용자 확정
  // "long-lived 직행"). pushTurn 미지원 어댑터(mock)는 SessionRuntime 이 턴-스코프로 폴백한다.

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

    // 동시 턴 admission — 서로 다른 세션의 동시 턴은 허용하되, 같은 세션(또는 같은 창의
    // 새-채팅 슬롯)의 중복 send 는 AdmissionController 정책 결과를 L3 에서 enact 한다.
    const admissionContext = createAdmissionContext(
      parsed.data.sessionId,
      event.sender,
      parsed.data.sessionId
        ? supervisor.hasSession(parsed.data.sessionId)
        : supervisor.hasPending(event.sender)
    )
    const admissionDecision = admission.admit(admissionContext)
    if (!enactAdmissionDecision(event.sender, parsed.data.sessionId, admissionDecision)) return

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

    // 0064 continuity — fork/handoff 는 새 세션 send(sessionId=null)로 수렴하되 출발 세션의
    // 메타(cwd·project·provider)를 계승한다. cwd 계승은 필수 — SDK 세션 파일이 cwd 인코딩
    // 경로(~/.claude/projects/<encoded-cwd>/)에 저장돼 resume(forkSession) 탐색이 cwd 에 묶인다.
    const continuitySource = parsed.data.forkFrom ?? parsed.data.handoffFrom
    const continuityMeta = continuitySource ? ctx.db.getSessionById(continuitySource) : undefined
    if (continuitySource) {
      if (!continuityMeta) {
        sendChatEvent(event.sender, {
          type: 'error',
          error: makeClassifiedError(
            'schema_validation_error',
            '분기할 원본 세션을 찾을 수 없습니다.',
            { retryable: false }
          )
        })
        return
      }
      // handoff 가드(mid-turn 거부) — 출발 세션 턴 진행 중엔 즉시 물질화를 거부한다(렌더러
      // 비활성 가드의 main 측 이중 방어). fork 는 원본 불변이라 허용(plan 파생 UX).
      if (parsed.data.handoffFrom && supervisor.hasSession(parsed.data.handoffFrom)) {
        sendChatEvent(event.sender, {
          type: 'error',
          error: makeClassifiedError(
            'provider_connection_error',
            '원본 세션의 턴이 진행 중입니다. 완료 후 핸드오프하세요.',
            { retryable: true }
          )
        })
        return
      }
    }

    const resolved = await resolveTurnProvider(ctx, {
      adapter,
      sessionId: parsed.data.sessionId,
      // fork/handoff 는 출발 세션의 마지막 provider 를 계승한다(명시 선택이 우선).
      providerKey: parsed.data.providerKey ?? continuityMeta?.provider_key ?? null,
      modelFamily: parsed.data.modelFamily ?? null
    })

    // orca.json 앱 전역 env(${VAR} 확장)만 SDK subprocess env 로 병합한다.
    const turnEnv = buildTurnEnv(ctx)

    const sessionMeta = parsed.data.sessionId
      ? ctx.db.getSessionById(parsed.data.sessionId)
      : undefined
    const boundProjectId = parsed.data.sessionId
      ? (sessionMeta?.project_id ?? null)
      : (continuityMeta?.project_id ?? parsed.data.projectId)

    // handoff 는 main 이 자동 메시지를 조립해 text 를 대체한다(템플릿 단일 출처 = orchestration/).
    const effectiveText = parsed.data.handoffFrom
      ? buildHandoffMessage(continuityMeta?.title ?? null, parsed.data.handoffFrom)
      : parsed.data.text

    // 핸드오프 자동 메시지 에코(0064 r4) — 렌더러가 본문을 모르는 main 조립 발화를 **턴 시작
    // 전에** 커밋한다. r2/r3 은 session.updated(SDK init) 시점에 에코했는데, 실기에서 init 이
    // compact 이벤트들보다 늦게 도착하면 요약(message.completed 폴백 라우팅)이 먼저 붙고 user
    // 버블이 그 뒤에 렌더되는 역순이 났다(r4 피드백 2). sessionId 미발급 시점이므로 이벤트에
    // sessionId 가 없고, 렌더러 receive() 가 pendingNewChatKey(=핸드오프 draft)로 라우팅한다 —
    // SDK 이벤트 순서와 무관하게 [user 버블 → inflight → 압축 요약] 순서가 보장된다.
    if (parsed.data.handoffFrom) {
      sendChatEvent(event.sender, {
        type: 'message.user',
        text: effectiveText,
        createdAt: Date.now()
      })
    }

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

    if (parsed.data.sessionId) {
      recoverDanglingToolCalls(ctx.db, {
        sessionId: parsed.data.sessionId,
        isSessionLive: (sessionId) => supervisor.hasSession(sessionId)
      })
    }

    const controller = new AbortController()
    // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
    // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
    const turn: TurnContext<WebContents> = {
      controller,
      owner: event.sender,
      live: null,
      titleAdapter: adapter,
      titleSettings: resolved.providerSettings,
      titleEnv: turnEnv,
      titleModel: resolved.titleModel,
      providerKey: resolved.providerKey,
      pendingUserText: effectiveText,
      firstUserText: effectiveText,
      pendingAttachmentViews: parsed.data.attachmentViews,
      dbSessionId: parsed.data.sessionId,
      pendingProjectId: parsed.data.sessionId ? null : boundProjectId,
      isNewSession: parsed.data.sessionId == null,
      // fork/handoff 는 출발 세션 cwd 를 계승한다(SDK 세션 파일 탐색이 cwd 에 묶임 — 위 주석).
      cwd: continuityMeta
        ? (continuityMeta.cwd ?? ctx.getCwd(continuityMeta.project_id))
        : resolveTurnCwd(
            ctx,
            {
              sessionId: parsed.data.sessionId,
              projectId: boundProjectId,
              cwd: parsed.data.cwd ?? null
            },
            sessionMeta
          ),
      // continuity 는 초기 마커 제목([분기]/[핸드오프])을 유지 — 자동 제목 생성 억제.
      titleGenerationStarted: continuitySource != null,
      currentAssistantMessageId: null,
      assistantText: '',
      pendingAskAnswers: [],
      askPendingIds: [],
      askResolved: new Map(),
      subagentTaskIds: new Map(),
      openToolRuns: new Map(),
      subagentTypes: new Map(),
      blockedSubagents: new Set(),
      stoppedSubagents: new Set(),
      // 0064 continuity — persist(session.updated)가 lineage 영속 + fork display 복사에 쓴다.
      // 초기 제목 = `[분기]/[핸드오프] <원본 제목>`(r3 피드백 — nav 최근 대화 식별). 원본
      // 제목 부재 시 id 앞 8자 폴백. titleGenerationStarted=true 로 자동 제목(0004)을 억제해
      // 마커 제목을 유지한다(사용자 rename 은 그대로 가능).
      ...(continuitySource
        ? {
            lineage: {
              parentSessionId: continuitySource,
              relation: parsed.data.handoffFrom ? ('handoff' as const) : ('fork' as const)
            },
            initialTitle: `${parsed.data.handoffFrom ? '[핸드오프]' : '[분기]'} ${
              continuityMeta?.title?.trim() || continuitySource.slice(0, 8)
            }`
          }
        : {})
    }
    if (parsed.data.sessionId) supervisor.startResume(parsed.data.sessionId, turn)
    else supervisor.startNew(event.sender, turn)

    // Persistent 채널이 세션 키의 idle 핸들로 살아있으면 재사용, 아니면 fresh(0067 — pushTurn
    // 미지원 어댑터는 SessionRuntime 이 턴-스코프 폴백). 반납은 finally 의 releaseRuntime.
    const runtime = supervisor.acquireRuntime(
      parsed.data.sessionId,
      () => new SessionRuntime(adapter)
    )

    // 이월(carryover, 0060 D2)은 **채널이 죽었을 때만** — 턴-스코프/사망 채널은 CLI 내부 큐가
    // 서브프로세스와 함께 소멸했으므로 미소비 pending(미echo flushed + held)을 여기서 프롬프트에
    // 병합해 전달·커밋한다. 채널 생존 시엔 드레인하지 않는다(0067): flushed 분은 CLI 큐에
    // 살아있어 다음 턴 P2 픽업→echo 커밋으로, held 분은 이번 턴 게이트 flush 로 이어진다 —
    // 여기서 드레인하면 모델에 이중 전달된다.
    const steerCarryover =
      parsed.data.sessionId && !runtime.channelAlive
        ? pendingMessages.drainAll(parsed.data.sessionId)
        : undefined

    // resume 경로: sessionId 가 들어왔다는 건 이전 init 으로 sessions row 가 이미
    // 존재한다는 의미. 다음 init 이벤트를 기다리지 않고 user 메시지를 즉시 기록.
    if (parsed.data.sessionId) {
      const now = Date.now()
      if (steerCarryover) {
        persistence.persistUserMessage(
          parsed.data.sessionId,
          steerCarryover.text,
          steerCarryover.createdAt
        )
      }
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

    // plugin 배포는 query 호출 전 최신성을 멱등 보장한다. 활성/비활성 토글은
    // 파일 삭제가 아니라 런타임 options.skills 필터로 반영한다.
    ctx.ensureExtensionsDeployedForTurn()

    // 백엔드 중립 확장 리소스(지침+정적 정책 append · MCP · skills · hooks)를 빌더가 조립.
    // resume 면 projectId 는 세션 바인딩에서 조회되므로 null 을 넘긴다. fork/handoff 새 세션은
    // 출발 세션에서 계승한 boundProjectId 를 쓴다.
    const extensions = ctx.extensions.build(
      parsed.data.sessionId,
      parsed.data.sessionId ? null : boundProjectId
    )

    const wc = event.sender
    // 렌더러(owner) 소멸 시 진행 턴 정리 — idle "완전 멈춤"으로 잃는 자가치유(무응답 abort)를
    // 타이머가 아닌 이벤트로 대체한다(사람 판단엔 시간 제한 두지 않음 유지). 바깥 finally 에서 해제.
    // 여기는 abortTurn(turn) 이 아니라 runtime 을 직접 mark 한다 — coordinator.run 이 turn.live=runtime
    // 을 세우기 *전* 에 owner 가 사라질 수 있어, 그 창에서도 런타임 상태(cancelled)를 확실히 남긴다.
    const onOwnerGone = (): void => {
      runtime.markAborted('user_cancelled')
      controller.abort()
    }
    wc.once('destroyed', onOwnerGone)
    wc.once('render-process-gone', onOwnerGone)

    // 가로축 구동체 — 스트림 소비·reduce·persist∥forward·retry·settle·stall 을 소유한다.
    const coordinator = new TurnCoordinator<WebContents>({
      runtime,
      bus,
      persist: persistence,
      forward: chatForward,
      registry: supervisor,
      classifyError: (err, phase) => adapter.classifyError(err, phase),
      activeTurns: supervisor.activeTurns,
      backgroundSubagents,
      pendingMessages
    })

    // 단일 권한 승인 위임 — 어댑터의 canUseTool 이 ask_question·plan_review·tool_approval 중
    // 하나를 PermissionAction 으로 넘기면, approvalId 를 발급해 permission.requested 이벤트로
    // renderer 에 surface 하고 broker 가 응답(또는 turn abort)까지 Promise 를 보류한다.
    // tool_approval 은 "세션 동안 허용"으로 부여된 도구면 카드 없이 즉시 allow 한다.
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
      // 승인 보류 동안 stall 타이머를 멈춘다 — 사용자 판단 시간이 stall 로 오판돼 턴이 abort 되지
      // 않게. release 로 재개(동시 N건은 refcount). broker 는 턴 signal + (있으면) SDK 권한요청
      // 취소 signal 양쪽으로 해소된다 — SDK 가 control_cancel_request 로 취소하면 sdkSignal abort
      // → broker deny → 무한 await 방지. 턴 abort 도 그대로 동작.
      const releaseIdle = coordinator.beginApprovalPause()
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

    const request: TurnRequest = {
      sessionId: parsed.data.sessionId,
      // 0064 continuity — 어댑터가 resume+forkSession 으로 어댑트해 새 session id 를 발급받는다.
      ...(continuitySource ? { forkFrom: continuitySource } : {}),
      // 이월된 steer 는 새 프롬프트 앞에 병합해 모델에 전달한다(D2) — DB 에는 위에서 별도 row 로
      // 이미 영속됐다. 제목/프리뷰(turn.firstUserText 등)는 사용자가 타이핑한 텍스트만 쓴다.
      // steer 이월(resume 경로)과 continuity(새 세션 경로)는 상호배타 — steerCarryover 는
      // sessionId 있는 턴에서만 존재하고, effectiveText 는 그 경로에서 parsed.data.text 와 같다.
      text: steerCarryover ? `${steerCarryover.text}\n\n${effectiveText}` : effectiveText,
      cwd: turn.cwd,
      signal: controller.signal,
      extensions,
      env: turnEnv,
      providerSettings: resolved.providerSettings,
      model: resolved.model,
      requestApproval,
      permissionMode: parsed.data.permissionMode,
      effort: parsed.data.effort,
      // 게이트 훅(PostToolBatch) 시점에 로컬 홀드 steer 를 병합 단일 배치로 회수(0060 D3·D4).
      // turn.dbSessionId 를 훅 발화 시점에 동적으로 읽는다 — 새 세션 턴은 session.updated
      // 전까지 null(그동안 steer 자체가 불가능하므로 빈 회수가 옳다).
      takeSteerFlush: () =>
        turn.dbSessionId ? pendingMessages.flushHeld(turn.dbSessionId) : undefined,
      // 서브에이전트 백그라운드화(가이드) — ORCA_SUBAGENT_BACKGROUND 게이트. 기본 off=foreground.
      backgroundSubagents,
      isSubagentBlocked: (st) => st !== undefined && turn.blockedSubagents.has(st),
      attachmentTexts: normalizedAttachments.attachmentTexts,
      attachmentImages: normalizedAttachments.attachmentImages
    }

    try {
      await coordinator.run(turn, request, { boundProjectId })
    } finally {
      wc.removeListener('destroyed', onOwnerGone)
      wc.removeListener('render-process-gone', onOwnerGone)
      // turn 핸들 teardown(레지스트리 제거)과 runtime 수명은 분리한다 — Persistent 핸들은 정상
      // 종료 시 turn.dbSessionId 키로 idle 보존되고, 그 외(에러·중단·OneShot)는 즉시 close.
      supervisor.release(turn)
      supervisor.releaseRuntime(turn.dbSessionId, runtime)
    }
  }

  // chatSend 는 검증 실패를 reject 가 아닌 error 이벤트로 회신하는 특례 — handlePlain 으로
  // 등록하고 핸들러 서두에서 직접 safeParse 한다.
  handlePlain(CHANNELS.chatSend, (raw, event) => handleChatSend(event, raw))

  handle(CHANNELS.chatSteer, SteerChatMessageSchema, 'reject', (req, event): void => {
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn || !turn.live?.canSteer) {
      sendChatEvent(event.sender, {
        type: 'error',
        sessionId: req.sessionId,
        error: makeClassifiedError(
          'capability_unsupported',
          '이 백엔드는 피드백 끼어들기를 지원하지 않습니다.',
          { retryable: false }
        )
      })
      return
    }
    // 어시스턴트 턴 = pending message queue 의 예약(held) 경로(0066) — stdin 즉시 주입하지
    // 않는다(0060 D3: stdin 주입 = 조작 권한 포기). 주입은 어댑터의 게이트 훅이 takeSteerFlush
    // 로 병합 배치를 회수해 수행하고, 커밋 판정은 coordinator 가 input.echo(batch uuid) 관측으로
    // 수행한다(0060 D1). held 인 동안만 취소 가능(chat:steerCancel).
    const item = pendingMessages.enqueue(req.sessionId, req.text, Date.now(), req.clientRequestId)
    sendChatEvent(event.sender, {
      type: 'steer.queued',
      sessionId: req.sessionId,
      id: item.id,
      text: item.text,
      createdAt: item.createdAt
    })
  })

  handle(CHANNELS.chatSteerCancel, CancelSteerSchema, 'reject', (req, event): void => {
    const removed = pendingMessages.cancel(req.sessionId, req.id)
    if (!removed) return
    sendChatEvent(event.sender, { type: 'steer.cancelled', sessionId: req.sessionId, id: req.id })
  })

  handle(CHANNELS.chatCancel, CancelChatSchema, 'reject', (req): void => {
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn) return
    abortTurn(turn, 'user_cancelled')
    // 진행 중이던 도구(최상위 + 서브에이전트 child)를 중단 결과로 정착 — 안 하면 결과가
    // 영영 안 와 "실행 중"으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남는다. turn.aborted 전에.
    settleOpenToolRuns(turn, emitTurn, 'aborted')
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
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn) return
    const taskId = turn.subagentTaskIds.get(req.toolUseId)
    const subagentType = turn.subagentTypes.get(req.toolUseId)
    if (subagentType) turn.blockedSubagents.add(subagentType)
    turn.stoppedSubagents.add(req.toolUseId)

    settleSubagentTask(turn, emitTurn, {
      type: 'subagent.task',
      sessionId: turn.dbSessionId ?? req.sessionId,
      toolUseId: req.toolUseId,
      phase: 'settled',
      status: 'stopped'
    })

    await stopLiveSubagent(turn.live, req.toolUseId, taskId, backgroundSubagents)
  })
}

// chat 턴 파이프라인 진입(orca:chat:send / cancel / stopSubagent)의 컴포지션 루트(L3). 가로축
// 구동(스트림 소비→reduce→persist∥forward + retry/settle/stall)은 TurnCoordinator(L1)가 1급으로
// 소유하고(handoff 0052, 0051 §A), 여기서는 *셋업* 만 한다 — 검증·동시턴 가드·provider/env/첨부
// 해석·dangling 복구·turn 생성·레지스트리 등록·승인 콜백(requestApproval) 배선. 턴 상태는
// SessionRuntimeRegistry, 영속은 HistoryWriter, 승인 왕복은 ApprovalCoordinator 에 위임한다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  CHANNELS,
  type ApprovalResolution,
  type AttachmentView,
  type PermissionAction
} from '../../shared/ipc'
import {
  CancelChatSchema,
  CancelSteerSchema,
  DiscardSessionSchema,
  SendChatMessageSchema,
  StopSubagentSchema
} from '../../shared/protocol'
import { normalizeAttachments } from '../features/chat/attachments'
import { appEnv } from '../infra/config/orca-config'
import {
  crossesProviderBoundary,
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  mergeEnvLayers,
  modelNameForFamily,
  providerSettingsChangedSinceSpawn,
  resolveTitleModel,
  type ResolvedProviderSettings
} from '../features/providers/provider-settings'
import { buildHandoffMessage } from '../features/orchestration/handoff'
import { continuityLangFor, continuityTitle } from '../../shared/continuity-lang'
import { agentPermissionRequest } from '../features/approvals/permission-bridge'
import type { PermissionModeController } from '../features/approvals/permission-mode-controller'
import { PLAN_APPROVED_MODE } from '../../shared/permission-mode'
import { makeClassifiedError } from '../infra/errors'
import type { RouterContext } from './context'
import { getLogger, runWithLogContext } from '../infra/log'
import { sendChatEvent } from '../infra/ipc/send'
import { handle, handlePlain } from '../infra/ipc/handle'
import type { ApprovalCoordinator } from '../features/approvals/coordinator'
import type { HistoryWriter } from '../features/history/writer'
import { SessionRuntime } from '../features/sessions/session-runtime'
import { decideRespawn } from '../features/sessions/respawn-policy'
import { prepareAutomaticContinuation } from './chat-turn-continuation'
import type { RuntimeSessionAdapter } from '../contracts/ports'
import { recoverSessionHistory } from '../features/chat/recovery'
import type { InterruptReceipt, SteerFlushBatch, TurnRequest } from '../adapters/turn'
import { TurnCoordinator } from '../features/chat/turn-coordinator'
import { BackgroundTaskTracker } from '../features/chat/background-tasks'
import type { SessionActivityProjector } from '../features/chat/session-activity-projector'
import { decidePostTurnStep, postTurnHoldsSession } from '../features/chat/post-turn'
import { reconcileInterruptReceipt } from '../features/chat/interrupt-reconcile'
import {
  settleOpenToolRuns,
  settleSubagentTask,
  settleTrackedTasks,
  stopLiveSubagent
} from '../features/chat/settle'
import type { MainBus, TurnEmit } from '../contracts/bus-events'
import type { TurnEventSink } from '../features/chat/turn-sinks'
import { RuntimeSupervisor } from '../features/sessions/supervisor'
import { abortTurn } from '../features/chat/abort'
import type { PendingMessageQueue } from '../features/chat/pending-message-queue'
import type { TurnContext } from '../contracts/turn'
import {
  clientLeaseKey,
  sessionLeaseKey,
  type SessionChainLease,
  type SessionControl
} from '../features/sessions/session-chain-lease'

export interface ChatDeps {
  ctx: RouterContext
  supervisor: RuntimeSupervisor<WebContents>
  bus: MainBus<WebContents>
  approvals: ApprovalCoordinator
  persistence: HistoryWriter
  permissionModes: PermissionModeController
  pendingMessages: PendingMessageQueue
  backgroundTasks: BackgroundTaskTracker
  activity: SessionActivityProjector
  isUpdateInstallPending: () => boolean
}

// renderer forward sink — sendChatEvent 래핑. 코디네이터가 버스를 타지 않는 forward-only 이벤트
// (합성 error·turn.retrying·steer.flushed)에 쓴다.
const chatForward: TurnEventSink<WebContents> = {
  forward: (owner, ev) => sendChatEvent(owner, ev)
}

// 매 턴 리셋되는 턴-로컬 상태의 단일 초기값 — 신규 턴(handleChatSend)과 자동 연속 턴
// (makeContinuationTurn)이 공유한다. TurnContext 에 턴-로컬 필드를 추가하면 여기에만 더한다
// (턴 간 계승/차이가 있는 blockedSubagents·pendingAttachmentViews 는 각 호출부가 명시).
function freshTurnLocalState(
  control?: SessionControl
): Pick<
  TurnContext<WebContents>,
  | 'live'
  | 'currentAssistantMessageId'
  | 'assistantText'
  | 'pendingAskAnswers'
  | 'askPendingIds'
  | 'askResolved'
  | 'subagentTaskIds'
  | 'openToolRuns'
  | 'subagentTypes'
  | 'stoppedSubagents'
> {
  return {
    live: null,
    currentAssistantMessageId: null,
    assistantText: '',
    pendingAskAnswers: [],
    askPendingIds: [],
    askResolved: new Map(),
    subagentTaskIds: control?.taskIds ?? new Map(),
    openToolRuns: new Map(),
    subagentTypes: control?.subagentTypes ?? new Map(),
    stoppedSubagents: control?.stoppedSubagents ?? new Set()
  }
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
    getLogger().child('providers').warn('providers.key.mismatch', {
      providerKey: req.providerKey,
      reason: 'adapter mismatch — falling back to session provider'
    })
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
    getLogger()
      .child('config')
      .warn('config.env.unresolved', { missing, reason: 'app env keys skipped' })
  }
  return mergeEnvLayers(undefined, expanded)
}

// 소유권 표시(0151 AC12) 발신 단일 지점 — held(취소 가능) ↔ submitted(전달됨, 취소 불가) 전이를
// renderer 에 알린다. 버스 미경유 직행(message.queued 동렬 — 미영속 UI 상태). 턴 핸들러(활성 턴의
// wc)와 steerCancel 핸들러(event.sender)가 서로 다른 WebContents 를 쓰므로 인자로 받는다.
function sendSubmitted(
  wc: WebContents,
  sessionId: string,
  ids: string[],
  submitted: boolean
): void {
  if (ids.length === 0) return
  sendChatEvent(wc, { type: 'message.submitted', sessionId, ids, submitted })
}

// 0067 AC10: AdmissionController(0056 framework) 폐기 — busy 세션 send 는 reject 가 아니라
// pending queue 예약(held)이 정답이 됐다. 유일하게 남은 가드는 새-채팅 슬롯의 중복 send race
// 뿐이라 핸들러 서두에 인라인한다.

export function registerChatHandlers(deps: ChatDeps): void {
  const {
    ctx,
    supervisor,
    bus,
    approvals,
    persistence,
    permissionModes,
    pendingMessages,
    backgroundTasks,
    activity,
    isUpdateInstallPending
  } = deps

  // settle(취소·서브에이전트 중단) 정착 이벤트를 turn.event 버스로 방출 — 스트리밍과 동일 파이프라인.
  // fault-isolated: 정리 중 구독자 throw 가 핸들러를 깨지 않게 격리한다.
  const emitTurn: TurnEmit<WebContents> = (turn, ev) => {
    try {
      bus.emit('turn.event', { turn, ev })
    } catch (err) {
      getLogger()
        .child('chat')
        .warn('chat.turn-event.emit-failed', { isolated: true, message: String(err) })
    }
  }

  // 0136 — 세션별 미정착 백그라운드 서브에이전트 추적(coordinator 가 갱신, 턴-후 루프가 조회)
  // + listen 턴 릴리즈 밸브(세션 키 — busy send 예약이 listen 프레임을 닫아 즉시 연속 턴 전환).
  const listenRelease = new Map<string, () => void>()
  // 중단 잔여(0151 r2) — Stop 영수증의 still_queued 중 **우리 예약**과 교집합인 uuid 목록.
  // "세션 전체 중단" 을 사용자가 고르면 이 목록의 예약을 폐기 대상으로 삼는다. 세션 키별 1건이며
  // 해제 지점은 둘 — ① 이후 중단 영수증이 clear(우리 잔여 없음) ② chatDiscardSession 실행.
  // 메모리 전용(비영속 — pending 정책 동일).
  const residualBySession = new Map<string, string[]>()

  // 0067: 장수명 세션 채널이 기본 — 게이트 env(ORCA_PERSISTENT_RUNTIME) 폐기(사용자 확정
  // "long-lived 직행"). pushTurn 미지원 어댑터(mock)는 SessionRuntime 이 턴-스코프로 폴백한다.

  // 0136 — 채널이 내려간 세션에 미정착 백그라운드 태스크가 남으면(in-process 라 채널과 함께
  // 소멸) 합성 settled(failed)로 부모 Task/열린 child 를 정착해 '실행 중' 영구 고착을 막고
  // 추적을 비운다. 정착 이벤트는 turn.event 버스(persist∥forward — tool_result upsert 멱등)로
  // 흐르므로 재로드 복원까지 일관된다.
  const settleDeadBackgroundTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(turn, emitTurn, sessionId, backgroundTasks, {
      status: 'failed',
      summary: '채널이 종료되어 서브에이전트가 중단되었습니다.',
      stopLive: false
    })

  // listen 대기 중 사용자 중단(0143, 사용자 확정) — 대기만 끊지 않고 실행 중 백그라운드 태스크도
  // 함께 중단한다(stopTask + 합성 stopped 정착). 대안(태스크 유지)은 다음 send 의 draining
  // teardown 으로 태스크가 어차피 소리 없이 죽어 '실행 중' 거짓 표시만 남긴다.
  const stopAndSettleAbortedTasks = (
    turn: TurnContext<WebContents>,
    sessionId: string
  ): Promise<void> =>
    settleTrackedTasks(turn, emitTurn, sessionId, backgroundTasks, {
      status: 'stopped',
      summary: '사용자가 대기를 중단해 백그라운드 서브에이전트를 중지했습니다.',
      stopLive: true
    })

  // busy 세션의 send 를 pending queue 예약(held)으로 수용한다(0067 AC5 — 구 chat:steer 본체).
  // 구조 페이로드: 첨부도 추출해 함께 적재 — 게이트 flush 시 content 블록으로 주입된다.
  // **동기 함수다(0152 AC1)**: 첨부 정규화는 호출자가 busy 판정 *전에* 끝내 넘긴다. 여기서
  // await 하면 그 사이 진행 턴이 끝나 held 예약이 고아가 된다(턴-후 루프는 이미 break·release).
  const reserveOnBusySession = (
    event: IpcMainInvokeEvent,
    queueKey: string,
    sessionId: string | undefined,
    lease: SessionChainLease<WebContents>,
    data: {
      text: string
      attachmentViews?: AttachmentView[]
      clientRequestId?: string
      providerKey?: string | null
    },
    na: Awaited<ReturnType<typeof normalizeAttachments>>
  ): void => {
    // 큐 admission 과 즉시 steer 가능 여부는 다른 계약이다. active 채널이 mid-turn steer 를
    // 지원하지 않아도 체인 종료 뒤 자동 continuation 으로 안전하게 전달할 수 있으므로,
    // closing 전 lease 는 입력을 held 로 수용한다. 실제 push 가능성은 턴-후 루프가 판정한다.
    const acceptsQueuedInput = lease.kind !== 'closing'
    if (!acceptsQueuedInput) {
      sendChatEvent(event.sender, {
        type: 'error',
        ...(sessionId ? { sessionId } : {}),
        error: makeClassifiedError(
          'capability_unsupported',
          '이 백엔드는 피드백 끼어들기를 지원하지 않습니다.',
          { retryable: false }
        )
      })
      return
    }
    // 0126: provider 경계 백스톱(main 측) — held 는 진행 턴 채널(spawn-바운드 env)로 flush
    // 되므로 경계를 넘는 예약은 성립하지 않는다. 렌더러 0119 가드가 1차 차단하고 이를 우회한
    // 레이스만 여기 도달한다 — 조용히 원 provider 로 실행하는 대신 거부해 드러낸다.
    // null(미지정) 은 보수적 허용(기존 흐름 불변).
    const leasedProviderKey =
      lease.kind === 'active' ? lease.providerKey : lease.requestedProviderKey
    if (crossesProviderBoundary(leasedProviderKey, data.providerKey ?? null)) {
      sendChatEvent(event.sender, {
        type: 'error',
        ...(sessionId ? { sessionId } : {}),
        error: makeClassifiedError(
          'provider_connection_error',
          '다른 공급자 모델이 선택되어 있습니다. 응답 완료 후 다시 전송하세요.',
          { retryable: true }
        )
      })
      return
    }
    const item = pendingMessages.enqueue(
      queueKey,
      {
        text: data.text,
        ...(na.attachmentTexts.length > 0 ? { attachmentTexts: na.attachmentTexts } : {}),
        ...(na.attachmentImages.length > 0 ? { attachmentImages: na.attachmentImages } : {}),
        ...(data.attachmentViews && data.attachmentViews.length > 0
          ? { attachmentViews: data.attachmentViews }
          : {})
      },
      Math.max(Date.now(), lease.admittedAt + 1),
      data.clientRequestId
    )
    sendChatEvent(event.sender, {
      type: 'message.queued',
      ...(sessionId ? { sessionId } : {}),
      id: item.id,
      text: item.text,
      ...(item.attachmentViews ? { attachmentViews: item.attachmentViews } : {}),
      createdAt: item.createdAt
    })
    // 0136 — listen 턴(백그라운드 대기) 중의 예약은 게이트 훅(PostToolBatch)이 영영 안 올 수
    // 있다(CLI 유휴). listen 프레임을 닫아 턴-후 루프가 즉시 held flush 연속 턴으로 전환한다.
    if (sessionId) listenRelease.get(sessionId)?.()
  }

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

    if (isUpdateInstallPending()) {
      sendChatEvent(event.sender, {
        type: 'error',
        error: makeClassifiedError(
          'capability_unsupported',
          '업데이트 설치가 시작되어 새 작업을 시작할 수 없습니다.',
          { retryable: false }
        )
      })
      return
    }

    const adapter =
      ctx.mockAdapter && ctx.debugMock.enabled ? ctx.mockAdapter : ctx.registry.getActive()
    if (!adapter) {
      sendChatEvent(event.sender, {
        type: 'error',
        error: makeClassifiedError('provider_connection_error', '활성 백엔드가 없습니다.', {
          retryable: true
        })
      })
      return
    }

    // 첨부 정규화(경로 추출·이미지 읽기·검증)는 턴 시작 전 단계라 아래 턴 try/catch 밖이다.
    // 여기서 throw 하면(홈 밖 경로·unsupported·binary·fs 오류) invoke 가 거부돼 renderer 의
    // fire-and-forget send 가 콘솔 rejection 으로만 남는다 → 정규 chat:error 로 surface 한다.
    //
    // **busy 판정보다 앞에 둔다(0152 AC1)**: 구 구조는 `hasSession()` 으로 busy 를 판정한 뒤
    // `reserveOnBusySession` 안에서 첨부를 await 했다. 그 await 동안 진행 턴이 끝나고 턴-후
    // 루프가 `havePending:false` 로 break·release 해버리면, 뒤늦게 held 에 착지한 예약을 flush
    // 할 주체가 사라진다(세션 idle + held 잔존 = "pending 인 채 답변완료"). 정규화를 앞으로
    // 올려 **판정 → 적재 사이에 await 가 없게** 만들면 단일 스레드 특성상 그 창이 닫힌다.
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

    // 첫 await(첨부 정규화)가 끝난 직후 논리 세션 키로 lease를 CAS 획득한다. provider 해석 등
    // 이후 await 동안 동시 send는 새 체인을 열지 않고 이 lease의 held 큐로 합류한다.
    const provisionalKey =
      parsed.data.sessionId ?? parsed.data.clientKey ?? parsed.data.clientRequestId ?? randomUUID()
    const logicalKey = parsed.data.sessionId
      ? sessionLeaseKey(parsed.data.sessionId)
      : clientLeaseKey(provisionalKey)
    const acquired = supervisor.acquireChain({
      logicalKey,
      sessionId: parsed.data.sessionId,
      owner: event.sender,
      requestedProviderKey: parsed.data.providerKey ?? null
    })
    const lease = acquired.lease
    if (!acquired.acquired) {
      if (!parsed.data.sessionId) {
        // 같은 provisional key의 재호출/후속 입력도 준비 중 lease의 held 큐로 수용한다.
        // sessionId가 아직 없어도 client key가 wire identity이므로 별도 체인을 열거나 오류
        // 버블을 만들 필요가 없다. 다른 창의 키 충돌만 소유권 위반으로 거부한다.
        if (lease.owner !== event.sender) {
          sendChatEvent(event.sender, {
            type: 'error',
            error: makeClassifiedError(
              'provider_connection_error',
              '이 대화 준비 작업은 다른 창에서 진행 중입니다.',
              { retryable: true }
            )
          })
          return
        }
        reserveOnBusySession(
          event,
          provisionalKey,
          undefined,
          lease,
          parsed.data,
          normalizedAttachments
        )
        return
      }
      reserveOnBusySession(
        event,
        parsed.data.sessionId,
        parsed.data.sessionId,
        lease,
        parsed.data,
        normalizedAttachments
      )
      return
    }
    // lease CAS 직후의 논리 admission 시각. 준비 중 후속 입력이 먼저 큐에 물질화되더라도
    // 최초 요청은 이 시각으로 정렬돼 사용자 입력 순서를 보존한다.
    const leaderAdmittedAt = lease.admittedAt

    let leaderTurn: TurnContext<WebContents> | null = null
    let leaderRuntime: SessionRuntime | null = null
    let cleanupDone = false
    let initialBatches: SteerFlushBatch[] = []
    const abortPreparing = (): void => lease.controller.abort()
    event.sender.once('destroyed', abortPreparing)
    event.sender.once('render-process-gone', abortPreparing)
    try {
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

      // 0127 — continuity 산출물(제목 마커·자동 메시지) 언어: renderer draft 생성 시점 스냅샷
      // (payload continuityLang) 우선, 부재 시 settings.language(선호 언어) 파생 폴백.
      // settingsLanguage 원문은 en 템플릿의 요약 언어 지시({language}) 보간에도 쓴다.
      const settingsLanguage = continuitySource ? ctx.settings.getAll().language : undefined
      const continuityLang = parsed.data.continuityLang ?? continuityLangFor(settingsLanguage)

      // handoff 는 main 이 자동 메시지를 조립해 text 를 대체한다(템플릿 단일 출처 = orchestration/).
      const effectiveText = parsed.data.handoffFrom
        ? buildHandoffMessage(
            continuityMeta?.title ?? null,
            parsed.data.handoffFrom,
            continuityLang,
            settingsLanguage
          )
        : parsed.data.text

      if (parsed.data.sessionId) {
        recoverSessionHistory(ctx.db, {
          sessionId: parsed.data.sessionId,
          isSessionLive: (sessionId) => supervisor.hasSession(sessionId)
        })
      }

      const controller = lease.controller
      // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
      // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
      const turn: TurnContext<WebContents> = {
        ...freshTurnLocalState(lease.control),
        controller,
        owner: event.sender,
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
        blockedSubagents: lease.control.blockedSubagents,
        // 0064 continuity — persist(session.updated)가 lineage 영속 + fork display 복사에 쓴다.
        // 초기 제목 = `[분기]/[핸드오프] <원본 제목>`(r3 피드백 — nav 최근 대화 식별, 0127 부터
        // continuityLang 스냅샷 언어의 shared continuityTitle 로 조립 — renderer draft 와 단일
        // 조립점). 원본 제목 부재 시 id 앞 8자 폴백. titleGenerationStarted=true 로 자동
        // 제목(0004)을 억제해 마커 제목을 유지한다(사용자 rename 은 그대로 가능).
        ...(continuitySource
          ? {
              lineage: {
                parentSessionId: continuitySource,
                relation: parsed.data.handoffFrom ? ('handoff' as const) : ('fork' as const)
              },
              initialTitle: continuityTitle(
                parsed.data.handoffFrom ? 'handoff' : 'fork',
                continuityLang,
                continuityMeta?.title?.trim() || continuitySource.slice(0, 8)
              )
            }
          : {}),
        // 0067 AC9 — 세션 id 확정 전 큐 키. coordinator 가 session.updated 에서 실 id 로 rekey.
        queueKey: provisionalKey
      }
      leaderTurn = turn
      if (parsed.data.sessionId) {
        supervisor.startResume(parsed.data.sessionId, turn)
        // 세션 재개 경계(카탈로그) — 신규 세션의 대응 이벤트(session.create.completed)는 sessionId
        // 발급 시점(HistoryWriter 의 session.updated persist)에 남는다.
        getLogger().child('session').info('session.resume.completed', {
          sessionId: parsed.data.sessionId,
          provider: adapter.id
        })
      } else supervisor.startNew(event.sender, turn)

      // Persistent 채널이 세션 키의 idle 핸들로 살아있으면 재사용, 아니면 fresh(0067 — pushTurn
      // 미지원 어댑터는 SessionRuntime 이 턴-스코프 폴백). 반납은 finally 의 releaseRuntime.
      if (lease.controller.signal.aborted) return
      const runtime = supervisor.acquireRuntime(
        parsed.data.sessionId,
        () => new SessionRuntime(adapter)
      )
      leaderRuntime = runtime
      if (!supervisor.activateChain(lease.leaseId, runtime, resolved.providerKey, turn)) {
        runtime.close()
        leaderRuntime = null
        return
      }

      // 0118: provider 경계 respawn — pushTurn 은 env/providerSettings 를 재주입하지 않으므로
      // 경계를 넘으면 살아있는 채널을 내려 이번 턴을 spawn(resume) 콜드 패스로 보낸다.
      // channelAlive=false 가 되어 아래 preludes 의 takeForRespawn 이월이 자연 동작한다.
      // 0125: 같은 provider 라도 settings.json 이 제자리 수정(토큰 로테이션·base URL 교체)돼
      // spawn 시점 주입본과 내용이 달라졌으면 동일하게 respawn 한다.
      // 0128: 같은 provider 안의 모델 변경(sonnet→haiku)도 respawn 한다 — 라이브 setModel(/model)은
      // 이미 스폰된 서브프로세스의 실제 생성 모델을 바꾸지 못한다(실측: /model 후에도 생성이 스폰
      // 모델에 과금). 콜드 spawn(resume)이 options.model 을 지키므로, 모델이 스폰 시점과 다르면 내린다.
      const extensions = ctx.extensions.build(
        parsed.data.sessionId,
        parsed.data.sessionId ? null : boundProjectId
      )

      if (
        parsed.data.sessionId &&
        decideRespawn({
          channelAlive: runtime.channelAlive,
          providerBoundaryChanged: crossesProviderBoundary(
            sessionMeta?.provider_key,
            resolved.providerKey
          ),
          modelChanged: resolved.model !== runtime.spawnedModel,
          providerSettingsChanged: providerSettingsChangedSinceSpawn(
            runtime.spawnedProviderSettings,
            resolved.providerSettings
          ),
          spawnedRuntimeToolsRevision: runtime.spawnedRuntimeToolsRevision,
          runtimeToolsRevision: extensions.runtimeTools?.revision
        })
      ) {
        runtime.teardownChannel()
      }

      // 0136 — 콜드 spawn 경계 = in-process 백그라운드 태스크 소멸. 이전 채널이 남긴 미정착
      // 태스크를 정착·정리해 렌더 '실행 중' 고착과 무의미한 listen 턴 개시를 막는다.
      if (parsed.data.sessionId && !runtime.channelAlive) {
        await settleDeadBackgroundTasks(turn, parsed.data.sessionId)
        if (lease.controller.signal.aborted) return
      }

      // ── 큐 경유(0067 AC5·AC6): 모든 프롬프트는 pending queue 에 적재 후 상태별로 주입된다 ──
      // ① 프렐류드: 채널 사망 이월 — 미소비 flushed(CLI 큐 소멸분) 재전달 + held 를 아이템 단위
      //    배치로 회수해 본 프롬프트 *앞에* 개별 user 메시지로 선적재한다(개별 echo→개별 커밋 =
      //    버블 구조 보존). 채널 생존 시엔 회수하지 않는다 — flushed 분은 CLI 큐에 살아있어 다음
      //    턴 P2 픽업으로, held 분은 이번 턴 게이트 flush 로 이어진다(드레인하면 이중 전달).
      const queueKey = turn.queueKey!
      const preludes: SteerFlushBatch[] = runtime.channelAlive
        ? []
        : pendingMessages.takeForRespawn(queueKey, lease.chainId)
      // ② 본 프롬프트: enqueue → 즉시 아이템 배치 flush(사용자 턴 = 즉시 주입). 커밋(user row
      //    영속·preview/provider_key·renderer 승격)은 echo 관측 단일 경로(coordinator)가 소유 —
      //    send 시점 선영속은 폐기됐다(0067 AC6).
      const queuedItem = pendingMessages.enqueue(
        queueKey,
        {
          text: effectiveText,
          ...(normalizedAttachments.attachmentTexts.length > 0
            ? { attachmentTexts: normalizedAttachments.attachmentTexts }
            : {}),
          ...(normalizedAttachments.attachmentImages.length > 0
            ? { attachmentImages: normalizedAttachments.attachmentImages }
            : {}),
          ...(parsed.data.attachmentViews.length > 0
            ? { attachmentViews: parsed.data.attachmentViews }
            : {})
        },
        leaderAdmittedAt,
        parsed.data.clientRequestId
      )
      // pending-first 렌더(0067 AC8) — renderer 낙관 항목과 id 로 합류(upsert). 새 세션은
      // sessionId 미확정이라 생략 → renderer 가 clientKey/pendingNewChatKey 로 라우팅.
      sendChatEvent(event.sender, {
        type: 'message.queued',
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        id: queuedItem.id,
        text: queuedItem.text,
        ...(queuedItem.attachmentViews ? { attachmentViews: queuedItem.attachmentViews } : {}),
        createdAt: queuedItem.createdAt
      })
      // 턴 프롬프트 예약 — origin='turn-open' 이라 확정 신호는 **첫 모델 출력**이다(0069·0151 AC1).
      //
      // **잔여 held 를 함께 병합한다(0152 AC2)**: 이전 턴이 남긴 예약이 있는데 새 항목만 예약하면
      // 새 메시지가 턴 프롬프트로 먼저 들어가고 잔여는 게이트/연속 턴으로 나중에 흘러 **입력 순서가
      // 뒤집힌다**. 구 주석의 근거("held 는 이번 턴 게이트 flush 로 이어진다")는 *busy 채널*에서만
      // 성립하고 idle send 에는 적용되지 않았다. reserveHeld 는 held 를 적재 순서(=시간 순)대로
      // 병합하므로 잔여가 앞, 새 메시지가 뒤가 된다(0067 D4 = 병합 1버블, 게이트 flush 와 동일 규칙).
      // 잔여가 없으면 종전대로 아이템 단위 배치(uuid=item id)를 유지한다.
      const mainBatch =
        pendingMessages.pending(queueKey).length > 1
          ? pendingMessages.reserveHeld(queueKey, 'turn-open', undefined, lease.chainId)!
          : pendingMessages.reserveItem(queueKey, queuedItem.id, 'turn-open', lease.chainId)!
      initialBatches = [...preludes, mainBatch]

      // plugin 배포는 query 호출 전 최신성을 멱등 보장한다. 활성/비활성 토글은
      // 파일 삭제가 아니라 런타임 options.skills 필터로 반영한다.
      await ctx.ensureExtensionsDeployedForTurn()
      if (lease.controller.signal.aborted) return

      // 백엔드 중립 확장 리소스(지침+정적 정책 append · MCP · skills · hooks)를 빌더가 조립.
      // resume 면 projectId 는 세션 바인딩에서 조회되므로 null 을 넘긴다. fork/handoff 새 세션은
      // 출발 세션에서 계승한 boundProjectId 를 쓴다.
      const wc = event.sender
      wc.removeListener('destroyed', abortPreparing)
      wc.removeListener('render-process-gone', abortPreparing)
      // 렌더러(owner) 소멸 시 진행 턴 정리 — idle "완전 멈춤"으로 잃는 자가치유(무응답 abort)를
      // 타이머가 아닌 이벤트로 대체한다(사람 판단엔 시간 제한 두지 않음 유지). 바깥 finally 에서 해제.
      // 여기는 abortTurn(turn) 이 아니라 runtime 을 직접 mark 한다 — coordinator.run 이 turn.live=runtime
      // 을 세우기 *전* 에 owner 가 사라질 수 있어, 그 창에서도 런타임 상태(cancelled)를 확실히 남긴다.
      const onOwnerGone = (): void => {
        runtime.markAborted('user_cancelled')
        controller.abort()
        // 창이 사라지면 in-process 백그라운드 태스크도 함께 죽는다 — 추적을 남기면 그 세션에
        // 다시 send 하기 전까지 영영 회수되지 않는다(clear 도달 조건이 재전송뿐이었다, 0149).
        if (turn.dbSessionId) backgroundTasks.clear(turn.dbSessionId)
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
        pendingMessages,
        backgroundTasks
      })

      // 자동 연속 턴(0067 AC7)이 같은 채널에서 후속 TurnContext 로 이어지므로, 승인·게이트 콜백은
      // 고정 turn 이 아니라 **현재 활성 턴**을 읽는다(세션-레벨 인디렉션 — SessionRuntime delegate
      // 와 같은 이유).
      let activeTurn: TurnContext<WebContents> = turn

      // 단일 권한 승인 위임 — 어댑터의 canUseTool 이 ask_question·plan_review·tool_approval 중
      // 하나를 PermissionAction 으로 넘기면, approvalId 를 발급해 permission.requested 이벤트로
      // renderer 에 surface 하고 broker 가 응답(또는 turn abort)까지 Promise 를 보류한다.
      // tool_approval 은 "세션 동안 허용"으로 부여된 도구면 카드 없이 즉시 allow 한다.
      const requestApproval = async (
        action: PermissionAction,
        sdkSignal?: AbortSignal
      ): Promise<ApprovalResolution> => {
        const turn = activeTurn
        const controller = turn.controller
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
          getLogger().child('chat').warn('chat.permission.session-missing', {
            approvalId,
            kind: action.kind,
            reason: 'permission.requested without dbSessionId — falling back to activeKey'
          })
        }
        sendChatEvent(
          wc,
          agentPermissionRequest(approvalId, outbound, turn.dbSessionId ?? undefined)
        )
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
        // 계획 승인 후처리 — SDK 세션은 어댑터가 allow 응답의 updatedPermissions 로 이미 전환했다
        // (adapters/claude.ts). 여기서는 main 세션 SSOT 를 같은 값으로 맞춰, 다음 턴 send 페이로드가
        // 도착하기 전 구간에도 controller 가 plan 이라고 답하지 않게 한다.
        if (action.kind === 'plan_review' && resolution.behavior === 'allow' && turn.dbSessionId) {
          void permissionModes.setMode(turn.dbSessionId, PLAN_APPROVED_MODE)
        }
        return resolution
      }

      // 세션 모드 SSOT 동기화 — resume 경로(sessionId 확정)에서 이번 턴 모드를 controller 에 기록.
      // 라이브 전환(setMode IPC)과 다음 턴이 같은 출처를 읽도록 한다.
      if (parsed.data.sessionId && parsed.data.permissionMode) {
        void permissionModes.setMode(parsed.data.sessionId, parsed.data.permissionMode)
      }

      // 소유권 표시(0151 AC12) — 이 턴의 wc 를 묶어 세 예약 경로(게이트 flush·롤백·연속 턴)가
      // 같은 인자로 부르게 한다. 발신 규칙 정본은 모듈 상단 sendSubmitted.
      const sendOwnership = (sessionId: string, ids: string[], submitted: boolean): void => {
        sendSubmitted(wc, sessionId, ids, submitted)
      }

      // 중단 영수증 화해(0151 AC11) — still_queued 에는 우리가 보낸 적 없는 내부 uuid(cron 트리거·
      // 백그라운드 auto-resume continuation)가 섞이므로(`sdk.d.ts:3487`), **우리 예약과의 교집합만**
      // 취한다. 모르는 uuid 를 잔여로 오인해 런타임을 폐기하면 0143 백그라운드 완료 통지가 죽는다.
      //
      // 교집합이 비지 않으면 **사용자에게 알리고 선택지를 준다**(0151 r2 / OQ1 결정). 공개 SDK 로는
      // 잔여를 취소할 수 없고(`cancel_async_message` 는 Query 메서드 아님, `interrupt()` 는 인자가
      // 없어 `cancel_queued:true` 도 못 보낸다) 남은 수단은 런타임 폐기뿐인데, 그건 백그라운드
      // 태스크를 함께 죽인다. 그 비용을 앱이 몰래 치르지 않고 사용자가 고르게 한다 — Stop 을 눌렀는데
      // 잠시 후 내 steer 가 실행되는 상황은 수동적 배지로 덮을 문제가 아니다.
      const reconcileInterrupt = (
        sessionId: string,
        receipt: InterruptReceipt | undefined,
        submittedAtInterrupt: readonly string[]
      ): void => {
        const outcome = reconcileInterruptReceipt(receipt, submittedAtInterrupt)
        const log = getLogger().child('chat')
        if (outcome.kind === 'unknown') {
          // capability 미보유(구형 CLI) — "잔여 없음" 이 아니라 "잔여 미상". 폐기하지 않는다.
          log.info('chat.interrupt.receipt-absent', { sessionId })
          return
        }
        if (outcome.kind === 'clear') {
          residualBySession.delete(sessionId)
          activity.setResidualAttempts(sessionId, [])
          return
        }
        log.info('chat.interrupt.still-queued', {
          sessionId,
          ourCount: outcome.uuids.length,
          totalCount: outcome.totalCount
        })
        residualBySession.set(sessionId, outcome.uuids)
        activity.setResidualAttempts(sessionId, outcome.uuids)
      }

      const request: TurnRequest = {
        sessionId: parsed.data.sessionId,
        // 0064 continuity — 어댑터가 resume+forkSession 으로 어댑트해 새 session id 를 발급받는다.
        ...(continuitySource ? { forkFrom: continuitySource } : {}),
        // 0127 — 핸드오프 도착 턴 표식: 매퍼가 압축 경계 전의 승계 컨텍스트 usage 를 무효화한다.
        ...(parsed.data.handoffFrom ? { handoff: true } : {}),
        // 본 프롬프트 = 큐에서 방금 flush 한 아이템 배치(0067 AC5). promptUuid=item id 가 echo
        // 상관키가 돼 커밋(user row 영속·renderer 승격)이 echo 관측 단일 경로로 흐른다(AC6).
        text: mainBatch.text,
        promptUuid: mainBatch.uuid,
        // 채널 사망 이월(프렐류드) — 본 프롬프트 앞에 개별 user 메시지로 선적재(위 ① 주석).
        ...(preludes.length > 0 ? { preludes } : {}),
        cwd: turn.cwd,
        signal: controller.signal,
        extensions,
        env: turnEnv,
        providerSettings: resolved.providerSettings,
        model: resolved.model,
        requestApproval,
        permissionMode: parsed.data.permissionMode,
        effort: parsed.data.effort,
        // 게이트 훅(PostToolBatch) 시점에 로컬 홀드 pending 을 병합 단일 배치로 회수(0060 D3·D4).
        // 활성 턴의 dbSessionId 를 훅 발화 시점에 동적으로 읽는다 — 새 세션 턴은 session.updated
        // 전까지 null(그동안 예약 자체가 불가능하므로 빈 회수가 옳다).
        takeSteerFlush: () => {
          const sid = activeTurn.dbSessionId
          if (!sid) return undefined
          const batch = pendingMessages.reserveHeld(sid, 'steer', undefined, lease.chainId)
          return batch
        },
        // 입력 채널이 배치를 거부하면(closed stream / push 예외) 예약을 held 로 되돌린다(AC4).
        rollbackSteerFlush: (batch) => {
          const sid = activeTurn.dbSessionId
          if (!sid) return
          if (pendingMessages.rollback(sid, batch.uuid)) sendOwnership(sid, batch.ids, false)
        },
        commitSteerFlush: (batch) => {
          const sid = activeTurn.dbSessionId
          if (!sid) return false
          const committed = pendingMessages.commit(
            sid,
            batch.attemptId ?? batch.uuid,
            lease.chainId
          )
          if (committed) sendOwnership(sid, batch.ids, true)
          return committed
        },
        canSubmitInitial: () => {
          const sid = activeTurn.dbSessionId ?? queueKey
          return pendingMessages.canCommitMany(
            sid,
            initialBatches.map((batch) => ({
              messageIds: batch.ids,
              attemptId: batch.attemptId ?? batch.uuid,
              chainId: batch.chainId ?? lease.chainId
            }))
          )
        },
        commitInitialSubmission: () => {
          const sid = activeTurn.dbSessionId ?? queueKey
          const committed = pendingMessages.commitMany(
            sid,
            initialBatches.map((batch) => ({
              messageIds: batch.ids,
              attemptId: batch.attemptId ?? batch.uuid,
              chainId: batch.chainId ?? lease.chainId
            }))
          )
          if (committed && activeTurn.dbSessionId) {
            for (const batch of initialBatches)
              sendOwnership(activeTurn.dbSessionId, batch.ids, true)
          }
          return committed
        },
        rollbackInitialSubmission: () => {
          const sid = activeTurn.dbSessionId ?? queueKey
          for (const batch of initialBatches) {
            if (
              pendingMessages.rollback(sid, batch.attemptId ?? batch.uuid) &&
              activeTurn.dbSessionId
            ) {
              sendOwnership(activeTurn.dbSessionId, batch.ids, false)
            }
          }
        },
        captureInterruptReceipt: () => {
          const sid = activeTurn.dbSessionId
          if (!sid) return undefined
          const submittedAtInterrupt = pendingMessages.submittedUuids(sid)
          return (receipt) => reconcileInterrupt(sid, receipt, submittedAtInterrupt)
        },
        onChannelRetired: () => {
          const sid = activeTurn.dbSessionId
          if (sid) void settleDeadBackgroundTasks(activeTurn, sid)
        },
        isSubagentBlocked: (st) => st !== undefined && activeTurn.blockedSubagents.has(st),
        attachmentTexts: normalizedAttachments.attachmentTexts,
        attachmentImages: normalizedAttachments.attachmentImages
      }

      // listen phase 레벨 신호(0143) — renderer 의 listening 상태(inflight 지속·send=steer 라우팅)
      // 를 구동한다. 개별 listen 턴 경계가 아니라 **턴-후 루프 스코프**로 started 1회/ended 1회 —
      // 연속 listen 턴·중간 held-flush 연속 턴을 관통해 깜빡임을 없앤다. sendChatEvent 직행(버스
      // 미경유)이라 history/usage 는 구조적으로 못 본다(미영속 — message.queued 동렬).
      let listenPhaseSessionId: string | null = null
      const beginListenPhase = (sessionId: string): void => {
        if (listenPhaseSessionId) return
        listenPhaseSessionId = sessionId
        activity.setTransport(sessionId, 'listening')
      }
      const endListenPhase = (): void => {
        if (!listenPhaseSessionId) return
        const sessionId = listenPhaseSessionId
        listenPhaseSessionId = null
        activity.setTransport(sessionId, 'idle')
      }

      try {
        await coordinator.run(turn, request, { boundProjectId })
        // 자동 연속 턴(0067 AC7) — 턴 종료 시 held 잔여(어시스턴트 턴 중 예약됐으나 게이트를 못
        // 만난 메시지)를 즉시 다음 턴으로 잇는다. 사용자 개입 없음. 명시 취소(controller abort)
        // 시에는 발동하지 않는다 — 중단 버튼이 held 를 이미 drain(draft 복원)했다.
        // 0136/0143 — held 가 없어도 미정착 백그라운드 태스크가 살아 있으면 listen 턴(입력 push
        // 없는 프레임 소비)으로 CLI 자동 턴(진행·task_notification·완료 알림 턴)을 라이브 배달한다.
        // 0143 기본화: 게이트 없음(구 opt-in env 게이트·0138 기본 배제 폐기).
        while (
          !lease.controller.signal.aborted &&
          !activeTurn.controller.signal.aborted &&
          activeTurn.dbSessionId
        ) {
          const sessionId = activeTurn.dbSessionId
          // 채널이 죽었으면 in-process 백그라운드 태스크도 소멸 — 정착·정리(고착 방지, 0136).
          if (!runtime.channelAlive) {
            await settleDeadBackgroundTasks(activeTurn, sessionId)
            if (lease.controller.signal.aborted) break
          }
          // 다음 스텝 판정(순수, 0143) — pushTurn 은 "CLI 유휴 + 백로그 없음" 채널에서만(버그 a).
          // 미확정 예약(0154) — pending() 은 held 만 반환하므로 "CLI 에 넘겨놓고 echo 를 기다리는
          // 중" 이라는 상태는 별도로 읽어야 한다. 이 입력이 없어서 턴 체인이 그 상태를 못 보고 끊겼다.
          const haveUnconfirmed = pendingMessages.hasSubmitted(sessionId)
          const pendingMessageCount = pendingMessages.pending(sessionId).length
          const taskCount = backgroundTasks.count(sessionId)
          const havePending = pendingMessageCount > 0
          const haveTasks = taskCount > 0
          const channelBusy = runtime.channelBusy
          const hasBacklog = runtime.hasUnframedBacklog
          const step = decidePostTurnStep({
            havePending,
            haveTasks,
            channelAlive: runtime.channelAlive,
            channelBusy,
            hasBacklog,
            haveUnconfirmed
          })
          getLogger().child('chat').info('chat.postturn.step', {
            sessionId,
            step,
            havePending,
            haveTasks,
            haveUnconfirmed,
            channelBusy,
            hasBacklog,
            taskCount,
            pendingMessageCount
          })
          const prepareContinuation: () => ReturnType<typeof prepareAutomaticContinuation> = () =>
            prepareAutomaticContinuation({
              runtime,
              providerKey: activeTurn.providerKey,
              modelFamily: parsed.data.modelFamily ?? null,
              fallbackModel: request.model,
              resolveProvider: ({ providerKey, modelFamily }) =>
                resolveTurnProvider(ctx, { adapter, sessionId, providerKey, modelFamily }),
              buildExtensions: () => ctx.extensions.build(sessionId, null)
            })
          // 세션 점유 신호(0153 F1) — `listen` 뿐 아니라 `flush`(held 를 연속 턴으로 잇는 경로)도
          // main 은 busy 다. 구 구조는 listen 스텝에서만 신호를 보내 renderer 가 이 구간을 idle 로
          // 오판했고, 그 창의 send 가 낙관 커밋 경로를 타 **잔여보다 앞에** 렌더됐다(DB 는 반대 순서
          // → 재시작 시 위치 재조정). 판정은 post-turn 의 순수 함수가 소유한다.
          if (postTurnHoldsSession(step)) beginListenPhase(sessionId)
          if (step === 'break') {
            // 턴 체인 종료(0151 AC7 → 0154 개정) — 확정 신호가 오지 않은 예약을 orphaned 로 내려
            // **관측 가능하게만** 한다. 폐기하지 않는다.
            //
            // **0151 OQ2("폐기 후 draft 복원")를 실측으로 철회한다.** 그 결정은 미확정 상태를 "CLI 가
            // 못 봤다" / "봤는데 echo 가 유실됐다" 둘로만 보고 구분 불가하니 사용자에게 되돌린다는
            // 것이었다. 실기 로그(세션 8c70aacd)가 **제3의 상태**를 보여줬다 — *아직 안 봤을 뿐, 곧
            // 본다*. push 된 배치는 `priority:'next'` 로 CLI 큐에 살아 있고(streaming-input.ts:35-38),
            // CLI 는 다음 턴 프롬프트로 정상 픽업한다. 실제로 사용자가 다음 메시지를 보내자 CLI 가
            // 그 배치의 답변을 먼저 내놓았다 — **버블만 우리가 지웠고 대화는 진행됐다.**
            //
            // 따라서 재주입도(이중 전달) 폐기도(유실) 답이 아니고, 옳은 것은 **기다리는 것**이다.
            // 회수는 CLI 큐가 실제로 사라지는 시점이 맡는다: 채널 사망 → takeForRespawn 이 이월,
            // 세션 폐기/종료 → dispose·disposeAll. 0151 이 막으려던 영구 잔존은 그 경로로 막힌다.
            const orphaned = pendingMessages.orphanUnconfirmed(sessionId, lease.chainId)
            if (orphaned.length > 0) {
              getLogger()
                .child('chat')
                .info('chat.steer.orphaned', { sessionId, count: orphaned.length })
            }
            break
          }
          if (step === 'listen') {
            // 유예를 1라운드로 묶는다(0154) — listen 을 여는 김에 미확정 예약을 orphaned 로 강등한다.
            // 강등해도 늦은 echo 는 여전히 확정할 수 있고(confirm 의 open 술어가 orphaned 포함),
            // haveUnconfirmed 는 submitted 만 세므로 다음 평가에서 break 에 정상 도달한다(무한 대기 방지).
            if (haveUnconfirmed) pendingMessages.orphanUnconfirmed(sessionId, lease.chainId)
            // listen 턴 — settle/persist/relay/usage/title 은 일반 턴과 같은 버스 파이프라인.
            // 종료 후 루프 재평가: 알림 턴이 pending 을 남겼으면 연속 턴, 태스크가 남았으면 재개.
            // (phase 신호는 위 postTurnHoldsSession 이 이미 열었다 — 0153 F1.)
            const continuation = await prepareContinuation()
            if (lease.controller.signal.aborted || activeTurn.controller.signal.aborted) break
            if (continuation.shouldRespawn) runtime.teardownChannel()
            const listenTurn = makeContinuationTurn(activeTurn)
            supervisor.startResume(sessionId, listenTurn)
            activeTurn = listenTurn
            // listen 요청은 **최소 리터럴**로 조립한다(0149) — 원 턴 request 를 spread 하면 그
            // 턴의 base64 첨부(수 MB)가 listen phase(분 단위) 내내 살아남는다. listen 경로가
            // 실제로 읽는 것은 프레임 위임(requestApproval·takeSteerFlush)·관측 메타뿐이다.
            const listenRequest: TurnRequest = {
              sessionId,
              text: '',
              cwd: request.cwd,
              extensions: continuation.extensions,
              signal: listenTurn.controller.signal,
              ...(continuation.model !== undefined ? { model: continuation.model } : {}),
              ...(continuation.providerSettings
                ? { providerSettings: continuation.providerSettings }
                : {}),
              ...(request.requestApproval ? { requestApproval: request.requestApproval } : {}),
              ...(request.takeSteerFlush ? { takeSteerFlush: request.takeSteerFlush } : {}),
              ...(request.captureInterruptReceipt
                ? { captureInterruptReceipt: request.captureInterruptReceipt }
                : {}),
              ...(request.onChannelRetired ? { onChannelRetired: request.onChannelRetired } : {})
            }
            // busy send 릴리즈 밸브 — 예약(held) 적재 직후 listen 프레임을 닫아 즉시 전환(0136).
            // CLI 가 자동 턴 진행 중이면 no-op(0143 유예) — terminal 자연 마감 후 루프가 flush.
            listenRelease.set(sessionId, () => runtime.endListenFrame())
            try {
              await coordinator.run(listenTurn, listenRequest, {
                boundProjectId,
                kind: 'listen'
              })
            } finally {
              listenRelease.delete(sessionId)
              supervisor.release(listenTurn)
            }
            // 사용자 중단(0143, 사용자 확정) — 대기 종료와 함께 실행 중 태스크도 중지·정착한다.
            if (listenTurn.controller.signal.aborted) {
              await stopAndSettleAbortedTasks(listenTurn, sessionId)
            }
            continue
          }
          // 0126: 연속 턴 settings 신선도 재판정 — providerKey 는 원 턴 키로 고정(선택 변경은
          // 다음 사용자 send 부터, 0119)하고 settings blob 만 재해석한다. spawn 주입본과 내용이
          // 다르면 teardown — 아래 channelAlive 분기가 채널-사망 경로(takeForRespawn)로 자연
          // 전환되고, respawn 은 contRequest 의 신선한 blob 으로 스폰한다(stale 재사용 방지).
          const continuation = await prepareContinuation()
          if (lease.controller.signal.aborted || activeTurn.controller.signal.aborted) break
          if (continuation.shouldRespawn) runtime.teardownChannel()
          let contPreludes: SteerFlushBatch[] = []
          let batch: SteerFlushBatch | undefined
          if (runtime.channelAlive) {
            // 채널 생존 — held 병합 단일 배치(D4 1버블)를 pushTurn 프롬프트로. 게이트 flush 와
            // 같은 메서드지만 여기서는 **턴 프롬프트**라 origin 이 다르다(0151 AC1 — 확정 신호가
            // echo 가 아니라 첫 모델 출력).
            batch = pendingMessages.reserveHeld(sessionId, 'turn-open', undefined, lease.chainId)
            // 소유권 전이 고지(0153 F3) — 0151 AC12 는 게이트(takeSteerFlush) 경로만 덮어서, 이
            // 연속 턴 예약분은 버블이 "취소 가능" 인 채로 남았다(눌러도 main 이 조용히 거부).
          } else {
            // 채널 사망 — respawn 이월 전체를 회수해 마지막을 본 프롬프트, 앞을 프렐류드로.
            const leftovers = pendingMessages.takeForRespawn(sessionId, lease.chainId)
            batch = leftovers.pop()
            contPreludes = leftovers
          }
          if (!batch) break
          initialBatches = [...contPreludes, batch]
          const contTurn = makeContinuationTurn(activeTurn)
          supervisor.startResume(sessionId, contTurn)
          activeTurn = contTurn
          const contRequest: TurnRequest = {
            ...request,
            sessionId,
            text: batch.text,
            promptUuid: batch.uuid,
            signal: contTurn.controller.signal,
            attachmentTexts: batch.attachmentTexts ?? [],
            attachmentImages: batch.attachmentImages ?? [],
            extensions: continuation.extensions,
            // 0126: respawn 대비 신선한 settings 로 교체 — 해석 실패(undefined)면 원본 유지(보수적).
            ...(continuation.providerSettings
              ? { providerSettings: continuation.providerSettings }
              : {}),
            ...(continuation.model !== undefined ? { model: continuation.model } : {}),
            ...(contPreludes.length > 0 ? { preludes: contPreludes } : {})
          }
          // 연속 턴은 fork/프렐류드(원 요청분)를 계승하지 않는다 — 재분기·이중 전달 방지.
          // handoff 표식(0127)도 동렬 제거 — 승계 시 후속 연속 턴의 실측 telemetry 를 버리게 된다.
          delete contRequest.forkFrom
          delete contRequest.handoff
          if (contPreludes.length === 0) delete contRequest.preludes
          try {
            await coordinator.run(contTurn, contRequest, { boundProjectId })
          } finally {
            supervisor.release(contTurn)
          }
        }
      } finally {
        // listen phase 종료 신호(0143) — 정상 종료·break·중단·throw 전 경로에서 renderer 의
        // listening 상태를 반드시 내린다.
        endListenPhase()
        wc.removeListener('destroyed', onOwnerGone)
        wc.removeListener('render-process-gone', onOwnerGone)
        const finalSessionId = activeTurn.dbSessionId ?? turn.dbSessionId
        // 제출 수용 전 예외가 재시도 한도를 소진한 경우에만 submitting 예약을 held 로 복구한다.
        // 이미 submitted/confirmed/orphaned 인 배치는 rollback fence가 거부하므로 이중 전달되지 않는다.
        request.rollbackInitialSubmission?.()
        if (finalSessionId) pendingMessages.orphanUnconfirmed(finalSessionId, lease.chainId)
        // turn 핸들 teardown(레지스트리 제거)과 runtime 수명은 분리한다 — Persistent 핸들은 정상
        // 종료 시 세션 키로 idle 보존되고, 그 외(에러·OneShot)는 즉시 close.
        supervisor.release(turn)
        supervisor.releaseRuntime(finalSessionId, runtime)
        supervisor.releaseChain(lease.leaseId)
        cleanupDone = true
      }
    } catch (err) {
      sendChatEvent(event.sender, {
        type: 'error',
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        error: adapter.classifyError(err, 'prepareTurn')
      })
    } finally {
      event.sender.removeListener('destroyed', abortPreparing)
      event.sender.removeListener('render-process-gone', abortPreparing)
      if (!cleanupDone) {
        const key = leaderTurn?.dbSessionId ?? leaderTurn?.queueKey ?? provisionalKey
        for (const batch of initialBatches) {
          pendingMessages.rollback(key, batch.attemptId ?? batch.uuid)
        }
        const restored = pendingMessages.cancelAllHeld(key)
        if (restored.length > 0 && parsed.data.sessionId) {
          sendChatEvent(event.sender, {
            type: 'message.cancelled',
            sessionId: parsed.data.sessionId,
            ids: restored.map((item) => item.id)
          })
        }
        if (leaderTurn) supervisor.release(leaderTurn)
        if (leaderRuntime) leaderRuntime.close()
        supervisor.releaseChain(lease.leaseId)
      }
    }
  }

  // 자동 연속 턴의 TurnContext — 직전 턴의 세션/메타를 계승하고 턴-로컬 상태만 초기화한다.
  const makeContinuationTurn = (prev: TurnContext<WebContents>): TurnContext<WebContents> => ({
    ...freshTurnLocalState({
      taskIds: prev.subagentTaskIds,
      subagentTypes: prev.subagentTypes,
      stoppedSubagents: prev.stoppedSubagents,
      blockedSubagents: prev.blockedSubagents,
      cancelled: prev.controller.signal.aborted
    }),
    controller: new AbortController(),
    owner: prev.owner,
    titleAdapter: prev.titleAdapter,
    titleSettings: prev.titleSettings,
    titleEnv: prev.titleEnv,
    titleModel: prev.titleModel,
    providerKey: prev.providerKey,
    pendingUserText: null,
    firstUserText: prev.firstUserText,
    pendingAttachmentViews: [],
    dbSessionId: prev.dbSessionId,
    pendingProjectId: null,
    isNewSession: false,
    cwd: prev.cwd,
    titleGenerationStarted: prev.titleGenerationStarted,
    blockedSubagents: prev.blockedSubagents
  })

  // chatSend 는 검증 실패를 reject 가 아닌 error 이벤트로 회신하는 특례 — handlePlain 으로
  // 등록하고 핸들러 서두에서 직접 safeParse 한다. 턴 진입을 runWithLogContext 로 감싸(0124 AC4)
  // 이 턴의 비동기 흐름(chat/engine/db)에서 emit 되는 로그가 동일 correlationId 로 묶인다.
  handlePlain(CHANNELS.chatSend, (raw, event) =>
    runWithLogContext({ correlationId: randomUUID() }, () => handleChatSend(event, raw))
  )

  // held 단건 취소(pending 버블 hover) — flushed(주입 완료) 항목은 거부(무이벤트), 이후 echo
  // 커밋이 버블을 복원한다(D3 정직 화해). 구 chat:steer 채널은 chat:send 로 흡수됐다(0067 AC5).
  handle(CHANNELS.chatSteerCancel, CancelSteerSchema, 'reject', (req, event): void => {
    const removed = pendingMessages.cancel(req.sessionId, req.id)
    if (!removed) {
      // 0151 AC12 — 거부를 침묵하지 않는다. 예약된 항목은 이미 소유권이 넘어갔으므로 그 사실을
      // 돌려줘 renderer 가 버블을 "전달됨"(취소 버튼 없음)으로 재동기화한다. 구 구현은 무이벤트
      // 반환이라, 사용자가 취소를 눌러도 화면에 아무 변화가 없었다.
      sendSubmitted(event.sender, req.sessionId, [req.id], true)
      return
    }
    sendChatEvent(event.sender, {
      type: 'message.cancelled',
      sessionId: req.sessionId,
      ids: [req.id]
    })
  })

  // 세션 전체 중단(0151 r2 / OQ1 결정) — Stop 뒤에도 CLI 큐에 살아남은 **우리** 예약을 없애는
  // 유일한 수단. 공개 SDK 에 provider 큐 개별 취소 표면이 없으므로 런타임(서브프로세스)을 폐기해
  // 큐를 통째로 소멸시킨다. **백그라운드 서브에이전트도 함께 죽으므로** 자동화하지 않고 사용자가
  // 명시적으로 고를 때만 실행된다(renderer 는 chat.activity의 residualCount가 있을 때만 제시).
  handle(CHANNELS.chatDiscardSession, DiscardSessionSchema, 'reject', (req, event): void => {
    const residual = residualBySession.get(req.sessionId) ?? []
    residualBySession.delete(req.sessionId)
    activity.setResidualAttempts(req.sessionId, [])
    // 진행 중 턴이 남아 있으면 먼저 끊는다 — 그래야 런타임이 풀로 반납돼 폐기 대상이 된다.
    const turn = supervisor.getBySession(req.sessionId)
    if (turn) abortTurn(turn, 'user_cancelled')
    supervisor.discardRuntime(req.sessionId)
    // 큐 잔여를 되돌려준다 — 서브프로세스와 함께 CLI 큐가 사라졌으므로 이 예약들은 확실히
    // 실행되지 않는다. 텍스트는 draft 로 복원해 사용자가 재전송을 정한다.
    const discarded = pendingMessages.discardSubmitted(req.sessionId, residual)
    const ids = discarded.flatMap((batch) => batch.ids)
    if (ids.length > 0) {
      sendChatEvent(event.sender, { type: 'message.cancelled', sessionId: req.sessionId, ids })
    }
    getLogger()
      .child('chat')
      .info('chat.session.discarded', { sessionId: req.sessionId, discarded: ids.length })
  })

  handle(CHANNELS.chatCancel, CancelChatSchema, 'reject', (req, event): void => {
    // 중단 버튼 = 턴 interrupt + held 전량 취소(0067 확정 5). renderer 는 message.cancelled 의
    // 잔존 항목 텍스트를 composer draft 로 복원한다(편집 가능). flushed 분은 회수 불가(D3) —
    // 소비되면 echo 커밋으로 정직 화해. controller abort 가 자동 연속 루프도 차단한다.
    const removed = pendingMessages.cancelAllHeld(req.sessionId)
    if (removed.length > 0) {
      sendChatEvent(event.sender, {
        type: 'message.cancelled',
        sessionId: req.sessionId,
        ids: removed.map((item) => item.id)
      })
    }
    supervisor.cancelChain(req.sessionId)
    const turn = supervisor.getBySession(req.sessionId)
    if (!turn) return
    abortTurn(turn, 'user_cancelled')
    // 진행 중이던 도구(최상위 + 서브에이전트 child)를 중단 결과로 정착 — 안 하면 결과가
    // 영영 안 와 "실행 중"으로 무한 렌더되고 부모 Task 가 "진행 중"으로 남는다. turn.aborted 전에.
    settleOpenToolRuns(turn, emitTurn, 'aborted')
    // 중단 턴은 버스 telemetry 없이 끝난다 — 진행 중 assistant 메시지의 content(FTS 캐시)를
    // 여기서 마감 기록한다(0107). settle 의 합성 tool_result 영속 뒤에 와야 한다.
    persistence.finalizeTurn(turn)
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
    const trackerSessionId = turn.dbSessionId ?? req.sessionId
    // per-task background 관측(0143) — settled(추적 해제)가 관측까지 지우므로 **해제 전에** 읽는다.
    const alreadyBackground = backgroundTasks.isAsyncLaunched(trackerSessionId, req.toolUseId)
    // 0136 — 사용자 중단은 즉시 추적 해제(아래 합성 settled 는 버스 직행이라 coordinator 의
    // 추적 훅을 지나지 않는다). 늦게 오는 SDK task_notification(stopped)의 해제는 멱등.
    backgroundTasks.settled(trackerSessionId, req.toolUseId)

    // 사용자 자기 행위의 통지는 소음(0143 설계 결정) — background 플래그를 싣지 않아
    // subagent_notice 미생성. 행 상태('중단')와 패널이 이미 결과를 보여준다.
    settleSubagentTask(turn, emitTurn, {
      type: 'subagent.task',
      sessionId: trackerSessionId,
      toolUseId: req.toolUseId,
      phase: 'settled',
      status: 'stopped'
    })

    await stopLiveSubagent(turn.live, req.toolUseId, taskId, alreadyBackground)
  })
}

// chat 턴 파이프라인 — orca:chat:send 의 이벤트 루프(어댑터 LiveTurn 소비 → persist →
// sendChatEvent)와 orca:chat:cancel. 턴 상태는 TurnRegistry, 영속은 TurnPersistence,
// 승인 왕복은 ApprovalCoordinator 에 위임하고 여기는 오케스트레이션만 담당한다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { CHANNELS, type ApprovalResolution, type PermissionAction } from '../../../shared/ipc'
import { CancelChatSchema, SendChatMessageSchema } from '../../../shared/protocol'
import { appEnv } from '../../config/orca-config'
import {
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  mergeEnvLayers,
  modelNameForFamily,
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
import type { InflightTurn, TurnRegistry } from './turn-registry'

export interface ChatDeps {
  ctx: RouterContext
  turns: TurnRegistry<WebContents>
  approvals: ApprovalCoordinator
  persistence: TurnPersistence
  permissionModes: PermissionModeController
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
  return {
    providerKey: selected.key,
    ...(providerSettings ? { providerSettings } : {}),
    ...(model ? { model } : {})
  }
}

// subprocess env 조립 — uv 런타임 env 베이스 위에 orca.json 앱 전역 env(${VAR} 확장)를 병합.
function buildTurnEnv(
  ctx: RouterContext,
  pyEnv: Record<string, string> | undefined
): Record<string, string> | undefined {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length > 0) {
    console.warn(`[orca-config] 미해결 환경변수로 일부 앱 env 키를 건너뜀: ${missing.join(', ')}`)
  }
  return mergeEnvLayers(pyEnv, expanded)
}

export function registerChatHandlers(deps: ChatDeps): void {
  const { ctx, turns, approvals, persistence, permissionModes } = deps

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

    // Python 런타임 env (uv 격리) + orca.json 앱 전역 env. ready 전이면 앱 env 만 (없으면 SDK 기본).
    const turnEnv = buildTurnEnv(ctx, ctx.runtime.getEnv() ?? undefined)

    const controller = new AbortController()
    // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
    // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
    const turn: InflightTurn = {
      controller,
      live: null,
      titleAdapter: adapter,
      titleSettings: resolved.providerSettings,
      titleEnv: turnEnv,
      providerKey: resolved.providerKey,
      pendingUserText: parsed.data.text,
      firstUserText: parsed.data.text,
      dbSessionId: parsed.data.sessionId,
      pendingProjectId: parsed.data.sessionId ? null : parsed.data.projectId,
      isNewSession: parsed.data.sessionId == null,
      cwd: ctx.getCwd(),
      titleGenerationStarted: false,
      currentAssistantMessageId: null,
      assistantText: '',
      pendingAskAnswers: [],
      askPendingIds: [],
      askResolved: new Map()
    }
    if (parsed.data.sessionId) turns.startResume(parsed.data.sessionId, turn)
    else turns.startNew(event.sender, turn)

    // resume 경로: sessionId 가 들어왔다는 건 이전 init 으로 sessions row 가 이미
    // 존재한다는 의미. 다음 init 이벤트를 기다리지 않고 user 메시지를 즉시 기록.
    if (parsed.data.sessionId) {
      const now = Date.now()
      persistence.persistUserMessage(parsed.data.sessionId, parsed.data.text, now)
      ctx.db.updateSessionPreview(parsed.data.sessionId, previewOf(parsed.data.text), now)
      ctx.db.updateSessionProviderKey(parsed.data.sessionId, turn.providerKey, now)
      turn.pendingUserText = null
    }

    // 백엔드 중립 확장 리소스(지침+PY_AGENT_RULES · MCP · skills · hooks)를 빌더가 조립.
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
    const requestApproval = async (action: PermissionAction): Promise<ApprovalResolution> => {
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
      sendChatEvent(wc, agentPermissionRequest(approvalId, outbound))
      const resolution = await approvals.register(approvalId, turn, controller.signal)
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
      // sendMessage 가 query() 를 즉시 시작하므로 try 안에서 호출 — 동기 throw 도 동일 경로로 분류.
      const live = adapter.sendMessage({
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
        effort: parsed.data.effort
      })
      turn.live = live
      for await (const ev of live.events) {
        persistence.persist(turn, ev)
        sendChatEvent(event.sender, ev)
        // sessionId 발급(session.updated) — 새-채팅 pending 턴을 sessionId 키로 승격.
        if (ev.type === 'session.updated') {
          turns.promote(event.sender, ev.sessionId)
        }
        // AskUserQuestion tool 호출이 도착하면 id 를 페어링 큐에 넣고 답변과 매칭 시도.
        if (ev.type === 'tool.call.started' && ev.toolName === 'AskUserQuestion') {
          turn.askPendingIds.push(ev.toolRunId)
          persistence.flushAskAnswers(turn, event.sender)
        }
      }
    } catch (err) {
      // sessionId 가 확정된 턴이면 부착 — renderer 멀티세션 store 가 정확한 엔트리로
      // 라우팅한다(없으면 활성 엔트리 폴백, handoff 0013).
      sendChatEvent(event.sender, {
        type: 'error',
        ...(turn.dbSessionId ? { sessionId: turn.dbSessionId } : {}),
        // 어댑터 소유 분류기(0016) — provider 는 어댑터가 자기 id 로 채운다. 표시용, 분기 미사용.
        error: adapter.classifyError(err, 'sendMessage')
      })
    } finally {
      turns.finish(turn)
    }
  }

  // chatSend 는 검증 실패를 reject 가 아닌 error 이벤트로 회신하는 특례 — handlePlain 으로
  // 등록하고 핸들러 서두에서 직접 safeParse 한다.
  handlePlain(CHANNELS.chatSend, (raw, event) => handleChatSend(event, raw))

  handle(CHANNELS.chatCancel, CancelChatSchema, 'reject', (req): void => {
    turns.getBySession(req.sessionId)?.controller.abort()
  })
}

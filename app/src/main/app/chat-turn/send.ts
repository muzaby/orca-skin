// chat:send 오케스트레이션 (0179 에서 892줄 단일 클로저에서 분해).
//
// 이 파일은 **순서**를 소유한다 — 판정(`admission.ts`)·조립(`turn-context.ts`·`turn-request.ts`·
// `continuation.ts`)·실행(`post-turn.ts`)은 각자의 모듈이 갖고, 여기서는 그것들을 이름 붙은
// 단계로 이어 붙이고 renderer 발신과 정리를 한다.
//
// **순서가 계약인 곳 3군데** (주석 옮겨쓰지 말고 이 이유를 지킬 것):
//  ① 첨부 정규화는 busy 판정보다 **앞** (0152 AC1) — 판정↔적재 사이에 await 가 생기면, 그 동안
//     진행 턴이 끝나 턴-후 루프가 `havePending:false` 로 break·release 해버려 뒤늦게 held 에
//     착지한 예약을 flush 할 주체가 사라진다.
//  ② lease CAS 직후 `leaderAdmittedAt` 고정 — 준비 중 후속 입력이 먼저 큐에 물질화돼도 최초
//     요청이 이 시각으로 정렬돼 사용자 입력 순서가 보존된다.
//  ③ `activeTurn`·`initialBatches` 는 **게터로** 넘긴다 — 자동 연속 턴과 finally 정리가 함께
//     보는 가변 상태라, 값으로 캡처하면 연속 턴에서 콜백이 옛 턴을 본다.

import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { ifPresent } from '../../../shared/obj'
import type { AttachmentView } from '../../../shared/ipc'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/turn'
import type { TurnContext } from '../../contracts/turn'
import { normalizeAttachments } from '../../features/chat/attachments'
import { TurnCoordinator } from '../../features/chat/turn-coordinator'
import type { SessionRuntime } from '../../features/sessions/session-runtime'
import { getLogger } from '../../infra/log'
import { sendChatEvent } from '../../infra/ipc/send'
import { prepareAutomaticContinuation } from '../chat-turn-continuation'
import { admitChatSend, attachmentFailure, foreignPreparingLease, leaseKeyFor } from './admission'
import { buildTurnContext } from './turn-context'
import { resolveTurn } from './resolve-turn'
import { acquireTurnRuntime } from './runtime-entry'
import { enqueueTurnPrompt } from './enqueue'
import { chatForward, resolveTurnProvider } from './turn-setup'
import { buildTurnRequest } from './turn-request'
import { createApprovalRequester } from './approval'
import { runTurnWithContinuations } from './post-turn'
import type { ChatRuntimeDeps, NormalizedAttachments } from './deps'
import { makeClassifiedError } from '../../infra/errors'
import { prepareTurnExecution } from './prepare-worktree'

export async function handleChatSend(
  deps: ChatRuntimeDeps,
  event: IpcMainInvokeEvent,
  raw: unknown
): Promise<void> {
  const {
    ctx,
    supervisor,
    bus,
    approvals,
    persistence,
    permissionModes,
    pendingMessages,
    backgroundTasks,
    activity
  } = deps

  // ── 1. 진입 게이트 (순수 판정 — admission.ts) ───────────────────────────────
  const adapter =
    ctx.mockAdapter && ctx.debugMock.enabled ? ctx.mockAdapter : ctx.registry.getActive()
  const admission = admitChatSend({
    raw,
    updateInstallPending: deps.isUpdateInstallPending(),
    hasActiveAdapter: adapter != null
  })
  if (!admission.ok) {
    sendChatEvent(event.sender, { type: 'error', error: admission.error })
    return
  }
  const payload = admission.data
  // admitChatSend 가 hasActiveAdapter 를 이미 통과시켰다.
  const activeAdapter = adapter!

  // ── 2. 첨부 정규화 (busy 판정 앞 — 위 ①) ──────────────────────────────────
  let normalizedAttachments: NormalizedAttachments
  try {
    normalizedAttachments = await normalizeAttachments(payload.attachments)
  } catch (err) {
    sendChatEvent(event.sender, {
      type: 'error',
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      error: attachmentFailure(err)
    })
    return
  }

  // ── 3. lease 획득 · busy 면 예약으로 수용 ──────────────────────────────────
  const { provisionalKey, logicalKey } = leaseKeyFor(payload)
  const acquired = supervisor.acquireChain({
    logicalKey,
    sessionId: payload.sessionId,
    owner: event.sender,
    requestedProviderKey: payload.providerKey ?? null
  })
  const lease = acquired.lease
  if (!acquired.acquired) {
    // 같은 provisional key 의 재호출/후속 입력도 준비 중 lease 의 held 큐로 수용한다.
    // 다른 창의 키 충돌만 소유권 위반으로 거부한다.
    if (!payload.sessionId && lease.owner !== event.sender) {
      sendChatEvent(event.sender, { type: 'error', error: foreignPreparingLease() })
      return
    }
    deps.reserveOnBusySession(
      event,
      payload.sessionId ?? provisionalKey,
      payload.sessionId ?? undefined,
      lease,
      payload,
      normalizedAttachments
    )
    return
  }
  // lease CAS 직후의 논리 admission 시각 (위 ②).
  const leaderAdmittedAt = lease.admittedAt

  let leaderTurn: TurnContext<WebContents> | null = null
  let leaderRuntime: SessionRuntime | null = null
  let cleanupDone = false
  let initialBatches: SteerFlushBatch[] = []
  const abortPreparing = (): void => lease.controller.abort()
  event.sender.once('destroyed', abortPreparing)
  event.sender.once('render-process-gone', abortPreparing)

  try {
    // ── 4·5. continuity 검증 + provider·env·메타·텍스트 해석 (resolve-turn.ts) ─
    const resolution = await resolveTurn(ctx, supervisor, activeAdapter, payload)
    if (!resolution.ok) {
      sendChatEvent(event.sender, { type: 'error', error: resolution.error })
      return
    }
    const {
      continuitySource,
      continuityMeta,
      continuityLang,
      resolved,
      sessionMeta,
      boundProjectId,
      effectiveText
    } = resolution.value

    const preparedExecution = await prepareTurnExecution({
      worktree: {
        enabled: payload.worktreeIsolation === true,
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
        sourceCwd: payload.cwd ?? ctx.getCwd(boundProjectId),
        firstPrompt: effectiveText,
        signal: lease.controller.signal,
        adapter: activeAdapter,
        providerSettings: resolved.prepared.providerSettings,
        env: resolved.prepared.env,
        worktrees: deps.worktrees
      },
      extraDirs: payload.extraDirs,
      buildTurn: (executionCwd, extraDirs) => {
        // ── 6. TurnContext 조립 ───────────────────────────────────────────
        const controller = lease.controller
        return buildTurnContext<WebContents>({
          controller,
          owner: event.sender,
          control: lease.control,
          titleAdapter: activeAdapter,
          // 0188 D-019: 제목 생성과 chat은 같은 prepared settings/env snapshot을 써야 한다.
          titleSettings: resolved.prepared.providerSettings,
          titleEnv: resolved.prepared.env,
          resolved,
          payload: {
            sessionId: payload.sessionId,
            cwd: executionCwd,
            ...(extraDirs !== undefined ? { extraDirs: [...extraDirs] } : {}),
            attachmentViews: payload.attachmentViews as AttachmentView[],
            ...(payload.forkFrom !== undefined ? { forkFrom: payload.forkFrom } : {}),
            ...(payload.handoffFrom !== undefined ? { handoffFrom: payload.handoffFrom } : {})
          },
          effectiveText,
          boundProjectId,
          sessionMeta,
          continuityMeta,
          continuityLang,
          queueKey: provisionalKey,
          getCwd: (projectId) => ctx.getCwd(projectId)
        })
      },
      acquireRuntime: async (turn) => {
        // ── 7. 런타임 확보 ─────────────────────────────────────────────
        if (payload.sessionId) {
          supervisor.startResume(payload.sessionId, turn)
          getLogger().child('session').info('session.resume.completed', {
            sessionId: payload.sessionId,
            provider: activeAdapter.id
          })
        } else supervisor.startNew(event.sender, turn)

        // start* 로 등록한 즉시 cleanup 핸들을 공개한다. 이 다음 await가 reject해도
        // 바깥 finally가 등록된 turn을 정확히 한 번 release해야 한다.
        leaderTurn = turn
        const entry = await acquireTurnRuntime(
          {
            supervisor,
            lease,
            adapter: activeAdapter,
            buildExtensions: () =>
              ctx.extensions.build(payload.sessionId, payload.sessionId ? null : boundProjectId),
            settleDeadBackgroundTasks: deps.settleDeadBackgroundTasks,
            // turn 과 같은 축 — 인출 즉시 공개해야 이 다음 await 가 reject 해도
            // 바깥 finally 가 핸들을 닫는다.
            onRuntimeAcquired: (acquired) => {
              leaderRuntime = acquired
            }
          },
          turn,
          { sessionId: payload.sessionId, resolved, sessionProviderKey: sessionMeta?.provider_key }
        )
        return entry
      }
    })
    if (preparedExecution.kind === 'rejected') {
      sendChatEvent(event.sender, {
        type: 'error',
        error: makeClassifiedError('schema_validation_error', preparedExecution.message)
      })
      return
    }
    const { turn, entry } = preparedExecution
    const controller = lease.controller
    // 성공 경로에서도 명시해 이후 요청 조립과 cleanup의 정적 narrowing을 유지한다.
    leaderTurn = turn
    leaderRuntime = entry.runtime
    if (!entry.ok) return
    const { runtime, extensions } = entry

    // ── 8. 큐 적재 (enqueue.ts) ─────────────────────────────────────────────
    const queueKey = turn.queueKey!
    const enqueued = enqueueTurnPrompt({
      wc: event.sender,
      pendingMessages,
      queueKey,
      chainId: lease.chainId,
      channelAlive: runtime.channelAlive,
      sessionId: payload.sessionId,
      text: effectiveText,
      attachments: normalizedAttachments,
      attachmentViews: payload.attachmentViews,
      admittedAt: leaderAdmittedAt,
      clientRequestId: payload.clientRequestId
    })
    const { preludes, mainBatch } = enqueued
    initialBatches = enqueued.initialBatches

    // ── 9. 확장 배포 보장 + owner 소멸 감시 교체 ────────────────────────────
    // plugin 배포는 query 호출 전 최신성을 멱등 보장한다. 활성/비활성 토글은 파일 삭제가
    // 아니라 런타임 options.skills 필터로 반영한다.
    await ctx.ensureExtensionsDeployedForTurn()
    if (lease.controller.signal.aborted) return

    const wc = event.sender
    wc.removeListener('destroyed', abortPreparing)
    wc.removeListener('render-process-gone', abortPreparing)
    // 렌더러(owner) 소멸 시 진행 턴 정리 — idle "완전 멈춤"으로 잃는 자가치유(무응답 abort)를
    // 타이머가 아닌 이벤트로 대체한다. 여기는 abortTurn(turn) 이 아니라 runtime 을 직접 mark
    // 한다 — coordinator.run 이 turn.live=runtime 을 세우기 *전* 에 owner 가 사라질 수 있어,
    // 그 창에서도 런타임 상태(cancelled)를 확실히 남긴다.
    const onOwnerGone = (): void => {
      runtime.markAborted('user_cancelled')
      controller.abort()
      // 창이 사라지면 in-process 백그라운드 태스크도 함께 죽는다 — 추적을 남기면 그 세션에
      // 다시 send 하기 전까지 영영 회수되지 않는다(0149).
      if (turn.dbSessionId) backgroundTasks.clear(turn.dbSessionId)
    }
    wc.once('destroyed', onOwnerGone)
    wc.once('render-process-gone', onOwnerGone)

    // ── 10. 가로축 구동체 + 승인 배선 (위 ③ — 활성 턴은 게터로) ─────────────
    const coordinator = new TurnCoordinator<WebContents>({
      runtime,
      bus,
      persist: persistence,
      forward: chatForward,
      registry: supervisor,
      classifyError: (err, phase) => activeAdapter.classifyError(err, phase),
      activeTurns: supervisor.activeTurns,
      pendingMessages,
      backgroundTasks
    })
    let activeTurn: TurnContext<WebContents> = turn
    const getActiveTurn = (): TurnContext<WebContents> => activeTurn

    const requestApproval = createApprovalRequester({
      wc,
      approvals,
      permissionModes,
      persistence,
      beginApprovalPause: () => coordinator.beginApprovalPause(),
      getActiveTurn
    })

    // 세션 모드 SSOT 동기화 — resume 경로(sessionId 확정)에서 이번 턴 모드를 controller 에 기록.
    // 라이브 전환(setMode IPC)과 다음 턴이 같은 출처를 읽도록 한다.
    if (payload.sessionId && payload.permissionMode) {
      void permissionModes.setMode(payload.sessionId, payload.permissionMode)
    }

    // ── 11. TurnRequest 조립 ────────────────────────────────────────────────
    const request: TurnRequest = buildTurnRequest(
      {
        wc,
        pendingMessages,
        activity,
        chainId: lease.chainId,
        queueKey,
        getActiveTurn,
        getInitialBatches: () => initialBatches,
        settleDeadBackgroundTasks: deps.settleDeadBackgroundTasks
      },
      {
        sessionId: payload.sessionId,
        // 0064 continuity — 어댑터가 resume+forkSession 으로 어댑트해 새 session id 를 발급받는다.
        ...(continuitySource ? { forkFrom: continuitySource } : {}),
        // 0127 — 핸드오프 도착 턴 표식: 매퍼가 압축 경계 전의 승계 컨텍스트 usage 를 무효화한다.
        ...(payload.handoffFrom ? { handoff: true } : {}),
        // 본 프롬프트 = 큐에서 방금 flush 한 아이템 배치(0067 AC5). promptUuid=item id 가 echo
        // 상관키가 돼 커밋이 echo 관측 단일 경로로 흐른다(AC6).
        text: mainBatch.text,
        promptUuid: mainBatch.uuid,
        ...(preludes.length > 0 ? { preludes } : {}),
        cwd: turn.cwd,
        ...(turn.extraDirs.length > 0 ? { extraDirs: turn.extraDirs } : {}),
        signal: controller.signal,
        extensions,
        ...(resolved.prepared.env ? { env: { ...resolved.prepared.env } } : {}),
        // 조립부가 계산한 값을 spawn 기록부로 나른다(0190) — `env` 는 얕은 복사지만
        // fingerprint 는 키를 정렬해 접으므로 두 값이 항상 일치한다.
        envFingerprint: resolved.prepared.envFingerprint,
        ...ifPresent('providerSettings', resolved.prepared.providerSettings),
        ...(resolved.model !== undefined ? { model: resolved.model } : {}),
        requestApproval,
        ...(payload.permissionMode ? { permissionMode: payload.permissionMode } : {}),
        ...(payload.effort ? { effort: payload.effort } : {}),
        attachmentTexts: normalizedAttachments.attachmentTexts,
        attachmentImages: normalizedAttachments.attachmentImages
      }
    )

    // ── 12. 실행 + 자동 연속 턴 루프 ────────────────────────────────────────
    try {
      await runTurnWithContinuations(
        {
          coordinator,
          runtime,
          lease,
          supervisor,
          activity,
          pendingMessages,
          backgroundTasks,
          listenRelease: deps.listenRelease,
          prepareContinuation: (sessionId) =>
            prepareAutomaticContinuation({
              runtime,
              providerKey: getActiveTurn().providerKey,
              modelFamily: payload.modelFamily ?? null,
              fallbackModel: request.model,
              resolveProvider: ({ providerKey, modelFamily }) =>
                resolveTurnProvider(ctx, {
                  adapter: activeAdapter,
                  sessionId,
                  providerKey,
                  modelFamily
                }),
              buildExtensions: () => ctx.extensions.build(sessionId, null)
            }),
          settleDeadBackgroundTasks: deps.settleDeadBackgroundTasks,
          stopAndSettleAbortedTasks: deps.stopAndSettleAbortedTasks,
          getActiveTurn,
          setActiveTurn: (next) => {
            activeTurn = next
          },
          setInitialBatches: (next) => {
            initialBatches = next
          }
        },
        turn,
        request,
        boundProjectId
      )
    } finally {
      wc.removeListener('destroyed', onOwnerGone)
      wc.removeListener('render-process-gone', onOwnerGone)
      const finalSessionId = activeTurn.dbSessionId ?? turn.dbSessionId
      // 제출 수용 전 예외가 재시도 한도를 소진한 경우에만 submitting 예약을 held 로 복구한다.
      // 이미 submitted/confirmed/orphaned 인 배치는 rollback fence 가 거부하므로 이중 전달되지 않는다.
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
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      error: activeAdapter.classifyError(err, 'prepareTurn')
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
      if (restored.length > 0 && payload.sessionId) {
        sendChatEvent(event.sender, {
          type: 'message.cancelled',
          sessionId: payload.sessionId,
          ids: restored.map((item) => item.id)
        })
      }
      if (leaderTurn) supervisor.release(leaderTurn)
      if (leaderRuntime) leaderRuntime.close()
      supervisor.releaseChain(lease.leaseId)
    }
  }
}

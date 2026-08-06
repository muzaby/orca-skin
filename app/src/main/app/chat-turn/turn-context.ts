// TurnContext 조립 — **순수 함수만** 산다 (0179).
//
// 턴 상태를 만드는 규칙(무엇이 턴마다 초기화되고, 무엇이 체인을 따라 계승되며, continuity 가
// 무엇을 덧붙이는가)은 부작용이 없다. 분해 전에는 892줄 클로저 한가운데 리터럴로 있어서
// "fork 턴은 initialTitle 을 갖는가" 같은 질문에 코드로 답할 수 없었다.

import type { AttachmentView } from '../../../shared/ipc'
import { continuityTitle, type ContinuityLang } from '../../../shared/continuity-lang'
import type { TurnContext } from '../../contracts/turn'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { ResolvedProviderSettings } from '../../adapters/provider-config'
import type { SessionControl } from '../../features/sessions/session-chain-lease'

// 턴-로컬 상태의 단일 초기값 — 신규 턴과 자동 연속 턴이 공유한다. TurnContext 에 턴-로컬
// 필드를 더하면 여기에만 더한다(턴 간 계승/차이가 있는 것은 각 호출부가 명시).
function freshTurnLocalState<W>(
  control?: SessionControl
): Pick<
  TurnContext<W>,
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

// 세션 cwd 해석. resume 은 세션행에 박힌 값을, 새 채팅은 요청값 → 프로젝트 파생 순.
export function resolveTurnCwd(
  req: { sessionId: string | null; projectId: string | null; cwd?: string | null | undefined },
  sessionMeta: { cwd: string | null; project_id: string | null } | undefined,
  getCwd: (projectId: string | null) => string
): string {
  if (req.sessionId) return sessionMeta?.cwd ?? getCwd(sessionMeta?.project_id ?? null)
  return req.cwd ?? getCwd(req.projectId)
}

export interface ContinuitySourceMeta {
  title: string | null
  cwd: string | null
  project_id: string | null
}

interface BuildTurnContextInput<W> {
  controller: AbortController
  owner: W
  control: SessionControl
  titleAdapter: RuntimeTitleAdapter
  titleEnv: Record<string, string> | undefined
  resolved: {
    providerKey: string | null
    providerSettings?: ResolvedProviderSettings | undefined
    titleModel?: string | undefined
  }
  payload: {
    sessionId: string | null
    cwd?: string | null | undefined
    attachmentViews: AttachmentView[]
    forkFrom?: string | undefined
    handoffFrom?: string | undefined
  }
  /** handoff 는 main 이 자동 메시지로 대체한 텍스트가 들어온다. */
  effectiveText: string
  boundProjectId: string | null
  sessionMeta: { cwd: string | null; project_id: string | null } | undefined
  continuityMeta: ContinuitySourceMeta | undefined
  continuityLang: ContinuityLang
  queueKey: string
  getCwd: (projectId: string | null) => string
}

// 신규 턴의 TurnContext.
//
// continuity(fork/handoff)가 더하는 것은 넷이다 — ① 출발 세션 cwd **계승**(SDK 세션 파일이
// cwd 인코딩 경로에 저장돼 resume/forkSession 탐색이 cwd 에 묶인다) ② `lineage`(persist 가
// 영속 + fork display 복사) ③ `initialTitle` 마커 ④ `titleGenerationStarted:true`(마커를
// 자동 제목이 덮지 않게). 넷은 항상 함께 간다.
export function buildTurnContext<W>(input: BuildTurnContextInput<W>): TurnContext<W> {
  const { payload, continuityMeta, resolved } = input
  const continuitySource = payload.forkFrom ?? payload.handoffFrom
  const relation = payload.handoffFrom ? ('handoff' as const) : ('fork' as const)

  return {
    ...freshTurnLocalState<W>(input.control),
    controller: input.controller,
    owner: input.owner,
    titleAdapter: input.titleAdapter,
    ...(resolved.providerSettings ? { titleSettings: resolved.providerSettings } : {}),
    ...(input.titleEnv ? { titleEnv: input.titleEnv } : {}),
    ...(resolved.titleModel ? { titleModel: resolved.titleModel } : {}),
    providerKey: resolved.providerKey,
    pendingUserText: input.effectiveText,
    firstUserText: input.effectiveText,
    pendingAttachmentViews: payload.attachmentViews,
    dbSessionId: payload.sessionId,
    pendingProjectId: payload.sessionId ? null : input.boundProjectId,
    isNewSession: payload.sessionId == null,
    cwd: continuityMeta
      ? (continuityMeta.cwd ?? input.getCwd(continuityMeta.project_id))
      : resolveTurnCwd(
          {
            sessionId: payload.sessionId,
            projectId: input.boundProjectId,
            cwd: payload.cwd ?? null
          },
          input.sessionMeta,
          input.getCwd
        ),
    titleGenerationStarted: continuitySource != null,
    blockedSubagents: input.control.blockedSubagents,
    ...(continuitySource
      ? {
          lineage: { parentSessionId: continuitySource, relation },
          initialTitle: continuityTitle(
            relation,
            input.continuityLang,
            continuityMeta?.title?.trim() || continuitySource.slice(0, 8)
          )
        }
      : {}),
    // 0067 AC9 — 세션 id 확정 전 큐 키. coordinator 가 session.updated 에서 실 id 로 rekey.
    queueKey: input.queueKey
  }
}

// 자동 연속 턴의 TurnContext — 직전 턴의 세션/메타를 계승하고 턴-로컬 상태만 초기화한다.
export function makeContinuationTurn<W>(prev: TurnContext<W>): TurnContext<W> {
  return {
    ...freshTurnLocalState<W>({
      taskIds: prev.subagentTaskIds,
      subagentTypes: prev.subagentTypes,
      stoppedSubagents: prev.stoppedSubagents,
      blockedSubagents: prev.blockedSubagents,
      cancelled: prev.controller.signal.aborted
    }),
    controller: new AbortController(),
    owner: prev.owner,
    titleAdapter: prev.titleAdapter,
    ...(prev.titleSettings ? { titleSettings: prev.titleSettings } : {}),
    ...(prev.titleEnv ? { titleEnv: prev.titleEnv } : {}),
    ...(prev.titleModel ? { titleModel: prev.titleModel } : {}),
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
  }
}

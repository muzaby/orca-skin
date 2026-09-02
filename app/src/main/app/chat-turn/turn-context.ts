// TurnContext 조립 — **순수 함수만** 산다 (0179).
//
// 턴 상태를 만드는 규칙(무엇이 턴마다 초기화되고, 무엇이 체인을 따라 계승되며, continuity 가
// 무엇을 덧붙이는가)은 부작용이 없다. 분해 전에는 892줄 클로저 한가운데 리터럴로 있어서
// "fork 턴은 initialTitle 을 갖는가" 같은 질문에 코드로 답할 수 없었다.

import type { AttachmentView } from '../../../shared/ipc'
import { continuityTitle, type ContinuityLang } from '../../../shared/continuity-lang'
import type { TurnContext } from '../../contracts/turn'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'
import type { SessionControl } from '../../features/sessions/session-chain-lease'
import { isAbsolutePath, isFilesystemRoot } from '../../../shared/absolute-path'

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
//
// **루트는 없는 것으로 친다** (D-019·D-021). cwd 는 `writeRoots[0]` 이라 루트면 0075 가드가
// 무력화되는데, `extraDirs` 처럼 버릴 수는 없다 — 턴이 설 자리가 없어진다. 그래서 **이미 있는
// 폴백**(cwd 미지정 시의 `getCwd(projectId)`)으로 접는다: 새 동작을 만들지 않고, 스키마가
// 생기기 전에 쓰인 세션행을 되살려도 턴은 정상 진행된다.
function usableCwd(value: string | null | undefined): string | null {
  if (value == null || value.length === 0) return null
  return isFilesystemRoot(value) ? null : value
}

export function resolveTurnCwd(
  req: { sessionId: string | null; projectId: string | null; cwd?: string | null | undefined },
  sessionMeta: { cwd: string | null; project_id: string | null } | undefined,
  getCwd: (projectId: string | null) => string
): string {
  if (req.sessionId) {
    return usableCwd(sessionMeta?.cwd) ?? getCwd(sessionMeta?.project_id ?? null)
  }
  return usableCwd(req.cwd) ?? getCwd(req.projectId)
}

// 세션행의 extra_dirs(JSON 배열 문자열) → 경로 배열. 손상된 값은 '없음' 으로 접는다 —
// 참조 경로 하나가 깨졌다고 턴을 실패시킬 이유가 없다(스코프가 좁아질 뿐 안전한 방향이다).
//
// **상대 경로는 여기서도 버린다.** IPC 스키마(`ExtraDirSchema`)가 입구를 막지만 이 함수는
// 입구가 아니라 **DB 행을 읽는 자리**라, 그 검증이 없던 시절에 쓰인 행이 그대로 들어온다.
// 그 값은 resume/continuity 턴에서 SDK 옵션 `additionalDirectories` 까지 흘러가는데, workspace
// 가드는 걸러도 SDK 자신의 스코프는 걸러지지 않아 D-006 이 막으려는 "두 스코프가 갈라짐" 이
// 정확히 일어난다. 같은 규칙을 같은 SSOT(`isAbsolutePath`)로 세 번째 지점에 세운다.
export function parseExtraDirs(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is string => typeof v === 'string' && isAbsolutePath(v) && !isFilesystemRoot(v)
    )
  } catch {
    return []
  }
}

// 추가 참조 경로 해석 — cwd 와 같은 규칙이다. resume 은 세션행에 박힌 값을, 새 채팅은 요청값을.
export function resolveTurnExtraDirs(
  req: { sessionId: string | null; extraDirs?: string[] | undefined },
  sessionMeta: { extra_dirs?: string | null } | undefined
): string[] {
  if (req.sessionId) return parseExtraDirs(sessionMeta?.extra_dirs)
  return req.extraDirs ?? []
}

export interface ContinuitySourceMeta {
  title: string | null
  cwd: string | null
  project_id: string | null
  extra_dirs?: string | null
}

interface BuildTurnContextInput<W> {
  controller: AbortController
  owner: W
  control: SessionControl
  titleAdapter: RuntimeTitleAdapter
  // ── 제목 생성이 받는 spawn 입력은 **두 채널 다** 다 (0188 D-019 · r10 정정) ─────────
  //
  // 0188 이 `ResolvedTurnProvider` 를 `{providerKey, prepared, …}` 로 바꾸면서 이 인터페이스에
  // 남아 있던 `resolved.providerSettings?` 가 **어디서도 채워지지 않는 죽은 필드**가 됐다 —
  // optional + 구조적 타이핑이라 typecheck 가 잡지 못했고, `titleSettings` 는 조용히 항상
  // `undefined` 였다(0188 이전에는 채워졌다). 그래서 제목 생성이 `options.settings` 없이 돌았고,
  // app env 도 settings env 도 없는 정적 배포에서는 **settings·env 둘 다** 없이 돌았다.
  //
  // 그 필드를 지우고 `titleEnv` 와 **같은 층위의 명시 입력**으로 올린다. 둘은 한 `prepared`
  // 객체에서 나와야 하며(chat 과 같은 스냅샷), 한쪽만 넘기면 여기서 형상이 어긋난다.
  titleSettings: ResolvedHarnessSettings | undefined
  titleEnv: Record<string, string> | undefined
  resolved: {
    providerKey: string | null
    titleModel?: string | undefined
  }
  payload: {
    sessionId: string | null
    cwd?: string | null | undefined
    extraDirs?: string[] | undefined
    attachmentViews: AttachmentView[]
    forkFrom?: string | undefined
    handoffFrom?: string | undefined
  }
  /** handoff 는 main 이 자동 메시지로 대체한 텍스트가 들어온다. */
  effectiveText: string
  boundProjectId: string | null
  sessionBaseline: string | null
  sessionBaselineRef: string | null
  sessionMeta:
    { cwd: string | null; project_id: string | null; extra_dirs?: string | null } | undefined
  continuityMeta: ContinuitySourceMeta | undefined
  continuityLang: ContinuityLang
  queueKey: string
  // 0211 — 세션 id 확정 훅. 컴포지션 루트만 채운다(격리 세션의 표시 정본 통지).
  onSessionConfirmed?: (sessionId: string) => void
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
    ...(input.titleSettings ? { titleSettings: input.titleSettings } : {}),
    ...(input.titleEnv ? { titleEnv: input.titleEnv } : {}),
    ...(resolved.titleModel ? { titleModel: resolved.titleModel } : {}),
    providerKey: resolved.providerKey,
    pendingUserText: input.effectiveText,
    firstUserText: input.effectiveText,
    pendingAttachmentViews: payload.attachmentViews,
    dbSessionId: payload.sessionId,
    pendingProjectId: payload.sessionId ? null : input.boundProjectId,
    isNewSession: payload.sessionId == null,
    sessionBaseline: input.sessionBaseline,
    sessionBaselineRef: input.sessionBaselineRef,
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
    // cwd 와 짝이다 — continuity 는 출발 세션의 참조 경로까지 계승해야 도착 세션에서 같은
    // 파일들을 계속 읽을 수 있다.
    extraDirs: continuityMeta
      ? parseExtraDirs(continuityMeta.extra_dirs)
      : resolveTurnExtraDirs(
          { sessionId: payload.sessionId, extraDirs: payload.extraDirs },
          input.sessionMeta
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
    queueKey: input.queueKey,
    ...(input.onSessionConfirmed ? { onSessionConfirmed: input.onSessionConfirmed } : {})
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
    sessionBaseline: null,
    sessionBaselineRef: null,
    cwd: prev.cwd,
    extraDirs: prev.extraDirs,
    titleGenerationStarted: prev.titleGenerationStarted,
    blockedSubagents: prev.blockedSubagents
  }
}

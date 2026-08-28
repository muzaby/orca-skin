import type {
  AppMessagePart,
  AskQuestionRequest,
  AttachmentView,
  NormalizedEvent,
  ClassifiedError,
  LoadedSession,
  PlanReviewRequest,
  ProviderReportedTelemetry,
  SubagentTaskMeta,
  Backend,
  EffortLevel
} from '../../../../../shared/ipc'
import { subagentNoticePart } from '../../../../../shared/ipc'
import { isFilesystemRoot } from '../../../../../shared/absolute-path'
import { DEFAULT_PERMISSION_MODE } from '../../../../../shared/permission-mode'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'
import type { ContinuityLang } from '../../../../../shared/continuity-lang'
import { readTaskToolObservation } from '../../../../../shared/task-tool'
import type { MessageKey } from '../../../shared/i18n'
import { contextTokens } from '../lib/telemetry'
import { agentTaskKey, backgroundTaskKey } from '../lib/taskBoard'
import { settleOrphanToolParts, settleStaleAsyncLaunchParts } from '../lib/parts'
import { isRightPanelTileSuspended, type RightPanelTileId } from '../lib/rightPanelTiles'
import type { BranchSnapshot } from '../components/composer/branchChipState'
import {
  addTileColumnMajor,
  columnsContain,
  removeTileFromColumns,
  type RightPanelColumns
} from '../lib/rightPanelLayout'

// transcript 렌더가 쓰는 도구 호출 view — parts 의 tool_call+tool_result 를 toolRunId 로
// 페어링한 결과(lib/parts.ts partsToolCalls). 더 이상 Message 의 필드가 아니다.
export interface ToolCall {
  toolUseId: string
  name: string
  input: unknown
  result?: {
    output: unknown
    isError: boolean
    durationMs?: number
    parentToolRunId?: string
    // 부모 Task tool_result 면 서브에이전트 영속 메타(모델·시간·도구수) — 재로드 후 카드/행 복원.
    subagentMeta?: SubagentTaskMeta
    // TaskXXX 도구의 SDK 구조화 출력(0204) — 작업 타일 목록 파생의 유일한 권위 입력.
    // `output` 은 모델용 wire content 라 task.id 같은 필드를 담지 않는다.
    structuredOutput?: unknown
  }
  parentToolRunId?: string
}

// 계획 패널 인라인 코멘트 1건(휘발성 — 세션 상태). quote=선택 본문 스냅샷, start/end=계획
// 본문 textContent 기준 오프셋(하이라이트 매핑·문서 순서), body=사용자 의견. 전송 시 IPC
// PlanFeedbackComment 로 변환(lib/planComments.ts toPlanFeedback).
export interface PlanComment {
  id: string
  quote: string
  start: number
  end: number
  body: string
  createdAt: number
}

// 메시지 = 순서 보존 parts 목록(provider-runtime.md §7). text 는 lib/parts.ts 셀렉터로 합치고,
// tool_call/tool_result 는 toolRunId 로 페어링해 렌더한다.
export interface Message {
  role: 'user' | 'assistant'
  createdAt: number
  parts: AppMessagePart[]
  incomplete?: boolean
  // 턴-시작 사용자 메시지의 낙관 커밋 ↔ main 이벤트(queued/committed) 합류 키(0068) —
  // 값 = clientRequestId(= 큐 아이템 id = echo 배치 ids[0]). 라이브 뷰 전용, DB 미영속.
  clientId?: string
}

export interface ChatState {
  sessionId: string | null
  // 사이드바 메타 (또는 LoadedSession.title) 에서 즉시 채워지는 세션 제목. 사용자가
  // 세션을 클릭한 순간부터 헤더에 표시되며, 메시지 도착 시점에 한 번 더 reconcile.
  title: string | null
  // 새 채팅 첫 메시지의 소속 프로젝트. ProjectDetail 진입 시 NEW_CHAT 액션에서 세팅되고,
  // 첫 메시지 send → init 이벤트 시점에 sessionId 가 발급되면 사실상 역할 종료. send 시
  // 함께 IPC 페이로드에 실어 main 으로 보낸다.
  pendingProjectId: string | null
  projectId: string | null
  backend: Backend | null
  providerKey: string | null
  modelFamily: string | null
  // 0119: 진행 중 턴이 실제로 쓰는 provider 스냅샷 — BEGIN_TURN 에서 providerKey 를 고정,
  // 턴 종료(telemetry/turn.aborted/error/CANCEL_CHAT)에 초기화. SET_MODEL 이 providerKey 를
  // inflight 중에도 덮어쓰므로, steer 게이트(경계 판정)는 이 스냅샷과 선택값을 비교한다.
  turnProviderKey: string | null
  effort: EffortLevel
  // 어댑터가 발급한 세션의 working directory (`init` 이벤트). Composer 의 `@`
  // 파일 자동완성이 이 경로 기준으로 디렉토리를 리스팅한다.
  cwd: string | null
  // 컴포저 참조 경로 칩이 모으는 cwd 밖 추가 경로(CLI `/add-dir` 대응).
  // **세션 출생 전(랜딩)에만 의미가 있다** — 첫 전송에 실려 세션행에 고정된 뒤로는
  // main/DB 가 정본이고 renderer 는 이 값을 다시 읽지 않는다.
  extraDirs: string[]
  worktreeIsolation: boolean
  // 마지막 참조 경로 추가가 **거부된 이유**. null = 거부 없음. 중복·cwd 자기 자신은 조용히
  // 무시하지만(사용자가 이미 가진 것을 다시 고른 것뿐) 루트는 사유를 남긴다 — 고른 폴더가
  // 칩으로 안 붙는데 아무 말도 없으면 사용자는 앱이 먹은 것으로 읽는다 (D-020).
  // 마지막 **경로 선택**이 거부된 이유. 참조 경로(＋)와 작업 경로(cwd 버튼)가 같은 사유를
  // 공유한다 — 규칙이 하나(D-019)이므로 사용자에게 보이는 문장도 하나다.
  extraDirRejection: 'root' | null
  // 커밋된 transcript 메시지(SSOT 는 DB, 이 배열은 그 미러). 스트리밍 라이브 텍스트/사고는
  // 여기 없다 — chatStore 의 live 슬라이스(transient)가 담당하고, 완성 시 parts 로 커밋된다.
  messages: Message[]
  // 0143 listen phase — 메인 턴 종료 후 main 이 백그라운드 서브에이전트를 기다리는 대기 구간
  // (chat.activity 권위 스냅샷). inflight 와 독립: TURN_END_RESET(telemetry 등)은
  // 건드리지 않는다 — listen 중 개별 알림 턴이 끝나도 애니메이션이 유지된다. send 라우팅
  // busy(steer 예약)와 StatusLine 표시가 inflight ‖ listening 으로 판정한다.
  listening: boolean
  activityRevision: number
  activityForeground: 'idle' | 'preparing' | 'streaming'
  activityQueuedCount: number
  activityDeliveryPendingCount: number
  activityResidualCount: number
  activityBackgroundTaskCount: number
  // listening 구간의 경과시간 앵커 — turnStartedAt 이 TURN_END_RESET 으로 비어도 StatusLine
  // 이 이 값을 폴백으로 쓴다.
  listenStartedAt: number | null
  // 이 세션 뷰에서 사용자가 라이브로 전송한 횟수(단조 증가, 세션 전환/새 채팅 시 0 리셋).
  // useScrollAnchor 가 "새 user 메시지 앵커" 트리거로 쓴다 — 메시지 배열 휴리스틱(로드된
  // 세션의 마지막 user 메시지 등 오탐) 없이 SEND 만 정확히 감지하기 위한 카운터.
  sendCount: number
  inflight: boolean
  // 사이드바 세션 클릭 또는 부팅 시 lastSessionId 자동 복원으로 메시지를 비동기 로드하는
  // 동안 true. ChatPane 이 인디케이터를 표시한다.
  loadingSession: boolean
  turnStartedAt: number | null
  // 마지막 턴의 provider-reported 통계(model·토큰·캐시 분해). 컨텍스트 도넛 + UsagePanel(입력·
  // 캐시·윈도우·사용%)의 소스. 턴 종료(telemetry) 시 세팅, 세션 로드 시 turn_usage 최신 행에서
  // 복원, 새 대화에서만 비움. SEND 는 비우지 않아 턴 진행 중에도 도넛이 유지된다.
  // 비용/지연은 패널에서 빠졌고 비용은 turn_usage 원장(집계)이 SSOT 라 state 에 두지 않는다.
  lastTelemetry?: ProviderReportedTelemetry
  // 그 telemetry 가 도착한 시점의 provider (0186). **`providerKey` 와 다르다** — 사용자가 모델을
  // 바꾸면 `providerKey` 는 즉시 바뀌지만 화면의 주/월 사용량은 마지막으로 측정된 provider 의
  // 것이어야 한다("Composer 가 보여주는 기준은 항상 텔레메트리가 업데이트되는 시점"). 현재 선택
  // provider 로 그리면 새 턴을 돌리기도 전에 숫자가 바뀐다.
  lastTelemetryProviderKey?: string | null
  // 이 세션에서만 발생한 비용 총합(USD, 추정치 — 0122 r2). 세션 로드 시 turn_usage 세션
  // SUM(LoadedSession.costUsd)으로 시드, 라이브 턴 종료(telemetry.costUsd)마다 누산.
  // fork/handoff 파생 draft 는 새 세션이라 승계하지 않는다(continuityDraftSession 미복사).
  // 압축(session.compacted)은 컨텍스트만 무효화 — 지출 누계인 비용은 유지.
  sessionCostUsd?: number
  error?: ClassifiedError
  retry?: { attempt: number; max: number; category: string }
  // Claude 가 AskUserQuestion 으로 던진 미응답 질문 묶음 큐. canUseTool 이 query 를 일시
  // 중지한 채 응답을 기다리므로 보통 길이 0~1 이지만, 안전하게 큐로 모델링해 앞에서 소비한다.
  pendingAsks: AskQuestionRequest[]
  // Composer 모드 버튼이 정하는 이 대화의 권한 모드. send 시 IPC 페이로드로 실린다.
  // 새 대화마다 기본값 'plan' 으로 리셋(initialChatState).
  permissionMode: NormalizedPermissionMode
  // plan 모드에서 에이전트가 제출한 계획(ExitPlanMode). canUseTool 직렬화로 동시 1개.
  // 승인/수정/거부 시 null. (백엔드 중립 — SDK 를 모름.) 우측 계획 타일의 액션바
  // (승인/수정/거부) 노출 여부 + requestId 의 소스.
  pendingPlanReview: PlanReviewRequest | null
  // 우측 패널 안의 활성 타일. 열 구조(열당 최대 ROWS_PER_COL)를 직접 들고 있어 제거 시
  // 다른 열로 리플로우되지 않는다(rightPanelLayout 참고). 추가는 column-major 로 채운다.
  rightPanelTiles: RightPanelColumns
  // 우측 패널 타일별 사용자 라벨 오버라이드. 값이 없으면 tile registry 의 기본 라벨을 쓴다.
  rightPanelTileLabels: Partial<Record<RightPanelTileId, string>>
  // 우측 패널 열별 폭(px). 분리선 드래그로 조절, clamp 280–640.
  rightPanelColWidths: number[]
  // 우측 패널 열 내부의 상단 행 비율. 행 분리선 드래그로 조절, clamp 0.2–0.8.
  rightPanelRowSplits: number[]
  // diff 타일의 좌측 컬럼(파일트리 + 커밋 목록) 표시 여부. 헤더 토글이 뒤집는다.
  // **본문이 아니라 세션 상태가 갖는 이유**: 토글 버튼은 타일 헤더에, 감춰지는 컬럼은 본문에
  // 있고 둘은 형제라 로컬 state 로 공유되지 않는다(0206 D-017 주변).
  diffFilesVisible: boolean
  // 작업 경로의 git 스냅샷 — **어느 cwd 의 값인지와 함께** 들고 있다(`statusForCwd`).
  // 컴포저 git 행과 diff 타일 헤더 둘이 읽으므로 세션 상태가 소유한다(0206 D-020).
  // null = 아직 조회 전. `useGitRowStatus` 만 채운다.
  gitStatus: BranchSnapshot | null
  // 우측 작업 타일에서 상세로 표시할 항목 키(`agent:<id>` | `bg:<toolUseId>`, taskBoard 가
  // 소유하는 네임스페이스). null 이면 목록 view.
  selectedTaskKey: string | null
  // 우측 **백그라운드 작업** 타일에서 상세(child transcript)로 표시할 부모 Task toolRunId.
  // null 이면 목록 view. `selectedTaskKey` 와 **독립**이다(0204 §10 EP-12) — 두 타일이 서로
  // 다른 항목을 열어 둘 수 있고, 한 타일을 닫아도 다른 타일의 상세가 접히지 않는다.
  selectedSubagentTaskId: string | null
  // 중단 요청을 보내고 SDK 확정을 기다리는 background tool_use id 집합(0204 D-005). 확정되면
  // 파생 상태가 스스로 진행 중을 벗어나므로 그때 비운다.
  stoppingTaskIds: string[]
  // 중단 요청이 실패한 항목의 사유(항목 키 → 실패 서술). 다음 요청/확정 시 지운다 —
  // 실패가 "아무 일도 안 일어남" 으로 보이지 않게 하는 유일한 소비자다(0204 AC14).
  taskStopErrors: Record<string, TaskStopError>
  // 사용자가 아직 작업 타일에서 확인하지 않은 종단 상태 항목 키. 타일을 열면 비운다(D-004).
  unseenSettledTaskKeys: string[]
  // 우측 계획 타일에 표시할 마지막 계획 마크다운. 승인/거부 후에도 유지해 읽기전용으로
  // 계속 보여준다(= pendingPlanReview 와 수명 분리). 세션 전환/새 대화 시 비움.
  planContent: string | null
  // 계획 검토 중(pendingPlanReview) 사용자가 본문에 남긴 인라인 코멘트(휘발성). 계획 해소
  // (RESOLVE_PLAN)·새 대화·세션 전환 시 비운다. revise 전송 시 구조화 태그로 직렬화된다.
  planComments: PlanComment[]
  // 패널↔composer 조정용 — 편집 대상 코멘트(패널이 해당 코멘트 팝오버를 열고 스크롤).
  // selectedTaskKey 와 동형의 UI 선택 상태.
  activePlanCommentId: string | null
  // 위험 도구(Bash/Write/Edit 등) 실행 승인 게이트 큐. permission.requested(tool_approval)
  // 도착마다 append, 응답(허용/세션허용/거부) 시 해당 approvalId 만 제거. 서브에이전트·병렬
  // tool_use 는 canUseTool 을 동시 호출해 여러 승인이 겹칠 수 있으므로 큐로 모델링한다(단일
  // 슬롯이면 직전 카드가 덮어써져 사라지고 해당 broker 보류가 영구 inflight 로 고착).
  pendingToolApprovals: { approvalId: string; toolName: string; input: unknown }[]
  // 0064 continuity — 이 뷰가 fork/handoff 로 파생된 세션(또는 미전송 draft)임을 표시.
  // draft 단계(sessionId=null)에선 send 페이로드(forkFrom/handoffFrom) 소스이자 라우트 싱크
  // 가드(원본 세션 재로드 방지) 마커. 발급 후에도 유지되다가 새 대화/세션 로드 시 리셋.
  // 재로드 세션은 LOAD_SESSION 이 LoadedSession.lineage 로 복원한다(출처 배너, r2).
  forkFrom: string | null
  handoffFrom: string | null
  // 출처 배너 표시용 부모 세션 제목 스냅샷(없으면 id 표시로 폴백).
  lineageParentTitle: string | null
  // 0127 — continuity 산출물 언어의 draft 생성 시점 스냅샷(settings.language 파생 ko/en).
  // send payload(continuityLang) 소스 — draft 제목과 main initialTitle 의 일치를 보장한다.
  // 재로드 세션은 불요(sessionId 확정 후 continuity send 없음) — LOAD_SESSION 미복원.
  continuityLang: ContinuityLang | null
}

export const initialChatState: ChatState = {
  sessionId: null,
  title: null,
  pendingProjectId: null,
  projectId: null,
  backend: null,
  providerKey: null,
  modelFamily: null,
  turnProviderKey: null,
  effort: 'high',
  cwd: null,
  extraDirs: [],
  worktreeIsolation: false,
  extraDirRejection: null,
  messages: [],
  sendCount: 0,
  inflight: false,
  listening: false,
  activityRevision: 0,
  activityForeground: 'idle',
  activityQueuedCount: 0,
  activityDeliveryPendingCount: 0,
  activityResidualCount: 0,
  activityBackgroundTaskCount: 0,
  listenStartedAt: null,
  loadingSession: false,
  turnStartedAt: null,
  pendingAsks: [],
  permissionMode: DEFAULT_PERMISSION_MODE,
  pendingPlanReview: null,
  rightPanelTiles: [],
  rightPanelTileLabels: {},
  rightPanelColWidths: [],
  rightPanelRowSplits: [],
  diffFilesVisible: true,
  gitStatus: null,
  selectedTaskKey: null,
  selectedSubagentTaskId: null,
  stoppingTaskIds: [],
  taskStopErrors: {},
  unseenSettledTaskKeys: [],
  planContent: null,
  planComments: [],
  activePlanCommentId: null,
  pendingToolApprovals: [],
  forkFrom: null,
  handoffFrom: null,
  lineageParentTitle: null,
  continuityLang: null
}

// 우측 패널 열 폭/행 분할 clamp 범위.
export const PANEL_MIN_WIDTH = 280
export const PANEL_MAX_WIDTH = 640
export const PANEL_DEFAULT_WIDTH = 360
export const PANEL_MIN_ROW_SPLIT = 0.2
export const PANEL_MAX_ROW_SPLIT = 0.8
export const PANEL_DEFAULT_ROW_SPLIT = 0.5

// 턴 종료 공통 리셋 — inflight 와 턴 스냅샷(turnProviderKey 0119 · turnStartedAt)·재시도 배너를
// 한 곳에서 내린다. 종료 경로(telemetry/turn.aborted/error/CANCEL_CHAT)가 늘거나 per-turn 필드가
// 추가되면 여기만 갱신한다 — 경로별 개별 나열은 스냅샷 초기화 누락(스티어 영구 차단)을 부른다.
const TURN_END_RESET: Pick<ChatState, 'inflight' | 'turnProviderKey' | 'turnStartedAt' | 'retry'> =
  {
    inflight: false,
    turnProviderKey: null,
    turnStartedAt: null,
    retry: undefined
  }

// 중단 요청 실패의 표시 재료. **번역하지 않은 채** 싣는다 — 카탈로그 키는 렌더에서 tr() 로
// 풀어야 언어 전환이 표시 중인 문구까지 따라온다(0096/0097 stale-방지, `UiMessage` 와 같은 이유).
// `detail` 은 main 이 준 원문이라 번역 대상이 아니다.
export interface TaskStopError {
  messageKey: MessageKey
  detail?: string
}

export type ChatAction =
  // 턴 시작 전이 — user 버블은 붙이지 않는다(버블은 낙관 커밋 또는 echo 커밋이 별도로).
  // 자동 연속 턴(send 없는 턴)도 store 가 활동 이벤트에서 같은 액션으로 전이시킨다.
  | { type: 'BEGIN_TURN' }
  // 사용자 메시지 커밋 버블. 턴-시작 send 는 낙관 커밋(clientId=clientRequestId, 0068)으로
  // 즉시 붙고, steer 예약·핸드오프 자동 메시지는 echo 커밋(message.committed)으로 붙는다 —
  // clientId 멱등 가드가 두 경로의 이중 append 를 차단한다.
  | {
      type: 'APPEND_COMMITTED_USER_MESSAGE'
      text: string
      createdAt?: number
      attachmentViews?: AttachmentView[]
      clientId?: string
    }
  // 낙관 커밋 롤백(0068) — send invoke 자체가 거부됐을 때만(큐 미적재 = echo 도 안 옴).
  | { type: 'DROP_UNCOMMITTED_USER'; clientId: string }
  | {
      type: 'SET_MODEL'
      providerKey: string | null
      modelFamily: string | null
      adapter?: string | null
    }
  | { type: 'SET_EFFORT'; effort: EffortLevel }
  | { type: 'RECV_EVENT'; event: NormalizedEvent }
  // 턴이 message.completed 없이 끝났을 때(telemetry 도착 시점) live 버퍼의 잔여 텍스트를
  // text 파트로 굳힌다. 버퍼 소유자는 chatStore — reducer 는 텍스트만 받는다.
  | { type: 'COMMIT_PENDING_TEXT'; text: string }
  | { type: 'NEW_CHAT'; projectId?: string | null }
  | { type: 'CANCEL_CHAT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CWD'; cwd: string }
  | { type: 'SET_WORKTREE_ISOLATION'; enabled: boolean }
  // 참조 경로 칩 추가/제거 — 세션 확정 전에만 유효(리듀서가 가드하지 않고 호출부가 게이트한다).
  | { type: 'ADD_EXTRA_DIR'; dir: string }
  | { type: 'REMOVE_EXTRA_DIR'; dir: string }
  | { type: 'START_LOAD_SESSION'; sessionId: string; title: string | null }
  | { type: 'LOAD_SESSION'; session: LoadedSession }
  | { type: 'RENAME_SESSION'; sessionId: string; title: string }
  // 사용자가 질문에 답하거나 건너뛰어 해당 requestId 의 카드를 큐에서 제거.
  | { type: 'RESOLVE_ASK'; requestId: string }
  // Composer 모드 버튼 선택 (계획 / 편집 수락).
  | { type: 'SET_PERMISSION_MODE'; mode: NormalizedPermissionMode }
  // 계획 카드 응답(승인/수정/거부) 후 액션 게이트 제거(타일 내용은 유지).
  | { type: 'RESOLVE_PLAN' }
  // 계획 패널 인라인 코멘트 추가/편집/삭제 + 편집 대상 선택.
  | { type: 'ADD_PLAN_COMMENT'; comment: PlanComment }
  | { type: 'UPDATE_PLAN_COMMENT'; id: string; body: string }
  | { type: 'REMOVE_PLAN_COMMENT'; id: string }
  | { type: 'SET_ACTIVE_PLAN_COMMENT'; id: string | null }
  // 위험 도구 승인 카드 응답(허용/세션허용/거부) 후 게이트 제거.
  | { type: 'RESOLVE_TOOL_APPROVAL'; approvalId: string }
  // 우측 패널 타일 활성 상태/라벨/레이아웃 조작.
  | { type: 'TOGGLE_RIGHT_PANEL_TILE'; id: RightPanelTileId }
  | { type: 'SET_RIGHT_PANEL_TILE_ACTIVE'; id: RightPanelTileId; active: boolean }
  | { type: 'RENAME_RIGHT_PANEL_TILE'; id: RightPanelTileId; label: string }
  | { type: 'REMOVE_RIGHT_PANEL_TILE'; id: RightPanelTileId }
  | { type: 'TOGGLE_DIFF_FILES' }
  | { type: 'SET_GIT_STATUS'; snapshot: BranchSnapshot }
  | { type: 'SELECT_TASK'; key: string | null }
  | { type: 'OPEN_TASK'; key: string }
  | { type: 'SELECT_SUBAGENT_TASK'; toolRunId: string | null }
  | { type: 'OPEN_SUBAGENT_TASK'; toolRunId: string }
  // 항목 키는 `backgroundTaskKey(toolUseId)` 로 유도된다 — 두 필드를 함께 실으면 둘이
  // 어긋날 수 있고 타입이 그것을 막지 못한다.
  | { type: 'TASK_STOP_REQUESTED'; toolUseId: string }
  | { type: 'TASK_STOP_FAILED'; toolUseId: string; detail?: string }
  | { type: 'ACKNOWLEDGE_SETTLED_TASKS' }
  | { type: 'SET_RIGHT_PANEL_COL_WIDTH'; col: number; width: number }
  | { type: 'SET_RIGHT_PANEL_ROW_SPLIT'; col: number; frac: number }

// 현재 assistant 메시지에 파트를 누적한다. 마지막 메시지가 user 면(턴 시작) 새 assistant
// 메시지를 만들고, assistant 면 그 parts 끝에 붙인다 — 한 턴의 reasoning/text/tool_*/error
// 가 같은 메시지로 묶인다(main persist 와 동형).
function appendAssistantPart(messages: Message[], part: AppMessagePart): Message[] {
  const last = messages[messages.length - 1]
  if (!last || last.role === 'user') {
    return [...messages, { role: 'assistant', createdAt: Date.now(), parts: [part] }]
  }
  const next = messages.slice()
  next[next.length - 1] = { ...last, parts: [...last.parts, part] }
  return next
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'BEGIN_TURN':
      return {
        ...state,
        sendCount: state.sendCount + 1,
        inflight: true,
        // 0119: 이 턴이 쓰는 provider 고정 — 이후 SET_MODEL 이 providerKey 를 바꿔도
        // steer 게이트가 진행 턴의 provider 를 기억한다.
        turnProviderKey: state.providerKey,
        turnStartedAt: Date.now(),
        // lastTelemetry 는 비우지 않는다 — 컨텍스트 도넛이 턴 진행 중에도 직전 값을 유지.
        error: undefined,
        retry: undefined
      }

    case 'APPEND_COMMITTED_USER_MESSAGE': {
      // 멱등(0068) — 같은 clientId 의 user 버블이 이미 있으면 no-op: 낙관 커밋 후 도착하는
      // message.committed(echo)가 이중 버블을 만들지 않는다.
      if (
        action.clientId !== undefined &&
        state.messages.some((m) => m.role === 'user' && m.clientId === action.clientId)
      ) {
        return state
      }
      const userParts: AppMessagePart[] = [{ type: 'text', text: action.text }]
      if (action.attachmentViews && action.attachmentViews.length > 0) {
        userParts.push({ type: 'attachment', attachments: action.attachmentViews })
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'user',
            createdAt: action.createdAt ?? Date.now(),
            parts: userParts,
            ...(action.clientId !== undefined ? { clientId: action.clientId } : {})
          }
        ]
      }
    }

    case 'DROP_UNCOMMITTED_USER':
      return {
        ...state,
        messages: state.messages.filter(
          (m) => !(m.role === 'user' && m.clientId === action.clientId)
        )
      }

    case 'RECV_EVENT': {
      const ev = action.event
      switch (ev.type) {
        case 'session.updated':
          // sessionId 발급 시점(claude init) → pendingProjectId 역할 종료(binding 완료). cwd 갱신.
          return {
            ...state,
            sessionId: ev.sessionId,
            backend: 'claude',
            cwd: ev.patch.cwd ?? state.cwd,
            pendingProjectId: null,
            projectId: state.pendingProjectId ?? state.projectId,
            retry: undefined
          }

        // message.delta · message.reasoning.delta 는 reducer 에 도달하지 않는다 —
        // chatStore.receive 가 live 슬라이스(transient)로 라우팅해 커밋 상태(이 reducer)는
        // 델타 프레임에 불변으로 남는다(델타당 transcript 재렌더 0).

        case 'message.reasoning':
          // 완성 사고 블록 → 영속 reasoning 파트. 라이브 프리뷰(live.reasoning)는 store 가 비운다.
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'reasoning',
              text: ev.text,
              ...(ev.signature !== undefined ? { signature: ev.signature } : {})
            })
          }

        case 'message.completed':
          // 스트리밍 델타는 라이브 리프가 보여줬으니, 완성본을 text 파트로 굳힌다.
          // (live.text 클리어는 store 가 담당.)
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'text',
              text: ev.message.text,
              ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
            })
          }

        case 'tool.call.started':
          return {
            ...state,
            retry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'tool_call',
              toolRunId: ev.toolRunId,
              toolName: ev.toolName,
              args: ev.args,
              ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
            })
          }

        case 'tool.call.completed': {
          const messages = appendAssistantPart(state.messages, {
            type: 'tool_result',
            toolRunId: ev.toolRunId,
            result: ev.result,
            isError: ev.isError,
            ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
            ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {}),
            // TaskXXX 구조화 출력(0204) — 라이브 파트가 이것을 빠뜨리면 작업 타일이 재로드
            // 전까지 비어 보인다(writer 영속과 같은 필드를 실어야 한다).
            ...(ev.structuredOutput !== undefined ? { structuredOutput: ev.structuredOutput } : {})
          })
          // 부모 Task 의 권위 결과 도착 = 중단 대기 종료(확정·watchdog·채널 사망 공통 경로).
          const stoppingTaskIds = state.stoppingTaskIds.includes(ev.toolRunId)
            ? state.stoppingTaskIds.filter((id) => id !== ev.toolRunId)
            : state.stoppingTaskIds
          return {
            ...state,
            retry: undefined,
            messages,
            stoppingTaskIds,
            unseenSettledTaskKeys: markCompletedAgentTask(state, ev)
          }
        }

        case 'turn.retrying':
          return {
            ...state,
            retry: { attempt: ev.attempt, max: ev.maxRetries, category: ev.error.category }
          }

        case 'session.compacted':
          // SDK 네이티브 압축 완료(0064 handoff) — 경계 마커 파트로 커밋(재로드는 DB 파트 복원).
          // 압축 전 이력 기준의 lastTelemetry 는 경계에서 무효 — 지워서 도넛/경고가 압축 전
          // 값에 고착되지 않게 한다(0065). 이어지는 telemetry(요약 크기 근사 또는 경계 이후
          // 실측)가 다시 채우고, 못 채우는 엣지에서는 '미측정'(도넛 비표시)이 정직한 상태다.
          return {
            ...state,
            retry: undefined,
            lastTelemetry: undefined,
            messages: appendAssistantPart(state.messages, {
              type: 'compact_boundary',
              ...(ev.trigger !== undefined ? { trigger: ev.trigger } : {}),
              ...(ev.preTokens !== undefined ? { preTokens: ev.preTokens } : {}),
              ...(ev.postTokens !== undefined ? { postTokens: ev.postTokens } : {})
            })
          }

        case 'telemetry': {
          const telemetry = ev.usage
          // 잔여 라이브 텍스트(message.completed 없이 끝난 턴)의 커밋은 store 가 telemetry 직전에
          // COMMIT_PENDING_TEXT 로 선행 dispatch 한다 — 버퍼 소유가 store 로 이동했기 때문.
          return {
            ...state,
            ...TURN_END_RESET,
            // 도넛/패널은 lastTelemetry 파생(컨텍스트 사용량 소스). 컨텍스트 0인 턴(/context 등
            // 로컬 슬래시 명령 — 모델 미호출)은 직전 도넛 값을 덮어쓰지 않게 스킵한다.
            // 0186 — 같은 조건에서 **그 턴이 실제로 쓴 provider** 를 함께 굳힌다. BEGIN_TURN 이
            // 고정해 둔 turnProviderKey 를 쓴다(SET_MODEL 이 그 사이 바꿨어도 턴의 값이 남는다).
            ...(telemetry && contextTokens(telemetry) > 0
              ? {
                  lastTelemetry: telemetry,
                  lastTelemetryProviderKey: state.turnProviderKey ?? state.providerKey
                }
              : {}),
            // 세션 비용 누산(0122 r2) — costUsd 는 턴 단위(원장 행과 동일 단위)라 단순 합산.
            // 컨텍스트 게이트와 무관하게 비용이 보고된 턴은 전부 계상한다(/compact 요약 턴 등).
            ...(telemetry?.costUsd != null
              ? { sessionCostUsd: (state.sessionCostUsd ?? 0) + telemetry.costUsd }
              : {})
          }
        }

        case 'permission.requested':
          // 권한 요청을 종류별 UI 상태로 분기. ask/plan 은 approvalId === action.request.requestId,
          // tool 은 ev.approvalId 를 키로 단일 permissionRespond 채널로 회신한다.
          if (ev.action.kind === 'ask_question') {
            return {
              ...state,
              retry: undefined,
              pendingAsks: [...state.pendingAsks, ev.action.request]
            }
          }
          if (ev.action.kind === 'plan_review') {
            // 계획 도착 → 액션 게이트 설정 + 우측 타일에 내용 표시 + 자동 오픈(auto-trigger).
            return {
              ...state,
              retry: undefined,
              pendingPlanReview: ev.action.request,
              planContent: ev.action.request.plan,
              rightPanelTiles: activateTile(state.rightPanelTiles, 'plan')
            }
          }
          // tool_approval — 위험 도구 실행 승인 게이트. approvalId 로 응답을 라우팅한다.
          // 동시 요청(서브에이전트·병렬 tool_use)은 덮어쓰지 않고 큐에 append 한다.
          return {
            ...state,
            retry: undefined,
            pendingToolApprovals: [
              ...state.pendingToolApprovals,
              {
                approvalId: ev.approvalId,
                toolName: ev.action.toolName,
                input: ev.action.input
              }
            ]
          }

        case 'permission.resolved':
          // 보통 카드는 사용자 respond 시 로컬 RESOLVE_* 로 이미 닫힌다(아래 filter 는 idempotent).
          // 단 SDK 가 권한요청을 *취소*하면(사용자 클릭 없이) 이 이벤트만 오므로, approvalId 로
          // 남은 카드(ask/plan/tool)를 정리해 "먹통 카드"가 남지 않게 한다.
          return {
            ...state,
            retry: undefined,
            pendingAsks: state.pendingAsks.filter((a) => a.requestId !== ev.approvalId),
            pendingToolApprovals: state.pendingToolApprovals.filter(
              (a) => a.approvalId !== ev.approvalId
            ),
            ...(state.pendingPlanReview?.requestId === ev.approvalId
              ? { pendingPlanReview: null }
              : {})
          }

        case 'chat.activity': {
          if (ev.revision <= state.activityRevision) return state
          // **`listening` 은 transport 에서만 파생한다**(0167 AC6 — 잔여와 직교). `busy` 를 섞으면
          // 0154 가 **의도적으로 남기는** orphaned 예약 하나로 `sessionBusy` 가 무한 true 가 되어
          // 보고 ②-a(마지막 답변 뒤 애니메이션 지속)를 그대로 재현한다. 대기 이유는 애니메이션이
          // 아니라 **라벨·개수**(StatusLine facts)와 **잔여 Notice**(Composer)로 알린다.
          //
          // **`inflight` 는 라이브 경로에서 renderer 소유다**(0143 유지 — 애니메이션 정책 불변).
          // 스냅샷의 `foreground` 는 **라벨 전용**이고, 여기서 `inflight` 를 덮으면
          // BEGIN_TURN/TURN_END_RESET/CANCEL_CHAT 의 낙관적 판정을 뒤늦은 스냅샷이 되돌린다
          // (초기 동기화만 예외 — LOAD_SESSION hydrate 는 로컬 진실이 없으므로 스냅샷을 쓴다).
          const listening = ev.transport === 'listening'
          return {
            ...state,
            activityRevision: ev.revision,
            activityForeground: ev.foreground,
            activityQueuedCount: ev.queuedCount,
            activityDeliveryPendingCount: ev.deliveryPendingCount,
            activityResidualCount: ev.residualCount,
            activityBackgroundTaskCount: ev.backgroundTaskCount,
            listening,
            listenStartedAt: listening ? (state.listenStartedAt ?? Date.now()) : null
          }
        }

        case 'subagent.task': {
          // 라이브 메타는 store transient(patchSubagentMeta)가 소유 — reducer 에는 **백그라운드
          // 완료 통지**(settled + background, main 권위 게이팅)만 도달해 subagent_notice 파트로
          // 물질화한다(writer 영속과 동형 — 재로드와 동일 위치·내용). toolRunId 멱등.
          if (ev.phase !== 'settled' || ev.background !== true) return state
          const exists = state.messages.some((m) =>
            m.parts.some((p) => p.type === 'subagent_notice' && p.toolRunId === ev.toolUseId)
          )
          if (exists) return state
          // 완료 통지 파트와 같은 게이트로 작업 타일 미확인 배지도 켠다(0204 D-004) — 사용자가
          // 직접 중단한 태스크는 background 가 실리지 않으므로 여기 오지 않는다(자기 행위는 소음).
          const key = backgroundTaskKey(ev.toolUseId)
          return {
            ...state,
            messages: appendAssistantPart(state.messages, subagentNoticePart(ev)),
            unseenSettledTaskKeys: state.unseenSettledTaskKeys.includes(key)
              ? state.unseenSettledTaskKeys
              : [...state.unseenSettledTaskKeys, key]
          }
        }

        case 'turn.aborted':
          return {
            ...state,
            ...TURN_END_RESET,
            pendingAsks: [],
            pendingPlanReview: null,
            pendingToolApprovals: []
          }

        case 'error':
          // 턴이 끊기면 보류 게이트(질문/계획/도구)는 main 이 broker abort 로 정리하므로 카드도 비운다.
          return {
            ...state,
            error: ev.error,
            ...TURN_END_RESET,
            pendingAsks: [],
            pendingPlanReview: null,
            pendingToolApprovals: []
          }
      }
      return state
    }

    case 'COMMIT_PENDING_TEXT':
      // telemetry 폴백 — 빈 텍스트는 빈 파트를 만들지 않는다.
      if (action.text === '') return state
      return {
        ...state,
        messages: appendAssistantPart(state.messages, { type: 'text', text: action.text })
      }

    case 'NEW_CHAT':
      // cwd 는 새 세션에서도 동일 (main 의 단일 default). 새 대화 즉시 `@` picker
      // 가 동작하도록 보존 — init 이벤트가 와도 같은 값으로 덮어쓰기만 함.
      // projectId 가 명시되면 새 세션이 해당 프로젝트에 binding 될 준비.
      return {
        ...initialChatState,
        cwd: state.cwd,
        pendingProjectId: action.projectId ?? null,
        projectId: action.projectId ?? null
      }

    case 'SET_CWD':
      // **루트는 작업 경로도 될 수 없다** (D-019). cwd 는 `writeRoots[0]` 이라 루트면 0075
      // 가드가 판정할 바깥이 아예 없어진다 — 참조 경로보다 오히려 직접적이다.
      if (isFilesystemRoot(action.cwd)) return { ...state, extraDirRejection: 'root' }
      // 작업 경로가 바뀌면 그 밑으로 들어온 참조 경로는 의미가 달라진다 — 같이 비운다.
      return { ...state, cwd: action.cwd, extraDirs: [], extraDirRejection: null }

    case 'SET_WORKTREE_ISOLATION':
      return { ...state, worktreeIsolation: action.enabled }

    case 'ADD_EXTRA_DIR':
      // **루트는 거부하고 사유를 남긴다** (D-019·D-020). 가드 루트로 오르면 0075 격리가
      // 판정할 바깥이 없어지므로 스키마·가드·세션행 3지점이 뒤에서 또 자르지만, 여기서
      // 막지 않으면 칩은 붙고 전송만 `schema_validation_error` 로 죽어 원인이 안 보인다.
      if (isFilesystemRoot(action.dir)) return { ...state, extraDirRejection: 'root' }
      // 중복·cwd 자기 자신은 조용히 무시한다 — 사용자가 이미 가진 것을 다시 고른 것뿐이다.
      if (state.extraDirs.includes(action.dir) || action.dir === state.cwd) return state
      return {
        ...state,
        extraDirs: [...state.extraDirs, action.dir],
        extraDirRejection: null
      }

    case 'REMOVE_EXTRA_DIR':
      if (!state.extraDirs.includes(action.dir)) return state
      return {
        ...state,
        extraDirs: state.extraDirs.filter((dir) => dir !== action.dir),
        extraDirRejection: null
      }

    case 'CANCEL_CHAT':
      // 턴 취소 시 main 의 broker 가 보류 게이트를 해소하므로 카드(질문/계획/도구)도 함께 비운다.
      // listening 도 즉시 내린다(0143) — main의 다음 activity snapshot이 곧 따라오지만, 중단 버튼의
      // 시각 피드백은 낙관적으로 즉각 반영한다.
      return {
        ...state,
        ...TURN_END_RESET,
        error: undefined,
        listening: false,
        listenStartedAt: null,
        pendingAsks: [],
        pendingPlanReview: null,
        pendingToolApprovals: []
      }

    case 'CLEAR_ERROR':
      return { ...state, error: undefined }

    // 사이드바 클릭 또는 부팅 시 자동 복원으로 비동기 load 가 시작된 시점. sessionId
    // 와 title 을 낙관적으로 세팅해 사이드바 selected 강조 + 헤더 제목을 메시지 도착
    // 전에도 즉시 표시한다. title 이 null 인 경우는 부팅 자동 복원 (사이드바 메타가
    // 아직 도착 안 한 시점) 뿐 — IPC 응답의 LoadedSession.title 로 reconcile.
    case 'START_LOAD_SESSION':
      return {
        ...initialChatState,
        cwd: state.cwd,
        sessionId: action.sessionId,
        title: action.title,
        loadingSession: true
      }

    // 사이드바에서 과거 대화를 선택했을 때 IPC 응답 (LoadedSession) 으로 state 를 통째로 교체.
    // cwd 는 세션 영속값이 있으면 우선하고, 레거시 세션은 현재 baseline 을 보존한다.
    case 'LOAD_SESSION': {
      const messages: Message[] = action.session.messages.map((m) => ({
        role: m.role,
        createdAt: m.createdAt,
        // 미완료(crash/quit)로 남은 메시지의 열린 도구는 'aborted' 로 정착해 "실행 중" 잔재를
        // 막는다. 라이브 경로(RECV_EVENT)는 미경유 — incomplete 한정이라 스트리밍 무영향.
        // 0143: settled 로 덮이지 않은 async_launched 영수증(재시작 = 태스크 소멸이라 '실행 중'
        // 표시는 항상 거짓)은 완료 여부와 무관하게 aborted 로 정착한다(로드 경로 전용).
        parts: settleStaleAsyncLaunchParts(m.incomplete ? settleOrphanToolParts(m.parts) : m.parts),
        ...(m.incomplete ? { incomplete: true } : {})
      }))
      const activity = action.session.activity
      const preserveNewerLiveActivity =
        state.sessionId === action.session.id && state.activityRevision > (activity?.revision ?? 0)
      return {
        ...initialChatState,
        cwd: action.session.cwd ?? state.cwd,
        sessionId: action.session.id,
        projectId: action.session.projectId ?? null,
        backend: action.session.backend,
        title: action.session.title,
        providerKey: action.session.providerKey ?? null,
        messages,
        ...(preserveNewerLiveActivity
          ? {
              activityRevision: state.activityRevision,
              activityForeground: state.activityForeground,
              activityQueuedCount: state.activityQueuedCount,
              activityDeliveryPendingCount: state.activityDeliveryPendingCount,
              activityResidualCount: state.activityResidualCount,
              activityBackgroundTaskCount: state.activityBackgroundTaskCount,
              inflight: state.inflight,
              listening: state.listening,
              listenStartedAt: state.listenStartedAt
            }
          : activity
            ? {
                activityRevision: activity.revision,
                activityForeground: activity.foreground,
                activityQueuedCount: activity.queuedCount,
                activityDeliveryPendingCount: activity.deliveryPendingCount,
                activityResidualCount: activity.residualCount,
                activityBackgroundTaskCount: activity.backgroundTaskCount,
                // **hydrate 만 스냅샷으로 inflight 를 세운다** — 세션 전환·재접속 시점에는 로컬
                // 진실(BEGIN_TURN 이력)이 없기 때문(G-4 초기 동기화). 라이브 스냅샷은 건드리지 않는다.
                inflight: activity.foreground !== 'idle',
                listening: activity.transport === 'listening',
                listenStartedAt: activity.transport === 'listening' ? Date.now() : null
              }
            : {}),
        // 컨텍스트 도넛/패널을 세션 수명 동안 유지 — turn_usage 최신 행에서 복원.
        // 0186 — 복원된 telemetry 의 provider 는 세션의 provider_key 다(그 행을 쓴 세션이므로).
        ...(action.session.lastTelemetry
          ? {
              lastTelemetry: action.session.lastTelemetry,
              lastTelemetryProviderKey: action.session.providerKey ?? null
            }
          : {}),
        // 세션 비용 시드(0122 r2) — turn_usage 세션 SUM. 이후 라이브 턴 telemetry 가 누산.
        ...(action.session.costUsd != null ? { sessionCostUsd: action.session.costUsd } : {}),
        // 0064 continuity — 파생 세션의 출처 배너 복원(fork/handoff 마커 + 부모 제목).
        ...(action.session.lineage
          ? action.session.lineage.relation === 'fork'
            ? {
                forkFrom: action.session.lineage.parentSessionId,
                lineageParentTitle: action.session.lineage.parentTitle
              }
            : {
                handoffFrom: action.session.lineage.parentSessionId,
                lineageParentTitle: action.session.lineage.parentTitle
              }
          : {})
      }
    }

    // 이 엔트리의 세션 제목 갱신. store 가 sessionId 키로 라우팅하므로 보통 일치하지만,
    // 새-채팅 엔트리(sessionId null) 등 불일치 시 no-op 가드.
    case 'RENAME_SESSION':
      if (state.sessionId !== action.sessionId) return state
      return { ...state, title: action.title }

    case 'RESOLVE_ASK':
      return {
        ...state,
        pendingAsks: state.pendingAsks.filter((a) => a.requestId !== action.requestId)
      }

    case 'SET_PERMISSION_MODE':
      return { ...state, permissionMode: action.mode }

    case 'SET_MODEL':
      if (state.sessionId && state.backend && action.adapter && action.adapter !== state.backend) {
        return state
      }
      return { ...state, providerKey: action.providerKey, modelFamily: action.modelFamily }

    case 'SET_EFFORT':
      return { ...state, effort: action.effort }

    case 'RESOLVE_PLAN':
      // 액션 게이트를 닫고 코멘트를 비운다(승인/수정/거부 후 코멘트 소비 완료) — planContent/
      // 계획 타일 활성 상태는 유지(검토 후 읽기전용 표시).
      return {
        ...state,
        pendingPlanReview: null,
        planComments: [],
        activePlanCommentId: null
      }

    case 'ADD_PLAN_COMMENT':
      // 작성 직후 편집 팝오버를 자동으로 열지 않는다(작성 팝오버만 닫힘) — activeId 는 null 유지.
      return {
        ...state,
        planComments: [...state.planComments, action.comment],
        activePlanCommentId: null
      }

    case 'UPDATE_PLAN_COMMENT':
      return {
        ...state,
        planComments: state.planComments.map((c) =>
          c.id === action.id ? { ...c, body: action.body } : c
        )
      }

    case 'REMOVE_PLAN_COMMENT':
      return {
        ...state,
        planComments: state.planComments.filter((c) => c.id !== action.id),
        activePlanCommentId:
          state.activePlanCommentId === action.id ? null : state.activePlanCommentId
      }

    case 'SET_ACTIVE_PLAN_COMMENT':
      return { ...state, activePlanCommentId: action.id }

    case 'RESOLVE_TOOL_APPROVAL':
      // 위험 도구 승인 카드 응답 후 해당 approvalId 만 큐에서 제거(나머지 동시 요청은 유지).
      return {
        ...state,
        pendingToolApprovals: state.pendingToolApprovals.filter(
          (a) => a.approvalId !== action.approvalId
        )
      }

    case 'TOGGLE_RIGHT_PANEL_TILE':
      return columnsContain(state.rightPanelTiles, action.id)
        ? removeTile(state, action.id)
        : { ...state, rightPanelTiles: activateTile(state.rightPanelTiles, action.id) }

    case 'SET_RIGHT_PANEL_TILE_ACTIVE':
      return action.active
        ? { ...state, rightPanelTiles: activateTile(state.rightPanelTiles, action.id) }
        : removeTile(state, action.id)

    case 'RENAME_RIGHT_PANEL_TILE': {
      const label = action.label.trim()
      const nextLabels = { ...state.rightPanelTileLabels }
      if (label) nextLabels[action.id] = label
      else delete nextLabels[action.id]
      return { ...state, rightPanelTileLabels: nextLabels }
    }

    case 'REMOVE_RIGHT_PANEL_TILE': {
      const nextLabels = { ...state.rightPanelTileLabels }
      delete nextLabels[action.id]
      const removed = removeTile(state, action.id)
      // 타일마다 자기 선택만 비운다(0204 §10 EP-12) — 한 분기로 합치면 한 타일을 닫을 때
      // 다른 타일의 상세까지 접힌다.
      return {
        ...removed,
        rightPanelTileLabels: nextLabels,
        ...(action.id === 'task' ? { selectedTaskKey: null } : {}),
        ...(action.id === 'subagent' ? { selectedSubagentTaskId: null } : {})
      }
    }

    case 'TOGGLE_DIFF_FILES':
      return { ...state, diffFilesVisible: !state.diffFilesVisible }

    case 'SET_GIT_STATUS':
      return { ...state, gitStatus: action.snapshot }

    case 'SELECT_TASK':
      // 목록/상세 어느 쪽이든 타일을 실제로 보고 있다 — 미확인 완료 표시를 해제한다.
      return { ...state, selectedTaskKey: action.key, unseenSettledTaskKeys: [] }

    case 'OPEN_TASK':
      return {
        ...state,
        selectedTaskKey: action.key,
        unseenSettledTaskKeys: [],
        rightPanelTiles: activateTile(state.rightPanelTiles, 'task')
      }

    // 백그라운드 작업 타일의 선택 — `selectedTaskKey` 를 건드리지 않는다(EP-12).
    case 'SELECT_SUBAGENT_TASK':
      return { ...state, selectedSubagentTaskId: action.toolRunId }

    case 'OPEN_SUBAGENT_TASK':
      return {
        ...state,
        selectedSubagentTaskId: action.toolRunId,
        rightPanelTiles: activateTile(state.rightPanelTiles, 'subagent')
      }

    case 'TASK_STOP_REQUESTED': {
      if (state.stoppingTaskIds.includes(action.toolUseId)) return state
      const taskStopErrors = { ...state.taskStopErrors }
      delete taskStopErrors[backgroundTaskKey(action.toolUseId)]
      return {
        ...state,
        stoppingTaskIds: [...state.stoppingTaskIds, action.toolUseId],
        taskStopErrors
      }
    }

    case 'TASK_STOP_FAILED':
      return {
        ...state,
        stoppingTaskIds: state.stoppingTaskIds.filter((id) => id !== action.toolUseId),
        taskStopErrors: {
          ...state.taskStopErrors,
          [backgroundTaskKey(action.toolUseId)]: {
            messageKey: 'chat.taskTile.stopFailed',
            ...(action.detail ? { detail: action.detail } : {})
          }
        }
      }

    case 'ACKNOWLEDGE_SETTLED_TASKS':
      return state.unseenSettledTaskKeys.length === 0
        ? state
        : { ...state, unseenSettledTaskKeys: [] }

    case 'SET_RIGHT_PANEL_COL_WIDTH': {
      if (action.col < 0) return state
      const nextWidths = state.rightPanelColWidths.slice()
      nextWidths[action.col] = clampPanelWidth(action.width)
      return { ...state, rightPanelColWidths: nextWidths }
    }

    case 'SET_RIGHT_PANEL_ROW_SPLIT': {
      if (action.col < 0) return state
      const nextSplits = state.rightPanelRowSplits.slice()
      nextSplits[action.col] = clampPanelRowSplit(action.frac)
      return { ...state, rightPanelRowSplits: nextSplits }
    }
  }
}

// TaskXXX 결과가 "완료" 전이를 담고 있으면 미확인 배지 키를 더한다(0204 D-004).
//
// `structuredOutput` 은 Task 도구에만 실리므로(§10 EP-01) 그 유무가 값싼 게이트다 — 일반 도구
// 결과에서는 tool_call 역탐색조차 하지 않는다. TaskList/TaskGet 은 보정(reconcile)이지 전이가
// 아니므로 배지를 켜지 않는다: 전이의 권위는 TaskUpdate 의 statusChange 다.
function markCompletedAgentTask(
  state: ChatState,
  ev: Extract<NormalizedEvent, { type: 'tool.call.completed' }>
): string[] {
  if (ev.structuredOutput === undefined || ev.isError) return state.unseenSettledTaskKeys
  const call = findToolCallPart(state.messages, ev.toolRunId)
  if (!call || call.toolName !== 'TaskUpdate') return state.unseenSettledTaskKeys
  const observation = readTaskToolObservation({
    toolName: call.toolName,
    args: call.args,
    structuredOutput: ev.structuredOutput,
    isError: false
  })
  if (!observation || observation.kind !== 'upserted') return state.unseenSettledTaskKeys
  if (observation.patch.status !== 'completed') return state.unseenSettledTaskKeys
  const key = agentTaskKey(observation.id)
  return state.unseenSettledTaskKeys.includes(key)
    ? state.unseenSettledTaskKeys
    : [...state.unseenSettledTaskKeys, key]
}

// toolRunId 의 tool_call 파트를 뒤에서부터 찾는다 — 결과는 대개 방금 커밋된 호출의 것이라
// 역방향이 첫 몇 파트에서 끝난다.
function findToolCallPart(
  messages: Message[],
  toolRunId: string
): Extract<AppMessagePart, { type: 'tool_call' }> | undefined {
  for (let m = messages.length - 1; m >= 0; m -= 1) {
    const parts = messages[m].parts
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const part = parts[i]
      if (part.type === 'tool_call' && part.toolRunId === toolRunId) return part
    }
  }
  return undefined
}

// 타일 제거 — 열 구조에서 해당 타일만 떼어낸다. 그 결과 열이 비면 열을 드롭하면서, 열 인덱스를
// 키로 쓰는 폭(rightPanelColWidths)·행분할(rightPanelRowSplits) 도 같은 인덱스에서 splice 해
// 정합을 맞춘다(열이 2→1 로 줄 때는 열이 유지되므로 그대로).
// 타일 활성화의 유일한 통로 (0205 §10 EP-01). 정지된 타일은 어느 경로로도 열에 들어가지
// 않는다 — 무변경은 참조를 그대로 돌려주므로 `addTileColumnMajor` 의 중복 처리와 동형이다.
//
// **reducer 가 `addTileColumnMajor` 를 직접 부르지 않는다**: 지점이 5곳이라 한 곳만 막으면
// 나머지로 정지가 뚫리고, 대표 경로 테스트는 그대로 통과한다. 게이트는 여기 하나다.
function activateTile(cols: RightPanelColumns, id: RightPanelTileId): RightPanelColumns {
  return isRightPanelTileSuspended(id) ? cols : addTileColumnMajor(cols, id)
}

function removeTile(state: ChatState, id: RightPanelTileId): ChatState {
  const { columns, removedCol } = removeTileFromColumns(state.rightPanelTiles, id)
  if (columns === state.rightPanelTiles) return state
  if (removedCol === null) return { ...state, rightPanelTiles: columns }
  return {
    ...state,
    rightPanelTiles: columns,
    rightPanelColWidths: state.rightPanelColWidths.filter((_, i) => i !== removedCol),
    rightPanelRowSplits: state.rightPanelRowSplits.filter((_, i) => i !== removedCol)
  }
}

const clampPanelWidth = (n: number): number =>
  Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(n)))

const clampPanelRowSplit = (n: number): number =>
  Math.max(PANEL_MIN_ROW_SPLIT, Math.min(PANEL_MAX_ROW_SPLIT, n))

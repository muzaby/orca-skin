import type { AttachmentView } from '../../shared/ipc'
import type { ResolvedProviderSettings } from '../adapters/provider-config'
import type { LineageRelation } from '../infra/db/types'
import type { RuntimeLiveTurn, RuntimeTitleAdapter } from './ports'
import type { TurnSelectionSnapshot } from '../adapters/turn'

export interface TurnContext<W = unknown> {
  controller: AbortController
  owner: W
  live: RuntimeLiveTurn | null
  titleAdapter: RuntimeTitleAdapter
  titleSettings?: ResolvedProviderSettings
  titleEnv?: Record<string, string>
  titleModel?: string
  providerKey: string | null
  // 이 턴이 실제로 시작할 때의 Composer 선택/해석 모델 스냅샷. busy 메시지의 steer 경계 판정
  // 기준이며, renderer 의 이후 선택 변경과 독립적으로 유지한다.
  selection: TurnSelectionSnapshot
  pendingUserText: string | null
  firstUserText: string
  pendingAttachmentViews: AttachmentView[]
  dbSessionId: string | null
  pendingProjectId: string | null
  isNewSession: boolean
  cwd: string
  titleGenerationStarted: boolean
  currentAssistantMessageId: number | null
  assistantText: string
  pendingAskAnswers: Array<{ answers: Record<string, string | string[]>; response?: string }>
  askPendingIds: string[]
  askResolved: Map<string, { answers: Record<string, string | string[]>; response?: string }>
  subagentTaskIds: Map<string, string>
  openToolRuns: Map<string, { parentToolRunId?: string }>
  subagentTypes: Map<string, string>
  blockedSubagents: Set<string>
  stoppedSubagents: Set<string>
  // 0064 continuity — fork/handoff 턴 메타. session.updated(새 id 발급) 시 persist 가
  // lineage 영속(+fork display 복사)에 쓴다.
  lineage?: { parentSessionId: string; relation: LineageRelation }
  // 새 세션행의 초기 제목 오버라이드 — continuity 는 `[분기]/[핸드오프] <원본 제목>` 을 쓰고
  // 자동 제목 생성(0004)을 억제해 마커를 유지한다(titleGenerationStarted=true 와 짝).
  initialTitle?: string
  // 0067 AC9 — 세션 id 확정 전 pending queue 키(renderer clientKey). session.updated 에서
  // coordinator 가 실 id 로 rekey 한다. 절대 영속 금지.
  queueKey?: string
}

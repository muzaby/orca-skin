import type { AttachmentView } from '../../shared/ipc'
import type { LineageRelation } from '../db/types'
import type { ResolvedProviderSettings } from '../settings/provider-settings'
import type { RuntimeLiveTurn, RuntimeTitleAdapter } from './ports'

export interface TurnContext<W = unknown> {
  controller: AbortController
  owner: W
  live: RuntimeLiveTurn | null
  titleAdapter: RuntimeTitleAdapter
  titleSettings?: ResolvedProviderSettings
  titleEnv?: Record<string, string>
  titleModel?: string
  providerKey: string | null
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
  // 0062 continuity — fork/handoff 턴 메타. session.updated(새 id 발급) 시 persist 가
  // lineage 영속(+fork display 복사)에 쓴다.
  lineage?: { parentSessionId: string; relation: LineageRelation }
  // 핸드오프 자동 메시지(main 조립 발화) — coordinator 가 세션 확정(promote) 직후
  // message.user 로 1회 forward 해 렌더러 transcript 에 커밋한다.
  echoUserText?: string
}

export type InflightTurn<W = unknown> = TurnContext<W>

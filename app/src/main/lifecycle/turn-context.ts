import type { AttachmentView } from '../../shared/ipc'
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
}

export type InflightTurn<W = unknown> = TurnContext<W>

import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'
export const openCodeTranscript: AgentTranscriptPresentation = {
  surface: 'opencode',
  turnProjection: 'standard',
  inlineSubagentDetail: true,
  showTaskAgentLabel: false,
  planBodyPlacement: 'right-panel',
  remountTranscriptBySession: false
}

import type { AgentTranscriptPresentation } from '../contracts'
export const openCodeTranscript: AgentTranscriptPresentation = {
  surface: 'opencode',
  turnProjection: 'standard',
  inlineSubagentDetail: true,
  showTaskAgentLabel: false,
  planBodyPlacement: 'right-panel',
  remountTranscriptBySession: false
}

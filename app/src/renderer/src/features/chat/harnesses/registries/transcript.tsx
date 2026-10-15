import type { Backend } from '../../../../../../shared/ipc'
import { ClaudeTranscriptView } from '../claude/transcript/Timeline'
import { OpenCodeTimeline } from '../opencode/transcript/Timeline'
import { ClaudeScrollController } from '../claude/transcript/ScrollController'
import { OpenCodeScrollController } from '../opencode/transcript/ScrollController'
import type { TranscriptViewProps } from '../contracts'
import type { ScrollControllerProps } from '../common/transcript/scrollTypes'

interface TranscriptHarness {
  Timeline: React.ComponentType<TranscriptViewProps & { textScaleClassName: string }>
  ScrollController: React.ComponentType<ScrollControllerProps>
  remountScrollBySession: boolean
}
const registry = {
  claude: {
    Timeline: ClaudeTranscriptView,
    ScrollController: ClaudeScrollController,
    remountScrollBySession: false
  },
  opencode: {
    Timeline: OpenCodeTimeline,
    ScrollController: OpenCodeScrollController,
    remountScrollBySession: true
  }
} satisfies Record<Backend, TranscriptHarness>
export function transcriptHarness(backend: Backend | null | undefined): TranscriptHarness {
  return registry[backend ?? 'claude']
}

import type { Backend } from '../../../../../../shared/ipc'
import { StatusLine } from '../../components/StatusLine'
import type { TranscriptRuntime } from '../common/transcript/TranscriptRuntime'
import { ClaudeAssistantSegment } from '../claude/transcript/AssistantSegment'
import { OpenCodeAssistantSegment } from '../opencode/transcript/AssistantSegment'
import { transcriptAppearance as claudeAppearance } from '../claude/transcript/appearance'
import { transcriptAppearance as opencodeAppearance } from '../opencode/transcript/appearance'
import { surfaces as claudeSurfaces } from '../claude/surfaces'
import { surfaces as opencodeSurfaces } from '../opencode/surfaces'
const runtimes = {
  claude: {
    DetailStatus: StatusLine,
    appearance: claudeAppearance,
    messageClassName: 'gap-[var(--chat-item-gap)] ' + claudeSurfaces.message,
    canFork: true,
    Segment: ClaudeAssistantSegment
  },
  opencode: {
    DetailStatus: StatusLine,
    appearance: opencodeAppearance,
    messageClassName: 'gap-5 ' + opencodeSurfaces.message,
    canFork: false,
    Segment: OpenCodeAssistantSegment
  }
} satisfies Record<Backend, TranscriptRuntime>
export function assistantRuntime(backend: Backend | null | undefined): TranscriptRuntime {
  return runtimes[backend ?? 'claude']
}

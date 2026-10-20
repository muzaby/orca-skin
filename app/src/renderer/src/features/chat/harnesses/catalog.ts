import type { Backend } from '../../../../../shared/ipc'
import type { AgentKind } from '../../../../../shared/agent-kind'
import type {
  AgentPresentation,
  AgentTranscriptPresentation,
  ComposerAppearance,
  TranscriptAppearance,
  HarnessSurfaces,
  RightPanelAppearance,
  ModelPresentation
} from './contracts'
import type { RightPanelAgentPolicy } from '../lib/rightPanelTiles'
import { agentPresentation } from './claude/presentation'
import { openCodeTranscript } from './opencode/presentation'
import { composerAppearance as claudeComposer } from './claude/composer/appearance'
import { composerAppearance as opencodeComposer } from './opencode/composer/appearance'
import { transcriptAppearance as claudeTranscript } from './claude/transcript/appearance'
import { transcriptAppearance as opencodeTranscript } from './opencode/transcript/appearance'
import { surfaces as claudeSurfaces } from './claude/surfaces'
import { surfaces as opencodeSurfaces } from './opencode/surfaces'
import { modelPresentation as claudeModel } from './claude/composer/modelPresentation'
import { modelPresentation as opencodeModel } from './opencode/composer/modelPresentation'
import * as claudePanel from './claude/rightPanel'
import * as opencodePanel from './opencode/rightPanel'
import { toolApprovalRequestKey as claudeApproval } from './claude/composer/approval'
import { toolApprovalRequestKey as opencodeApproval } from './opencode/composer/approval'
interface HarnessPolicy {
  composer: ComposerAppearance
  transcriptAppearance: TranscriptAppearance
  surfaces: HarnessSurfaces
  model: ModelPresentation
  agent: Record<AgentKind, AgentPresentation>
  transcript: (kind: AgentKind) => AgentTranscriptPresentation
  panel: (kind: AgentKind) => RightPanelAgentPolicy
  panelAppearance: RightPanelAppearance
  planEmptyDescription: typeof claudePanel.planEmptyDescriptionKey
  planSelectHint: typeof claudePanel.planSelectHintKey
  toolApproval: typeof claudeApproval
}
const catalog = {
  claude: {
    composer: claudeComposer,
    transcriptAppearance: claudeTranscript,
    surfaces: claudeSurfaces,
    model: claudeModel,
    agent: agentPresentation,
    transcript: (kind: AgentKind) => agentPresentation[kind].transcript,
    panel: (kind: AgentKind) => claudePanel.RIGHT_PANEL_POLICY[kind],
    panelAppearance: claudePanel.rightPanelAppearance,
    planEmptyDescription: claudePanel.planEmptyDescriptionKey,
    planSelectHint: claudePanel.planSelectHintKey,
    toolApproval: claudeApproval
  },
  opencode: {
    composer: opencodeComposer,
    transcriptAppearance: opencodeTranscript,
    surfaces: opencodeSurfaces,
    model: opencodeModel,
    agent: agentPresentation,
    transcript: () => openCodeTranscript,
    panel: (kind: AgentKind) =>
      kind === 'code'
        ? opencodePanel.OPEN_CODE_PANEL_POLICY
        : opencodePanel.OPEN_CODE_WORK_PANEL_POLICY,
    panelAppearance: opencodePanel.rightPanelAppearance,
    planEmptyDescription: opencodePanel.planEmptyDescriptionKey,
    planSelectHint: opencodePanel.planSelectHintKey,
    toolApproval: opencodeApproval
  }
} satisfies Record<Backend, HarnessPolicy>
export function harnessCatalog(backend: Backend | null | undefined): HarnessPolicy {
  return catalog[backend ?? 'claude']
}

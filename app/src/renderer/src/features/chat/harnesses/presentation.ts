import { composerAppearance as claudeComposer } from './claude/composer/appearance'
import { composerAppearance as openCodeComposer } from './opencode/composer/appearance'
import { toolApprovalRequestKey as claudeToolApproval } from './claude/composer/approval'
import { toolApprovalRequestKey as openCodeToolApproval } from './opencode/composer/approval'
import {
  rightPanelAppearance as claudeRightPanel,
  planEmptyDescriptionKey as claudePlanEmptyDescription
} from './claude/rightPanel'
import {
  rightPanelAppearance as openCodeRightPanel,
  planEmptyDescriptionKey as openCodePlanEmptyDescription
} from './opencode/rightPanel'
import { surfaces as claudeSurfaces } from './claude/surfaces'
import { surfaces as openCodeSurfaces } from './opencode/surfaces'
import { transcriptAppearance as claudeTranscript } from './claude/transcript/appearance'
import { transcriptAppearance as openCodeTranscript } from './opencode/transcript/appearance'

export function transcriptAppearance(openCode: boolean): typeof claudeTranscript {
  return openCode ? openCodeTranscript : claudeTranscript
}

export function composerAppearance(openCode: boolean): typeof claudeComposer {
  return openCode ? openCodeComposer : claudeComposer
}
export function rightPanelAppearance(openCode: boolean): typeof claudeRightPanel {
  return openCode ? openCodeRightPanel : claudeRightPanel
}

export function planEmptyDescriptionKey(openCode: boolean): typeof claudePlanEmptyDescription {
  return openCode ? openCodePlanEmptyDescription : claudePlanEmptyDescription
}

export function toolApprovalRequestKey(openCode: boolean): typeof claudeToolApproval {
  return openCode ? openCodeToolApproval : claudeToolApproval
}

export function harnessSurfaces(openCode: boolean): typeof claudeSurfaces {
  return openCode ? openCodeSurfaces : claudeSurfaces
}

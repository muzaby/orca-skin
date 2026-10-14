import { composerAppearance as claudeComposer } from './claude/composer/appearance'
import { composerAppearance as openCodeComposer } from './opencode/composer/appearance'
import { rightPanelAppearance as claudeRightPanel } from './claude/rightPanel'
import { rightPanelAppearance as openCodeRightPanel } from './opencode/rightPanel'
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

export function harnessSurfaces(openCode: boolean): typeof claudeSurfaces {
  return openCode ? openCodeSurfaces : claudeSurfaces
}

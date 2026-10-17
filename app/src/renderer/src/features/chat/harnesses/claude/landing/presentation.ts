import { AgentModeToggle } from '../../../components/AgentModeToggle'
import type { HarnessLandingPresentation } from '../../contracts'
import { surfaces } from '../surfaces'

export const claudeLandingPresentation: HarnessLandingPresentation = {
  root: surfaces.landingRoot,
  align: surfaces.landingAlign,
  column: surfaces.landingColumn,
  Header: AgentModeToggle,
  composer: { openCodeLanding: false, flush: false }
}

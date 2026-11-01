import { AgentModeToggle } from '../../../components/AgentModeToggle'
import type { HarnessLandingPresentation } from '../../contracts'

export const claudeLandingPresentation: HarnessLandingPresentation = {
  Header: AgentModeToggle,
  composer: { contextLayout: 'inline', flush: false }
}

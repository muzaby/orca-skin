import type { Backend } from '../../../../../../shared/ipc'
import { claudeLandingPresentation } from '../claude/landing/presentation'
import { openCodeLandingPresentation } from '../opencode/landing/presentation'
import type { HarnessLandingPresentation } from '../contracts'

const presentations = {
  claude: claudeLandingPresentation,
  opencode: openCodeLandingPresentation
} satisfies Record<Backend, HarnessLandingPresentation>

export function harnessLanding(backend: Backend | null): HarnessLandingPresentation {
  return presentations[backend ?? 'claude']
}

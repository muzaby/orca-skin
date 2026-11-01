import type { Backend } from '../../../../../../shared/ipc'
import { claudeLandingPresentation } from '../claude/landing/presentation'
import type { HarnessLandingPresentation } from '../contracts'
import { openCodePresentation } from '../opencode/landing/presentation'

const presentations = {
  claude: claudeLandingPresentation,
  opencode: openCodePresentation
} satisfies Record<Backend, HarnessLandingPresentation>

export function harnessLanding(backend: Backend | null): HarnessLandingPresentation {
  return presentations[backend ?? 'claude']
}

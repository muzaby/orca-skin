import type { HarnessLandingPresentation } from '../../contracts'
import { LandingBrand } from './Brand'

export const openCodeLandingPresentation: HarnessLandingPresentation = {
  Header: LandingBrand,
  composer: { openCodeLanding: true, flush: true }
}

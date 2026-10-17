import type { HarnessLandingPresentation } from '../../contracts'
import { LandingBrand } from './Brand'
import { surfaces } from '../surfaces'

export const openCodeLandingPresentation: HarnessLandingPresentation = {
  root: surfaces.landingRoot,
  align: surfaces.landingAlign,
  column: surfaces.landingColumn,
  Header: LandingBrand,
  composer: { openCodeLanding: true, flush: true }
}

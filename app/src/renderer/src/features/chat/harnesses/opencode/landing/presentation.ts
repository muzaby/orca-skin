import type { HarnessLandingPresentation } from '../../contracts'
import { LandingBrand } from './Brand'

export const openCodePresentation: HarnessLandingPresentation = {
  Header: LandingBrand,
  composer: { contextLayout: 'below', flush: true }
}

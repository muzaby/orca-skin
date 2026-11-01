import type { Backend } from '../../../../../shared/ipc'
import { harnessCatalog } from './catalog'
import type { HarnessSurfaces } from './contracts'
export function harnessSurfaces(backend: Backend): HarnessSurfaces {
  return harnessCatalog(backend).surfaces
}

import { harnessCatalog } from './catalog'
import type { HarnessSurfaces } from './contracts'
export function harnessSurfaces(openCode: boolean): HarnessSurfaces {
  return harnessCatalog(openCode ? 'opencode' : 'claude').surfaces
}

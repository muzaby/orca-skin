import { harnessCatalog } from './catalog'
import { isBackend } from '../../../../../shared/harness'
import type { ModelPresentation } from './contracts'
export function modelPresentation(adapter: string): ModelPresentation {
  return harnessCatalog(isBackend(adapter) ? adapter : 'claude').model
}

import { modelPresentation as claude } from './claude/composer/modelPresentation'
import { modelPresentation as opencode } from './opencode/composer/modelPresentation'
import type { ModelPresentation } from './types'

export function modelPresentation(adapter: string): ModelPresentation {
  return adapter === 'opencode' ? opencode : claude
}

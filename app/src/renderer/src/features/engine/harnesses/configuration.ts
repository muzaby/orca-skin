import type { Backend } from '../../../../../shared/ipc'
import { claudeEngineConfiguration } from './claude/configuration'
import { openCodeEngineConfiguration } from './opencode'
import type { EngineHarnessConfiguration } from './types'
export function engineHarnessConfiguration(backend: Backend): EngineHarnessConfiguration {
  return backend === 'opencode' ? openCodeEngineConfiguration : claudeEngineConfiguration
}

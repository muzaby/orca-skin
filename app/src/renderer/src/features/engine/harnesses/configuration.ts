import type { Backend } from '../../../../../shared/ipc'
import { claudeEngineConfiguration } from './claude/configuration'
import { openCodeEngineConfiguration } from './opencode'
import type { EngineHarnessConfiguration } from './types'
const configurations = {
  claude: claudeEngineConfiguration,
  opencode: openCodeEngineConfiguration
} satisfies Record<Backend, EngineHarnessConfiguration>

export function engineHarnessConfiguration(backend: Backend): EngineHarnessConfiguration {
  return configurations[backend]
}

// 기존 추가 폼의 최초 하네스와 편집 초깃값은 조립부가 명시한다.
export const engineFormPolicy = {
  configurationFor: engineHarnessConfiguration,
  defaultEngine: 'claude' as const,
  defaultInitialSettingsJson: '{\n  "env": {}\n}'
}

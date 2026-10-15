import type { Backend } from '../../../../../shared/ipc'
import { ClaudeDescription, ClaudeFields } from './claude/Fields'
import { claudeSettingsCodec } from './claude/preferences'
import { OpenCodeDescription, OpenCodeFields } from './opencode/Fields'
import { openCodeSettingsCodec } from './opencode/preferences'
import type { HarnessSettingsConfiguration } from './types'

const configurations = {
  claude: {
    ...claudeSettingsCodec,
    Fields: ClaudeFields,
    Description: ClaudeDescription
  },
  opencode: {
    ...openCodeSettingsCodec,
    Fields: OpenCodeFields,
    Description: OpenCodeDescription
  }
} satisfies Record<Backend, HarnessSettingsConfiguration>

export function harnessSettingsConfiguration(backend: Backend): HarnessSettingsConfiguration {
  return configurations[backend]
}

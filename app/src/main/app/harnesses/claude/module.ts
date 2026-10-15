import { ClaudeAdapter } from '../../../adapters/claude/adapter'
import {
  loadClaudeProviderSettings,
  readUserClaudeSettings
} from '../../../adapters/claude/settings'
import {
  parseClaudeModels,
  parseRuntimeModels
} from '../../../features/harnesses/claude/model-parser'
import { defaultProvider, resolveTitleModel } from '../../../features/harnesses/claude/model-policy'
import type { MainHarnessModule } from '../common/contracts'

export const claudeMainModule: MainHarnessModule = {
  id: 'claude',
  createAdapter: () => new ClaudeAdapter(),
  loadSettings: loadClaudeProviderSettings,
  parseSettingsModels: parseClaudeModels,
  parseRuntimeModels,
  readUserSettings: readUserClaudeSettings,
  defaultProvider,
  resolveTitleModel
}

// Existing native blobs use this startup flag before settings are loaded.
export const claudeSettingsEnvHoist = {
  key: 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST',
  value: '1'
} as const

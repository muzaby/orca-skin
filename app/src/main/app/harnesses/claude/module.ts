import { configuredClaudeCommands } from '../../../adapters/claude/plugin-catalog'
import { ClaudeAdapter } from '../../../adapters/claude/adapter'
import {
  configuredClaudeResources,
  configuredClaudePluginDirectory
} from '../../../adapters/claude/configured-resources'
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
  configuredResources: configuredClaudeResources,
  configuredCommands: configuredClaudeCommands,
  configuredPluginDirectory: configuredClaudePluginDirectory,
  defaultProvider,
  resolveTitleModel,
  recoveryContextWindow: (_settings, model) =>
    /(?:\[1m\]|-1m)(?:$|\b)/i.test(model ?? '') ? 1000000 : 200000
}

// Existing native blobs use this startup flag before settings are loaded.
export const claudeSettingsEnvHoist = {
  key: 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST',
  value: '1'
} as const

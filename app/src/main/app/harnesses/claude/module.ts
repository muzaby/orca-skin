import { configuredClaudeCommands, pluginPathKey } from '../../../adapters/claude/plugin-catalog'
import { ClaudeAdapter } from '../../../adapters/claude/adapter'
import {
  configuredClaudeResources,
  configuredClaudePluginDirectory,
  configuredClaudeMcpFile
} from '../../../adapters/claude/configured-resources'
import {
  globalClaudeResources,
  globalClaudeResourcePath
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
import {
  claudeProjectSettingsFiles,
  readClaudeProjectSettings
} from '../../../adapters/claude/project-settings'

export const claudeMainModule: MainHarnessModule = {
  projectResources: {
    files: claudeProjectSettingsFiles,
    read: async (cwd) => ({ revision: readClaudeProjectSettings(cwd).revision })
  },
  id: 'claude',
  createAdapter: (options) => new ClaudeAdapter(options.extensionControl, options.pluginSnapshots),
  globalResources: globalClaudeResources,
  globalResourcePath: globalClaudeResourcePath,
  loadSettings: loadClaudeProviderSettings,
  parseSettingsModels: parseClaudeModels,
  parseRuntimeModels,
  readUserSettings: readUserClaudeSettings,
  configuredResources: configuredClaudeResources,
  nativeResourceScope: pluginPathKey,
  configuredCommands: configuredClaudeCommands,
  configuredPluginDirectory: configuredClaudePluginDirectory,
  configuredMcpFile: configuredClaudeMcpFile,
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

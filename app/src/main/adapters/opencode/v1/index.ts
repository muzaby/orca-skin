import type { OpenCodeImplementation } from '../implementation'
import { OpenCodeAdapter } from './adapter'
import {
  configuredOpenCodePluginSkillDirectories,
  configuredOpenCodeResources,
  globalOpenCodeMcpFile,
  globalOpenCodeResources
} from './configured-resources'
import { openCodeContextWindow } from './context-usage'
import { openCodeDiscovery } from './discovery-cache'
import { openCodeGlobalConfigFiles, openCodeGlobalPluginFingerprint } from './global-plugins'
import { LegacyStorageMigration } from './legacy-storage-migration'
import { openCodeProjectResources } from './project-settings'
import { OpenCodeServerPool } from './server'
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  parseOpenCodeRuntimeModels,
  readUserOpenCodeSettings
} from './settings'
import { openCodeSkillDirectories } from './skill-sources'

export const implementation: OpenCodeImplementation = {
  invalidateDiscovery: () => openCodeDiscovery.invalidate(),
  globalPluginFiles: openCodeGlobalConfigFiles,
  globalPluginFingerprint: openCodeGlobalPluginFingerprint,
  projectResources: openCodeProjectResources,
  createAdapter: (options) =>
    new OpenCodeAdapter(
      options.server ?? new OpenCodeServerPool(options),
      options.fetchImpl,
      options.openDatabase
        ? new LegacyStorageMigration({
            legacyRoot: options.dataDirectory,
            openDatabase: options.openDatabase
          })
        : undefined,
      options.openDatabase,
      options.extensionControl,
      options.preferences,
      options.managedMcp
    ),
  loadSettings: loadOpenCodeProviderSettings,
  parseModels: parseOpenCodeModels,
  parseRuntimeModels: parseOpenCodeRuntimeModels,
  readUserSettings: readUserOpenCodeSettings,
  configuredResources: configuredOpenCodeResources,
  globalResources: globalOpenCodeResources,
  globalResourcePath: globalOpenCodeMcpFile,
  skillDirectories: openCodeSkillDirectories,
  pluginSkillDirectories: configuredOpenCodePluginSkillDirectories,
  contextWindow: openCodeContextWindow
}

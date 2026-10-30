import { openCodeGlobalConfigFiles, openCodeGlobalPluginFingerprint } from './global-plugins'
import { openCodeProjectResources } from './project-settings'
import { openCodeDiscovery } from './discovery-cache'
import type { OpenCodeImplementation } from '../implementation'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import { LegacyStorageMigration } from './legacy-storage-migration'
import { openCodeContextWindow } from './context-usage'
import {
  configuredOpenCodeMcpFile,
  configuredOpenCodeResources,
  configuredOpenCodePluginSkillDirectories
} from './configured-resources'
import { globalOpenCodeResources, globalOpenCodeMcpFile } from './configured-resources'
import { openCodeSkillDirectories } from './skill-sources'
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  parseOpenCodeRuntimeModels,
  readUserOpenCodeSettings
} from './settings'

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
  configuredMcpFile: configuredOpenCodeMcpFile,
  configuredResources: configuredOpenCodeResources,
  globalResources: globalOpenCodeResources,
  globalResourcePath: globalOpenCodeMcpFile,
  skillDirectories: openCodeSkillDirectories,
  pluginSkillDirectories: configuredOpenCodePluginSkillDirectories,
  contextWindow: openCodeContextWindow
}

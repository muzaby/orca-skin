import type { OpenCodeImplementation } from '../implementation'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import { LegacyStorageMigration } from './legacy-storage-migration'
import { openCodeContextWindow } from './context-usage'
import { configuredOpenCodeMcpFile } from './configured-resources'
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings
} from './settings'

export const implementation: OpenCodeImplementation = {
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
      options.openDatabase
    ),
  loadSettings: loadOpenCodeProviderSettings,
  parseModels: parseOpenCodeModels,
  readUserSettings: readUserOpenCodeSettings,
  configuredMcpFile: configuredOpenCodeMcpFile,
  contextWindow: openCodeContextWindow
}

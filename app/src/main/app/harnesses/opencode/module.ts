import { join } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import {
  createOpenCodeGlobalPlugins,
  createOpenCodeAdapter,
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings,
  configuredOpenCodeMcpFile,
  configuredOpenCodeResources,
  globalOpenCodeResources,
  globalOpenCodeResourcePath,
  openCodeProjectResources,
  openCodeContextWindow
} from '../../../adapters/opencode'
import {
  defaultProvider,
  resolveTitleModel
} from '../../../features/harnesses/opencode/model-policy'
import type { MainHarnessModule } from '../common/contracts'

export const openCodeMainModule: MainHarnessModule = {
  id: 'opencode',
  globalResourceControl: createOpenCodeGlobalPlugins,
  projectResources: openCodeProjectResources,
  globalResources: globalOpenCodeResources,
  globalResourcePath: globalOpenCodeResourcePath,
  createAdapter: (options) =>
    createOpenCodeAdapter({
      ...options,
      preferences: () => options.preferences('opencode'),
      openDatabase: openFileDatabase,
      dataDirectory: join(options.dataDirectory, 'opencode')
    }),
  loadSettings: loadOpenCodeProviderSettings,
  parseSettingsModels: parseOpenCodeModels,
  readUserSettings: readUserOpenCodeSettings,
  configuredMcpFile: configuredOpenCodeMcpFile,
  draftResources: configuredOpenCodeResources,
  defaultProvider,
  resolveTitleModel,
  recoveryContextWindow: openCodeContextWindow
}

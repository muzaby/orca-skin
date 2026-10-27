import { join } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import {
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
  // The module's second argument is a choices map, not a subprocess environment.
  draftResources: (cwd) => configuredOpenCodeResources(cwd),
  defaultProvider,
  resolveTitleModel,
  recoveryContextWindow: openCodeContextWindow
}

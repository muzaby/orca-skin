import { join } from 'node:path'
import {
  configuredOpenCodeResources,
  createOpenCodeAdapter,
  globalOpenCodeResourcePath,
  globalOpenCodeResources,
  openCodeContextWindow,
  openCodeProjectResources,
  readUserOpenCodeSettings
} from '../../../adapters/opencode'
import {
  defaultProvider,
  resolveTitleModel
} from '../../../features/harnesses/opencode/model-policy'
import { openFileDatabase } from '../../../infra/db/file-database'
import type { MainHarnessModule } from '../common/contracts'
import { openCodeConfigModule } from './config'

export const openCodeMainModule: MainHarnessModule = {
  ...openCodeConfigModule,
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
  readUserSettings: readUserOpenCodeSettings,
  // The module's second argument is a choices map, not a subprocess environment.
  draftResources: (cwd) => configuredOpenCodeResources(cwd),
  defaultProvider,
  resolveTitleModel,
  recoveryContextWindow: openCodeContextWindow
}

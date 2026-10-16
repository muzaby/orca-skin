import { join } from 'node:path'
import { openFileDatabase } from '../../../infra/db/file-database'
import {
  createOpenCodeAdapter,
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings,
  openCodeContextWindow
} from '../../../adapters/opencode'
import {
  defaultProvider,
  resolveTitleModel
} from '../../../features/harnesses/opencode/model-policy'
import type { MainHarnessModule } from '../common/contracts'

export const openCodeMainModule: MainHarnessModule = {
  id: 'opencode',
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
  defaultProvider,
  resolveTitleModel,
  recoveryContextWindow: openCodeContextWindow
}

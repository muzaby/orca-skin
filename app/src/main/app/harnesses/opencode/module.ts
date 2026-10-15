import { join } from 'node:path'
import {
  createOpenCodeAdapter,
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings
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
      dataDirectory: join(options.dataDirectory, 'opencode')
    }),
  loadSettings: loadOpenCodeProviderSettings,
  parseSettingsModels: parseOpenCodeModels,
  readUserSettings: readUserOpenCodeSettings,
  defaultProvider,
  resolveTitleModel
}

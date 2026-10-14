import type { OpenCodeImplementation } from '../implementation'
import { OpenCodeAdapter } from './adapter'
import { OpenCodeServerPool } from './server'
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings
} from './settings'

export const implementation: OpenCodeImplementation = {
  createAdapter: (options) =>
    new OpenCodeAdapter(options.server ?? new OpenCodeServerPool(options), options.fetchImpl),
  loadSettings: loadOpenCodeProviderSettings,
  parseModels: parseOpenCodeModels,
  readUserSettings: readUserOpenCodeSettings
}

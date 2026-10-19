import { DEFAULT_PROVIDER_ID, PROVIDER_OPTIONS, providerOption } from './providerCatalog'
import type { EngineHarnessConfiguration } from '../types'
export const claudeEngineConfiguration: EngineHarnessConfiguration = {
  cardLabel: 'Claude',
  editHarnessChip: 'claude',
  defaultProvider: DEFAULT_PROVIDER_ID,
  defaultSettings: providerOption(DEFAULT_PROVIDER_ID)?.template ?? '{}',
  providers: PROVIDER_OPTIONS,
  hint: 'engine.form.envHint',
  importKeys: {
    title: 'engine.form.importTitle',
    button: 'engine.form.importButton',
    notFound: 'engine.form.importNotFound',
    failed: 'engine.form.importFailed'
  }
}

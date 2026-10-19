import type { MessageKey } from '../../../shared/i18n'
import type { Backend } from '../../../../../shared/ipc'
export interface EngineHarnessConfiguration {
  cardLabel: string
  editHarnessChip: string | null
  defaultProvider: string
  defaultSettings: string
  providers: readonly {
    id: string
    labelKey: MessageKey
    descKey: MessageKey
    custom: boolean
    template: string
  }[]
  hint: 'engine.form.envHint' | 'engine.form.openCodeHint'
  importKeys: { title: MessageKey; button: MessageKey; notFound: MessageKey; failed: MessageKey }
}

export type EngineConfigurationFor = (backend: Backend) => EngineHarnessConfiguration

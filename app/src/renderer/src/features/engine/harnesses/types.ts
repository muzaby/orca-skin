import type { MessageKey } from '../../../shared/i18n'
export interface EngineHarnessConfiguration {
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

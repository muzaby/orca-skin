import type { EngineHarnessConfiguration } from '../../types'
// OpenCode 1.x native opencode.json. UI state and import lifetime remain in the common form.
export const openCodeEngineConfiguration: EngineHarnessConfiguration = {
  defaultProvider: 'default',
  defaultSettings: '{}',
  providers: [],
  hint: 'engine.form.openCodeHint',
  importKeys: {
    title: 'engine.form.openCodeImportTitle',
    button: 'engine.form.openCodeImportButton',
    notFound: 'engine.form.openCodeImportNotFound',
    failed: 'engine.form.openCodeImportFailed'
  }
}

import type { SettingsPatch } from './ipc'

// Compiled by the normal typecheck gate: renderer patches cannot edit restoration records.
const forbidden: SettingsPatch = {
  // @ts-expect-error main-only field must stay outside SettingsPatch
  openCodeDisabledPlugins: [{ id: 'plugin', file: '/private', entry: 'pkg', index: 0 }]
}
void forbidden

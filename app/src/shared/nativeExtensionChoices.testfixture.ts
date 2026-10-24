import type { SettingsPatch } from './ipc'

export const rejectedNativeChoicePatch: SettingsPatch = {
  // @ts-expect-error Global choices can only be changed through the catalog handler.
  nativeExtensionChoices: { claude: { 'plugin:protected': false } }
}

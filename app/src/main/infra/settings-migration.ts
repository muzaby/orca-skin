import { SettingsSchema, type Settings } from '../../shared/protocol'

export const SETTINGS_VERSION = 1
export const SETTINGS_VERSION_KEY = 'settingsVersion'
export const LAST_APP_VERSION_KEY = 'lastAppVersion'

type Raw = Record<string, unknown>
type SettingsKey = keyof Settings

const SETTINGS_KEYS = Object.keys(SettingsSchema.parse({})) as SettingsKey[]

function settingValue<K extends SettingsKey>(key: K, value: unknown): Settings[K] {
  const parsed = SettingsSchema.safeParse({ [key]: value })
  return parsed.success ? parsed.data[key] : SettingsSchema.parse({})[key]
}

function recoverKnownSettings(raw: Raw): Settings {
  const recovered: Raw = SettingsSchema.parse({}) as Raw
  for (const key of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      recovered[key] = settingValue(key, raw[key])
    }
  }
  return SettingsSchema.parse(recovered)
}

export interface SettingsMigrationResult {
  raw: Raw
  settings: Settings
}

export function migrateRawSettings(raw: Raw, currentAppVersion: string): SettingsMigrationResult {
  const parsed = SettingsSchema.safeParse(raw)
  const settings = parsed.success ? parsed.data : recoverKnownSettings(raw)
  const migrated: Raw = {
    ...settings,
    [SETTINGS_VERSION_KEY]: SETTINGS_VERSION,
    [LAST_APP_VERSION_KEY]: currentAppVersion
  }
  return { raw: migrated, settings }
}

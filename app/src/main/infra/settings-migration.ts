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

// 키 개명 마이그레이션 (구 이름 → 새 이름). 값 형태가 같을 때만 쓴다.
// 새 키가 이미 있으면 그쪽이 이긴다(재실행 안전 — 멱등).
const RENAMED_KEYS: ReadonlyArray<readonly [from: string, to: SettingsKey]> = [
  // 0157 — SSO 게이트가 인증 플랫폼으로 대체되면서 함께 개명.
  ['ssoBypass', 'authBypass']
]

function applyRenames(raw: Raw): Raw {
  let next = raw
  for (const [from, to] of RENAMED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, from)) continue
    const { [from]: legacy, ...rest } = next
    next = Object.prototype.hasOwnProperty.call(next, to) ? rest : { ...rest, [to]: legacy }
  }
  return next
}

export function migrateRawSettings(raw: Raw, currentAppVersion: string): SettingsMigrationResult {
  const renamed = applyRenames(raw)
  const parsed = SettingsSchema.safeParse(renamed)
  const settings = parsed.success ? parsed.data : recoverKnownSettings(renamed)
  const migrated: Raw = {
    ...settings,
    [SETTINGS_VERSION_KEY]: SETTINGS_VERSION,
    [LAST_APP_VERSION_KEY]: currentAppVersion
  }
  return { raw: migrated, settings }
}

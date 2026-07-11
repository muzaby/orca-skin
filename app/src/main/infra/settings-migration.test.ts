import { describe, expect, it } from 'vitest'
import {
  LAST_APP_VERSION_KEY,
  SETTINGS_VERSION,
  SETTINGS_VERSION_KEY,
  migrateRawSettings
} from './settings-migration'

describe('settings migration', () => {
  it('uiLocale — 부재는 ko 기본값, 유효값(en)은 보존, 불량값은 ko 로 복구(0096)', () => {
    expect(migrateRawSettings({}, '1.100.0').settings.uiLocale).toBe('ko')
    expect(migrateRawSettings({ uiLocale: 'en' }, '1.100.0').settings.uiLocale).toBe('en')
    expect(migrateRawSettings({ uiLocale: 'fr' }, '1.100.0').settings.uiLocale).toBe('ko')
  })

  it('유효한 기존 설정을 보존하고 내부 버전 메타데이터를 기록한다', () => {
    const migrated = migrateRawSettings(
      {
        windowBounds: { x: 10, y: 20, width: 800, height: 600 },
        lastSessionId: 's1',
        lastBackend: 'claude',
        density: 'compact'
      },
      '1.100.0'
    )

    expect(migrated.settings).toMatchObject({
      windowBounds: { x: 10, y: 20, width: 800, height: 600 },
      lastSessionId: 's1',
      lastBackend: 'claude',
      density: 'compact'
    })
    expect(migrated.raw[SETTINGS_VERSION_KEY]).toBe(SETTINGS_VERSION)
    expect(migrated.raw[LAST_APP_VERSION_KEY]).toBe('1.100.0')
  })

  it('일부 키가 invalid여도 보존 가능한 사용자 상태를 기본값으로 무음 리셋하지 않는다', () => {
    const migrated = migrateRawSettings(
      {
        density: 'invalid-density',
        windowBounds: { x: 1, y: 2, width: 1024, height: 768 },
        lastSessionId: 'last',
        lastBackend: 'claude'
      },
      '1.100.0'
    )

    expect(migrated.settings.density).toBe('normal')
    expect(migrated.settings.windowBounds).toEqual({ x: 1, y: 2, width: 1024, height: 768 })
    expect(migrated.settings.lastSessionId).toBe('last')
    expect(migrated.settings.lastBackend).toBe('claude')
  })

  it('settingsVersion/lastAppVersion은 공개 settings 결과에 노출하지 않는다', () => {
    const migrated = migrateRawSettings(
      {
        [SETTINGS_VERSION_KEY]: 999,
        [LAST_APP_VERSION_KEY]: '99.99.99',
        lastSessionId: 's1'
      },
      '1.100.0'
    )

    expect(migrated.raw[SETTINGS_VERSION_KEY]).toBe(SETTINGS_VERSION)
    expect(migrated.raw[LAST_APP_VERSION_KEY]).toBe('1.100.0')
    expect(migrated.settings).not.toHaveProperty(SETTINGS_VERSION_KEY)
    expect(migrated.settings).not.toHaveProperty(LAST_APP_VERSION_KEY)
  })
})

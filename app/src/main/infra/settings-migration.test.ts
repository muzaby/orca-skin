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

  // 0157 — SSO 게이트가 인증 플랫폼으로 대체되면서 키를 개명했다.
  describe('ssoBypass → authBypass 개명 (AC14)', () => {
    it('구 키의 값을 새 키로 옮긴다', () => {
      const migrated = migrateRawSettings({ ssoBypass: true }, '1.100.0')
      expect(migrated.settings.authBypass).toBe(true)
      expect(migrated.settings).not.toHaveProperty('ssoBypass')
      expect(migrated.raw).not.toHaveProperty('ssoBypass')
    })

    it('구 키가 없으면 기본값을 유지한다', () => {
      expect(migrateRawSettings({}, '1.100.0').settings.authBypass).toBe(false)
    })

    it('새 키가 이미 있으면 그쪽이 이긴다 (재실행 안전)', () => {
      const migrated = migrateRawSettings({ ssoBypass: true, authBypass: false }, '1.100.0')
      expect(migrated.settings.authBypass).toBe(false)
    })

    it('멱등 — 마이그레이션 결과를 다시 넣어도 값이 유지된다', () => {
      const once = migrateRawSettings({ ssoBypass: true }, '1.100.0')
      const twice = migrateRawSettings(once.raw, '1.100.0')
      expect(twice.settings.authBypass).toBe(true)
    })

    it('형제 설정을 보존한다', () => {
      const migrated = migrateRawSettings({ ssoBypass: true, lastSessionId: 's1' }, '1.100.0')
      expect(migrated.settings.lastSessionId).toBe('s1')
      expect(migrated.settings.authBypass).toBe(true)
    })
  })
})

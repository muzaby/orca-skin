import { describe, expect, it } from 'vitest'
import { en } from '../shared/i18n/resources/en'
import { ko } from '../shared/i18n/resources/ko'
import { SIDEBAR_NAV } from './navItems'

describe('SIDEBAR_NAV', () => {
  it('플러그인 nav 항목은 /plugins 로 이동하고 그 경로에서 활성이다', () => {
    const item = SIDEBAR_NAV[3]
    expect(item.path).toBe('/plugins')
    expect(item.isActive('/plugins')).toBe(true)
    expect(item.isActive('/skills')).toBe(false)
    expect(ko.sidebar.nav.plugins).toBeTruthy()
    expect(en.sidebar.nav.plugins).toBeTruthy()
  })
})

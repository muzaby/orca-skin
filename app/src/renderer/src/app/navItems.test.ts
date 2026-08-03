import { describe, expect, it } from 'vitest'
import { en } from '../shared/i18n/resources/en'
import { ko } from '../shared/i18n/resources/ko'
import { SIDEBAR_NAV } from './navItems'

describe('SIDEBAR_NAV', () => {
  it('플러그인 nav 항목은 라우트가 아닌 모달 액션이다', () => {
    const item = SIDEBAR_NAV[3]
    expect(item.path).toBeNull()
    expect(item.isActive()).toBe(false)
    expect(ko.sidebar.nav.plugins).toBeTruthy()
    expect(en.sidebar.nav.plugins).toBeTruthy()
  })
})

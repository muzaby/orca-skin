import { describe, expect, it } from 'vitest'
import { en } from '../shared/i18n/resources/en'
import { ko } from '../shared/i18n/resources/ko'
import { SIDEBAR_NAV } from './navItems'

describe('SIDEBAR_NAV', () => {
  // 고정 프로젝트 바로가기(`/projects/:id`)와 프로젝트 목록 메뉴(`/projects`)는 서로 다른
  // nav 표면이다 — 상세를 열었을 때 상단 메뉴까지 켜지면 어디에 있는지가 흐려진다.
  it('프로젝트 메뉴는 목록 경로에서만 활성이다', () => {
    const projects = SIDEBAR_NAV[1]
    expect(projects.path).toBe('/projects')
    expect(projects.isActive('/projects')).toBe(true)
    expect(projects.isActive('/projects/abc')).toBe(false)
  })

  it('플러그인 nav 항목은 라우트가 아닌 모달 액션이다', () => {
    const item = SIDEBAR_NAV[3]
    expect(item.path).toBeNull()
    expect(item.isActive()).toBe(false)
    expect(ko.sidebar.nav.plugins).toBeTruthy()
    expect(en.sidebar.nav.plugins).toBeTruthy()
  })
})

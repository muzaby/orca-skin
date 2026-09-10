import { describe, expect, it } from 'vitest'
import { en } from '../shared/i18n/resources/en'
import { ko } from '../shared/i18n/resources/ko'
import { SIDEBAR_NAV } from './navItems'

describe('SIDEBAR_NAV', () => {
  // 고정 프로젝트 바로가기(`/projects/:id`)와 프로젝트 목록 메뉴(`/projects`)는 서로 다른
  // nav 표면이다 — 상세를 열었을 때 상단 메뉴까지 켜지면 어디에 있는지가 흐려진다.
  it('프로젝트 메뉴는 목록 경로에서만 활성이다', () => {
    const projects = SIDEBAR_NAV.find((item) => item.path === '/projects')!
    expect(projects.path).toBe('/projects')
    expect(projects.isActive('/projects')).toBe(true)
    expect(projects.isActive('/projects/abc')).toBe(false)
  })

  it('플러그인 nav 항목은 카탈로그 페이지를 열고 활성 상태를 표시한다', () => {
    const item = SIDEBAR_NAV.find((entry) => entry.path === '/plugins')!
    expect(item.isActive('/plugins')).toBe(true)
    expect(item.isActive('/new')).toBe(false)
    expect(ko.sidebar.nav.plugins).toBeTruthy()
    expect(en.sidebar.nav.plugins).toBeTruthy()
  })

  it('아티팩트 메뉴는 갤러리 경로를 열고 활성 상태를 표시한다', () => {
    const item = SIDEBAR_NAV.find((entry) => entry.path === '/artifacts')!
    expect(item.isActive('/artifacts')).toBe(true)
    expect(item.isActive('/chat/session')).toBe(false)
    expect(ko.sidebar.nav.artifacts).toBe('아티팩트')
    expect(en.sidebar.nav.artifacts).toBe('Artifacts')
  })
})

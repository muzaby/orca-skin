import type { MessageKey } from '../shared/i18n'
import type { IconName } from '../shared/ui/Icon'

export const SIDEBAR_NAV = [
  {
    icon: 'plus',
    labelKey: 'sidebar.nav.newChat',
    path: '/new',
    isActive: (p: string) => p === '/new'
  },
  {
    icon: 'folder',
    labelKey: 'sidebar.nav.projects',
    path: '/projects',
    // 프로젝트 목록 메뉴와 고정 프로젝트 바로가기는 서로 다른 nav 항목이다.
    // 상세 프로젝트를 열었을 때 상단 메뉴까지 선택된 것처럼 보이지 않게 한다.
    isActive: (p: string) => p === '/projects'
  },
  {
    // 예약 작업. `clock` 의 path 가 Material Symbols `schedule` 이다.
    icon: 'clock',
    labelKey: 'sidebar.nav.scheduled',
    path: '/scheduled',
    isActive: (p: string) => p === '/scheduled'
  },
  {
    icon: 'doc',
    labelKey: 'sidebar.nav.artifacts',
    path: '/artifacts',
    isActive: (p: string) => p === '/artifacts'
  },
  {
    icon: 'cpu',
    labelKey: 'sidebar.nav.engine',
    path: '/agent',
    isActive: (p: string) => p.startsWith('/agent')
  },
  {
    icon: 'electricalServices',
    labelKey: 'sidebar.nav.plugins',
    path: '/plugins',
    isActive: (p: string) => p === '/plugins'
  }
] as const satisfies readonly {
  icon: IconName
  labelKey: MessageKey
  path: string
  isActive: (pathname: string) => boolean
}[]

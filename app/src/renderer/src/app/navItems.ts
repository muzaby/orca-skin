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
    isActive: (p: string) => p.startsWith('/projects')
  },
  {
    icon: 'cpu',
    labelKey: 'sidebar.nav.engine',
    path: '/agent',
    isActive: (p: string) => p.startsWith('/agent')
  },
  {
    icon: 'layers',
    labelKey: 'sidebar.nav.plugins',
    path: '/plugins',
    isActive: (p: string) => p.startsWith('/plugins')
  }
] as const satisfies readonly {
  icon: IconName
  labelKey: MessageKey
  path: string
  isActive: (pathname: string) => boolean
}[]

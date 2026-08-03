// URL/path 라우팅의 라벨·breadcrumb 카탈로그.
// `pattern` 은 react-router 의 path 패턴 (matchPath 호환). AppLayout 이 `useLocation`
// 의 pathname 을 매칭해 헤더 라벨/breadcrumb 을 결정한다.
//
// 라벨은 언어 전환 시 stale 해지지 않도록 i18n 키만 상수로 두고 소비자(AppLayout 등)가
// 렌더에서 tr() 해석한다(0096 패턴).
//
// Sidebar 의 active 강조는 별도 — pathname.startsWith 등의 prefix 매칭으로 처리하므로
// 여기서는 *현재 화면의 메타* 만 담당한다.

export interface RouteInfo {
  pattern: string
  labelKey: (typeof ROUTES)[number]['labelKey']
  breadcrumbKey: (typeof ROUTES)[number]['breadcrumbKey']
}

export const ROUTES = [
  { pattern: '/new', labelKey: 'nav.chat', breadcrumbKey: null },
  { pattern: '/chat/:sessionId', labelKey: 'nav.chat', breadcrumbKey: null },
  { pattern: '/projects', labelKey: 'nav.projects', breadcrumbKey: 'nav.projectsBreadcrumb' },
  {
    pattern: '/projects/:projectId',
    labelKey: 'nav.projects',
    breadcrumbKey: 'nav.projectsBreadcrumb'
  },
  { pattern: '/agent', labelKey: 'nav.engine', breadcrumbKey: 'nav.engineBreadcrumb' },
  { pattern: '/plugins', labelKey: 'nav.plugins', breadcrumbKey: 'nav.pluginsBreadcrumb' },
  { pattern: '/captures', labelKey: 'nav.captures', breadcrumbKey: 'nav.capturesBreadcrumb' }
] as const

// fallback — 매칭되지 않는 경로 (`/` 부팅 직후 한 프레임, catch-all 직전 등) 에서
// AppLayout 이 사용할 안전 기본값.
export const DEFAULT_ROUTE_INFO: RouteInfo = ROUTES[0]

export const LEGACY_ROUTE_REDIRECTS = { '/skills': '/plugins' } as const

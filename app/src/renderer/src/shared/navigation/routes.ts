// URL/path 라우팅의 라벨·breadcrumb 카탈로그.
// `pattern` 은 react-router 의 path 패턴 (matchPath 호환). AppLayout 이 `useLocation`
// 의 pathname 을 매칭해 헤더 라벨/breadcrumb 을 결정한다.
//
// Sidebar 의 active 강조는 별도 — pathname.startsWith 등의 prefix 매칭으로 처리하므로
// 여기서는 *현재 화면의 메타* 만 담당한다.

export interface RouteInfo {
  pattern: string
  label: string
  breadcrumb: string | null
}

export const ROUTES: RouteInfo[] = [
  { pattern: '/new', label: '01 채팅', breadcrumb: null },
  { pattern: '/chat/:sessionId', label: '01 채팅', breadcrumb: null },
  { pattern: '/projects', label: '02 프로젝트', breadcrumb: '프로젝트' },
  { pattern: '/projects/:projectId', label: '02 프로젝트', breadcrumb: '프로젝트' },
  { pattern: '/agent', label: '03 엔진 & 모델', breadcrumb: '설정 · 엔진 & 모델' },
  { pattern: '/skills', label: '04 Skills / MCP', breadcrumb: '설정 · Skills & MCP' },
  { pattern: '/captures', label: '05 캡처 히스토리', breadcrumb: '캡처 히스토리' }
]

// fallback — 매칭되지 않는 경로 (`/` 부팅 직후 한 프레임, catch-all 직전 등) 에서
// AppLayout 이 사용할 안전 기본값.
export const DEFAULT_ROUTE_INFO: RouteInfo = ROUTES[0]

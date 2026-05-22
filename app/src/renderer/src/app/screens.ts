export type ScreenId =
  | 'chat'
  | 'projects'
  | 'project-detail'
  | 'engine'
  | 'skills'
  | 'captures'
  | 'v5-home'
  | 'v5-projects'
  | 'v5-task'
  | 'v5-modals'
  | 'v5-settings'
  | 'v5-artifact'
  | 'v5-menu-account'
  | 'v5-menu-lang'
  | 'v5-sched-empty'
  | 'v5-sched-list'
  | 'v5-sched-detail'
  | 'v5-sched-chat'
  | 'v5-sched-done'

export interface ScreenInfo {
  id: ScreenId
  label: string
  breadcrumb: string | null
}

export const SCREENS: ScreenInfo[] = [
  { id: 'chat', label: '01 채팅', breadcrumb: null },
  { id: 'projects', label: '02 프로젝트', breadcrumb: '프로젝트' },
  { id: 'project-detail', label: '02 프로젝트', breadcrumb: '프로젝트' },
  { id: 'engine', label: '03 엔진 & 모델', breadcrumb: '설정 · 엔진 & 모델' },
  { id: 'skills', label: '04 Skills / MCP', breadcrumb: '설정 · Skills & MCP' },
  { id: 'captures', label: '05 캡처 히스토리', breadcrumb: '캡처 히스토리' },
  { id: 'v5-home', label: 'v5 홈', breadcrumb: 'v5 · 홈' },
  { id: 'v5-projects', label: 'v5 프로젝트', breadcrumb: 'v5 · 프로젝트' },
  { id: 'v5-task', label: 'v5 태스크', breadcrumb: 'v5 · 태스크' },
  { id: 'v5-modals', label: 'v5 모달', breadcrumb: 'v5 · 모달' },
  { id: 'v5-settings', label: 'v5 설정', breadcrumb: 'v5 · 설정' },
  { id: 'v5-artifact', label: 'v5 아티팩트', breadcrumb: 'v5 · 아티팩트' },
  { id: 'v5-menu-account', label: 'v5 계정 메뉴', breadcrumb: 'v5 · 계정 메뉴' },
  { id: 'v5-menu-lang', label: 'v5 언어 메뉴', breadcrumb: 'v5 · 언어 메뉴' },
  { id: 'v5-sched-empty', label: 'v5 예약 (빈)', breadcrumb: 'v5 · 예약 빈' },
  { id: 'v5-sched-list', label: 'v5 예약 목록', breadcrumb: 'v5 · 예약 목록' },
  { id: 'v5-sched-detail', label: 'v5 예약 상세', breadcrumb: 'v5 · 예약 상세' },
  { id: 'v5-sched-chat', label: 'v5 예약 대화', breadcrumb: 'v5 · 예약 대화' },
  { id: 'v5-sched-done', label: 'v5 예약 완료', breadcrumb: 'v5 · 예약 완료' }
]

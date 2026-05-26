export type ScreenId = 'chat' | 'projects' | 'project-detail' | 'engine' | 'skills' | 'captures'

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
  { id: 'captures', label: '05 캡처 히스토리', breadcrumb: '캡처 히스토리' }
]

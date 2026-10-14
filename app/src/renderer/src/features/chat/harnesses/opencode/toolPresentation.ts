// 현재 지원 버전 선택은 이 진입점에서만 한다. 화면은 버전 중립 view를 소비한다.
export { describeTool, toolKind } from './v1/toolPresentation'
export type { OpenCodeFileView, OpenCodeToolView } from './toolPresentation.types'

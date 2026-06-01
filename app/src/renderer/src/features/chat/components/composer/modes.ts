import type { IconName } from '../../../../shared/ui/Icon'
import type { PermissionMode } from '../../../../../../shared/ipc'

// Composer 모드 버튼이 노출하는 두 권한 모드. 라벨/아이콘은 칩(Composer)과 메뉴(ModeMenu)가
// 공유하므로 컴포넌트와 분리된 데이터 모듈에 둔다 (react-refresh 경계 보존).
export const MODE_OPTIONS: {
  mode: PermissionMode
  label: string
  icon: IconName
  description: string
}[] = [
  {
    mode: 'plan',
    label: '계획',
    icon: 'board',
    description: '읽기 전용 — 코드를 탐색·분석하고 계획만 세웁니다 (편집 없음).'
  },
  {
    mode: 'acceptEdits',
    label: '편집 수락',
    icon: 'edit',
    description: '파일 편집을 자동으로 수락합니다 (확인 없이 적용).'
  }
]

export const MODE_LABELS: Record<PermissionMode, string> = {
  plan: '계획',
  acceptEdits: '편집 수락'
}

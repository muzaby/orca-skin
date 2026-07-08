import type { IconName } from '../../../../shared/ui/Icon'
import type { NormalizedPermissionMode } from '../../../../../../shared/permission-mode'

// Composer 모드 버튼이 노출하는 권한 모드(정규화 6종). 라벨/아이콘은 칩(Composer)과 메뉴(ModeMenu)가
// 공유하므로 컴포넌트와 분리된 데이터 모듈에 둔다 (react-refresh 경계 보존).
// `risky` = 승인 게이트를 무력화하는 모드 → ModeMenu 가 2-스텝 확인으로 가드(보안 베이스라인).
export const MODE_OPTIONS: {
  mode: NormalizedPermissionMode
  label: string
  icon: IconName
  description: string
  risky?: boolean
}[] = [
  {
    mode: 'plan',
    label: '계획',
    icon: 'board',
    description: '읽기 전용 — 코드를 탐색·분석하고 계획만 세웁니다 (편집 없음).'
  },
  {
    mode: 'default',
    label: '기본',
    icon: 'check',
    description: '표준 동작 — 위험한 작업은 그때그때 확인을 요청합니다.'
  },
  {
    mode: 'accept_edits',
    label: '편집 수락',
    icon: 'edit',
    description: '파일 편집을 자동으로 수락합니다 (확인 없이 적용).'
  },
  {
    mode: 'auto_classified',
    label: '자동 분류',
    icon: 'sparkle',
    description: '모델이 위험도를 분류해 안전한 작업을 자동 승인합니다.'
  },
  {
    mode: 'dont_ask',
    label: '묻지 않음',
    icon: 'bolt',
    description: 'Orca 승인 질문을 만들지 않고 기본 자동 진행 정책을 따릅니다.',
    risky: true
  },
  {
    mode: 'bypass',
    label: '권한 우회',
    icon: 'alert',
    description: '샌드박스/승인 권한 검사를 최대한 건너뜁니다 — 매우 위험.',
    risky: true
  }
]

export const MODE_LABELS: Record<NormalizedPermissionMode, string> = {
  plan: '계획',
  default: '기본',
  accept_edits: '편집 수락',
  auto_classified: '자동 분류',
  dont_ask: '묻지 않음',
  bypass: '권한 우회'
}

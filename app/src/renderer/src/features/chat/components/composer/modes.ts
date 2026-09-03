import type { MessageKey } from '../../../../shared/i18n'
import type { NormalizedPermissionMode } from '../../../../../../shared/permission-mode'
import { isHaikuModel } from '../../../../../../shared/model-identity'

// Composer 모드 버튼이 노출하는 권한 모드(정규화 6종). 라벨/설명은 **카탈로그 키**만 두고
// 칩(Composer)과 메뉴(ModeMenu)가 렌더에서 tr() 해석한다(0096 stale-방지 패턴, 0097).
// `risky` = 승인 게이트를 무력화하는 모드 → ModeMenu 가 2-스텝 확인으로 가드(보안 베이스라인).
// `descKey` 생략 = 메뉴에서 한 줄 행(설명 없음).
// `hidden` = 메뉴에 내걸지 않는 모드. 카탈로그에는 남긴다 — 복원된 세션·다른 경로가 그 모드를
// 들고 오면 칩이 `MODE_LABEL_KEYS[mode]` 를 읽어야 하고, 빠지면 라벨이 undefined 가 된다.
export interface ModeOption {
  mode: NormalizedPermissionMode
  labelKey: MessageKey
  descKey?: MessageKey
  risky?: boolean
  hidden?: boolean
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'auto_classified',
    labelKey: 'chat.composer.modes.auto_classified.label',
    descKey: 'chat.composer.modes.auto_classified.desc'
  },
  {
    mode: 'default',
    labelKey: 'chat.composer.modes.default.label',
    descKey: 'chat.composer.modes.default.desc'
  },
  {
    mode: 'accept_edits',
    labelKey: 'chat.composer.modes.accept_edits.label',
    descKey: 'chat.composer.modes.accept_edits.desc'
  },
  {
    mode: 'plan',
    labelKey: 'chat.composer.modes.plan.label',
    descKey: 'chat.composer.modes.plan.desc'
  },
  {
    mode: 'bypass',
    labelKey: 'chat.composer.modes.bypass.label',
    risky: true
  },
  {
    mode: 'dont_ask',
    labelKey: 'chat.composer.modes.dont_ask.label',
    descKey: 'chat.composer.modes.dont_ask.desc',
    risky: true,
    hidden: true
  }
]

// 메뉴에 실제로 걸리는 항목(표시 순서 = 배열 순서). 모델 제약을 받지 않는 기본 목록이다.
export const MODE_MENU_OPTIONS = MODE_OPTIONS.filter((opt) => !opt.hidden)

// 이 모델에서 실제로 고를 수 있는 항목 (0215 D-010). haiku 는 SDK `auto` 를 지원하지 않으므로
// '자동' 을 목록에서 뺀다 — 고를 수 없는 모드를 내걸면 사용자는 그것이 적용됐다고 믿는다.
// `model === null`(선택 전)이면 제약 없이 기본 목록을 돌려준다.
export function modeMenuOptions(
  model: { alias: string; model: string | null } | null
): ModeOption[] {
  if (!model || !isHaikuModel(model)) return MODE_MENU_OPTIONS
  return MODE_MENU_OPTIONS.filter((opt) => opt.mode !== 'auto_classified')
}

// MODE_OPTIONS 의 labelKey 파생 — 라벨 키의 단일 진실원은 MODE_OPTIONS.
export const MODE_LABEL_KEYS = Object.fromEntries(
  MODE_OPTIONS.map((o) => [o.mode, o.labelKey])
) as Record<NormalizedPermissionMode, MessageKey>

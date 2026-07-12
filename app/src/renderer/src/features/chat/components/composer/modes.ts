import type { IconName } from '../../../../shared/ui/Icon'
import type { MessageKey } from '../../../../shared/i18n'
import type { NormalizedPermissionMode } from '../../../../../../shared/permission-mode'

// Composer 모드 버튼이 노출하는 권한 모드(정규화 6종). 라벨/설명은 **카탈로그 키**만 두고
// 칩(Composer)과 메뉴(ModeMenu)가 렌더에서 tr() 해석한다(0096 stale-방지 패턴, 0097).
// `risky` = 승인 게이트를 무력화하는 모드 → ModeMenu 가 2-스텝 확인으로 가드(보안 베이스라인).
export const MODE_OPTIONS: {
  mode: NormalizedPermissionMode
  labelKey: MessageKey
  icon: IconName
  descKey: MessageKey
  risky?: boolean
}[] = [
  {
    mode: 'plan',
    labelKey: 'chat.composer.modes.plan.label',
    icon: 'board',
    descKey: 'chat.composer.modes.plan.desc'
  },
  {
    mode: 'default',
    labelKey: 'chat.composer.modes.default.label',
    icon: 'check',
    descKey: 'chat.composer.modes.default.desc'
  },
  {
    mode: 'accept_edits',
    labelKey: 'chat.composer.modes.accept_edits.label',
    icon: 'edit',
    descKey: 'chat.composer.modes.accept_edits.desc'
  },
  {
    mode: 'auto_classified',
    labelKey: 'chat.composer.modes.auto_classified.label',
    icon: 'sparkle',
    descKey: 'chat.composer.modes.auto_classified.desc'
  },
  {
    mode: 'dont_ask',
    labelKey: 'chat.composer.modes.dont_ask.label',
    icon: 'bolt',
    descKey: 'chat.composer.modes.dont_ask.desc',
    risky: true
  },
  {
    mode: 'bypass',
    labelKey: 'chat.composer.modes.bypass.label',
    icon: 'alert',
    descKey: 'chat.composer.modes.bypass.desc',
    risky: true
  }
]

// MODE_OPTIONS 의 labelKey 파생 — 라벨 키의 단일 진실원은 MODE_OPTIONS.
export const MODE_LABEL_KEYS = Object.fromEntries(
  MODE_OPTIONS.map((o) => [o.mode, o.labelKey])
) as Record<NormalizedPermissionMode, MessageKey>

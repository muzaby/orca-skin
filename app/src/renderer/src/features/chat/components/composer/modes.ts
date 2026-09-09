import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { MessageKey } from '../../../../shared/i18n'
import {
  coercePermissionMode,
  agentPermissionPolicy,
  type NormalizedPermissionMode
} from '../../../../../../shared/permission-mode'

// Composer 모드 버튼이 노출하는 권한 모드(정규화 6종). 라벨/설명은 **카탈로그 키**만 두고
// 칩(Composer)과 메뉴(ModeMenu)가 렌더에서 tr() 해석한다(0096 stale-방지 패턴, 0097).
// `risky` = 승인 게이트를 무력화하는 모드 → ModeMenu 가 2-스텝 확인으로 가드(보안 베이스라인).
// `descKey` 생략 = 메뉴에서 한 줄 행(설명 없음).
// 종류별 메뉴 순서/허용값은 공용 권한 정책에서 선택한다. 카탈로그는 모든 모드의 문구를 갖는다.
export interface ModeOption {
  mode: NormalizedPermissionMode
  labelKey: MessageKey
  descKey?: MessageKey
  risky?: boolean
}

const optionByMode: {
  [Mode in NormalizedPermissionMode]: ModeOption & { mode: Mode }
} = {
  auto_classified: {
    mode: 'auto_classified',
    labelKey: 'chat.composer.modes.auto_classified.label',
    descKey: 'chat.composer.modes.auto_classified.desc'
  },
  default: {
    mode: 'default',
    labelKey: 'chat.composer.modes.default.label',
    descKey: 'chat.composer.modes.default.desc'
  },
  accept_edits: {
    mode: 'accept_edits',
    labelKey: 'chat.composer.modes.accept_edits.label',
    descKey: 'chat.composer.modes.accept_edits.desc'
  },
  plan: {
    mode: 'plan',
    labelKey: 'chat.composer.modes.plan.label',
    descKey: 'chat.composer.modes.plan.desc'
  },
  bypass: {
    mode: 'bypass',
    labelKey: 'chat.composer.modes.bypass.label',
    risky: true
  },
  dont_ask: {
    mode: 'dont_ask',
    labelKey: 'chat.composer.modes.dont_ask.label',
    descKey: 'chat.composer.modes.dont_ask.desc',
    risky: true
  }
}

export const MODE_OPTIONS: ModeOption[] = Object.values(optionByMode)

// 모드의 설명/위험 표시는 공통 카탈로그, 종류별 문구와 순서는 명시적인 정의다.
const agentModeOptions = {
  work: {
    ...optionByMode,
    default: { ...optionByMode.default, labelKey: 'chat.composer.modes.workManualLabel' },
    auto_classified: {
      ...optionByMode.auto_classified,
      labelKey: 'chat.composer.modes.workAutoLabel'
    },
    bypass: { ...optionByMode.bypass, labelKey: 'chat.composer.modes.skipAllLabel' }
  },
  code: optionByMode
} satisfies Record<AgentKind, Record<NormalizedPermissionMode, ModeOption>>

const agentMenuOptions = {
  work: agentPermissionPolicy.work.menuModes.map((mode) => agentModeOptions.work[mode]),
  code: agentPermissionPolicy.code.menuModes.map((mode) => agentModeOptions.code[mode])
} satisfies Record<AgentKind, ModeOption[]>

export function modeMenuOptions(
  model: { alias: string; model: string | null; isCustom?: boolean } | null,
  kind: AgentKind
): ModeOption[] {
  const options = agentMenuOptions[kind]
  return options.filter((option) =>
    option.mode === 'auto_classified' && (model?.isCustom || model?.alias === 'custom')
      ? false
      : coercePermissionMode(option.mode, model, kind) === option.mode
  )
}

export function permissionModeLabelKey(
  mode: NormalizedPermissionMode,
  kind: AgentKind
): MessageKey {
  return agentModeOptions[kind][mode].labelKey
}

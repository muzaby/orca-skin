import type { EffortLevel } from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'

// 라벨/설명은 카탈로그 키만 두고 렌더에서 tr() 해석한다(0096 stale-방지 패턴, 0097).
export const EFFORT_LABEL_KEYS: Record<EffortLevel, MessageKey> = {
  low: 'chat.composer.effort.low.label',
  medium: 'chat.composer.effort.medium.label',
  high: 'chat.composer.effort.high.label',
  xhigh: 'chat.composer.effort.xhigh.label',
  max: 'chat.composer.effort.max.label'
}

export const EFFORT_DESC_KEYS: Record<EffortLevel, MessageKey> = {
  low: 'chat.composer.effort.low.desc',
  medium: 'chat.composer.effort.medium.desc',
  high: 'chat.composer.effort.high.desc',
  xhigh: 'chat.composer.effort.xhigh.desc',
  max: 'chat.composer.effort.max.desc'
}

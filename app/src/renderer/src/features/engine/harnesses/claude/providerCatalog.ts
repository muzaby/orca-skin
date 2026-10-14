// 엔진 추가 모달(단일 화면)이 쓰는 카탈로그 + settings.json 실시간 검증 (순수 모듈).
// Claude 공급자 선택지/템플릿을 한 곳에 모은다. provider env 템플릿은 TRD §6.8 레시피 표와 정합.
// 검증 규칙은 backend features/harnesses/settings-write.ts (PROVIDER_NAME_RE · readSettingsObject) 와
// 같은 제약을 renderer 에서 미리 비춘다.
//
// 라벨/에러는 카탈로그 **키**만 반환하고 렌더(EngineFormModal 등)가 tr() 해석한다(0097 D6)
// — 언어 전환 시 표시 중인 검증 메시지도 함께 갱신된다.

import type { MessageKey } from '../../../../shared/i18n'
import { withClaudeSettingsDefaults } from '../../../../../../shared/harnesses/claude/settings-defaults'

export interface ProviderOption {
  id: string
  labelKey: MessageKey
  descKey: MessageKey
  custom: boolean
  template: string
}

function tpl(value: Record<string, unknown>): string {
  return JSON.stringify(withClaudeSettingsDefaults(value), null, 2)
}

// 공급자(provider) 드롭다운 선택지. 각 항목은 선택 시 채워질 settings.json 템플릿을 갖는다.
export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'anthropic',
    labelKey: 'engine.provider.anthropic.label',
    descKey: 'engine.provider.anthropic.desc',
    custom: false,
    template: tpl({ env: {} })
  },
  {
    id: 'bedrock',
    labelKey: 'engine.provider.bedrock.label',
    descKey: 'engine.provider.bedrock.desc',
    custom: false,
    template: tpl({ env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-west-2' } })
  },
  {
    id: 'vertex',
    labelKey: 'engine.provider.vertex.label',
    descKey: 'engine.provider.vertex.desc',
    custom: false,
    template: tpl({ env: { CLAUDE_CODE_USE_VERTEX: '1', CLOUD_ML_REGION: 'us-east5' } })
  },
  {
    id: 'custom',
    labelKey: 'engine.provider.custom.label',
    descKey: 'engine.provider.custom.desc',
    custom: true,
    template: tpl({
      env: { ANTHROPIC_BASE_URL: 'https://gw.example.com', ANTHROPIC_AUTH_TOKEN: '${GW_TOKEN}' }
    })
  }
]

// add 모드 초기 선택 — 가장 흔한 케이스(anthropic)로 모달 오픈 즉시 유효한 폼을 만든다.
export const DEFAULT_PROVIDER_ID = 'anthropic'

export function providerOption(id: string): ProviderOption | undefined {
  return PROVIDER_OPTIONS.find((p) => p.id === id)
}

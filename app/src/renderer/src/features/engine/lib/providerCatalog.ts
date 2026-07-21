// 엔진 추가 모달(단일 화면)이 쓰는 카탈로그 + settings.json 실시간 검증 (순수 모듈).
// adapter 는 claude 고정(handoff 0090 — 엔진 선택 단계 제거)이며, 공급자 드롭다운의
// 선택지/템플릿을 한 곳에 모은다. provider env 템플릿은 TRD §6.8 레시피 표와 정합.
// 검증 규칙은 backend engine-write.ts (PROVIDER_NAME_RE · readSettingsObject) 와
// 같은 제약을 renderer 에서 미리 비춘다.
//
// 라벨/에러는 카탈로그 **키**만 반환하고 렌더(EngineFormModal 등)가 tr() 해석한다(0097 D6)
// — 언어 전환 시 표시 중인 검증 메시지도 함께 갱신된다.

import type { MessageKey } from '../../../shared/i18n'

export interface ProviderOption {
  id: string
  labelKey: MessageKey
  descKey: MessageKey
  custom: boolean
  template: string
}

function tpl(value: unknown): string {
  return JSON.stringify(value, null, 2)
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

// provider 이름 제약 — backend(normalizeProvider)와 동일. 빈 값/형식 위반을 미리 막는다.
const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

export type ProviderNameValidation = { ok: true } | { ok: false; errorKey: MessageKey }

export function validateProviderName(name: string): ProviderNameValidation {
  const trimmed = name.trim()
  if (trimmed === '') return { ok: false, errorKey: 'engine.validation.nameRequired' }
  if (!PROVIDER_NAME_RE.test(trimmed)) {
    return { ok: false, errorKey: 'engine.validation.nameFormat' }
  }
  return { ok: true }
}

export type JsonValidation =
  { ok: true } | { ok: false; errorKey: MessageKey; params?: Record<string, unknown> }

// JSON.parse 의 "at position N" 을 사람이 읽을 줄·열로 환산 (toss 식 친절한 안내).
function locateError(text: string, raw: string): { line: number; col: number } | null {
  const match = /position (\d+)/.exec(raw)
  if (!match) return null
  const pos = Number(match[1])
  let line = 1
  let col = 1
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1
      col = 1
    } else {
      col += 1
    }
  }
  return { line, col }
}

// settings.json 실시간 검증 — 빈 값/파싱 실패/비객체 최상위를 구분해 친절히 안내한다.
export function validateSettingsJson(text: string): JsonValidation {
  if (text.trim() === '') return { ok: false, errorKey: 'engine.validation.jsonRequired' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const raw = e instanceof Error ? e.message : null
    const at = raw ? locateError(text, raw) : null
    if (at) return { ok: false, errorKey: 'engine.validation.jsonSyntaxAt', params: at }
    // position 미검출 시 JSON.parse 원문(reason)을 그대로 통과, 원문조차 없으면 별도 키.
    if (raw) return { ok: false, errorKey: 'engine.validation.jsonSyntax', params: { reason: raw } }
    return { ok: false, errorKey: 'engine.validation.jsonSyntaxUnknown' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errorKey: 'engine.validation.topLevelObject' }
  }
  return { ok: true }
}

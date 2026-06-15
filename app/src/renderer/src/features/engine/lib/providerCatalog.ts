// 엔진 추가 마법사가 쓰는 카탈로그 + settings.json 실시간 검증 (순수 모듈).
// engine(adapter) → provider → settings 3단계의 선택지/템플릿을 한 곳에 모은다.
// provider env 템플릿은 TRD §6.8 레시피 표와 정합. 검증 규칙은 backend engine-write.ts
// (PROVIDER_NAME_RE · readSettingsObject) 와 같은 제약을 renderer 에서 미리 비춘다.

export interface EngineOption {
  id: string
  label: string
  desc: string
  enabled: boolean
}

// 1단계 — 엔진(adapter). claude-code 만 활성, opencode 는 빗금 목업.
export const ENGINE_OPTIONS: EngineOption[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    desc: 'Anthropic 공식 CLI · Agent SDK',
    enabled: true
  },
  { id: 'opencode', label: 'OpenCode', desc: 'sst.dev · 다중 모델 (준비 중)', enabled: false }
]

export interface ProviderOption {
  id: string
  label: string
  desc: string
  custom: boolean
  template: string
}

function tpl(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

// 2단계 — 공급자(provider). 각 항목은 3단계에서 채워질 settings.json 템플릿을 갖는다.
export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    desc: 'api.anthropic.com · OAuth 또는 API 키',
    custom: false,
    template: tpl({ env: {} })
  },
  {
    id: 'bedrock',
    label: 'Amazon Bedrock',
    desc: 'AWS 자격증명으로 Claude 호출',
    custom: false,
    template: tpl({ env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-west-2' } })
  },
  {
    id: 'vertex',
    label: 'Google Vertex AI',
    desc: 'GCP 프로젝트로 Claude 호출',
    custom: false,
    template: tpl({ env: { CLAUDE_CODE_USE_VERTEX: '1', CLOUD_ML_REGION: 'us-east5' } })
  },
  {
    id: 'custom',
    label: '직접 입력',
    desc: '게이트웨이 등 사용자 정의 provider',
    custom: true,
    template: tpl({
      env: { ANTHROPIC_BASE_URL: 'https://gw.example.com', ANTHROPIC_AUTH_TOKEN: '${GW_TOKEN}' }
    })
  }
]

export function providerOption(id: string): ProviderOption | undefined {
  return PROVIDER_OPTIONS.find((p) => p.id === id)
}

// provider 이름 제약 — backend(normalizeProvider)와 동일. 빈 값/형식 위반을 미리 막는다.
const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

export interface ProviderNameValidation {
  ok: boolean
  error?: string
}

export function validateProviderName(name: string): ProviderNameValidation {
  const trimmed = name.trim()
  if (trimmed === '') return { ok: false, error: 'provider 이름을 입력하세요.' }
  if (!PROVIDER_NAME_RE.test(trimmed)) {
    return { ok: false, error: '영문 · 숫자 · _ · - 만 사용할 수 있습니다.' }
  }
  return { ok: true }
}

export interface JsonValidation {
  ok: boolean
  error?: string
}

// JSON.parse 의 "at position N" 을 사람이 읽을 줄·열로 환산 (toss 식 친절한 안내).
function locateError(text: string, raw: string): string {
  const match = /position (\d+)/.exec(raw)
  if (!match) return raw
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
  return `${line}번째 줄, ${col}번째 글자 부근에서 형식이 어긋났어요.`
}

// settings.json 실시간 검증 — 빈 값/파싱 실패/비객체 최상위를 구분해 친절히 안내한다.
export function validateSettingsJson(text: string): JsonValidation {
  if (text.trim() === '') return { ok: false, error: 'settings.json 내용을 입력하세요.' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const raw = e instanceof Error ? e.message : '알 수 없는 오류'
    return { ok: false, error: `JSON 형식이 올바르지 않아요 — ${locateError(text, raw)}` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: '최상위는 객체 { … } 형태여야 해요.' }
  }
  return { ok: true }
}

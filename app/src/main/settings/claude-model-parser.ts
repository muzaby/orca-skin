// Claude settings.json → 모델 선택지 파서 (meta.json 제거, handoff: settings-json-model-parser).
// settings.json 단독에서 모델 선택 UI 용 리스트를 추출한다. Claude Code 런타임의 전체 모델
// resolve 우선순위를 재현하지 않는다 — OS env·CLI --model·런타임 /model 은 범위 밖.
//
// 스펙 §0~§8 을 따르되, "항상 3개 alias" 는 프로젝트 결정으로 재정의했다(아래 2단계 필터링):
//   커스텀(ANTHROPIC_DEFAULT_*_MODEL)이 하나라도 있으면 그 커스텀만 노출, 전무할 때만 3개 alias.
// 명시 모델(ANTHROPIC_MODEL/model)은 필터링이 아니라 default 선정에만 쓴다.
//
// 순수 함수 — fs 비의존, vitest 대상.

export const MODEL_ALIASES = ['sonnet', 'opus', 'haiku'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]

// 필터링 폴백/노출 순서. UI 표시 순서이자 default 폴백 순서(sonnet→haiku→opus 는 §4 규칙,
// 단 노출 배열은 sonnet/opus/haiku — 폴백 평가는 별도 ORDER 로).
const DISPLAY_ORDER: readonly ModelAlias[] = ['sonnet', 'opus', 'haiku']
const FALLBACK_ORDER: readonly ModelAlias[] = ['sonnet', 'haiku', 'opus']

const ALIAS_ENV_KEY: Record<ModelAlias, string> = {
  sonnet: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
  opus: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
  haiku: 'ANTHROPIC_DEFAULT_HAIKU_MODEL'
}

// 모델 선택 UI 1행. meta.json 의 구 OrcaModelConfig({name,family,default}) 를 대체한다.
export interface ParsedModel {
  alias: ModelAlias
  model: string | null // env 에 구성된 model명. 미구성 시 null (추측 금지).
  isCustom: boolean // ANTHROPIC_DEFAULT_<ALIAS>_MODEL 키 존재 여부.
  oneMillionContext: boolean // model/명시값에 [1m] 접미사가 있었으면 true.
  isDefault: boolean // 노출 목록 전체에서 정확히 1개.
}

interface AliasCandidate extends ParsedModel {}

// [1m] 접미사 분리 — trim 후 정확한 브래킷 토큰만. 구 includes('1m') 부분문자열 매칭 금지.
function stripOneMillion(raw: string): { value: string; oneMillion: boolean } {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().endsWith('[1m]')) {
    return { value: trimmed.slice(0, -'[1m]'.length).trim(), oneMillion: true }
  }
  return { value: trimmed, oneMillion: false }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

// 비어있지 않은 문자열만 모델값으로 인정.
function modelValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function parseClaudeModels(settings: { model?: unknown; env?: unknown }): ParsedModel[] {
  const env = asRecord(settings.env)

  // 1단계 — alias 별 후보 빌드.
  const candidates: AliasCandidate[] = DISPLAY_ORDER.map((alias) => {
    const raw = modelValue(env[ALIAS_ENV_KEY[alias]])
    if (raw === undefined) {
      return { alias, model: null, isCustom: false, oneMillionContext: false, isDefault: false }
    }
    const { value, oneMillion } = stripOneMillion(raw)
    return { alias, model: value, isCustom: true, oneMillionContext: oneMillion, isDefault: false }
  })

  // 2단계 — 노출 집합. 커스텀이 있으면 그것만, 없으면 3개 alias 전부.
  const customs = candidates.filter((c) => c.isCustom)
  const visible = customs.length > 0 ? customs : candidates

  // 3단계 — 노출 목록 내 default 정확히 1개.
  const rawExplicit = modelValue(env.ANTHROPIC_MODEL) ?? modelValue(settings.model)
  const explicit = rawExplicit ? stripOneMillion(rawExplicit).value : undefined

  const byAlias = new Map(visible.map((m) => [m.alias, m]))
  const chooseDefault = (): ParsedModel => {
    // 규칙 1 — 명시 모델이 노출 항목의 alias 또는 model 과 일치.
    if (explicit) {
      const hit = visible.find(
        (m) => m.alias === explicit || (m.model !== null && m.model === explicit)
      )
      if (hit) return hit
    }
    // 규칙 2 — 노출 항목 중 sonnet→haiku→opus 순 첫 항목.
    for (const alias of FALLBACK_ORDER) {
      const hit = byAlias.get(alias)
      if (hit) return hit
    }
    // 규칙 3 — 폴백(노출 집합은 항상 non-empty).
    return visible[0]
  }
  chooseDefault().isDefault = true

  return visible
}

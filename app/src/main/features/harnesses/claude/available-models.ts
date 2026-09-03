import { isRecord } from '../../../../shared/obj'
import { modelIdentity, sameModelIdentity } from '../../../../shared/model-identity'
import type { ParsedModel } from './model-parser'

// Claude 모델 family — 노출 순서이자 discovery 분류 순서. 폴백 평가 순서는 아래 별도 상수다.
export const FAMILY_ORDER = ['sonnet', 'opus', 'haiku'] as const
const DEFAULT_FAMILY_ORDER = ['sonnet', 'haiku', 'opus'] as const

// 명시 모델(`env.ANTHROPIC_MODEL` 등)의 정규화 형태. `[1m]` 을 분리해 **두 축**으로 들고 다닌다
// — 이름만 비교하면 `X` 와 `X[1m]` 이 같은 것이 되어 사용자가 지정한 1M 이 조용히 사라진다.
export interface ExplicitModel {
  value: string
  oneMillion: boolean
}

export function availableModelsOf(value: unknown): string[] | undefined {
  if (!isRecord(value)) return undefined
  const candidate = value.availableModels
  if (candidate === undefined) return undefined
  if (!Array.isArray(candidate) || candidate.some((model) => typeof model !== 'string'))
    return undefined
  return candidate
}

// 명시 모델 문자열 → 정규화. 비문자열·빈 값은 `undefined`(= 명시 없음).
export function explicitModelOf(raw: unknown): ExplicitModel | undefined {
  if (typeof raw !== 'string') return undefined
  const { value, oneMillion } = stripOneMillion(raw)
  return value === '' ? undefined : { value, oneMillion }
}

// 모델명 → 노출 항목. family 이름이 부분문자열로 들어있으면 그 alias, 없으면 custom.
function classifyModel(model: string, oneMillion: boolean): ParsedModel {
  const lower = model.toLowerCase()
  const family = FAMILY_ORDER.find((candidate) => lower.includes(candidate))
  return {
    alias: family ?? 'custom',
    model,
    isCustom: family === undefined,
    oneMillionContext: oneMillion,
    isDefault: false
  }
}

// 명시 모델이 노출 목록의 어느 항목인가 — alias 또는 모델명이 일치하고 **1M 축까지 같을 때**만.
// default 부여와 `withExplicitModel` 의 중복 판정이 같은 술어를 쓴다(SSOT).
function matchesExplicit(model: ParsedModel, explicit: ExplicitModel): boolean {
  if (model.oneMillionContext !== explicit.oneMillion) return false
  return model.alias === explicit.value || model.model === explicit.value
}

// 노출 목록에 명시 모델(`ANTHROPIC_MODEL`)을 더한다 (0215 D-005). 이미 같은 항목이 있으면
// **추가하지 않는다** — 사용자 요구 "추가시 중복이 되면 1개만 유지".
export function withExplicitModel(
  models: ParsedModel[],
  explicit: ExplicitModel | undefined
): ParsedModel[] {
  if (!explicit) return models
  if (models.some((model) => matchesExplicit(model, explicit))) return models
  return [...models, classifyModel(explicit.value, explicit.oneMillion)]
}

export function normalizeAvailableModels(models: readonly string[]): ParsedModel[] {
  // dedupe 키는 **모델명이 아니라 identity** 다 (0215 D-008) — `X` 와 `X[1m]` 은 서로 다른
  // 실행 대상이라 base 이름으로 접으면 둘 중 하나가 목록에서 사라진다.
  const seen = new Set<string>()
  const normalized: ParsedModel[] = []
  for (const raw of models) {
    const { value: model, oneMillion } = stripOneMillion(raw)
    if (!model) continue
    const entry = classifyModel(model, oneMillion)
    const key = modelIdentity(entry)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(entry)
  }
  markDefaultModel(normalized)
  return normalized
}

// 두 항목이 같은 모델인가 — env family 와 discovery 를 병합할 때 쓴다(EP-05 두 번째 사이트).
export function sameParsedModel(a: ParsedModel, b: ParsedModel): boolean {
  return sameModelIdentity(a, b)
}

export function markDefaultModel(models: ParsedModel[], explicit?: ExplicitModel): void {
  for (const model of models) model.isDefault = false
  const selected =
    (explicit ? models.find((model) => matchesExplicit(model, explicit)) : undefined) ??
    DEFAULT_FAMILY_ORDER.map((family) => models.find((model) => model.alias === family)).find(
      (model) => model !== undefined
    ) ??
    models[0]
  if (selected) selected.isDefault = true
}

export function stripOneMillion(raw: string): { value: string; oneMillion: boolean } {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().endsWith('[1m]')) {
    return { value: trimmed.slice(0, -'[1m]'.length).trim(), oneMillion: true }
  }
  return { value: trimmed, oneMillion: false }
}

import { isRecord } from '../../../../shared/obj'
import type { ParsedModel } from './model-parser'

// Claude 모델 family — 노출 순서이자 discovery 분류 순서. 폴백 평가 순서는 아래 별도 상수다.
export const FAMILY_ORDER = ['sonnet', 'opus', 'haiku'] as const
const DEFAULT_FAMILY_ORDER = ['sonnet', 'haiku', 'opus'] as const

export function availableModelsOf(value: unknown): string[] | undefined {
  if (!isRecord(value)) return undefined
  const candidate = value.availableModels
  if (candidate === undefined) return undefined
  if (!Array.isArray(candidate) || candidate.some((model) => typeof model !== 'string'))
    return undefined
  return candidate
}

export function normalizeAvailableModels(models: readonly string[]): ParsedModel[] {
  const seenModels = new Set<string>()
  const normalized: ParsedModel[] = []
  for (const raw of models) {
    const { value: model, oneMillion } = stripOneMillion(raw)
    if (!model || seenModels.has(model)) continue
    seenModels.add(model)
    const lower = model.toLowerCase()
    const family = FAMILY_ORDER.find((candidate) => lower.includes(candidate))
    const alias = family ?? 'custom'
    normalized.push({
      alias,
      model,
      isCustom: family === undefined,
      oneMillionContext: oneMillion,
      isDefault: false
    })
  }
  markDefaultModel(normalized)
  return normalized
}

export function markDefaultModel(models: ParsedModel[], explicit?: string): void {
  for (const model of models) model.isDefault = false
  const selected =
    (explicit
      ? models.find((model) => model.alias === explicit || model.model === explicit)
      : undefined) ??
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

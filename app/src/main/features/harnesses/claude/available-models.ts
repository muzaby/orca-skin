import type { ParsedModel } from './model-parser'

const FAMILY_ORDER = ['sonnet', 'opus', 'haiku'] as const

export function availableModelsOf(value: unknown): string[] | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const candidate = (value as Record<string, unknown>).availableModels
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
      isDefault: normalized.length === 0
    })
  }
  return normalized
}

export function stripOneMillion(raw: string): { value: string; oneMillion: boolean } {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().endsWith('[1m]')) {
    return { value: trimmed.slice(0, -'[1m]'.length).trim(), oneMillion: true }
  }
  return { value: trimmed, oneMillion: false }
}

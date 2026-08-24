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
  const seenAliases = new Set<string>()
  const normalized: ParsedModel[] = []
  for (const raw of models) {
    const model = raw.trim()
    if (!model || seenModels.has(model)) continue
    seenModels.add(model)
    const lower = model.toLowerCase()
    const family = FAMILY_ORDER.find((candidate) => lower.includes(candidate))
    const alias = family ?? model
    if (seenAliases.has(alias)) continue
    seenAliases.add(alias)
    normalized.push({
      alias,
      model,
      isCustom: family === undefined,
      oneMillionContext: false,
      isDefault: normalized.length === 0
    })
  }
  return normalized
}

import type { ParsedModel } from '../common/model-types'
import { modelForPreferredAlias, providerByPreference } from '../common/models'

export function resolveTitleModel(models: ParsedModel[]): string | undefined {
  return modelForPreferredAlias(models, 'haiku')
}

export function defaultProvider<T extends { modelProviderId: string }>(
  entries: readonly T[]
): T | undefined {
  return providerByPreference(entries, 'anthropic')
}

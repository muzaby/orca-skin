import type { MessageKey } from '../../../../../shared/i18n'
import type { ProviderDraft } from '../providerForm.types'

const npm = '@ai-sdk/openai-compatible'
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export function emptyProviderDraft(): ProviderDraft {
  return {
    id: '',
    name: '',
    baseURL: '',
    apiKey: '',
    models: [{ row: 'model-0', id: '', name: '' }],
    headers: [{ row: 'header-0', key: '', value: '' }]
  }
}

/** Only the 1.x codec interprets native provider/options/models shapes. */
export function importedProviders(json: string): ProviderDraft[] {
  const source = record(JSON.parse(json))
  return Object.entries(record(source.provider))
    .filter(([, value]) => record(value).npm === npm)
    .map(([id, value]) => {
      const provider = record(value),
        options = record(provider.options)
      const models = Object.entries(record(provider.models)).map(([model, definition], index) => ({
        row: `model-${index}`,
        id: model,
        name: text(record(definition).name) || model,
        originalId: model
      }))
      const headers = Object.entries(record(options.headers)).map(([key, value], index) => ({
        row: `header-${index}`,
        key,
        value: text(value)
      }))
      return {
        ...emptyProviderDraft(),
        id,
        originalId: id,
        name: text(provider.name) || id,
        baseURL: text(options.baseURL),
        apiKey: text(options.apiKey),
        source,
        ...(models.length ? { models } : {}),
        ...(headers.length ? { headers } : {})
      }
    })
}

export function validateProviderDraft(draft: ProviderDraft): Record<string, MessageKey> {
  const errors: Record<string, MessageKey> = {}
  const required: MessageKey = 'engine.openCode.required'
  const duplicate: MessageKey = 'engine.openCode.duplicate'
  const id = draft.id.trim()
  if (!id) errors.id = required
  else if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) errors.id = 'engine.openCode.idFormat'
  else if (id !== draft.originalId && Object.hasOwn(record(draft.source?.provider), id))
    errors.id = duplicate
  if (!draft.name.trim()) errors.name = required
  if (!draft.baseURL.trim()) errors.baseURL = required
  else {
    try {
      const url = new URL(draft.baseURL.trim())
      if (!['http:', 'https:'].includes(url.protocol)) errors.baseURL = 'engine.openCode.urlFormat'
    } catch {
      errors.baseURL = 'engine.openCode.urlFormat'
    }
  }
  const models = new Set<string>(),
    headers = new Set<string>()
  if (!draft.models.length) errors.models = required
  draft.models.forEach((row) => {
    const id = row.id.trim()
    if (!id) errors[`${row.row}.id`] = required
    else if (models.has(id)) errors[`${row.row}.id`] = duplicate
    models.add(id)
    if (!row.name.trim()) errors[`${row.row}.name`] = required
  })
  draft.headers.forEach((row) => {
    const key = row.key.trim(),
      value = row.value.trim()
    if (!key && !value) return
    if (!key) errors[`${row.row}.key`] = required
    else if (headers.has(key.toLowerCase())) errors[`${row.row}.key`] = duplicate
    headers.add(key.toLowerCase())
    if (!value) errors[`${row.row}.value`] = required
  })
  return errors
}

export function serializeProviderDraft(draft: ProviderDraft): string {
  if (Object.keys(validateProviderDraft(draft)).length) throw new Error('Invalid provider draft')
  const source = draft.source ?? {},
    id = draft.id.trim()
  const providers = { ...record(source.provider) }
  const original = record(providers[draft.originalId ?? id])
  const options = { ...record(original.options) }
  options.baseURL = draft.baseURL.trim()
  if (draft.apiKey.trim()) options.apiKey = draft.apiKey.trim()
  else delete options.apiKey
  const headers = Object.fromEntries(
    draft.headers.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value.trim()])
  )
  if (Object.keys(headers).length) options.headers = headers
  else delete options.headers
  const oldModels = record(original.models)
  const models = Object.fromEntries(
    draft.models.map((row) => [
      row.id.trim(),
      {
        ...record(oldModels[row.originalId ?? row.id.trim()]),
        name: row.name.trim()
      }
    ])
  )
  if (draft.originalId) delete providers[draft.originalId]
  providers[id] = { ...original, npm, name: draft.name.trim(), options, models }
  const result: Record<string, unknown> = { ...source, provider: providers }
  // Keep native default references valid when an imported provider/model is renamed or removed.
  for (const field of ['model', 'small_model']) {
    const current = text(result[field])
    const prefix = `${draft.originalId ?? id}/`
    if (!current.startsWith(prefix)) continue
    const previous = current.slice(prefix.length)
    const selected = draft.models.find((row) => (row.originalId ?? row.id.trim()) === previous)
    result[field] = `${id}/${(selected ?? draft.models[0]).id.trim()}`
  }
  for (const field of ['enabled_providers', 'disabled_providers']) {
    if (Array.isArray(result[field]) && draft.originalId)
      result[field] = result[field].map((value) => (value === draft.originalId ? id : value))
  }
  return JSON.stringify(result, null, 2)
}

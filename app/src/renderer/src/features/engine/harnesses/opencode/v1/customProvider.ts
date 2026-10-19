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
        name: text(record(definition).name) || model
      }))
      const headers = Object.entries(record(options.headers)).map(([key, value], index) => ({
        row: `header-${index}`,
        key,
        value: text(value)
      }))
      return {
        ...emptyProviderDraft(),
        id,
        name: text(provider.name) || id,
        baseURL: text(options.baseURL),
        apiKey: text(options.apiKey),
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
  const id = draft.id.trim()
  const headers = Object.fromEntries(
    draft.headers.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value.trim()])
  )
  const models = Object.fromEntries(
    draft.models.map((row) => [row.id.trim(), { name: row.name.trim() }])
  )
  // Import is only a field source. This engine owns a new, complete native document.
  const result = {
    $schema: 'https://opencode.ai/config.json',
    enabled_providers: [id],
    provider: {
      [id]: {
        npm,
        name: draft.name.trim(),
        options: {
          baseURL: draft.baseURL.trim(),
          ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
          ...(Object.keys(headers).length ? { headers } : {})
        },
        whitelist: Object.keys(models),
        models
      }
    }
  }
  return JSON.stringify(result, null, 2)
}

import { describe, expect, it } from 'vitest'
import type { ProviderDraft } from '../providerForm.types'
import {
  emptyProviderDraft,
  importedProviders,
  serializeProviderDraft,
  validateProviderDraft
} from './customProvider'

const valid = (): ProviderDraft => ({
  ...emptyProviderDraft(),
  id: 'local',
  name: 'Local',
  baseURL: 'http://localhost:1234/v1',
  models: [{ row: 'm', id: 'model', name: 'Model' }]
})

describe('OpenCode custom provider config', () => {
  it('builds a native provider with optional key/headers and multiple models', () => {
    const draft = valid()
    expect(validateProviderDraft(draft)).toEqual({})
    const config = JSON.parse(serializeProviderDraft(draft))
    expect(config.provider.local).toEqual({
      npm: '@ai-sdk/openai-compatible',
      name: 'Local',
      options: { baseURL: 'http://localhost:1234/v1' },
      whitelist: ['model'],
      models: { model: { name: 'Model' } }
    })
    draft.apiKey = '{env:LOCAL_KEY}'
    draft.headers = [{ row: 'h', key: 'X-Tenant', value: 'tenant' }]
    draft.models.push({ row: 'm2', id: 'model2', name: 'Second' })
    expect(JSON.parse(serializeProviderDraft(draft)).provider.local.options).toEqual({
      baseURL: draft.baseURL,
      apiKey: '{env:LOCAL_KEY}',
      headers: { 'X-Tenant': 'tenant' }
    })
  })
  it('rejects empty/invalid identifiers and URLs, duplicate models and case-insensitive headers', () => {
    expect(Object.keys(validateProviderDraft(emptyProviderDraft()))).toEqual([
      'id',
      'name',
      'baseURL',
      'model-0.id',
      'model-0.name'
    ])
    for (const id of ['UPPER', '_first', 'with space'])
      expect(validateProviderDraft({ ...valid(), id }).id).toBeDefined()
    for (const baseURL of ['file:///tmp', 'https://'])
      expect(validateProviderDraft({ ...valid(), baseURL }).baseURL).toBeDefined()
    const draft = valid()
    draft.models.push({ row: 'm2', id: ' model ', name: '' })
    draft.headers = [
      { row: 'h', key: 'Authorization', value: 'value' },
      { row: 'h2', key: 'authorization', value: '' }
    ]
    expect(validateProviderDraft(draft)).toMatchObject({
      'm2.id': 'engine.openCode.duplicate',
      'm2.name': 'engine.openCode.required',
      'h2.key': 'engine.openCode.duplicate',
      'h2.value': 'engine.openCode.required'
    })
    expect(() => serializeProviderDraft(draft)).toThrow('Invalid provider draft')
  })
  it('imports only visible fields and serializes a fresh document owned by the selected provider', () => {
    const original = {
      model: 'local/a',
      small_model: 'local/b',
      enabled_providers: ['local', 'other'],
      instructions: ['keep.md'],
      provider: {
        local: {
          npm: '@ai-sdk/openai-compatible',
          name: 'Local',
          options: { baseURL: 'https://example.test/v1', timeout: 1200, apiKey: 'fixture' },
          models: { a: { name: 'A', limit: { context: 5000 } }, b: { name: 'B' } }
        },
        other: { npm: '@ai-sdk/anthropic', options: { keep: true } }
      }
    }
    const before = JSON.stringify(original)
    const drafts = importedProviders(before)
    expect(drafts).toHaveLength(1)
    const draft = drafts[0]
    draft.id = 'renamed'
    draft.models = [{ ...draft.models[0], id: 'new-a' }]
    draft.apiKey = ''
    const result = JSON.parse(serializeProviderDraft(draft))
    expect(result).toEqual({
      $schema: 'https://opencode.ai/config.json',
      enabled_providers: ['renamed'],
      provider: {
        renamed: {
          npm: '@ai-sdk/openai-compatible',
          name: 'Local',
          options: { baseURL: 'https://example.test/v1' },
          whitelist: ['new-a'],
          models: { 'new-a': { name: 'A' } }
        }
      }
    })
    expect(result.provider.local).toBeUndefined()
    expect(result.provider.renamed.options.apiKey).toBeUndefined()
    expect(JSON.stringify(original)).toBe(before)
    draft.id = 'other'
    expect(validateProviderDraft(draft)).toEqual({})
  })
})

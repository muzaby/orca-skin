import { describe, expect, it } from 'vitest'
import { availableModelsOf, normalizeAvailableModels } from './available-models'

describe('availableModels exact contract', () => {
  it('accepts only the exact camelCase string array field', () => {
    expect(availableModelsOf({ availableModels: [' a '] })).toEqual([' a '])
    expect(availableModelsOf({ AvailableModels: ['a'] })).toBeUndefined()
    expect(availableModelsOf({ availableModels: 'a' })).toBeUndefined()
    expect(availableModelsOf({ availableModels: ['a', 1] })).toBeUndefined()
  })

  it('classifies families and preserves a custom name as its self alias/model', () => {
    expect(
      normalizeAvailableModels(['Claude-SONNET-4', 'x-opus-y', 'haiku-next', 'corp/model-v1'])
    ).toEqual([
      expect.objectContaining({ alias: 'sonnet', model: 'Claude-SONNET-4', isDefault: true }),
      expect.objectContaining({ alias: 'opus', model: 'x-opus-y', isDefault: false }),
      expect.objectContaining({ alias: 'haiku', model: 'haiku-next', isDefault: false }),
      expect.objectContaining({ alias: 'custom', model: 'corp/model-v1', isCustom: true })
    ])
  })

  it('trims empties, keeps every distinct family model, and deduplicates exact names', () => {
    expect(
      normalizeAvailableModels([' ', 'sonnet-a', 'sonnet-b', 'private-v1', 'private-v1'])
    ).toEqual([
      expect.objectContaining({ alias: 'sonnet', model: 'sonnet-a' }),
      expect.objectContaining({ alias: 'sonnet', model: 'sonnet-b' }),
      expect.objectContaining({ alias: 'custom', model: 'private-v1' })
    ])
  })

  it('normalizes the [1m] suffix consistently with env-configured models', () => {
    expect(normalizeAvailableModels(['claude-sonnet-4-6[1m]'])).toEqual([
      expect.objectContaining({
        alias: 'sonnet',
        model: 'claude-sonnet-4-6',
        oneMillionContext: true
      })
    ])
  })
})

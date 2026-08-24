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
      expect.objectContaining({ alias: 'corp/model-v1', model: 'corp/model-v1', isCustom: true })
    ])
  })

  it('trims empties and deterministically keeps the first model per family', () => {
    expect(normalizeAvailableModels([' ', 'sonnet-a', 'sonnet-b', 'custom', 'custom'])).toEqual([
      expect.objectContaining({ alias: 'sonnet', model: 'sonnet-a' }),
      expect.objectContaining({ alias: 'custom', model: 'custom' })
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { listedModelsOf, runtimeModelsFromListing } from './runtime-listing'

describe('runtime listing helpers (0291 MD-08)', () => {
  it('listedModelsOf copies a well-formed listing', () => {
    const input = [{ id: 'corp/a', name: 'A', variants: ['high'] }, { id: 'corp/b' }]
    const listed = listedModelsOf(input)
    expect(listed).toEqual(input)
    expect(listed).not.toBe(input)
  })

  it('listedModelsOf rejects anything else', () => {
    for (const bad of [
      undefined,
      null,
      'corp/a',
      { id: 'corp/a' },
      [{ id: '' }],
      [{ id: 'corp/a', name: 1 }],
      [{ id: 'corp/a', variants: 'high' }],
      [{ id: 'corp/a', variants: [1] }],
      [{ name: 'x' }]
    ]) {
      expect(listedModelsOf(bad)).toBeUndefined()
    }
  })

  it('runtimeModelsFromListing builds availableModels and modelDetails', () => {
    expect(
      runtimeModelsFromListing([
        { id: 'corp/a', name: 'A', variants: ['high'] },
        { id: 'corp/b' },
        { id: 'corp/a', name: 'dup' }
      ])
    ).toEqual({
      availableModels: ['corp/a', 'corp/b'],
      modelDetails: { 'corp/a': { name: 'A', variants: ['high'] }, 'corp/b': {} }
    })
  })
})

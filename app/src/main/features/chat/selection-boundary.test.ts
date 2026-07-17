import { describe, expect, it } from 'vitest'
import { canSteerAcrossSelection } from './selection-boundary'

const current = { providerKey: 'claude', model: 'claude-opus-4-6', effort: 'high' }

describe('canSteerAcrossSelection', () => {
  it('allows only the same provider, canonical model and effort', () => {
    expect(canSteerAcrossSelection(current, { ...current })).toBe(true)
    expect(canSteerAcrossSelection(current, { ...current, providerKey: 'other' })).toBe(false)
    expect(canSteerAcrossSelection(current, { ...current, model: 'claude-sonnet-4-6' })).toBe(false)
    expect(canSteerAcrossSelection(current, { ...current, effort: 'medium' })).toBe(false)
  })
})

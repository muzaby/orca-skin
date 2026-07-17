import { describe, expect, it } from 'vitest'
import { canSteerAcrossSelection, matchesActualModel } from './selection-boundary'

const current = { providerKey: 'claude', model: 'claude-opus-4-6', effort: 'high' }

describe('canSteerAcrossSelection', () => {
  it('allows only the same provider, canonical model and effort', () => {
    expect(canSteerAcrossSelection(current, { ...current })).toBe(true)
    expect(canSteerAcrossSelection(current, { ...current, providerKey: 'other' })).toBe(false)
    expect(canSteerAcrossSelection(current, { ...current, model: 'claude-sonnet-4-6' })).toBe(false)
    expect(canSteerAcrossSelection(current, { ...current, effort: 'medium' })).toBe(false)
  })
})

describe('matchesActualModel', () => {
  it('정식 id 는 exact, bare alias 는 모델 id 토큰으로 비교한다', () => {
    expect(
      matchesActualModel({ model: 'claude-sonnet-4-6', modelFamily: 'sonnet' }, 'claude-sonnet-4-6')
    ).toBe(true)
    expect(
      matchesActualModel({ model: 'haiku', modelFamily: 'haiku' }, 'claude-haiku-4-5-20251001')
    ).toBe(true)
    expect(matchesActualModel({ model: 'haiku', modelFamily: 'haiku' }, 'claude-sonnet-4-6')).toBe(
      false
    )
    expect(
      matchesActualModel({ model: 'custom-haiku', modelFamily: 'haiku' }, 'claude-haiku-4-5')
    ).toBe(false)
  })
})

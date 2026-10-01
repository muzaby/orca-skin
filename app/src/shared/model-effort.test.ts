import { describe, expect, it } from 'vitest'
import { CLAUDE_MODEL_FAMILIES } from './model-identity'
import {
  CLAUDE_ALIAS_VERSION,
  CLAUDE_MODEL_DEFAULT_EFFORT,
  defaultEffortForModel
} from './model-effort'

describe('0246 AC4 — model default effort', () => {
  it.each([
    'claude-opus-5-5',
    'opus-5.5',
    'Opus 5.5',
    'us.anthropic.claude-opus-5-5-v1:0',
    'claude-opus-5-5[1m]',
    'claude-sonnet-5-5',
    'sonnet-5.5',
    'opus',
    'OPUS',
    'opus[1m]',
    'sonnet',
    ' sonnet[1m] '
  ])('%s defaults to medium', (model) => {
    expect(defaultEffortForModel(model)).toBe('medium')
  })

  it.each(['claude-opus-4-7', 'gw-opus-4.7'])('%s defaults to xhigh', (model) => {
    expect(defaultEffortForModel(model)).toBe('xhigh')
  })

  it.each([
    'claude-fable-5-1',
    'claude-fable-5',
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-opus-4-8',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'fable',
    'haiku',
    'claude-opus-4-1',
    'claude-haiku-4-5',
    'claude-mythos-5-1',
    'gw-opus',
    'gpt-oss-120b',
    'my-gateway-model',
    'myopus-5.5',
    null,
    undefined,
    ''
  ])('%s defaults to high', (model) => {
    expect(defaultEffortForModel(model)).toBe('high')
  })

  it('has no duplicate table rows and covers exactly the supported aliases', () => {
    const identities = CLAUDE_MODEL_DEFAULT_EFFORT.map(
      ({ family, major, minor }) => `${family}:${major}:${minor}`
    )
    expect(new Set(identities).size).toBe(identities.length)
    expect(Object.keys(CLAUDE_ALIAS_VERSION).sort()).toEqual([...CLAUDE_MODEL_FAMILIES].sort())
  })
})

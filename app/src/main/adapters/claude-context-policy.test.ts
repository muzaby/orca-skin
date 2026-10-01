import { describe, expect, it } from 'vitest'
import {
  classifyContextModel,
  envLookup,
  modelForCli,
  resolveCliModel
} from './claude-context-policy'

const gateway = { ANTHROPIC_BASE_URL: 'https://llm.example.test' }
const lookup = (env: Record<string, string> = {}): ReturnType<typeof envLookup> =>
  envLookup(env, undefined, {})

describe('0245 AC1 — CLI model classification', () => {
  it.each([
    ['claude-opus-4-7', 'claude', 1_000_000],
    ['us.anthropic.claude-opus-4-7-v1:0', 'claude', 1_000_000],
    ['gw-opus-4.7', 'claude', 1_000_000],
    ['opus_4-8', 'claude', 1_000_000],
    ['sonnet-5', 'claude', 1_000_000],
    ['claude-fable-5-1', 'claude', 1_000_000],
    ['mythos-5', 'claude', 1_000_000],
    ['claude-opus-4-6', 'claude', 200_000],
    ['claude-sonnet-4-5-20250929', 'claude', 200_000],
    ['claude-haiku-4-5', 'claude', 200_000],
    ['claude-3-5-sonnet', 'claude', 200_000],
    ['opus', 'claude', 200_000],
    ['claude-opus-4-20250514', 'claude', 200_000],
    ['claude-opus-4-6[1m]', 'claude', 1_000_000],
    ['my-vlm', 'custom', 200_000],
    ['my-vlm[1m]', 'custom', 1_000_000],
    [undefined, 'default', 200_000],
    ['GW-OPUS/4.7', 'claude', 1_000_000],
    ['myopus-4.7', 'custom', 200_000],
    ['opusology-4.7', 'custom', 200_000],
    ['gw-opus-5', 'claude', 1_000_000]
  ])('%s → %s/%i', (model, kind, contextWindow) => {
    expect(classifyContextModel(model as string | undefined)).toMatchObject({ kind, contextWindow })
  })

  it('parses old version order and excludes dates', () => {
    expect(classifyContextModel('claude-3-5-sonnet')).toMatchObject({ major: 3, minor: 5 })
    expect(classifyContextModel('claude-opus-4-20250514')).toMatchObject({ major: 4, minor: 0 })
  })
})

describe('0245 AC2 — execution model only', () => {
  it.each([
    ['gw-opus-4.7', gateway, 'gw-opus-4.7[1m]'],
    ['claude-opus-4-7', {}, 'claude-opus-4-7'],
    ['claude-opus-4-7', { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }, 'claude-opus-4-7'],
    ['claude-opus-4-6', gateway, 'claude-opus-4-6'],
    ['gw-opus-4.7[1m]', gateway, 'gw-opus-4.7[1m]'],
    ['my-vlm', gateway, 'my-vlm'],
    ['my-vlm[1m]', gateway, 'my-vlm[1m]'],
    ['gw-opus-4.7', { ...gateway, CLAUDE_CODE_DISABLE_1M_CONTEXT: '1' }, 'gw-opus-4.7'],
    ['gw-opus-4.7', { ...gateway, CLAUDE_CODE_DISABLE_1M_CONTEXT: 'false' }, 'gw-opus-4.7[1m]'],
    ['claude-opus-4-7', { CLAUDE_CODE_USE_BEDROCK: '1' }, 'claude-opus-4-7[1m]'],
    ['claude-sonnet-5', { CLAUDE_CODE_USE_BEDROCK: '1' }, 'claude-sonnet-5'],
    ['claude-sonnet-5', gateway, 'claude-sonnet-5[1m]']
  ])('%s with %j → %s', (model, env, expected) => {
    expect(modelForCli(model, lookup(env))).toBe(expected)
  })

  it.each(['VERTEX', 'FOUNDRY', 'MANTLE', 'ANTHROPIC_AWS', 'ANTHROPIC_GOOGLE_CLOUD'])(
    'recognizes the %s provider flag',
    (provider) => {
      expect(
        modelForCli('claude-opus-4-7', lookup({ [`CLAUDE_CODE_USE_${provider}`]: 'true' }))
      ).toBe('claude-opus-4-7[1m]')
    }
  )
})

describe('0245 AC20 — actual CLI model resolution', () => {
  it.each([
    [
      'opus',
      { ...gateway, ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7' },
      undefined,
      'gw-opus-4.7',
      'opus[1m]'
    ],
    [
      'sonnet',
      { ...gateway, ANTHROPIC_DEFAULT_SONNET_MODEL: 'internal-llm' },
      undefined,
      'internal-llm',
      'sonnet'
    ],
    [
      'opus',
      { ...gateway, ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7[1m]' },
      undefined,
      'gw-opus-4.7[1m]',
      'opus'
    ],
    [
      undefined,
      { ...gateway, ANTHROPIC_MODEL: 'gw-opus-4.7' },
      undefined,
      'gw-opus-4.7',
      'gw-opus-4.7[1m]'
    ],
    [undefined, gateway, 'gw-fable-5', 'gw-fable-5', 'gw-fable-5[1m]'],
    [
      undefined,
      { ...gateway, ANTHROPIC_MODEL: 'internal-llm' },
      undefined,
      'internal-llm',
      undefined
    ],
    [undefined, gateway, undefined, undefined, undefined],
    [
      'OPUS[1M]',
      { ...gateway, ANTHROPIC_DEFAULT_OPUS_MODEL: 'gw-opus-4.7' },
      undefined,
      'gw-opus-4.7',
      'OPUS[1M]'
    ],
    [
      undefined,
      { ...gateway, ANTHROPIC_MODEL: 'sonnet', ANTHROPIC_DEFAULT_SONNET_MODEL: 'gw-sonnet-5' },
      'haiku',
      'gw-sonnet-5',
      'gw-sonnet-5[1m]'
    ],
    [
      'fable',
      { ...gateway, ANTHROPIC_DEFAULT_FABLE_MODEL: 'gw-fable-5.1' },
      undefined,
      'gw-fable-5.1',
      'fable[1m]'
    ],
    [
      'haiku',
      { ...gateway, ANTHROPIC_DEFAULT_HAIKU_MODEL: 'internal-llm' },
      undefined,
      'internal-llm',
      'haiku'
    ],
    ['opus', gateway, 'gw-fable-5', 'opus', 'opus']
  ])('resolves %s with %j', (model, env, settingsModel, resolved, executionModel) => {
    expect(resolveCliModel(model, lookup(env), settingsModel)).toBe(resolved)
    expect(modelForCli(model, lookup(env), settingsModel)).toBe(executionModel)
  })

  it('reads prepared env exclusively; otherwise settings strings override process env without mutation', () => {
    const env = Object.freeze({ ANTHROPIC_MODEL: 'prepared' })
    const settings = Object.freeze({ env: { ANTHROPIC_MODEL: 'settings', OTHER: 12 } })
    const inherited = Object.freeze({ ANTHROPIC_MODEL: 'inherited', OTHER: 'fallback' })
    expect(envLookup(env, settings, inherited)('ANTHROPIC_MODEL')).toBe('prepared')
    expect(envLookup(env, settings, inherited)('OTHER')).toBeUndefined()
    expect(envLookup(undefined, settings, inherited)('ANTHROPIC_MODEL')).toBe('settings')
    expect(envLookup(undefined, settings, inherited)('OTHER')).toBe('fallback')
  })
})

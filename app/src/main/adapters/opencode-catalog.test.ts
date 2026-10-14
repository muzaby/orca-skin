import { describe, expect, it } from 'vitest'
import type { Agent, Provider } from '@opencode-ai/sdk/v2'
import { openCodeCatalog } from './opencode-catalog'

describe('OpenCode catalog', () => {
  it('keeps provider-qualified model IDs, names, defaults and enabled variants', () => {
    const providers = [
      {
        id: 'one',
        models: {
          shared: { id: 'shared', name: 'First', variants: { low: {}, hidden: { disabled: true } } }
        }
      },
      { id: 'two', models: { shared: { id: 'shared', name: 'Second', variants: {} } } }
    ] as unknown as Provider[]
    const agents = [
      { name: 'build', mode: 'primary', description: 'Build' },
      { name: 'plan', mode: 'all' },
      { name: 'hidden', mode: 'primary', hidden: true },
      { name: 'child', mode: 'subagent' }
    ] as Agent[]
    const catalog = openCodeCatalog(
      { adapter: 'opencode', key: 'opencode-local', supported: true, models: [] },
      providers,
      agents,
      { one: 'shared' }
    )
    expect(catalog.models).toEqual([
      {
        alias: 'First',
        model: 'one/shared',
        providerId: 'one',
        isCustom: true,
        oneMillionContext: false,
        isDefault: true,
        variants: ['low']
      },
      {
        alias: 'Second',
        model: 'two/shared',
        providerId: 'two',
        isCustom: true,
        oneMillionContext: false,
        isDefault: false,
        variants: []
      }
    ])
    expect(catalog.agents).toEqual([{ name: 'build', description: 'Build' }, { name: 'plan' }])
    expect(catalog.key).toBe('opencode-local')
  })
})

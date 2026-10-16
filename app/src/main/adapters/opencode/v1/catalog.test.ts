import { describe, expect, it, vi } from 'vitest'
import { openCodeCatalog } from './catalog'
import { OpenCodeAdapter } from './adapter'

describe('OpenCode catalog', () => {
  it('keeps provider-qualified model IDs, names, defaults and enabled variants', () => {
    const config = {
      model: 'one/shared',
      provider: {
        one: {
          models: {
            shared: {
              id: 'shared',
              name: 'First',
              variants: { low: {}, hidden: { disabled: true } }
            }
          }
        },
        two: { models: { shared: { name: 'Second', variants: {} } } }
      },
      agent: {
        build: { mode: 'primary', description: 'Build' },
        plan: { mode: 'all' },
        hidden: { mode: 'primary', hidden: true },
        disabled: { disable: true },
        child: { mode: 'subagent' }
      }
    }
    const before = JSON.stringify(config)
    const catalog = openCodeCatalog(
      { adapter: 'opencode', key: 'opencode-local', supported: true, models: [] },
      config
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
    expect(JSON.stringify(config)).toBe(before)
  })
  it('rebuilds from only the engine document without starting a server or fetching global models', async () => {
    const acquire = vi.fn(),
      fetchImpl = vi.fn()
    const adapter = new OpenCodeAdapter({ acquire, installed: vi.fn(), close: vi.fn() }, fetchImpl)
    const entry = { adapter: 'opencode', key: 'opencode-local', supported: true, models: [] }
    for (const id of ['first', 'second']) {
      const result = await adapter.catalog(
        entry,
        { provider: { local: { models: { [id]: { name: id } } } } },
        true
      )
      expect(result.models.map((model) => model.model)).toEqual([`local/${id}`])
    }
    expect((await adapter.catalog(entry, {})).models).toEqual([])
    expect(acquire).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

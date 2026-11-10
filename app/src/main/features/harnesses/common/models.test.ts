import { describe, expect, it } from 'vitest'
import { modelNameForFamily, permissionModelForFamily, toAgentEnvironment } from './models'
import type { ParsedModel } from './model-types'

const models: ParsedModel[] = [
  {
    alias: 'sonnet',
    model: 'sonnet',
    resolvedModel: 'claude-sonnet-5-5',
    isCustom: false,
    oneMillionContext: false,
    isDefault: true
  },
  {
    alias: 'haiku',
    model: 'haiku',
    resolvedModel: 'claude-haiku-5-5',
    isCustom: false,
    oneMillionContext: true,
    isDefault: false
  }
]
describe('0304 permission evidence and execution identity', () => {
  it.each(['haiku[1m]', 'haiku', 'sonnet', null, 'missing'])(
    'selects the same row for %s',
    (selected) => {
      const haiku = selected?.startsWith('haiku')
      expect(modelNameForFamily(models, selected)).toBe(haiku ? 'haiku[1m]' : 'sonnet')
      expect(permissionModelForFamily(models, selected)).toBe(
        haiku ? 'claude-haiku-5-5' : 'claude-sonnet-5-5'
      )
    }
  )
  it('falls back to execution identity without evidence and handles empty lists', () => {
    expect(permissionModelForFamily([{ ...models[0], resolvedModel: undefined }], 'sonnet')).toBe(
      'sonnet'
    )
    expect(permissionModelForFamily([], 'sonnet')).toBeUndefined()
  })
  it('retains evidence on the agent wire', () => {
    const row = toAgentEnvironment(
      { key: 'claude-team', harnessId: 'claude', modelProviderId: 'team', models },
      { supported: true, source: 'runtime', readOnly: true }
    )
    expect(row.models).toEqual(models)
    expect(row.models[1].resolvedModel).toBe('claude-haiku-5-5')
  })
})

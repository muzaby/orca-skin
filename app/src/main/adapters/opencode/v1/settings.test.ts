import { describe, expect, it } from 'vitest'
import { parseOpenCodeModels, readUserOpenCodeSettings } from './settings'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openCodeCatalog } from './catalog'
import type { Agent, Provider } from '@opencode-ai/sdk/v2'

it('reads raw global settings including invalid JSON for editing', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-opencode-import-'))
  try {
    expect(readUserOpenCodeSettings(root)).toEqual({ exists: false, settingsJson: '' })
    mkdirSync(join(root, 'opencode'))
    for (const raw of ['{ "model": "vendor/한글" }\n', '{broken', '']) {
      writeFileSync(join(root, 'opencode', 'opencode.json'), raw)
      expect(readUserOpenCodeSettings(root)).toEqual({ exists: true, settingsJson: raw })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('OpenCode native model catalogs', () => {
  it('uses native provider/model IDs and filters disabled variants', () => {
    expect(
      parseOpenCodeModels({
        model: 'vendor/reasoning',
        provider: {
          vendor: {
            models: {
              reasoning: {
                name: 'Reasoning',
                variants: { low: {}, high: {}, hidden: { disabled: true } }
              }
            }
          }
        }
      })
    ).toEqual([
      {
        alias: 'Reasoning',
        model: 'vendor/reasoning',
        providerId: 'vendor',
        isCustom: true,
        isDefault: true,
        oneMillionContext: false,
        variants: ['low', 'high']
      }
    ])
    expect(parseOpenCodeModels({ env: { ANTHROPIC_MODEL: 'claude' } })).toEqual([])
  })
  it('exposes server models and primary agents without hidden or subagent-only choices', () => {
    const providers = [
      {
        id: 'vendor',
        models: { m: { id: 'm', name: 'Model', variants: { high: {}, off: { disabled: true } } } }
      }
    ] as unknown as Provider[]
    const agents = [
      { name: 'build', mode: 'primary' },
      { name: 'plan', mode: 'all' },
      { name: 'internal', hidden: true },
      { name: 'explore', mode: 'subagent' }
    ] as Agent[]
    const result = openCodeCatalog(
      { key: 'opencode-local', adapter: 'opencode', supported: true, models: [] },
      providers,
      agents,
      { vendor: 'm' }
    )
    expect(result.models[0]).toMatchObject({
      model: 'vendor/m',
      isDefault: true,
      variants: ['high']
    })
    expect(result.agents?.map((agent) => agent.name)).toEqual(['build', 'plan'])
  })
})

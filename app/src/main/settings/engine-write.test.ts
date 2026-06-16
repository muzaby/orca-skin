import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addProviderSettings,
  deleteProviderSettings,
  extractModels,
  readProviderSettings,
  updateProviderSettings
} from './engine-write'

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'orca-engine-write-'))
}

describe('extractModels', () => {
  it('extracts family models from Claude env keys and marks ANTHROPIC_MODEL as default', () => {
    const models = extractModels(
      JSON.stringify({
        env: {
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-5',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-1-1m',
          ANTHROPIC_MODEL: 'claude-sonnet-4-5'
        }
      })
    )

    expect(models).toEqual([
      { name: 'claude-sonnet-4-5', family: 'sonnet', default: true },
      { name: 'claude-haiku-4-5', family: 'haiku' },
      { name: 'claude-opus-4-1-1m', family: 'opus·1m' }
    ])
  })

  it('uses top-level model as default and returns empty models for SDK fallback', () => {
    expect(extractModels(JSON.stringify({ model: 'claude-sonnet-1m' }))).toEqual([
      { name: 'claude-sonnet-1m', family: 'sonnet·1m', default: true }
    ])
    expect(extractModels(JSON.stringify({ env: { OTHER: 'x' } }))).toEqual([])
  })
})

describe('engine settings writes', () => {
  it('adds, reads, updates and deletes a claude-code provider', () => {
    const root = tempRoot()
    const created = addProviderSettings(
      'claude-code',
      'Bedrock',
      JSON.stringify({ env: { ANTHROPIC_MODEL: 'bedrock-sonnet' } }),
      root
    )
    expect(created.key).toBe('claude-code-bedrock')
    expect(readProviderSettings(created.key, root).settingsJson).toContain('bedrock-sonnet')

    updateProviderSettings(
      created.key,
      JSON.stringify({ env: { ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku-1m' } }),
      root
    )
    const meta = JSON.parse(
      readFileSync(join(root, 'sources/settings/claude-code/meta.json'), 'utf8')
    )
    expect(meta.bedrock.models).toEqual([{ name: 'haiku-1m', family: 'haiku·1m' }])

    deleteProviderSettings(created.key, root)
    const after = JSON.parse(
      readFileSync(join(root, 'sources/settings/claude-code/meta.json'), 'utf8')
    )
    expect(after.bedrock).toBeUndefined()
  })
})

import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addHarnessSettings,
  deleteHarnessSettings,
  readHarnessSettings,
  updateHarnessSettings
} from './settings-write'

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'orca-engine-write-'))
}

describe('engine settings writes', () => {
  it('adds, reads, updates and deletes a claude provider (settings.json only — no meta.json)', () => {
    const root = tempRoot()
    const created = addHarnessSettings(
      'claude',
      'Bedrock',
      JSON.stringify({ env: { ANTHROPIC_MODEL: 'bedrock-sonnet' } }),
      root
    )
    expect(created).toEqual({
      key: 'claude-bedrock',
      engine: 'claude',
      provider: 'bedrock'
    })
    expect(readHarnessSettings(created.key, root).settingsJson).toContain('bedrock-sonnet')

    updateHarnessSettings(
      created.key,
      JSON.stringify({ env: { ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku-1m' } }),
      root
    )
    const settingsPath = join(root, 'sources/settings/claude/bedrock/settings.json')
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toEqual({
      env: { ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku-1m' }
    })

    // 파생 캐시(meta.json)는 더 이상 만들지 않는다.
    expect(existsSync(join(root, 'sources/settings/claude/meta.json'))).toBe(false)

    deleteHarnessSettings(created.key, root)
    expect(existsSync(join(root, 'sources/settings/claude/bedrock'))).toBe(false)
  })

  it('rejects non claude engines and duplicate providers', () => {
    const root = tempRoot()
    addHarnessSettings('claude', 'anthropic', '{}', root)
    expect(() => addHarnessSettings('claude', 'anthropic', '{}', root)).toThrow(
      '이미 존재하는 provider'
    )
  })
})

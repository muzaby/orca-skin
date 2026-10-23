import { expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import type { SettingsStore } from '../../../../infra/settings-store'

const target = vi.hoisted(() => ({ file: '' }))
vi.mock('../../../../infra/config/paths', () => ({ mcpJsonPath: () => target.file }))
vi.mock('../../../../infra/config/secret-store', () => ({
  SecretStore: class {
    has(): boolean {
      return false
    }
  }
}))
import { McpStore } from './store'

it('adds a server when the sources mcp directory does not exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-mcp-fresh-'))
  target.file = join(root, 'sources', 'mcp', 'mcp.json')
  let settings = { mcpEnabled: {}, mcpMeta: {} }
  const store = new McpStore({
    getAll: () => settings,
    patch: (next: object) => {
      settings = { ...settings, ...next }
      return settings
    }
  } as unknown as SettingsStore)
  try {
    store.add({ name: 'docs', transport: 'http', url: 'https://example.test/mcp' })
    expect(JSON.parse(readFileSync(target.file, 'utf8'))).toEqual({
      mcpServers: { docs: { type: 'http', url: 'https://example.test/mcp' } }
    })
    expect(store.list()).toEqual([expect.objectContaining({ name: 'docs', enabled: true })])
    expect(readdirSync(dirname(target.file))).toEqual(['mcp.json'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

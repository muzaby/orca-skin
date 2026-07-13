import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { StaticUsageProviderModule } from '../../../contracts/usage-report'
import { STATIC_USAGE_PROVIDERS, materializeStaticProviderSettings } from './index'

describe('static usage provider registry', () => {
  it('registers no static providers by default and materializes no settings', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-static-provider-'))
    try {
      expect(STATIC_USAGE_PROVIDERS).toEqual([])
      expect(materializeStaticProviderSettings(undefined, root)).toEqual({ created: [] })
      expect(existsSync(join(root, 'sources', 'settings', 'claude', 'bedrock'))).toBe(false)
      expect(existsSync(join(root, 'sources', 'settings', 'claude', 'vertex'))).toBe(false)
      expect(existsSync(join(root, 'sources', 'settings', 'claude', 'custom'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('materializes a registry-only opt-in module without provider-name branches', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-static-provider-'))
    const modules: StaticUsageProviderModule[] = [
      {
        adapter: 'claude',
        provider: 'enterprise',
        defaultSettings: { usageReport: { endpoint: 'https://usage.example.invalid' } }
      }
    ]
    try {
      const result = materializeStaticProviderSettings(modules, root)
      expect(result.created).toHaveLength(1)
      expect(result.created[0]).toBe(
        join(root, 'sources', 'settings', 'claude', 'enterprise', 'settings.json')
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

import { expect, it, vi } from 'vitest'
const captured = vi.hoisted(() => ({
  claude: undefined as (() => unknown) | undefined,
  opencode: undefined as (() => unknown) | undefined
}))
vi.mock('electron-store', () => ({ default: class {} }))
vi.mock('../../adapters/claude/adapter', () => ({
  ClaudeAdapter: class {
    id = 'claude'
    constructor(_control: unknown, _snapshots: unknown, preferences: () => unknown) {
      captured.claude = preferences
    }
  }
}))
vi.mock('../../adapters/opencode/v1/adapter', () => ({
  OpenCodeAdapter: class {
    id = 'opencode'
    constructor(
      _server: unknown,
      _fetch: unknown,
      _migration: unknown,
      _db: unknown,
      _control: unknown,
      preferences: () => unknown
    ) {
      captured.opencode = preferences
    }
  }
}))
import { createAdapterRegistry } from './registry'
import { SettingsStore } from '../../infra/settings-store'
it('passes saved harness preferences to adapters live', () => {
  const settings = new SettingsStore('test', { store: {} })
  createAdapterRegistry({
    dataDirectory: 'unused',
    preferences: (id) => settings.getAll().harnesses?.[id],
    fetchImpl: vi.fn()
  })
  settings.patch({
    harnesses: {
      claude: { instructions: 'c', outputStyle: 'Learning' },
      opencode: { instructions: 'o', autoApprovePermissions: true }
    }
  })
  expect(captured.claude!()).toMatchObject({ instructions: 'c', outputStyle: 'Learning' })
  expect(captured.opencode!()).toMatchObject({ instructions: 'o', autoApprovePermissions: true })
  settings.patch({
    harnesses: { claude: { outputStyle: 'Proactive' }, opencode: { autoApprovePermissions: false } }
  })
  expect(captured.claude!()).toMatchObject({ instructions: 'c', outputStyle: 'Proactive' })
  expect(captured.opencode!()).toMatchObject({ instructions: 'o', autoApprovePermissions: false })
})

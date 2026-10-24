import { expect, it, vi } from 'vitest'
import type { RouterContext } from '../context'
import { SettingsStore } from '../../infra/settings-store'
import { CHANNELS } from '../../../shared/ipc'
const handlers = vi.hoisted(() => new Map<string, (event: unknown, payload?: unknown) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: (event: unknown, payload?: unknown) => unknown) =>
      handlers.set(name, fn)
  }
}))
import { registerSettingsHandlers, registerSettingsReadHandler } from './settings'

vi.mock('electron-store', () => ({ default: class {} }))
it('keeps global choices out of renderer patches in both settings responses', () => {
  const backend = { store: {} as Record<string, unknown> }
  const store = new SettingsStore('test', backend)
  const choices = { claude: { 'plugin:private-choice': false }, opencode: { 'mcp:docs': true } }
  store.setNativeExtensionChoices(choices)
  registerSettingsReadHandler(store)
  registerSettingsHandlers({
    settings: store,
    scheduler: { applySettings: vi.fn() }
  } as unknown as Pick<RouterContext, 'settings' | 'scheduler'>)
  for (const channel of [CHANNELS.settingsGet, CHANNELS.settingsSet]) {
    const value = handlers.get(channel)!({}, { nativeExtensionChoices: {}, theme: 'dark' })
    expect(value).toMatchObject({ nativeExtensionChoices: choices })
  }
  expect(store.getAll().nativeExtensionChoices).toEqual(choices)
})

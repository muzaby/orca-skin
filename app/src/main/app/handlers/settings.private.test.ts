import { expect, it, vi } from 'vitest'
import type { RouterContext } from '../context'
import { SettingsSchema } from '../../../shared/protocol'
import { CHANNELS } from '../../../shared/ipc'
const handlers = vi.hoisted(() => new Map<string, (event: unknown, payload?: unknown) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: (event: unknown, payload?: unknown) => unknown) =>
      handlers.set(name, fn)
  }
}))
import { registerSettingsHandlers, registerSettingsReadHandler } from './settings'

it('keeps plugin restoration options and paths out of both settings responses', () => {
  const settings = SettingsSchema.parse({
    openCodeDisabledPlugins: [
      {
        id: 'plugin',
        file: '/private/config',
        entry: ['private-plugin', { token: 'private-secret' }],
        index: 0
      }
    ]
  })
  const store = { getAll: () => settings, patch: () => settings }
  registerSettingsReadHandler(store)
  registerSettingsHandlers({
    settings: store,
    scheduler: { applySettings: vi.fn() }
  } as unknown as Pick<RouterContext, 'settings' | 'scheduler'>)
  for (const channel of [CHANNELS.settingsGet, CHANNELS.settingsSet]) {
    const value = handlers.get(channel)!({})
    expect(value).toMatchObject({ openCodeDisabledPlugins: [], theme: 'white' })
    expect(JSON.stringify(value)).not.toMatch(/private/)
  }
  expect(settings.openCodeDisabledPlugins).toHaveLength(1)
})

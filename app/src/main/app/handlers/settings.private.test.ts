import { expect, it, vi } from 'vitest'
import type { RouterContext } from '../context'
import { SettingsStore } from '../../infra/settings-store'
import { CHANNELS } from '../../../shared/ipc'
import { registerSettingsHandlers, registerSettingsReadHandler } from './settings'
import { invokeChannel } from '../../infra/ipc/test-transport.testfixture'

vi.mock('electron-store', () => ({ default: class {} }))
it('keeps global choices out of renderer patches in both settings responses', async () => {
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
    const value = await invokeChannel(channel, { nativeExtensionChoices: {}, theme: 'dark' })
    expect(value).toMatchObject({ nativeExtensionChoices: choices })
  }
  expect(store.getAll().nativeExtensionChoices).toEqual(choices)
})

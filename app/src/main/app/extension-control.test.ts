import { expect, it, vi } from 'vitest'
import type { Settings } from '../../shared/ipc'
import { extensionControl } from './extension-control'

it('persists explicit global choices and restores them in a new control', () => {
  let saved: Settings['nativeExtensionChoices']
  const store = {
    get: () => saved,
    set: vi.fn((value) => {
      saved = value
    })
  }
  const first = extensionControl(store)
  first.setGlobal('claude', 'plugin:shared', false)
  first.setGlobal('opencode', 'mcp:shared', true)
  first.setGlobal('opencode', 'mcp:disabled', false)
  expect(store.set).toHaveBeenCalledTimes(3)
  expect(saved).toEqual({
    claude: { 'plugin:shared': false },
    opencode: { 'mcp:shared': true, 'mcp:disabled': false }
  })
  const restored = extensionControl(store)
  expect(restored.global('claude')).toEqual({ 'plugin:shared': false })
  expect(restored.global('opencode')).toEqual({ 'mcp:shared': true, 'mcp:disabled': false })
  restored.global('claude')['plugin:shared'] = true
  expect(restored.global('claude')['plugin:shared']).toBe(false)
})

it('keeps the last saved choices when persistence fails and allows a retry', () => {
  const set = vi.fn().mockImplementationOnce(() => {
    throw new Error('disk full')
  })
  const control = extensionControl({ get: () => ({ claude: { 'plugin:one': true } }), set })
  expect(() => control.setGlobal('claude', 'plugin:one', false)).toThrow('disk full')
  expect(control.global('claude')).toEqual({ 'plugin:one': true })
  control.setGlobal('claude', 'plugin:one', false)
  expect(control.global('claude')).toEqual({ 'plugin:one': false })
})

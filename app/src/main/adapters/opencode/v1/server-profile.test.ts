import { expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { profileComponents } from './diagnostics'
import { openCodeServerProfile } from './server-profile'
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  existsSync: vi.fn(() => false)
}))
vi.mock('./diagnostics', async (original) => {
  const actual = await original<typeof import('./diagnostics')>()
  return { ...actual, profileComponents: vi.fn(actual.profileComponents) }
})
it('computes executable identity once and delays diagnostic components until requested', () => {
  vi.mocked(existsSync).mockClear()
  vi.mocked(profileComponents).mockClear()
  const profile = openCodeServerProfile('opencode', {}, {}, process.cwd())
  expect(existsSync).toHaveBeenCalledOnce()
  expect(profileComponents).not.toHaveBeenCalled()
  const components = profile.components
  expect(profile.components).toBe(components)
  expect(profileComponents).toHaveBeenCalledOnce()
  expect(existsSync).toHaveBeenCalledOnce()
})

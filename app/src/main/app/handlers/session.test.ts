import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, SettingsSchema } from '../../../shared/protocol'
const handlers = vi.hoisted(() => new Map<string, () => unknown>())
vi.mock('../../infra/ipc/handle', () => ({
  handle: vi.fn(),
  handlePlain: (channel: string, callback: () => unknown) => handlers.set(channel, callback)
}))
import { registerSessionHandlers } from './session'
const roots: string[] = []
afterEach(async () => {
  for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true })
})
it('returns the remembered work path only while it is a directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-last-cwd-'))
  roots.push(root)
  const file = join(root, 'file.txt')
  await writeFile(file, '')
  let lastCwd: string | null = root
  registerSessionHandlers({
    db: {} as Parameters<typeof registerSessionHandlers>[0]['db'],
    getCwd: () => 'Desktop',
    settings: { getAll: () => SettingsSchema.parse({ lastCwd }), patch: vi.fn() }
  })
  expect(await handlers.get(CHANNELS.sessionCwd)!()).toBe(root)
  for (const invalid of [null, '', 'relative/path', file, join(root, 'deleted')]) {
    lastCwd = invalid
    expect(await handlers.get(CHANNELS.sessionCwd)!()).toBe('Desktop')
  }
})

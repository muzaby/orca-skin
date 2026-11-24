import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS } from '../../../shared/ipc'
import { invokeChannel } from '../../infra/ipc/test-transport.testfixture'
import { fakeClient } from '../../infra/ipc/client.testfixture'
import { registerFilesHandlers } from './files'

const roots: string[] = []
const clients: ReturnType<typeof fakeClient>[] = []

async function fixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'oo-file-menu-'))
  roots.push(cwd)
  registerFilesHandlers({
    getCwd: () => cwd,
    db: {
      hasSessionWithCwd: vi.fn(() => false),
      getSessionById: vi.fn(),
      searchMessages: vi.fn(),
      listSessionAttachmentFiles: vi.fn()
    }
  })
  return cwd
}

function windowClient(id: number): ReturnType<typeof fakeClient> {
  const sender = fakeClient(id)
  clients.push(sender)
  return sender
}

function list(
  cwd: string,
  sender: ReturnType<typeof fakeClient>,
  relDir = '',
  owner = 'composer',
  active = true
): Promise<unknown> {
  return invokeChannel(CHANNELS.filesList, { cwd, relDir, observation: { owner, active } }, sender)
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('open composer file menu through data IPC', () => {
  it('notifies only the subscribed window and lists each external create, rename and deletion', async () => {
    const cwd = await fixture()
    await mkdir(join(cwd, 'other'))
    const active = windowClient(1)
    const other = windowClient(2)
    expect(await list(cwd, active)).toEqual([{ name: 'other', isDirectory: true }])
    expect(await list(cwd, other, 'other')).toEqual([])
    const mutations = [
      { update: () => writeFile(join(cwd, 'before.txt'), ''), name: 'before.txt' },
      { update: () => rename(join(cwd, 'before.txt'), join(cwd, 'after.txt')), name: 'after.txt' },
      { update: () => rm(join(cwd, 'after.txt')), name: null }
    ]
    for (const { update, name } of mutations) {
      const previous = active.sent.length
      await update()
      await vi.waitFor(() => expect(active.sent.length).toBeGreaterThan(previous))
      expect(active.sent.at(-1)).toEqual({
        channel: CHANNELS.filesFolderChanged,
        payload: { cwd, relDir: '', revision: expect.any(Number) }
      })
      expect(await list(cwd, active)).toEqual([
        { name: 'other', isDirectory: true },
        ...(name ? [{ name, isDirectory: false }] : [])
      ])
    }
    expect(other.sent).toEqual([])
    expect(await invokeChannel(CHANNELS.filesList, { cwd, relDir: '' }, other)).toEqual([
      { name: 'other', isDirectory: true }
    ])
  })

  it('rebinds an active watch when the folder is replaced', async () => {
    const cwd = await fixture()
    const folder = join(cwd, 'active')
    await mkdir(folder)
    const sender = windowClient(1)
    expect(await list(cwd, sender, 'active')).toEqual([])
    await rename(folder, join(cwd, 'moved'))
    await vi.waitFor(() => expect(sender.sent.length).toBeGreaterThan(0), { timeout: 3000 })
    const previous = sender.sent.length
    await mkdir(folder)
    await writeFile(join(folder, 'new.txt'), '')
    await vi.waitFor(() => expect(sender.sent.length).toBeGreaterThan(previous), { timeout: 3000 })
    expect(await list(cwd, sender, 'active')).toEqual([{ name: 'new.txt', isDirectory: false }])
    const recovered = sender.sent.length
    await writeFile(join(folder, 'later.txt'), '')
    await vi.waitFor(() => expect(sender.sent.length).toBeGreaterThan(recovered))
    expect(await list(cwd, sender, 'active')).toEqual([
      { name: 'later.txt', isDirectory: false },
      { name: 'new.txt', isDirectory: false }
    ])
  })

  it('keeps other owners on explicit release and closes all owners with the port', async () => {
    const cwd = await fixture()
    const first = windowClient(1)
    const second = windowClient(2)
    await list(cwd, first)
    await list(cwd, first, '', 'alternate')
    await list(cwd, second)
    await list(cwd, first, '', 'composer', false)
    await writeFile(join(cwd, 'first.txt'), '')
    await vi.waitFor(() => {
      expect(first.sent).toHaveLength(1)
      expect(second.sent).toHaveLength(1)
    })
    first.close()
    await writeFile(join(cwd, 'second.txt'), '')
    await vi.waitFor(() => expect(second.sent).toHaveLength(2))
    expect(first.sent).toHaveLength(1)
    await list(cwd, second, '', 'composer', false)
    expect(second.watchers()).toBe(0)
  })
})

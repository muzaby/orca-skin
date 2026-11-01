import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { ProjectResourceSync, type ProjectResourceTarget } from './project-resource-sync'

const probe = vi.hoisted(() => ({ file: '', wait: Promise.resolve() }))
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return {
    ...fs,
    lstat: async (...args: Parameters<typeof fs.lstat>) => {
      if (args[0] === probe.file) await probe.wait
      return fs.lstat(...args)
    },
    stat: async (...args: Parameters<typeof fs.stat>) => {
      if (args[0] === probe.file) await probe.wait
      return fs.stat(...args)
    }
  }
})

it('establishes the watcher baseline before reading and publishing project settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-project-watch-start-'))
  const file = join(root, 'settings.json')
  await writeFile(file, 'old')
  const baseline = Promise.withResolvers<void>()
  probe.file = file
  probe.wait = baseline.promise
  const read = vi.fn(async () => ({ revision: await readFile(file, 'utf8') }))
  const target: ProjectResourceTarget = {
    backend: 'claude',
    cwd: root,
    key: root,
    request: { sessionId: 'one' }
  }
  const emit = vi.fn()
  const service = new ProjectResourceSync({
    resolve: () => target,
    targets: () => [],
    idle: () => true,
    policy: () => ({ files: () => [file], read }),
    read: async () => ({ state: 'connected', generation: await readFile(file, 'utf8'), items: [] }),
    emit: vi.fn()
  })
  try {
    service.observe('owner', target.request, emit)
    for (let n = 0; n < 40; n++) await Promise.resolve()
    expect(read).not.toHaveBeenCalled()
    // The write occurs while stat is pending, before the consumer has read settings.
    await writeFile(file, 'new')
    baseline.resolve()
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ generation: 'new' }))
    )
    expect(await read.mock.results[0].value).toEqual({ revision: 'new' })
    await writeFile(file, 'later')
    await vi.waitFor(
      () => expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ generation: 'later' })),
      { timeout: 4000 }
    )
  } finally {
    baseline.resolve()
    service.close()
    probe.file = ''
    await rm(root, { recursive: true, force: true })
  }
})

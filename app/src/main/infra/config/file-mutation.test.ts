import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FileMutationCoordinator } from './file-mutation'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-file-queue-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
const patch =
  (key: string, value: boolean) =>
  (text: string | undefined): string =>
    JSON.stringify({ ...JSON.parse(text ?? '{}'), [key]: value })

it('serializes canonical same-file aliases, merges latest bytes and keeps other files independent', async () => {
  const a = join(root, 'a.json'),
    b = join(root, 'b.json')
  const gate = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const queue = new FileMutationCoordinator({
    beforeCommit: async (file) => {
      if (file === a) {
        entered.resolve()
        await gate.promise
      }
    }
  })
  let finished = false
  const first = queue.mutate(a, patch('one', true)).then(() => {
    finished = true
  })
  await entered.promise
  const second = queue.mutate(
    process.platform === 'win32' ? a.toUpperCase() : a,
    patch('two', true)
  )
  const last = queue.mutate(a, patch('one', false))
  await queue.mutate(b, patch('other', true))
  expect(finished).toBe(false)
  expect(JSON.parse(await readFile(b, 'utf8'))).toEqual({ other: true })
  gate.resolve()
  await Promise.all([first, second, last])
  expect(JSON.parse(await readFile(a, 'utf8'))).toEqual({ one: false, two: true })
  expect((await readdir(root)).sort()).toEqual(['a.json', 'b.json'])
})

it('re-reads an external edit and retries a temporary rename lock without early success', async () => {
  const file = join(root, 'settings.json')
  await writeFile(file, '{"preserved":true}')
  let external = false
  const replace = vi
    .fn<typeof rename>()
    .mockRejectedValueOnce(Object.assign(new Error('locked'), { code: 'EBUSY' }))
    .mockImplementation(rename)
  const queue = new FileMutationCoordinator({
    rename: replace,
    beforeCommit: async () => {
      if (!external) {
        external = true
        await writeFile(file, '{"preserved":true,"external":true}')
      }
    }
  })
  await queue.mutate(file, patch('plugin', false))
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    preserved: true,
    external: true,
    plugin: false
  })
  expect(replace).toHaveBeenCalledTimes(2)
})

it('preserves malformed bytes and disk-full failures, releases the queue, and bounds permanent lock retries', async () => {
  const file = join(root, 'settings.json')
  await writeFile(file, '{broken')
  const queue = new FileMutationCoordinator()
  const failed = queue.mutate(file, patch('a', true))
  const recovered = queue.mutate(file, (latest) => {
    expect(latest).toBe('{broken')
    return '{}'
  })
  await expect(failed).rejects.toThrow()
  await recovered
  for (const code of ['ENOSPC', 'EPERM']) {
    const writer = new FileMutationCoordinator({
      retryMs: 30,
      rename: async () => {
        throw Object.assign(new Error('failure'), { code })
      }
    })
    await expect(writer.mutate(file, patch('a', true))).rejects.toThrow('failure')
    expect(await readFile(file, 'utf8')).toBe('{}')
    expect(await readdir(root)).toEqual(['settings.json'])
  }
})

it('rejects directory and escaped junction targets and drains admitted saves on close', async () => {
  const project = join(root, 'project'),
    outside = join(root, 'outside')
  await mkdir(project)
  await mkdir(outside)
  await symlink(
    outside,
    join(project, '.claude'),
    process.platform === 'win32' ? 'junction' : 'dir'
  )
  const queue = new FileMutationCoordinator()
  await expect(
    queue.mutate(join(project, '.claude/settings.local.json'), patch('a', true), { root: project })
  ).rejects.toThrow()
  await expect(queue.mutate(outside, patch('a', true))).rejects.toThrow()
  const gate = Promise.withResolvers<void>()
  const draining = new FileMutationCoordinator({ beforeCommit: () => gate.promise })
  const save = draining.mutate(join(project, 'a.json'), patch('a', true))
  let closed = false
  const close = draining.close().then(() => {
    closed = true
  })
  await expect(draining.mutate(join(project, 'b.json'), patch('a', true))).rejects.toThrow()
  expect(closed).toBe(false)
  gate.resolve()
  await Promise.all([save, close])
  expect(JSON.parse(await readFile(join(project, 'a.json'), 'utf8'))).toEqual({ a: true })
})

it.skipIf(process.platform !== 'win32')(
  'waits for an actual Windows FileShare.None handle to be released',
  async () => {
    const file = join(root, 'settings.json')
    await writeFile(file, '{}')
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '$f = [IO.File]::Open($env:ORCA_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None); [Console]::WriteLine("ready"); [Console]::ReadLine() | Out-Null; $f.Dispose()'
      ],
      {
        env: { ...process.env, ORCA_LOCK_FILE: file },
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.once('data', () => resolve())
        child.once('error', reject)
        child.once('exit', (code) => {
          if (code) reject(new Error('lock helper failed'))
        })
      })
      let finished = false
      const save = new FileMutationCoordinator().mutate(file, patch('saved', true)).then(() => {
        finished = true
      })
      await new Promise((done) => setTimeout(done, 120))
      expect(finished).toBe(false)
      child.stdin.end('\n')
      await save
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ saved: true })
    } finally {
      child.stdin.end('\n')
      child.kill()
    }
  },
  15_000
)

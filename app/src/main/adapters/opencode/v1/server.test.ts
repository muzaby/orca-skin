import { OpenCodeAdapter } from './adapter'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { OpenCodeServerPool, resolveOpenCodeExecutable } from './server'
import { jsonResponse } from './adapter.testfixture'

const directories: string[] = []
const pools: OpenCodeServerPool[] = []
afterEach(() => {
  for (const pool of pools.splice(0)) pool.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), 'orca-opencode-test-'))
  directories.push(path)
  return path
}
function fakeChild(): ChildProcess & { kill: ReturnType<typeof vi.fn> } {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      queueMicrotask(() => child.emit('exit', 0))
      return true
    })
  })
  return child as unknown as ChildProcess & { kill: ReturnType<typeof vi.fn> }
}
function setup(
  options: {
    announce?: boolean
    health?: typeof fetch
    timeoutMs?: number
    version?: string
    readVersion?: (executable: string) => Promise<string>
  } = {}
): {
  pool: OpenCodeServerPool
  spawnProcess: ReturnType<typeof vi.fn>
  children: ReturnType<typeof fakeChild>[]
  fetchImpl: ReturnType<typeof vi.fn>
  dataDirectory: string
  preferences: { instructions: string; executablePath: string }
  readVersion: ReturnType<typeof vi.fn>
} {
  const children: ReturnType<typeof fakeChild>[] = []
  const spawnProcess = vi.fn(() => {
    const child = fakeChild()
    children.push(child)
    if (options.announce !== false)
      queueMicrotask(() => {
        child.stdout!.emit(
          'data',
          Buffer.from('opencode server listening on http://127.0.0.1:49123\n')
        )
      })
    return child
  })
  const fetchImpl = vi.fn(
    options.health ?? (async () => jsonResponse({ healthy: true, version: '1.18.27' }))
  )
  const dataDirectory = temporaryDirectory()
  const preferences = { instructions: 'Use tests', executablePath: 'ignored' }
  const readVersion = vi.fn(options.readVersion ?? (async () => options.version ?? '1.19.0'))
  const pool = new OpenCodeServerPool({
    dataDirectory,
    preferences: () => preferences,
    executable: () => preferences.executablePath,
    readVersion,
    allocatePort: async () => 49123,
    spawnProcess: spawnProcess as unknown as typeof spawn,
    fetchImpl,
    timeoutMs: options.timeoutMs ?? 1000
  })
  pools.push(pool)
  return { pool, spawnProcess, children, fetchImpl, dataDirectory, preferences, readVersion }
}

describe('owned OpenCode server lifecycle', () => {
  it('shares the effective profile when only the overridden snapshot setting differs', async () => {
    const { pool, spawnProcess, children } = setup()
    const enabled = await pool.acquire({ snapshot: true, model: 'profile/model' })
    const disabled = await pool.acquire({ snapshot: false, model: 'profile/model' })
    expect(spawnProcess).toHaveBeenCalledOnce()
    enabled.release!()
    expect(children[0].kill).not.toHaveBeenCalled()
    disabled.release!()
    expect(children[0].kill).toHaveBeenCalledOnce()
  })
  it('forces snapshots off for every newly spawned generation', async () => {
    const { pool, spawnProcess, children } = setup()
    for (const snapshot of [undefined, true, false]) {
      const connection = await pool.acquire(
        { snapshot, model: 'sentinel/model' },
        { OPENCODE_CONFIG_CONTENT: '{"snapshot":true}', OPENCODE_DB: '/sentinel.db' }
      )
      const call = spawnProcess.mock.calls.at(-1) as unknown as [
        string,
        string[],
        { env: NodeJS.ProcessEnv }
      ]
      expect(JSON.parse(call[2].env.OPENCODE_CONFIG_CONTENT!)).toEqual({
        snapshot: false,
        model: 'sentinel/model',
        share: 'disabled'
      })
      expect(call[2].env.OPENCODE_DB).toBe('/sentinel.db')
      expect(children.at(-1)!.kill).not.toHaveBeenCalled()
      connection.release!()
    }
    expect(spawnProcess).toHaveBeenCalledTimes(3)
  })
  it('releases only the last owner, is idempotent and never retires a replacement generation', async () => {
    const { pool, children, spawnProcess } = setup()
    const [one, two] = await Promise.all([pool.acquire(), pool.acquire()])
    one.release!()
    one.release!()
    expect(children[0]!.kill).not.toHaveBeenCalled()
    two.release!()
    expect(children[0]!.kill).toHaveBeenCalledOnce()
    const next = await pool.acquire()
    two.release!()
    expect(spawnProcess).toHaveBeenCalledTimes(2)
    expect(children[1]!.kill).not.toHaveBeenCalled()
    next.release!()
    expect(children[1]!.kill).toHaveBeenCalledOnce()
  })
  it('coalesces version checks across install and different server configurations', async () => {
    const { pool, readVersion } = setup()
    await Promise.all([
      pool.installed(),
      pool.acquire({ model: 'one' }),
      pool.acquire({ model: 'two' })
    ])
    await pool.installed()
    expect(readVersion).toHaveBeenCalledOnce()
  })
  it('invalidates the version cache when the executable bytes change at the same path', async () => {
    const { pool, preferences, readVersion } = setup()
    preferences.executablePath = join(temporaryDirectory(), 'opencode.exe')
    writeFileSync(preferences.executablePath, 'first')
    await pool.installed()
    writeFileSync(preferences.executablePath, 'replacement-longer')
    await pool.installed()
    expect(readVersion).toHaveBeenCalledTimes(2)
  })
  it('shares a profile across directories while separating native storage environments', async () => {
    const { pool, spawnProcess } = setup()
    const one = temporaryDirectory()
    const two = temporaryDirectory()
    await pool.acquire({}, { XDG_DATA_HOME: one }, one)
    await pool.acquire({}, { XDG_DATA_HOME: one }, one)
    await pool.acquire({}, { XDG_DATA_HOME: two }, one)
    await pool.acquire({}, { XDG_DATA_HOME: two }, two)
    expect(spawnProcess).toHaveBeenCalledTimes(2)
    expect(
      spawnProcess.mock.calls.map(
        (call) => (call as unknown as [unknown, unknown, { cwd: string }])[2].cwd
      )
    ).toEqual([homedir(), homedir()])
    expect(
      spawnProcess.mock.calls.map(
        (call) =>
          (call as unknown as [unknown, unknown, { env: NodeJS.ProcessEnv }])[2].env.XDG_DATA_HOME
      )
    ).toEqual([one, two])
  })
  it('resolves configured and PATH npm executable files without invoking a shell', () => {
    const directory = temporaryDirectory()
    const executable = join(directory, process.platform === 'win32' ? 'opencode.exe' : 'opencode')
    writeFileSync(executable, '')
    expect(resolveOpenCodeExecutable(executable)).toBe(executable)
    expect(resolveOpenCodeExecutable('', { PATH: directory })).toBe(executable)
    expect(() => resolveOpenCodeExecutable('relative.exe')).toThrow('절대 경로')
    expect(() => resolveOpenCodeExecutable('', { PATH: directory + '-missing' })).toThrow(
      '찾을 수 없습니다'
    )
  })

  it('separates relative path environments and preserves relative XDG and special native values', async () => {
    const { pool, spawnProcess } = setup()
    const a = temporaryDirectory()
    const b = temporaryDirectory()
    await pool.acquire({}, { OPENCODE_CONFIG: './settings.json' }, a)
    await pool.acquire({}, { OPENCODE_CONFIG: join(a, 'settings.json') }, b)
    await pool.acquire({}, { OPENCODE_CONFIG: './settings.json' }, b)
    if (process.platform === 'win32')
      await pool.acquire({}, { OPENCODE_CONFIG: `${a.slice(0, 2)}settings.json` }, a)
    expect(spawnProcess).toHaveBeenCalledTimes(2)
    const options = (): { cwd: string; env: NodeJS.ProcessEnv }[] =>
      spawnProcess.mock.calls.map(
        (call) =>
          (call as unknown as [string, string[], { cwd: string; env: NodeJS.ProcessEnv }])[2]
      )
    expect(options().map((value) => value.env.OPENCODE_CONFIG)).toEqual([
      join(a, 'settings.json'),
      join(b, 'settings.json')
    ])
    await pool.acquire(
      {},
      {
        XDG_DATA_HOME: 'relative',
        OPENCODE_DB: ':memory:',
        OPENCODE_CONFIG: 'file:///config.json'
      },
      a
    )
    await pool.acquire(
      {},
      {
        XDG_DATA_HOME: 'relative',
        OPENCODE_DB: ':memory:',
        OPENCODE_CONFIG: 'file:///config.json'
      },
      b
    )
    expect(
      options()
        .slice(2)
        .map((value) => ({
          cwd: value.cwd,
          data: value.env.XDG_DATA_HOME,
          db: value.env.OPENCODE_DB,
          config: value.env.OPENCODE_CONFIG
        }))
    ).toEqual([
      { cwd: a, data: 'relative', db: ':memory:', config: 'file:///config.json' },
      { cwd: b, data: 'relative', db: ':memory:', config: 'file:///config.json' }
    ])
  })

  it('retires only future acquisitions and shuts down every owned generation', async () => {
    const { pool, children } = setup()
    const a = await pool.acquire({}, undefined, 'C:/one')
    const b = await pool.acquire({}, undefined, 'C:/two')
    a.retire!()
    a.release!()
    expect(children[0].kill).not.toHaveBeenCalled()
    const next = await pool.acquire({}, undefined, 'C:/one')
    expect(children).toHaveLength(2)
    a.retire!()
    await pool.acquire({}, undefined, 'C:/three')
    expect(children).toHaveLength(2)
    pool.close()
    expect(children.map((child) => child.kill.mock.calls.length)).toEqual([1, 1])
    b.release!()
    next.release!()
    expect(children.map((child) => child.kill.mock.calls.length)).toEqual([1, 1])
  })

  it('does not discover the scoped CLI package', () => {
    const root = temporaryDirectory()
    const bin = join(root, 'node_modules', '@opencode', 'cli', 'bin')
    mkdirSync(bin, { recursive: true })
    const executable = join(bin, process.platform === 'win32' ? 'opencode.exe' : 'opencode')
    writeFileSync(executable, '')
    expect(() => resolveOpenCodeExecutable('', { PATH: root })).toThrow('찾을 수 없습니다')
    const legacyBin = join(root, 'node_modules', 'opencode-ai', 'bin')
    mkdirSync(legacyBin, { recursive: true })
    const legacyExecutable = join(
      legacyBin,
      process.platform === 'win32' ? 'opencode.exe' : 'opencode'
    )
    writeFileSync(legacyExecutable, '')
    expect(resolveOpenCodeExecutable('', { PATH: root })).toBe(legacyExecutable)
  })

  it('ignores the unprefixed startup announcement', async () => {
    const { pool, children, fetchImpl } = setup({ announce: false, timeoutMs: 100 })
    const ready = pool.acquire()
    const rejected = expect(ready).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.waitFor(() => expect(children).toHaveLength(1), { interval: 1 })
    children[0]!.stdout!.emit('data', Buffer.from('server listening on http://127.0.0.1:12345\n'))
    await rejected
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(children[0]!.kill).toHaveBeenCalledOnce()
  })

  it.each(['1.18.27', '1.19.0', 'v1.19.0', 'opencode v1.19.0', '1.19.0-beta.1', '1.19.0+local'])(
    'accepts supported 1.x versions (%s)',
    async (version) => {
      const { pool, spawnProcess } = setup({ version })
      await expect(pool.acquire()).resolves.toMatchObject({ url: 'http://127.0.0.1:49123' })
      expect(spawnProcess).toHaveBeenCalledOnce()
    }
  )

  it.each(['2.0.28', 'opencode v2.0.28', '2.0.0-beta.1', '', '1.19.', 'unknown', '11.19.0'])(
    'rejects unsupported versions before spawning a server (%s)',
    async (version) => {
      const { pool, spawnProcess, fetchImpl } = setup({ version })
      await expect(pool.acquire()).rejects.toThrow('OpenCode CLI 1.x가 필요합니다')
      expect(spawnProcess).not.toHaveBeenCalled()
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  )

  it('reports the actual installed version', async () => {
    const { pool, readVersion, preferences, spawnProcess } = setup({
      version: 'opencode v2.0.28\n'
    })
    await expect(pool.installed()).resolves.toEqual({
      installed: true,
      binPath: preferences.executablePath,
      version: 'opencode v2.0.28'
    })
    expect(readVersion).toHaveBeenCalledWith(preferences.executablePath)
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it('retries after replacing an unsupported executable', async () => {
    const { pool, readVersion, spawnProcess } = setup({ version: '2.0.28' })
    await expect(pool.acquire()).rejects.toThrow('1.x')
    readVersion.mockResolvedValue('1.19.0')
    await expect(pool.acquire()).resolves.toMatchObject({ url: 'http://127.0.0.1:49123' })
    expect(readVersion).toHaveBeenCalledTimes(2)
    expect(spawnProcess).toHaveBeenCalledOnce()
  })

  it('does not spawn after shutdown during version probing', async () => {
    let complete!: (version: string) => void
    const { pool, spawnProcess, fetchImpl } = setup({
      readVersion: () =>
        new Promise<string>((resolve) => {
          complete = resolve
        })
    })
    const ready = pool.acquire()
    pool.close()
    complete('1.19.0')
    await expect(ready).rejects.toThrow('종료')
    expect(spawnProcess).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child', async () => {
    const { pool, spawnProcess, fetchImpl, children, preferences } = setup()
    const config = { model: 'test/model', provider: { test: { options: { apiKey: 'secret' } } } }
    const first = pool.acquire(config, { TEST_SETTING: 'value' })
    const second = pool.acquire(config, { TEST_SETTING: 'value' })
    const secondConnection = await second
    const connection = await first
    expect(spawnProcess).toHaveBeenCalledOnce()
    const [command, args, options] = spawnProcess.mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string>; cwd: string; windowsHide: boolean }
    ]
    expect(command).toBe(preferences.executablePath)
    expect(args).toEqual(['serve', '--hostname=127.0.0.1', '--port=49123'])
    expect(secondConnection.url).toBe(connection.url)
    expect(secondConnection.release).not.toBe(connection.release)
    expect(options).toMatchObject({ cwd: homedir(), windowsHide: true })
    expect(JSON.parse(options.env.OPENCODE_CONFIG_CONTENT!)).toEqual({
      ...config,
      share: 'disabled',
      snapshot: false
    })
    expect(options.env.TEST_SETTING).toBe('value')
    for (const key of [
      'XDG_DATA_HOME',
      'XDG_CONFIG_HOME',
      'XDG_STATE_HOME',
      'XDG_CACHE_HOME',
      'OPENCODE_DB'
    ])
      expect(options.env[key]).toBe(process.env[key])
    expect(options.env.OPENCODE_SERVER_PASSWORD).toHaveLength(43)
    expect(connection.headers.Authorization).toBe(
      `Basic ${Buffer.from(`opencode:${options.env.OPENCODE_SERVER_PASSWORD}`).toString('base64')}`
    )
    expect(fetchImpl.mock.calls[0]).toMatchObject([
      'http://127.0.0.1:49123/global/health',
      { headers: connection.headers, redirect: 'error' }
    ])
    expect(children[0]!.kill).not.toHaveBeenCalled()
    pool.close()
    expect(children[0]!.kill).toHaveBeenCalledOnce()
    await expect(pool.acquire()).rejects.toThrow('종료')
  })

  it('removes failed startup and health entries so an explicit retry launches a fresh child', async () => {
    let calls = 0
    const { pool, children, spawnProcess } = setup({
      health: async () => jsonResponse({ healthy: ++calls > 1 })
    })
    await expect(pool.acquire()).rejects.toThrow('준비되지')
    expect(children[0]!.kill).toHaveBeenCalledOnce()
    await expect(pool.acquire()).resolves.toMatchObject({ url: 'http://127.0.0.1:49123' })
    expect(spawnProcess).toHaveBeenCalledTimes(2)
    children[1]!.emit('exit', 1)
    await pool.acquire()
    expect(spawnProcess).toHaveBeenCalledTimes(3)
  })

  it('explains incompatible server APIs and stops its child instead of accepting an HTML fallback', async () => {
    const { pool, children } = setup({
      health: async () =>
        new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
    })
    await expect(pool.acquire()).rejects.toThrow('서버 API가 호환되지')
    expect(children[0]!.kill).toHaveBeenCalledOnce()
  })

  it('rejects startup timeout, spawn error and shutdown while startup is pending', async () => {
    const timed = setup({ announce: false, timeoutMs: 15 })
    await expect(timed.pool.acquire()).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(timed.children[0]!.kill).toHaveBeenCalledOnce()
    const errored = setup({ announce: false })
    const starting = errored.pool.acquire()
    await vi.waitFor(() => expect(errored.children).toHaveLength(1), { interval: 1 })
    errored.children[0]!.emit('error', new Error('spawn failure'))
    await expect(starting).rejects.toThrow('spawn failure')
    const stopped = setup({ announce: false })
    const pending = stopped.pool.acquire()
    await vi.waitFor(() => expect(stopped.children).toHaveLength(1), { interval: 1 })
    stopped.pool.close()
    await expect(pending).rejects.toThrow('종료')
    expect(stopped.children[0]!.kill).toHaveBeenCalled()
  })

  it('isolates server configurations and only kills children returned by its spawn factory', async () => {
    const unrelated = fakeChild()
    const { pool, children, spawnProcess, preferences } = setup()
    await pool.acquire({ model: 'a/one' })
    await pool.acquire({ model: 'b/two' })
    preferences.executablePath = 'other-path'
    await pool.acquire({ model: 'a/one' })
    expect(spawnProcess).toHaveBeenCalledTimes(3)
    pool.close()
    expect(children.every((child) => child.kill.mock.calls.length === 1)).toBe(true)
    expect(unrelated.kill).not.toHaveBeenCalled()
  })
})

it('starts a new server for new owners after retireAll while existing owners keep theirs', async () => {
  const { pool, children, spawnProcess } = setup()
  const [one, peer] = await Promise.all([pool.acquire(), pool.acquire()])
  const adapter = new OpenCodeAdapter(pool, vi.fn())
  adapter.extensionsChanged()
  expect(children[0].kill).not.toHaveBeenCalled()
  const next = await pool.acquire()
  expect(spawnProcess).toHaveBeenCalledTimes(2)
  expect(next.headers.Authorization).not.toBe(one.headers.Authorization)
  expect(peer.headers).toEqual(one.headers)
  one.release!()
  expect(children[0].kill).not.toHaveBeenCalled()
  peer.release!()
  expect(children[0].kill).toHaveBeenCalledOnce()
  expect(children[1].kill).not.toHaveBeenCalled()
  next.release!()
  expect(children[1].kill).toHaveBeenCalledOnce()
})

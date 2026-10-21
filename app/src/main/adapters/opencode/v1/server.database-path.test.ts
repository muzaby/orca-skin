import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jsonResponse } from './adapter.testfixture'

// `databasePath` asks the CLI itself (`opencode db path`), so the call is observed here.
const cli = vi.hoisted(() => ({
  calls: [] as Array<{ args: string[]; env: NodeJS.ProcessEnv; cwd: string }>,
  output: '',
  fail: false
}))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execFile: (
      _file: string,
      args: string[],
      options: { env: NodeJS.ProcessEnv; cwd: string },
      callback: (error: Error | null, stdout: string) => void
    ) => {
      cli.calls.push({ args, env: options.env, cwd: options.cwd })
      queueMicrotask(() =>
        callback(cli.fail ? new Error('temporary CLI error') : null, `${cli.output}\n`)
      )
    }
  }
})

import { OpenCodeServerPool } from './server'

const directories: string[] = []
const pools: OpenCodeServerPool[] = []
afterEach(() => {
  for (const pool of pools.splice(0)) pool.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
  cli.calls.length = 0
  cli.fail = false
})

function fakeChild(): ChildProcess {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => {
      queueMicrotask(() => child.emit('exit', 0))
      return true
    })
  })
  queueMicrotask(() =>
    child.stdout.emit('data', Buffer.from('opencode server listening on http://127.0.0.1:49123\n'))
  )
  return child as unknown as ChildProcess
}

describe('OpenCode native database path (0262 EP56 P49)', () => {
  it('reads the database path through the server and CLI environment of the selected engine document', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-opencode-db-path-'))
    directories.push(root)
    cli.output = join(root, 'opencode.db')
    writeFileSync(cli.output, '')
    const spawnProcess = vi.fn(fakeChild)
    const pool = new OpenCodeServerPool({
      dataDirectory: root,
      preferences: () => ({ instructions: '', executablePath: '' }),
      executable: () => 'opencode',
      readVersion: async () => '1.19.0',
      spawnProcess: spawnProcess as unknown as typeof spawn,
      fetchImpl: vi.fn(async () => jsonResponse({ healthy: true, version: '1.19.0' })),
      timeoutMs: 1000
    })
    pools.push(pool)
    const document = { model: 'other/extra', provider: { other: { models: { extra: {} } } } }
    const env = { XDG_DATA_HOME: root, OPENCODE_CONFIG: './settings.json' }

    // The history read already holds the server for this document.
    await pool.acquire(document, env, root)
    await expect(pool.databasePath(document, env, root)).resolves.toBe(cli.output)
    await Promise.all([
      pool.databasePath(document, env, root),
      pool.databasePath(document, env, root)
    ])

    // No second server is started for an empty or different configuration.
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    expect(cli.calls).toHaveLength(1)
    expect(cli.calls[0]?.args).toEqual(['db', 'path'])
    const spawned = (
      spawnProcess.mock.calls[0] as unknown as [
        string,
        string[],
        { cwd: string; env: NodeJS.ProcessEnv }
      ]
    )[2]
    expect(cli.calls[0]?.cwd).toBe(spawned.cwd)
    expect(cli.calls[0]?.env.OPENCODE_CONFIG).toBe(join(root, 'settings.json'))
    expect(spawned.env.OPENCODE_CONFIG).toBe(cli.calls[0]?.env.OPENCODE_CONFIG)
    expect(JSON.parse(cli.calls[0]!.env.OPENCODE_CONFIG_CONTENT!)).toEqual({
      ...document,
      share: 'disabled'
    })
    // A disappeared database path and a failed probe must not poison the live entry.
    rmSync(cli.output)
    cli.fail = true
    await expect(pool.databasePath(document, env, root)).rejects.toThrow('temporary CLI error')
    cli.fail = false
    cli.output = join(root, 'replacement.db')
    writeFileSync(cli.output, '')
    await expect(pool.databasePath(document, env, root)).resolves.toBe(cli.output)
    expect(cli.calls).toHaveLength(3)
  })
})

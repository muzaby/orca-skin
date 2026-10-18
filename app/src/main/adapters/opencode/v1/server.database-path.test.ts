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
  calls: [] as Array<{ args: string[]; env: NodeJS.ProcessEnv }>,
  output: ''
}))
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execFile: (
      _file: string,
      args: string[],
      options: { env: NodeJS.ProcessEnv },
      callback: (error: Error | null, stdout: string) => void
    ) => {
      cli.calls.push({ args, env: options.env })
      queueMicrotask(() => callback(null, `${cli.output}\n`))
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
    const env = { XDG_DATA_HOME: root }

    // The history read already holds the server for this document.
    await pool.acquire(document, env, root)
    await expect(pool.databasePath(document, env, root)).resolves.toBe(cli.output)

    // No second server is started for an empty or different configuration.
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    expect(cli.calls).toHaveLength(1)
    expect(cli.calls[0]?.args).toEqual(['db', 'path'])
    expect(JSON.parse(cli.calls[0]!.env.OPENCODE_CONFIG_CONTENT!)).toEqual({
      ...document,
      share: 'disabled'
    })
  })
})

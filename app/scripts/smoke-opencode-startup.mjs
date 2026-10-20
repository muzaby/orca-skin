// Owned, isolated CLI only; no paid model requests or user configuration writes.
import { createServer } from 'vite'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'

const root = await mkdtemp(join(tmpdir(), 'orca-opencode-startup-'))
const loader = await createServer({
  root: resolve('.'),
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})
const { OpenCodeServerPool } = await loader.ssrLoadModule(
  '/src/main/adapters/opencode/v1/server.ts'
)
const env = {
  HOME: join(root, 'home'),
  USERPROFILE: join(root, 'home'),
  XDG_CONFIG_HOME: join(root, 'config'),
  XDG_DATA_HOME: join(root, 'data'),
  XDG_CACHE_HOME: join(root, 'cache'),
  XDG_STATE_HOME: join(root, 'state'),
  OPENCODE_DISABLE_AUTOUPDATE: 'true',
  OPENCODE_DISABLE_MODELS_FETCH: 'true',
  OPENCODE_CONFIG: join(root, 'opencode.json')
}
await mkdir(env.HOME, { recursive: true })
await writeFile(env.OPENCODE_CONFIG, '{}')
const children = []
const timings = {}
const pool = new OpenCodeServerPool({
  dataDirectory: root,
  preferences: () => undefined,
  fetchImpl: fetch,
  readVersion: (executable) => {
    const started = performance.now()
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        ['--version'],
        { windowsHide: true, timeout: 15000 },
        (error, output) => {
          timings.versionMs = Math.round(performance.now() - started)
          if (error) reject(error)
          else resolve(output)
        }
      )
    })
  },
  spawnProcess: (...args) => {
    timings.spawnedAt = performance.now()
    const child = spawn(...args)
    children.push(child)
    return child
  }
})
try {
  const started = performance.now()
  const one = await pool.acquire({}, env, root)
  const coldMs = Math.round(performance.now() - started)
  timings.serverReadyMs = Math.round(performance.now() - timings.spawnedAt)
  delete timings.spawnedAt
  assert.notEqual(new URL(one.url).port, '4096')
  const warmStarted = performance.now()
  const two = await pool.acquire({}, env, root)
  const warmMs = Math.round(performance.now() - warmStarted)
  assert.equal(one.url, two.url)
  const client = createOpencodeClient({ baseUrl: one.url, headers: one.headers, fetch })
  const sessions = []
  try {
    for (const label of ['firstSessionMs', 'nextSessionMs']) {
      const creation = performance.now()
      const created = await client.session.create(
        { directory: root, permission: [{ permission: '*', pattern: '*', action: 'deny' }] },
        { signal: AbortSignal.timeout(20000), throwOnError: true }
      )
      assert.ok(created.data?.id)
      sessions.push(created.data.id)
      timings[label] = Math.round(performance.now() - creation)
    }
  } finally {
    await Promise.all(
      sessions.map((sessionID) =>
        client.session.delete(
          { sessionID, directory: root },
          { signal: AbortSignal.timeout(5000), throwOnError: true }
        )
      )
    )
  }
  one.release()
  assert.equal(children[0].exitCode, null)
  const exited = new Promise((done) => children[0].once('exit', done))
  two.release()
  await Promise.race([
    exited,
    new Promise((_, reject) => {
      const timeout = setTimeout(() => reject(new Error('owned child did not exit')), 7000)
      timeout.unref()
    })
  ])
  assert.notEqual(children[0].exitCode, null)
  console.log(
    JSON.stringify({
      coldMs,
      warmMs,
      timings,
      spawns: children.length,
      port: new URL(one.url).port,
      released: true,
      root
    })
  )
} finally {
  pool.close()
  await loader.close()
}

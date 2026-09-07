import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { parseProbeArgs, runProbe } from './sandbox-probe.mjs'

const probePath = fileURLToPath(new URL('./sandbox-probe.mjs', import.meta.url))
const exec = promisify(execFile)
const budget = { timeout: 15_000 }

test('stdin probe measures binary chunks and EOF without disclosing input', budget, async () => {
  const data = Buffer.concat([Buffer.from('fake-stdin-only\0한글'), Buffer.alloc(70_000, 255)])
  const child = spawn(process.execPath, [probePath, 'stdin'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  child.stdin.on('error', () => {})
  const closed = once(child, 'close')
  child.stdin.write(data.subarray(0, 3))
  child.stdin.end(data.subarray(3))
  const [code] = await closed
  assert.equal(code, 0, stderr)
  assert.deepEqual(JSON.parse(stdout), {
    mode: 'stdin',
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex')
  })
  assert.doesNotMatch(stdout + stderr, /fake-stdin-only/)
})

test('stdin probe distinguishes empty EOF and bounds the bytes it consumes', async () => {
  const { stdinProbe } = await import('./sandbox-probe.mjs')
  assert.equal(typeof stdinProbe, 'function')
  assert.deepEqual(await stdinProbe(Readable.from([])), {
    mode: 'stdin',
    bytes: 0,
    sha256: createHash('sha256').digest('hex')
  })
  await assert.rejects(stdinProbe(Readable.from([Buffer.alloc(1024 * 1024 + 1)])), /stdin_limit/)
})

async function listen(server, host = '127.0.0.1') {
  server.listen(0, host)
  await once(server, 'listening')
  return server.address().port
}

test('CLI echo preserves explicit argv and prints only the fake env key', budget, async () => {
  const args = ['', '한글', 'a b', 'quote"\\', 'line\nbreak', '$HOME & %PATH%']
  const { stdout, stderr } = await exec(
    process.execPath,
    [probePath, 'echo', JSON.stringify({ args })],
    {
      env: {
        ...process.env,
        ORCA_SANDBOX_TEST: 'fake-key-only',
        ORCA_REAL_SECRET_TEST: 'must-not-print'
      },
      windowsHide: true
    }
  )
  const result = JSON.parse(stdout)
  assert.deepEqual(result.argv, args)
  assert.deepEqual(result.env, { ORCA_SANDBOX_TEST: 'fake-key-only' })
  assert.equal(result.cwd, process.cwd())
  assert.equal(stderr, '')
  assert.equal(stdout.includes('must-not-print'), false)
})

test('argument parsing rejects malformed and excess input without echoing payloads', () => {
  assert.deepEqual(parseProbeArgs([]), { mode: 'echo', options: {} })
  assert.throws(() => parseProbeArgs(['echo', '{secret']), /invalid_json/)
  assert.throws(() => parseProbeArgs(['echo', '{}', 'extra']), /invalid_arguments/)
  assert.throws(() => parseProbeArgs(['unknown', '{}']), /unknown_mode/)
})

test(
  'filesystem probe reports actual access, never assumes deny labels mean blocked',
  budget,
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'orca-srt-probe-'))
    try {
      const allowRoot = path.join(root, 'allowed')
      await mkdir(allowRoot)
      const denyReadFile = path.join(root, 'read-fixture.txt')
      const denyWriteFile = path.join(root, 'write-fixture.txt')
      await writeFile(denyReadFile, 'fake-file-content')
      const result = await runProbe('fs', { allowRoot, denyReadFile, denyWriteFile })
      assert.equal(result.allowWrite.ok, true)
      assert.equal(result.allowRead.ok, true)
      assert.equal(result.denyRead.ok, true)
      assert.equal(result.denyWrite.ok, true)
      assert.equal(result.denyRead.bytes, 17)
      assert.equal(JSON.stringify(result).includes('fake-file-content'), false)
      const written = await readFile(denyWriteFile, 'utf8')
      assert.match(written, /orca-srt-probe/)
      const again = await runProbe('fs', {
        allowRoot,
        denyReadFile: path.join(root, 'missing'),
        denyWriteFile
      })
      assert.equal(again.denyRead.errorCode, 'ENOENT')
      assert.equal(again.denyWrite.errorCode, 'EEXIST')
      assert.equal(await readFile(denyWriteFile, 'utf8'), written)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)

test(
  'network probe uses the real HTTP proxy and observes both direct IP families',
  budget,
  async () => {
    const requests = []
    const proxy = http.createServer((req, res) => {
      requests.push(req.url)
      res.writeHead(req.url.includes('/allowed') ? 200 : 403)
      res.end('must-not-appear-in-probe-output')
    })
    const ipv4 = net.createServer((socket) => socket.end())
    const ipv6 = net.createServer((socket) => socket.end())
    try {
      const proxyPort = await listen(proxy)
      const port4 = await listen(ipv4)
      const port6 = await listen(ipv6, '::1')
      const options = {
        allowedUrl: `http://127.0.0.1:${port4}/allowed`,
        deniedUrl: `http://localhost:${port4}/denied`,
        directIPv4: { host: '127.0.0.1', port: port4 },
        directIPv6: { host: '::1', port: port6 },
        timeoutMs: 1500
      }
      const { stdout } = await exec(
        process.execPath,
        [probePath, 'network', JSON.stringify(options)],
        {
          env: { ...process.env, HTTP_PROXY: `http://127.0.0.1:${proxyPort}`, NO_PROXY: '*' },
          windowsHide: true
        }
      )
      const result = JSON.parse(stdout)
      assert.deepEqual(requests.sort(), [options.allowedUrl, options.deniedUrl].sort())
      assert.deepEqual(result.allowed, { ok: true, status: 200 })
      assert.deepEqual(result.denied, { ok: false, status: 403 })
      assert.deepEqual(result.directIPv4, { connected: true })
      assert.deepEqual(result.directIPv6, { connected: true })
      assert.equal(stdout.includes('must-not-appear'), false)
    } finally {
      await Promise.all(
        [proxy, ipv4, ipv6]
          .filter((server) => server.listening)
          .map((server) => new Promise((resolve) => server.close(resolve)))
      )
    }
  }
)

test('network mode refuses a missing proxy instead of trying direct HTTP', budget, async () => {
  const env = { ...process.env }
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'http_proxy') delete env[key]
  await assert.rejects(
    exec(
      process.execPath,
      [
        probePath,
        'network',
        JSON.stringify({
          allowedUrl: 'http://localhost:1234/a',
          deniedUrl: 'http://localhost:1234/b',
          directIPv4: { host: '127.0.0.1', port: 1234 },
          directIPv6: { host: '::1', port: 1234 }
        })
      ],
      { env, windowsHide: true }
    ),
    (error) => {
      assert.equal(error.stdout, '')
      assert.match(error.stderr, /proxy_missing/)
      return true
    }
  )
})

test(
  'SRT proxy URL credentials become only Proxy-Authorization and never output',
  budget,
  async () => {
    const headers = []
    const credentials = 'command /한글:fake-token +?'
    const expected = `Basic ${Buffer.from(credentials).toString('base64')}`
    const proxy = http.createServer((req, res) => {
      headers.push(req.headers)
      res.writeHead(req.headers['proxy-authorization'] === expected ? 200 : 407)
      res.end()
    })
    try {
      const port = await listen(proxy)
      const options = {
        allowedUrl: `http://localhost:${port}/a`,
        deniedUrl: `http://localhost:${port}/b`,
        directIPv4: { host: '127.0.0.1', port },
        directIPv6: { host: '::1', port },
        timeoutMs: 1000
      }
      const proxyUrl = `http://${encodeURIComponent('command /한글')}:${encodeURIComponent('fake-token +?')}@127.0.0.1:${port}`
      const { stdout, stderr } = await exec(
        process.execPath,
        [probePath, 'network', JSON.stringify(options)],
        {
          env: { ...process.env, HTTP_PROXY: proxyUrl },
          windowsHide: true
        }
      )
      const result = JSON.parse(stdout)
      assert.equal(result.allowed.status, 200)
      assert.equal(result.denied.status, 200)
      assert.equal(headers.length, 2)
      for (const requestHeaders of headers) {
        assert.equal(requestHeaders['proxy-authorization'], expected)
        assert.equal(requestHeaders.authorization, undefined)
      }
      assert.equal((stdout + stderr).includes('fake-token'), false)
      assert.equal((stdout + stderr).includes(expected), false)
    } finally {
      if (proxy.listening) await new Promise((resolve) => proxy.close(resolve))
    }
  }
)

test(
  'network timeout is a distinct observation and never hangs on a stalled proxy',
  budget,
  async () => {
    const proxy = http.createServer(() => {})
    const connections = new Set()
    proxy.on('connection', (socket) => {
      connections.add(socket)
      socket.on('close', () => connections.delete(socket))
    })
    try {
      const proxyPort = await listen(proxy)
      const options = {
        allowedUrl: 'http://localhost:1234/a',
        deniedUrl: 'http://localhost:1234/b',
        directIPv4: { host: '127.0.0.1', port: proxyPort },
        directIPv6: { host: '::1', port: proxyPort },
        timeoutMs: 50
      }
      const { stdout } = await exec(
        process.execPath,
        [probePath, 'network', JSON.stringify(options)],
        {
          env: { ...process.env, HTTP_PROXY: `http://127.0.0.1:${proxyPort}` },
          windowsHide: true
        }
      )
      const result = JSON.parse(stdout)
      assert.deepEqual(result.allowed, { ok: false, errorCode: 'ETIMEDOUT' })
      assert.deepEqual(result.denied, { ok: false, errorCode: 'ETIMEDOUT' })
      assert.equal(result.directIPv6.connected, false)
      assert.ok(['ECONNREFUSED', 'ETIMEDOUT'].includes(result.directIPv6.errorCode))
    } finally {
      for (const socket of connections) socket.destroy()
      if (proxy.listening) await new Promise((resolve) => proxy.close(resolve))
    }
  }
)

test(
  'imported child probe stop closes its entire nested fixture before lifetime expires',
  budget,
  async () => {
    const result = await runProbe('child', { depth: 2, lifetimeMs: 4000 })
    result.stop()
    const outcome = await Promise.race([
      result.exited.then(() => 'closed'),
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve('still-running'), 1000)
        timer.unref()
      })
    ])
    assert.equal(outcome, 'closed')
    for (const pid of result.observation.pids.slice(1)) assert.throws(() => process.kill(pid, 0))
  }
)

test('child mode emits a live nested PID chain, then all levels expire', budget, async () => {
  const child = spawn(
    process.execPath,
    [probePath, 'child', JSON.stringify({ depth: 2, lifetimeMs: 500 })],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  )
  const closed = once(child, 'close')
  let text = ''
  for await (const chunk of child.stdout) {
    text += chunk
    if (text.includes('\n')) break
  }
  const result = JSON.parse(text)
  assert.equal(result.mode, 'child')
  assert.equal(result.pids.length, 3)
  assert.equal(result.pids[0], child.pid)
  assert.equal(new Set(result.pids).size, 3)
  for (const pid of result.pids) assert.doesNotThrow(() => process.kill(pid, 0))
  assert.deepEqual(await closed, [0, null])
  for (const pid of result.pids) assert.throws(() => process.kill(pid, 0))
})

test('independent descendants survive killing only their probe root', budget, async () => {
  const cleanupErrors = []
  const child = spawn(
    process.execPath,
    [
      probePath,
      'child',
      JSON.stringify({
        depth: 2,
        lifetimeMs: 120_000,
        independentDescendants: true
      })
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  )
  const closed = once(child, 'close')
  const descendants = []
  child.stderr.resume()
  try {
    let text = ''
    for await (const chunk of child.stdout) {
      text += chunk
      if (text.includes('\n')) break
    }
    const result = JSON.parse(text)
    assert.equal(result.pids[0], child.pid)
    assert.equal(result.pids.length, 3)
    descendants.push(...result.pids.slice(1))
    for (const pid of descendants) assert.doesNotThrow(() => process.kill(pid, 0))
    child.kill('SIGKILL')
    await closed
    // Give an accidental parent-EOF cleanup enough time to finish before observing survival.
    await new Promise((resolve) => setTimeout(resolve, 600))
    for (const pid of descendants) assert.doesNotThrow(() => process.kill(pid, 0))
  } finally {
    // Only PIDs returned by this owned fixture are eligible for explicit cleanup.
    for (const pid of descendants.reverse()) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') cleanupErrors.push(error.code)
      }
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await closed
  }
  assert.deepEqual(cleanupErrors, [])
})

test('child lifetime/depth and control booleans reject malformed options before spawning', async () => {
  for (const options of [
    { depth: 5 },
    { lifetimeMs: 120_001 },
    { independentDescendants: 'true' },
    { independentDescendants: 1 },
    { independentDescendants: null },
    { parentControlled: 'false' }
  ]) {
    await assert.rejects(
      runProbe('child', { depth: 0, lifetimeMs: 100, ...options }),
      /invalid_(integer|boolean)/
    )
  }
})

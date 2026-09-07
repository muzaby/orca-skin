// SRT P0 fixture. This observes real access; it never declares a sandbox policy passed.
// CLI: node sandbox-probe.mjs <echo|fs|network|child> '<JSON options>'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const marker = 'orca-srt-probe-v1'
const scriptPath = fileURLToPath(import.meta.url)
const modes = new Set(['echo', 'fs', 'network', 'child'])

function fail(code) {
  throw new Error(code)
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_options')
  return value
}

function integer(value, fallback, min, max) {
  const actual = value ?? fallback
  if (!Number.isInteger(actual) || actual < min || actual > max) fail('invalid_integer')
  return actual
}

function boolean(value, fallback = false) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') fail('invalid_boolean')
  return value
}

function absolute(value) {
  if (typeof value !== 'string' || value.includes('\0') || !path.isAbsolute(value))
    fail('invalid_path')
  return value
}

function errorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
    ? error.code
    : 'PROBE_OPERATION_FAILED'
}

export function parseProbeArgs(argv) {
  if (argv.length > 2) fail('invalid_arguments')
  const mode = argv[0] ?? 'echo'
  if (!modes.has(mode)) fail('unknown_mode')
  if ((argv[1]?.length ?? 0) > 65_536) fail('options_too_large')
  let options
  try {
    options = argv[1] === undefined ? {} : JSON.parse(argv[1])
  } catch {
    fail('invalid_json')
  }
  return { mode, options: object(options) }
}

export function echoProbe(options = {}) {
  const args = options.args ?? []
  if (!Array.isArray(args) || args.length > 4096 || args.some((arg) => typeof arg !== 'string')) {
    fail('invalid_echo_args')
  }
  return {
    mode: 'echo',
    marker,
    argv: args,
    cwd: process.cwd(),
    // Only the documented fake fixture variable may be echoed. Never enumerate process.env.
    env:
      process.env.ORCA_SANDBOX_TEST === undefined
        ? {}
        : { ORCA_SANDBOX_TEST: process.env.ORCA_SANDBOX_TEST }
  }
}

async function observe(operation) {
  try {
    const result = await operation()
    return { ok: true, ...(result ?? {}) }
  } catch (error) {
    return { ok: false, errorCode: errorCode(error) }
  }
}

export async function filesystemProbe(options) {
  const allowRoot = absolute(options.allowRoot)
  const denyReadFile = absolute(options.denyReadFile)
  const denyWriteFile = absolute(options.denyWriteFile)
  const allowFile = path.join(allowRoot, `orca-srt-probe-${randomUUID()}.txt`)
  const create = (file) => writeFile(file, marker, { flag: 'wx' })
  const read = async (file) => ({ bytes: (await readFile(file)).length })
  const allowWrite = await observe(() => create(allowFile))
  const allowRead = await observe(() => read(allowFile))
  const denyRead = await observe(() => read(denyReadFile))
  // Exclusive creation: an unexpected grant must not overwrite an existing fixture.
  // EEXIST/ENOENT are observations, not evidence that policy denied access.
  const denyWrite = await observe(() => create(denyWriteFile))
  return { mode: 'fs', allowFile, allowWrite, allowRead, denyRead, denyWrite }
}

function loopbackUrl(value, allowProxyAuth = false) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail('invalid_url')
  }
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    (!allowProxyAuth && (url.username || url.password)) ||
    url.hash
  )
    fail('invalid_loopback_url')
  return url
}

function endpoint(value, host) {
  object(value)
  if (value.host !== host) fail('invalid_direct_host')
  return { host, port: integer(value.port, undefined, 1, 65535) }
}

function proxyRequest(proxy, target, timeoutMs) {
  const proxyEndpoint = new URL(proxy)
  const headers = { Host: target.host }
  if (proxy.username || proxy.password) {
    let credentials
    try {
      credentials = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
    } catch {
      fail('invalid_proxy_auth')
    }
    headers['Proxy-Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`
  }
  // Node URL auth would otherwise become origin Authorization, not proxy credentials.
  proxyEndpoint.username = ''
  proxyEndpoint.password = ''
  return new Promise((resolve) => {
    let settled = false
    let timer
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const req = http.request(
      proxyEndpoint,
      {
        method: 'GET',
        path: target.href,
        headers,
        agent: false
      },
      (res) => {
        const status = res.statusCode ?? 0
        finish({ ok: status >= 200 && status < 300, status })
        // Bodies are irrelevant to the policy result and must never be printed or buffered.
        res.destroy()
      }
    )
    req.on('error', (error) => finish({ ok: false, errorCode: errorCode(error) }))
    timer = setTimeout(() => {
      finish({ ok: false, errorCode: 'ETIMEDOUT' })
      req.destroy()
    }, timeoutMs)
    req.end()
  })
}

function directConnect(target, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection(target)
    const timer = setTimeout(() => finish({ connected: false, errorCode: 'ETIMEDOUT' }), timeoutMs)
    let settled = false
    function finish(result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(result)
    }
    socket.once('connect', () => finish({ connected: true }))
    socket.once('error', (error) => finish({ connected: false, errorCode: errorCode(error) }))
  })
}

export async function networkProbe(options) {
  const allowedUrl = loopbackUrl(options.allowedUrl)
  const deniedUrl = loopbackUrl(options.deniedUrl)
  const ipv4 = endpoint(options.directIPv4, '127.0.0.1')
  const ipv6 = endpoint(options.directIPv6, '::1')
  const timeoutMs = integer(options.timeoutMs, 3000, 25, 30_000)
  const proxyValue = process.env.HTTP_PROXY ?? process.env.http_proxy
  if (!proxyValue) fail('proxy_missing')
  const proxy = loopbackUrl(proxyValue, true)
  // Intentionally explicit proxy routing, including localhost. NO_PROXY cannot bypass this test.
  const [allowed, denied, directIPv4, directIPv6] = await Promise.all([
    proxyRequest(proxy, allowedUrl, timeoutMs),
    proxyRequest(proxy, deniedUrl, timeoutMs),
    directConnect(ipv4, timeoutMs),
    directConnect(ipv6, timeoutMs)
  ])
  return { mode: 'network', allowed, denied, directIPv4, directIPv6 }
}

// Returns a live observation plus an awaitable lifetime. CLI prints observation before waiting.
export async function startChildProbe(options = {}) {
  object(options)
  const depth = integer(options.depth, 2, 0, 4)
  const lifetimeMs = integer(options.lifetimeMs, 30_000, 100, 120_000)
  const independentDescendants = boolean(options.independentDescendants)
  const parentControlled = boolean(options.parentControlled)
  // Job cleanup probes must survive parent EOF; otherwise graceful cascading can mimic job cleanup.
  const watchParent = parentControlled && !independentDescendants
  let child
  let childExit
  let descendants = []
  if (depth > 0) {
    child = spawn(
      process.execPath,
      [
        scriptPath,
        'child',
        JSON.stringify({
          depth: depth - 1,
          lifetimeMs,
          parentControlled: true,
          independentDescendants
        })
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Avoid Node's own parent-lifetime job; libuv does not request CREATE_BREAKAWAY_FROM_JOB.
        detached: independentDescendants,
        windowsHide: true
      }
    )
    childExit = once(child, 'close')
    // Catch early errors until the readiness reader has completed.
    childExit.catch(() => {})
    const line = await new Promise((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('child_start_timeout'))
      }, 5000)
      child.once('error', () => {
        clearTimeout(timer)
        reject(new Error('child_start_failed'))
      })
      child.once('exit', () => {
        clearTimeout(timer)
        reject(new Error('child_exited_before_ready'))
      })
      child.stdout.on('data', (data) => {
        output += data.toString('utf8')
        if (output.length > 4096) {
          clearTimeout(timer)
          child.kill()
          reject(new Error('child_output_limit'))
          return
        }
        if (output.includes('\n')) {
          clearTimeout(timer)
          resolve(output.slice(0, output.indexOf('\n')))
        }
      })
      child.stderr.resume()
    })
    try {
      descendants = JSON.parse(line).pids
    } catch {
      child.kill()
      fail('child_invalid_result')
    }
  }
  let finish
  const deadline = new Promise((resolve) => {
    finish = resolve
  })
  const timer = setTimeout(finish, lifetimeMs)
  const stop = () => {
    clearTimeout(timer)
    child?.stdin.end()
    finish()
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  if (watchParent) {
    process.stdin.once('end', stop)
    process.stdin.resume()
  }
  const exited = deadline
    .then(async () => {
      if (child) {
        child.stdin.end()
        const [code] = await childExit
        if (code !== 0) fail('nested_child_failed')
      }
    })
    .finally(() => {
      clearTimeout(timer)
      process.removeListener('SIGTERM', stop)
      process.removeListener('SIGINT', stop)
      if (watchParent) {
        process.stdin.removeListener('end', stop)
        process.stdin.pause()
      }
    })
  return { observation: { mode: 'child', pids: [process.pid, ...descendants] }, exited, stop }
}

export async function runProbe(mode, options = {}) {
  object(options)
  if (mode === 'echo') return echoProbe(options)
  if (mode === 'fs') return filesystemProbe(options)
  if (mode === 'network') return networkProbe(options)
  if (mode === 'child') return startChildProbe(options)
  fail('unknown_mode')
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const { mode, options } = parseProbeArgs(process.argv.slice(2))
    const result = await runProbe(mode, options)
    if (mode === 'child') {
      process.stdout.write(`${JSON.stringify(result.observation)}\n`)
      await result.exited
    } else {
      process.stdout.write(`${JSON.stringify(result)}\n`)
    }
  } catch (error) {
    // Only our fixed diagnosis code, never JSON input, URLs, file contents or environment values.
    const code = /^[a-z_]+$/.test(error?.message) ? error.message : 'probe_failed'
    process.stderr.write(`${code}\n`)
    process.exitCode = 1
  }
}

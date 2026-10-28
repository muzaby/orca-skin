import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OpenCodeMcpControl } from './mcp-control'
import { OpenCodeComposerCache } from './composer-cache'
import { openCodeDiscovery } from './discovery-cache'

let cwd: string
let controller: AbortController
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'orca-connection-'))
  controller = new AbortController()
  openCodeDiscovery.invalidate()
})
afterEach(async () => {
  controller.abort()
  vi.useRealTimers()
  openCodeDiscovery.invalidate()
  await rm(cwd, { recursive: true, force: true })
})

function fixture(
  defaults: Record<string, boolean>,
  initialGlobal: Record<string, boolean> = {},
  managed: Record<string, boolean> = {}
): {
  control: OpenCodeMcpControl
  states: Record<string, { status: string }>
  gates: Map<string, ReturnType<typeof Promise.withResolvers<void>>>
  failures: Set<string>
  reads: ReturnType<typeof Promise.withResolvers<void>>[]
  requests: string[]
  global: Record<string, boolean>
  managed: Record<string, boolean>
  busy(value: boolean): void
} {
  const states = Object.fromEntries(Object.keys(defaults).map((id) => [id, { status: 'disabled' }]))
  const gates = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>()
  const failures = new Set<string>()
  const reads: ReturnType<typeof Promise.withResolvers<void>>[] = []
  const requests: string[] = []
  const global = initialGlobal
  let busy = false
  const client = createOpencodeClient({
    baseUrl: 'http://fixture.test',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      const path = new URL(request.url).pathname
      requests.push(path)
      if (path === '/mcp') {
        const snapshot = structuredClone(states)
        const hold = reads.shift()
        if (hold) await hold.promise
        return Response.json(snapshot)
      }
      const id = decodeURIComponent(path.split('/')[2])
      if (gates.has(id)) await gates.get(id)!.promise
      if (failures.has(id)) return Response.json({ message: 'failure' }, { status: 503 })
      states[id] = { status: path.endsWith('/connect') ? 'connected' : 'disabled' }
      return Response.json(true)
    }
  })
  const cache = new OpenCodeComposerCache(client, cwd, controller.signal)
  const control = new OpenCodeMcpControl(
    client,
    cwd,
    { global: () => global },
    controller.signal,
    cache,
    { choices: () => managed },
    () => !busy,
    defaults
  )
  return {
    control,
    states,
    gates,
    failures,
    reads,
    requests,
    global,
    managed,
    busy: (value: boolean) => {
      busy = value
    }
  }
}

it('activates directories connects desired MCPs independently and admits submissions within the bound', async () => {
  await writeFile(
    join(cwd, 'opencode.json'),
    JSON.stringify({ mcp: { project: { enabled: true }, managed: { enabled: false } } })
  )
  const f = fixture(
    { slow: true, fast: true, global: true, project: false, managed: false },
    { 'mcp:global': false, 'mcp:project': false },
    { managed: true }
  )
  const slow = Promise.withResolvers<void>()
  f.gates.set('slow', slow)
  expect(await f.control.read(controller.signal)).toEqual([])
  await f.control.reconcileChoices()
  expect(f.requests).toEqual([])
  // Initial additive activation is allowed even while a response is active.
  f.busy(true)
  await f.control.prepare()
  expect(await f.control.pending()).toBe(false)
  await vi.waitFor(() => expect(f.control.connected('fast')).toBe(true))
  expect(f.requests.filter((path) => path.endsWith('/connect')).sort()).toEqual([
    '/mcp/fast/connect',
    '/mcp/managed/connect',
    '/mcp/project/connect',
    '/mcp/slow/connect'
  ])
  f.busy(false)
  await f.control.reconcileChoices()
  expect(await f.control.pending()).toBe(false)
  expect(
    (await f.control.read(controller.signal)).find((item) => item.id === 'slow')
  ).toMatchObject({
    status: 'pending',
    enabled: true,
    canToggle: false
  })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const send = vi.fn(async () => 'accepted')
  const submitted = f.control.submit(controller.signal, send)
  await vi.advanceTimersByTimeAsync(1999)
  expect(send).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(send).toHaveBeenCalledOnce()
  expect(await submitted).toBe('accepted')
  // A shared status flight crossing completion is successful and is not cached as fresh.
  const reading = Promise.withResolvers<void>()
  f.reads.push(reading)
  const observed = f.control.read(controller.signal, true)
  await vi.advanceTimersByTimeAsync(0)
  slow.resolve()
  await vi.advanceTimersByTimeAsync(0)
  reading.resolve()
  expect((await observed).find((item) => item.id === 'slow')?.status).toBe('connected')
  expect((await f.control.read(controller.signal)).find((item) => item.id === 'slow')?.status).toBe(
    'connected'
  )
  await f.control.prepare()
  expect(f.requests.filter((path) => path === '/mcp/slow/connect')).toHaveLength(1)
  controller.abort()
  expect(() => f.control.read(new AbortController().signal)).toThrow()
})

it('settles mentioned connections and cancels admission without cancelling a shared attempt', async () => {
  const f = fixture({ slow: true, failed: true })
  const slow = Promise.withResolvers<void>()
  f.gates.set('slow', slow)
  f.failures.add('failed')
  await f.control.prepare()
  await vi.waitFor(() => expect(f.requests).toContain('/mcp/failed/connect'))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const caller = new AbortController(),
    send = vi.fn(async () => {})
  const pending = f.control.submit(caller.signal, send, ['slow'])
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(5000)
  expect(send).not.toHaveBeenCalled()
  caller.abort()
  await rejected
  const next = f.control.submit(controller.signal, send, ['slow', 'failed'])
  await vi.advanceTimersByTimeAsync(2000)
  expect(send).not.toHaveBeenCalled()
  slow.resolve()
  await vi.advanceTimersByTimeAsync(0)
  await next
  expect(send).toHaveBeenCalledOnce()
  expect(f.control.connected('failed')).toBe(false)
  expect(await f.control.pending()).toBe(false)
  expect(f.requests.filter((path) => path === '/mcp/slow/connect')).toHaveLength(1)
})

it('defers toggle mutations while busy and blocks submission on removal failure but not connect failure', async () => {
  const f = fixture({ tool: true, other: false })
  await f.control.prepare()
  await vi.waitFor(() => expect(f.control.connected('tool')).toBe(true))
  await f.control.reconcileChoices()
  f.busy(true)
  f.global['mcp:tool'] = false
  f.global['mcp:other'] = true
  await f.control.reconcileChoices()
  expect(f.requests).not.toContain('/mcp/tool/disconnect')
  expect(f.requests).not.toContain('/mcp/other/connect')
  expect(await f.control.pending()).toBe(true)
  f.busy(false)
  f.failures.add('tool')
  const send = vi.fn(async () => {})
  await expect(f.control.submit(controller.signal, send)).rejects.toThrow()
  expect(send).not.toHaveBeenCalled()
  expect(await f.control.pending()).toBe(true)
  f.failures.delete('tool')
  f.failures.add('other')
  await f.control.submit(controller.signal, send)
  expect(send).toHaveBeenCalledOnce()
  expect(f.states.tool.status).toBe('disabled')
  expect(f.control.connected('other')).toBe(false)
  expect(
    (await f.control.read(controller.signal)).find((item) => item.id === 'other')
  ).toMatchObject({ status: 'failed', enabled: true, canToggle: false })
  expect(await f.control.pending()).toBe(false)
  const attempts = f.requests.filter((path) => path === '/mcp/other/connect').length
  await f.control.submit(controller.signal, send)
  expect(f.requests.filter((path) => path === '/mcp/other/connect')).toHaveLength(attempts)
  f.failures.delete('other')
  await f.control.read(controller.signal, true)
  await vi.waitFor(() => expect(f.control.connected('other')).toBe(true))
  expect(f.requests.filter((path) => path === '/mcp/other/connect')).toHaveLength(attempts + 1)
})

it('rechecks removal when choices change during the bounded admission wait', async () => {
  const f = fixture({ slow: true, tool: true })
  const slow = Promise.withResolvers<void>()
  f.gates.set('slow', slow)
  await f.control.prepare()
  await vi.waitFor(() => expect(f.control.connected('tool')).toBe(true))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const send = vi.fn(async () => {})
  const submitted = f.control.submit(controller.signal, send)
  const failed = expect(submitted).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(1000)
  f.global['mcp:tool'] = false
  f.failures.add('tool')
  await vi.advanceTimersByTimeAsync(1000)
  await failed
  expect(f.requests).toContain('/mcp/tool/disconnect')
  expect(send).not.toHaveBeenCalled()
  slow.resolve()
})

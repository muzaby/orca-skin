import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { OpenCodeComposerCache } from './composer-cache'
import { openCodeDiscovery } from './discovery-cache'
import { OpenCodeMcpControl } from './mcp-control'

let cwd: string
let controller: AbortController
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'orcinus-orca-connection-'))
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

it('holds every explicit ON past the old bound, including ordinary submissions; busy peers suppress activation and read retries', async () => {
  const f = fixture({ slow: false, fast: false }, { 'mcp:slow': true, 'mcp:fast': true })
  const gate = Promise.withResolvers<void>()
  f.gates.set('slow', gate)
  f.busy(true)
  f.control.activate()
  await f.control.read(controller.signal, true)
  await f.control.reconcileChoices()
  expect(f.requests.filter((path) => path.endsWith('/connect'))).toEqual([])
  f.busy(false)
  await f.control.reconcileChoices()
  await vi.waitFor(() => expect(f.control.connected('fast')).toBe(true))
  expect((await f.control.read(controller.signal)).find((item) => item.id === 'slow')?.status).toBe(
    'pending'
  )
  vi.useFakeTimers()
  const send = vi.fn(async () => 'sent')
  const admitted = f.control.submit(controller.signal, send)
  await vi.advanceTimersByTimeAsync(4000)
  expect(send).not.toHaveBeenCalled()
  gate.resolve()
  await expect(admitted).resolves.toBe('sent')
  expect(send).toHaveBeenCalledOnce()
  expect(f.requests.filter((path) => path === '/mcp/slow/connect')).toHaveLength(1)
})

it('cancels one caller without cancelling the shared attempt or sending the cancelled input', async () => {
  const f = fixture({ slow: true }, { 'mcp:slow': true })
  const gate = Promise.withResolvers<void>()
  f.gates.set('slow', gate)
  const signal = new AbortController()
  const cancelled = vi.fn(async () => {})
  const send = vi.fn(async () => {})
  const first = expect(f.control.submit(signal.signal, cancelled)).rejects.toMatchObject({
    name: 'AbortError'
  })
  const second = f.control.submit(controller.signal, send)
  await vi.waitFor(() => expect(f.requests).toContain('/mcp/slow/connect'))
  signal.abort()
  await first
  expect(send).not.toHaveBeenCalled()
  gate.resolve()
  await second
  expect(send).toHaveBeenCalledOnce()
  expect(cancelled).not.toHaveBeenCalled()
  expect(f.requests.filter((path) => path === '/mcp/slow/connect')).toHaveLength(1)
})

it('rejects ordinary submissions on explicit ON or OFF failure and retries the same selection', async () => {
  const f = fixture({ tool: true, other: false }, { 'mcp:tool': true })
  const send = vi.fn(async () => {})
  await f.control.submit(controller.signal, send)
  expect(f.control.connected('tool')).toBe(true)
  send.mockClear()
  f.busy(true)
  f.global['mcp:tool'] = false
  f.global['mcp:other'] = true
  await f.control.reconcileChoices()
  expect(f.requests).not.toContain('/mcp/tool/disconnect')
  f.busy(false)
  f.failures.add('tool')
  await expect(f.control.submit(controller.signal, send)).rejects.toThrow('해제')
  expect(send).not.toHaveBeenCalled()
  f.failures.delete('tool')
  f.failures.add('other')
  await expect(f.control.submit(controller.signal, send)).rejects.toThrow('연결')
  expect(f.states.tool.status).toBe('disabled')
  expect(
    (await f.control.read(controller.signal)).find((item) => item.id === 'other')
  ).toMatchObject({ status: 'failed', enabled: true })
  expect(send).not.toHaveBeenCalled()
  f.failures.delete('other')
  await f.control.submit(controller.signal, send)
  expect(send).toHaveBeenCalledOnce()
  expect(f.control.connected('other')).toBe(true)
})

it('rechecks OFF saved during a slow connect before accepting the original input once', async () => {
  const f = fixture({ slow: false }, { 'mcp:slow': true })
  const gate = Promise.withResolvers<void>()
  f.gates.set('slow', gate)
  const send = vi.fn(async () => {
    expect(f.states.slow.status).toBe('disabled')
  })
  const admitted = f.control.submit(controller.signal, send)
  await vi.waitFor(() => expect(f.requests).toContain('/mcp/slow/connect'))
  f.global['mcp:slow'] = false
  gate.resolve()
  await admitted
  expect(f.requests.filter((path) => path.endsWith('/disconnect'))).toEqual([
    '/mcp/slow/disconnect'
  ])
  expect(send).toHaveBeenCalledOnce()
})

it('re-observes a dropped ON and an externally reconnected OFF before the next SDK submission', async () => {
  const f = fixture({ tool: true }, { 'mcp:tool': true })
  await f.control.submit(controller.signal, async () => {})
  f.states.tool.status = 'disabled'
  await f.control.submit(controller.signal, async () => {
    expect(f.states.tool.status).toBe('connected')
  })
  expect(f.requests.filter((path) => path === '/mcp/tool/connect')).toHaveLength(2)
  f.global['mcp:tool'] = false
  await f.control.reconcileChoices()
  f.states.tool.status = 'connected'
  await f.control.submit(controller.signal, async () => {
    expect(f.states.tool.status).toBe('disabled')
  })
  expect(f.requests.filter((path) => path === '/mcp/tool/disconnect')).toHaveLength(2)
})

it('allows an ordinary message after the bounded wait for an unselected directory default', async () => {
  const f = fixture({ optional: true })
  const gate = Promise.withResolvers<void>()
  f.gates.set('optional', gate)
  try {
    await f.control.submit(controller.signal, async () => {
      expect(f.states.optional.status).toBe('disabled')
    })
  } finally {
    gate.resolve()
  }
})

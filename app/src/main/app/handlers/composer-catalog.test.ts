import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ComposerCatalogLease, ComposerCatalogRequest } from '../../../shared/composer-catalog'
import type { NativeComposerCatalog } from '../../../shared/native-resources'
const callbacks = vi.hoisted(
  () => new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
)
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: (event: unknown, payload: unknown) => Promise<unknown>) =>
      callbacks.set(name, fn)
  }
}))
import { registerComposerCatalogHandlers } from './composer-catalog'

class Sender extends EventEmitter {
  readonly send = vi.fn()
  constructor(readonly id: number) {
    super()
  }
  isDestroyed(): boolean {
    return false
  }
}
const request = (): ComposerCatalogRequest => ({
  owner: randomUUID(),
  part: 'agents',
  scope: {
    backend: 'opencode',
    sessionId: null,
    cwd: 'C:/B',
    projectId: 'project-B',
    providerKey: 'opencode-team',
    agentKind: 'code'
  }
})
function lease(): {
  value: ComposerCatalogLease
  control: AbortController
  release: ReturnType<typeof vi.fn<() => Promise<void>>>
} {
  const control = new AbortController()
  const data: NativeComposerCatalog = {
    agents: [{ name: 'Atlas' }],
    models: [{ id: 'team/fast', variants: ['deep'] }]
  }
  const release = vi.fn(async () => undefined)
  const value: ComposerCatalogLease = {
    generation: randomUUID(),
    signal: control.signal,
    read: async (part) => data[part],
    release
  }
  return { value, control, release }
}
const call = (
  sender: Sender,
  payload: unknown,
  channel: string = CHANNELS.composerCatalog
): Promise<unknown> => callbacks.get(channel)!({ sender }, payload)
beforeEach(() => callbacks.clear())

it('shares pending acquisition for parts, isolates windows, and releases on navigation/crash/shutdown', async () => {
  const a = lease(),
    b = lease()
  const gate = Promise.withResolvers<ComposerCatalogLease>()
  const prepare = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValueOnce(b.value)
  const close = registerComposerCatalogHandlers(prepare)
  const one = new Sender(1),
    two = new Sender(2),
    req = request()
  try {
    const agents = call(one, req)
    const models = call(one, { ...req, part: 'models' })
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    expect(prepare.mock.calls[0][0]).toEqual(req.scope)
    gate.resolve(a.value)
    expect(await agents).toEqual({
      part: 'agents',
      value: [{ name: 'Atlas' }],
      generation: a.value.generation
    })
    expect(await models).toMatchObject({
      part: 'models',
      value: [{ id: 'team/fast', variants: ['deep'] }]
    })
    await call(two, { owner: req.owner }, CHANNELS.composerCatalogRelease)
    expect(a.release).not.toHaveBeenCalled()
    await call(two, req)
    expect(prepare).toHaveBeenCalledTimes(2)
    one.emit('did-start-navigation', {}, 'url', true, true)
    expect(a.release).not.toHaveBeenCalled()
    one.emit('did-start-navigation', {}, 'url', false, true)
    expect(a.release).toHaveBeenCalledTimes(1)
    two.emit('render-process-gone')
    expect(b.release).toHaveBeenCalledTimes(1)
  } finally {
    close()
  }
})

it('releases acquisitions completing after close and rejects stale requests without exposing native errors', async () => {
  const owned = lease(),
    gate = Promise.withResolvers<ComposerCatalogLease>()
  const prepare = vi.fn<Parameters<typeof registerComposerCatalogHandlers>[0]>(() => gate.promise)
  const close = registerComposerCatalogHandlers(prepare)
  const sender = new Sender(3),
    req = request()
  const result = call(sender, req).catch((error: unknown) => error)
  await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
  await call(sender, { owner: req.owner }, CHANNELS.composerCatalogRelease)
  expect(prepare.mock.calls[0]![1].aborted).toBe(true)
  gate.resolve(owned.value)
  expect(String(await result)).toContain('목록을 불러오지 못했습니다')
  expect(owned.release).toHaveBeenCalledTimes(1)
  close()
})

it('reports a dead native generation and reacquires only on explicit retry', async () => {
  const a = lease(),
    b = lease(),
    sender = new Sender(4),
    req = request()
  const prepare = vi.fn().mockResolvedValueOnce(a.value).mockResolvedValueOnce(b.value)
  const close = registerComposerCatalogHandlers(prepare)
  try {
    await call(sender, req)
    a.control.abort()
    expect(sender.send).toHaveBeenCalledWith(CHANNELS.composerCatalogInvalidated, {
      owner: req.owner,
      generation: a.value.generation
    })
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(await call(sender, { ...req, refresh: true })).toMatchObject({
      generation: b.value.generation
    })
    expect(a.release).toHaveBeenCalledTimes(1)
    await expect(
      call(sender, { ...req, scope: { ...req.scope, cwd: 'C:/wrong' } })
    ).rejects.toThrow()
  } finally {
    close()
  }
  expect(b.release).toHaveBeenCalledTimes(1)
})

it('validates directory and owner before preparation, then retries failed setup', async () => {
  const owned = lease(),
    sender = new Sender(5),
    req = request()
  const prepare = vi
    .fn()
    .mockRejectedValueOnce(new Error('SECRET config'))
    .mockResolvedValueOnce(owned.value)
  const close = registerComposerCatalogHandlers(prepare)
  try {
    await expect(
      call(sender, { ...req, scope: { ...req.scope, cwd: 'relative' } })
    ).rejects.toThrow()
    await expect(call(sender, { ...req, owner: 'invalid' })).rejects.toThrow()
    expect(prepare).not.toHaveBeenCalled()
    await expect(call(sender, req)).rejects.toThrow('OpenCode 목록')
    expect(await call(sender, req)).toMatchObject({ part: 'agents' })
  } finally {
    close()
  }
})

it('refresh re-resolves and keeps old owner until replacement is ready', async () => {
  const a = lease(),
    b = lease(),
    sender = new Sender(6),
    req = request()
  const replacement = Promise.withResolvers<ComposerCatalogLease>()
  const disposal = Promise.withResolvers<void>()
  a.release.mockReturnValue(disposal.promise)
  const prepare = vi
    .fn()
    .mockResolvedValueOnce(a.value)
    .mockReturnValueOnce(replacement.promise)
    .mockRejectedValueOnce(new Error('config unavailable'))
  const close = registerComposerCatalogHandlers(prepare)
  try {
    await call(sender, req)
    const agents = call(sender, { ...req, refresh: true })
    const models = call(sender, { ...req, part: 'models', refresh: true })
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(2))
    expect(a.release).not.toHaveBeenCalled()
    replacement.resolve(b.value)
    expect(await agents).toMatchObject({ generation: b.value.generation })
    expect(await models).toMatchObject({ generation: b.value.generation })
    expect(a.release).toHaveBeenCalledTimes(1)
    await expect(call(sender, { ...req, refresh: true })).rejects.toThrow('목록')
    expect(await call(sender, req)).toMatchObject({ generation: b.value.generation })
    expect(b.release).not.toHaveBeenCalled()
  } finally {
    disposal.resolve()
    close()
  }
})

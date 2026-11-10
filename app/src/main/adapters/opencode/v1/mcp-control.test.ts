import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { OpenCodeMcpControl } from './mcp-control'

it('applies restored choices once per new directory and preserves project overrides and existing instances', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-mcp-choices-'))
  const a = join(root, 'A'),
    b = join(root, 'B')
  await mkdir(a)
  await mkdir(b)
  const file = join(a, 'opencode.json')
  const contents = '{"mcp":{"project":{"enabled":true}}}'
  await writeFile(file, contents)
  let choices = { 'mcp:docs': false, 'mcp:disabled': true, 'mcp:project': false }
  const control = { global: () => ({ ...choices }) }
  const states = new Map<string, Record<string, { status: string }>>()
  const state = (directory: string): Record<string, { status: string }> => {
    let value = states.get(directory)
    if (!value)
      states.set(
        directory,
        (value = {
          docs: { status: 'connected' },
          disabled: { status: 'disabled' },
          project: { status: 'connected' }
        })
      )
    return value
  }
  const status = vi.fn(async ({ directory }: { directory: string }) => ({
    data: structuredClone(state(directory))
  }))
  const connect = vi.fn(async ({ directory, name }: { directory: string; name: string }) => {
    state(directory)[name] = { status: 'connected' }
    return {}
  })
  const disconnect = vi.fn(async ({ directory, name }: { directory: string; name: string }) => {
    state(directory)[name] = { status: 'disabled' }
    return {}
  })
  const client = { mcp: { status, connect, disconnect } } as unknown as OpencodeClient
  const signal = new AbortController().signal
  try {
    const old = new OpenCodeMcpControl(client, a, control, signal)
    old.activate()
    await old.pending()
    await old.reconcileChoices()
    expect(connect.mock.calls.map(([params]) => params)).toEqual([
      { directory: a, name: 'disabled' },
      { directory: a, name: 'project' }
    ])
    expect(disconnect.mock.calls.map(([params]) => params)).toEqual([
      { directory: a, name: 'docs' }
    ])
    choices = { 'mcp:docs': true, 'mcp:disabled': false, 'mcp:project': true }
    old.activate()
    await old.pending()
    const next = new OpenCodeMcpControl(client, b, control, signal)
    next.activate()
    await next.pending()
    await next.reconcileChoices()
    expect(
      await old.preview([
        {
          id: 'docs',
          name: 'docs',
          kind: 'mcp',
          enabled: false,
          canToggle: false,
          status: 'disabled'
        }
      ])
    ).toMatchObject([{ enabled: true, status: 'disabled' }])
    expect(await old.pending()).toBe(true)
    await old.reconcileChoices()
    expect(await old.pending()).toBe(false)
    expect(state(a).docs.status).toBe('connected')
    expect(state(a).project.status).toBe('connected')
    expect(connect).toHaveBeenCalledTimes(5)
    expect(disconnect).toHaveBeenCalledTimes(2)
    expect(await readFile(file, 'utf8')).toBe(contents)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('wakes unsafe admission immediately on activity signals and cleans up aborted waits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-activity-admission-'))
  const controller = new AbortController()
  const client = {
    mcp: {
      status: async () => ({ data: {} }),
      connect: async () => ({}),
      disconnect: async () => ({})
    }
  } as unknown as OpencodeClient
  let idle = false
  const control = new OpenCodeMcpControl(
    client,
    root,
    { global: () => ({}) } as never,
    controller.signal,
    undefined,
    undefined,
    () => idle
  )
  const action = vi.fn(async () => 'sent')
  try {
    control.activate()
    await control.pending()
    vi.useFakeTimers()
    const pending = control.submit(controller.signal, action)
    for (let i = 0; i < 30; i++) await Promise.resolve()
    expect(action).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    idle = true
    control.resourceActivityChanged()
    expect(await pending).toBe('sent')
    expect(action).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    idle = false
    const abort = new AbortController()
    const rejected = control.submit(abort.signal, action)
    const assertion = expect(rejected).rejects.toMatchObject({ name: 'AbortError' })
    for (let i = 0; i < 30; i++) await Promise.resolve()
    abort.abort()
    await assertion
    expect(action).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
    controller.abort()
    await rm(root, { recursive: true, force: true })
  }
})

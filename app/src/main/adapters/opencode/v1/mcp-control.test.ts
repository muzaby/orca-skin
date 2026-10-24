import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { expect, it, vi } from 'vitest'
import { OpenCodeMcpControl } from './mcp-control'

it('applies restored choices once per new directory and preserves project overrides and existing instances', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-mcp-choices-'))
  const a = join(root, 'A'),
    b = join(root, 'B')
  await mkdir(a)
  await mkdir(b)
  const file = join(a, 'opencode.json')
  const contents = '{"mcp":{"project":{"enabled":true}}}'
  await writeFile(file, contents)
  let choices = { 'mcp:docs': false, 'mcp:disabled': true, 'mcp:project': false }
  const control = { global: () => ({ ...choices }) }
  const status = vi.fn(async () => ({
    data: {
      docs: { status: 'connected' },
      disabled: { status: 'disabled' },
      project: { status: 'connected' }
    }
  }))
  const connect = vi.fn<
      (params: { directory: string; name: string }, options: unknown) => Promise<object>
    >(async () => ({})),
    disconnect = vi.fn<
      (params: { directory: string; name: string }, options: unknown) => Promise<object>
    >(async () => ({}))
  const client = { mcp: { status, connect, disconnect } } as unknown as OpencodeClient
  const signal = new AbortController().signal
  try {
    const old = new OpenCodeMcpControl(client, a, control, signal)
    await old.prepare()
    expect(connect.mock.calls.map(([params]) => params)).toEqual([
      { directory: a, name: 'disabled' }
    ])
    expect(disconnect.mock.calls.map(([params]) => params)).toEqual([
      { directory: a, name: 'docs' }
    ])
    choices = { 'mcp:docs': true, 'mcp:disabled': false, 'mcp:project': true }
    await old.prepare()
    const next = new OpenCodeMcpControl(client, b, control, signal)
    await next.prepare()
    expect(status).toHaveBeenCalledTimes(2)
    expect(connect).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(await readFile(file, 'utf8')).toBe(contents)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

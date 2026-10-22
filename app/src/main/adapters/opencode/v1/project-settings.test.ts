import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { readOpenCodeProjectSettings, openCodeProjectFiles } from './project-settings'
import { OpenCodeMcpControl } from './mcp-control'
let root: string | undefined
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})
it('observes exact cwd MCP/plugin keys without writing, and waits for reclamation for external edits', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-oc-project-'))
  const a = join(root, 'A'),
    b = join(a, 'B')
  await mkdir(b, { recursive: true })
  const file = join(a, 'opencode.jsonc')
  await writeFile(
    file,
    '// native\n{"mcp":{"same":{"enabled":false}},"plugin":["p"],"model":"keep",}'
  )
  const first = await readOpenCodeProjectSettings(a)
  const child = await readOpenCodeProjectSettings(b)
  expect(first.mcp).toEqual({ same: false })
  expect(child.mcp).toEqual({})
  expect(openCodeProjectFiles(a)).toContain(file)
  const connect = vi.fn(),
    disconnect = vi.fn()
  const client = { mcp: { connect, disconnect } } as unknown as OpencodeClient
  const control = new OpenCodeMcpControl(
    client,
    a,
    { global: () => ({ 'mcp:same': true }) },
    new AbortController().signal
  )
  await control.prepare() // Own native project declaration wins over an Orca global default.
  await writeFile(file, '{"mcp":{"same":{"enabled":false}},"plugin":["p"],"model":"other"}')
  expect((await readOpenCodeProjectSettings(a)).revision).toBe(first.revision)
  await writeFile(file, '{"mcp":{"same":{"enabled":true}},"plugin":["p"],"model":"other"}')
  const bytes = await readFile(file, 'utf8')
  const next = await control.policy.read(a)
  expect(await control.reconcile(next.revision, () => false)).toBe('pending')
  expect(await control.reconcile(next.revision, () => true)).toBe('restart-required')
  expect(
    await control.preview([
      {
        id: 'same',
        name: 'same',
        kind: 'mcp',
        enabled: false,
        status: 'disabled',
        canToggle: false
      }
    ])
  ).toMatchObject([{ enabled: true, status: 'disabled', canToggle: false }])
  await expect(control.set('same', false)).rejects.toThrow()
  expect(connect).not.toHaveBeenCalled()
  expect(disconnect).not.toHaveBeenCalled()
  expect(await readFile(file, 'utf8')).toBe(bytes)
  expect((await readOpenCodeProjectSettings(b)).revision).toBe(child.revision)
})

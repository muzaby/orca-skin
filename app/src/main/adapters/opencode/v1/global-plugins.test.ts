import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OpenCodeDisabledPlugin, NativeResource } from '../../../../shared/native-resources'
import { FileMutationCoordinator } from '../../../infra/config/file-mutation'
import { OpenCodeGlobalPlugins, openCodeGlobalPluginFingerprint } from './global-plugins'
import { globalOpenCodeResources } from './configured-resources'
import { openCodePluginId } from './plugin-installation'
import { insertPluginEntry, removePluginEntry } from './openCodePluginConfig'

let root: string,
  file: string,
  env: NodeJS.ProcessEnv,
  records: OpenCodeDisabledPlugin[],
  specs: string[]
const store = {
  get: () => records,
  set: (value: OpenCodeDisabledPlugin[]) => {
    records = value
  }
}
const item = (index = 0): NativeResource => ({
  id: openCodePluginId(specs[index]),
  name: specs[index],
  kind: 'plugin',
  enabled: true,
  status: 'installed',
  canToggle: true
})
const text = (): string =>
  JSON.stringify(
    { plugin: [specs[0], [specs[1], { mode: 'distinct' }]], theme: 'unchanged' },
    null,
    2
  ).replace('{', '{\n  // keep this comment') + '\n'
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-global-plugins-'))
  await mkdir(join(root, 'opencode'))
  specs = []
  for (const name of ['one', 'two']) {
    const dir = join(root, name)
    await mkdir(dir)
    specs.push(pathToFileURL(dir).href)
  }
  file = join(root, 'opencode', 'opencode.jsonc')
  env = { XDG_CONFIG_HOME: root }
  records = []
  await writeFile(file, text())
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('records before removing and restores the original entry at its index', async () => {
  const mutations = new FileMutationCoordinator({
    beforeCommit: async () => {
      expect(records).toHaveLength(1)
      expect(records[0]).toMatchObject({ file, index: 1, entry: [specs[1], { mode: 'distinct' }] })
    }
  })
  const control = new OpenCodeGlobalPlugins(store, env, root, mutations)
  await control.set(item(1), false)
  expect(await readFile(file, 'utf8')).not.toContain(specs[1])
  expect(await control.reconcile()).toEqual([
    expect.objectContaining({ id: item(1).id, enabled: false, status: 'disabled' })
  ])
  await control.set(item(1), true)
  expect(records).toEqual([])
  expect(await readFile(file, 'utf8')).toBe(text())
})

it('rolls back the record when the file write fails', async () => {
  const control = new OpenCodeGlobalPlugins(
    store,
    env,
    root,
    new FileMutationCoordinator({
      beforeCommit: async () => {
        expect(records).toHaveLength(1)
        throw new Error('write failed')
      }
    })
  )
  await expect(control.set(item(), false)).rejects.toThrow('write failed')
  expect(records).toEqual([])
  expect(await readFile(file, 'utf8')).toBe(text())
})

it('reports a recorded plugin that is still declared as enabled and clears the record', async () => {
  records = [{ id: item().id, file, entry: specs[0], index: 0 }]
  expect(await new OpenCodeGlobalPlugins(store, env, root).reconcile()).toEqual([])
  expect(records).toEqual([])
  expect(
    (await globalOpenCodeResources(env, root)).find((value) => value.id === item().id)
  ).toMatchObject({ enabled: true, canToggle: true })
})

it('applies concurrent toggles and an external edit without failure', async () => {
  const mutations = new FileMutationCoordinator({
    beforeCommit: async (_path, attempt) => {
      if (!attempt && !(await readFile(file, 'utf8')).includes('external'))
        await writeFile(file, (await readFile(file, 'utf8')).replace('unchanged', 'external'))
    }
  })
  const control = new OpenCodeGlobalPlugins(store, env, root, mutations)
  await Promise.all([control.set(item(), false), control.set(item(1), false)])
  expect(records.map((value) => value.id).sort()).toEqual([item().id, item(1).id].sort())
  expect(await readFile(file, 'utf8')).toContain('external')
  expect(await readFile(file, 'utf8')).not.toContain(specs[0])
  expect(await readFile(file, 'utf8')).not.toContain(specs[1])
})

it('derives the fingerprint only from the effective plugin array', async () => {
  const first = await openCodeGlobalPluginFingerprint(env, root)
  await writeFile(join(root, 'opencode', 'opencode.json'), '{"plugin":["shadowed"]}')
  await writeFile(file, text().replace('unchanged', 'external'))
  expect(await openCodeGlobalPluginFingerprint(env, root)).toBe(first)
  await writeFile(file, '{"plugin":[]}')
  expect(await openCodeGlobalPluginFingerprint(env, root)).not.toBe(first)
})

it('shows a record only while its installation exists and its spec is absent', async () => {
  const control = new OpenCodeGlobalPlugins(store, env, root)
  await control.set(item(), false)
  expect(await control.reconcile()).toHaveLength(1)
  await rm(join(root, 'one'), { recursive: true })
  expect(await control.reconcile()).toEqual([])
  expect(records).toEqual([])
})

it('marks only plugins declared by the effective global file as toggleable', async () => {
  await writeFile(join(root, 'opencode', 'config.json'), JSON.stringify({ plugin: ['shadowed'] }))
  await writeFile(join(root, 'opencode', 'opencode.json'), JSON.stringify({ plugin: [specs[0]] }))
  await writeFile(
    file,
    JSON.stringify({ plugin: [[specs[1], { option: true }], 'unresolvable://plugin'] })
  )
  const values = await globalOpenCodeResources(env, root)
  expect(values.map((value) => value.id)).toEqual([
    openCodePluginId(specs[1]),
    openCodePluginId('unresolvable://plugin')
  ])
  expect(values.map((value) => value.canToggle)).toEqual([true, false])
})

it('removes and reinserts string and tuple entries while preserving comments', () => {
  const source = text()
  for (const index of [0, 1]) {
    const entry = index
      ? ([specs[1], { mode: 'distinct' }] as [string, Record<string, unknown>])
      : specs[0]
    const removed = removePluginEntry(source, index)
    expect(removed).toContain('// keep this comment')
    expect(insertPluginEntry(removed, entry, index)).toBe(source)
  }
})

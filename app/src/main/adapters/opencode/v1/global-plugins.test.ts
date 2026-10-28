import { openCodeDiscovery } from './discovery-cache'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openCodeGlobalPluginFingerprint } from './global-plugins'
import { globalOpenCodeResources } from './configured-resources'
import { openCodePluginId } from './plugin-installation'

let root: string, file: string, env: NodeJS.ProcessEnv, specs: string[]
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
  await writeFile(file, text())
  openCodeDiscovery.invalidate()
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('derives the fingerprint only from the effective plugin array', async () => {
  const first = await openCodeGlobalPluginFingerprint(env, root)
  await writeFile(join(root, 'opencode', 'opencode.json'), '{"plugin":["shadowed"]}')
  openCodeDiscovery.invalidate()
  await writeFile(file, text().replace('unchanged', 'external'))
  openCodeDiscovery.invalidate()
  expect(await openCodeGlobalPluginFingerprint(env, root)).toBe(first)
  await writeFile(file, '{"plugin":[]}')
  openCodeDiscovery.invalidate()
  expect(await openCodeGlobalPluginFingerprint(env, root)).not.toBe(first)
})

it('lists only plugins declared by the effective global file as fixed rows', async () => {
  await writeFile(join(root, 'opencode', 'config.json'), JSON.stringify({ plugin: ['shadowed'] }))
  openCodeDiscovery.invalidate()
  await writeFile(join(root, 'opencode', 'opencode.json'), JSON.stringify({ plugin: [specs[0]] }))
  openCodeDiscovery.invalidate()
  await writeFile(
    file,
    JSON.stringify({ plugin: [[specs[1], { option: true }], 'unresolvable://plugin'] })
  )
  openCodeDiscovery.invalidate()
  const values = await globalOpenCodeResources(env, root)
  expect(values.map((value) => value.id)).toEqual([
    openCodePluginId(specs[1]),
    openCodePluginId('unresolvable://plugin')
  ])
  expect(values.map((value) => value.canToggle)).toEqual([false, false])
})

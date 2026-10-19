import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'
import { openCodeNativePluginDirectory, openCodeNativeResources } from './native-resources'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-opencode-plugin-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('reads real file and npm installations in the native cache environment without executing code', async () => {
  const local = join(root, 'local plugin')
  const npm = join(
    root,
    'cache',
    'opencode',
    'packages',
    '@vendor/skills@latest',
    'node_modules',
    '@vendor/skills'
  )
  for (const directory of [local, npm]) {
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ description: directory === local ? 'Local skills' : 'Npm skills' })
    )
  }
  const file = join(local, 'plugin.ts')
  await writeFile(file, 'throw new Error("must never execute")')
  const env = { XDG_CACHE_HOME: 'cache' }
  expect(await openCodePluginInstallation(pathToFileURL(file).href, root, env)).toEqual({
    directory: local,
    description: 'Local skills'
  })
  expect(await openCodePluginInstallation('@vendor/skills', root, env)).toEqual({
    directory: npm,
    description: 'Npm skills'
  })
  expect(await openCodePluginInstallation('@vendor/skills@2', root, env)).toBeUndefined()
  expect(await openCodePluginInstallation('https://private/token', root, env)).toBeUndefined()
  expect(await openCodePluginInstallation('../../missing.ts', root, env)).toBeUndefined()
  const specs = [pathToFileURL(file).href, '@vendor/skills']
  const get = vi.fn(async () => ({ data: { plugin: specs } }))
  const client = {
    config: { get },
    mcp: { status: async () => ({ data: {} }) }
  } as unknown as OpencodeClient
  const items = await openCodeNativeResources(client, root, env)
  expect(items.map((item) => item.description)).toEqual(['Local skills', 'Npm skills'])
  expect(JSON.stringify(items)).not.toContain(root.replaceAll('\\', '\\\\'))
  specs.reverse()
  expect(await openCodeNativePluginDirectory(client, root, items[0].id, env)).toBe(local)
  expect(await openCodeNativePluginDirectory(client, root, items[1].id, env)).toBe(npm)
  expect(await openCodeNativePluginDirectory(client, root, file, env)).toBeUndefined()
  expect((await openCodeNativeResources(client, root, env)).map((item) => item.id)).toEqual(
    items.map((item) => item.id).reverse()
  )
  expect(openCodePluginId('@vendor/skills')).not.toBe(openCodePluginId('@vendor/skills@2'))
})

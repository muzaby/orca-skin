import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { mkdir, mkdtemp, realpath, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { globalOpenCodeResources } from './configured-resources'
import { nativeOpenCodeEnvironment } from './native-storage'
import { openCodeDiscovery } from './discovery-cache'
import { openCodeNativePlugins } from './native-resources'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orcinus-orca-opencode-plugin-')).then((path) =>
    realpath(path)
  )
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
  const items = await openCodeNativePlugins(client, root, env)
  expect(items.map((item) => item.description)).toEqual(['Local skills', 'Npm skills'])
  expect(JSON.stringify(items)).not.toContain(root.replaceAll('\\', '\\\\'))
  specs.reverse()
  expect((await openCodeNativePlugins(client, root, env)).map((item) => item.id)).toEqual(
    items.map((item) => item.id).reverse()
  )
  expect(openCodePluginId('@vendor/skills')).not.toBe(openCodePluginId('@vendor/skills@2'))
})

it('reads the current native installation after the harness upgrades and never reinjects or restores a saved version', async () => {
  const env = { XDG_CACHE_HOME: join(root, 'cache'), XDG_CONFIG_HOME: join(root, 'config') }
  const directory = join(env.XDG_CONFIG_HOME, 'opencode')
  await mkdir(directory, { recursive: true })
  const declaration = join(directory, 'opencode.json')
  const settings = { plugin: ['example@1'], model: 'p/m' }
  const metadata = (v: number): string =>
    join(
      env.XDG_CACHE_HOME,
      'opencode',
      'packages',
      'example@' + v,
      'node_modules',
      'example',
      'package.json'
    )
  for (const version of [1, 2]) {
    const config = JSON.stringify({ plugin: ['example@' + version] })
    await writeFile(declaration, config)
    const path = metadata(version)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, JSON.stringify({ description: 'feature-' + version }))
    openCodeDiscovery.invalidate()
    expect(await openCodePluginInstallation('example@' + version, root, env)).toMatchObject({
      description: 'feature-' + version
    })
    expect(JSON.parse(nativeOpenCodeEnvironment(settings, env).OPENCODE_CONFIG_CONTENT!)).toEqual({
      model: 'p/m',
      share: 'disabled',
      snapshot: false
    })
    expect(
      (await globalOpenCodeResources(env, root)).map((item) => ({
        id: item.id,
        status: item.status,
        canToggle: item.canToggle
      }))
    ).toEqual([
      { id: openCodePluginId('example@' + version), status: 'configured', canToggle: false }
    ])
    expect(await readFile(declaration, 'utf8')).toBe(config)
    expect(await readFile(path, 'utf8')).toBe(JSON.stringify({ description: 'feature-' + version }))
  }
})

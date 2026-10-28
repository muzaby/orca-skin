import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
  rm,
  stat,
  utimes,
  symlink
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { discoveryReadFile, OpenCodeDiscoveryCache, openCodeDiscovery } from './discovery-cache'
import { configuredOpenCodeResources } from './configured-resources'
import { openCodePluginInstallation } from './plugin-installation'
import { effectiveOpenCodePlugins } from './global-plugins'
import { readOpenCodeProjectSettings } from './project-settings'

vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, readFile: vi.fn(fs.readFile), realpath: vi.fn(fs.realpath) }
})
let root: string, cwd: string, env: NodeJS.ProcessEnv, now: number
const releases: (() => void)[] = []
const expire = (): void => {
  now += 1001
}
beforeEach(async () => {
  now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  // Windows tmpdir() can be an 8.3 short path; installations resolve through realpath.
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-discovery-')))
  cwd = join(root, 'project', 'child')
  await mkdir(cwd, { recursive: true })
  await mkdir(join(root, 'project', '.git'))
  env = { XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache') }
  openCodeDiscovery.invalidate()
  vi.mocked(readFile).mockClear()
  vi.mocked(realpath).mockClear()
})
afterEach(async () => {
  for (const release of releases.splice(0)) release()
  openCodeDiscovery.invalidate()
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it('shares reads and immutable results, then detects equal-size content with restored mtime', async () => {
  const file = join(cwd, 'opencode.json')
  await writeFile(file, '{"mcp":{"one":{"enabled":true}}}')
  const before = await stat(file)
  const values = await Promise.all(
    Array.from({ length: 12 }, () => configuredOpenCodeResources(cwd, env))
  )
  expect(vi.mocked(readFile).mock.calls.filter(([path]) => path === file)).toHaveLength(1)
  values[0][0].name = 'mutation'
  expect(values[1][0].name).toBe('one')
  const key = openCodeDiscovery.key('configured', cwd, env, 'false')
  const changed = vi.fn()
  releases.push(openCodeDiscovery.hold(key, changed))
  await writeFile(file, '{"mcp":{"two":{"enabled":true}}}')
  await utimes(file, before.atime, before.mtime)
  expire()
  await openCodeDiscovery.poll()
  expect(changed).toHaveBeenCalledOnce()
  expect((await configuredOpenCodeResources(cwd, env)).map((item) => item.id)).toEqual(['two'])
  expect(vi.mocked(readFile).mock.calls.filter(([path]) => path === file)).toHaveLength(2)
})

it('tracks missing candidates, ancestor git boundaries, custom files and environment layouts', async () => {
  const ancestor = join(root, 'project', 'opencode.json')
  await writeFile(ancestor, '{"mcp":{"parent":{}}}')
  expect((await configuredOpenCodeResources(cwd, env)).map((item) => item.id)).toEqual(['parent'])
  await mkdir(join(cwd, '.git'))
  await writeFile(join(cwd, 'opencode.jsonc'), '{"mcp":{"child":{}}}')
  expire()
  expect((await configuredOpenCodeResources(cwd, env)).map((item) => item.id)).toEqual(['child'])
  await rm(join(cwd, '.git'), { recursive: true })
  await rm(join(cwd, 'opencode.jsonc'))
  expire()
  expect((await configuredOpenCodeResources(cwd, env)).map((item) => item.id)).toEqual(['parent'])
  const custom = join(root, 'custom.json')
  await writeFile(custom, '{"mcp":{"custom":{}}}')
  const customDir = join(root, 'custom-dir')
  await mkdir(customDir)
  await writeFile(join(customDir, 'opencode.json'), '{"mcp":{"extra":{}}}')
  expect(
    (
      await configuredOpenCodeResources(cwd, {
        ...env,
        OPENCODE_CONFIG: custom,
        OPENCODE_CONFIG_DIR: customDir
      })
    ).map((item) => item.id)
  ).toEqual(['custom', 'parent', 'extra'])
  const alternate = join(root, 'alternate')
  await mkdir(join(alternate, 'opencode'), { recursive: true })
  await writeFile(join(alternate, 'opencode', 'config.json'), '{"mcp":{"global":{}}}')
  expect(
    (await configuredOpenCodeResources(cwd, { ...env, XDG_CONFIG_HOME: alternate })).map(
      (item) => item.id
    )
  ).toEqual(['global', 'parent'])
})

it('shares global/project file probes and sees a dirty barrier before the one-second deadline', async () => {
  const file = join(cwd, 'opencode.json')
  await writeFile(file, '{"mcp":{"first":{}}}')
  await Promise.all([configuredOpenCodeResources(cwd, env), readOpenCodeProjectSettings(cwd)])
  expect(vi.mocked(readFile).mock.calls.filter(([path]) => path === file)).toHaveLength(1)
  await writeFile(file, '{"mcp":{"other":{}}}')
  openCodeDiscovery.invalidate()
  expect((await readOpenCodeProjectSettings(cwd)).mcp).toEqual({ other: true })
  await mkdir(join(root, 'config', 'opencode'), { recursive: true })
  await writeFile(join(root, 'config', 'opencode', 'opencode.json'), '{"plugin":["p"]}')
  openCodeDiscovery.invalidate()
  vi.mocked(readFile).mockClear()
  await Promise.all([effectiveOpenCodePlugins(env), configuredOpenCodeResources(cwd, env)])
  expect(
    vi
      .mocked(readFile)
      .mock.calls.filter(([path]) => path === join(root, 'config', 'opencode', 'opencode.json'))
  ).toHaveLength(1)
})

it('revalidates installation realpaths and package descriptions without executing plugins', async () => {
  const first = join(root, 'first'),
    second = join(root, 'second'),
    link = join(root, 'link')
  await mkdir(first)
  await mkdir(second)
  await writeFile(join(first, 'package.json'), '{"description":"first"}')
  await writeFile(join(second, 'package.json'), '{"description":"other"}')
  await symlink(first, link, 'junction')
  const spec = pathToFileURL(link).href
  expect(await openCodePluginInstallation(spec, cwd, env)).toMatchObject({ description: 'first' })
  expect(await openCodePluginInstallation(spec, cwd, env)).toMatchObject({ description: 'first' })
  expect(vi.mocked(realpath).mock.calls.filter(([path]) => path === link)).toHaveLength(1)
  await rm(link, { recursive: true })
  await symlink(second, link, 'junction')
  expire()
  expect(await openCodePluginInstallation(spec, cwd, env)).toMatchObject({
    directory: second,
    description: 'other'
  })
  await writeFile(join(second, 'package.json'), '{"description":"fresh"}')
  expire()
  expect(await openCodePluginInstallation(spec, cwd, env)).toMatchObject({ description: 'fresh' })
})

it('fences a dirty flight, bounds values and stops polling after its last scope owner', async () => {
  const cache = new OpenCodeDiscoveryCache()
  const file = join(cwd, 'opencode.json')
  await writeFile(file, 'old')
  const entered = Promise.withResolvers<void>(),
    resume = Promise.withResolvers<void>()
  const key = cache.key('configured', cwd, env)
  const load = vi.fn(async () => {
    const text = await discoveryReadFile(file)
    if (text === 'old') {
      entered.resolve()
      await resume.promise
    }
    return { text }
  })
  const reading = cache.run(key, load)
  await entered.promise
  await writeFile(file, 'new')
  cache.invalidate()
  resume.resolve()
  expect(await reading).toEqual({ text: 'new' })
  expect(load).toHaveBeenCalledTimes(2)
  const changed = vi.fn(),
    release = cache.hold(key, changed)
  releases.push(release)
  for (let n = 0; n < 65; n++)
    await cache.run(cache.key('configured', String(n), env), async () => n)
  expect(await cache.run(key, load)).toEqual({ text: 'new' })
  expect(load).toHaveBeenCalledTimes(3)
  await writeFile(file, 'end')
  expire()
  await cache.poll()
  expect(changed).toHaveBeenCalledOnce()
  release()
  vi.mocked(readFile).mockClear()
  expire()
  await cache.poll()
  expect(readFile).not.toHaveBeenCalled()
  const installed = vi.fn(async () => ({ value: 'package' }))
  const installKey = cache.key('installation', cwd, env, 'first')
  await cache.run(installKey, installed)
  for (let n = 0; n < 257; n++)
    await cache.run(cache.key('installation', cwd, env, String(n)), async () => n)
  await cache.run(installKey, installed)
  expect(installed).toHaveBeenCalledTimes(2)
})

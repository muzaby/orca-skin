import { openCodeDiscovery } from './discovery-cache'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import {
  configuredOpenCodeMcpFile,
  globalOpenCodeResources,
  configuredOpenCodePluginSkillDirectories
} from './configured-resources'

it('discovers global config.json and excludes the default workspace and its .opencode files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-global-config-'))
  try {
    const global = join(root, 'config', 'opencode')
    await mkdir(global, { recursive: true })
    await mkdir(join(root, '.opencode'), { recursive: true })
    await writeFile(
      join(global, 'config.json'),
      JSON.stringify({
        mcp: { docs: { enabled: false, url: 'PRIVATE_URL' } },
        plugin: ['plugin-global']
      })
    )
    openCodeDiscovery.invalidate()
    await writeFile(join(root, 'opencode.json'), JSON.stringify({ mcp: { project: {} } }))
    openCodeDiscovery.invalidate()
    await writeFile(
      join(root, '.opencode', 'opencode.json'),
      JSON.stringify({ mcp: { hidden: {} } })
    )
    openCodeDiscovery.invalidate()
    const items = await globalOpenCodeResources({ XDG_CONFIG_HOME: join(root, 'config') }, root)
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'docs', enabled: false, canToggle: true, canOpen: true }),
        expect.objectContaining({
          name: 'plugin-global',
          enabled: true,
          canToggle: false,
          canOpen: false
        })
      ])
    )
    expect(items).toHaveLength(2)
    expect(JSON.stringify(items)).not.toContain('PRIVATE_URL')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('resolves JSONC MCP declarations in global, custom and project scopes without parsing URL comments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-open-config-'))
  const cwd = join(root, 'project')
  const global = join(root, 'config', 'opencode', 'opencode.json')
  const custom = join(root, 'override.json')
  const project = join(cwd, 'opencode.jsonc')
  try {
    await mkdir(join(cwd, '.git'), { recursive: true })
    await mkdir(dirname(global), { recursive: true })
    await writeFile(global, JSON.stringify({ mcp: { global: {}, shared: {} } }))
    openCodeDiscovery.invalidate()
    await writeFile(custom, JSON.stringify({ mcp: { custom: {}, shared: {} } }))
    openCodeDiscovery.invalidate()
    await writeFile(
      project,
      '{ /* config */ "mcp": { "shared": { "url": "https://host/a//b", }, }, }'
    )
    openCodeDiscovery.invalidate()
    const env = { XDG_CONFIG_HOME: join(root, 'config'), OPENCODE_CONFIG: custom }
    for (const [id, file] of [
      ['global', global],
      ['custom', custom],
      ['shared', project]
    ])
      expect(await configuredOpenCodeMcpFile(cwd, id, env)).toBe(file)
    expect(await configuredOpenCodeMcpFile(cwd, 'missing', env)).toBeUndefined()
    expect(
      await configuredOpenCodeMcpFile(cwd, 'shared', {
        ...env,
        OPENCODE_DISABLE_PROJECT_CONFIG: 'true'
      })
    ).toBe(custom)
    await writeFile(project, '{"mcp":')
    openCodeDiscovery.invalidate()
    await expect(configuredOpenCodeMcpFile(cwd, 'shared', env)).rejects.toThrow('설정 파일')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('retains plugin skill roots through cached metadata and refreshes removed installations', async () => {
  // Windows tmpdir() can be an 8.3 short path; installations resolve through realpath.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'orca-plugin-skills-')))
  const plugin = join(root, 'plugin'),
    config = join(root, 'config', 'opencode')
  const env = { XDG_CONFIG_HOME: join(root, 'config') }
  try {
    await mkdir(plugin)
    await mkdir(config, { recursive: true })
    await writeFile(join(plugin, 'package.json'), '{"name":"fixture"}')
    await writeFile(join(plugin, 'index.js'), 'throw new Error("must not execute")')
    await writeFile(
      join(config, 'opencode.json'),
      JSON.stringify({
        plugin: [pathToFileURL(join(plugin, 'index.js')).href],
        skills: { paths: [join(plugin, 'extra'), join(root, 'outside')] }
      })
    )
    const expected = [join(plugin, 'skills'), join(plugin, 'skill'), join(plugin, 'extra')]
    expect(await configuredOpenCodePluginSkillDirectories(root, env)).toEqual(expected)
    expect(await configuredOpenCodePluginSkillDirectories(root, env)).toEqual(expected)
    await rm(plugin, { recursive: true })
    openCodeDiscovery.invalidate()
    expect(await configuredOpenCodePluginSkillDirectories(root, env)).toEqual([])
  } finally {
    openCodeDiscovery.invalidate()
    await rm(root, { recursive: true, force: true })
  }
})

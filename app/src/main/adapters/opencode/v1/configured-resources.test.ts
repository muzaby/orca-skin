import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { configuredOpenCodeMcpFile } from './configured-resources'

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
    await writeFile(custom, JSON.stringify({ mcp: { custom: {}, shared: {} } }))
    await writeFile(
      project,
      '{ /* config */ "mcp": { "shared": { "url": "https://host/a//b", }, }, }'
    )
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
    await expect(configuredOpenCodeMcpFile(cwd, 'shared', env)).rejects.toThrow('설정 파일')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

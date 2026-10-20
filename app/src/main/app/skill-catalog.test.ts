import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { readSkillCatalog } from './skill-catalog'
import { registerSkillsHandlers } from './handlers/skills'
import { CHANNELS } from '../../shared/ipc'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, raw: unknown) => unknown>())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, raw: unknown) => unknown) =>
      handlers.set(channel, fn)
  },
  shell: {}
}))

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function skill(root: string, name: string): Promise<void> {
  await mkdir(join(root, name), { recursive: true })
  await writeFile(
    join(root, name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name}\n---\nbody`
  )
}
it('assembles the real catalog from lock, harness and native plugin files without exposing other installations', async () => {
  const home = await mkdtemp(join(tmpdir(), 'orca-skill-catalog-'))
  roots.push(home)
  const agents = join(home, '.agents', 'skills'),
    claude = join(home, '.claude')
  const opencode = join(home, '.config', 'opencode', 'skills'),
    plugin = join(home, 'plugin')
  await Promise.all([
    skill(agents, 'locked'),
    skill(agents, 'unregistered'),
    skill(join(claude, 'skills'), 'claude-only'),
    skill(opencode, 'open-only'),
    skill(join(plugin, 'skills'), 'native'),
    skill(join(home, 'open-plugin', 'skills'), 'open-plugin-skill')
  ])
  await mkdir(join(claude, 'plugins'), { recursive: true })
  await mkdir(join(plugin, '.claude-plugin'), { recursive: true })
  await writeFile(join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'design' }))
  await writeFile(
    join(claude, 'settings.json'),
    JSON.stringify({ enabledPlugins: { 'design@test': true } })
  )
  await writeFile(
    join(claude, 'plugins', 'installed_plugins.json'),
    JSON.stringify({ plugins: { 'design@test': [{ scope: 'user', installPath: plugin }] } })
  )
  const lock = join(home, '.agents', '.skill-lock.json')
  await writeFile(
    lock,
    JSON.stringify({
      version: 3,
      skills: { locked: { source: 'owner/repo', skillPath: '../../outside' }, missing: {} }
    })
  )
  await symlink(join(agents, 'locked'), join(claude, 'skills', 'alias'), 'junction')
  await symlink(join(agents, 'unregistered'), join(claude, 'skills', 'unlocked-alias'), 'junction')
  await writeFile(
    join(home, '.config', 'opencode', 'opencode.json'),
    JSON.stringify({
      plugin: [pathToFileURL(join(home, 'open-plugin')).href]
    })
  )
  const catalog = (): ReturnType<typeof readSkillCatalog> =>
    readSkillCatalog(
      [
        {
          sourceId: 'adapter:claude',
          sourceLabel: 'Claude 스킬',
          sourceKind: 'adapter',
          rootDir: join(claude, 'skills')
        }
      ],
      {},
      home,
      {}
    )
  expect((await catalog()).map((s) => `${s.sourceId}/${s.name}`).sort()).toEqual([
    'adapter:claude/claude-only',
    'adapter:opencode/open-only',
    'agents/locked',
    'plugin:claude/design:native',
    'plugin:opencode/open-plugin-skill'
  ])
  expect((await catalog()).find((s) => s.name === 'design:native')?.sourceLabel).toBe(
    'Claude 플러그인'
  )
  const snapshot = await catalog()
  registerSkillsHandlers({
    getSkills: () => snapshot,
    settings: {} as never,
    deployExtensions: vi.fn() as never,
    refreshSkills: catalog
  })
  const result = handlers.get(CHANNELS.skillsList)?.({}, undefined)
  expect(result).toBe(snapshot)
  expect(result).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sourceId: 'agents', name: 'locked', canRemove: false }),
      expect.objectContaining({
        sourceId: 'plugin:claude',
        name: 'design:native',
        canToggle: false
      }),
      expect.objectContaining({
        sourceId: 'plugin:opencode',
        name: 'open-plugin-skill',
        canToggle: false
      })
    ])
  )
  await writeFile(lock, 'invalid')
  expect((await catalog()).filter((s) => s.sourceId === 'agents')).toEqual([])
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS, type SkillInfo } from '../../../shared/ipc'
import { registerSkillsHandlers } from './skills'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, raw: unknown) => unknown>())
const shell = vi.hoisted(() => ({
  openPath: vi.fn(async () => ''),
  showItemInFolder: vi.fn()
}))
const sources = vi.hoisted(() => ({
  removeOrcaSkillDir: vi.fn(async () => {}),
  writeAuthoredSkill: vi.fn(async () => {}),
  writeUploadedSkill: vi.fn(async () => {})
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, raw: unknown) => unknown) =>
      handlers.set(channel, listener)
  },
  shell
}))
vi.mock('../../features/extensions/common/skills/sources', () => sources)

const nativeName = 'superpowers:using-superpowers'
const skill = (sourceId: string, name: string, enabled = false): SkillInfo => ({
  name,
  sourceId,
  sourceLabel: sourceId,
  description: '',
  sourceKind: sourceId === 'orca' ? 'orca' : 'adapter',
  enabled,
  canToggle: sourceId === 'orca',
  canRemove: sourceId === 'orca',
  skillPath: `/catalog/${sourceId}/${name}/SKILL.md`,
  skillDir: `/catalog/${sourceId}/${name}`
})
const catalog = [
  skill('adapter:claude', nativeName, true),
  skill('plugin:claude', 'other:skill', true),
  skill('plugin:claude', nativeName),
  skill('orca', 'local')
]
const ctx = {
  getSkills: () => catalog,
  settings: {
    getAll: () => ({ skillEnabled: { 'orca/local': false, 'orca/other': true } }),
    patch: vi.fn()
  },
  deployExtensions: vi.fn(async () => {}),
  refreshSkills: vi.fn(async () => catalog)
}
const target = { sourceId: 'plugin:claude', name: nativeName }
async function invoke(channel: string, raw: unknown): Promise<unknown> {
  const listener = handlers.get(channel)
  if (!listener) throw new Error(`missing handler: ${channel}`)
  return listener({}, raw)
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
  registerSkillsHandlers({ ...ctx, settings: ctx.settings as never })
})

describe('catalog skill target IPC', () => {
  it.each([CHANNELS.skillsOpen, CHANNELS.skillsShowInFolder])(
    '%s opens the exact disabled native skill without treating its name as a directory slug',
    async (channel) => {
      await invoke(channel, { ...target, path: '/untrusted/SKILL.md' })
      const expected = catalog[2].skillPath
      expect(shell.openPath.mock.calls).toEqual(channel === CHANNELS.skillsOpen ? [[expected]] : [])
      expect(shell.showItemInFolder.mock.calls).toEqual(
        channel === CHANNELS.skillsShowInFolder ? [[expected]] : []
      )
      expect(ctx.settings.patch).not.toHaveBeenCalled()
      expect(ctx.deployExtensions).not.toHaveBeenCalled()
      expect(catalog[2].enabled).toBe(false)
    }
  )

  it('uses the exact catalog name, including long Unicode frontmatter names', async () => {
    const entry = skill('plugin:opencode', `문서 검토 ${'long-name '.repeat(10)}.md`)
    catalog.push(entry)
    try {
      await invoke(CHANNELS.skillsShowInFolder, { sourceId: entry.sourceId, name: entry.name })
      expect(shell.showItemInFolder).toHaveBeenCalledWith(entry.skillPath)
    } finally {
      catalog.pop()
    }
  })

  it.each([
    CHANNELS.skillsOpen,
    CHANNELS.skillsShowInFolder,
    CHANNELS.skillsSetEnabled,
    CHANNELS.skillsRemove
  ])('%s rejects unknown source/name combinations before side effects', async (channel) => {
    for (const invalid of [
      { ...target, sourceId: 'unknown' },
      { ...target, name: 'superpowers:missing' },
      { sourceId: 'orca', name: nativeName },
      { ...target, name: '../outside' },
      { ...target, name: ` ${target.name} ` }
    ]) {
      await expect(invoke(channel, { ...invalid, enabled: true })).rejects.toThrow(
        '스킬을 찾을 수 없습니다'
      )
    }
    expect(shell.openPath).not.toHaveBeenCalled()
    expect(shell.showItemInFolder).not.toHaveBeenCalled()
    expect(ctx.settings.patch).not.toHaveBeenCalled()
    expect(ctx.deployExtensions).not.toHaveBeenCalled()
    expect(sources.removeOrcaSkillDir).not.toHaveBeenCalled()
  })

  it('keeps native toggles read-only after accepting namespaced targets', async () => {
    expect(await invoke(CHANNELS.skillsSetEnabled, { ...target, enabled: true })).toEqual(catalog)
    expect(ctx.settings.patch).not.toHaveBeenCalled()
    expect(ctx.refreshSkills).not.toHaveBeenCalled()
  })

  it('keeps native removal forbidden after accepting namespaced targets', async () => {
    await expect(invoke(CHANNELS.skillsRemove, target)).rejects.toThrow('스킬만 제거할 수 있습니다')
    expect(sources.removeOrcaSkillDir).not.toHaveBeenCalled()
    expect(ctx.settings.patch).not.toHaveBeenCalled()
    expect(ctx.deployExtensions).not.toHaveBeenCalled()
  })

  it('still updates Orca skill toggles without changing other settings', async () => {
    await invoke(CHANNELS.skillsSetEnabled, { sourceId: 'orca', name: 'local', enabled: true })
    expect(ctx.settings.patch).toHaveBeenCalledWith({
      skillEnabled: { 'orca/local': true, 'orca/other': true }
    })
    expect(ctx.refreshSkills).toHaveBeenCalledOnce()
    expect(ctx.deployExtensions).not.toHaveBeenCalled()
  })

  it('still removes only the selected Orca directory and its setting', async () => {
    await invoke(CHANNELS.skillsRemove, { sourceId: 'orca', name: 'local' })
    expect(sources.removeOrcaSkillDir).toHaveBeenCalledWith(catalog[3].skillDir)
    expect(ctx.settings.patch).toHaveBeenCalledWith({ skillEnabled: { 'orca/other': true } })
    expect(ctx.deployExtensions).toHaveBeenCalledOnce()
    expect(ctx.refreshSkills).toHaveBeenCalledOnce()
  })
})

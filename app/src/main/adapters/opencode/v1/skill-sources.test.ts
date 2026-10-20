import { mkdtemp, mkdir, writeFile, realpath, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { isOpenCodeSkill } from './skill-sources'

it('matches a canonical skill against an aliased config root while excluding sibling installations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-skill-root-'))
  try {
    const config = join(root, 'physical')
    const alias = join(root, 'alias')
    const skill = join(config, 'opencode', 'skills', 'review', 'SKILL.md')
    await mkdir(join(config, 'opencode', 'skills', 'review'), { recursive: true })
    await writeFile(skill, 'review')
    await symlink(config, alias, process.platform === 'win32' ? 'junction' : 'dir')
    const path = await realpath(skill)
    expect(await isOpenCodeSkill(path, join(root, 'project'), { XDG_CONFIG_HOME: alias })).toBe(
      true
    )
    expect(
      await isOpenCodeSkill(join(root, 'other', 'SKILL.md'), join(root, 'project'), {
        XDG_CONFIG_HOME: alias
      })
    ).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

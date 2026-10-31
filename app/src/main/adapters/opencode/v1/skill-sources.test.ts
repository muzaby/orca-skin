import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { openCodeSkillRoots, withinSkillRoot } from './skill-sources'

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
    const roots = await openCodeSkillRoots(join(root, 'project'), { XDG_CONFIG_HOME: alias })
    expect(roots.some((root) => withinSkillRoot(path, root))).toBe(true)
    expect(roots.some((entry) => withinSkillRoot(join(root, 'other', 'SKILL.md'), entry))).toBe(
      false
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

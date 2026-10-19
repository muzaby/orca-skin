import { afterEach, describe, expect, it, vi } from 'vitest'
import { homedir } from 'node:os'
import path from 'node:path'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { claudeSkillRoots } from './extensions'
import { scanSkills } from '../../../features/extensions/common/skills/scan'

afterEach(() => vi.unstubAllEnvs())

describe('Claude native skill root', () => {
  it('reads skill content from the configured native directory without copying or modifying it', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'orca-native-skill-'))
    try {
      const skill = path.join(root, 'skills', 'native-example', 'SKILL.md')
      await mkdir(path.dirname(skill), { recursive: true })
      const content = '---\nname: native-example\ndescription: Native test\n---\nNative source body'
      await writeFile(skill, content)
      vi.stubEnv('CLAUDE_CONFIG_DIR', root)
      const result = await scanSkills(claudeSkillRoots())
      expect(result).toEqual([
        expect.objectContaining({
          name: 'native-example',
          body: 'Native source body',
          skillPath: skill,
          sourceKind: 'adapter'
        })
      ])
      expect(await readFile(skill, 'utf8')).toBe(content)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('scans the configured native root instead of an Orca-managed copy', () => {
    const native = path.resolve('fixture-native-root')
    vi.stubEnv('CLAUDE_CONFIG_DIR', native)
    expect(claudeSkillRoots()[0].rootDir).toBe(path.join(native, 'skills'))
  })
  it('retains the native home default without an explicit override', () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', undefined)
    expect(claudeSkillRoots()[0].rootDir).toBe(path.join(homedir(), '.claude', 'skills'))
  })
})

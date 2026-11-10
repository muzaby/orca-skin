import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanSkills } from './scan'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orcinus-orca-skill-scan-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function skill(dir: string, name: string, text: string): void {
  const target = join(dir, name)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'SKILL.md'), text, 'utf8')
}

describe('scanSkills', () => {
  it('여러 source root 를 소스 메타와 enabled 상태로 스캔한다', async () => {
    const oo = join(root, 'orcinus-orca')
    const adapter = join(root, 'adapter')
    skill(oo, 'alpha', '---\nname: alpha\ndescription: A\nargument-hint: <file>\n---\nbody')
    skill(adapter, 'beta', '---\nname: beta\ndescription: B\n---\ntext')

    const result = await scanSkills(
      [
        {
          sourceId: 'orcinus-orca',
          sourceLabel: 'Orcinus orca 스킬',
          sourceKind: 'orcinus-orca',
          rootDir: oo
        },
        {
          sourceId: 'adapter:claude',
          sourceLabel: '어댑터 스킬',
          sourceKind: 'adapter',
          rootDir: adapter
        }
      ],
      { 'orcinus-orca/alpha': false, 'adapter:claude/beta': false }
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alpha',
          sourceId: 'orcinus-orca',
          sourceLabel: 'Orcinus orca 스킬',
          enabled: false,
          canToggle: true,
          sourceKind: 'orcinus-orca',
          argumentHint: '<file>'
        }),
        expect.objectContaining({
          name: 'beta',
          sourceId: 'adapter:claude',
          sourceLabel: '어댑터 스킬',
          enabled: true,
          canToggle: false,
          sourceKind: 'adapter'
        })
      ])
    )
  })
})

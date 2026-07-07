import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { seedBuiltinSkills } from './seed'

let root: string
let builtinDir: string
let skillsDir: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-skill-seed-'))
  builtinDir = join(root, 'builtin', 'skills')
  skillsDir = join(root, 'sources', 'skills')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function write(path: string, text: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text, 'utf8')
}

function manifest(version: string, skills: string[]): void {
  write(join(builtinDir, 'manifest.json'), JSON.stringify({ version, skills }, null, 2))
}

function builtinSkill(name: string, body = `# ${name}`): void {
  write(join(builtinDir, name, 'SKILL.md'), body)
}

function sourceSkill(name: string, body = `# ${name}`): void {
  write(join(skillsDir, name, 'SKILL.md'), body)
}

function marker(): { version: string; skills: string[]; at: number } {
  return JSON.parse(readFileSync(join(skillsDir, '.orca-builtin.json'), 'utf8'))
}

describe('seedBuiltinSkills', () => {
  it('최초 설치 시 manifest skill 을 sources/skills 로 복사하고 marker 를 기록한다', () => {
    manifest('1.0.0', ['demo'])
    builtinSkill('demo', '# bundled')

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({ seeded: ['demo'], pruned: [], skipped: false, version: '1.0.0' })
    expect(readFileSync(join(skillsDir, 'demo', 'SKILL.md'), 'utf8')).toBe('# bundled')
    expect(marker()).toMatchObject({ version: '1.0.0', skills: ['demo'] })
  })

  it('버전 업 시 builtin skill 을 덮어쓰고 새 manifest 에 없는 이전 builtin 을 prune 한다', () => {
    manifest('1.0.0', ['old', 'keep'])
    builtinSkill('old', '# old bundled')
    builtinSkill('keep', '# keep v1')
    seedBuiltinSkills(builtinDir, skillsDir)

    rmSync(builtinDir, { recursive: true, force: true })
    manifest('1.1.0', ['keep', 'new'])
    builtinSkill('keep', '# keep v2')
    builtinSkill('new', '# new')

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({
      seeded: ['keep', 'new'],
      pruned: ['old'],
      skipped: false,
      version: '1.1.0'
    })
    expect(readFileSync(join(skillsDir, 'keep', 'SKILL.md'), 'utf8')).toBe('# keep v2')
    expect(readFileSync(join(skillsDir, 'new', 'SKILL.md'), 'utf8')).toBe('# new')
    expect(existsSync(join(skillsDir, 'old'))).toBe(false)
    expect(marker()).toMatchObject({ version: '1.1.0', skills: ['keep', 'new'] })
  })

  it('동일 버전이면 어떤 파일도 쓰거나 삭제하지 않는다', () => {
    manifest('1.0.0', ['demo'])
    builtinSkill('demo', '# bundled')
    seedBuiltinSkills(builtinDir, skillsDir)
    write(join(skillsDir, 'demo', 'USER.md'), 'user edit')
    const before = statSync(join(skillsDir, '.orca-builtin.json')).mtimeMs

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({ seeded: [], pruned: [], skipped: true, version: '1.0.0' })
    expect(readFileSync(join(skillsDir, 'demo', 'USER.md'), 'utf8')).toBe('user edit')
    expect(statSync(join(skillsDir, '.orca-builtin.json')).mtimeMs).toBe(before)
  })

  it('사용자가 만든 non-builtin skill 디렉토리는 버전 업과 prune 에서 보존한다', () => {
    manifest('1.0.0', ['builtin'])
    builtinSkill('builtin')
    seedBuiltinSkills(builtinDir, skillsDir)
    sourceSkill('mine', '# mine')

    rmSync(builtinDir, { recursive: true, force: true })
    manifest('1.1.0', [])

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({ seeded: [], pruned: ['builtin'], skipped: false, version: '1.1.0' })
    expect(existsSync(join(skillsDir, 'builtin'))).toBe(false)
    expect(readFileSync(join(skillsDir, 'mine', 'SKILL.md'), 'utf8')).toBe('# mine')
  })

  it('manifest 가 부재하거나 손상되면 안전하게 no-op 한다', () => {
    expect(seedBuiltinSkills(builtinDir, skillsDir)).toEqual({
      seeded: [],
      pruned: [],
      skipped: true,
      version: null
    })

    write(join(builtinDir, 'manifest.json'), '{broken')
    expect(seedBuiltinSkills(builtinDir, skillsDir)).toEqual({
      seeded: [],
      pruned: [],
      skipped: true,
      version: null
    })

    write(join(builtinDir, 'manifest.json'), JSON.stringify({ version: 1, skills: [] }))
    expect(seedBuiltinSkills(builtinDir, skillsDir)).toEqual({
      seeded: [],
      pruned: [],
      skipped: true,
      version: null
    })
  })

  it('빈 builtin pipeline 은 marker 를 만들고 다음 동일 버전 호출에서 no-op 된다', () => {
    manifest('1.0.0', [])

    const first = seedBuiltinSkills(builtinDir, skillsDir)
    const before = statSync(join(skillsDir, '.orca-builtin.json')).mtimeMs
    const second = seedBuiltinSkills(builtinDir, skillsDir)

    expect(first).toEqual({ seeded: [], pruned: [], skipped: false, version: '1.0.0' })
    expect(marker()).toMatchObject({ version: '1.0.0', skills: [] })
    expect(second).toEqual({ seeded: [], pruned: [], skipped: true, version: '1.0.0' })
    expect(statSync(join(skillsDir, '.orca-builtin.json')).mtimeMs).toBe(before)
  })

  it('marker 의 비안전 이름은 prune 하지 않는다', () => {
    manifest('1.0.0', [])
    mkdirSync(skillsDir, { recursive: true })
    writeFileSync(
      join(skillsDir, '.orca-builtin.json'),
      JSON.stringify({ version: '0.9.0', skills: ['../outside', 'safe'] }),
      'utf8'
    )
    write(join(root, 'sources', 'outside', 'sentinel.txt'), 'keep')
    sourceSkill('safe')

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({ seeded: [], pruned: ['safe'], skipped: false, version: '1.0.0' })
    expect(readFileSync(join(root, 'sources', 'outside', 'sentinel.txt'), 'utf8')).toBe('keep')
    expect(existsSync(join(skillsDir, 'safe'))).toBe(false)
  })

  it('소스 디렉토리가 없는 manifest skill 은 marker 에 관리 대상으로 기록하지 않는다', () => {
    manifest('1.0.0', ['missing'])

    const result = seedBuiltinSkills(builtinDir, skillsDir)

    expect(result).toEqual({ seeded: [], pruned: [], skipped: false, version: '1.0.0' })
    expect(marker()).toMatchObject({ version: '1.0.0', skills: [] })
  })
})

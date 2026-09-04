import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { gitDiffPatch } from './git-diff'
import { runGit } from './runner'

const repos: string[] = []
async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runGit(cwd, args)
  if (!result.ok) throw new Error(result.stderr)
  return result.stdout.trim()
}
async function repo(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'orca-commit-diff-'))
  repos.push(cwd)
  await git(cwd, ['init', '--initial-branch=main'])
  await git(cwd, ['config', 'user.email', 'test@orca.local'])
  await git(cwd, ['config', 'user.name', 'orca test'])
  return cwd
}
async function commit(cwd: string, message: string): Promise<string> {
  await git(cwd, ['add', '.'])
  await git(cwd, ['commit', '--allow-empty', '-m', message])
  return git(cwd, ['rev-parse', 'HEAD'])
}
const content = (count: number): string =>
  Array.from({ length: count }, (_, i) => `line ${i + 1}\n`).join('')

afterAll(async () => {
  for (const cwd of repos) {
    if (!resolve(cwd).startsWith(`${resolve(tmpdir())}${sep}orca-commit-diff-`))
      throw new Error('Unexpected test repo path')
    await rm(cwd, { recursive: true, force: true })
  }
})

describe('커밋별 patch — 실제 Git 비교', () => {
  it('100줄과 20줄 커밋은 각각 100/20, 전체는 120이며 이후 HEAD/작업트리와 독립적이다', async () => {
    const cwd = await repo()
    const baseOid = await commit(cwd, 'base')
    await writeFile(join(cwd, 'lines.txt'), content(100))
    const first = await commit(cwd, 'add 100')
    await writeFile(join(cwd, 'lines.txt'), content(120))
    const second = await commit(cwd, 'add 20')

    const selected = await gitDiffPatch({ cwd, baseOid, commitSha: second })
    expect(selected.files[0]?.added).toBe(20)
    expect(selected.files[0]?.lines.filter((line) => line.type === 'added')).toHaveLength(20)
    expect(selected.base).toEqual({ kind: 'commit-parent', oid: first, commitOid: second })
    expect((await gitDiffPatch({ cwd, baseOid, commitSha: first })).files[0]?.added).toBe(100)
    expect((await gitDiffPatch({ cwd, baseOid })).files[0]?.added).toBe(120)
    expect(await git(cwd, ['diff', '--numstat', first, second])).toBe('20\t0\tlines.txt')

    await writeFile(join(cwd, 'lines.txt'), content(130))
    await commit(cwd, 'add later 10')
    await writeFile(join(cwd, 'lines.txt'), content(150))
    expect((await gitDiffPatch({ cwd, baseOid, commitSha: second })).files).toEqual(selected.files)
  }, 30000)

  it('root는 empty tree 대비이고 없는 커밋은 누적 본문으로 폴백하지 않는다', async () => {
    const cwd = await repo()
    await writeFile(join(cwd, 'root.txt'), 'root\n')
    const root = await commit(cwd, 'root')
    expect((await gitDiffPatch({ cwd, commitSha: root })).files[0]?.added).toBe(1)
    const missing = await gitDiffPatch({ cwd, commitSha: 'f'.repeat(40) })
    expect(missing).toMatchObject({ isRepo: true, unavailable: true, files: [] })
  }, 15000)

  it('merge 커밋은 첫 부모와 비교한다', async () => {
    const cwd = await repo()
    await writeFile(join(cwd, 'base.txt'), 'base\n')
    const baseOid = await commit(cwd, 'base')
    await git(cwd, ['checkout', '-b', 'topic'])
    await writeFile(join(cwd, 'topic.txt'), 'topic\n')
    await commit(cwd, 'topic')
    await git(cwd, ['checkout', 'main'])
    await writeFile(join(cwd, 'main.txt'), 'main\n')
    const parent = await commit(cwd, 'main')
    await git(cwd, ['merge', '--no-ff', 'topic', '-m', 'merge'])
    const sha = await git(cwd, ['rev-parse', 'HEAD'])
    const patch = await gitDiffPatch({ cwd, baseOid, commitSha: sha })
    expect(patch.base).toEqual({ kind: 'commit-parent', oid: parent, commitOid: sha })
    expect(patch.files.map((file) => file.path)).toEqual(['topic.txt'])
  }, 30000)
})

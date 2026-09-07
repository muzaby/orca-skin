import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { removeTempRoots } from './temp-repo.testfixture'
import { gitDiffPatch } from './git-diff'
import { runGit } from './runner'

// **파일 예산 225s** — 최악 케이스(100/20줄 커밋)는 실제 git 을 직렬로 25회 띄운다
// (`repo()` 3 + `commit()` 4회 12 + `gitDiffPatch` 4회 9 + `diff --numstat` 1). self-hosted windows 러너의 실측 spawn 은 약 6s 로
// 레포 기준(약 2s)의 3배라, 상한을 25 × 6s × 1.5(여유) = 225s 로 잡는다. 글로벌 20s
// (`vitest.config.ts`)는 그대로 두고 **이 파일만** 넓힌다. 훅도 같은 값이다 — 기본 10s 는
// 실제 저장소를 만드는 훅을 담지 못하고, 끊긴 훅은 고아를 남겨 정리까지 함께 무너뜨린다.
vi.setConfig({ testTimeout: 225_000, hookTimeout: 225_000 })

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

// 정리는 `removeTempRoots` 하나로 모은다 — `rm` 을 직접 부르면 끊긴 케이스가 남긴 고아 git
// 자식을 그대로 밟아 EBUSY/EPERM 이 난다(픽스처 주석 참고).
afterAll(async () => {
  for (const cwd of repos) {
    if (!resolve(cwd).startsWith(`${resolve(tmpdir())}${sep}orca-commit-diff-`))
      throw new Error('Unexpected test repo path')
  }
  await removeTempRoots(repos)
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
  })

  it('root는 empty tree 대비이고 없는 커밋은 누적 본문으로 폴백하지 않는다', async () => {
    const cwd = await repo()
    await writeFile(join(cwd, 'root.txt'), 'root\n')
    const root = await commit(cwd, 'root')
    expect((await gitDiffPatch({ cwd, commitSha: root })).files[0]?.added).toBe(1)
    const missing = await gitDiffPatch({ cwd, commitSha: 'f'.repeat(40) })
    expect(missing).toMatchObject({ isRepo: true, unavailable: true, files: [] })
  })

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
  })
})

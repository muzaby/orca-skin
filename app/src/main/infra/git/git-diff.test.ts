// 0211 VP-09 · VP-10 · VP-11 · VP-12 — **실제 임시 저장소** 대비 diff 조회.
//
// fake 를 쓰지 않는 이유: 이 코드가 하는 일이 곧 git 출력 해석이라, git 을 흉내내면 흉내가
// 틀린 만큼 조용히 초록이 된다. `worktree.test.ts`·`repository.test.ts` 가 이미 쓰는 형태다.
//
// 경로는 **값으로 비교하지 않는다** — Windows 의 `\` 와 POSIX 의 `/` 가 갈린다(0208 AT-29).
// git 이 주는 diff 경로는 항상 `/` 이므로 그것만 단언한다.

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gitDiffFile, gitDiffSummary, resolveDiffRange } from './git-diff'
import { MAX_DIFF_FILE_BYTES } from './git-diff-parse'
import { runGit } from './runner'

const dirs: string[] = []

afterAll(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function git(cwd: string, args: string[]): Promise<void> {
  const result = await runGit(cwd, args)
  if (!result.ok) throw new Error(`git ${args.join(' ')} → ${result.stderr}`)
}

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-diff-'))
  dirs.push(dir)
  await git(dir, ['init', '--initial-branch=main'])
  await git(dir, ['config', 'user.email', 'test@orca.local'])
  await git(dir, ['config', 'user.name', 'orca test'])
  return dir
}

async function head(cwd: string): Promise<string> {
  const result = await runGit(cwd, ['rev-parse', 'HEAD'], { readOnly: true })
  return result.stdout.trim()
}

describe('diff 요약 — 범위와 목록 (VP-09)', () => {
  let repo: string
  let baseOid: string

  beforeAll(async () => {
    repo = await makeRepo()
    await writeFile(join(repo, 'kept.ts'), 'const a = 1\n')
    await writeFile(join(repo, 'edited.ts'), 'line one\nline two\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    baseOid = await head(repo)
    // 추적 파일 수정 1 + 미추적 파일 생성 1.
    await writeFile(join(repo, 'edited.ts'), 'line one\nline two changed\nline three\n')
    await writeFile(join(repo, 'fresh.ts'), 'new file\nsecond\n')
  })

  it('managed row 가 있으면 base_oid 대비다 — 커밋된 것과 미커밋을 함께 본다', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.isRepo).toBe(true)
    expect(summary.base).toEqual({ kind: 'worktree-base', oid: baseOid })
  })

  it('row 가 없으면 HEAD 대비다 — 가짜 base 를 만들지 않는다', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid: null })
    expect(summary.base).toEqual({ kind: 'head', oid: await head(repo) })
    expect(summary.commits).toEqual([])
    expect(summary.uncommitted).toEqual({
      files: summary.files,
      totals: summary.totals,
      filesTruncated: summary.filesTruncated
    })
  })

  it('추적 + 미추적 fixture에서 추적 변경만 목록·합계에 남는다 (VP-30)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    const paths = summary.files.map((f) => f.path).sort()
    expect(paths).toEqual(['edited.ts'])
    expect(paths).not.toContain('fresh.ts')
    const edited = summary.files.find((f) => f.path === 'edited.ts')!
    expect(summary.totals).toEqual({ added: edited.added, removed: edited.removed })
    expect(summary.totals.added).toBeGreaterThan(0)
    // 바뀌지 않은 파일은 목록에 없다 — 음성 짝.
    expect(paths).not.toContain('kept.ts')
  })

  // AT-18 증상 반증 — 사용자가 본 `+0−0` 이 여기서 재현되면 안 된다.
  it('base 위에 커밋하고 트리가 깨끗해도 합계가 0 이 아니다 (AT-18)', async () => {
    const committed = await makeRepo()
    await writeFile(join(committed, 'a.ts'), ['one', ''].join('\n'))
    await git(committed, ['add', '.'])
    await git(committed, ['commit', '-m', 'base'])
    const base = await head(committed)
    // 에이전트가 한 일 = 커밋. 작업 트리는 깨끗하다.
    await writeFile(join(committed, 'a.ts'), ['one', 'two', 'three', ''].join('\n'))
    await git(committed, ['add', '.'])
    await git(committed, ['commit', '-m', 'work'])

    // HEAD 대비(비격리)는 0 이다 — 그것이 사용자가 본 `+0−0` 의 정체다.
    const headScope = await gitDiffSummary({ cwd: committed, baseOid: null })
    expect(headScope.totals).toEqual({ added: 0, removed: 0 })
    // base 대비(격리)는 그 커밋을 센다.
    const baseScope = await gitDiffSummary({ cwd: committed, baseOid: base })
    expect(baseScope.totals.added).toBeGreaterThan(0)
    expect(baseScope.files.map((f) => f.path)).toEqual(['a.ts'])
  })

  it('저장소가 아니면 빈 요약이다 — 타일이 사라지지 않는다', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'orca-nonrepo-'))
    dirs.push(outside)
    const summary = await gitDiffSummary({ cwd: outside, baseOid: null })
    expect(summary.isRepo).toBe(false)
    expect(summary.files).toEqual([])
    // 필수 필드다 — optional 로 두면 소비자가 조용히 옛 dirty 로 폴백한다.
    expect(summary.totals).toEqual({ added: 0, removed: 0 })
  })
})

describe('diff 파일 본문 (VP-10)', () => {
  let repo: string
  let baseOid: string

  beforeAll(async () => {
    repo = await makeRepo()
    await writeFile(join(repo, 'edited.ts'), 'before\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    baseOid = await head(repo)
    await writeFile(join(repo, 'edited.ts'), 'after\n')
  })

  it('old 는 base 시점, new 는 작업 트리다', async () => {
    const content = await gitDiffFile({ cwd: repo, path: 'edited.ts', baseOid })
    expect(content).toEqual({
      kind: 'text',
      oldValue: 'before\n',
      newValue: 'after\n',
      truncated: false
    })
  })

  it('base 에 없던 staged 파일은 old 가 빈 문자열이다', async () => {
    await writeFile(join(repo, 'staged.ts'), 'brand new\n')
    await git(repo, ['add', 'staged.ts'])
    const content = await gitDiffFile({ cwd: repo, path: 'staged.ts', baseOid })
    expect(content).toEqual({
      kind: 'text',
      oldValue: '',
      newValue: 'brand new\n',
      truncated: false
    })
  })

  it('삭제된 파일은 new 가 빈 문자열이다 — 작업 트리에 없는 것이 정상이다', async () => {
    await rm(join(repo, 'edited.ts'))
    const content = await gitDiffFile({ cwd: repo, path: 'edited.ts', baseOid })
    expect(content).toEqual({
      kind: 'text',
      oldValue: 'before\n',
      newValue: '',
      truncated: false
    })
    await writeFile(join(repo, 'edited.ts'), 'after\n')
  })

  it('binary 는 본문 대신 종류를 돌려준다', async () => {
    await writeFile(join(repo, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02, 0x00]))
    await git(repo, ['add', 'blob.bin'])
    const content = await gitDiffFile({ cwd: repo, path: 'blob.bin', baseOid })
    expect(content).toEqual({ kind: 'binary' })
  })

  it('추적된 1 MiB 초과 파일은 too-large로 유지한다', async () => {
    await writeFile(join(repo, 'large.txt'), 'x'.repeat(MAX_DIFF_FILE_BYTES + 1))
    await git(repo, ['add', 'large.txt'])

    await expect(gitDiffFile({ cwd: repo, path: 'large.txt', baseOid })).resolves.toEqual({
      kind: 'unavailable',
      reason: 'too-large'
    })
  })

  it('baseline 범위 밖의 미추적 파일 본문은 돌려주지 않는다', async () => {
    await writeFile(join(repo, 'untracked.ts'), 'private working copy\n')

    await expect(gitDiffFile({ cwd: repo, path: 'untracked.ts', baseOid })).resolves.toEqual({
      kind: 'unavailable',
      reason: 'error'
    })
  })
})

describe('raw history delimiter safety (VP-31)', () => {
  it('실제 Git의 루트 orca-commit 파일을 commit header로 오인하지 않는다', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'base.ts'), 'base\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    const baseOid = await head(repo)

    await writeFile(join(repo, 'orca-commit'), 'one\ntwo\n')
    await git(repo, ['add', 'orca-commit'])
    await git(repo, ['commit', '-m', 'root path'])

    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toHaveLength(1)
    expect(summary.commits[0]).toMatchObject({
      subject: 'root path',
      fileCount: 1,
      totals: { added: 2, removed: 0 }
    })
    expect(summary.commits[0].files).toEqual([
      { path: 'orca-commit', status: 'added', added: 2, removed: 0, binary: false }
    ])
  })
})

describe('커밋 grouping과 미커밋 블록 (VP-31 · VP-33)', () => {
  let repo: string
  let baseOid: string
  let sha1: string
  let sha2: string

  beforeAll(async () => {
    repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'v0\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    baseOid = await head(repo)

    await writeFile(join(repo, 'a.ts'), 'v1\n')
    await git(repo, ['commit', '-am', 'first change', '-m', 'first body'])
    sha1 = await head(repo)

    await writeFile(join(repo, 'b.ts'), 'only in second\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'second change'])
    sha2 = await head(repo)

    // 같은 파일이 커밋 노드와 미커밋 블록에 동시에 등장하는 정상 중복을 만든다.
    await writeFile(join(repo, 'a.ts'), 'v2-worktree\n')
  })

  it('격리 세션의 커밋 목록은 base..HEAD 실제 커밋이다 (VP-12)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toHaveLength(2)
    expect(summary.commits.map((c) => c.subject)).toEqual(['second change', 'first change'])
    expect(summary.commits[0].sha).toBe(sha2)
    expect(summary.commits[0].author).toBe('orca test')
    expect(summary.commits[0]).not.toHaveProperty('body')
    expect(summary.commits[0]).toMatchObject({
      fileCount: 1,
      totals: { added: 1, removed: 0 },
      filesTruncated: false
    })
    expect(summary.commits[0].files.map((file) => [file.path, file.status])).toEqual([
      ['b.ts', 'added']
    ])
    expect(summary.commits[1]).toMatchObject({ body: 'first body\n', fileCount: 1 })
    expect(summary.commits[1].files.map((file) => file.path)).toEqual(['a.ts'])
  })

  it('row 가 없으면 커밋 목록이 비어 있다 — base 를 모르면 셀 수 없다 (D-013)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid: null })
    expect(summary.commits).toEqual([])
  })

  it('커밋에도 있는 파일이 HEAD 뒤에 다시 바뀌면 uncommitted에도 따로 남는다', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(
      summary.commits.find((commit) => commit.sha === sha1)?.files.map((file) => file.path)
    ).toEqual(['a.ts'])
    expect(summary.uncommitted.files.map((file) => file.path)).toEqual(['a.ts'])
    expect(summary.files.map((file) => file.path).sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('파일 본문은 느 그룹에서 열었든 항상 baseline 대비 작업 트리다', async () => {
    const content = await gitDiffFile({ cwd: repo, path: 'a.ts', baseOid })
    expect(content).toEqual({
      kind: 'text',
      oldValue: 'v0\n',
      newValue: 'v2-worktree\n',
      truncated: false
    })
  })
})

describe('범위 해석 SSOT (VP-35)', () => {
  it('커밋이 하나도 없는 저장소는 base 가 none 이다', async () => {
    const repo = await makeRepo()
    const range = await resolveDiffRange({ cwd: repo, baseOid: null })
    expect(range).toEqual({ kind: 'working', base: { kind: 'none' } })
  })

  it('HEAD와 baseline이 같아도 미커밋 변경은 별도 블록에 남는다', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'base\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    const baseOid = await head(repo)
    await writeFile(join(repo, 'a.ts'), 'working\n')

    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toEqual([])
    expect(summary.uncommitted.files.map((file) => file.path)).toEqual(['a.ts'])
    expect(summary.uncommitted.totals).toEqual(summary.totals)
  })
})

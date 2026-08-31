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
    expect(summary.base).toEqual({ kind: 'head' })
  })

  it('추적 수정 1 + 미추적 1 = 2건이고 미추적은 수치 0 이다 (D-026)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    const paths = summary.files.map((f) => f.path).sort()
    expect(paths).toEqual(['edited.ts', 'fresh.ts'])
    const fresh = summary.files.find((f) => f.path === 'fresh.ts')!
    expect(fresh.status).toBe('added')
    // 목록에는 남지만 수치에는 더하지 않는다 — 2줄짜리 파일인데 0 이다.
    expect([fresh.added, fresh.removed]).toEqual([0, 0])
    // 합계는 추적 파일 하나의 실측과 정확히 같다 — 미추적 2줄이 섞이지 않는다.
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
    await writeFile(join(repo, 'fresh.ts'), 'brand new\n')
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

  it('미추적 파일은 old 가 빈 문자열이다 — base 에 없던 파일이다', async () => {
    const content = await gitDiffFile({ cwd: repo, path: 'fresh.ts', baseOid })
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
    const content = await gitDiffFile({ cwd: repo, path: 'blob.bin', baseOid })
    expect(content).toEqual({ kind: 'binary' })
  })
})

describe('커밋 선택과 커밋 목록 (VP-11 · VP-12)', () => {
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
    await git(repo, ['commit', '-am', 'first change'])
    sha1 = await head(repo)

    await writeFile(join(repo, 'b.ts'), 'only in second\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'second change'])
    sha2 = await head(repo)

    // **작업 트리를 커밋과 다르게 둔다** — 이것이 없으면 `commit` 범위와 `working` 범위가
    // 같은 답을 내서, 본문 조회가 범위 해석을 우회해도 초록이다(VP-11 등록 변이 M5 실측).
    await writeFile(join(repo, 'a.ts'), 'v2-worktree\n')
  })

  it('격리 세션의 커밋 목록은 base..HEAD 실제 커밋이다 (VP-12)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toHaveLength(2)
    expect(summary.commits.map((c) => c.subject)).toEqual(['second change', 'first change'])
    expect(summary.commits[0].sha).toBe(sha2)
    expect(summary.commits[0].author).toBe('orca test')
  })

  it('row 가 없으면 커밋 목록이 비어 있다 — base 를 모르면 셀 수 없다 (D-013)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid: null })
    expect(summary.commits).toEqual([])
  })

  it('커밋을 고르면 그 커밋 하나의 파일만 나온다 (VP-11)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid, commit: sha2 })
    expect(summary.files.map((f) => f.path)).toEqual(['b.ts'])
    // 전체 범위였다면 a.ts 도 함께 나온다 — 범위가 실제로 좁아졌다는 음성 짝.
    const all = await gitDiffSummary({ cwd: repo, baseOid })
    expect(all.files.map((f) => f.path).sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('커밋 범위의 본문은 그 커밋의 부모 대비다 — 두 채널이 같은 범위를 쓴다', async () => {
    const content = await gitDiffFile({ cwd: repo, path: 'a.ts', baseOid, commit: sha1 })
    expect(content).toEqual({
      kind: 'text',
      // 커밋 범위이므로 new 는 **그 커밋의 내용**이다 — 작업 트리(`v2-worktree`)가 아니다.
      // 본문 조회가 범위 해석을 우회하면 여기가 red 다(VP-11 등록 변이).
      oldValue: 'v0\n',
      newValue: 'v1\n',
      truncated: false
    })
  })

  it('전체 범위의 본문은 작업 트리 대비다 — 같은 파일이 범위에 따라 다른 답을 준다', async () => {
    const content = await gitDiffFile({ cwd: repo, path: 'a.ts', baseOid })
    expect(content).toEqual({
      kind: 'text',
      oldValue: 'v0\n',
      newValue: 'v2-worktree\n',
      truncated: false
    })
  })
})

describe('범위 해석 SSOT (VP-11 · EP-07)', () => {
  it('commit 이 base_oid 를 이긴다 — 커밋을 고르면 작업 트리를 보지 않는다', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'x\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'c'])
    const range = await resolveDiffRange({ cwd: repo, commit: 'abc1234', baseOid: 'deadbeef' })
    expect(range).toEqual({ kind: 'commit', sha: 'abc1234' })
  })

  it('커밋이 하나도 없는 저장소는 base 가 none 이다', async () => {
    const repo = await makeRepo()
    const range = await resolveDiffRange({ cwd: repo, baseOid: null })
    expect(range).toEqual({ kind: 'working', base: { kind: 'none' } })
  })
})

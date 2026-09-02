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
import { gitDiffPatch, gitDiffSummary, resolveDiffRange, type GitDiffRunner } from './git-diff'
import { runGit } from './runner'
import type { GitDiffPatchFile } from '../../../shared/ipc'

/** 패치의 그 파일 — 없으면 undefined 라 테스트가 "목록에 없다" 도 단언할 수 있다. */
function fileOf(files: readonly GitDiffPatchFile[], path: string): GitDiffPatchFile | undefined {
  return files.find((file) => file.path === path)
}

/** 줄 배열을 `'+after' | '-before' | ' ctx'` 문자열로 눌러 비교를 읽기 쉽게 한다. */
function shape(file: GitDiffPatchFile | undefined): string[] {
  return (file?.lines ?? []).map(
    (line) => `${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}${line.text}`
  )
}

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
    // 0211 ΔV4 — 이름을 안 넘겼으면 `ref` 는 null 이다. 화면은 그때 oid 7자로 접는다(D-071).
    expect(summary.base).toEqual({ kind: 'worktree-base', oid: baseOid, ref: null })
  })

  it('baseRef 를 넘기면 그 이름이 그대로 실린다 — 라벨의 유일한 출처다 (AT-43)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid, baseRef: 'main' })

    expect(summary.base).toEqual({ kind: 'worktree-base', oid: baseOid, ref: 'main' })
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

describe('diff 패치 — 파일별 줄 (VP-55)', () => {
  let repo: string
  let baseOid: string

  beforeAll(async () => {
    repo = await makeRepo()
    await writeFile(join(repo, 'edited.ts'), 'before\n')
    await writeFile(join(repo, 'gone.ts'), 'x\ny\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    baseOid = await head(repo)
    await writeFile(join(repo, 'edited.ts'), 'after\n')
  })

  it('한 호출이 수정·추가·삭제·binary 를 함께 싣는다 — 파일 수와 무관하다 (AT-47)', async () => {
    await writeFile(join(repo, 'staged.ts'), 'brand new\n')
    await rm(join(repo, 'gone.ts'))
    await writeFile(join(repo, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02, 0x00]))
    await git(repo, ['add', '-A'])

    const patch = await gitDiffPatch({ cwd: repo, baseOid })

    expect(patch.isRepo).toBe(true)
    expect(patch.contextLimited).toBe(false)
    expect(patch.unavailable).toBe(false)
    expect(shape(fileOf(patch.files, 'edited.ts'))).toEqual(['-before', '+after'])
    expect(fileOf(patch.files, 'staged.ts')?.status).toBe('added')
    expect(shape(fileOf(patch.files, 'staged.ts'))).toEqual(['+brand new'])
    expect(fileOf(patch.files, 'gone.ts')?.status).toBe('deleted')
    expect(shape(fileOf(patch.files, 'gone.ts'))).toEqual(['-x', '-y'])
    const binary = fileOf(patch.files, 'blob.bin')
    expect(binary?.kind).toBe('binary')
    expect(binary?.lines).toEqual([])
  })

  it('전문맥이다 — 변경 주변이 아니라 파일 전체가 온다 (D-076)', async () => {
    const wide = await makeRepo()
    const body = Array.from({ length: 40 }, (_, i) => `line${i + 1}`).join('\n')
    await writeFile(join(wide, 'wide.ts'), `${body}\n`)
    await git(wide, ['add', '.'])
    await git(wide, ['commit', '-m', 'base'])
    const oid = await head(wide)
    await writeFile(join(wide, 'wide.ts'), `${body.replace('line20', 'CHANGED')}\n`)

    const patch = await gitDiffPatch({ cwd: wide, baseOid: oid })
    const file = fileOf(patch.files, 'wide.ts')

    // 변경 1쌍 + 문맥 39줄 = 41. `-U3` 이었다면 9줄이다.
    expect(file?.lines).toHaveLength(41)
    expect(file?.lines[0]).toMatchObject({ type: 'unchanged', text: 'line1' })
  })

  it('한글·공백 경로가 이스케이프되지 않는다 — core.quotePath=false (EP-29 ②)', async () => {
    const repoKo = await makeRepo()
    await writeFile(join(repoKo, '한글 파일.txt'), 'a\n')
    await git(repoKo, ['add', '.'])
    await git(repoKo, ['commit', '-m', 'base'])
    const oid = await head(repoKo)
    await writeFile(join(repoKo, '한글 파일.txt'), 'b\n')

    const patch = await gitDiffPatch({ cwd: repoKo, baseOid: oid })

    expect(patch.files.map((file) => file.path)).toEqual(['한글 파일.txt'])
  })

  it('rename 은 새 경로에 옛 경로를 함께 싣는다', async () => {
    const repoRe = await makeRepo()
    await writeFile(join(repoRe, 'src.txt'), 'a\nb\nc\nd\n')
    await git(repoRe, ['add', '.'])
    await git(repoRe, ['commit', '-m', 'base'])
    const oid = await head(repoRe)
    await git(repoRe, ['mv', 'src.txt', 'dst.txt'])

    const patch = await gitDiffPatch({ cwd: repoRe, baseOid: oid })

    expect(fileOf(patch.files, 'dst.txt')).toMatchObject({
      status: 'renamed',
      oldPath: 'src.txt'
    })
  })

  it('미추적 파일은 패치에 없다 — D-035 가 패치 축에서도 성립한다', async () => {
    await writeFile(join(repo, 'untracked.ts'), 'private working copy\n')

    const patch = await gitDiffPatch({ cwd: repo, baseOid })

    expect(fileOf(patch.files, 'untracked.ts')).toBeUndefined()
  })

  it('저장소가 아니면 빈 패치다 — 화면이 사라지지 않는다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orca-diff-none-'))
    dirs.push(dir)

    await expect(gitDiffPatch({ cwd: dir })).resolves.toMatchObject({
      isRepo: false,
      files: []
    })
  })
})

describe('패치 조회 인자와 폴백 (VP-55 · VP-48 회귀)', () => {
  function collectingRunner(fail: (args: readonly string[]) => boolean): {
    calls: string[][]
    runner: GitDiffRunner
  } {
    const calls: string[][] = []
    const runner: GitDiffRunner = async (_cwd, args) => {
      calls.push([...args])
      if (args.includes('--is-inside-work-tree'))
        return { ok: true, stdout: 'true\n/repo\n', stderr: '', code: 0, aborted: false }
      if (fail(args)) return { ok: false, stdout: '', stderr: 'boom', code: null, aborted: false }
      return { ok: true, stdout: '', stderr: '', code: 0, aborted: false }
    }
    return { calls, runner }
  }

  it('성공 경로는 전문맥 한 호출이고 모든 인자가 잠금을 피한다', async () => {
    const { calls, runner } = collectingRunner(() => false)

    await gitDiffPatch({ cwd: '/repo', baseOid: 'b'.repeat(40) }, runner)

    const patchCalls = calls.filter((args) => args.includes('diff'))
    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0]).toContain('--unified=1000000')
    expect(patchCalls[0]).toContain('core.quotePath=false')
    // 누락 0건을 **차집합**으로 센다 — "있다" 를 몇 건 세면 새 호출부를 놓친다(AT-39).
    expect(calls.filter((args) => args[0] !== '--no-optional-locks')).toEqual([])
  })

  it('전문맥 조회가 실패하면 --unified=3 으로 한 번 더 부르고 contextLimited 를 싣는다', async () => {
    const { calls, runner } = collectingRunner((args) => args.includes('--unified=1000000'))

    const patch = await gitDiffPatch({ cwd: '/repo', baseOid: 'b'.repeat(40) }, runner)

    const patchCalls = calls.filter((args) => args.includes('diff'))
    expect(patchCalls).toHaveLength(2)
    expect(patchCalls[1]).toContain('--unified=3')
    expect(patchCalls[1]).not.toContain('--unified=1000000')
    expect(patch.contextLimited).toBe(true)
    expect(patch.unavailable).toBe(false)
  })

  it('폴백까지 실패하면 unavailable 이다 — 빈 목록을 "변경 없음" 으로 읽히게 두지 않는다', async () => {
    const { runner } = collectingRunner((args) => args.includes('diff'))

    const patch = await gitDiffPatch({ cwd: '/repo', baseOid: 'b'.repeat(40) }, runner)

    expect(patch).toMatchObject({ isRepo: true, files: [], unavailable: true })
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

  it('패치의 파일 줄은 커밋을 골라도 baseline 대비 작업 트리다 (D-036 회귀)', async () => {
    const patch = await gitDiffPatch({ cwd: repo, baseOid })
    const file = patch.files.find((entry) => entry.path === 'a.ts')

    expect(shape(file)).toEqual(['-v0', '+v2-worktree'])
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

// 0211 ΔV3 — `readDiff` 가 두 호출에서 한 호출로 바뀌었다(D-062). **status 는 그 한 호출의
// `--raw` 블록에서만 온다** — 그 플래그가 빠지면 모든 파일이 조용히 `modified` 가 된다.
// 커밋 노드의 status 는 다른 케이스가 이미 잠갔고, 여기서는 **세션 파일 목록**을 센다.
describe('세션 파일 목록의 status (AT-39 산출 동등 · EP-25 ①)', () => {
  let repo: string

  beforeAll(async () => {
    repo = await makeRepo()
    await writeFile(join(repo, 'keep.ts'), 'a\n')
    await writeFile(join(repo, 'gone.ts'), 'b\n')
    await writeFile(join(repo, 'old.ts'), 'same content stays identical for rename detection\n')
    await git(repo, ['add', '.'])
    await git(repo, ['commit', '-m', 'base'])
    await writeFile(join(repo, 'keep.ts'), 'a\nb\n')
    await rm(join(repo, 'gone.ts'))
    await git(repo, ['mv', 'old.ts', 'new.ts'])
    await writeFile(join(repo, 'fresh.ts'), 'c\n')
    await git(repo, ['add', '-A'])
  })

  afterAll(async () => {
    await rm(repo, { recursive: true, force: true })
  })

  it('추가·삭제·수정·이름변경이 각각 다른 status 로 온다', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid: await head(repo) })
    const byPath = new Map(summary.files.map((f) => [f.path, f.status]))

    expect(byPath.get('fresh.ts')).toBe('added')
    expect(byPath.get('gone.ts')).toBe('deleted')
    expect(byPath.get('keep.ts')).toBe('modified')
    // rename 은 새 경로에 표시된다 — 네 종류가 **서로 다른** 값이라야 계약이 잠긴다.
    expect(byPath.get('new.ts')).toBe('renamed')
    expect(new Set(byPath.values()).size).toBe(4)
  })
})

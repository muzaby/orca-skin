// 0211 VP-09 · VP-10 · VP-11 · VP-12 — **실제 임시 저장소** 대비 diff 조회.
//
// fake 를 쓰지 않는 이유: 이 코드가 하는 일이 곧 git 출력 해석이라, git 을 흉내내면 흉내가
// 틀린 만큼 조용히 초록이 된다. `worktree.test.ts`·`repository.test.ts` 가 이미 쓰는 형태다.
//
// 경로는 **값으로 비교하지 않는다** — Windows 의 `\` 와 POSIX 의 `/` 가 갈린다(0208 AT-29).
// git 이 주는 diff 경로는 항상 `/` 이므로 그것만 단언한다.

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRepo, appendCommit, type TempRepo, removeTempRoots } from './temp-repo.testfixture'
import { gitDiffPatch, gitDiffSummary, resolveDiffRange, type GitDiffRunner } from './git-diff'
import { type GitRunResult } from './runner'
import { createGitGateway } from './gateway'
import type { GitDiffPatchFile } from '../../../shared/ipc'
import { scaledBudget } from '../../../../scripts/test-time.mjs'

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

// **파일 예산 135s** — 이 스위트의 최악 케이스(AT-18)는 실제 git 을 직렬로 15회 띄운다
// (`makeRepo` 3 + 준비 커밋 5 + `gitDiffSummary` 2회 7). self-hosted windows 러너의 실측
// spawn 은 약 6s 로 레포 기준(약 2s)의 3배라, 상한을 15 × 6s × 1.5(여유) = 135s 로 잡는다.
// 글로벌 20s(`vitest.config.ts`)는 그대로 두고 **이 파일만** 넓힌다 — 전역을 올리면 git 을
// 쓰지 않는 3천여 케이스의 멈춤 보고까지 함께 늦어진다.
//
// hookTimeout 을 같은 값으로 함께 못 박는 이유: 기본값 10s 는 여기 `beforeAll` 의 spawn
// 11회(6s × 11 = 66s)를 애초에 담지 못한다. 예산이 끊긴 훅/케이스는 git 핸들을 연 채 죽고,
// 남은 고아가 정리 `rm` 을 EBUSY 로 밀어 케이스 하나의 실패가 스위트 전체로 번진다.
vi.setConfig(scaledBudget({ testTimeout: 135_000, hookTimeout: 135_000 }))

const dirs: string[] = []

// 정리는 `removeTempRoots` 하나로 모은다 — `rm` 을 직접 부르면 끊긴 케이스가 남긴 고아 git
// 자식을 그대로 밟아 EBUSY/EPERM 이 난다(픽스처 주석 참고).
afterAll(() => removeTempRoots(dirs.splice(0)))

const fixtures = new Map<string, TempRepo>()
const knownFiles = new Map<string, Set<string>>()
async function makeRepo(commits: Parameters<typeof createRepo>[1] = {}): Promise<string> {
  const fixture = await createRepo(dirs, commits)
  fixtures.set(fixture.root, fixture)
  const paths = new Set<string>()
  for (const commit of commits.commits ?? [])
    for (const [path, value] of Object.entries(commit.files ?? {})) {
      if (value === null) paths.delete(path)
      else paths.add(path)
    }
  knownFiles.set(fixture.root, paths)
  return fixture.root
}

async function commitSnapshot(cwd: string, message: string, date?: string): Promise<void> {
  const files: Record<string, Buffer | null> = {}
  const names = new Set<string>()
  for (const entry of await readdir(cwd, { recursive: true, withFileTypes: true })) {
    const relative = join(entry.parentPath, entry.name)
      .slice(cwd.length + 1)
      .replaceAll('\\', '/')
    if (relative === '.git' || relative.startsWith('.git/') || !entry.isFile()) continue
    names.add(relative)
    files[relative] = await readFile(join(cwd, relative))
  }
  for (const old of knownFiles.get(cwd) ?? []) if (!names.has(old)) files[old] = null
  await appendCommit(fixtures.get(cwd)!, { message, date, files })
  knownFiles.set(cwd, names)
}
function commitAt(cwd: string, message: string, iso: string): Promise<void> {
  return commitSnapshot(cwd, message, iso)
}
async function head(cwd: string): Promise<string> {
  return fixtures.get(cwd)!.oids.at(-1)!
}

describe('diff 요약 — 범위와 목록 (VP-09)', () => {
  let repo: string
  let baseOid: string

  beforeAll(async () => {
    repo = await makeRepo({
      commits: [
        {
          message: 'base',
          files: { 'kept.ts': 'const a = 1\n', 'edited.ts': 'line one\nline two\n' }
        },
        { message: 'work', files: { 'edited.ts': 'line one\nline two changed\nline three\n' } }
      ]
    })
    baseOid = fixtures.get(repo)!.oids[0]
    // 그리고 커밋하지 않은 것 둘 — 추적 파일 수정 1 + 미추적 파일 생성 1.
    await writeFile(join(repo, 'kept.ts'), 'const a = 2\n')
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
  })

  // AT-72 — 커밋된 것만 온다. **집합 동등**으로 센다: “커밋한 파일이 있다” 만 보면
  // 세 파일이 다 오는 구현이 그대로 통과한다(범위를 안 좁힌 변이가 red 여야 한다).
  it('커밋된 변경만 목록에 온다 — 미커밋 추적도 미추적도 없다 (D-111)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })

    expect(summary.files.map((f) => f.path).sort()).toEqual(['edited.ts'])
    const edited = summary.files.find((f) => f.path === 'edited.ts')!
    expect(summary.totals).toEqual({ added: edited.added, removed: edited.removed })
    expect(summary.totals.added).toBeGreaterThan(0)
  })

  // AT-73 — 기준선 이후 커밋이 0 이면 그릴 것이 없다(D-112). 이 저장소에는 미커밋 변경과
  // 미추적 파일이 **있는데도** 목록·커밋이 함께 비어야 한다.
  it('기준선 이후 커밋이 없으면 목록도 커밋도 비어 있다 (D-112)', async () => {
    const clean = await makeRepo()
    await writeFile(join(clean, 'a.ts'), 'base\n')

    await commitSnapshot(clean, 'base')
    const oid = await head(clean)
    await writeFile(join(clean, 'a.ts'), 'working copy\n')
    await writeFile(join(clean, 'untracked.ts'), 'new\n')

    const summary = await gitDiffSummary({ cwd: clean, baseOid: oid })

    expect(summary.files).toEqual([])
    expect(summary.commits).toEqual([])
    expect(summary.totals).toEqual({ added: 0, removed: 0 })
  })

  // AT-18 증상 반증 — 사용자가 본 `+0−0` 이 여기서 재현되면 안 된다.
  it('base 위에 커밋하고 트리가 깨끗해도 합계가 0 이 아니다 (AT-18)', async () => {
    const committed = await makeRepo({
      commits: [
        { message: 'base', files: { 'a.ts': 'one\n' } },
        { message: 'work', files: { 'a.ts': 'one\ntwo\nthree\n' } }
      ]
    })
    const base = fixtures.get(committed)!.oids[0]

    // HEAD 대비(비격리)는 0 이다 — 그것이 사용자가 본 `+0−0` 의 정체다.
    const headScope = await gitDiffSummary({ cwd: committed, baseOid: null })
    expect(headScope.totals).toEqual({ added: 0, removed: 0 })
    // base 대비(격리)는 그 커밋을 센다.
    const baseScope = await gitDiffSummary({ cwd: committed, baseOid: base })
    expect(baseScope.totals.added).toBeGreaterThan(0)
    expect(baseScope.files.map((f) => f.path)).toEqual(['a.ts'])
  })

  it('저장소가 아니면 빈 요약이다 — 타일이 사라지지 않는다', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'orcinus-orca-nonrepo-'))
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
    repo = await makeRepo({
      commits: [
        { message: 'base', files: { 'edited.ts': 'before\n', 'gone.ts': 'x\ny\n' } },
        { message: 'edit', files: { 'edited.ts': 'after\n' } }
      ]
    })
    baseOid = fixtures.get(repo)!.oids[0]
  })

  it('한 호출이 수정·추가·삭제·binary 를 함께 싣는다 — 파일 수와 무관하다 (AT-47)', async () => {
    await writeFile(join(repo, 'staged.ts'), 'brand new\n')
    await rm(join(repo, 'gone.ts'))
    await writeFile(join(repo, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02, 0x00]))

    await commitSnapshot(repo, 'four kinds')

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
    const body = Array.from({ length: 40 }, (_, i) => `line${i + 1}`).join('\n')
    const wide = await makeRepo({
      commits: [
        { message: 'base', files: { 'wide.ts': `${body}\n` } },
        { message: 'wide', files: { 'wide.ts': `${body.replace('line20', 'CHANGED')}\n` } }
      ]
    })
    const oid = fixtures.get(wide)!.oids[0]

    const patch = await gitDiffPatch({ cwd: wide, baseOid: oid })
    const file = fileOf(patch.files, 'wide.ts')

    // 변경 1쌍 + 문맥 39줄 = 41. `-U3` 이었다면 9줄이다.
    expect(file?.lines).toHaveLength(41)
    expect(file?.lines[0]).toMatchObject({ type: 'unchanged', text: 'line1' })
  })

  it('한글·공백 경로가 이스케이프되지 않는다 — core.quotePath=false (EP-29 ②)', async () => {
    const repoKo = await makeRepo({
      commits: [
        { message: 'base', files: { '한글 파일.txt': 'a\n' } },
        { message: 'ko', files: { '한글 파일.txt': 'a\nb\n' } }
      ]
    })
    const oid = fixtures.get(repoKo)!.oids[0]

    const patch = await gitDiffPatch({ cwd: repoKo, baseOid: oid })

    expect(patch.files.map((file) => file.path)).toEqual(['한글 파일.txt'])
  })

  it('rename 은 새 경로에 옛 경로를 함께 싣는다', async () => {
    const repoRe = await makeRepo({
      commits: [
        { message: 'base', files: { 'src.txt': 'a\nb\nc\nd\n' } },
        { message: 'rename', files: { 'src.txt': null, 'dst.txt': 'a\nb\nc\nd\n' } }
      ]
    })
    const oid = fixtures.get(repoRe)!.oids[0]

    const patch = await gitDiffPatch({ cwd: repoRe, baseOid: oid })

    expect(fileOf(patch.files, 'dst.txt')).toMatchObject({
      status: 'renamed',
      oldPath: 'src.txt'
    })
  })

  // AT-72 패치 축 — 요약만 좁히고 패치를 안 좁힌 변이가 여기서 red 다(§10 EP-47 ③).
  it('커밋하지 않은 것은 패치에도 없다 — 미추적도 미커밋 추적도 (D-111)', async () => {
    await writeFile(join(repo, 'untracked.ts'), 'private working copy\n')
    await writeFile(join(repo, 'edited.ts'), 'dirty working copy\n')

    const patch = await gitDiffPatch({ cwd: repo, baseOid })

    expect(fileOf(patch.files, 'untracked.ts')).toBeUndefined()
    // 커밋된 그 파일은 남되 **커밋 시점의 줄**이다 — 작업 트리 내용이 새어 들지 않는다.
    expect(shape(fileOf(patch.files, 'edited.ts'))).toEqual(['-before', '+after'])
  })

  it('저장소가 아니면 빈 패치다 — 화면이 사라지지 않는다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orcinus-orca-diff-none-'))
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
        return {
          ok: true,
          stdout:
            'true\n' + process.cwd() + '\n.git\n.git\n' + 'a'.repeat(40) + '\nrefs/heads/main\n',
          stderr: '',
          code: 0,
          aborted: false
        }
      if (fail(args)) return { ok: false, stdout: '', stderr: 'boom', code: null, aborted: false }
      return { ok: true, stdout: '', stderr: '', code: 0, aborted: false }
    }
    return { calls, runner: createGitGateway({ run: runner }).read }
  }

  it('성공 경로는 전문맥 한 호출이고 모든 인자가 잠금을 피한다', async () => {
    const { calls, runner } = collectingRunner(() => false)

    await gitDiffPatch({ cwd: process.cwd(), baseOid: 'b'.repeat(40) }, runner)

    const patchCalls = calls.filter((args) => args.includes('diff'))
    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0]).toContain('--unified=1000000')
    expect(patchCalls[0]).toContain('core.quotePath=false')
    // 누락 0건을 **차집합**으로 센다 — "있다" 를 몇 건 세면 새 호출부를 놓친다(AT-39).
    expect(calls.filter((args) => args[0] !== '--no-optional-locks')).toEqual([])
  })

  it('전문맥 조회가 실패하면 --unified=3 으로 한 번 더 부르고 contextLimited 를 싣는다', async () => {
    const { calls, runner } = collectingRunner((args) => args.includes('--unified=1000000'))

    const patch = await gitDiffPatch({ cwd: process.cwd(), baseOid: 'b'.repeat(40) }, runner)

    const patchCalls = calls.filter((args) => args.includes('diff'))
    expect(patchCalls).toHaveLength(2)
    expect(patchCalls[1]).toContain('--unified=3')
    expect(patchCalls[1]).not.toContain('--unified=1000000')
    expect(patch.contextLimited).toBe(true)
    expect(patch.unavailable).toBe(false)
  })

  it('폴백까지 실패하면 unavailable 이다 — 빈 목록을 "변경 없음" 으로 읽히게 두지 않는다', async () => {
    const { runner } = collectingRunner((args) => args.includes('diff'))

    const patch = await gitDiffPatch({ cwd: process.cwd(), baseOid: 'b'.repeat(40) }, runner)

    expect(patch).toMatchObject({ isRepo: true, files: [], unavailable: true })
  })
})

describe('raw history delimiter safety (VP-31)', () => {
  it('실제 Git의 루트 orcinus-orca-commit 파일을 commit header로 오인하지 않는다', async () => {
    const repo = await makeRepo({
      commits: [
        { message: 'base', files: { 'base.ts': 'base\n' } },
        { message: 'root path', files: { 'orcinus-orca-commit': 'one\ntwo\n' } }
      ]
    })
    const baseOid = fixtures.get(repo)!.oids[0]

    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toHaveLength(1)
    expect(summary.commits[0]).toMatchObject({
      subject: 'root path',
      fileCount: 1,
      totals: { added: 2, removed: 0 }
    })
    expect(summary.commits[0].files).toEqual([
      { path: 'orcinus-orca-commit', status: 'added', added: 2, removed: 0, binary: false }
    ])
  })
})

describe('커밋 grouping과 미커밋 블록 (VP-31 · VP-33)', () => {
  let repo: string
  let baseOid: string
  let sha1: string
  let sha2: string

  beforeAll(async () => {
    repo = await makeRepo({
      commits: [
        { message: 'base', files: { 'a.ts': 'v0\n' } },
        { message: 'first change\n\nfirst body', files: { 'a.ts': 'v1\n' } },
        { message: 'second change', files: { 'b.ts': 'only in second\n' } }
      ]
    })
    ;[baseOid, sha1, sha2] = fixtures.get(repo)!.oids

    // 같은 파일이 커밋 노드와 미커밋 블록에 동시에 등장하는 정상 중복을 만든다.
    await writeFile(join(repo, 'a.ts'), 'v2-worktree\n')
  })

  it('격리 세션의 커밋 목록은 base..HEAD 실제 커밋이다 (VP-12)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toHaveLength(2)
    expect(summary.commits.map((c) => c.subject)).toEqual(['second change', 'first change'])
    expect(summary.commits[0].sha).toBe(sha2)
    expect(summary.commits[0].author).toBe('Orcinus orca test')
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

  it('커밋 노드의 파일과 세션 목록이 같은 커밋 집합에서 온다 (D-111)', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(
      summary.commits.find((commit) => commit.sha === sha1)?.files.map((file) => file.path)
    ).toEqual(['a.ts'])
    // 작업 트리의 `a.ts` 수정은 목록에 기여하지 않는다 — 커밋 둘이 만든 두 파일뿐이다.
    expect(summary.files.map((file) => file.path).sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('패치의 파일 줄은 커밋을 골라도 baseline → HEAD 다 (D-036 · D-111 회귀)', async () => {
    const patch = await gitDiffPatch({ cwd: repo, baseOid })
    const file = patch.files.find((entry) => entry.path === 'a.ts')

    // 작업 트리의 `v2-worktree` 가 아니라 **커밋된** 값이다.
    expect(shape(file)).toEqual(['-v0', '+v1'])
  })
})

describe('범위 해석 SSOT (VP-35)', () => {
  it('커밋이 하나도 없는 저장소는 base 가 none 이다', async () => {
    const repo = await makeRepo()
    const range = await resolveDiffRange({ cwd: repo, baseOid: null })
    expect(range).toEqual({ kind: 'cumulative', base: { kind: 'none' }, headOid: null })
  })

  it('HEAD와 baseline이 같으면 미커밋 변경이 있어도 전부 빈다 (D-111 · D-112)', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'base\n')

    await commitSnapshot(repo, 'base')
    const baseOid = await head(repo)
    await writeFile(join(repo, 'a.ts'), 'working\n')

    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    expect(summary.commits).toEqual([])
    expect(summary.files).toEqual([])
  })
})

// 0211 ΔV3 — `readDiff` 가 두 호출에서 한 호출로 바뀌었다(D-062). **status 는 그 한 호출의
// `--raw` 블록에서만 온다** — 그 플래그가 빠지면 모든 파일이 조용히 `modified` 가 된다.
// 커밋 노드의 status 는 다른 케이스가 이미 잠갔고, 여기서는 **세션 파일 목록**을 센다.
describe('세션 파일 목록의 status (AT-39 산출 동등 · EP-25 ①)', () => {
  let repo: string
  let baseOid: string

  beforeAll(async () => {
    repo = await makeRepo({
      commits: [
        {
          message: 'base',
          files: {
            'keep.ts': 'a\n',
            'gone.ts': 'b\n',
            'old.ts': 'same content stays identical for rename detection\n'
          }
        },
        {
          message: 'four statuses',
          files: {
            'keep.ts': 'a\nb\n',
            'gone.ts': null,
            'old.ts': null,
            'new.ts': 'same content stays identical for rename detection\n',
            'fresh.ts': 'c\n'
          }
        }
      ]
    })
    baseOid = fixtures.get(repo)!.oids[0]
  })

  afterAll(() =>
    // `beforeAll` 이 예산 초과나 git 실패로 중간에 끊기면 `repo` 는 할당되기 전이다. 빈 목록을
    // 넘기는 것이 곧 no-op 이라, 원인(훅 실패) 위에 정리 실패를 한 겹 더 쌓지 않는다.
    removeTempRoots(repo ? [repo] : [])
  )

  it('추가·삭제·수정·이름변경이 각각 다른 status 로 온다', async () => {
    const summary = await gitDiffSummary({ cwd: repo, baseOid })
    const byPath = new Map(summary.files.map((f) => [f.path, f.status]))

    expect(byPath.get('fresh.ts')).toBe('added')
    expect(byPath.get('gone.ts')).toBe('deleted')
    expect(byPath.get('keep.ts')).toBe('modified')
    // rename 은 새 경로에 표시된다 — 네 종류가 **서로 다른** 값이라야 계약이 잠긴다.
    expect(byPath.get('new.ts')).toBe('renamed')
    expect(new Set(byPath.values()).size).toBe(4)
  })
})

// 0211 ΔV4 r2 — **삭제된 `git-diff-service.test.ts` 가 잠그던 계약의 새 자리**(D5·D6).
//
// ΔV4 가 그 파일을 지우면서 9케이스가 함께 사라졌고, r1 검증은 그중 셋을 재측정해 green 을
// 관측했다: 좌표 캐시를 무력화해도 · log 폴백을 통째로 지워도 · 전용 버퍼를 기본값으로 낮춰도
// 전 스위트가 통과했다. 여기가 그 세 축의 새 자리다.
//
// 실제 저장소가 아니라 **인자·옵션 수집 runner** 를 쓴다: 재는 것이 git 출력 해석이 아니라
// "몇 번 어떤 옵션으로 부르는가" 라 실기로는 관측 지점이 없다.
describe('읽기 조회의 호출 형태 — 프로세스 수와 버퍼 (VP-48 · VP-31 회귀)', () => {
  interface Call {
    args: string[]
    maxBuffer: number | undefined
  }

  /** 어떤 git 명령인가 = **첫 비-플래그 인자**다. 인덱스로 세면 읽기 플래그가 하나 붙을 때마다 전부 깨진다. */
  const subcommand = (args: readonly string[]): string | undefined =>
    args.find((arg) => !arg.startsWith('-'))

  function collectingRunner(options: { failLogRaw?: boolean; failLogAll?: boolean } = {}): {
    calls: Call[]
    runner: GitDiffRunner
  } {
    const calls: Call[] = []
    const ok = (stdout: string): GitRunResult => ({
      ok: true,
      stdout,
      stderr: '',
      code: 0,
      aborted: false
    })
    const fail = (): GitRunResult => ({
      ok: false,
      stdout: '',
      stderr: 'boom',
      code: 1,
      aborted: false
    })
    const runner: GitDiffRunner = async (_cwd, args, runOptions) => {
      calls.push({ args: [...args], maxBuffer: runOptions?.maxBuffer })
      if (args.includes('--is-inside-work-tree'))
        return ok(
          'true\n' + process.cwd() + '\n.git\n.git\n' + 'a'.repeat(40) + '\nrefs/heads/main\n'
        )
      const cmd = subcommand(args)
      if (cmd === 'rev-parse') return ok('h'.repeat(40) + '\n')
      if (cmd === 'log') {
        if (options.failLogAll) return fail()
        if (options.failLogRaw && args.includes('--raw')) return fail()
        return ok('')
      }
      return ok('')
    }
    return { calls, runner: createGitGateway({ run: runner }).read }
  }

  const base = 'b'.repeat(40)

  it('저장소 좌표와 HEAD는 요청마다 한 probe로 다시 읽는다 (0241 R1)', async () => {
    const { calls, runner } = collectingRunner()

    await gitDiffPatch({ cwd: process.cwd(), baseOid: base }, runner)
    await gitDiffPatch({ cwd: process.cwd(), baseOid: base }, runner)

    const coordCalls = calls.filter((call) => call.args.includes('--is-inside-work-tree'))
    // 좌표·HEAD 결과를 저장하지 않으므로 두 요청은 각각 probe를 실행한다.
    expect(coordCalls).toHaveLength(2)
    // 저장소 좌표는 각 요청의 한 probe에 함께 들어 있다.
    expect(coordCalls[0].args).toEqual(
      expect.arrayContaining(['--is-inside-work-tree', '--show-toplevel'])
    )
  })

  it('log 가 실패하면 --raw·--numstat 만 뺀 재조회를 한 번 하고 unavailable 을 남긴다 (EP-17 ⑤)', async () => {
    const { calls, runner } = collectingRunner({ failLogRaw: true })

    const summary = await gitDiffSummary({ cwd: process.cwd(), baseOid: base }, runner)

    const logCalls = calls.filter((call) => subcommand(call.args) === 'log')
    expect(logCalls).toHaveLength(2)
    expect(logCalls[0].args).toEqual(expect.arrayContaining(['--raw', '--numstat']))
    // **인자 차집합**으로 본다 — 폴백이 형식까지 바꾸면 커밋 메시지가 통째로 달라진다.
    expect(logCalls[1].args).not.toContain('--raw')
    expect(logCalls[1].args).not.toContain('--numstat')
    expect(logCalls[1].args.filter((arg) => arg !== '--raw' && arg !== '--numstat')).toEqual(
      logCalls[0].args.filter((arg) => arg !== '--raw' && arg !== '--numstat')
    )
    // 폴백은 **성공했지만 파일 목록이 없다** — 그 사실을 값으로 남긴다(D-053).
    expect(summary.commitFilesUnavailable).toBe(true)
  })

  it('폴백까지 실패하면 커밋은 빈 목록이고 unavailable 을 유지한다 (EP-17 ⑤)', async () => {
    const { calls, runner } = collectingRunner({ failLogAll: true })

    const summary = await gitDiffSummary({ cwd: process.cwd(), baseOid: base }, runner)

    expect(calls.filter((call) => subcommand(call.args) === 'log')).toHaveLength(2)
    expect(summary.commits).toEqual([])
    // 빈 목록만 주면 사용자는 "커밋이 없다" 로 읽는다 — 두 상태가 값으로 갈린다.
    expect(summary.commitFilesUnavailable).toBe(true)
  })

  it('전용 버퍼가 조회마다 다르다 — 절단은 파서 단계라 이것을 대신하지 못한다 (EP-17 ④ · EP-29 ②)', async () => {
    const summaryRun = collectingRunner()
    await gitDiffSummary({ cwd: process.cwd(), baseOid: base }, summaryRun.runner)
    const patchRun = collectingRunner()
    await gitDiffPatch({ cwd: process.cwd(), baseOid: base }, patchRun.runner)

    const logCall = summaryRun.calls.find((call) => subcommand(call.args) === 'log')
    const patchCall = patchRun.calls.find((call) => call.args.includes('--unified=1000000'))
    const plainCall = summaryRun.calls.find((call) => subcommand(call.args) === 'diff')

    expect(logCall?.maxBuffer).toBe(8 * 1024 * 1024)
    expect(patchCall?.maxBuffer).toBe(16 * 1024 * 1024)
    // 기본 조회는 기본 버퍼다 — 셋이 같은 값이면 "전용" 이 아무 뜻도 없다.
    expect(plainCall?.maxBuffer).toBe(4 * 1024 * 1024)
  })
})

// 0211 ΔV4 r3 — **기준선은 고정점이다.** `baseline_oid` 가 없는 세션에서 질의 시점 HEAD 를
// 읽으면 기준이 커밋을 따라 움직여, 사용자가 커밋할수록 diff 가 비어 간다.
//
// 실사용에서 관측된 그대로를 재현한다: 세션이 서고 → 터미널에서 수동 커밋 → 양쪽 다 빈 화면.
describe('기록된 기준선이 없는 세션 (D-098)', () => {
  it('빈 저장소에서 시작했으면 이후 커밋이 전부 범위 안이다', async () => {
    const repo = await makeRepo()
    // 세션이 선 시점 — 커밋 0개(`git init` 직후). `resolveHead` 가 null 을 내던 그 상태다.
    const bornAt = Date.parse('2020-06-01T00:00:00Z')
    await writeFile(join(repo, 'a.ts'), 'one\ntwo\n')

    await commitAt(repo, '세션 시작 뒤 터미널에서 넣은 커밋', '2021-01-01T00:00:00Z')

    const summary = await gitDiffSummary({ cwd: repo, bornAt })

    // 커밋이 보인다 — 예전에는 `commits` 가 항상 빈 배열이었다.
    expect(summary.commits.map((c) => c.subject)).toEqual(['세션 시작 뒤 터미널에서 넣은 커밋'])
    // 그 커밋의 내용도 범위 안에 남는다 — 커밋했다고 변경이 사라지지 않는다.
    expect(summary.files.map((f) => f.path)).toContain('a.ts')
    expect(summary.totals.added).toBe(2)
  })

  it('커밋이 있던 저장소는 출생 시각의 커밋을 기준으로 잡는다 — 그 이전 이력은 범위 밖이다', async () => {
    const repo = await makeRepo({
      commits: [
        {
          message: '세션 이전 커밋',
          date: '2020-01-01T00:00:00Z',
          files: { 'before.ts': 'old\n' }
        },
        { message: '세션 이후 커밋', date: '2021-01-01T00:00:00Z', files: { 'after.ts': 'new\n' } }
      ]
    })
    const beforeOid = fixtures.get(repo)!.oids[0]
    const bornAt = Date.parse('2020-06-01T00:00:00Z')

    const summary = await gitDiffSummary({ cwd: repo, bornAt })

    expect(summary.base).toMatchObject({ kind: 'worktree-base', oid: beforeOid })
    expect(summary.commits.map((c) => c.subject)).toEqual(['세션 이후 커밋'])
    expect(summary.files.map((f) => f.path)).toEqual(['after.ts'])
  })

  it('기록된 기준선이 있으면 출생 시각을 보지 않는다 — 고정점이 우선이다', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'one\n')

    await commitSnapshot(repo, 'base')
    const baseOid = await head(repo)

    const range = await resolveDiffRange({ cwd: repo, baseOid, baseRef: 'main', bornAt: 0 })

    expect(range.base).toEqual({ kind: 'worktree-base', oid: baseOid, ref: 'main' })
  })

  it('출생 시각이 없으면 예전 동작 그대로다 — 회귀 짝', async () => {
    const repo = await makeRepo()
    await writeFile(join(repo, 'a.ts'), 'one\n')

    await commitSnapshot(repo, 'base')

    const range = await resolveDiffRange({ cwd: repo })

    expect(range.base.kind).toBe('head')
  })
})

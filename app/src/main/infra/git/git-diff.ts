// 변경사항(diff) 타일의 읽기 실행부 (0211) — 요약 1종 + 파일 본문 1종.
// 요약과 본문은 모두 세션 baseline → 현재 추적 상태만 본다. baseline 이 없는 예전
// 세션만 질의 시점 HEAD 로 접는다.

import { stat } from 'node:fs/promises'
import { GitCommitOidSchema } from '../../../shared/protocol'
import type {
  GitDiffBase,
  GitDiffFileEntry,
  GitDiffPatch,
  GitDiffPatchFile,
  GitDiffSummary,
  GitDiffTotals
} from '../../../shared/ipc'
import { runGit, type GitRunOptions, type GitRunResult } from './runner'
import {
  MAX_DIFF_COMMITS,
  MAX_DIFF_FILES,
  mergeDiffEntries,
  parseCommitFiles,
  parseCommitLog,
  parseUnifiedPatch
} from './git-diff-parse'

const TIMEOUT_MS = 15_000
const MAX_BUFFER = 4 * 1024 * 1024
const HISTORY_MAX_BUFFER = 8 * 1024 * 1024
// 패치는 **전문맥**이라(0211 ΔV4 D-076) 변경 파일의 내용을 통째로 싣는다. 파서보다 앞서는
// `maxBuffer` 판정을 넉넉히 두고, 그래도 넘치면 `--unified=3` 로 한 번 더 부른다(D-077).
const PATCH_MAX_BUFFER = 16 * 1024 * 1024
// 전문맥을 요구하는 값. 실측(git 2.43) — 파일 전체가 한 hunk 로 나온다.
const PATCH_CONTEXT = 1_000_000
const COMMIT_FORMAT = '--format=%x00orca-commit%x00%H%x00%s%x00%an%x00%ct%x00%b%x00'

export type GitDiffRunner = (
  cwd: string,
  args: string[],
  options?: GitRunOptions
) => Promise<GitRunResult>

// 읽기 조회는 **저장소를 잠그지 않는다**(0211 D-064). `--no-optional-locks` 를 여기서 한 번
// 붙이는 이유: 호출부마다 붙이면 새 호출부가 조용히 빠진다. 이 함수가 유일한 관문이고
// AT-39 가 "누락 0건" 을 차집합으로 센다.
export const READ_ONLY_GIT_FLAG = '--no-optional-locks'

function run(
  runner: GitDiffRunner,
  cwd: string,
  args: string[],
  maxBuffer = MAX_BUFFER
): Promise<GitRunResult> {
  return runner(cwd, [READ_ONLY_GIT_FLAG, ...args], {
    readOnly: true,
    timeoutMs: TIMEOUT_MS,
    maxBuffer
  })
}

const ZERO_TOTALS: GitDiffTotals = { added: 0, removed: 0 }
const EMPTY_GROUP: GitDiffSummary['uncommitted'] = {
  files: [],
  totals: ZERO_TOTALS,
  filesTruncated: false
}

export const EMPTY_DIFF_PATCH: GitDiffPatch = {
  isRepo: false,
  base: { kind: 'none' },
  files: [],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

export const EMPTY_DIFF_SUMMARY: GitDiffSummary = {
  isRepo: false,
  base: { kind: 'none' },
  files: [],
  totals: ZERO_TOTALS,
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: EMPTY_GROUP
}

export interface GitDiffRange {
  kind: 'working'
  base: GitDiffBase
}

// 빈 저장소의 기준점. `git diff <이 sha>` 는 추적 파일 전체를 추가로 내고
// `git log <이 sha>..HEAD` 는 루트부터의 커밋을 전부 낸다(실측) — 세션이 커밋 0개인 저장소에서
// 시작했다면 그 이후 **전부**가 이 세션의 작업이므로 그것이 맞는 기준이다.
export const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export async function resolveDiffRange(
  input: { cwd: string; baseOid?: string | null; baseRef?: string | null; bornAt?: number | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffRange> {
  // `ref` 는 화면의 유일한 비교 기준 라벨이다(0211 ΔV4 D-069). 여기서 다시 조회하지 않고
  // 세션행이 준 값을 그대로 싣는다 — 지금 체크아웃된 브랜치를 읽으면 세션 시작 시점이 아니다.
  if (input.baseOid)
    return {
      kind: 'working',
      base: { kind: 'worktree-base', oid: input.baseOid, ref: input.baseRef ?? null }
    }

  // 기록된 기준선이 없으면 **출생 시각으로 되짚는다**(0211 ΔV4 r3).
  //
  // 여기서 질의 시점 HEAD 를 읽으면 기준선이 고정점이 아니라 **움직이는 값**이 된다 — 사용자가
  // 커밋할 때마다 기준이 그 커밋으로 따라 올라가 diff 가 비고, 커밋 목록도 `worktree-base` 가
  // 아니라 영영 빈다. 세션 시작 이후의 커밋은 보여야 한다는 것이 이 패널의 요구다.
  if (input.bornAt != null) {
    const born = await run(runner, input.cwd, [
      'rev-list',
      '-1',
      `--before=${new Date(input.bornAt).toISOString()}`,
      'HEAD'
    ])
    const bornOid = born.stdout.trim()
    if (born.ok && bornOid.length > 0)
      return {
        kind: 'working',
        base: { kind: 'worktree-base', oid: bornOid, ref: input.baseRef ?? null }
      }
    // 그 시각 이전 커밋이 없다 = 세션이 **빈 저장소**에서 시작했다. 저장소의 시작이 기준이다.
    const anyCommit = await run(runner, input.cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
    if (anyCommit.ok && anyCommit.stdout.trim().length > 0)
      return {
        kind: 'working',
        base: { kind: 'worktree-base', oid: EMPTY_TREE_OID, ref: input.baseRef ?? null }
      }
    return { kind: 'working', base: { kind: 'none' } }
  }

  const head = await run(runner, input.cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  const oid = head.stdout.trim()
  return {
    kind: 'working',
    base: head.ok && oid.length > 0 ? { kind: 'head', oid } : { kind: 'none' }
  }
}

// 비교 범위 — **커밋된 것만**이다 (0211 ΔV6 D-111, §10 EP-47 ①).
//
// 두 항(`<base> HEAD`)이라 작업 트리를 보지 않는다. 한 항으로 두면 `git diff <base>` 가
// base → **작업 트리**를 내고, 그러면 커밋하지 않은 변경이 목록에 섞인다 — 사용자가
// “미커밋 변경분을 항상 목록에서 제외” 를 골랐다.
//
// 커밋이 하나도 없는 저장소(`none`)는 HEAD 가 없어 어떤 범위도 만들 수 없다. 빈 배열을
// 돌려주면 `git diff` 가 다시 작업 트리를 보므로 **`null`** 로 “범위 없음” 을 말한다 —
// 호출부가 조회 자체를 건너뛴다.
function diffRevArgs(base: GitDiffBase): string[] | null {
  if (base.kind === 'commit-parent') return [base.oid, base.commitOid]
  if (base.kind === 'worktree-base') return [base.oid, 'HEAD']
  if (base.kind === 'head') return [base.oid, 'HEAD']
  return null
}

async function resolveCommitPatchRange(
  cwd: string,
  sha: string,
  runner: GitDiffRunner
): Promise<GitDiffRange | null> {
  if (!GitCommitOidSchema.safeParse(sha).success) return null
  // raw 객체 헤더를 읽어 shallow 경계도 root로 오인하지 않는다. merge는 첫 parent다.
  const commit = await run(runner, cwd, ['cat-file', 'commit', sha])
  if (!commit.ok) return null
  const headers = commit.stdout.split(/\r?\n\r?\n/, 1)[0].split(/\r?\n/)
  const parent = headers.find((line) => line.startsWith('parent '))?.slice(7)
  if (parent && !GitCommitOidSchema.safeParse(parent).success) return null
  return {
    kind: 'working',
    base: { kind: 'commit-parent', oid: parent ?? EMPTY_TREE_OID, commitOid: sha }
  }
}

interface RepoCoords {
  inside: boolean
  root: string | null
}

// 저장소 좌표는 **좌표만** 담는다 — 파일 내용을 담지 않으므로 worktree 가 사라져도 낡은 본문을
// 주지 않는다(0211 D-063). 소실 감지는 0210 D-107 이 이미 갖는다.
//
// runner 별로 나눠 담는 이유는 격리다: fake runner 를 쓰는 테스트가 서로의 캐시를 보지 않고,
// 프로덕션은 `runGit` 하나라 프로세스 수명 동안 한 칸을 공유한다.
const repoCoordsCache = new WeakMap<GitDiffRunner, Map<string, RepoCoords>>()

async function repoCoords(cwd: string, runner: GitDiffRunner): Promise<RepoCoords> {
  const byCwd = repoCoordsCache.get(runner) ?? new Map<string, RepoCoords>()
  const cached = byCwd.get(cwd)
  if (cached) return cached

  if (runner === runGit) {
    const dir = await stat(cwd).catch(() => null)
    if (!dir?.isDirectory()) return { inside: false, root: null }
  }
  // 두 값이 한 호출로 나온다(실측) — 순서는 inside, toplevel 이다.
  const result = await run(runner, cwd, ['rev-parse', '--is-inside-work-tree', '--show-toplevel'])
  const [insideLine, rootLine] = result.stdout.split('\n')
  const coords: RepoCoords = {
    inside: result.ok && insideLine?.trim() === 'true',
    root: result.ok && rootLine?.trim() ? rootLine.trim() : null
  }
  // 저장소가 아닌 경로는 캐시하지 않는다 — 나중에 clone/init 될 수 있다.
  if (coords.inside) {
    byCwd.set(cwd, coords)
    repoCoordsCache.set(runner, byCwd)
  }
  return coords
}

// `--raw --numstat -z` **한 호출**이 status 와 줄 수를 함께 낸다(0211 D-062, 실측) — 예전의
// `--numstat` + `--name-status` 두 호출을 대신한다. 파서는 신설하지 않는다: 커밋 경로가 이미
// 같은 형식을 `parseCommitFiles` 로 읽고 있어, 새로 만들면 rename·binary 처리가 두 벌이 된다.
async function readDiff(
  cwd: string,
  revArgs: readonly string[],
  runner: GitDiffRunner
): Promise<{ files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals }> {
  const result = await run(runner, cwd, ['diff', '--raw', '--numstat', '-z', ...revArgs])
  const tracked = result.ok ? parseCommitFiles(result.stdout.split('\0')) : []
  return mergeDiffEntries(tracked)
}

// 범위가 없는 저장소(커밋 0개)의 빈 결과. `git diff` 를 인자 없이 부르면 작업 트리를 보므로
// **조회 자체를 하지 않는다**(0211 ΔV6 D-111 · D-112).
const EMPTY_DIFF_GROUP: { files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals } = {
  files: [],
  truncated: false,
  totals: ZERO_TOTALS
}

async function headOid(cwd: string, runner: GitDiffRunner): Promise<string | null> {
  const head = await run(runner, cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  const oid = head.stdout.trim()
  return head.ok && oid.length > 0 ? oid : null
}

async function readCommitHistory(
  cwd: string,
  baseOid: string,
  runner: GitDiffRunner
): Promise<{
  commits: GitDiffSummary['commits']
  truncated: boolean
  filesUnavailable: boolean
}> {
  const common = [
    'log',
    `--max-count=${MAX_DIFF_COMMITS + 1}`,
    COMMIT_FORMAT,
    '-z',
    `${baseOid}..HEAD`
  ]
  const normalArgs = [...common.slice(0, 3), '--raw', '--numstat', ...common.slice(3)]
  const normal = await run(runner, cwd, normalArgs, HISTORY_MAX_BUFFER)
  if (normal.ok) {
    const parsed = parseCommitLog(normal.stdout, true)
    return { commits: parsed.commits, truncated: parsed.truncated, filesUnavailable: false }
  }

  const fallback = await run(runner, cwd, common, HISTORY_MAX_BUFFER)
  if (!fallback.ok) return { commits: [], truncated: false, filesUnavailable: true }
  const parsed = parseCommitLog(fallback.stdout)
  return { commits: parsed.commits, truncated: parsed.truncated, filesUnavailable: true }
}

export async function gitDiffSummary(
  input: { cwd: string; baseOid?: string | null; baseRef?: string | null; bornAt?: number | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffSummary> {
  if (!(await repoCoords(input.cwd, runner)).inside) return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input, runner)
  const base = range.base
  // 커밋된 것만 본다 (0211 ΔV6 D-111, §10 EP-47 ②) — 범위가 `<base> HEAD` 라 작업 트리가
  // 들어오지 않고, 미추적 조회도 없다. 범위가 아예 없으면(커밋 0개) 조회를 건너뛴다.
  const revArgs = diffRevArgs(base)
  const overall = revArgs ? await readDiff(input.cwd, revArgs, runner) : EMPTY_DIFF_GROUP
  const currentHead = base.kind === 'head' ? base.oid : await headOid(input.cwd, runner)

  let commits: GitDiffSummary['commits'] = []
  let commitsTruncated = false
  let commitFilesUnavailable = false
  if (base.kind === 'worktree-base' && currentHead != null && base.oid !== currentHead) {
    const history = await readCommitHistory(input.cwd, base.oid, runner)
    commits = history.commits
    commitsTruncated = history.truncated
    commitFilesUnavailable = history.filesUnavailable
  }

  return {
    isRepo: true,
    base,
    files: overall.files,
    totals: overall.totals,
    filesTruncated: overall.truncated,
    commits,
    commitsTruncated,
    commitFilesUnavailable,
    // **항상 빈 값이다** (0211 ΔV6 D-111). 이 조회는 커밋된 것만 수집하므로 미커밋 집합을
    // 만들 재료가 없다 — 채우려면 D-111 이 없앤 작업 트리 조회를 되살려야 하고, 그 값을
    // 읽는 renderer 소비처는 ΔV5 D-107 이후 0건이다. 계약 필드 제거는 이번 범위 밖이라
    // 형태만 남긴다(§18 ΔV6 파생 이슈 I-06).
    uncommitted: EMPTY_GROUP
  }
}

// 비교 범위 **전체**의 파일별 diff 줄을 한 번에 얻는다 (0211 ΔV4 D-074·D-075).
//
// 세 가지가 이 한 호출에 걸려 있다.
// ① **전문맥**(`--unified=1000000`) — 문맥 확장이 재조회 0 인 순수 파생으로 남는다(D-076).
// ② **`core.quotePath=false`** — 한글·공백 경로가 `"\355\225\234…"` 로 오지 않는다. 그 문자열이
//    그대로 화면과 요구사항 anchor 의 `filePath` 가 되므로 인용된 채로 두면 둘 다 깨진다.
// ③ **실패 시 축소 재조회** — `maxBuffer` 판정은 파서보다 앞이라 파일 상한이 그것을 막지 못한다.
//    폴백까지 실패하면 `unavailable:true` 로 알린다 — 빈 배열만 주면 "변경 없음" 으로 읽힌다.
async function runPatch(
  cwd: string,
  context: number,
  revArgs: readonly string[],
  runner: GitDiffRunner
): Promise<GitRunResult> {
  return run(
    runner,
    cwd,
    ['-c', 'core.quotePath=false', 'diff', `--unified=${context}`, '-M', '--no-color', ...revArgs],
    PATCH_MAX_BUFFER
  )
}

export async function gitDiffPatch(
  input: {
    cwd: string
    baseOid?: string | null
    baseRef?: string | null
    bornAt?: number | null
    commitSha?: string
  },
  runner: GitDiffRunner = runGit
): Promise<GitDiffPatch> {
  if (!(await repoCoords(input.cwd, runner)).inside) return EMPTY_DIFF_PATCH
  const range = input.commitSha
    ? await resolveCommitPatchRange(input.cwd, input.commitSha, runner)
    : await resolveDiffRange(input, runner)
  if (!range) return { ...EMPTY_DIFF_PATCH, isRepo: true, unavailable: true }
  const revArgs = diffRevArgs(range.base)
  // 커밋된 것만 본다 (0211 ΔV6 D-111, §10 EP-47 ③) — 미추적 병합이 사라졌다. 범위가 없으면
  // (커밋 0개) 조회하지 않고 빈 패치를 돌려준다: 인자 없는 `git diff` 는 작업 트리를 본다.
  if (!revArgs)
    return {
      isRepo: true,
      base: range.base,
      files: [],
      filesTruncated: false,
      contextLimited: false,
      unavailable: false
    }

  // 상한은 파싱 뒤에 다시 잰다 — 파서가 준 순서(git 순서)를 재정렬하지 않는다.
  const capped = (
    files: readonly GitDiffPatchFile[],
    filesTruncated: boolean
  ): { files: GitDiffPatchFile[]; filesTruncated: boolean } => ({
    files: files.slice(0, MAX_DIFF_FILES),
    filesTruncated: filesTruncated || files.length > MAX_DIFF_FILES
  })

  const full = await runPatch(input.cwd, PATCH_CONTEXT, revArgs, runner)
  if (full.ok) {
    const parsed = parseUnifiedPatch(full.stdout)
    return {
      isRepo: true,
      base: range.base,
      ...capped(parsed.files, parsed.filesTruncated),
      contextLimited: false,
      unavailable: false
    }
  }

  const limited = await runPatch(input.cwd, 3, revArgs, runner)
  if (!limited.ok)
    return {
      isRepo: true,
      base: range.base,
      files: [],
      filesTruncated: false,
      contextLimited: false,
      unavailable: true
    }
  const parsed = parseUnifiedPatch(limited.stdout)
  return {
    isRepo: true,
    base: range.base,
    ...capped(parsed.files, parsed.filesTruncated),
    contextLimited: true,
    unavailable: false
  }
}

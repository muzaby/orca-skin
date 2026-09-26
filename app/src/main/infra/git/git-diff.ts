// 변경사항(diff) 타일의 읽기 실행부 (0211) — 요약 1종 + 파일 본문 1종.
// 누적 요약·본문은 세션 baseline → probe 시점 커밋만 본다.
// 선택 커밋 본문은 그 커밋의 첫 부모 → 선택 커밋으로 고정한다.

import { GitCommitOidSchema } from '../../../shared/protocol'
import type {
  GitDiffBase,
  GitDiffFileEntry,
  GitDiffPatch,
  GitDiffPatchFile,
  GitDiffSummary,
  GitDiffTotals
} from '../../../shared/ipc'
import { gitGateway, type GitWrite, type GitRunResult } from './gateway'
import { probeRepo, type RepositoryProbe } from './probe'
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

export type GitDiffRunner = GitWrite
export const DIFF_SAFETY_ARGS = ['--no-ext-diff', '--no-textconv'] as const

function run(
  runner: GitDiffRunner,
  cwd: string,
  args: string[],
  maxBuffer = MAX_BUFFER
): Promise<GitRunResult> {
  return runner(cwd, args, { timeoutMs: TIMEOUT_MS, maxBuffer })
}

const ZERO_TOTALS: GitDiffTotals = { added: 0, removed: 0 }

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
  commitFilesUnavailable: false
}

export type GitDiffRange =
  | {
      kind: 'cumulative'
      base: Exclude<GitDiffBase, { kind: 'commit-parent' }>
      headOid: string | null
    }
  | { kind: 'commit'; base: Extract<GitDiffBase, { kind: 'commit-parent' }> }

export const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
export interface DiffInput {
  cwd: string
  baseOid?: string | null
  baseRef?: string | null
  bornAt?: number | null
}

// The probe owns H for the entire request, including date lookup and patch retries.
export async function resolveDiffRange(
  input: DiffInput,
  runner: GitDiffRunner = gitGateway.read,
  repository?: RepositoryProbe
): Promise<GitDiffRange> {
  const probe = repository ?? (await probeRepo(input.cwd, { read: runner }))
  const headOid = probe.kind === 'repo' && probe.head.kind !== 'unborn' ? probe.head.oid : null
  if (input.baseOid)
    return {
      kind: 'cumulative',
      base: { kind: 'worktree-base', oid: input.baseOid, ref: input.baseRef ?? null },
      headOid
    }
  if (input.bornAt != null && headOid) {
    const born = await run(runner, input.cwd, [
      'rev-list',
      '-1',
      `--before=${new Date(input.bornAt).toISOString()}`,
      headOid
    ])
    const oid = born.ok && born.stdout.trim() ? born.stdout.trim() : EMPTY_TREE_OID
    return {
      kind: 'cumulative',
      base: { kind: 'worktree-base', oid, ref: input.baseRef ?? null },
      headOid
    }
  }
  return {
    kind: 'cumulative',
    base: headOid ? { kind: 'head', oid: headOid } : { kind: 'none' },
    headOid
  }
}

export function rangeArgs(
  range: GitDiffRange
): { diff: [string, string]; log: string | null } | null {
  if (range.kind === 'commit') return { diff: [range.base.oid, range.base.commitOid], log: null }
  if (range.base.kind === 'none' || !range.headOid || range.base.oid === range.headOid) return null
  return { diff: [range.base.oid, range.headOid], log: `${range.base.oid}..${range.headOid}` }
}

async function resolveCommitPatchRange(
  cwd: string,
  sha: string,
  runner: GitDiffRunner
): Promise<GitDiffRange | null> {
  if (!GitCommitOidSchema.safeParse(sha).success) return null
  const commit = await run(runner, cwd, ['cat-file', 'commit', sha])
  if (!commit.ok) return null
  const headers = commit.stdout.split(/\r?\n\r?\n/, 1)[0].split(/\r?\n/)
  const parent = headers.find((line) => line.startsWith('parent '))?.slice(7)
  if (parent && !GitCommitOidSchema.safeParse(parent).success) return null
  return {
    kind: 'commit',
    base: { kind: 'commit-parent', oid: parent ?? EMPTY_TREE_OID, commitOid: sha }
  }
}

// `--raw --numstat -z` **한 호출**이 status 와 줄 수를 함께 낸다(0211 D-062, 실측) — 예전의
// `--numstat` + `--name-status` 두 호출을 대신한다. 파서는 신설하지 않는다: 커밋 경로가 이미
// 같은 형식을 `parseCommitFiles` 로 읽고 있어, 새로 만들면 rename·binary 처리가 두 벌이 된다.
async function readDiff(
  cwd: string,
  revArgs: readonly string[],
  runner: GitDiffRunner
): Promise<{ files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals }> {
  const result = await run(runner, cwd, [
    'diff',
    ...DIFF_SAFETY_ARGS,
    '--raw',
    '--numstat',
    '-z',
    ...revArgs
  ])
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

async function readCommitHistory(
  cwd: string,
  logRange: string,
  runner: GitDiffRunner
): Promise<{
  commits: GitDiffSummary['commits']
  truncated: boolean
  filesUnavailable: boolean
}> {
  const common = ['log', `--max-count=${MAX_DIFF_COMMITS + 1}`, COMMIT_FORMAT, '-z', logRange]
  const normalArgs = [...common, ...DIFF_SAFETY_ARGS, '--raw', '--numstat']
  const normal = await run(runner, cwd, normalArgs, HISTORY_MAX_BUFFER)
  if (normal.ok) {
    const parsed = parseCommitLog(normal.stdout, true)
    return { commits: parsed.commits, truncated: parsed.truncated, filesUnavailable: false }
  }

  const fallback = await run(runner, cwd, [...common, ...DIFF_SAFETY_ARGS], HISTORY_MAX_BUFFER)
  if (!fallback.ok) return { commits: [], truncated: false, filesUnavailable: true }
  const parsed = parseCommitLog(fallback.stdout)
  return { commits: parsed.commits, truncated: parsed.truncated, filesUnavailable: true }
}

export async function gitDiffSummary(
  input: DiffInput,
  runner: GitDiffRunner = gitGateway.read,
  repository?: RepositoryProbe
): Promise<GitDiffSummary> {
  const probe = repository ?? (await probeRepo(input.cwd, { read: runner }))
  if (probe.kind !== 'repo') return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input, runner, probe)
  const args = rangeArgs(range)
  const [overall, history] = await Promise.all([
    args ? readDiff(input.cwd, args.diff, runner) : Promise.resolve(EMPTY_DIFF_GROUP),
    args?.log && range.base.kind === 'worktree-base'
      ? readCommitHistory(input.cwd, args.log, runner)
      : Promise.resolve({ commits: [], truncated: false, filesUnavailable: false })
  ])
  return {
    isRepo: true,
    base: range.base,
    files: overall.files,
    totals: overall.totals,
    filesTruncated: overall.truncated,
    commits: history.commits,
    commitsTruncated: history.truncated,
    commitFilesUnavailable: history.filesUnavailable
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
    [
      '-c',
      'core.quotePath=false',
      'diff',
      ...DIFF_SAFETY_ARGS,
      `--unified=${context}`,
      '-M',
      '--no-color',
      ...revArgs
    ],
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
  runner: GitDiffRunner = gitGateway.read
): Promise<GitDiffPatch> {
  const probe = await probeRepo(input.cwd, { read: runner })
  if (probe.kind !== 'repo') return EMPTY_DIFF_PATCH
  const range = input.commitSha
    ? await resolveCommitPatchRange(input.cwd, input.commitSha, runner)
    : await resolveDiffRange(input, runner, probe)
  if (!range) return { ...EMPTY_DIFF_PATCH, isRepo: true, unavailable: true }
  const revArgs = rangeArgs(range)?.diff
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

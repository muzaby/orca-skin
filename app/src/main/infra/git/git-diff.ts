// 변경사항(diff) 타일의 읽기 실행부 (0211) — 요약 1종 + 파일 본문 1종.
// 요약과 본문은 모두 세션 baseline → 현재 추적 상태만 본다. baseline 이 없는 예전
// 세션만 질의 시점 HEAD 로 접는다.

import { stat } from 'node:fs/promises'
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
  parseUnifiedPatch,
  parseUntrackedPaths
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

export async function resolveDiffRange(
  input: { cwd: string; baseOid?: string | null; baseRef?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffRange> {
  // `ref` 는 화면의 유일한 비교 기준 라벨이다(0211 ΔV4 D-069). 여기서 다시 조회하지 않고
  // 세션행이 준 값을 그대로 싣는다 — 지금 체크아웃된 브랜치를 읽으면 세션 시작 시점이 아니다.
  if (input.baseOid)
    return {
      kind: 'working',
      base: { kind: 'worktree-base', oid: input.baseOid, ref: input.baseRef ?? null }
    }
  const head = await run(runner, input.cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  const oid = head.stdout.trim()
  return {
    kind: 'working',
    base: head.ok && oid.length > 0 ? { kind: 'head', oid } : { kind: 'none' }
  }
}

function diffRevArgs(base: GitDiffBase): string[] {
  if (base.kind === 'worktree-base') return [base.oid]
  if (base.kind === 'head') return [base.oid]
  return []
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
  runner: GitDiffRunner,
  untracked: readonly GitDiffFileEntry[] = []
): Promise<{ files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals }> {
  const result = await run(runner, cwd, ['diff', '--raw', '--numstat', '-z', ...revArgs])
  const tracked = result.ok ? parseCommitFiles(result.stdout.split('\0')) : []
  return mergeDiffEntries(tracked, untracked)
}

// 미추적 파일 조회 — **`git diff` 는 추적 파일만 본다**(실측). 이 한 호출이 없으면 사용자나
// 에이전트가 방금 만든 새 파일이 커밋 전까지 목록·트리·패치 어디에도 뜨지 않고, 화면은
// 그것을 "변경 없음" 과 구분하지 못한다(0211 D-026).
//
// 실패는 값으로 접는다 — 미추적을 못 읽었다고 추적 변경까지 못 보여 줄 이유가 없다.
async function readUntracked(cwd: string, runner: GitDiffRunner): Promise<GitDiffFileEntry[]> {
  const result = await run(runner, cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
  return result.ok ? parseUntrackedPaths(result.stdout) : []
}

// 패치 축의 미추적 항목. **본문은 비운다**(D-026) — 줄을 실으면 `+0 −0` 헤더와 본문이
// 어긋나고, 그 순간 헤더가 거짓말이 된다. 목록·트리에 이름이 남는 것이 이 항목의 전부다.
function untrackedPatchFiles(entries: readonly GitDiffFileEntry[]): GitDiffPatchFile[] {
  return entries.map((entry) => ({
    path: entry.path,
    status: 'added' as const,
    added: 0,
    removed: 0,
    kind: 'text' as const,
    lines: []
  }))
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
  input: { cwd: string; baseOid?: string | null; baseRef?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffSummary> {
  if (!(await repoCoords(input.cwd, runner)).inside) return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input, runner)
  const base = range.base
  // 미추적 집합은 범위와 무관하다 — 어떤 base 를 잡아도 "아직 git 이 모르는 파일" 은 같다.
  // 그래서 한 번만 묻고 아래 두 목록(전체·미커밋)에 같은 값을 싣는다.
  const untracked = await readUntracked(input.cwd, runner)
  const overall = await readDiff(input.cwd, diffRevArgs(base), runner, untracked)
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

  const uncommitted =
    currentHead == null || base.kind !== 'worktree-base' || base.oid === currentHead
      ? overall
      : await readDiff(input.cwd, [currentHead], runner, untracked)

  return {
    isRepo: true,
    base,
    files: overall.files,
    totals: overall.totals,
    filesTruncated: overall.truncated,
    commits,
    commitsTruncated,
    commitFilesUnavailable,
    uncommitted: {
      files: uncommitted.files,
      totals: uncommitted.totals,
      filesTruncated: uncommitted.truncated
    }
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
  input: { cwd: string; baseOid?: string | null; baseRef?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffPatch> {
  if (!(await repoCoords(input.cwd, runner)).inside) return EMPTY_DIFF_PATCH
  const range = await resolveDiffRange(input, runner)
  const revArgs = diffRevArgs(range.base)
  const untracked = untrackedPatchFiles(await readUntracked(input.cwd, runner))

  // 미추적 항목은 **꼬리에 붙인다** — 경로로 다시 정렬하면 추적 파일의 기존 순서(git 이 준
  // 순서)가 바뀌어 본문 배치가 조용히 달라진다. 상한은 붙인 뒤에 다시 잰다.
  const withUntracked = (
    files: readonly GitDiffPatchFile[],
    filesTruncated: boolean
  ): { files: GitDiffPatchFile[]; filesTruncated: boolean } => {
    const merged = [...files, ...untracked]
    return {
      files: merged.slice(0, MAX_DIFF_FILES),
      filesTruncated: filesTruncated || merged.length > MAX_DIFF_FILES
    }
  }

  const full = await runPatch(input.cwd, PATCH_CONTEXT, revArgs, runner)
  if (full.ok) {
    const parsed = parseUnifiedPatch(full.stdout)
    return {
      isRepo: true,
      base: range.base,
      ...withUntracked(parsed.files, parsed.filesTruncated),
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
    ...withUntracked(parsed.files, parsed.filesTruncated),
    contextLimited: true,
    unavailable: false
  }
}

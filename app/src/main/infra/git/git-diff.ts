// 변경사항(diff) 타일의 읽기 실행부 (0211) — 요약 1종 + 파일 본문 1종.
// 요약과 본문은 모두 세션 baseline → 현재 추적 상태만 본다. baseline 이 없는 예전
// 세션만 질의 시점 HEAD 로 접는다.

import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  GitDiffBase,
  GitDiffFileContent,
  GitDiffFileEntry,
  GitDiffSummary,
  GitDiffTotals
} from '../../../shared/ipc'
import { runGit, type GitRunOptions, type GitRunResult } from './runner'
import {
  MAX_DIFF_COMMITS,
  MAX_DIFF_FILE_BYTES,
  mergeDiffEntries,
  parseCommitFiles,
  parseCommitLog,
  parseNumstatZ
} from './git-diff-parse'

const TIMEOUT_MS = 15_000
const MAX_BUFFER = 4 * 1024 * 1024
const HISTORY_MAX_BUFFER = 8 * 1024 * 1024
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
  input: { cwd: string; baseOid?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffRange> {
  if (input.baseOid) return { kind: 'working', base: { kind: 'worktree-base', oid: input.baseOid } }
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
  runner: GitDiffRunner
): Promise<{ files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals }> {
  const result = await run(runner, cwd, ['diff', '--raw', '--numstat', '-z', ...revArgs])
  const tracked = result.ok ? parseCommitFiles(result.stdout.split('\0')) : []
  return mergeDiffEntries(tracked)
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
  input: { cwd: string; baseOid?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffSummary> {
  if (!(await repoCoords(input.cwd, runner)).inside) return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input, runner)
  const base = range.base
  const overall = await readDiff(input.cwd, diffRevArgs(base), runner)
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
      : await readDiff(input.cwd, [currentHead], runner)

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

async function showAt(
  cwd: string,
  rev: string,
  path: string,
  runner: GitDiffRunner
): Promise<string | null> {
  const result = await run(runner, cwd, ['show', `${rev}:${path}`])
  if (!result.ok) return ''
  if (result.stdout.length > MAX_DIFF_FILE_BYTES) return null
  return result.stdout
}

async function isTrackedDiffPath(
  cwd: string,
  path: string,
  base: GitDiffBase,
  runner: GitDiffRunner
): Promise<boolean> {
  const result = await run(runner, cwd, [
    'diff',
    '--numstat',
    '-z',
    ...diffRevArgs(base),
    '--',
    path
  ])
  return result.ok && parseNumstatZ(result.stdout).some((entry) => entry.path === path)
}

export async function gitDiffFile(
  input: { cwd: string; path: string; baseOid?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffFileContent> {
  const coords = await repoCoords(input.cwd, runner)
  if (!coords.inside) return { kind: 'unavailable', reason: 'error' }
  const range = await resolveDiffRange(input, runner)
  const baseRev = range.base.kind === 'none' ? null : range.base.oid
  // 추적 판정과 base 본문은 서로를 기다릴 이유가 없다 — 직렬 깊이를 줄인다(0211 §14 ΔV3).
  // 추적이 아니면 읽은 본문은 버린다: 미추적 파일 본문이 새는 축은 판정이 막는다(D-035).
  const [tracked, oldValue] = await Promise.all([
    isTrackedDiffPath(input.cwd, input.path, range.base, runner),
    baseRev ? showAt(input.cwd, baseRev, input.path, runner) : Promise.resolve<string | null>('')
  ])
  if (!tracked) return { kind: 'unavailable', reason: 'error' }
  if (oldValue == null) return { kind: 'unavailable', reason: 'too-large' }

  const root = coords.root ?? input.cwd
  const abs = resolve(root, input.path)
  const info = await stat(abs).catch(() => null)
  if (!info) return { kind: 'text', oldValue, newValue: '', truncated: false }
  if (!info.isFile()) return { kind: 'unavailable', reason: 'not-found' }
  if (info.size > MAX_DIFF_FILE_BYTES) return { kind: 'unavailable', reason: 'too-large' }

  const buf = await readFile(abs).catch(() => null)
  if (!buf) return { kind: 'unavailable', reason: 'error' }
  if (buf.includes(0)) return { kind: 'binary' }
  return { kind: 'text', oldValue, newValue: buf.toString('utf8'), truncated: false }
}

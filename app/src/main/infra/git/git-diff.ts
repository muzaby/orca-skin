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
  applyNameStatus,
  mergeDiffEntries,
  parseCommitLog,
  parseNameStatusZ,
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

function run(
  runner: GitDiffRunner,
  cwd: string,
  args: string[],
  maxBuffer = MAX_BUFFER
): Promise<GitRunResult> {
  return runner(cwd, args, { readOnly: true, timeoutMs: TIMEOUT_MS, maxBuffer })
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

async function insideWorkTree(cwd: string, runner: GitDiffRunner): Promise<boolean> {
  if (runner === runGit) {
    const dir = await stat(cwd).catch(() => null)
    if (!dir?.isDirectory()) return false
  }
  const result = await run(runner, cwd, ['rev-parse', '--is-inside-work-tree'])
  return result.ok && result.stdout.trim() === 'true'
}

async function repoRoot(cwd: string, runner: GitDiffRunner): Promise<string | null> {
  const result = await run(runner, cwd, ['rev-parse', '--show-toplevel'])
  const path = result.stdout.trim()
  return result.ok && path.length > 0 ? path : null
}

async function readDiff(
  cwd: string,
  revArgs: readonly string[],
  runner: GitDiffRunner
): Promise<{ files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals }> {
  const [numstat, nameStatus] = await Promise.all([
    run(runner, cwd, ['diff', '--numstat', '-z', ...revArgs]),
    run(runner, cwd, ['diff', '--name-status', '-z', ...revArgs])
  ])
  const tracked = numstat.ok
    ? applyNameStatus(
        parseNumstatZ(numstat.stdout),
        nameStatus.ok ? parseNameStatusZ(nameStatus.stdout) : new Map()
      )
    : []
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
  if (!(await insideWorkTree(input.cwd, runner))) return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input, runner)
  const base = range.base
  const overall = await readDiff(input.cwd, diffRevArgs(base), runner)
  const currentHead = base.kind === 'head' ? base.oid : await headOid(input.cwd, runner)

  let commits: GitDiffSummary['commits'] = []
  let commitsTruncated = false
  let commitFilesUnavailable = false
  if (
    base.kind === 'worktree-base' &&
    currentHead != null &&
    base.oid !== currentHead
  ) {
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

export async function gitDiffFile(
  input: { cwd: string; path: string; baseOid?: string | null },
  runner: GitDiffRunner = runGit
): Promise<GitDiffFileContent> {
  if (!(await insideWorkTree(input.cwd, runner))) return { kind: 'unavailable', reason: 'error' }
  const range = await resolveDiffRange(input, runner)
  const baseRev = range.base.kind === 'none' ? null : range.base.oid
  const oldValue = baseRev ? await showAt(input.cwd, baseRev, input.path, runner) : ''
  if (oldValue == null) return { kind: 'unavailable', reason: 'too-large' }

  const root = (await repoRoot(input.cwd, runner)) ?? input.cwd
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

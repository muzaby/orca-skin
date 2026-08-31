// 변경사항(diff) 타일의 읽기 실행부 (0211) — 요약 1종 + 파일 본문 1종.
//
// **비교 범위를 정하는 곳은 `resolveDiffRange` 하나다**(§10 EP-07). 요약과 본문이 각자 범위를
// 계산하면 목록은 base 대비인데 본문은 HEAD 대비가 되어 같은 화면의 두 값이 어긋난다.
//
// 실패는 예외가 아니라 값이다 — `git-cli.ts` 와 같은 규칙이다. 저장소가 아니거나 git 이 없는
// 것은 정상적인 질문의 답이고, 그 판정이 곧 타일의 입력이다.

import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  GitDiffBase,
  GitDiffFileContent,
  GitDiffFileEntry,
  GitDiffSummary,
  GitDiffTotals
} from '../../../shared/ipc'
import { runGit } from './runner'
import {
  MAX_DIFF_COMMITS,
  MAX_DIFF_FILE_BYTES,
  applyNameStatus,
  mergeDiffEntries,
  parseCommitLog,
  parseNameStatusZ,
  parseNulPaths,
  parseNumstatZ
} from './git-diff-parse'

const TIMEOUT_MS = 15_000
// 본문 한 측 상한(1 MiB)의 4배. `git show` 가 상한 근처 파일을 뱉을 때 버퍼가 먼저 터지면
// 그 실패는 `too-large` 가 아니라 `error` 로 보여 원인을 가린다.
const MAX_BUFFER = 4 * 1024 * 1024

function run(cwd: string, args: string[]): ReturnType<typeof runGit> {
  return runGit(cwd, args, { readOnly: true, timeoutMs: TIMEOUT_MS, maxBuffer: MAX_BUFFER })
}

const ZERO_TOTALS: GitDiffTotals = { added: 0, removed: 0 }

export const EMPTY_DIFF_SUMMARY: GitDiffSummary = {
  isRepo: false,
  base: { kind: 'none' },
  files: [],
  totals: ZERO_TOTALS,
  filesTruncated: false,
  commits: [],
  commitsTruncated: false
}

// 무엇과 무엇을 비교하는가. 두 채널이 **같은 함수**를 쓴다.
//
// - `commit` 지정 → 그 커밋 하나(`<sha>^` → `<sha>`). 작업 트리는 보지 않는다.
// - managed row 의 `base_oid` → 그 커밋 → 현재 작업 트리 (격리 세션).
// - 그 밖 → `HEAD` → 현재 작업 트리 (비격리·랜딩·0210 폴백 후).
export type GitDiffRange = { kind: 'working'; base: GitDiffBase } | { kind: 'commit'; sha: string }

export async function resolveDiffRange(input: {
  cwd: string
  commit?: string
  baseOid?: string | null
}): Promise<GitDiffRange> {
  if (input.commit) return { kind: 'commit', sha: input.commit }
  if (input.baseOid) return { kind: 'working', base: { kind: 'worktree-base', oid: input.baseOid } }
  const head = await run(input.cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  // 커밋이 하나도 없는 저장소 — 비교 대상이 없으므로 전부 추가로 보인다.
  return { kind: 'working', base: head.ok ? { kind: 'head' } : { kind: 'none' } }
}

// 범위를 `git diff` 의 리비전 인자로 바꾼다. `none` 은 인자가 없다(빈 트리 대비 = 전부 추가).
function diffRevArgs(range: GitDiffRange): string[] {
  if (range.kind === 'commit') return [`${range.sha}^`, range.sha]
  if (range.base.kind === 'worktree-base') return [range.base.oid]
  if (range.base.kind === 'head') return ['HEAD']
  return []
}

async function insideWorkTree(cwd: string): Promise<boolean> {
  const dir = await stat(cwd).catch(() => null)
  if (!dir?.isDirectory()) return false
  const result = await run(cwd, ['rev-parse', '--is-inside-work-tree'])
  return result.ok && result.stdout.trim() === 'true'
}

async function repoRoot(cwd: string): Promise<string | null> {
  const result = await run(cwd, ['rev-parse', '--show-toplevel'])
  const path = result.stdout.trim()
  return result.ok && path.length > 0 ? path : null
}

export async function gitDiffSummary(input: {
  cwd: string
  commit?: string
  baseOid?: string | null
}): Promise<GitDiffSummary> {
  if (!(await insideWorkTree(input.cwd))) return EMPTY_DIFF_SUMMARY
  const range = await resolveDiffRange(input)
  const revArgs = diffRevArgs(range)

  // 세 조회는 서로의 결과에 의존하지 않는다 — 전부 read-only 이고 `GIT_OPTIONAL_LOCKS=0`
  // 이라 index.lock 을 잡지 않으므로 함께 낸다(폭 3, 늘리지 않는다).
  const [numstat, nameStatus, others] = await Promise.all([
    run(input.cwd, ['diff', '--numstat', '-z', ...revArgs]),
    run(input.cwd, ['diff', '--name-status', '-z', ...revArgs]),
    // 커밋 하나를 보는 중이면 작업 트리는 범위 밖이라 미추적을 섞지 않는다.
    range.kind === 'working'
      ? run(input.cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
      : null
  ])
  const tracked: GitDiffFileEntry[] = numstat.ok
    ? applyNameStatus(
        parseNumstatZ(numstat.stdout),
        nameStatus.ok ? parseNameStatusZ(nameStatus.stdout) : new Map()
      )
    : []

  // 경로만 싣는다 — 줄 수를 세지 않으므로 파일을 읽지 않는다(D-026).
  const untracked: { path: string }[] =
    others?.ok === true ? parseNulPaths(others.stdout).map((path) => ({ path })) : []

  const merged = mergeDiffEntries(tracked, untracked)

  // 커밋 목록은 base 를 아는 격리 세션에서만 의미가 있다(0211 D-013) — base 를 모르면
  // "이 세션의 커밋" 을 셀 수 없고, 최근 N개를 대신 보여주면 그것은 다른 질문의 답이다.
  let commits: GitDiffSummary['commits'] = []
  let commitsTruncated = false
  if (range.kind === 'working' && range.base.kind === 'worktree-base') {
    const log = await run(input.cwd, [
      'log',
      `--max-count=${MAX_DIFF_COMMITS + 1}`,
      '--format=%H%x1f%s%x1f%an%x1f%ct%x1e',
      `${range.base.oid}..HEAD`
    ])
    if (log.ok) {
      const parsed = parseCommitLog(log.stdout)
      commits = parsed.commits
      commitsTruncated = parsed.truncated
    }
  }

  return {
    isRepo: true,
    base: range.kind === 'commit' ? { kind: 'head' } : range.base,
    files: merged.files,
    totals: merged.totals,
    filesTruncated: merged.truncated,
    commits,
    commitsTruncated
  }
}

// 한 리비전에서의 파일 내용. 없는 파일(추가/삭제의 반대편)은 빈 문자열이다 —
// `git show` 가 그때 실패하는 것이 정상 경로다.
async function showAt(cwd: string, rev: string, path: string): Promise<string | null> {
  const result = await run(cwd, ['show', `${rev}:${path}`])
  if (!result.ok) return ''
  if (result.stdout.length > MAX_DIFF_FILE_BYTES) return null
  return result.stdout
}

export async function gitDiffFile(input: {
  cwd: string
  path: string
  commit?: string
  baseOid?: string | null
}): Promise<GitDiffFileContent> {
  if (!(await insideWorkTree(input.cwd))) return { kind: 'unavailable', reason: 'error' }
  const range = await resolveDiffRange(input)

  if (range.kind === 'commit') {
    const oldValue = await showAt(input.cwd, `${range.sha}^`, input.path)
    const newValue = await showAt(input.cwd, range.sha, input.path)
    if (oldValue == null || newValue == null) return { kind: 'unavailable', reason: 'too-large' }
    return { kind: 'text', oldValue, newValue, truncated: false }
  }

  const baseRev =
    range.base.kind === 'worktree-base'
      ? range.base.oid
      : range.base.kind === 'head'
        ? 'HEAD'
        : null
  // 커밋이 없는 저장소에서는 비교 대상이 없다 — 작업 트리 전체가 추가다.
  const oldValue = baseRev ? await showAt(input.cwd, baseRev, input.path) : ''
  if (oldValue == null) return { kind: 'unavailable', reason: 'too-large' }

  const root = (await repoRoot(input.cwd)) ?? input.cwd
  const abs = resolve(root, input.path)
  const info = await stat(abs).catch(() => null)
  // 삭제된 파일 — 작업 트리에 없는 것이 정상이고 new 는 빈 문자열이다.
  if (!info) return { kind: 'text', oldValue, newValue: '', truncated: false }
  if (!info.isFile()) return { kind: 'unavailable', reason: 'not-found' }
  if (info.size > MAX_DIFF_FILE_BYTES) return { kind: 'unavailable', reason: 'too-large' }

  const buf = await readFile(abs).catch(() => null)
  if (!buf) return { kind: 'unavailable', reason: 'error' }
  if (buf.includes(0)) return { kind: 'binary' }
  return { kind: 'text', oldValue, newValue: buf.toString('utf8'), truncated: false }
}

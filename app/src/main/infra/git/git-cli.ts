// git CLI 실행부 — 컴포저 브랜치 칩이 쓰는 읽기 2종 + 전환 1종.
//
// **PATH 의 `git` 을 execFile 로 부른다** (shell 미경유 — 인자가 셸 파싱을 타지 않는다).
// 저장소가 아니거나 git 이 없으면 예외가 아니라 `isRepo:false` / `reason:'error'` 값으로
// 돌려준다 — 컴포저는 git 없이도 정상 동작해야 하고, 그 판정 자체가 UI 의 입력이다.
//
// 읽기 명령에는 `GIT_OPTIONAL_LOCKS=0` 을 건다. 칩이 주기적으로 상태를 물으므로 index.lock
// 을 잡으면 사용자의 다른 git 작업과 충돌한다. `GIT_TERMINAL_PROMPT=0` 은 자격증명 프롬프트로
// 프로세스가 매달리는 것을 막는다.

import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import type {
  GitBranchList,
  GitCheckoutResult,
  GitDirtyResolution,
  GitDirtyStat,
  GitStatus
} from '../../../shared/ipc'
import { firstErrorLine, parseBranchList, parseShortstat } from './git-parse'

const GIT_ENV = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
const TIMEOUT_MS = 10_000
const MAX_BUFFER = 4 * 1024 * 1024

interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
}

// 비정상 종료를 예외로 올리지 않는다 — git 은 "그런 ref 없음"·"저장소 아님" 같은 **정상적인
// 질문의 답** 도 exit code 로 말한다.
function run(cwd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, env: GIT_ENV, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({ ok: error == null, stdout: String(stdout), stderr: String(stderr) })
      }
    )
  })
}

async function isDirectory(path: string): Promise<boolean> {
  const info = await stat(path).catch(() => null)
  return info?.isDirectory() ?? false
}

async function insideWorkTree(cwd: string): Promise<boolean> {
  if (!(await isDirectory(cwd))) return false
  const result = await run(cwd, ['rev-parse', '--is-inside-work-tree'])
  return result.ok && result.stdout.trim() === 'true'
}

// 현재 브랜치. detached HEAD 면 null. **`symbolic-ref` 를 쓰는 이유**: 커밋이 하나도 없는
// unborn 브랜치에서도 이름을 준다(`rev-parse --abbrev-ref HEAD` 는 거기서 실패한다).
async function currentBranch(cwd: string): Promise<string | null> {
  const result = await run(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'])
  const name = result.stdout.trim()
  return result.ok && name.length > 0 ? name : null
}

// 커밋되지 않은 변경 = **추적 파일의 HEAD 대비 차이**. 미추적 파일은 체크아웃을 막지 않으므로
// 경고에서도 해소(stash/commit/discard)에서도 일관되게 뺀다.
async function dirtyStat(cwd: string): Promise<GitDirtyStat | null> {
  const hasCommit = await run(cwd, ['rev-parse', '--verify', '-q', 'HEAD'])
  if (!hasCommit.ok) return null
  const result = await run(cwd, ['diff', 'HEAD', '--shortstat'])
  return result.ok ? parseShortstat(result.stdout) : null
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  if (!(await insideWorkTree(cwd))) {
    return { isRepo: false, branch: null, detached: false, dirty: null }
  }
  const branch = await currentBranch(cwd)
  return { isRepo: true, branch, detached: branch == null, dirty: await dirtyStat(cwd) }
}

export async function gitBranches(cwd: string): Promise<GitBranchList> {
  if (!(await insideWorkTree(cwd))) return { current: null, branches: [] }
  const current = await currentBranch(cwd)
  const result = await run(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'])
  return { current, branches: result.ok ? parseBranchList(result.stdout, current) : [] }
}

// dirty 트리 해소 3종. 전부 **추적 변경만** 건드린다(미추적 파일은 그대로 남는다).
async function resolveDirty(
  cwd: string,
  resolution: GitDirtyResolution,
  target: string
): Promise<RunResult> {
  if (resolution === 'stash') {
    return run(cwd, ['stash', 'push', '-m', `orca: auto-stash before switching to ${target}`])
  }
  if (resolution === 'commit-wip') return run(cwd, ['commit', '-a', '-m', 'WIP'])
  return run(cwd, ['reset', '--hard', 'HEAD'])
}

export async function gitCheckout(
  cwd: string,
  branch: string,
  resolution?: GitDirtyResolution
): Promise<GitCheckoutResult> {
  if (!(await insideWorkTree(cwd))) {
    return { ok: false, reason: 'not-repo', message: 'git 저장소가 아닙니다.' }
  }
  const dirty = await dirtyStat(cwd)
  if (dirty && resolution === undefined) {
    // 아직 아무것도 하지 않았다 — 무엇을 할지는 사용자가 모달에서 고른다.
    return { ok: false, reason: 'dirty', from: await currentBranch(cwd), stat: dirty }
  }
  if (dirty) {
    const resolved = await resolveDirty(cwd, resolution as GitDirtyResolution, branch)
    if (!resolved.ok) {
      return {
        ok: false,
        reason: 'error',
        message: firstErrorLine(resolved.stderr) || '변경 사항을 처리하지 못했습니다.'
      }
    }
  }
  const checkout = await run(cwd, ['checkout', branch])
  if (!checkout.ok) {
    return {
      ok: false,
      reason: 'error',
      message: firstErrorLine(checkout.stderr) || '브랜치를 전환하지 못했습니다.'
    }
  }
  return { ok: true, branch }
}

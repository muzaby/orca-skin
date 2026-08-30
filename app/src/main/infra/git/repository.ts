import { realpath, stat } from 'node:fs/promises'
import { normalize } from 'node:path'
import { runGit } from './runner'

export async function canonicalPath(path: string): Promise<string> {
  return normalize(await realpath(path))
}

export async function resolveRepoRoot(cwd: string): Promise<string | null> {
  const dir = await stat(cwd).catch(() => null)
  if (!dir?.isDirectory()) return null
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel'], { readOnly: true })
  return result.ok && result.stdout.trim() ? canonicalPath(result.stdout.trim()) : null
}

// Git 자체가 답을 주는가. `resolveRepoRoot` 의 `null` 은 **두 가지**를 뜻한다 — 저장소가 아니거나,
// git 이 없거나 실행되지 못했거나. 0210 이 준비 단계의 `isClean` 게이트를 걷어내면서
// `git-unavailable` 을 내던 유일한 지점이 사라졌으므로, 그 구분을 여기서 되살린다.
// 답을 못 주면 "Git 저장소가 아닙니다" 는 원인을 가리키지 않는 문구다.
export async function gitAvailable(cwd: string): Promise<boolean> {
  return (await runGit(cwd, ['--version'], { readOnly: true })).ok
}

export async function resolveHead(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['rev-parse', '--verify', 'HEAD'], { readOnly: true })
  const oid = result.stdout.trim()
  return result.ok && /^[0-9a-fA-F]{40,64}$/.test(oid) ? oid : null
}

// 로컬 브랜치 하나의 커밋 OID. **`refs/heads/` 를 붙여서** 넘긴다 — 사용자가 고른 값이 그대로
// 첫 인자가 되면 `-` 로 시작하는 이름이 git 옵션으로 읽힌다. 접두사가 그 가능성을 없애고,
// 동시에 조회 범위를 브랜치 칩이 실제로 제시하는 로컬 브랜치로 좁힌다.
export async function resolveBranchOid(cwd: string, branch: string): Promise<string | null> {
  const result = await runGit(cwd, ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`], {
    readOnly: true
  })
  const oid = result.stdout.trim()
  return result.ok && /^[0-9a-fA-F]{40,64}$/.test(oid) ? oid : null
}

export async function isClean(cwd: string): Promise<boolean | null> {
  const result = await runGit(cwd, ['status', '--porcelain', '--untracked-files=all'], {
    readOnly: true
  })
  return result.ok ? result.stdout.trim().length === 0 : null
}

export async function validateBranchName(repoRoot: string, branch: string): Promise<boolean> {
  const result = await runGit(repoRoot, ['check-ref-format', '--branch', branch], {
    readOnly: true
  })
  return result.ok
}

export async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
  const result = await runGit(
    repoRoot,
    ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    {
      readOnly: true
    }
  )
  return result.ok
}

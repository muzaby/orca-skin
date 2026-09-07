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

// `rev-parse --verify` 의 결과를 OID 로 받는 판정. **OID 유효성 규칙은 여기 한 곳이다** —
// 두 벌이면 SHA-256 확장 같은 변경이 한쪽만 따라간다. (`shared/protocol.ts` 의
// `GitCommitOidSchema` 는 정확히 40자라 의도적으로 다르다 — 함께 접지 않는다.)
async function revParseOid(cwd: string, rev: string): Promise<string | null> {
  const result = await runGit(cwd, ['rev-parse', '--verify', rev], { readOnly: true })
  const oid = result.stdout.trim()
  return result.ok && /^[0-9a-fA-F]{40,64}$/.test(oid) ? oid : null
}

export async function resolveHead(cwd: string): Promise<string | null> {
  return revParseOid(cwd, 'HEAD')
}

// 현재 HEAD 가 가리키는 **브랜치 이름**. detached HEAD 면 null (0211 ΔV4 D-070).
//
// **`symbolic-ref` 를 쓰는 이유**: 커밋이 하나도 없는 unborn 브랜치에서도 이름을 준다 —
// `rev-parse --abbrev-ref HEAD` 는 거기서 실패한다. `git-cli.ts` 가 같은 판단을 사본으로
// 갖고 있었고 0218 에서 이 함수 하나로 접었다 — HEAD 브랜치 이름 판정은 여기가 소유한다.
export async function resolveHeadRef(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'], { readOnly: true })
  const name = result.stdout.trim()
  return result.ok && name.length > 0 ? name : null
}

// 로컬 브랜치 하나의 커밋 OID. **`refs/heads/` 를 붙여서** 넘긴다 — 사용자가 고른 값이 그대로
// 첫 인자가 되면 `-` 로 시작하는 이름이 git 옵션으로 읽힌다. 접두사가 그 가능성을 없애고,
// 동시에 조회 범위를 브랜치 칩이 실제로 제시하는 로컬 브랜치로 좁힌다.
export async function resolveBranchOid(cwd: string, branch: string): Promise<string | null> {
  return revParseOid(cwd, `refs/heads/${branch}^{commit}`)
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

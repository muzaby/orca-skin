import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { branchExists, validateBranchName } from '../../infra/git/repository'

function slugOf(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// 저장소를 가리키는 **결정적** 디렉토리 세그먼트 (0210 D-104). 같은 repoRoot 는 언제나 같은
// 값이어야 한다 — 호출마다 새 UUID 를 뽑으면 첫 칸이 저장소를 식별하지 못하고 depth 만 는다.
//
// 이름만으로는 다른 저장소가 겹치므로(`~/a/orca` 와 `~/b/orca`) 경로 해시 8자를 붙인다.
// 입력은 `canonicalPath` 를 지난 값 하나로 고정한다 — realpath 결과가 아니면 같은 저장소가
// 두 세그먼트로 갈린다.
export function repoDirSegment(repoRoot: string): string {
  const hash = createHash('sha1').update(repoRoot).digest('hex').slice(0, 8)
  const name = basename(repoRoot)
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return `${name === '' ? 'repo' : name.slice(0, 40)}-${hash}`
}

// 브랜치 이름 → 디렉토리 세그먼트. `work/foo` 의 `/` 는 경로 구분자라 그대로 쓰면 depth 가
// 하나 더 생긴다. 사람이 브랜치를 눈으로 찾을 수 있는 것이 이 칸의 목적이다.
export function branchDirSegment(branch: string): string {
  return branch.replace(/[/\\]+/g, '-')
}

export async function chooseBranchName(input: {
  repoRoot: string
  worktreeId: string
  firstPrompt: string
  complete?: (prompt: string, signal: AbortSignal) => Promise<string>
  signal?: AbortSignal
  // 후보 브랜치가 만들 디렉토리가 이미 있으면 그 후보도 쓸 수 없다. 브랜치 유일성 루프
  // **하나가** 두 유일성을 겸한다 — 지워진 브랜치의 디렉토리 잔여물이 남아 있으면
  // `worktree add` 가 실패하는데, 그 실패를 루프 밖에서 다시 처리하면 규칙이 두 곳에 산다.
  dirTaken?: (branch: string) => Promise<boolean>
}): Promise<string> {
  let slug = ''
  if (input.complete) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const abort = (): void => controller.abort()
    input.signal?.addEventListener('abort', abort, { once: true })
    try {
      slug = slugOf(
        await input.complete(
          `다음 작업을 Git branch용 영문 kebab-case slug 하나로만 요약하라. 최대 40자.\n\n${input.firstPrompt}`,
          controller.signal
        )
      )
    } catch {
      slug = ''
    } finally {
      clearTimeout(timeout)
      input.signal?.removeEventListener('abort', abort)
    }
  }
  const base = `work/${slug || input.worktreeId.replace(/-/g, '').slice(0, 8)}`
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    if (
      (await validateBranchName(input.repoRoot, candidate)) &&
      !(await branchExists(input.repoRoot, candidate)) &&
      !(await input.dirTaken?.(candidate))
    )
      return candidate
  }
  return `work/${input.worktreeId.replace(/-/g, '')}`
}

import { branchExists, validateBranchName } from '../../infra/git/repository'

function slugOf(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function chooseBranchName(input: {
  repoRoot: string
  worktreeId: string
  firstPrompt: string
  complete?: (prompt: string, signal: AbortSignal) => Promise<string>
  signal?: AbortSignal
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
      !(await branchExists(input.repoRoot, candidate))
    )
      return candidate
  }
  return `work/${input.worktreeId.replace(/-/g, '')}`
}

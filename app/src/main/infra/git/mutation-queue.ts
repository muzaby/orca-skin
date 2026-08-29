import { realpath } from 'node:fs/promises'
import { normalize, resolve } from 'node:path'

const tails = new Map<string, Promise<void>>()

export async function canonicalRepoKey(repoPath: string): Promise<string> {
  const absolute = resolve(repoPath)
  return normalize(await realpath(absolute).catch(() => absolute))
}

export async function withRepoMutation<T>(
  repoPath: string,
  operation: () => Promise<T>
): Promise<T> {
  const repoKey = await canonicalRepoKey(repoPath)
  const previous = tails.get(repoKey) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  tails.set(repoKey, current)
  await previous.catch(() => undefined)
  try {
    return await operation()
  } finally {
    release()
    if (tails.get(repoKey) === current) tails.delete(repoKey)
  }
}

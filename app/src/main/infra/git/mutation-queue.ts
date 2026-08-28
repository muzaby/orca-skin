const tails = new Map<string, Promise<void>>()

export async function withRepoMutation<T>(
  repoKey: string,
  operation: () => Promise<T>
): Promise<T> {
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

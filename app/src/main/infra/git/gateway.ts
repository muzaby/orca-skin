import { runGit as defaultRunGit, type GitRunOptions, type GitRunResult } from './runner'
import { withRepoMutation } from './mutation-queue'

export type { GitRunResult } from './runner'
export type GitReadOptions = Pick<GitRunOptions, 'maxBuffer' | 'timeoutMs' | 'signal'>
export type GitWrite = (
  cwd: string,
  args: string[],
  options?: GitReadOptions
) => Promise<GitRunResult>
export interface GitGateway {
  read: GitWrite
  mutate<T>(repoPath: string, operation: (write: GitWrite) => Promise<T>): Promise<T>
  generation(): number
}

export function createGitGateway({
  run: runGit = defaultRunGit,
  maxConcurrentReads = 4
}: {
  run?: typeof defaultRunGit
  maxConcurrentReads?: number
} = {}): GitGateway {
  let generation = 0
  let active = 0
  const waiting: Array<() => void> = []
  const inFlight = new Map<string, Promise<GitRunResult>>()
  async function read(
    cwd: string,
    args: string[],
    options: GitReadOptions = {}
  ): Promise<GitRunResult> {
    const key = JSON.stringify([generation, cwd, args, options.maxBuffer, options.timeoutMs])
    // Cancellation ownership cannot be shared across different callers.
    const shared = options.signal ? undefined : inFlight.get(key)
    if (shared) return shared
    const execute = async (): Promise<GitRunResult> => {
      if (active >= maxConcurrentReads) await new Promise<void>((ready) => waiting.push(ready))
      else active++
      try {
        return await runGit(cwd, ['--no-optional-locks', ...args], { ...options, readOnly: true })
      } finally {
        const next = waiting.shift()
        if (next) next()
        else active--
      }
    }
    const pending = execute()
    if (!options.signal) inFlight.set(key, pending)
    try {
      return await pending
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key)
    }
  }
  return {
    read,
    generation: () => generation,
    mutate: (repoPath, operation) =>
      withRepoMutation(repoPath, async () => {
        try {
          return await operation((cwd, args, options = {}) =>
            runGit(cwd, args, { ...options, readOnly: false })
          )
        } finally {
          generation++
        }
      })
  }
}

export const gitGateway = createGitGateway()

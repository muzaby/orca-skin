import type { SessionAdapter } from '../../adapters/types'
import type { WorktreeService } from '../../features/worktrees/service'

type CompletionInput = Parameters<SessionAdapter['complete']>[0]

export type PrepareTurnWorktreeResult =
  | { kind: 'passthrough'; executionCwd: string }
  | { kind: 'managed'; worktreeId: string; executionCwd: string }
  | { kind: 'rejected'; message: string }

export async function prepareTurnWorktree(input: {
  enabled: boolean
  sessionId?: string
  sourceCwd: string
  firstPrompt: string
  signal: AbortSignal
  adapter: Pick<SessionAdapter, 'complete'>
  providerSettings: CompletionInput['providerSettings']
  env: CompletionInput['env']
  worktrees: Pick<WorktreeService, 'prepare'>
}): Promise<PrepareTurnWorktreeResult> {
  if (!input.enabled || input.sessionId) {
    return { kind: 'passthrough', executionCwd: input.sourceCwd }
  }

  return input.worktrees.prepare({
    sourceCwd: input.sourceCwd,
    firstPrompt: input.firstPrompt,
    signal: input.signal,
    complete: (prompt, signal) =>
      input.adapter.complete({
        prompt,
        cwd: input.sourceCwd,
        signal,
        providerSettings: input.providerSettings,
        env: input.env
      })
  })
}

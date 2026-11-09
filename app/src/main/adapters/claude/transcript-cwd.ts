import type { ClaudeHistoryEntry } from './native-history-map'

/**
 * Claude CLI session working directory, decided the way the CLI decides it.
 *
 * Each transcript entry records `cwd` from the shell's current directory, so a Bash `cd` inside a
 * turn changes the per-entry value. The session's own directory is the last valid `relocated`
 * stamp, otherwise the first recorded `cwd` (SDK `relocatedCwd ?? first cwd`). Session identity is
 * checked by the caller. Returns `undefined` when neither exists.
 */
export function claudeTranscriptCwd(entries: readonly ClaudeHistoryEntry[]): string | undefined {
  const relocated = entries.findLast(
    (entry) =>
      entry.type === 'relocated' &&
      typeof entry.relocatedCwd === 'string' &&
      entry.relocatedCwd !== ''
  )
  if (relocated) return relocated.relocatedCwd as string
  const first = entries.find((entry) => typeof entry.cwd === 'string')
  return first?.cwd as string | undefined
}

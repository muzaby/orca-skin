import type {
  BackgroundTaskRecord,
  BackgroundOutputRef
} from '../../../../../shared/background-task'
import { isBackgroundTerminal } from '../../../../../shared/background-task'
export function backgroundTaskStatus(
  task: BackgroundTaskRecord
): 'completed' | 'failed' | 'stopped' | 'running' | 'pending' | 'unknown' | 'excluded' {
  if (task.status === 'killed' || task.status === 'stopped') return 'stopped'
  if (task.status === 'completed' || task.status === 'failed') return task.status
  if (task.liveMembership === 'excluded') return 'excluded'
  if (task.status === 'running' || task.status === 'pending') return task.status
  return 'unknown'
}
export function hasTerminalConflict(task: BackgroundTaskRecord): boolean {
  return (
    new Set(
      task.terminalEvidence.map((item) => (item.status === 'killed' ? 'stopped' : item.status))
    ).size > 1
  )
}
export function canStopBackgroundTask(
  task: BackgroundTaskRecord,
  generation: string | undefined,
  connection: string
): boolean {
  return (
    task.generation === generation &&
    connection === 'connected' &&
    !isBackgroundTerminal(task.status) &&
    task.liveMembership !== 'excluded' &&
    task.stop?.state !== 'requested' &&
    task.stop?.state !== 'acknowledged'
  )
}
export function safeOutputText(text: string): string {
  // Control bytes are deliberately removed before rendering provider output as text.
  /* eslint-disable no-control-regex */
  return text
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  /* eslint-enable no-control-regex */
}
export function backgroundResultText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return safeOutputText(value)
  return safeOutputText(JSON.stringify(value, null, 2) ?? '')
}

// Keep every source ref in canonical state; URI aliases share one visible output entry.
export function backgroundOutputRefsForDisplay(
  refs: readonly BackgroundOutputRef[] = []
): BackgroundOutputRef[] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key =
      ref.kind === 'uri' ? JSON.stringify(['uri', ref.value]) : JSON.stringify(['id', ref.id])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'

export async function resolveLandingCwd(
  lastCwd: string | null | undefined,
  fallback: string
): Promise<string> {
  if (!lastCwd || !isAbsolute(lastCwd)) return fallback
  try {
    return (await stat(lastCwd)).isDirectory() ? lastCwd : fallback
  } catch {
    return fallback
  }
}

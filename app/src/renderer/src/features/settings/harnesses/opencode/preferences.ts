import type { HarnessPreferences } from '../../../../../../shared/harness'
export function openCodePreferences(
  saved: HarnessPreferences,
  instructions: string,
  executablePath: string
): HarnessPreferences {
  return { ...saved, instructions, executablePath: executablePath.trim() }
}

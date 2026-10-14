import type { HarnessPreferences } from '../../../../../../shared/harness'
export function claudePreferences(
  saved: HarnessPreferences,
  instructions: string
): HarnessPreferences {
  return { ...saved, instructions }
}

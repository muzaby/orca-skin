import type { Backend } from '../../../../../shared/ipc'
import type { HarnessPreferences } from '../../../../../shared/harness'
import { claudePreferences } from './claude/preferences'
import { openCodePreferences } from './opencode/preferences'

export function harnessPreferences(
  backend: Backend,
  saved: HarnessPreferences,
  instructions: string,
  executablePath: string
): HarnessPreferences {
  return backend === 'opencode'
    ? openCodePreferences(saved, instructions, executablePath)
    : claudePreferences(saved, instructions)
}

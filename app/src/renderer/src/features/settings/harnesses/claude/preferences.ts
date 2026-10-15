import type { HarnessPreferences } from '../../../../../../shared/harness'
import type { HarnessSettingsCodec } from '../types'
export function claudePreferences(
  saved: HarnessPreferences,
  instructions: string
): HarnessPreferences {
  return { ...saved, instructions }
}

export const claudeSettingsCodec: HarnessSettingsCodec = {
  createDraft: (saved) => ({ instructions: saved.instructions, fields: {} }),
  isDirty: (saved, draft) => draft.instructions !== saved.instructions,
  serialize: (saved, draft) => claudePreferences(saved, draft.instructions)
}

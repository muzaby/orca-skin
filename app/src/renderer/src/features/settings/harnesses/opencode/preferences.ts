import type { HarnessPreferences } from '../../../../../../shared/harness'
import type { HarnessSettingsCodec } from '../types'
export function openCodePreferences(
  saved: HarnessPreferences,
  instructions: string,
  executablePath: string
): HarnessPreferences {
  return { ...saved, instructions, executablePath: executablePath.trim() }
}

export const openCodeSettingsCodec: HarnessSettingsCodec = {
  createDraft: (saved) => ({
    instructions: saved.instructions,
    fields: { executablePath: saved.executablePath ?? '' }
  }),
  isDirty: (saved, draft) =>
    draft.instructions !== saved.instructions ||
    draft.fields.executablePath.trim() !== (saved.executablePath ?? ''),
  serialize: (saved, draft) =>
    openCodePreferences(saved, draft.instructions, draft.fields.executablePath)
}

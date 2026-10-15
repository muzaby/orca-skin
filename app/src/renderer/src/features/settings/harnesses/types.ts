import type { ComponentType } from 'react'
import type { HarnessPreferences } from '../../../../../shared/harness'

export interface HarnessSettingsDraft {
  instructions: string
  fields: Record<string, string>
}

export interface HarnessSettingsFieldsProps {
  draft: HarnessSettingsDraft
  onChange: (draft: HarnessSettingsDraft) => void
}

export interface HarnessSettingsCodec {
  createDraft: (saved: HarnessPreferences) => HarnessSettingsDraft
  isDirty: (saved: HarnessPreferences, draft: HarnessSettingsDraft) => boolean
  serialize: (saved: HarnessPreferences, draft: HarnessSettingsDraft) => HarnessPreferences
}

export interface HarnessSettingsConfiguration extends HarnessSettingsCodec {
  Fields: ComponentType<HarnessSettingsFieldsProps>
  Description: ComponentType
}

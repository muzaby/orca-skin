/** Model rows cross the native parsing boundary without carrying SDK types. */
export interface ParsedModel {
  alias: string
  model: string | null
  isCustom: boolean
  oneMillionContext: boolean
  isDefault: boolean
}

export type SettingsModelParser = (settings: Record<string, unknown>) => ParsedModel[]

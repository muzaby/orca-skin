import { isRecord } from '../../../shared/obj'

export const claudePluginEnabled = (value: unknown): boolean =>
  value === true || Array.isArray(value) || isRecord(value)

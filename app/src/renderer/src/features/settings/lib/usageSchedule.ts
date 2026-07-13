export const USAGE_RECOMPUTE_PRESETS = [
  { value: '0 */1 * * *', labelKey: 'settings.usage.presetHourly' },
  { value: '*/30 * * * *', labelKey: 'settings.usage.preset30m' },
  { value: '0 9 * * *', labelKey: 'settings.usage.presetDaily9' }
] as const

export const CUSTOM_USAGE_RECOMPUTE_PRESET = 'custom'

export function usageRecomputeSelectValue(cron: string, customSelected = false): string {
  if (customSelected) return CUSTOM_USAGE_RECOMPUTE_PRESET
  return USAGE_RECOMPUTE_PRESETS.some((p) => p.value === cron)
    ? cron
    : CUSTOM_USAGE_RECOMPUTE_PRESET
}

export function isUsageCronInputEnabled(selectValue: string): boolean {
  return selectValue === CUSTOM_USAGE_RECOMPUTE_PRESET
}

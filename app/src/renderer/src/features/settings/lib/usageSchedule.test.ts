import { describe, expect, it } from 'vitest'
import {
  CUSTOM_USAGE_RECOMPUTE_PRESET,
  isUsageCronInputEnabled,
  usageRecomputeSelectValue
} from './usageSchedule'

describe('usage schedule view model', () => {
  it('selects presets for known cron values and disables manual input', () => {
    const value = usageRecomputeSelectValue('*/30 * * * *')
    expect(value).toBe('*/30 * * * *')
    expect(isUsageCronInputEnabled(value)).toBe(false)
  })

  it('selects custom for unknown cron values and enables manual input', () => {
    const value = usageRecomputeSelectValue('*/17 * * * *')
    expect(value).toBe(CUSTOM_USAGE_RECOMPUTE_PRESET)
    expect(isUsageCronInputEnabled(value)).toBe(true)
  })

  it('keeps manual input enabled after the user explicitly chooses custom from a preset', () => {
    const value = usageRecomputeSelectValue('0 */1 * * *', true)
    expect(value).toBe(CUSTOM_USAGE_RECOMPUTE_PRESET)
    expect(isUsageCronInputEnabled(value)).toBe(true)
  })
})

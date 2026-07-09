import { describe, expect, it } from 'vitest'
import { UpdateInstallResultSchema, UpdateProgressSchema, UpdateStateSchema } from './protocol'

describe('update IPC schemas', () => {
  it('accepts normalized update state and progress payloads', () => {
    expect(
      UpdateStateSchema.safeParse({
        status: 'ready',
        currentVersion: '1.0.0',
        availableVersion: '1.0.1',
        releaseNotes: 'fixes',
        progress: { percent: 100, transferred: 10, total: 10, bytesPerSecond: 1 },
        canInstall: true,
        checkedAt: 123
      }).success
    ).toBe(true)
    expect(UpdateProgressSchema.safeParse({ percent: 50 }).success).toBe(true)
  })

  it('rejects invalid status and out-of-range progress', () => {
    expect(
      UpdateStateSchema.safeParse({ status: 'done', currentVersion: '1.0.0', canInstall: true })
        .success
    ).toBe(false)
    expect(UpdateProgressSchema.safeParse({ percent: 150 }).success).toBe(false)
  })

  it('accepts install result failure reasons used by the handler', () => {
    expect(
      UpdateInstallResultSchema.safeParse({
        ok: false,
        reason: 'not-idle',
        message: '작업이 진행 중입니다'
      }).success
    ).toBe(true)
  })
})

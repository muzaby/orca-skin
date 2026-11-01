import { describe, expect, it } from 'vitest'
import { UpdateInstallResultSchema } from './protocol'

describe('update IPC schemas', () => {
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

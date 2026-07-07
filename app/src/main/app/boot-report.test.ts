import { describe, expect, it } from 'vitest'
import { createBootReportRecorder } from './boot-report'

describe('BootReportRecorder', () => {
  it('완료된 부트 리포트 스냅샷을 불변 복사로 반환한다', () => {
    const recorder = createBootReportRecorder()

    recorder.stepSync('db-init', { critical: true }, () => 'ok')
    recorder.stepSync('config', { critical: false }, () => {
      throw new Error('fallback used')
    })
    recorder.finish()

    const first = recorder.getReport()
    first.steps.push({
      id: 'mutated',
      status: 'failed',
      critical: true,
      startedAt: 0,
      finishedAt: 0,
      durationMs: 0
    })
    first.warnings.push('mutated')

    const second = recorder.getReport()
    expect(second.status).toBe('warning')
    expect(second.steps.map((step) => step.id)).toEqual(['db-init', 'config'])
    expect(second.warnings).toEqual(['config: fallback used'])
  })

  it('critical step 실패는 리포트에 failed 로 남기고 다시 throw 한다', () => {
    const recorder = createBootReportRecorder()

    expect(() =>
      recorder.stepSync('db-init', { critical: true }, () => {
        throw new Error('db down')
      })
    ).toThrow('db down')

    const report = recorder.getReport()
    expect(report.status).toBe('failed')
    expect(report.steps[0]).toMatchObject({
      id: 'db-init',
      status: 'failed',
      critical: true,
      message: 'db down'
    })
  })

  it('non-critical step 실패는 warning 으로 degrade 한다', async () => {
    const recorder = createBootReportRecorder()

    await recorder.step('workspace', { critical: false }, async () => {
      throw new Error('permission denied')
    })

    const report = recorder.getReport()
    expect(report.status).toBe('warning')
    expect(report.steps[0]).toMatchObject({
      id: 'workspace',
      status: 'warning',
      critical: false,
      message: 'permission denied'
    })
  })
})

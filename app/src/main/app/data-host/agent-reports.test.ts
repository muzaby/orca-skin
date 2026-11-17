import { describe, expect, it, vi } from 'vitest'
import type { AppErrorReport } from '../../../shared/app-error'
import type { BootReport } from '../../../shared/ipc'
import { createAgentReports } from './agent-reports'

const own: BootReport = {
  startedAt: 100,
  finishedAt: 160,
  durationMs: 60,
  status: 'ok',
  steps: [
    { id: 'db', status: 'ok', critical: true, startedAt: 100, finishedAt: 120, durationMs: 20 },
    {
      id: 'skill-scan',
      status: 'ok',
      critical: false,
      startedAt: 150,
      finishedAt: 160,
      durationMs: 10
    }
  ],
  warnings: []
}
const agent: BootReport = {
  startedAt: 130,
  finishedAt: 190,
  durationMs: 60,
  status: 'warning',
  steps: [
    {
      id: 'harness-install',
      status: 'warning',
      critical: false,
      startedAt: 130,
      finishedAt: 190,
      durationMs: 60,
      message: 'm'
    }
  ],
  warnings: ['harness-install: m']
}
const error: AppErrorReport = { id: 'r1', title: 'engineInternal', detail: 'd', origin: 'main' }

describe('데이터 호스트가 모으는 에이전트 호스트 보고 (AC47)', () => {
  it('오류 보고는 허브로 1건 내고, 다른 통지는 처리하지 않는다', () => {
    const publish = vi.fn()
    const reports = createAgentReports({ publish })
    expect(reports.notify('report.error', error)).toBe(true)
    expect(publish).toHaveBeenCalledExactlyOnceWith(error)
    expect(reports.notify('turn.event', {})).toBe(false)
    expect(publish).toHaveBeenCalledOnce()
  })

  it('형식이 틀린 보고는 버리고 알린다', () => {
    const publish = vi.fn()
    const onInvalid = vi.fn()
    const reports = createAgentReports({ publish, onInvalid })
    expect(reports.notify('report.error', { ...error, title: 'nope' })).toBe(true)
    expect(reports.notify('report.boot', { ...agent, steps: 'x' })).toBe(true)
    expect(publish).not.toHaveBeenCalled()
    expect(onInvalid.mock.calls).toEqual([['report.error'], ['report.boot']])
    expect(reports.bootReport(own)).toBe(own)
  })

  it('부팅 보고는 두 호스트의 단계를 시작 순서로 합치고 더 나쁜 상태·가장 넓은 구간을 준다', () => {
    const reports = createAgentReports({ publish: vi.fn() })
    expect(reports.bootReport(own)).toBe(own)
    reports.notify('report.boot', agent)
    const merged = reports.bootReport(own)
    expect(merged.steps.map((step) => step.id)).toEqual(['db', 'harness-install', 'skill-scan'])
    expect(merged).toMatchObject({
      startedAt: 100,
      finishedAt: 190,
      durationMs: 90,
      status: 'warning',
      warnings: ['harness-install: m']
    })
  })

  it('자기 상태가 더 나쁘면 그 상태를 유지한다', () => {
    const reports = createAgentReports({ publish: vi.fn() })
    reports.notify('report.boot', agent)
    expect(reports.bootReport({ ...own, status: 'failed' }).status).toBe('failed')
  })

  it('에이전트 호스트가 죽으면 그 부팅 보고를 비운다', () => {
    const reports = createAgentReports({ publish: vi.fn() })
    reports.notify('report.boot', agent)
    reports.peerClosed()
    expect(reports.bootReport(own)).toBe(own)
  })
})

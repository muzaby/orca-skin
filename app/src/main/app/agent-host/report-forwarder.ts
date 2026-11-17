// 에이전트 호스트의 오류 보고·부팅 단계를 데이터 호스트로 넘긴다 (0324 D-042 · AC47).
//
// 창에 오류 보고와 부팅 보고를 주는 프로세스는 데이터 호스트 하나다. 에이전트 호스트는 자기 허브가
// 낸 보고를 `report.error` 로, 끝난 부팅 보고를 `report.boot` 로 보낸다. 피어가 없는 동안의 오류
// 보고는 상한까지 보관했다가 연결되면 순서대로 보내고, 부팅 보고는 연결될 때마다 다시 보낸다 —
// 데이터 호스트가 다시 뜨면 그쪽 사본이 비기 때문이다.

import { APP_ERROR_PENDING_MAX, type AppErrorReport } from '../../../shared/app-error'
import type { BootReport } from '../../../shared/ipc'
import type { ErrorReportHub } from '../../infra/error-report/hub'

export interface ReportForwarderDeps {
  hub: Pick<ErrorReportHub, 'setForward'>
  // 보냈으면 true, 피어가 없어 못 보냈으면 false.
  notify(method: 'report.error' | 'report.boot', payload: unknown): boolean
  onConnected(listener: () => void): () => void
}

export interface ReportForwarder {
  // 부팅 보고가 끝났다 — 지금 보내고, 이후 연결마다 다시 보낸다.
  bootFinished(report: BootReport): void
  stop(): void
}

export function createReportForwarder(deps: ReportForwarderDeps): ReportForwarder {
  let pending: AppErrorReport[] = []
  let boot: BootReport | null = null

  deps.hub.setForward((report) => {
    if (deps.notify('report.error', report)) return
    pending.push(report)
    if (pending.length > APP_ERROR_PENDING_MAX) pending.shift()
  })
  const offConnected = deps.onConnected(() => {
    if (boot) deps.notify('report.boot', boot)
    const queued = pending
    pending = []
    for (const report of queued) deps.notify('report.error', report)
  })

  return {
    bootFinished(report) {
      boot = report
      deps.notify('report.boot', report)
    },
    stop() {
      offConnected()
      deps.hub.setForward(null)
    }
  }
}

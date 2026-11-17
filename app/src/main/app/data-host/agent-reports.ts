// 에이전트 호스트가 보낸 오류 보고·부팅 보고를 받는다 (0324 D-042 · AC47).
//
// 오류 보고는 이 프로세스의 허브에 그대로 낸다 — 창 전달·중복 억제·준비 전 보류가 자기 보고와 같다.
// 부팅 보고는 사본으로 두었다가 창이 부팅 보고를 물으면 자기 보고와 합친다. 에이전트 호스트가 죽으면
// 사본을 비운다 — 다시 뜬 호스트가 새 보고를 보낸다.

import { AppErrorReportSchema, type AppErrorReport } from '../../../shared/app-error'
import type { BootReport } from '../../../shared/ipc'
import { BootReportSchema, mergeBootReports } from '../boot-report'

export interface AgentReportsDeps {
  publish(report: AppErrorReport): void
  onInvalid?(method: string): void
}

export interface AgentReports {
  // 처리했으면 true — 다른 통지는 호출자가 다음 수신기로 넘긴다.
  notify(method: string, payload: unknown): boolean
  bootReport(own: BootReport): BootReport
  peerClosed(): void
}

export function createAgentReports(deps: AgentReportsDeps): AgentReports {
  let agentBoot: BootReport | null = null
  return {
    notify(method, payload) {
      if (method === 'report.error') {
        const parsed = AppErrorReportSchema.safeParse(payload)
        if (parsed.success) deps.publish(parsed.data as AppErrorReport)
        else deps.onInvalid?.(method)
        return true
      }
      if (method === 'report.boot') {
        const parsed = BootReportSchema.safeParse(payload)
        if (parsed.success) agentBoot = parsed.data
        else deps.onInvalid?.(method)
        return true
      }
      return false
    },
    bootReport: (own) => mergeBootReports(own, agentBoot),
    peerClosed() {
      agentBoot = null
    }
  }
}

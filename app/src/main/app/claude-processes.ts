// Claude 플러그인 전역 토글(0283)이 닫는 실행 중 Claude 프로세스의 계획과 실행.
// 전역 선택은 Query 생성 때만 읽히므로, 토글은 살아 있는 Claude 프로세스를 모두 닫아 다음
// 메시지가 새 선택으로 다시 띄우게 한다. electron·DB 를 import 하지 않는 순수 모듈이다.
import type { Backend, ChatActivitySnapshot } from '../../shared/ipc'
import { sessionActivityBusy } from './session-activity-busy'

interface LeaseView {
  readonly leaseId: string
  readonly sessionId: string | null
  readonly backend?: Backend
  readonly kind: string
}

interface RuntimeView {
  readonly sessionId: string
  readonly runtime: { readonly responding?: boolean }
}

export type ClaudeProcessTarget =
  { sessionId: string; busy: boolean } | { leaseId: string; busy: true }

export interface ClaudeProcessPlan {
  targets: ClaudeProcessTarget[]
  // 동작 중인 대상 수 — 확인 대화상자의 N.
  busy: number
}

export interface ClaudeProcessInput {
  leases: readonly LeaseView[]
  runtimes: readonly RuntimeView[]
  backendOf(sessionId: string): Backend | undefined
  activity(sessionId: string): ChatActivitySnapshot
}

export function planClaudeProcesses(input: ClaudeProcessInput): ClaudeProcessPlan {
  const targets: ClaudeProcessTarget[] = []
  const seen = new Set<string>()
  // closing lease 는 이미 닫히는 중이다 — 그 lease 의 runtime 항목도 다시 세지 않는다.
  for (const lease of input.leases) if (lease.sessionId) seen.add(lease.sessionId)
  for (const lease of input.leases) {
    if (lease.kind === 'closing') continue
    const backend =
      lease.backend ?? (lease.sessionId ? input.backendOf(lease.sessionId) : undefined)
    if (backend !== 'claude') continue
    // lease 가 있으면 준비·응답·연속 턴·수신 대기 중이다(0166 lease = 생성 중).
    targets.push(
      lease.sessionId
        ? { sessionId: lease.sessionId, busy: true }
        : { leaseId: lease.leaseId, busy: true }
    )
  }
  for (const { sessionId, runtime } of input.runtimes) {
    if (seen.has(sessionId) || input.backendOf(sessionId) !== 'claude') continue
    seen.add(sessionId)
    targets.push({
      sessionId,
      busy: runtime.responding === true || sessionActivityBusy(input.activity(sessionId))
    })
  }
  return { targets, busy: targets.filter((target) => target.busy).length }
}

export interface ClaudeProcessReset {
  plan(): ClaudeProcessPlan
  close(targets: readonly ClaudeProcessTarget[]): void
}

export function createClaudeProcessReset(deps: {
  supervisor: {
    allLeases(): readonly LeaseView[]
    runtimeEntries(): readonly RuntimeView[]
    discardLease(leaseId: string): boolean
  }
  backendOf(sessionId: string): Backend | undefined
  activity(sessionId: string): ChatActivitySnapshot
  discardSession(sessionId: string): void
  failed(error: unknown): void
}): ClaudeProcessReset {
  return {
    plan: () =>
      planClaudeProcesses({
        leases: deps.supervisor.allLeases(),
        runtimes: deps.supervisor.runtimeEntries(),
        backendOf: deps.backendOf,
        activity: deps.activity
      }),
    close: (targets) => {
      for (const target of targets) {
        // 한 대상의 실패가 나머지를 옛 선택으로 남기지 않게 계속 닫는다.
        try {
          if ('leaseId' in target) deps.supervisor.discardLease(target.leaseId)
          else deps.discardSession(target.sessionId)
        } catch (error) {
          deps.failed(error)
        }
      }
    }
  }
}

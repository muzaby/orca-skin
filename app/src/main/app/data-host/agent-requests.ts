// 데이터 호스트가 에이전트 호스트에 부탁하는 실행 요청 (0324 F4 · EP-21′ 5자리 · D-050). 데이터 호스트
// 조립이 예약 작업·인증 스택·확장 배포에 넘긴다. 세션 핸들러의 훅 4자리는 `session-hooks.ts` 다.
//
// - 예약 셸 명령 실행 · 하네스 설치 판정 · 모델 목록 · 확장 배포: `requestEnsured` — 실행 결과가 필요해
//   에이전트 호스트가 없으면 띄워 달라고 한다(AC48).
// - 셸 명령 취소: `request` — 실행이 없으면 취소할 것도 없다. 취소 실패는 삼킨다.
//
// 링크는 부를 때마다 받는다 — 조립은 링크를 DB 준비 뒤에 만든다.

import type { HarnessListedModel } from '../../adapters/common/harness-config'
import type { Backend } from '../../../shared/ipc'
import type { ShellRunResult } from '../../infra/shell/shell-runner'
import type { AgentLink } from './agent-link'

type Link = Pick<AgentLink, 'request' | 'requestEnsured'>

export interface ShellRunInput {
  command: string
  cwd: string
  signal?: AbortSignal
  timeoutMs: number
  maxOutputBytes: number
}

// 예약 작업의 셸 명령 실행. 실행 id 는 이 함수가 매긴다 — 취소가 그 id 를 가리킨다.
export function createRemoteShellRunner(
  getLink: () => Link
): (input: ShellRunInput) => Promise<ShellRunResult> {
  let seq = 0
  return async ({ command, cwd, signal, timeoutMs, maxOutputBytes }) => {
    const link = getLink()
    const runId = `run_${++seq}`
    const onAbort = (): void => {
      void link.request('cancelShell', runId).catch(() => undefined)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      return await link.requestEnsured('runShell', {
        runId,
        command,
        cwd,
        timeoutMs,
        maxOutputBytes
      })
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

// 로그인 프리 연결의 하네스 능력(0291) — 하네스는 에이전트 호스트에 있다.
export function createRemoteHarnessHost(getLink: () => Link): {
  installed(harnessId: Backend): Promise<{ installed: boolean; version?: string }>
  listModels(
    harnessId: Backend,
    provider: string,
    options: { env?: Record<string, string> }
  ): Promise<readonly HarnessListedModel[]>
} {
  return {
    installed: (harnessId) => {
      const link = getLink()
      return link.requestEnsured('harnessInstalled', harnessId)
    },
    // 환경 변수는 구조화 복제가 되는 평범한 객체로 넘긴다.
    listModels: (harnessId, provider, options) => {
      const link = getLink()
      return link.requestEnsured(
        'harnessListModels',
        harnessId,
        provider,
        options.env ? { ...options.env } : undefined
      )
    }
  }
}

// MCP·스킬이 바뀌었다 — 이쪽 계산(관리형 MCP)을 먼저 고치고 하네스 플러그인 배포를 부탁한다.
export function createRemoteExtensionDeploy(
  getLink: () => Link,
  refresh: () => void
): (options?: { throwOnFailure?: boolean }) => Promise<void> {
  return async (options) => {
    refresh()
    const link = getLink()
    await link.requestEnsured('deployExtensions', options)
  }
}

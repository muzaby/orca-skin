// 턴 실행 cwd 확정 (0209 신규 생성 + 0210 resume 복구).
//
// 이 모듈이 실행 cwd의 **단일 producer**다. 신규 세션은 여기서 worktree를 만들고, resume 세션은
// 여기서 그 worktree가 아직 있는지 확인한다 — 확인이 없으면 없는 경로가 그대로 spawn 인자가 되고
// SDK는 그 실패를 "native binary … failed to launch"(libc 불일치)로 오진해 보고한다.

import type { WorktreeDisplay, WorktreePrepareStep } from '../../../shared/ipc'
import type { SessionAdapter } from '../../adapters/types'
import type { WorktreeService } from '../../features/worktrees/service'
import { resolveHead } from '../../infra/git/repository'

type CompletionInput = Parameters<SessionAdapter['complete']>[0]

export type PrepareTurnWorktreeResult =
  | { kind: 'passthrough'; executionCwd: string; sessionBaseline: string | null }
  | {
      kind: 'managed'
      worktreeId: string
      executionCwd: string
      display: WorktreeDisplay
      sessionBaseline: string
    }
  // 원본 작업 경로로 되돌린 turn. `passthrough`와 합치면 통지·respawn 책임이 사라진다.
  | { kind: 'recovered'; executionCwd: string; lostWorktreeRoot: string; sessionBaseline: null }
  | { kind: 'rejected'; message: string }

export async function prepareTurnWorktree(input: {
  enabled: boolean
  sessionId?: string
  sourceCwd: string
  baseRef?: string
  firstPrompt: string
  signal: AbortSignal
  adapter: Pick<SessionAdapter, 'complete'>
  providerSettings: CompletionInput['providerSettings']
  env: CompletionInput['env']
  worktrees: Pick<WorktreeService, 'prepare' | 'recoverMissingWorktree'>
  // 폴백을 사용자 화면에 알린다. 세 번째 쓰기 지점이고 DB 두 쓰기 **뒤**다(§13).
  onRecovered?: (recovered: { sessionId: string; executionCwd: string }) => void
  // 격리 준비 진행 (0211). **신규 격리 경로에서만** 발화한다 — resume·recover·passthrough 는
  // 부르지 않는다(0211 D-005: 요구 범위가 "워크트리로 세션 시작 시" 다).
  onProgress?: (step: WorktreePrepareStep) => void
  // 표시 정본이 확정된 순간 (0211). `buildTurn` 보다 **앞**에서 불려야 TurnContext 조립이
  // 그 값을 쓸 수 있다 — 아래 호출 순서가 그것을 보장한다.
  onManaged?: (display: WorktreeDisplay) => void
}): Promise<PrepareTurnWorktreeResult> {
  if (input.sessionId) {
    const recovery = await input.worktrees.recoverMissingWorktree({
      sessionId: input.sessionId,
      executionCwd: input.sourceCwd
    })
    if (recovery.kind === 'unrecoverable')
      return {
        kind: 'rejected',
        message:
          'Worktree와 원본 작업 경로가 모두 없어 이 대화를 이어갈 수 없습니다. 작업 경로를 다시 지정해 주세요.'
      }
    if (recovery.kind === 'recovered') {
      input.onRecovered?.({ sessionId: input.sessionId, executionCwd: recovery.executionCwd })
      return {
        kind: 'recovered',
        executionCwd: recovery.executionCwd,
        lostWorktreeRoot: recovery.lostWorktreeRoot,
        sessionBaseline: null
      }
    }
    return { kind: 'passthrough', executionCwd: input.sourceCwd, sessionBaseline: null }
  }

  if (!input.enabled) {
    const sessionBaseline = await resolveHead(input.sourceCwd).catch(() => null)
    return { kind: 'passthrough', executionCwd: input.sourceCwd, sessionBaseline }
  }

  const prepared = await input.worktrees.prepare({
    sourceCwd: input.sourceCwd,
    firstPrompt: input.firstPrompt,
    signal: input.signal,
    ...(input.baseRef ? { baseRef: input.baseRef } : {}),
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    complete: (prompt, signal) =>
      input.adapter.complete({
        prompt,
        cwd: input.sourceCwd,
        signal,
        providerSettings: input.providerSettings,
        env: input.env
      })
  })
  // 다섯 번째 단계 — worktree 를 확보한 **뒤**, 런타임 확보 전. 거부된 준비에는 붙이지
  // 않는다: 실패한 뒤에 "세션을 시작하는 중" 을 말하면 그것이 마지막 문구로 남는다.
  if (prepared.kind === 'managed') {
    input.onManaged?.(prepared.display)
    input.onProgress?.('session')
    return {
      kind: 'managed',
      worktreeId: prepared.worktreeId,
      executionCwd: prepared.executionCwd,
      display: prepared.display,
      sessionBaseline: prepared.baseOid
    }
  }
  return prepared
}

export async function prepareTurnExecution<TTurn, TEntry>(input: {
  worktree: Parameters<typeof prepareTurnWorktree>[0]
  extraDirs: readonly string[] | undefined
  buildTurn: (
    executionCwd: string,
    extraDirs: readonly string[] | undefined,
    sessionBaseline: string | null
  ) => TTurn
  // `executionCwdRecovered` 는 respawn 판정으로 간다 — cwd 는 spawn 시점에 박히므로 살아 있는
  // 채널을 새 경로로 돌릴 방법이 없고, 내려야만 다음 spawn 이 원본 경로에서 뜬다(D-108).
  acquireRuntime: (turn: TTurn, executionCwdRecovered: boolean) => Promise<TEntry>
}): Promise<{ kind: 'rejected'; message: string } | { kind: 'ready'; turn: TTurn; entry: TEntry }> {
  const prepared = await prepareTurnWorktree(input.worktree)
  if (prepared.kind === 'rejected') return prepared

  const turn = input.buildTurn(prepared.executionCwd, input.extraDirs, prepared.sessionBaseline)
  const entry = await input.acquireRuntime(turn, prepared.kind === 'recovered')
  return { kind: 'ready', turn, entry }
}

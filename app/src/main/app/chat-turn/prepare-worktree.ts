// 턴 실행 cwd 확정 (0209 신규 생성 + 0210 resume 복구).
//
// 이 모듈이 실행 cwd의 **단일 producer**다. 신규 세션은 여기서 worktree를 만들고, resume 세션은
// 여기서 그 worktree가 아직 있는지 확인한다 — 확인이 없으면 없는 경로가 그대로 spawn 인자가 되고
// SDK는 그 실패를 "native binary … failed to launch"(libc 불일치)로 오진해 보고한다.

import type { SessionAdapter } from '../../adapters/types'
import type { WorktreeService } from '../../features/worktrees/service'

type CompletionInput = Parameters<SessionAdapter['complete']>[0]

export type PrepareTurnWorktreeResult =
  | { kind: 'passthrough'; executionCwd: string }
  | { kind: 'managed'; worktreeId: string; executionCwd: string }
  // 원본 작업 경로로 되돌린 turn. `passthrough`와 합치면 통지·respawn 책임이 사라진다.
  | { kind: 'recovered'; executionCwd: string; lostWorktreeRoot: string }
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
        lostWorktreeRoot: recovery.lostWorktreeRoot
      }
    }
    return { kind: 'passthrough', executionCwd: input.sourceCwd }
  }

  if (!input.enabled) return { kind: 'passthrough', executionCwd: input.sourceCwd }

  return input.worktrees.prepare({
    sourceCwd: input.sourceCwd,
    firstPrompt: input.firstPrompt,
    signal: input.signal,
    ...(input.baseRef ? { baseRef: input.baseRef } : {}),
    complete: (prompt, signal) =>
      input.adapter.complete({
        prompt,
        cwd: input.sourceCwd,
        signal,
        providerSettings: input.providerSettings,
        env: input.env
      })
  })
}

export async function prepareTurnExecution<TTurn, TEntry>(input: {
  worktree: Parameters<typeof prepareTurnWorktree>[0]
  extraDirs: readonly string[] | undefined
  buildTurn: (executionCwd: string, extraDirs: readonly string[] | undefined) => TTurn
  // `executionCwdRecovered` 는 respawn 판정으로 간다 — cwd 는 spawn 시점에 박히므로 살아 있는
  // 채널을 새 경로로 돌릴 방법이 없고, 내려야만 다음 spawn 이 원본 경로에서 뜬다(D-108).
  acquireRuntime: (turn: TTurn, executionCwdRecovered: boolean) => Promise<TEntry>
}): Promise<{ kind: 'rejected'; message: string } | { kind: 'ready'; turn: TTurn; entry: TEntry }> {
  const prepared = await prepareTurnWorktree(input.worktree)
  if (prepared.kind === 'rejected') return prepared

  const turn = input.buildTurn(prepared.executionCwd, input.extraDirs)
  const entry = await input.acquireRuntime(turn, prepared.kind === 'recovered')
  return { kind: 'ready', turn, entry }
}

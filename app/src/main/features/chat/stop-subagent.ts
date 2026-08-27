// 개별 background 작업 중단의 수명주기 (0204 D-005/D-006).
//
// 0143 은 클릭 즉시 합성 정착했다 — 사용자는 언제나 '중단됨' 을 봤고, 실제로 멈추지 못했을
// 때조차 그랬다. 명세 §2 가 그것을 뒤집는다: 클릭은 **요청**이고 확정은 SDK 가 준다.
//
//   요청 → (renderer '중단 중') → stopTask → task_notification(stopped) → 정착 → '중단됨'
//        ↘ 요청 실패(throw) → renderer '진행 중' 복구 + 사유
//        ↘ 확정 없음 → watchdog 이 합성 정착 → '중단됨' (고착 없음)
//
// app 컴포지션 루트가 아니라 여기 사는 이유: 이 흐름은 배선이 아니라 판정이고, IPC 없이
// 단위 테스트할 수 있어야 한다(`src/main/AGENTS.md §작업 규칙 1`).

import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type { GovernedLiveTurn } from '../../contracts/ports'

// 사용자 중단 클릭이 확정을 기다리는 최대 시간(ms). 짧으면 정상 확정을 앞질러 거짓 '중단됨'
// 을 만들고, 길면 '중단 중' 이 사실상 고착으로 보인다 — `[1_000, 60_000]` 안에 둔다.
export const STOP_SETTLE_TIMEOUT_MS = 15_000

// 이 흐름이 트래커에게 요구하는 최소 표면(구조적 포트 — 구현은 BackgroundTaskTracker).
export interface StopSubagentTracker {
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
  settled(sessionId: string, toolUseId: string): void
  waitForTask(
    sessionId: string,
    toolUseId: string,
    opts: { timeoutMs: number }
  ): Promise<'settled' | 'timeout'>
}

export interface StopSubagentDeps<W> {
  tracker: StopSubagentTracker
  // 합성 정착 — 호출부가 settleSubagentTask 를 emit 과 함께 묶어 넘긴다.
  settle: (turn: TurnContext<W>, ev: Extract<NormalizedEvent, { type: 'subagent.task' }>) => void
  // watchdog 발화 관측점(로깅). 테스트는 이것으로 발화를 확인한다.
  onWatchdog?: (info: { sessionId: string; toolUseId: string; timeoutMs: number }) => void
  timeoutMs?: number
}

/**
 * 개별 서브에이전트 중단 **요청**. `stopLiveSubagent`(대량 정착용)와 달리 실패를 삼키지
 * 않는다 — 사용자 클릭에는 "요청이 실패했다" 를 화면에 돌려줄 소비자가 있다(AC14).
 *
 * taskId 미상은 실패가 아니다: 아직 task_started 를 못 본 foreground 태스크이며, coordinator 가
 * taskId 도착 시 `stoppedSubagents` 를 보고 이어서 멈춘다.
 */
async function requestLiveSubagentStop(
  live: GovernedLiveTurn | null,
  toolUseId: string,
  taskId: string | undefined,
  alreadyBackground: boolean
): Promise<void> {
  if (!live) throw new Error('subagent-stop: session channel is not live')
  if (!alreadyBackground) await live.backgroundTask(toolUseId)
  if (taskId) await live.stopTask(taskId)
}

/**
 * 중단 요청 → 확정 대기 → (필요 시) watchdog 합성 정착.
 *
 * throw 하면 요청 자체가 실패한 것이다 — 호출부(IPC 핸들러)는 그대로 reject 해 renderer 가
 * '진행 중' 으로 복구하게 한다. 중단 표식(`stoppedSubagents`·`blockedSubagents`)도 되돌린다:
 * 되돌리지 않으면 계속 도는 태스크의 나중 정착이 'stopped' 로 강등된다.
 */
export async function stopSubagentTask<W>(
  turn: TurnContext<W>,
  req: { sessionId: string; toolUseId: string },
  deps: StopSubagentDeps<W>
): Promise<void> {
  const { toolUseId } = req
  const taskId = turn.subagentTaskIds.get(toolUseId)
  const subagentType = turn.subagentTypes.get(toolUseId)
  if (subagentType) turn.blockedSubagents.add(subagentType)
  turn.stoppedSubagents.add(toolUseId)
  const sessionId = turn.dbSessionId ?? req.sessionId
  // per-task background 관측(0143) — 정착이 관측까지 지우므로 **정착 전에** 읽는다.
  const alreadyBackground = deps.tracker.isAsyncLaunched(sessionId, toolUseId)

  try {
    await requestLiveSubagentStop(turn.live, toolUseId, taskId, alreadyBackground)
  } catch (err) {
    turn.stoppedSubagents.delete(toolUseId)
    if (subagentType) turn.blockedSubagents.delete(subagentType)
    throw err
  }

  const timeoutMs = deps.timeoutMs ?? STOP_SETTLE_TIMEOUT_MS
  const outcome = await deps.tracker.waitForTask(sessionId, toolUseId, { timeoutMs })
  if (outcome === 'settled') return

  deps.onWatchdog?.({ sessionId, toolUseId, timeoutMs })
  deps.tracker.settled(sessionId, toolUseId)
  // 사용자 자기 행위의 통지는 소음(0143) — background 플래그를 싣지 않아 subagent_notice 미생성.
  deps.settle(turn, {
    type: 'subagent.task',
    sessionId,
    toolUseId,
    phase: 'settled',
    status: 'stopped'
  })
}

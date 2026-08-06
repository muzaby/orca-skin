// 턴 중단 영수증 화해(0151 AC11, 순수) — `Query.interrupt()` 가 돌려주는 `still_queued` 를
// "우리가 예약한 것" 과 대조해 Stop 이후 실제로 살아남은 명령을 가린다.
//
// **왜 교집합인가.** SDK JSDoc(`sdk.d.ts:3487`)이 명시한다 — 목록에는 *"internally-enqueued
// uuids the client never sent (cron triggers, auto-resume continuations)"* 가 섞이며,
// *"ignore unknown uuids rather than treating them as an error"* 다. Orca 는 백그라운드
// 서브에이전트가 기본이라(0143) 완료 알림이 CLI 내부 큐 주입 → auto-resume continuation 으로
// 새 턴을 연다. 즉 **모르는 uuid 는 정상이며, 그것을 잔여로 오인해 런타임을 폐기하면 백그라운드
// 완료 통지가 죽는다.**
//
// 공개 SDK 로는 살아남은 명령을 취소할 수단이 없다(`cancel_async_message` 는 `Query` 메서드가
// 아니고, `interrupt()` 는 인자가 없어 `cancel_queued:true` 도 못 보낸다). 그래서 이 함수는
// **판정만** 하고 처분(런타임 폐기 여부)은 호출자·제품 정책에 맡긴다.

import type { InterruptReceipt } from '../../adapters/turn'

type InterruptOutcome =
  // 영수증 미보유 — CLI 가 `interrupt_receipt_v1` capability 를 알리지 않는 구형. 잔여 **미상**
  // 이며 "없음" 이 아니다. 보수적으로 아무것도 폐기하지 않는다.
  | { kind: 'unknown' }
  // 영수증은 왔고, 우리 예약 중 살아남은 것이 없다. (모르는 uuid 는 있을 수 있다 — 우리 소관 아님.)
  | { kind: 'clear' }
  // 우리 예약이 중단에서 살아남았다 — Stop 뒤에도 실행될 수 있다.
  | { kind: 'survived'; uuids: string[]; totalCount: number }

export function reconcileInterruptReceipt(
  receipt: InterruptReceipt | undefined,
  ourSubmitted: readonly string[]
): InterruptOutcome {
  if (!receipt) return { kind: 'unknown' }
  const ours = new Set(ourSubmitted)
  const uuids = receipt.stillQueued.filter((uuid) => ours.has(uuid))
  if (uuids.length === 0) return { kind: 'clear' }
  return { kind: 'survived', uuids, totalCount: receipt.stillQueued.length }
}

// 무회귀 배럴 — 순수 빌더 정본은 L1 lifecycle/subagent-settlement.ts (0052). 기존 import
// 경로(./subagent-settlement)를 깨지 않도록 re-export 만 둔다.
export type {
  OpenToolRunInfo,
  OpenToolRunEntries,
  SubagentSettlementInput
} from '../../lifecycle/subagent-settlement'
export {
  subagentParentResult,
  createSubagentSettlementEvents,
  coerceStoppedToolCompletion
} from '../../lifecycle/subagent-settlement'

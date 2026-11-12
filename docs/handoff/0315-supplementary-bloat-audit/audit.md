# 0315 보완 감사 — 0305가 X8·L6으로 판정하지 않은 6구간

> 기준 커밋 `c1af29f`. 계약 정본은 [plan.md](plan.md)다. 표는 [`data/audit.json`](data/audit.json)을 [`scan/check.mjs`](scan/check.mjs)가 렌더한 생성 블록이고 손으로 고치지 않는다.

## 진행표

| 단계 | 내용 | 상태 |
|---|---|---|
| P1 | 검사기 · UT · 단위 뼈대(136) | 완료 |
| P2 | A1·A2·A3 판정 (renderer) | 대기 |
| P3 | A4·A5·A6 판정 (main) | 대기 |
| P4 | 전제·조건 근거 · 문서 완성 | 대기 |

## 1. 중단 규칙에 넣을 값

verify가 통과 후보의 근거를 재현한 뒤 이 블록으로 판정한다(plan §10 EP-06 · D-015).

<!-- gen:ruling -->
| 축 | 값 | 근거 |
|---|---|---|
| 구현 건수 | 없음 | 통과 후보 P = 없음 |
| 넓은 감사 | 열지 않는다 | 핫패스 L6 통과 후보 없음 · 30줄 이상 통과 후보 없음 |
| 구현 묶음 | 없음 | 후보 0건 중 통과 0건 |

승인 목록(`remove` 유형 — 사용자 승인 뒤에만 제거한다):

| 후보 | 무엇을 지우는가 | 통과 여부 |
|---|---|---|
<!-- /gen:ruling -->

## 2. 구간 판정

<!-- gen:areas -->
| 구간 | 범위 | X1 | X2 | X3 | X4 | X5 | X6 | X7 | X8 | L1 | L5 | L6 | 판정 근거 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `chatReducer.ts` 961-1329 (369줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| A2 | `chatReducer.ts` 1454-1596 (143줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| A3 | `chatStore.ts` 349-380 · 470-644 · 698-1010 (520줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| A4 | `session-context.ts` 1-567 (567줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| A5 | `store.ts` 1-517 (517줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
| A6 | `map.ts` 1-1019 (1019줄) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) | (대기) |
<!-- /gen:areas -->

## 3. 후보

<!-- gen:candidates -->
| 후보 | 구간 | 렌즈 | 유형 | 되풀이되는 것 | 자리 | 보존 동작 | 남기는 구조 | 감량(prod) | 핫패스 | 통과 |
|---|---|---|---|---|---|---|---|---|---|---|
<!-- /gen:candidates -->

## 4. 전제 확인 · 조건

<!-- gen:premises -->
| 후보 | 경쟁 가드 | 형태 잠금 | AGENTS 채택 규칙 | UI | 성능 |
|---|---|---|---|---|---|
<!-- /gen:premises -->

## 5. 판정 단위별 L6

<!-- gen:units -->
| 구간 | 단위 | L6 | 근거 |
|---|---|---|---|
| A1 | `RECV_EVENT` | (대기) |  |
| A1 | `session.schedules` | (대기) |  |
| A1 | `session.updated` | (대기) |  |
| A1 | `worktree.preparing` | (대기) |  |
| A1 | `message.reasoning` | (대기) |  |
| A1 | `response.boundary` | (대기) |  |
| A1 | `output.captured` | (대기) |  |
| A1 | `message.completed` | (대기) |  |
| A1 | `tool.call.started` | (대기) |  |
| A1 | `tool.call.completed` | (대기) |  |
| A1 | `turn.retrying` | (대기) |  |
| A1 | `session.compacted` | (대기) |  |
| A1 | `telemetry` | (대기) |  |
| A1 | `permission.requested` | (대기) |  |
| A1 | `permission.resolved` | (대기) |  |
| A1 | `chat.activity` | (대기) |  |
| A1 | `subagent.task` | (대기) |  |
| A1 | `turn.ended` | (대기) |  |
| A1 | `turn.aborted` | (대기) |  |
| A1 | `error` | (대기) |  |
| A2 | `LOAD_SESSION` | (대기) |  |
| A3 | `dispatchTo` | (대기) |  |
| A3 | `patchEntry` | (대기) |  |
| A3 | `userBubbleText` | (대기) |  |
| A3 | `hasCommittedClientId` | (대기) |  |
| A3 | `isTerminalWithoutSession` | (대기) |  |
| A3 | `TURN_ACTIVITY_EVENTS` | (대기) |  |
| A3 | `shouldBeginTurn` | (대기) |  |
| A3 | `resolveSessionKey` | (대기) |  |
| A3 | `resolveApprovalOwner` | (대기) |  |
| A3 | `receiveDeltaBatch` | (대기) |  |
| A3 | `setState` | (대기) |  |
| A3 | `sendNewChatPayload` | (대기) |  |
| A3 | `releaseNewChatGate` | (대기) |  |
| A3 | `promotePendingNewChat` | (대기) |  |
| A3 | `receive` | (대기) |  |
| A3 | `message.completed` | (대기) |  |
| A3 | `message.reasoning` | (대기) |  |
| A3 | `turn.retrying` | (대기) |  |
| A3 | `subagent.task` | (대기) |  |
| A3 | `message.queued` | (대기) |  |
| A3 | `message.committed` | (대기) |  |
| A3 | `chat.activity` | (대기) |  |
| A3 | `session.schedules` | (대기) |  |
| A3 | `message.submitted` | (대기) |  |
| A3 | `message.cancelled` | (대기) |  |
| A3 | `telemetry` | (대기) |  |
| A3 | `turn.ended` | (대기) |  |
| A3 | `permission.requested` | (대기) |  |
| A3 | `turn.aborted` | (대기) |  |
| A3 | `error` | (대기) |  |
| A3 | `session.updated` | (대기) |  |
| A3 | `coalescer` | (대기) |  |
| A3 | `ingestChatEvent` | (대기) |  |
| A4 | `choices` | (대기) |  |
| A4 | `callerClient` | (대기) |  |
| A4 | `release` | (대기) |  |
| A4 | `events` | (대기) |  |
| A4 | `prepare` | (대기) |  |
| A4 | `commands` | (대기) |  |
| A4 | `agents` | (대기) |  |
| A4 | `models` | (대기) |  |
| A4 | `mcp` | (대기) |  |
| A4 | `plugins` | (대기) |  |
| A4 | `rememberCommands` | (대기) |  |
| A4 | `directory` | (대기) |  |
| A4 | `signal` | (대기) |  |
| A4 | `ready` | (대기) |  |
| A4 | `offer` | (대기) |  |
| A4 | `connectEvents` | (대기) |  |
| A4 | `startEvents` | (대기) |  |
| A4 | `fail` | (대기) |  |
| A4 | `resourceActivityChanged` | (대기) |  |
| A4 | `reconcileConnections` | (대기) |  |
| A4 | `close` | (대기) |  |
| A4 | `configureResourceActivity` | (대기) |  |
| A4 | `acquire` | (대기) |  |
| A4 | `finish` | (대기) |  |
| A4 | `retireAll` | (대기) |  |
| A5 | `vaultKeysOf` | (대기) |  |
| A5 | `load` | (대기) |  |
| A5 | `save` | (대기) |  |
| A5 | `createMemoryGrantPersistence` | (대기) |  |
| A5 | `restore` | (대기) |  |
| A5 | `entry` | (대기) |  |
| A5 | `records` | (대기) |  |
| A5 | `credentialRevision` | (대기) |  |
| A5 | `isVerified` | (대기) |  |
| A5 | `markVerified` | (대기) |  |
| A5 | `get` | (대기) |  |
| A5 | `put` | (대기) |  |
| A5 | `revoke` | (대기) |  |
| A5 | `deleteVaultKeys` | (대기) |  |
| A5 | `status` | (대기) |  |
| A5 | `markExpired` | (대기) |  |
| A5 | `settleExpired` | (대기) |  |
| A5 | `settleExpiry` | (대기) |  |
| A5 | `authKind` | (대기) |  |
| A5 | `isCurrentGrant` | (대기) |  |
| A5 | `isCurrentUnexpiredGrant` | (대기) |  |
| A5 | `refreshTokenSecret` | (대기) |  |
| A5 | `secret` | (대기) |  |
| A5 | `flush` | (대기) |  |
| A5 | `persist` | (대기) |  |
| A6 | `receivedOrigin` | (대기) |  |
| A6 | `RETRACTION_MEMORY_LIMIT` | (대기) |  |
| A6 | `retractedToolRuns` | (대기) |  |
| A6 | `rememberToolRuns` | (대기) |  |
| A6 | `accrueSubagentMeta` | (대기) |  |
| A6 | `mapTaskSystem` | (대기) |  |
| A6 | `num` | (대기) |  |
| A6 | `assignNums` | (대기) |  |
| A6 | `usageSnapshot` | (대기) |  |
| A6 | `readParentToolRunId` | (대기) |  |
| A6 | `hasSingleToolResult` | (대기) |  |
| A6 | `applyPendingScheduleReceipt` | (대기) |  |
| A6 | `asyncLaunchReceipt` | (대기) |  |
| A6 | `asStringList` | (대기) |  |
| A6 | `mapTaskUpdated` | (대기) |  |
| A6 | `claudeToNormalized` | (대기) |  |
| A6 | `input.echo` | (대기) |  |
| A6 | `input.received` | (대기) |  |
| A6 | `message.completed` | (대기) |  |
| A6 | `message.reasoning` | (대기) |  |
| A6 | `tool.call.started` | (대기) |  |
| A6 | `tool.call.completed` | (대기) |  |
| A6 | `session.compacted` | (대기) |  |
| A6 | `mapClaudeMessage` | (대기) |  |
| A6 | `system` | (대기) |  |
| A6 | `stream_event` | (대기) |  |
| A6 | `assistant` | (대기) |  |
| A6 | `user` | (대기) |  |
| A6 | `result` | (대기) |  |
| A6 | `overrideContext` | (대기) |  |
| A6 | `normalizeResultTelemetry` | (대기) |  |
| A6 | `applyCumulativeUsageDelta` | (대기) |  |
<!-- /gen:units -->

## 재현

```sh
node docs/handoff/0315-supplementary-bloat-audit/scan/check.mjs --check    # 검사
node docs/handoff/0315-supplementary-bloat-audit/scan/check.mjs --ruling   # 중단 규칙 입력값
node --test docs/handoff/0315-supplementary-bloat-audit/scan/*.test.mjs    # 검사기 UT
```

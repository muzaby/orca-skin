# Plan — 0044-subagent-meta-stop

## 메타

| 항목 | 값 |
|---|---|
| slug | `0044-subagent-meta-stop` |
| 작성자 | Claude Code |
| 일자 | 2026-06-24 |
| 매핑 | 0043 후속 — 실환경 피드백(모델/답변/시간/중단) |
| 상태 | impl/IMPL_DONE |
| 구현 주체 | **Claude** (SDK 통합 — task_* 이벤트 소비 + stopTask) |

## Context (왜)

0043 구현이 실환경에서 4가지 어긋남 + 중단 미구현. 근본 원인:
1. **모델이 'Explore'(subagent_type)로 표시** — 모델 소스가 없어 fallback. 실제 모델은 child assistant `message.model`.
2. **서브에이전트 답변 미표시(도구만)** — SDK 가 기본적으로 서브에이전트 text/thinking 을 forward 안 함 → `forwardSubagentText: true` 필요.
3. **개별 시간 추적 안 됨** — claude-map 이 SDK `task_*` 시스템 이벤트를 버림(claude-map.ts:260 "Phase 3 미사용"). 이 이벤트가 개별 `duration_ms`·`tool_uses`·`last_tool_name`·`task_id` 제공.
4. **중단 버튼** — 우측 백그라운드 리스트 '대화록 보기' 우측(네모·라운드·채움없음).
5. **중단 구현** — `query().stopTask(taskId)`.

사용자 확정: SDK `task_*` 이벤트 정식 구현 + 5건 모두 한 라운드.

## SDK 사실 (0.3.143)
- `Options.forwardSubagentText?: boolean`, `SDKAssistantMessage.message.model`.
- `SDKTaskStartedMessage`/`SDKTaskProgressMessage`/`SDKTaskNotificationMessage`: `task_id`·`tool_use_id?`·`subagent_type?`·`usage{duration_ms,tool_uses}`·`last_tool_name?`·`status`.
- `Query.stopTask(taskId)`·`Query.backgroundTasks(toolUseId?)`.

## 인수 기준 (Acceptance Criteria)
1. **모델 캡처**: claude-map 이 child assistant `message.model` 을 `subagent.task(progress).model` 로 emit + ctx 누산. 행/카드가 'Explore' 대신 모델(예: Haiku 4.5) 표시.
2. **모델 라벨 매핑**: `modelDisplayLabel` 이 model id → 'Haiku 4.5'/'Sonnet 4.5'/'Opus 4.1'/'Fable 5', 미인식 원형.
3. **답변 캡처**: `forwardSubagentText: true` 추가 → child text 가 message.completed(parentToolRunId) 로 와 우측 상세에 답변 렌더(0043 경로 재사용).
4. **task_* 소비**: claude-map 이 `task_started/progress/notification` → `subagent.task` NormalizedEvent. `tool_use_id` 없거나 `skip_transcript` 면 드롭.
5. **라이브 시간/도구**: store transient `subagentMeta`(toolUseId 키)로 흡수 → AgentTaskRow 가 단일·그룹 진행 중 모두 경과시간 표시(단일은 `모델 · 현재도구 · 도구수 + 경과`), 현재 도구·도구수 라이브 갱신.
6. **영속/재로드**: 부모 Task `tool.call.completed.subagentMeta`(model/duration/toolUses)로 영속 → 재로드 후 카드/행 복원(`subagentTasksFromMessages` 가 subagentMeta 우선).
7. **중단 버튼**: 우측 리스트 running 카드 '대화록 보기' 우측 네모·라운드·채움없음(`stop` 아이콘). 카드 열기와 버블 분리(stopPropagation). 카드는 `<button>`→`<div role>` 재구성(중첩 버튼 불가).
8. **중단 구현**: `orca:chat:stopSubagent`(sessionId,toolUseId) → main 이 toolUseId→task_id 로 `live.stopTask`(실패 시 `backgroundTask`+재시도). turn 전체 아니라 해당 Task 만.
9. **무회귀·게이트**: lint/typecheck/test(환경 가능분) green, 레이어 경계 0.

## 구현 요약 (파일)
- **shared**: `ipc.ts`(`chatStopSubagent` 채널·`subagent.task` 이벤트·`tool.call.completed.subagentMeta`·`tool_result.subagentMeta`·`SubagentTaskMeta`), `protocol.ts`(`StopSubagentSchema`).
- **adapters**: `claude.ts`(`forwardSubagentText:true` + `stopTask`/`backgroundTask` 위임), `claude-map.ts`(task_* → subagent.task + child model 캡처 + ctx 누산 + 부모 tool_result enrich), `types.ts`(`LiveTurn.stopTask/backgroundTask`), `mock.ts`(no-op stop).
- **ipc/chat**: `turn-registry.ts`(`subagentTaskIds`), `send.ts`(subagent.task→taskId 기록 + `chatStopSubagent` 핸들러), `persist.ts`(tool_result.subagentMeta 영속).
- **renderer**: `store/chatStore.ts`(transient `subagentMeta` + `subagent.task` 처리 + `useSubagentMeta` + `stopSubagent` 액션), `reducer/chatReducer.ts`(`ToolCall.result.subagentMeta`), `lib/parts.ts`(`modelDisplayLabel`·`agentModelFromCall`·`subagentTypeFromCall`·subagentMeta 우선), `components/transcript/AgentTaskRow.tsx`(라이브 메타 병합·단일 경과시간), `components/rightpanel/SubAgentTileContent.tsx`(카드 재구성+중단 버튼), `shared/ui/Icon.tsx`(`stop`), `shared/api/ipc.ts`+preload(`stopSubagent`).
- **mock/문서/테스트**: `mock-scenarios.ts`(subagent.task 라이프사이클+모델+subagentMeta, running 진행 시연), `IPC_CONTRACT.md`(채널 49→50·subagent.task·subagentMeta), `claude-map.test.ts`/`parts.test.ts`/`mock-scenarios.test.ts`/`chatStore.test.ts`.

## 게이트 결과
- `npm run typecheck` ✅ / `npm run lint` ✅ / `npm test` 478 passed(+신규). 잔여 12 fail(3파일 `db/queries`·`persist`·`send.runtime-resilience`)은 better-sqlite3 ABI + electron 바이너리 미설치(네트워크 차단) 환경 제한 — base 동일·변경 무관.

## 사람(실환경) 검증 대기
- `forwardSubagentText` 실제 child 답변 캡처.
- `task_*` 라이브 메타(모델·시간·현재도구·도구수) 실제 표시.
- `stopTask` 실제 중단 — foreground 직접 stop 가능 여부 / `backgroundTasks` fallback 필요 여부(SDK 동작 차이).
- UI 시각 검증: Debug `subagent_task_running`/`_multi`/`_child`.

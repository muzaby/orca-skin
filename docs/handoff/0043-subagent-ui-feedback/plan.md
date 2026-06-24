# Plan — 0043-subagent-ui-feedback

## 메타

| 항목 | 값 |
|---|---|
| slug | `0043-subagent-ui-feedback` |
| 작성자 | Claude Code |
| 일자 | 2026-06-24 |
| 매핑 | 0042 후속 — 사용자 스크린샷 피드백 반영 |
| 상태 | impl/IMPL_DONE |
| 구현 주체 | **Claude** (피드백 보정 — 백엔드 텍스트 캡처 + 렌더러 양식) |

## Context (왜)

0042 가 서브에이전트(Task) transcript/우측 패널/child 트랜스크립트를 구현(`47b…`, `431bc5d`)한 뒤, 사용자가 첨부한 3개 스크린샷 + 피드백으로 양식 보정을 요청했다. 현 구현과의 격차:

- **메인 transcript**: 서브에이전트 그룹/카드가 일반 도구처럼 `실행 중 <대화 타이틀>` 로만 렌더. 요구 양식 = 그룹 헤드 `실행 중 에이전트 N개`, 개별/단일 항목 `에이전트 실행 중 <모델> …`.
- **서브에이전트 transcript(우측 상세)**: 메시지 버블 간격이 메인보다 좁고, '완료됨' 일 때 서브에이전트 답변/완료 텍스트가 출력되지 않음.

### 사용자 확정 결정 (AskUserQuestion + 후속)

1. **작업 중단 버튼** = **배치 취소**(요청 철회). 백그라운드 패널 카드 현 구조 유지.
2. **라이브 메타(경과시간/현재도구)** = 메인 턴 시간추적(StatusLine 1초 틱) **메커니즘 재사용**. 단 앵커는 도구별로 필요 → 행이 처음 진행 중으로 나타난 시각을 렌더러 로컬에 기록(reducer/part/IPC 비오염).
3. **완료 답변 소스** = **실제 서브에이전트 텍스트 캡처(백엔드)**. claude-map 이 `parent_tool_use_id` 가진 assistant 텍스트(`message.completed`)를 child 로 라우팅.

## 인수 기준 (Acceptance Criteria)

1. **그룹 헤드(진행 중)**: 서브에이전트 Task 그룹이 진행 중이면 헤더가 `실행 중 에이전트 N개`(N=진행 중 에이전트 수). 완료는 기존 segment 요약(`실행됨 에이전트 N개`) 유지.
2. **그룹 내 개별 항목(진행 중)**: `에이전트 실행 중 <model> <title> <elapsed>` 양식.
3. **단일 항목(진행 중)**: `에이전트 실행 중 <model> · <현재 child 도구> · <child 도구수>` 양식.
4. **모델 라벨**: 진행 중·완료 모두 `<model>`(예: Haiku 4.5) 표시. `agentLabelFromCall`(input/result `agentLabel`) 재사용 + mock Task `args.agentLabel` 제공.
5. **경과시간 라이브**: 진행 중 항목의 elapsed 가 1초 틱으로 갱신(StatusLine 과 동일 `useElapsed`/`formatElapsed` 공유 훅).
6. **백엔드 child 텍스트 캡처**: `claude-map` 이 `message.completed` 에 `parentToolRunId` 전파 → text `AppMessagePart` 에 보존(persist/복원), 메인 트랜스크립트/preview 제외, child 트랜스크립트에만 포함.
7. **서브에이전트 상세 간격**: 프롬프트↔답변 간격이 메인 transcript 양식(`--chat-turn-gap`)을 따름.
8. **완료 답변 출력**: '완료됨' 서브에이전트의 답변 텍스트가 상세 child 트랜스크립트에 출력(child text 없으면 Task result summary 폴백).
9. **무회귀·게이트**: 서브에이전트 없는 턴 무변경. lint/typecheck/test(환경 가능분) green + 레이어 경계 0.

## 설계 / 구현 요약

### Part A — 백엔드 텍스트 캡처
- `shared/ipc.ts`: `message.completed` NormalizedEvent + `text`/`reasoning` AppMessagePart 에 optional `parentToolRunId`.
- `adapters/claude-map.ts`: assistant text → `message.completed` 에 `parentToolRunId` 부착(기존 계산값 재사용).
- `ipc/chat/persist.ts`: `message.completed` 에 `parentToolRunId` 보존, **child 텍스트는 assistantText/세션 preview 누적 제외**(메인 오염 방지). 복원은 `partFromRow` payload spread 로 자동.
- `store/chatStore.ts`: child `message.completed` 는 메인 `live.text` 를 비우지 않음.
- `reducer/chatReducer.ts`: `message.completed` 의 `parentToolRunId` 를 text 파트로 전파.
- `lib/parts.ts`: `partsText`/`partsReasoning`/`messageSegments` 가 `parentToolRunId` 가진 text/reasoning 을 메인에서 제외. `childMessageForParentToolRunId` 가 child 의 text/reasoning 까지 수집(타입안전 `stripParentToolRunId`). `subagentTasksFromMessages` 에 `currentChildLabel`(진행 중 child 도구명) 파생.

### Part B — 렌더러 양식
- 신규 `transcript/AgentTaskRow.tsx`: Task 전용 행. store(messages) 구독 → child 메타(모델·현재 도구·도구수)·로컬 시작시각 앵커 + `useElapsed` 로 경과시간. 진행 중/완료/중지/실패 접두 + 그룹/단일 포맷 분기. ToolCard 가 agent_task 일 때 위임(early return).
- `transcript/ToolGroup.tsx`: pending 이 agent Task 면 헤더 `실행 중 에이전트 N개`.
- `shared/ui/elapsed.ts`(신규): `formatElapsed` + `useElapsed(startedAt)` 공유 훅. StatusLine 이 중복 로직 제거하고 재사용.
- `rightpanel/SubAgentTileContent.tsx`: 상세 컨테이너 `gap-[var(--chat-turn-gap)]`(프롬프트↔답변 메인 간격) + child text 없을 때 Task result summary 폴백 답변.

### Mock / Debug
- `adapters/mock-scenarios.ts`: 모든 subagent Task `args.agentLabel` 추가 + child `message.completed`(답변 텍스트) 스텝 추가. `subagent_task_multi` 를 동시 실행으로 재구성(그룹 헤더 관찰). 신규 `subagent_task_running`(단일 Task + child Bash 진행 유지 → 단일 항목 메타·경과시간 관찰).
- `shared/ipc.ts` `MOCK_SCENARIO_IDS` + `debug/DebugPanel.tsx` 라벨에 `subagent_task_running` 추가.

### 문서
- `docs/IPC_CONTRACT.md`: `message.completed` `parentToolRunId` 행 + `MockScenarioId` 12→13 갱신.

## 영향 받는 파일
- 백엔드/공유: `app/src/shared/ipc.ts`, `app/src/main/adapters/claude-map.ts`, `app/src/main/ipc/chat/persist.ts`
- 렌더러: `app/src/renderer/src/features/chat/store/chatStore.ts`, `.../reducer/chatReducer.ts`, `.../lib/parts.ts`, `.../components/transcript/{AgentTaskRow,ToolCard,ToolGroup}.tsx`, `.../components/rightpanel/SubAgentTileContent.tsx`, `.../shared/ui/{elapsed.ts,StatusLine.tsx}`, `.../features/debug/components/DebugPanel.tsx`
- mock/문서/테스트: `app/src/main/adapters/mock-scenarios.ts`, `docs/IPC_CONTRACT.md`, `claude-map.test.ts`/`mock-scenarios.test.ts`/`parts.test.ts`

## 게이트 결과

| 게이트 | 결과 |
|---|---|
| `npm run typecheck` (node+web+test) | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 471 passed / 1 added. 잔여 12 fail(3 files: `db/queries.test.ts`·`persist.test.ts`·`send.runtime-resilience.test.ts`)는 **환경 제한**(better-sqlite3 Node ABI + electron 바이너리 미설치, 네트워크 차단) — base 브랜치에서도 동일 실패(변경 무관, 0019 계열). |

## 사람 확인 대기
- UI 시각 검증: `npm run dev` → Debug 패널에서 `subagent_task_running`/`subagent_task_multi`/`subagent_task_child` 실행.
  - 그룹 헤드 `실행 중 에이전트 N개`, 그룹 항목 `에이전트 실행 중 Haiku 4.5 <타이틀> <경과>`, 단일 `에이전트 실행 중 Haiku 4.5 · Bash · N`.
  - 서브에이전트 상세 프롬프트↔답변 간격 = 메인 transcript, '완료됨' 답변 텍스트 출력.
- 실환경 서브에이전트 턴에서 `parent_tool_use_id` 텍스트 캡처 확인.

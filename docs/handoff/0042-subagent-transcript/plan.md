# Plan — 0042-subagent-transcript

## 메타

| 항목 | 값 |
|---|---|
| slug | `0042-subagent-transcript` |
| 작성자 | Claude Code |
| 일자 | 2026-06-23 |
| 매핑 | PHASES 행(서브에이전트 표면) / PR (구현 후) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Codex** (기능 구현 — 백엔드 데이터모델 + 렌더러) |

## Context (왜)

사용자가 첨부한 스크린샷(이미지 6~8)은 **서브에이전트(Task 도구) 호출의 UI 양식**을 Claude Code 웹 UI 기준으로 요구한다:

- **이미지 6**: 서브에이전트 호출 시 transcript 에 카드 UI 표시 + 서브에이전트 도구 그룹에서 항목을 펼치면 **우측 패널에 그 서브에이전트의 대화록(트랜스크립트) 출력** — main transcript 와 동일 구성.
- **이미지 7**: 서브에이전트 호출이 **중단(中止)** 됐을 때 transcript 카드 UI 표시.
- **이미지 8**: 우측 패널에서 **뒤로 이동** 시 서브에이전트 활동을 카드 목록으로 표시, 카드 선택 시 그 대화록 열람.

**구조적 공백**: 현재 Task 도구는 일반 도구처럼 `used` 동사로만 렌더되고(`toolMeta.ts`), 우측 `subagent` 타일은 플레이스홀더(`SubAgentTileContent.tsx` = "아직 서브 에이전트 출력이 없습니다")다. **결정적으로, `adapters/claude-map.ts` 가 SDK 메시지의 `parent_tool_use_id` 를 읽지 않아 서브에이전트 내부 도구호출이 부모 Task 와 연결되지 않는다** — 중첩 트랜스크립트가 데이터로 존재하지 않는다. 따라서 이미지 6/8 의 "우측 패널 = 서브에이전트 자체 트랜스크립트"는 **백엔드 데이터모델 변경이 선행돼야** 실제 데이터로 구현된다. 본 핸드오프는 백엔드(Part A) + 렌더러(Part B)를 함께 다룬다.

> 사용자 확정: 백엔드 캡처 포함. 구현 주체 = Codex.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

### Part A — 백엔드 (데이터모델)
1. **부모연결 캡처**: `claude-map.ts` 가 SDK assistant/user 메시지의 `parent_tool_use_id` 를 읽어 `tool.call.started`/`tool.call.completed` `NormalizedEvent` 에 부모 식별자(예: `parentToolRunId`)를 실어 보낸다. 부모가 없으면(최상위 턴) 필드는 생략/`undefined`.
2. **AppMessagePart 전파**: `tool_call`/`tool_result` `AppMessagePart` 에 동일 부모 식별자 필드가 추가되어 DB persist·세션 복원까지 보존된다(무회귀 — 기존 평면 트랜스크립트는 필드 부재로 동일 렌더).
3. **reducer child 분기**: `chatReducer` 가 부모 식별자를 가진 도구호출을 **부모 Task `toolRunId` 로 키잉된 child 트랜스크립트**로 분기·집계한다(부모 Task 의 `ToolCall` 에서 child 목록을 조회 가능). 메인 트랜스크립트에는 child 가 평면 혼입되지 않는다.
4. **IPC_CONTRACT 동기화**: `NormalizedEvent` variant 와 AppMessagePart 변경이 `docs/IPC_CONTRACT.md`(§3·§6 절차)에 반영된다.
5. **단위테스트**: claude-map `parent_tool_use_id` 매핑 + reducer child 분기에 단위테스트가 동반된다.

### Part B — 렌더러 (UI)
6. **Task 호출 카드(이미지 6)**: Task 도구가 transcript 에서 전용 카드로 렌더된다(`toolMeta.ts` Task 카테고리/서술, `registry.ts` `agent_task` kind 등록). 진행 중/완료 상태가 구분된다.
7. **중단 카드(이미지 7)**: 서브에이전트 호출이 중단(`turn.aborted`/`incomplete`/도구결과 에러)된 경우 카드가 **중단 상태**로 시각 구분되어 표시된다.
8. **우측 패널 child 트랜스크립트(이미지 6)**: 서브에이전트 도구 그룹/카드에서 항목을 펼치면 우측 `subagent` 타일이 활성화(`chatStore.setRightPanelTileActive('subagent', true)`)되고, 해당 Task 의 child 트랜스크립트가 **메인 transcript 컴포넌트(`AssistantMessage`/`ToolGroup`/`ToolCard`)를 재사용**해 렌더된다.
9. **뒤로가기 카드 목록(이미지 8)**: 우측 패널 타일에서 뒤로 이동하면 서브에이전트 활동이 **카드 목록**으로 표시되고, 카드 선택 시 해당 child 트랜스크립트(상세)로 전환된다(타일 내부 리스트 ↔ 상세 2-뷰).
10. **무회귀·게이트**: 서브에이전트 없는 기존 턴은 시각/동작 무변경. 게이트(lint/typecheck/test) 통과 + 우측 패널 멀티컬럼/리사이즈(0034) 무회귀.

## 범위 / 비범위

- **범위**: Task 도구의 중첩 트랜스크립트 캡처(백엔드) + transcript 카드(호출/중단) + 우측 패널 child 트랜스크립트 렌더 + 뒤로가기 카드 목록↔상세.
- **비범위**:
  - 서브에이전트 **실시간 스트리밍 진척률** 세부(토큰/시간 라이브 게이지)는 기본 상태표시까지만(상세 게이지는 Future).
  - 중첩 깊이 2단 초과(서브에이전트 안의 서브에이전트) 일반화 — 1단(부모 Task → child)만. 다단은 데이터모델이 `parentToolRunId` 체인으로 확장 가능하나 본 범위 밖.
  - opencode 등 타 어댑터의 서브에이전트 매핑(seam 만 — claude 한정).
  - Ask UI 정제(→ 0041).

## 설계

### Part A — 백엔드 데이터모델

**A1. claude-map 캡처** (`app/src/main/adapters/claude-map.ts`)
- `parent_tool_use_id` 는 SDK 메시지 최상위에 존재(현 `adapters/streaming-input.ts:27` 가 outbound 로 사용). assistant(`tool_use`, 145~157행)·user(`tool_result`, 169~179행) 양 경로에서 메시지 객체의 `parent_tool_use_id` 를 좁혀 읽어 이벤트에 부가.
- `NormalizedEvent` 의 `tool.call.started`/`tool.call.completed`(`shared/ipc.ts:284·291 부근)에 optional `parentToolRunId?: string` 추가.

**A2. AppMessagePart 전파** (`app/src/shared/ipc.ts`)
- `tool_call`/`tool_result` part(`ipc.ts:666·669 부근)에 optional `parentToolRunId?: string` 추가. router persist 경로(`src/main/ipc/router.ts` + `db`)가 해당 필드를 보존(없으면 생략 — 마이그레이션은 컬럼 추가 또는 직렬화 페이로드 내 보존 중 **기존 패턴 따름**; merged 마이그레이션 수정 금지, 신규 파일만).

**A3. reducer child 분기** (`features/chat/reducer/chatReducer.ts`)
- `ToolCall`(25~30행)에 `children?: ToolCall[]`(또는 child 트랜스크립트 조회용 구조) 추가. tool_call/tool_result 페어링 시 `parentToolRunId` 가 있으면 부모 Task 의 `children` 으로 귀속, 없으면 기존 평면 경로.
- `parts.ts`/`messageSegments` 의 메인 트랜스크립트 세그먼트화는 child 를 제외(부모 Task 카드만 메인에 노출).

### Part B — 렌더러 UI

**B1. Task 카드 + 중단** (`features/chat/lib/toolMeta.ts`, `transcript/registry.ts`, 신규 `tool-bodies/AgentTaskBody.tsx`)
- `toolVerbCategory` 에 Task(`Task`·`Agent`·sub-agent 도구명) → 신규/전용 카테고리, `toolDescription` 에 Task `description`/`subagent_type` 서술. `registry.ts` 에 `agent_task` kind 등록(현재 seam — registry.ts 주석 21행).
- 중단(이미지 7): 부모 메시지 `incomplete`(`chatReducer.ts:38`) / 도구결과 `isError` / `turn.aborted` 를 카드 상태로 매핑해 "중단됨" 라벨·톤(`text-bad`/중립) 표시. `ToolCard`/`ToolGroup` 의 기존 pending/done/에러 분기(`ToolGroup.tsx:24~53`) 확장.

**B2. 우측 패널 child 트랜스크립트** (`features/chat/components/rightpanel/SubAgentTileContent.tsx` 교체)
- 플레이스홀더 → 선택된 Task 의 child `ToolCall[]`(+ child 텍스트/추론)을 **메인 transcript 컴포넌트 재사용**으로 렌더. `AssistantMessage`/`ToolGroup`/`ToolCard` 는 `features/chat` 내부라 동일 feature 재사용 가능(레이어 경계 OK). 선택 상태(어느 Task 인지)는 `chatStore` 또는 타일 prop 로 전달.
- 펼침→활성화: 도구 그룹/카드의 펼침 인터랙션에서 `chatStore.setRightPanelTileActive('subagent', true)` + 선택 Task id 세팅. (`chatStore.ts:463~469` 의 기존 타일 액션 재사용·필요 시 선택 id 액션 추가.)

**B3. 뒤로가기 리스트↔상세** (`SubAgentTileContent.tsx` + `RightPanelTile.tsx` 헤더)
- 타일 내부 2-뷰 상태: (리스트) 서브에이전트 활동을 카드 목록(이미지 8) — 각 카드 = Task 1개 요약(서술·도구 카운트·상태) ↔ (상세) 선택 Task child 트랜스크립트(B2). `RightPanelTile` 헤더(`rightpanel/RightPanelTile.tsx`)에 뒤로가기 네비 추가(상세→리스트). 헤더 액션은 기존 close/copy 패턴(0034·0036) 따름.

### 재사용 / 경계
- 우측 패널 렌더는 **메인 transcript 컴포넌트 재사용**(중복 구현 금지) — 이미지 6 "main transcript 구성과 동일" 요구 충족.
- 우측 패널 셸·레이아웃(`RightPanel`/`rightPanelLayout`/`tileRegistry`/`rightPanelTiles`, 0034)·`chatStore` 타일 액션 그대로 사용.
- 백엔드 변경은 main 레이어 DAG(L0 `shared/ipc` → L1 `db` → L2 `adapters` → L3 `ipc`) 하향 의존 유지(`app/src/main/AGENTS.md`). 구체 `parent_tool_use_id` 어휘는 `adapters/claude-map.ts`(L2) 안에만.
- 스타일은 시맨틱 토큰만, 신규 토큰 시 3 테마 스코프.

## 영향 받는 파일

**백엔드(Part A)**
- `app/src/main/adapters/claude-map.ts` (A1)
- `app/src/shared/ipc.ts` (A1·A2 — NormalizedEvent·AppMessagePart)
- `app/src/main/ipc/router.ts` + `app/src/main/db/**` (A2 persist; 신규 마이그레이션 필요 시 `NNNN_*.sql`)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` + `lib/parts.ts` (A3)
- `docs/IPC_CONTRACT.md` (A4)

**렌더러(Part B)**
- `app/src/renderer/src/features/chat/lib/toolMeta.ts` (B1)
- `app/src/renderer/src/features/chat/components/transcript/registry.ts` + 신규 `tool-bodies/AgentTaskBody.tsx` (B1)
- `app/src/renderer/src/features/chat/components/transcript/ToolGroup.tsx` · `ToolCard.tsx` (B1 중단 상태·펼침 활성화)
- `app/src/renderer/src/features/chat/components/rightpanel/SubAgentTileContent.tsx` (B2·B3)
- `app/src/renderer/src/features/chat/components/rightpanel/RightPanelTile.tsx` (B3 뒤로가기 헤더)
- `app/src/renderer/src/features/chat/store/chatStore.ts` (선택 Task id 액션, 필요 시)

**테스트**
- `app/src/main/adapters/claude-map.*.test.ts`(부모연결 매핑) · `features/chat/reducer/chatReducer.tool.test.ts`(child 분기)

## 참고 문서

- `docs/arch/backend/provider-runtime.md` (NormalizedEvent SSOT·정규화 계층)
- `docs/IPC_CONTRACT.md` (§3 NormalizedEvent variant · §6 변경 절차 — **반드시 동시 갱신**)
- `app/src/main/AGENTS.md` (main 레이어 DAG)
- 선행 핸드오프: `0034-multi-right-panels`(우측 패널 멀티타일/레이아웃)·`0033-runtime-resilience`(`turn.aborted`·`incomplete`)·`0008`(reconcileSegments memo)
- `app/AGENTS.md` §스타일링·§DB(마이그레이션 — merged 파일 수정 금지)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: claude-map `parent_tool_use_id` 매핑(어댑터 정규화) + reducer child 분기(reducer) 단위테스트. IPC 스키마 변경분 zod 검증 무회귀.

---

## [Codex 기입] 구현 체크리스트

- [ ] A1 claude-map `parent_tool_use_id` 캡처 → NormalizedEvent `parentToolRunId`
- [ ] A2 AppMessagePart `parentToolRunId` 전파 + persist 보존
- [ ] A3 reducer child 분기(부모 Task 키잉) + 메인 세그먼트 child 제외
- [ ] A4 IPC_CONTRACT §3·§6 동기화
- [ ] A5 claude-map · reducer 단위테스트
- [ ] B1 Task 전용 카드(`agent_task` kind) + 호출/완료/중단 상태
- [ ] B2 우측 패널 child 트랜스크립트(메인 컴포넌트 재사용) + 펼침→타일 활성화
- [ ] B3 뒤로가기 리스트↔상세(카드 목록 ↔ 대화록)
- [ ] B4 서브에이전트 없는 턴 무회귀 + 우측 패널(0034) 무회귀
- [ ] 게이트 lint/typecheck/test 통과

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (N passed) |
| IPC 채널 변경 | (NormalizedEvent/AppMessagePart 변경 요약) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

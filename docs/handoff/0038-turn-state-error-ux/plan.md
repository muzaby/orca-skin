# Plan — 0038-turn-state-error-ux

> 핸드오프 plan. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 작업은 *버그수정/UX*(비기능)이므로 Claude 가 plan → impl → verify 를 직접 수행한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0038-turn-state-error-ux` |
| 작성자 | Claude Code |
| 일자 | 2026-06-22 |
| 매핑 | PHASES "현재 작업 중" / PR (생성 시 기입) |
| 상태 | DRAFT → READY |
| 구현 주체 | Claude (비기능 직접 구현) |

## Context (왜)

검증 엔지니어가 채팅에서 5가지 문제를 보고했다. 근본 원인을 코드에서 직접 확인했다. "턴 종료 신호"의 빈틈, "에러 표면화"의 빈틈, 테마 토큰 오용, 그리고 세션 복원 시 모델 정보 누락에서 비롯된다.

렌더러는 진행중 표시(`inflight`)를 **`telemetry` · `error` · `turn.aborted`** 이벤트에서만 false 로 내린다(`app/src/renderer/src/features/chat/reducer/chatReducer.ts:261,305,315`). 이 종료 신호가 빠지는 경로가 두 군데(거부 후 무result 종료, API 400 무result 종료) 있어 UI 가 영구 in-progress 로 멈춘다.

| # | 증상 | 근본 원인 (파일:라인) |
|---|---|---|
| 1 | 도구 **거부/취소** 후에도 어시스턴트가 in-progress 로 유지 | 거부(`chatStore.ts:403` `denyTool`, `interrupt:false`)는 *의도대로* 턴을 계속시킨다(거부=에이전트 턴 지속, 취소=`turn.aborted`). 하지만 SDK 스트림이 `result`(→`telemetry`) 없이 끝나면 `send.ts:332-333` 루프가 종료 이벤트 없이 `return` → `inflight` 영구 true. |
| 2 | API **400** 발생해도 UI 가 계속 대기 | `claude-map.ts:185` 는 **`result` 메시지만** `telemetry` 로 매핑 → `result` 없이 스트림이 끝나면 종료 신호 없음. 또한 재시도(`send.ts:347-358`)가 **조용히** 진행돼 사용자는 "멈춘" 것으로 인지. |
| 3 | **쿨 테마** 에러 표시가 파란색 | 에러 UI 가 액센트 토큰 `--color-rust` 사용 → 쿨 테마가 이를 파랑 `#2563eb` 로 오버라이드(`styles/tokens.css:181`). 전용 에러 토큰 `--color-bad`(`#b54a3a`, 전 테마 빨강, `tokens.css:44`)는 미사용. |
| 4 | 디버그 mock 시나리오 부실 | 모든 도구/사용자요청 시나리오가 `closing()`(message.completed+telemetry)로 자동 완료(`mock-scenarios.ts:236-238`) → in-progress/거부 경로 재현 불가. `full` 은 `ask_question`·`plan_review` 를 누락해 "전체"가 아님. |
| 5 | 세션 복원 시 모델 라벨이 `<provider>` 로만 표시 | 세션은 `provider_key` 만 영속(`send.ts:230`)하고 **modelFamily 는 영속 안 함** → `LOAD_SESSION`(`chatReducer.ts:389`)이 `providerKey` 만 복원, `modelFamily=null`. Composer 초기화 effect(`Composer.tsx:132-135`)가 `providerKey` 있으면 early-return → 모델 미충전, `selectionLabel`(`modelSelection.ts:36`)이 model 없이 provider 만 렌더. |

**사용자 확정 결정** (질의 결과):
- #1: 거부=에이전트 턴 지속, 취소=`turn.aborted` 의미론은 **유지**(Claude Code 와 동일). 멈춤은 종료 이벤트 보장으로 해소.
- #2: 재시도는 유지하되 **재시도 진행을 UI 에 렌더**("재시도 N/M").
- #5: model 정보가 없으면 **default 모델을 자동 셋업**(영속/마이그레이션 대신 기본값 폴백).

## 인수 기준 (Acceptance Criteria)

1. 도구 승인 카드에서 **거부** 후, 에이전트가 추가 출력 없이 끝나도 in-progress 표시가 사라진다(폴백 종료 이벤트).
2. 도구 승인 카드 맥락에서 **취소**(턴 취소) 시 `turn.aborted` 로 즉시 종료된다(기존 동작 유지·회귀 없음).
3. API 400/스트림 조기종료 시 무한 대기 없이 종료되고, 재시도 중에는 "재시도 N/M" 가 보이며, 최종 실패 시 에러 배너가 뜬다.
4. SDK `result`(is_error 또는 비-success subtype)가 에러 배너로 표면화된다(빈 완료 금지).
5. 쿨 테마에서 ErrorCard · TurnErrorBanner · ToolCard/ToolGroup 에러 표시가 **빨강**(`--color-bad`)이다. classic/dark 도 빨강으로 일관.
6. mock `tool_calls` · `tool_approval`(allow/deny) · `ask_question` 시나리오가 in-progress 로 끝났다가 종료 이벤트 보장으로 정상 종료된다(거부 경로 포함 — 인수 1 의 회귀 가드).
7. mock `full` 이 text · reasoning · tool_calls · tool_approval · ask_question · plan_review 를 모두 거친 뒤 도구호출→에러점프(`tool.call.started` 직후 `tool.call.completed` 없이 `error`)로 끝난다.
8. 앱 재시작 후 기존 세션을 로드하면 모델 라벨이 `provider/모델`(provider 의 기본 모델)로 표시되고 `<provider>` 단독으로 끝나지 않는다.

## 범위 / 비범위

- **범위**: 턴 종료 신호 보장(main), 재시도 렌더링(이벤트+reducer+UI), result-error 표면화(map), 에러 토큰 교정(renderer 스타일), mock 시나리오 재설계(main), 세션 복원 모델 기본값 폴백(renderer). IPC_CONTRACT 동기화.
- **비범위**: 거부/취소 의미론 변경, modelFamily 의 DB 영속(마이그레이션), 4xx 비재시도 분류 변경, MAX_RETRIES 횟수 변경(현행 2 유지), `AskUserQuestionCard` 의 선택강조 rust(액센트로 유지).

## 설계

### #3 — 에러색 토큰 교정 (renderer 스타일, 독립)
에러 *표시* 컴포넌트의 `rust`/`rust-soft` → 시맨틱 에러 토큰 `bad` 로 교체. 신규 토큰 불필요 — Tailwind v4 opacity 수식어로 소프트 표면 생성(`tool-bodies/DiffBody.tsx` 의 `color-mix(in srgb, var(--color-bad) …)` 선례와 동형: `bg-bad/10`·`border-bad/40`).
- `features/chat/components/transcript/ErrorCard.tsx`: `border-rust/40`→`border-bad/40`, `bg-rust-soft`→`bg-bad/10`, `text-rust`(2곳)→`text-bad`.
- `features/chat/components/transcript/Exchange.tsx`(`TurnErrorBanner`, ~line 58): `border-rust bg-rust-soft`→`border-bad/40 bg-bad/10`.
- `features/chat/components/transcript/ToolCard.tsx`(~line 108,143): 에러상태 `text-rust`→`text-bad`.
- `features/chat/components/transcript/ToolGroup.tsx`(~line 46): `text-rust`→`text-bad`.
- 부수효과: classic/dark 에서도 에러색이 rust(#c96442)→bad(#b54a3a)로 미세 변경(둘 다 빨강, 의도된 일관화).

### #1+#2(a) — 턴 종료 이벤트 보장 (main)
- `app/src/main/ipc/chat/send.ts`: 이벤트 루프 중 `telemetry|error|turn.aborted` 수신 시 `sawTerminal=true` 기록. `for await` 정상 종료 후 `return`(~line 333) 직전에 `!sawTerminal && !controller.signal.aborted` 면 **폴백 `telemetry` 이벤트** emit → 렌더러 `inflight` 해제. (거부 후 무result 종료·400 무result 종료 모두 커버.) `turn.aborted` 는 cancel 핸들러가 이미 발행하므로 abort 가드로 이중 발행 방지.

### #1+#2(b) — 재시도 진행 렌더링 (이벤트 + reducer + UI)
- `app/src/shared/ipc.ts` `NormalizedEvent` 에 variant 추가:
  `{ type:'turn.retrying'; sessionId?:string; attempt:number; maxRetries:number; error:ClassifiedError }`.
- `send.ts`: 재시도 결정 직후(`abortableDelay` 전, ~line 353) `turn.retrying`{attempt:attempt+1, maxRetries:`MAX_RETRIES`, error} emit. (`MAX_RETRIES` 현행 2 유지 → "재시도 1/2…".)
- `app/src/main/ipc/chat/persist.ts`: `turn.retrying` 은 DB 영속 제외(no-op skip) 보장.
- `chatStore.ts` `receive()`: `turn.retrying` 라우팅 추가(sessionId 있으면 키, 없으면 활성 폴백 — `error` 케이스와 동형, `chatStore.ts:190-194` 참고).
- `chatReducer.ts`: `ChatState` 에 `retry?: { attempt:number; max:number }` 추가. `turn.retrying` → `inflight` 유지 + `retry` 세팅. **그 외 모든 RECV_EVENT 는 `retry` 클리어**(재시도 성공 시 배너 소거), `SEND_USER_MESSAGE`/`telemetry`/`error`/`turn.aborted`/`CANCEL_CHAT` 에서도 클리어.
- UI: `PendingAssistant.tsx` 에서 `useChatSession(s=>s.retry)` 구독해 "재시도 {attempt}/{max} · {errorCategoryLabel}" 소형 표시. 기존 `errorCategoryLabel`(`features/chat/lib/errorLabels.ts`) 재사용.

### #1+#2(c) — result-error 표면화 (map)
- `app/src/main/adapters/claude-map.ts`: `msg.type==='result'` 에서 `is_error===true` 또는 `subtype!=='success'` 면 `telemetry` 외에 **`error` 이벤트**도 방출(기존 `errorEvent`/`makeClassifiedError` 재사용, 기본 `stream_error`). → 400 등 API 실패가 빈 완료가 아니라 에러 배너로 표면화.

### #5 — 세션 복원 시 모델 기본값 자동 셋업 (renderer)
- `app/src/renderer/src/features/chat/components/Composer.tsx` 초기화 effect(~line 132-135) 확장: `providerKey` 가 **있어도 `modelFamily==null` 이면** 그 provider 의 기본 모델을 채운다.
  - `agents.find(a=>a.key===providerKey)` → `models.find(m=>m.isDefault) ?? models[0]` → `setModel(providerKey, modelKey(model), agent.adapter)`. `composer/modelSelection.ts` 의 `modelKey` 재사용.
  - `providerKey` 미설정(새 채팅) 분기는 기존 `defaultSelection` 유지. effect deps 에 `modelFamily` 추가.
  - `SET_MODEL` 가드(`chatReducer.ts:411`)는 `adapter===backend` 면 통과 — adapter 를 `agent.adapter` 로 넘겨 거부 회피.

### #4 — mock 시나리오 재설계 (main)
- `app/src/main/adapters/mock-scenarios.ts`: 각 시나리오 본문을 **프래그먼트 빌더**로 추출(prelude/closing 미포함): `textFragment()`·`reasoningFragment()`·`toolCallsFragment()`·`toolApprovalFragment()`·`askQuestionFragment()`·`planReviewFragment()`·`errorJumpFragment()`.
- **도구/사용자요청 시나리오는 `closing()` 제거 → in-progress 로 끝나게**: `tool_calls`·`tool_approval`(allow/deny 양쪽)·`ask_question` 은 상호작용 후 종료(closing 없음). send.ts (a) 종료보장이 폴백 telemetry 로 마무리 → in-progress→정상종료 전이를 실제 경로로 재현(거부 경로 #1 직접 검증).
- **`error` 시나리오**: 현행 유지(스트림 중 error 점프).
- **`full` 재구성** = prelude → text → reasoning → tool_calls → tool_approval → ask_question → plan_review → **에러점프**(`tool.call.started` 직후 `tool.call.completed` 없이 `error`). 드롭다운 전 항목을 한 턴에 순차 실행 + #4 "도구호출에서 안 기다리고 에러로 점프" 충족. `error` 가 터미널이므로 반드시 마지막.

### 재사용할 기존 함수·유틸·파일 경로
- `runtime-errors/classifier.ts` `makeClassifiedError`, `runtime-errors/claude-classifier.ts` `errorEvent` (result-error 분류/봉투).
- `features/chat/lib/errorLabels.ts` `errorCategoryLabel` (재시도 배너 라벨).
- `composer/modelSelection.ts` `modelKey`·`defaultSelection`·`selectionLabel`.
- `ipc/chat/send.ts` `MAX_RETRIES`·`abortableDelay`·`sendChatEvent`.
- 토큰: `styles/tokens.css` `--color-bad`(전 테마 상수), `tool-bodies/DiffBody.tsx` 의 `color-mix`/opacity 패턴.

### 레이어 경계 준수
- main: send/persist=L3 ipc, claude-map/mock-scenarios=L2 adapters, classifier=L1. 하향 의존만 — 신규 상위참조 없음.
- shared: `ipc.ts` NormalizedEvent variant 추가는 L0(순수 타입).
- renderer: chatReducer/chatStore=`features/chat`, Composer/transcript 컴포넌트=동일 feature 내부. cross-feature import 없음.

## 영향 받는 파일

- main: `app/src/main/ipc/chat/send.ts`, `app/src/main/ipc/chat/persist.ts`, `app/src/main/adapters/claude-map.ts`, `app/src/main/adapters/mock-scenarios.ts`
- shared: `app/src/shared/ipc.ts` (NormalizedEvent)
- renderer: `app/src/renderer/src/features/chat/reducer/chatReducer.ts`, `app/src/renderer/src/features/chat/store/chatStore.ts`, `app/src/renderer/src/features/chat/components/transcript/{ErrorCard,Exchange,ToolCard,ToolGroup,PendingAssistant}.tsx`, `app/src/renderer/src/features/chat/components/Composer.tsx`
- docs: `docs/handoff/0038-turn-state-error-ux/plan.md`(본 문서), `docs/handoff/INDEX.md`, `docs/IPC_CONTRACT.md`

## 참고 문서

- `docs/arch/backend/provider-runtime.md` (NormalizedEvent·ErrorClassifier·Telemetry 정본)
- `docs/IPC_CONTRACT.md` §3 NormalizedEvent variant — **`turn.retrying` 추가 + 카운트 동시 갱신**(§6 변경 절차)
- `docs/arch/frontend/state.md` (chatStore 멀티세션 라우팅 / reducer 불변식)
- `app/src/main/AGENTS.md`(main 레이어 DAG), `app/AGENTS.md`(스타일 토큰 규칙)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규/갱신 테스트:
  - `adapters/mock-scenarios.test.ts` — 신 프래그먼트/시나리오 형태, `full` 커버리지(7종 모두), 도구/사용자요청 시나리오의 closing 부재.
  - `adapters/claude-map.test.ts` — result(is_error/비-success) → error 이벤트 매핑.
  - reducer 테스트(`chatReducer.*.test.ts`) — `turn.retrying`→`retry` 세팅·`inflight` 유지·타 이벤트에서 `retry` 클리어.
  - (가능 시) send 종료보장 — 스트림이 terminal 없이 끝나면 폴백 telemetry 발행.

---

## [구현(Claude) 기입] 구현 체크리스트

- [ ] #3 에러 토큰 교정 (ErrorCard·Exchange·ToolCard·ToolGroup)
- [ ] #1+#2(a) send.ts 종료 이벤트 보장(`sawTerminal` + 폴백 telemetry)
- [ ] #1+#2(b) `turn.retrying` 이벤트(ipc.ts) + persist skip + chatStore 라우팅 + reducer `retry` + PendingAssistant 표시
- [ ] #1+#2(c) claude-map result-error → error 이벤트
- [ ] #5 Composer 모델 기본값 폴백
- [ ] #4 mock-scenarios 프래그먼트화 + 도구/사용자요청 in-progress 종료 + `full` 전체화
- [ ] IPC_CONTRACT §3 + 카운트 동기화
- [ ] 테스트 갱신·게이트 4종 통과

## [구현(Claude) 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (기입) |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | (기입) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

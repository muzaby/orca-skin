# Plan — 0040-new-chat-race-early-registration

> 새-채팅 전송 동시성 버그 해소(draftId 상관) + 첫 partial 시점 최근대화 등록/제목 생성. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0040-new-chat-race-early-registration` |
| 작성자 | Claude Code |
| 일자 | 2026-06-23 |
| 매핑 | PHASES "현재 작업 중" (보드 링크) / PR 미생성 |
| 상태 | DRAFT → READY |
| 구현 주체 | Codex |

## Context (왜)

사용자 요구 2건:

- **(R1) 메시지 전송 버튼 누른 순간 세션 화면 전환.**
- **(R2) partial message 도착하자마자** ① 최근 대화 등록(세션데이터/공간/메타데이터 할당이 있으면 complete 전 **pre-init** 으로 접근) ② **제목 작성 query 호출**.

### 사용자 확정 사항

1. **R1 의 실체 = 동시성 버그.** 일반 단일 전송은 이미 정상 전환된다(`/new` 에서 `messages>0` 이 되는 순간 `NewChatLandingPage` 가 `ChatTile` 로 자연 전환). 문제는 **"전송 → 새 대화 클릭 → 다시 전송"** 을 첫 `session.updated` 도착 전에 빠르게 했을 때다: 랜딩으로 돌아갔다 재전환되고, **2번째 세션이 최근대화에 기록되지 않고 소멸**, 남은 세션은 **첫 턴 사용자 메시지 버블이 사라진다**.
2. **R2 트리거 앵커 = `session.updated`(init)**. (1차 응답은 "첫 partial" 이었으나, "첫 이벤트가 partial 이 맞는가?" 재확인 후, 첫 이벤트는 `session.updated`(init)이고 sessionId·DB row 가 그 시점에 존재함을 반영해 init 으로 확정.)
3. **제목 생성 turn-end 안전망 유지** — 멱등 belt-and-suspenders.

### 근본 원인 (코드 확인 완료)

단일 슬롯 가정이 동시 새-채팅을 못 버틴다.

- **렌더러** `features/chat/store/chatStore.ts`: 새-채팅 슬롯이 `NEW_CHAT_KEY='__new__'` 단 1개. `newChat()` 는 이 슬롯을 `freshEntry()` 로 덮어쓰므로 **승격 전 메시지가 소실**된다. `promoteNewChat(sessionId)` 는 "현재 `NEW_CHAT_KEY` 엔트리"를 sessionId 로 re-key 하므로, 두 번째 새 채팅이 끼면 **엉뚱한(2번째) 엔트리가 1번째 sessionId 로 승격**된다.
- **메인** `ipc/chat/turn-registry.ts`: `pendingByOwner: Map<WebContents, InflightTurn>` — 창당 pending 슬롯 1개. `send.ts` 의 중복 가드 `turns.hasPending(sender)` 가 2번째 새-채팅 전송을 거부하거나, 타이밍에 따라 `promote(owner, …)` 가 슬롯을 오염시킨다.
- **상관 키 부재**: `session.updated` 이벤트가 `sessionId` 만 싣고 어느 새-채팅(draft)의 것인지 표시하지 않아, 렌더러가 올바른 엔트리를 골라 승격할 수 없다.

### 이벤트 순서 (확인 · `claude-map.ts`)

claude SDK `system/init` → **`session.updated`**(sessionId 발급; `persist.ts` 가 `insertSession` 으로 DB 세션 row + 대기 user 메시지 기록) → **`message.delta`**(partials; `includePartialMessages: true`) → `assistant`(`message.completed`/`tool.call.started`) → … → **`telemetry`**(턴 종료; `persist.ts` 가 `onTurnEnd(turn)` → `TitleGenerator.maybeStart`).

함의 (중요):
- **첫 이벤트는 partial 이 아니라 `session.updated`(init)** 이다. partial(`message.delta`)은 그 뒤에 온다.
- `message.delta` 는 **항상 보장되지 않는다** — 텍스트 없이 도구만 호출하는 턴, init 직후 에러 턴에는 없을 수 있다.
- **DB `insertSession` 은 이미 init 에서 pre-init** 된다. 반면 **사이드바 refresh·제목 생성은 turn-end** 라 늦다(사이드바=`useChatSessionsSync` 의 inflight true→false, 제목=`onTurnEnd`).

→ **사용자 확정**: 두 후속 작업(등록·제목)의 트리거 앵커는 **`session.updated`(init)** — 진짜 첫 이벤트이자 sessionId·DB row 가 존재하는 가장 이른 시점. (요구사항의 "partial 도착하자마자"는 "complete 를 기다리지 말고 가능한 한 일찍"의 의도이며, 실제 데이터 생성 지점인 init 으로 앵커링한다.)

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능 항목.

1. **동시 새-채팅 비소멸**: "전송 → 새 대화 → 전송"을 첫 `session.updated` 전에 수행해도 **두 세션 모두 최근 대화에 기록**되고 어느 것도 소멸하지 않는다.
2. **버블 보존**: 위 시나리오에서 각 세션의 **첫 턴 사용자 메시지 버블이 보존**된다(엉뚱한 엔트리 승격 없음).
3. **배경 승격 비간섭**: 사용자가 다음 새 채팅으로 이동한 상태에서 이전 draft 가 `session.updated` 로 승격되어도 **활성 세션의 `activeKey`/URL 을 가로채지 않는다**.
4. **상관 키 왕복**: 새-채팅 전송 payload 에 `draftId` 가 실리고, 그 턴의 `session.updated` 이벤트가 **같은 `draftId` 를 echo** 한다. `docs/IPC_CONTRACT.md` 가 동기화된다.
5. **init 등록**: `session.updated`(init) 시 **사이드바 최근 대화에 해당 세션이 등장**한다(턴 종료를 기다리지 않음).
6. **init 제목**: `session.updated`(init) 시 **제목 생성 query 가 발사**되어 스트리밍과 **병렬** 진행되고, 완료 시 기존 `sessionTitleEvent` 로 in-place 반영된다.
7. **멱등 + 안전망**: 제목 생성은 **턴당 1회**만 실행된다(`titleGenerationStarted` 멱등). turn-end 안전망 유지(belt-and-suspenders).
8. **회귀 0**: 일반 단일 새-채팅 및 이어가기(resume, `sessionId != null`) 경로의 동작이 바뀌지 않는다.
9. **게이트 + 테스트**: `cd app && npm run lint && npm run typecheck && npm test` 통과 + 신규 단위 테스트(아래 게이트 절).

## 범위 / 비범위

- **범위**: 새-채팅 동시성 상관(draftId) — L0 스키마/타입, 메인 turn-registry/send, 렌더러 chatStore; 첫-partial 트리거(제목 = 메인 내부, 등록 = 렌더러 셸 훅); `IPC_CONTRACT.md` 동기화; 단위 테스트.
- **비범위**:
  - 낙관적 **URL 선전환**(전송 즉시 `/chat/<임시>` 로 navigate). 현 전환(`messages>0`→`ChatTile`, init 시 URL 승격)으로 R1 의도 충족 — 라우트 임시키 도입은 하지 않는다.
  - 신규 IPC **채널** 추가(채널 수 불변 — `session.updated` variant 필드 추가만, `chat:send` payload 필드 추가만).
  - 제목 모델/프롬프트 변경(handoff 0004 그대로 재사용).
  - 세션 공간/워크스페이스 실제 선할당 신설(현재 그런 할당 없음 — 아래 pre-init 메모 참조).
  - opencode 등 타 어댑터 일반화.

## 설계

### Part A — 동시 새-채팅 상관(draftId)로 R1 해소

전송마다 클라이언트가 생성한 `draftId` 로 엔트리/턴을 식별해 단일 슬롯 충돌을 제거한다. 메인의 멀티세션 토대(handoff 0011/0013, `bySession` 키잉)와 정합하며, 새-채팅 pending 도 단일 슬롯에서 **draft 키 맵**으로 일반화한다.

**L0 shared** (`src/shared/`)

- `protocol.ts` `SendChatMessageSchema`: optional `draftId: z.string()` 추가(새-채팅 전송만 채움; resume 은 미포함). 재사용: 기존 zod 스키마에 필드 1개.
- `ipc.ts` `NormalizedEvent` 의 `session.updated` variant: optional `draftId?: string`(상관 echo). `chat:send` payload 타입에도 `draftId?` 반영.

**메인** (`src/main/ipc/chat/`)

- `turn-registry.ts`:
  - `pendingByOwner: Map<W, InflightTurn>` → `pendingByDraft: Map<string, InflightTurn>`.
  - `startNew(draftId, turn)` / `hasPendingDraft(draftId): boolean` / `promote(draftId, sessionId)` 로 시그니처 변경.
  - `InflightTurn` 에 `draftId: string` 추가. `owner`(W) 는 이벤트 타깃(cancel/abort `sendChatEvent`)용으로 **유지**.
  - `finish(turn)` 은 값 동일성 제거이므로 그대로(맵 이름만 변경).
  - 효과: **동시 새-채팅 pending 허용**(서로 다른 draftId).
- `send.ts`:
  - `parsed.data.draftId` 사용. 새-채팅 중복 가드를 `turns.hasPendingDraft(draftId)` 로(같은 draft 재전송만 거부; 서로 다른 새 채팅은 충돌하지 않음). `parsed.data.sessionId` 있으면 기존 `hasSession` 가드 유지.
  - `turns.startNew(draftId, turn)` (resume 은 `startResume` 유지).
  - 이벤트 루프에서 `ev.type === 'session.updated'` 시: **outbound 이벤트에 `turn.draftId` 를 주입한 사본**을 `sendChatEvent` 로 보내고(어댑터/`claude-map` 무변경 — 오케스트레이터가 augment), `turns.promote(turn.draftId, ev.sessionId)` 호출.
  - `InflightTurn` 생성부(`send.ts:220`)에 `draftId` 채움.

**렌더러** (`features/chat/store/chatStore.ts`)

- `send()`: `cur.sessionId == null`(= 새 채팅) 이면 `const draftId = crypto.randomUUID()` 생성 → 현재 `NEW_CHAT_KEY` 엔트리를 `draftId` 키로 re-key(엔트리 객체 동일성 보존 → 메시지/라이브 따라감), `activeKey = draftId`, `NEW_CHAT_KEY` 는 새 `freshEntry()` 로 재생성. `chatApi.send({ …, draftId })`. resume 경로는 draftId 미전달.
- `promoteNewChat` → `promoteDraft(draftId, sessionId)`: `receive(session.updated)` 에서 `ev.draftId` 의 엔트리를 sessionId 로 re-key. **`activeKey` 는 그 draft 가 현재 활성일 때만 추종**(배경 승격은 URL/activeKey 불변 → 사용자가 옮긴 새 채팅을 가로채지 않음, 인수 기준 3). 하위호환: `ev.draftId` 가 없거나 매칭 엔트리가 없으면 기존 `NEW_CHAT_KEY` 승격으로 폴백.
- `newChat()`: `NEW_CHAT_KEY` 빈 엔트리만 리셋 — **진행 중 draftId 엔트리는 건드리지 않는다**(소실 방지가 핵심).
- 라우팅 키 해석(`receive` 의 key 결정)은 draft 엔트리도 `activeKey` 폴백으로 자연 처리되며, 승격 후에는 sessionId 키로 라우팅된다.

`useChatRouteSync` 방향 2(armed-ref)는 무변경: 활성 세션의 sessionId 가 null→non-null 될 때만 navigate 하므로, 배경 draft 승격에는 발사되지 않는다.

### Part B — `session.updated`(init) 에 등록 + 제목 (R2)

> 트리거 앵커 = **`session.updated`(init)**. 첫 이벤트이자 sessionId·DB row 가 존재하는 가장 이른 시점이라, 첫-콘텐츠 감지/게이팅(`contentStarted`·`registered` 플래그)이 **불필요**해 설계가 단순해진다.

- **제목 생성 (메인 내부 · IPC 무변경)**: `router.ts:195` 에서 만든 `titles`(`TitleGenerator`) 를 `ChatDeps` 로 `registerChatHandlers` 에 주입한다. `send.ts` 이벤트 루프에서 `ev.type === 'session.updated'` 처리 시 — **`persistence.persist(turn, ev)` 가 `turn.dbSessionId` 세팅 + `insertSession` 을 끝낸 직후** — `titles.maybeStart(turn)` 를 호출한다. `dbSessionId`/`firstUserText` 모두 이 시점에 확보됨. `maybeStart` 는 `turn.titleGenerationStarted` 로 **멱등** → init·turn-end 양쪽에서 호출돼도 1회만 실행. 제목 query 가 스트리밍과 **병렬** 진행.
  - **turn-end 안전망 유지**: `persist.ts` 의 `onTurnEnd(turn)` → `maybeStart` 경로는 그대로 둔다(인수 기준 7). 새 세션은 init 에서 이미 시작되므로 이제 belt-and-suspenders(멱등 무해).
- **최근 대화 등록 (렌더러 · 신규 IPC 채널 0)**: `chatStore.receive()` 의 `session.updated`(promoteDraft) 경로에서 store 카운터 `recentsEpoch` 를 증가시킨다(세션당 1회 — 승격 시점, 전 세션/배경 턴 포함). 셸 훅 `app/src/renderer/src/app/hooks/useChatSessionsSync.ts` 가 `recentsEpoch` 변화를 구독해 `sessionsActions.refresh()` 를 호출한다(`features/chat` → `features/sessions` 직접 결합 금지 → **셸이 호스트**, 경계 준수). 기존 inflight false→refresh 는 완료 후 preview/정렬 동기화로 **유지**(중복 무해).
- **pre-init 메모**: 세션 DB row 는 이미 `session.updated`(init) 에서 `insertSession` 되어 pre-init 상태다. 현재 별도의 공간/워크스페이스 실제 할당은 turn-end 에 없다(`getWorkspacePath` 는 턴마다 순수 계산, handoff 0039). 따라서 본 작업의 "등록"은 **사이드바 가시화 + 제목**을 init 으로 앞당기는 것이다. 향후 세션별 공간/메타데이터 **실제 선할당**이 필요해지면, complete 를 기다리지 말고 동일하게 **init 시점에 pre-init** 하라.

### 레이어 경계

- L0 `shared` 스키마/타입 추가 → main·renderer 모두 하향 의존(OK).
- 메인: `turn-registry`·`send` 는 L3 ipc, `TitleGenerator` 주입은 컴포지션 루트(`router.ts`)에서 — 상위 참조 없음.
- 렌더러: cross-feature(chat→sessions) refresh 는 **셸 훅**(`app/`)이 호스트 — `features/chat` 가 `features/sessions` 를 직접 import 하지 않는다.

## 영향 받는 파일

- `app/src/shared/protocol.ts` — `SendChatMessageSchema.draftId?`
- `app/src/shared/ipc.ts` — `session.updated` variant `draftId?`, `chat:send` payload 타입
- `app/src/main/ipc/chat/turn-registry.ts` — `pendingByDraft` 맵 + draftId API + `InflightTurn.draftId`
- `app/src/main/ipc/chat/send.ts` — draftId 가드/시작/승격, session.updated draftId 주입, 첫-partial `titles.maybeStart`
- `app/src/main/ipc/router.ts` — `titles` 를 `ChatDeps` 로 주입
- `app/src/renderer/src/features/chat/store/chatStore.ts` — `send`/`promoteDraft`/`newChat`/`recentsEpoch`
- `app/src/renderer/src/app/hooks/useChatSessionsSync.ts` — `recentsEpoch` 구독 refresh
- `app/src/renderer/src/shared/api/ipc.ts` · `app/src/preload/index.ts` — `draftId` 전달 타입
- `docs/IPC_CONTRACT.md` — `chat:send` payload + `session.updated` `draftId` (§6 변경 절차 동시 갱신)

## 참고 문서

- `docs/IPC_CONTRACT.md` (§ chat send payload · §3 NormalizedEvent `session.updated`)
- `docs/arch/frontend/state.md §1.4` (멀티세션 외피 · `NEW_CHAT_KEY` 승격 · handoff 0013)
- `docs/handoff/0004-auto-session-title/` (제목 생성 seam `SessionAdapter.complete` · `sessionTitleEvent`)
- `docs/handoff/0011-main-decompose/`, `0013-renderer-multisession-store/` (세션 키잉 토대)
- `docs/TRD.md` §6 (세션/메시지 데이터 모델)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (better-sqlite3 Node ABI 재빌드 후 전체 green 확인).
- 신규 테스트 요구:
  - `turn-registry.test.ts` — 두 draftId 동시 pending → 각각 독립 promote(서로 오염 없음); 같은 draftId 재시작 가드.
  - send 스키마 — `SendChatMessageSchema` 가 `draftId` 를 수용/생략 모두 파싱.
  - 제목 멱등 — `session.updated` 다회/`onTurnEnd` 중복 호출에도 `maybeStart` 가 1회만(`titleGenerationStarted`).
  - (가능하면) store 순수 로직 — `promoteDraft` 가 비활성 draft 승격 시 `activeKey` 불변·`recentsEpoch` 증가, 활성 draft 승격 시 추종.

---

## [Codex 기입] 구현 체크리스트

- [ ] L0: `protocol.ts` `draftId?` + `ipc.ts` `session.updated.draftId?` / payload 타입
- [ ] 메인: `turn-registry` `pendingByDraft` API + `InflightTurn.draftId`
- [ ] 메인: `send.ts` draftId 가드/시작/승격 + `session.updated` draftId 주입 + init `maybeStart`
- [ ] 메인: `router.ts` `titles` 주입(`ChatDeps`)
- [ ] 렌더러: `chatStore` `send`/`promoteDraft`/`newChat`/`recentsEpoch`
- [ ] 렌더러: `useChatSessionsSync` `recentsEpoch` refresh
- [ ] 렌더러: `shared/api/ipc.ts`·`preload/index.ts` draftId 타입
- [ ] `docs/IPC_CONTRACT.md` 동기화
- [ ] 신규 단위 테스트 4종

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint ⬜ / typecheck ⬜ / test ⬜ (N passed) |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

# Plan — 0033-runtime-resilience

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 작업은 **비기능(런타임 복원력)** 이므로 구현 주체 = **Claude**(plan → impl → verify 순차 직접 수행).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0033-runtime-resilience` |
| 작성자 | Claude Code |
| 일자 | 2026-06-21 |
| 매핑 | PHASES 행 (검증 PASS 시 승격) / PR (push 후) |
| 상태 | DRAFT → READY |

## Context (왜)

Orca 는 턴 실행을 Claude Agent SDK 에 위임하면서 **감독·복구 레이어**를 두지 않았다. 에러 분류기(`runtime-errors/classifier.ts` — 8 category + `retryable`)는 있으나 그 신호를 **소비하는 곳이 없다**. 그 결과 4개의 실질 격차가 단일 백엔드(claude)에서도 유효하다:

1. **턴 실행 타임아웃 없음** — SDK/네트워크가 멈추면 `ipc/chat/send.ts:272` 의 `for await (const ev of live.events)` 가 무한 대기. 제목 생성엔 30초 타임아웃이 있는데(`title-generation.ts:49`) 메인 턴엔 없다.
2. **부분 턴(orphaned partial turn) 미처리** — `telemetry` 도착 전 턴이 끝나면(에러/취소/타임아웃/크래시) DB 에 불완전 assistant 메시지가 남고 "미완료" 표시가 없다. 재시작 시 정상 메시지처럼 보인다.
3. **취소 ack 없음** — `chat:cancel`(`send.ts:303`)은 `controller.abort()` 만, 렌더러는 `CANCEL_CHAT` 으로 **낙관적**으로 inflight 종료(`chatStore.ts:238`). main 이 확정하는 터미널 이벤트가 없어 멀티세션(비활성 세션) 취소가 권위적이지 않다.
4. **재시도/백오프 없음** — `retryable: true` 로 분류해도 자동 재시도가 없다.

의도한 결과: 멈춘 턴을 스스로 끊고(재시도 가능 안내), 중단/크래시된 응답을 "미완료"로 정직하게 표시하며, 취소를 멀티세션에서 정확히 확정하고, 시작 단계 일시 실패를 보수적으로 자동 복구한다.

## 인수 기준 (Acceptance Criteria)

**#1 턴 idle 타임아웃**
1. (1-a) 이벤트 무수신이 `IDLE_TIMEOUT_MS`(기본 120_000) 지속되면 controller.abort 후 `error` 이벤트(category `stream_error`, `retryable: true`) 1회 emit.
2. (1-b) 이벤트가 흐르는 동안 타이머가 매 이벤트마다 리셋되어 만료되지 않는다(장기 정상 턴 보호).
3. (1-c) 정상 종료·취소·재시도 종료 시 타이머 clear — 핸들 누수 0.

**#2 부분 턴 마커 + 복구**
4. (2-a) assistant 메시지는 생성 시 `complete=0`, 정상 종료(`telemetry`) 시 `complete=1`.
5. (2-b) 에러·취소·타임아웃으로 끝난 턴의 assistant 메시지는 `complete=0` 유지.
6. (2-c) 세션 로드가 `incomplete` 를 노출하고 렌더러 transcript 가 "응답이 완료되지 않았습니다" 칩을 표시(완료 메시지엔 없음).
7. (2-d) 마이그레이션 `0009` 가 기존 messages 행을 `complete=1` 로 채운다(회귀 0).

**#3 취소 ack**
8. (3-a) `chat:cancel` 시 main 이 `turn.aborted`(reason `user_cancelled`, 올바른 sessionId) 1회 emit.
9. (3-b) 비활성(백그라운드) 세션 취소도 그 세션만 정확히 종료(다른 세션 영향 0).
10. (3-c) abort 시 SDK 에러는 여전히 억제 — 스푸리어스 `error` 이벤트 없음(`claude.ts` 기존 동작 보존).

**#4 재시도/백오프 (pre-stream 한정)**
11. (4-a) 이벤트 0개 상태의 retryable 실패가 백오프(1s→2s) 후 최대 `MAX_RETRIES`(기본 2) 재시도.
12. (4-b) 이벤트 1개 이상 수신 후의 실패는 재시도하지 않는다.
13. (4-c) 재시도 대기 중 cancel 이 루프를 즉시 끊는다(`AbortSignal` 존중).
14. (4-d) 재시도 경로에서 user 메시지 중복 영속 0.
15. (4-e) 재시도 소진 시 `error` 이벤트를 정확히 1회 emit.

## 범위 / 비범위

- **범위**: 위 #1~#4. main 턴 오케스트레이션(`send.ts`)·영속(`persist.ts`/`queries.ts`/마이그레이션)·와이어 타입(`shared/ipc.ts`)·렌더러 소비(reducer/store/transcript)·`IPC_CONTRACT.md`.
- **비범위**: OS 서브프로세스(SDK 가 spawn 하는 CLI) 감독·재시작(#5 — SDK 가 프로세스 핸들을 노출 안 함). provider fallback(#6 — 멀티백엔드 의존, claude 단일에선 무의미). 두 항목 모두 사용자 합의로 제외.

## 설계

### #1 idle 타임아웃
- 총-턴 시간 상한이 아닌 **무응답(idle) 타임아웃** — 정상 장기 턴은 이벤트를 계속 흘리고 멈춘 턴만 무이벤트. 하드 총량 상한은 정당한 장기 에이전트 턴을 죽이므로 채택 안 함.
- `send.ts` 이벤트 루프에 타이머를 두고 **매 이벤트마다 리셋**. 만료 시 `turn.timedOut = true` 후 `controller.abort()`. setTimeout→abort 패턴은 `title-generation.ts:48-49` 재사용.
- 루프 종료 후 `turn.timedOut` 이면 `error`(stream_error/retryable) emit → 기존 reducer error 경로(`chatReducer.ts:286`)가 inflight 종료 + 재시도 안내.

### #2 부분 턴 마커
- 마이그레이션 `0009_message_complete.sql`: `ALTER TABLE messages ADD COLUMN complete INTEGER NOT NULL DEFAULT 1`(레거시·user 메시지 1로 안전).
- `persist.ts ensureAssistantMessage` → assistant 메시지를 `complete=0` 으로 insert. `telemetry` 케이스(`persist.ts:179`)에서 `complete=1`(신규 `db.markMessageComplete(id)`).
- 크래시 시 finally 미실행 → `complete=0` 이 디스크에 잔존 = 크래시 시그널. 세션 로드(`queries.ts` 메시지 조회)가 `complete` 를 읽어 `LoadedMessage.incomplete?: boolean`(신규)로 노출. transcript 가 칩 표시.

### #3 취소 ack
- 신규 `NormalizedEvent` variant `{ type: 'turn.aborted'; sessionId?; reason: 'user_cancelled' | 'timeout' }`.
- **결정**: timeout 은 `error`(stream_error)로, **cancel 은 `turn.aborted`(user_cancelled)** 로 분리 — cancel 은 사용자가 의도한 정상 종료라 에러가 아니다.
- 렌더러: `turn.aborted` 수신 시 해당 sessionId 키로 inflight 확정 종료 + 메시지 incomplete 반영. 기존 낙관적 `CANCEL_CHAT` 은 즉시 UX용으로 유지(권위적 확정은 `turn.aborted`).

### #4 재시도 (pre-stream 한정)
- 스트리밍 시작 후 재시도는 user 메시지·부분 출력을 꼬이게 하므로, **이벤트 0개 상태의 transient 실패만** 재시도.
- `send.ts` 에서 sendMessage+루프를 재시도 루프로 감싸고 조건 = `classified.retryable && eventsReceived === 0`. 최대 2회, 백오프 1s→2s(`AbortSignal` 존중). user 메시지 재영속 금지(이미 기록). 소진 시 기존처럼 error emit.

### 재사용
- `AbortController`/`controller.signal`(`send.ts:156`), `makeClassifiedError`(`runtime-errors/classifier.ts:44`), setTimeout→abort(`title-generation.ts`), `sendChatEvent`(`ipc/context.ts`), 마이그레이션 러너(`db/migrations/`), `appendMessage`/`updateMessageContent`(`db/queries.ts`).
- 레이어 경계: 변경은 모두 L3 ipc(`ipc/chat/*`)·L1 domain(`db`)·L0 shared(`shared/ipc.ts`)·렌더러 features/chat — 하향 의존 유지(신규 상위참조 0).

## 영향 받는 파일

- `app/src/main/db/migrations/0009_message_complete.sql` (신규)
- `app/src/main/db/queries.ts` — `markMessageComplete()` · 메시지 조회 `complete`→`incomplete` 매핑 · assistant insert complete 인자
- `app/src/main/ipc/chat/persist.ts` — ensureAssistantMessage complete=0 · telemetry markComplete
- `app/src/main/ipc/chat/send.ts` — idle 타임아웃(#1) · 재시도 루프(#4) · `turn.aborted` emit(#3) · finally 정리
- `app/src/main/ipc/chat/turn-registry.ts` — `InflightTurn.timedOut?`
- `app/src/shared/ipc.ts` — `turn.aborted` variant · `LoadedMessage.incomplete?`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` — `turn.aborted` 처리 · incomplete 반영
- `app/src/renderer/src/features/chat/store/chatStore.ts` — `turn.aborted` sessionId 키 라우팅
- `app/src/renderer/src/features/chat/components/transcript/*` — incomplete 칩
- 상수(`IDLE_TIMEOUT_MS`·`MAX_RETRIES`·백오프)는 `send.ts` 상단 명명 상수.

## 참고 문서

- `docs/arch/backend/provider-runtime.md` §2(NormalizedEvent)·§6(ErrorClassifier)
- `docs/IPC_CONTRACT.md` (§6 변경 절차 — NormalizedEvent variant 추가 시 **동시 갱신**)
- `docs/arch/backend/persistence.md` (messages 스키마)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`(better-sqlite3 Node ABI 재빌드 후 전체 green — 0019 패턴).
- 신규 테스트: idle 타임아웃(fake timer, 1-a/1-b/1-c) · 재시도(mock pre-stream throw, 4-a~e) · persist complete 전이(2-a/2-b) · 마이그레이션 회귀(2-d, 인라인 INSERT 로 0006 스키마 오염 회피 — 0010 r2 교훈) · reducer `turn.aborted` 키별 종료(3-a/3-b).

## 미정 (사용자 결정 가능 — 보수적 기본값으로 진행)

- `IDLE_TIMEOUT_MS` 기본값 = **120초**(제안). 
- `MAX_RETRIES` = **2**, 백오프 1s→2s(제안).

## 사용자 입장 확인 사항 (수동 GUI 검증 — 사람 책임, verify §책임 분리)

`npm run dev` 로 확인:
1. **#1 타임아웃** — 무응답 유도 시 ~2분 후 자동 중단 + "응답 없음/재시도 가능" 안내. 정상 장기 턴(도구 다회 호출)이 중간에 죽지 않는지(idle 리셋).
2. **#2 부분 턴** — 턴 진행 중 강제 종료 → 재실행 → 해당 세션 마지막 응답에 "완료되지 않음" 칩. 정상 완료엔 칩 없음.
3. **#3 취소** — 스트리밍 중 중단 즉시 멈춤. 멀티세션 동시 진행 중 비활성 세션 취소가 그 세션만 멈추는지.
4. **#4 재시도** — 시작 직후 일시 실패 시 사용자 개입 없이 자동 재시도. user 메시지 중복 누적 없음.
5. **회귀** — 채팅·승인 카드·제목 자동생성·비용 도넛 정상.

---

## [구현] 체크리스트

- [x] 마이그레이션 0009 + queries(markComplete·incomplete 매핑·assistant insert)
- [x] persist.ts complete 전이
- [x] send.ts idle 타임아웃(#1)
- [x] send.ts 재시도 루프(#4)
- [x] shared/ipc.ts `turn.aborted` + `LoadedMessage.incomplete`
- [x] send.ts `turn.aborted` emit(#3)
- [x] 렌더러 reducer/store turn.aborted + incomplete
- [x] transcript incomplete 칩
- [x] IPC_CONTRACT.md 갱신
- [x] 신규 단위 테스트 5종
- [ ] 게이트 4종 통과 (node_modules 불완전으로 환경 제한 — 보고 참조)

## [구현] 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/db/migrations/0009_message_complete.sql`, `app/src/main/db/migrate.ts`, `app/src/main/db/queries.ts`, `app/src/main/db/types.ts`, `app/src/main/ipc/chat/persist.ts`, `app/src/main/ipc/chat/send.ts`, `app/src/main/ipc/chat/turn-registry.ts`, `app/src/main/ipc/handlers/session.ts`, `app/src/shared/ipc.ts`, `app/src/renderer/src/features/chat/reducer/chatReducer.ts`, `app/src/renderer/src/features/chat/store/chatStore.ts`, `app/src/renderer/src/features/chat/components/transcript/AssistantMessage.tsx`, `docs/IPC_CONTRACT.md`, 신규 테스트 3파일 |
| 실행 명령 | `git diff --check` / `npm run lint` / `npm run typecheck` / `npm run typecheck:test` / `npm test` |
| 게이트 결과 | `git diff --check` 통과. npm 게이트는 `node_modules` 불완전 상태에서 실패(`electron-vite/node`, `@electron-toolkit/tsconfig`, `vitest` 누락). `npm install`/`npm ci --ignore-scripts` 는 네트워크/패키지 fetch 단계에서 장시간 무응답으로 중단. |
| 블로커 / 역질문 | 없음 — 코드 구현은 완료, 검증자는 의존성 설치 후 게이트 재실행 필요. |
| 대상 커밋 | `c31ac25` |

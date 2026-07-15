# Plan — 0107-streaming-persist-hotpath

## 메타

| 항목 | 값 |
|---|---|
| slug | `0107-streaming-persist-hotpath` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | 성능 시리즈 1/4 (0107~0110) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "응답없음, 동기대기 등의 앱 사용 경험을 저해하는 대표적인 성능 저하 요소들을 찾아라. 그리고 수정 방안을 마련하라" + 조사 후 "전체 4유닛 순차" 구현 확정 | 라이브 세션 요청 (2026-07-15) |
| 추론 의도 | "저해 요소" = 스트리밍 중 jank·콜드스타트 프리즈·상호작용 블로킹. 가장 빈번한 경로(스트리밍)가 1순위라는 우선순위는 내 해석 | 조사 결과 심각도 산정 |

## Context (왜)

better-sqlite3 는 동기다. `TurnCoordinator.run` 의 이벤트 루프가 매 `NormalizedEvent` 를 동기 버스 팬아웃(usage → **history** → title → relay)으로 흘리므로, history 의 DB 쓰기가 그대로 main 스레드 점유가 된다. history 가 relay 보다 먼저 도는 critical 구독자라 **DB 지연 = 렌더러 화면 갱신 지연**. 두 가지 증폭 요인이 있다:

1. **매 커밋 fsync** — `initDb` 에 `synchronous` PRAGMA 미설정 → SQLite 기본 FULL. WAL 모드에서 FULL 은 커밋마다 fsync 한다. 스트리밍 중 블록/툴 이벤트마다 발생.
2. **FTS 전체 재색인** — `message.completed` 마다 누적 `assistantText` **전체**를 `updateMessageContent` 로 재기록 → FTS5 external-content 트리거 `messages_au` 가 매번 전체 content 를 delete+재삽입 → 응답 길이에 초선형 비용.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 버스 팬아웃 동기 + 순서(usage→history→title→relay), history=critical | `app/src/main/app/bootstrap.ts:386-397`, `features/chat/turn-coordinator.ts:237` |
| persist 가 이벤트 타입별 동기 쓰기(appendPart/upsertToolResultPart/…) | `app/src/main/features/history/writer.ts:136-296` |
| `message.completed` 마다 누적 전체 재기록 | `writer.ts:220-224` → `infra/db/queries.ts:460` |
| FTS5 AFTER UPDATE 트리거가 전체 content 재색인 | `app/src/main/infra/db/migrations/0003_messages_fts.sql:22-25` |
| `synchronous` PRAGMA 부재(WAL 만 설정) | `app/src/main/infra/db/index.ts:17-18` |
| WAL + `synchronous=NORMAL` 공식 권장 — 앱 크래시 무손실, 정전 시 최근 커밋 롤백·DB 무결성 보존 | https://sqlite.org/pragma.html#pragma_synchronous ("WAL mode is safe from corruption with synchronous=NORMAL") |
| `messages.content` 는 FTS 색인용 concat 캐시 — 트랜스크립트 복원은 `loadParts`(parts)만 사용, content 읽기는 FTS·검색·fork 복사뿐 | `queries.ts:458` 주석, `queries.ts:106-121`(loadParts), `queries.ts:401-425`(copyMessagesTx) |
| assistant 메시지가 닫히는 경계 = telemetry persist + `commitUserMessage`(mid-turn 마감) | `writer.ts:280-291`, `writer.ts:64-84` |
| 사용자 중단(chatCancel)은 버스 telemetry 없이 턴 종료 — `turn.aborted` 는 renderer 직송 | `app/src/main/app/chat-turn.ts:751-774`, `turn-coordinator.ts:289,301` |
| 세션 단위 dangling 복구가 매 `chat:send` 초입에 실행 | `chat-turn.ts:398-403` |
| 부팅 복구(`recoverDanglingToolCalls`)는 complete=0 + tool_result 부재만 취급 | `features/chat/recovery.ts:19-39` |

## 인수 기준 (Acceptance Criteria)

1. `initDb` 가 `journal_mode=WAL` 직후 `synchronous=NORMAL` 을 설정한다.
2. 스트리밍 중 `message.completed`(최상위 텍스트 블록) N개가 와도 `updateMessageContent` 는 호출되지 않고, 턴 종료(telemetry persist) 시 **정확히 1회** 누적 전체로 호출된다 (단위 테스트).
3. `commitUserMessage` 가 진행 중 assistant 메시지를 마감할 때 content 를 그 시점 누적분으로 기록하고 `markMessageComplete` 한다 (단위 테스트).
4. 사용자 중단(chatCancel) 시에도 진행 중 assistant 메시지의 content 가 마감 기록된다.
5. finalize 이전 종료(크래시·adapter error·stall timeout)로 content 가 비어 있는 `complete=0` assistant 메시지를, 부팅 시 + 해당 세션 다음 `chat:send` 시 최상위 text 파트 concat 으로 재구성한다(`rebuildIncompleteMessageContent`, 단위 테스트). 서브에이전트 child 텍스트(`parentToolRunId` 존재)는 제외.
6. 재구성은 `recoverDanglingToolCalls` **이전**에 실행된다 (complete 마킹 후엔 대상 식별 불가).
7. 세션 프리뷰(`updateSessionPreview`) 라이브 갱신은 유지된다.
8. 게이트: lint 0 error · typecheck 3종 0 · 관련 vitest green. (DB 로드 스위트는 ABI 제약 환경 베이스라인 분리 보고 — app/AGENTS.md 규약.)

## 범위 / 비범위

- **범위**: PRAGMA 1줄, writer finalize 재배치, 재구성 복구, chatCancel finalize, 문서(persistence.md).
- **비범위**: write-behind 큐(불변식 리스크 — 설계 참조), FTS 트리거 변경/마이그레이션, main 측 델타 IPC 배칭(드랍 — 근거는 세션 계획), fork 복사 최적화(보류).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `DbQueries` prepared statement 패턴, `recoverDanglingToolCalls` 의 boot/세션 이중 진입 패턴, bootReport step.
- 전제: `messages.content` 소비자는 FTS 색인·검색·fork 복사뿐(조사로 확인). 신규 의존성 **없음**.

## 설계

**write-behind 큐를 만들지 않는다.** 큐는 usage→history 구독 순서(usage 가 reset 전 `currentAssistantMessageId` 를 읽음), `commitUserMessage` 의 [응답-전][user][응답-후] idx 정렬, 세션 전환 read-after-write, shutdown 동기 보장을 전부 위협한다. 대신 (a) fsync 제거로 이벤트당 상수 비용을 낮추고, (b) 초선형 항(FTS 재색인)은 호출 횟수를 O(블록수)→O(1) 로 줄인다.

1. **`infra/db/index.ts`**: `connection.pragma('synchronous = NORMAL')`.
2. **`features/history/writer.ts`**:
   - `message.completed`: `turn.assistantText` 누적과 `updateSessionPreview` 는 유지, `updateMessageContent` 호출만 제거.
   - private `finalizeAssistantMessage(turn)` — `updateMessageContent(id, turn.assistantText)` + `markMessageComplete(id)`. reset 은 호출부 유지.
   - telemetry 케이스와 `commitUserMessage` 의 기존 `markMessageComplete` 를 finalize 로 대체.
   - public `finalizeTurn(turn)` — chatCancel 등 버스 밖 종료 경계용(finalize + reset).
3. **`app/chat-turn.ts` chatCancel**: `settleOpenToolRuns(...)` 직후 `persistence.finalizeTurn(turn)` (합성 tool_result 파트가 먼저 영속된 뒤 content/complete 마감).
4. **재구성 복구**: `queries.ts` 에 `findIncompleteAssistantTextParts(sessionId?)`(complete=0 assistant 의 text 파트, m.id·mp.idx 순) + `recovery.ts` 에 `rebuildIncompleteMessageContent(db, {sessionId?})` — 메시지별 최상위 text concat(파싱 실패·`parentToolRunId` 파트 skip, 빈 concat skip) 후 `updateMessageContent`. 호출부 2곳: `bootstrap.start()` chat-recovery 스텝(recover **앞**), `chat-turn.ts` chat:send 초입(recover **앞**, 비-live 세션만).
5. **문서**: `docs/arch/backend/persistence.md` 에 synchronous=NORMAL 트레이드오프 + content 마감 시점 변경 기재.

레이어 경계: writer(features/history)·recovery(features/chat)·queries(infra) 모두 기존 소속 유지, 교차 import 없음(호출 배선은 컴포지션 루트).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **검색 지연 창**: 스트리밍 진행 중 턴의 텍스트는 턴 종료까지 FTS 검색에 안 잡힌다(현행은 블록 단위로 잡힘). 진행 중 턴을 검색하는 시나리오는 희소 — 수용.
- **adapter error/stall timeout 종료**: finalize 누락 → 해당 세션 다음 send 또는 다음 부팅에서 재구성(AC5·6). 그 사이 검색 공백 수용.
- **fork 진행 중 턴 복사**: content='' 복사 가능 — 파트도 복사되므로 표시 무영향, FTS 만 해당 복사행 공백(부팅 재구성이 복사행도 커버 — complete=0 유지 시).
- 동시성/멀티세션: 재구성·recover 는 세션 스코프 가드(`isSessionLive` 대칭) — live 턴의 쓰기와 경합하지 않음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `synchronous=NORMAL`: 정전/OS 크래시 시 최근 커밋 소실 가능(앱 크래시는 무손실, DB 무결성 보존) | SQLite 공식 권장 조합. persistence.md 에 명기 |
| finalize 이전 비정상 종료 시 FTS 공백 | 이중 재구성(부팅+세션 send) + chatCancel 즉시 finalize 로 상시 경로 커버 |
| writer 동작 변경으로 기존 스위트 기대 어긋남 | writer.test 신규 단언으로 고정 |

- 되돌리기 어려운 결정: 없음(PRAGMA·호출 시점 변경 모두 가역, 스키마 무변경).
- Open Question: 없음 (성능 SLA 는 TRD §15 미정이나 본 작업은 SLA 수치 결정이 아니라 명백한 핫패스 제거).

## 영향 받는 파일

- `app/src/main/infra/db/index.ts` · `queries.ts` · `types.ts`
- `app/src/main/features/history/writer.ts` (+ `writer.test.ts`)
- `app/src/main/features/chat/recovery.ts` (+ `recovery.test.ts`)
- `app/src/main/app/bootstrap.ts` · `chat-turn.ts`
- `docs/arch/backend/persistence.md`

## 참고 문서

- `docs/arch/backend/persistence.md` §FTS/WAL
- `docs/arch/backend/provider-runtime.md` §7 (persist)
- IPC 변경: 없음

## 게이트

- `cd app && npm run lint && npm run typecheck` + `vitest run src/main/features/history src/main/features/chat`(비-DB) 필수. DB 로드 스위트는 환경 베이스라인 분리 보고.
- 신규 테스트: writer finalize 흐름(AC2·3), rebuild 재구성(AC5).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, 우선순위 해석은 추론 표기.
- [x] 자료조사 — 전 발견 `파일:라인`/웹 URL 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 신규 의존성 없음 명시.
- [x] 파생 UX — 검색 지연 창·비정상 종료·fork·동시성 전개.
- [x] 리스크 — durability 트레이드오프 명기, Open Question 없음 확인.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: finalize-at-close + PRAGMA 조합. write-behind 큐 비채택 근거(불변식 4종) 재검토 후 동의.
- 이견 / 우려: 설계 초안의 "재구성을 recover *직후* 호출"은 오류였다 — `recoverDanglingToolCalls` 가 complete 를 올리면 `complete=0` 기반 재구성이 대상을 잃는다. **recover 이전 호출**로 설계 자체를 정정했다(인수 기준 6에 반영, 설계자=구현자 동일인이라 plan 수정으로 처리).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 사용자 중단(chatCancel)은 버스 telemetry 없이 턴 종료 → finalize 누락으로 상시 사용 경로에서 FTS 공백 발생 | ✅ `HistoryWriter.finalizeTurn` 공개 메서드 신설, chatCancel 에서 settle 직후 호출 | `chat-turn.ts` chatCancel — settle 합성 tool_result 영속 뒤 마감 |
| 2 | writer 스위트가 `infra/ipc/send`→electron 런타임 체인으로 이 환경(electron 바이너리 부재)에서 로드 실패 | ✅ `vi.mock('electron')` hermetic 주입(0104 선례) — 신규 finalize 테스트가 제약 환경에서도 돈다 | `writer.test.ts` 상단 |

## [구현자 기입] 구현 체크리스트

- [x] `synchronous = NORMAL` PRAGMA (`infra/db/index.ts`)
- [x] `message.completed` 의 `updateMessageContent` 제거 + finalize 헬퍼/`finalizeTurn`
- [x] telemetry·`commitUserMessage`·chatCancel 마감 경계 3종
- [x] `findIncompleteAssistantTextParts`(전역/세션) + `rebuildIncompleteMessageContent`
- [x] 부팅·세션 send 재구성 배선 (둘 다 recover 이전)
- [x] 테스트: writer finalize 4건 + recovery 재구성 3건
- [x] `docs/arch/backend/persistence.md` 갱신

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `infra/db/{index,queries,types}.ts` · `features/history/writer{,.test}.ts` · `features/chat/recovery{,.test}.ts` · `app/{bootstrap,chat-turn}.ts` · `docs/arch/backend/persistence.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run src/main/features/{history,chat}` |
| 게이트 결과 | lint ✅ 0 error(경고 1=0102 기지) / typecheck 3종 ✅ / writer 6·recovery 6 ✅ (DB 로드 스위트는 electron ABI egress 제약 베이스라인 — app/AGENTS.md 규약) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 기재) |

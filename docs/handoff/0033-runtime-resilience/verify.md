# Verify — 0033-runtime-resilience

> 템플릿 기반. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0033-runtime-resilience` |
| 검증자 | Claude Code |
| 일자 | 2026-06-21 |
| 대상 커밋 | impl `57a89af`(본 브랜치 실 커밋, INDEX 기재 `c31ac25` = Codex 분리환경 해시 — 위생 노트 ①) + verify 동반수정 본 커밋 |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan §인수 기준 1:1 대조. 증거는 `파일:라인` + 게이트 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1-a | idle 무수신 `IDLE_TIMEOUT_MS`(120s) 시 abort + `error`(stream_error/retryable) 1회 | ✅ | `send.ts:42-56`(`createIdleTimer` setTimeout→`turn.timedOut=true`+`controller.abort()`), `send.ts:336-345`(timeout 분기 stream_error/retryable, `return` 으로 1회). 테스트 `send.runtime-resilience.test.ts:11-23` |
| 1-b | 이벤트마다 타이머 리셋(장기 정상 턴 보호) | ✅ | `send.ts:317` `idle.reset()`(스트림 시작), `send.ts:320` `idle.reset()`(매 이벤트). 테스트 `send.runtime-resilience.test.ts:25-39`(reset 연장) |
| 1-c | 정상/취소/재시도 종료 시 타이머 clear(누수 0) | ✅ | `send.ts:369-371` `finally { idle.clear() }`(매 attempt). `createIdleTimer.clear` 가 `clearTimeout` |
| 2-a | assistant 생성 시 `complete=0`, telemetry 시 `complete=1` | ✅ | `persist.ts:39-43`(`ensureAssistantMessage` insert `complete:0`), `persist.ts:222-224`(telemetry `markMessageComplete`). 테스트 `queries.test.ts:341-362` |
| 2-b | 에러·취소·타임아웃 종료 턴은 `complete=0` 유지 | ✅ | telemetry 경로에서만 `markMessageComplete` 호출(`persist.ts:222`) — error/cancel/timeout 은 telemetry 미도달이라 `complete=0` 디스크 잔존 |
| 2-c | 세션 로드가 `incomplete` 노출 + transcript 칩(완료엔 없음) | ✅ | 로드 쿼리 `queries.ts:80` `m.complete AS complete`, 핸들러 `session.ts:43-48`(assistant && complete===0 → `incomplete:true`), reducer `chatReducer.ts:362`, UI `AssistantMessage.tsx:52-56`("응답이 완료되지 않았습니다" 칩, `message.incomplete` 가드) |
| 2-d | 마이그레이션 0009 가 기존 messages 를 `complete=1` backfill | ✅ | `0009_message_complete.sql`(`ADD COLUMN complete INTEGER NOT NULL DEFAULT 1`), `migrate.ts:25,29`(등록). 회귀테스트 `queries.test.ts:90-111`(마이그레이션 전 INSERT → 0009 후 complete=1, **인라인 INSERT** 로 공유헬퍼 오염 회피 — 0010 r2 교훈 준수) |
| 3-a | `chat:cancel` 시 `turn.aborted`(user_cancelled·올바른 sessionId) 1회 | ✅ | `send.ts:382-392`(cancel 핸들러 → `sendChatEvent(turn.owner, {turn.aborted, sessionId, user_cancelled})`). `turn.owner` 로 정확한 WebContents 타깃 |
| 3-b | 비활성 세션 취소도 그 세션만 종료 | ✅ | `turns.getBySession(req.sessionId)`(세션키 조회) + 렌더러 `chatStore.ts:150-152,184-187`(evSessionId 키 라우팅 → 해당 세션만 `dispatchTo`/`resetLive`). 테스트 `chatReducer.runtime-resilience.test.ts:8-21` |
| 3-c | abort 시 SDK 에러 억제(스푸리어스 error 없음) | ✅ | `send.ts:335`(`turn.cancelled && signal.aborted` → 조용히 `return`, 기존 동작 보존) |
| 4-a | 이벤트 0개 retryable 실패가 백오프(1s→2s) 후 최대 2회 재시도 | ✅ | `send.ts:298`(`for attempt`), `send.ts:347-358`(`retryable && eventsReceived===0 && attempt<MAX_RETRIES` → `abortableDelay(RETRY_BACKOFF_MS[attempt])` → `continue`). `MAX_RETRIES=2`·`RETRY_BACKOFF_MS=[1000,2000]`(`send.ts:31-32`) |
| 4-b | 이벤트 1개 이상 수신 후 실패는 재시도 안 함 | ✅ | `send.ts:319` `eventsReceived += 1` → `send.ts:349` 조건 `eventsReceived === 0` 차단 |
| 4-c | 재시도 대기 중 cancel 이 루프 즉시 차단 | ✅ | `abortableDelay`(`send.ts:58-74`)가 `signal.aborted`/`abort` 이벤트에 reject → `send.ts:353-357` catch `return`. 또 `send.ts:351` `!signal.aborted` 가드. 테스트 `send.runtime-resilience.test.ts:41-49` |
| 4-d | 재시도 경로 user 메시지 중복 영속 0 | ✅ | `persistUserMessage`(`send.ts:228`)는 재시도 루프(`send.ts:297`) **바깥**에서 1회만. 루프 내부엔 sendMessage+이벤트소비만 |
| 4-e | 재시도 소진 시 error 정확히 1회 emit | ✅ | 소진 시 조건 false → `send.ts:362-368` error emit 후 `return`(1회) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | **PASS** (lint 0 · typecheck node+web+test 0 · test 418/418 · build 0) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 15/15 충족(증거 첨부) |
| 레이어 경계 위반 0 | ✅ | — | lint(eslint-boundaries) 통과 — 변경은 L3 ipc·L1 db·L0 shared·렌더러 features/chat, 하향 의존 유지 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT §3 turn.aborted variant 행 추가·error 행 정정 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경(스캔 N/A) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions(IDLE_TIMEOUT/MAX_RETRIES 기본값) | ✖ | ✅ | 보수적 기본값(120s·2회) 채택 — 사람 조정 가능 |
| UI/UX 시각 검증(incomplete 칩·취소 즉시성) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm install --ignore-scripts && npm rebuild better-sqlite3 && node node_modules/electron/install.js
# (impl 보고의 환경 제한 해소: 의존성 설치 + better-sqlite3 Node ABI 재빌드 + electron 바이너리 설치)

$ npm run lint            → 0 (eslint --fix, 경계 위반 0)
$ npm run typecheck       → 0 (node + web + test 3종)
$ npm test                → Test Files 59 passed (59) / Tests 418 passed (418)
$ npm run build           → ✓ built (electron-vite, exit 0)
```

## 검증 중 동반 수정 (Claude — impl 완료 보강)

impl 보고가 `node_modules` 불완전으로 게이트 미실행이었다. 환경을 갖춰 4종을 돌리니 **3건의 게이트 결함**이 드러나 동반 수정했다(비기능 = Claude 직접 구현, 프로덕션 동작 무변경):

1. **lint** — `chatReducer.runtime-resilience.test.ts:5` `recv` 화살표 함수 반환 타입 누락(`explicit-function-return-type`). → `ChatAction` 명시 반환 타입.
2. **typecheck:web** — 같은 테스트의 `pendingAsks` 픽스처가 구형 평면 형태(`{question,header,options}`). → 현행 `AskQuestionRequest`(`{requestId, questions:[…]}`) 형태로 정정.
3. **typecheck:test** — 기존 `turn-registry.test.ts` 가 impl 의 `InflightTurn<W>`(신규 `owner:W` 필드 → 변성) 변경으로 `InflightTurn<unknown>`↔`<object>` 불일치. → `fakeTurn` 반환을 `InflightTurn<object>` 로 파라미터화(동반 테스트 수정).
4. **위생** — `types.ts ProjectInsert` 에 잘못 추가된 `complete?: 0 | 1`(projects 테이블 무관·dead) 제거.

## 위생 검토

- 키/토큰/이메일/IP 패턴: 변경 파일에 비밀 혼입 0. 마이그레이션·상수(`IDLE_TIMEOUT_MS` 등) 평문 상수만.
- AGENTS.md 변경 없음.

## PHASES.md 정합성

- `docs/PHASES.md` 표에 `0033-runtime-resilience` 완료 행 승격(커밋 기재). IPC_CONTRACT §3 변경 동기화 확인.

## 결론 / 다음 단계

- **상태: PASS** — 인수 15/15 충족, 게이트 4종 green(418/418), 레이어 경계 0, 신규 의존성 0.
- INDEX `verify/PASS` + PHASES 승격 + (요청 시) PR.
- **사람 확인 대기**(verify §책임 분리): `npm run dev` 수동 GUI 검증 — ① 무응답 ~2분 자동중단 + 정상 장기 턴 생존 ② 강제종료 후 재실행 시 "완료되지 않음" 칩 ③ 멀티세션 비활성 세션 취소 격리 ④ 시작 직후 일시실패 자동 재시도·user 메시지 중복 없음 ⑤ 채팅/승인/제목/비용 회귀. IDLE_TIMEOUT(120s)·MAX_RETRIES(2) 기본값 조정 여부.
</content>
</invoke>

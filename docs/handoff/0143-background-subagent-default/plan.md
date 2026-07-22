# Plan — 0143-background-subagent-default

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0143-background-subagent-default` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES (verify PASS 시 승격) — `0135` 폐기 · `0138` supersede · `0136` 기본화 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 135를 deprecated 하고, 136을 엄격하게 구현하라." 증상: ① 서브에이전트 실행 후 메시지턴 종료 — inflight 애니메이션 안 나옴, 완료하면 답변하겠다고만 하고 턴 종료 ② inflight 가 나와도 steer 주입 시 세션 사망(`claude result failed (error_during_execution)`) | 라이브 세션 요청(2026-07-22) |
| 명시 요구 (UX 불변식) | 내부 프로토콜이 바뀌어도 ① 서브에이전트 패널 inflight 애니메이션 + 업데이트 실시간 출력 ② 메인이 서브에이전트/도구 응답을 기다리는 대기 상태(listen)에서도 inflight 애니메이션 지속 | 라이브 세션 요청(동일) |
| 명시 요구 (추가) | "Claude Code (web) 와 똑같이 백그라운드 작업 완료 시 안내 문구를 출력하라. 메시지 프로토콜에 있을 것으로 판단된다." — 예: `백그라운드 작업 완료 / Agent "…" finished · 4m 43s 소요됨` | 라이브 세션 요청(스크린샷 첨부) |
| 명시 결정 | listen 대기 중 중단 버튼 = **태스크도 중단**(stopTask + '중단됨' 정착) | 라이브 AskUserQuestion 응답(2026-07-22) |
| 추론 의도 | "엄격하게" = 0136 을 opt-in 이 아닌 **제품 기본 경로**로 승격하고(0136 Open Question 의 사용자 결정), 0135 의 foreground 주입과 0138 의 기본 경로 게이트를 제거 — env escape hatch 도 두지 않는다(태스크 단위 동기화는 모델의 `run_in_background:false` 명시로 충분). (추론) | 요청 문구 + 0136 plan "Open Question" |

## Context (왜)

SDK 0.3.215 / CLI 2.1.198+ 는 서브에이전트를 기본 백그라운드로 돌린다. `0135` 는 canUseTool 에서 `run_in_background:false` 를 주입해 구 foreground 를 고정하려 했으나 **라이브에서 무효**(증상 지속 — 0138 진단 로그 설계의 "주입 무효" 분기 그대로), `0138` 은 기본 경로에서 listen 턴을 배제해 "메인 턴 즉시 종료 → inflight 없음 → 서브에이전트가 완료돼도 후속 답변 없음" 이라는 정반대 열화를 남겼다. 방향을 반전한다: **백그라운드 수용(0136)이 기본 경로**이며, 남은 두 버그(steer 사망·listen 대기 inflight 소실)를 런타임/렌더러 양쪽에서 수정하고, 완료 통지(UX)를 추가한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 버그 a 기전: listen 중 send → held + 릴리즈 밸브 → `endListenFrame`(인터럽트·draining 없음) → 루프 held-flush 가 CLI **자동(알림) 턴 진행 중** 채널에 무가드 `pushTurn` | `chat-turn.ts:240-318,315-317`, `session-runtime.ts:363-370`, `claude.ts:462-471` |
| 프레임 오정렬: `routeEvent` 는 **첫 terminal** 에서 현재 프레임을 마감 — steer 프레임이 auto-turn 의 잔여 이벤트+terminal 을 승계 | `session-runtime.ts:306-328`, `openFrame` 백로그 선합류 `:280-287` |
| 비-success result(`error_during_execution` 등)는 무조건 치명 `stream_error` 매핑 — 오귀속 시 "세션 사망" 렌더 | `claude-map.ts:478-491`; subtype 의미("API 실패 또는 취소된 요청") `@docs/spec/claude/agent-sdk/agent-loop.md:265-277` |
| 정상 cancel 경로가 무사한 이유: `markAborted` 는 push 전 `live.interrupt()` + draining(터미널까지 드랍) — listen 릴리즈 경로에만 상응물이 없음 | `session-runtime.ts:422-435` |
| SDK 스트리밍 입력은 mid-turn push 를 공식 지원(큐잉·도구 경계 드레인) — 문제는 push 자체가 아니라 Orca 프레임 귀속 | `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md:52-71`, `adapters/streaming-input.ts:30-33` |
| 버그 b 기전: renderer inflight 는 BEGIN_TURN/TURN_END_RESET 만으로 구동 — 메인 턴 telemetry 가 끄고, listen 턴은 입력 push 가 없어 활동 이벤트 전까지 유휴 표시. renderer 에 listen 개념 없음 | `chatReducer.ts:203-211,286-298`, `chatStore.ts:332-343,428-450` |
| 자동 BEGIN_TURN 휴리스틱이 `parentToolRunId`(자식) 이벤트를 미배제 → listen 배달 중 메인 inflight 깜빡임 | `chatStore.ts:334-343` |
| `send()` busy 라우팅은 `cur.inflight` 단독 — listening 을 store 레벨 busy 로 반영하지 않으면 낙관 커밋 vs `message.queued` 이중 렌더 | `chatStore.ts:564-597` |
| 서브에이전트 패널 애니메이션은 `deriveSubagentTaskStatus==='running'` + `subagentMeta.startedAtMs` 파생 — 이벤트 라이브 배달(=listen 기본화)만으로 자연 동작 | `parts.ts:298-304`, `SubAgentTileContent.tsx:133-135`, `AgentTaskRow.tsx:46-96` |
| 완료 통지 재료는 프로토콜에 기존재: `subagent.task` settled(=SDK `task_notification`) 에 subagentType·description·status·durationMs·toolUses·summary | `shared/ipc.ts:597-614`, `claude-map.ts:69-124` |
| foreground 태스크도 `task_started` 를 방출해 트래커에 등록 — membership ≠ background. 정확한 background 신호 = async_launched 런치 영수증 관측 | `turn-coordinator.ts:314-320,347-355`, `background-tasks.ts:49-55` |
| history writer 는 명시 case 스위치 — `subagent.task`/`chat.listen` 은 case 부재 시 자동 no-op(미영속 구조 보장), 파트 append 는 `ensureAssistantMessage` 재사용 가능 | `features/history/writer.ts:103-114,154-302` |
| `NormalizedEvent` union 은 순수 TS(와이어 zod 없음) — variant 추가는 타입+IPC_CONTRACT §3 동기만 | `shared/ipc.ts:507-` |
| listen 턴 activeTurns 계상·NOOP stall — 0136 구현 현행 | `turn-coordinator.ts:45-57,237,243` |

## 인수 기준 (Acceptance Criteria)

1. **[0135 폐기]** `makeCanUseTool` 은 Agent/Task 에 `run_in_background` 를 일절 주입하지 않는다 — 차단 deny 만 유지, 입력 passthrough(모델 명시값 보존). `CanUseToolOptions.backgroundSubagents` 제거.
2. **[env 소거]** `ORCA_SUBAGENT_BACKGROUND` / `backgroundSubagents` 식별자가 `app/src` 에서 전수 소거된다(grep 0건).
3. **[0138 supersede]** 턴-후 루프는 미정착 태스크 존재 + 채널 생존이면 **항상** listen 턴을 연다 — 0138 게이트·`chat.subagent.background-unexpected` 경고 제거.
4. **[버그 a — 런타임]** `SessionRuntime` 이 CLI mid-turn 상태(`channelBusy`)를 추적(routeEvent 비-terminal=true/terminal=false, finishPump/teardown=false)하고, `endListenFrame()` 은 `channelBusy` 면 no-op(auto-turn terminal 의 자연 마감에 위임), 유휴면 즉시 마감한다.
5. **[버그 a — 루프]** held 가 있어도 `channelBusy ‖ unframed 백로그` 면 드레인 listen 턴을 먼저 돌린다 — `pushTurn` 은 "유휴 + 백로그 없음" 채널에서만 실행. 분기 판정은 순수 함수(`decidePostTurnStep`)로 추출·단위 테스트.
6. **[버그 a — 회귀 테스트]** "auto-turn 진행 중 밸브 no-op → terminal 자연 마감 → 이벤트 무손실·오귀속 없음" 이 session-runtime 단위 테스트로 고정된다. `error_during_execution` 치명 매핑은 유지(진짜 API 실패 은폐 금지 — mid-turn push 제거가 정공).
7. **[버그 b — 프로토콜]** 신규 `NormalizedEvent` `{type:'chat.listen'; sessionId; phase:'started'|'ended'}` — listen **phase** 진입 시 1회 started, 루프 이탈(finally) 시 1회 ended. `sendChatEvent` 직행(버스 미경유·미영속). 개별 listen 턴 경계마다 재방출하지 않는다.
8. **[버그 b — renderer]** `ChatState.listening`/`listenStartedAt`: ① send busy = `inflight || listening`(listening 중 send = steer 예약, 낙관 커밋 없음) ② StatusLine/PendingAssistant 는 `inflight || listening` 동안 표시(`turnStartedAt ?? listenStartedAt` 앵커) ③ TURN_END_RESET 은 listening 불변 ④ 클리어는 `chat.listen ended`·CANCEL_CHAT·세션 로드/신규 생성에서만.
9. **[버그 b — 깜빡임]** 자동 BEGIN_TURN 휴리스틱이 `parentToolRunId` 실린 이벤트를 제외한다.
10. **[불변 UX]** 서브에이전트 패널 라이브(shimmer·child transcript 실시간)는 0136 경로 그대로 유지 — renderer 파생 로직(`deriveSubagentTaskStatus` 등) 무변.
11. **[stop 정확화]** 트래커가 per-task `asyncLaunched`(영수증 관측)를 기록하고, `stopLiveSubagent` 분기가 전역 불린 대신 이를 사용한다(관측=stopTask 직행 / 미관측=backgroundTask 선행).
12. **[중단 의미론 — 사용자 확정]** listen 중 중단: 추적 태스크 전건 stop + 합성 `subagent.task settled(status:'stopped')` 정착 + 트래커 clear + `chat.listen ended` → 완전 유휴.
13. **[완료 통지]** background 정착 태스크(settled + `background:true` enrich)는 transcript 에 통지 블록을 남긴다(상태별 문구 + Agent "{description}" + 소요시간 + summary). 라이브·세션 재로드 동일 렌더(신규 영속 파트 `subagent_notice`, toolRunId 멱등). 사용자가 패널에서 직접 stop 한 태스크는 통지 미표시(설계 결정). i18n ko/en.
14. **[concurrency]** listen 턴은 `activeTurns`(동시 턴 경고)에 계상하지 않는다.
15. **[재로드 위생]** 세션 로드 시 async_launched 영수증이 settled 로 덮이지 않은 채 복원된 부모 Task 를 중단 표시로 강제한다(재시작 = in-process 태스크 소멸 — running 표시는 항상 거짓).
16. **[문서]** provider-runtime.md §2 서브에이전트 절 재서술 · IPC_CONTRACT.md §3(`chat.listen`·`subagent.task.background`·`subagent_notice`) · INDEX/PHASES 의 0135/0136/0138 주석.
17. **[게이트]** lint/typecheck 0 error + 순수 vitest green(신규 포함). DB-로드 스위트는 egress 베이스라인 분리 보고.

## 범위 / 비범위

- **범위**: main(`adapters/claude.ts`·`adapters/turn.ts`·`features/sessions/session-runtime.ts`·`features/chat/{turn-coordinator,background-tasks,settle}.ts`·`features/history/writer.ts`·`app/chat-turn.ts`) + shared(`ipc.ts`) + renderer(`chatReducer`·`chatStore`·`parts.ts`·표시 컴포넌트·i18n) + 문서.
- **비범위**: `SDKBackgroundTasksChangedMessage` 레벨 신호 채택(후속 검토 존치) · `remote_launched` · SDK 핀 변경 · listen stall 재무장(백그라운드 침묵 오판 리스크로 기각) · mock 어댑터 시나리오 확장.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- SDK 0.3.215 핀 유지: `task_started/progress/notification`·`tool_use_result`(async_launched)·스트리밍 입력 큐잉 의미론. 신규 의존성 0.
- CLI 는 백그라운드 태스크 완료 시 알림 턴(terminal 로 종결)을 연다 — listen 프레임 자연 종료 조건(0136 전제 승계). 엣지는 밸브·채널 사망 정리·중단이 커버.
- `chat.listen`/`subagent.task` 는 history writer 명시 case 스위치 덕에 case 추가 전까지 자동 미영속 — `subagent_notice` 만 의도적으로 영속한다.

## 설계

### A. 0135·0138 제거 (기본 = 백그라운드 passthrough)
- `claude.ts` 서브에이전트 분기: 차단 deny 후 즉시 `allow(updatedInput: input)` — 주입 제거. 옵션·배선·env 읽기·turn.ts 필드·coordinator dep 전수 소거.
- escape hatch env 없음(설계 결정) — 모델의 `run_in_background:false` 명시가 태스크 단위 opt-out.

### B. SessionRuntime — `channelBusy` + 밸브 유예 (버그 a 핵)
- `cliBusy` 필드: routeEvent(드레이닝 분기 포함)에서 비-terminal=true/terminal=false, finishPump/teardownChannel=false. getter `channelBusy`·`hasUnframedBacklog` 노출.
- `endListenFrame`: 프레임 동일성 검사 뒤 `if (this.cliBusy) return` — auto-turn 이 진행 중이면 그 terminal 이 listen 프레임을 자연 마감하고 턴-후 루프가 held 를 flush 한다.

### C. chat-turn 턴-후 루프 (버그 a 루프측 + chat.listen + 중단)
- 순수 판정 `decidePostTurnStep({havePending, haveTasks, channelAlive, channelBusy, hasBacklog})` → `'listen'|'flush'|'break'` — held 가 있어도 busy/백로그면 listen 드레인 선행, `pushTurn` 은 유휴+무백로그에서만.
- `chat.listen` started/ended 를 phase 스코프로 방출(sendChatEvent 직행). 루프 이탈 finally 에서 ended 보장.
- listen 턴 aborted(중단 버튼) → 추적 태스크 전건 `stopLiveSubagent` + 합성 settled(stopped, background:true) + clear.
- 콜드 spawn 전 트래커 clear·채널 사망 합성 정착(0136)은 유지 — 사망 정착도 `background:true`.

### D. 트래커·stop 정확화
- `BackgroundTaskTracker` 내부를 `Map<sessionId, Map<toolUseId,{asyncLaunched}>>` 로 — `markAsyncLaunched`/`isAsyncLaunched` 추가, 기존 API 의미 불변.
- coordinator: async_launched 영수증 관측 시 mark, settled emit 전에 `background:true` enrich(트래커 해제 후 재settled 는 미부여 — 통지 중복 차단). stop 분기·`settle.ts` 파라미터를 per-task 로.

### E. renderer — listening 레벨 상태 (버그 b 핵)
- `shared/ipc.ts`: `chat.listen` variant(transient·relay-only 주석).
- `chatReducer`: `listening`/`listenStartedAt` + `chat.listen` case. TURN_END_RESET 불변, CANCEL_CHAT/로드/신규에서 클리어.
- `chatStore`: busy = `inflight || listening`, 자동 BEGIN_TURN 에 `parentToolRunId === undefined` 조건.
- 표시: ChatTile→TranscriptView `inflight || listening`, PendingAssistant 앵커 `turnStartedAt ?? listenStartedAt`, Composer(feedbackMode·취소 버튼·concurrency 자기-차감) 동일 확장. `inflight` 소비처 전수 grep 분류는 [구현자 기입]에 표로 고정.

### F. 완료 통지
- `subagent.task` 에 additive `background?: boolean`(main 권위 게이팅 — renderer 추론 금지).
- `AppMessagePart` 에 `subagent_notice{toolRunId,status,durationMs?,summary?}` + writer `case 'subagent.task'`(settled+background 만 append — `ensureAssistantMessage` 재사용, 마이그레이션 불요). description 은 렌더 시 부모 tool_call args 조인.
- renderer: settled+background → reducer 로 notice 파트 커밋(멱등), `messageSegments` 독립 세그먼트, `SubagentNoticeRow` 신규, i18n `chat.subagentNotice.*` ko/en.
- 재로드 위생(AC15): 세션 로드 정리 경로에서 async_launched 잔존 부모 Task 를 중단 표시로 강제.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- steer 게이트(PostToolBatch)가 auto-turn 중 held 를 먼저 flush → 루프 재평가 시 pending 빈 상태 → listen 재개(이중 주입 없음 — flushHeld 소진형).
- listen 프레임 사이 auto-turn 개시 레이스 → `channelBusy‖백로그` 가드가 흡수. 잔여 극소 창은 draining 미설정으로 무손실(리스크 표).
- listen 중 채널 사망 → finishPump 프레임 마감 → 합성 failed(background:true → "실패" 통지) → break → ended.
- 개별 stop 후 SDK settled 지각 도착 → 트래커 이미 해제 → enrich 미부여, upsert 멱등 — 통지·파트 중복 없음.
- 윈도 리로드 중 listening → ended 유실 가능 → 세션 로드 리셋이 방어.
- telemetry ↔ chat.listen started 사이 1-프레임 공백 → rAF 배치로 대부분 동일 플러시, 최악 1 rAF — 사람 검증 항목.
- listen phase 진입 직후 즉시 settled(백로그에 notification 적체) → started/ended 근접 방출 — 정상.
- notice 파트 시점에 열린 assistant 메시지 부재 → `ensureAssistantMessage` 가 신규 생성(기존 파트 경로 동형).
- 테마/접근성: SubagentNoticeRow 는 시맨틱 토큰 + 기존 행 패턴 준수, 신규 인터랙션 없음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| held steer 가 진행 중 auto-turn 1개 수명만큼 대기(유계) | PostToolBatch 게이트·중단 버튼이 탈출구. stall 재무장은 백그라운드 침묵 오판(중단 유발) 리스크로 기각 |
| 가드 통과 직후 auto-turn 개시 극소 레이스 | draining 미설정으로 무손실 — 증상은 렌더 순서 수준. 수용 |
| CLI task_* 스키마 드리프트 | SDK 0.3.215 핀 유지가 방어 |
| listening 게이팅 누락 표면(`inflight` 소비처) | 구현 시 전수 grep → busy 대상 vs 스트리밍-전용 분류 표를 [구현자 기입]에 고정 |

- 되돌리기 어려운 결정: `subagent_notice` 파트 영속(과거 세션 데이터에 신규 파트 유입) — 파트는 JSON 이라 스키마 마이그레이션 없고, 미인식 파트는 구버전 렌더러가 무시(전방 호환).
- 단독 결정 금지 항목: 없음 — 방향(기본화)·중단 의미론은 사용자 확정, escape hatch 제거·fatal 매핑 유지·직접 stop 통지 미표시는 설계 결정으로 기록(이견 시 회신).

## 영향 받는 파일

- `app/src/main/adapters/claude.ts`(+`claude.canusetool.test.ts`) · `adapters/turn.ts`
- `app/src/main/features/sessions/session-runtime.ts`(+test)
- `app/src/main/features/chat/{turn-coordinator,background-tasks,settle}.ts`(+tests)
- `app/src/main/features/history/writer.ts`
- `app/src/main/app/chat-turn.ts` (+ 신규 `features/chat/post-turn.ts` 순수 판정)
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,store/chatStore.ts,lib/parts.ts}`(+tests)
- `app/src/renderer/src/features/chat/components/…`(ChatTile·TranscriptView·PendingAssistant·Composer·신규 SubagentNoticeRow)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/arch/backend/provider-runtime.md` · `docs/IPC_CONTRACT.md` · `docs/handoff/INDEX.md` · `docs/PHASES.md`

## 참고 문서

- `docs/handoff/0135-subagent-foreground-restore/plan.md` · `0136-background-subagent-runtime/plan.md` · `0138-listen-turn-optin-foreground/plan.md`
- `docs/arch/backend/provider-runtime.md` §2 · `docs/IPC_CONTRACT.md` §3/§6 · `docs/spec/claude/agent-sdk/`

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 순수 vitest(신규 포함). DB-로드 스위트·electron 실기는 egress 제약으로 CI/사람 몫 분리 보고. grep 게이트: `ORCA_SUBAGENT_BACKGROUND|backgroundSubagents` app/src 0건.
- 신규 테스트 요구: AC5·6·8·9·11·13 (post-turn 판정·session-runtime busy/밸브·coordinator enrich/stop·reducer listening·store 라우팅·notice 멱등·i18n 패리티).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 요청·UX 불변식·중단 의미론(AskUserQuestion) 인용, "엄격" 해석은 추론 표기.
- [x] 자료조사 — 전 발견 레퍼런스(`파일:라인`·`@docs/spec/…`).
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — SDK 핀·알림 턴 전제·미영속 구조 명시, 신규 의존성 0.
- [x] 파생 UX — 레이스·채널 사망·리로드·중복 통지·테마/a11y 열거.
- [x] 리스크 — held 대기·극소 레이스·파트 영속 전방 호환 검토, Open Question 잔여 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: `channelBusy` + 밸브 유예 + `pushTurn` 유휴 보장(설계 §B·§C)이 버그 a 의 근원(mid-turn push → 프레임 오귀속)을 제거함을 코드로 재확인. `chat.listen` 레벨 신호(phase 스코프)는 renderer 상태 1쌍으로 inflight 지속·send 라우팅을 동시에 해결 — 파생(태스크 running) 대안의 stale-row phantom busy 문제를 회피한다.
- 이견 / 보강 (F1): 설계 §B 초안의 "routeEvent 비-terminal = busy" 는 **백그라운드 child 스트림에서 busy 가 고착**되는 결함이 있었다 — child(parentToolRunId)·`subagent.task` 이벤트는 CLI 메인 루프 턴 밖에서도(백그라운드 동시 실행) 흐르므로, 이를 busy 로 치면 서브에이전트가 스트리밍하는 동안 밸브가 영영 안 열려 steer 가 태스크 종료까지 좌초한다. **백그라운드 스코프 이벤트를 busy 판정에서 제외**(`isBackgroundScoped`)로 선조치.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| F1 | busy 판정에 백그라운드 스코프 이벤트가 포함되면 child 스트리밍 중 밸브 영구 no-op(steer 좌초) | ✅ `isBackgroundScoped`(child parentToolRunId·subagent.task) 제외 + 테스트 "백그라운드 스코프 이벤트는 busy 를 켜지 않는다" | `session-runtime.ts` |
| F2 | 완료 알림(useCompletionNotifier)이 메인 턴 telemetry 에서 조기 발화 — listen 대기 중 "완료" OS 알림 | ✅ busy = `inflight ‖ listening` 로 확장 — listen phase 종료까지 알림 유예 | `useCompletionNotifier.ts` |
| F3 | 채널 사망 합성 settled(`settleSubagentTask`)만으로는 renderer transient 메타·writer 통지가 안 흐름(정착 tool_result 만 방출) | ✅ 합성 `subagent.task settled` 이벤트 자체도 `emitTurn` 으로 버스 방출(사망=failed·중단=stopped, `background:true`) — 라이브 settled 와 동일 경로 | `chat-turn.ts` `settleDeadBackgroundTasks`/`stopAndSettleAbortedTasks` |
| F4 | stopSubagent 핸들러의 per-task 관측 조회가 트래커 `settled()`(관측 동반 제거) 뒤면 항상 false | ✅ 해제 **전에** `isAsyncLaunched` 를 읽어 `stopLiveSubagent` 에 전달 | `chat-turn.ts` stopSubagent 핸들러 |

## [구현자 기입] 구현 체크리스트

- [x] AC1~3 0135/0138 제거 + env 소거(grep 0건) + canusetool 테스트 재작성(passthrough/명시값 보존/deny)
- [x] AC4~6 session-runtime `channelBusy`(백그라운드 스코프 제외)·`hasUnframedBacklog`·밸브 유예 + 테스트 5종(busy 전이·스코프 제외·mid-turn 밸브 no-op→자연 마감 무손실·백로그·teardown 해제)
- [x] AC5 `decidePostTurnStep`(`features/chat/post-turn.ts`) 순수 추출(테스트 8종) + 루프 재구성 + AC7 `chat.listen` phase 신호 + AC12 중단(stop+stopped 정착+clear)
- [x] AC11 트래커 `markAsyncLaunched`/`isAsyncLaunched`(테스트 5종) + coordinator 영수증 마킹·settled enrich(테스트 3종) + `stopLiveSubagent` per-task 분기
- [x] AC8~9 renderer `listening`/`listenStartedAt`·busy 라우팅·BEGIN_TURN 자식 제외 + reducer/store 테스트(9종)
- [x] AC13 `subagent_notice` 파트(writer case + reducer 멱등 커밋 + `SubagentNoticeRow` + segments 분리 + i18n ko/en 4키) / AC15 `settleStaleAsyncLaunchParts`(테스트 4종)
- [x] AC14 listen 턴 activeTurns 미계상(+테스트)
- [x] AC16 provider-runtime.md §2 재서술·IPC_CONTRACT §3(`chat.listen`·`background`·`subagent_notice`) / AC17 게이트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `adapters/claude.ts`·`adapters/turn.ts`·`features/sessions/session-runtime.ts`(+test)·`features/chat/{turn-coordinator(+test),background-tasks(+test),settle,post-turn(신규+test)}.ts`·`features/history/writer.ts`·`infra/db/types.ts`·`app/chat-turn.ts`(+continuity 픽스처) / shared: `ipc.ts` / renderer: `reducer/chatReducer.ts`(+listen test)·`store/chatStore.ts`(+listen test)·`lib/parts.ts`(+stale-async test)·`components/{ChatTile,Composer,transcript/{PendingAssistant,AssistantMessage,SubagentNoticeRow(신규)}}.tsx`·`app/hooks/useCompletionNotifier.ts`·`shared/i18n/resources/{ko,en}.ts` / adapters test: `claude.canusetool.test.ts` / docs: provider-runtime·IPC_CONTRACT |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint 0 error(1 pre-existing warning: useTranscriptVirtualizer, 무관) / typecheck 3분할 0 error / vitest **1144/1144**(신규 ~35 — post-turn 8·session-runtime 5·coordinator 4·background-tasks 5·canusetool 재작성·reducer listen 9·store listen 7·parts stale 4; `chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) + scripts 25/25. grep 게이트 `ORCA_SUBAGENT_BACKGROUND\|backgroundSubagents` app/src **0건**. 레이어 경계 0, IPC 채널 수 불변(이벤트 variant/파트 additive), DB 마이그레이션 0(파트 JSON) |
| 블로커 / 역질문 | 없음. 라이브 실기(백그라운드 런치→listen 배달→통지·steer 무사망·중단 정착)는 electron 로드라 사람/CI 몫 |
| 대상 커밋 | (push 후 기재) |

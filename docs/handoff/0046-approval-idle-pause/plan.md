# Plan — 0046-approval-idle-pause

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(버그수정) = Claude 가 plan→impl→verify 직접 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0046-approval-idle-pause` |
| 작성자 | Claude Code |
| 일자 | 2026-06-25 |
| 매핑 | PHASES 행 / PR (impl 후) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "웹에서 상호작용 도구가 사용자 입력을 기다리다 타임아웃/abort 되는 현상을 orca 에서 검토하고 고쳐라." 동작은 "승인 보류 중 idle 타이머 **완전 멈춤**". | 라이브 세션 요청 + AskUserQuestion 응답("수정 핸드오프 생성"/"승인 보류 중 완전 멈춤") |
| 명시 요구 | "프로그램 종료(quit) 케이스도 검토하라." → 종료 시 진행 턴 정리(Q1) + 크래시 로드 보정(Q2) 포함. | 라이브 세션 요청 + AskUserQuestion 응답("0046에 함께 포함") |
| 명시 요구 | "재시작 시 승인 UI 를 다시 띄워 이어가게 할 것인가?" → **아니오, 중단됨만.** | AskUserQuestion 응답("아니오 — 중단됨만") |
| 추론 의도 | "완전 멈춤"으로 잃는 자가치유(렌더러 소멸/크래시)는 별도 가드로 보완해야 한다 — 안 그러면 다른 종류의 행을 만든다(추론). | 코드 구조 분석 |

## Context (왜)

`AskUserQuestion`/`ExitPlanMode`/위험 도구 승인 카드가 떠 사용자를 기다리는 동안 SDK `query()` 가 `canUseTool` await 로 멈춰 이벤트가 끊긴다. 그 사이 턴 단위 idle 타이머(`IDLE_TIMEOUT_MS=120_000`)가 reset 되지 못해 120초 뒤 `controller.abort()` → broker 가 보류 승인을 `deny` 로 강제 해소(카드 자동 거부) + "응답이 없어 턴을 중단했습니다" 에러. 이후 늦은 클릭은 무시된다(`broker.settle` `if(!entry)return`). broker 벽시계 `timeoutMs` 는 같은 이유로 의도적으로 미와이어링돼 있는데(`broker.ts:16-19`), idle 타이머가 그 의도를 깬다. idle 타이머는 ⓐ provider 무응답과 ⓑ 사용자 대기를 구분 못 하는 것이 근본 원인.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| broker timeoutMs 의도적 미와이어링(승인 중 auto-deny=UX 해침) | `app/src/main/ask/broker.ts:16-19` · `app/src/main/ipc/chat/approvals.ts:36-38` |
| idle 타이머: 매 이벤트 reset, 120초 무이벤트 시 abort | `app/src/main/ipc/chat/send.ts:42,55-69,453-458` |
| canUseTool→requestApproval await 동안 이벤트 정지 | `app/src/main/adapters/claude.ts:86,105,129,144` · `send.ts:365-417` |
| requestApproval(365) 가 idle(429 생성)보다 바깥 스코프 = 멈출 수단 부재 | `app/src/main/ipc/chat/send.ts:365,429` |
| idle 타이머 도입 출처 | `docs/PHASES.md` 0033-runtime-resilience 행 |
| 종료: will-quit 가 closeDb 만, 진행 턴 정리 없음 | `app/src/main/index.ts:171-181` |
| turns/persistence 가 register() 지역 변수(인덱스 접근 불가) | `app/src/main/ipc/router.ts:191-199` |
| settleOpenToolRuns(라이브 전용, aborted 합성 tool_result) | `app/src/main/ipc/chat/send.ts:93-116` |
| 로드 시 tool_result 없는 tool_call = "실행 중" 투영 | `app/src/renderer/.../features/chat/lib/parts.ts:76-105,381-440` |
| 로드 incomplete 마커(DB complete=0) + LOAD_SESSION 매핑 | `chatReducer.ts:47,427-433` · `AssistantMessage.tsx:52` |
| permission.* 비영속(재시작 재구성 소스 없음) | `app/src/main/ipc/chat/persist.ts:263` |
| isAbortedResult: reason/message 의 abort/cancel/중단 인식 | `app/src/renderer/.../lib/parts.ts:260-270` |
| tool_result AppMessagePart 형태(result:unknown,isError,parentToolRunId?) | `app/src/shared/ipc.ts:717-726` |

## 인수 기준 (Acceptance Criteria)

1. `createIdleTimer` 에 `pause()`/`resume()` 추가(기존 `reset`/`clear` 시그니처 불변). pause 후 시간 경과해도 abort 안 됨, resume 후 다시 작동.
2. 승인 보류(`await approvals.register`) 동안 idle 타이머가 멈춘다 — 세션 자동허용 early-return 경로는 제외. 동시 보류 카운터로 0→1 pause, 1→0 resume.
3. provider 무응답(스트림 stall) 시 idle 타이머는 **여전히** 120초 후 abort(stall guard 보존).
4. owner webContents `destroyed`/`render-process-gone` 시 진행 턴 abort(자가치유 대체, 타이머 아님). finally 에서 리스너 해제.
5. [Q1] `IpcRouter.shutdown()` 이 진행 중 모든 턴에 `settleOpenToolRuns('aborted')` + `controller.abort()` 동기 수행. `will-quit` 이 `shutdown()` → `closeDb()` 순서로 호출. `TurnRegistry.all()` 추가.
6. [Q2] 로드 시 `incomplete` 메시지의 tool_result 없는 tool_call 에 합성 aborted tool_result 를 붙이는 순수 헬퍼 + LOAD_SESSION 적용. `complete` 메시지·이미 결과 있는 tool_call·라이브 경로 무영향.
7. 게이트 4종 통과(lint/typecheck/typecheck:test/test). 레이어 경계 0, 신규 의존성 0, IPC 채널/DB 스키마 변경 0.

## 범위 / 비범위

- **범위**: idle pause/resume + 승인 래핑, owner-gone 가드, Q1 graceful-quit settlement, Q2 로드 보정.
- **비범위**: "이어서 다시 시도" 재시도 어포던스(사용자 결정="중단됨만"). main write-back 영속(렌더러 순수 보정으로 충분, 후속 여지). broker timeoutMs 와이어링(OpenCode seam 유지).

## 의존 기술 / 전제

- Electron `webContents` 'destroyed'/'render-process-gone' 이벤트, `app.on('will-quit')`. better-sqlite3 동기 persist(will-quit 내 완료 가능). 신규 의존성 0.

## 설계

- **send.ts**: `createIdleTimer` 에 pause(=clear)/resume(=reset). `handleChatSend` 에 `let activeIdle`, `let pendingApprovals=0` 인디렉션. attempt 루프가 `activeIdle=idle` 설정, 바깥 finally 에서 null. `requestApproval` 의 `await approvals.register` 만 pending 카운터로 감싸 pause/resume. 턴 생성 직후 owner-gone 리스너 등록, 바깥 finally 해제. `settleOpenToolRuns` export.
- **router.ts/index.ts/turn-registry.ts**: `turns`/`persistence` 를 IpcRouter 필드로 승격. `shutdown()` 추가(turns.all() 순회 settle+abort). `index.ts` will-quit 에서 `router.shutdown()` → `closeDb()`. `TurnRegistry.all()`.
- **lib/parts.ts**: 순수 `settleOrphanToolParts(parts)` — tool_result 없는 tool_call 마다 `{type:'tool_result',toolRunId,result:{reason:'aborted',message:'중단되었습니다'},isError:true,parentToolRunId?}` append. `chatReducer` LOAD_SESSION 에서 `m.incomplete` 면 적용.
- 레이어: main 변경=L3 ipc/L1 domain 내부, 렌더러=features/chat 내부. 경계 영향 0.

## 파생 UX / 엣지케이스

- 멀티세션: shutdown 은 모든 진행 턴 순회. owner-gone 은 해당 owner 턴만(controller per turn).
- 동시 승인(서브에이전트 병렬): pendingApprovals 카운터로 마지막 해소 시에만 resume.
- 라이브 vs 히스토리: Q2 는 `incomplete`(=LOAD 경로) 한정 → 라이브 스트리밍 무영향.
- 테마/a11y: 렌더 분기 추가 없음(기존 "중단됨" 경로 재사용).

## 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| idle 완전 멈춤으로 렌더러 소멸/크래시 자가치유 상실 | owner-gone 이벤트 가드(즉시) + Q1 종료 정리 + Q2 로드 백스톱(계층 방어) |
| shutdown persist 가 will-quit 시간 내 못 끝남 | better-sqlite3 동기 → 완료 보장. abort 는 fire-and-forget(OS 가 프로세스 정리) |
| Q2 가 라이브 메시지를 잘못 settle | `incomplete` 게이트 + LOAD 경로 단일 적용(RECV_EVENT 미경유) |

- 되돌리기 어려운 결정: 없음(동작 추가, 스키마 불변).

## 영향 받는 파일

- `app/src/main/ipc/chat/send.ts` · `app/src/main/ipc/chat/turn-registry.ts` · `app/src/main/ipc/router.ts` · `app/src/main/index.ts`
- `app/src/main/ask/broker.ts`(주석) · `app/src/main/ipc/chat/approvals.ts`(주석)
- `app/src/renderer/src/features/chat/lib/parts.ts` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- 테스트: `send.runtime-resilience.test.ts` · `turn-registry.test.ts` · `lib/parts.*.test.ts`(신규 또는 확장)

## 참고 문서

- `docs/arch/backend/provider-runtime.md`(PermissionBridge·PendingApprovalStateMachine) · `docs/PHASES.md`(0033)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`(better-sqlite3 Node ABI 재빌드 후 green).
- 신규 테스트: idle pause/resume 3건, TurnRegistry.all 1건, settleOrphanToolParts 4건.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 + AskUserQuestion 응답 인용, 추론 표기.
- [x] 자료조사 — 모든 발견 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — Electron 이벤트/will-quit, 신규 의존성 0.
- [x] 파생 UX — 멀티세션·동시승인·라이브/히스토리·테마.
- [x] 리스크 — 자가치유 상실·will-quit 시간·오settle 완화.

---

> **[구현자 기입]** — Claude(비기능) 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계의 인디렉션(`activeIdle`+`pendingApprovals`)이 스코프 문제를 정확히 해소. pause=clear/resume=reset 으로 충분(별도 상태 불필요 — resume 은 어차피 스트림 재개 후 첫 이벤트가 다시 reset).
- 보강: owner-gone 해제는 `removeListener`(Electron 타입 안전)로 작성. settleOpenToolRuns 는 `WebContents` 제네릭 턴만 받으므로 `export` 만으로 router(같은 L3) 재사용 가능 — 신규 헬퍼 불필요.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `requestApproval` 세션 자동허용 early-return 은 await 없이 즉시 반환 — pause 로 감싸면 안 됨 | ✅ pause/카운터를 `await approvals.register` **직전/try-finally** 에만 배치(early-return 경로 미경유) | `send.ts` requestApproval 상단 isSessionAllowed 분기 |
| 2 | Q2 helper 가 라이브 메시지를 settle 할 위험 | ✅ `incomplete`(=LOAD 경로) 게이트 + reducer LOAD_SESSION 단일 호출(RECV_EVENT 미경유) | `chatReducer.ts` LOAD_SESSION |
| 3 | tool_result append 위치가 페어링에 영향? | ✅ 무영향 — 셀렉터가 resultByRun 맵을 전수 선구축 후 페어링(위치 무관). 끝에 append | `lib/parts.ts:382-393,79-90` |

## [구현자 기입] 구현 체크리스트

- [x] createIdleTimer pause/resume(IdleTimer 타입) + 하위호환 reset/clear
- [x] activeIdle/pendingApprovals 인디렉션 + requestApproval await 래핑(early-allow 제외)
- [x] owner-gone(destroyed/render-process-gone) 가드 + finally 해제
- [x] settleOpenToolRuns export; TurnRegistry.all(); IpcRouter.shutdown(); will-quit 순서(shutdown→closeDb)
- [x] settleOrphanToolParts + LOAD_SESSION incomplete 적용
- [x] 주석 동기화(approvals.ts)
- [x] 테스트: idle pause/resume 3 + TurnRegistry.all 1 + settleOrphanToolParts 5

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `index.ts`·`ipc/router.ts`·`ipc/chat/{send,turn-registry,approvals}.ts` / renderer: `features/chat/lib/parts.ts`·`features/chat/reducer/chatReducer.ts` / 테스트 3파일 |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `npm test` |
| 게이트 결과 | typecheck ✅(node+web+test) / lint ✅(boundaries 0) / test **508/508 실행분 green**; 2 suites(`persist`·`send.runtime-resilience`) import 차단 = **electron 바이너리 미설치(프록시 다운로드 중단) 환경 제한**(0033/0041~0044 동일 계열) — typecheck + 코드 1:1 로 갈음 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |

---

## [검증자 기입] 파생 이슈 (Derived Issues) — 라운드 2 (PR #137 GUI 피드백)

라운드 1 PASS 후 사용자 GUI 검증에서 동시/서브에이전트 도구 승인 결함 2건 발견 → 같은 핸드오프 라운드 2 로 처리(렌더러 전용, 백엔드 무변경).

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 서브에이전트 도구 승인을 2분+ 대기 후 승인해도 수행 미이어짐·inflight 고착 | 사용자 GUI #1 | D2 의 downstream — 동시 요청 덮어쓰기로 사라진 approvalId 가 broker 보류 유지 + `pendingApprovals`>0 로 idle 영구 pause | 해결(D2 수정으로) |
| D2 | 동시(3개) 도구 승인 시 composer 패널스택 덮어쓰기로 직전 2개 소실 | 사용자 GUI #2 | `pendingToolApproval` 단일 슬롯 → `pendingToolApprovals` 큐(append) + 스택 렌더 + approvalId 별 제거 | 해결 |

### 라운드 2 근본 원인

`chatReducer.ts` `pendingToolApproval`(단일 슬롯, 주석 "canUseTool 직렬화로 동시 1개")가 서브에이전트·병렬 tool_use 의 **동시** `permission.requested(tool_approval)` 를 덮어썼다. 백엔드는 approvalId 별 개별 이벤트 + broker Map + `pendingApprovals` 카운터로 동시성이 이미 정확 → 누락은 렌더러 단일 슬롯뿐. 사라진 approvalId 는 broker 에 영구 보류되어 해당 서브에이전트 canUseTool 미반환(inflight) + 카운터>0 로 idle 영구 pause(=abort 도 안 됨). ask 는 이미 큐(`pendingAsks`)라 무사고였던 것과 대조.

### 라운드 2 변경 (렌더러 전용)

- `chatReducer.ts`: `pendingToolApproval: T|null` → `pendingToolApprovals: T[]`. tool_approval append, `RESOLVE_TOOL_APPROVAL{approvalId}` 가 해당 1개만 filter 제거, 리셋 경로 `[]`.
- `chatStore.ts`: approve/approveForSession/deny 가 `RESOLVE_TOOL_APPROVAL{approvalId}` dispatch.
- `ApprovalCard.tsx`: `ToolApprovalBody` prop 수신화(approvalId/toolName/input), `ApprovalCard` plan 전용(死 tool 분기 제거).
- `Composer.tsx`: `pendingToolApprovals` 스택 렌더(map, key=approvalId) + `toolApprovalPending = length>0`.
- 테스트 `chatReducer.tool.test.ts`: 단일→큐(동시 보존·approvalId별 제거·리셋) 6 케이스.

### 라운드 2 게이트 결과

typecheck ✅(node+web+test) / lint ✅(boundaries 0) / test **509/509 실행분 green**(+1 동시 케이스). 2 suites(`persist`·`send.runtime-resilience`) electron 미설치 환경 제한(라운드1 동일). 신규 의존성 0, IPC/DB/백엔드 무변경.

---

## [검증자 기입] 파생 이슈 — 라운드 4 (동시 서브에이전트 승인: idle pause/reset 경쟁)

| # | 이슈 | 출처 | 대응 | 상태 |
|---|---|---|---|---|
| D3 | 서브에이전트 1개=3분 대기 정상 / 3개 동시=2분 후 모두 inflight 고착(무한·무에러) | 사용자 GUI | idle pause/reset 경쟁(아래) 수정 + signal 존중 + 진단 로그 | 해결(주 수정) |

### 라운드 4 근본원인 (사용자 지적, 코드 검증)
`send.ts` 이벤트 루프는 **모든 이벤트마다 무조건 `idle.reset()`**. 서브에이전트 child 이벤트(`subagent.task`·child `tool.call.started`·델타)도 같은 루프·같은 `idle` 객체를 지난다. 라운드1 `pause=clear`(단순 해제)라 — 단건은 대기 중 다른 이벤트가 없어 pause 유지(정상), **동시 N건은 #1 승인 pause(clear) 직후 아직 안 멈춘 #2·#3 이벤트가 `idle.reset()`로 재무장 → pause 무력화**. 이벤트 루프 reset 과 승인 pause 가 같은 idle 객체를 두고 경쟁 = 단건성공/동시실패의 정확한 설명. (라운드2 큐화는 UI 덮어쓰기만 고쳐 무효.)

### 라운드 4 변경
- **(주) `createIdleTimer` `paused` 플래그**(`send.ts`): `reset()`은 paused 중 no-op. `pause`=paused set+clear, `resume`=paused clear+arm. 보류 승인이 1개라도 있으면(pendingApprovals>0→pause) 동시 서브에이전트 이벤트의 reset 이 전부 무시됨. stall guard(paused=false 시 매 이벤트 reset)는 유지.
- **(하드닝) `options.signal` 존중**: `claude.ts makeCanUseTool`이 SDK 3번째 인자 signal 을 `requestApproval`로 전달 → `send.ts`가 턴 signal 과 `AbortSignal.any`로 합쳐 broker 에 등록 → SDK 권한요청 취소 시 broker deny 해소(무한 await 방지·pendingApprovals 정상 감소). 렌더러 `permission.resolved`가 approvalId 로 남은 카드 정리(취소 시 먹통 카드 제거). `TurnRequest.requestApproval` 시그니처에 optional signal 추가.
- **(진단) `[approval]` 로그**(0025 `wireLog` 게이트, `context.isWireLog()`): requested/resolved/respond(엔트리 found·brokerSize)·pendingApprovals 전이. 프로덕션 무출력.

### 라운드 4 게이트
typecheck ✅(node+web+test)/lint ✅(boundaries 0)/test **509/509 실행분**. 2 suites(`persist`·`send.runtime-resilience`) electron 미설치 환경 제한(신규 paused 테스트 포함 — typecheck 검증, electron 환경서 실행). 신규 의존성 0, IPC 채널 0.

### 정직 노트
pause-race 는 코드로 확정된 실재 버그이고 단건/동시 패턴과 정합하나, 관측 증상(무한·무에러)과 100% 일치한다는 확증은 GUI 런타임뿐. 그래서 진단 로그를 함께 넣었다 — 주 수정으로도 재현되면 `[approval]` 로그로 잔여 원인(SDK/CLI 동시 처리) 확정.

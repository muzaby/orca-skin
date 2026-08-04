# Plan — 0166-session-chain-lease

> **출신**: `0165` r5 리뷰(5라운드 · 24건)에서 **소유권·제어·제출 권위**에 해당하는 항목을
> 분리한 핸드오프(사용자 결정 ⑦). 0165 는 보고 증상 직결분만 갖는다.
> **선행**: 0165(메시지-원자 배치 라우팅 · channel incarnation token · attempt identity) —
> 본 문서는 그 토큰·attempt 를 **전제로** 쓴다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0166-session-chain-lease` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 |
| 상태 | DRAFT → **READY** |
| 선행 / 후속 | 선행 `0165` · 후속 `0167`(활동 스냅샷 — 본 문서의 lease 수명을 입력으로 쓴다) |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "**구조적 결함을 반드시 극복하되 사용자 경험을 해치지 말 것**" | 라이브 세션(0165 문맥, 반복 지시) |
| 명시 요구 | "**핸드오프 문서 작성까지**" | 동상 |
| 사용자 결정 | **3개 핸드오프로 분할** — 소유권 계층을 본 문서로 | 라이브 세션 |
| 외부 리뷰 | 0165 r4·r5 리뷰의 P1 다수가 이 계층을 지목 | PR 리뷰 4·5차 |
| 추론 의도 | 사용자는 ①② 증상을 보고했지만, 그 조사 중 드러난 **미보고 결함 4종**(D3~D7)도 같은 뿌리라 함께 닫는다 (추론) | §자료조사 |

## Context (왜)

0165 조사 과정에서 **세션 소유권이 개별 turn 의 수명에 묶여 있다**는 것이 드러났다. registry 는
`Map<sessionId, TurnContext>` 로 *turn* 을 담고, admission·재시작 게이트·shutdown·중단이 전부
"현재 turn 이 있는가" 로 판정한다. 그래서 **turn 이 없는 구간이 곧 제어 공백**이 된다.

이 공백은 사용자에게 이렇게 나타난다 — 같은 세션에 CLI 서브프로세스가 둘 뜨고, 작업 중인데
업데이트가 설치되고, 앱을 종료해도 서브프로세스가 남고, 백그라운드 서브에이전트 중단 버튼이
아무 일도 하지 않는다. **넷 다 현행 결함이며 아직 아무도 보고하지 않았을 뿐이다.**

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당.** 네 결함(D3~D7)이 **하나의 원인**(turn 수명 = 소유 단위)에서 나온다. 개별로 고치면 네 곳에 각각 방어 코드가 생기고 다섯 번째 구멍이 남는다 | §자료조사 |
| 이미 있는 것 아닌가 | **없다.** "체인이 진행 중" 을 표현하는 타입이 없다. `hasSession` 은 turn 등록의 파생일 뿐이다 | `session-registry.ts:3-5`, `:13-15` |
| 더 작은 해법이 있는가 | **부분적으로 있다 — 그리고 그건 함정이다.** 예컨대 "listen child 를 release 하지 않는다" 로 창 하나는 막을 수 있지만, **동시 전송 2건의 창**(`:394`↔`:552`)은 그대로 남는다. 소유 단위를 올리지 않으면 창을 하나씩 막는 일이 끝나지 않는다 | `chat-turn.ts:394`, `:456`, `:552` |
| 인용 자료(리뷰)가 요구를 부풀리지 않았나 | **1건 정정.** 리뷰의 "지각 훅이 새 채널에 push 한다" 는 **현행에선 불가능**하다(훅이 자기 채널 `input` 을 캡처). 다만 **본 문서가 push 를 Runtime 으로 옮기는 순간 생기는 위험**이므로 `expectedToken` 요구사항으로 반영한다 | `claude.ts:327`, `:393-397` |
| 기존 채택 결정을 뒤집는가 | **문서화된 채택 결정 0건.** registry 의 turn 단위 등록은 *구조*(결정 문서 없음) — 구조 변경으로 표기 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음.

## 자료조사 (Research)

> 인용 라인은 이번 세션에서 직접 열어 확인했다.

| 발견 | 레퍼런스 |
|---|---|
| **[결함 D7] 동시 전송 2건이 이중 체인을 만든다.** busy 판정 `:394` → `await resolveTurnProvider` `:456` → 등록 `:552`. 두 send 가 그 사이를 함께 통과하면 각자 체인을 연다 | `chat-turn.ts:394`, `:456`, `:552` |
| **이중 런타임까지 간다.** `RuntimePool` 은 **idle 만** 보관하므로 첫 체인이 체크아웃한 동안 `pool.take()` 가 `undefined` → `acquireRuntime` 이 `factory()` 로 새 `SessionRuntime` 을 만든다 | `runtime-pool.ts:15`, `:21-28` · `supervisor.ts:114-119` |
| **먼저 반납된 런타임이 조용히 닫힌다.** `keepIdle` 이 같은 키의 이전 핸들을 `closeEntry` 한다 | `runtime-pool.ts:32-37` |
| **[결함 D4] 작업 중 업데이트 설치가 허용될 수 있다.** `restartGateState()` 가 `isGenerating: turns.length>0` 을 `all()` 로만 계산하고, 게이트는 `!isGenerating` 이면 설치를 진행한다. 턴-후 루프의 child 교체 창에서 `all()` 은 비어 있다 | `bootstrap.ts:489-494` · `shared/update-restart.ts:10` |
| **[결함 D5] 종료 시 active 서브프로세스가 잔존한다.** `shutdown` 은 `all()` abort + `closeIdleRuntimes()`(idle 풀만) — 교체 창의 active runtime 은 둘 중 어디에도 없다 | `bootstrap.ts:553-560` · `runtime-pool.ts:64-68` |
| **[결함 D3] "세션 전체 중단" 이 active runtime 을 못 죽인다.** `discardRuntime` 은 idle 풀만 닫는다. 주석이 "진행 중 턴의 런타임은 풀 밖이라 여기서 잡히지 않는다" 고 자인 | `supervisor.ts:141-149` |
| **[결함 D6] 서브에이전트 제어 상태가 턴마다 리셋된다.** `subagentTaskIds`·`subagentTypes`·`stoppedSubagents` 가 `freshTurnLocalState()` 에 있어 연속·listen 턴마다 비워진다 → listen 중 중단이 `stopTask` 에 도달하지 못한다 | `chat-turn.ts:96-112`, `:1163-1170` |
| **provider 경계 판정도 turn 을 읽는다** — `crossesProviderBoundary(turn.providerKey, …)` | `chat-turn.ts:298-311` |
| **정착은 tracker ids 에 의존한다** — `settleTrackedTasks` 는 `ids.length===0` 이면 즉시 반환. 세대 스코프가 ids 를 *숨기면* 정착 대상까지 잃어 transcript 가 "실행 중" 으로 고착된다 | `settle.ts:68-76`, `:102-107` |
| **steer push 는 어댑터가 한다** — `makeSteerGateHook(take, (batch) => input.push(…), rollback)`. `input` 은 spawn 마다 생성돼 훅이 **자기 채널**을 캡처한다 | `claude.ts:327`, `:393-397` · `claude-adapt.ts:146-178` |
| registry 소비처 **전수 9곳** — shutdown 2 · chat-turn 6 · approvals 1 | `rg 'getBySession\|hasSession(\|hasPending(\|\.all()' src/main` |
| `refreshGate()` 호출 지점은 `bootstrap.ts:504` **1곳** — lease 수명과 연동되지 않는다 | `bootstrap.ts:504` · `updater.ts:112` |
| `isSessionLive`(`chat-turn.ts:493`)는 recovery 가 살아 있는 세션의 dangling 복구를 건너뛰는 데 쓴다 — lease 로 참이 길어지면 **더 보수적**(안전 방향) | `features/chat/recovery.ts:11`, `:31` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함

> **소유권이 안쪽 수명(turn)에 묶여 있고, 세션 수명의 사실이 turn-local 에 산다.**

| # | 발현 | 결함 |
|---|---|---|
| F-E | admission·제어가 "현재 turn" 파생 → turn 없는 구간 = 제어 공백 | D3·D4·D5·D7 |
| F-F | 세션 수명 사실(서브에이전트 제어·providerKey)이 turn-local | D6 + provider 경계 |
| F-G | 입력 제출 경로가 둘(Runtime / 어댑터 훅) → "어느 채널에 실렸는가" 를 한 곳에서 기록 불가 | 0165 의 잔여 판정 정밀도 상한 |

## 설계

### 원칙

> ④ **소유권은 가장 바깥 수명에서 잡는다** ⑤ **세션 수명의 사실은 세션 수명 객체가 든다**
> ⑥ **권위는 하나다** — 같은 행위(입력 제출)에 경로가 둘이면 어느 쪽도 사실을 기록할 수 없다.

### A. SessionChainLease — 상태머신 (F-E, 리뷰 P1-1·P1-2)

```ts
type SessionChainLease<W> =
  | { kind: 'preparing'; leaseId; chainId; owner: W; sessionId: string | null
      controller: AbortController }                       // runtime·providerKey 아직 없음
  | { kind: 'active';    leaseId; chainId; owner: W; sessionId: string | null
      runtime: ManagedRuntime; providerKey: string
      control: SessionControl; activeChild: TurnContext<W> | null }
  | { kind: 'closing';   leaseId; chainId }                // 반납·정리 중, 신규 begin 차단
```

- **`preparing` 은 동기 검증 직후 첫 `await` 전에 등록**한다(P1-1) — 그래야 `await
  normalizeAttachments`/`resolveTurnProvider` 구간에서 두 번째 체인이 열리지 않는다.
  `runtime`·`providerKey` 는 **그 시점에 알 수 없으므로** 상태로 분리한다.
- **준비 실패 UX**: preparing 중 실패하면 그 사이 합류한 held 메시지를 ⓐ 다음 leader 로 넘기거나
  ⓑ draft 로 복원하고 사용자에게 사유를 알린다 — **조용한 유실 금지**(AC-A4).
- **해제는 `leaseId` 정체성으로**(P1-2). 신규 세션은 owner 키 → `promote` 로 sessionId 키로
  승격되므로 **외부 키를 인자로 쓰면 과거 키로 지워 lease 가 영구 잔류**한다.
- **반납 순서**(P1-2): `runtime` 반납/close **→ 그다음** lease 해제. 반대면 게이트가 idle 로
  보는데 runtime 은 아직 active 인 창이 생긴다.
- **child 교체는 `swapChild(prev, next)` 원자 연산** — null 창을 만들지 않는다.
- 소비처 매핑(전수 9곳): `hasSession` → lease 존재 · `getBySession` → `activeChild` ·
  **`allLeases()` 신설** → 게이트·shutdown.

### B. 제어 권위 이관 (F-F, 리뷰 P1-1·P2-18)

- `SessionControl` = `{ taskIds, subagentTypes, stoppedSubagents, blockedSubagents, cancelled }`
  를 **lease 로 옮긴다.** `freshTurnLocalState()` 에서는 **제거**한다(복제 금지).
- 전송 admission 은 `lease.runtime.canSteer` + **`lease.providerKey`** 로 판정한다 —
  nullable child 를 읽지 않는다. **`providerKey` 만** 든다(모델·settings 신선도는 runtime 권위).
- 서브에이전트 중단은 lease control 을 읽으므로 **연속·listen 턴에서도 `stopTask` 에 도달**한다.
- **정리 시점**(P2-18): `settled` 관측 시 해당 키 제거, lease 해제 시 전량 폐기.

### C. 제출 포트 단일화 (F-G, 리뷰 P1-3·P1-6)

- 어댑터에 push 클로저를 주지 않는다. Runtime 이 구현한 **`submitSteer(batch)` 포트**만 넘기고
  게이트 훅은 **요청만** 한다(훅의 fail-open·rollback·경고 로그 구조는 **그대로 보존**).
- **`submitSteer` 는 생성 시점 `expectedToken` 을 캡처**하고, 호출 시 현재 채널 토큰과 다르면
  **no-op/stale 을 반환**한다(P1-6 — 포트 도입이 만드는 신규 위험의 필수 방어).
- **네 경로 전부** 이 포트를 지난다: 최초 전송 · 자동 연속 턴 · respawn 프렐류드 · PostToolBatch.
- 순서: draining 확인/필요 시 respawn → `ensureChannel()`(0165 의 incarnation token) →
  큐 **CAS `submitting(token)`** → push → 성공 `submitted` / 실패 `held` 롤백.
  **CAS 실패 = 이미 취소·폐기** → **push 하지 않고 채널도 폐기하지 않는다**.

### D. 레이어 경계 — 포트 2종 (리뷰 P1-3)

`features/sessions` 와 `features/chat` 은 **서로 import 할 수 없다**(lint error). 컴포지션 루트가
주입한다:

| 포트 | 소비자 | 제공자 | 메서드 |
|---|---|---|---|
| `SubmissionAttemptPort` | `SessionRuntime`(sessions) | `PendingMessageQueue`(chat) | `begin(attempt, token)` / `commit` / `rollback` |
| `SessionControlPort` | `TurnCoordinator`·핸들러(chat/app) | lease(sessions) | task 매핑 조회·기록, stopped/blocked/cancelled |

### E. 종료 경로 원자성 (리뷰 P1-9·P1-10·P1-15)

- **게이트**: `isGenerating` 을 **lease 수**로 판정(단 `preparing` 은 runtime cap 에서 제외 — P2-17).
  `activeToolCallCount` 는 `activeChild?.openToolRuns.size ?? 0` 합. **lease
  acquire/promote/activate/release 마다 `refreshGate()`** 를 호출한다(P1-9 — 현행은 호출 지점이
  1곳뿐이라 마지막 lease 해제에서 갱신되지 않는다).
- **shutdown 순서**(P1-10) — 기존 경로를 **대체가 아니라 확장**한다:
  ① preparing controller 취소 → ② 각 `await` 뒤 cancelled/frozen 재검사(신규 runtime factory 금지)
  → ③ active child 정착(`settleOpenToolRuns`)·abort → ④ **모든 lease 의 runtime close** →
  ⑤ idle 풀 close → ⑥ 큐 dispose.
- **`retireChannel(token)`**(P1-8): 세대 교체 시 트래커 엔트리를 *숨기지 않고* **정착 대상 ids 를
  반환**한다. 호출자가 합성 settled 를 영속·전달한 뒤 제거한다 — transcript 고착 방지.
- **discard CAS**(P1-15): "세션 전체 중단" 을 원자화한다 — ⓐ 해당 세션 신규 begin 차단
  (`closing`) → ⓑ 현재 토큰 무효화 + runtime close → ⓒ 그 시점 **모든 open 배치 폐기** →
  ⓓ draft 복원 이벤트 → ⓔ admission 재개.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `SessionChainLease` + lease registry | 세션 소유·제어 권위 | features/sessions | 순수 단위 — `session-registry.test.ts`·`supervisor.test.ts` |
| `SubmissionAttemptPort`·`SessionControlPort` | 레이어 경계 절단 | contracts(타입) + app(주입) | 구조적 포트 — fake 구현으로 양쪽 단위 테스트 |
| `SessionRuntime.submitSteer`(expectedToken) | 제출 권위 | features/sessions | 순수 단위 — fake live 채널 harness |
| `retireChannel(token)` | 세대 교체 시 정착 | features/chat(tracker) | 순수 단위 — `background-tasks.test.ts` |
| shutdown/gate/discard 배선 | 종료 원자성 | app | `bootstrap.*.test.ts`(신규 2) + 기존 harness |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A1 | **동시 전송 2건이 체인 1개·runtime 1개만 만든다**(두 번째는 기존 체인의 held 큐로) | `chat-turn.lease.test.ts::"동시 전송은 체인을 하나만 연다"` | `chat:send` ×2 → `preparing` lease |
| A2 | listen child 교체 중 전송도 **기존 체인에 예약**된다(`message.queued` 수신) | `chat-turn.lease.test.ts::"child 교체 창의 send 는 기존 체인에 예약된다"` | 턴-후 루프 child 교체 |
| A3 | 교체 창의 send 가 **provider 경계 검사를 받는다** — 같으면 `message.queued`, 다르면 안내 메시지 | `chat-turn.lease.test.ts::"activeChild 부재에도 provider 경계가 판정된다"` | `reserveOnBusySession` → `lease.providerKey` |
| A4 | **preparing 실패 시** 그 사이 합류한 held 가 다음 leader 로 인계되거나 draft 로 복원되고 사용자에게 사유가 전달된다 | `chat-turn.lease.test.ts::"준비 실패는 held 를 유실하지 않는다"` | provider 해석 실패·첨부 오류 |
| A5 | lease 해제는 **leaseId 일치 시에만** 일어난다(지각한 이전 체인이 새 lease 를 지우지 않는다) | `supervisor.test.ts::"leaseId 불일치 해제는 무시된다"` | outer `finally` |
| A6 | **승격(promote) 후에도 해제가 성립**한다 — owner 키로 시작한 lease 가 sessionId 승격 뒤 정상 해제된다 | `supervisor.test.ts::"승격된 lease 도 leaseId 로 해제된다"` | 새 채팅 첫 전송 |
| A7 | **반납 순서**: runtime 반납/close 가 lease 해제보다 **먼저** 일어난다 | `chat-turn.lease.test.ts::"runtime 반납 후 lease 가 해제된다"` | outer `finally` |
| A8 | `swapChild` 전후로 **`hasSession` 이 계속 true** 다 | `supervisor.test.ts::"swapChild 는 hasSession 을 흔들지 않는다"` | child 교체 |
| A9 | **child 사이에 누른 Stop 이 체인을 종료**시킨다 | `chat-turn.lease.test.ts::"activeChild 부재 시 Stop 이 체인을 멈춘다"` | `chat:cancel` → `control.cancelled` |
| A10 | **listen 턴 중 서브에이전트 중단이 `stopTask` 까지 도달**한다(lease control) | `chat-turn.lease.test.ts::"listen 중 중단이 taskId 로 도달한다"` | `chat:stopSubagent` |
| A11 | `settled` 관측 시 control 엔트리가 제거되고, lease 해제 시 전량 폐기된다 | `supervisor.test.ts::"control 은 settled·해제에서 정리된다"` | 서브에이전트 수명 |
| A12 | child 없는 구간에도 `restartGateState().isGenerating === true` 라 **작업 중 업데이트 설치가 차단**된다 | `bootstrap.restart-gate.test.ts::"child 없는 lease 도 isGenerating 이다"` | `update:*` → `restartGateState` |
| A13 | **lease 수명 전이마다 `refreshGate()` 가 호출**돼 마지막 해제 후 게이트가 idle 로 갱신된다 | `bootstrap.restart-gate.test.ts::"lease 해제가 게이트를 갱신한다"` | `UpdateController.refreshGate` |
| A14 | `preparing` lease 는 **runtime cap 계산에서 제외**된다(느린 준비가 무관한 세션을 거절하지 않는다) | `supervisor.test.ts::"preparing 은 runtime population 에 세지 않는다"` | `enforceCap` |
| A15 | shutdown 이 **① preparing 취소 ② active child 정착·abort ③ 모든 lease runtime close ④ idle close ⑤ 큐 dispose** 순으로 수행된다 | `bootstrap.shutdown.test.ts::"종료 순서가 보장된다"` | 앱 종료 |
| A16 | shutdown 중 **신규 runtime factory 가 실행되지 않는다**(준비 중 체인이 되살아나지 않는다) | `bootstrap.shutdown.test.ts::"종료 중 신규 spawn 이 없다"` | 동 A15 |
| A17 | **"세션 전체 중단" 이 active runtime 을 종료**하고, 그 시점 **모든 open 배치를 폐기**하며, 그 사이 신규 begin 이 차단된다 | `supervisor.test.ts::"discard 는 active runtime 을 닫는다"` · `chat-turn.lease.test.ts::"discard 중 신규 제출이 차단된다"` | 잔여 Notice → `chat:discardSession` |
| A18 | `submitSteer` 는 **`expectedToken` 불일치 시 stale 을 반환하고 push 하지 않는다** | `session-runtime.test.ts::"토큰 불일치 submitSteer 는 push 하지 않는다"` | 구 채널의 지각 훅 |
| A19 | **PostToolBatch steer 도 Runtime 포트를 지나** 토큰에 결합된다(어댑터 직접 push 0) | `adapters/claude.steer-port.test.ts::"게이트 훅은 submitSteer 를 부른다"` | CLI 훅 |
| A20 | 훅의 **fail-open·rollback·경고 로그가 보존**된다(포트 교체가 steer 를 조용히 끊지 않는다) | `claude-adapt.test.ts::"포트 거부 시 rollback + 경고 로그"` | 동 A19 |
| A21 | **`retireChannel(token)` 이 정착 대상 ids 를 반환**하고, 호출자가 합성 settled 를 전달한 뒤 제거한다(transcript 가 '실행 중' 으로 남지 않는다) | `background-tasks.test.ts::"retireChannel 은 정착 대상을 반환한다"` · `chat-turn.lease.test.ts::"세대 교체가 열린 태스크를 정착시킨다"` | respawn |
| A22 | `features/sessions` ↔ `features/chat` **직접 import 0** — 포트 2종을 컴포지션 루트가 주입한다 | `npm run lint`(boundaries) + `supervisor.test.ts` 의 fake 포트 사용 | 빌드 게이트 |
| A23 | 실기: 백그라운드 서브에이전트가 도는 세션에서 연속 전송을 반복해도 **CLI 서브프로세스가 세션당 1개**로 유지되고, 앱 종료 후 **잔존 프로세스가 0** 이다 | **사람 실기** — `npm run dev` + `ps` 확인(전송 5회 반복 → 종료) | 앱 전체 |

## 범위 / 비범위

- **범위**: A~E + AC 23건.
- **비범위**: 활동 스냅샷·대기 표시(**0167**) · 메시지-원자 라우팅과 incarnation token(**0165** 선행) ·
  `RuntimePool` 을 active/idle 2단으로 일반화(lease 가 active 를 들므로 풀은 저장소로 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 |
|---|---|
| 스냅샷·대기 UX | **아니오** — 0167 이 lease 수명을 구독만 하면 된다 |
| RuntimePool 2단화 | **아니오** — lease 가 소유를 표현하므로 풀 변경 없이 성립 |

## 의존 기술 / 전제

- **선행 의존**: 0165 의 `ensureChannel()` incarnation token · `SubmissionAttempt`.
  0165 없이 착수하면 C 의 토큰 결합과 E 의 `retireChannel` 이 기준점을 잃는다.
- 전제 1: registry 소비처는 **9곳**이며 `hasSession`/`getBySession`/`all()` 3술어로 표현된다.
- 전제 2: in-process 백그라운드 태스크는 서브프로세스와 함께 죽는다(0136 승계).
- 전제 3: 훅은 자기 채널 `input` 을 캡처하므로 **현행에는** 교차 채널 push 가 없다 — C 가 그
  전제를 바꾸므로 `expectedToken` 이 필요하다.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 이번 변경 |
|---|---|---|
| registry 의 turn 단위 등록 (구조, 결정 문서 없음) | `session-registry.ts:3-5` | **구조 변경** — 등록 단위를 체인으로. 3술어 계약 유지 + `allLeases()` 신설 |
| 게이트·shutdown 이 `all()` 로 판정 (구조) | `bootstrap.ts:489-494`, `:553-560` | **구조 변경 + 현행 결함 수정** |
| 세션 제어 상태를 turn-local 에 보관 (구조) | `chat-turn.ts:96-112` | **구조 변경** — lease 로 이관(복제 금지) |
| 어댑터가 steer push 수행 (구조) | `claude.ts:393-397` | **구조 변경** — 요청만, push·결합은 Runtime |
| 0151 "처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | **유지** — 선택지는 그대로, 처분이 **실제로 동작**하게 된다 |
| 0136 릴리즈 밸브 · 0153 admission · 0143 표시 | 각 주석 | **유지** |
| main 레이어 DAG(feature 교차 금지) | `eslint.config.mjs` | **준수** — 포트 2종 + 루트 주입(AC-A22) |

## 파생 UX / 엣지케이스

- **준비 중 종료**: preparing controller 취소 → 신규 spawn 금지(A16).
- **준비 실패**: held 인계 또는 draft 복원 + 사유 통지(A4) — 조용한 유실 금지.
- **승격 경계**: owner 키 lease → sessionId 승격 후에도 leaseId 로 해제(A6).
- **discard 와 제출 경합**: `closing` 이 신규 begin 을 막아 "런타임은 죽었는데 큐에 새 배치" 를
  구조적으로 없앤다(A17).
- **recovery**: `isSessionLive` 가 체인 내내 true → 살아 있는 세션의 dangling 복구를 건너뛴다(안전).
- **handoff 가드**: `hasSession(handoffFrom)` 이 더 오래 true → 진행 중 세션 핸드오프가 확실히
  거부된다(보수적).

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| **lease 누수 = 세션 영구 busy**(모든 send 가 held 로만 쌓임) | 해제는 outer `finally` 단일 지점 + leaseId CAS. shutdown 이 강제 정리(A15). 0167 스냅샷이 lease 존재를 항상 관측 가능하게 노출 |
| 포트 도입이 steer 를 조용히 끊을 수 있다 | 훅의 fail-open·rollback·경고 로그 **구조 보존**(A20) + 포트 호출 자체를 AC 로 잠금(A19) |
| 세대 스코프가 정착 대상을 잃게 할 수 있다 | `retireChannel` 이 **반환**하고 호출자가 정착(A21) — 숨기지 않는다 |
| 9곳 소비처 회귀 | 3술어 계약 유지 + `allLeases()` 는 **신설**(기존 시그니처 무변경). A12·A15 가 게이트·종료를 양성 단언 |
| diff 가 크다 | 커밋을 A(상태머신) → B(제어 이관) → C/D(포트) → E(종료 원자성) 순으로 쪼갠다. **A 만 들어가도 D7 이 닫힌다** |

- 되돌리기 어려운 결정: 없음(공개 계약·스키마 무변경).
- **Open Question**: 없음.

## 영향 받는 파일

- `app/src/main/features/sessions/session-registry.ts` · `supervisor.ts` — lease 상태머신 ·
  `swapChild` · CAS 해제 · `allLeases()` · `discardRuntime` 이 active 도달
- `app/src/main/features/sessions/session-runtime.ts` — `submitSteer(expectedToken)` · CAS 연동
- `app/src/main/contracts/ports.ts` — `SubmissionAttemptPort` · `SessionControlPort`
- `app/src/main/features/chat/pending-message-queue.ts` — `submitting` CAS(포트 구현)
- `app/src/main/features/chat/background-tasks.ts` — `retireChannel(token)`
- `app/src/main/app/chat-turn.ts` — lease 수명 · 제어 이관(`freshTurnLocalState` 축소) ·
  `canSteer`/`providerKey` 판정 교정
- `app/src/main/app/bootstrap.ts` — 게이트·shutdown·포트 주입
- `app/src/main/adapters/{claude,claude-adapt}.ts` — 게이트 훅이 포트 호출

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: supervisor/registry 8 · bootstrap 4 · session-runtime 2 · background-tasks 1 ·
  어댑터 2 · chat-turn harness 8.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 요구·결정 인용, 추론 표기(미보고 결함 4종 동반 처리)
- [x] 자료조사 — 14행 전부 `파일:라인`, 앵커를 직접 열어 확인
- [x] 의존 기술 — 전제 3건 + **선행 의존(0165)** 명시, 신규 의존성 0
- [x] 파생 UX — 준비 중 종료·준비 실패·승격 경계·discard 경합·recovery·handoff 6건
- [x] 리스크 — 5건 + 완화책, Open Question 0
- [x] `검증 수단` 공란 0 — AC 23건 중 22건 `파일::케이스`, 1건 사람 실기(`ps` 절차 명시)
- [x] 부정형 기준 0개 — A16·A18·A22 는 "신규 spawn 이 없다"·"push 하지 않는다"·"직접 import 0" 을 **lint/호출 관측**으로 단언
- [x] AC 간 모순 없음 — A1↔A2(동시 전송 / 교체 창, 같은 규칙의 두 경로) · A5↔A6(CAS 해제 / 승격 후에도 성립) · A12↔A14(lease 는 세되 preparing 은 cap 제외) · A18↔A19(포트를 부르되 토큰 불일치는 stale) · A21↔A17(정착 후 폐기 / discard 는 즉시 폐기 — 서로 다른 트리거)
- [x] 인용 수치 직접 측정 — registry 소비처 **9** · `refreshGate` 호출점 **1** · 게이트 기준선 이번 세션
- [x] 신규 모듈 테스트 방법 — 5항목 전부. 포트는 **fake 구현**으로 양쪽 순수 테스트
- [x] 전수 조사 N — registry 소비처 9 · shutdown 소비 2 · 제출 경로 4
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(A23)에 실행 절차(`ps`)가 있고 비범위에 막혀 있지 않다
- [x] 소비 계약의 제약 필드 강제 지점 — lease(획득·CAS 해제)·control(기록·정리)·토큰(발급·검사)·포트(주입 지점)를 §A~E 에 명시
- [x] 미룬 항목 일방향 여부 — 2건 "아니오" + 근거
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 7행을 본문 문장 기준으로 채웠고 인용 경로를 열어 확인

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만 | … |

## [구현자 기입] 구현 체크리스트

- [ ] A lease 상태머신(preparing/active/closing · CAS 해제 · swapChild · allLeases)
- [ ] B 제어 권위 이관(control · providerKey · freshTurnLocalState 축소)
- [ ] C 제출 포트 단일화(`submitSteer` + expectedToken, 네 경로)
- [ ] D 포트 2종 + 컴포지션 루트 주입(레이어 경계)
- [ ] E 종료 원자성(게이트 refresh · shutdown 순서 · `retireChannel` · discard CAS)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | — | — | — |

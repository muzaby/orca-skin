# Plan — 0166-session-chain-lease (r3 · 구현 반영)

> **출신**: `0165` 리뷰(6라운드)에서 **소유권·제어·제출 권위**에 해당하는 항목을 분리한
> 핸드오프(사용자 결정 ⑦). 0165 는 보고 증상 직결분만 갖는다.
> **선행**: 0165(메시지-원자 배치 라우팅 · channel incarnation token · attempt identity) —
> 본 문서는 그 토큰·attempt 를 **전제로** 쓴다. **0165 → 0166 → 0167 순차 병합 강제**(파일 중첩).
>
> **r2 개정** — 6차 리뷰에서 확정된 것을 흡수한다: **spawn handshake**(초기 입력이 LiveTurn 이전에
> 적재된다) · **adapter outcome 계약**(push 결과가 관측 불가) · **재시도 규칙**(0165 에서 이관) ·
> `beginMany` · **preparing admission 자기모순 해소** · **준비 실패 정책 고정** · `closing` 자원 보존 ·
> **activation CAS** · **commit fencing** · **open state 정본** · `ChannelLifecyclePort`.
>
> **r3 구현 교정** — 공개 포트 수를 늘리는 원안 대신 현재 실행 모델의 더 작은 원자 경계를 썼다.
> 초기 입력은 `sendMessage()` 내부 스트림 생성까지 동기(run-to-completion)이므로 Runtime이 호출 전
> `canSubmitInitial` 전량 fence, 반환 직후 `commitMany`를 수행한다. 후속 `pushTurn`은 adapter outcome을
> await한 뒤 commit하며, 그 사이 discard가 끼면 commit 실패 + 채널 격리다. PostToolBatch는 자기
> 채널 input을 캡처하므로 새 채널 오염이 불가능하고 같은 queue commit/rollback fence를 쓴다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0166-session-chain-lease` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 |
| 상태 | **IMPLEMENTED** (자동 게이트 완료, GUI/프로세스 사람 실기만 잔여) |
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
interface LeaseBase<W> {                    // 세 상태가 공통으로 든다 (r2 — closing 이 자원을 잃던 결함)
  leaseId: string; chainId: string; owner: W; sessionId: string | null
  controller: AbortController               // preparing abort · 종료 취소에 공용
  control: SessionControl                   // 세션 수명 제어 상태
}
type SessionChainLease<W> =
  | (LeaseBase<W> & { kind: 'preparing' })                              // runtime·providerKey 미확정
  | (LeaseBase<W> & { kind: 'active'; runtime: ManagedRuntime
                      providerKey: string | null                        // provider 해석은 string | null
                      activeChild: TurnContext<W> | null })
  | (LeaseBase<W> & { kind: 'closing'; runtime?: ManagedRuntime
                      reason: 'discard' | 'shutdown' })                 // 정리 대상 자원을 **보존**
```

- **`closing` 은 discard/shutdown 전용**이다(r2). **취소는 체인을 정상 종료**시키고 lease 를 놓으므로
  `closing` 을 거치지 않는다 — 0067 AC3("취소 후 같은 채널 재사용")과 정합하며, 정리가 새 입력을
  막지 않는다.
- `providerKey` 는 `string | null` — 실제 provider 해석 반환형과 일치시킨다(r2).

- **`preparing` 은 동기 검증 직후 첫 `await` 전에 등록**한다(P1-1) — 그래야 `await
  normalizeAttachments`/`resolveTurnProvider` 구간에서 두 번째 체인이 열리지 않는다.
  `runtime`·`providerKey` 는 **그 시점에 알 수 없으므로** 상태로 분리한다.
- **준비 실패 정책 = 고정**(r2 — "둘 중 하나" 는 UX 계약이 아니다): preparing 이 실패하면 그 사이
  합류한 held 를 **전부 원래 순서대로 draft 로 복원**하고 **구체적 오류를 1회** 보여준다.
  **자동 leader 승격은 하지 않는다** — 같은 장애에서 실행 시점에 따라 메시지가 전송되기도 하고
  draft 로 돌아오기도 하는 것은 예측 불가능하다(AC-A4).
- **activation CAS**(r2): 준비를 마치고 `activate(leaseId, prepared)` 로 전이한다. 그 사이 Stop·
  owner-gone·discard·shutdown 이 lease 를 바꿨으면 **CAS 실패 → 방금 얻은 runtime 을 즉시 close**
  한다. 지각한 준비 작업이 종료된 세션을 되살리지 못한다(AC-A24).
- **preparing 중 Stop·owner-gone**(r2): `chat:cancel` 은 preparing controller 를 abort 하고,
  owner WebContents 소멸도 같은 경로를 탄다. 이후 도착한 provider 해석 결과로 **spawn 하지 않는다**
  (AC-A25).
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
- **전송 admission 은 `acceptsQueuedInput` 로 판정한다**(r2 — 자기모순 해소). `lease.runtime.canSteer`
  만으로는 부족하다: `preparing` 에는 runtime 이 없고, runtime 을 얻었어도 **첫 spawn 전 `active`**
  에서는 `canSteer === false` 다. **"현재 채널에 steer 가능한가"(live capability)와 "이 체인에 held
  로 합류 가능한가"(admission)를 분리**한다.

  | 상황 | `acceptsQueuedInput` | 사용자에게 |
  |---|---|---|
  | `preparing` | **true** | pending 버블(held 합류) |
  | `active`, spawn 전 | **true** | pending 버블 |
  | `active`, 채널 생존 + `canSteer` | **true** | pending 버블 |
  | 어댑터가 즉시 steer 미지원(turn-scoped) | **true** | held 후 체인 종료 시 자동 continuation |
  | provider 경계 위반(`lease.providerKey` 기준) | false | "다른 공급자 모델이 선택됨" 안내 |
  | `closing`(discard/shutdown) | false | 잠시 후 재시도 안내 |

  `providerKey` **만** lease 에 둔다(모델·settings 신선도는 runtime 권위 — 복제 금지).
- 서브에이전트 중단은 lease control 을 읽으므로 **연속·listen 턴에서도 `stopTask` 에 도달**한다.
- **정리 시점**(P2-18): `settled` 관측 시 해당 키 제거, lease 해제 시 전량 폐기.

### C. 제출 트랜잭션 구현 계약 (F-G, r3)

> 아래 r2의 `openChannel`/`submitSteer` 전면 포트화 제안은 **r3에서 폐기**한다. 현재 구현의
> 권위 계약은 다음과 같다.

- 예약 배치는 `submitting`으로 시작하고 `(attemptId, chainId, messageIds)` 전량 fence를 갖는다.
- 초기 spawn은 Runtime이 `canSubmitInitial()`을 확인한 뒤 **동기** `sendMessage()`를 호출하고,
  반환 직후 `commitMany()`한다. 호출 전 discard는 push를 막고, 호출과 commit 사이에는 JS
  run-to-completion 때문에 다른 IPC가 끼어들 수 없다.
- 후속 `pushTurn`은 `accepted|rejectedBeforeAccept` outcome을 반환한다. accepted 뒤 commit fence가
  실패하면 채널을 격리하고, 명시적 거절만 **같은 submitting attempt**로 fresh channel에서 재시도한다.
  wire identity를 바꾸지 않아 renderer pending 버블과 큐 원장이 갈라지지 않는다.
  accepted 뒤 무이벤트 실패는 `submission_stale` fence로 자동 재전송하지 않는다.
- PostToolBatch는 해당 spawn의 `input`을 캡처한다. push 성공 뒤 같은 queue commit callback,
  거절/예외에는 rollback callback을 호출한다. 과거 훅은 새 채널 input에 접근할 수 없다.
- respawn은 `messageIds`를 보존하고 wire `attemptId`를 재발급한다. 프렐류드와 본 프롬프트의
  commit은 `commitMany` 전량 검증으로 부분 상태 전이를 막는다.

#### r2 검토 기록(비권위)

- 어댑터에 push 클로저를 주지 않는다. Runtime 이 구현한 **`submitSteer(batch)` 포트**만 넘기고
  게이트 훅은 **요청만** 한다(훅의 fail-open·rollback·경고 로그 구조는 **그대로 보존**).
- **`submitSteer` 는 생성 시점 `expectedToken` 을 캡처**하고, 호출 시 현재 채널 토큰과 다르면
  **no-op/stale 을 반환**한다(P1-6 — 포트 도입이 만드는 신규 위험의 필수 방어).
- **spawn handshake**(r2 — 필수). 최초 prompt·respawn 프렐류드는 **LiveTurn 이 생기기 전에**
  `createSessionInputStream([...preludes, prompt])` 로 어댑터 내부 큐에 적재된다(`claude.ts:327-334`).
  따라서 `submitSteer` 만 추가해서는 **네 경로 중 셋이 Runtime 을 통과하지 않는다.**
  → 어댑터 계약을 **`openChannel(reqWithoutInput)` → Runtime 이 초기 배치를 submit** 으로 바꾼다.
- **네 경로 전부** 이 포트를 지난다: 최초 전송 · 자동 연속 턴 · respawn 프렐류드 · PostToolBatch.
- **adapter outcome 계약**(r2 — 필수). 현재 `LiveTurn.pushTurn?(next): Promise<void>` 가
  `input.push()` 의 `boolean` 을 **버려서**(`types.ts:24` · `streaming-input.ts:30`) "명시적 거절" 을
  관측할 수 없다. 반환형을 다음으로 바꾼다:
  `{ kind: 'accepted' } | { kind: 'rejectedBeforeAccept'; reason } | { kind: 'stale' }`.
- **`beginMany(attempts, token)`**(r2): respawn 은 프렐류드 N개 + prompt 를 함께 제출한다.
  **전부 성공 또는 전부 무효**로 예약한다 — 중간 하나가 CAS 에 실패했을 때 앞의 것만 push 되는
  부분 제출을 금지한다.
- 순서: draining 확인/필요 시 respawn → `ensureChannel()`(0165 의 incarnation token) →
  큐 **CAS `submitting(token)`** → push → `accepted` 면 `submitted` / `rejectedBeforeAccept` 면
  `held` 롤백. **CAS 실패 = 이미 취소·폐기** → **push 하지 않고 채널도 폐기하지 않는다**.
- **commit fencing**(r2): commit 은 `(leaseId, chainId, token, attemptId, state==='submitting')`
  **전량 일치** 시에만 성공한다. push 를 await 하는 동안 discard/close 가 끼어들었으면
  **늦은 commit 은 no-op/stale** 로 끝난다 — 폐기된 상태를 되살리지 않는다.
- **재시도 규칙**(0165 에서 이관 — outcome 계약이 있어야 성립):
  `rejectedBeforeAccept` **만** 1회 재시도(새 `attemptId`) · `accepted` 후 무이벤트는
  **재전송 금지**(중복 도구 실행 위험) · **취소·discard·CAS 실패는 재시도 사유가 아니다**.
- **open state 정본**(세 문서 공통, r2): `submitting | submitted(accepted) | orphaned` = **open**.
  residual 계산 · 전체 중단 · 세션 삭제 · shutdown · 스냅샷이 **모두 이 정본**을 쓴다.

### D. 레이어 경계 — 구현된 구조적 callback 3종 (리뷰 P1-3, r3)

`features/sessions` 와 `features/chat` 은 **서로 import 할 수 없다**(lint error). 컴포지션 루트가
주입한다:

| 경계 | 소비자 | 제공자 | 메서드 |
|---|---|---|---|
| `TurnRequest` 제출 callbacks | `SessionRuntime`(sessions) | app → `PendingMessageQueue`(chat) | `canSubmitInitial` / `commitInitialSubmission` / `rollbackInitialSubmission` |
| `SessionControl` 참조 | coordinator·handler | lease(sessions) | task map·stopped/blocked/cancelled를 continuation이 같은 참조로 공유 |
| `onChannelRetired(token)` | app | `SessionRuntime`(sessions) | app이 tracker를 조회해 합성 settled; sessions→chat 직접 import 없음 |

### E. 종료 경로 원자성 (리뷰 P1-9·P1-10·P1-15)

- **게이트**: `isGenerating` 을 **lease 수**로 판정(단 `preparing` 은 runtime cap 에서 제외 — P2-17).
  `activeToolCallCount` 는 `activeChild?.openToolRuns.size ?? 0` 합. **lease
  acquire/promote/activate/release 마다 `refreshGate()`** 를 호출한다(P1-9 — 현행은 호출 지점이
  1곳뿐이라 마지막 lease 해제에서 갱신되지 않는다).
- **shutdown 순서**(P1-10) — 기존 경로를 **대체가 아니라 확장**한다:
  ① preparing controller 취소 → ② 각 `await` 뒤 cancelled/frozen 재검사(신규 runtime factory 금지)
  → ③ active child 정착(`settleOpenToolRuns`)·abort → ④ **모든 lease 의 runtime close** →
  ⑤ idle 풀 close → ⑥ 큐 dispose.
- **`onChannelRetired(token)`**(P1-8): 세대 교체를 app에 1회 통지한다. app이 해당 세션 tracker의
  정착 대상을 읽어 합성 settled를 영속·전달한다 — sessions가 chat tracker를 직접 알지 않는다.
- **discard CAS**(P1-15): "세션 전체 중단" 을 원자화한다 — ⓐ 해당 세션 신규 begin 차단
  (`closing`) → ⓑ 현재 토큰 무효화 + runtime close → ⓒ 그 시점 **모든 open 배치 폐기** →
  ⓓ draft 복원 이벤트 → ⓔ admission 재개.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `SessionChainLease` + registry | 세션 소유·제어 권위 | features/sessions | `session-chain-lease.test.ts` |
| queue submission callbacks | 제출 전량 fence | `TurnRequest` + app 주입 | queue/runtime 단위 테스트 |
| channel token + retirement callback | 영수증·정착 세대 격리 | SessionRuntime + app | `session-runtime.test.ts` |
| shutdown/gate/discard 배선 | 종료 원자성 | app | supervisor·전체 회귀 suite |

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
| A18 | channel token이 바뀐 뒤 도착한 **이전 interrupt 영수증은 폐기**된다 | `session-runtime.test.ts::"채널 교체 뒤 지각 도착한 interrupt 영수증"` | 구 채널 비동기 영수증 |
| A19 | PostToolBatch는 **자기 spawn의 input만 캡처**하고 queue commit/rollback callback으로 제출 상태를 결합한다 | `claude.fork.test.ts` + `claude-adapt` 기존 steer suite | CLI 훅 |
| A20 | 훅의 **fail-open·rollback·경고 로그가 보존**된다(포트 교체가 steer 를 조용히 끊지 않는다) | `claude-adapt.test.ts::"포트 거부 시 rollback + 경고 로그"` | 동 A19 |
| A21 | channel retirement가 token당 **정확히 1회** app에 통지되고 tracker 합성 정착 경로가 실행된다 | `session-runtime.test.ts::"채널 화신 종료 통지는 token당 한 번"` | respawn·stream end·oneshot |
| A22 | `features/sessions` ↔ `features/chat` **직접 import 0** — callback과 lease 참조를 app이 조립한다 | `npm run lint` boundaries | 빌드 게이트 |
| A23 | 실기: 백그라운드 서브에이전트가 도는 세션에서 연속 전송을 반복해도 **CLI 서브프로세스가 세션당 1개**로 유지되고, 앱 종료 후 **잔존 프로세스가 0** 이다 | **사람 실기** — `npm run dev` + `ps` 확인(전송 5회 반복 → 종료) | 앱 전체 |
| A24 | **activation CAS**: 준비 완료 시 lease 가 이미 `closing` 이면 전이가 실패하고 **방금 얻은 runtime 이 즉시 close** 된다 | `supervisor.test.ts::"activation CAS 실패는 runtime 을 즉시 닫는다"` | 준비 중 discard/shutdown 경합 |
| A25 | **preparing 중 Stop·owner-gone** 이 준비를 abort 하고, 이후 도착한 provider 해석 결과로 **spawn 하지 않는다** | `chat-turn.lease.test.ts::"preparing 중 Stop 은 spawn 을 막는다"` · `::"owner 소멸도 같은 경로"` | 전송 직후 중단 · 창 닫기 |
| A26 | **동기 spawn handshake**: 최초 prompt·프렐류드는 `canSubmitInitial` 전량 preflight 후 `sendMessage` 반환 직후 commit된다 | `session-runtime.test.ts` 초기 send + continuity 통합 테스트 | 최초 전송·respawn |
| A27 | **adapter outcome**: 후속 push 거절은 `rejectedBeforeAccept`, 수용은 `accepted`로 Runtime까지 전파된다 | `session-runtime.test.ts` 후속 제출 fence + Claude adapter suite | 후속 제출 |
| A28 | 거절 전에는 같은 attempt로 fresh channel 재시도가 가능하고, accepted/stale 뒤에는 자동 재전송하지 않는다 | queue state fence + coordinator retry suite | coordinator retry 루프 |
| A29 | **전량 원자성**: `canCommitMany`가 모든 프렐류드+prompt를 검증한 뒤 `commitMany`가 한 mutation으로 전이한다 | `pending-message-queue.test.ts` commitMany fence | respawn 프렐류드 |
| A30 | **commit fencing**: push 를 await 하는 동안 discard 되면 **늦은 commit 이 no-op** 이고 폐기 상태가 되살아나지 않는다 | `pending-message-queue.test.ts::"discard 후 늦은 commit 은 무시된다"` · `chat-turn.lease.test.ts::"submitting 중 discard 경합"` | 잔여 Notice → discard |
| A31 | **open 정본 3상태**(`submitting\|submitted\|orphaned`)를 residual·discard·세션 삭제·shutdown·스냅샷이 **모두** 사용한다 | `pending-message-queue.test.ts::"open 정본이 모든 소비처에서 일치한다"` | 큐 전 소비처 |
| A32 | `onChannelRetired(token)`이 app의 `settleDeadBackgroundTasks`를 호출해 열린 tracker를 합성 정착한다 | Runtime callback test + chat-turn 배선 | respawn |

## 범위 / 비범위

- **범위**: A~E + AC **32건**(r2 에서 9건 추가).
- **비범위**: 활동 스냅샷·대기 표시(**0167**) · 메시지-원자 라우팅과 incarnation token(**0165** 선행) ·
  `RuntimePool` 을 active/idle 2단으로 일반화(lease 가 active 를 들므로 풀은 저장소로 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 |
|---|---|
| 스냅샷·대기 UX | **아니오** — 0167 이 lease 수명을 구독만 하면 된다 |
| RuntimePool 2단화 | **아니오** — lease 가 소유를 표현하므로 풀 변경 없이 성립 |

## 의존 기술 / 전제

- **선행 의존**: 0165 의 channel incarnation token · `SubmissionAttempt`.
  0165 없이 착수하면 C의 attempt fence와 E의 retirement 기준점을 잃는다.
- 전제 1: registry 소비처는 **9곳**이며 `hasSession`/`getBySession`/`all()` 3술어로 표현된다.
- 전제 2: in-process 백그라운드 태스크는 서브프로세스와 함께 죽는다(0136 승계).
- 전제 3: PostToolBatch 훅은 자기 채널 `input`을 캡처한다. r3는 이 전제를 유지하고 queue
  commit/rollback만 callback으로 결합한다.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 이번 변경 |
|---|---|---|
| registry 의 turn 단위 등록 (구조, 결정 문서 없음) | `session-registry.ts:3-5` | **구조 변경** — 등록 단위를 체인으로. 3술어 계약 유지 + `allLeases()` 신설 |
| 게이트·shutdown 이 `all()` 로 판정 (구조) | `bootstrap.ts:489-494`, `:553-560` | **구조 변경 + 현행 결함 수정** |
| 세션 제어 상태를 turn-local 에 보관 (구조) | `chat-turn.ts:96-112` | **구조 변경** — lease 로 이관(복제 금지) |
| 어댑터가 steer push 수행 (구조) | `claude.ts` | **유지 + fence 보강** — 자기 input push, app queue commit/rollback callback |
| 0151 "처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | **유지** — 선택지는 그대로, 처분이 **실제로 동작**하게 된다 |
| 0136 릴리즈 밸브 · 0153 admission · 0143 표시 | 각 주석 | **유지** |
| main 레이어 DAG(feature 교차 금지) | `eslint.config.mjs` | **준수** — callbacks + 루트 주입(AC-A22) |

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
| callback 결합이 steer 를 조용히 끊을 수 있다 | 훅의 fail-open·rollback·경고 로그 구조 보존(A20) |
| 세대 스코프가 정착 대상을 잃게 할 수 있다 | retirement를 token당 1회 app에 통지하고 app이 tracker를 정착(A21) |
| 9곳 소비처 회귀 | 3술어 계약 유지 + `allLeases()` 는 **신설**(기존 시그니처 무변경). A12·A15 가 게이트·종료를 양성 단언 |
| diff 가 크다 | 커밋을 A(상태머신) → B(제어 이관) → C/D(포트) → E(종료 원자성) 순으로 쪼갠다. **A 만 들어가도 D7 이 닫힌다** |

- 되돌리기 어려운 결정: 없음(공개 계약·스키마 무변경).
- **Open Question**: 없음.

## 영향 받는 파일

- `app/src/main/features/sessions/session-registry.ts` · `supervisor.ts` — lease 상태머신 ·
  `swapChild` · CAS 해제 · `allLeases()` · `discardRuntime` 이 active 도달
- `app/src/main/features/sessions/session-runtime.ts` — 초기/후속 제출 fence · channel retirement
- `app/src/main/adapters/turn.ts` — queue submission·retirement callback 계약
- `app/src/main/features/chat/pending-message-queue.ts` — `submitting` CAS(포트 구현)
- `app/src/main/features/chat/background-tasks.ts` — 앱 수명 tracker 구독·정착 입력
- `app/src/main/app/chat-turn.ts` — lease 수명 · 제어 이관(`freshTurnLocalState` 축소) ·
  `canSteer`/`providerKey` 판정 교정
- `app/src/main/app/bootstrap.ts` — 게이트·shutdown·포트 주입
- `app/src/main/adapters/{types,turn,claude,claude-adapt,mock}.ts` — provider batch · outcome 반환형 ·
  게이트 queue callback
- `app/src/main/features/chat/turn-coordinator.ts` — 재시도 규칙(0165 에서 이관)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: supervisor/registry 10 · bootstrap 4 · session-runtime 5 · pending-message-queue 3 ·
  background-tasks 1 · turn-coordinator 2 · 어댑터 4 · chat-turn harness 11.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 요구·결정 인용, 추론 표기(미보고 결함 4종 동반 처리)
- [x] 자료조사 — 14행 전부 `파일:라인`, 앵커를 직접 열어 확인
- [x] 의존 기술 — 전제 3건 + **선행 의존(0165)** 명시, 신규 의존성 0
- [x] 파생 UX — 준비 중 종료·준비 실패·승격 경계·discard 경합·recovery·handoff 6건
- [x] 리스크 — 5건 + 완화책, Open Question 0
- [x] `검증 수단` 공란 0 — AC **32건** 중 31건 `파일::케이스`, 1건 사람 실기(`ps` 절차 명시)
- [x] **검증 수단이 실제로 성립하는지 재점검**(r2) — `push` 결과 관측은 **adapter outcome 계약(A27)이 이 문서에 있으므로** 성립한다. 0165 에서 같은 AC 가 성립하지 않았던 이유(계약 부재)를 §자료조사에 기록
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

- 동의 / 그대로 진행: 논리 키(`session:`/`client:`) CAS lease, `preparing|active|closing`, leaseId
  해제, activeChild 원자 교체, 세션 수명 control 이관은 그대로 구현했다. admission과 즉시 steer
  capability도 분리해 turn-scoped 백엔드 입력을 다음 continuation으로 보존한다.
- 이견 / 보완: 원안의 `openChannel`/별도 `SubmissionAttemptPort`는 현재 동기 초기 스트림 생성에
  비해 추상화 비용이 컸다. Runtime 호출 전 전량 fence와 호출 직후 commit으로 같은 원자성을
  만들고, 비동기 `pushTurn`만 outcome+늦은 commit fence를 적용했다. queue의 `chainId`가 lease
  generation fence이고 channel token은 Runtime의 배치·영수증·retirement 경계에 한정했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 준비 중 후속 입력이 leader보다 먼저 큐에 물질화되면 입력 순서가 뒤집힐 수 있음 | ✅ lease CAS 직후 leader admission 시각 고정 + reserve 시 createdAt 정렬 | provisional 동시 send 경로 |
| 2 | 확장 배포 await 중 취소 후 지각 spawn 가능 | ✅ await 직후 controller 재검사 + `canSubmitInitial` fence | chat-turn 준비 경로 |
| 3 | Runtime 내부 channel retirement가 background tracker 정착을 우회 | ✅ `onChannelRetired(token)` 상향 통지와 app 합성 정착 | teardown/finish/oneshot |
| 4 | 제출 수용 뒤 무이벤트 실패를 일반 transient retry하면 중복 실행 가능 | ✅ submitted 시도는 다음 fence를 통과하지 못하고 `submission_stale`은 재시도 제외 | coordinator retry 경계 |
| 5 | leader와 준비 중 합류 입력의 `Date.now()`가 같으면 stable sort가 follower를 먼저 둘 수 있음 | ✅ lease `admittedAt`을 leader 시각으로, follower는 최소 +1ms | provisional 동시 send |
| 6 | preparing lease의 turn이 legacy registry에서도 세어져 runtime cap에서 우회 중복 계상 | ✅ lease session/owner에 대응하는 registry turn 제외 | supervisor population test |
| 7 | 세션 삭제가 DB를 먼저 지우면 active runtime의 지각 이벤트가 삭제 뒤 영속화를 재개할 수 있음 | ✅ runtime/child abort·queue scrub 후 DB 삭제 | session dispose hook |
| 8 | child 없는 await 구간의 Stop이 lease만 abort하고 continuation controller 검사에서 누락될 수 있음 | ✅ supervisor가 lease+child 동시 abort, 루프·await 뒤 chain signal 재검사 | cancelChain·post-turn loop |

## [구현자 기입] 구현 체크리스트

- [x] A lease 상태머신(preparing/active/closing · CAS 해제 · swapChild · allLeases)
- [x] B 제어 권위 이관(control · providerKey · freshTurnLocalState 축소)
- [x] C 제출 트랜잭션(`canSubmitInitial` · adapter outcome · commit/rollback fence)
- [x] D 경계 포트(queue callback · control · channel retirement) + 컴포지션 루트 주입
- [x] E 종료 원자성(lease gate · shutdown runtime close · active discard)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `session-chain-lease.ts`, supervisor, chat-turn, SessionRuntime, pending queue, adapter outcome/게이트 및 bootstrap 종료 배선 |
| 게이트 결과 | lint 0 error(기존 TanStack warning 1) · typecheck 3/3 · Vitest 198파일 1793/1793 · scripts 28/28 |
| 블로커 / 역질문 | 자동 검증 블로커 없음. 세션당 CLI 1개·종료 후 0개는 GUI 사람 실기 필요 |
| 대상 커밋 | 작업 트리 구현(아직 커밋하지 않음) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | — | — | — |

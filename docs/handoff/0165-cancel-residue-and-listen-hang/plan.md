# Plan — 0165-cancel-residue-and-listen-hang (r7 · 재축소)

> **개정 이력**
> - **r1** 점 수정 3개 → 리뷰 P1 3건. **r2** 구조 전환 → P1 3건(1건은 r2 가 만든 ABA).
>   **r3** identity·큐 파생·스냅샷 → P1 3건. **r4** 체인 lease·제출 트랜잭션 → P1 3건.
>   **r5** 세션 제어 권위·제출 포트 → **24건**. **r6** 3분할(0165/0166/0167) → **24건**.
> - **r7 (본 문서)** — 6차 리뷰에서 **내 설계의 구현 불가 항목 3건**이 코드로 확정됐다.
>   재시도 규칙(관측 불가) → **0166**, 잔여 파생·발행(이중 권위) → **0167**, tracker 토큰
>   스코프(포트 필요) → **0166**. 본 문서는 **신규 포트 0 · IPC 0 · 레이어 무변경**으로 줄인다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0165-cancel-residue-and-listen-hang` |
| 작성자 | Claude Code |
| 일자 | 2026-08-04 (r1 → r7) |
| 상태 | r7 DRAFT → **READY** |
| 병합 순서 | **0165 → 0166 → 0167 순차 강제** (§파일 중첩) |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "첫 취소에서 어시스턴트의 **에러 메시지 버블 노출**. 이후 delta 도착 시작하자 삭제 후 delta 출력" | 라이브 세션 + 첨부 `orcacancelresendanalysis.md` §1 |
| 명시 요구 ② | "마지막 어시스턴트 답변 이후 **inflight 애니메이션 지속** + **'중단했지만 대기 중인 메시지가 남아 있습니다'** 표기" | 동상 + 첨부 §2 |
| 명시 요구 ③ | "**구조적 결함을 반드시 극복하되 사용자 경험을 해치지 말 것**" | 라이브 세션 ×4 |
| 명시 요구 ④ | "**핸드오프 문서 작성까지**" | 라이브 세션 |
| 명시 요구 ⑤ | "**제안 및 피드백에 대해 비판적 검토를 하라**" — 리뷰도 무비판 수용 금지 | 라이브 세션 ×3 |
| 사용자 결정 ⑥ | 0143(listen 대기 = inflight 지속) **유지 — 라벨만 추가**. foreground/transport UI 분리 **미채택** | 라이브 세션 |
| 사용자 결정 ⑦ | **3개 핸드오프로 분할** | 라이브 세션 |
| 사용자 결정 ⑧ | ②-a 는 **0165 에 최소분만** | 라이브 세션 |

## Context (왜)

실기 세션 `8f6ad70c` 의 취소→재전송에서 세 증상이 났고 로그에는 `error`/`warn` 이 0건이다 —
정상 경로의 오판이라 관측 없이 UI 만 틀어진다.

설계가 **6라운드**를 돌며 범위가 계속 바깥으로 확장됐고(큐 → 이벤트 경계 → 채널 세대 → 체인
소유권 → 세션 제어 권위), 6차 리뷰에서 **내가 쓴 AC 중 검증 수단이 성립하지 않는 것**이 드러났다.
그래서 r7 의 기준은 하나다 — **"이 문서만으로 구현·검증이 완결되는가"**. 그 기준에 걸리는 항목은
전부 0166/0167 로 옮긴다.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **①은 원인 확정**(F-A). **②-b 의 *오탐* 은 원인 확정**(죽은 채널의 지각 영수증). **②-a 는 원인 미확정** — r1 의 귀속은 반증됐고 남은 후보를 로그로 못 가린다. 본 문서는 **증명된 것만** 고치고 ②-a 는 *증명된 한 조각*(체인 종료 강등)과 *관측*만 담는다 | `turn-coordinator.ts:232-236` · 첨부 §2-1 |
| 이미 있는 것 아닌가 | 아니다. `takeForRespawn` 의 "uuid 보존"(0067)이 함정이었다 — pending id 정합은 `ids` 가 담당하는데 wire uuid 까지 보존해 **죽은 채널의 영수증이 산 배치와 교집합**을 만든다 | `pending-message-queue.ts:333-354` · `chat-turn.ts:1096`, `:1120` |
| 더 작은 해법이 있는가 | **이 문서가 그 답이다.** r5→r6→r7 로 두 번 줄였다. 이제 **신규 모듈 0 · 신규 포트 0 · IPC 무변경 · 레이어 무변경**이다 | §설계 |
| **인용 자료(리뷰)가 요구를 부풀리지 않았나** (요구 ⑤) | **6라운드 전부 검증.** 3차 1건 **등급 하향**, 5차 1건 **정정**, 5차 제안 3건 **미채택**, 6차 제안 4건 **미채택**(근거는 §외부 리뷰 처리). 동시에 **6차가 지적한 내 결함 3건은 코드로 확정해 전면 수용**했다 | §외부 리뷰 처리 |
| 기존 채택 결정을 뒤집는가 | **0건.** 0143 유지(⑥) · 0067 정밀화 · 0154/0151/0136/0153 유지 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음.

## 자료조사 (Research)

> 인용 라인은 이번 세션에서 직접 열어 확인했다. SDK 는 `npm ci` 로 설치한 `0.3.220` 실물.

### r7 에서 새로 확정 — **내 설계의 구현 불가 3건**

| 발견 | 레퍼런스 |
|---|---|
| **push 결과는 관측 불가하다.** `input.push()` 는 `boolean` 을 반환하지만 **`LiveTurn.pushTurn?(next): Promise<void>`** 가 그 값을 버린다 → "push 명시적 거절" 을 Runtime·coordinator 층에서 구분할 수 없다. **재시도 규칙은 adapter outcome 계약 없이는 검증 불가** → 0166 | `streaming-input.ts:30`, `:77` · `types.ts:24` · `claude.ts` `pushTurn` |
| **최초 prompt·프렐류드는 LiveTurn 이 생기기 전에 적재된다** — `createSessionInputStream([...preludes, prompt])`. `submitSteer` 만으로는 "모든 입력이 Runtime 을 통과" 가 성립하지 않는다(**spawn handshake** 필요) → 0166 | `claude.ts:327-334` |
| **잔여 발행을 0165 가 하면 0167 과 이중 권위** — 늦은 legacy 이벤트가 이미 지운 경고를 되살린다. renderer 는 residual 을 별도 상태로 들고 있다 → 0167 을 **유일 publisher** 로 | `chatStore.ts:476-483` · `chatReducer` residual 경로 |

### 본 문서 범위의 확정 사실

| 발견 | 레퍼런스 |
|---|---|
| 한 SDK 메시지가 N개 이벤트로 분해된다 | `claude-map.ts:1-8` |
| **실패·취소 result 는 terminal 을 2개 낸다** — `[telemetry, error]`. `SDKResultError.subtype` **4멤버** 전부 같은 분기 | `claude-map.ts:474-486` · `sdk.d.ts:4269-4271` |
| `error_during_execution` = "API 실패 **또는 취소된 요청**" | `docs/spec/claude/agent-sdk/agent-loop.md:274` |
| `terminal_reason`(19멤버)은 optional → 취소 판별에 쓰지 않는다 | `sdk.d.ts:4282`, `:6909` |
| **`routeEvent` 가 첫 terminal 에서 프레임을 닫아** 두 번째가 `unframed` 로 샌다 | `session-runtime.ts:354-380`(프레임 분기 `:368-377`) |
| `openFrame()` 이 `unframed` 를 새 프레임 **앞에 합류**시킨다(소속 라벨 없음) | `session-runtime.ts:328-335` |
| `teardownChannel()` 이 `unframed` 를 비운다 → "첫 취소에서만" 인 이유 | `session-runtime.ts:446` · 첨부 §3 |
| renderer 는 `error` 로 배너를 띄우고 `BEGIN_TURN` 에서 지운다 + **DB 에도 error 파트로 영속** | `chatReducer.ts:546-556`, `:297-309` · `writer.ts:276-285` |
| **중단 영수증 실측 지연 6.06초**, 그 사이 respawn | 첨부 §2-2/§3 · `session-runtime.ts:485-504` |
| **`reserveHeld` 는 여러 메시지를 `ids: string[]` 한 배치로 병합** → identity 는 배치 단위여야 한다 | `pending-message-queue.ts` `toBatch`/`reserveHeld` |
| `discardSubmitted` 는 `submitted` 만 매칭 → 강등분이 폐기되지 않는다 | `pending-message-queue.ts:309-312` |
| `orphanUnconfirmed` 호출점 **전수 2곳**, 둘 다 턴-후 루프 안(조건 `!aborted`) | `chat-turn.ts:939`, `:951` |
| `consumeTurnScoped`(mock/oneshot)는 pump 를 쓰지 않는다 — 배치 경로가 따로 필요 | `session-runtime.ts:287-309` |
| `live.events` 소비처 **3곳**(전부 `session-runtime.ts`), 생산자 **2곳** | `:174`, `:290`, `:342` |
| 게이트 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed (196 files)** + node:test **28 pass** | 이번 세션 실행 |

## 구조적 결함 — 본 문서가 닫는 것

> 주제는 **"소속 없는 신호"**. 본 문서는 **메시지 경계**와 **채널 세대**, **시도(attempt)** 를 세운다.

| # | 발현 | 보고 증상 | 처방 |
|---|---|---|---|
| **F-A** | 프레임 경계 ≠ provider 메시지 경계 → 메시지 꼬리가 다음 턴에 재귀속 | ① (+ 실제 API 실패도) | **A** |
| **F-C′** | 중단 영수증이 **어느 채널의 큐**를 가리키는지 표현이 없다 | ②-b **오탐** | **B** |
| **F-B′** | 취소·stall 로 끝난 체인이 예약을 `submitted` 로 방치 | ②-a **일부** | **C** |

**이월**: 잔여 상태·발행(F-D) → **0167** · 세션 소유권·제출 권위(F-E~G) → **0166**.

## 외부 리뷰 처리 (6라운드)

| 라운드 | 처리 |
|---|---|
| 1~5차 | §개정 이력 참조. 24건은 r6 에서 셋으로 매핑 |
| **6차 — 내 결함 3건** | **전면 수용** — 재시도 → 0166 · 잔여 발행 → 0167 · tracker 토큰 스코프 → 0166 |
| **6차 — 그 외** | open state 정본·preparing admission·closing 자원·activation CAS·commit fencing·`beginMany`·spawn handshake → **0166** / `lastActivityAt`·transport 공식·AC7 이동·projection key·hydrate·legacy producer 제거 → **0167** |

### 6차 제안 중 **미채택 4건** (요구 ⑤)

| 제안 | 판단 | 근거 |
|---|---|---|
| `foreground: preparing\|streaming` 에만 inflight 연결 | **기각** | **사용자 결정 ⑥ 위반.** foreground/transport UI 분리는 이미 미채택으로 결정됐다(0143 유지). 형태를 바꾼 재제안이라 설계자가 단독 수용할 수 없다 |
| `RetiredChainRegistry` 신설 | **미채택** | Orca 의 취소는 **채널을 유지**한다(0067 AC3 "취소 후 같은 채널 재사용" — `markAborted` 는 interrupt 경로, `session-runtime.ts:485-504`). 취소가 채널을 은퇴시키지 않으므로 레지스트리가 필요 없다. 실질 우려("정리가 새 입력을 막는다")는 **0166 의 `closing` 을 discard/shutdown 전용**으로 두면 사라진다 |
| old/new publisher **feature flag** | **미채택** | main·renderer 는 같은 빌드로 배포돼 스큐가 없다. 대신 **0167 에 "legacy producer 0건" AC** 를 넣어 동시 존재 자체를 없앤다 |
| 대기 표시 **액션 버튼**(지금 보내기·편집·삭제) | **보류** | 보고 범위 밖 제품 변경. **문구 중립화는 0167 에서 채택**, 액션 추가는 별도 결정으로 올린다 |

## 설계

### 원칙

> ① **소속을 붙인다** — 메시지 경계 · 채널 세대 · 시도.
> ② **시간은 표시 계층에서만** — 라우팅에 타이머 0.
> ③ **이 문서만으로 구현·검증이 완결되는 것만 담는다** *(r7)*.

### A. 메시지-원자 배치 라우팅 (F-A)

**불변식: 한 provider 메시지의 이벤트는 전부 같은 목적지로 간다(프레임 / 드랍 / unframed).**

- `LiveTurn.eventBatches: AsyncIterable<ProviderMessageBatch>`,
  `ProviderMessageBatch = { sequence: number; events: NormalizedEvent[] }` — **선택적 우회로가
  아니라 계약**. 다중 이벤트 어댑터는 반드시 한 배치로, 단일 이벤트 어댑터(mock)도 1-이벤트 배치로.
- `claude.ts` 의 `events()` 는 이미 `claudeToNormalized()` **배열**을 `yield*` 로 편다 — 펴지 않고
  배치째 내보낸다. `drainCompactSummaries` 산출물은 같은 배치 뒤에 이어 붙여 순서 보존.
- `routeEvent` → `routeBatch(token, batch)`: 배치 전 이벤트를 한 목적지로 보낸 **뒤** terminal
  전이(프레임 닫기·draining 종료·`cliBusy` 해제)를 적용한다.
- **`consumeTurnScoped`(mock/oneshot)도 같은 경로**를 탄다.
- 효과: **① 소멸 + 실제 실패 result 의 일반 누출 동시 소멸.** 새 가변 상태 0.

### B. Channel incarnation token (F-C′)

- `SessionRuntime` **내부**에 채널 화신 토큰. **`ensureChannel()` 이 기존 토큰을 반환**하고
  **spawn/respawn 때만 새로 발급**한다(제출마다 발급하면 두 번째 steer 이후 정상 이벤트가 전부
  stale 로 폐기된다).
- 용도 **2가지만**: ⓐ `routeBatch` 세대 검사(구 채널 잔여 폐기) ⓑ **중단 영수증 정합** —
  `markAborted` 가 발행 시점 토큰을 캡처하고 resolve 시 일치할 때만 `onInterruptReceipt` 로 올린다.
  → **②-b 의 오탐(죽은 큐 기준 잔여 판정) 소멸.**
- **토큰은 `features/sessions` 를 넘지 않는다.** tracker 스코프·`retireChannel` 은 포트가 필요하므로
  **0166** 소관이다.

### C. SubmissionAttempt + 체인 종료 강등 (F-B′)

- **배치 단위** identity: `SubmissionAttempt { messageIds: string[]; attemptId: string; chainId: string }`.
  `attemptId` 는 재제출마다 새로 발급하고 wire uuid 로 쓴다. `takeForRespawn` 은 `messageIds` 를
  보존하고 `attemptId` 를 **재발급**한다.
  (0067 의 "uuid 보존 = pending id 정합" 은 실제로 **`ids`(messageIds)가 담당** — 정합 유지.)
- 체인 종료 `finally` 에서 **`(attemptId, chainId)` 일치분만** `orphaned` 로 강등 — 취소·stall·throw
  전 경로를 덮으면서 지각한 이전 체인이 새 시도를 건드리지 못한다(ABA 차단).
- **companion**: `discardSubmitted` 를 **open 매칭**으로 확장한다. 이 문서가 orphaned 를 늘리므로
  같은 문서에서 상쇄해야 "세션 전체 중단" 이 조용히 무력화되지 않는다.
  **open 상태 정본은 0166 이 확정**하며(`submitting` 추가), 본 문서는 현재 상태집합
  (`submitted | orphaned`)에 맞춰 구현하고 0166 이 확장한다 — 이 확장 지점을 §API 이월에 명시.

### D. 관측 — ②-a 원인 확정 수단

- listen/flush 개시 시 `chat.postturn.step` 에 `step` + 판정 입력 5종(`havePending`·`haveTasks`·
  `haveUnconfirmed`·`channelBusy`·`hasBacklog`) + `taskCount`·`pendingMessageCount`.
  **카운트·불리언만**(원문 금지 — `observability.md`).

### 0166 이 바꿀 API (이월 명시)

| 본 문서가 만드는 것 | 0166 이 바꾸는 것 |
|---|---|
| `SubmissionAttempt` 타입 | `SubmissionAttemptPort`(begin/commit/rollback·`beginMany`)로 승격 |
| 큐 open 상태 `submitted \| orphaned` | `submitting` 추가 → **정본 3상태** |
| `ensureChannel()` 토큰(내부) | `ChannelLifecyclePort` 로 app 통지(tracker 스코프·`retireChannel`) |
| `pushTurn(): Promise<void>` (무변경) | **outcome 계약**으로 교체(accepted / rejectedBeforeAccept / stale) |

| 신규 모듈 / 확장 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `ProviderMessageBatch` + `LiveTurn.eventBatches` | 메시지-원자 계약 | adapters | 어댑터 단위(claude·mock) |
| `SessionRuntime.routeBatch` · incarnation token · `ensureChannel()` | 배치 라우팅 · 세대 | features/sessions | 순수 단위 — 기존 fake live 채널 harness |
| `SubmissionAttempt` · `discardSubmitted` open 확장 | 예약 identity | features/chat | 순수 단위 — `pending-message-queue.test.ts` |
| 체인 종료 강등 · `chat.postturn.step` | 배선 | app | **기존 harness seam** — 신규 `chat-turn.cancel-residue.test.ts` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 실패 result 가 만든 `[telemetry, error]` **두 이벤트가 같은 프레임으로 배달**된다 | `session-runtime.test.ts::"실패 result 배치는 같은 프레임으로 전부 배달된다"` | CLI result → `eventBatches` → `routeBatch` → `consumeFrame` |
| 2 | 취소 draining 중 도착한 result 배치는 **전부 드랍되고 `hasUnframedBacklog` 가 false 로 남는다** | `session-runtime.test.ts::"취소 draining 중 배치는 통째로 드랍된다"` | `chat:cancel` → `markAborted` → `routeBatch` |
| 3 | **이전 세대(토큰)의 배치는 통째로 폐기**된다 | `session-runtime.test.ts::"세대 불일치 배치는 라우팅되지 않는다"` | respawn 직후 구 채널 잔여 |
| 4 | `ensureChannel()` 은 **채널이 살아 있으면 같은 토큰을 반환**하고 spawn/respawn 때만 새 토큰을 낸다 | `session-runtime.test.ts::"토큰은 채널 화신 단위다"` | 연속 턴/steer |
| 5 | claude 어댑터가 **한 SDK 메시지 = 한 배치**로 낸다 | `adapters/claude.eventbatches.test.ts::"한 SDK 메시지 = 한 배치"` | `ClaudeAdapter.sendMessage` |
| 6 | **mock 어댑터도 배치 계약을 지키고 `consumeTurnScoped` 도 같은 경로**를 탄다 | `adapters/mock.test.ts::"mock 도 배치로 낸다"` · `session-runtime.test.ts::"turn-scoped 소비도 배치 라우팅을 쓴다"` | dev mock 백엔드 |
| 7 | **채널이 교체된 뒤 도착한 중단 영수증은 잔여 판정에 반영되지 않는다** | `session-runtime.test.ts::"세대 불일치 영수증은 폐기된다"` | `markAborted` → `interrupt()` promise |
| 8 | **같은 세대**의 영수증은 그대로 반영된다 | `session-runtime.test.ts::"같은 세대의 영수증은 배달된다"` | 동 7 |
| 9 | `SubmissionAttempt` 는 **배치 단위**다 — 병합 배치의 `messageIds` 가 전부 실린다 | `pending-message-queue.test.ts::"attempt 는 배치의 messageIds 를 모두 싣는다"` | `reserveHeld` 병합 |
| 10 | `takeForRespawn` 은 **`messageIds` 를 보존하고 `attemptId` 를 재발급**한다 | `pending-message-queue.test.ts::"respawn 은 messageIds 보존·attemptId 재발급"` | 채널 사망 respawn |
| 11 | 취소로 끝난 턴 체인이 **`(attemptId, chainId)` 일치분만** `orphaned` 로 강등한다 | `chat-turn.cancel-residue.test.ts::"취소로 끝난 체인이 자기 시도만 강등한다"` · `pending-message-queue.test.ts::"attemptId 불일치 강등은 다른 시도를 건드리지 않는다"` | outer `finally` |
| 12 | `orphaned` 배치가 **지각 echo 로 `confirmed` 된다**(강등이 커밋을 잃게 하지 않는다) | `pending-message-queue.test.ts::"orphaned 배치도 지각 echo 로 확정된다"` | 늦은 CLI 픽업 |
| 13 | "세션 전체 중단" 이 **`orphaned` 배치도 폐기**해 텍스트를 draft 로 되돌린다 | `pending-message-queue.test.ts::"discardSubmitted 는 open 상태를 폐기한다"` | 잔여 Notice → `chat:discardSession` |
| 14 | **취소 → 재전송 프로덕션 경로**에서 renderer 로 가는 `error` 이벤트 0건, history `error` 파트 0건, 다음 턴 첫 delta 정상 출력. **반복 취소에서도 동일** | `chat-turn.cancel-residue.test.ts::"취소 후 재전송에 에러 이벤트가 없다(반복 포함)"` | `chat:send`→`chat:cancel`→`chat:send` |
| 15 | listen/flush 개시 시 `chat.postturn.step` 이 **판정 입력 5종 + 개수 2종**을 남긴다(원문 0) | `chat-turn.cancel-residue.test.ts::"턴-후 판정 입력이 로그에 남는다"` | `~/.config/orca/logs/` JSONL |
| 16 | 실기: ⓐ 에러 배너 부재 ⓑ 반복 취소에서도 동일 ⓒ 재시작 후 error 카드 부재 | **사람 실기** — `cd app && npm run dev`, 아래 절차 | 앱 전체 |

### 사람 실기 절차 (AC16)

1. 전송 → 응답 중 **중단** → 재전송 → transcript 에 **에러 배너 없음**(①).
2. **중단을 3회 반복**해도 동일.
3. 앱 재시작 후 같은 대화 → 답변 위에 **error 카드 없음**(① 영속 경로).

> ②-b 의 *경고 해제* 와 ②-a 의 *애니메이션 정지* 는 본 문서의 실기 항목이 **아니다** —
> 각각 0167·(0166/0167)이 닫는다. 본 문서는 ②-b 의 **오탐 제거**(AC7)까지다.

## 범위 / 비범위

- **범위**: 설계 A~D + AC 16건. **신규 모듈 0 · 신규 포트 0 · 레이어 무변경 · IPC 무변경.**
- **비범위(이월)**:

| 이월 항목 | 어디로 | 나중에 하면 더 비싼가 |
|---|---|---|
| **재시도 규칙** | 0166 | **아니오** — 지금은 push 결과가 관측 불가라 **애초에 구현할 수 없다**. 0166 의 outcome 계약과 함께 와야 한다 |
| **잔여 파생·발행·count 단위·mutation 경계** | 0167 | **아니오** — 0167 이 유일 publisher 가 되므로 지금 임시 publisher 를 만들면 **오히려 제거 비용**이 든다 |
| tracker 토큰 스코프 · `retireChannel` | 0166 | **아니오** — 포트가 있어야 성립 |
| 세션 소유권(이중 체인·업데이트 게이트·종료 누수·서브에이전트 중단) | 0166 | **아니오** — 본 문서의 토큰·attempt 가 0166 의 전제를 미리 세운다 |
| ②-a 근본 원인 규명 | 재현 로그(D) 후 | **아니오** — 특정 입력을 겨냥한 수정이 r1 의 실패였다 |

## 파일 중첩 · 병합 순서 (r7 정정)

r6 의 "**파일이 거의 겹치지 않는다**" 는 **틀렸다.** 0165·0166 은 `session-runtime.ts` ·
`pending-message-queue.ts` · `chat-turn.ts` · 어댑터 계약을 **함께** 만진다.

- **0165 → 0166 → 0167 순차 병합을 강제**한다(병렬 금지).
- 각 단계는 **단독으로** `lint`·`typecheck`·`test` green 이어야 한다.
- 0165 가 만들고 0166 이 바꿀 API 는 §"0166 이 바꿀 API" 표에 명시했다.

## 의존 기술 / 전제

- 기댈 기존 모듈: `claudeToNormalized`(배열 반환) · `SessionRuntime` 프레임 모델 · `Frame` 버퍼 ·
  `PendingMessageQueue`.
- 전제 1: `live.events` 소비처는 `session-runtime.ts` **3곳뿐**.
- 전제 2: `orphaned` 는 여전히 확정 가능(`confirm` 의 `open` 술어).
- 전제 3: renderer pending id 정합은 `ids`(messageIds)가 담당.
- 전제 4: 지각 echo 는 **죽은 채널 소속이라 도달하지 않는다**.
- **신규 의존성: 없음.**

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **0143** listen 대기 = 작업 중 | `ChatTile.tsx:51-53` | (표시 무변경) | **유지 — 결정 ⑥** |
| **0067 AC3** 취소 후 같은 채널 재사용 | `session-runtime.ts:485-504`(interrupt 경로) | §미채택 `RetiredChainRegistry` | **유지** — 취소는 채널을 은퇴시키지 않는다 |
| **0067** "uuid 보존 = pending id 정합" | `pending-message-queue.ts:328-332` 주석 | §C "정합은 `ids` 가 담당" | **정밀화** |
| 0154 "재주입도 폐기도 아닌 기다림" | `chat-turn.ts:920-936` | §C · AC12 | **유지** |
| 0151 "잔여는 교집합만 / 처분은 사용자 선택" | `interrupt-reconcile.ts:1-16` | §B | **유지** — *영수증 유효 범위*만 정한다 |
| 0136 · 0153 | 각 주석 | (무변경) | **유지** |
| main 레이어 DAG | `eslint.config.mjs` | §B "토큰은 features/sessions 내부" | **준수** — 신규 포트 0 |
| IPC variant 변경 시 문서 동시 갱신 | `docs/AGENTS.md` §6 | §범위 "IPC 무변경" | **해당 없음** |

## 파생 UX / 엣지케이스

- **취소 직후 즉시 재전송**: A 가 result 배치를 통째로 드레인에 걸어 다음 턴이 오염되지 않는다.
- **반복 취소**: teardown 이 `unframed` 를 비우므로 2·3번째는 원래 증상이 없었다 — AC14 가
  **반복까지** 포함해 회귀를 고정한다.
- **채널 사망**: 토큰 무효화로 영수증·구 배치가 함께 걸러진다.
- **강등 후 지각 echo**: `confirm` 의 `open` 술어가 orphaned 를 포함해 커밋이 유실되지 않는다.
- **"세션 전체 중단"**: open 확장으로 강등분도 폐기된다. 단 **active runtime 미도달은 0166 소관**.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| A 가 프레임 모델의 핵심 경로를 바꾼다 | 소비처 3곳·생산자 2곳 면적 실측. 세대 검사(AC3)가 잘못된 배치를 **명시적으로 폐기**해 실패 모드가 조용하지 않다 |
| C 가 wire uuid 를 바꾼다 — 지각 echo 매칭 | 지각 echo 는 죽은 채널 소속이라 도달하지 않는다(전제 4). AC12 로 정상 경로를 잠근다 |
| 0166 이 곧 바꿀 API 를 지금 만든다 | §"0166 이 바꿀 API" 표로 **예고**하고 순차 병합을 강제한다. 그래도 0165 는 **단독으로 ①을 닫는다** |
| ②-a·②-b 해제가 이번에 안 닫힌다 | **의도된 결과**(결정 ⑦·⑧ + 6차 리뷰). ②-b **오탐**은 닫히고, 나머지는 0166/0167 |

- 되돌리기 어려운 결정: 없음(공개 계약·스키마·식별자 무변경).
- **Open Question**: 없음.

## 영향 받는 파일

- `app/src/main/adapters/types.ts` — `ProviderMessageBatch` · `LiveTurn.eventBatches`(계약)
- `app/src/main/adapters/claude.ts` · `mock.ts` — 배치 생산(우회로 0)
- `app/src/main/features/sessions/session-runtime.ts` — `routeBatch` · incarnation token ·
  `ensureChannel()` · 영수증 정합 · `consumeTurnScoped` 배치 경로
- `app/src/main/features/chat/pending-message-queue.ts` — `SubmissionAttempt`(`messageIds[]`) ·
  `discardSubmitted` open 확장
- `app/src/main/app/chat-turn.ts` — chainId·attemptId 배선 · 체인 종료 강등 · `chat.postturn.step`
- **변경 없음**: `turn-coordinator.ts`(재시도 → 0166) · `post-turn.ts` · renderer · `IPC_CONTRACT.md`

## 참고 문서

- `docs/arch/backend/adapters.md` · `docs/arch/backend/observability.md`
- 후속: `docs/handoff/0166-session-chain-lease/plan.md` · `0167-session-activity-projection/plan.md`
- 선행 결정: 0154 · 0151 · 0143 · 0136 · 0153 · 0067

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 기준선(실측): lint 0 error / 1 warning(기존·무관) · typecheck 0 · vitest **1772 passed
  (196 files)** + node:test **28 pass**.
- 신규 테스트: session-runtime 7 · pending-message-queue 5 · 어댑터 2 · chat-turn harness 3.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 5건 + 사용자 결정 3건 인용
- [x] 자료조사 — r7 신규 3행 + 본 범위 15행, 전부 `파일:라인`. 앵커를 직접 열어 확인
- [x] 의존 기술 — 전제 4건, 신규 의존성 0
- [x] 파생 UX — 취소 직후 재전송·반복 취소·채널 사망·지각 echo·세션 중단 5건
- [x] 리스크 — 4건 + 완화책, Open Question 0
- [x] **요구 ⑤(비판적 검토) 이행** — 6라운드 검증. 6차가 지적한 **내 결함 3건은 코드로 확정해 전면 수용**(재시도 AC 는 `types.ts:24` 때문에 **검증 수단이 성립하지 않았다**), 6차 제안 **4건은 미채택**(근거 기재)
- [x] **`검증 수단`이 실제로 성립하는지 재점검** — 이번 라운드의 핵심 실패가 "관측 불가 AC" 였다. AC 16건 전부에 대해 *그 관측이 현재 계약으로 가능한지* 확인했고, 불가한 것(push 결과)은 **문서에서 제거**했다
- [x] `검증 수단` 공란 0 — AC 16건 중 15건 `파일::케이스`, 1건 사람 실기(절차 명시)
- [x] 부정형 기준 0개 — AC2·AC3·AC7 은 "드랍되고 false 로 남는다"·"폐기된다"·"반영되지 않는다(=배달 호출 0)" 로 **관측 가능한 상태**를 단언
- [x] AC 간 모순 없음 — AC1↔AC2(프레임 생존 vs draining) · AC3↔AC4(세대 교체 시 폐기 / 같은 채널은 같은 토큰) · AC7↔AC8(불일치 폐기 / 일치 배달) · AC11↔AC12(강등 후에도 확정) · AC12↔AC13(확정 vs 폐기 — 서로 다른 종착지)
- [x] 인용 수치 직접 측정 — `live.events` 소비처 **3** · 생산자 **2** · `orphanUnconfirmed` **2** · SDK subtype **4** · 영수증 지연 **6.06초** · 게이트 기준선 이번 세션
- [x] 신규 모듈 테스트 방법 — 4항목 전부. electron 의존은 기존 harness seam
- [x] 각 AC 에 프로덕션 도달 경로 — 유일한 호출자가 테스트인 AC 0개
- [x] "사람 실기" AC(16)에 3단계 절차가 있고, **본 문서가 닫지 않는 항목은 실기에서 제외**된다고 명시
- [x] 미룬 항목 일방향 여부 — 5건 전부 "아니오" + 근거(구현 불가 · 제거 비용 · 포트 필요 · 전제 선행 · 원인 미확정)
- [x] **파일 중첩·병합 순서** — r6 의 잘못된 서술을 정정하고 순차 병합을 강제
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 8행을 본문 문장 기준으로 채웠고 인용 경로 확인

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 가 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만 | … |

## [구현자 기입] 구현 체크리스트

- [ ] A 메시지-원자 배치 라우팅 (claude · mock · `routeBatch` · `consumeTurnScoped`)
- [ ] B channel incarnation token (`ensureChannel` · 세대 검사 · 영수증 정합)
- [ ] C `SubmissionAttempt` + 체인 종료 강등 + `discardSubmitted` open 확장
- [ ] D `chat.postturn.step` 관측

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
| D1 | ②-a 의 실제 판정 입력이 로그로 확정되지 않았다 | r2 자체 검토 | §D 관측으로 다음 재현에서 확정 → 0166/0167 중 하나로 귀속 | open |
| D2~D7 | 대기 표시 · 세션 전체 중단 미도달 · 업데이트 게이트 · 종료 누수 · 서브에이전트 중단 · 이중 체인 | r4~r6 | **0166 / 0167** | 이관 |
| D8 | **push 결과가 관측 불가**(`pushTurn: Promise<void>`) — 안전한 재시도 규칙을 세울 수 없다 | r7 검증(`types.ts:24` · `streaming-input.ts:30`) | **0166** 의 adapter outcome 계약 | 이관(0166) |
| D9 | **최초 prompt·프렐류드가 LiveTurn 이전에 적재**돼 "모든 입력이 Runtime 통과" 가 성립하지 않는다 | r7 검증(`claude.ts:327-334`) | **0166** 의 spawn handshake | 이관(0166) |

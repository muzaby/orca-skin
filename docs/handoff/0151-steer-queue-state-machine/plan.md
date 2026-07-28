# Plan — 0151-steer-queue-state-machine

## 메타

| 항목 | 값 |
|---|---|
| slug | `0151-steer-queue-state-machine` |
| 작성자 | Claude Code |
| 일자 | 2026-07-28 |
| 매핑 | PHASES "현재 작업 중" / 브랜치 `claude/steer-pending-queue-review-a8zgsm` |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 첨부 가이드(`Orca Steer 메시지 구조 진단 및 구현 가이드`)를 **수석 엔지니어 관점에서 비판적 검토** | 라이브 세션 요청 (2026-07-28) |
| 명시 요구 | 검토 결과를 기반 지식으로 두고 **현행 steer 구조 진단 → 약점·구조적 취약점 도출 → 새 구조 제안** | 라이브 세션 요청 (4단계 지시) |
| 명시 요구 | 제안한 구조를 **핸드오프 작성 + 구현** | 라이브 세션 요청 |
| 명시 요구(검토 2회차) | 가이드의 "Driver 추상화 + native queue 점진 도입" **최종 권고 철회**, PostToolBatch 기반 로컬 hold 유지 | 사용자 첨부 문서 §1 "최종 판정 — 반론을 대체로 채택합니다" |
| 명시 요구(검토 2회차) | Stop 잔여 처리는 **우리 uuid 교집합만**, 모르는 내부 uuid 는 무시 | 사용자 첨부 문서 §3 + 세션 내 사용자 선택("우리 uuid 만 대조 → 있으면 채널 폐기") |
| 추론 의도 | 가이드 §6 의 3-클래스 구조(Controller/Registry/Driver)는 **도입하지 않는다** — 근거인 provider lifecycle 이 공개 표면에 없으므로. *추론*: 사용자가 "새로운 구조를 제안하라"고 했을 때 원한 것은 *더 큰 추상화*가 아니라 *실재 결함을 푸는 구조*라고 해석 | 사용자 첨부 문서 §1 최종선 + 본 세션 §6 반론 |
| 추론 의도 | Stop 시 "세션 전체 중단" 능동 제시 UX 는 **제품 결정**이므로 이번 범위에서 제외하고 Open Question 으로 올린다 | *추론* — `AGENTS.md` "제품 의도는 단독 결정 금지" |

## Context (왜)

첨부 가이드는 현행 steer 큐를 진단하고 `SessionCommandController` / `EphemeralCommandRegistry` / `QueuedInputDriver` 3-클래스 목표 구조를 제안했다. 본 세션의 비판적 검토에서 그 처방의 전제 3건이 **SDK 0.3.220 공개 표면에 존재하지 않음**이 저장소 자체 실증으로 확인됐고(§자료조사 R1~R3), 사용자가 이를 수용해 최종 권고를 철회했다.

남은 것은 **실재하는 결함**이다. 본 세션의 재진단에서 두 문서가 합의한 3건(push 무영수증 · interrupt 영수증 폐기 · text 폴백) 외에 **코드 재검토로 새로 확인된 취약점 4건**(GC 부재 · 세션 삭제 미정리 · 취소 침묵 · 미확인 전달 상태 부재)이 나왔다.

관통하는 원인은 하나다 — **상태 머신이 존재하지만 데이터로 존재하지 않는다.** 4상태(held → flushed → consumed → drained)가 `consumed` 불리언 + 두 Map 의 소속으로만 인코딩돼 있어, 표현할 수 없는 상태·검증할 수 없는 전이·정리 시점이 없는 수명이 생긴다.

**의도한 결과**: 소유권 모델(로컬 hold + PostToolBatch 전달 경계)은 그대로 두고, 암묵 상태 머신을 명시 데이터로 올려 위 7건을 동시에 해소한다. 신규 모듈 0개.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **R1.** 공개 `Query.interrupt()` 는 **인자가 없다** — `interrupt(): Promise<SDKControlInterruptResponse \| undefined>`. `cancel_queued` 는 프로토콜 타입에만 있고 래퍼가 `{subtype:"interrupt"}` 를 하드코딩 | `@docs/etc/study/claude/api/04-제어-메서드-setModel-setPermissionMode-interrupt.md` §4.1~4.2 (`sdk.d.ts:2293`, `sdk.mjs` `class Hh`) |
| **R2.** `command_lifecycle` 은 `SDKMessage` 39-variant 유니언에 **없다** | `@docs/etc/study/claude/api/03-출력-경로-SDKMessage.md` §3.1 (`sdk.d.ts:4019`) |
| **R3.** `cancel_async_message` 는 제어 subtype 으로 존재하나 **`Query` 타입 안전 래퍼 목록에 없다**(`interrupt`/`setPermissionMode`/`stopTask`/`backgroundTasks`/`streamInput`/`close` 뿐) | `@docs/etc/study/claude/02-제어-프로토콜과-턴-큐.md` §2.2 |
| **R4.** `still_queued` 는 **클라이언트가 보낸 적 없는 내부 uuid**(cron 트리거·auto-resume continuation)를 포함할 수 있다 — *"ignore unknown uuids rather than treating them as an error"* | `@docs/etc/study/claude/api/04-…md` §4.3 (`sdk.d.ts:3487` JSDoc) |
| **R5.** Orca 는 **백그라운드 서브에이전트가 기본**이고 완료 알림은 CLI 내부 큐 주입 → auto-resume continuation 으로 새 턴을 연다 → R4 의 "내부 uuid" 가 Orca 에서 실제로 발생한다 | `@docs/etc/study/claude/05-비동기-턴-전환-listen-모델.md` §5.0 · 핸드오프 0143 |
| **R6.** 구형 CLI 는 `still_queued` 없는 빈 성공 응답을 보낸다 → 반환형이 `\| undefined`. **버전이 아니라 `capabilities` 배열로 feature-detect** (`interrupt_receipt_v1`) | `@docs/etc/study/claude/api/04-…md` §4.3 (`sdk.d.ts:4447`) |
| **R7.** CLI 는 큐를 **배치로 coalesce** 하며, coalesce 후 **비대표 uuid 취소는 no-op** — 현행 "대표 uuid 1개 = 배치 1개" 가 provider 모델과 정합. 배치 분해(가이드 P1)는 provider 가 못 지킨다 | `@docs/etc/study/claude/02-…md` §2.3 (`sdk.d.ts:3487`) |
| **R8.** `interrupt()` 반환값을 **의도적으로 폐기**하고 있다 — 주석이 자백 | `app/src/main/adapters/claude.ts:470-473` · 포트 `adapters/types.ts:26` `interrupt(): Promise<void>` |
| **R9.** `push()` 는 closed 스트림에서 **조용히 no-op** 한다 | `app/src/main/adapters/streaming-input.ts:72-77` |
| **R10.** `flushHeld()` 가 held 를 먼저 지우고(`:130`) 호출자가 *그 뒤* push 한다 → 비원자적 인계 | `app/src/main/features/chat/pending-message-queue.ts:127-134` · `adapters/claude-adapt.ts:150-152` |
| **R11.** `markConsumed` 의 text 폴백이 uuid 를 **함께 받고도** 불일치 시 발동 — 호출자가 항상 둘 다 넘긴다 | `pending-message-queue.ts:178-184` · `turn-coordinator.ts:151-154` |
| **R12.** `flushedBySession` 에서 항목이 빠지는 경로는 `drainConsumedBatches`(consumed 만)와 `takeForRespawn`(**채널 사망 시에만**) 둘뿐 → echo 유실 시 배치가 세션 런타임 수명(수 시간) 내내 잔존. base64 첨부 포함 | `pending-message-queue.ts:149-166,194-203` · 런타임 수명 `bootstrap.ts:440` |
| **R13.** 같은 버그 클래스를 0149 가 이미 한 번 고쳤다 — *"원 턴 request 를 spread 하면 그 턴의 base64 첨부(수 MB)가 listen phase 내내 살아남는다"* | `app/src/main/app/chat-turn.ts:827-829` · 핸드오프 0149 AC10 |
| **R14.** `sessionDelete` 핸들러가 `pendingMessages` 를 **건드리지 않는다**(`grep` 결과 핸들러 참조 0건) | `app/src/main/app/handlers/session.ts:90-94` |
| **R15.** 취소 거부가 **무이벤트 반환** → renderer 는 `message.cancelled` 로만 pending 버블을 제거하므로 사용자에게 아무 피드백이 없다 | `app/src/main/app/chat-turn.ts:960-968` · `renderer/…/chatStore.ts:469` |
| **R16.** `consumed` 확정 신호가 배치 성격에 따라 **둘로 갈리는데**(턴-시작=첫 모델 출력 / steer=echo), 배치에 성격 필드가 없다 — 규약이 4개 모듈에 흩어져 있다 | `turn-coordinator.ts:151,278-283` · `pending-message-queue.ts:53-58` |
| **R17.** **같은 `flushHeld` 가 두 성격을 만든다** — 게이트 훅(`chat-turn.ts:776`)은 steer, 연속 턴 루프(`:881`)는 턴 프롬프트. 따라서 성격은 메서드로 유도할 수 없고 **호출자가 명시**해야 한다 | `chat-turn.ts:776,881-896` |
| **R18.** `takeForRespawn` 이 회수한 미소비 배치는 **프렐류드로 재주입**되므로 성격이 steer → turn-open 으로 바뀐다 | `chat-turn.ts:884-886` · `claude.ts:319-329` |
| **R19.** `pendingMessages` 는 컴포지션 루트(`bootstrap.ts:471`)가 생성해 `registerChatHandlers` 에 주입한다 → 루트가 참조를 갖고 있어 세션 삭제·종료 배선이 **교차 feature import 없이** 가능 | `bootstrap.ts:471-484` |
| **R20.** echo 는 **CLI 의 drain 증거**이지 모델 소비 증거가 아니다 — *"실제 소비를 관측하려면 출력 스트림의 replay variant 를 봐야 한다"* | `@docs/etc/study/claude/api/02-입력-경로-SDKUserMessage.md` §124 · 사용자 첨부 문서 §2 |

## 인수 기준 (Acceptance Criteria)

1. **배치가 자기 성격을 안다.** 큐 레코드가 `origin: 'turn-open' | 'steer'` 를 보유하고, 예약 시 **호출자가 명시**한다(R17). `takeForRespawn` 회수분은 `turn-open` 으로 재스탬프한다(R18).
2. **상태가 1급 필드다.** 레코드가 `state: 'submitted' | 'confirmed' | 'orphaned'` 를 갖는다(held 는 별도 맵 유지). `consumed` 불리언은 제거한다.
3. **push 영수증.** `SessionInputStream.push()` 가 `boolean`(수용 여부)을 반환하고 closed 에서 `false` 를 낸다. 조용한 no-op 제거(R9).
4. **예약 롤백.** 게이트 훅에서 `push` 가 `false` 를 반환하거나 예외가 나면 예약이 `held` 로 되돌아가 **다시 취소 가능**해진다(R10). 롤백된 항목은 `createdAt` 순서를 보존한다.
5. **확정 신호 검증.** `confirm(sessionId, signal)` 이 `origin` ↔ `signal.kind` 를 대조해 불일치 확정을 거부한다 — `echo`→`steer` 만, `model-output`→`turn-open` 만(R16).
6. **uuid 우선 확정.** `signal.kind==='echo'` 이고 `uuid` 가 있으면 **uuid 로만** 판정한다. 불일치 시 text 폴백으로 넘어가지 않는다. uuid 부재 replay 만 text 폴백을 탄다(R11).
7. **미확인 전달에 상태가 있다.** 턴 체인 종료 시 `orphanUnconfirmed()` 가 미확정 `submitted` 를 `orphaned` 로 전이하고 카운트를 로그로 남긴다(R12·R15). 지각 도착한 확정 신호는 `orphaned` 도 확정할 수 있다(커밋 유실 방지).
8. **수명 정리.** `dispose(sessionId)` 가 해당 세션의 held·submitted·confirmed·orphaned 전량을 제거하고 payload(첨부 base64 포함)를 스크럽한다. **세션 삭제**(R14)와 **프로그램 종료**에서 호출된다.
9. **종료 admission freeze.** `freeze()` 이후 `enqueue`/예약이 거부된다. `bootstrap.shutdown()` 이 맨 앞에서 호출한다.
10. **interrupt 영수증 상위 전달.** `LiveTurn.interrupt()` 가 `InterruptReceipt | undefined` 를 반환한다. `undefined`(capability 미보유, R6)와 `{stillQueued: []}`(잔여 없음)를 **엄격히 구분**한다(R8).
11. **우리 uuid 만 대조.** 컴포지션 루트가 `receipt.stillQueued ∩ submittedUuids(sessionId)` 를 계산한다. **교집합이 비면 무동작**(모르는 uuid 는 무시 — R4·R5 로 0143 백그라운드 통지 보존). 교집합이 있으면 로그 + renderer 통지.
12. **소유권이 UI 에 보인다.** 신규 이벤트 `message.submitted` 로 pending 버블이 "전달됨" 상태가 되고 **취소 버튼이 사라진다**(R15). `IPC_CONTRACT.md` 를 동시 갱신한다.
13. **교차 feature import 0.** `features/sessions` → `features/chat` 직접 참조 없이 컴포지션 루트 주입으로 배선한다(`main/AGENTS.md` 해소책 ③, R19). `npm run lint` boundaries 위반 0.
14. **테스트**: AC3~AC11 을 덮는 신규 단위 테스트. 최소 — closed 스트림 롤백 · push 예외 롤백 · 롤백 후 재예약 · confirmed 롤백 거부 · origin↔signal 불일치 거부 · uuid 불일치 시 text 폴백 미발동 · uuid 부재 시 text 폴백 발동 · orphan 전이 · 지각 확정 · dispose 스크럽 · freeze 거부 · 영수증 `undefined`/빈배열/우리uuid/미지uuid 4분기.
15. **게이트**: `npm run lint`(0 error) · `npm run typecheck`(3분할 0) · vitest 회귀 0. 신규 의존성 0.

## 범위 / 비범위

- **범위**: 위 AC1~15. `PendingMessageQueue` 상태 머신화 + push/interrupt 영수증 + 수명 정리 + `message.submitted` IPC 1건 + 렌더러 버블 취소 버튼 조건부 렌더.
- **비범위**:
  - 가이드 §6 의 `SessionCommandController` / `EphemeralCommandRegistry` / `QueuedInputDriver` — 전제(R2·R3)가 공개 표면에 없다. 재검토 조건: `command_lifecycle` + 개별 uuid 취소가 `sdk.d.ts` 에 오를 때.
  - **Stop 시 "세션 전체 중단" 능동 제시 UX** — 제품 결정(Open Question 1).
  - **`orphaned` 자동 재주입 여부** — 이중 전달 위험이 있어 제품 결정(Open Question 2). 이번엔 기존 동작(채널 사망 시 `takeForRespawn` 재주입)만 유지한다.
  - `still_queued` 교집합 발생 시 **런타임 폐기** — Open Question 1 에 종속. 이번엔 관측·통지까지만.
  - 관측 지표 10종(가이드 §8.3) — 이번엔 orphan·영수증 로그 2건만.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `PendingMessageQueue`(`features/chat/pending-message-queue.ts`) · `createSessionInputStream`(`adapters/streaming-input.ts`) · `makeSteerGateHook`(`adapters/claude-adapt.ts`) · `decidePostTurnStep`(`features/chat/post-turn.ts`) · `sendChatEvent`(`infra/ipc/send`) · `getLogger()`(`infra/log/registry`).
- SDK: `Query.interrupt()` 반환 `SDKControlInterruptResponse | undefined`(R1). **새 SDK 표면을 쓰지 않는다** — 이미 호출 중인 메서드의 반환값을 버리지 않을 뿐이다.
- 전제: `pendingMessages` 가 컴포지션 루트 스코프에 있다(R19) — 세션 삭제/종료 배선의 전제.
- **신규 의존성: 없음.**

## 설계

### 1) 상태 모델 (`pending-message-queue.ts`)

```ts
export type BatchOrigin = 'turn-open' | 'steer'
export type BatchState = 'submitted' | 'confirmed' | 'orphaned'

interface TrackedBatch extends SteerFlushBatch {
  origin: BatchOrigin
  state: BatchState
  items: PendingMessage[]   // 롤백 복원 원본
}

export type ConfirmSignal =
  | { kind: 'echo'; uuid?: string; text?: string }        // → origin 'steer' 만
  | { kind: 'model-output'; uuids: string[] }             // → origin 'turn-open' 만
```

전이:

```
held ──reserve*──→ submitted ──confirm(신호 일치)──→ confirmed ──drainConfirmed──→ 제거+scrub
  │                    │
  │←──rollback─────────┤ (push=false / 예외)
cancel                 └──턴 체인 종료──→ orphaned ──takeForRespawn──→ 재주입(turn-open 재스탬프)
                                              └──지각 confirm──→ confirmed
```

메서드(구명 → 신명): `flushHeld`→**`reserveHeld(sessionId, origin, uuid?)`** · `flushItem`→**`reserveItem(sessionId, id, origin)`** · `markConsumed`→**`confirm(sessionId, signal): SteerFlushBatch[]`** · `drainConsumedBatches`→**`drainConfirmed(sessionId)`**. 신규: `rollback` · `orphanUnconfirmed` · `submittedUuids` · `dispose` · `freeze`.

이름을 바꾸는 이유: `flush` 는 "보내고 잊는다"를 함의하는데 새 계약은 **되돌릴 수 있는 예약**이다. 이름이 계약을 말하게 한다.

### 2) 영수증 2종

- `SessionInputStream.push(content, uuid): boolean` — `closed` 면 `false`.
- `LiveTurn.interrupt(): Promise<InterruptReceipt | undefined>`, `InterruptReceipt = { stillQueued: string[] }` (`adapters/turn.ts` 신설 타입). `claude.ts` 가 `handle.interrupt()` 결과를 매핑하고 **`undefined` 는 그대로 전파**한다. `mock.ts` 는 `undefined`.

### 3) 배선 (신규 모듈 0개, 교차 feature import 0)

| 지점 | 변경 |
|---|---|
| `claude-adapt.ts` `makeSteerGateHook(take, push, rollback?)` | `push` 가 `boolean` 반환 → `false`/예외 시 `rollback(batch)`. fail-open 유지 |
| `adapters/turn.ts` `TurnRequest` | `rollbackSteerFlush?` · `onInterruptReceipt?` 추가 |
| `session-runtime.ts` | `delegate` 에 `onInterruptReceipt` 추가. `markAborted` 는 **동기 시그니처 유지**하고 `interrupt().then(r => delegate.onInterruptReceipt?.(r))` 로 위임 |
| `app/chat-turn.ts` | `reserveHeld(…, 'steer')`(게이트) / `reserveHeld(…, 'turn-open')`(연속 턴 `:881`) / `reserveItem(…, 'turn-open')` 로 **호출부가 성격을 명시**. `rollbackSteerFlush`·`onInterruptReceipt` 바인딩. `decidePostTurnStep === 'break'` 에서 `orphanUnconfirmed()` |
| `app/handlers/session.ts` | `registerSessionHandlers(ctx, { onSessionDisposed })` — 루트가 `dispose` 주입 (R19) |
| `app/bootstrap.ts` | `pendingMessages` 를 필드로 보관. `shutdown()` 맨 앞 `freeze()`, 끝에 세션별 `dispose()`. `runtime-pool` idle close 경로에도 dispose 훅 |
| `turn-coordinator.ts` | `confirm({kind:'echo',…})` / `confirm({kind:'model-output', uuids})` 로 교체 |
| `shared/ipc.ts` | `message.submitted` 이벤트 variant 추가 |
| renderer `chatStore.ts` · `PendingSteerTurn.tsx` | `PendingSteerState.submitted?: boolean`. `submitted` 면 취소 버튼 미렌더 + `data-state="submitted-steer"` |

### 4) 레이어 경계 준수

`SessionRuntime`(features/sessions)은 `PendingMessageQueue`(features/chat)를 **절대 import 하지 않는다.** 영수증은 `TurnRequest` 의 콜백(구조적 포트)으로 흐르고, 교집합 계산은 컴포지션 루트(`app/chat-turn.ts`)가 한다 — `main/AGENTS.md` 해소책 ③.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **취소 불가 상태의 가시화**: submitted 버블은 취소 버튼이 없고 시각적으로 구분된다(AC12). "눌렀는데 아무 일도 안 남"(R15) 제거.
- **동시성/멀티세션**: 상태는 세션 키별 격리 유지. `dispose` 는 해당 세션만.
- **새 세션(`dbSessionId` 미확정)**: 예약 자체가 불가하므로(`chat-turn.ts:776` 가드) 빈 회수가 옳다 — 현행 유지. `rekey` 후 정상 흐름.
- **지각 신호**: 턴 종료 후 도착한 echo 가 `orphaned` 를 확정 → 커밋 유실 방지(AC7).
- **롤백 순서**: 롤백된 항목이 그 사이 들어온 신규 held 보다 **앞**에 와야 한다(`createdAt` 정렬).
- **빈 상태**: 모든 신규 조회(`submittedUuids`)는 세션 미등록 시 `[]`.
- **테마/접근성**: submitted 버블은 기존 pending 버블 토큰을 재사용하고 배지만 추가 — 신규 CSS·토큰 0.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 메서드 4개 개명 → 기존 테스트 대량 수정 | 개명이 계약 변화를 말하게 하는 것이 목적(설계 §1). 테스트 수정은 같은 커밋에서 수행하고, 동작 회귀는 신규 테스트(AC14)가 잡는다 |
| `orphanUnconfirmed` 를 너무 이르게 호출하면 진행 중 배치를 오분류 | `decidePostTurnStep === 'break'`(턴 체인 종료)에서만 호출. `orphaned` 도 확정 가능(AC7)하므로 오분류의 기능적 피해는 0 — 관측 라벨만 영향 |
| `push` 반환형 변경이 호출부 전수에 영향 | 호출부는 `claude.ts` 2곳뿐(`pushTurn`·게이트). typecheck 가 전수 강제 |
| `still_queued` 교집합이 있어도 **취소할 공개 API 가 없다**(R3) | 이번엔 관측·통지까지만. 폐기 여부는 Open Question 1 |
| `dispose` 를 LRU 축출에 걸면 축출된 세션의 held 가 사라진다 | **idle close 경로에는 걸지 않는다** — 축출은 채널만 닫고 큐는 살아야 `takeForRespawn` 재주입이 성립. `dispose` 는 **세션 삭제 + 프로그램 종료**만 |
| 되돌리기 어려운 결정: IPC 이벤트 1건 추가 | additive variant 이며 renderer 미처리 시 무시된다. `IPC_CONTRACT.md` 동시 갱신 |

- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  - **OQ1.** Stop 시 우리 uuid 가 `still_queued` 에 남았을 때 — (a) 통지만 / (b) 능동 "세션 전체 중단" 제시 / (c) 무조건 런타임 폐기. (c)는 0143 백그라운드 통지를 죽인다(R4·R5).
  - **OQ2.** `orphaned` 처리 — (a) 다음 턴 자동 재주입(이중 전달 위험) / (b) 폐기 후 draft 복원 / (c) 관측만(= 기존 동작 유지).
  - **→ r2 에서 사용자 결정 완료: OQ1 = (b), OQ2 = (b)** (라이브 세션 "진행하라" — 검증자 권고안 채택). 아래 AC16~AC19 로 인수 기준 승격.

## 인수 기준 추가 (r2 — OQ 결정 반영)

16. **Stop 잔여를 능동 고지한다.** `still_queued ∩ 우리 예약` 이 비지 않으면 `chat.residual{count}` 를 발신하고, 컴포저가 "세션 전체 중단" 액션이 붙은 Notice 를 띄운다. 교집합이 비면 통지를 해제한다(`count:0`). 수동적 배지로 끝내지 않는다 — Stop 을 눌렀는데 잠시 후 steer 가 실행되는 것은 Stop 의 통념과 어긋나므로 그 자리에서 완전 정지 수단을 준다.
17. **"세션 전체 중단" 이 실제로 잔여를 없앤다.** 신규 IPC `orca:chat:discardSession` 이 진행 턴 abort → 런타임(서브프로세스) 폐기 → 잔여 예약 폐기 → `message.cancelled`(draft 복원) + `chat.residual{count:0}` 을 수행한다. **백그라운드 서브에이전트도 함께 종료된다는 사실을 UI 문구에 명시**한다(비용을 숨기지 않는다).
18. **`orphaned` 는 자동 재주입하지 않는다.** 턴 체인 종료 시 `discardOrphaned` 로 큐에서 빼고 `message.cancelled` 로 텍스트를 composer draft 에 되돌린다. 근거: 확정 신호 부재는 "CLI 가 못 봤다" 와 "봤는데 echo 가 유실됐다" 를 **구분할 수 없다**(공개 SDK 에 "이 uuid 가 실행됐나" 를 묻는 표면이 없다). 재주입은 후자에서 모델 이중 전달, 조용한 폐기는 전자에서 유실이므로 **사용자를 루프에 넣는다**.
19. **폐기된 배치는 되살아나지 않는다.** `discardOrphaned`/`discardSubmitted` 이후 지각 확정 신호나 `takeForRespawn` 이 그 배치를 재전달하지 않는다.

## 영향 받는 파일

- `app/src/main/features/chat/pending-message-queue.ts` (+ `.test.ts`)
- `app/src/main/adapters/streaming-input.ts` (+ `.test.ts`) · `claude-adapt.ts` (+ `.test.ts`) · `claude.ts` · `turn.ts` · `types.ts` · `mock.ts`
- `app/src/main/features/sessions/session-runtime.ts`
- `app/src/main/features/chat/turn-coordinator.ts`
- `app/src/main/app/chat-turn.ts` · `bootstrap.ts` · `handlers/session.ts`
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `components/transcript/PendingSteerTurn.tsx`
- `docs/IPC_CONTRACT.md` (채널 무증가, 이벤트 variant +1)

## 참고 문서

- `@docs/etc/study/claude/02-제어-프로토콜과-턴-큐.md` §2.2·2.3 · `api/03` §3.1 · `api/04` §4.1~4.3 · `05` §5.0
- `@docs/IPC_CONTRACT.md` §3 (NormalizedEvent variant — **동시 갱신**)
- `@app/src/main/AGENTS.md` (레이어 DAG · 교차 feature 해소책 ③)
- 선행 핸드오프: 0060(D1·D3·D5) · 0067(AC5·AC6·AC9) · 0069(확정 신호 2종) · 0143(백그라운드 기본화) · 0149(AC10 첨부 수명)

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립) + `./node_modules/.bin/vitest run` 순수 스위트.
- DB 로드 스위트 실패는 egress 차단 베이스라인으로 분리 보고(`app/AGENTS.md` 제약 환경 절).
- 신규 테스트: `pending-message-queue.test.ts`(상태 머신 전수) · `streaming-input.test.ts`(closed 영수증) · `claude-adapt.test.ts`(게이트 롤백) · 영수증 교집합 판정 순수 함수.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청 + 사용자 첨부 문서 인용으로 출처화했고, 추론 3건을 추론으로 표기했다.
- [x] 자료조사 — 발견 20건 전부 `@docs/…`(절 번호) 또는 `파일:라인` 레퍼런스를 붙였다. 추측은 Open Question 으로 분리했다.
- [x] 인수 기준 — 15개 번호, 각각 R1~R20 에 근거하며 기계 검증 가능(AC12 시각 확인 제외).
- [x] 의존 기술 — 신규 의존성 0. SDK 신규 표면 사용 0(기존 호출의 반환값만 회수).
- [x] 파생 UX — 취소 가시화·동시성·새 세션·지각 신호·롤백 순서·빈 상태·테마를 펼쳤다.
- [x] 리스크 — 개명 비용·조기 orphan·dispose 범위·되돌리기 어려운 IPC 추가를 적고, OQ 2건을 사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: 설계 §1 의 "상태를 데이터로 올린다" 는 구현하면서 값을 증명했다. `origin` 필드 하나가 AC5·AC6 을 동시에 풀고(신호 검증이 큐 안의 한 줄이 됨), `orphaned` 상태 하나가 AC7·V1(GC)·관측을 함께 푼다. 설계 §3 의 "신규 모듈 0개" 도 대체로 지켜졌다(예외 1건 — 아래 P1).
- **이견 1 — AC8 의 "payload 스크럽" 이 과약속이었다.** 설계는 *"다른 곳이 같은 객체를 참조하고 있어도 내용이 남지 않는다"* 고 적었으나, `reserveHeld`/`reserveItem` 이 반환하는 공개 배치는 `toBatch` 가 만든 **별개 스냅샷**이고 큐는 그 참조를 갖고 있지 않다. 큐가 스크럽할 수 있는 것은 (a) 자기 맵이 붙든 `TrackedBatch` 와 (b) 참조를 공유하는 `PendingMessage` 아이템뿐이다. 이미 어댑터로 흘려보낸 호출자 스냅샷을 지울 방법은 없고, 지우겠다고 주장해서도 안 된다. **테스트를 실제 보장에 맞춰 좁혔다**(`heldItem` 스크럽 + 큐 미보유 검증). 실제 leak(R12·R13 — 맵이 세션 런타임 수명 내내 base64 를 pin)은 그대로 해소된다.
- **이견 2 — 설계가 `ManagedRuntime`/`CoordinatorRuntime` 타입 파급을 예측하지 못했다.** AC10 이 `LiveTurn.interrupt()` 반환형만 바꾸는 것으로 적혔으나, `RuntimeLiveTurn extends LiveTurn` 을 통해 **런타임 거버넌스 표면 3곳**(`ManagedRuntime`·`CoordinatorRuntime`·`TurnContext.live`)이 같이 끌려왔다. 실제로는 두 `interrupt` 가 **다른 행위**다(SDK 제어 호출 vs 턴 중단 표시) — 아래 P2 로 선조치.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| P1 | AC11 의 교집합 판정이 `chat-turn.ts` 클로저 안에 있어 **단위 테스트가 불가능**했다. AC14 는 "영수증 4분기" 테스트를 요구하는데 설계대로면 검증할 수 없다. | ✅ 구현함 — 순수 함수 `features/chat/interrupt-reconcile.ts`(`reconcileInterruptReceipt`)로 추출하고 `InterruptOutcome` 3-variant(`unknown`/`clear`/`survived`)로 반환. 6 케이스 테스트 신설. 설계의 "신규 모듈 0개" 를 1개 어겼지만, 순수 판정 함수 1개가 테스트 불가를 해소하는 대가로 타당하다고 판단. | `main/AGENTS.md` "테스트 동반 — 순수 변환기는 단위 테스트와 함께" |
| P2 | `LiveTurn.interrupt()` 반환형 변경이 `RuntimeLiveTurn` 상속을 타고 거버넌스 표면 3곳으로 전파돼 타입 에러 20+ 를 냈다. | ✅ 구현함 — `contracts/ports.ts` 에 `GovernedLiveTurn`(= `Omit<RuntimeLiveTurn,'interrupt'>` + `interrupt(): Promise<void>`)을 신설하고 `ManagedRuntime`·`CoordinatorRuntime`·`TurnContext.live`·`settle.ts` 가 이를 쓰게 했다. **의미를 분리한 것이지 회피가 아니다**: 어댑터 raw 핸들의 interrupt 는 SDK 제어 호출(영수증 반환), 거버넌스의 interrupt 는 "이 턴 중단 표시"(영수증은 `onInterruptReceipt` 위임으로 별도 도착). | `adapters/types.ts` vs `session-runtime.ts:497` 의 두 `interrupt` 의미 차이 |
| P3 | `bootstrap.shutdown()` 의 조기 반환 경로(`!supervisor \|\| !bus` — `start()` 이전 종료)가 `disposeAll()` 을 건너뛴다. | ✅ 구현함 — 조기 반환 직전에도 `disposeAll()` 을 호출. freeze 는 그보다 앞. | AC8·AC9 |
| P4 | `dispose` 를 LRU idle 축출에 걸면 축출 세션의 held 가 사라져 `takeForRespawn` 재주입이 깨진다. | ✅ 구현함(안 거는 쪽으로) — `dispose` 는 **세션 삭제 + 프로그램 종료**만. 큐 주석에 이유를 명시. plan 리스크 표의 결정과 동일. | plan 리스크 표 |
| P5 | `freeze()` 가 취소·확정·drain 까지 막으면 종료 중 진행 정리가 멎는다. | ✅ 구현함 — freeze 는 `enqueue`(throw `app_closing`)·`reserveHeld`/`reserveItem`(undefined) 만 막고 `cancel`/`confirm`/`drainConfirmed` 는 통과. 회귀 테스트 1건. | AC9 |
| P6 | `takeForRespawn` 이 회수한 **steer** 배치가 새 턴에서는 프렐류드/프롬프트가 되므로 확정 신호가 echo→첫 모델 출력으로 바뀐다. origin 을 그대로 두면 영영 확정되지 않는다. | ✅ 구현함 — `takeForRespawn` 이 회수분 origin 을 `turn-open` 으로 **재스탬프**. 회귀 테스트로 고정(echo 거부 + model-output 확정). | R18 · AC1 |
| P7 | `chat.steer.orphaned`·`chat.interrupt.*` 로그가 메시지 본문을 실을 위험. | ✅ 구현함 — 카운트·sessionId 만 기록(본문·uuid 목록 미기록). | `arch/backend/observability.md` prod 카탈로그 원칙 |

## [구현자 기입] 구현 체크리스트

- [x] AC1 `BatchOrigin` + 호출부 3곳이 성격 명시(게이트=steer / 연속 턴=turn-open / 턴 프롬프트=turn-open)
- [x] AC2 `BatchState` 3상태 + `consumed` 불리언 제거
- [x] AC3 `push(): boolean` + closed=false
- [x] AC4 `rollback` + 게이트 훅 배선(false·예외 양쪽)
- [x] AC5 origin↔signal 검증
- [x] AC6 uuid 우선 판정(불일치 시 폴백 금지)
- [x] AC7 `orphanUnconfirmed` + 턴 체인 종료 배선 + 지각 확정 허용
- [x] AC8 `dispose`/`disposeAll` + 세션 삭제·종료 배선
- [x] AC9 `freeze` + shutdown 선두 배선
- [x] AC10 `InterruptReceipt` 포트 + claude 매핑(`undefined` 보존) + mock
- [x] AC11 `reconcileInterruptReceipt` 교집합(미지 uuid 무시)
- [x] AC12 `message.submitted` IPC + renderer 취소 버튼 조건부 + i18n(ko/en)
- [x] AC13 boundaries 위반 0 (컴포지션 루트 주입)
- [x] AC14 신규 테스트 (queue 32 · adapt/streaming 56 · reconcile 6)
- [x] AC15 게이트 + 신규 의존성 0
- [x] `docs/IPC_CONTRACT.md` 동시 갱신(이벤트 variant +1, 채널 수 불변)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main 13 — `features/chat/{pending-message-queue,interrupt-reconcile(신규),turn-coordinator,settle}.ts` · `adapters/{streaming-input,claude-adapt,claude,turn,types,mock}.ts` · `features/sessions/session-runtime.ts` · `contracts/{ports,turn}.ts` · `app/{chat-turn,bootstrap,handlers/session}.ts` · shared 1 — `shared/ipc.ts` · renderer 4 — `chatStore.ts` · `PendingSteerTurn.tsx` · i18n `resources/{ko,en}.ts` · 테스트 8 · 문서 2 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` |
| 게이트 결과 | lint ✅ **0 error**(warning 1 = `useTranscriptVirtualizer` TanStack↔React Compiler, 0102 이래 베이스라인) · typecheck ✅ **3/3** · vitest ✅ **1212/1212 pass** (파일 1 = `chat-turn.continuity.test.ts` **로드 실패** — `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 로 설치해 electron 바이너리 부재, **테스트 0건 실패**, 코드 무관 환경 제약) · scripts ✅ **28/28** |
| 신규 의존성 | 0 |
| 블로커 / 역질문 | 없음 (r1 시점의 OQ 2건은 r2 에서 사용자 결정 후 구현 완료 — 아래 참조). |
| 대상 커밋 | `32a350e`(r1) · `2d4480e`(CI 회귀 수정) · r2(OQ 구현) |

## [구현자 기입] r2 — CI 회귀 수정 + OQ 결정 구현

### R1. CI 가 잡은 실재 회귀 (커밋 `2d4480e`)

**증상**: `chat-turn.continuity.test.ts` 2건 실패 — 사용자 메시지 파트가 영속되지 않음(`parts` 가 `[]`).

**원인**: AC5 의 origin↔신호 대조를 **양방향 대칭**으로 만든 것이 과했다. echo 를 `steer` 전용으로 막았는데, echo 는 **CLI 가 입력을 drain 했다는 영수증**이라 배치 성격과 무관하게 유효하다. **모델 출력이 하나도 없는 턴**(handoff 도착 턴)에서는 turn-open 배치의 **유일한** 확정 신호였고, 이를 거부하자 user row 가 영영 커밋되지 않았다.

**수정**: 관계를 **비대칭**으로 되돌린다 — 막아야 할 것은 `model-output → steer` 한 방향뿐이다(0060 D2: 응답 진행은 mid-turn steer 의 소비 증거가 못 된다). `echo` 는 양쪽 origin 을 확정한다. `takeForRespawn` 의 `turn-open` 재스탬프는 여전히 필요하다 — 재스탬프해야 **첫 모델 출력이 확정 신호로 열린다**.

**왜 로컬에서 못 잡았나 (프로세스 교훈)**: 이 스위트는 electron 바이너리 부재로 **로드조차 되지 않아** r1 verify 가 "환경 베이스라인, 테스트 0건 실패" 로 분리 보고했다. 그러나 **내가 바로 그 파일의 큐 API 호출을 바꿨으므로** 베이스라인으로 넘길 게 아니라 실행 수단을 찾았어야 했다. 실제로 `ELECTRON_OVERRIDE_DIST_PATH=<any>` 로 `electron/index.js` 의 경로 해석을 우회하면 **전 스위트(148 파일 · 1216 테스트)가 로컬에서 돈다**. 베이스라인은 회피 가능했다.

### R2. OQ 결정 구현 (사용자 결정 = 검증자 권고안 (b)/(b))

| AC | 구현 | 파일 |
|---|---|---|
| 16 | `chat.residual{count}` 이벤트 + 컴포저 Notice(액션 버튼 동반). `reconcileInterrupt` 가 교집합 비면 통지 해제 | `shared/ipc.ts` · `app/chat-turn.ts` · `Composer.tsx` · `chatStore.ts` · i18n |
| 17 | 신규 IPC `orca:chat:discardSession` — abort → `supervisor.discardRuntime` → `discardSubmitted` → `message.cancelled` + `chat.residual{0}`. `RuntimePool.close(sessionId)` 신설. UI 문구가 백그라운드 종료를 명시 | `handlers` in `chat-turn.ts` · `supervisor.ts` · `runtime-pool.ts` · `preload` · `shared/api/ipc.ts` |
| 18 | 턴 체인 종료 시 `orphanUnconfirmed` → `discardOrphaned` → `message.cancelled`(기존 renderer 경로가 버블 제거 + draft 복원을 이미 수행) | `pending-message-queue.ts` · `app/chat-turn.ts` |
| 19 | 폐기분은 큐에서 제거돼 지각 확정·`takeForRespawn` 어느 쪽으로도 되살아나지 않음 | 테스트 6건 |

**설계 판단 기록**: OQ1 에서 (c)"무조건 폐기" 를 고르지 않은 이유는 R4·R5 그대로다 — `still_queued` 의 미지 uuid 는 백그라운드 auto-resume continuation 일 수 있어 자동 폐기는 0143 을 죽인다. (b)는 폐기 **행위 자체는 동일**하되 **사용자가 방아쇠를 당긴다** — 백그라운드 작업이 함께 죽는 비용을 UI 문구로 고지하고 동의를 받는다.

### r2 게이트

lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · vitest **148 파일 / 1216 테스트 전부 pass**(`ELECTRON_OVERRIDE_DIST_PATH` 로 종전 로드 실패 파일 포함 — **베이스라인 제외 0건**) · scripts 28/28. CI `gate`(windows-latest) **success** on `2d4480e`.

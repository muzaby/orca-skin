# Plan — 0152-steer-stranded-and-ordering

## 메타

| 항목 | 값 |
|---|---|
| slug | `0152-steer-stranded-and-ordering` |
| 작성자 | Claude Code |
| 일자 | 2026-07-28 |
| 매핑 | PHASES Phase 4 / PR #292 (0151 위에 이어짐) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Steer(queue) 메시지가 어시스턴트 턴 종료후 바로 flush 되지 않는다. 답변완료 상태로 빠짐." | 라이브 세션 버그 리포트 (실기, 2026-07-28) |
| 명시 요구 | "이 상태에서(Pending된 상태) 새 메시지 입력시 새 메시지가 먼저, pending 메시지가 후에 들어간다." | 동상 |
| 명시 요구 | 순서 보장 형태 = **병합(한 버블)** | 라이브 세션 선택 |
| 명시 요구 | 작업 위치 = **새 핸드오프 0152** (0151 에 흡수하지 않음) | 라이브 세션 선택 |
| 추론 의도 | 두 증상이 별개가 아니라 **하나의 원인 + 하나의 노출**이라는 해석 — 증상 1 이 stranded held 를 만들고 증상 2 가 그것을 뒤로 민다. *추론*이며 아래 자료조사로 뒷받침 | 코드 추적 |

## Context (왜)

0151 (PR #292) 로 steer 큐 상태 머신을 정리한 뒤 사용자 실기에서 버그 2건이 나왔다. 추적 결과 **둘 다 0151 회귀가 아니라 0067/0136/0143 부터 있던 기존 결함**이다 — 0151 이 만든 게 아니라, 사용자가 steer 경로를 집중적으로 쓰면서 드러났다.

- **증상 1(stranded held)**: 진행 턴이 끝나는 순간에 도착한 steer 예약이 `held` 에 고아로 남는다. 세션은 idle 인데 큐에는 항목이 있어, UI 는 "답변완료 + pending 버블" 이라는 모순된 상태로 멈춘다.
- **증상 2(순서 역전)**: 그 상태에서 새 메시지를 보내면 새 메시지가 턴 프롬프트가 되고 잔여는 뒤로 밀린다.

증상 1 이 없으면 증상 2 는 관측되지 않는다(잔여가 생길 일이 없다). 그러나 **둘은 독립 결함**이라 각각 고친다 — 증상 1 만 고치면 다른 경로(채널 사망 이월 등)로 생긴 잔여에서 순서 역전이 다시 난다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **R1.** busy 판정(`supervisor.hasSession`)과 실제 적재(`pendingMessages.enqueue`) 사이에 **`await normalizeAttachments(...)` 가 있다.** 판정 시점엔 턴이 살아 있었어도 적재 시점엔 끝나 있을 수 있다 | `app/src/main/app/chat-turn.ts` — 판정 `:366`(수정 전) → `reserveOnBusySession` 내부 `await` `:298` → `enqueue` `:310` |
| **R2.** 턴-후 루프는 `havePending = pending(sessionId).length > 0`(= **held** 만)으로 다음 스텝을 정하고, `break` 후 `finally` 에서 `supervisor.release` 까지 **await 없이** 진행한다. 즉 루프가 한 번 `break` 하면 그 뒤 도착한 held 를 볼 주체가 없다 | `chat-turn.ts:868-873` · `features/chat/post-turn.ts:21-30` · `finally` `:1000-1010` |
| **R3.** R1+R2 결합 = **TOCTOU**. `await` 동안 턴 종료 → 루프 `havePending:false` → `break`·`release` → 그 뒤 `enqueue` 착지 → **flush 주체 없음**. 단일 스레드라 `await` 가 유일한 인터리브 지점이므로, 판정↔적재 사이의 await 를 없애면 창이 닫힌다 | R1·R2 |
| **R4.** `listenRelease.get(sessionId)?.()`(적재 직후 호출)는 **listen 프레임을 닫는** 밸브일 뿐, 이미 종료된 턴-후 루프를 되살리지 못한다 — R3 의 방어책이 아니다 | `chat-turn.ts:332` · `:924` |
| **R5.** idle send 경로는 채널이 살아 있으면 프렐류드를 회수하지 않고(`preludes = channelAlive ? [] : takeForRespawn(...)`) **새 항목만** 턴 프롬프트로 예약한다 → 기존 held 는 뒤로 밀린다 | `chat-turn.ts:592-594` · `:620` |
| **R6.** R5 주석의 근거("held 분은 이번 턴 게이트 flush 로 이어진다")는 **busy 채널** 전제다. idle send 에는 진행 중인 턴이 없어 게이트가 없고, 잔여는 *다음* 턴까지 밀린다 | `chat-turn.ts:586-591` 주석 |
| **R7.** 살아있는 채널에는 프렐류드 주입 경로가 없다 — `pushTurn` 은 메시지 1건만 push 하고, 프렐류드는 `createSessionInputStream(initial)` 즉 **spawn 시점**에만 선적재된다. 따라서 "앞에 끼워넣기" 를 그대로는 못 한다 | `adapters/claude.ts` `pushTurn` · `createSessionInputStream` |
| **R8.** `reserveHeld` 는 held 를 **적재 순서**(= 시간 순, `enqueue` 가 push)대로 병합하고 `createdAt` 은 가장 오래된 항목 값을 쓴다. 병합 1버블은 게이트 flush 가 이미 쓰는 확정 규칙(0067 D4) | `features/chat/pending-message-queue.ts` `reserveHeld`·`toBatch` |

## 인수 기준 (Acceptance Criteria)

1. **판정↔적재가 원자적이다.** 첨부 정규화를 busy 판정 **앞**으로 올려 `hasSession()` → `enqueue()` 사이에 `await` 가 없다. `reserveOnBusySession` 은 **동기 함수**가 된다(정규화 결과를 인자로 받는다).
2. **잔여 held 는 새 턴 프롬프트에 병합된다.** idle send 시 held 가 2건 이상(잔여 + 신규)이면 `reserveHeld(queueKey,'turn-open')` 로 **적재 순서대로 병합**해 잔여가 앞, 신규가 뒤가 된다. 잔여가 없으면 종전대로 `reserveItem`(uuid=item id) 유지.
3. **중복 정규화 제거.** busy/idle 두 경로가 첨부를 각각 정규화하던 것을 한 번으로 합친다(동작 동일, 경로 단일화).
4. **회귀 0.** 기존 steer/커밋/프렐류드/respawn 동작이 그대로다 — 전 스위트 green.
5. **순서 회귀 테스트.** 잔여 + 신규 병합이 시간순(잔여 먼저)과 `createdAt`(가장 오래된 값)을 보존하는 단위 테스트.

## 범위 / 비범위

- **범위**: AC1~5. `chat-turn.ts` 의 send 핸들러 구조 조정 + 큐 테스트 1건.
- **비범위**:
  - 턴-후 루프의 `havePending` 판정 자체 재설계 — AC1 이 원인을 막으므로 불필요. (루프가 `submitted` 를 못 보는 것은 의도된 설계다.)
  - 0151 파생 이슈 D3(renderer reducer 테스트)·D4(orphan 전이 경로)·D5(AGENTS.md electron 우회) — 별건.
  - 병합 시 두 메시지를 transcript 에서 시각적으로 분리하는 것 — 사용자가 "병합(한 버블)" 을 선택했다.

## 의존 기술 / 전제

- 기존 모듈만 사용: `PendingMessageQueue.reserveHeld/reserveItem/pending` · `normalizeAttachments` · `supervisor.hasSession`.
- 전제: Node 단일 스레드 — `await` 없는 구간은 인터리브되지 않는다(AC1 의 근거).
- **신규 의존성: 없음. IPC 변경: 없음.**

## 설계

**AC1** — `handleChatSend` 에서 `normalizeAttachments` 를 busy 판정 위로 이동하고, 결과를 `reserveOnBusySession(event, sessionId, data, na)` 로 넘긴다. `reserveOnBusySession` 의 `async`/내부 `await`·중복 try/catch 를 제거해 동기화(AC3 도 동시 충족). idle 경로는 이미 같은 변수를 쓰던 자리라 그대로 재사용.

**AC2** — 턴 프롬프트 예약 지점에서 분기:

```ts
const mainBatch =
  pendingMessages.pending(queueKey).length > 1
    ? pendingMessages.reserveHeld(queueKey, 'turn-open')!   // 잔여 + 신규 병합(시간순)
    : pendingMessages.reserveItem(queueKey, queuedItem.id, 'turn-open')!
```

잔여가 없을 때 `reserveItem` 을 유지하는 이유: 배치 uuid = item id 라는 기존 정합(renderer pending id·continuity 테스트 픽스처)을 건드리지 않기 위해서다. 병합 경로는 새 uuid 를 쓰지만 `message.committed` 가 `ids` 배열을 싣기 때문에 renderer 버블 해소는 동일하게 동작한다.

## 파생 UX / 엣지케이스

- **병합 버블**: 잔여 + 신규가 transcript 에서 버블 1개, DB user row 1건이 된다(사용자 확정). 게이트 flush 와 같은 표현이라 새 UX 어휘가 늘지 않는다.
- **첨부**: 병합 시 `toBatch` 가 양쪽 첨부를 flatMap 으로 합친다 — 기존 게이트 병합과 동일.
- **잔여 3건 이상**: 전부 시간순 병합(2건 케이스의 일반화).
- **취소 창**: 병합 전까지 각 항목은 여전히 held 라 개별 취소 가능. 병합(예약) 순간 0151 의 `message.submitted` 로 취소 버튼이 내려간다.
- **새 세션(sessionId 미확정)**: `hasSession` 이 false 라 busy 경로를 타지 않는다 — 무영향.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 정규화를 앞으로 옮기면 **busy 예약이 아닌 경우에도** 첨부를 먼저 읽는다 | 원래 두 경로 모두 정규화했으므로 총 작업량은 동일하거나 줄어든다(중복 제거). 실패 시 에러 경로도 동일 |
| 병합이 사용자 의도(별개 메시지 2건)와 다르게 보일 수 있음 | 사용자가 명시 선택. 순서 보장이 버블 분리보다 우선이라는 판단 |
| AC1 이 "await 없음" 이라는 **암묵 불변식**에 의존 — 나중에 누가 await 를 다시 넣으면 조용히 재발 | 코드 주석에 이유를 못박았다. 기계 강제는 없음 → **파생 이슈로 남긴다** |

- 단독 결정 금지 항목: 없음(형태·범위 모두 사용자 확정).

## 영향 받는 파일

- `app/src/main/app/chat-turn.ts` (send 핸들러 구조)
- `app/src/main/features/chat/pending-message-queue.test.ts` (순서 회귀 테스트)

## 참고 문서

- 선행: 0067(AC5 큐 일원화·AC7 자동 연속) · 0136/0143(listen 턴) · 0151(상태 머신)
- `app/src/main/AGENTS.md` (컴포지션 루트 규칙)

## 게이트

- `npm run lint` · `npm run typecheck` · `ELECTRON_OVERRIDE_DIST_PATH=<any> vitest run` 전 스위트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 버그 리포트 원문 인용, 형태·범위 선택을 출처로 표기, 추론 1건을 추론으로 명시.
- [x] 자료조사 — R1~R8 전부 `파일:라인` 근거. TOCTOU 주장은 R1·R2 로 구성 증명.
- [x] 인수 기준 — 5개, 각각 검증 가능(AC1 은 구조적 — 함수 시그니처가 동기).
- [x] 의존 기술 — 신규 의존성·IPC 변경 0.
- [x] 파생 UX — 병합 버블·첨부·3건 이상·취소 창·새 세션을 펼쳤다.
- [x] 리스크 — 암묵 불변식 의존을 파생 이슈로 분리.

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: AC1 의 "await 를 없애 창을 닫는다" 는 방어 코드를 더하는 것보다 낫다. 루프 쪽에 재확인을 붙이는 대안도 있었지만, 그건 **증상 위치에 패치**하는 것이고 원인은 send 경로의 판정↔적재 간극이다.
- **이견 — AC1 의 보장 범위를 좁혀야 한다.** 설계는 "창이 닫힌다" 고 단정하지만, 정확히는 **`reserveOnBusySession` 경로의 창**이 닫힌다. 턴-후 루프가 `coordinator.run` 내부 await 중에 도착한 예약은 다음 반복이 보므로 원래 문제없고, `break` 이후 `release` 까지는 await 가 없어 새 창이 없다. 즉 **현재 코드 기준으로는 전부 닫히지만, 그 근거는 "루프 쪽에도 await 가 없다" 는 별개 사실에 의존**한다. 리스크 표의 "암묵 불변식" 항목이 이 의존까지 포함하도록 읽어야 한다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| P1 | AC2 의 `pending().length > 1` 판정은 **enqueue 직후** 읽어야 정확하다(신규 포함 개수). 순서를 잘못 두면 항상 1이라 병합이 죽는다 | ✅ 구현함 — `enqueue` → `message.queued` 발신 → 그 다음에 판정. | `chat-turn.ts` 예약 지점 |
| P2 | `reserveOnBusySession` 을 동기화하면 호출부의 `await` 가 불필요해진다(lint `no-misused-promises` 위험) | ✅ 구현함 — 호출부에서 `await` 제거. typecheck·lint 0 error | — |
| P3 | AC1 이 지키는 불변식("판정↔적재 사이 await 금지")에 **기계 강제가 없다** | ⚠️ 보고만 — 파생 이슈 D1. ESLint 로 잡기 어려운 종류라 주석 + verify 기록으로 남긴다 | 리스크 표 |

## [구현자 기입] 구현 체크리스트

- [x] AC1 정규화 hoist + `reserveOnBusySession` 동기화
- [x] AC2 잔여 병합 분기
- [x] AC3 중복 정규화 제거(AC1 과 동시 달성)
- [x] AC4 전 스위트 green
- [x] AC5 순서 회귀 테스트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/chat-turn.ts` · `app/src/main/features/chat/pending-message-queue.test.ts` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `ELECTRON_OVERRIDE_DIST_PATH=<any> vitest run` |
| 게이트 결과 | lint ✅ 0 error(warning 1 = 0102 베이스라인) · typecheck ✅ 3/3 · vitest ✅ **148 파일 / 1223 테스트 전부 pass** |
| 신규 의존성 / IPC | 0 / 변경 없음 |
| 블로커 | 없음. **증상 1 은 레이스라 단위 테스트로 고정 불가** — 구조(동기 함수 시그니처)가 증거이고, 최종 확인은 사람 실기 몫. |

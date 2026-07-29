# Plan — 0155-simplify-150-154-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0155-simplify-150-154-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-29 |
| 매핑 | PHASES Phase 4 행 (0150~0154 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 150~154에 대해 리팩토링을 진행하려한다" — 0150~0154 가 도입한 코드를 리팩토링한다 | 라이브 세션 요청 (2026-07-29) |
| 명시 요구 | "superpowers 스킬을 활용하여 진행하라" | 라이브 세션 요청 (2026-07-29) |
| 제약 (환경) | **`superpowers` 스킬/플러그인이 이 환경에 없다** — 활성 스킬 목록·`~/.claude/skills`·`~/.claude/plugins`·조직 플러그인 카탈로그(`SearchPlugins`) 어디에도 없음. 가장 가까운 대체로 저장소가 같은 목적에 이미 쓰는 **`/simplify` + 핸드오프 프로토콜**을 적용했다(선례 `0131`·`0149`) | 세션 도구 조회 결과 |
| 추론 의도 | "리팩토링" = 동작 보존 품질 정리. 관찰 가능 동작·렌더 DOM·클래스·a11y 속성·IPC 채널/스키마는 **불변**이어야 한다 (추론) | `/simplify` 스킬 정의 + `0131`·`0149` 선례 |
| 추론 의도 | 0149 처럼 "구조 일반화까지" 를 명시 승인받지는 않았으므로, **구조/계약을 바꾸는 일반화는 하지 않고** 중복·죽은 어포던스·거짓 주석·불필요한 할당에 한정한다 (추론 — 보수적 기본값) | `handoff/AGENTS.md` §2 선조치 경계 (의심되면 보수적) |

## Context (왜)

`b13235b..HEAD` 의 `app/src` 변경(**45 파일 · +1,713/−301**)이 미리뷰 구간이다. `b13235b` 는
직전 /simplify 핸드오프 **0149** 의 마지막 커밋(디버그 패널 밀도 라디오 제거)이라 그 이후 전체가
0150~0154 범위에 대응한다.

| 핸드오프 | 성격 | 코드 커밋 |
|---|---|---|
| `0150-plan-approval-back-and-permission-mode` | 계획 승인 UX + 권한 모드 전환 | `2e787fc`·`7dc71ce` |
| `0151-steer-queue-state-machine` | steer 큐 암묵 상태 머신 → 명시 데이터 | `0001012`·`e890784`·`43afda6` |
| `0152-steer-stranded-and-ordering` | 턴 경계 예약 고아 레이스 + 입력 순서 역전 | `2aec878` |
| `0153-live-persist-structure-parity` | 턴 경계 busy 판정 불일치 → 라이브/영속 순서 역전 | `7eb9b73` |
| `0154-steer-premature-orphan-cancel` | `discardOrphaned` 철회 — 미확정 예약은 폐기 아닌 대기 | `98e7238` |

**이 묶음의 성격.** 0151 이 `PendingMessageQueue` 를 상태 머신으로 재작성하고, 0152~0154 가
같은 모듈·같은 호출부(`chat-turn.ts` 턴-후 루프)를 **세 번 연속 수정**했다. 세 라운드가 각각
자기 사정으로 코드를 얹은 결과, ① 큐 내부에 같은 필터-분기-재설정 절차가 두 벌 남았고
② `chat-turn.ts` 턴-후 루프에 `step` 분기가 네 곳으로 흩어졌으며 ③ 0154 가 철회한 결정
(`discardOrphaned`)과 0151 이 쓴 수명 주석 일부가 **코드와 어긋난 채** 남았다.

**깨끗함이 확인된 것**(재발견 아님, 조사 결과):

- `0154` 는 `discardOrphaned` 를 **실제로 전량 제거**했다 — 메서드 본문·호출부·테스트 어디에도
  남아 있지 않고, 제거 사실을 설명하는 주석 블록만 큐에 남는다(의도적 묘비).
- `PLAN_APPROVED_MODE`(`shared/permission-mode.ts:24`)는 0150 이 **이미 수행한 dedup** 이다 —
  renderer 칩·SDK `updatedPermissions`·main SSOT 세 곳이 한 상수를 읽는다. 추가 정리 불요.
- `interrupt-reconcile.ts`·`sendAdmission.ts`·`postTurnHoldsSession` 은 올바른 레이어의
  순수·테스트 가능 모듈이고 각각 단위 테스트를 동반한다. 구조 변경 대상 아님.
- `GovernedLiveTurn`(`contracts/ports.ts:34`) 도입은 `Omit` 한 줄로 `interrupt` 반환 계약만
  좁힌 것이라 중복이 아니다. `RuntimeLiveTurn` 은 그 base 로 계속 필요하다.
- 렌더러 신규 UI(`chat.residual` Notice · `PendingSteerTurn` 전달됨 표기)는 기존
  `Notice`/`Button`/`UserBubbleText` 를 재사용했다 — 새 프리미티브 복제 없음.

## 자료조사 (Research)

> 4관점(재사용·단순화·효율·altitude) 전수 인라인 리뷰. **에이전트 병렬 팬아웃은 쓰지 않았다** —
> 세션 정책상 사용자가 요청하지 않은 서브에이전트 기동이 금지돼 있고, 0131 도 같은 이유로
> 직접 인라인 리뷰로 대체한 선례가 있다.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `drainConfirmed` 의 본문이 private `remove()` 와 **절차·분기·반환이 동일**하다 — `filter(match)` → 빈 배열 조기반환 → `filter(!match)` 잔여 → 비면 `delete` 아니면 `set` → `map(toPublic)`. `discardSubmitted` 만 `remove` 를 쓰고 `drainConfirmed` 는 같은 절차를 손으로 다시 쓴다 | `pending-message-queue.ts:288-297`(drainConfirmed) ↔ `:361-370`(remove) |
| `disposeAll()` 이 `[...heldBySession.keys(), ...trackedBySession.keys()]` 를 순회 — 두 맵에 **동시에 있는 세션은 `dispose` 가 두 번** 호출된다(멱등이라 무해하나 이미 비운 배열을 다시 스크럽) | `pending-message-queue.ts:352-356` |
| 턴-후 루프에서 `submittedUuids(sessionId).length > 0` 로 **존재 여부만** 묻는다 — `filter` + `map` 두 벌 배열을 만들어 길이만 보고 버린다. 루프는 턴 체인 1회전마다 돈다 | `chat-turn.ts:879` ↔ `pending-message-queue.ts:323-327` |
| `message.submitted` 이벤트 리터럴이 **두 곳에 복제**됐다 — 턴 핸들러의 `sendOwnership` 클로저와 `chatSteerCancel` 핸들러 인라인. 후자는 `event.sender`, 전자는 `wc` 라 클로저를 공유할 수 없어 그대로 복사됐다 | `chat-turn.ts:764-767` ↔ `chat-turn.ts:1066-1076` |
| 턴-후 루프의 `step` 분기가 **네 곳으로 흩어졌다** — `step==='listen' && haveUnconfirmed`(강등) → `postTurnHoldsSession(step)`(phase 신호) → `step==='break'` → `step==='listen'`(listen 턴). 첫 번째와 네 번째가 같은 조건인데 사이에 다른 두 분기가 낀다 | `chat-turn.ts:891`·`896`·`897`·`919` |
| `residualBySession` 주석이 **"새 턴 시작·폐기 실행 시 해제된다"** 고 적었으나, 실제 `delete` 는 ① 후속 중단 영수증이 `clear` 일 때 ② `chatDiscardSession` 실행 시 **두 곳뿐**이다 — 새 턴 시작 경로에 해제가 없다 | `chat-turn.ts:222-224`(주석) ↔ `:787`·`:1091`(전 delete 호출부) |
| `closeEntry` 주석이 자기 호출 경로를 **"prev 교체·closeAll·LRU eviction"** 3종으로 열거하는데, 0151 이 `close(sessionId)`(사용자 의도 폐기)를 4번째 경로로 추가했다 | `runtime-pool.ts:74-75`(주석) ↔ `:41-43`(신규 경로) |
| `chatStore.send` 가 `getState()` 를 **두 번** 호출한다(`sendKey` 결정용 · `pendingCount` 조회용). 두 읽기 사이에 store 가 바뀌면 서로 다른 스냅샷을 보게 된다 | `chatStore.ts:659`·`:671` |
| `useChatResidualSteer` 가 **`useChatBusy` 의 6줄 doc 주석과 그 함수 사이에 삽입**됐다 — 0143/0149 가 쓴 busy 정의 근거(“소비처마다 손으로 유도하다 판정이 갈렸다”)가 이제 residual 훅을 설명하는 것처럼 보인다 | `chatStore.ts:1276-1290` |
| 게이트 제약: `lint`·`typecheck` 는 ABI 중립, `npm test` 는 better-sqlite3 를 Node ABI 로 뒤집는다. egress 차단 환경에선 DB 로드 스위트만 실패하며 이는 **알려진 베이스라인** | `app/AGENTS.md` "better-sqlite3 ABI · 제약 환경 게이트 가이드" |

## 인수 기준 (Acceptance Criteria)

> 전부 **동작 보존** 전제 — 관찰 가능 동작·렌더 DOM·클래스·a11y 속성·IPC 채널/스키마·DB 스키마 무변경.

1. **AC1** — `PendingMessageQueue.drainConfirmed` 가 private `remove()` 에 위임한다. 반환 배열의
   내용·순서, 큐 잔여 상태, 세션 키 삭제 조건이 종전과 동일하다.
2. **AC2** — `disposeAll()` 이 세션 키를 중복 없이(`Set`) 순회해 `dispose` 를 세션당 1회만 호출한다.
3. **AC3** — 턴-후 루프의 미확정 예약 존재 판정이 배열을 만들지 않는다 (`PendingMessageQueue`
   에 boolean 술어 추가, `submittedUuids` 는 영수증 화해용으로 존치).
4. **AC4** — `message.submitted` 발신이 **단일 함수**를 지난다. 두 호출부(턴 핸들러 · steerCancel
   핸들러)가 같은 함수를 쓰고, 각자의 `WebContents` 를 인자로 넘긴다. 빈 `ids` 무발신 규칙 유지.
5. **AC5** — 턴-후 루프의 `step === 'listen'` 분기가 **한 곳으로 합쳐진다**. 미확정 예약 강등이
   listen 턴 개시와 같은 블록에 놓이고, `break`/`holds` 분기와의 실행 순서가 관찰적으로 동일하다.
6. **AC6** — `residualBySession`·`closeEntry` 주석이 **실제 호출 경로와 일치**한다 (거짓 주석 0).
7. **AC7** — `chatStore.send` 가 store 스냅샷을 **1회** 읽고 `sendKey`·`pendingCount` 를 그 하나에서 파생한다.
8. **AC8** — `useChatResidualSteer` 가 `useChatBusy` 의 doc 주석 블록 **밖**으로 이동해, 주석이
   자기가 설명하는 함수에 다시 붙는다.
9. **AC9** — 게이트: `npm run lint` 0 error(기존 warning 1 = 0102 베이스라인 허용)·`npm run typecheck`
   3분할 0 error·영향 스위트 vitest green. 레이어 경계 위반 0, 신규 의존성 0.
10. **AC10** — `git diff` 상 IPC 채널 수(73)·`NormalizedEvent` variant 집합·zod 스키마·i18n 키가 **불변**이다.

## 범위 / 비범위

- **범위**: 위 AC1~AC8 의 동작 보존 정리 + 게이트.
- **비범위**:
  - `ApprovalCard` 의 `collapsedAtCount` 워터마크 표현(`null` = 명시적 펼침). 대안(`-1` 센티넬)은
    매직넘버와 union 타입의 맞교환이라 순이득이 없다 — **의도적 스킵**.
  - `toBatch`/`toPublic`/`scrubBatch` 의 첨부 3~4 필드 반복. 공통화하면 간접층이 늘고
    optional 스프레드 규칙이 흐려진다 — **의도적 스킵**.
  - `RuntimePool.close()` 가 `closeEntry` 얇은 위임인 점. private helper 의 **공개 출입구**라
    정당하다(다른 공개 메서드도 같은 패턴) — **의도적 스킵**.
  - `postTurnHoldsSession(step) === (step !== 'break')` 를 인라인하는 것. 이름이 곧 문서이고
    post-turn 이 판정을 소유한다는 0153 결정을 표현한다 — **의도적 스킵**.
  - `chat.residual` 이 새 턴 시작 시 renderer 에서 자동으로 내려가지 않는 점 = **제품 동작**
    (사용자가 discard 하거나 다음 중단 영수증이 clear 여야 사라진다). 바꾸려면 설계 결정이
    필요하므로 본 정리 범위 밖 — **리스크 표에 기록만**.
  - 신규 기능·성능 최적화·테스트 외 동작 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `PendingMessageQueue`(features/chat) · `sendChatEvent`(infra/ipc/send) ·
  `decidePostTurnStep`/`postTurnHoldsSession`(features/chat/post-turn) · zustand `getState`.
- 전제: 0150~0154 는 전부 `verify/PASS` 로 종료돼 **인수 기준이 이미 고정**돼 있다 — 본 정리는
  그 기준을 재해석하지 않고 표현만 바꾼다.
- **신규 의존성: 없음.**

## 설계

- **AC1 (큐 dedup)**: `drainConfirmed` → `return this.remove(sessionId, (b) => b.state === 'confirmed')`.
  `remove` 는 이미 "조건 일치분을 빼서 공개 형태로 반환" 계약이라 의미가 정확히 겹친다.
- **AC2**: `for (const sessionId of new Set([...held.keys(), ...tracked.keys()]))`.
- **AC3**: `hasSubmitted(sessionId): boolean` 추가 — `.some((b) => b.state === 'submitted')`.
  호출부는 `chat-turn.ts:879` 하나. `submittedUuids` 는 `reconcileInterrupt`(교집합 계산)와
  `discardSubmitted` 흐름에 계속 필요하므로 **삭제하지 않는다**.
- **AC4**: `chat-turn.ts` 모듈 스코프에 `sendSubmitted(wc, sessionId, ids, submitted)` 를 두고
  (기존 모듈 헬퍼 `freshTurnLocalState`·`resolveTurnCwd` 와 같은 자리), 턴 핸들러의
  `sendOwnership` 은 `wc` 를 묶는 얇은 클로저로 남긴다(호출부 3곳이 `wc` 를 반복 전달하지 않게).
- **AC5**: 강등 호출을 `if (step === 'listen') { … }` 블록 선두로 이동. `beginListenPhase` 는
  IPC 발신 + 로컬 플래그라 큐 상태와 무관하므로, 강등이 그 뒤로 밀려도 관찰 결과가 같다.
- **AC6**: 주석만 실제 경로로 정정 (`residualBySession` = 영수증 clear · discard 실행 /
  `closeEntry` = prev 교체 · closeAll · LRU eviction · **사용자 의도 폐기**).
- **AC7**: `const st = getState()` 1회 → `sendKey`·`pendingCount` 파생.
- **AC8**: `useChatResidualSteer` 정의를 `sessionBusy` 아래로 이동(자체 주석 동반).
- **레이어 경계**: 새 파일 0, import 방향 변경 0. `chat-turn.ts`(app 컴포지션 루트)는 이미
  `features/chat` 를 의존하고, 렌더러 변경은 `features/chat` 내부 이동뿐이다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **동시성/멀티세션**: AC2 의 `Set` 순회는 종료 경로(`disposeAll`) 전용 — 세션 간 순서 의존 없음.
  AC5 의 블록 병합은 단일 세션의 턴 체인 안이라 세션 간 영향 없음.
- **엣지케이스 (AC1)**: `remove` 는 `hit.length === 0` 에서 조기반환하며 맵을 건드리지 않는다 —
  `drainConfirmed` 의 "확정분 0건이면 무변경" 계약과 동일. 확정분이 전부일 때 세션 키 삭제도 동일.
- **엣지케이스 (AC4)**: `chatSteerCancel` 은 `ids` 가 항상 1건이라 빈 배열 가드에 걸리지 않는다 —
  가드를 공유해도 종전 동작(항상 발신)이 유지된다.
- **엣지케이스 (AC7)**: `sendKey` 와 `pendingCount` 가 **같은 스냅샷**에서 나오므로, 두 읽기
  사이에 활성 세션이 바뀌던 이론적 창이 닫힌다(동작 개선 방향이며 회귀 아님).
- 로딩/빈상태/테마/a11y: 렌더 트리·클래스·ARIA 를 건드리지 않으므로 **N/A**.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| AC5 의 블록 이동이 `beginListenPhase` ↔ 강등 순서를 바꾼다 | 두 연산은 상호 무관(전자=IPC 발신+로컬 플래그, 후자=큐 상태 전이). `chat.listen` 이벤트에 큐 상태가 실리지 않음을 발신부에서 확인. 기존 post-turn/queue 테스트가 회귀를 잡는다 |
| AC3 이 큐 공개 표면을 1개 늘린다 | `submittedUuids().length > 0` 이라는 우회 관용구가 사라지고 호출부 의도가 드러난다. 순증 3줄, 기존 메서드 삭제 없음 |
| AC1 의 위임으로 `drainConfirmed` 의 인라인 주석 맥락이 얇아진다 | 주석은 유지하고 본문만 위임 — "확정 배치를 배치 단위로 drain" 근거(0067 버블 구조)를 그대로 남긴다 |
| `npm test` 전체 실행이 better-sqlite3 ABI 를 Node 로 뒤집는다 | ABI 중립 게이트(lint+typecheck)를 1차로, 영향 스위트는 `./node_modules/.bin/vitest run` 으로 직접 호출해 `pretest` 를 우회 |
| **관측만·미조치**: `chat.residual` 이 새 턴 시작으로 자동 해제되지 않아, 사용자가 discard 를 고르지 않고 대화를 계속하면 Notice 가 남는다 | 해제 시점 결정은 **제품 의도**(0151 r2 OQ1 계열)라 단독 변경 금지. 본 핸드오프는 주석을 사실에 맞추는 데 그치고, 필요 시 후속 핸드오프로 사용자 결정 |

- 되돌리기 어려운 결정: 없음 (전부 동작 보존 국소 편집, 되돌리기 = 역패치).
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 위 표 마지막 행(`chat.residual` 해제 시점).

## 영향 받는 파일

- `app/src/main/features/chat/pending-message-queue.ts` (AC1·AC2·AC3)
- `app/src/main/app/chat-turn.ts` (AC3 호출부·AC4·AC5·AC6)
- `app/src/main/features/sessions/runtime-pool.ts` (AC6 주석)
- `app/src/renderer/src/features/chat/store/chatStore.ts` (AC7·AC8)

## 참고 문서

- `docs/handoff/0151-steer-queue-state-machine/{plan,verify}.md` — 큐 상태 머신 인수 기준(AC1~AC12)
- `docs/handoff/0152-steer-stranded-and-ordering/plan.md` · `0153-live-persist-structure-parity/plan.md`
  · `0154-steer-premature-orphan-cancel/plan.md` — 후속 3라운드가 고정한 동작
- `app/src/main/AGENTS.md` — main 레이어 DAG (app → features → contracts → adapters → infra → shared)
- `docs/IPC_CONTRACT.md` — 채널 카탈로그 (**본 작업은 IPC 무변경 → 갱신 불요**)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` (ABI 중립) + 영향 스위트 vitest.
- 신규 테스트 요구: **없음** — 동작 보존 정리이므로 기존 스위트(`pending-message-queue.test.ts`
  46 케이스 · `post-turn.test.ts` · `chatStore*.test.ts` · `turn-coordinator.test.ts`)가
  회귀 감지 책임을 진다. 새 술어(AC3)는 기존 케이스의 시나리오로 이미 커버된다.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, `superpowers` 부재라는 환경 제약과
      그에 따른 대체 선택을 별도 행으로 분리했다. 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스를 붙였다.
- [x] 인수 기준 — 10개 번호, 전부 diff/grep/게이트로 검증 가능하다.
- [x] 의존 기술 — 기존 모듈만 사용, 신규 의존성 0 을 명시했다.
- [x] 파생 UX — 동시성·엣지케이스를 펼쳤고 해당 없는 항목(테마/a11y)은 N/A 로 적었다.
- [x] 리스크 — 트레이드오프 5건, Open Question 1건을 사용자 결정으로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 건은 **비기능(리팩토링) = Claude 직접 구현**.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: AC1·AC2·AC6·AC8 은 논쟁 여지 없는 정리다. AC4 도 "두 벌 복제 → 단일
  함수" 라 구조 위험이 없다.
- **이견 / 우려 (해소됨)**: 설계 §AC5 의 "관찰적으로 동일" 주장은 근거가 `beginListenPhase` 구현
  하나에 걸려 있다. 구현 시 발신부(`chat-turn.ts:855-862`)를 직접 읽어 **payload 가
  `{type:'chat.listen', sessionId, phase}` 3필드뿐이고 큐를 읽지 않음**을 확인했다 — 강등이
  뒤로 밀려도 이벤트 내용이 달라지지 않는다. 우려 해소.
- **이견 (범위 유지 확인)**: 비범위의 `chat.residual` 자동 해제는 실제로 사용자 눈에 띄는
  잔존이지만, 해제 시점(새 턴? 다음 send? 명시적 닫기?)이 제품 결정이라 **보고만** 이 맞다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 설계가 `drainConfirmed` 위임(AC1)의 **술어 2회 평가**를 다루지 않았다 — `remove` 는 `match` 를 `filter(match)`·`filter(!match)` 두 번 돈다. 종전 `drainConfirmed` 도 `state === 'confirmed'` 를 두 번 돌았으므로 비용 동일 | ✅ 그대로 위임(추가 조치 불요) | `pending-message-queue.ts:288-297` 구 본문이 이미 2-pass |
| 2 | AC3 의 `hasSubmitted` 를 `post-turn.ts` 쪽 순수 함수로 올릴 수도 있었으나, 그러면 큐 내부 상태(`TrackedBatch.state`)가 feature 밖으로 새어나간다 | ✅ 큐 메서드로 유지 (캡슐화 보존) | `main/AGENTS.md` feature 수직 슬라이스 규칙 |
| 3 | AC4 로 `sendOwnership` 을 얇은 클로저로 남기면 "함수를 부르는 함수" 한 겹이 생긴다. 없애고 3곳이 `wc` 를 직접 넘기게 할 수도 있다 | ✅ 클로저 유지 — 3 호출부가 전부 같은 `wc` 를 쓰고 이름(`sendOwnership`)이 도메인 의미를 담는다 | `chat-turn.ts:829`·`836`·`985` 세 호출부 모두 턴 핸들러 스코프 |
| 4 | ⚠️ `chat.residual` 잔존(비범위 표) — 사용자가 discard 하지 않고 대화를 이어가면 Notice 가 계속 보인다 | ⚠️ **보고만 · 결정 필요** — 해제 시점은 제품 의도 | `chat-turn.ts:787`·`1091` 이 전 delete 경로 |

## [구현자 기입] 구현 체크리스트

- [x] AC1 — `drainConfirmed` → `remove` 위임
- [x] AC2 — `disposeAll` `Set` 순회
- [x] AC3 — `hasSubmitted` 추가 + `chat-turn.ts:879` 치환
- [x] AC4 — 모듈 스코프 `sendSubmitted` + 두 호출부 수렴
- [x] AC5 — 턴-후 루프 `step === 'listen'` 분기 통합
- [x] AC6 — `residualBySession`·`closeEntry` 주석 정정
- [x] AC7 — `chatStore.send` store 스냅샷 1회
- [x] AC8 — `useChatResidualSteer` 이동
- [x] 게이트 lint / typecheck / 영향 스위트 vitest

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/features/chat/pending-message-queue.ts` · `app/src/main/app/chat-turn.ts` · `app/src/main/features/sessions/runtime-pool.ts` · `app/src/renderer/src/features/chat/store/chatStore.ts` (4 파일) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` (영향 스위트) |
| 게이트 결과 | [검증 턴 기입] |
| 블로커 / 역질문 | 없음 (Open Question 1건은 리스크 표 · 놓친 문제 #4 로 보고) |
| 대상 커밋 | [검증 턴 기입] |

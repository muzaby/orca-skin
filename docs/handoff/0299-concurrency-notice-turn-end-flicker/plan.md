# Plan — 0299-concurrency-notice-turn-end-flicker

## 메타

| 항목 | 값 |
|---|---|
| slug | `0299-concurrency-notice-turn-end-flicker` |
| 작성자 | Claude Code |
| 일자 | 2026-11-07 |
| 매핑 | 버그수정(비기능) — 구현 주체 Claude |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 자기 턴만 실행 중인 프로젝트에서 턴이 끝날 때마다 컴포저 위 "같은 프로젝트에서 다른 작업이 실행 중입니다" 패널이 나타났다 곧바로 사라진다.
- 원인(조사 결과, §8·§9 AS-IS): 판정식 `projectCount − (inflight ? 1 : 0) > 0`의 두 항이 서로 다른 IPC로 도착하고, 턴 종료 때 `inflight=false`가 `count=0`보다 먼저 도착한다. 그 사이 자기 턴 1건이 "다른 작업"으로 계산된다.
- 완료 후 달라지는 것: 자기 턴의 종료·오류·중단(Stop)·즉시 보내기는 어느 순간에도 이 패널을 만들지 않는다. 다른 턴이 실제로 돌 때의 패널 동작은 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 혼자 작업할 때 이 경고는 한 번도 깜빡이지 않고, 같은 프로젝트에서 다른 작업이 돌 때만 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "오픈코드 컴포저로 세션 시작 시, 어시스턴트의 답변이 끝날때(턴종료), 컴포저 상단에 같은 경로에서 1개 이상의 세션이 동작하는 경우에 대한 경고 패널이 떴다가 바로 사라진다. 플리커처럼 깜빡이며 바로 사라지는데 판정상 1개의 세션만 확인돼서 그런것으로 보인다. 왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 라이브 세션 2026-11-07 (`/handoff-plan`) |
| 추론 의도 | 원인 확인 후 깜빡임을 없앤다 — `/handoff-plan`으로 요청해 설계·구현 대상으로 본다 | 호출 스킬 |
| 추론 의도 | Stop·즉시 보내기도 같은 원인으로 같은 깜빡임을 낸다(§8 R-07·R-08) — 같은 계약("자기 턴 제외") 위반이라 함께 닫는다 | D-003 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 턴 종료 때 동시 실행 경고가 깜빡이는 원인을 확인하고 없앤다 | 원문: "왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 사용자 턴 | ACTIVE | — |
| D-002 | 경고 의미 유지 — 같은 프로젝트에서 **자기 턴을 뺀** 다른 턴이 돌 때만 보이고, 차단하지 않으며, ×는 에피소드 단위다 | 기존 채택 동작 | `Composer.tsx:167-169` 주석 · `ko.ts:1099-1100` · `IPC_CONTRACT.md §2.12-b` | ACTIVE | — |
| D-003 | 범위는 같은 원인의 자기 턴 종료 경로 전부다 — 정상 종료·스트림 오류/중단·Stop·즉시 보내기 | 같은 판정식이 같은 방식으로 틀린다(§8 R-07·R-08). 한 경로만 고치면 D-002 위반이 남는다 | 설계(추론) — 사용자가 좁히면 SUPERSEDED | ACTIVE | — |
| D-004 | 하네스 무관하게 고친다. OpenCode 전용 분기를 두지 않는다 | 경합이 공통 `TurnCoordinator`·`Composer`에 있다(§8 R-05) | 설계 | ACTIVE | — |
| D-005 | 지연·디바운스로 가리지 않고 순서를 보장해 고친다 | 시간 휴리스틱은 진짜 경고를 늦추고 경합을 남긴다 | 설계 | ACTIVE | — |
| D-006 | listen 턴은 동시 턴으로 세지 않는다 | 0143 결정 유지 | `turn-coordinator.ts:320-323` 주석 · `turn-policy.ts` | ACTIVE | — |
| D-007 | IPC `orca:concurrency:event` payload `{ projectId; count }`는 그대로 둔다. 설명 문장만 새 순서 계약으로 고친다 | 세션 식별자를 싣는 대안은 새 세션(id 미발급) 매핑이 필요해 범위가 커진다(§17) | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-007 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-002(기존 경고 의미), D-006(0143).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC6(다른 턴 진행 시 표시 유지) · D-003 ↔ AC1~AC5 · D-004 ↔ AC14(두 하네스 실기) · D-005 ↔ §9 TO-BE(타이머 없음) · D-006 ↔ AC11(listen 비계상 회귀) · D-007 ↔ AC13(payload 불변, 문장 갱신).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 사용자 가설("1개 세션만 확인")이 맞다 | 실측 순서에서 count=1은 자기 턴이고, 그 순간 `inflight`가 이미 false라 차감이 빠진다(§8 R-04) |
| 이미 기존 코드가 충족하는가 | 아니오 | 자기 차감은 renderer 낙관 플래그 `inflight`에 의존한다(`Composer.tsx:171`) |
| 더 작은 해법이 있는가 | main 쪽 순서 교정 1곳만으로 정상 종료는 닫힌다. Stop은 renderer 낙관 갱신(`CANCEL_CHAT`)이 main보다 앞서 별도 신호가 필요하다 | §8 R-07·R-08 |
| 선행 자료의 주장을 코드와 대조했는가 | `IPC_CONTRACT.md:473` "Composer는 자기 inflight를 차감해" — 이 서술이 경합을 만든 설계다 | §8 R-10 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 — D-002·D-006 유지 | §16 |

- 사용자에게 올릴 결정: 없음. D-003(Stop·즉시 보내기 포함)은 추론이며 사용자가 정상 종료만으로 좁힐 수 있다.
- 코드 조사로 닫은 사실: 원인·발생 조건·하네스 무관성·첫 턴 한정 아님(§8).

## 5. 동작 / 사용자 흐름

```text
[사용자 전송] → BEGIN_TURN(자기 턴 열림)
  → main 턴 시작 → 프로젝트 count +1  (자기 턴이라 차감 → 경고 없음)
  → 응답 스트림 …
  → 턴 종료(정상/오류/중단) 또는 Stop/즉시 보내기
      → main이 자기 턴 계상을 먼저 해제(count −1) → 그 뒤 terminal 전달
      → renderer가 terminal 수신 → 자기 턴 닫힘
  → 모든 중간 순간 경고 없음
  ↘ 같은 프로젝트에 다른 턴이 돌고 있으면 그 턴이 끝날 때까지 경고 표시
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 자기 턴만, 정상 종료(`telemetry`) | count 0 전달 → telemetry 전달 | 경고 없음(현재: 1~2 IPC 동안 표시 = 깜빡임) |
| 자기 턴만, 스트림 `error`·`turn.aborted` | 같음 | 경고 없음 |
| 자기 턴만, Stop 클릭 | renderer 즉시 응답 중 표시 해제, 자기 턴은 main terminal 전까지 차감 유지 → main 해제 → `turn.aborted` | 경고 없음(현재: 클릭~해제 사이 표시) |
| 자기 턴만, 즉시 보내기 | 중단 → 연속 턴 시작·종료 | 경고 없음 |
| 다른 턴 진행 중 + 자기 턴 진행/종료/Stop | count는 다른 턴 1 이상 유지 | 경고 계속 표시 |
| 다른 턴 종료 | count 0 | 경고 사라짐 |

### 파생 UX / 엣지케이스

- loading / empty / error: 해당 없음 — 표시 문구·스타일 불변.
- cancel / retry / close / restart: Stop은 상태표 행. 재시도(attempt) 사이 count 0/1 왕복은 자기 턴이 열려 있어 경고 없음. 재시작 hydrate는 활동 스냅샷으로 자기 턴 열림을 세운다.
- concurrency / multi-session: 다른 세션·다른 창의 턴은 계속 "다른 작업"이다.
- keyboard / a11y / theme: 해당 없음.
- 외부환경: 해당 없음.

## 6. 범위 / 비범위

- **범위**: main 계상 해제 시점(턴 단위 멱등 해제, terminal 전달 전) · renderer 자기 차감 신호(`ownTurnOpen`) · Composer 판정의 순수 함수화 · IPC 계약 설명 문장 · 테스트.
- **비범위**: 경고 문구·디자인 · × 에피소드 로직(`Composer.tsx:172-178`, 코드 미변경) · payload 형식(D-007) · 프로젝트 재바인딩 불일치(§10 경계 B-3) · steer 거절 `error`를 renderer가 terminal로 읽는 기존 동작(§10 경계 B-4).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 세션 식별자 기반 자기 제외(payload 변경) | 아니오 — 이번 순서 계약으로 충분 | 후속 불필요 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 자기 턴만 있을 때 정상 종료(P1)의 owner 수신 순서 모든 접두에서 경고 판정 false | ST-01: 순서 fixture P1 재생 → 판정열 전부 false · IT-01: main 기록 순서 = fixture | `TurnCoordinator.run` → tracker → `broadcastConcurrency` / relay → `sendChatEvent` → `chatStore` → `Composer` |
| R-01 | AT-01 / AC2 | 스트림 terminal이 `error`(P2)·`turn.aborted`(P3)여도 AC1과 같다 | ST-01 P2·P3 · IT-01 P2·P3 | 같음 |
| R-02 | AT-02 / AC3 | Stop(P4): 클릭 직후 낙관 갱신 포함 모든 접두에서 false | ST-01 P4(`CANCEL_CHAT`을 main 반응 전에 둠) · IT-01 P4 | `chatCancel` → `interruptResponse` → tracker → `sendChatEvent(turn.aborted)` |
| R-02 | AT-02 / AC4 | 즉시 보내기(P5): 중단 → 연속 턴 → 종료 전 구간 false | ST-01 P5 · IT-01 P5 | `chatSteerSendNow` → `interruptResponse` → post-turn flush |
| R-01 | AT-01 / AC5 | 이미 순서가 맞던 경로 회귀 — 합성 telemetry(P6)·예외 error(P7)·시작 전 중단(P8) false | ST-01·IT-01 P6~P8 | `turn-coordinator.ts:553-616` |
| R-03 | AT-03 / AC6 | 다른 턴 진행 중: 자기 턴 진행·종료·Stop 동안 true 유지, 다른 턴 종료 후 false(O1·O2), 자기 idle이면 다른 턴 동안 true(O3) | ST-01 O1~O3 · IT-01 O1 | 같음 |
| — | UT-01 / AC8 | tracker `begin/end`가 토큰 단위 멱등이다(§10 규칙 칸) | UT-01 | `active-turn-tracker.ts` |
| — | UT-02 / AC9 | 판정 함수·자기 계상 selector 규칙(§10 규칙 칸) | UT-02 | `concurrencyNotice.ts` |
| — | UT-03 / AC10 | reducer `ownTurnOpen` 전이 규칙(§10 규칙 칸) — `CANCEL_CHAT`은 내리지 않는다 | UT-03 | `chatReducer.ts` |
| — | IT-01 / AC11 | main 해제 3자리가 각 terminal 송신 전에 count 0을 낸다. listen 턴은 계상하지 않는다 | IT-01 · 기존 `turn-coordinator.test.ts:'listen 턴은 activeTurns 회계에 계상하지 않는다'` 갱신 | E1~E3 |
| — | IT-02 / AC12 | Composer가 `useChatSession(ownTurnCounted)`와 `concurrencyNoticeActive`로 판정한다(`useChatResponding`으로 판정하지 않음) | IT-02 | `Composer.tsx` |
| — | — / AC13 | `IPC_CONTRACT.md §2.12-b`·`runtime-ipc.md` ActiveTurnTracker 행이 새 순서 계약을 서술하고 payload 표기는 불변이다 | `node scripts/check-doc-inventory.mjs --check` + 문장 대조 | 문서 |
| R-01·02·03 | AT-01~03 / AC14 | 실제 앱에서 OpenCode·Claude 각각: 새 세션 첫 턴 종료 5회·기존 세션 턴 종료 3회·Stop 3회에 패널 미출현, 두 세션 동시 실행 시 패널 출현→다른 턴 종료 후 소멸 | 사람 실기 — 페인트·IPC FIFO는 vitest 밖(§10 B-1·B-2) | 실제 Electron |

### AC 검증 주의사항

- 기존 테스트 재사용: `turn-coordinator.test.ts:1337` listen 비계상 케이스 실재 확인 — `increment/decrement` 단언을 새 API로 바꾼다.
- 사람 실기 항목: 깜빡임 자체는 페인트 타이밍이고 main↔renderer IPC 순서는 Electron 실행이 필요하다. 판정 로직·순서 모델은 ST-01/IT-01이 덮는다.
- 순서 기준 관측 지점: owner 하나로 가는 renderer-bound 이벤트와 concurrency 브로드캐스트를 **한 로그**에 기록한다(IT-01).
- 총량 기준: 해당 없음.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 이 영역의 기존 handoff V 없음(`rg -l "concurrencyNotice|useProjectConcurrencyCount" docs/handoff/*/plan.md` → 0).
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5 상태표 1·2행 — 자기 턴 종료 경로 경고 없음 | NEW | — |
| R-02 | R | §5 상태표 3·4행 — Stop·즉시 보내기 경고 없음 | NEW | — |
| R-03 | R | §5 상태표 5·6행 — 다른 턴 경고 유지 | NEW | — |
| AT-01~03 | AT | §7 AC14 + ST-01 | NEW | — |
| SD-01 | SD | §9 TO-BE 순서 계약 — main 해제 ≺ terminal 전달, renderer 차감은 main terminal까지 | NEW | — |
| ST-01 | ST | 순서 fixture 재생 | NEW | — |
| AR-01 | AR | §10 main — 토큰 단위 해제 3자리 + begin 1자리 | NEW | — |
| IT-01 | IT | main 순서 기록 | NEW | — |
| AR-02 | AR | §10 renderer — `ownTurnOpen` 생산 → selector → Composer | NEW | — |
| IT-02 | IT | Composer 렌더 | NEW | — |
| MD-01 | MD | §10 tracker 규칙 | NEW | — |
| MD-02 | MD | §10 판정 함수·selector 규칙 | NEW | — |
| MD-03 | MD | §10 reducer 전이 규칙 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 스트림 terminal → coordinator → tracker/relay → IPC → chatStore → Composer → `Notice` | AC14 실기 + ST-01 P1~P3·P5~P8 | not selected — ST-01이 판정을 직접 관측 | 0 — 운반 자리는 VP-04~09가 고정. AT는 페인트·IPC FIFO 확인 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | Stop/즉시 보내기 클릭 → `CANCEL_CHAT`/IPC → `interruptResponse` → … → `Notice` | AC14 실기 + ST-01 P4·P5 | not selected | 0 — 같음 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 다른 턴 begin → count ≥1 → Composer | AC14 실기 + ST-01 O1~O3 | not selected | 0 — 같음 |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | fixture 단계열(renderer 지역 동작 + wire) → 실제 `chatReducer` → `ownTurnCounted` → `concurrencyNoticeActive` | 신규 `app/src/renderer/src/features/chat/lib/concurrencyNotice.order.test.ts` — 경로별 판정열 = fixture `expectNotice` · fixture 연결은 IT-01의 동등 단언 | **required** — 순서 모델이 맞는지(민감도): AS-IS 순서(P1에서 terminal ≺ count 0)와 P4에서 `CANCEL_CHAT`이 `ownTurnOpen`을 내리는 reducer 변이를 넣으면 판정열에 true가 나와야 한다 | SD-1~SD-2 (2) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | `TurnCoordinator.run` begin → 스트림 terminal → `activeTurns.end` → onChange → `this.emit` → relay · `chatCancel`/`chatSteerSendNow` → `interruptResponse` → `end` → `sendChatEvent` | 신규 `app/src/main/app/chat-turn/concurrency-order.test.ts` — P1~P8·O1 기록 순서 = fixture wire · `turn-coordinator.test.ts` 갱신 케이스 | **required** — 불변식이 순서라 "end를 emit 뒤로 옮김" 변이를 E1·E3에 각각 심어 red | E0~E3 (4) |
| VP-06 | AR-02 ↔ IT-02 | REQUIRED | `concurrencyApi.onEvent` → `concurrencyByProjectId` → `useProjectConcurrencyCount` + reducer `ownTurnOpen`·`activityTransport` → `useChatSession(ownTurnCounted)` → `concurrencyNoticeActive` → `<Notice>` | 신규 `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts` | **required** — Composer가 `useChatResponding`으로 되돌아가도 green이면 안 된다: 구별 입력(§10 IT-02 칸)으로 맞바꿈 변이 red | C1~C2 (2) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | `ActiveTurnTracker.begin/end/getCount` | `app/src/main/features/sessions/active-turn-tracker.test.ts` 개정 + `supervisor.test.ts:197-198` 갱신 | not selected — 규칙 칸 분기별 입력이 직접 oracle | T1~T3 (3) |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | `concurrencyNoticeActive` · `ownTurnCounted` | 신규 `app/src/renderer/src/features/chat/lib/concurrencyNotice.test.ts` | not selected | N1~N2 (2) |
| VP-09 | MD-03 ↔ UT-03 | REQUIRED | `chatReducer` `ownTurnOpen` 전이 자리 | 신규 `app/src/renderer/src/features/chat/reducer/chatReducer.ownTurnOpen.test.ts` | not selected | M1~M12 (12) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint + typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 유발한 error |
| 관련 vitest | main·renderer 테스트 추가·수정 | `./node_modules/.bin/vitest run src/main/features/sessions src/main/features/chat/turn-coordinator.test.ts src/main/app/chat-turn src/renderer/src/features/chat` | 현재 변경이 유발한 red. DB 로드 스위트 bindings 실패는 환경 기준선 |
| 테스트 예산 | 새 테스트 파일 | `node scripts/check-test-budgets.mjs` | 새 파일의 위반 |
| 테스트 풀 | 새 main 테스트가 unit 풀에서 자식 프로세스·SQLite를 쓰지 않음 | vitest 실행 결과(unit guard) | 새 파일의 위반 |
| 문서 인벤토리 | `docs/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 새 수치·깨진 링크 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| R-01 | 경고 판정 = `projectConcurrencyCount − (inflight ? 1 : 0) > 0`. `inflight`는 `useChatResponding()` = `s.inflight \|\| s.activityTransport === 'listening'` | `Composer.tsx:127,166,171` · `chatStore.ts:2248-2255` |
| R-02 | renderer `inflight`는 main `telemetry`·`turn.aborted`·`error` 수신과 `CANCEL_CHAT`에서 `TURN_END_RESET`으로 false. 비-delta 이벤트는 rAF 버퍼 없이 즉시 store에 반영 | `chatReducer.ts:589-599,1131-1137,1289-1304,1404-1408` · `eventCoalescer.ts` push |
| R-03 | count는 `ActiveTurnTracker`가 coordinator `increment`(스트림 시작 직후)·`decrement`(스트림 루프 `finally`)마다 즉시 `broadcastConcurrency` | `turn-coordinator.ts:323,550` · `bootstrap.ts:1110-1113` · `send.ts(ipc):67-69` |
| R-04 | 실측 순서(실제 `TurnCoordinator` + 실제 `ActiveTurnTracker` + 버스 relay, 일회성 스크래치): `concurrency(p1=1)` → `chatEvent(message.completed)` → `chatEvent(telemetry)` → `chatEvent(turn.ended)` → `concurrency(p1=0)`. 같은 열에 R-01 판정을 적용하면 `[F,F,T,T,F]` | 스크래치 vitest 출력(커밋 안 함 — IT-01이 같은 관측을 고정) |
| R-05 | 두 하네스 모두 terminal 배치가 `[…, telemetry, turn.ended]`이고 프레임은 그 배치 뒤 끝난다 — 경합은 공통 코드에 있다 | OpenCode `map.ts:245-277` · Claude `adapter.ts:945-965` · `session-runtime.ts:540,632-640` |
| R-06 | renderer는 IPC 메시지마다 별도 task로 처리하고 zustand(`useSyncExternalStore`) 갱신을 다음 메시지 전에 commit한다. `Notice`에는 전환 효과가 없어 DOM 삽입·제거가 그대로 깜빡임이 된다 | React 19.2.8 · zustand 5.0.14 (`node_modules`) · `Notice.tsx:29-33` |
| R-07 | Stop: renderer `cancel()`이 `CANCEL_CHAT`을 즉시 적용(inflight false)한 뒤 main이 처리한다. main `interruptResponse`는 `turn.aborted`를 바로 보내지만 coordinator `decrement`는 그 뒤 microtask에서 돈다 | `chatStore.ts:1372-1392` · `chat-turn/index.ts:110-120` · `session-runtime.ts:888-917` |
| R-08 | 즉시 보내기도 `interruptResponse`를 지난다 | `chat-turn/index.ts:148-167` |
| R-09 | count의 소비자는 Composer 경고 하나다. 업데이트 gate는 count가 아니라 lease를 읽는다 | `rg concurrencyByProjectId` → `chatStore.ts`·Composer만 · `bootstrap.ts:920-929` |
| R-10 | 계약 문서가 현재 설계를 서술한다: "Composer는 자기 inflight를 차감해 경고 표시 여부를 판정한다" | `IPC_CONTRACT.md:473` |
| R-11 | 연속 턴은 `makeContinuationTurn`이 새 객체를 명시 필드로 만든다 — 턴 객체를 토큰으로 써도 이전 턴 상태가 새지 않는다 | `turn-context.ts:213-243` |
| R-12 | 같은 WebContents로 가는 `wc.send`는 channel을 인자로만 갖는다. chatEvent와 concurrencyEvent 모두 그 경로다. 저장소는 이미 같은 경로의 순서(delta → telemetry)에 의존한다 | `infra/ipc/send.ts:50-69` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| main이 renderer로 terminal 리터럴을 보내는 자리 | `rg -n "type: '(telemetry\|error\|turn\.aborted)'" src/main/features/chat/turn-coordinator.ts src/main/app/chat-turn -g '!*.test.ts'` | 17 | 아래 분류표 |
| 스트림 이벤트 relay 자리 | `rg -n "this\.emit\(turn, ev\)" src/main/features/chat/turn-coordinator.ts` | 4 | 113(emit 정의 내부) · 132(streamEmit) · 461(루프 relay — terminal 포함) · 560(합성 telemetry) |
| tracker 호출 자리 | `rg -n "activeTurns\.(increment\|decrement\|begin\|end)\(" src/main -g '!*.test.ts'` | 2 | 323 · 550 |
| renderer `inflight` 전이 자리 | `rg -n "inflight: (true\|false\|state\.inflight\|activity)\|\.\.\.TURN_END_RESET" src/renderer/src/features/chat/reducer/chatReducer.ts` | 9 | 514·593(정의) · 879(BEGIN_TURN) · 1137·1293·1302(main terminal) · 1408(CANCEL_CHAT) · 1544·1560(hydrate) |
| count 소비처 | `rg -n "concurrencyByProjectId\|useProjectConcurrencyCount\|concurrencyActive" src/renderer/src -g '!*.test.*'` | 11 | store 정의·구독 + Composer만 |

terminal 송신 자리 분류 — "그 턴이 계상 중일 때 송신될 수 있는가":

| 자리 | 계상 중 송신 | 근거 |
|---|---|---|
| `turn-coordinator.ts:461` 루프 relay(terminal) | **예** | inner `finally`(550)보다 앞 |
| `turn-coordinator.ts:296` `deliverAbortTerminal` | 아니오 | begin 전(시작 전 중단) 또는 inner `finally` 뒤에서만 호출 |
| `turn-coordinator.ts:555` 합성 telemetry | 아니오 | inner `finally` 뒤 |
| `turn-coordinator.ts:616` catch error | 아니오 | outer catch — inner `finally` 뒤 |
| `chat-turn/index.ts:116` `interruptResponse` | **예** | coordinator 루프 진행 중 |
| `send.ts` 12자리(78·92·110·117·134·152·166·186·228·279·460·727) | 아니오 | 727은 `runTurnWithContinuations` 예외 경로라 inner `finally` 뒤, 나머지는 begin 전 |
| `enqueue.ts:103` busy 거절 | 해당 턴과 무관 — 경계 B-4 | steer 거절 |

### 수치 / 전칭 표현 검산

- 분류표 합계: coordinator 3(296·555·616) + index 1 + send 12 + enqueue 1 = 17 = 검색 N.
- "계상 중 송신" 자리 = 2(461·index:116). 반례 검색은 위 분류표 전수다.
- "첫 턴 한정 아님": 경합은 턴마다 같은 coordinator 경로를 지난다(R-03·R-05).
- 문서 앵커·기존 테스트 존재: `IPC_CONTRACT.md:469 §2.12-b` · `runtime-ipc.md:25` · `turn-coordinator.test.ts:1337` · `post-turn.schedules.test.ts` 실핸들러 fixture(:46-275) 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01, AR-02.
- 현재 책임 소유자: count = main `ActiveTurnTracker`(프로젝트별 정수). 자기 차감 = renderer `inflight`(낙관).
- 경로: coordinator가 스트림 시작에 `increment`, 루프가 terminal을 relay(461), 스트림 종료 뒤 `finally`에서 `decrement`(550).
- 오류/취소: Stop은 renderer가 먼저 `inflight=false`, main은 `turn.aborted`를 먼저 보내고 count는 나중에 내려간다.
- 직접 원인: 자기 차감 신호(`inflight`)가 count보다 먼저 내려가는 순서를 막는 계약이 없다.

```text
main:  increment → … → relay(telemetry) ─┐        ┌→ decrement → concurrency(0)
                                          ▼        │
renderer: inflight=false (count 1 그대로) → 1−0>0 → Notice 삽입 → (다음 IPC) count 0 → Notice 제거
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, AR-01, AR-02.
- 책임: count는 그대로 main tracker. 다만 계상은 **턴 객체 토큰 단위**이고 해제는 멱등이다. 자기 차감은 renderer `ownTurnOpen`(main terminal로만 닫힘) 또는 활동 transport `listening`.
- 순서 계약: main은 자기 턴의 terminal을 renderer로 보내기 **전에** 그 턴의 계상을 해제한다(E1·E3). renderer는 main terminal을 받을 때까지 자기 턴을 차감한다(M2~M6).
- 오류/취소: Stop의 `CANCEL_CHAT`은 `inflight`만 내리고 `ownTurnOpen`은 둔다. main `interruptResponse`가 `end(turn)` 뒤 `turn.aborted`를 보낸다.
- 유지: payload·브로드캐스트 경로·× 에피소드·listen 비계상. 제거: 판정의 `useChatResponding` 의존.

```text
main:  begin(turn) → … → end(turn) → concurrency(0) → relay(telemetry)
renderer: count 0 · ownTurnOpen → 0−1 ≤ 0 → telemetry → ownTurnOpen=false → 0−0 ≤ 0
Stop:  CANCEL_CHAT(ownTurnOpen 유지) → main end(turn) → concurrency(0) → turn.aborted → ownTurnOpen=false
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 자기 차감 = `inflight`(낙관) | `ownTurnOpen`(main terminal로만 닫힘) | 낙관 갱신이 count보다 앞섬 | AR-02 / VP-06·09 |
| data/control flow | relay(terminal) ≺ decrement | end(turn) ≺ relay(terminal) | 순서 경합 제거 | SD-01 / VP-04·05 |
| state/contract | tracker `increment/decrement(projectId)` | `begin(token, projectId)`/`end(token)` 멱등 | 여러 자리에서 안전하게 해제 | MD-01 / VP-07 |
| error/lifecycle | Stop이 `turn.aborted` 먼저 | `interruptResponse`가 `end` 먼저 | R-07 | AR-01 / VP-05 E3 |
| test seam | 판정 인라인 식 | 순수 `concurrencyNoticeActive`·`ownTurnCounted` | 단위·재생 테스트 | MD-02 / VP-08 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/sessions/active-turn-tracker.ts` | 토큰 단위 계상·프로젝트 count·onChange | `begin/end/getCount` | supervisor(소유) · coordinator(포트) · `chat-turn/index.ts`(supervisor 경유) |
| `features/chat/turn-coordinator.ts` | begin · terminal 직전 end · finally end | `ActiveTurnGate` 포트 | `app/chat-turn` |
| `app/chat-turn/index.ts` `interruptResponse` | `end(turn)` 뒤 `turn.aborted` | supervisor | IPC 핸들러 |
| renderer `chatReducer.ts` | `ownTurnOpen` 전이 | action → state | store |
| renderer `features/chat/lib/concurrencyNotice.ts`(신규) | 판정 함수·selector | 순수 | Composer |
| renderer `Composer.tsx` | 판정 조립·표시 | hooks | 페이지 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-05 | 자기 턴 계상 해제 ≺ 그 턴 terminal 송신 | `active-turn-tracker.ts` | main | **E0** `turn-coordinator.ts` 스트림 시작 직후 `begin(turn, boundProjectId)` (`policy.countsAsActive`일 때만) · **E1** 루프 relay 직전 — `ev.type`이 `telemetry`·`error`·`turn.aborted`면 `end(turn)` · **E2** inner `finally` `end(turn)` · **E3** `chat-turn/index.ts` `interruptResponse`의 `sendChatEvent(turn.aborted)` 직전 `supervisor.activeTurns.end(turn)` — 4자리 | `rg -n "activeTurns\.(begin\|end\|increment\|decrement)\(" src/main -g '!*.test.ts'` → 변경 후 4건 · 보조: §8 terminal 분류표 검색(17건) 중 "계상 중 송신" 2건 = E1·E3 | E1 누락 → 정상 종료 깜빡임 재발 · E3 누락 → Stop 깜빡임 · E2 누락 → 예외 경로 count 고착(경고 영구 표시) · E0 정책 누락 → listen이 경고 오점화 |
| MD-01 / VP-07 | tracker 규칙 | 같음 | main | **T1** `begin` · **T2** `end` · **T3** `getCount` — 3자리 | `rg -n "^\s+(begin\|end\|getCount)\(" src/main/features/sessions/active-turn-tracker.ts` → 3건 | 아래 규칙 칸 |
| AR-02 / VP-06 | Composer 판정 = `concurrencyNoticeActive(count, ownTurnCounted(state))` | `concurrencyNotice.ts` | renderer | **C1** `Composer.tsx` 판정식(현 171) · **C2** 자기 계상 입력(현 127 `useChatResponding` → `useChatSession(ownTurnCounted)`) — 2자리 | `rg -n "concurrencyActive\|concurrencyNoticeActive\|ownTurnCounted\|useProjectConcurrencyCount" src/renderer/src -g '!*.test.*'` | C2가 `useChatResponding`이면 Stop 깜빡임 · C1 인라인 복귀면 SSOT 이탈 |
| MD-02 / VP-08 | 판정·selector | `concurrencyNotice.ts` | renderer | **N1** `concurrencyNoticeActive` · **N2** `ownTurnCounted` — 2자리 | `rg -n "^export function" src/renderer/src/features/chat/lib/concurrencyNotice.ts` → 2건 | 아래 규칙 칸 |
| MD-03 / VP-09 | `ownTurnOpen` 전이 | `chatReducer.ts` | renderer | **M1** `initialChatState` false · **M2** `BEGIN_TURN` true · **M3** RECV `telemetry` false · **M4** RECV `turn.aborted` false · **M5** RECV `error` false · **M6** `CANCEL_CHAT` 유지 · **M7** `LOAD_SESSION` 전체 분기 + `preserveNewerLiveActivity` → `state.ownTurnOpen` · **M8** 전체 분기 + activity → `activity.foreground !== 'idle'` · **M9** 전체 분기 + activity 없음 → false(`...initialChatState`) · **M10** `LOAD_SESSION` `preserveLocalState` 분기 → `...state`로 유지 · **M11** `NEW_CHAT` → false(`...initialChatState`) · **M12** `START_LOAD_SESSION` → false(`...initialChatState`) — 12자리 | `rg -n "inflight: (true\|false\|state\.inflight\|activity)\|\.\.\.TURN_END_RESET\|preserveLocalState &&\|\.\.\.initialChatState," src/renderer/src/features/chat/reducer/chatReducer.ts` → 514 M1 · 593 `TURN_END_RESET` 정의(자리 아님 — M3~M5는 `MAIN_TERMINAL_RESET`, M6은 그대로) · 879 M2 · 1137 M3 · 1293 M4 · 1302 M5 · 1408 M6 · 1544 M7 · 1560 M8 · 1483 M9 · 1449 M10 · 1322 M11 · 1425 M12 | M6 누락 → Stop 깜빡임 · M3~M5 누락 → 자기 턴 영구 차감(다른 턴 1건 가림) · M7~M12 누락 → 재열기·새 대화 직후 오판 |
| SD-01 / VP-04 | 순서 모델 | `app/src/shared/concurrency-order.testfixture.ts`(신규) | 테스트 | **SD-1** main 기록 투영 = fixture wire(IT-01 안의 동등 단언) · **SD-2** fixture 재생 판정열 = `expectNotice`(ST-01) — 2자리 | `rg -n "CONCURRENCY_ORDER" app/src -g '*.test.ts'` → 두 테스트 파일 | fixture가 실제 main 순서와 갈라지면 재생이 거짓 green |

### 규칙 칸 ↔ UT 입력 칸

| 자리 | 규칙(분기) | UT 입력 — 각 분기로 가는 입력 |
|---|---|---|
| T1 `begin(token, projectId)` | (a) projectId null/undefined → 무변화·onChange 없음 (b) 새 토큰 → count+1·onChange(p, n) (c) 이미 보유 토큰 → 무변화·onChange 없음 | (a) `begin(t1, null)` (b) `begin(t1,'p1')`·`begin(t2,'p1')` → 1·2 (c) `begin(t1,'p1')` 두 번 → 1, onChange 1회 |
| T2 `end(token)` | (a) 보유 → count−1·0이면 삭제·onChange(p, n) (b) 미보유 → 무변화·onChange 없음 (c) 다른 토큰 보존 | (a) `begin(t1,'p1')`→`end(t1)` → 0, onChange `(p1,0)` (b) `end(t9)` 단독·`end(t1)` 두 번째 (c) t1·t2 보유 후 `end(t1)` → 1 |
| T3 `getCount` | null/undefined → 0 · 미존재 → 0 | `getCount(null)`·`getCount(undefined)`·`getCount('px')` |
| N1 `concurrencyNoticeActive(count, own)` | `count − (own?1:0) > 0` | `(0,false)`F · `(0,true)`F · `(1,true)`F · `(1,false)`T · `(2,true)`T |
| N2 `ownTurnCounted(s)` | `ownTurnOpen` 또는 `activityTransport==='listening'` | `{open:true, idle}`T · `{false, listening}`T · `{false, ready}`F · `{false, idle}`F |
| M1~M12 | 위 §10 표 | M1 `initialChatState` · M2 `BEGIN_TURN` · M3~M5 각 RECV(시작 true) · M6 open=true에서 `CANCEL_CHAT` → true **이면서 inflight=false**(구별) · M7 같은 세션 + 스냅샷 revision이 state보다 낮음, state.ownTurnOpen=true · M8 foreground `responding`→true / `idle`→false · M9 activity 없음, 시작 true → false · M10 `preserveLocalState` + 같은 세션, 시작 true → true · M11 `NEW_CHAT`, 시작 true → false · M12 `START_LOAD_SESSION`, 시작 true → false |
| IT-02 Composer | 판정이 C1·C2를 거친다 | `(count 1, ownTurnOpen true, inflight false, responding false)` → 패널 없음 — **구 판정이면 표시되는 구별 입력** · `(1, false, false, false)` → 있음 · `(1, false, transport listening, responding true)` → 없음 · `(2, true, true, true)` → 있음 |
| ST-01 경로 | P1~P8 판정열 전부 F · O1 `[F,T,T,T,F]` 형(자기 턴 중 count 2 → T, 종료 후 1 → T, 다른 턴 종료 → F) · O2 Stop 중 T 유지 · O3 T→F | fixture 단계열(§11) |

- **선언 경계**:
  - B-1 페인트 타이밍: vitest는 프레임을 그리지 않는다. 판정열 F가 곧 "그려질 상태 없음"이며 실제 깜빡임 부재는 AC14 실기로만 본다.
  - B-2 IPC FIFO: chatEvent·concurrencyEvent가 같은 WebContents에서 보낸 순서대로 도착한다는 전제(R-12). vitest가 electron을 로드하지 못하고(`src/main/AGENTS.md` P29), `bootstrap.ts:1110-1113` onChange→`broadcastConcurrency` 동기 호출도 같은 이유로 좌표가 없다(이번 변경 없음). AC14가 덮는다.
  - B-3 프로젝트 재바인딩: main이 `send.ts:349`에서 다른 projectId로 바인딩하면 renderer 키와 갈린다 — 기존 동작, 이번 계약 밖.
  - B-4 steer 거절 `error`(`enqueue.ts:103`): renderer가 terminal로 읽어 `inflight`·`ownTurnOpen`을 내린다. 원 턴이 계속 돌면 경고가 보인다 — 현재도 같다(회귀 아님).
  - B-5 renderer가 main terminal을 끝내 받지 못하면 `ownTurnOpen`이 남아 다른 턴 1건을 가린다(false negative). main은 begin 이후 모든 경로에서 terminal을 보낸다(§8 분류표) — 앱 crash·IPC 단절만 남는다.
- 열린 입력 집합 판정 산출물: 해당 없음.
- 같은 규칙의 SSOT: 판정·selector는 `concurrencyNotice.ts` 한 곳. Composer에 인라인 식을 두지 않는다.
- "다른 게이트가 막는다" 기재: 해당 없음.
- 선택적 필드: `ownTurnOpen`은 필수 boolean(기본 false). tracker `projectId` null/undefined는 계상하지 않는다(T1a).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/sessions/active-turn-tracker.ts` | 토큰 계상 | `increment/decrement` → `begin(token: object, projectId)`/`end(token)`. `Map<object, string>`로 보유 토큰 관리, onChange는 실제 변화 때만. 헤더 주석에 순서 계약 1줄 | UT-01 |
| `app/src/main/features/chat/turn-coordinator.ts` | E0~E2 | `ActiveTurnGate`를 `begin/end`로. 323 → `begin(turn, boundProjectId)` · 461 앞 terminal이면 `end(turn)` · 550 → `end(turn)` | IT-01 |
| `app/src/main/app/chat-turn/index.ts` | E3 | `interruptResponse`에서 `sendChatEvent(turn.aborted)` 직전 `supervisor.activeTurns.end(turn)` | IT-01 P4·P5 |
| `app/src/main/features/sessions/supervisor.ts` | 타입 | getter 타입 유지(코드 변경 없을 수 있음) | — |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | M1~M12 | `ChatState.ownTurnOpen: boolean` + 주석("main terminal을 받기 전의 자기 턴 — 동시 실행 경고 자기 차감 전용, CANCEL_CHAT은 내리지 않는다"). main terminal 3경로는 `MAIN_TERMINAL_RESET = { ...TURN_END_RESET, ownTurnOpen: false }`, `CANCEL_CHAT`은 `TURN_END_RESET` 유지 | UT-03 |
| `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`(신규) | N1·N2 | 순수 함수 2개 | UT-02 |
| `app/src/renderer/src/features/chat/components/Composer.tsx` | C1·C2 | `const ownCounted = useChatSession(ownTurnCounted)` · `concurrencyActive = concurrencyNoticeActive(projectConcurrencyCount, ownCounted)`. `inflight`(=responding)의 다른 사용처는 그대로 | IT-02 |
| `app/src/shared/concurrency-order.testfixture.ts`(신규) | 순서 fixture | 단계 어휘 `{at:'renderer', action:'BEGIN_TURN'\|'CANCEL_CHAT'}` · `{at:'wire', channel:'concurrency', count}` · `{at:'wire', channel:'chat', type:'telemetry'\|'error'\|'turn.aborted'\|'turn.ended'}` · `{at:'wire', channel:'chat', type:'chat.activity', transport}`. 경로 P1~P8·O1~O3별 `steps`·`expectNotice`. renderer 지역 동작은 main 반응 **전**에 둔다(최악 순서) | SD-1·SD-2 |
| `app/src/main/app/chat-turn/concurrency-order.test.ts`(신규) | IT-01 | `post-turn.schedules.test.ts` fixture 형태(실제 `SessionRuntime`·`RuntimeSupervisor`·`TurnCoordinator`·`registerChatHandlers`) + `new RuntimeSupervisor({ activeTurns: new ActiveTurnTracker(로그) })` · `boundProjectId 'p1'` · coordinator forward와 `sendChatEvent` mock과 activity emit을 **같은 로그**에 기록. 경로별 투영(concurrency p1 · fixture 어휘 chat · activity는 transport 변화만) = fixture wire | E0~E3 · SD-1 |
| `app/src/main/features/chat/turn-coordinator.test.ts` | 갱신 | `activeTurns` fake를 `begin/end`로(:255·795-796·1171-1172·1346-1347) | 기존 회귀 |
| `app/src/main/features/sessions/active-turn-tracker.test.ts`·`supervisor.test.ts:197-198` | UT-01 | 규칙 칸 입력 | T1~T3 |
| `app/src/renderer/src/features/chat/lib/concurrencyNotice.test.ts`(신규) | UT-02 | 규칙 칸 입력 | N1·N2 |
| `app/src/renderer/src/features/chat/lib/concurrencyNotice.order.test.ts`(신규) | ST-01 | fixture `steps`를 실제 `chatReducer`(`RECV_EVENT`·`BEGIN_TURN`·`CANCEL_CHAT`)와 count 변수로 재생하고 단계마다 `concurrencyNoticeActive(count, ownTurnCounted(state))` → `expectNotice`. 대조: AS-IS 순서 P1 변형은 true를 낸다 | SD-2 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ownTurnOpen.test.ts`(신규) | UT-03 | M1~M12 | M1~M12 |
| `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts`(신규) | IT-02 | `Composer.activity.test.ts`와 같은 `renderToStaticMarkup` + `useChatSession`이 selector를 가짜 state에 적용하는 mock · `useProjectConcurrencyCount`·`useChatResponding` 값 주입 · 패널 제목 존재 단언 | C1·C2 |
| `docs/IPC_CONTRACT.md:473` · `docs/arch/backend/runtime-ipc.md:25` | AC13 | 설명 문장: main은 턴 terminal 전 계상을 해제, Composer는 main terminal 전 자기 턴(+수신 대기 transport)을 차감 | 인벤토리 게이트 |

### 테스트 가능성

- 순수 파일: `concurrencyNotice.ts`(React·store 비의존), `active-turn-tracker.ts`(electron 비의존).
- 기존 메커니즘 재사용: 실핸들러 fixture는 `boundProjectId`를 `null`로 넘겨 계상하지 않는다(`post-turn.schedules.test.ts:229`) — 새 파일은 `'p1'`을 넘긴다.
- 순서 관측: 단일 로그 배열 하나에 tracker onChange·forward·`sendChatEvent` mock·activity emit을 기록한다.

## 12. End-to-end 영향

### producer → consumer

```text
coordinator/interruptResponse → ActiveTurnTracker → broadcastConcurrency ─┐
coordinator relay / sendChatEvent → chatEvent ────────────────────────────┤→ chatStore(count · ownTurnOpen) → Composer → Notice
```

- producer 기준: count = 계상 중 턴 수. 해제는 terminal 송신 전(E1·E3).
- consumer 파생 규칙: 다른 턴 = count − 자기 계상(main terminal 전 자기 턴 또는 수신 대기 transport).
- 합성값 우회: 없음 — Composer는 `concurrencyNoticeActive` 하나로 판정한다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:1110-1113` onChange → `broadcastConcurrency` + `updateStateChanged` | 호출 시점이 terminal 직전으로 앞당겨질 뿐, gate는 lease를 읽는다(R-09) | AC14 |
| `activeTurns`를 참조하는 통합 테스트 6파일(`rg -l "activeTurns" src/main -g '*.test.ts'` → 8건 중 `supervisor.test.ts`·`turn-coordinator.test.ts` 제외: `chat-turn.runtime-tools`·`response-boundary.integration`·`post-turn.schedules`·`opencode-continuation`·`chat-turn.continuity`·`chat-turn.execution-config`) | 실제 tracker를 넘기면 API 변경만 반영 | 관련 vitest gate |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `runtime.send` 직후 `begin`(E0). 재시도 attempt마다 begin↔finally end 왕복.
- 취소/중단: Stop·즉시 보내기 = E3 → 이후 coordinator의 E1·E2는 no-op.
- 종료/crash/renderer-gone: 예외로 루프를 나오면 E2가 해제. renderer-gone은 lease 정리 경로가 turn abort → E2.
- retry/timeout: retry는 thrown error·이벤트 0건에서만 — terminal 뒤 begin 재진입 없음.
- cleanup: 토큰 Map 항목은 end에서 삭제 — 누수 없음.
- 다중 저장소 쓰기: 산출 판정의 사본 = `plan.md`·`verify.md`·`INDEX.md` 보드. 코드 쪽은 해당 없음.

## 14. 성능 / 상한 / 최적화

- 해당 없음 — 턴당 broadcast 수 불변(begin 1·end 1).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 외부 구현자 없음. IPC 계약 문장만 갱신(AC13).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 경고 = 자기 턴 제외·비차단·에피소드 닫기 | `Composer.tsx:167-178` · `ko.ts:1099-1100` | §5 · AC6 | 유지 |
| listen 턴 비계상(0143) | `turn-coordinator.ts:320-323` | E0 · AC11 | 유지 |
| `inflight`는 라이브 경로에서 renderer 소유, 스냅샷은 hydrate만 | `chatReducer.ts:1242-1245,1558-1560` | M7·M8은 같은 원칙으로 `ownTurnOpen`도 hydrate에서만 스냅샷 사용 | 유지 |
| `TURN_END_RESET` 단일 리셋 | `chatReducer.ts:586-599` | `MAIN_TERMINAL_RESET`이 `TURN_END_RESET`을 펼쳐 쓴다 | 유지(확장) |
| IPC 계약 "자기 inflight 차감" | `IPC_CONTRACT.md:473` | AC13 | 변경 — 경합 원인 서술 |
| main 레이어 DAG | `src/main/AGENTS.md` | `app → features/sessions`(supervisor 경유) | 유지 |
| renderer 4-layer | `src/renderer/AGENTS.md` | 신규 파일은 `features/chat/lib` | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Stop 직후 다른 창 Composer에서 경고가 실제 스트림 종료보다 조금 일찍 꺼진다 | 사용자가 중단을 요청한 턴이라 "실행 중 작업"이 아니다 — 수용 |
| `ownTurnOpen` 고착(B-5) | 결과는 경고 1건 가림(오탐 아님). main 모든 경로가 terminal을 보낸다 |
| 세션 식별자 기반 대안(D-007) | 새 세션 id 미발급 구간 매핑·payload 변경·IPC 문서 개정이 필요 — 순서 계약이 더 작다 |

- 되돌리기 어려운 결정: 없음(내부 API·renderer 상태).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/sessions/active-turn-tracker.ts`(+test) · `supervisor.test.ts`
- `app/src/main/features/chat/turn-coordinator.ts`(+test)
- `app/src/main/app/chat-turn/index.ts` · `app/src/main/app/chat-turn/concurrency-order.test.ts`(신규)
- `app/src/shared/concurrency-order.testfixture.ts`(신규)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `chatReducer.ownTurnOpen.test.ts`(신규)
- `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`·`.test.ts`·`.order.test.ts`(신규)
- `app/src/renderer/src/features/chat/components/Composer.tsx` · `Composer.concurrency.test.ts`(신규)
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/runtime-ipc.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 제약: 제약 환경은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`로 설치한다. DB 로드 스위트 bindings 실패는 기준선.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate 표의 vitest 명령 + `node scripts/check-test-budgets.mjs` + `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC14(OpenCode·Claude).

## READY self-review

- 결정 보존: D-001~D-007 ACTIVE, OPEN 0. D-003은 추론임을 §2·§4에 표시.
- Part I만으로 완료 상태 설명 가능: §1·§5 상태표.
- 사용자 문장 재해석 없음: §2 원문 인용. "세션 시작 시"는 첫 턴 포함 모든 턴으로 확인(§8 검산).
- AS-IS/TO-BE 같은 축: §9 Delta 5행이 §11 파일과 AC에 연결.
- 실측: 순서(R-04)·검색 N(§8 전수 조사)·문서 앵커·기존 테스트(§8 검산 4번째 줄).
- V: Baseline, NEW node 13개 전부 REQUIRED pair. AT pair는 §10 자리 0 + 이유.
- 규칙 칸 ↔ 입력 칸: §10 표 — T1(3분기)·T2(3)·T3(2)·N1(5)·N2(4)·M1~M12·IT-02(4) 모두 입력 있음.
- 적대 증거: VP-04(순서 모델 민감도)·VP-05(end 뒤로 옮김)·VP-06(responding 맞바꿈)만 선택, 이유 기재.
- 선언 경계 B-1~B-5는 측정 근거(파일:줄·실측)와 함께.
- INDEX 후보 표 겹침: 0행(0262·0294·0296 대상 파일과 무관).
- 사람 실기로 미룬 순수 로직 없음: 판정·전이·순서 모델은 UT/ST.
- 산출물 문장 규칙: 표 한 칸 3줄 이내로 작성.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: 해당 없음(첫 라운드)

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

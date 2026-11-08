# Plan — 0299-concurrency-notice-turn-end-flicker

## 메타

| 항목 | 값 |
|---|---|
| slug | `0299-concurrency-notice-turn-end-flicker` |
| 작성자 | Claude Code |
| 일자 | 2026-11-07 (V1) · 2026-11-08 (ΔV1) |
| 매핑 | 버그수정(비기능) — 구현 주체 Claude |
| 상태 | READY (ΔV1) |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `0299:V1@(V1 설계 — 검증자 기입)` — 브랜치 `ccr-37c31341-jfr0sv` 커밋 `28cffb4`, `main` 미병합 |
| 이번 V revision | `ΔV1` — 사용자 결정 D-008로 V1의 순서 보정 설계(SD-01·AR-01·AR-02·MD-01~03)를 신원 기반 설계로 대체 |
| 유효 V | `V1 + ΔV1` — 구현은 §7-B와 Part II(ΔV1판)만 따른다 |

> **ΔV1 읽는 법.** Part I과 Part II는 ΔV1 기준으로 고쳐 썼다. V1 원문(순서 계약 · `ownTurnOpen`)은 기준 V 커밋에 있다.
> §7-A는 V1 node·pair의 처분만 남기고, 유효 V는 §7-B다. V1은 구현·검증 전이라 이관할 실행 증거가 없다.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 자기 턴만 실행 중인 프로젝트에서 턴이 끝날 때마다 컴포저 위 "같은 프로젝트에서 다른 작업이 실행 중입니다" 패널이 나타났다 곧바로 사라진다.
- 구조 원인(§8 R-01~R-08): "자기 턴 제외"를 **출처·채널·시점이 다른 두 값의 산술**(main 집계 `count` − renderer 낙관 플래그 `inflight`)로 계산한다. 두 값 사이에는 동기화 계약이 없어 한쪽이 먼저 바뀌는 모든 순간이 오판이다.
- 같은 구조가 만드는 증상 네 가지(하네스 무관): 턴 종료 오탐(보고된 깜빡임) · Stop·즉시 보내기 오탐 · 다른 세션 실행 중에 자기 턴을 시작하면 경고가 잠깐 사라지는 누락(OpenCode 서버 준비 동안 길어짐) · V1 같은 순서 보정은 IPC 도착 순서와 로컬 플래그 전이 자리를 전부 맞춰야만 성립한다.
- 완료 후 달라지는 것: 경고는 main이 보낸 "지금 실행 중인 턴의 신원 목록"과 "화면에 띄운 세션의 신원"만으로 정해진다. 로컬 턴 플래그와 도착 순서는 판정에 들어가지 않는다.
- 성공을 사용자 관점에서 한 문장으로: 혼자 작업할 때 이 경고는 한 번도 깜빡이지 않고, 같은 프로젝트에서 다른 세션이 돌 때만 끊김 없이 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "오픈코드 컴포저로 세션 시작 시, 어시스턴트의 답변이 끝날때(턴종료), 컴포저 상단에 같은 경로에서 1개 이상의 세션이 동작하는 경우에 대한 경고 패널이 떴다가 바로 사라진다. … 왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 라이브 세션 2026-11-07 |
| 명시 요구 | "Claude에서도 발상할수있는 구조적인 문제라면 구조적인 문제자체를 해결하도록 설계하라" | 라이브 세션 2026-11-08 |
| 추론 의도 | 순서를 맞추는 보정이 아니라 오판이 생길 수 없는 판정 구조로 바꾼다 — "구조적인 문제자체를 해결" | D-008 |
| 추론 의도 | 같은 구조의 다른 증상(Stop·즉시 보내기·시작 시 누락)도 함께 사라져야 한다 | D-003 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 턴 종료 때 동시 실행 경고가 깜빡이는 원인을 확인하고 없앤다 | 원문: "왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 사용자 턴 2026-11-07 | ACTIVE | — |
| D-002 | 경고 의미 유지 — 같은 프로젝트에서 **자기 것이 아닌** 턴이 돌 때만 보이고, 차단하지 않으며, ×는 에피소드 단위다 | 기존 채택 동작 | `Composer.tsx:167-178` · `ko.ts:1099-1100` | ACTIVE | — |
| D-003 | 범위는 같은 원인의 모든 증상이다 — 정상 종료·스트림 오류/중단·Stop·즉시 보내기·핸드오프 새 세션·시작 시 누락 | 한 판정식이 모든 경로에서 같은 방식으로 틀린다 | 설계(추론) | ACTIVE | — |
| D-004 | 하네스 무관하게 고친다. 하네스 전용 분기를 두지 않는다 | 원인이 공통 `TurnCoordinator`·`Composer`에 있다(§8 R-05) | 설계 | ACTIVE | — |
| D-005 | 지연·디바운스로 가리지 않는다 | 시간 휴리스틱은 진짜 경고를 늦추고 원인을 남긴다 | 설계 | ACTIVE | — |
| D-006 | listen 턴은 실행 중 턴으로 세지 않는다 | 0143 결정 유지 | `turn-coordinator.ts:320-323` | ACTIVE | — |
| D-007 | IPC payload `{ projectId; count }`를 유지한다 | — | V1 설계 | SUPERSEDED | D-009 |
| D-008 | 구조 원인 자체를 없앤다. 도착 순서·로컬 플래그 동기화에 기대는 보정을 쓰지 않는다 | 원문: "구조적인 문제라면 구조적인 문제자체를 해결하도록 설계하라" | 사용자 턴 2026-11-08 | ACTIVE | — |
| D-009 | 자기 제외를 **신원**으로 한다. main은 프로젝트별 실행 중 턴의 신원 스냅샷 `{ projectId; turns: ActiveTurnRef[] }`을 보내고 `count`는 없앤다. renderer는 표시 중 세션 신원과 맞는 항목을 뺀 수로 판정한다. renderer 턴 플래그(`inflight`·`responding`·transport)는 판정 입력이 아니다 | 스냅샷은 한 번에 통째로 오고 신원 비교는 순서와 무관하다. `count`를 없애야 산술 판정이 다시 생기지 않는다 | 설계(D-008 이행) | ACTIVE | D-007 대체 |
| D-010 | "자기"는 표시 중 세션이다 — 같은 세션 id, 또는 그 세션이 태어난 draft 키. 다른 창에서 같은 세션을 볼 때 그 세션의 턴도 자기로 본다 | 같은 세션은 lease 때문에 병렬로 돌 수 없어 파일 충돌 경고 대상이 아니다. AS-IS는 다른 창에서 경고를 띄웠다 — 사용자가 바꿀 수 있다 | 설계(추론) | ACTIVE | — |

### 갱신 메모

- 이번 턴(ΔV1)에서 새로 추가된 결정: D-008(사용자) · D-009 · D-010.
- 변경된 결정: D-007 → D-009 (사용자 지시 "구조적인 문제자체를 해결" — payload 유지 조건이 순서 보정 설계의 전제였다).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001~D-006.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC6 · D-003 ↔ AC1~AC7 · D-004 ↔ AC14 · D-005 ↔ §9 TO-BE(타이머 없음) · D-006 ↔ AC11 · D-008 ↔ AC1~AC7의 "모든 도착 순서" 단언 · D-009 ↔ AC12(Composer에 플래그 입력 없음)·AC13(payload) · D-010 ↔ AC9 N2 분기.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 원인은 판정 구조이고 증상은 그 결과다 | §8 R-01·R-04·R-09 |
| 이미 기존 코드가 충족하는가 | 아니오 | `Composer.tsx:171` 산술 판정 |
| 더 작은 해법이 있는가 | V1(순서 보정)이 더 작지만 IPC FIFO 전제(V1 B-2)와 로컬 플래그 고착(V1 B-5)이 남고, 플래그가 오르는 자리 셋(R-10)을 놓쳤다 — D-008이 배제 | §8 R-10 |
| 선행 자료의 주장을 코드와 대조했는가 | `IPC_CONTRACT.md:473` "Composer는 자기 inflight를 차감해" — 이 계약 문장이 구조 원인이다 | §8 R-11 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | D-007(V1)만 대체. D-002·D-006 유지 | §16 |

- 사용자에게 올릴 결정: 없음. D-010(같은 세션 다른 창 처리)은 추론이며 사용자가 AS-IS 동작을 원하면 바꾼다.
- 코드 조사로 닫은 사실: 원인·증상 네 가지·하네스 무관·같은 산술 패턴은 `Composer.tsx:171` 한 곳(§8 전수 조사)·양쪽이 공유하는 신원(R-12~R-14).

## 5. 동작 / 사용자 흐름

```text
main:      턴 시작 → 실행 중 턴 목록에 {세션 신원} 추가 → 세션 id 확정 시 신원 보강 → 턴 끝 → 목록에서 제거
           (목록이 바뀔 때마다 프로젝트 스냅샷을 통째로 전송)
renderer:  표시 중 세션 신원 = { sessionId, 그 세션이 태어난 draft 키 }
           다른 턴 수 = 최신 스냅샷 − 표시 중 세션 신원과 맞는 항목
           경고 = 다른 턴 수 > 0
  → 스냅샷·채팅 이벤트·로컬 동작이 어떤 순서로 도착해도 결과가 같다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 자기 턴만, 정상 종료·오류·중단 | 스냅샷에서 자기 항목이 빠지기 전후 모두 자기 신원이라 제외 | 경고 없음 (AS-IS: 1~2 IPC 동안 표시) |
| 자기 턴만, Stop·즉시 보내기 | 같음 | 경고 없음 (AS-IS: 클릭~해제 사이 표시) |
| 새 세션 첫 턴(세션 id 확정 전후) | draft 키로 일치 → 확정 뒤에도 draft 키를 엔트리가 기억 | 경고 없음 |
| 다른 세션 실행 중 + 자기 턴 시작(준비 대기 포함) | 다른 항목은 계속 남는다 | 경고 계속 표시 (AS-IS: 자기 턴 계상 전까지 사라짐) |
| 다른 세션 실행 중 + 자기 턴 종료·Stop | 같음 | 경고 계속 표시 |
| 다른 세션 턴 종료 | 그 항목이 빠진다 | 경고 사라짐 |
| 같은 세션을 다른 창에서 보는 중 | 세션 id로 일치 → 자기 | 경고 없음 (D-010, AS-IS: 표시) |

### 파생 UX / 엣지케이스

- loading / empty / error: 해당 없음 — 문구·스타일 불변.
- cancel / retry / close / restart: 재시도 attempt 사이 항목이 빠졌다 다시 들어와도 자기 신원이라 무관. 앱 재시작·renderer reload 직후 스냅샷은 다음 변경 때 온다(§10 B-3, 기존 동작).
- concurrency / multi-session: 다른 세션·다른 창의 턴은 다른 작업이다. 새 대화 대기열(`newChatQueue`)의 아직 안 보낸 draft는 실행 중 항목이 없다.
- keyboard / a11y / theme / 외부환경: 해당 없음.

## 6. 범위 / 비범위

- **범위**: IPC `ConcurrencyEvent` payload를 신원 스냅샷으로 교체 · main 신원 계상(`begin`·`confirm`·`end`) · renderer 엔트리의 draft 키 보존 · 신원 판정 순수 함수·selector · Composer 판정 교체 · 계약 문서 · 테스트.
- **비범위**: 경고 문구·디자인 · × 에피소드 로직(`Composer.tsx:172-178`, 코드 미변경) · renderer 기동 시 스냅샷 초기 조회(§10 B-3) · 프로젝트 재바인딩 불일치(§10 B-4).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 기동 시 스냅샷 초기 조회 채널 | 아니오 — payload가 스냅샷이라 나중에 pull 하나를 더하면 된다 | 후속 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 자기 턴만, 정상 종료 — 새 세션(승격 포함)·기존 세션 모두, 세 채널(로컬 동작·채팅·스냅샷)의 **모든 인터리빙**의 모든 접두에서 경고 판정 false | ST-02 P1·P2 | `TurnCoordinator` → tracker → `broadcastConcurrency` / `sendChatEvent` → `chatStore` → `Composer` |
| R-01 | AT-01 / AC2 | terminal이 `error`·`turn.aborted`여도 AC1과 같다 | ST-02 P3·P4 | 같음 |
| R-02 | AT-02 / AC3 | Stop — `cancel`을 send 뒤 어느 위치에 두어도(새 세션 승격 전 포함) false | ST-02 P5·P6 | `cancel()` → `chatCancel` → `interruptResponse` |
| R-02 | AT-02 / AC4 | 즉시 보내기 — 중단 → 연속 턴 스냅샷 왕복 동안 false | ST-02 P7 | `chatSteerSendNow` → post-turn flush |
| R-01 | AT-01 / AC5 | main 예외·시작 전 중단·재시도 경로에서 턴 항목이 빠지고 남지 않는다 | IT-03 예외·재시도 케이스 | `turn-coordinator.ts` inner `finally` |
| R-03 | AT-03 / AC6 | 다른 턴이 있으면 모든 인터리빙의 모든 접두에서 판정 = 최신 스냅샷에 자기 아닌 항목 존재(oracle은 fixture 태그) — 자기 턴 시작·종료·Stop 중에도 | ST-02 O1~O3 | 같음 |
| R-01 | AT-01 / AC7 | 핸드오프 새 세션도 AC1과 같다 | ST-02 P8 | `startHandoff()` → `sendNewChatPayload` |
| — | UT-04 / AC8 | tracker `begin/confirm/end/turns` 규칙(§10 규칙 칸) | UT-04 | `active-turn-tracker.ts` |
| — | UT-05 / AC9 | 신원 순수 함수 규칙(§10 규칙 칸, D-010 분기 포함) | UT-05 | `concurrencyNotice.ts` |
| — | UT-06 / AC10 | `activeTurnRef(turn)` 규칙(§10 규칙 칸) | UT-06 | `active-turn-ref.ts` |
| — | IT-03 / AC11 | 실제 coordinator·tracker·핸들러가 P1·P2·P5·P7의 스냅샷 열을 fixture 그대로 낸다. listen 턴은 항목을 만들지 않는다 | IT-03 · `turn-coordinator.test.ts:'listen 턴은 activeTurns 회계에 계상하지 않는다'` 갱신 | E0~E2 |
| — | IT-04 / AC12 | renderer가 스냅샷을 저장하고(S1) 새 세션 엔트리에 draft 키를 남기며(S2·S3) 승격 뒤에도 유지하고(S4) Composer는 `useOtherProjectTurnCount(projectId) > 0`으로만 판정한다(C1) | IT-04 | `chatStore.ts` · `Composer.tsx` |
| — | — / AC13 | `IPC_CONTRACT.md §2.12-b`·`runtime-ipc.md` ActiveTurnTracker 행이 신원 스냅샷 payload와 "신원으로 제외, 산술 금지"를 서술한다 | `node scripts/check-doc-inventory.mjs --check` + 문장 대조 | 문서 |
| R-01·02·03 | AT-01~03 / AC14 | 실제 앱에서 OpenCode·Claude 각각: 새 세션 첫 턴 종료 5회·기존 세션 턴 종료 3회·Stop 3회에 패널 미출현, 다른 세션 실행 중 자기 새 세션 시작(준비 대기 포함) 동안 패널 유지, 다른 세션 종료 후 소멸 | 사람 실기 — 페인트·실제 IPC는 vitest 밖(§10 B-1·B-2) | 실제 Electron |

### AC 검증 주의사항

- 기존 테스트 재사용: `turn-coordinator.test.ts:1337` listen 비계상 케이스 실재 확인 — API 갱신 대상.
- 사람 실기 항목: 깜빡임은 페인트 현상이다. 판정이 순서와 무관하다는 논리는 ST-02 전수 인터리빙이 덮는다.
- 순서 기준: 이번 계약은 순서를 요구하지 않는다. 대신 "모든 순서에서 같은 결과"를 인터리빙 전수로 관측한다(§11).
- 총량 기준: 해당 없음.

## 7-A. V1 처분 (ΔV1)

- V mode 판정: 기준 V = 이 handoff의 V1. 사용자 결정으로 SD·AR·MD 수준을 대체하고 R은 강화(CHANGED).
- 기준 V 상속 근거: `0299:V1@(검증자 기입)` — 커밋 `28cffb4`는 공유 브랜치 `main`에 없다.
- 변경이 시작되는 수준: R(CHANGED — "모든 도착 순서"·시작 시 누락·D-010 추가).

| V1 node | 처분 | 대체 node / 폐기 근거 |
|---|---|---|
| R-01 · R-02 · R-03 / AT-01~03 | CHANGED | §7-B 같은 ID |
| SD-01 순서 계약 | SUPERSEDED | SD-02 순서 무관 계약 |
| AR-01 main 해제 순서(E0~E3) | SUPERSEDED | AR-03 main 신원 스냅샷 |
| AR-02 renderer `ownTurnOpen` 생산→Composer | SUPERSEDED | AR-04 renderer 신원 |
| MD-01 tracker 토큰 규칙 | SUPERSEDED | MD-04 tracker 신원 규칙 |
| MD-02 `count−own` 판정 함수 | SUPERSEDED | MD-05 신원 판정 함수 |
| MD-03 reducer `ownTurnOpen` 전이 | SUPERSEDED — 폐기 | 로컬 턴 플래그가 판정 입력에서 빠진다(D-009) |

| V1 pair | 처분 | AC·선택 적대 증거 이관 |
|---|---|---|
| VP-01~03 | CHANGED | §7-B 같은 ID |
| VP-04 (SD-01↔ST-01) | → VP-14 | 적대 "AS-IS 순서 변형 → true" → VP-14 음성 대조(AS-IS 공식이 어떤 인터리빙에서 오판) |
| VP-05 (AR-01↔IT-01) | → VP-15 | 적대 "end를 emit 뒤로" — **폐기**: 순서가 더 이상 계약이 아니다. VP-15는 `confirm` 누락 변이를 새로 등록 |
| VP-06 (AR-02↔IT-02) | → VP-16 | 적대 "responding 맞바꿈" → VP-16 구별 입력으로 이관 |
| VP-07 (MD-01↔UT-01) | → VP-17 | 규칙 입력 승계 + `confirm`·스냅샷 순서 분기 추가 |
| VP-08 (MD-02↔UT-02) | → VP-18 | 판정 함수가 신원 함수로 바뀜 |
| VP-09 (MD-03↔UT-03) | 폐기 | 대상 필드 없음 — AC10은 MD-06으로 재지정 |

## 7-B. ΔV1 — V / Trace Matrix (유효)

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5 1·3행 — 자기 턴 종료 경로 경고 없음, 모든 도착 순서 | CHANGED | V1 R-01 |
| R-02 | R | §5 2행 — Stop·즉시 보내기 경고 없음, 모든 도착 순서 | CHANGED | V1 R-02 |
| R-03 | R | §5 4~7행 — 다른 턴 경고 끊김 없음, 같은 세션 다른 창(D-010) | CHANGED | V1 R-03 |
| AT-01~03 | AT | §7 AC14 + ST-02 | CHANGED | V1 AT-01~03 |
| SD-02 | SD | §9 TO-BE — 판정 = f(최신 스냅샷, 표시 세션 신원), 입력 도착 순서 무관 | NEW | V1 SD-01 대체 |
| ST-02 | ST | 세 채널 인터리빙 전수 재생 | NEW | — |
| AR-03 | AR | §10 main 신원 스냅샷(E0~E2) + payload | NEW | V1 AR-01 대체 |
| IT-03 | IT | main 스냅샷 열 기록 | NEW | — |
| AR-04 | AR | §10 renderer 신원(S1~S5·C1) | NEW | V1 AR-02 대체 |
| IT-04 | IT | 스토어·Composer | NEW | — |
| MD-04 | MD | §10 tracker 규칙(T1~T4) | NEW | V1 MD-01 대체 |
| MD-05 | MD | §10 신원 판정 함수(N1~N3) | NEW | V1 MD-02 대체 |
| MD-06 | MD | §10 `activeTurnRef`(A1) | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 사용자 전송 → main 턴 → tracker 스냅샷 · 채팅 이벤트 → IPC → `chatStore` → `Composer` → `Notice` | AC14 실기 + ST-02 P1~P4·P8 | not selected — ST-02가 판정을 직접 관측 | 0 — 운반 자리는 VP-14~19가 고정. AT는 페인트·실제 IPC 확인 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | Stop/즉시 보내기 → `cancel`/IPC → `interruptResponse` → … → `Notice` | AC14 실기 + ST-02 P5~P7 | not selected | 0 — 같음 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 다른 세션 턴 → 스냅샷 → `Composer` | AC14 실기 + ST-02 O1~O3 + UT-05 N2(D-010) | not selected | 0 — 같음 |
| VP-14 | SD-02 ↔ ST-02 | REQUIRED | fixture 세 열(L·C·K) → 인터리빙 → 실제 `chatStore`(`send`·`startHandoff`·`cancel`·`ingestChatEvent`·concurrency 핸들러) → `otherProjectTurnCount` | 신규 `app/src/renderer/src/features/chat/store/chatStore.concurrency.order.test.ts` — 경로별 모든 인터리빙·접두에서 판정 = oracle · fixture 연결은 IT-03의 동등 단언(SD-1) | **required** — 장치 민감도: 같은 인터리빙에 AS-IS 공식(`스냅샷 길이 − (sessionResponding?1:0) > 0`)을 적용하면 P1에서 오탐, O2에서 누락이 각각 1개 이상 나와야 한다 | SD-1~SD-2 (2) |
| VP-15 | AR-03 ↔ IT-03 | REQUIRED | `TurnCoordinator.run` → `begin(turn, projectId, activeTurnRef(turn))` → `session.updated` → `promote` → `confirm(turn, ev.sessionId)` → `finally end(turn)` → tracker 이벤트 생성 → (bootstrap) `broadcastConcurrency` | 신규 `app/src/main/app/chat-turn/concurrency-identity.test.ts` — 스냅샷 열 = fixture K · `turn-coordinator.test.ts` 갱신 케이스 | **required** — `confirm` 누락 변이(E1 제거): 새 세션 스냅샷이 `{null, draft}`에 머물러 P1 열과 달라져야 한다. 신원 대신 빈 ref를 넣는 변이(E0 ref 빈 값)도 red | E0~E2 (3) |
| VP-16 | AR-04 ↔ IT-04 | REQUIRED | `concurrencyApi.onEvent` → `concurrencyByProjectId` · 새 세션 `send`/`startHandoff` → `entry.clientKey` → 승격 → `otherProjectTurnCount` → `useOtherProjectTurnCount` → `Composer` → `<Notice>` | 신규 `app/src/renderer/src/features/chat/store/chatStore.concurrency.test.ts`(S1~S5) · 신규 `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts`(C1) | **required** — Composer가 플래그 산술로 돌아가면 red: §10 IT-04 구별 입력 | S1~S5·C1 (6) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `ActiveTurnTracker.begin/confirm/end/turns` | `app/src/main/features/sessions/active-turn-tracker.test.ts` 개정 + `supervisor.test.ts:197-198` 갱신 | not selected — 분기별 입력이 직접 oracle | T1~T4 (4) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | `ownTurnIdentity` · `isOwnTurn` · `otherProjectTurns` | 신규 `app/src/renderer/src/features/chat/lib/concurrencyNotice.test.ts` | not selected | N1~N3 (3) |
| VP-19 | MD-06 ↔ UT-06 | REQUIRED | `activeTurnRef(turn)` | 신규 `app/src/main/features/chat/active-turn-ref.test.ts` | not selected | A1 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint + typecheck | `app/**` 수정, IPC 타입 변경 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 유발한 error |
| 관련 vitest | main·renderer·shared 테스트 추가·수정 | `./node_modules/.bin/vitest run src/main/features/sessions src/main/features/chat src/main/app/chat-turn src/renderer/src/features/chat src/shared/ipc-documentation.test.ts` | 현재 변경이 유발한 red. DB 로드 스위트 bindings 실패는 환경 기준선 |
| 테스트 예산·풀 | 새 테스트 파일 | `node scripts/check-test-budgets.mjs` + vitest unit guard | 새 파일의 위반 |
| 문서 인벤토리 | `docs/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 새 수치·깨진 링크 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design (ΔV1)

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| R-01 | 경고 판정 = `projectConcurrencyCount − (inflight ? 1 : 0) > 0`. `inflight` = `useChatResponding()` = `s.inflight \|\| s.activityTransport === 'listening'` | `Composer.tsx:127,166,171` · `chatStore.ts:2248-2255` |
| R-02 | renderer `inflight`는 main terminal 수신과 `CANCEL_CHAT`에서 false, `BEGIN_TURN`·핸드오프 draft 생성에서 true. 비-delta 이벤트는 즉시 store 반영 | `chatReducer.ts:589-599,879,1131-1137,1289-1304,1404-1408` · `chatStore.ts:1632-1638` · `eventCoalescer.ts` |
| R-03 | count는 coordinator `increment`(스트림 시작 직후)·`decrement`(스트림 루프 `finally`)마다 즉시 브로드캐스트 | `turn-coordinator.ts:323,550` · `bootstrap.ts:1110-1113` |
| R-04 | 실측 순서(실제 coordinator + tracker + 버스 relay, 일회성 스크래치): `count=1` → `message.completed` → `telemetry` → `turn.ended` → `count=0`, 판정 `[F,F,T,T,F]` | 스크래치 vitest(커밋 안 함, V1 §8 R-04) |
| R-05 | 두 하네스 모두 terminal 배치가 `[…, telemetry, turn.ended]`이고 같은 coordinator를 지난다 | OpenCode `map.ts:245-277` · Claude `adapter.ts:945-965` |
| R-06 | renderer는 IPC 메시지마다 store를 갱신하고 commit한다. `Notice`에는 전환 효과가 없다 | React 19.2.8 · zustand 5.0.14 · `Notice.tsx:29-33` |
| R-07 | Stop: `cancel()`이 `CANCEL_CHAT`을 먼저 적용하고, main `interruptResponse`는 count 감소 전에 `turn.aborted`를 보낸다 | `chatStore.ts:1372-1392` · `chat-turn/index.ts:110-120` |
| R-08 | 시작 시 누락: `BEGIN_TURN`이 send 즉시 `inflight=true`를 세우고 count는 main 준비(OpenCode 서버 기동·세션 생성) 뒤 오른다 → 다른 턴 1건이 있으면 `1−1=0` | `chatStore.ts:1120` · `turn-coordinator.ts:319-323` · `channel.ts:330-385` |
| R-09 | 산술 판정 패턴은 저장소에 한 곳뿐이다 | `rg -n "\? 1 : 0\)\|- \((inflight\|busy\|responding\|listening)" src/renderer/src -g '!*.test.*'` → `Composer.tsx:171` 1건(나머지 1건은 `StatusLine.tsx:35` 숫자 포맷) |
| R-10 | 로컬 턴 플래그가 오르는 자리는 사용자 send 밖에도 있다 — 핸드오프 draft 직접 대입, main발 스트림 이벤트의 `shouldBeginTurn`(배치·단건 두 경로). 플래그 기반 설계는 이 자리를 전부 따라가야 하고 V1은 셋 다 놓쳤다 | `chatStore.ts:1632-1638` · `:540-542` · `:731-734` |
| R-11 | 계약 문서가 구조 원인을 서술한다: "Composer는 자기 inflight를 차감해 경고 표시 여부를 판정한다" | `IPC_CONTRACT.md:473` |
| R-12 | 새 세션 send 두 경로 모두 엔트리를 `draftKey`로 두고 payload `clientKey: draftKey`를 보낸다 | `chatStore.ts:1006,1032,1061-1063` · `:1617,1630,1643-1647` |
| R-13 | main 턴은 새 세션이면 `isNewSession=true`·`dbSessionId=null`·`queueKey=clientKey`, 기존 세션이면 `dbSessionId=sessionId`로 시작한다. 연속 턴은 `isNewSession=false`·`queueKey` 없음 | `turn-context.ts:170-172,207,213-243` · `admission.ts:97-110` |
| R-14 | 승격은 엔트리 객체를 그대로 `sessionId` 키로 옮긴다 — 엔트리에 둔 값은 승격 뒤에도 남는다 | `chatStore.ts:584-626`(`[sessionId]: entry`) |
| R-15 | `registry.promote`는 대기 중 새 턴만 한 번 승격하고 `dbSessionId`를 쓰지 않는다. `dbSessionId`는 history writer가 `session.updated`에서 쓴다 | `session-registry.ts:27-31` · `writer.ts:309-312` |
| R-16 | count 소비자는 Composer 하나다. 업데이트 gate는 lease를 읽는다 | `rg concurrencyByProjectId` · `bootstrap.ts:920-929` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 산술 판정 패턴 | R-09 검색 | 1 | 구조 원인이 사는 곳 — 교체 대상 |
| 새 세션 payload(`clientKey`) | `rg -n "clientKey: draftKey" src/renderer/src -g '!*.test.*'` | 2 | S2·S3 — 각 함수가 엔트리에 같은 키를 남겨야 한다 |
| 새 세션 payload(`sessionId: null`) | `rg -n "sessionId: null," src/renderer/src -g '!*.test.*'` | 4 | 1013·1617 = 위 2건 · `composerCatalogState.ts:242`(카탈로그 조회) · `chatReducer.ts:494`(초기 상태) — 누락 경로 없음 |
| `ConcurrencyEvent`·`concurrencyByProjectId` 사용처 | `rg -n "concurrencyByProjectId\|ConcurrencyEvent" src` | 17 | 타입 6(`ipc.ts`·`protocol.ts`·renderer `api/ipc.ts` 2·preload 2) + main send 2 + store 4(151·311·2214·2425) + 테스트 fixture 5 = 17 |
| tracker 호출 | `rg -n "activeTurns\.(increment\|decrement\|begin\|confirm\|end)\(" src/main -g '!*.test.ts'` | 2 | 323·550 → 변경 후 3(E0~E2) |
| `activeTurns` 참조 테스트 | `rg -l "activeTurns" src/main -g '*.test.ts'` | 8 | 단위 2(`supervisor`·`turn-coordinator`) + 통합 6 |

### 수치 / 전칭 표현 검산

- "한 곳뿐"(R-09): 검색 2건 중 1건은 숫자 포맷이라 판정 패턴은 1건.
- "새 세션 경로 2개"(R-12): `sessionId: null` 4건 = payload 2 + 비송신 2.
- 문서 앵커·기존 테스트: `IPC_CONTRACT.md:469 §2.12-b` · `runtime-ipc.md:25` · `turn-coordinator.test.ts:1337` · `post-turn.schedules.test.ts` 실핸들러 fixture · `chatStore.test.ts:1423` concurrency mock 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-02, AR-03, AR-04.
- 책임: main은 프로젝트별 **개수**만 안다. renderer는 그 개수에서 **자기 플래그**를 뺀다.
- 경로: tracker `increment/decrement` → `{projectId, count}` 브로드캐스트 → `concurrencyByProjectId[p] = count` → `count − (responding?1:0) > 0`.
- 직접 원인: 개수에는 "누구"가 없어서 자기 몫을 다른 채널의 플래그로 추정한다. 두 채널은 독립적으로 도착한다.

```text
main 개수 ──(concurrency 채널)──┐
                                ├─ 산술 → 두 입력의 상대 시점에 결과가 좌우됨
renderer 플래그 ←(chat 채널·로컬 클릭)─┘
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-02, AR-03, AR-04.
- 책임: main은 프로젝트별 **실행 중 턴의 신원 목록**을 안다. renderer는 표시 중 세션의 신원을 안다. 판정은 둘의 집합 연산이다.
- main: coordinator가 스트림 시작에 `begin(turn, projectId, activeTurnRef(turn))`, 새 세션 id 확정 시 `confirm(turn, ev.sessionId)`, 스트림 종료 `finally`에 `end(turn)`. 바뀔 때마다 tracker가 `{ projectId, turns }`를 만들어 onChange로 넘긴다.
- renderer: 새 세션 엔트리에 `clientKey = draftKey`를 남긴다(승격 뒤에도 유지). 판정 = `otherProjectTurns(최신 turns, ownTurnIdentity(활성 엔트리)) > 0`을 한 번의 store 읽기로 계산한다.
- 유지: 브로드캐스트 경로·× 에피소드·listen 비계상. 제거: `count` 필드, 판정의 `useChatResponding` 의존, V1 순서 계약.

```text
main:      {sid|null, draftKey|null}[]  ──(concurrency 채널, 통째 교체)──┐
renderer:  표시 엔트리 {sessionId, clientKey} ─────────────────────────────┤→ 신원 제외 개수 > 0
           (로컬 플래그·채팅 이벤트는 판정에 쓰지 않음)                     ┘
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 자기 몫 추정 = renderer 플래그 | 자기 몫 = 신원 일치(main 목록 × renderer 엔트리) | 서로 다른 시점의 두 값을 섞지 않음 | AR-03·AR-04 / VP-15·16 |
| data/control flow | 개수 산술 | 집합에서 신원 제외 | 도착 순서 무관 | SD-02 / VP-14 |
| state/contract | `{ projectId; count }` | `{ projectId; turns: ActiveTurnRef[] }` | 신원 없이는 자기 제외가 불가능 | AR-03 / VP-15 · `ipc.ts` |
| error/lifecycle | Stop이 플래그만 먼저 내림 | Stop은 판정에 무관 | 로컬 낙관 갱신이 입력이 아님 | SD-02 / VP-14 P5·P6 |
| test seam | 인라인 식 | 순수 함수 3개 + selector + 인터리빙 재생 | 순서 무관을 전수로 관측 | MD-05 / VP-18 · VP-14 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/ipc.ts` | `ActiveTurnRef`·`ConcurrencyEvent` 타입 | 계약 | main·preload·renderer |
| `main/features/sessions/active-turn-tracker.ts` | 토큰별 ref 보관·프로젝트 스냅샷·이벤트 생성 | `begin/confirm/end/turns` | supervisor(소유) · coordinator(포트) |
| `main/features/chat/active-turn-ref.ts`(신규) | 턴 → ref 순수 변환 | `TurnContext` → `ActiveTurnRef` | coordinator |
| `main/features/chat/turn-coordinator.ts` | E0~E2 호출 | `ActiveTurnGate` 포트 | `app/chat-turn` |
| `main/app/bootstrap.ts` | tracker 이벤트 → `broadcastConcurrency` 전달 | pass-through | 부팅 |
| renderer `features/chat/lib/concurrencyNotice.ts`(신규) | 신원 판정 순수 함수 | ref·identity → boolean/수 | store selector |
| renderer `chatStore.ts` | 스냅샷 저장·엔트리 `clientKey` 기록·selector/hook | — | Composer |
| renderer `Composer.tsx` | `useOtherProjectTurnCount(projectId) > 0` | hook | 페이지 |

## 10. 계약 / 타입 / 강제 지점

계약 타입(`src/shared/ipc.ts`):

```ts
export interface ActiveTurnRef {
  sessionId: string | null   // 확정된 세션 id. 새 세션 확정 전 null
  clientKey: string | null   // 새 세션이 태어난 renderer draft 키. 기존 세션·연속 턴은 null
}
export interface ConcurrencyEvent {
  projectId: string
  turns: ActiveTurnRef[]     // 그 프로젝트의 실행 중 턴 전부(begin 순서). 비면 []
}
```

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-03 / VP-15 | 실행 중 턴 신원 스냅샷 | `active-turn-tracker.ts` | main | **E0** `turn-coordinator.ts` 스트림 시작 직후(현 323) `begin(turn, boundProjectId, activeTurnRef(turn))` — `policy.countsAsActive`일 때만 · **E1** `session.updated` 처리의 `registry.promote` 직후(현 471) `confirm(turn, ev.sessionId)` · **E2** inner `finally`(현 550) `end(turn)` — 3자리 | `rg -n "activeTurns\.(begin\|confirm\|end\|increment\|decrement)\(" src/main -g '!*.test.ts'` → 변경 후 3건 | E0 ref 누락 → 자기 턴이 다른 작업으로 잡힘 · E1 누락 → 같은 세션 다른 창·재로드 엔트리가 새 세션 첫 턴을 남으로 봄 · E2 누락 → 항목 고착(경고 영구) · E0 정책 누락 → listen 오점화 |
| MD-04 / VP-17 | tracker 규칙 | 같음 | main | **T1** `begin` · **T2** `confirm` · **T3** `end` · **T4** `turns`(스냅샷·이벤트 생성) — 4자리 | `rg -n "^\s+(begin\|confirm\|end\|turns)\(" src/main/features/sessions/active-turn-tracker.ts` → 4건 | 아래 규칙 칸 |
| MD-06 / VP-19 | 턴 → ref | `active-turn-ref.ts` | main | **A1** `activeTurnRef` — 1자리 | `rg -n "^export function activeTurnRef" src/main/features/chat/active-turn-ref.ts` → 1건 | 아래 규칙 칸 |
| AR-04 / VP-16 | renderer 신원·스냅샷 | `chatStore.ts` | renderer | **S1** concurrency 핸들러(현 2212-2216)가 `ev.turns`를 그대로 저장 · **S2** 새 세션 `send()`가 만드는 엔트리(현 1047-1063)에 `clientKey: draftKey` · **S3** `startHandoff()` draft 엔트리(현 1632-1647)에 `clientKey: draftKey` · **S4** `promotePendingNewChat`(현 616-621) 엔트리 객체 이동 — 코드 변경 없음, 운반 자리 · **S5** `otherProjectTurnCount(state, projectId)` selector + `useOtherProjectTurnCount` hook · **C1** `Composer.tsx` 판정(현 166-171) — 6자리 | `rg -n "clientKey: draftKey\|concurrencyByProjectId\|otherProjectTurnCount\|useOtherProjectTurnCount\|\[sessionId\]: entry" src/renderer/src -g '!*.test.*'` — S2·S3은 payload 2건이 있는 함수마다 엔트리 기록 1건 | S1 변형 → 잘못된 목록 · S2/S3 누락 → 새 세션 승격 직후 자기 턴을 남으로 봄 · S4 재생성 → 같은 결함 · C1 산술 복귀 → 구조 재발 |
| MD-05 / VP-18 | 신원 판정 | `concurrencyNotice.ts` | renderer | **N1** `ownTurnIdentity` · **N2** `isOwnTurn` · **N3** `otherProjectTurns` — 3자리 | `rg -n "^export function" src/renderer/src/features/chat/lib/concurrencyNotice.ts` → 3건 | 아래 규칙 칸 |
| SD-02 / VP-14 | 순서 무관 | `app/src/shared/concurrency-order.testfixture.ts`(신규) | 테스트 | **SD-1** IT-03이 P1·P2·P5·P7 스냅샷 열 = fixture K 단언 · **SD-2** ST-02가 fixture로 인터리빙 전수 재생 — 2자리 | `rg -n "CONCURRENCY_ORDER" app/src -g '*.test.ts'` → 두 테스트 파일 | fixture가 실제 main 열과 갈라지면 재생이 거짓 green |

### 규칙 칸 ↔ UT 입력 칸

| 자리 | 규칙(분기) | UT 입력 — 각 분기로 가는 입력 |
|---|---|---|
| T1 `begin(token, projectId, ref)` | (a) projectId null/undefined → 무변화·이벤트 없음 (b) 새 토큰 → 끝에 추가·이벤트 `{p, turns}` (c) 이미 보유 → 무변화·이벤트 없음 | (a) `begin(t1, null, r1)` (b) `begin(t1,'p1',r1)`·`begin(t2,'p1',r2)` → `[r1]`·`[r1,r2]` (c) `begin(t1,'p1',r1)` 두 번 → 이벤트 1회 |
| T2 `confirm(token, sessionId)` | (a) 보유 & ref.sessionId null → sessionId 채움(clientKey 유지)·이벤트 (b) 보유 & 이미 sessionId 있음 → 무변화(같은 id·다른 id 모두) (c) 미보유 → 무변화 | (a) r=`{null,'draft:a'}` → `confirm(t,'s1')` → `{s1,'draft:a'}` (b) r=`{s1,null}` → `confirm(t,'s1')`·`confirm(t,'s2')` → 이벤트 없음 (c) `confirm(t9,'s1')` |
| T3 `end(token)` | (a) 보유 → 제거·이벤트(마지막이면 `turns: []`) (b) 미보유 → 무변화 (c) 다른 토큰·순서 보존 | (a) `begin(t1)`→`end(t1)` → 이벤트 `{p1, []}` (b) `end(t9)`·`end(t1)` 두 번째 (c) t1·t2·t3 보유 후 `end(t2)` → `[r1,r3]` |
| T4 `turns(projectId)` | null/undefined → `[]` · 미존재 → `[]` · begin 순서 · 반환값을 바꿔도 내부 불변 | `turns(null)`·`turns('px')`·`turns('p1')` 후 반환 배열 `push` → 재조회 불변 |
| A1 `activeTurnRef(turn)` | (a) 새 세션 확정 전 → `{null, queueKey}` (b) 기존 세션 → `{dbSessionId, null}`(queueKey가 sessionId여도) (c) 연속 턴(`isNewSession=false`, queueKey 없음) → `{dbSessionId, null}` (d) 새 세션인데 queueKey 없음 → `{null, null}` | (a) `{isNewSession:true, dbSessionId:null, queueKey:'draft:a'}` (b) `{false,'s1','s1'}` (c) `{false,'s1',undefined}` (d) `{true,null,undefined}` |
| N1 `ownTurnIdentity(entry)` | 엔트리 없음 → `{null,null}` · `{ sessionId: entry.session.sessionId, clientKey: entry.clientKey ?? null }` | `undefined` · draft `{null,'draft:a'}` · 승격 `{s1,'draft:a'}` · 로드 `{s1, 없음}` → `{s1,null}` |
| N2 `isOwnTurn(ref, own)` | (a) sessionId 같고 null 아님 → T (b) clientKey 같고 null 아님 → T (c) 양쪽 null끼리는 일치 아님 → F (d) 다른 id → F | (a) `{s1,null}`/`{s1,null}` (b) `{null,'draft:a'}`/`{s1,'draft:a'}`(승격 경합) (c) `{null,null}`/`{null,null}` (d) `{s1,null}`/`{s2,null}` · D-010: `{s1,'draft:a'}`/`{s1,null}` → T |
| N3 `otherProjectTurns(refs, own)` | 자기 아닌 항목 수 | `[]`→0 · `[own]`→0 · `[own, other]`→1 · `[other, other2]`→2 |
| S1~S5 | 위 §10 표 | S1: 핸들러에 `{p1, [r]}` → 저장값 `[r]`, 이어 `{p1, []}` → `[]` · S2: 새 세션 `send` → `sessions[draftKey].clientKey === payload.clientKey` · S3: `startHandoff` → 같음 · S4: `session.updated(s1)` 수신 → `sessions.s1.clientKey === draftKey` · 기존 세션 `send` → `clientKey` 미기록 · S5: `{ activeKey, sessions, concurrencyByProjectId }` 시드 → selector 값 |
| C1 Composer | `useOtherProjectTurnCount(projectId) > 0`만 쓴다 | (자기 항목만, responding false) → 없음 — **AS-IS면 표시** · (다른 항목만, responding true) → 있음 — **AS-IS면 숨김** · (자기+다른, responding true) → 있음 · (빈 목록) → 없음 |
| ST-02 경로 | P1~P8 모든 인터리빙·접두 F · O1~O3 판정 = oracle(최신 K에 `other` 태그 항목 존재) | §11 fixture 표 |

- **선언 경계**:
  - B-1 페인트: vitest는 프레임을 그리지 않는다. 판정 F가 "그려질 경고 없음"이며 깜빡임 부재는 AC14로만 본다.
  - B-2 bootstrap 전달: `bootstrap.ts:1110-1113`의 tracker onChange → `broadcastConcurrency` 전달은 변환 없는 pass-through이고 electron을 import해 vitest가 로드하지 못한다(`src/main/AGENTS.md` P29). 이벤트 생성은 tracker(T4)가 맡아 좌표가 있다. 전달 자체는 AC14가 덮는다.
  - B-3 기동 직후: renderer reload·앱 재시작 직후 스냅샷은 다음 변경 때 온다. 그 사이 경고가 안 보일 수 있다(누락, 깜빡임 아님) — 기존 push-only 동작이며 이번 변경이 바꾸지 않는다.
  - B-4 프로젝트 재바인딩: main이 `send.ts:349`에서 다른 projectId로 바인딩하면 renderer 키와 갈린다 — 기존 동작.
  - B-5 새 세션 payload에 `clientKey`가 없으면(현재 0경로, §8 전수 조사) 확정 전 신원이 맞지 않는다 — S2·S3 불변식이 막는다.
- 열린 입력 집합 판정 산출물: 해당 없음.
- 같은 규칙의 SSOT: 신원 일치 규칙은 `isOwnTurn` 한 곳. selector·Composer·ST가 모두 이를 쓴다. ref 생성 규칙은 `activeTurnRef` 한 곳.
- "다른 게이트가 막는다" 기재: 해당 없음.
- 선택적 필드: `ActiveTurnRef`의 두 필드는 `null` 허용 필수 필드다(`undefined` 금지). 엔트리 `clientKey?: string`은 새 세션 엔트리만 갖는다.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `ActiveTurnRef` 추가, `ConcurrencyEvent.count` → `turns` | typecheck |
| `app/src/main/features/sessions/active-turn-tracker.ts` | T1~T4 | `Map<object, { projectId; ref }>`. `begin/confirm/end/turns`. 변화 때만 onChange(`ConcurrencyEvent`) — 프로젝트별 begin 순서 유지 | UT-04 |
| `app/src/main/features/chat/active-turn-ref.ts`(신규) | A1 | 순수 함수(`TurnContext` 일부 필드만 Pick) | UT-06 |
| `app/src/main/features/chat/turn-coordinator.ts` | E0~E2 | `ActiveTurnGate`를 `begin/confirm/end`로. 323·471 뒤·550 | IT-03 |
| `app/src/main/app/bootstrap.ts` | 전달 | `new ActiveTurnTracker((ev) => { broadcastConcurrency(ev); this.updateStateChanged() })` | B-2 |
| `app/src/main/features/sessions/supervisor.ts` | 타입 | getter 유지 | — |
| `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`(신규) | N1~N3 | 순수 함수. 엔트리는 구조적 타입 `{ session: { sessionId }, clientKey? }`로 받아 store 순환 import를 피한다 | UT-05 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | S1~S5 | `SessionEntry.clientKey?: string` · `concurrencyByProjectId: Record<string, readonly ActiveTurnRef[]>` · S2·S3 엔트리 기록 · `otherProjectTurnCount`(export, 순수) · `useOtherProjectTurnCount` — 한 store 읽기에서 스냅샷과 활성 엔트리를 함께 본다. `useProjectConcurrencyCount` 삭제 | IT-04 |
| `app/src/renderer/src/features/chat/components/Composer.tsx` | C1 | `const otherTurns = useOtherProjectTurnCount(projectId)` · `concurrencyActive = otherTurns > 0`. `useProjectConcurrencyCount` import 제거. `inflight`(responding)의 다른 사용처는 그대로 | IT-04 |
| `app/src/shared/concurrency-order.testfixture.ts`(신규) | SD-1·SD-2 | `CONCURRENCY_ORDER` — 아래 fixture 표. 키 자리표시 `$draft`(store가 만든 draftKey로 치환)·`$sid`·`$other`(태그 `other`) | — |
| `app/src/main/app/chat-turn/concurrency-identity.test.ts`(신규) | IT-03 | 새 세션 P1: coordinator 단위(턴 `isNewSession:true, dbSessionId:null, queueKey:'draft:a'`, 스크립트 `[session.updated s1, message.completed, telemetry, turn.ended]`, 실제 tracker). 기존 세션 P2·Stop P5·즉시 보내기 P7: `post-turn.schedules.test.ts` 형태 실핸들러 fixture(`new RuntimeSupervisor({ activeTurns: new ActiveTurnTracker(로그) })`, `boundProjectId 'p1'`). 예외(이벤트 1건 뒤 throw)·시작 전 중단·재시도(이벤트 0건 retryable 실패 후 성공) → AC5. 각 열 = fixture K | E0~E2 · SD-1 |
| `app/src/renderer/src/features/chat/store/chatStore.concurrency.order.test.ts`(신규) | ST-02 | `chatStore.test.ts` 형태로 `window.api` mock(concurrency 핸들러 캡처). 경로마다 L·C·K 인터리빙을 전수 생성(각 열 내부 순서 보존 + 아래 제약) → 실제 `send`/`startHandoff`/`cancel`/`ingestChatEvent`/핸들러 실행 → 접두마다 `otherProjectTurnCount(getState(),'p1') > 0` = oracle. 음성 대조: 같은 열에 AS-IS 공식 → P1 오탐 ≥1·O2 누락 ≥1 | SD-2 |
| `app/src/renderer/src/features/chat/store/chatStore.concurrency.test.ts`(신규) | IT-04 S1~S5 | §10 입력 | S1~S5 |
| `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts`(신규) | IT-04 C1 | `Composer.activity.test.ts`처럼 `renderToStaticMarkup`. chatStore mock은 `...original`을 유지해 `useOtherProjectTurnCount`·`useChatStore`를 실물로 두고, `useChatStore.setState`로 엔트리·스냅샷을 시드. `useChatResponding`은 §10 C1 구별 값으로 덮는다 | C1 |
| `active-turn-tracker.test.ts` · `supervisor.test.ts:197-198` · `turn-coordinator.test.ts`(:255·795-796·1171-1172·1346-1347) | 갱신 | 새 API | UT-04 · 회귀 |
| `active-turn-ref.test.ts` · `concurrencyNotice.test.ts`(신규) | UT-06·UT-05 | §10 입력 | A1 · N1~N3 |
| store 테스트 fixture 5곳(`chatStore.test.ts:384,497` · `chatStore.testHarness.ts:77` · `chatStore.extraDirs.test.ts:28` · `chatStore.worktreeIsolation.test.ts:35`) | 타입 | 빈 객체 유지 — 값 타입만 바뀐다 | typecheck |
| `docs/IPC_CONTRACT.md:473` · `docs/arch/backend/runtime-ipc.md:25` | AC13 | payload 표기 교체 + "renderer는 표시 중 세션 신원과 맞는 항목을 빼고 판정한다 — 자기 턴 플래그로 산술하지 않는다" | 인벤토리 게이트 |

### ST-02 fixture (`CONCURRENCY_ORDER`)

L = renderer 로컬 동작, C = 채팅 채널(main→renderer), K = concurrency 채널 스냅샷. 공통 제약: C·K의 모든 단계는 L의 첫 동작 뒤. `turn.aborted`(Stop 경로)는 `cancel` 뒤. O 경로는 L 앞에 초기 스냅샷 `K0`를 적용한다.

| 경로 | L | C | K |
|---|---|---|---|
| P1 새 세션 정상 | `send(새)` | `session.updated($sid)` · `telemetry` · `turn.ended` | `[{null,$draft}]` · `[{$sid,$draft}]` · `[]` |
| P2 기존 정상 | `send($sid)` | `telemetry` · `turn.ended` | `[{$sid,null}]` · `[]` |
| P3 기존 error | `send($sid)` | `error` | P2와 같음 |
| P4 기존 스트림 중단 | `send($sid)` | `turn.aborted` | P2와 같음 |
| P5 기존 Stop | `send($sid)` · `cancel` | `turn.aborted` | P2와 같음 |
| P6 새 세션 승격 전 Stop | `send(새)` · `cancel` | `session.updated($sid)` · `telemetry` | P1과 같음 |
| P7 즉시 보내기 | `send($sid)` | `turn.aborted` · `chat.activity(listening)` · `telemetry` · `chat.activity(idle)` | `[{$sid,null}]` · `[]` · `[{$sid,null}]` · `[]` |
| P8 핸드오프 새 세션 | `startHandoff` | P1과 같음 | P1과 같음 |
| O1 다른 턴 + 기존 정상 | `send($sid)` | `telemetry` | K0 `[{$other}]` → `[{$other},{$sid,null}]` · `[{$other}]` · `[]` |
| O2 다른 턴 + 새 세션 시작~종료 | `send(새)` | `session.updated($sid)` · `telemetry` | K0 `[{$other}]` → `[{$other},{null,$draft}]` · `[{$other},{$sid,$draft}]` · `[{$other}]` · `[]` |
| O3 다른 턴 + Stop | `send($sid)` · `cancel` | `turn.aborted` | K0 `[{$other}]` → `[{$other},{$sid,null}]` · `[{$other}]` |

- 인터리빙 수는 경로마다 C(|C|+|K|, |K|) 이하(P7 최대 70) — 전수 실행 가능하다.
- 기대값: P 경로는 전부 F. O 경로는 접두마다 "최신 K에 `other` 태그 항목이 있다" — 신원 함수와 독립인 oracle이다.

### 테스트 가능성

- 순수 파일: `concurrencyNotice.ts`(React·store 비의존) · `active-turn-ref.ts`·`active-turn-tracker.ts`(electron 비의존).
- 기존 메커니즘 재사용: 실핸들러 fixture는 `boundProjectId`를 `null`로 넘겨 계상하지 않는다(`post-turn.schedules.test.ts:229`) — 새 파일은 `'p1'`. `chatStore.test.ts:1423`의 `concurrency: { onEvent: vi.fn() }`에서 핸들러를 꺼낸다.
- 순서 관측: 순서를 단언하지 않는다. ST-02가 모든 순서를 돌린다.

## 12. End-to-end 영향

### producer → consumer

```text
coordinator(E0~E2) → ActiveTurnTracker(T1~T4) → bootstrap → broadcastConcurrency → preload → concurrencyApi
  → chatStore.concurrencyByProjectId(S1) ─┐
send/startHandoff(S2·S3) → entry.clientKey → 승격(S4) ─┴→ otherProjectTurnCount(S5) → Composer(C1) → Notice
```

- producer 기준: `turns` = 그 순간 계상 중 턴 전부의 신원.
- consumer 파생 규칙: 다른 턴 = `turns` 중 `isOwnTurn`이 false인 항목.
- 합성값 우회: `count`가 사라져 개수 산술 경로가 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:1110-1113` onChange → `broadcastConcurrency` + `updateStateChanged` | 인자 형태만 바뀐다. gate는 lease를 읽는다(R-16) | AC14 |
| preload `concurrency.onEvent` · renderer `api/ipc.ts:225` | 타입 통과 | typecheck |
| `activeTurns` 참조 통합 테스트 6파일 | 실제 tracker를 넘기면 API 변경만 반영 | vitest gate |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `runtime.send` 직후 E0. 재시도 attempt마다 E0↔E2 왕복.
- 세션 확정: E1은 대기 중 새 턴에서 한 번만 의미가 있다(T2a). 기존 세션 `session.updated` patch는 T2b로 무시.
- 취소/중단: Stop·즉시 보내기는 coordinator 루프 종료 → E2. 판정은 그 시점과 무관하다.
- 종료/crash/renderer-gone: 예외로 루프를 나오면 E2. renderer-gone은 lease 정리 → turn abort → E2.
- cleanup: 토큰 항목은 E2에서 삭제. 프로젝트 목록이 비면 `turns: []` 이벤트를 보내고 내부 키를 지운다.
- 다중 저장소 쓰기: 판정 사본 = `plan.md`·`verify.md`·`INDEX.md`. 코드 쪽은 해당 없음.

## 14. 성능 / 상한 / 최적화

- 이벤트 크기: 프로젝트 실행 중 턴 수 × ref 2필드. 턴 수 상한은 runtime cap(`bootstrap.ts:1117` capacity)과 lease 수에 묶인다.
- 이벤트 수: 턴당 begin 1 · confirm 최대 1 · end 1 — AS-IS보다 새 세션에서 1 늘 뿐이다.
- selector 비용: 렌더마다 목록 순회(수 개). 원시값 반환이라 불필요한 재렌더가 없다.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 외부 구현자 없음. IPC 계약 문서만 갱신(AC13).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 경고 = 자기 제외·비차단·에피소드 닫기 | `Composer.tsx:167-178` · `ko.ts:1099-1100` | §5 · AC6 | 유지 — "자기"의 정의를 플래그에서 신원으로 바꿈(D-010) |
| listen 턴 비계상(0143) | `turn-coordinator.ts:320-323` | E0 · AC11 | 유지 |
| `inflight`는 라이브 경로에서 renderer 소유 | `chatReducer.ts:1242-1245` | 판정이 `inflight`를 읽지 않음 | 유지(무관해짐) |
| IPC 계약 "자기 inflight 차감" · payload `{projectId; count}` | `IPC_CONTRACT.md:473` | AC13 | 변경 — D-009 |
| `clientKey`는 영속 금지 | `ipc.ts:961-963` · `contracts/turn.ts:71-73` | renderer 엔트리 메모리·IPC 스냅샷에만 둔다 | 유지 |
| `lease-key.ts` 코덱 | `src/shared/lease-key.ts` | 접두 키를 쓰지 않고 원 키를 ref 필드에 둔다 | 유지(비사용) |
| main 레이어 DAG · renderer 4-layer | `src/main/AGENTS.md` · `src/renderer/AGENTS.md` | `features/chat` ↔ `features/sessions`는 포트 경유 · 신규 renderer 파일은 `features/chat/lib` | 유지 |
| V1 설계(순서 계약·`ownTurnOpen`) | 이 plan V1 | §7-A | 대체 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| D-010으로 같은 세션 다른 창의 경고가 사라진다 | 같은 세션은 병렬 실행이 불가능해 충돌 경고 의미가 없다. 사용자가 원하면 N2에서 창 구분을 더한다 |
| payload 변경(one-way door) | 소비자가 Composer 하나이고 내부 IPC다(R-16). 문서 동시 갱신(AC13) |
| 기동 직후 스냅샷 부재(B-3) | 기존 동작. 스냅샷 형태라 초기 조회 하나를 더하면 닫힌다(§6 후속) |

- 되돌리기 어려운 결정: IPC payload 형태 — 내부 계약이라 같은 PR에서 양쪽이 바뀐다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/shared/concurrency-order.testfixture.ts`(신규)
- `app/src/main/features/sessions/active-turn-tracker.ts`(+test) · `supervisor.test.ts`
- `app/src/main/features/chat/active-turn-ref.ts`(+test, 신규) · `turn-coordinator.ts`(+test)
- `app/src/main/app/bootstrap.ts` · `app/src/main/app/chat-turn/concurrency-identity.test.ts`(신규)
- `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`(+test, 신규)
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `chatStore.concurrency.test.ts`·`chatStore.concurrency.order.test.ts`(신규) · store 테스트 fixture 5곳
- `app/src/renderer/src/features/chat/components/Composer.tsx` · `Composer.concurrency.test.ts`(신규)
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/runtime-ipc.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 제약: 제약 환경은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`. DB 로드 스위트 bindings 실패는 기준선.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-B 운영 gate 표.
- 사람 실기: AC14(OpenCode·Claude).

## READY self-review

- 결정 보존: D-001~D-006·D-008~D-010 ACTIVE, D-007 SUPERSEDED → D-009, OPEN 0. D-010은 추론 표시(§3·§4).
- 사용자 문장: §2 원문 인용. "구조적인 문제자체를 해결" → D-008(순서 보정 금지)·D-009(산술 제거).
- Part I만으로 완료 상태 설명: §1·§5 상태표.
- AS-IS/TO-BE 같은 축: §9 Delta 5행이 §11 파일·AC에 연결. 사라진 책임: `count`·플래그 차감·V1 순서 계약 = 삭제(§9 TO-BE 유지/제거 줄).
- 실측: R-09·R-12·R-13·R-14·R-15 검색과 파일:줄, §8 전수 조사 N 6행.
- V: ΔV1 — CHANGED R 3·NEW 10 node 전부 REQUIRED pair. SUPERSEDED pair 6건의 증거 이관·폐기 근거(§7-A).
- 규칙 칸 ↔ 입력 칸: T1(3)·T2(3)·T3(3)·T4(4)·A1(4)·N1(4)·N2(4+D-010)·N3(4)·S1~S5·C1(4) 모두 입력 있음.
- 적대 증거: VP-14(AS-IS 공식 음성 대조)·VP-15(`confirm` 누락·빈 ref)·VP-16(플래그 산술 구별 입력)만 선택.
- 선언 경계 B-1~B-5 — 근거 파일:줄·전수 검색과 함께.
- INDEX 후보 표 겹침: 0행.
- 사람 실기로 미룬 순수 로직 없음.
- 산출물 문장 규칙: 표 한 칸 3줄 이내.

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

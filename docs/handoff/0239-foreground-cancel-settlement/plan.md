# Plan — 0239-foreground-cancel-settlement

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0239-foreground-cancel-settlement` |
| 작성자 | Claude Code |
| 일자 | 2026-09-23 |
| 매핑 | 사용자 검토 요청 1건 + 설계 질의 응답 3건 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 기준 코드 | `cb5d828` (브랜치 `claude/foreground-task-cancel-state-qmcm4c` 착수 시점) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 도구·포그라운드 작업이 **정상 실행 전에** 폐기·취소·거부되면 종료 통지가 오지 않거나 무시되어, transcript와 작업 패널에 실행 중 표시가 남고 턴이 끝난 뒤에도 세션이 대기(listen) 상태에 머문다.
- 완료 후 달라지는 것: 결과 없이 끝난 도구는 턴 종료나 SDK 철회 시점에 `실행되지 않음`으로 정착한다. 결과가 온 비실행 도구는 `거부됨/취소됨/중단됨`으로 실패와 구분되고, 포그라운드 작업은 턴 후 대기와 Stop을 붙잡지 않는다.
- 성공을 사용자 관점에서 한 문장으로: 실행되지 않은 도구·작업이 끝없이 도는 표시 없이 사유와 함께 정착하고, 응답이 끝나면 불필요한 대기 없이 세션이 풀린다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “포그라운드 작업이 실제 실행 전에 어떤이유로  취소/실패(추측) 됐지만 취소 상태가 ui와 턴에 반영되지 않아, 실행 중 spinner가 계속 남고, assistant 응답까지 불필요하게 대기하는 문제를 발견했다.” | 2026-09-23 사용자 요청 |
| 명시 요구 | “도구가 정상 실행이 되기 전에 취소되는 경우, 구조적으로 notification이 누락되고 있는 구간이 있는지 코드레벨 및 sdk 프로토콜에서 검토하라” | 2026-09-23 사용자 요청 |
| 명시 결정 | Q1 “SDK가 실행 전에 폐기해 결과가 오지 않는 도구 카드” → **“'실행되지 않음' 상태”** | 2026-09-23 설계 질의 응답 |
| 명시 결정 | Q2 “결과는 왔지만 실행되지 않은 도구(권한 거부·중단·취소)” → **“포함”** | 2026-09-23 설계 질의 응답 |
| 명시 결정 | Q3 “포그라운드 태스크가 종료 알림 없이 부모 호출만 끝난 경우” → **“호출 결과로 표시”** | 2026-09-23 설계 질의 응답 |
| 추론 의도 | “포그라운드 작업”은 부모 도구 호출이 결과를 기다리는 실행이다 — SDK `is_backgrounded:false`와 저장소 명세 `claude-taskxxx-spec.md §5.2`의 정의를 따른다. | `sdk.d.ts:5300`, `docs/claude-taskxxx-spec.md` §5.2 |
| 추론 의도 | 사용자가 “추측”이라 적은 원인은 단일 경로로 확정하지 않는다. 계획은 누락 구간 전부(§4 검토 결과 G1~G4)를 닫는다. | 사용자 문장의 “(추측)” |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | SDK가 결과 없이 끝낸(폐기·철회된) 도구 카드는 **`실행되지 않음`** 중립 상태로 정착한다. 카드는 남긴다. | 실패·사용자 중단과 구분되고 진단 흔적이 남는다. | 사용자 Q1 | ACTIVE | — |
| D-002 | 결과가 온 비실행 도구(SDK `non_execution_kind`)는 **실패와 구분해** 표시하며 이번 범위에 포함한다. 필드가 없으면 현행 표시로 폴백한다. | 근거 필드가 SDK `@internal`이라 부재·신규 값에 견뎌야 한다. | 사용자 Q2 | ACTIVE | — |
| D-003 | 포그라운드 태스크가 종료 알림 없이 **부모 호출만 끝나면** 작업 패널 카드는 부모 호출 결과로 표시하고 경과 시간을 멈춘다. | 태스크의 종료 증거는 합성하지 않는다 — 표시만 파생한다. | 사용자 Q3 · 0231 D-06 | ACTIVE | — |
| D-004 | 턴 terminal(`result`→`telemetry`·`error`·합성 `telemetry`) 직전에 그 턴의 **열린 도구 실행**을 정착한다. | SDK는 “exactly one result per turn, after that turn's assistant, user and stream_event messages”를 보장한다. | `sdk.d.ts:5028` · 코드 조사 | ACTIVE | — |
| D-005 | 포그라운드 태스크(`isBackgrounded===false`·live 미포함·background 관측 이력 없음)는 **턴 후 대기(`backgroundPending`)에 세지 않는다.** | level 신호는 백그라운드 전용이고, 포그라운드는 부모 호출이 기다리는 실행이다. | `sdk.d.ts:3398`·`:5300` · 코드 조사 | ACTIVE | — |
| D-006 | SDK 공개 철회 신호(`model_refusal_fallback.retracted_message_uuids`·`assistant.supersedes`)는 **아직 열린 도구**에만 적용한다. | 이미 결과가 있는 도구·텍스트의 철회(evict)는 실행 사실을 지우는 별도 설계다. | 코드 조사 | ACTIVE | — |
| D-007 | stdout 직렬화가 실측되지 않은 `@internal` 신호(`tombstone`·`set_in_progress_tool_use_ids`)는 소비하지 않는다. | 정적 분석으로 wire 형상을 확정하지 못했다 — 추측 구현 금지. 원인 무관 정착은 D-004가 맡는다. | 코드 조사 | ACTIVE | — |
| D-008 | 비실행 분류: `user-rejected`·`permission-rule`·`automode-*`(3종) → **거부됨**, `interrupted` → **중단됨**(기존), `cancelled` → **취소됨**, host `no_result`·`retracted`·미지 SDK 값 → **실행되지 않음**. | `interrupted`는 사용자 Stop의 결과라 Orca 자체 정착(“중단됨”)과 같은 이름을 쓴다. | 사용자 Q2 해석 · CLI 분석 | ACTIVE | — |
| D-009 | 표시 파생 SSOT는 shared `nonExecutionOutcome`(분류)과 renderer `toolRunOutcome`(transcript) 하나씩이다. 표면별 라벨은 `Record<…>` 전수 맵으로 강제한다. | 상태가 늘 때 누락 표면이 typecheck에서 실패하게 한다. | 설계 | ACTIVE | — |
| D-010 | 작업 패널의 **정본 반환이 없는 호출 카드**는 transcript 결과(SDK·host 정착)를 표시 입력으로 조인한다. 정본 journal에 host 합성 반환을 쓰지 않는다. | 0231 D-10(상태 lane 분리)과 D-06(종료 합성 금지)을 지킨다. | 설계 · 0231 | ACTIVE | — |
| D-011 | post-turn 로그는 판정 입력(`hasPending`)과 표시 수(`count`)를 **분리해** 기록한다. | 현재 로그 `haveTasks`는 판정과 다른 값을 적는다. | 코드 조사 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (최초 plan).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0231 D-06(종료 합성 금지)·D-10(lane 분리), 0143(백그라운드 대기 중 Stop), 0231 source-spec “`ambient` 작업도 무조건 무시하지 않음”.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-003 ↔ AC14·AC16(표시만 파생·terminalEvidence 불변) 일치, D-006 ↔ AC4(열린 것만) 일치, D-007 ↔ §6 비범위·AC 부재 일치, D-008 ↔ AC9 분류표 일치, D-010 ↔ AC15(journal 무기록) 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 증상(spinner·대기)의 원인은 한 곳이 아니라 **네 누락 구간(G1~G4)**이다. | 아래 검토 결과 표 |
| 이미 기존 코드가 충족하는가 | 부분 — 사용자 Stop·stall·throw 경로만 열린 도구를 정착한다. 정상 terminal은 정착하지 않는다. | `turn-coordinator.ts:501-515` vs `:525`·`:569` · `chat-turn/index.ts:177` |
| 더 작은 해법이 있는가 | 없음 — G1(턴 종료 정착)만 고치면 패널·대기(G2·G3)가 남고, G2만 고치면 transcript 카드가 남는다. | 각 구간의 소비자가 다르다(§8 전수 조사) |
| 선행 자료의 주장을 코드와 대조했는가 | 정정 필요 — `provider-runtime.md:90`은 합성 정착이 “실행 중 고착을 막는다”고 적지만 정본 모드에서는 no-op이다. | `settle.ts:114` · `chat-turn/index.ts:69`·`:84` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 — 태스크 종료를 합성하지 않고(0231 D-06) 표시·대기 판정만 고친다. | D-003·D-010 |

### 검토 결과 — 구조적 통지 누락 구간

| ID | 층 | 발생 경로 | 누락된 통지 | 관측 결과 |
|---|---|---|---|---|
| G1 | SDK+코드 | 스트리밍 폴백·거부 폴백 시 CLI가 이미 보낸 `tool_use`의 실행을 폐기한다. | `tool_result`가 **영영 오지 않는다**. Orca는 철회 신호도, 턴 종료 대사도 없다. | transcript 카드 spinner 영구, 재로드 후에도 유지 |
| G2 | SDK+코드 | 포그라운드 태스크의 종료 bookend가 없거나 `result` 뒤에 늦게 온다. | level 신호가 포그라운드를 담지 않는다. 정본 lane은 부모 호출 반환을 종료로 쓰지 않는다. | 작업 패널 카드 `포그라운드 · 실행 중` 영구, 경과 계속 증가 |
| G3 | 코드 | `backgroundPending`이 포그라운드 태스크(`unknown`+`running`)를 대기로 센다. | 턴 후 루프가 listen을 연다. listen은 pending 해소로 끝나지 않고, Stop은 다시 listen에 든다. | 응답 뒤 대기 애니메이션 지속(배경 작업 수 0), Stop 무력 |
| G4 | SDK+코드 | 권한 거부·중단·취소로 실행되지 않은 도구의 `tool_result`에 SDK가 사유를 싣는다. | Orca는 사유(`tool_result_meta[].non_execution_kind`)를 읽지 않는다. | 취소·거부가 빨간 `실패`로 보인다 |

- 사용자에게 올릴 결정: 없음 — Q1~Q3를 이번 턴에 확정했다(D-001~D-003).
- 코드 조사로 닫은 사실: SDK 공개 계약 5건(§8.1), CLI 2.1.267 정적 분석 7건(§8.2), Orca 소비처 전수(§8.3).

## 5. 동작 / 사용자 흐름

```text
[모델이 tool_use 방출] → 카드 "…중"(spinner)
  ├ 정상 실행 → tool_result → 완료/실패                         (현행 유지)
  ├ 실행 전 거부·취소(SDK non_execution_kind 동반 결과)        → 거부됨 / 취소됨 / 중단됨
  ├ SDK 철회 신호(refusal fallback 등)가 이 tool_use를 가리킴  → 즉시 실행되지 않음
  └ 결과 없이 그 턴의 result 도착(폐기)                        → result 직전 실행되지 않음
[포그라운드 태스크]
  ├ 종료 알림 도착 → 알림 상태(현행)
  └ 알림 없이 부모 호출만 반환 → 작업 패널: 호출 결과로 표시·경과 정지 · 턴 후 대기 없음
[턴 종료] → 대기 사유(백그라운드·예약·미확정 입력·CLI 진행)가 없으면 세션 해제
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 열린 도구 + 그 턴 `result` 도착 | terminal 방출 직전 host 정착 `no_result` | 카드 `실행되지 않음`(중립), spinner 없음, 재로드 동일 |
| 열린 도구 + `model_refusal_fallback`/`supersedes`가 그 wire 메시지를 지목 | 즉시 host 정착 `retracted` | 카드 `실행되지 않음` — 폴백 재시도 동안에도 spinner 없음 |
| 결과 도착 + `non_execution_kind` | 결과에 사유 동봉·영속 | `거부됨`/`취소됨`/`중단됨`(중립), 빨강 아님 |
| 정착 후 같은 도구의 실제 결과 도착 | 마지막 결과가 이긴다 | 실제 결과로 교체(DB upsert·라이브 페어링) |
| 포그라운드 태스크 알림 누락, 부모 호출 반환 | 정본 기록 불변, 패널 표시만 파생 | 카드가 완료 그룹으로, 호출 결과 라벨, 경과 정지, 중단 버튼 숨김 |
| 턴 종료 시 포그라운드 태스크만 미정착 | post-turn `break` | 대기 애니메이션 없음 |
| 포그라운드 태스크만 미정착 상태에서 Stop | 체인 종료(수신 유지 안 함) | 대기가 끝난다 |

### 파생 UX / 엣지케이스

- loading / empty / error: `error` terminal도 `telemetry`와 같은 정착 경로를 탄다(AC2).
- cancel / retry / close / restart: 사용자 Stop은 기존 `aborted` 정착을 유지한다. retry(재시도 전 이벤트 0)는 열린 도구가 없어 영향 없음.
- concurrency / multi-session: 병렬 tool_use는 자기 id별로 정착한다. 백그라운드 서브에이전트의 child 실행은 보존 집합이 막는다(AC3).
- keyboard / a11y / theme: 새 라벨은 기존 중단 표시와 같은 중립 톤·sr-only 규칙을 따른다. 두 테마 시각은 사람 실기다.
- 외부환경/오프라인/폐쇄망: 사내 프록시에서 잦은 스트리밍 폴백(`streaming_fallback_began`)이 G1의 대표 방아쇠다.

## 6. 범위 / 비범위

- **범위**: G1(턴 종료 정착 + 공개 철회 신호), G2(패널 표시 파생), G3(포그라운드 pending 제외 + 로그 정정), G4(비실행 사유 운반·영속·표시), 관련 문서·인벤토리.
- **비범위**: 텍스트·사고·이미 결과 있는 도구의 철회 evict(A1) · `tombstone`/`set_in_progress_tool_use_ids` 소비(D-007) · listen이 pending 해소만으로 끝나지 않는 일반 문제(A3) · `ambient` 작업의 pending 포함(0231 결정 유지) · 과거 세션의 complete 메시지에 남은 고아 도구 재로드 보정(A4).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| A1 거부 폴백의 철회 텍스트 evict | 아니오 — 표시 전용이며 데이터 형식 변경 없음 | NEXT_HANDOFF 후보 |
| A3 listen 해제 일반화(백그라운드 사용자 중지 등) | 아니오 — post-turn 판정 확장 | NEXT_HANDOFF 후보 |
| A4 과거 고아 도구 재로드 보정 | 아니오 — 로드 시점에 진행 중 턴과 구분하는 규칙이 별도 설계 | NEXT_HANDOFF 후보 |
| `nonExecution` 필드 이름·형상 | **예 — 영속 payload와 IPC 계약** | 이번에 D-002·§10 EP-01로 확정 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 턴의 `telemetry` 도착 시 결과 없는 메인 실행은 `tool.call.completed{isError:true, nonExecution:{source:'host',kind:'no_result'}}`로 정착하고, 정착 이벤트가 `telemetry`보다 먼저 버스에 방출된다. | coordinator 테스트: `started(A) → telemetry` → 버스 순서 `[started, completed(A,no_result), telemetry]`, `openToolRuns` 비움 | SDK `result` → claude-map → frame → `TurnCoordinator.run` → bus(history→relay) |
| R-01 | AT-01 / AC2 | `error`만 오는 terminal과 terminal 없는 스트림 종료(합성 `telemetry`)도 같은 정착을 terminal 전에 수행한다. | coordinator 테스트 2건: `started → error`, `started → (스트림 종료)` 각각 completed(no_result)가 terminal 앞 | 동일 + `turn-coordinator.ts:502` 합성 경로 |
| R-01 | AT-01 / AC3 | 보존 대상(백그라운드·원격 호출, `awaitingTask`, live 포함·`isBackgrounded:true` 태스크와 그 후손)은 정착하지 않는다. 부모가 열린 child는 두고, 부모가 닫혔고 보존되지 않은 child는 정착한다. 정본 상태가 없으면 child는 둔다. | settle 테스트: 5형 fixture(백그라운드 child·열린 부모 child·닫힌 부모 child·메인·정본 없음 child) 각각 방출 여부 | `settleOrphanToolRuns` ← coordinator terminal |
| R-01 | AT-01 / AC4 | `model_refusal_fallback.retracted_message_uuids` 또는 `assistant.supersedes`가 지목한 wire 메시지의 tool_use 중 **열린 것만** 즉시 `kind:'retracted'`로 정착한다. 결과가 있는 도구는 바꾸지 않는다. 내부 이벤트 `tool.call.retracted`는 버스·renderer·DB에 도달하지 않는다. | claude-map 테스트: uuid→id 매핑·supersedes·빈 목록 · coordinator 테스트: 열린 A 정착·완료된 B 불변·버스에 retracted 부재 | SDK system/assistant → claude-map → coordinator |
| R-01 | AT-01 / AC5 | 정착된 도구에 같은 `toolRunId`의 실제 결과가 뒤늦게 오면 그것이 표시·영속을 대체한다. | writer 테스트: upsert 후 payload가 실제 결과 · renderer 테스트: 같은 메시지 두 결과 → 마지막 결과 페어링 | DB `upsertToolResultPart` · `resultMap` |
| R-01 | AT-01 / AC6 | host 정착 카드는 `실행되지 않음` 라벨·중립 톤이며 running 표식(spinner·sr-only)이 없다. 재로드 후에도 같다. | ToolCard 렌더 테스트(라벨·클래스·sr-only 부재) · LOAD_SESSION 왕복 테스트 | relay → chatReducer → ToolCard / DB → reader → LOAD_SESSION |
| R-02 | AT-02 / AC7 | claude-map은 SDK `tool_result_meta[]`에서 해당 `tool_use_id`의 `non_execution_kind`(+`user_feedback`)를 `nonExecution:{source:'sdk',…}`로 싣는다. 부재·형식 오류면 싣지 않는다. | claude-map 테스트 4건: 일치 id·불일치 id·배열 아님·빈 문자열 | SDK user 메시지 → claude-map |
| R-02 | AT-02 / AC8 | `nonExecution`은 writer payload에 영속되고 reader→part→`resultMap`→`ToolCall.result`로 복원된다. 라이브와 재로드 결과가 같다. | writer 테스트(payload 필드) · parts 테스트(`resultMap` 복사) · 라이브/재로드 동치 테스트 | bus → writer → DB → reader → renderer |
| R-02 | AT-02 / AC9 | 분류 전수: 결과 없음→running, SDK 거부 5종→rejected, `interrupted`→aborted, `cancelled`→cancelled, 미지 SDK 값·host 2종→not_executed, 기존 abort 사유→aborted, 그 밖 오류→failed, 성공→completed. | 표 기반 단위 테스트 — 입력 10형 각각의 출력 | `toolRunOutcome` / `nonExecutionOutcome` |
| R-02 | AT-02 / AC10 | 9개 표시 자리(§10 EP-04)가 분류를 경유해 `거부됨/취소됨/중단됨/실행되지 않음`을 중립 톤으로 보이고 `failed`만 빨강이다. | 표면별 렌더/순수 테스트 + `Record` 전수 맵 typecheck | chatReducer → 각 컴포넌트 |
| R-03 | AT-03 / AC11 | `backgroundPending`은 포그라운드 태스크를 세지 않는다. `task_updated is_backgrounded:true`나 live 포함으로 승격되면 다시 센다. 백그라운드 `unknown`+`running`은 계속 센다. | 공유 reducer 테스트 4건(포그라운드·승격·live 포함·백그라운드 unknown) | provider lane → tracker → `hasPending` |
| R-03 | AT-03 / AC12 | 포그라운드 태스크만 미정착이고 다른 대기 사유(예약·미확정 입력·CLI 진행)가 없으면 턴 후 단계는 `break`(listen 없음, transport `idle`)이고, Stop은 체인을 끝낸다(`keepScheduledReception=false`). | `post-turn.schedules.test.ts` 하네스: 정본 이벤트 observe 후 telemetry → listen 미개시 · chatCancel → 재대기 없음 | `runTurnWithContinuations` · `chatCancel` 핸들러 |
| R-05 | AT-05 / AC13 | `chat.postturn.step` 로그의 `haveTasks`는 판정 입력(`hasPending`)과 같고 `taskCount`는 별도 필드다. | 로그 레지스트리 스파이로 필드 단언(포그라운드 unknown 1건: hasPending·count 값 각각) | `post-turn.ts:104-129` |
| R-04 | AT-04 / AC14 | 포그라운드 태스크(종료 증거 없음)의 부모 호출이 정본에서 반환되면 카드는 호출 결과 상태로 완료 그룹에 들고, 경과는 호출 반환 시각에 멈추며, 중단 버튼이 숨고, 지우기 대상이 된다. 종료 증거가 오면 그것이 이긴다. | canonicalBackground 순수 테스트 + 패널 렌더 테스트(그룹·라벨·경과·버튼·지우기) | provider lane → backgroundStore → `CanonicalBackgroundContent` |
| R-04 | AT-04 / AC15 | 정본 반환이 없는 호출 카드(Agent/Task·요청된 셸 등)는 transcript 결과가 있으면 그 결과로 표시되고 실행 중이 아니다. | 패널 렌더 테스트: 정본 call(started) + transcript host 정착 → `실행되지 않음`·완료 그룹 | chatStore messages + backgroundStore → 패널 |
| R-04 | AT-04 / AC16 | 정본 태스크 기록에 합성 `terminalEvidence`가 생기지 않는다 — `status`·`terminalEvidence`는 표시 파생 전후 동일하다. | 공유 reducer/패널 테스트: 표시 파생 후 상태 객체 불변 단언 | 표시 파생 함수 |
| R-05 | AT-05 / AC17 | 계약·아키텍처 문서가 새 동작을 서술하고 인벤토리가 재생성된다. | `node scripts/check-doc-inventory.mjs --check` 통과 · 문서 4곳 grep | `docs/IPC_CONTRACT.md` 외 3곳 |

### AC 검증 주의사항

- 기존 테스트 재사용: `turn-coordinator.test.ts`의 순서 계약 케이스(`telemetry 팬아웃은 usage→history→title→relay…`, `:554`)와 합성 telemetry 케이스(`:565`)가 실재한다 — 같은 하네스에 순서 단언을 더한다. `settle.test.ts:18`의 보존 케이스를 AC3 fixture 기준선으로 쓴다.
- 사람 실기 항목: 새 라벨 3종의 두 테마 시각(ToolCard·Work·패널) 1회. 로직은 전부 순수·통합 테스트로 내린다.
- N회/총량 기준: 없음 — AC1·AC2는 **순서와 대상 집합**을 단언한다. host 정착의 생산 호출부는 `settleOrphanToolRuns` 호출 2곳(terminal·retracted)이다.
- 0건 기준: AC4의 “버스에 retracted 부재”는 음성 단언이라 양성 짝(열린 A 정착)과 함께 둔다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V가 없다 — `Baseline V`.
- 기준 V 상속 근거: 없음. 0231의 정본 lane 계약은 상속 V가 아니라 §16의 기존 결정으로 대조한다.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5·§7 AC1~AC6 — 결과 없는 도구의 `실행되지 않음` 정착 | NEW | — |
| R-02 | R | §7 AC7~AC10 — 비실행 사유 구분 표시 | NEW | — |
| R-03 | R | §7 AC11·AC12 — 포그라운드가 대기·Stop을 붙잡지 않음 | NEW | — |
| R-04 | R | §7 AC14~AC16 — 패널 카드의 호출 결과 표시 | NEW | — |
| R-05 | R | §7 AC13·AC17 — 관측성·문서 | NEW | — |
| AT-01~AT-05 | AT | §7 검증 수단 열 | NEW | — |
| SD-01 | SD | §9 TO-BE ① — terminal 경계 정착 순서 | NEW | — |
| SD-02 | SD | §9 TO-BE ② — 철회 신호 즉시 정착 | NEW | — |
| SD-03 | SD | §9 TO-BE ③ — post-turn·Stop 판정의 포그라운드 제외 | NEW | — |
| AR-01 | AR | §10 EP-01·EP-03 — `nonExecution` 필드·`tool.call.retracted` 계약 | NEW | — |
| AR-02 | AR | §10 EP-01 ⑤~⑧ — 영속·복원 경계 | NEW | — |
| AR-03 | AR | §10 EP-05 — pending 소비 체인 | NEW | — |
| AR-04 | AR | §10 EP-06 — 패널의 정본+transcript 조인 | NEW | — |
| MD-01 | MD | §11 `shared/tool-outcome.ts` | NEW | — |
| MD-02 | MD | §11 `settle.ts` 고아 선별 | NEW | — |
| MD-03 | MD | §11 `isForegroundTask`·`backgroundPending` | NEW | — |
| MD-04 | MD | §11 `toolRunOutcome`·표면 Record | NEW | — |
| MD-05 | MD | §11 패널 표시 파생 | NEW | — |
| MD-06 | MD | §11 claude-map 추적·매핑 | NEW | — |
| ST-01~03 · IT-01~04 · UT-01~06 | ST/IT/UT | 아래 pair의 evidence 열 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | SDK `assistant(tool_use)` → claude-map → coordinator → bus → chatReducer → ToolCard | AC1~AC6 단언 | not selected — 라벨·순서 직접 관측 | EP-01(8)·EP-02(3)·EP-03(4) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | SDK `user(tool_result, tool_result_meta)` → claude-map → writer/relay → renderer 9자리 | AC7~AC10 단언 | required — 형제 라벨 맞바꿈(rejected↔cancelled) 1종, 자리: EP-04 ①·⑥·⑧ | EP-01(8)·EP-04(9) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | provider `task_started(is_backgrounded:false)` → tracker → post-turn step / chatCancel | AC11·AC12 단언 | required — 제외 술어 제거 변이, 자리: EP-05 ① | EP-05(4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | provider lane + chat messages → backgroundStore/패널 파생 → 카드 | AC14~AC16 단언 | required — 호출 반환 규칙 제거 변이, 자리: EP-06 ①·②·⑤ | EP-06(6) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | post-turn 로그 · 문서 생성기 | AC13·AC17 | not selected — 값·생성기 직접 관측 | EP-08(4)·EP-09(1) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | frame terminal → coordinator 정착 → bus(history finalize 전) → relay | 버스 순서 로그 `[…completed, terminal]` · history part가 같은 메시지 | required — 정착을 `emit(terminal)` 뒤로 이동 / error 경로 삭제 / 합성 경로 삭제 3변이, 자리: EP-02 ①②③ | EP-02(3) |
| VP-07 | SD-02 ↔ ST-02 | REQUIRED | SDK `model_refusal_fallback`/`supersedes` → claude-map `tool.call.retracted` → coordinator | 열린 A 정착·완료 B 불변·relay 부재 | required — 완료된 id에도 적용하는 변이, 자리: EP-03 ④ | EP-03(4) |
| VP-08 | SD-03 ↔ ST-03 | REQUIRED | canonical 상태 → `hasPending` → `decidePostTurnStep`·`keepScheduledReception` | 하네스의 transport·push·chain 관측 | not selected — VP-03 변이가 같은 자리를 잠근다 | EP-05(4) |
| VP-09 | AR-01 ↔ IT-01 | REQUIRED | 생산자(claude-map·settle) → `NormalizedEvent` → 소비자(coordinator·writer·reducer) | 타입 + 필드 왕복 테스트 | not selected — typecheck·왕복 직접 관측 | EP-01(8)·EP-03(4) |
| VP-10 | AR-02 ↔ IT-02 | REQUIRED | bus → writer payload → DB → reader → LOAD_SESSION → ToolCall | 라이브·재로드 동치 | required — writer에서 필드 누락 변이, 자리: EP-01 ⑤ | EP-01 ⑤~⑧(4) |
| VP-11 | AR-03 ↔ IT-03 | REQUIRED | `backgroundPending` → tracker `hasPending` → 2 소비자 | 소비자별 값 관측 | not selected — VP-03과 같은 변이 | EP-05(4) |
| VP-12 | AR-04 ↔ IT-04 | REQUIRED | chatStore messages → `transcriptResultsByToolUseId` → 패널·지우기 | AC15 렌더·지우기 관측 | required — 조인 입력 제거 변이, 자리: EP-06 ④·⑤ | EP-06(6) |
| VP-13 | MD-01 ↔ UT-01 | REQUIRED | `readToolResultMeta` → `nonExecutionOutcome` | 표 기반 입력 10형 | required — `interrupted`↔`cancelled` 맞바꿈 변이 | 0 — 순수 모듈 |
| VP-14 | MD-02 ↔ UT-02 | REQUIRED | `openToolRuns` + 정본 상태 → 정착 대상 집합 | AC3 fixture 5형 | required — 보존 검사 제거 / 부모 규칙 반전 2변이 | 0 — 순수 선별 |
| VP-15 | MD-03 ↔ UT-03 | REQUIRED | `BackgroundSessionState` → `backgroundPending` | AC11 4형 | required — 포그라운드 제외 ↔ 전 `unknown` 제외 맞바꿈(형제 자리) | 0 — 순수 술어 |
| VP-16 | MD-04 ↔ UT-04 | REQUIRED | `ToolCall.result` → `toolRunOutcome` → 표면 Record | 분류표 + Record 전수(typecheck) | required — Record 키 삭제 시 typecheck red 확인 | 0 — 순수 분류 |
| VP-17 | MD-05 ↔ UT-05 | REQUIRED | 정본 task/call + transcript 결과 → `BackgroundDisplay` | AC14·AC15·AC16 순수 단언 | required — 경과 종점을 `firstSeenAt`로 맞바꾸는 변이 | 0 — 순수 파생 |
| VP-18 | MD-06 ↔ UT-06 | REQUIRED | SDK assistant/system → `toolRunIdsByMessageUuid` → `tool.call.retracted` | 매핑·상한·빈 목록 | not selected — 출력 이벤트 직접 관측 | 0 — 순수 매핑 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree 정적 | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` (lint는 `--fix`라 트리 변화 확인) | 이번 변경이 유발한 error만 blocking |
| 관련 테스트 | main·shared·renderer 순수·통합 | `./node_modules/.bin/vitest run <§19 스위트>` — `pretest` 우회 | DB 로드 스위트의 ABI 실패는 환경 기인으로 분리 |
| 문서 인벤토리 | NormalizedEvent variant가 늘어난다 | `cd app && node scripts/check-doc-inventory.mjs` 재생성 후 `--check` | 불일치는 blocking |
| message-bus | plan·INDEX·커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건은 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 8.1 SDK 공개 계약 (`@anthropic-ai/claude-agent-sdk@0.3.267` `sdk.d.ts`, 1차 근거)

| 발견 / 제약 | 근거 |
|---|---|
| `result`는 턴당 1회, 그 턴의 assistant·user·stream_event **뒤**에 온다. 단 task 알림은 result 뒤에 올 수 있다. | `sdk.d.ts:5028` |
| `background_tasks_changed`는 “live background task” 전량이고 멤버십 변화에 “a foreground agent being backgrounded”가 있다 — 포그라운드는 전환 전 멤버가 아니다. “a missed bookend cannot wedge a stale running indicator”라 bookend 유실을 전제한다. | `sdk.d.ts:3398` |
| `task_started.is_backgrounded:false` = “registered … in the foreground with the spawning tool call blocking on it”. 전환은 `task_updated patch.is_backgrounded`로 온다. | `sdk.d.ts:5300` |
| `model_refusal_fallback.retracted_message_uuids`: 거부된 부분 응답의 wire uuid(블록별)와 tombstone된 tool_result — “remove these messages from transcript state on receipt”. | `sdk.d.ts:4806` |
| `assistant.supersedes`: 이 프레임이 대체하는 기존 wire uuid(“tombstoned tool_result frames” 포함 가능). `assistant.aborted`: 중단으로 잘린 프레임. | `sdk.d.ts:3343`·`:3347` |
| `result.terminal_reason`에 `tool_deferred`·`aborted_streaming`·`aborted_tools` 등이 있고 `deferred_tool_use`로 지연 도구가 온다. | `sdk.d.ts:8645`·`:5074` |

### 8.2 CLI 2.1.267 런타임 (정적 분석, 보조 근거)

| 발견 | 오프셋(linux-x64 `claude`) |
|---|---|
| 스트리밍 도구 실행기가 `discard` 되면 `getCompletedResults`·`getRemainingResults`가 **즉시 반환**한다 — 폐기된 도구의 결과(합성 오류 포함)가 방출되지 않는다. | `188071300` · `188071945` |
| `discardAndAbortInFlight`는 실행 중 도구를 abort하고 대기 도구(`queuedNeverStarted`)는 시작하지 않는다. | `188065829` |
| `streaming_fallback_began`에서 이미 방출한 assistant(`tool_use` 포함)·tool_result를 internal `tombstone`하고 실행기를 폐기한다. | `188231042` |
| task 이벤트 큐 상한 1000, 가득 차면 bookend도 축출(`bookend_evicted`)된다. | `181232531` · `181233993` |
| 태스크 레지스트리 `update`는 종료 전이 때 `task_updated`+`task_notification`을 내지만 `remove`는 아무것도 내지 않는다. | `185870523` · `185870783` · `185871452` |
| 포그라운드 Agent: `Ikn`이 등록(`task_started`)한 뒤 `if(ha)await ka(Zde(…))`가 `try/finally`(종료 `ki`) **앞**에 있다 — 여기서 거부되면 종료 알림이 없다. | `185898903` · `187391907` · `187397084` |
| 비실행 사유 enum 7종과 wrapper `tool_result_meta[{id,non_execution_kind,user_feedback?}]`(“absent means the tool ran to completion”). | `181357317` · `181406647` |

재현(보조 근거 확인용):

```bash
npm pack @anthropic-ai/claude-agent-sdk@0.3.267 @anthropic-ai/claude-agent-sdk-linux-x64@0.3.267
tar xzf anthropic-ai-claude-agent-sdk-linux-x64-0.3.267.tgz
python3 -c "d=open('package/claude','rb').read();print(d.find(b'*getCompletedResults(){if(this.discarded)return;'))"
```

`tombstone`·`set_in_progress_tool_use_ids`는 `@internal` 스키마(`uuid`·`session_id` 동반)가 있으나 stdout 직렬화 지점을 정적 분석으로 찾지 못했다 — D-007.

### 8.3 Orca 코드

| 발견 / 제약 | 근거 |
|---|---|
| claude-map은 그 밖 system 메시지를 전부 버린다 — `model_refusal_fallback` 포함. | `app/src/main/adapters/claude-map.ts:767-769` |
| tool_result 매핑은 `isError`만 싣고 `tool_result_meta`를 읽지 않는다. | `claude-map.ts:583-595` |
| coordinator는 열린 도구를 기록하지만 정상 terminal·합성 telemetry에서 정착하지 않는다. stall·throw 경로만 정착한다. | `turn-coordinator.ts:475-493` · `:501-515` · `:525` · `:569` |
| 연속 턴은 `openToolRuns`를 새 Map으로 시작한다 — 이전 턴의 고아는 이후 턴의 정착 대상에서 빠진다. | `app/src/main/app/chat-turn/turn-context.ts:43` |
| Stop 핸들러는 열린 도구를 `aborted`로 정착하고, 수신 유지 여부를 `hasPending`으로 판정한다. | `chat-turn/index.ts:165-177` |
| 재로드 보정은 미완료(`incomplete`) 메시지에만 적용된다 — telemetry로 complete가 된 메시지의 고아는 남는다. | `renderer/.../chatReducer.ts:1336` · `lib/parts.ts:97-110` · writer `finalizeTurn` |
| `backgroundPending`은 `unknown && running` 태스크를 센다 — 포그라운드는 level 멤버가 아니라서, 시작 뒤에 snapshot이 오지 않는 한 `unknown`이다. | `app/src/shared/background-task.ts:557-584`(`:579`) |
| `started` 뒤 `excluded`를 `unknown`으로 되돌린다 — snapshot 뒤 시작한 포그라운드도 `unknown`이다. | `background-task.ts:497-503` |
| 부모 호출 반환(`background.call` returned)은 태스크를 연결만 하고 종료로 쓰지 않는다. | `background-task.ts:404-483` |
| 정본 모드에서 합성 정착 3경로는 no-op이다. legacy 트래커 `started/settled`도 정본이 있으면 반환한다. | `settle.ts:114` · `chat-turn/index.ts:69`·`:84` · `background-tasks.ts:84`·`:98` |
| listen 프레임은 terminal·busy send 밸브·취소·채널 사망으로만 끝난다 — pending 해소는 종료 조건이 아니다. | `session-runtime.ts:709-716` · `post-turn.ts:176` |
| post-turn 로그 `haveTasks`는 `count>0`, 판정은 `hasPending`이다 — `count`는 live 집합(포그라운드 제외) 기준. | `post-turn.ts:106`·`:111`·`:124` · `background-tasks.ts:193-202` |
| 패널: 호출 카드 기본값 `running`, 포그라운드 라벨, 태스크 라벨 `running`. | `CanonicalBackgroundContent.tsx:38-46`·`:184` · `backgroundPresentation.ts:12` |
| 대기 라벨: listening + 사실 0개면 `waiting`, 30초 뒤 `finishingSlow`. | `renderer/.../lib/activityLabel.ts:75-89`(`:87-88`) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| SDK 철회·비실행·종료사유 신호 소비 | `rg -n "supersedes\|retracted_message_uuids\|model_refusal_fallback\|non_execution_kind\|terminal_reason\|deferred_tool_use\|set_in_progress_tool_use_ids" app/src` | 0 | 전부 미소비 |
| `tool_result_meta` 참조 | `rg -n "tool_result_meta" app/src` | 1 | `claude-background.ts:338-339` 원본 보존만(해석 없음) |
| `settleOpenToolRuns` 호출처 | `rg -n "settleOpenToolRuns\(" app/src/main` (정의·테스트 제외) | 4 | shutdown `bootstrap.ts:832` · Stop `index.ts:177` · stall `:525` · throw `:569` |
| `tool.call.completed` 생산자(main, mock 제외) | `rg -n "type: 'tool.call.completed'" app/src/main` | 4파일 | claude-map · settle · subagent-settlement · writer(Ask 합성) |
| `hasPending` 소비자 | `rg -n "\.hasPending\(" app/src/main` (정의 제외) | 2 | `post-turn.ts:111` · `index.ts:168` |
| 도구 상태 표시 자리(renderer) | `rg -n "isAbortedResult\(\|deriveSubagentTaskStatus\(\|Record<SubagentTaskStatus\|callStatus\(\|backgroundTaskStatus\(" app/src/renderer/src` | 9 | §10 EP-04 |
| 패널 종료 판정 자리 | `rg -n "isBackgroundTerminal\(\|isCompletedBackgroundCall\(\|canStopBackgroundTask\(" app/src/renderer/src` | 6 | §10 EP-06 (ForegroundShellActions는 `canPromote`가 `returned`를 이미 막아 제외) |

### 수치 / 전칭 표현 검산

- 재측정 수치: NormalizedEvent variant 29 → 이번 변경 후 30(`tool.call.retracted` 1 추가) — `docs/generated/inventory.md` 재생성으로만 반영한다.
- “결과가 **영영** 오지 않는다”(G1)의 반례: `terminal_reason:'tool_deferred'`의 지연 도구는 이후 재개될 수 있다 → AC5(last-wins)로 흡수한다.
- “포그라운드는 level에 없다”의 반례: 전환 후에는 멤버다 → `isForegroundTask`가 live 포함·`backgroundObserved`를 제외한다.
- 문서 앵커: `docs/claude-taskxxx-spec.md` §5.2 · §4.5 실재, `provider-runtime.md:90` 합성 정착 서술 실재, `rendering.md:13` 패널 그룹 서술 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`~`SD-03`, `AR-01`~`AR-04`.
- 현재 책임 소유자: 열린 도구 = `TurnCoordinator`(`turn.openToolRuns`), 태스크 상태 = 정본 `BackgroundTaskTracker`, 턴 후 대기 = `runTurnWithContinuations`.
- 현재 entry → flow → store → consumer: SDK 메시지 → `ClaudeBackgroundMapper`(정본 lane) ∥ `claudeToNormalized`(transcript lane) → frame → coordinator → bus → writer·relay → chatReducer.
- 현재 오류/취소/정리 경로: Stop·stall·throw만 `settleOpenToolRuns`, 정상 terminal은 정착 없음.
- 문제의 직접 원인: SDK가 결과·종료를 보내지 않는 경로(폐기·bookend 유실)를 terminal 경계에서 대사하지 않고, 정본 pending이 포그라운드를 대기로 센다.

```text
SDK tool_use ──► claude-map ──► coordinator(openToolRuns.set) ──► 카드 spinner
(폐기: tool_result 없음) … SDK result ──► telemetry ──► history finalize(complete=1)
                                                     └► openToolRuns 잔존 → 연속 턴에서 폐기
provider task_started(fg) ──► 정본(unknown,running) ──► backgroundPending=true
                                                     ──► post-turn listen / Stop 재대기
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`~`SD-03`, `AR-01`~`AR-04`.
- 변경 후 책임 소유자: 동일 — coordinator가 terminal 대사를, shared가 pending·분류 규칙을, renderer가 표시 파생을 소유한다.
- ① terminal 대사: 프레임에서 `telemetry`/`error`(또는 합성 telemetry)를 처리할 때 **방출 직전** `settleOrphanToolRuns(…,'no_result')`.
- ② 철회: claude-map이 wire uuid→tool_use id를 기억하고, 철회 신호에서 main 내부 `tool.call.retracted`를 낸다. coordinator는 열린 id만 `retracted`로 정착하고 이벤트를 흡수한다.
- ③ 대기: `backgroundPending`이 `isForegroundTask`를 제외 → post-turn·Stop 판정이 자동으로 맞춰진다.
- ④ 표시: 결과 payload 옆에 `nonExecution`을 운반·영속하고, renderer는 `toolRunOutcome`·`BackgroundDisplay`로만 상태를 파생한다.
- 유지하는 기존 메커니즘: Stop·stall·throw `settleOpenToolRuns`, `settleSubagentTask`, 정본 reducer의 “첫 종료 증거 우선”, 0231 host 이벤트(control·connection) 외 journal 무기록.

```text
SDK tool_use ──► claude-map(uuid→ids 기억) ──► coordinator(openToolRuns.set)
SDK retraction ──► claude-map ─(tool.call.retracted, 내부)─► coordinator: 열린 id만 정착(retracted)
SDK result ──► telemetry ──► coordinator: settleOrphanToolRuns(no_result) → emit(terminal)
provider task_started(fg) ──► 정본(unknown,running) ──► backgroundPending: isForegroundTask 제외 → break
renderer: ToolCall.result(nonExecution) ──► toolRunOutcome ──► 표면 Record 라벨
          정본 task/call + transcript 결과 ──► BackgroundDisplay ──► 그룹·라벨·경과·버튼·지우기
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 열린 도구 정착은 Stop·stall·throw 한정 | terminal·철회도 coordinator가 정착 | G1 | SD-01·SD-02 / VP-06·07 · `turn-coordinator.ts` |
| data/control flow | 철회 신호 버림 | `tool.call.retracted`(내부) 경유 | G1 | AR-01 / VP-09 · `claude-map.ts` |
| state/contract | `tool.call.completed`에 사유 없음 | `nonExecution?` 운반·영속 | G4·D-001 | AR-01·AR-02 / VP-09·10 · `ipc.ts`·`writer.ts` |
| error/lifecycle | 정본 pending이 포그라운드를 셈 | 포그라운드 제외, 승격 시 복귀 | G3 | SD-03·AR-03 / VP-08·11 · `background-task.ts` |
| test seam/관측점 | 표시가 표면마다 인라인 판정 | `toolRunOutcome`·`BackgroundDisplay` 순수 파생 | G2·G4 | MD-04·MD-05 / VP-16·17 |

AS-IS에서 사라지는 책임: 없음. `callStatus`(패널 인라인)는 `backgroundCallDisplay`로 **이동**한다.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/tool-outcome.ts` (신규) | 비실행 사유 파싱·분류 | SDK meta·`NonExecution` → 분류 | claude-map · settle · renderer parts · 패널 |
| `adapters/claude-map.ts` | 사유 운반·철회 매핑 | SDK 메시지 → `NormalizedEvent` | claude 어댑터 |
| `features/chat/settle.ts` | 고아 선별·host 정착 이벤트 생성 | `openToolRuns`·정본 상태 → 이벤트 | coordinator |
| `features/chat/turn-coordinator.ts` | terminal·철회 시점 호출 | 프레임 이벤트 → bus | chat-turn |
| `shared/background-task.ts` | 포그라운드 판정·pending | 정본 상태 → boolean | tracker · renderer 패널 |
| `renderer/.../lib/parts.ts` | `toolRunOutcome` SSOT | `ToolCall.result` → 분류 | 도구 표시 표면 |
| `renderer/.../lib/canonicalBackground.ts` | `BackgroundDisplay` 파생 | 정본 + transcript 결과 → 표시 | 패널 · backgroundStore |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-09·10 | **EP-01** `nonExecution?: NonExecution` 운반 8자리 | `shared/tool-outcome.ts` 타입 | ① claude-map tool_result(`claude-map.ts:583-595`) ② settle host 정착 ③ `ipc.ts:621` 이벤트 타입 ④ `ipc.ts:1454` part 타입 ⑤ writer payload(`writer.ts:430-445`) ⑥ reducer append(`chatReducer.ts:976-990`) ⑦ `ToolCall.result`(`chatReducer.ts:76-86`) ⑧ `resultMap`(`parts.ts:208-221`) | 매핑·영속·로드·페어링 | 한 자리라도 빠지면 라이브/재로드 표시가 갈린다 |
| SD-01 / VP-06 | **EP-02** terminal 직전 정착 3자리 | coordinator | ① SDK `telemetry` 방출 전(`turn-coordinator.ts:413` 직전) ② `error` 방출 전(같은 자리) ③ 합성 `telemetry` 전(`:502-507`) | 프레임 terminal | 뒤로 밀리면 history가 정착 전 finalize하고 renderer가 reset 후 결과를 받는다 |
| SD-02 / VP-07 | **EP-03** 철회 4자리 | claude-map + coordinator | ① assistant uuid 기록(`claude-map.ts:429-537`) ② `model_refusal_fallback` 분기(`:767` 앞 신설) ③ `assistant.supersedes`(assistant 분기 선두) ④ coordinator 흡수(`turn-coordinator.ts:325` 뒤) | SDK 메시지 수신 | 열린 id 외 적용 시 실행된 도구의 결과를 덮는다 |
| R-02 / VP-02·16 | **EP-04** 분류 소비 9자리 | `toolRunOutcome`·`nonExecutionOutcome` | ① ToolCard(`ToolCard.tsx:110-141`) ② AgentTaskRow(`:17-22`·`:51`) ③ SubAgentTileContent(`:59-64`) ④ taskBoard `TaskBoardStatus`·`backgroundBoardStatus`(`taskBoard.ts:34-35`·`:229-239`) ⑤ TaskStatusIcon(`:4`·`:37-41`) ⑥ `workToolPresentation.status`(`:14`·`:57-60`) ⑦ WorkToolTimeline(`:23`·`:49-62`) ⑧ 패널 호출 라벨(`CanonicalBackgroundContent.tsx:38-46`·`:317`) ⑨ 패널 태스크 라벨(`:226`) | 렌더 | 인라인 판정이 남으면 한 표면만 `실패`로 보인다 |
| SD-03 / VP-03·08·11 | **EP-05** 포그라운드 pending 제외 4자리 | `isForegroundTask`(shared) | ① `backgroundPending`(`background-task.ts:557-584`) ② `tracker.hasPending`(`background-tasks.ts:61-64`) ③ post-turn step(`post-turn.ts:111`) ④ Stop 유지(`index.ts:165-170`) | 턴 후 판정·Stop | ①만 바꾸고 ②~④가 다른 술어를 쓰면 대기·Stop이 갈린다 |
| AR-04 / VP-04·12·17 | **EP-06** 패널 `settled` 판정 6자리 | `BackgroundDisplay` | ① 그룹(`CanonicalBackgroundContent.tsx:95`·`:98`) ② 카드 terminal·경과(`:165-170`) ③ 중단 버튼(`:166` · `backgroundPresentation.ts:22-33`) ④ 라벨(`:226`·`:317`) ⑤ 지우기(`backgroundStore.ts:63`·`:68`) ⑥ dismiss 가드(`canonicalBackground.ts:32`) | 렌더·지우기 클릭 | 그룹은 완료인데 지우기·버튼이 실행 중으로 보는 불일치 |
| R-05 | **EP-07** i18n 5키군 × ko·en | `resources/{ko,en}.ts` | toolMeta 3 · agentStatus 3 · subagentTile.status 3 · taskTile.status 3 · background 3 | 렌더 | 키 누락 시 원문 키 노출 |
| R-05 / VP-05 | **EP-08** 문서 4자리 | 각 정본 문서 | `IPC_CONTRACT.md`(2행) · `provider-runtime.md:90` · `background-tasks.md` · `inventory.md` 재생성 | CI `--check` | 인벤토리 불일치는 CI red |
| R-05 / VP-05 | **EP-09** 로그 필드 1자리 | `post-turn.ts:118-129` | `haveTasks`=판정 값, `taskCount` 별도 | 매 반복 | 로그가 판정을 반증하지 못한다 |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 분류는 `shared/tool-outcome.ts` 하나 — main(settle은 host kind 생성만)과 renderer(parts·패널)가 import한다. 포그라운드 판정은 `shared/background-task.ts`의 `isForegroundTask` 하나 — pending과 패널 표시가 함께 쓴다.
- `실패 의미`에 “다른 게이트가 막는다”를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음 — EP-04의 typecheck 강제는 `Record<…>` 전수 맵에만 성립하고, 인라인 삼항은 VP-02 변이로 잠근다.
- 선택적 필드의 `true/false/undefined` 의미: `nonExecution` 부재 = 도구가 끝까지 실행됨(SDK 문구) 또는 사유 미상 — 현행 표시. `isBackgrounded` `undefined`(태스크 종류상 미설정)는 포그라운드가 **아니다** — pending에 남는다.
- 외부 SDK 경계의 실제 요구 타입/의미: `tool_result_meta`는 공개 타입에 없는 `@internal` wrapper다 — 배열·`id` 문자열·`non_execution_kind` 문자열이 모두 맞을 때만 읽는다. 미지 값은 `not_executed`로 분류한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/tool-outcome.ts` (신규) | 분류 SSOT | `NonExecution = {source:'sdk';kind:string;userFeedback?:string} \| {source:'host';kind:'no_result'\|'retracted'}` · `readToolResultMeta(meta, toolUseId)` · `nonExecutionOutcome(v): 'rejected'\|'aborted'\|'cancelled'\|'not_executed'`(D-008) | 순수 단위 (UT-01) |
| `app/src/shared/ipc.ts` | 계약 | `tool.call.completed`·part `tool_result`에 `nonExecution?` · 신규 variant `{type:'tool.call.retracted';sessionId;toolRunIds:string[]}`(main 내부 전용 주석) | typecheck |
| `app/src/main/adapters/claude-map.ts` | 매핑 | `MapContext.toolRunIdsByMessageUuid`(상한 2048, `receivedInputUuids`와 같은 축출) · assistant `supersedes` → retracted 선방출 · `model_refusal_fallback` → retracted · tool_result에 `nonExecution` | 순수 단위 (UT-06, AC7) |
| `app/src/main/features/chat/settle.ts` | 선별·정착 | 보존 집합 계산을 내부 순수 함수로 추출(기존 `settleOpenToolRuns` 동작 불변) · `settleOrphanToolRuns(turn, emit, cause, background?, only?)`: `no_result`=보존 제외 ∩ (부모 없음 ∪ 부모 닫힘), 정본 없음이면 부모 있는 실행 보존 · `retracted`=`only ∩ open` · 결과 `{reason:'not_executed',message:'실행되지 않았습니다'}` | 순수 단위 (UT-02) |
| `app/src/main/features/chat/turn-coordinator.ts` | 시점 | `tool.call.retracted` 흡수(`input.echo` 뒤, `continue`) · `telemetry`/`error` 방출 직전·합성 telemetry 직전 `settleOrphanToolRuns(…,'no_result', getState)` | fake runtime 통합 (ST-01·02) |
| `app/src/shared/background-task.ts` | pending | `isForegroundTask(task)` export · `backgroundPending` 태스크 절에 `!isForegroundTask(task)` | 순수 단위 (UT-03) |
| `app/src/main/app/chat-turn/post-turn.ts` | 관측 | `hasPending`을 1회 계산해 판정·로그에 같은 값 사용 | 로그 스파이 (AC13) |
| `app/src/main/features/history/writer.ts` | 영속 | `upsertToolResultPart` payload에 `nonExecution` | 통합 (IT-02) |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 라이브 | `ToolCall.result.nonExecution?` · `tool.call.completed` append 복사 | reducer 단위 |
| `app/src/renderer/src/features/chat/lib/parts.ts` | 분류 | `resultMap` 복사 · `ToolRunOutcome`·`toolRunOutcome` · `SubagentTaskStatus = ToolRunOutcome` · `deriveSubagentTaskStatus` 위임 | 순수 단위 (UT-04) |
| `ToolCard.tsx` · `AgentTaskRow.tsx` · `SubAgentTileContent.tsx` · `taskBoard.ts` · `TaskStatusIcon.tsx` · `workToolPresentation.ts` · `WorkToolTimeline.tsx` | 표시 | EP-04 9자리를 `toolRunOutcome` 경유 + `Record<ToolRunOutcome,…>` 전수 맵. 새 3상태는 중단과 같은 중립 톤·`stop` 아이콘, 라벨로 구분 | 렌더/순수 |
| `app/src/renderer/src/features/chat/lib/canonicalBackground.ts` | 패널 파생 | `transcriptResultsByToolUseId(messages)` · `backgroundCallDisplay(call, transcriptResult?)` · `backgroundTaskDisplay(state, task)` → `{status, settled, endedAt?}` · dismiss 가드가 `settled`를 본다 | 순수 단위 (UT-05) |
| `CanonicalBackgroundContent.tsx` · `backgroundStore.ts` · `backgroundPresentation.ts` | 패널 소비 | EP-06 6자리를 `BackgroundDisplay`로 교체 · `dismissCompletedBackgroundItems`에 transcript 결과 인자 | 렌더 (IT-04) |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | EP-07 15키 × 2 | typecheck(키 타입) |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `shared/tool-outcome.ts`(신규), `settle.ts`(이미 순수 주입), `canonicalBackground.ts`(이미 순수) — electron import 없음.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `settleOpenToolRuns`의 보존 규칙은 “중단 시 백그라운드 후손 보존”과 같은 형상이라 재사용한다. 시점은 terminal **방출 전**이어야 하므로 기존 catch 경로(방출 후 forward)와 다른 자리에 둔다.
- 순서를 관측할 훅: coordinator 테스트의 버스 구독 배열(`turn-coordinator.test.ts` 하네스)로 `[completed, telemetry]` 순서를 단언한다.

## 12. End-to-end 영향

### producer → consumer

```text
SDK tool_result(+meta) ─► claude-map(nonExecution) ─► coordinator ─► bus ─► writer(DB) ∥ relay ─► chatReducer ─► toolRunOutcome ─► 표면
SDK result ─► telemetry ─► coordinator: settleOrphanToolRuns ─► (위와 같은 경로) ─► emit(telemetry)
provider task_* ─► 정본 reducer ─► backgroundPending(isForegroundTask 제외) ─► post-turn / Stop
provider call + chat messages ─► BackgroundDisplay ─► 패널·지우기
```

- producer 기준: SDK가 보낸 사유(`source:'sdk'`)와 Orca가 만든 사유(`source:'host'`)를 구분해 싣는다.
- consumer 파생 규칙: 표면은 `nonExecution`을 직접 해석하지 않고 `toolRunOutcome`만 부른다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 패널은 정본 태스크의 `status`를 바꾸지 않는다(AC16). transcript 결과는 **정본 반환이 없는 호출**에만 조인한다(D-010).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `SessionActivityProjector`(`count`) | `count`는 live 집합 기준이라 불변 | AC13 |
| `settleOpenToolRuns` 보존 규칙 | 추출 리팩터링 — Stop·stall·throw 동작 불변 | AC3(기존 `settle.test.ts:18` 통과 유지) |
| 재로드 `settleOrphanToolParts` | 불변 — 새 host 결과가 DB에 있어 incomplete 보정 대상이 줄 뿐 | AC6 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `tool.call.started`에서 `openToolRuns` 기록(현행), claude-map이 uuid→id 기억(신규).
- 취소/중단: 사용자 Stop은 현행 `aborted` 정착 — 이후 도착한 CLI `interrupted` 결과는 draining으로 transcript에 오지 않는다. 정본 lane에서는 D-008로 같은 `중단됨`이다.
- 종료/quit/crash/renderer-gone: shutdown 정착(`bootstrap.ts:832`) 불변.
- retry/timeout/partial failure: retry는 이벤트 0에서만 돌므로 열린 도구가 없다. stall은 현행 `aborted`.
- cleanup/rollback: `openToolRuns`는 정착 시 삭제되어 terminal 두 번(`telemetry` 뒤 `error`)에도 1회만 방출한다.
- **다중 저장소 쓰기**: host 정착은 버스 1회 방출 → writer(DB)·relay 두 곳에 도달한다(기존 스트리밍 이벤트와 같은 팬아웃·같은 실패 의미). 문서 산출물의 사본은 `plan.md`와 `INDEX.md` 두 곳이며 둘 다 이번 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: host 정착 이벤트 수 ≤ 턴의 열린 도구 수(SDK 동시 도구 상한 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 기본 10 × 턴 내 배치 수). 결과 payload는 고정 문구 1개다.
- 새 요청 수: 0 — SDK 제어 요청을 추가하지 않는다.
- `toolRunIdsByMessageUuid`: tool_use를 담은 assistant 메시지만 기록, 상한 2048(초과 시 가장 오래된 항목 축출).
- 캐시/호출 축소로 잃는 부수 효과: 없음.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 외부 구현자가 구현하는 port/schema가 없다. `NormalizedEvent`는 앱 내부 계약이며 `IPC_CONTRACT.md`에 서술한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| “ACK·timeout·snapshot 제외로 종료를 합성하지 않음” | 0231 D-06 | §3 D-003 · AC16 | 유지 — 태스크 기록 불변, 표시만 파생 |
| “상태 이벤트는 pump 독점, transcript는 기존 버스” | 0231 D-10 | §3 D-010 · AC15 | 유지 — journal 무기록, renderer 조인 |
| “hasPending은 live/미확인 런치/승인/stop/재동기화 보류를 포함” | 0231 plan:301 | §3 D-005 · AC11 | 유지 — 포그라운드는 다섯 중 무엇도 아니므로 제외가 원 의도와 일치 |
| “`ambient` 작업도 무조건 무시하지 않음” | 0231 source-spec:568 | §6 비범위 | 유지 |
| 백그라운드 대기 중 Stop은 태스크를 보존하며 수신을 잇는다 | 0143 · `index.ts:158-172` | AC12 | 유지 — 포그라운드만 남은 경우에만 수신을 잇지 않는다 |
| “foreground/background는 턴이 기다리는가다” | `claude-taskxxx-spec.md` §5.2 | D-005 | 유지 — 근거로 사용 |
| 합성 정착이 “실행 중 고착을 막는다” | `provider-runtime.md:90` | §10 EP-08 | **변경(문서 정정)** — 정본 모드 no-op 사실과 신규 규칙으로 고친다 |
| 재로드 고아 보정은 incomplete 한정 | `parts.ts:88-96` 주석 | §6 A4 | 유지 |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md` | §11 | 유지 — 스키마 변경 없음(payload_json 필드 추가만) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `tool_result_meta`는 `@internal` — 형상·값이 예고 없이 바뀔 수 있다 | 검증 후 읽기·미지 값 `not_executed`·부재 시 현행(D-002) |
| 지연 도구(`tool_deferred`)가 host 정착 후 재개되면 라이브 표시는 이전 메시지에 정착으로 남을 수 있다 | DB upsert는 전역 last-wins라 재로드에서 교정된다(AC5). Orca 자체는 defer 훅을 쓰지 않는다 |
| 폴백 재시도 중 스트리밍 폴백은 공개 철회 신호가 없어 정착이 재시도 `result`까지 늦다 | D-007 — 원인 무관 terminal 정착으로 영구 고착만 제거한다 |
| `interrupted`를 `중단됨`에 합치면 사용자 Stop과 CLI 중단이 구분되지 않는다 | 의도된 결정(D-008) — 두 lane 라벨 일치가 우선 |
| ExitPlanMode 수정 요청이 `거부됨`으로 보인다 | 현행(빨간 `계획 제안함`)보다 의미가 가깝다 — 사람 실기에서 확인 |

- 되돌리기 어려운 결정: `nonExecution` 필드 이름·형상(영속 payload) — D-002·EP-01로 확정.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{tool-outcome.ts(신규),ipc.ts,background-task.ts}`
- `app/src/main/adapters/claude-map.ts`
- `app/src/main/features/chat/{settle.ts,turn-coordinator.ts}` · `app/src/main/features/history/writer.ts` · `app/src/main/app/chat-turn/post-turn.ts`
- `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,lib/parts.ts,lib/workToolPresentation.ts,lib/taskBoard.ts,lib/canonicalBackground.ts,lib/backgroundPresentation.ts,store/backgroundStore.ts}`
- `app/src/renderer/src/features/chat/components/{transcript/ToolCard.tsx,transcript/AgentTaskRow.tsx,transcript/WorkToolTimeline.tsx,rightpanel/SubAgentTileContent.tsx,rightpanel/TaskStatusIcon.tsx,rightpanel/CanonicalBackgroundContent.tsx}`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md` · `docs/arch/backend/background-tasks.md` · `docs/arch/frontend/rendering.md`(`:13` 패널 그룹 서술) · `docs/generated/inventory.md`(재생성)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드, `app/src/main/AGENTS.md` 레이어 규칙(shared 신규 파일은 런타임 의존 0), `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: node_modules 미설치 환경이면 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. DB 로드 스위트 실패는 환경 기인으로 분리 보고.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/shared/tool-outcome.test.ts src/shared/background-task.test.ts src/main/adapters/claude-map.test.ts src/main/features/chat/settle.test.ts src/main/features/chat/turn-coordinator.test.ts src/main/app/chat-turn/post-turn.schedules.test.ts src/main/features/history src/renderer/src/features/chat`.
- 문서: `cd app && node scripts/check-doc-inventory.mjs && node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: 새 라벨 3종(거부됨·취소됨·실행되지 않음)의 두 테마 시각 — Code ToolCard·Work 타임라인·작업 패널 1회.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 사용자 결정 3건(D-001~D-003)과 설계 결정 8건.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §1·§5 상태 전이표.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — 사용자 원문 §2 인용, “(추측)”을 단일 원인으로 확정하지 않음.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — 상태 전이 7행 ↔ AC1~AC16 ↔ §11.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE에 명시했다 — `callStatus` 이동.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사·검산.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없어 Baseline V를 썼다.
- [x] 변경 효과에 필요한 레벨(R·SD·AR·MD)을 선택했고 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — VP-01~VP-18.
- [x] 영향받은 INHERITED node 없음(Baseline).
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거가 필요한 pair만 선택 이유·변이를 갖는다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 시각 1회만.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — 순서·대상 집합·라벨을 직접 단언.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — EP-01~EP-09.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표.
- [x] producer/consumer 양쪽 의미를 확인했다 — `source:'sdk'|'host'`.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14·§17.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고, `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

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

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

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
| **관측한 게이트 산출**(exit code 아님) | … |
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

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

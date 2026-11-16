# Plan — 0323-cross-harness-session-hooks-panel

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **이 문서는 DRAFT다.** §3의 `OPEN` 결정 세 건이 닫히기 전에는 §7 이후(AC·V·§10·구현 설계)를 확정하지 않는다 — 어느 쪽을 고르느냐에 따라 계약의 위치와 IPC 표면이 달라진다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0323-cross-harness-session-hooks-panel` |
| 작성자 | Claude Code |
| 일자 | 2026-11-16 |
| 매핑 | 없음 |
| 상태 | **DRAFT** (OPEN 결정 D-008 대기 · D-014 범위 분할 판정 대기) |
| V mode | `Baseline V` (OPEN 결정 뒤 확정) |
| 기준 V | `none` |
| 이번 V revision | `V1` — 미작성 |
| 유효 V | 미확정 |
| 입력 자료 | [`mods-hook-mechanism.md`](../../etc/study/claude/mods-hook-mechanism.md) — 조사 대상 SDK 0.3.325 / CLI 2.1.325 |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 세션에서 일어난 일을 우측 패널에 반영하는 길이 기능마다 따로 뚫려 있고, 그 길의 시작점인 훅은 Claude 하네스에만 있다.
- 완료 후 달라지는 것: 하네스와 무관한 세션 훅 계약이 생기고, 우측 패널은 "정적 패널"을 기본으로 "훅으로 갱신되는 동적 패널"이 그 위에 선다.
- 성공을 사용자 관점에서 한 문장으로: 같은 종류의 세션 패널이 Claude 세션과 OpenCode 세션에서 같은 계기로 같은 내용을 갱신하고, 세션 밖 패널은 지금처럼 동작한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Orcinis orca의 범용 세션에서 제공해야 할 훅과 각 세션에서 훅에서 등록한 이벤트에 맞춰 우측패널 상태를 업데이트 해야 한다면 어떤 정보를 범용으로 제공해야 할지를 고민하라. 레퍼런스는 claude agent sdk에서 제공하고 있는 메커니즘이다." | 라이브 세션 2026-11-16 턴 1 |
| 명시 요구 | "교차 하네스 훅 정규화 필요함" | 턴 4-1 |
| 명시 요구 | "우선은 내부로만 열되, 추후 외부나 내부 api 통해서 등록(e.g., 큭정 버전에서 훅 시딩 지원 등)을 고려한다." | 턴 4-2 |
| 명시 요구 | "우측 패널을 확장 가능하게 한다. 단 우측 패널은 세션 바깥에서도 사용을 하고 있다(E.g., 플러그인 라우팅 등). 이러한 시나리오들을 고려함다면 static 한 정보를 출력하는 우측 패널을 기본으로 하여 동적 업데이트(with hook)를 파생/확장 하거나 기본 우측 패널 클래스를 두고 정적/동적 업데이트를 각각 파생/확정하거나 하는 방법으로 발전시켜야 한다." | 턴 4-3 |
| 명시 요구 | "세션에서 열리는 패널, 세션 밖에서 열리는 패널에 따라 다를 것으로 생각된다. 세션 밖에서의 패널들은 이번 보고의 시나리오와 다르다." | 턴 4-4 |
| 명시 요구 | "이번 핸드오프에서는 올리지 않는다." (SDK 버전) | 턴 4-5 |
| 명시 요구 | "커밋 시 조사 타겟이 된 sdk 버전은 기록하되 package.json은 그대로 유지하라." | 턴 2 |
| 추론 의도 | 턴 4-4 는 내가 물은 "내부 훅을 정규 계약으로 옮기는가"에 대한 답 자리에 왔지만 내용은 패널 구분이다. 내부 훅 이전 여부는 답을 받지 못한 것으로 본다 → D-010 | 턴 3 질문 4 ↔ 턴 4-4 |
| 추론 의도 | 턴 4-3 은 두 구조("정적을 기본으로 동적을 파생" / "기본 클래스에서 정적·동적을 각각 파생")를 대안으로 제시했고 하나를 지정하지 않았다 → 설계자가 고른다(D-007) | 턴 4-3 의 "하거나 … 하거나" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 세션 훅을 하네스 간에 정규화한다 | "교차 하네스 훅 정규화 필요함" | 턴 4-1 | ACTIVE | `adapters.md` §3.2.5 "범용 정규화 야망 폐기"를 대체 — 문서 정정은 이 handoff 범위 |
| D-002 | 훅 등록은 이번에 내부(Orcinus orca 자체 코드)로만 연다 | "우선은 내부로만 열되" | 턴 4-2 | ACTIVE | — |
| D-003 | 계약은 나중의 외부·내부 API 등록(예: 특정 버전의 훅 시딩)을 막지 않는 형태여야 한다. 그 등록 수단 자체는 만들지 않는다 | "추후 … 등록 … 을 고려한다" | 턴 4-2 | ACTIVE | — |
| D-004 | 우측 패널을 확장 가능하게 한다 | "우측 패널을 확장 가능하게 한다" | 턴 4-3 | ACTIVE | — |
| D-005 | 패널 구조는 세션 밖 사용을 포함해 성립해야 한다. 정적 정보 패널이 바탕이고 훅 기반 동적 갱신은 그 위의 파생이다 | "우측 패널은 세션 바깥에서도 사용을 하고 있다(E.g., 플러그인 라우팅 등)" | 턴 4-3 | ACTIVE | — |
| D-006 | 세션 밖 패널에는 이번 훅 갱신 시나리오를 적용하지 않는다 | "세션 밖에서의 패널들은 이번 보고의 시나리오와 다르다" | 턴 4-4 | ACTIVE | — |
| D-007 | 패널 클래스 구조는 "공통 기본 + 정적 파생 + 동적 파생"으로 한다(설계자 선택) | 턴 4-3 의 두 대안 중 하나. 세션 밖 패널이 동적 파생의 상태를 떠안지 않고, 세션 패널이 정적 파생의 열림/닫힘 규칙을 상속하지 않는다 | 턴 4-3 + 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-008 | 훅 등록·발화와 패널 상태 계산을 **어느 프로세스**에 두는가 | 유효한 두 설계 — §4-A | 설계자 질의 | **OPEN** | — |
| D-009 | 이번 handoff 가 실제로 옮기는 **첫 동적 패널**은 무엇인가 | 소비자 없는 계약은 검증할 동작이 없다 — §4-B | 설계자 질의 | SUPERSEDED | D-012 |
| D-010 | Claude 어댑터 내부 훅(`make…Hook`)을 정규 계약으로 옮기는가 | 턴 3 질문 4 가 답을 받지 못했다 — §4-C | 설계자 질의 | SUPERSEDED | D-013 |
| D-012 | 세션 패널은 **전부** 새 계약으로 옮긴다 | "모든 패널이 새로운 계약에 맞춰 이주해야 한다" | 턴 6-2 | ACTIVE | D-009 대체. 설계자 권고(변경사항 타일만)는 기각됐다 |
| D-013 | Claude 어댑터 내부 훅을 **전부** 정규 계약으로 옮긴다. 어댑터에 종속된 기능은 훅 이름에 어댑터 이름을 접두사로 붙이는 형태를 검토한다 | "전부 옮긴다. 이 과정에서 adapter 종속적인 기능이 있다면 훅 정의시 adapter 이름으로 prefix로 하는 형태로 전개해도 좋을 거 같다. 검토하라" | 턴 6-3 | ACTIVE | D-010 대체. 접두사 검토 결과는 §4-C |
| D-014 | 범위를 한 handoff 로 둘지 가를지 | D-012·D-013 으로 범위가 커졌다 — §17 | 설계자 | **OPEN** (D-008 뒤 설계자가 판정) | — |
| D-015 | 이 handoff 보다 renderer 갱신 방식(main·renderer 역할, 워커)을 먼저 고친다. 이 plan 은 그 작업의 규칙을 입력으로 받는다 | "패널확장보다 renderer 업데이트 방법을 우선 고쳐야겠다는 결론이다" | 턴 8 | ACTIVE | D-008 은 [역할 제안](../../etc/study/main-renderer-roles/vscode-comparison-and-proposal.md) §6 의 조건을 받는다 — 여전히 OPEN |
| D-011 | SDK 버전은 이 handoff 에서 올리지 않는다. 고정 버전에 없는 SDK 훅에 기대는 설계를 하지 않는다 | "이번 핸드오프에서는 올리지 않는다" | 턴 4-5 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (최초 작성).
- 턴 8 추가: D-015. 이 plan 은 보류다 — 역할·워커 작업의 순서가 정해지면 다시 연다.
- 변경된 결정: D-009 → D-012, D-010 → D-013 (사용자 답 턴 6). D-008 은 사용자가 "다시 그리기는 main, 코드(렌더러)업데이트는 워커 … 이 방식에 애해 평가를 우선 하라"고 해 평가(§4-D)를 먼저 낸다 — 아직 OPEN.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음(최초).
- **`ACTIVE 결정 ↔ AC` 대조**: AC 미작성(DRAFT) — OPEN 결정 뒤 채운다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 훅→패널 경로가 기능마다 따로다 — `makeOutputFilesHook` → `output.captured`, `makeTurnEndHook` → `turn.ended`, `makePlanFileHook` → plan cell (`adapters/claude/adapter.ts` 의 `mergeHooks(…)` 호출) |
| 이미 기존 코드가 충족하는가 | 일부 | 관찰 쪽은 두 하네스가 이미 같은 `NormalizedEvent` 를 낸다(`adapters/claude/map.ts`, `adapters/opencode/v1/map.ts`). 정규 **훅 등록** 계약은 비어 있다(`features/extensions/common/builder.ts` 의 `hooks: { normalized: {} }`) |
| 더 작은 해법이 있는가 | 있음 — §4-A 의 안 B | 관찰은 renderer 가 이미 받는 이벤트 스트림 위에 등록 계층만 얹어도 하네스 중립이 된다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 | 조사 문서 §5 의 L1·L2·L5·L6 를 이번 턴에 `adapt.ts`·`builder.ts`·`adapters/opencode` 에서 다시 확인 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 1건 — 사용자가 대체를 지시 | `docs/arch/backend/adapters.md` §3.2.5 ↔ D-001 |

### 4-A. D-008 — 훅과 패널 상태를 어디에 두는가

| | 안 A — main | 안 B — renderer |
|---|---|---|
| 훅 등록·발화 | main 의 턴 구동부에 세 번째 sink 로 둔다(지금은 persist·forward 둘 — `features/chat/turn-sinks.ts`) | renderer 가 받는 `NormalizedEvent` 스트림 위에 등록 계층을 둔다 |
| 패널 상태 | main 이 계산해 새 이벤트(교체 의미 + `rev`)로 보낸다 | renderer 가 훅 핸들러에서 패널 상태 조각을 쓴다 |
| IPC 표면 | **늘어난다** — `NormalizedEvent` 에 멤버 추가, `IPC_CONTRACT.md` 갱신, 재로드 시 복원 규칙 필요 | 그대로 |
| 게이트(막는 훅) | 같은 자리에서 다룬다 | 다룰 수 없다 — 게이트는 어차피 main 에 따로 둔다 |
| D-003(나중의 훅 시딩) | 등록 지점이 main 한 곳 | 시딩된 훅이 화면이 없는 세션에서도 돌아야 한다면 다시 main 으로 옮겨야 한다 |
| 화면이 닫힌 세션 | 계산이 계속된다 | renderer 스토어가 비활성 세션도 누적하므로 계산은 된다(`state.md` §1.1) |
| 되돌리기 | 어렵다(이벤트 스키마) | 쉽다 |
| 레퍼런스와의 대응 | mods 엔진과 같다 — 엔진이 상태를 갖고 화면은 "낡았다"만 듣는다 | 화면 쪽 구독 모델 |

설계자 권고: **안 A.** D-003 의 훅 시딩과 게이트가 모두 main 에 있어야 하고, 관찰과 게이트를 한 등록 계약으로 묶을 수 있다. 비용은 IPC 표면 1건과 재로드 복원 규칙이다.

### 4-B. D-009 — 첫 동적 패널

이미 "훅이 계기인 패널 갱신"이 Claude 에 세 개 있다. 후보는 이 중에서 고른다 — 새 화면을 발명하지 않는다.

| 후보 | 지금의 계기 | OpenCode 쪽 대응 | 옮기면 사용자가 보는 차이 |
|---|---|---|---|
| 변경사항(diff) 타일 갱신 | Claude `Stop` 훅 → `turn.ended` | OpenCode 도 `turn.ended` 를 낸다(`adapters/opencode/v1/map.ts`) | 없음(동작 보존) — 가장 안전. renderer 쪽 갱신 소비 경로는 READY 때 고정한다 |
| 계획(plan) 타일 | Claude `PostToolUse(Write\|Edit)` 훅 → plan cell | 미확인 | 미확인 |
| 산출물 카드·뷰어 | Claude `PostToolUse` 훅 → `output.captured` | 미확인 | 미확인 |

설계자 권고: **변경사항 타일 하나만.** 두 하네스에 계기가 이미 있어 "같은 계기 → 같은 갱신"을 테스트로 닫을 수 있다.

### 4-C. D-010 — 내부 훅 이전

- 관측: 내부 훅 여섯은 SDK 원본 payload 를 읽어 `NormalizedEvent` 를 **만드는 쪽**이다(예: `makeTurnEndHook` 이 `Stop` 입력에서 세션 예약을 읽는다). 정규 훅은 `NormalizedEvent` **위**에 선다.
- 설계자 권고: **옮기지 않는다.** 내부 훅은 Claude 어댑터의 생산자로 남기고, 정규 훅 계약은 그 산출을 소비한다. `makeWorkspaceGuardHook`(Claude `PreToolUse` 게이트)은 OpenCode 에 대응 지점이 없어 하네스 전용으로 남긴다.

### 4-D. D-008 재검토 — "그리기는 main, 계산은 워커"

사용자 원문: "다시 그리기는 main, 코드(렌더러)업데이트는 워커(현재 ui 워커가 있는지 모르겠음). … 안드로이드 앱은 이러한 형태로 기억하는데, 퍼포먼스적으로 일반적인 방법인지?"

| 질문 | 판정 | 근거 |
|---|---|---|
| 일반적인 방법인가 | 그렇다 — "화면을 그리는 스레드에서 무거운 일을 하지 않는다"는 UI 플랫폼 공통 원칙이다 | Android 의 UI 스레드 + 백그라운드 스레드와 같은 모양 |
| Electron 에서 용어가 어떻게 대응하는가 | Android 의 "main(UI) 스레드" = Electron **renderer 프로세스의 메인 스레드**. Electron 의 **main 프로세스**는 화면을 그리지 않는다 | Electron 프로세스 모델 |
| Orcinus orca 에 UI 워커가 있는가 | **없다** | `rg 'new Worker\(\|new SharedWorker\(\|utilityProcess\|worker_threads' app/src` (테스트 제외) → 주석 1건(`app/handlers/files.ts`)뿐 |
| 이미 "화면 밖 계산" 자리가 있는가 | 있다 — **main 프로세스**가 renderer 와 다른 프로세스라 그 역할을 한다 | 사용량 파생을 main 이 하고 renderer 는 사본만 든다(`state.md` §1.1 사용량 미러) |
| 훅 발화·패널 상태 계산에 워커가 필요한가 | 필요하지 않다 — 계산이 가볍다(사건 하나에 조각 하나 교체). 워커를 새로 두면 직렬화 왕복과 수명 관리가 더 든다 | 조사 문서 §3.2 — 레퍼런스도 엔진이 상태를 갖고 화면은 "낡았다"만 듣는다 |

사용자 방식을 Electron 에 옮기면 **안 A 와 같은 배치**가 된다: 계산은 화면 밖(main 프로세스), 그리기는 renderer 메인 스레드. 새 Web Worker 는 두지 않는다. 설계자 권고는 그대로 안 A 다.

### 4-C 보충. D-013 — 어댑터 접두사 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 접두사 방식이 성립하는가 | 성립한다 — 레퍼런스가 같은 방식을 쓴다 | mods 는 설정 훅 이벤트를 `classic.<Event>` 로 노출한다(조사 문서 §2.1) |
| 어떤 훅이 접두사 대상인가 | 두 하네스가 모두 낼 수 없는 것 | 작업공간 가드(Claude `PreToolUse`) · 계획 파일 · 산출물 · compact 후 요약 — OpenCode 대응 여부는 READY 전에 훅마다 확인한다 |
| 정규 어휘 원칙과 충돌하는가 | 충돌하지 않는다 — 접두사 없는 이름은 "두 하네스가 모두 낸다", 접두사 있는 이름은 "그 하네스만 낸다"로 갈린다 | §10 |
| 접두사 훅의 봉투 | 공통 봉투는 같고, 하네스 원본은 `raw` 로만 준다 | 조사 문서 §6.3 |

- 사용자에게 올릴 결정: D-008 (평가 §4-D 확인).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

> DRAFT — D-008·D-009 뒤 확정. 아래는 두 안에 공통인 뼈대다.

```text
[세션에서 사건 발생 — 턴 종료·도구 완료·권한 요청 …]
  → [하네스 어댑터가 정규 이벤트로 낸다 — 지금과 같다]
  → [정규 세션 훅이 발화: 공통 봉투 + 사건별 필드]
  → [등록된 관찰 핸들러가 패널 상태 조각을 교체한다]
  → [그 조각을 읽는 동적 패널만 다시 그린다]
  ↘ [핸들러 실패: 그 핸들러만 건너뛰고 턴은 계속된다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 세션 패널이 열린 채 사건 발생 | 조각 교체 → 해당 패널 갱신 | 패널 내용이 바뀐다 |
| 세션 패널이 닫힌 채 사건 발생 | 조각만 교체 | 패널을 열면 최신 내용이다. 사용자가 닫은 패널이 저절로 열리지 않는다 |
| 다른 세션으로 전환 | 조각은 세션별로 따로 | 돌아오면 그 세션의 마지막 내용 |
| 세션 재로드 | (D-008 에 따라 확정) | 끝난 작업이 실행 중으로 보이지 않는다 |
| 세션 밖 패널(플러그인 상세·예약 작업·아티팩트 화면) | 훅과 무관 | 지금과 같다(D-006) |

### 파생 UX / 엣지케이스

- loading / empty / error: 조각이 아직 없으면 패널은 지금의 빈 상태를 쓴다.
- cancel / retry / close / restart: 턴 중단도 사건이다 — 중단된 턴의 조각이 "진행 중"으로 남지 않아야 한다.
- concurrency / multi-session: 조각의 키는 `sessionId` + 패널 종류. 늦게 도착한 갱신은 `rev` 로 버린다.
- keyboard / a11y / theme: 패널 껍데기(크기 조절·펼치기·닫기·Esc)는 기본 계층이 갖고 지금 동작을 보존한다.

## 6. 범위 / 비범위

- **범위**: 정규 세션 훅 계약(공통 봉투·이벤트 어휘·관찰/게이트 구분·실패 정책) · 내부 등록 지점 · 패널 기본/정적/동적 구조 · D-009 가 정한 첫 동적 패널의 이전 · `adapters.md` §3.2.5 정정.
- **비범위**: 외부·API 훅 등록 수단(D-003 은 형태만 막지 않는다) · 세션 밖 패널의 동적 갱신(D-006) · 제3자 패널 기여와 선언적 요소 트리 · SDK 버전 올림(D-011) · D-009 가 고르지 않은 패널의 이전.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 외부 훅 등록 수단 | 아니오 — 등록 계약에 출처 필드를 두면 된다 | 후속 |
| 나머지 패널 이전 | 아니오 | 후속 handoff |
| 이벤트 이름·봉투 필드 | **예 — 이름·스키마** | 이번에 고정(§10) |
| 패널 조각 이벤트(안 A) | **예 — IPC 계약** | D-008 에서 사용자 결정 |
| 제3자 패널 기여 | 아니오 — 조각 계약이 닫힌 타일 id 를 요구하지 않게 두면 된다 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

> DRAFT — OPEN 결정 뒤 작성. 예정 요구만 적는다(번호는 확정 시 다시 매긴다).

| 예정 R | 내용 | 걸린 결정 |
|---|---|---|
| R-a | 같은 사건에서 Claude 세션과 OpenCode 세션의 정규 훅이 같은 이벤트 이름·같은 봉투 필드로 발화한다 | D-001 |
| R-b | 메인 대화와 하위 에이전트의 사건을 봉투만으로 구분할 수 있다 | D-001 |
| R-c | 관찰 핸들러가 던져도 턴 결과와 다른 핸들러의 실행이 바뀌지 않는다 | D-001 |
| R-d | 게이트 핸들러의 실패 시 열림/닫힘이 등록 때 정해지고 그대로 적용된다 | D-001 · D-008 |
| R-e | 등록 지점이 내부 한 곳이고, 등록 항목이 출처를 갖는다 | D-002 · D-003 |
| R-f | 첫 동적 패널이 두 하네스에서 같은 계기로 갱신된다 | D-009 |
| R-g | 사용자가 닫은 패널이 사건으로 다시 열리지 않는다 | D-004 |
| R-h | 세션 밖 패널 세 곳의 열기·크기 조절·펼치기·닫기·Esc 가 변경 전과 같다 | D-005 · D-006 |
| R-i | 세션 재로드 뒤 패널이 끝난 작업을 진행 중으로 보이지 않는다 | D-008 |

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음.
- Node·Pair registry: **미작성(DRAFT).** OPEN 결정 뒤 `R↔AT`·`SD↔ST`·`AR↔IT`·`MD↔UT` 네 레벨을 모두 쓴다 — 제품 결과·수명주기·경계·모듈 불변식이 전부 바뀐다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 정규 훅 타입은 있고 Claude 로만 어댑트된다 | `app/src/main/adapters/common/hooks.ts` · `adapters/claude/adapt.ts` 의 `adaptHooks`·`NORMALIZED_TO_CLAUDE_EVENT` |
| 프로덕션은 정규 핸들러를 하나도 등록하지 않는다 | `features/extensions/common/builder.ts` — `hooks: { normalized: {} }` |
| 실제로 도는 훅은 어댑터 내부 훅 여섯이다 | `adapters/claude/adapter.ts` — `withPostCompactHook(mergeHooks(adaptHooks, makePlanFileHook, makeOutputFilesHook, makeInputReceiptHook, makeTurnEndHook, makeWorkspaceGuardHook))` |
| 정규 훅 래퍼는 핸들러를 try 없이 순차 실행하고 SDK 의 `timeout`·`onFailure` 를 넘기지 않는다 | `adapt.ts` 의 `makeClaudeHookCallback` · `adaptHooks` |
| 턴 구동부는 이벤트를 persist·forward 두 sink 로 보낸다 | `features/chat/turn-sinks.ts` · `features/chat/turn-coordinator.ts` |
| OpenCode 는 훅 수단이 없고 원본 이벤트를 정규 이벤트로 바꾼다 | `adapters/opencode/v1/map.ts` — `message.part.delta`·`message.part.updated`·`message.updated`·`session.compacted`·`session.error` |
| OpenCode 에서 Orcinus orca 로 들어오는 "막을 수 있는" 지점은 권한 요청뿐이다 | `adapters/opencode/v1/approval.ts` 의 `permission.asked` · `question.asked` |
| 세션 패널은 하네스별 모듈이 공통 `TilePanel` 을 쓴다 | `renderer/src/features/chat/harnesses/registries/rightpanel.ts` · `harnesses/common/rightpanel/TilePanel.tsx` |
| 타일 등록 형태는 `{ id, defaultLabelKey, Content, HeaderActions?, HeaderContent? }` 이고 `Content` 는 props 를 받지 않는다 | `harnesses/contracts.ts` 의 `RightPanelTileRegistration` |
| 타일 id 는 닫힌 목록이다 | `features/chat/lib/rightPanelTiles.ts` 의 `rightPanelTileDefinitions` |
| 세션 밖 패널은 `DetailSidePane` 또는 `ResizableSidePane` 을 직접 쓴다 | 아래 전수 조사 |
| 교차 하네스 훅 정규화는 폐기된 것으로 문서에 적혀 있다 | `docs/arch/backend/adapters.md` §3.2.5 |
| 외부 SDK | 조사 문서 §4 — 단, D-011 로 고정 버전 기준. 고정 버전의 `HOOK_EVENTS` 는 아직 대조하지 않았다 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 우측 패널 껍데기를 마운트하는 자리 | `rg '<ResizableSidePane\|<RightPanel\b\|<TilePanel\|<ArtifactViewer\b' renderer --glob '*.tsx'` (테스트 제외) | 10 | 세션 안: `ChatTile.tsx` · `RightPanelColumn.tsx` · `TilePanel.tsx`(3) · `claude/rightpanel/Panel.tsx` · `opencode/rightpanel/Panel.tsx` / 세션 밖: `DetailSidePane.tsx` · `ArtifactsView.tsx` · `useArtifactCatalogViewer.tsx` |
| `DetailSidePane` 소비처 | `rg 'DetailSidePane' renderer --glob '*.tsx'` (정의·테스트 제외) | 2 | `features/schedules/components/SchedulesScreen.tsx` · `features/skills/components/customize/ExtensionDetailPane.tsx` |
| Claude 내부 훅 생성자 | `rg 'makeTurnEndHook\|makeInputReceiptHook\|makeWorkspaceGuardHook\|makePlanFileHook\|makeOutputFilesHook\|withPostCompactHook' main` (테스트 제외, 정의) | 6 | D-010 의 대상 |
| OpenCode 가 구독하는 원본 이벤트 중 게이트 성격 | `rg -o 'permission\.asked\|question\.asked' adapters/opencode/v1` | 2종 | 정규 게이트의 OpenCode 쪽 대응 지점 |

### 수치 / 전칭 표현 검산

- "프로덕션은 정규 핸들러를 하나도 등록하지 않는다": `rg 'normalized:' main` (테스트 제외) → 타입 선언과 `builder.ts` 의 빈 객체뿐.
- "OpenCode 는 훅 수단이 없다": `rg -l 'hooks' adapters/opencode` (테스트 제외) → `discovery-cache.ts`·`configured-resources.ts` 2건, 둘 다 설정 조회이고 훅 어댑트가 아니다. **OpenCode 플러그인 모듈로 훅을 심는 길은 이번에 조사하지 않았다** — 안 A 의 게이트 범위를 정할 때 확인한다.
- 문서 앵커: `adapters.md` §3.2.5 존재 확인. `state.md` "우측 타일 선택" 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: 훅 = Claude 어댑터 / 패널 상태 = renderer `chatReducer`·`backgroundStore` / 패널 껍데기 = `TilePanel`(세션) · `DetailSidePane`(세션 밖).
- 문제의 직접 원인: 훅이 어댑터 안에 있어 하네스마다 다시 써야 하고, 훅이 얻은 사실을 패널로 보내는 공통 경로가 없다.

```text
[Claude SDK 훅 콜백]                         [OpenCode SSE 원본 이벤트]
  → adapters/claude (내부 훅 6 + map.ts)        → adapters/opencode/v1/map.ts
  → NormalizedEvent  ←────────────────────────────┘
  → TurnCoordinator → persist sink / forward sink
  → renderer chatStore(reducer) · backgroundStore
  → harnesses/<하네스>/rightpanel → TilePanel → tile Content (스토어를 직접 읽는다)

[세션 밖 화면]  → DetailSidePane / ResizableSidePane → 화면이 준 children
```

### TO-BE — 변경 후 목표 구조와 동작 경로

> DRAFT — 안 A 기준의 그림이다. D-008 이 안 B 면 "정규 세션 훅"과 "패널 상태 조각"이 renderer 로 내려간다.

```text
[하네스 어댑터]  → NormalizedEvent  (지금과 같다 — 내부 훅은 생산자로 남는다, D-010 권고)
  → TurnCoordinator → persist sink / forward sink / **hook sink**
                                                    → 정규 세션 훅 발화(공통 봉투)
                                                    → 관찰 핸들러 → 패널 상태 조각(교체 + rev)
                                                    → forward → renderer
[권한 요청·프롬프트 제출]  → **게이트 훅**(두 하네스가 이미 main 을 거치는 자리)

renderer:
  패널 기본(껍데기: 크기 조절·펼치기·닫기·Esc·수명 키)
    ├─ 정적 패널  ← 세션 밖 화면이 준 내용            (DetailSidePane 소비처)
    └─ 동적 패널  ← sessionId + 패널 종류의 상태 조각   (세션 타일)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 걸린 결정 |
|---|---|---|---|---|
| 훅 계약의 위치 | Claude 어댑터 안 | 정규 이벤트 위(하네스 밖) | D-001 | D-008 |
| 관찰과 게이트 | 구분 없음 — 모든 콜백을 SDK 가 기다린다 | 계약에서 구분. 게이트는 두 하네스가 이미 main 을 거치는 자리에만 | 조사 문서 §2.2 | D-008 |
| 실패 정책 | 없음 | 관찰 = 건너뜀, 게이트 = 등록 시 열림/닫힘 | 조사 문서 §5 L6 | — |
| 봉투 | `sessionId`·`cwd`·도구 필드·`raw` | + `turnId`·`toolRunId`·`agentId`·부모·순번·출처·실시간 여부 | 조사 문서 §6.3 | — |
| 패널 상태의 원천 | 타일이 스토어를 직접 읽는다 | 첫 동적 패널은 상태 조각을 읽는다 | D-004 | D-009 |
| 패널 껍데기 | 세션 안팎이 따로 | 공통 기본 + 정적/동적 파생 | D-005·D-007 | — |
| 타일 id | 닫힌 목록 | (이번에는 유지 — 조각 계약만 열어 둔다) | 범위 제한 | — |

### 핵심 책임 분리

> DRAFT — D-008 뒤 모듈·레이어·import 방향을 확정한다. 안 A 면 hook sink 는 `features/chat`(L1) 의 구조적 포트로 받고 concrete 는 `app` 이 주입한다(`src/main/AGENTS.md` 의존 역전 규칙).

## 10. 계약 / 타입 / 강제 지점

> 미작성(DRAFT). OPEN 결정 뒤 자리 목록과 자리 검색 명령을 고정한다.

고정해야 할 이름(one-way door) 후보만 적는다.

| 계약 | 후보 | 비고 |
|---|---|---|
| 관찰 이벤트 어휘 | 세션 시작·종료·상태 / 턴 시작·완료 / 도구 실행 후·실패 / 에이전트 시작·종료 / 작업 생성·갱신·완료 / compact 전·후 / 알림 | 조사 문서 §6.2. 두 하네스가 **모두** 낼 수 있는 것만 정규 어휘에 넣는다 |
| 게이트 이벤트 어휘 | 프롬프트 제출 · 권한 판정 | 두 하네스가 이미 main 을 거치는 자리 |
| 봉투 필드 | 조사 문서 §6.3 | — |
| 패널 상태 조각 | `{ sessionId, panel, rev, data }` 교체 의미 | 안 A 면 IPC 계약 |

## 11~15

미작성(DRAFT).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "`normalized` 는 claude 단일 엔진의 in-process 콜백에 한정(범용 정규화 야망 폐기)" | `docs/arch/backend/adapters.md` §3.2.5 | D-001 | **변경** — 사용자 지시(턴 4-1). 문서 정정을 범위에 넣는다 |
| feature 교차 import 금지 · 의존 역전 | `app/src/main/AGENTS.md` | §9 핵심 책임 분리 | 유지 |
| IPC 채널·이벤트 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` 작성 규칙 6 | 안 A 의 패널 조각 이벤트 | 유지 — 안 A 면 적용 |
| 새 의존성은 사용자 확인 | `app/AGENTS.md` | — | 신규 의존성 없음 |
| SDK exact pin | `docs/TRD.md` §2 | D-011 | 유지 |
| "재로드된 live 목록은 현재 실행 근거가 아니다" | `docs/arch/frontend/state.md` | R-i | 유지 — 조각에도 같은 규칙 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 범위가 커서 AC 가 25건을 넘는다 | D-012·D-013 으로 전 패널·전 내부 훅이 범위다. 한 plan 으로는 넘을 가능성이 높다 — D-014 에서 가른다(후보: ① 훅 계약 + 내부 훅 이전 ② 패널 기본/정적/동적 구조 ③ 패널별 이전) |
| 정규 어휘에 한 하네스만 낼 수 있는 이벤트가 들어간다 | "두 하네스가 모두 낼 수 있는 것만"을 §10 에 불변식으로 고정하고 하네스별 fixture 로 검사 |
| 세션 밖 패널 회귀 | R-h 를 변경 전 동작의 회귀 pair 로 둔다 |
| 훅 핸들러가 턴을 늦춘다 | 관찰은 턴 경로에서 기다리지 않는다 |

- 되돌리기 어려운 결정: 이벤트 이름 · 봉투 필드 · (안 A) 패널 조각 이벤트.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

> DRAFT — 확정 전 목록.

- `app/src/main/adapters/common/hooks.ts` · `adapters/claude/adapt.ts` · `features/chat/turn-sinks.ts` · `features/chat/turn-coordinator.ts` · `features/approvals/permission-bridge.ts` · `app/chat-turn/`
- `app/src/shared/ipc.ts` (안 A)
- `app/src/renderer/src/shared/ui/{DetailSidePane,ResizableSidePane}.tsx` · `features/chat/harnesses/common/rightpanel/` · `features/chat/harnesses/contracts.ts`
- `docs/arch/backend/adapters.md` §3.2.5 · `docs/arch/frontend/{rendering,state}.md` · `docs/IPC_CONTRACT.md` (안 A)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트·사람 실기: READY 때 확정.

## READY self-review

미실시 — DRAFT. OPEN 결정 D-008·D-014 가 닫히면 §7·§7-A·§10~§15 를 쓰고 체크한다.

- INDEX `## 새 handoff 후보` 대조(이번 턴에 실시): 겹치는 행 2건.
  - 0317 독립 버그 후보 `harnesses/claude/rightpanel/LegacySubAgentTile.tsx` 카드 키 처리기 — 이 handoff 가 그 파일을 고치게 되면 범위로 들어온다. D-009 권고(변경사항 타일)에서는 닿지 않는다.
  - 0314 이월 `adapters/claude/mock*.ts` SDK 메시지 층 mock — 훅 계약 테스트가 mock 어댑터를 쓰면 닿는다. READY 때 다시 판정한다.

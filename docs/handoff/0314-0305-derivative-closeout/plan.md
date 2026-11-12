# Plan — 0314-0305-derivative-closeout

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3·§8 · 0307~0313 plan의 Decision · 2026-11-12 사용자 지시 세 턴과 질의 1(§2)이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0314-0305-derivative-closeout` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 0305 분할안 H-H 3단계(C-34 — 구현) · C-26 중 스위치 4곳(구현) · 후보 39건 종결 장부 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0231의 백그라운드 V를 상속하지 않는다. 정본 reducer의 기존 동작은 §7-A가 기존 테스트 좌표로 `REGRESSION`에 올린다 |
| 이번 V revision | `V1 rev.3` — rev.1(구현 없이 종결)·rev.2(mock 매퍼 포함)에 대한 구현·검증은 0회다. 턴 2·턴 3의 사용자 결정으로 다시 썼다 |
| 유효 V | `V1 rev.3` |
| 구현 주체 | Claude (비기능 — 리팩토링. root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `2479aa4` (`git cat-file -t` → commit · `git merge-base --is-ancestor 2479aa4 origin/main` 성공) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: main의 백그라운드 상태에 원천이 둘이다. 정본(`BackgroundEvent` → `BackgroundSessionState`)과, `subagent.task`·도구 결과를 보고 main이 따로 짐작하는 구 추적(`BackgroundTaskTracker.bySession`)이다. 둘을 가르는 스위치가 네 곳에 있고, 구 추적에 실제로 기대는 어댑터는 DEV mock 하나다(§4).
- 이번에 하지 않는 것: mock을 정본으로 옮기는 일. mock 안에 Claude 매퍼를 손으로 복제하면 같은 파편화가 다시 생기므로, SDK 메시지 층에서 흉내 내는 mock을 후속 handoff로 둔다(D-022).
- 완료 후 달라지는 것: 백그라운드 상태의 원천은 정본 이벤트 하나다. 하네스별 해석은 어댑터 안에서 정본으로 정규화되고, main은 개별 이벤트로 상태를 짐작하지 않는다. 구 추적과 스위치 네 곳이 사라진다.
- 성공을 사용자 관점에서 한 문장으로: Claude·OpenCode 화면과 동작은 그대로이고, main의 백그라운드 판정 경로가 하나로 준다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305파생 마감 핸드오프를 만들어 plan 작성하라. 범위는 c-34 3단계(main hasCanoncial 스위치 단일화)와 c-26, 그리고 305후보 39건 종결 장부다." | 턴 1 |
| 명시 요구 | "먼저 claude, opencode, mock어댑터가 백그아뉸드 이벤트보다 먼저 정본 상태를 내는지 조사하고, 하나라도 구 추적에 기대면 규현 없이 종결 근거만 남겨라." | 턴 1 |
| 명시 요구 | "종결 대상은 c -18,23,33,35,34 4단계•캐시 2종이다." | 턴 1 |
| 명시 요구 | "조건은 ui 회귀 금지, 성능 최소 동등, 전략 없이 줄 수 감량 금지다. (=과밀도제거+구조화/모듈화유지혹은확보)" | 턴 1 |
| 명시 요구 | "백그라운드 상태는 정본 이벤트를 원천으로 하겠다. 하네스별 해석은 어댑터 안에서 정본으로 정규화한다. Main은 개별 이벤트로 상태를 짐작하지 않도록 한다." | 턴 2 |
| 명시 요구 | "mock을 정본 계약에 맞게 전환" | 턴 2 |
| 명시 요구 | "opencode에 백그라운드 작업이 있는데 정본이벤트가 없는 경우가 없음을 증명" | 턴 2 |
| 명시 요구 | "다음 4행을 모두 정본으로 개발할 것 — isAsyncLaunched, listen 턴을 열지 못하는 조건, 0212 레벨 산호(이벤트 누락시 고착 방지), watchdog(채널이 죽은 경우)" | 턴 2 |
| 명시 요구 | "구 추적과 스위치 4곳 제거" | 턴 2 |
| 명시 요구 | "c-26의 나머지 9곳은 0307 d-009대로 종결" | 턴 2 |
| 상속 | 화면 정책 포함 사용자 경험 변경 불가 · 단순 test 감소 불가 · 실기는 모든 최적화 뒤 사람이 한 번에 | 0313 plan §2 턴 2·턴 5 |
| 명시 요구 | "D 006 캐시 해석 틀렸고, 장부 b표 (a) 근거도 사실과 다르다. (a) child 메시지 파생은 종결이 아니라 핸드오프 이월이 될어야 함. G9가 renderer 변경을 금지하므로 이번 핸드오프에서 고칠 수 없다." | 턴 3 |
| 명시 요구 | "Mock 매퍼가 claude 매퍼를 손으로 복제한다. 막으려했던 파편화가 mock 안에서 다시 생긴다. sdk층 mock 핸드오프 예정으로 둘 것." | 턴 3 |
| 명시 요구 | 구 추적·스위치 제거 시점 — "0314에서 제거 진행" (mock 백그라운드 시나리오의 DEV 한정 저하를 알린 질의의 답) | 질의 1 |
| 해석 | "캐시 2종" = 정본 보조 파생 둘 — `persistedBackgroundModels` · `transcriptResultsByToolUseId`의 공유 캐시. child 메시지 파생은 여기에 들지 않는다 | 설계자 해석(D-020) — 턴 3이 (a)를 종결에서 뺐고, 0313 §6이 나열한 세 함수 중 남는 것이 이 둘이다 |
| 해석 | "스위치 4곳" = 정본 유무로 경로를 가르는 `hasCanonical` 네 자리(`settle.ts:176` · `turn-coordinator.ts:140` · `chat-turn/index.ts:78,93`). `background-controller.ts:62`는 복원 가드라 남는다 | 설계자 해석(D-014) — rev.1 §4가 같은 구분을 적었고 턴 2가 "4곳"으로 받았다 |

## 3. Decision Ledger

| ID | 결정 | 근거 / 조건 | 출처 | 상태 | 비고 |
|---|---|---|---|---|---|
| D-001 | 범위는 C-34 3단계 · C-26 · 후보 39건 종결 장부다 | 턴 1 원문 | 사용자 | ACTIVE | — |
| D-002 | 구현 여부는 선행 조사가 정한다 — 하나라도 구 추적에 기대면 구현하지 않는다 | 턴 1 원문 | 사용자 | SUPERSEDED → D-011 | 조사는 수행됐다(§4). 그 결과를 보고 사용자가 방향을 바꿨다 |
| D-003 | C-34 3단계와 C-26을 구현하지 않는다. `app/**` 변경 0 | D-002 + mock 조사 | 설계자 조사 | SUPERSEDED → D-011·D-015 | — |
| D-004 | C-18 · C-23 · C-33 · C-35 · C-34 4단계 · 캐시 2종을 구현 없이 종결한다 | "종결 대상은 …이다" | 사용자 | ACTIVE | 0307 D-004("보류")의 C-33·C-34 4단계를 종결로 닫는다 |
| D-005 | 조건은 셋이다 — UI 회귀 금지 · 성능 최소 동등 · 전략 없는 줄 수 감량 금지(과밀도 제거 + 구조화/모듈화 유지·확보) | 턴 1 원문 | 사용자 | ACTIVE | AC9·AC10·AC8이 잠근다 |
| D-006 | "캐시 2종"은 (a) `childMessageForParentToolRunId` (b) `persistedBackgroundModels`·`transcriptResultsByToolUseId`의 공유 캐시다 | 0313 plan §6 미룬 항목 표 | 설계자 해석 | SUPERSEDED → D-020·D-021 | 턴 3이 틀렸다고 정정했다. (a)의 근거 "소비처 3곳이 각자 `useMemo`"도 사실이 아니었다 — `AgentViews.tsx:68`은 메모 없이 부른다 |
| D-007 | C-26은 13곳 전부를 종결한다 | D-002 조건문 | 설계자 조사 | SUPERSEDED → D-015·D-016 | — |
| D-008 | 장부는 새 문서 `ledger.md`다. 0305 `audit.md`·`data/*.json`은 바꾸지 않는다 | 감사 문서는 `audit-check.mjs --check`가 데이터와 대조하는 생성물이다 | 설계자 판단 | ACTIVE | — |
| D-009 | mock이 정본 이벤트를 내도록 고치는 길은 가지 않는다 | D-002 "구현 없이" | 설계자 판단 | SUPERSEDED → D-012 | — |
| D-010 | 장부의 단위는 후보 39행(A표) + 분해안 단계 58행(A-2표) + 종결 파생 2행(B표) + 이월 2행(C표)이다 | 후보 하나가 단계별로 다른 handoff·Decision에 귀속된다 | 설계자 판단 | ACTIVE | — |
| D-011 | 백그라운드 상태의 원천은 정본 이벤트다. 하네스별 해석은 어댑터 안에서 정본으로 정규화하고, main은 개별 이벤트로 상태를 짐작하지 않는다 | 턴 2 원문 | 사용자 | ACTIVE | 이 handoff의 구조 원칙 |
| D-012 | mock 어댑터를 정본 계약에 맞게 전환한다 | "mock을 정본 계약에 맞게 전환" | 사용자 | SUPERSEDED → D-022 | rev.2는 mock 안에 매퍼를 새로 두는 설계였다 |
| D-013 | OpenCode에 "백그라운드 작업이 있는데 정본 이벤트가 없는 경우"가 없음을 증명한다 | 턴 2 원문 | 사용자 | ACTIVE | 증명 = 코드 경로 논증(§8) + 그 불변식을 잠그는 테스트(AC3) |
| D-014 | 네 동작을 정본으로 구현한다 — `isAsyncLaunched` · listen 턴 판정 · 0212 레벨 신호(이벤트 누락 시 고착 방지) · watchdog(채널 사망) | 턴 2 원문 | 사용자 | ACTIVE | 규칙은 §10 A~D |
| D-015 | 구 추적과 스위치 4곳을 제거한다 | "구 추적과 스위치 4곳 제거" | 사용자 | ACTIVE | 4곳의 해석은 §2 해석 행 |
| D-016 | C-26의 나머지 9곳은 0307 D-009대로 종결한다 | 턴 2 원문 · 0307 D-009 "계약 타입이 다른 구현자에게도 열려 있다" | 사용자 | ACTIVE | `turn-coordinator.ts`의 `?.(`는 13 → 9가 된다 |
| D-017 | 구 추적이 하던 합성 정착(`settleTrackedTasks`)은 정본으로 옮기지 않고 없앤다 | 정본 계약: "집합에서 빠진 사실은 terminal 상태를 만들지 않는다" · "host 정착을 provider journal에 합성하지 않는다"(`docs/arch/backend/background-tasks.md:11,17`). Claude는 지금도 이 경로를 타지 않는다(`chat-turn/index.ts:78,93`이 정본이면 즉시 반환) | 설계자 판단 | ACTIVE | DEV mock 세션에서만 달라진다 — 합성 `실패` 정착이 사라진다(§5 · D-023) |
| D-018 | renderer와 IPC 계약은 바꾸지 않는다 | D-005 UI 회귀 금지 · C-34 4단계 종결(D-004) | 설계자 판단 | ACTIVE | `chat:stop-subagent` 채널과 구 모델 타일은 남는다 |
| D-019 | mock의 `stopTask`는 no-op으로 둔다 | rev.2의 mock 전환에 딸린 판단 | 설계자 판단 | SUPERSEDED → D-022 | mock을 건드리지 않으므로 판단 대상이 없다 |
| D-020 | "캐시 2종"은 정본 보조 파생 `persistedBackgroundModels`·`transcriptResultsByToolUseId`의 공유 캐시이고, 구현 없이 종결한다 | 턴 3 정정 + 0313 §6의 세 함수 중 남는 둘. 두 함수는 호출이 한 컴포넌트에 하나씩이고 `useMemo([messages])` 안이다(`CanonicalBackgroundContent.tsx:62,63`) | 설계자 해석 | ACTIVE | 장부 B표 2행 |
| D-021 | child 메시지 파생(`childMessageForParentToolRunId`)의 공유 캐시는 종결이 아니라 후속 handoff로 이월한다 | "종결이 아니라 핸드오프 이월" · "G9가 renderer 변경을 금지하므로 이번 핸드오프에서 고칠 수 없다" | 사용자 | ACTIVE | 장부 C표 · INDEX 후보 표 |
| D-022 | mock의 정본 전환은 SDK 메시지 층 mock으로 하고 후속 handoff로 둔다. 이번에는 mock 코드를 바꾸지 않는다 | "Mock 매퍼가 claude 매퍼를 손으로 복제한다. 막으려했던 파편화가 mock 안에서 다시 생긴다. sdk층 mock 핸드오프 예정으로 둘 것." | 사용자 | ACTIVE | 장부 C표 · INDEX 후보 표 |
| D-023 | 구 추적과 스위치 제거는 0314에서 진행한다. 그 사이 mock의 백그라운드 시나리오가 DEV에서 저하되는 것을 받아들인다 | 질의 1 답 "0314에서 제거 진행" | 사용자 | ACTIVE | 저하 범위는 §5 · §10 경계 1 |

### 갱신 메모

- 턴 2 diff: D-002·D-003·D-007·D-009를 SUPERSEDED로 바꾸고 D-011~D-019를 더했다.
- 턴 3 diff: D-006·D-012·D-019를 SUPERSEDED로 바꾸고 D-020~D-023을 더했다. D-011(원칙)은 남는다 — production 어댑터에서 성립하고 mock은 D-022가 후속으로 닫는다.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-011 ↔ AC5·AC6 · D-013 ↔ AC3 · D-014 ↔ AC4 · D-015·D-023 ↔ AC5·AC6 · D-016 ↔ AC6(`?.(` 9) · D-004·D-010·D-020·D-021·D-022 ↔ AC11 · D-005 ↔ AC8·AC9·AC10 · D-018 ↔ AC9 · D-022 ↔ AC15(mock 파일 diff 0).
- OPEN 0. 설계자 해석·판단(D-020 · "4곳" 해석 · D-017)은 완료 보고에서 사용자에게 알린다.

## 4. 요구 비판적 검토

### 선행 조사 결과 (rev.1에서 수행 — 코드 경로 판독)

| 어댑터 | 정본을 먼저 내는가 | 구 추적에 기대는가 | 관측 |
|---|---|---|---|
| Claude | 예 | 아니오 | SDK 메시지마다 `backgroundMapper.map` 결과가 같은 배치의 `providerEvents`다(`adapter.ts:869,960`). 첫 메시지 `init`이 `background.connection connected`다(`background.ts:124-134`). 런타임은 provider 이벤트를 normalized 이벤트보다 먼저 넘긴다(`session-runtime.ts:630` → `:673`). 새 세션은 세션 행 insert 직후 flush된다(`writer.ts:90-95,331`) |
| OpenCode | 백그라운드 작업이 생기는 그 호출에서 낸다 | 아니오 | 정본 이벤트는 bash·task 도구 파트에서 난다(`activity.ts:113,174,220`). `subagent.task` 생산 0파일 |
| mock | 아니오 | 예 | 배치가 `events`만 싣는다(`mock.ts:59-62`). 시나리오는 `subagent.task`(`mock-scenarios.ts:250-281`)와 정착 없는 `async_launched` 영수증(`:554-558`)을 낸다 |

### 검토 표

| 검토 | 판정 | 관측 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 예 | 구 추적의 유일한 실사용자는 mock이다(위 표). production 어댑터 둘은 구 추적을 쓰지 않는다 |
| 이미 기존 코드가 충족하는가 — 네 동작의 정본 구현 | 대부분 있다 | `isAsyncLaunched` 정본 분기 `background-tasks.ts:125-136` · listen 판정 `backgroundPending`(`shared/background-task.ts:527-554`) · 레벨 `background.snapshot`(`:281-311`) · 채널 사망 `background.connection terminated`(`session-runtime.ts:830-843`). 이번 일은 새 구현보다 **구 분기 제거 + 정본 분기를 유일 경로로 잠그기**다 |
| 이미 기존 코드가 충족하는가 — 0212 레벨의 구 구현 | 이미 죽었다 | `applyLiveSet` production 호출 0(`rg -n "applyLiveSet\(" app/src/main -g '!*.test.*'` → 정의 1줄) — 0307 verify가 같은 사실을 보고했다 |
| 더 작은 해법 | 없음 | 스위치만 지우고 구 추적을 남기면 쓰기만 하고 읽지 않는 상태가 남는다 |
| mock을 이번에 옮기지 않아도 되는가 | 된다 — DEV 저하를 받아들이면 | mock은 `import.meta.env.DEV`에서만 생성된다(`bootstrap.ts:831`). 저하되는 것은 정착 없는 백그라운드 작업을 내는 시나리오 하나다(`mock-scenarios.ts:554-558`) — 질의 1 |
| "제거"가 이동이 아닌가 | 아니다 | 합성 정착은 정본으로 옮기지 않고 없앤다(D-017). 정본 계약이 그것을 금한다 |
| 선행 자료의 주장을 코드와 대조했는가 | 스위치 `undefined`와 빈 상태는 뜻이 다르다 | `orphanToolRunIds`는 `background`가 `undefined`면 child 도구를 정착 대상에서 뺀다(`settle.ts:109`). 스위치를 지우면 정본 없는 세션이 빈 상태를 받는다 — child 도구가 있는 세션에 정본이 항상 있어야 동치다(§8 OpenCode 논증 · AC3) |
| ACTIVE 결정·채택 결정과 충돌하는가 | 0143 "listen 중 중단은 태스크도 멈춘다" | 정본 세션에서는 0231부터 이 경로가 돌지 않는다(`index.ts:93`). 현재 채택 문서는 "메인 응답 취소는 백그라운드 수신을 보존한다"다(`background-tasks.md:25`) — 문서와 Claude 실동작이 이미 같다 |

## 5. 동작 / 사용자 흐름

### 사용자가 보는 것

| 대상 | 변경 전 | 변경 후 |
|---|---|---|
| Claude 세션 | 정본 경로 | 같음 — 화면·listen·중단·정착 불변(AC7·AC9) |
| OpenCode 세션 | 정본 경로(bash·task가 있을 때) / 빈 구 추적 | 같음 |
| 0231 이전 기록 세션 | 구 모델 타일(renderer) | 같음 — renderer 불변(D-018) |
| DEV mock 세션 | 구 모델 타일 · 채널 종료 시 `실패` 합성 정착 | 구 모델 타일(정본 없음 — renderer 불변). 백그라운드 시나리오가 저하된다(아래 표 · D-023). 개발자만 본다(`bootstrap.ts:831`) |

### DEV mock의 저하 범위 (D-023 — SDK층 mock handoff가 되돌린다)

| mock 동작 | 변경 전 | 변경 후 |
|---|---|---|
| 정착 없는 백그라운드 작업(`mock-task-board-bg`) | 턴 뒤 채널 종료에서 합성 `실패` 정착 | 정착 없음 — 구 모델 타일에 `실행 중`으로 남는다. listen 턴도 열리지 않는다 |
| 작업 중단 클릭(`chat:stop-subagent`) | 15초 뒤 미확인으로 reject → `진행 중` 복구 | 정본이 없어 즉시 resolve — 시나리오가 `settled`를 내지 않으면 `중단 중`에 머문다 |
| 백그라운드 정착의 완료 통지 표식(`background:true`) | `async_launched` 영수증을 본 작업에 부여 | 부여 안 됨 |
| 포그라운드 서브에이전트 시나리오(시작→정착이 턴 안) | 정상 | 같음 — transcript 정착(`settleSubagentTask`)은 남는다 |

### 네 동작 — 무엇이 답하는가

| 동작 | 변경 전(정본 없는 세션) | 변경 후(모든 세션) |
|---|---|---|
| `isAsyncLaunched` | `bySession`의 `asyncLaunched` 플래그 | 정본 호출·작업 기록(§10 A) |
| listen 턴 판정 | `hasAny` — 추적 맵이 비었는가 | `backgroundPending(state)`(§10 B) |
| 레벨 신호(이벤트 누락 시 고착 방지) | `applyLiveSet` — 호출부 0 | `background.snapshot`이 live 집합을 교체한다(§10 C) |
| watchdog(채널 사망) | `settleTrackedTasks` 합성 `failed` | `background.connection terminated` → 대기 해제. 중단 요청은 15초 뒤 `unconfirmed`(§10 D) |

### 상태와 전이 — 정본 없는 세션

| 상태 | 판정 |
|---|---|
| 정본 이벤트를 한 번도 못 본 세션 | 빈 상태(`emptyBackgroundState`) — 대기 아님 · 개수 0 · `isAsyncLaunched` false · `waitForTask` 즉시 `settled` |

### 장부 (D-004 · D-010) — 설계자가 고정한 A표 분류 (39 = 14 + 9 + 16)

| 분류 | 후보 | 수 |
|---|---|---|
| `DONE` | C-01 C-03 C-04 C-05 C-08 C-09 C-32 C-13 C-17 C-39(0307) · C-02 C-10 C-11(0308) · C-25(0311) | 14 |
| `PARTIAL` | C-06(0307 D-012) · C-07(0310 D-002) · C-14(0311 D-009·D-008) · C-24(0308·0309 D-007) · C-27(0312 D-006·D-007) · C-29(0310 D-007·D-008) · C-36(0312 D-011) · C-34(0313 + 0314 구현 · 4단계 0314 D-004) · C-26(0314 4곳 구현 · 9곳 0314 D-016) | 9 |
| `CLOSED` | C-12(0307 D-008) · C-15(0311 D-007) · C-16(0307 D-015) · C-19(0311 D-008 · 0313 D-002) · C-20 C-21 C-22 C-23 C-31(0309 D-008~D-012) · C-28(0312 D-009) · C-30(0307 D-016) · C-37(0307 D-013) · C-38(0307 D-014) · C-18 C-33 C-35(0314 D-004) | 16 |

이번에 구현 없이 닫는 항목과 설계자가 잰 근거:

| 항목 | 종결 근거 | 관측 (조사 기준 커밋) |
|---|---|---|
| C-26 9곳 | 0307 D-009 — 계약 타입이 다른 구현자에게 열려 있다(D-016) | 구현 뒤 `rg -c "\?\.\(" turn-coordinator.ts` → 9 |
| C-34 4단계 | 0231 이전 세션의 구 모델 표시가 그 id 배열과 파생 함수를 쓴다 | `LegacySubAgentTile.tsx:86,135` · `chatReducer.ts:435-444` |
| C-18 | 겹침 22줄에 하네스별 정책 분리 경계(감사 §9 보류 표) | 두 파일 57 · 77줄 |
| C-23 | 채택 규칙 "안정 액션 묶음 `chatActions`" 변경이다(0309 D-011) | `docs/arch/frontend/state.md:90` · 테스트 81파일 |
| C-33 | 채택 규칙 "직접 호출 금지" 변경이다 | `state.md:120-121` · 래퍼 참조 테스트 51파일 |
| C-35 | 공통 줄 13 — 겉모습이 하네스별로 다르다(감사 §9 보류 표) | `QuestionCard.tsx` 325줄 · `QuestionDock.tsx` 265줄 |
| 캐시 `persistedBackgroundModels` | 호출 1곳이고 이미 `useMemo([messages])` 안이다 — 공유할 상대가 없다(D-020) | `rg -n "persistedBackgroundModels\(" renderer/src -g '!*.test.*'` → 정의 1 + 호출 1(`CanonicalBackgroundContent.tsx:62`) |
| 캐시 `transcriptResultsByToolUseId` | 같음 | 같은 명령 → 정의 1 + 호출 1(`CanonicalBackgroundContent.tsx:63`) |

이월 항목(C표 — 종결이 아니다):

| 항목 | 이월 이유 | 관측 (조사 기준 커밋) |
|---|---|---|
| child 메시지 파생 공유 캐시 | 호출 3곳 중 1곳이 메모 없이 렌더마다 전 파트를 돈다. renderer 변경이 필요한데 이번 handoff는 renderer diff 0이다(D-021 · G9) | `AgentViews.tsx:68`(메모 없음) · `LegacySubAgentTile.tsx:140-143` · `InlineSubagentDetail.tsx:30-33`(각자 `useMemo`) |
| SDK 메시지 층 mock | mock이 정본 이벤트를 내지 않는다. mock 안에 매퍼를 두면 Claude 매퍼의 복제다(D-022) | `rg -c "providerEvents" app/src/main/adapters/claude/mock.ts` → 0 · `mock.ts:59-62` |

### 파생 UX / 엣지케이스

- mock 세션에는 정본이 없으므로 renderer가 계속 구 모델 타일을 고른다(`SubAgentTileContent.tsx:23,70` `hasCanonicalBackground`).
- 구현자가 장부 한 행의 관측을 재현하지 못하거나 A-2표 단계가 어느 Decision에도 귀속되지 않으면 고치지 않고 `PLAN_GAP`으로 돌린다.

## 6. 범위 / 비범위

- **범위**
  - main: `features/chat/background-tasks.ts`(구 추적 제거) · `turn-coordinator.ts`(추적 쓰기 4곳 · 스위치 · `getState` 필수) · `settle.ts`(`settleTrackedTasks`·`settleTaskSubset` 제거) · `stop-subagent.ts`(포트) · `features/chat/post-turn.ts`(`stopTasks`) · `app/chat-turn/{index,deps,runtime-entry,post-turn,turn-request,send}.ts`(정착 deps 제거).
  - 테스트: 위 파일의 테스트와 fake · OpenCode `activity.test.ts`.
  - 문서: `docs/arch/backend/background-tasks.md` · `provider-runtime.md:94` · `ledger.md` · INDEX(0314 행 · 후보 표 2행).
- **비범위**: `app/src/renderer/**` · `app/src/preload/**` · `app/src/shared/**`(D-018 — 정본 reducer 불변) · `ClaudeBackgroundMapper` · OpenCode `activity.ts` production 코드(증명만 — 결함이 나오면 `PLAN_GAP`) · C-26 9곳(D-016) · C-34 4단계 · 턴-국소 id 표(`subagentTaskIds`·`subagentTypes`·`stoppedSubagents` — §10 경계 2) · mock 어댑터 전부(`adapters/claude/mock*.ts` — D-022) · child 메시지 파생 캐시(D-021) · 0305 산출물(D-008).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| SDK 메시지 층 mock(정본 전환 · DEV 저하 복구) | 아니오 | 후속 handoff — INDEX 후보 표(D-022) |
| child 메시지 파생 공유 캐시 | 아니오 | 후속 handoff — INDEX 후보 표(D-021) |
| `chat:stop-subagent` 채널과 구 모델 타일 제거 | 아니오 | C-34 4단계 — 종결(D-004) |
| 턴-국소 id 표를 정본 기록에서 읽기 | 아니오 | 사용자가 고르면 새 handoff |

## 7. Requirements / Acceptance — `R ↔ AT`

| AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC3 | OpenCode: child가 등록된 `map` 호출은 그 호출 또는 이전 호출에서 같은 `toolUseId`의 `background.call`을 냈고, child가 백그라운드로 표시된 호출은 같은 호출에서 `background.task`를 낸다 | UT `activity.test.ts` 신규(§10 O1~O6 입력) | `OpenCodeActivity.map` → `providerEvents` |
| AC4 | 네 동작이 §10 A~D 규칙 분기마다 정본 상태만으로 답한다 | UT `background-tasks.test.ts` · 기존 `shared/background-task.test.ts` · `background-controller.test.ts` · `stop-subagent.test.ts` 좌표(§10) | tracker 선택자 → `post-turn.ts:124-127` · `turn-coordinator.ts:347,516` · `stop-subagent.ts:78,89` |
| AC5 | 구 추적이 없다 — tracker에 `started`·`settled`·`markAsyncLaunched`·`applyLiveSet`·`resetLevel`·`clear`·`ids`·`hasAny`와 `bySession`·`levelEstablished`가 없고, coordinator가 `subagent.task`·도구 결과로 tracker에 쓰지 않는다 | `gate:G7`(음성) + AC4(양성 — 동작은 정본으로 남는다) | `background-tasks.ts` · `turn-coordinator.ts` |
| AC6 | 스위치 4곳이 없다 — production `hasCanonical` 참조는 tracker 정의 1 + 복원 가드 1뿐이고, `turn-coordinator.ts`의 `?.(`는 9다 | `gate:G8` | §10 EP-02 |
| AC7 | Claude·OpenCode의 턴 동작이 그대로다 — coordinator·post-turn·settle·continuation 기존 테스트가 정본 시드로 같은 결과를 단언한다 | 기존 스위트(§19 G12) — 구 API로 시드하던 케이스는 정본 이벤트 시드로 옮긴다 | `TurnCoordinator.run` · `runPostTurn` |
| AC8 | 테스트를 단순히 줄이지 않는다 — 지운 케이스마다 대체 케이스 또는 "동작 자체가 없어짐(D-017)" 근거가 1:1로 적힌다 | 구현 보고 `삭제 케이스 대응표` + 검증자 대조 | `git diff 2479aa4..HEAD -- '*.test.*'` |
| AC9 | renderer·preload·shared의 변경이 0이다 | `gate:G9` | `git diff --stat` |
| AC10 | 성능 최소 동등 — 어댑터 경로에 이벤트당 새 작업이 없고, coordinator의 이벤트당 tracker 쓰기 4곳이 사라진다 | `gate:G7`(쓰기 0) · production 신규 파일 0(`git diff --stat --diff-filter=A 2479aa4..HEAD -- app/src ':!*.test.*'` → 출력 없음) | §14 |
| AC11 | 장부 A표 39행(14·9·16) · A-2표 58행이 §5 고정 분류·감사 데이터와 차집합 ∅이고, Decision 좌표가 실재한다. B표는 캐시 2행(종결), C표는 이월 2행이고 C표 행마다 INDEX 후보 표의 `0314` 행이 있다 | `gate:G1·G2·G4·G14` | `ledger.md` · `INDEX.md` |
| AC12 | 문서가 현재 상태를 적는다 — `provider-runtime.md`에 "legacy 추적" 서술이 없고 `background-tasks.md`가 어댑터 계약(Claude·OpenCode는 정본 이벤트로만 백그라운드 사실을 내고 main은 `subagent.task`로 상태를 추적하지 않는다)과 DEV mock이 정본을 내지 않는다는 사실을 적는다 | `rg -n "legacy 추적" docs/arch` → 0 · 검증자 대조 · `gate:G5` | `docs/arch/backend/*` |
| AC13 | 운영 gate가 통과한다 | §19 G5·G6·G10~G13 | — |
| AC15 | mock 어댑터를 바꾸지 않는다 | `gate:G15` | `git diff --stat` |

### AC 검증 주의사항

- AC5는 음성 게이트(G7)만으로 닫지 않는다. "정본으로 답한다"는 양성 단언(AC4)과 짝이다 — 구 분기를 지우고 정본 분기까지 깨뜨리면 G7은 green이다.
- AC7에서 구 API 시드를 정본 시드로 옮길 때 기대값을 고치지 않는다. 기대값이 달라지는 케이스는 D-017(합성 정착 소멸)에 해당할 때만 허용하고 대응표(AC8)에 적는다.
- AC3의 "증명"은 테스트가 열거한 입력 범위의 증명이다. 범위 밖은 §10 경계 3이다.
- AC1·AC2·AC14는 rev.3에서 삭제했다(mock 전환이 범위에서 빠졌다). 번호는 재사용하지 않는다.
- 사람 실기 없음. 프로덕션 화면은 바뀌지 않는다(AC9). DEV mock 저하(§5)는 의도된 결과라 실기 대상이 아니다.

## 7-A. V / Trace Matrix

- V mode: `Baseline V`. 필요한 레벨: 모듈 불변식(`MD↔UT` — tracker 선택자 · OpenCode 불변식) · 조립 경계(`AR↔IT` — coordinator·post-turn 배선) · 종단 수명주기(`SD↔ST` — 턴 뒤 루프의 listen 판정) · 사용자 결과(`R↔AT`).

### Node registry

| ID | 레벨 | 내용 | provenance | 기준선 |
|---|---|---|---|---|
| R-01 | R | Claude·OpenCode 화면·동작 불변 | NEW | — |
| R-02 | R | 0305 후보가 장부 한 장에 귀속된다 | NEW | — |
| SD-01 | SD | 턴 뒤 루프가 정본 대기 판정만으로 listen·break를 고른다 | CHANGED | `post-turn.ts:100-175` 현행 |
| AR-01 | AR | 어댑터 `providerEvents` → controller → tracker가 백그라운드 상태의 유일 경로다(정본을 내지 않는 mock 세션은 빈 상태다) | CHANGED | 0231 정본 경로 |
| AR-02 | AR | coordinator·chat-turn은 tracker에 쓰지 않고 선택자만 읽는다 | NEW | — |
| MD-01 | MD | tracker 선택자 규칙 A~D(§10) | CHANGED | `background-tasks.ts` 정본 분기 |
| MD-03 | MD | OpenCode 불변식 O1~O6 | NEW(잠금만 — 코드 불변) | `activity.ts` 현행 |
| MD-04 | MD | 정본 reducer(`applyBackgroundEvent`·`backgroundPending`) | INHERITED | `shared/background-task.test.ts` 기존 케이스 |

### Pair registry

| Pair | 좌 ↔ 우 | requiredness | production path | 강제 지점 N · oracle | 적대 증거 |
|---|---|---|---|---|---|
| VP-03 | MD-03 ↔ UT-03 | REQUIRED | SDK `Event` → `OpenCodeActivity.map` → `providerEvents` | EP-06 — 4자리 · `activity.test.ts` 신규 | required — 0건 주장. (f) `:173` `background.task` push 제거 (g) `:219` `background.call` push 제거 (h) `:112` 완료 통지 push 제거 |
| VP-04 | MD-01 ↔ UT-04 | REQUIRED | `tracker.observe(events)` → `isAsyncLaunched`·`hasPending`·`count`·`waitForTask` | A1~A6 · B1~B9 · C1~C4 · D1~D4 — 23분기 · §10 좌표 | required — 맞바꿈. (i) A2 `call.mode` 항 제거 (j) A4를 `'excluded'`로 (k) `hasPending`을 `count() > 0`으로 대체 (l) 정본 없음일 때 `waitForTask`를 대기로 |
| VP-05 | AR-01·AR-02 ↔ IT-02 | REQUIRED | 어댑터 이벤트 → `TurnCoordinator.run` 루프 → emit · tracker 선택자 읽기 | EP-01·EP-02·EP-07 — 4 + 4 + 9자리 · `turn-coordinator.test.ts`(정본 시드) | required — 0건 주장. (m) `canonicalBackground`가 항상 `undefined` 반환 (n) `:347` enrich 조건의 `isAsyncLaunched` 항 제거 |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | `coordinator.run` 종료 → `runPostTurn` 루프 → `hasPending` → `decidePostTurnStep` → listen/break | EP-03 — 18자리(삭제) · `post-turn.schedules.test.ts` · `chat-turn.returned-input.test.ts` · `concurrency-identity.test.ts` | required — 삭제가 순서를 바꿀 수 있다. (o) `haveTasks`를 `false` 고정 → listen 케이스 red |
| VP-07 | R-01 ↔ AT-01 | REQUIRED | 사용자 조작 → renderer(불변) → IPC(불변) → main | G9 1자리 · AC7 스위트 | (p) `app/src/renderer` 아래 한 줄 변경 → G9 red |
| VP-08 | R-02 ↔ AT-02 | REQUIRED | 감사 데이터·후속 plan → `ledger.md` | L1~L5 — 5자리 · G1·G2·G4 | required — 전수 주장. (q) A표 한 행 삭제 (r) 분류 맞바꿈 (s) A-2 귀속 칸 비움 (t) 없는 Decision 좌표 |
| VP-09 | MD-04 ↔ UT-09 | REGRESSION | `applyBackgroundEvent` → `backgroundPending` | 0 — `app/src/shared` diff 0(G9). 기존 `shared/background-task.test.ts` 전건 green | 선택 안 함 — 코드 불변 |

### 현재 변경의 운영 gate

§19 G5·G6·G10~G13. `app/**`를 바꾸므로 `app/AGENTS.md` 로컬 확인 목록 전부가 적용된다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 전수 조사

| 대상 | 검색 (`app/src/main`, `-g '!*.test.*'`) | N | 의미 |
|---|---|---|---|
| 스위치 | `rg -n "hasCanonical"` | 8줄 — 모드 스위치 4 · 복원 가드 1(`background-controller.ts:62`) · 선언 3 | EP-02 |
| 구 추적 쓰기 | `rg -n "backgroundTasks\.(started\|settled\|markAsyncLaunched)\("` | 4 — `turn-coordinator.ts:492,494,543,545` | EP-01 |
| 구 추적 정리 | `rg -n "backgroundTasks\.clear\(\|tracker\.(clear\|settled\|ids)\("` | 4 — `send.ts:507` · `settle.ts:177,180,217` | EP-01 |
| 합성 정착 deps | `rg -n "settleDeadBackgroundTasks\|stopAndSettleAbortedTasks" -g '!*.testfixture.*'` | 19줄(코드 18 + `settle.ts:161` 주석) | EP-03 |
| `isAsyncLaunched` 소비 | `rg -n "isAsyncLaunched\("` | 호출 4 — `turn-coordinator.ts:347,516` · `stop-subagent.ts:78` · `settle.ts:202`(삭제 대상) | EP-07 |
| 대기·개수 소비 | `rg -n "backgroundTasks\.(hasPending\|count)\("` | 4 — `post-turn.ts:124,127` · `index.ts:199` · `session-activity-projector.ts:232` | EP-07 |
| `waitForTask` 소비 | `rg -n "waitForTask\("` | 호출 1 — `stop-subagent.ts:89` | EP-07 |
| `getState` 소비(포트) | `rg -n "backgroundTasks\.getState"` | 4 — `turn-coordinator.ts:141,289,593` · `index.ts:112` | EP-02 |
| `applyLiveSet`·`resetLevel` 소비 | `rg -n "applyLiveSet\(\|resetLevel\("` | 정의 2 + 내부 호출 1 | 죽은 표면 |
| mock 생성 | `rg -n "new MockAdapter"` | 1 — `bootstrap.ts:831` | DEV 전용 — 저하 범위(D-023) |
| OpenCode 정본 push | `rg -n "providerEvents.push" adapters/opencode/v1/activity.ts` | 3 — `:112,173,219` | EP-06 |
| OpenCode child 등록·표시 | `rg -n "this.children.set\|target.background = true" adapters/opencode/v1/activity.ts` | 각 1 | EP-06 |
| 구 API를 쓰는 테스트 | `rg -l "tracker\.started\(\|backgroundTasks\.started\(\|\.markAsyncLaunched\(\|applyLiveSet\|settleTrackedTasks" -g '*.test.*'` | 5파일 | AC7·AC8 분모 |

### OpenCode — "백그라운드 작업이 있으면 정본 이벤트가 있다"의 논증

`OpenCodeActivity.map`(`activity.ts:92-244`)에서 백그라운드 작업이 생기는 길은 셋이고, 각각 같은 호출 안에서 정본 이벤트를 민다.

| 길 | 조건 | 같은 호출이 내는 정본 이벤트 |
|---|---|---|
| child 등록 | `task` 파트 · `metadata.sessionId`가 남의 세션 · `children.set`(`:157`) | `part.tool === 'task'`라 `:219`의 `background.call`까지 내려간다. 중복 억제(`:212`)에 걸리면 같은 스냅샷을 이전 호출이 이미 냈다 |
| 백그라운드 표시 | `metadata.background === true` → `target.background = true`(`:169`) | `:173` `background.task`(`settled`가 아니면) + `:219` `background.call`(`mode:'background'`) |
| bash 백그라운드 | `bash` 파트 · `metadata.background === true` | `:219` `background.call`(`mode:'background'`) |

- 그 앞의 조기 반환(`:97` 세션 없음 · `:124` 매퍼 없음/종료 · `:139-143` 파트 아님·`pending`·남의 메시지)은 child 등록·표시보다 앞이라 "표시만 되고 이벤트 없음"을 만들지 않는다.
- 전달: `channel.ts:430-431`이 `events`가 비어도 `providerEvents`가 있으면 배치를 낸다. 런타임은 provider 이벤트를 먼저 넘긴다(`session-runtime.ts:630`).
- `subagent.task`를 내지 않으므로 coordinator의 `subagentTaskIds` 등 턴-국소 표도 OpenCode에서는 비어 있다.

이 논증은 판독이다. AC3이 표의 세 길과 조기 반환을 입력으로 잠근다.

### 수치 / 전칭 표현 검산

- 39 = 14 + 9 + 16. 58 = 후보별 단계 수 합(rev.1과 같음 — `audit.md` `gen:decomposition`).
- `?.(` 13 − 4(`:140` `hasCanonical?.` · `:141,289,593` `getState?.`) = 9.
- 23분기 = A 6 + B 9 + C 4 + D 4.
- "Claude는 합성 정착 경로를 타지 않는다" — 반례 조건은 정본 없는 Claude 세션에 구 추적 항목이 있는 것이다. 구 추적 쓰기는 정본이 있으면 첫 줄에서 반환하고(`background-tasks.ts:85,99,110`), Claude는 `init`에서 정본이 선다(§4).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
Claude   ─ providerEvents ─┐
OpenCode ─ providerEvents ─┼→ BackgroundController → tracker.canonical ─┐
mock     ─ (없음)          ┘                                            ├→ 선택자(isAsyncLaunched·hasPending·count·waitForTask)
                                                                        │     └ 정본 있으면 정본 / 없으면 bySession
모든 어댑터 ─ normalized(subagent.task · tool.call.completed)           │
   → TurnCoordinator ─ started/settled/markAsyncLaunched → tracker.bySession ┘
chat-turn: hasCanonical ? 아무것도 안 함 : settleTrackedTasks(합성 정착)   ← 스위치 3
coordinator: hasCanonical ? getState : undefined                          ← 스위치 1
```

### TO-BE

```text
Claude   ─ providerEvents ─┐
OpenCode ─ providerEvents ─┴→ BackgroundController → tracker.canonical → 선택자(정본만)
mock     ─ (없음 — 빈 상태. SDK층 mock 후속 handoff)

TurnCoordinator: tracker에 쓰지 않는다. getState·isAsyncLaunched만 읽는다
chat-turn: 합성 정착 deps 없음
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | AC |
|---|---|---|---|
| 상태 원천 | 정본 + `bySession` | 정본 | AC5 |
| mock | normalized만 · 구 추적으로 대기·정착 | normalized만 · 백그라운드 상태 없음(후속 handoff) | AC15 |
| 스위치 | 4곳 | 0 | AC6 |
| 채널 사망 | 정본 없으면 합성 `failed` | 연결 `terminated`만 | AC4 D1 |
| coordinator → tracker | 쓰기 4 + 읽기 | 읽기만 | AC5 |
| 포트 `BackgroundTaskPort` | 선택 2 + 필수 5 | 필수 2(`getState`·`isAsyncLaunched`) | AC6 |

### 핵심 책임 분리

| 모듈 | 책임 | 하지 않는 것 |
|---|---|---|
| 어댑터(`ClaudeBackgroundMapper`·`OpenCodeActivity`) | 하네스 신호 → `BackgroundEvent` | main 상태 접근 |
| `shared/background-task.ts` | 순수 reducer·판정(`backgroundPending` 등) | — (불변) |
| `BackgroundTaskTracker` | 세션별 정본 상태 보관 · 선택자 · 구독 | 이벤트 해석 · 합성 정착 |
| `TurnCoordinator` | 턴 이벤트 팬아웃 · transcript 정착(`settleSubagentTask`) | 백그라운드 상태 추적 |

## 10. 계약 / 타입 / 강제 지점

### 포트

```ts
// features/chat/background-tasks.ts
export interface BackgroundTaskPort {
  getState(sessionId: string): BackgroundSessionState
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
}
```

`BackgroundTaskTracker`에 남는 public: `observe` · `restore` · `getState` · `hasCanonical`(복원 가드 전용) · `hasPending` · `count` · `isAsyncLaunched` · `waitForTask` · `subscribe` · `dispose`.

### 규칙 A — `isAsyncLaunched(sessionId, toolUseId)` (VP-04 · UT `background-tasks.test.ts`)

| 분기 | 정본 상태 입력 | 기대 |
|---|---|---|
| A1 | 세션에 정본 없음 | false |
| A2 | 현재 세대 호출 `mode:'background'`(작업 연결 없음) | true |
| A3 | 호출에 연결된 작업 `isBackgrounded:true` | true |
| A4 | 연결된 작업이 snapshot에 포함(`liveMembership:'included'`), `isBackgrounded` 미설정 | true |
| A5 | 호출 `mode:'foreground'` · 작업 `isBackgrounded:false` · snapshot 없음 | false |
| A6 | A2 뒤 새 세대 이벤트 1건 — 같은 `toolUseId` | false |

### 규칙 B — listen 판정 `hasPending(sessionId) = backgroundPending(getState(sessionId))` (VP-04·VP-06)

| 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|
| B1 | 정본 없음 | false | `background-tasks.test.ts` 신규 |
| B2 | 연결 `terminated` — 직전까지 live 작업 1 | false | 신규 |
| B3 | 연결 `resynchronizing` | true | `shared/background-task.test.ts`:"reinitialize requires a fresh snapshot to restore connected state" |
| B4 | `connected` + snapshot에 작업 1 | true | 신규 |
| B5 | 영수증만 온 호출(`awaitingTask`) | true | `shared/…`:"keeps explicit launch pending until its first live snapshot" |
| B6 | 포그라운드 작업(`isBackgrounded:false` · unknown · running) | false | `shared/…`:"is_backgrounded:false 로 시작해 unknown·running 인 태스크는 대기가 아니다" |
| B7 | 백그라운드 작업 unknown · running | true | `shared/…`:"백그라운드·미설정 unknown·running 은 계속 센다" |
| B8 | snapshot에서 빠진 running 작업(`excluded`) | false | 신규 — 규칙 C2와 같은 입력 |
| B9 | 중단 `requested`·`acknowledged`인 백그라운드 작업 | true | 신규 |

B3·B5·B6·B7은 reducer 수준 기존 좌표다(VP-09). tracker 수준에서 `hasPending`이 그 판정을 그대로 돌려주는지는 B1·B2·B4·B8·B9 신규 5건이 `tracker.observe` 진입으로 본다.

### 규칙 C — 레벨 신호(이벤트 누락 시 고착 방지) (VP-04)

| 분기 | 입력 | 기대 |
|---|---|---|
| C1 | 첫 snapshot이 작업 1개를 담는다 | `count` 1 · 그 작업 `included` — 첫 수신부터 live 집합을 교체한다 |
| C2 | 종료 통지 없이 다음 snapshot에서 그 작업이 빠진다 | `hasPending` false · `count` 0 · 작업 `status`는 `running` 그대로(종료를 지어내지 않는다) |
| C3 | 빠진 뒤 같은 작업의 `started`가 다시 온다 | `liveMembership:'unknown'` · `hasPending` true |
| C4 | 새 세대 첫 이벤트 | `count` 0(`liveKnown` false) — 이전 세대 집합이 새 세대 작업을 지우지 않는다 |

### 규칙 D — watchdog(채널 사망·확정 없음) (VP-04)

| 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|
| D1 | live 작업 1 → `background.connection terminated` | `hasPending` false · `count` 0 · 작업 `status` 불변 — 합성 `failed` 없음 | `background-tasks.test.ts` 신규 |
| D2 | 중단 ACK 뒤 15초 안에 종료 통지 없음 | `background.control unconfirmed` | 기존 `background-controller.test.ts`의 미확인 케이스 — 구현자가 케이스명을 좌표로 적는다. 없으면 신규 |
| D3 | `waitForTask` — 정본에 그 `toolUseId`의 작업이 있고 종료 통지가 오지 않음 | `timeout` → `stopSubagentTask`가 `onWatchdog` 호출 뒤 reject | `background-tasks.test.ts` 신규(정본 시드) + 기존 `stop-subagent.test.ts` |
| D4 | `waitForTask` — 정본 없음 / 종료 통지 도착 | 즉시 `settled` / 통지 시 `settled` | `background-tasks.test.ts` 신규 2입력 |

### 규칙 O — OpenCode 불변식 입력 (VP-03 · UT `activity.test.ts`)

| 입력 | 기대 |
|---|---|
| O1 | `task` 파트 `running` · `metadata.background:true` · 첫 관측 | 같은 호출 `providerEvents`에 `background.task started`(`isBackgrounded:true`) + `background.call`(`mode:'background'`) |
| O2 | 같은 child가 먼저 포그라운드로 관측되고 나중에 `background:true` | 첫 호출 `background.call`(`foreground`) · 나중 호출 `background.task started` |
| O3 | `task` 파트 `error` · `background:true` | `background.task notification`(`status:'error'`) |
| O4 | `bash` 파트 · `metadata.background:true` | `background.call`(`mode:'background'`) |
| O5 | `task` 파트 `pending` | `providerEvents` 빈 배열이고 `ownedSessions()`에 child가 없다 |
| O6 | 백그라운드 child의 완료 입력(`nativeTaskCompletion`) | `background.task notification`(`isBackgrounded:true` · 그 status) |

O1~O4·O6 뒤 공통 단언: `ownedSessions()`가 돌려주는 child마다 지금까지 나온 `providerEvents`에 그 부모 `toolUseId`의 `background.call`이 있다.

### 강제 지점

| ID / pair | 규칙 | 누가 | 언제 강제(자리) | 자리 검색 (`app/src/main`, `-g '!*.test.*'`) | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 / VP-05 | main은 normalized 이벤트로 tracker에 쓰지 않는다 | 구현자 | 삭제 4자리 `turn-coordinator.ts:492,494,543,545` + 정리 4자리 `send.ts:507` · `settle.ts:177,180,217` | `rg -n "backgroundTasks\.(started\|settled\|markAsyncLaunched\|clear)\(\|tracker\.(settled\|clear\|ids)\("` → 0 | 원천이 둘로 남는다 |
| EP-02 / VP-05 | 정본 유무로 경로를 가르지 않는다. `getState`는 필수다 | 구현자 | 스위치 4자리 `settle.ts:176` · `turn-coordinator.ts:140` · `index.ts:78,93` + `getState` 4자리 `turn-coordinator.ts:141,289,593` · `index.ts:112` | `rg -n "hasCanonical"` → 2줄(tracker 정의 · `background-controller.ts:62`) · `rg -n "getState\?\."` → 0 | 죽은 분기가 남거나, child 도구 정착 대상이 달라진다(§4) |
| EP-03 / VP-06 | 합성 정착 deps가 없다 | 구현자 | 18자리 — `index.ts` 4 · `deps.ts` 2 · `runtime-entry.ts` 2 · `post-turn.ts` 4 · `turn-request.ts` 2 · `send.ts` 4 | `rg -n "settleDeadBackgroundTasks\|stopAndSettleAbortedTasks\|settleTrackedTasks\|settleTaskSubset\|stopTasks"` → 0 | 항상 no-op인 호출이 남는다 |
| EP-04 / VP-04 | tracker에 구 추적 표면이 없다 | 구현자 | `background-tasks.ts` — 멤버 10(`bySession`·`levelEstablished`·`started`·`settled`·`markAsyncLaunched`·`applyLiveSet`·`resetLevel`·`clear`·`ids`·`hasAny`) | `rg -n "bySession\|levelEstablished\|applyLiveSet\|resetLevel\|markAsyncLaunched" features/chat/background-tasks.ts features/chat/turn-coordinator.ts` → 0 | 구 추적이 남는다 |
| EP-06 / VP-03 | OpenCode의 child 등록·표시는 정본 push와 한 호출에 있다 | (코드 불변) 검증자 | 4자리 — `activity.ts:112,173,219` push · `:169` 표시 | §8 전수 조사 표의 두 명령 | 정본 없는 백그라운드 작업 — 스위치 제거의 동치가 깨진다 |
| EP-07 / VP-05 | 선택자 소비처는 정본 답을 받는다 | 구현자 | 9자리 — `isAsyncLaunched` 3 · `hasPending` 2 · `count` 2 · `waitForTask` 1 · `controller.state`의 `getState` 1 | §8 표의 세 명령 | 소비처가 낡은 의미를 가정한다 |
| L1~L6 / VP-08 | 장부 완전성(A표 ID·분류 · A-2 집합·배타 귀속 · Decision 실재 · C표 이월 2행 ↔ INDEX 후보 표) | 구현자 | `ledger.md` 표 4개 · `INDEX.md` 후보 표 | G1·G2·G4·G14 | 후보·단계가 귀속 없이 남거나 이월이 보드에서 사라진다 |

### 선언 경계 — 게이트가 green인 채로 남는 차이

1. DEV mock의 백그라운드 시나리오가 저하된다(§5 표 4행 — D-023). mock 세션은 정본이 없어 `canonicalBackground`가 빈 상태를 받으므로, 턴 종료 시 열린 child 도구도 정착 대상이 된다(`settle.ts:109`). 어느 것도 자동 oracle로 잠그지 않는다 — SDK층 mock handoff가 다시 정한다.
2. 턴-국소 id 표(`subagentTaskIds`·`subagentTypes`·`stoppedSubagents`)는 `subagent.task`에서 채우는 중단 요청 장부이며 남는다. 백그라운드 **상태**가 아니라 요청 상관표라 D-011의 "상태 짐작"에 넣지 않았다.
3. AC3은 O1~O6 입력 범위의 잠금이다. OpenCode SDK가 여기 없는 방식으로 백그라운드 작업을 알리는 경우(새 도구 종류·새 메타데이터 키)는 다루지 않는다 — 현재 매퍼가 인식하는 형태는 `task`·`bash` 둘이다(`activity.ts:195`).
4. 합성 정착 deps를 지우면 `await` 한 번(항상 이행된 Promise)이 사라져 마이크로태스크 한 틱이 준다. VP-06 기존 스위트가 순서 회귀를 보지만, 그 스위트가 덮지 않는 겹침 순서는 재지 않았다.
5. D-011의 "모든 하네스가 어댑터 안에서 정본으로 정규화한다"는 Claude·OpenCode에서만 성립한다. mock은 후속 handoff까지 예외다(D-022).
6. 장부 게이트(G1·G2·G4)는 귀속의 존재와 좌표 실재만 본다. Decision 문장이 그 단계를 가리키는지는 검증자 대조다.
7. 0307~0313 verify의 PASS는 "기계 범위"다. 장부의 `DONE`은 사람 실기 완료를 뜻하지 않는다 — 장부 머리에 적는다.

## 11. 구현 설계

커밋 단위(단계마다 커밋 — 0305 D-007 상속):

| 단계 | 내용 | AC |
|---|---|---|
| M0 | 잠금 먼저 — 규칙 A~D 신규 케이스를 **현재 코드에서** 정본 시드로 추가해 green 확인(정본 분기는 이미 있다) · OpenCode O1~O6 | AC3·AC4 |
| M1 | 구 추적·스위치·합성 정착 deps 제거 · 포트 축소 · 테스트 시드 이전 | AC5~AC8 |
| M2 | 문서 2건 + `ledger.md` + 구현 보고 | AC11·AC12 |

순서 근거: M0이 앞이어야 M1의 삭제가 정본 분기를 건드렸을 때 red가 난다.

### M1 세부

| 파일 | 변경 |
|---|---|
| `background-tasks.ts` | EP-04 멤버 삭제 · 포트 2메서드 · `hasPending`/`count`/`isAsyncLaunched`/`waitForTask`는 `getState` 한 줄에서 출발 · 머리 주석을 현재 역할로 교체 |
| `turn-coordinator.ts` | `:487-496` · `:537-547`의 tracker 쓰기 블록 삭제(`openToolRuns.delete`는 남긴다) · `canonicalBackground`는 `sessionId ? getState(sessionId) : undefined` · `getState?.` → `getState` · `:497-504` 0212 주석을 한 줄(레벨은 provider 경로가 소비)로 |
| `settle.ts` | `settleTrackedTasks`·`settleTaskSubset`·두 interface 삭제. `settleSubagentTask`·`stopLiveSubagent`·`settleOpenToolRuns`·`settleOrphanToolRuns` 유지 |
| `stop-subagent.ts` | `StopSubagentTracker`에서 `settled` 삭제 · 머리 주석의 "watchdog 이 합성 정착" 문장을 현재 동작(reject)으로 |
| `features/chat/post-turn.ts` | `AbortResumePolicy`에서 `stopTasks` 삭제 — `{ resume: boolean }` |
| `app/chat-turn/index.ts` | 두 정착 클로저와 `runtimeDeps` 두 키 삭제 · `:67-99` 주석 정리 |
| `deps.ts` · `runtime-entry.ts` · `turn-request.ts` · `send.ts` | deps 필드와 호출 삭제 · `send.ts:505-507`의 `clear` 호출과 그 주석 삭제 |
| `app/chat-turn/post-turn.ts` | `settleAbortedTasksOnce`·`settledAbortedTurns` · `:109-111` · `:114-118` · `:242-247` 삭제. `delete activeTurn.abortContinuation`은 남긴다 |

### 테스트 가능성

- tracker·`OpenCodeActivity`는 electron·DB 비의존이라 unit 풀이다.
- mock 시나리오 테스트(`mock.test.ts`·`mock-scenarios.test.ts`)는 어댑터 출력만 본다 — 구 추적 제거에 영향받지 않아야 한다. 영향받으면 그 케이스를 보고한다.
- 정본 시드는 `tracker.observe(event)`다. 시드 헬퍼가 필요하면 테스트 파일 안에 둔다 — production export를 늘리지 않는다.
- 구 API fake(`hasCanonical`·`hasAny`·`ids`·`clear`·`settled` 키)를 가진 테스트 조립은 포트에 맞춰 줄인다 — `typecheck:test`가 남은 키를 잡지 못하는 `as never` 조립(`chat-turn.background-subagent.test.ts:42` 등)은 구현자가 `rg`로 찾는다.

## 12. End-to-end 영향

| producer | 정규화/상태 | consumer |
|---|---|---|
| Claude SDK 메시지 | `ClaudeBackgroundMapper` → 정본(불변) | tracker 선택자 → post-turn·coordinator·stop·activity projector → renderer(불변) |
| OpenCode SDK 이벤트 | `OpenCodeActivity` → 정본(불변) | 같음 |
| mock 시나리오 | 정본 없음 — tracker는 빈 상태 | 선택자가 전부 기본값(대기 아님 · 0 · false) |

부팅/등록 변경: 없음.

## 13. Lifecycle / 오류 / 정리

| 시점 | 변경 전(정본 없는 세션) | 변경 후 |
|---|---|---|
| 콜드 spawn 전(`runtime-entry.ts:101`) | 구 추적 합성 정착 + clear | 없음 — 새 세대 첫 이벤트가 이전 세대를 `retiredGenerations`로 보낸다 |
| 채널 사망 | 합성 `failed` | 런타임이 `terminated`를 낸다(`session-runtime.ts:830-843`) |
| owner 소멸(`send.ts:505-507`) | `clear` | 없음 — 런타임 폐기가 `terminated`를 낸다 |
| 세션 삭제 | `dispose` | 같음 |
| listen 중 사용자 중단 | 합성 `stopped` | 없음 — 백그라운드 수신 보존(`background-tasks.md:25`) |

## 14. 성능 / 상한 / 최적화

- production 경로: coordinator의 이벤트당 tracker 호출 4곳과 chat-turn의 `hasCanonical` 조회 3곳이 사라진다. 더해지는 작업은 없다.
- `hasPending`은 `getState` 맵 조회 1회 + `backgroundPending`(기존과 같은 계산)이다.
- 잃는 부수 효과: 합성 정착이 열린 child 도구에 붙이던 `tool.call.completed`(정본 없는 세션 한정) — mock만 해당한다(D-017 · D-023).

## 15. 외부 구현 포트 / 문서 계약

계약 타입 변경 없음. `background-tasks.md`에 어댑터 계약과 DEV mock의 현재 상태를 적는다(AC12).

## 16. 기존 결정·규칙과의 관계

| 결정 / 규칙 | 관계 |
|---|---|
| 0307 D-004 C-33·C-34 보류 | 대체 — C-34 3단계 구현(D-015) · 4단계와 C-33 종결(D-004) |
| 0307 D-009 · 0313 D-010 (C-26·스위치 미구현) | 대체 — 스위치 4곳 구현, 9곳은 D-009 근거로 종결(D-016) |
| 0136·0143 구 추적 · 0149 `settleTrackedTasks` · 0212 `applyLiveSet` | 제거 — 0231 정본이 대체했고 남은 소비자는 mock뿐이었다(mock은 D-022 후속) |
| 0143 "listen 중단은 태스크도 멈춘다" | 정본 세션에서 이미 비활성. 채택 문서는 "수신 보존"이다 — 유지 |
| 0231 정본 계약(`background-tasks.md`) | 유지 · 유일 경로로 승격 |
| `src/main/AGENTS.md` 레이어 DAG | 유지 — 새 모듈 없음 |
| `app/AGENTS.md` 테스트 규칙(풀 분류·시간 예산) | 신규·수정 테스트 파일마다 판정한다 |
| 후보 표 0308 독립 행(`background-controller.ts` `dispose` 타이머 미잠금) | 이번 변경이 그 파일을 건드리지 않는다 — 승격 없음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 대응 |
|---|---|
| 정본 없는 세션에 child 도구가 있어 정착 대상이 달라진다 | AC3(OpenCode 불변식) · VP-05 변이 (m) |
| `await` 제거로 턴 뒤 루프의 겹침 순서가 달라진다 | VP-06 기존 스위트 · 경계 4 |
| 테스트 이전이 기대값 수정으로 번진다 | AC7 주의사항 · AC8 대응표 |
| DEV mock 저하가 후속 handoff 없이 방치된다 | INDEX 후보 표에 등록한다(AC11 · G14) |
| "4곳"·D-017·D-020 해석이 사용자 뜻과 다르다 | 완료 보고에서 알린다. 다르면 ΔV |

## 18. 영향 받는 파일 / 문서

| 파일 | 변경 |
|---|---|
| `app/src/main/features/chat/{background-tasks,turn-coordinator,settle,stop-subagent,post-turn}.ts` (+tests) | 제거·축소 |
| `app/src/main/app/chat-turn/{index,deps,runtime-entry,post-turn,turn-request,send}.ts` (+tests·testfixture) | deps 제거 |
| `app/src/main/adapters/opencode/v1/activity.test.ts` | 불변식 케이스 추가 |
| `docs/arch/backend/background-tasks.md` · `provider-runtime.md` | 현재 상태 반영 |
| `docs/handoff/0314-0305-derivative-closeout/ledger.md` · `plan.md` · `docs/handoff/INDEX.md` | 장부 · 구현 보고 · 보드(후보 표 2행은 이 설계 커밋이 넣는다) |

## 19. 게이트

`L=docs/handoff/0314-0305-derivative-closeout/ledger.md`. 장부 표는 `<!-- table:A -->` … `<!-- /table:A -->`(A-2 · B · C도 같은 꼴) 사이에서 읽는다.

| ID | 명령(요지) | green 조건 |
|---|---|---|
| G1 | `node -e`: A 구간 ID·분류를 `0305 data/candidates.json`·§5 고정 분류와 양방향 차집합 | ∅ · 중복 0 · 14/9/16 |
| G2 | `node -e`: A-2 구간 (후보, 단계)를 `audit.md` `gen:decomposition`과 양방향 차집합 · 귀속 칸 배타 | ∅ · 58행 · 행마다 `—` 정확히 1 |
| G4 | `node -e`: 장부의 `NNNN D-NNN` 좌표마다 해당 plan의 `^\| D-NNN \|` 줄 수 | 전부 1 |
| G5 | `cd app && node scripts/check-doc-inventory.mjs --check` | exit 0 |
| G6 | `git log -1 --format='%(trailers:only=true)'` (커밋마다) | 파싱됨 |
| G7 | §10 EP-01·EP-03·EP-04의 `rg` 3개 | 전부 0줄 |
| G8 | `rg -n "hasCanonical" app/src/main -g '!*.test.*'` · `rg -c "\?\.\(" app/src/main/features/chat/turn-coordinator.ts` | 2줄 · 9 |
| G9 | `git diff --stat 2479aa4..HEAD -- app/src/renderer app/src/preload app/src/shared docs/handoff/0305-code-bloat-audit` | 출력 없음 |
| G10 | `cd app && npm run lint && npm run typecheck` | 0 error |
| G11 | `cd app && node scripts/check-migrations-appendonly.mjs && node scripts/check-product-naming.mjs && node scripts/check-test-budgets.mjs` | exit 0 |
| G12 | `cd app && ./node_modules/.bin/vitest run`(필터 없음) | 실패 집합 − `2479aa4`의 실패 집합 = ∅(환경 서명만) |
| G13 | `cd app && node --test scripts/*.test.mjs` | 전건 통과 |
| G14 | `node -e`: C 구간 행 수와, `INDEX.md` `## 새 handoff 후보` 표에서 출처가 `0314`인 행 수 | 2 · 2 |
| G15 | `git diff --stat 2479aa4..HEAD -- app/src/main/adapters/claude/mock.ts app/src/main/adapters/claude/mock-scenarios.ts` | 출력 없음 |

G3은 rev.1의 `app/**` diff 0 게이트였고 D-003과 함께 폐기했다(G9가 좁혀 잇는다). 구현자는 G1·G2·G4의 명령 전문과 G12의 기준선 실패 목록을 구현 보고에 적는다.

## READY self-review

- [x] Decision Ledger: ACTIVE 16 · SUPERSEDED 7(대체 ID 연결) · OPEN 0.
- [x] Part I이 구현 방식 없이 완료 상태(원천 하나 · 프로덕션 화면 불변 · 장부)를 설명한다.
- [x] 턴 2 문장 6개 · 턴 3 문장 2개 · 질의 답 1개를 원문으로 인용했다. "제거"를 이동으로, "이월"을 종결로 바꾸지 않았다(D-017 · D-021).
- [x] 사용자에게 물을 결정과 조사로 닫을 사실을 갈랐다 — 제거 시점은 물었고(질의 1), 해석 3건은 표시하고 보고한다.
- [x] 수치 실측: 8·4·4·19·4·4·1·4·3·5(§8) · 13→9 · 39 · 58.
- [x] 저장소 규칙: main 레이어 DAG · 테스트 풀·예산 · 문서 가드 · 후보 표 겹침 행(§16).
- [x] AC마다 동작 기준·검증 수단·도달 경로.
- [x] Baseline V — 상속 없음. 정본 reducer는 `INHERITED`로 `REGRESSION`(VP-09).
- [x] NEW·CHANGED 노드 7개에 같은 레벨 REQUIRED pair(VP-03~08).
- [x] 영향받은 상위 동작(턴 뒤 루프)은 SD-01 `CHANGED`로 VP-06.
- [x] pair마다 path · §10 자리와 검색 명령 · oracle 좌표 · 적대 증거와 이유.
- [x] 규칙 칸 ↔ 입력 칸: A 6 · B 9 · C 4 · D 4 · O 6 — 분기마다 입력.
- [x] 선언 경계 7건 — 재지 않은 것(경계 1·4)을 보호로 적지 않았다.
- [x] 열린 입력 집합 판정 산출물 아님(검사기·스캐너를 만들지 않는다).
- [x] 운영 gate G5·G6·G10~G13.
- [x] 사람 실기 없음 — 로직은 UT·IT로 내렸다.
- [x] structural proxy: 음성 G7·G8을 양성 AC4와 짝지었다.
- [x] "있다" 불변식: 정본 분기 제거·맞바꿈 변이 (i)(j)(k)(l).
- [x] 배타 상태: 포트 2메서드 필수 — 선택 표기 없음.
- [x] 참조 구현 없음 · 신규 모듈 없음.
- [x] producer/consumer(§12) · 기존 소비처 9자리(EP-07).
- [x] worst-case·one-way door 없음 — 삭제만 한다.
- [x] 본문 ↔ Ledger 교차검증: 갱신 메모 `충돌 0`. §5 "네 동작" 표 ↔ §10 A~D ↔ AC4 대조.
- [x] 산출물 문장 규칙.

---

## [구현자 기입] 설계 리뷰

(구현 턴에 기입)

## [구현자 기입] 강제 지점 전수 (§10 대조)

(구현 턴에 기입)

## [구현자 기입] 이번 라운드 수정의 잠금

(구현 턴에 기입)

## [구현자 기입] Product/UX 파생 검토

(구현 턴에 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응

(구현 턴에 기입)

## [구현자 기입] 구현 보고

(구현 턴에 기입 — `삭제 케이스 대응표`(AC8) 포함)

## [구현자 기입] Review Signals — 사실만

(구현 턴에 기입)

## [검증자 기입] 파생 이슈

(검증 턴에 기입)

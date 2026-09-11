# Plan — 0234-conditional-task-tools

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md).
> **조사 정본은 [`0230 §0.7`](../0230-background-task-ux-conformance/plan.md)** — 여기서 다시 적지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0234-conditional-task-tools` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 0230~0236 분할의 **5번**(실행 순서). 담당 = G5(F-15~F-19) |
| 상태 | **DRAFT** — 0230 구현 후 READY 승격. §6 의 A/B 분할 결정이 선행 |
| V mode | `Delta V` 후보 — 0230 의 `AR-01`(`taskKind`)·`AR-02`(런치 영수증)를 확장한다 |
| 기준 V | `0230:V1@<구현 커밋>` (확정 시 기입) |
| 이번 V revision | `ΔV1` |
| 유효 V | `0230 V1 + ΔV1` |

**선행**: 0230. `taskKind` 어휘에 `monitor`·`workflow` 가 이미 들어 있고, 런치 영수증 술어가
확장 지점이다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: `Monitor`·`Workflow`·분리 `Skill`·원격 Agent 는 **차단되어 있지 않다**.
  설치본 CLI 가 주면 모델이 지금도 부르고, 부르면 잘못 그려진다. 하나는 세션을 유휴로 돌려보내지
  못하는 고착 결함이다.
- 완료 후 달라지는 것: 네 도구가 각자의 실행 카드를 갖고, 시작 실패가 라이브 실행으로 등록되지
  않으며, 원격 실행이 즉시 완료로 보이지 않는다.
- 성공을 사용자 관점에서 한 문장으로: 모델이 무엇을 띄우든 화면이 그것의 실제 상태를 말한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "스펙전면대응을 자세하게 나열해줘" → "f15~19 자세히" | 라이브 세션 2026-09-11 |
| 명시 요구 | "g7까지 핸드오프 문서를 분할하여 작성하라" | 같은 턴 |
| 설계자 권고 | "F-16 ②·F-18 ②·F-19 ②는 새 화면 없이 판정 한 줄씩으로 닫힌다. 새 카드와 같은 항목으로 묶으면 값싼 결함 수정까지 함께 밀린다" | 앞 턴 답변. 사용자 미확정 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-401 | `Workflow` 결과에 `error` 가 있으면 `status:'async_launched'` 여도 **라이브 실행으로 등록하지 않는다** | 스펙 §1 Workflow 필수: "구문 검사 실패 시 … 실행은 시작되지 않는다" | 첨부 스펙 | ACTIVE |
| D-402 | 원격 Agent(`remote_launched`)는 **완료가 아니다**. 원격 실행 상태로 둔다 | 스펙 §1 Agent 결과 판정표: "원격 실행. 로컬 프로세스 수명과 구분" | 첨부 스펙 | ACTIVE |
| D-403 | 분리 `Skill` 은 `taskId` 를 **합성하지 않는다**. `task_started.tool_use_id` 로만 연결한다 | 스펙 §1 Skill 필수 | 첨부 스펙 | ACTIVE |
| D-404 | `TaskOutput`/`TaskStop` 미채택(⛔)은 **유지**한다 | 0204 D-010·D-011 과 스펙이 일치한다 | `claude-taskxxx-spec.md:111-124` | ACTIVE |
| D-405 | 모델이 부른 `TaskStop` 의 정착은 "사용자에 의해 중단됨" 으로 말하지 않는다 | F-19 ② — 행위자 오표시 | §0.7 | ACTIVE |
| D-406 | A/B 분할 — A(판정 3건: F-16②·F-18②·F-19②) 를 먼저 하고 B(새 카드 4종)를 나눌 것인가 | **OPEN** — 사용자 결정 | — | **OPEN** |
| D-407 | `Monitor`·`Workflow` 를 `RISKY_TOOLS` 에 넣을 것인가 | **OPEN** — 둘 다 프로세스를 띄운다. 현재 목록은 `Bash`·`PowerShell`·편집 4종이다 | `risky-tools.ts` | **OPEN** |

### 갱신 메모

- 새로 추가: D-401~D-407.
- 0230 승계: D-004(종류 우선순위) · D-007(런치 영수증 술어).
- **`ACTIVE 결정 ↔ AC` 대조**: READY 승격 시 수행.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 네 도구의 운명이 `isAsyncLaunchedPayload` 한 술어에서 갈린다(§0.7 표) |
| 이미 기존 코드가 충족하는가 | 아니오 | `rg Monitor\|Workflow\|remote_launched app/src` → 각 0건 |
| 더 작은 해법이 있는가 | **있다 — D-406** | 판정 3건은 새 화면 없이 닫힌다. 새 카드 4종은 그보다 크다 |
| 선행 자료의 주장을 코드와 대조했는가 | 부분 | 결과 payload 형태는 **스펙 기준이며 코드 관측이 아니다**. 실제 로그 확인이 이 handoff 의 선행 조사다 |
| ACTIVE 결정과 충돌하는가 | 아니오 | D-404 가 0204 D-010 을 그대로 잇는다 |

- **사용자에게 올릴 결정**: D-406(A/B 분할) · D-407(위험 도구 등록).
- **가용성 전제**: 네 도구가 실제 세션에 나타나는지 먼저 확인한다. 나타나지 않으면 이 handoff 는
  "노출되지만 시험하지 않음" 이 아니라 **"가용하지 않음"** 으로 기록하고 범위를 A 로 줄인다 —
  스펙 §3: "노출되지만 아직 시험하지 않은 기능을 가용하지 않다고 표시하여 통과시키면 안 된다".

## 5. 동작 / 사용자 흐름

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| `Workflow` 결과에 `error` | 라이브 등록하지 않고 실패로 정착 | "워크플로 시작 실패" + 사유. 배지 증가 없음 |
| `Workflow` 정상 시작 | `taskId`·`runId`·`transcriptDir` 보존 | 워크플로 카드 — 내부 에이전트 진행·`blocked` |
| `Monitor` 시작 | 런치 영수증으로 추적 유지 | 감시 카드 — 대상·경과·타임아웃 잔여 |
| `Monitor` `persistent: true` | CLI 종료 후 생존을 **가정하지 않는다** | 카드가 "지속 감시" 라벨만 붙인다 |
| 분리 `Skill` 시작 | `task_started` 가 오면 연결. 안 오면 연결하지 않는다 | 스킬 카드 또는 현행 일반 카드 |
| 원격 Agent 시작 | 원격 실행 상태 | 원격 카드 — 세션 링크·상태·출력 |
| 원격 중 로컬 종료 | 원격 결과를 확정하지 않는다 | "원격 상태 확인 불가" |
| 모델이 `TaskStop` 호출 | 행위자 = 모델 | "모델이 중단함" (D-405) |

## 6. 범위 / 비범위

**A — 판정 3건 (새 화면 없음)**

- F-16 ②: `Workflow` 시작 오류를 라이브 등록에서 제외.
- F-18 ②: `remote_launched` 를 완료로 파생하지 않음.
- F-19 ②: 중단 행위자 구분.

**B — 새 카드 4종**

- F-15 Monitor · F-16 ①③④ Workflow · F-17 분리 Skill · F-18 ①③ 원격 Agent · F-19 ①(영속 위생).

- **비범위**: `TaskOutput` polling(D-404 로 영구 제외) · 원격 실행의 취소 보장(환경 검증 필요) ·
  `workflow_agent` 전체 진행 스키마(스펙도 "검증 필요").

## 7. Requirements / Acceptance (초안)

### A 그룹

| R | AT | 동작 기준 |
|---|---|---|
| R-401 | AT-401 | `async_launched` + `error` 결과가 라이브 백그라운드 집합을 증가시키지 않는다 |
| R-401 | AT-402 | 같은 결과가 실패로 정착하고 사유를 말한다 |
| R-401 | AT-403 | `error` 없는 `async_launched` 는 **기존대로** 라이브 등록된다 (음성 대조) |
| R-402 | AT-404 | `remote_launched` 결과의 표시 상태가 `completed` 가 아니다 |
| R-402 | AT-405 | 같은 호출이 `task_notification` 전까지 실행 중으로 남는다 |
| R-403 | AT-406 | 모델이 부른 `TaskStop` 의 정착이 "사용자에 의해 중단됨" 을 쓰지 않는다 |

### B 그룹

| R | AT | 동작 기준 |
|---|---|---|
| R-404 | AT-407 | `Monitor` 가 자기 카드로 서고 `taskKind==='monitor'` 로 셸과 구분된다 |
| R-405 | AT-408 | `Workflow` 카드가 `runId`·`transcriptDir` 를 보존한다(정착이 덮지 않는다) |
| R-406 | AT-409 | 내부 에이전트 완료가 워크플로 전체 완료로 처리되지 않는다 |
| R-407 | AT-410 | 분리 `Skill` 이 `task_started` 없이는 작업과 연결되지 않는다 (D-403 음성 단언) |
| R-408 | AT-411 | 원격 카드가 `sessionUrl` 진입점을 갖는다 |
| R-409 | AT-412 | 로컬 종료 후 원격 작업이 성공/실패로 확정되지 않는다 |

> AT-403 · AT-410 · AT-412 가 이 handoff 의 음성 축이다. 셋 다 "하지 않는다" 를 잠그므로 각각
> 짝이 되는 양성 단언(AT-401·AT-407·AT-411)과 함께 읽어야 방향이 선다.

## 7-A. V / Trace Matrix (Delta 초안)

| Node | 레벨 | provenance | 기준선 출처 / 대체 |
|---|---|---|---|
| AR-02 | AR | **CHANGED** | 0230 `AR-02`(런치 영수증) — `remote_launched`·`error` 동반 케이스가 추가된다 |
| AR-01 | AR | INHERITED | 0230 `AR-01`(`taskKind`) — 어휘를 소비만 한다 |
| R-401~R-409 | R | NEW | — |
| MD-401 | MD | NEW | 런치 영수증 판정의 결과 종류별 분기 |

- `AR-02` 가 `CHANGED` → 0230 `VP-02`·`VP-07` 를 **`REGRESSION`** 으로 다시 닫는다.
- 0230 `VP-04`(정착 kind 게이트)는 이 경로가 닿는다 → `REGRESSION`.
- 0230 `VP-05`·`VP-09`(셸 투영·영속)는 닿지 않는다 → `NOT_REQUIRED`, 기존 증거는 0230 verify.

---

# Part II — Technical Design (방향)

## 8. Research — 이미 확인한 것

| 발견 / 제약 | 근거 |
|---|---|
| 거부 목록은 `Bash`·`WebSearch` 둘뿐 | `claude.ts:432` |
| `allowedTools: []` 는 제목 생성 query 의 것 | `claude.ts:272` (`maxTurns:1`) |
| 런치 영수증 술어가 리터럴 하나다 | `shared/subagent.ts` |
| 술어가 거짓이면 추적 해제 | `turn-coordinator.ts:514-522` |
| 상태 파생이 "결과 있음 + 에러 아님 → completed" 다 | `parts.ts` `deriveSubagentTaskStatus` |
| 통지 행 제목 조인이 Agent 이름으로 좁다 | `parts.ts:283` |
| 미지 도구는 `KeyValueBody` 로 떨어지고 동사는 "사용" | `registry.ts`; `toolMeta.ts` `toolVerbCategory` default |
| `TaskOutput`/`TaskStop` 은 `structuredOutput` 을 영속하는데 렌더 소비처가 0 | `claude-map.ts:514-517`·`583`; `registry.ts` `task_list` |
| 중단 사유 폴백이 "사용자에 의해 중단됨" | `ko.ts:775` |
| `RISKY_TOOLS` 는 6종 | `risky-tools.ts` |

### 남은 조사 (구현 턴 전에 닫는다)

| 대상 | 방법 | 왜 필요한가 |
|---|---|---|
| 네 도구가 실제 세션의 `init.tools` 에 나타나는가 | 실행 로그 | 가용성 전제(§4) |
| 각 결과 payload 의 실제 형태 | 실행 로그 | 지금은 스펙 기준 추론이다 |
| `workflow_agent` 이벤트의 최상위 `type` | 배포물 `.d.ts` + 로그 | 스펙도 "검증 필요" 로 남겼다 |
| 원격 Agent 가 이 배포 조합에서 가용한가 | 환경 확인 | 가용하지 않으면 F-18 은 기록만 |

## 9~15

D-406 확정 후 작성한다. 고정된 설계 제약:

| 제약 | 이유 |
|---|---|
| 런치 영수증 판정은 **결과 종류별 discriminated union** 으로 돌려준다 — boolean 이 아니다 | `agent-async` · `shell-background` · `workflow` · `remote` · `none` 이 서로 다른 후속 처리를 갖는다 |
| `Workflow` 의 `error` 검사는 **등록보다 앞**이다 | D-401. 등록 후 취소하면 배지가 한 번 깜빡인다 |
| 원격 실행 상태는 로컬 종료 상태와 **다른 축**에 저장한다 | 스펙 §2 연결 축 — 로컬 종료가 원격 결과를 확정하면 안 된다 |
| 중단 행위자는 정착 이벤트가 나른다. UI 가 폴백으로 추측하지 않는다 | D-405 |
| 새 카드는 0230 의 `backgroundTasksFromMessages` 포함 술어를 **확장**한다. 새 fold 를 만들지 않는다 | 0215 의 "두 타일이 같은 것을 그리던 중복" 재발 방지 |

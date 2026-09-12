# Plan — 0231-background-progress-and-turn-state

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md).
> **조사 정본은 [`0230 §0`](../0230-background-task-ux-conformance/plan.md)** — 여기서 다시 적지 않는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0231-background-progress-and-turn-state` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 0230~0236 분할의 **2번**. 담당 = G2(F-04~F-07) + 사용자 제보 ② |
| 상태 | **READY** |
| V mode | `Baseline V`(이 handoff 고유 V1) |
| 기준 V | `none` — 0230 V1 을 상속하지 않는다(§4 참조) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

**선행 해소**: 0230 이 `impl/IMPL_DONE`(r2) 를 지나 `verify/PASS` 까지 갔다. F-07 의 대상인 셸
카드가 섰고 어포던스 규칙(R-03)도 잠겼으므로 §7-A 를 채워 READY 로 올린다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 ①: spark 라인이 "백그라운드 작업 N건" 만 말한다. 얼마나 오래 돌았는지, 지금
  무엇을 하는지, 어디를 눌러야 상세가 나오는지가 없다.
- 해결하려는 문제 ②: 어시스턴트 턴이 끝나고 main 이 백그라운드 작업만 기다리는 구간에서, 사용자가
  보낸 메시지가 **진행 중 응답에 끼어드는 예약(steer)** 으로 그려진다.
- 완료 후 달라지는 것: 백그라운드 실행 표시가 "어시스턴트가 생각 중" 표시에서 **분리**된다.
  어시스턴트 턴은 종료로 보이고, 그 아래에 백그라운드 실행 줄이 따로 서며, 사용자의 다음 메시지는
  정식 사용자 턴으로 보인다.
- 성공을 사용자 관점에서 한 문장으로: 백그라운드 작업이 도는 동안 화면이 "클로드는 답을 마쳤고,
  이 작업이 N분째 돌고 있다" 고 말한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "메시지버블 아래 spark 라인에서 백그라운드 작업 이라는 표현될때 실제로 해당 백그라운드 작업이 얼마나 진행됐는지 확인하고 싶을때가 있다" | 라이브 세션 2026-09-11 |
| 명시 요구 | "main이 백그라운드 작업을 기다리고 있을때, 대화재개가 가능한 상태가 되는데 메시지 전송시 steer로 push되는 uiux로 표현된다. 어시스턴트의 종료 이후 사용자 턴을 기다리는 상태로 되어여 한다." | 같은 턴 |
| 명시 요구 | "원하큰건 정식사용자 턴인데 클로드가 백그라운드 작업이 끝나면 답변하겠다고 턴을 종료하는 상황이어야 한다" | 같은 턴 (질의 응답) |
| 명시 요구 | 진행 정보 위치 = "spark 라인 요약 + 클릭 진입" | 같은 턴 (질의 응답) |
| 추론 의도 | 두 요구는 **같은 표면**이다 — ②가 "생각 중" 표시를 내리라고 하고 ①이 그 자리에 백그라운드 정보를 넣으라고 한다. 한 handoff 로 묶는다 | 설계자 추론 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 백그라운드 진행 정보는 **spark 라인 한 줄 요약 + 클릭 시 상세** | 사용자 선택 | 사용자 턴 | ACTIVE | 0230 에서 승계 |
| D-002 | 백그라운드 대기 구간의 사용자 전송은 **정식 사용자 턴**으로 보이고, 앞의 어시스턴트 턴은 **종료된 턴**으로 보인다 | 사용자 원문 인용(§2) | 사용자 턴 | ACTIVE | 0230 에서 승계 |
| D-101 | "생각 중" spark 라인과 **백그라운드 실행 줄을 분리**한다. 후자는 **transcript 안, 마지막 어시스턴트 턴 아래**에 남는다 — 컴포저 위 고정 바가 아니다 | 사용자 선택. 실행 줄이 어느 턴에서 떠난 작업인지 문맥이 붙고, 다음 사용자 메시지가 오면 위로 밀려 대화 기록의 일부가 된다. 고정 바는 그 문맥이 끊기고 컴포저 세로 공간을 상시 점유한다 | 사용자 턴 | **ACTIVE** | — |
| D-102 | **main 의 커밋 순서 메커니즘(held 큐)은 바꾸지 않는다.** 바뀌는 것은 renderer 의 표시다 | 0153 이 낙관 커밋을 금지한 이유는 DB `idx` 와 라이브 순서가 갈리는 것이었다. 자동 턴이 사이에 끼면 같은 증상이 돌아온다 | `sendAdmission.ts:1-23` | ACTIVE | — |
| D-103 | 진행률(%)은 만들지 않는다. **경과 · 최근 동작 · 요약**만 쓴다 | 스펙 §1 `task_progress`: "이 메시지는 완료 백분율을 제공하지 않는다" | 첨부 스펙 | ACTIVE | — |
| D-104 | 배지 건수는 **런치 영수증이 관측된 작업만** 센다 | F-06 — 현재는 foreground 도 센다. 0230 의 `readLaunchReceipt` 가 판정원이다 | §0.4 F-06 | ACTIVE | — |
| D-105 | 실행 줄 클릭은 **백그라운드 작업 타일의 목록**을 연다 — 개별 작업 상세를 열지 않는다 | 실행 줄은 N건의 요약이라 열 상세가 하나로 정해지지 않는다. 셸은 하위 대화록도 없어 개별 상세가 죽은 어포던스다(0230 R-03). 목록은 두 종류를 다 담고 에이전트 카드는 거기서 다시 상세로 간다 | 설계자 추론 | ACTIVE | — |
| D-106 | 통지 행의 종류 라벨은 `subagentTaskJoin.kind` 하나로 가른다 | 현재 `agentLine` 이 종류와 무관한 고정 문구라 셸이 `Agent "npx vitest run" finished` 로 보인다. 0230 이 같은 자리에 `kind` 를 이미 실어 뒀다 | 0230 verify r2 · D6 | ACTIVE | — |

### 갱신 메모

- 새로 추가된 결정: D-101 · D-102 · D-103 · D-104 · D-105 · D-106.
- 승계: D-001 · D-002 (0230 Decision Ledger).
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** D-001↔AT-107·AT-112 · D-002↔AT-108·AT-109 ·
  D-101↔AT-112 · D-102↔AT-111(held 큐 불변) · D-103↔§7 전체(진행률 AC 0건) ·
  D-104↔AT-105 · D-105↔AT-107 · D-106↔AT-114.
- **`OPEN` 0건.** D-101 이 사용자 턴으로 닫힌 뒤 남은 미정 항목이 없다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | ②는 타당. ①은 **부분적** | ①의 "언제 끝나는지 모른다" 는 0230 의 추적 해제(F-03 ②)가 1차 원인이고, 표시는 2차다. 그래서 0230 이 먼저다 |
| 이미 기존 코드가 충족하는가 | 부분 | `sessionResponding` 이 `transport==='ready'` 에서 이미 스피너를 내린다(`chatStore.ts:1762-1766`). 그런데 `shouldQueueAsPending` 은 `listening` 만 보므로 **두 판정이 갈려 있다** — 화면은 유휴인데 전송은 예약이다 |
| 더 작은 해법이 있는가 | 있다 | 제보 ②의 최소안은 `shouldQueueAsPending` 에 `transport==='ready'` 탈출구 하나다. §8 이 `ready` ⇒ held 없음을 코드로 닫아 D-102 의 순서 위험이 줄었다 — 그래도 AT-111 을 회귀로 남긴다 |
| V 를 0230 에서 상속하는가 | **아니오** | 0230 의 V1 은 셸 작업의 존재·정착 계약이다. 이 handoff 는 그 위에 새 Product 요구를 세우지 기존 V 노드를 바꾸지 않는다 — Delta V 가 아니라 별도 Baseline 이 맞다 |
| ACTIVE 결정과 충돌하는가 | 주의 | 0153(낙관 커밋 금지) · 0167 AC21(foreground 구간 무활동 라벨 금지) · 0208 D-002(스피너는 셋이 분기 없이 같은 것). D-101 의 실행 줄은 **스피너가 아니다** — 별도 컴포넌트라 0208 D-002 의 "분기 없음" 은 유지된다(§9 위험표) |

- **사용자에게 올릴 결정**: 없음 — D-101 이 사용자 턴으로 확정됐다(transcript 안, 마지막 턴 아래).
- 코드 조사로 닫은 사실: `sessionResponding` ↔ `shouldQueueAsPending` 의 판정 불일치.

## 5. 동작 / 사용자 흐름

```text
[어시스턴트가 답을 마치고 백그라운드 작업만 남음]
  → 어시스턴트 턴: 종료 표시 (턴 메타 노출, 스피너 없음)
  → 그 아래 백그라운드 실행 줄: "백그라운드 작업 1건 · 3분 12초 · PowerShell"
      → 클릭 → 우측 패널 `백그라운드 작업` 타일의 **목록**(D-105)
  → 컴포저: 전송 버튼 (중지 아님)
  → 사용자 전송 → 정식 사용자 말풍선 (회색 기울임 아님)
  ↘ 작업 완료 → 완료 통지 행 → CLI 자동 턴이 답변
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| `transport==='ready'` + 백그라운드 작업 있음 | 실행 줄 표시, 스피너 부재 | "작업 N건 · 경과 · 최근 동작" |
| `transport==='listening'`(CLI 실제 진행 중) | 현행 유지 | 스피너 + spark 라인 사실 |
| `tool_progress.subagent_retry` 수신 | 보조 상태 = 재시도 대기 | "재시도 대기 중" — heartbeat 로 해제되지 않는다 |
| `tool_progress.heartbeat` 만 반복 | 연결 생존만 갱신 | 경과는 흐르되 "진척" 을 주장하지 않는다 |
| `task_progress.summary` 수신 | 최신 요약 교체(누적 아님) | 실행 줄 꼬리에 한 줄 요약 |
| 사용자 전송 (위 상태) | main 은 held 로 수용(D-102) | 정식 사용자 말풍선 |
| 사용자 전송 (어시스턴트 실제 스트리밍 중) | 현행 유지 | 회색 기울임 예약 말풍선 |

### 파생 UX / 엣지케이스

- 전환 경계: 실행 줄이 서 있는 동안 CLI 자동 턴이 시작되면 스피너가 다시 뜬다. 두 줄이 동시에
  보이지 않게 한다.
- 취소: 실행 줄을 눌러 목록으로 가면 카드에서 중단한다(D-105). 실행 줄 자체에 중단 버튼은 두지 않는다.
- a11y: 실행 줄은 `aria-live="polite"` 를 이미 쓰는 `StatusLine` 과 **중복 낭독되지 않게** 한다.

## 6. 범위 / 비범위

- **범위**: F-04 `tool_progress` 소비 · F-05 `summary` 보존과 `agentProgressSummaries` · F-06 배지
  의미 정정 · F-07 클릭 진입 · D-002 턴 상태 표현(전송 admission + 어시스턴트 턴 종료 표시).
- **비범위**: 셸 카드 자체(0230) · `output_file` 전체 출력(0232) · `ambient` 필터(0233) ·
  `perTaskStopAffordance`(0235) · main 의 held 큐 메커니즘 변경(D-102).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 실행 줄의 배치(D-101) | **예 — 사용자가 보는 결과** | 확정 — transcript 안, 마지막 턴 아래 |
| `agentProgressSummaries: true` 의 토큰 비용 | 아니오 | 설정 노출 없이 기본 on, 0235 에서 재검토 |

## 7. Requirements / Acceptance

| R | AT | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-101 | AT-101 | `tool_progress` 가 `elapsed_time_seconds` 를 실으면 그 도구 카드가 경과를 보인다 | UT: `claudeToNormalized` 직접 호출 + 순수 렌더 | SDK 메시지 → `claude-map` → `subagent.task` → store → 카드 |
| R-101 | AT-102 | `subagent_retry` 표시는 이후 `heartbeat` 만 와도 해제되지 않는다 | UT: 두 메시지를 순서대로 주입 후 상태 단언 | 같음 |
| R-102 | AT-103 | `task_progress.summary` 가 실행 줄에 한 줄로 보인다 | UT: `patchSubagentMeta` 흡수 + 순수 렌더 | 어댑터는 이미 싣는다 — renderer 흡수만 추가 |
| R-102 | AT-104 | 같은 작업의 두 번째 `usage` 스냅샷이 첫 번째에 더해지지 않는다 | UT: 두 progress 주입 후 값이 **두 번째와 같다** | `accrueSubagentMeta` → `patchSubagentMeta`. **회귀 가드** — 현재 이미 교체다(§8) |
| R-103 | AT-105 | 배지 건수가 런치 영수증 관측분만 센다 | UT: foreground 만 추적된 트래커에서 배지 입력이 `0` | 트래커 → 프로젝터 → `backgroundTaskCount` |
| R-103 | AT-106 | 같은 변경이 턴-후 루프의 대기 조건을 **좁히지 않는다** | UT: foreground 만 추적된 상태에서 `decidePostTurnStep` 이 여전히 `listen` | `post-turn.ts:106` — 배지와 **다른 소비자**다(§10 EP-203) |
| R-104 | AT-107 | 실행 줄을 누르면 백그라운드 작업 타일이 활성화되고 **목록**이 선다 | 순수 렌더: 클릭 핸들러가 타일 활성화 + 선택 해제를 부른다 | 실행 줄 → `chatActions` → `rightPanelTiles` |
| R-105 | AT-108 | `transport==='ready'` + 백그라운드 잔여 상태에서 어시스턴트 턴이 **종료로** 그려진다 | 순수: `sessionResponding` 이 false + 렌더에 스피너 부재 | `chat.activity` → `sessionResponding` → `TranscriptView.pending`. **회귀 가드** — 현재 충족(§8) |
| R-105 | AT-109 | 같은 상태의 사용자 전송이 **정식 사용자 말풍선**으로 그려진다 | 순수: `shouldQueueAsPending` 이 false + 렌더 상태 속성 | `chatStore.ts:892` 호출부 |
| R-105 | AT-110 | 어시스턴트가 **실제 스트리밍 중**이면 여전히 예약 말풍선이다 | 같은 함수의 음성 대조(`transport==='listening'`) | 같음 |
| R-106 | AT-111 | 낙관 커밋과 main 커밋의 순서가 갈리지 않는다 | IT: 자동 턴이 끼어드는 시나리오에서 DB `idx` 순서와 라이브 순서 일치 | 0153 회귀 |
| R-107 | AT-112 | `ready` + 백그라운드 잔여면 마지막 어시스턴트 턴 **아래**에 실행 줄이 선다 | 순수 렌더: 해당 DOM 이 마지막 턴 뒤에 있고 건수·경과 문자열을 담는다 | store 파생 → `Exchange` |
| R-107 | AT-113 | `foreground` 가 `streaming` 이면 실행 줄 대신 스피너다 — **둘이 동시에 서지 않는다** | 같은 렌더의 음성 대조 | 같음 |
| R-108 | AT-114 | 셸 작업의 완료 통지 행이 `Agent` 가 아니라 셸 라벨을 쓴다 | 순수 렌더: 셸 통지에 `Agent "` 부재 + 셸 라벨 존재 | `subagentTaskJoin.kind` → `SubagentNoticeRow` |

- 음성 대조 3건이 방향을 잡는다 — AT-110(스트리밍 중에는 예약 유지) · AT-113(동시 표시 금지) ·
  AT-106(대기 조건을 좁히지 않음).
- AT-104·AT-108·AT-111 은 **회귀 가드**다. 지금 충족하는 동작을 이번 변경이 깨지 않는지 본다.
- **인용한 기존 케이스는 실재한다**(`sendAdmission.test.ts`, 4케이스 확인). MD-102 는 그중
  `턴-후 체인 진행 중(listening) → 예약 (0143)`(`:17-19`)의 계약을 좁히므로 두 케이스로 가른다 —
  `listening + ready → false` · `listening + !ready → true`. `pendingCount` 케이스(`:21-25`)는
  `ready` 와 무관하게 `true` 로 남아야 하고 그것이 VP-210 의 변이다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 근거는 §4 의 "V 를 0230 에서 상속하는가" 행.
- 변경이 시작되는 수준: `R`.

| Node | 레벨 | provenance | 비고 |
|---|---|---|---|
| R-101 | R | NEW | 진행 신호 소비(F-04) |
| R-102 | R | NEW | 요약 보존(F-05) |
| R-103 | R | NEW | 배지 의미(F-06) |
| R-104 | R | NEW | 클릭 진입(F-07) |
| R-105 | R | NEW | 턴 상태 표현(제보 ②) |
| R-106 | R | INHERITED | 커밋 순서 보존(0153) |
| R-107 | R | NEW | 백그라운드 실행 줄(D-101) |
| R-108 | R | NEW | 통지 행 종류 라벨(D-106) |
| SD-101 | SD | NEW | listen 구간의 화면 상태 전이 전 구간 |
| AR-101 | AR | NEW | `tool_progress` → 정규화 계약(최상위 type 별도 분기) |
| AR-102 | AR | CHANGED | 배지 산출 — 트래커에 **두 번째 세기**를 더한다 |
| AR-103 | AR | NEW | 실행 줄 producer(store 파생) → consumer(`Exchange`) 배선 |
| MD-101 | MD | NEW | `sessionAwaitingBg` 파생 |
| MD-102 | MD | CHANGED | `shouldQueueAsPending` — 0153 계약을 좁힌다 |
| MD-103 | MD | CHANGED | `patchSubagentMeta` — `summary` 흡수 |
| MD-104 | MD | CHANGED | 통지 행 라벨 선택 — `subagentTaskJoin.kind` 소비 |

### 검증 pair

| Pair | 레벨 | 노드 | requiredness | production path | 직접 oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|---|---|
| VP-201 | R↔AT | R-101 ↔ AT-101·AT-102 | REQUIRED | SDK `tool_progress` → `claudeToNormalized` → 이벤트 → store → 카드 | 렌더 문자열 | required — `subagent_retry` 를 `heartbeat` 로 덮는 변이 | EP-201 (1) |
| VP-202 | AR↔IT | AR-101 ↔ IT | REQUIRED | 최상위 `type` 분기 → 이벤트 | 정규화 반환값(드롭 경로 미통과) | required — 분기 제거 변이 | EP-201 (1) |
| VP-203 | R↔AT | R-102 ↔ AT-103 | REQUIRED | `task_progress` → `patchSubagentMeta` → 실행 줄 | 렌더 문자열 | not selected — 값 단언 | EP-202 (2) |
| VP-204 | MD↔UT | MD-103 ↔ UT | REQUIRED | `patchSubagentMeta` 단독 | 흡수 결과 객체 | not selected | EP-202 (2) |
| VP-205 | R↔AT | R-102 ↔ AT-104 | REGRESSION | 어댑터 누산부 + store 흡수 | 두 번째 스냅샷 == 결과 | required — 두 지점 중 하나를 `+=` 로 바꾸는 변이 | EP-202 (2) |
| VP-206 | R↔AT | R-103 ↔ AT-105 | REQUIRED | 트래커 → 프로젝터 → `backgroundTaskCount` | 배지 입력값 | not selected — 값 단언 | EP-203 (2) |
| VP-207 | AR↔IT | AR-102 ↔ AT-105·AT-106 | REQUIRED | 트래커 → 두 소비자(배지 · 턴-후 루프) | 두 소비자의 **서로 다른** 값 | required — **형제 맞바꿈**: 두 소비자가 같은 세기를 쓰게 하는 변이 | EP-203 (2) |
| VP-208 | R↔AT | R-104 ↔ AT-107 | REQUIRED | 실행 줄 클릭 → `chatActions` → 타일 상태 | 액션 호출 관측 | not selected | EP-204 (1) |
| VP-209 | R↔AT | R-105 ↔ AT-109·AT-110 | REQUIRED | `chatStore.ts:892` → 술어 → 말풍선 렌더 | 렌더 상태 속성 | not selected — VP-210 이 술어를 본다 | EP-205 (2) |
| VP-210 | MD↔UT | MD-102 ↔ AT-109·AT-110 | REQUIRED | `shouldQueueAsPending` 단독 | 판정 결과 | required — `ready` 탈출구 제거 변이 | EP-205 (2) |
| VP-211 | R↔AT | R-105 ↔ AT-108 | REGRESSION | `sessionResponding` → `TranscriptView.pending` | 스피너 부재 | not selected — 현행 동작 | EP-205 (2) |
| VP-212 | R↔AT | R-106 ↔ AT-111 | REGRESSION | 낙관 커밋 ↔ main 커밋 순서 | DB `idx` ↔ 라이브 순서 | required — `ready` 탈출구가 `pendingCount>0` 를 삼키는 변이 | EP-205 (2) |
| VP-213 | R↔AT | R-107 ↔ AT-112·AT-113 | REQUIRED | store 파생 → `Exchange` → DOM | 렌더 문자열 + 위치 | required — **형제 맞바꿈**: 실행 줄↔스피너 | EP-206 (2) |
| VP-214 | AR↔IT | AR-103 ↔ IT | REQUIRED | **컨테이너 마운트**로 store → 실행 줄 배선 | 컨테이너 렌더 출력 | required — 배선 제거 변이(0230 D1 과 같은 축) | EP-206 (2) |
| VP-215 | MD↔UT | MD-101 ↔ UT | REQUIRED | `sessionAwaitingBg` 파생 단독 | 파생 반환값 | required — 배타 조건 제거 변이 | EP-206 (2) |
| VP-216 | R↔AT | R-108 ↔ AT-114 | REQUIRED | `subagentTaskJoin.kind` → 통지 행 라벨 | 렌더 문자열 | required — **형제 맞바꿈**: 두 라벨을 맞바꾸는 변이 | EP-207 (1) |
| VP-217 | MD↔UT | MD-104 ↔ UT | REQUIRED | 라벨 선택 단독 | 반환 키 | not selected — VP-216 이 렌더까지 본다 | EP-207 (1) |
| VP-218 | SD↔ST | SD-101 ↔ ST | REQUIRED | 턴 종료 → listen → 백그라운드 정착 → 자동 턴 전 구간 | 상태 전이 순서 관측 | not selected — 하위 pair 가 각 구간을 직접 본다 | 0 — 구간 계약이라 단일 지점이 없다 |
| VP-219 | R↔AT | 0208 D-002(스피너 단일 소스) | REGRESSION | `StatusLine` 소비처 | 분기 부재 | not selected | EP-206 (2) |
| VP-220 | R↔AT | 0230 R-03(셸은 상세 진입점을 갖지 않는다) | REGRESSION | 통지 행 · 카드 | 어포던스 부재 | not selected — 0230 이 잠갔다 | EP-207 (1) |

- **합계 검산**: `REQUIRED 15 · REGRESSION 5 = 20 pair`. 레벨 분포 `R↔AT 12 · AR↔IT 3 · MD↔UT 4 · SD↔ST 1 = 20`.
- **노드 대응**: `NEW`·`CHANGED` 노드 15개가 전부 같은 레벨 `REQUIRED` pair 를 갖는다 —
  R-101·102·103·104·105·107·108(7) · SD-101(1) · AR-101·102·103(3) · MD-101·102·103·104(4).
  `INHERITED` 는 R-106 하나이고 VP-212 가 `REGRESSION` 으로 받는다.

### 현재 변경의 운영 gate

0230 §7-A 와 같은 5종(subtree unit · typecheck · lint · build · doc inventory).

---

# Part II — Technical Design

## 8. Research — 코드에서 닫은 사실

| 발견 / 제약 | 근거 |
|---|---|
| `transport` 는 `idle`·`ready`·`listening` 셋이고 `ready` 는 "수신 중 + 채널 생존 + CLI 유휴 + 백로그 없음" 이다 | `post-turn.ts:56-61` `syncTransport` |
| **`flush` 스텝은 `ready` 를 내지 않는다** — `beginListenPhase(sessionId, step === 'listen')` 이라 held 를 미는 구간은 `receiving=false` 다 | `post-turn.ts:135` + `:58-60` |
| 그래서 `transport === 'ready'` 는 **main 에 held 예약이 없음**을 함의한다 — D-102 안전판의 코드 근거 | 위 두 줄 |
| `sessionResponding` 은 `ready` 를 응답 아님으로 본다. `shouldQueueAsPending` 은 `listening`(=`!== idle`)만 본다 | `chatStore.ts:1762-1766`; `sendAdmission.ts:15-24` |
| 두 판정의 불일치가 제보 ②의 직접 원인 | 위 두 줄의 대조 |
| **`ready` 구간에는 지금 아무 표시도 없다** — spark 라인 두 지점이 모두 `pending`(=`sessionResponding`) 게이트 안이라 배경 작업이 화면에서 사라진다 | `AssistantTurn.tsx:64`; `Exchange.tsx:68`; 입력은 `TranscriptView.tsx:138` |
| `StatusLine` 은 `PendingAssistant` 와 **우측 패널 서브에이전트 상세** 두 곳에서 선다 | `PendingAssistant.tsx:80`; `SubAgentTileContent.tsx:199` |
| 스피너는 세 소비처가 분기 없이 같은 것을 받는다 | `StatusLine.tsx:121` (0208 D-002) |
| 활동 라벨 조합 규칙은 순수 모듈이 소유하고 호출부는 1곳이다 | `activityLabel.ts:48`; `StatusLine.tsx:76` |
| `ChatActivitySnapshot` 이 이미 `foreground`·`backgroundTaskCount` 를 싣고 renderer state 가 셋 다 보관한다 — **새 IPC 필드가 필요 없다** | `ipc.ts:1557-1569`; `chatReducer.ts:320-322`·`:1115-1120` |
| **`sessionForeground` 가 이미 `transport !== 'ready'` 를 접는다** — `foreground` 는 transport 와 독립이 아니다. `sessionSpeaking` 은 새 정보가 아니라 기존 판정의 이름이다 | `session-activity-projector.ts:10-19` |
| `patchSubagentMeta` 가 `summary` 를 복사하지 않는다 | `chatStore.ts:322-338` |
| **`task_progress` 는 이미 정규화된다** — `subagent.task` `phase:'progress'` 로 `summary`·`lastToolName` 을 싣는다. F-05 는 renderer 흡수 한 줄이다 | `claude-map.ts:174`·`:204`; `:407` |
| **`accrueSubagentMeta` 는 이름과 달리 교체다** — AT-104 는 정정이 아니라 회귀 가드다 | `claude-map.ts:130-138` |
| `tool_progress` 는 **최상위 `type`** 이라 `mapTaskSystem`(system subtype) 분기로는 못 받는다. 미지 메시지는 드롭된다 | `sdk.d.ts:4553-4572`; `claude-map.ts:801-803` |
| SDK `0.3.220` 에 `agentProgressSummaries`(Options)와 `SDKToolProgressMessage` 가 **둘 다 있다** — SDK 상향은 선행이 아니다 | `sdk.d.ts:1799`·`:4553`; `package.json:35` |
| `backgroundTasks.count()` 소비자는 **둘이고 의미가 다르다** — 턴-후 루프(전량)와 배지(런치 관측분) | `post-turn.ts:106`; `session-activity-projector.ts:216` |
| spark 라인 사실에는 클릭 대상이 없다 — `span` 뿐이다 | `StatusLine.tsx:121-127` |

### 닫지 못한 것

| 대상 | 왜 남았는가 | 처리 |
|---|---|---|
| `ready` 구간의 실측 지속 시간 | 앱 실기가 필요하고 이 환경에서 Windows 실행을 못 한다 | 설계로 우회 — `ready` 는 `channelBusy` 가 내려가면 성립하고 `endListenPhase` 까지 유지된다(`post-turn.ts:56-73`). 순간적이어도 AT-112 는 `listening` 경로를 함께 잠근다 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
chat.activity(transport, foreground, backgroundTaskCount)
  → chatReducer: listening = transport !== 'idle'
  → sessionResponding : inflight || (listening && transport !== 'ready')   ← 스피너·pending
  → shouldQueueAsPending: inflight || listening || pendingCount > 0        ← 전송 경로
        두 술어가 'ready' 에서 갈린다  ← 제보 ②
  → backgroundTaskCount = 추적 전량(foreground 포함)                        ← F-06
  → tool_progress                → 드롭                                     ← F-04
  → task_progress.summary        → 정규화되나 store 가 버린다                ← F-05
  → spark 라인 사실              → span, 클릭 대상 없음                      ← F-07
  → 'ready' 구간                 → 표시 자체가 없다
```

### TO-BE

```text
chat.activity
  → sessionSpeaking    = sessionResponding (이름만 정리 — §8 의 foreground 사실)
  → sessionAwaitingBg  = listening && !sessionSpeaking && backgroundTaskCount > 0
  → 스피너             : sessionSpeaking
  → 백그라운드 실행 줄 : sessionAwaitingBg          (D-101 위치 · 둘은 배타)
  → 전송 admission     : inflight || pendingCount > 0 || (listening && transport !== 'ready')
  → 배지               : 트래커의 **두 번째 세기**(런치 관측분). 턴-후 루프는 전량을 계속 본다
```

**AT-109·AT-111 의 안전판이 admission 의 마지막 항이다.** `ready` 가 아니면 현행대로 예약이고,
`pendingCount > 0` 항은 그대로 남는다 — `ready` 는 §8 이 보인 대로 held 없음을 함의하므로 두 항은
서로를 덮지 않는다.

### 실행 줄의 데이터

| 필드 | 출처 | 없을 때 |
|---|---|---|
| 건수 | `activityBackgroundTaskCount` | 줄 자체가 서지 않는다 |
| 경과 | `listenStartedAt`(기존 앵커) | 경과를 생략한다 |
| 요약 | `subagentMeta[id].summary`(MD-103 이 채운다) | 종류·명령 서술로 폴백 |

### 위험과 대응

| 위험 | 대응 |
|---|---|
| `ready` 직후 자동 턴이 열려 낙관 커밋이 자동 턴 출력보다 앞서 그려진다 | admission 에 `pendingCount === 0` 을 유지한다. `ready` 는 held 없음을 함의한다(§8) — AT-111 이 이 경계를 잠근다 |
| 0208 D-002("스피너는 분기 없이 같은 것") 위반 | 실행 줄은 **스피너가 아니다** — 별도 컴포넌트로 만들고 `SparkSpinner` 를 쓰지 않는다(D-101). VP-214 가 회귀를 본다 |
| 배지 세기를 좁히다 **턴-후 루프까지 좁힌다** | 소비자가 둘이고 의미가 다르다(§8) — `count()` 를 고치지 않고 두 번째 메서드를 더한다. §10 EP-203 · AT-106 이 이것만 본다 |
| transcript 안에 두면 위로 스크롤했을 때 안 보인다 | 배지가 상시 표면이다 — 실행 줄은 **문맥이 붙은 상세**고 배지가 **놓치지 않는 신호**다 |
| `tool_progress` 영속으로 파트 폭증 | transient 로 둔다(`message.delta` 선례). §10 EP-201 |
| 실행 줄과 스피너가 동시에 선다 | 두 파생을 배타로 정의하고 AT-113 이 음성 대조를 잠근다 |

## 10. 계약 / 타입 / 강제 지점

| EP | pair | 계약 | SSOT | 누가 | 언제 강제 | 지점 수 | 실패 의미 |
|---|---|---|---|---|---|---|---|
| EP-201 | VP-201·VP-202 | `tool_progress` 는 **transient** — 영속 파트를 만들지 않는다 | `claude-map.ts` 최상위 분기 | 어댑터 | SDK 메시지 매핑 1곳 | 1 | 영속하면 파트가 초당 늘어 재로드가 느려지고 transcript 가 오염된다 |
| EP-202 | VP-203·VP-204·VP-205 | `usage`·`summary` 는 **스냅샷 교체**이며 누적하지 않는다 | `accrueSubagentMeta` · `patchSubagentMeta` | 어댑터 + store | 진행 스냅샷 수신 2곳 | 2 | 한 곳만 `+=` 로 바뀌면 도구수·경과가 부풀고 화면이 실제보다 큰 값을 말한다 |
| EP-203 | VP-206 | 배지 세기와 **턴-후 루프 세기는 다른 질문이다** | `background-tasks.ts` | 트래커 | 두 소비자 — `post-turn.ts:106` · `session-activity-projector.ts:216` | 2 | 루프까지 좁히면 foreground 태스크가 도는 중에 세션이 대기를 끊는다(0136 회귀) |
| EP-204 | VP-207 | 실행 줄 클릭은 **목록**을 연다 — 개별 상세를 열지 않는다 | 실행 줄 컴포넌트 | renderer | 클릭 핸들러 1곳 | 1 | 개별 상세로 보내면 셸은 하위 대화록이 없어 죽은 어포던스가 된다(0230 R-03) |
| EP-205 | VP-208·VP-209·VP-210 | 전송 admission 과 답변 표면은 **같은 `ready` 판정**을 쓴다 | `sendAdmission.ts` + `chatStore.ts` 선택자 | renderer | 판정 함수 1 + 호출부 1 | 2 | 다시 갈리면 제보 ②가 그대로 돌아온다 |
| EP-206 | VP-211·VP-214 | 실행 줄과 스피너는 **배타** — 한 화면에 둘이 서지 않는다 | 파생 선택자 | renderer | 파생 정의 1 + 렌더 분기 1 | 2 | 둘이 함께 서면 "끝났다"와 "생각 중"을 동시에 말한다 |
| EP-207 | VP-212·VP-215 | 통지 행의 라벨·어포던스는 **`subagentTaskJoin.kind` 하나**가 가른다 | `SubagentNoticeRow.tsx` | renderer | 라벨 선택 1곳(어포던스는 0230 이 이미 잠갔다) | 1 | 종류마다 다른 출처를 쓰면 라벨과 어포던스가 갈려 셸이 에이전트로 보인다 |

- **합계**: `1+2+2+1+2+2+1 = 11` 지점.
- EP-203 의 두 지점은 **서로 다른 값을 받아야 한다** — 같은 값을 주는 것이 이 행의 실패다.

## 11. 구현 설계

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/main/adapters/claude-map.ts` | `tool_progress` 최상위 분기 신설 | `elapsed_time_seconds`·`heartbeat`·`subagent_retry` 를 `subagent.task phase:'progress'` 로 정규화 |
| `src/shared/ipc.ts` | 이벤트 필드 확장 | `elapsedSeconds?`·`heartbeat?`·`retry?` 를 `subagent.task` 에 더한다 |
| `src/main/features/chat/background-tasks.ts` | 두 번째 세기 | `launchedCount(sessionId)` 신설 — `count()` 는 그대로 |
| `src/main/features/chat/session-activity-projector.ts` | 배지 입력 교체 | `count` → `launchedCount` |
| `src/main/app/chat-turn/deps.ts` 등 | 실행 구성 | `agentProgressSummaries: true` 를 Options 에 싣는다 |
| `src/renderer/.../lib/sendAdmission.ts` | admission 술어 | `transportReady` 인자 추가 |
| `src/renderer/.../store/chatStore.ts` | 파생·흡수 | `sessionAwaitingBg` 선택자 · `patchSubagentMeta` 의 `summary`·`retry` 흡수 · 호출부 인자 |
| `src/renderer/.../components/transcript/BackgroundRunRow.tsx` | **신규** | 실행 줄 — 스피너를 쓰지 않는 별도 컴포넌트 |
| `src/renderer/.../components/transcript/Exchange.tsx` | 배치 | 마지막 어시스턴트 턴 아래에 실행 줄 |
| `src/renderer/.../components/transcript/SubagentNoticeRow.tsx` | 라벨 | `joined.kind` 로 `agentLine`/`shellLine` 선택 |
| `src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | `shellLine` · 실행 줄 문구 |

## 12. End-to-end 영향

```text
SDK tool_progress / task_progress
  → claude-map(최상위 분기 · system subtype 분기)
  → subagent.task 이벤트(transient)
  → chatStore.patchSubagentMeta(교체)
  → sessionAwaitingBg 파생
  → Exchange 의 실행 줄  →(클릭) 백그라운드 작업 타일 목록
사용자 전송
  → shouldQueueAsPending(transportReady 포함)
  → 정식 사용자 말풍선 또는 예약 말풍선
```

## 13. Lifecycle / 오류 / 정리

- 실행 줄은 `backgroundTaskCount === 0` 이 되는 순간 사라진다. 정착 통지 행이 그 자리를 잇는다.
- `retry` 표시는 `subagent_retry` 수신으로 서고 **정착 또는 새 `attempt`** 로만 바뀐다. `heartbeat` 는 경과만 민다(AT-102).
- 세션 전환·재로드에서 실행 줄은 라이브 스냅샷 기반이라 복원하지 않는다 — 재로드 후에는 통지 행과 우측 패널 카드가 사실을 갖는다.

## 14. 성능 / 상한 / 최적화

- `tool_progress` 는 도구당 초 단위로 온다. **transient** 라 파트가 늘지 않고, store 흡수는 `subagentMeta[id]` 한 칸 교체다.
- 실행 줄은 1초 틱을 쓰지 않는다 — 경과는 기존 `listenStartedAt` 앵커를 재사용한다.
- `agentProgressSummaries: true` 는 서브에이전트 모델·프롬프트 캐시를 재사용하는 fork 라 SDK 문서가 비용을 "typically minimal" 로 적는다(`sdk.d.ts:1793-1798`). 설정 노출 없이 기본 on, 0235 에서 재검토.

## 15. 외부 구현 포트 / 문서 계약

- `docs/IPC_CONTRACT.md` 의 `subagent.task` 행에 새 필드를 적는다.
- `docs/claude-taskxxx-spec.md` 의 `tool_progress`·`agentProgressSummaries` 채택 표기를 ❌ → ✅ 로 바꾼다.

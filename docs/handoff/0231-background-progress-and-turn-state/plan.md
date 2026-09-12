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
| 상태 | **DRAFT** — D-101 확정. 0230 구현 후 READY 승격 |
| V mode | `Baseline V`(이 handoff 고유 V1) |
| 기준 V | `none` — 0230 V1 을 상속하지 않는다(§4 참조) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

**선행**: 0230. F-07(클릭 진입)의 대상이 0230 이 만드는 셸 카드다. 0230 이 `impl/IMPL_DONE` 에
도달하면 §7-A 의 미확정 행을 채우고 READY 로 올린다.

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

### 갱신 메모

- 새로 추가된 결정: D-101 · D-102 · D-103 · D-104.
- 승계: D-001 · D-002 (0230 Decision Ledger).
- **`ACTIVE 결정 ↔ AC` 대조**: READY 승격 시 수행한다. D-101 이 확정돼 §5 배치가 고정됐으므로
  남은 미확정은 0230 의 산출(셸 카드)에 붙는 §7-A 행뿐이다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | ②는 타당. ①은 **부분적** | ①의 "언제 끝나는지 모른다" 는 0230 의 추적 해제(F-03 ②)가 1차 원인이고, 표시는 2차다. 그래서 0230 이 먼저다 |
| 이미 기존 코드가 충족하는가 | 부분 | `sessionResponding` 이 `transport==='ready'` 에서 이미 스피너를 내린다(`chatStore.ts:1762-1766`). 그런데 `shouldQueueAsPending` 은 `listening` 만 보므로 **두 판정이 갈려 있다** — 화면은 유휴인데 전송은 예약이다 |
| 더 작은 해법이 있는가 | 있다 | 최소안은 `shouldQueueAsPending` 에 `transport==='ready'` 탈출구를 넣는 것 하나다. 다만 D-102 의 순서 위험이 남아 §9 가 그것을 설계로 없앤다 |
| V 를 0230 에서 상속하는가 | **아니오** | 0230 의 V1 은 셸 작업의 존재·정착 계약이다. 이 handoff 는 그 위에 새 Product 요구를 세우지 기존 V 노드를 바꾸지 않는다 — Delta V 가 아니라 별도 Baseline 이 맞다 |
| ACTIVE 결정과 충돌하는가 | 주의 | 0153(낙관 커밋 금지) · 0167 AC21(foreground 구간 무활동 라벨 금지) · 0208 D-002(스피너는 셋이 분기 없이 같은 것). D-101 의 실행 줄은 **스피너가 아니다** — 별도 컴포넌트라 0208 D-002 의 "분기 없음" 은 유지된다(§9 위험표) |

- **사용자에게 올릴 결정**: 없음 — D-101 이 사용자 턴으로 확정됐다(transcript 안, 마지막 턴 아래).
- 코드 조사로 닫은 사실: `sessionResponding` ↔ `shouldQueueAsPending` 의 판정 불일치.

## 5. 동작 / 사용자 흐름

```text
[어시스턴트가 답을 마치고 백그라운드 작업만 남음]
  → 어시스턴트 턴: 종료 표시 (턴 메타 노출, 스피너 없음)
  → 그 아래 백그라운드 실행 줄: "백그라운드 작업 1건 · 3분 12초 · PowerShell"
      → 클릭 → 우측 패널의 해당 작업 상세
  → 컴포저: 전송 버튼 (중지 아님)
  → 사용자 전송 → 정식 사용자 말풍선 (회색 기울임 아님)
  ↘ 작업 완료 → 완료 통지 행 → CLI 자동 턴이 답변
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| `foreground==='idle'` + 백그라운드 작업 있음 | 실행 줄 표시, 스피너 라벨 억제 | "작업 N건 · 경과 · 최근 동작" |
| `tool_progress.subagent_retry` 수신 | 보조 상태 = 재시도 대기 | "재시도 대기 중" — heartbeat 로 해제되지 않는다 |
| `tool_progress.heartbeat` 만 반복 | 연결 생존만 갱신 | 경과는 흐르되 "진척" 을 주장하지 않는다 |
| `task_progress.summary` 수신 | 최신 요약 교체(누적 아님) | 실행 줄 꼬리에 한 줄 요약 |
| 사용자 전송 (위 상태) | main 은 held 로 수용(D-102) | 정식 사용자 말풍선 |
| 사용자 전송 (어시스턴트 실제 스트리밍 중) | 현행 유지 | 회색 기울임 예약 말풍선 |

### 파생 UX / 엣지케이스

- 전환 경계: 실행 줄이 서 있는 동안 CLI 자동 턴이 시작되면 스피너가 다시 뜬다. 두 줄이 동시에
  보이지 않게 한다.
- 취소: 실행 줄의 항목을 눌러 상세로 가면 거기서 중단한다. 실행 줄 자체에 중단 버튼은 두지 않는다.
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

## 7. Requirements / Acceptance (초안 — READY 승격 시 확정)

| R | AT | 동작 기준 | 검증 수단 |
|---|---|---|---|
| R-101 | AT-101 | `tool_progress` 가 `elapsed_time_seconds` 를 실으면 해당 도구 카드가 경과를 보인다 | UT: 정규화 + 순수 렌더 |
| R-101 | AT-102 | `subagent_retry` 표시는 이후 `heartbeat` 만 와도 해제되지 않는다 | UT: 이벤트 순서 주입 후 상태 단언 |
| R-102 | AT-103 | `task_progress.summary` 가 실행 줄에 한 줄로 보인다 | UT: store 흡수 + 순수 렌더 |
| R-102 | AT-104 | 같은 작업의 두 번째 `usage` 스냅샷이 첫 번째에 **더해지지 않는다** | UT: 두 progress 주입 후 값이 두 번째와 같다 |
| R-103 | AT-105 | 배지 건수가 런치 영수증 관측분만 센다 | UT: foreground 작업만 있을 때 `backgroundTaskCount === 0` |
| R-104 | AT-106 | 실행 줄을 누르면 해당 작업 상세가 열린다 | 순수 렌더: 클릭 핸들러가 `openSubagentTask(id)` 를 부른다 |
| R-105 | AT-107 | `foreground==='idle'` + 백그라운드만 남은 상태에서 어시스턴트 턴이 **종료로** 그려진다 | 순수 렌더: 스피너 라벨 부재 + 턴 메타 존재 |
| R-105 | AT-108 | 같은 상태의 사용자 전송이 **정식 사용자 말풍선**으로 그려진다 | 순수: `shouldQueueAsPending` 이 false + 렌더 상태 속성 |
| R-105 | AT-109 | 어시스턴트가 **실제 스트리밍 중**이면 여전히 예약 말풍선이다 | 같은 함수의 음성 대조 |
| R-106 | AT-110 | 낙관 커밋과 main 커밋의 순서가 갈리지 않는다 | IT: 자동 턴이 끼어드는 시나리오에서 DB `idx` 순서와 라이브 순서 일치 |

> AT-110 이 D-102 의 안전판이다. 이 행이 red 면 표시 변경을 되돌리는 것이 아니라 §9 의 admission
> 술어를 더 좁힌다.

## 7-A. V / Trace Matrix (초안)

- V mode 판정: **Baseline V**. 근거는 §4 의 "V 를 0230 에서 상속하는가" 행.
- 변경이 시작되는 수준: `R`.
- 노드·pair 는 0230 의 셸 카드 산출에 붙는 행만 남았다. D-101 확정으로 고정된 것:

| Node | 레벨 | provenance | 비고 |
|---|---|---|---|
| R-101~R-106 | R | NEW | §7 |
| SD-101 | SD | NEW | listen 구간의 화면 상태 전이 전 구간 |
| AR-101 | AR | NEW | `tool_progress` → 정규화 계약(신설 이벤트 또는 기존 확장) |
| AR-102 | AR | NEW | `backgroundTaskCount` 산출 규칙 |
| MD-101 | MD | NEW | `deriveActivityLabel` 의 분리된 백그라운드 모델 |
| MD-102 | MD | CHANGED | `shouldQueueAsPending` — 0153 계약을 좁힌다 |

`MD-102` 가 `CHANGED` 이므로 0153 의 기존 동작에 닿는다 → 그 상위 `INHERITED` 노드(커밋 순서
보존)를 **`REGRESSION` pair** 로 다시 닫는다. 그 pair 의 oracle 이 AT-110 이다.

### 현재 변경의 운영 gate

0230 §7-A 와 같은 5종(subtree unit · typecheck · lint · build · doc inventory).

---

# Part II — Technical Design (방향 — READY 승격 시 확정)

## 8. Research — 이미 확인한 것

| 발견 / 제약 | 근거 |
|---|---|
| `transport` 는 `idle`·`ready`·`listening` 셋이고 `ready` 는 "CLI 유휴 + 백로그 없음 + listen 중" 이다 | `app/src/main/app/chat-turn/post-turn.ts` `syncTransport` |
| `sessionResponding` 은 `ready` 를 응답 아님으로 본다. `shouldQueueAsPending` 은 `listening`(=`!== idle`)만 본다 | `chatStore.ts:1762-1766`; `sendAdmission.ts:14-23` |
| 두 판정의 불일치가 제보 ②의 직접 원인 | 위 두 줄의 대조 |
| `StatusLine` 은 `PendingAssistant` 안에서만 선다 | `PendingAssistant.tsx:27`; `Exchange.tsx:65` |
| 스피너는 세 소비처가 분기 없이 같은 것을 받는다 | `StatusLine.tsx:4` (0208 D-002) |
| 활동 라벨 조합 규칙은 순수 모듈이 소유한다 | `lib/activityLabel.ts` |
| `patchSubagentMeta` 가 `summary` 를 복사하지 않는다 | `chatStore.ts:322-338` |
| 미지 SDK 메시지는 드롭된다 — `tool_progress` 도 여기로 간다 | `claude-map.ts:747-749` |

### 남은 조사 (구현 턴 전에 닫는다)

| 대상 | 방법 | 왜 필요한가 |
|---|---|---|
| `tool_progress` 를 새 `NormalizedEvent` 로 둘 것인가, `subagent.task` 확장으로 둘 것인가 | 소비처 수와 영속 여부로 판정 | 영속하면 파트가 초당 늘어난다 — **transient 여야 한다** |
| `agentProgressSummaries` 가 SDK `0.3.220` 에 있는가 | 배포물 `.d.ts` 확인 | 없으면 SDK 상향이 선행이다 |
| `ready` 구간의 실측 지속 시간 | 로그 | `ready` 가 순간적이면 admission 탈출구가 거의 안 열린다 |

## 9. Architecture — 방향

### AS-IS

```text
chat.activity(transport)
  → chatReducer: listening = transport !== 'idle'
  → sessionResponding: inflight || (listening && transport !== 'ready')   ← 스피너
  → shouldQueueAsPending: inflight || listening || pendingCount > 0       ← 전송 경로
        두 술어가 'ready' 에서 갈린다
```

### TO-BE — 방향

`ChatActivitySnapshot` 에서 **"어시스턴트가 말하는 중"** 과 **"세션이 백그라운드를 기다리는 중"**
을 서로 다른 파생값으로 만들고, 세 소비처(스피너 · 전송 admission · 백그라운드 실행 줄)가 각자
필요한 것만 읽는다.

```text
chat.activity
  → sessionSpeaking   = foreground !== 'idle'
  → sessionAwaitingBg = listening && foreground === 'idle' && backgroundTaskCount > 0
  → 스피너            : sessionSpeaking
  → 백그라운드 실행 줄: sessionAwaitingBg          (D-101 위치)
  → 전송 admission    : sessionSpeaking || pendingCount > 0 || (listening && !transportReady)
```

**AT-110 의 안전판이 마지막 줄이다.** `transportReady` 가 아니면 현행대로 예약이다 — 자동 턴이
진행 중일 수 있는 구간에서는 순서 보장을 포기하지 않는다.

### 위험과 대응

| 위험 | 대응 |
|---|---|
| `ready` 직후 자동 턴이 열려 낙관 커밋이 자동 턴 출력보다 앞서 그려진다 | admission 술어에 `pendingCount === 0` 을 유지하고, `ready` 는 "CLI 유휴 + 백로그 없음" 이라는 main 의 실측 신호다. AT-110 이 이 경계를 잠근다 |
| 0208 D-002("스피너는 분기 없이 같은 것") 위반 | 새 실행 줄은 **스피너가 아니다** — 별도 컴포넌트로 만들고 `SparkSpinner` 를 쓰지 않는다(D-101 제약) |
| transcript 안에 두면 위로 스크롤했을 때 안 보인다 | 배지(`backgroundTaskCount`)가 상시 표면이다 — 실행 줄은 **문맥이 붙은 상세**고 배지가 **놓치지 않는 신호**다. 둘을 겹치지 않게 가른다 |
| `tool_progress` 영속으로 파트 폭증 | transient 로 둔다(`message.delta` 선례) |

## 10~15

0230 이 `verify/PASS` 에 도달해 셸 카드 계약이 굳으면 작성한다. 지금 고정된 강제 지점 후보:

| EP 후보 | 계약 | SSOT |
|---|---|---|
| EP-101 | `sessionSpeaking`·`sessionAwaitingBg`·전송 admission 세 파생의 **단일 소유자** | `chatStore.ts` 선택자 또는 `lib/activityLabel.ts` |
| EP-102 | `tool_progress` 는 transient — 영속 파트를 만들지 않는다 | `claude-map.ts` + `writer.ts` |
| EP-103 | `usage` 는 스냅샷 교체이며 누적하지 않는다 | `patchSubagentMeta` |
| EP-104 | 배지 건수 = 런치 영수증 관측분 | `background-tasks.ts` |
| EP-105 | retry 표시는 heartbeat 로 해제되지 않는다 | 진행 상태 reducer |

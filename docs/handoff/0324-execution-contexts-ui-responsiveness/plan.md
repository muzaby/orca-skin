# Plan — 0324-execution-contexts-ui-responsiveness

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0324-execution-contexts-ui-responsiveness` |
| 작성자 | Claude Code |
| 일자 | 2026-11-16 |
| 매핑 | 없음 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 입력 자료 | 사용자 첨부 "VS Code의 main·renderer·워커와 화면 갱신 경로" 개정 2 · [`vscode-comparison-and-proposal.md`](../../etc/study/main-renderer-roles/vscode-comparison-and-proposal.md) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 입력 크기에 비례하는 계산과 읽기가 UI를 맡는 두 스레드(renderer 메인 스레드, main 프로세스)에서 한 번에 돈다 — 구문 강조 1,000줄이 renderer를 약 1초, part 1만 개 세션 로드가 main을 약 150ms 막는다(§8 실측).
- 완료 후 달라지는 것: 실행 주체마다 맡는 일과 금지가 문서와 가드로 고정되고, 구문 강조·diff 계산은 renderer Web Worker가, 세션 본문 읽기는 데이터 호스트 프로세스가 맡으며, 남은 멈춤은 `perf.stall` 기록으로 드러난다.
- 성공을 사용자 관점에서 한 문장으로: 큰 코드·큰 diff·큰 세션을 여는 동안에도 스크롤·입력·창 조작이 끊기지 않고, 늦는 결과는 로딩 표시나 강조 없는 원문으로 먼저 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "패널확장보다 renderer 업데이트 방법(인프라)을 우선 고쳐야겠다는 결론이다." | 라이브 세션 2026-11-16 턴 1 |
| 명시 요구 | "첨부 vscode의 사례를 검토하고 main과 renderer의 역할을 재정의하라." | 턴 1 |
| 명시 요구 | "추가적인 워커 (스레드/프로세스)를 어떻게 운영할지 검토하고 제안하라. Orcinus orca의 수준에 맞춰 검토할 것." | 턴 1 |
| 명시 요구 | "구조적으로 앱 버벅임이 없애야 함. (로딩표시 제외). 앱 조작 시 버벅임 없어야 함" | 턴 1 |
| 명시 요구 | 반응성 수치: "리눅스 top half 혹은 vscode 기준등 범용적인 기준을 확인하고 제안하라" | 턴 2 답 1 |
| 명시 요구 | 범위: "한 handoff에 전부" — 선택지 문구는 "역할 규칙·계측·renderer 워커·main 데이터 프로세스·세션 로드 조각 전달까지 0324 하나에 담는다" | 턴 2 답 2 |
| 명시 요구 | main 쪽 워커: "별도 프로세스 + 직접 포트" — `utilityProcess` 가 읽기 전용 DB 연결을 갖고 결과는 `MessagePort` 로 renderer 에 바로 간다 | 턴 2 답 3 |
| 추론 의도 | "(로딩표시 제외)"는 "결과가 늦어 로딩 표시가 뜨는 것은 버벅임으로 세지 않는다"로 읽는다. 로딩 표시가 떠 있는 동안에도 조작은 반응해야 한다 | 턴 1 문장의 괄호 위치 |
| 추론 의도 | "한 handoff에 전부"의 "전부"는 선택지가 열거한 다섯 항목이다. 턴 스트림을 main 밖으로 옮기는 세션 호스트는 그 열거에 없었다 → D-010 | 턴 2 답 2의 선택지 문구 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이 작업이 0323(패널 확장)보다 먼저다 | "패널확장보다 renderer 업데이트 방법(인프라)을 우선" | 턴 1 | ACTIVE | 0323 D-015 와 같은 결정 |
| D-002 | 앱 조작 시 버벅임이 구조적으로 없어야 한다. 로딩 표시는 버벅임이 아니다 | "구조적으로 앱 버벅임이 없애야 함. (로딩표시 제외)" | 턴 1 | ACTIVE | — |
| D-003 | main·renderer 역할을 VS Code 사례 기준으로 재정의한다 | "첨부 vscode의 사례를 검토하고 … 재정의하라" | 턴 1 | ACTIVE | — |
| D-004 | 추가 워커(스레드/프로세스)의 운영 방식을 정한다. 규모는 Orcinus orca 수준에 맞춘다 | "Orcinus orca의 수준에 맞춰 검토할 것" | 턴 1 | ACTIVE | — |
| D-005 | 역할 규칙·계측·renderer 워커·main 데이터 프로세스·세션 로드 조각 전달을 이 handoff 하나에 담는다 | "한 handoff에 전부" | 턴 2 | ACTIVE | 설계자 권고(분할)는 기각됐다 |
| D-006 | main 의 대량 읽기는 `utilityProcess` 가 읽기 전용 연결로 하고 결과는 `MessagePort` 로 renderer 에 직접 간다 | "별도 프로세스 + 직접 포트" | 턴 2 | ACTIVE | — |
| D-007 | 반응성 예산: UI 스레드의 한 작업은 **50ms** 를 넘지 않는다. **160ms** 이상은 심각으로 기록한다. UI 스레드에 남는 반복 작업은 **5ms** 마다 양보한다 | "범용적인 기준을 확인하고 제안하라" — 근거는 §4-A | 턴 2 + 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-008 | 입력 크기에 상한이 없는 계산·읽기는 UI 스레드에 두지 않는다. UI 스레드에 남기려면 입력 상한을 상수로 두고 그 상한에서의 비용을 잰다 | D-002 를 기계가 검사할 수 있는 규칙으로 옮긴 것 | 설계자 | ACTIVE | — |
| D-009 | 워커·호스트가 실패하면 강조 없는 원문 또는 오류 표시로 남는다. UI 스레드에서 같은 계산을 대신 돌리는 대체 경로를 두지 않는다 | 첨부 문서 사례 C 의 fallback — "fallback에서는 renderer가 계산을 수행한다" | 턴 1 첨부 + 설계자 | ACTIVE | 연구 문서 §5.2 "main 의 기존 경로로 한 번 대체"를 대체 |
| D-010 | 턴 스트림(SDK 메시지 해석·정규화·저장·전달)은 main 에 둔다. 세션 호스트 프로세스는 만들지 않는다 | DB 단건 쓰기 0.064ms(§8). `perf.stall` 이 스트리밍 중 main 멈춤을 보이면 다시 연다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-011 | 세션 본문은 조각으로 받아 **한 번에** 화면에 반영한다. 앞부분부터 보이는 점진 표시는 하지 않는다 | 점진 표시는 스크롤 위치·미완료 표시의 제품 동작을 바꾼다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-012 | 구문 강조는 **32,000자** 이하 코드에만 적용한다. 지금 상한은 200,000자다 | 강조 결과를 DOM 에 넣는 일은 UI 스레드에 남고 1,000줄(35,696자)에서 26ms 다(§8) | 설계자 | ACTIVE (사용자 거부 가능 — 화면 동작 변경) | — |
| D-013 | 계측 결과는 기존 로컬 로그(JSONL)에만 남긴다. 외부 전송과 새 화면은 만들지 않는다 | 텔레메트리는 PRD §11 미정 항목이다 | 설계자 | ACTIVE | — |
| D-014 | diff 줄 계산은 두 입력의 줄 수 합이 **400** 이하면 UI 스레드에서, 넘으면 워커에서 한다. 넘는 입력의 도구 카드 머리 증감 수는 표시하지 않는다 | 작은 diff 마다 로딩 표시가 깜빡이지 않게 한다. 2,546줄·절반 변경이 415ms 다(§8) | 설계자 | ACTIVE (사용자 거부 가능 — 화면 동작 변경) | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014 (최초 작성).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음(최초).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ AC8·AC15·AC22(조작 반응) · D-005 ↔ AC1~AC22(다섯 항목 전부에 AC) · D-006 ↔ AC15·AC18 · D-007 ↔ AC5·AC6·AC7(50/160 상수) · D-008 ↔ AC2·AC3·AC4 · D-009 ↔ AC12·AC18 · D-010 ↔ §10 선언 경계 B3 · D-011 ↔ AC16 · D-012 ↔ AC8 · D-013 ↔ AC5 · D-014 ↔ AC10.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 멈춤의 원인은 "어디서 도는가"다 — `CodeBlock.tsx:65` 의 `codeToHtml` 이 renderer 메인 스레드에서 1,000줄에 약 1초(§8) |
| 이미 기존 코드가 충족하는가 | 일부 — 전제 정정 | "주니어 수준" 전제와 달리 스트리밍 표시는 이미 프레임에 묶인다(`chatStore.ts:995` rAF 코얼레서, `rendering.md` §1.2). 없는 것은 워커·계측·배치 규칙이다(`rg 'new Worker\(\|utilityProcess\|monitorEventLoopDelay' app/src` → 주석 1건) |
| 더 작은 해법이 있는가 | 부분 채택 | DOM 삽입 비용은 상한으로 막는다(D-012). 세션 로드를 main 안에서 나눠 읽는 안은 기각 — 같은 연결의 반복 조회 중 쓰기가 막힌다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 2건 정정 | 연구 문서의 "전부 미측정"은 §8 실측으로 대체. "DB 쓰기를 그대로 둔다"는 0.064ms 로 확인. "턴 정규화는 이벤트당 가볍다"는 미측정이라 D-010 에 조건을 달았다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 계약 변경 2건 | `oo:session:load`·`oo:session:refresh` 응답에서 세션 본문이 빠진다 — `IPC_CONTRACT.md` 를 같이 고친다(D-006 의 귀결) |

- 사용자에게 올릴 결정: 없음. D-007·D-010·D-011·D-012·D-014 는 설계자 제안이라 거부할 수 있다.
- 코드 조사로 닫은 사실: §8.

### 4-A. D-007 의 근거 — 범용 기준

| 기준 | 수치 | 출처(이번 턴에 원문 확인) | Orcinus orca 에 옮긴 것 |
|---|---|---|---|
| W3C Long Tasks | 한 작업 50ms 초과가 "long task". 입력 응답 100ms 목표(RAIL)에서 나온 값 | `w3c/longtasks` README — "Long-task threshold is 50ms" | 한 작업 상한 50ms |
| Linux softirq(bottom half) | 한 번에 2ms 또는 10회 재시작까지 돌고 남은 일은 `ksoftirqd` 스레드로 넘긴다 | `kernel/softirq.c` — `MAX_SOFTIRQ_TIME msecs_to_jiffies(2)` · `MAX_SOFTIRQ_RESTART 10` | 짧게 처리하고 남으면 넘긴다(D-008) |
| React scheduler | 5ms 마다 브라우저에 양보한다 | `SchedulerFeatureFlags.js` — `frameYieldMs = 5` | UI 스레드 반복 작업의 양보 간격 5ms |
| VS Code 배경 토큰화 | 1~2ms 조각으로 돌고 idle callback 에 다시 예약한다 | `textModelTokens.ts` — "try to yield every 1-2ms" | 같은 원칙 |
| VS Code 느린 작업 감지 | `longtask` 관측값이 기준 PC 에서 약 160ms(`perfBaseline * 10`) 이상이면 프로파일을 뜬다 | `rendererAutoProfiler.ts` · `timerService.ts` | 심각 기록 기준 160ms |

`w3c.github.io`·`web.dev` 는 이 세션의 네트워크 허용 목록 밖이라 열지 못했다 — W3C 수치는 같은 명세의 GitHub 저장소 README 로 확인했다.

## 5. 동작 / 사용자 흐름

```text
[코드 블록·diff·세션을 연다]
  → 원문 또는 로딩 표시가 즉시 보인다 (조작은 계속 반응)
  → 워커/호스트가 결과를 보낸다
  → 화면에 반영된다 (강조·diff 표·세션 본문)
  ↘ 내용이 바뀌었거나 닫혔다 → 늦은 결과는 버린다
  ↘ 워커/호스트 실패 → 원문 유지 또는 기존 오류 표시, UI 스레드 대체 계산 없음
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 32,000자 이하 코드 블록이 화면에 놓임 | 워커에 강조 요청, 같은 내용이 캐시에 있으면 바로 반영 | 원문 → 색상(지금과 같은 순서) |
| 32,000자 초과 코드 블록 | 강조 요청 없음 | 원문 그대로 |
| 줄 수 합 400 이하 diff | UI 스레드에서 줄 계산 | 지금과 같다 |
| 줄 수 합 400 초과 diff | 워커에 줄 계산 요청 | 본문 자리에 로딩 표시 → diff 표. 머리의 증감 수는 없다 |
| 강조 요청 중 내용 변경·언마운트 | 요청 취소, 늦은 응답 폐기 | 새 내용의 원문 |
| 워커 생성 실패·오류 | 오류 1회 기록, 연속 3회 실패하면 창이 닫힐 때까지 요청하지 않음 | 원문 그대로 |
| 세션 클릭 | main 이 활동 상태만 돌려주고 본문은 호스트가 조각으로 보냄 | 기존 세션 로딩 표시 → 본문 |
| 세션 로드 중 다른 세션 클릭 | 앞 요청 취소, 남은 조각 미전송 | 새 세션의 로딩 표시 |
| 호스트 비정상 종료 | 진행 중 요청 실패, 다음 요청에서 다시 띄움 | 기존 "대화 열기 실패" 오류 표시 |
| UI 스레드가 50ms 이상 멈춤 | `perf.stall` 로그 1건 | 화면 변화 없음 |

### 파생 UX / 엣지케이스

- loading / empty / error: 강조 대기는 원문, 큰 diff 대기는 로딩 표시, 세션 대기는 기존 `loadingSession` 표시를 쓴다. 새 문구는 큰 diff 로딩 1종뿐이다(`ko.ts`).
- cancel / retry / close / restart: 취소는 요청 번호 폐기다. 세션 로드 실패의 재시도는 지금처럼 다시 여는 것이다. 창이 닫히면 워커가 끝나고, 앱이 끝나면 main 이 호스트를 내린다.
- concurrency / multi-session: 워커는 창마다 1, 호스트는 앱에 1 이다. 창이 둘이면 호스트 포트도 둘이다.
- keyboard / a11y / theme: 테마가 바뀌면 캐시 키가 달라져 다시 요청한다. 큰 diff 로딩 표시는 `role="status"` 를 갖는다.
- 외부환경/오프라인/폐쇄망: 새 네트워크 요청과 새 의존성이 없다.

## 6. 범위 / 비범위

- **범위**: 실행 주체 계약 문서와 가드 · `perf.stall` 계측 · renderer 계산 워커(구문 강조·diff 토큰·diff 줄) · 데이터 호스트 프로세스와 세션 로드/갱신 이주 · 턴 시작의 동기 플러그인 카탈로그 읽기 제거.
- **비범위**: 세션 호스트 프로세스(D-010) · 세션 본문의 점진 표시(D-011) · Markdown 변환의 워커 이주 · 긴 코드의 줄 가상화 · 검색·사용량 집계의 호스트 이주 · 델타 송신 묶기 · 계측 화면과 외부 전송(D-013) · 0323 의 훅·패널.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 검색·사용량 집계의 호스트 이주 | 아니오 — 호스트 프로토콜에 서비스 종류를 더하면 된다 | `perf.stall` 이 보이면 후속 |
| 세션 호스트 프로세스 | 아니오 — 지금 만들지 않아 묶이는 계약이 없다 | D-010 조건 |
| Markdown 변환(3.3만 자 50~95ms) | 아니오 | §10 선언 경계 B1, 후속 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 실행 주체 5종의 맡는 일·금지·예산·워커 운영이 한 문서에 있고 main·renderer 가이드가 그 규칙을 갖는다 | `node scripts/check-doc-inventory.mjs --check` green · 문서의 금지 행마다 강제 수단(AC2~AC4 가드 이름 또는 "강제 없음")이 적혀 있음을 검증자가 대조 | `docs/INDEX.md` → `docs/arch/execution-model.md` → `app/src/{main,renderer}/AGENTS.md` |
| R-02 | AT-02 / AC2 | `src/main` 에 등록되지 않은 Node 동기 API 이름(`fs`·`child_process` 의 `*Sync`)을 쓰면 가드가 실패한다. 등록 개수가 실제보다 많아도 적어도 실패한다 | `scripts/check-ui-thread.test.mjs` — 미등록 추가 → exit 1 · 등록 초과 → exit 1 · 등록 일치 → exit 0 | `ci.yml` 가드 단계 · `npm test` |
| R-02 | AT-03 / AC3 | renderer 에서 허용 경로 밖 모듈이 `shiki`·`shiki/*`·`diff` 의 값을 import 하면 가드가 실패한다. `import type` 은 통과한다 | 같은 테스트 — 값 import → exit 1 · type import → exit 0 · 허용 경로의 값 import → exit 0 | 같다 |
| R-02 | AT-04 / AC4 | `features/history/reader` 의 `loadSession` 을 등록된 자리 밖에서 import 하면 가드가 실패한다 | 같은 테스트 — 미등록 import → exit 1 | 같다 |
| R-03 | AT-05 / AC5 | main 이벤트 루프가 50ms 이상 멈추면 `perf.stall` 이 `thread:'main'`·`durationMs`·`severity` 로 남는다. 160ms 이상이면 `severity:'severe'` 다. 한 관측 창에 1건만 남는다 | `infra/perf/stall-monitor.test.ts` — 지연 표본 49/50/159/160 → 기록 없음/`long`/`long`/`severe` · 한 창에 표본 3개 → 기록 1건(최댓값) | `bootstrap.ts` 시작 → `monitorEventLoopDelay` → 로거 |
| R-03 | AT-06 / AC6 | IPC 핸들러의 동기 구간이 50ms 이상이면 채널 이름과 함께 `perf.stall` 이 남는다. `handle`·`handlePlain`·`on` 모두 그렇고, `handle.ts` 밖에서 `ipcMain` 에 직접 등록하는 자리는 없다 | `infra/ipc/handle.test.ts` — 주입한 시계로 60ms 걸리는 핸들러 → 채널 이름이 실린 기록 1건, 세 등록 함수 각각 · 가드 규칙 (d) — `handle.ts` 밖의 `ipcMain` 등록 → exit 1 | renderer invoke → `handle()` → 핸들러 |
| R-03 | AT-07 / AC7 | renderer 메인 스레드의 50ms 이상 작업이 `thread:'renderer'` 로 같은 형식에 남는다. 1초에 1건을 넘지 않는다 | `shared/perf/longTaskReporter.test.ts` — long task 항목 5개를 1초 안에 주입 → emit 1건(`count:5`, 최댓값) | `main.tsx` → `PerformanceObserver('longtask')` → `oo:log:emit` |
| R-04 | AT-08 / AC8 | 코드 블록 강조는 워커 응답 전에는 원문, 응답 후에는 색상이다. 32,000자 초과 코드는 요청하지 않는다 | `CodeBlock.render.test.ts` — 가짜 계산 클라이언트 응답 전 `<pre>` 원문 · 응답 후 응답 HTML · 32,001자 → 요청 0회 | `Markdown` → `CodeBlock` → `computeClient` → 워커 |
| R-04 | AT-09 / AC9 | diff 구문 토큰이 워커에서 계산돼 줄에 붙는다 | `useDiffSyntax` 테스트 — 가짜 클라이언트가 준 토큰이 old/new 축별로 해당 줄에 매핑 | `FileDiffSection` → `useDiffSyntax` → `computeClient` |
| R-04 | AT-10 / AC10 | 줄 수 합 400 이하 diff 는 같은 렌더에서 결과가 나오고, 401 이상은 워커 결과가 올 때까지 로딩 상태다. 401 이상의 머리 증감 수는 없다 | `shared/compute/inline.test.ts` — 400 → 결과 · 401 → `null` · `toolMeta` 테스트 — 401 → 증감 수 없음 | `DiffBody`·`filePresentation`·`toolMeta` → `diffLinesWithinCap` / 워커 |
| R-04 | AT-11 / AC11 | 취소한 요청의 늦은 응답은 반영되지 않는다. 대기 중 취소된 요청은 워커에 보내지 않는다. 실행 중 요청이 취소되고 대기 요청이 있으면 워커를 새로 만든다 | `shared/compute/client.test.ts` — 가짜 워커로 세 경우 각각: resolve 0회 / postMessage 0회 / `terminate` 1회 + 새 워커에 대기 요청 전송 | `CodeBlock` 언마운트 → `computeClient.cancel` |
| R-04 | AT-12 / AC12 | 워커가 실패하면 요청은 실패로 끝나고 소비자는 원문을 유지한다. UI 스레드는 `shiki` 를 부르지 않는다. 연속 3회 실패 뒤에는 워커를 만들지 않는다 | `client.test.ts` — 생성 실패/`error` 이벤트 → reject + 오류 로그 1건 · 4번째 요청 → 워커 생성 0회 · AC3 가드가 UI 스레드의 `shiki` 값 import 를 막음 | `computeClient` → `Worker` 생성 |
| R-04 | AT-13 / AC13 | 대기 요청은 입력 길이가 짧은 것부터 나간다 | `client.test.ts` — 길이 9000·10·500 순으로 넣음 → 전송 순서 10·500·9000 | 같다 |
| R-04 | AT-14 / AC14 | 같은 `(종류, 내용, 언어, 테마)` 재요청은 워커에 가지 않는다. 캐시는 결과 문자 수 합 4,000,000 을 넘으면 오래된 것부터 버린다 | `client.test.ts` — 같은 요청 2회 → 전송 1회 · 상한 초과 삽입 → 가장 오래 안 쓴 항목 재요청 시 전송 발생 | 가상 스크롤 재마운트 → `CodeBlock` |
| R-05 | AT-15 / AC15 | 세션을 열면 본문이 호스트 → renderer 포트로 오고, 조립한 결과는 지금의 `loadSession` 결과와 같다 | `app/data-host/session-load.test.ts`(io) — 같은 DB 픽스처에서 `loadSession()` 결과와 `조각 전송 → 조립` 결과가 `toEqual`(native 이력 있는 세션·없는 세션·없는 id) | 사이드바 클릭 → `chatStore.loadSession` → `sessionApi.load` → 호스트 |
| R-05 | AT-16 / AC16 | 한 조각은 part 500개를 넘지 않는다. part 가 500개를 넘는 메시지 하나는 혼자 한 조각이다. renderer 는 마지막 조각 뒤에 한 번만 스토어에 반영한다 | `shared/data-host-chunks.test.ts` — 1,200 part → 조각별 part 수 ≤ 500 · 700 part 메시지 → 단독 조각 · `chatStore` 테스트 — 조각 3개 수신 동안 `LOAD_SESSION` 0회, 끝에 1회 | 같다 |
| R-05 | AT-17 / AC17 | 진행 중 로드가 취소되면 호스트는 다음 조각부터 보내지 않고, renderer 는 그 요청의 늦은 조각을 버린다 | `session-load.test.ts` — 조각 1 뒤 취소 → 조각 2 미전송 · `dataHostClient.test.ts` — 취소한 요청 번호의 조각 → 조립 결과 없음, 다른 요청 정상 | 세션 A 로드 중 세션 B 클릭 |
| R-05 | AT-18 / AC18 | 호스트는 첫 요청에 뜬다. 비정상 종료하면 진행 중 요청이 실패하고 다음 요청에서 다시 뜬다. 앱 종료 때 `closeDb` 보다 먼저 내려간다. main 이 대신 읽지 않는다 | `app/data-host/supervisor.test.ts` — 가짜 프로세스로: 요청 전 fork 0회 · exit 이벤트 → 종료 통지 1회 · 다음 connect → fork 2회째 · `shutdown()` 호출 순서 기록 | `bootstrap.ts` → `DataHostSupervisor` |
| R-05 | AT-19 / AC19 | 세션 갱신도 본문을 호스트에서 받는다. `oo:session:load`·`oo:session:refresh` 의 main 응답에는 메시지 배열이 없다 | `handlers/session.load.test.ts` — 두 채널 응답에 `messages` 키 없음 · `activity` 는 있음 · `compactLegacyRaw` 가 응답 전에 1회 호출 | `chatStore` 의 `refresh()` → `sessionApi.refresh` → 호스트 |
| R-05 | AT-20 / AC20 | 호스트는 DB 를 읽기 전용으로 연다. 호스트 요청은 스키마 검증을 통과해야 처리된다 | `session-load.test.ts`(io) — 호스트 연결로 쓰기 실행 → `SQLITE_READONLY` · 형식이 틀린 요청 → `error` 응답, 조회 0회 | 호스트 `entry.ts` |
| R-06 | AT-21 / AC21 | 턴을 시작할 때 플러그인 카탈로그를 비동기로 읽는다. 결과는 지금과 같다 | `adapters/claude` 기존 카탈로그 테스트를 비동기 진입점으로 — 같은 픽스처에서 같은 카탈로그 · AC2 가드에서 `plugin-catalog.ts` 등록 0 | `chat:send` → `adapter.ts` 턴 셋업 |
| R-07 | AT-22 / AC22 | Windows 실기 6개 시나리오에서 main·renderer 의 `perf.stall` 이 0건이다. 선언 경계(B1~B4·B8)의 경로에서 난 기록은 경계로 적는다 | 사람 실기 — §19 시나리오를 수행하고 로그에서 `perf.stall` 을 센다 | 설치본 또는 `npm run dev` |
| R-07 | AT-23 / AC23 | 패키징한 앱에서 워커와 호스트가 실제로 뜬다 — 코드 블록에 색이 입혀지고 세션이 열린다 | 사람 실기 — `build:win` 산출물에서 코드 블록 강조 1회, 세션 열기 1회, 로그에 워커·호스트 오류 0건 | NSIS 설치본 |

### AC 검증 주의사항

- 기존 테스트 재사용: `CodeBlock.render.test.ts`·`handle.test.ts`·`session.load.test.ts` 는 실재한다(`ls` 확인). 새 단언은 이 파일들에 더한다.
- 사람 실기 항목: AC22·AC23 은 실제 Chromium 프레임과 Electron 프로세스 생성이 관측 대상이다. 이 저장소의 에이전트 환경은 Electron 바이너리를 받지 못한다(`app/AGENTS.md` 제약 환경). 순수 로직은 AC5~AC20 으로 내렸다.
- N회/총량 기준: AC5·AC7 의 "1건"은 관측 창 하나의 기록 수다. sink 는 로거 하나이고 호출부는 모니터 1곳·리포터 1곳이다.
- 총량/0건 기준: AC22 의 0건은 §10 선언 경계 B1~B4·B8 의 경로를 뺀 수다. 경계 경로의 기록은 실기 보고에 따로 적는다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 로 분해한 pair 의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-07 | R | §7 | NEW | — |
| AT-01~AT-23 | AT | §7 | NEW | — |
| SD-01 | SD | 계산 요청 수명주기 — §5·§13 | NEW | — |
| SD-02 | SD | 세션 로드 수명주기(티켓 → 포트 → 조각 → 반영 / 취소 / 호스트 종료) — §5·§13 | NEW | — |
| AR-01 | AR | 계산 클라이언트 ↔ 워커 메시지 계약 — §10 EP-3 | NEW | — |
| AR-02 | AR | main 감독자 ↔ 호스트 ↔ renderer 클라이언트 계약 — §10 EP-5·EP-6 | NEW | — |
| AR-03 | AR | IPC 등록 함수의 계측 경계 — §10 EP-2 | NEW | — |
| AR-04 | AR | 가드가 보는 소스 집합과 등록 표 — §10 EP-1 | NEW | — |
| AR-05 | AR | 세션 로드 응답 계약(`SessionLoadTicket`) — §10 EP-4 | CHANGED | `shared/ipc.ts` 의 `LoadedSession`·`RefreshSessionResult` |
| MD-01 | MD | 계산 대기열(순서·취소·교체·캐시·실패 차단) — §11 | NEW | — |
| MD-02 | MD | 조각 분할과 조립 — §11 | NEW | — |
| MD-03 | MD | 멈춤 판정(50/160, 창당 1건) — §11 | NEW | — |
| MD-04 | MD | 가드 판정(이름 집합·등록 개수·import 종류) — §11 | NEW | — |
| MD-05 | MD | 상한 판정(`diffLinesWithinCap`·강조 32,000자) — §11 | NEW | — |
| SD-03 | SD | 세션 로드 중 라이브 이벤트 보호(`isCurrent`·`liveChanged`) | INHERITED | `chatStore.ts:1782~1790` · `chatStore.native-history.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `docs/INDEX.md` → `execution-model.md` → 두 `AGENTS.md` | `gate:node scripts/check-doc-inventory.mjs --check` | not selected — 문서 대조 | 0 + 문서 산출 |
| VP-02 | R-02 ↔ AT-02~04 | REQUIRED | 소스 트리 → `check-ui-thread.mjs` → exit code → `ci.yml` | 신규 `scripts/check-ui-thread.test.mjs` — 규칙 4종 × 분기(§10 EP-1 규칙 칸) | required — 0건 가드라 눈이 있는지 확인. 변이: 등록 표에서 1행 삭제 → red | EP-1 (4) |
| VP-03 | R-03 ↔ AT-05~07 | REQUIRED | 멈춤 → 모니터/등록 함수/리포터 → 로거 | AC5·AC6·AC7 의 세 테스트 파일 | not selected — 값 단언 | EP-2 (7) |
| VP-04 | R-04 ↔ AT-08~14 | REQUIRED | 컴포넌트 → 훅 → `computeClient` → 워커 → 응답 → 상태 | AC8~AC14 의 테스트 | not selected — 행동 단언 | EP-3 (9) |
| VP-05 | R-05 ↔ AT-15~20 | REQUIRED | 클릭 → `sessionApi.load` → main 티켓 → 호스트 → 조각 → 조립 → `LOAD_SESSION` | AC15~AC20 의 테스트 | not selected — 동치·값 단언 | EP-4 (3) · EP-5 (2) · EP-6 (5) |
| VP-06 | R-06 ↔ AT-21 | REQUIRED | `chat:send` → `adapter.ts` 턴 셋업 → 카탈로그 | 기존 카탈로그 테스트(비동기 진입점) + `gate:node scripts/check-ui-thread.mjs` | not selected | EP-7 (1) |
| VP-07 | R-07 ↔ AT-22·23 | REQUIRED | 실제 앱 | 사람 실기 §19 | not selected | 0 + 실기 |
| VP-08 | SD-01 ↔ ST-01 | REQUIRED | 요청 → 대기 → 전송 → 응답/취소/실패 → 소비자 상태 | `client.test.ts` — 수명주기 전이 6종(전송·응답·대기 취소·실행 취소·실패·차단) | not selected | EP-3 과 공유 |
| VP-09 | SD-02 ↔ ST-02 | REQUIRED | 티켓 → 포트 → begin → chunk* → end / cancel / exit | `session-load.test.ts` + `dataHostClient.test.ts` + `supervisor.test.ts` | not selected | EP-5·EP-6 과 공유 |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | `client.ts` ↔ `compute.worker.ts` 메시지 | 신규 `shared/compute/worker/handler.test.ts` — 요청 3종을 실제 처리 함수에 넣어 응답 형식을 `client` 의 파서로 읽음 | not selected | EP-3 (종류 3) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | `dataHostClient` ↔ `session-load` 서비스 메시지 | `session-load.test.ts` — 서비스가 낸 메시지를 `dataHostClient` 조립기에 그대로 넣음 | not selected | EP-6 (5) |
| VP-12 | AR-03 ↔ IT-03 | REQUIRED | `ipcMain.handle` 등록 → 계측 → 핸들러 | `handle.test.ts` — 세 등록 함수 | required — 등록 함수 하나만 계측해도 대표 테스트는 통과. 변이: `handlePlain` 의 계측 제거 → red | EP-2 (7) |
| VP-13 | AR-04 ↔ IT-04 | REQUIRED | 실제 트리 → 가드 | `gate:node scripts/check-ui-thread.mjs` 를 실제 트리에 실행 → exit 0 | not selected | EP-1 (4) |
| VP-14 | AR-05 ↔ IT-05 | REQUIRED | `handlers/session.ts` → preload → `shared/api/ipc.ts` | `session.load.test.ts` + `preload/index.test.ts` | not selected | EP-4 (3) |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | `client.ts` 내부 | `client.test.ts` | not selected | EP-3 과 공유 |
| VP-16 | MD-02 ↔ UT-02 | REQUIRED | `data-host-chunks.ts` | `data-host-chunks.test.ts` — 규칙 칸 분기 4종(§10 EP-6) | not selected | EP-6 과 공유 |
| VP-17 | MD-03 ↔ UT-03 | REQUIRED | `stall-monitor.ts` | `stall-monitor.test.ts` — 49/50/159/160 | not selected | EP-2 과 공유 |
| VP-18 | MD-04 ↔ UT-04 | REQUIRED | `check-ui-thread.mjs` | `check-ui-thread.test.mjs` | VP-02 와 같다 | EP-1 과 공유 |
| VP-19 | MD-05 ↔ UT-05 | REQUIRED | `inline.ts` · `CodeBlock.tsx` | `inline.test.ts` — 400/401 · `CodeBlock.render.test.ts` — 32,000/32,001 | not selected | EP-3 과 공유 |
| VP-20 | SD-03 ↔ ST-03 | REGRESSION | 로드 대기 중 라이브 이벤트 → `liveChanged` → 로드 결과 폐기 | 기존 `chatStore.native-history.test.ts` · `chatStore.listen.test.ts` — 전송 수단만 바뀐 뒤에도 green | not selected | 0 + 기존 보호 재사용 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` subtree | `app/**` 를 고친다 | `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` | 이번 변경이 만든 실패만 |
| 가드 스크립트 | 테스트와 스크립트를 더한다 | `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · 신규 `check-ui-thread` | 같다 |
| 문서 | `docs/arch`·`IPC_CONTRACT.md`·`docs/INDEX.md` 를 고친다 | `check-doc-inventory --check` | 같다 |
| message-bus | handoff 산출 | 커밋 trailer 파싱 확인 · `INDEX.md` 행 | 같다 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 구문 강조는 renderer 메인 스레드에서 동기로 돈다. 상한은 200,000자다 | `shared/ui/markdown/CodeBlock.tsx:46`·`:65` |
| diff 토큰도 같은 스레드에서 축마다 한 번씩 강조한다 | `features/chat/lib/diffSyntax.ts:25` |
| jsdiff 를 renderer 가 직접 부른다 | `lib/diffLines.ts:47` · `lib/toolMeta.ts:185` · `lib/unifiedDiffLines.ts:7` |
| shiki 엔진은 JS 정규식 엔진이다 — WASM 이 없어 CSP 변경 없이 워커에서 돈다 | `shared/ui/markdown/syntax.ts:39` · `index.html` CSP `script-src 'self'` |
| 세션 로드는 main 에서 모든 part 를 한 번에 읽고 한 응답으로 보낸다 | `app/handlers/session.ts:70` · `features/history/reader.ts:19` · `infra/db/queries.ts:465` |
| 세션 로드 전에 쓰기 1건(`compactLegacyRaw`)이 있다 | `app/handlers/session.ts:69` |
| 갱신 경로는 스냅샷을 DB 에 저장한 뒤 돌려준다 — 호스트가 다시 읽을 수 있다 | `features/history/native-sync.ts:123~141` |
| renderer 로드는 대기 중 라이브 이벤트가 오면 결과를 버린다 | `chatStore.ts:1782~1790` |
| 모든 invoke 채널은 `handle`·`handlePlain`, 단방향은 `on` 으로 등록된다 | `infra/ipc/handle.ts` |
| renderer → main 로그 채널이 이미 있다 | `preload/index.ts:127` `CHANNELS.logEmit` |
| 턴 시작에 플러그인 카탈로그를 동기로 읽는다. 비동기 판이 같은 파일에 있다 | `adapters/claude/adapter.ts:609` · `plugin-catalog.ts:273`·`:321` |
| `app://` 스킴은 standard·secure 로 등록돼 있고 자산은 파일로 응답한다 | `main/index.ts:134~160` |
| renderer 의 새 디렉토리는 `shared` 요소 안에 둬야 boundaries 설정을 안 고친다 | `eslint.config.mjs:69~78` |
| 외부 SDK/API | shiki 1.29.2 `codeToHtml`·`codeToTokens`(패키지 타입) · Electron 39 `utilityProcess.fork`·`MessageChannelMain`(TRD 스택) · Node `perf_hooks.monitorEventLoopDelay` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| renderer 의 shiki 실행 자리 | `rg -n "codeToHtml\(\|codeToTokens\(\|getHighlighter\(" app/src/renderer/src --glob '!*.test.*'` | 5줄 / 3파일 | `CodeBlock.tsx`·`diffSyntax.ts`·`syntax.ts` |
| renderer 의 jsdiff 호출 | `rg -n "buildDiffLines\(\|jsDiffLines\(\|parsePatch\(" app/src/renderer/src --glob '!*.test.*'` | 7줄 | 정의 1 · 호출 6 |
| main 의 `loadSession` 호출 | `rg -n "loadSession\(" app/src/main --glob '!*.test.*'` | 4줄 | 정의 1 · 호출 3(`session.ts:70`·`:92`·`native-session.ts:55`) |
| main 의 Node 동기 API 이름 | Node 의 `fs`·`child_process` export 중 `Sync` 로 끝나는 이름 46개를 주석 제거 뒤 토큰으로 셈 | 125 / 25파일 | 가드의 초기 등록 분모 |
| IPC 등록 함수 | `rg -n "^export function" app/src/main/infra/ipc/handle.ts` | 3 | `handle`·`handlePlain`·`on` |
| `ipcMain` 직접 등록 | `rg -n "ipcMain\.(handle\|on\|once\|handleOnce)\(" app/src/main --glob '!*.test.*'` | 7 | `handle.ts` 3 · `index.ts` 4 |
| 계산된 이름으로 동기 API 접근 | `rg -n "\[['\"\`][^\]]*Sync" app/src/main --glob '!*.test.*'` | 2 | 둘 다 타입 인덱스 `LoadedSession['nativeSync']` — 동기 API 접근 0 |
| 워커·계측 | `rg -n 'new Worker\(\|utilityProcess\|worker_threads\|monitorEventLoopDelay\|PerformanceObserver' app/src --glob '!*.test.*'` | 1 | 주석 1건 — 실사용 0 |

### 수치 / 전칭 표현 검산

이 환경(Xeon 2.3GHz 4코어, Node 22.23, Chromium headless)에서 이번 턴에 잰 값이다. 기준 PC 의 값이 아니라 순서와 자릿수를 본다.

| 작업 | 입력 | 한 번에 걸린 시간 |
|---|---|---|
| shiki `codeToHtml`(TypeScript) | 200줄 / 1,000줄 / 2,546줄 / 200,000자 | 67ms / 약 980ms / 약 2,570ms / 약 4,950ms |
| 강조 HTML 을 DOM 에 넣고 레이아웃 | 200 / 1,000 / 2,546 / 5,092줄 | 7 / 26 / 61 / 121ms |
| 원문 `<pre>` 삽입 | 같은 입력 | 2.4 / 11 / 17 / 35ms |
| jsdiff `diffLines` | 2,546줄, 1/7 변경 / 절반 변경 | 40ms / 415ms |
| remark 변환(parse + gfm + rehype) | 5,000자 / 33,441자 | 8ms / 51~95ms |
| jsdiff `parsePatch` | 0.13MB / 1.30MB / 5.22MB | 3 / 10 / 45ms |
| 세션 part 조회 + 행별 `JSON.parse` + 직렬화 | 1,000 / 10,000 / 50,000 part | 15 / 150 / 800ms |
| SQLite 단건 쓰기(WAL, `synchronous=NORMAL`) | 1건 | 0.064ms |
| `MessagePort` 왕복 | 500 / 10,000 part | 4.5 / 49ms |
| 읽기 전용 연결 | 쓰기 문 준비 가능 · 실행은 `SQLITE_READONLY` · WAL 커밋 행 보임 · 읽는 중 쓰기 안 막힘 | 4건 모두 관측 |
| shiki 조각 실행 | 100줄씩 `grammarState` 로 이어 붙인 토큰이 통째 실행과 같다 | 2,547줄 일치 |

- 내역 합 = 총계: 동기 API 25파일의 개수 합 125(§8 스크립트 출력).
- "유일한/항상/절대" 반례 검색: "모든 invoke 가 `handle`·`handlePlain` 을 지난다"는 틀렸다 — `rg -n "ipcMain\.(handle|on|once|handleOnce)\(" app/src/main --glob '!*.test.*'` → 7줄, `handle.ts` 3 + `index.ts` 4(`:234`·`:237`·`:241` 창 최소화·최대화·닫기, `:280` 부팅 대기). 이 4곳은 `handlePlain` 으로 옮긴다(§10 EP-2).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `rendering.md` §1.2·§1.3 · `app/AGENTS.md` "better-sqlite3 ABI · 제약 환경 게이트 가이드" · `handle.test.ts`·`CodeBlock.render.test.ts`·`session.load.test.ts` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01·SD-02·AR-05.
- 현재 책임 소유자: main 이 세션 본문 조회·조립·전송을, renderer 메인 스레드가 강조·diff 계산을 한다.
- 현재 오류/취소/정리 경로: 강조는 effect 의 `cancelled` 플래그로 늦은 결과만 버린다 — 계산 자체는 끝까지 돈다. 세션 로드는 `isCurrent()` 로 결과를 버린다.
- 문제의 직접 원인: 입력 크기에 비례하는 일이 UI 스레드의 한 작업으로 돈다.

```text
[CodeBlock mount]  → getHighlighter() → codeToHtml()            (renderer 메인 스레드, 동기)
[diff 타일]        → buildDiffLines() / codeToTokens() ×2        (renderer 메인 스레드, 동기)
[세션 클릭]        → invoke oo:session:load
                   → main: compactLegacyRaw → loadParts().all() → 조립 → 응답 1개
                   → renderer: LOAD_SESSION
[턴 시작]          → main: readClaudePluginCatalog() (readdirSync·readFileSync)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01·SD-02·AR-01~AR-05.
- 변경 후 책임 소유자: 아래 표.
- 변경 후 오류/취소/정리 경로: §13.
- 유지하는 기존 메커니즘: 델타 코얼레서 · `isCurrent()`/`liveChanged` 보호 · `handle()` 의 zod 검증 · 로거. 대체하는 메커니즘: renderer 의 직접 `shiki` 호출 · main 의 세션 본문 응답.

| 실행 주체 | 종류 | 수·수명 | 맡는다 | 맡지 않는다 |
|---|---|---|---|---|
| main | Electron main | 1 | 창·OS·권한·IPC 라우팅·프로세스 수명·턴 구동·순서가 중요한 단건 쓰기 | 입력 크기에 비례하는 읽기와 계산 · 등록되지 않은 동기 파일 API · 화면 갱신 지시 |
| renderer 메인 스레드 | Chromium renderer | 창마다 1 | UI 상태·그리기 예약·결과 반영·상한 있는 계산 | `shiki` 실행 · 상한 없는 diff 계산 |
| 계산 워커 | Web Worker | 창마다 1, 첫 요청에 생성, 창과 함께 종료 | 구문 강조 · diff 토큰 · diff 줄 | 상태 소유 · IPC |
| 데이터 호스트 | `utilityProcess` | 앱에 1, 첫 요청에 생성, 앱 종료 때 종료 | 읽기 전용 연결로 세션 본문 조회·조립·조각 전송 | 쓰기 · 권한 판정 |
| 하네스·git | 자식 프로세스(기존) | 그대로 | 에이전트 실행 · git | — |

```text
[CodeBlock mount]  → useHighlightedHtml → computeClient.request('highlight.html')
                   → (캐시 hit: 즉시) / 워커 postMessage → 응답 → setState
[큰 diff]          → useDiffLines → 400 이하: diffLinesWithinCap (동기)
                                  → 초과: computeClient.request('diff.lines') → 응답
[세션 클릭]        → sessionApi.load
                   → invoke oo:session:load → main: compactLegacyRaw → { activity } (작다)
                   → dataHostClient.request('session.load')
                        (포트 없으면 invoke oo:data-host:connect → main 이 fork + 포트 2개 전달)
                   → host: loadSession() → begin → chunk × n → end  (MessagePort, main 미경유)
                   → renderer: 조립 → activity 병합 → LOAD_SESSION 1회
[턴 시작]          → main: await readClaudePluginCatalogAsync()
[멈춤]             → stall-monitor / handle() / longTaskReporter → perf.stall 로그
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 강조·diff = renderer 메인 스레드 | 계산 워커 | D-008 | AR-01 / VP-04·VP-10 · `shared/compute/**` |
| 책임/소유권 | 세션 본문 = main | 데이터 호스트 | D-006 | AR-02 / VP-05·VP-11 · `app/data-host/**` |
| data/control flow | 세션 본문이 main JS 를 지난다 | 호스트 → renderer 포트 직접 | D-006 | SD-02 / VP-09 |
| state/contract | `oo:session:load` → `LoadedSession \| null` | `SessionLoadTicket` + 호스트 메시지 | D-006 | AR-05 / VP-14 · `shared/ipc.ts`·`shared/data-host.ts` |
| error/lifecycle | 강조 계산은 취소 불가 | 대기 취소·실행 중 교체·3회 실패 차단 | D-009 | SD-01 / VP-08 |
| error/lifecycle | 호스트 없음 | 지연 기동·종료 통지·재기동·종료 순서 | D-006 | SD-02 / VP-09 · `supervisor.ts` |
| test seam/관측점 | 계측 없음 | `perf.stall`(main 루프·IPC 동기 구간·renderer long task) | D-002 | MD-03·AR-03 / VP-03·VP-12 |
| test seam/관측점 | 배치 규칙이 문서에 없다 | `check-ui-thread.mjs` 가 CI 에서 강제 | D-008 | AR-04 / VP-02·VP-13 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/perf-budget.ts` | 예산 상수 SSOT — `UI_TASK_BUDGET_MS=50`·`STALL_SEVERE_MS=160` | 상수 | main·renderer·스크립트 문서 |
| `src/shared/data-host.ts` | 호스트 메시지 zod 스키마·`SESSION_CHUNK_MAX_PARTS=500`·조각 분할/조립 순수 함수 | `LoadedSession` ↔ 메시지 열 | 호스트·renderer 클라이언트 |
| `renderer shared/compute/client.ts` | 대기열·캐시·취소·워커 교체·실패 차단 | 요청 → Promise | `useHighlightedHtml`·`useDiffSyntax`·`useDiffLines` |
| `renderer shared/compute/worker/` | 워커 진입점과 처리 함수(`shiki`·`diff` 값 import 허용 구역) | 메시지 → 메시지 | `client.ts` 가 URL 로만 참조 |
| `renderer shared/compute/inline.ts` | 상한 있는 동기 diff(`diff` 값 import 허용 파일) | 문자열 → `DiffLine[] \| null` | diff 소비처 |
| `renderer shared/api/dataHost.ts` | 포트 획득·요청 번호·조립·취소 | `sessionId` → `LoadedSession \| null` | `shared/api/ipc.ts` 의 `sessionApi` |
| `renderer shared/perf/longTaskReporter.ts` | long task 묶음 보고 | 관측 항목 → `logEmit` | `main.tsx` |
| `main infra/perf/stall-monitor.ts` | 루프 지연 판정과 기록(시계·표본원 주입) | 표본 → 로그 | `bootstrap.ts` |
| `main infra/ipc/handle.ts` | 세 등록 함수의 동기 구간 계측 | 핸들러 → 로그 | 모든 핸들러 등록부 |
| `main app/data-host/supervisor.ts` | fork·포트 중개·종료 통지·shutdown | `webContents` → 포트 | `bootstrap.ts`·`handlers/session.ts` |
| `main app/data-host/entry.ts` | 호스트 진입점 — 읽기 전용 연결·요청 검증·서비스 호출 | 포트 메시지 | electron-vite main 의 두 번째 입력 |
| `main app/data-host/session-load.ts` | `loadSession` 호출·조각 전송·조각 사이 취소 확인 | 요청 → 메시지 열 | `entry.ts` |
| `app/scripts/check-ui-thread.mjs` | 규칙 4종 판정과 등록 표 | 트리 → exit code | `ci.yml`·`npm test` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-04 / VP-02·13·18 **EP-1** | UI 스레드 금지 규칙 4종 | `check-ui-thread.mjs` 의 등록 표 | 가드 | 4자리 — (a) `src/main` 의 동기 API 이름 (b) renderer 의 계산 라이브러리 값 import (c) `loadSession` import (d) `ipcMain` 직접 등록 | `node scripts/check-ui-thread.mjs --list` → 규칙별 발견 목록 | 등록 밖 사용이 CI 를 통과한다 |
| AR-03 / VP-03·12·17 **EP-2** | 멈춤 기록 `perf.stall` | `infra/perf/stall-monitor.ts` 의 기록 함수 | main | 7자리 — 등록 함수 `handle`·`handlePlain`·`on` + `index.ts:234`·`:237`·`:241`·`:280` 의 직접 등록(→ `handlePlain`) | §8 의 `ipcMain` 직접 등록 `rg` → 7 | 느린 핸들러가 채널 이름 없이 묻힌다 |
| AR-01 / VP-04·08·10·15·19 **EP-3** | UI 스레드에서 사라지는 계산 호출 | `shared/compute/client.ts` | renderer | 9자리 — `CodeBlock.tsx:57`·`:65` · `diffSyntax.ts:20`·`:25` · `DiffBody.tsx:26`·`:31`·`:36` · `filePresentation.ts:9` · `toolMeta.ts:185` | §8 전수 조사의 두 `rg` — 정의·`syntax.ts`·`unifiedDiffLines.ts:7` 을 뺀 9 | 그 자리가 UI 스레드에서 계속 계산한다 |
| AR-05 / VP-05·14 **EP-4** | 세션 본문을 main 응답에 싣지 않는다 | `shared/ipc.ts` 의 `SessionLoadTicket` | main | 3자리 — `session.ts:70`·`:92`·`native-session.ts:55` | `rg -n "loadSession\(" app/src/main --glob '!*.test.*'` → 정의 빼고 3 | 본문이 main 을 지난다 |
| AR-02 / VP-05·09 **EP-5** | 호스트 포트 전달 | `supervisor.ts` | main·preload | 2자리 — `supervisor.connect` 의 두 `postMessage` · preload 의 포트 전달 | 구현 뒤 `rg -n "dataHostPort" app/src` | 포트가 한쪽에만 간다 → 요청이 영원히 대기 |
| AR-02 / VP-05·09·11·16 **EP-6** | 호스트 메시지 5종 | `shared/data-host.ts` | 호스트·renderer | 5자리 — `begin`·`chunk`·`end`·`error`·`cancel` | 구현 뒤 `rg -n "type: '(begin\|chunk\|end\|error\|cancel)'" app/src/shared/data-host.ts` | 조립 불일치·취소 무시 |
| VP-06 **EP-7** | 턴 시작 카탈로그는 비동기 | `plugin-catalog.ts` | main | 1자리 — `adapter.ts:609` | `rg -n "readClaudePluginCatalog\b" app/src/main --glob '!*.test.*'` | 턴 시작마다 디렉토리 순회가 main 을 막는다 |

**EP-1 규칙 칸** (가드의 판정 — 분기마다 `check-ui-thread.test.mjs` 입력 1개):

| 규칙 | 분기 | 기대 |
|---|---|---|
| (a) 동기 API | 등록 없는 파일에 이름 추가 | exit 1 |
| (a) | 등록된 파일의 개수가 등록보다 많음 | exit 1 |
| (a) | 등록된 파일의 개수가 등록보다 적음 | exit 1 |
| (a) | 주석·문자열 안의 이름 | exit 0 |
| (a) | 테스트 파일(`*.test.ts`·`*.testfixture.ts`) | exit 0 |
| (b) 계산 라이브러리 | 허용 밖 파일의 값 import(`import { x } from 'shiki'`·`import('shiki/core')`) | exit 1 |
| (b) | 허용 밖 파일의 `import type` | exit 0 |
| (b) | `shared/compute/worker/**` 의 값 import · `shared/compute/inline.ts` 의 `diff` 값 import | exit 0 |
| (b) | `lib/unifiedDiffLines.ts` 처럼 허용 밖 파일의 `diff` 값 import | exit 1 |
| (b) | `inline.ts` 의 `shiki` 값 import | exit 1 |
| (c) `loadSession` | 등록 밖 파일의 import | exit 1 |
| (c) | 등록된 파일(`app/data-host/session-load.ts`·`app/chat-turn/native-session.ts`)의 import | exit 0 |
| (d) `ipcMain` 등록 | `infra/ipc/handle.ts` 밖의 `ipcMain.handle(`·`.on(`·`.once(`·`.handleOnce(` | exit 1 |
| (d) | `infra/ipc/handle.ts` 안의 등록 | exit 0 |

- 가드는 열린 입력 집합을 판정한다 → **fail-closed 로 설계한다.** (a)의 이름 집합은 Node 가 정한다(`Object.keys(require('node:fs'))`·`child_process` 중 `Sync` 로 끝나는 것 — 실행 시 계산). 같은 이름의 로컬 함수(`native-settings-file.ts:75` 의 `readSync`)도 걸리며, 등록하거나 이름을 바꾼다. (b)는 모듈 지정자 문자열(`'shiki'`·`'shiki/…'`·`'diff'`)이 `import type` 이 아닌 문장에 나오면 실패다 — 모르는 import 형태는 실패 쪽으로 떨어진다.
- 등록 표는 `{ file, count, class, reason }` 이다. `class` 는 `boot`(부팅·마이그레이션 전용) · `single-file`(파일 하나의 읽기·쓰기·존재 확인) · `capped`(상한 상수 있음) · `tooling`(프로덕션 경로 아님) 넷이다. 초기 등록은 §8 의 25파일에서 `plugin-catalog.ts` 를 뺀 24파일이다.
- **EP-6 규칙 칸** (조각 분할 — `data-host-chunks.test.ts` 입력): part 합이 500 이하인 세션 → 조각 1 · 1,200 part(메시지당 10) → 조각 3, 각 ≤ 500 · part 700 인 메시지 하나 → 단독 조각 · 메시지 0개 → `begin` + `end`, 조각 0.
- **선언 경계** (측정한 것만):
  - B1 — Markdown 변환은 renderer 메인 스레드에 남는다: 33,441자에서 51~95ms(§8). 이 handoff 는 `perf.stall` 로 드러내기만 한다.
  - B2 — 강조 HTML 과 원문의 DOM 삽입은 UI 스레드에 남는다: 강조 1,000줄 26ms, 원문 5,092줄 35ms(§8). 강조는 32,000자 상한으로 막고 원문 `<pre>` 에는 상한이 없다.
  - B3 — 턴 스트림은 main 에 남는다(D-010): 단건 쓰기 0.064ms(§8). 이벤트 하나의 크기에는 상한이 없다(`rendering.md` §1.8 "버퍼 상한이 없다").
  - B4 — `native-session.ts:55` 의 `loadSession` 은 main 에 남는다: 턴 시작의 복구 경로이고 화면 조작 경로가 아니다. 비용은 세션 로드와 같다(1만 part 150ms).
  - B5 — `handle()` 계측은 핸들러의 첫 `await` 전 동기 구간만 잰다. 그 뒤의 멈춤은 루프 모니터가 채널 이름 없이 잡는다.
  - B6 — 조각 하나의 바이트 크기에는 상한이 없다: part 하나가 수 MB 면 그 조각의 역직렬화가 길어진다.
  - B7 — 가드 (a)는 이름 토큰을 본다: `fs['read' + 'FileSync']` 같은 계산된 접근은 잡지 못한다. 트리에 그런 형태는 0 이다(§8 전수 조사).
  - B8 — unified patch 파싱은 UI 스레드에 남는다: 1.30MB 에서 10ms(§8). `PATCH_INLINE_MAX_CHARS=1_000_000` 을 넘는 patch 는 파싱하지 않고 기존 파싱 실패 폴백(원문 표시)으로 간다.
- 같은 규칙이 여러 레이어에 있다면 SSOT: 예산 수치는 `src/shared/perf-budget.ts`, 조각 상한과 메시지 스키마는 `src/shared/data-host.ts` 한 곳이다. 강조 상한 `HIGHLIGHT_MAX_CHARS=32_000` · diff 상한 `DIFF_INLINE_MAX_LINES=400` · patch 상한 `PATCH_INLINE_MAX_CHARS=1_000_000` 은 `shared/compute/limits.ts` 한 곳이다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면: 해당 없음.
- 선택적 필드의 `true/false/undefined` 의미: `SessionLoadTicket.activity` 는 지금의 `LoadedSession.activity` 와 같다 — 없으면 "활동 정보 없음"이고 소비자는 지금처럼 다룬다.
- 외부 SDK 경계의 실제 요구 타입/의미: `utilityProcess.fork(modulePath, args, { serviceName })` 의 자식은 `process.parentPort` 로 받는다. `MessagePortMain` 은 `start()` 를 불러야 메시지가 흐른다. preload 는 받은 포트를 `window.postMessage(msg, window.location.origin, ports)` 로 메인 월드에 넘긴다.

## 11. 구현 설계

구현 순서는 표의 단계 번호를 따른다. 단계마다 게이트를 돌리고 다음으로 간다.

| 단계 | 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|---|
| 1 | `src/shared/perf-budget.ts` | 예산 상수 | 신규 | — |
| 1 | `src/main/infra/perf/stall-monitor.ts` | 루프 멈춤 판정 | 신규. 표본원(`() => maxMs` 후 reset)·시계·로거를 주입받는 순수 코어와 `monitorEventLoopDelay({ resolution: 10 })` 를 묶는 얇은 시작 함수. 1초 창마다 최댓값 1건 | 순수 단위 |
| 1 | `src/main/infra/ipc/handle.ts` | 동기 구간 계측 | 세 등록 함수가 `fn` 호출 전후 시각 차를 재고 50ms 이상이면 `perf.stall`(`source:'ipc'`, `label: channel`). 시계 주입 가능 | 순수 단위(기존 테스트 파일) |
| 1 | `src/renderer/src/shared/perf/longTaskReporter.ts` · `main.tsx` | long task 보고 | 신규. 항목을 1초 창으로 묶어 `logEmit` 1건(`count`·`maxMs`) | 순수 단위(관측자 주입) |
| 2 | `scripts/check-ui-thread.mjs` · `.test.mjs` · `ci.yml` · `package.json` test 스크립트 | 가드 | 신규. `--list` 는 발견 목록 출력. `ci.yml` 의 테스트 예산 가드 뒤에 단계 추가 | `node --test` |
| 3 | `shared/compute/{protocol,client,limits,inline}.ts` | 계산 클라이언트 | 신규. `WorkerLike`(`postMessage`·`terminate`·`onmessage`·`onerror`) 팩토리를 주입받는다 | 순수 단위(가짜 워커) |
| 3 | `shared/compute/worker/{compute.worker,handler}.ts` | 워커 | 신규. `handler.ts` 는 요청 → 응답 순수 함수, `compute.worker.ts` 는 `self.onmessage` 배선만 | 순수 단위(`handler`) |
| 3 | `shared/ui/markdown/{CodeBlock.tsx,syntax.ts}` | 강조 소비 | `syntax.ts` 의 하이라이터 생성을 `worker/` 로 옮기고 `isLang` 등 순수 판정만 남긴다. `CodeBlock` 은 `useHighlightedHtml` 로 받는다 | 기존 렌더 테스트 |
| 3 | `features/chat/lib/{diffSyntax,diffLines,toolMeta,unifiedDiffLines}.ts` · `hooks/useDiffSyntax.ts` · 신규 `hooks/useDiffLines.ts` · `DiffBody.tsx` · `filePresentation.ts` | diff 소비 | jsdiff 호출을 `inline.ts`/워커로. 순수 함수 소비처는 상한 초과 시 `null` 을 받는다. `parsePatch` 는 `inline.ts` 의 상한 있는 함수로 옮긴다(B8) | 순수 단위 |
| 3 | `electron.vite.config.ts` | 워커 번들 | `renderer.worker.format = 'es'` | 사람 실기(AC23) |
| 4 | `src/shared/data-host.ts` | 메시지 계약·분할·조립 | 신규 | 순수 단위 |
| 4 | `src/main/app/data-host/{supervisor,entry,session-load}.ts` | 호스트 | 신규. `supervisor` 는 fork 함수·채널 생성 함수를 주입받는다. `entry` 는 DB 경로를 인자로 받는다 | 순수 단위(`supervisor`) · io(`session-load`) |
| 4 | `electron.vite.config.ts` | 호스트 번들 | `main.build.rollupOptions.input` 에 `data-host` 진입점 추가 | 사람 실기(AC23) |
| 4 | `src/shared/ipc.ts` · `protocol.ts` · `preload/index.ts` · `renderer shared/api/{ipc,dataHost}.ts` | 응답 계약·포트 | `SessionLoadTicket` · `RefreshSessionResult.updated` 에서 `session` 제거 · `CHANNELS.dataHostConnect`·`dataHostPort`·`dataHostExited` 추가 | 기존 preload·핸들러 테스트 |
| 4 | `src/main/app/handlers/session.ts` · `bootstrap.ts` | 핸들러·수명 | 두 핸들러가 티켓만 돌려준다. `shutdown()` 은 `closeDb` 앞에서 호스트를 내린다 | 기존 핸들러 테스트 |
| 4 | `features/chat/store/chatStore.ts` | 취소 배선 | `loadSession`·`refresh` 가 `AbortSignal` 을 넘기고 `sessionLoads` 교체·삭제 때 abort 한다 | 기존 스토어 테스트 |
| 5 | `adapters/claude/{adapter,plugin-catalog}.ts` | 비동기 카탈로그 | `adapter.ts:609` 를 `await readClaudePluginCatalogAsync` 로, 동기 판 삭제 | 기존 카탈로그 테스트 |
| 6 | `docs/arch/execution-model.md` · `docs/decisions/012-execution-contexts.md` · `docs/INDEX.md` · `IPC_CONTRACT.md` · `arch/frontend/rendering.md` §1.3 · `arch/backend/{overview,runtime-ipc,security}.md` · 두 `AGENTS.md` · `app/AGENTS.md` CI 표 | 문서 | 현재 상태로 갱신. 수치는 상수 경로로 적는다 | 문서 가드 |

### 계산 클라이언트의 규칙 (MD-01)

| 규칙 | 내용 |
|---|---|
| 동시 실행 | 워커에 나가 있는 요청은 1개다 |
| 순서 | 대기열은 입력 문자 수 오름차순, 같으면 먼저 온 것 |
| 캐시 | 키 = `종류 + 언어 + 테마 + 내용`. 결과 문자 수 합 4,000,000 초과 시 가장 오래 안 쓴 것부터 버린다 |
| 중복 | 같은 키의 요청이 대기·실행 중이면 그 Promise 를 공유한다. 공유자가 모두 취소해야 취소다 |
| 취소 | 대기 중이면 대기열에서 뺀다. 실행 중이고 대기 요청이 있으면 `terminate()` 뒤 새 워커로 대기열을 잇는다. 대기 요청이 없으면 끝나길 기다리고 결과는 캐시에만 넣는다 |
| 실패 | 생성 실패·`error`·`messageerror` → 실행 중 요청 reject, 오류 로그 1건, 워커 폐기. 연속 3회면 이후 요청을 즉시 reject 한다. 성공 응답이 오면 연속 횟수는 0 이 된다 |

### 세션 로드의 규칙 (MD-02 · SD-02)

| 단계 | 누가 | 내용 |
|---|---|---|
| 티켓 | main `oo:session:load` | `compactLegacyRaw` → `{ activity }` 반환. 본문을 읽지 않는다 |
| 연결 | renderer → main `oo:data-host:connect` | 호스트가 없으면 fork. `MessageChannelMain` 의 한쪽은 호스트에, 다른 쪽은 요청한 `webContents` 에 보낸다 |
| 요청 | renderer → 호스트 | `{ type:'session.load', requestId, sessionId }` — zod 검증 실패는 `error` |
| 응답 | 호스트 → renderer | `begin{head}` → `chunk{seq, messages}` × n → `end{messageCount}`. 세션이 없으면 `end{missing:true}` |
| 양보 | 호스트 | 조각 사이에 매크로태스크 1회를 넘겨 `cancel` 을 받는다 |
| 조립 | renderer | `seq` 가 0 부터 이어지고 메시지 수가 `messageCount` 와 같으면 `LoadedSession` 을 만든다. 어긋나면 실패 |
| 반영 | `chatStore` | 지금의 `isCurrent()` 판정 뒤 `LOAD_SESSION` 1회. 조각 수신 중에는 스토어를 건드리지 않는다 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `stall-monitor.ts`(코어) · `shared/data-host.ts` · `shared/compute/client.ts` · `shared/compute/worker/handler.ts` · `supervisor.ts`(fork·채널 주입). `entry.ts`·`compute.worker.ts` 는 배선만 갖고 단위 테스트 대상이 아니다 — AC23 이 닫는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `logEmit` 은 단방향 `send` 라 long task 보고가 응답을 기다리지 않는다. `isCurrent()` 는 `await sessionApi.load` 의 길이와 무관하게 성립한다.
- 순서를 관측할 훅/로그/주입 경계: `shutdown()` 의 호스트 종료 → `closeDb` 순서는 주입한 가짜의 호출 기록으로 본다.
- 풀 분류: `session-load.test.ts` 는 SQLite 를 쓰므로 io, 나머지 신규 테스트는 unit 이다(`app/AGENTS.md` vitest 풀 분류).

## 12. End-to-end 영향

### producer → consumer

```text
호스트 loadSession() → 조각 메시지 → dataHost 조립 → sessionApi.load → chatStore LOAD_SESSION → transcript
워커 handler → 응답 → computeClient 캐시 → useHighlightedHtml/useDiffSyntax/useDiffLines → CodeBlock/DiffTable
```

- producer 기준: 호스트의 `LoadedSession` 은 `features/history/reader.ts` 의 `loadSession` 을 그대로 부른 값이다 — 조립 규칙의 사본을 만들지 않는다.
- consumer 파생 규칙: `chatStore` 는 조립된 `LoadedSession` 에 티켓의 `activity` 를 얹어 지금과 같은 형상을 받는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 조각은 전송 단위일 뿐 스토어에 들어가지 않는다(D-011).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `sessionApi.load` 호출부(`chatStore.ts:1792`) | 반환 형상은 그대로, 대기 시간만 달라진다 | AC15·VP-20 |
| `sessionApi.refresh` 호출부(`chatStore.ts:1840`) | `updated` 응답에 `session` 이 없다 → 호스트에서 다시 받는다 | AC19 |
| `shutdown()` 순서(`index.ts` will-quit → `closeDb`) | 호스트 종료가 `closeDb` 앞에 선다 | AC18 |
| `ci.yml` 단계 목록과 `app/AGENTS.md` CI 표 | 가드 단계 1개 추가 | AC1 |
| `getHighlighter` 소비처 2곳 | 워커 쪽으로 옮겨져 renderer 메인 번들에서 사라진다 | AC3·AC8·AC9 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 워커는 첫 계산 요청, 호스트는 첫 `oo:data-host:connect` 에 만든다. 모니터는 `bootstrap` 시작 때 켠다.
- 취소/중단: 계산은 §11 취소 규칙. 세션 로드는 `AbortSignal` → `cancel` 메시지 → 호스트가 다음 조각부터 중단.
- 종료/quit/crash/renderer-gone: 창이 닫히면 워커가 함께 끝난다. `webContents` 가 사라지면 호스트 쪽 포트가 닫힌다. 호스트가 죽으면 main 이 `oo:data-host:exited` 를 모든 창에 보내고 클라이언트는 진행 중 요청을 reject 한 뒤 포트를 버린다.
- retry/timeout/partial failure: 호스트 요청은 30초 안에 `end`·`error` 가 없으면 실패다. 자동 재시도는 없다 — 사용자가 다시 연다.
- cleanup/rollback: `shutdown()` 은 예약 작업 `dispose` → `Scheduler.stopAll()` → 호스트 종료 → `closeDb` 순이다.
- **다중 저장소 쓰기**: 해당 없음 — 호스트는 읽기 전용이고 새 쓰기 경로가 없다. 산출 문서의 상태 사본은 이 plan 의 메타와 `INDEX.md` 행 두 곳이다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: `perf.stall` 은 main 창당 1건/초 + renderer 창당 1건/초다. 조각은 part 500개 × 조각 수(세션 part 수 / 500)다.
- 새 요청 수의 `원천 상한 × 배치 상한`: 계산 요청은 화면에 놓인 코드 블록 수(가상 스크롤이 제한)이고 워커 동시 실행은 1 이다. 호스트 요청은 세션 열기·갱신당 1 이다.
- 구조적 목표: 해당 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과와 회귀 테스트: 강조 캐시는 테마를 키에 넣어 테마 전환 뒤 옛 색이 남지 않는다 — `client.test.ts` 에 "테마만 다른 요청은 전송된다" 케이스를 둔다.
- 메모리: 호스트 프로세스 1개와 창당 워커 1개가 는다. 워커는 shiki 문법 11종을 한 벌 더 갖는다(renderer 메인 번들에서는 빠진다).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 배포·플러그인이 구현할 포트를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| IPC 채널을 바꾸면 `IPC_CONTRACT.md` 를 같은 PR 에서 갱신 | `docs/AGENTS.md` 작성 규칙 6 | §11 단계 4·6 | 유지 — 갱신 대상에 포함 |
| `src/main` 최상위는 `{app, contracts, adapters, features, infra}` 뿐 | `app/src/main/AGENTS.md` | §9 호스트 위치 `app/data-host/` | 유지 |
| renderer 4-layer — `shared` 는 `shared` 만 의존 | `app/src/renderer/AGENTS.md` | §9 `shared/compute/**` | 유지 |
| TRD 스택 밖 패키지는 사용자 승인 | `app/AGENTS.md` 의존성 정책 | §17 | 유지 — 신규 의존성 0 |
| 보안 베이스라인(`sandbox`·`contextIsolation`) | `app/AGENTS.md` | §10 preload 포트 전달 | 유지 — 옵션 불변, 포트 전달 경로를 `security.md` 에 적는다 |
| 텔레메트리는 미정 항목 | PRD §11 | D-013 | 유지 — 로컬 로그만 |
| 편집 미리보기는 1MiB 상한으로 main 에서 동기로 읽는다(0229 E-006) | `adapters/claude/edit-preview.ts:87` | §10 EP-1 등록 `capped` | 유지 |
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` 원칙 4 | §11 단계 6 | 유지 — arch 문서는 상수 경로를 적는다 |
| 연구 문서 §5.2 "main 의 기존 경로로 한 번 대체" | `vscode-comparison-and-proposal.md` | D-009 | 변경 — 대체 경로는 멈춤의 원인이라 두지 않는다 |
| 0323 D-015 "역할·워커 작업 우선" | 0323 plan | D-001 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 워커·호스트의 실제 기동은 에이전트 환경에서 실행할 수 없다 | 배선 파일을 얇게 두고 로직을 주입 가능한 순수 파일에 둔다. 실기는 AC23 |
| 세션 로드가 두 번의 왕복(티켓 → 호스트)이 된다 | 작은 세션에서 수 ms 가 는다. 그 사이의 라이브 이벤트는 기존 `liveChanged` 가 막는다(VP-20) |
| 32,000자 초과 코드가 강조 없이 보인다 | D-012 — 사용자가 거부하면 줄 블록 단위 점진 반영으로 다시 설계한다 |
| 한 handoff 의 AC 가 23건이다 | D-005. §11 의 6단계 순서로 구현하고 단계마다 게이트를 돌린다 |
| 실행 중 강조가 길면 뒤 요청이 기다린다 | 짧은 것 먼저 + 취소 시 워커 교체. 기다리는 동안은 원문이라 조작은 막히지 않는다 |
| 호스트가 renderer 에서 온 요청을 직접 받는다 | 요청마다 zod 검증, 서비스는 세션 읽기 1종, 연결은 읽기 전용 |

- 되돌리기 어려운 결정: `oo:session:load`·`oo:session:refresh` 응답 형상 변경(같은 릴리스 안의 main·renderer 만 쓰므로 버전 호환 문제는 없다) · 프로세스 1개 추가.
- 신규 의존성: 없음 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{perf-budget,data-host,ipc,protocol}.ts`
- `app/src/main/infra/{perf/stall-monitor,ipc/handle}.ts` · `app/src/main/app/{bootstrap.ts,handlers/session.ts,data-host/*}` · `app/src/main/adapters/claude/{adapter,plugin-catalog}.ts`
- `app/src/preload/index.ts`
- `app/src/renderer/src/{main.tsx,shared/compute/**,shared/perf/**,shared/api/{ipc,dataHost}.ts,shared/ui/markdown/{CodeBlock.tsx,syntax.ts}}`
- `app/src/renderer/src/features/chat/{lib/{diffSyntax,diffLines,toolMeta}.ts,hooks/{useDiffSyntax,useDiffLines}.ts,store/chatStore.ts}` · `DiffBody.tsx` · `filePresentation.ts` · `shared/i18n/ko.ts`
- `app/scripts/check-ui-thread.{mjs,test.mjs}` · `app/electron.vite.config.ts` · `app/package.json`(test 스크립트만) · `.github/workflows/ci.yml`
- `docs/arch/execution-model.md` · `docs/decisions/012-execution-contexts.md` · `docs/INDEX.md` · `docs/IPC_CONTRACT.md` · `docs/arch/frontend/rendering.md` · `docs/arch/backend/{overview,runtime-ipc,security}.md` · `app/AGENTS.md` · `app/src/{main,renderer}/AGENTS.md` · `docs/generated/inventory.md`(재생성)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` "better-sqlite3 ABI · 제약 환경 게이트 가이드" · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md` · `docs/AGENTS.md`.
- ABI/네트워크 등 환경 제약: Electron 바이너리를 받지 못하는 환경에서는 `dev`·`build` 를 돌리지 못한다. DB 로드 스위트의 바인딩 실패는 알려진 서명으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: 수정 루프는 `./node_modules/.bin/vitest run <suite>`. IMPL_DONE 전에는 `app/AGENTS.md` "로컬 확인"의 명령 전부와 `node scripts/check-ui-thread.mjs`.
- 사람 실기(AC22): Windows 에서 아래를 수행하고 로그의 `perf.stall` 을 센다. 각 시나리오 중 스크롤·입력·창 드래그를 함께 한다.

| # | 시나리오 | 보는 것 |
|---|---|---|
| 1 | 800줄 TypeScript 코드 블록이 있는 메시지를 연다 | 원문이 먼저 보이고 색이 뒤에 입혀진다. 그동안 스크롤이 끊기지 않는다 |
| 2 | 5,000줄 파일을 출력 뷰어로 연다 | 강조 없이 열리고 스크롤이 끊기지 않는다 |
| 3 | 2,000줄 이상 바뀐 파일의 diff 타일을 연다 | 로딩 표시 뒤 diff 표. 그동안 다른 타일을 누를 수 있다 |
| 4 | part 5,000개 이상인 세션을 여는 동안 다른 세션이 스트리밍 중이다 | 스트리밍 글자가 멈추지 않고 창을 끌 수 있다 |
| 5 | 세션 10개를 빠르게 번갈아 누른다 | 마지막에 누른 세션이 열린다. 입력창 타이핑이 끊기지 않는다 |
| 6 | 스트리밍 중에 창을 최대화·복원하고 입력창에 타이핑한다 | 끊김이 없다 |

- 사람 실기(AC23): `npm run build:win` 산출물을 설치해 시나리오 1·4 를 한 번씩 수행한다.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — D-001~D-014, OPEN 0.
- [x] Part I 만 읽어도 사용자/제품 완료 상태가 이해된다 — §1·§5 상태표.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "(로딩표시 제외)"·"전부"의 해석은 §2 추론 의도에 따로 적었다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 상태표 10행 ↔ AC5~AC20.
- [x] Technical Design 에 AS-IS 와 TO-BE 가 모두 있고 같은 축으로 작성되어 있다 — §9 네 경로.
- [x] AS-IS → TO-BE Delta 의 각 변경이 구현 파일/모듈 또는 AC 에 추적 가능하다 — Delta 8행 모두 V 칸 보유.
- [x] AS-IS 에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE 에 명시했다 — 강조·세션 본문은 이동, 동기 카탈로그는 삭제.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8. 전칭 1건("모든 invoke 가 등록 함수를 지난다")은 반례 4로 정정했다.
- [x] 각 AC 가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 23행.
- [x] Baseline V 를 썼고 유효 V 를 재구성할 수 있다 — V1.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW/CHANGED node 에 같은 레벨 REQUIRED pair 가 있다 — R 7·SD 2·AR 5·MD 5 ↔ VP-01~VP-19.
- [x] 영향받은 INHERITED node 는 REGRESSION 이다 — SD-03 ↔ VP-20.
- [x] 각 pair 의 경로·§10 분모·oracle 좌표가 있고 적대 증거는 VP-02·VP-12·VP-18 만 선택했다.
- [x] 규칙 칸의 분기마다 UT 입력 칸에 그 분기로 가는 입력이 있다 — EP-1 14분기 · EP-6 4분기 · AC5 4표본 · AC10 2표본.
- [x] 선언 경계를 §10 에 적었다 — B1~B8. 가드는 fail-closed 다.
- [x] INDEX `## 새 handoff 후보` 표에서 겹치는 행을 확인했다 — `chatStore.ts` 를 짚는 0308 행 1건은 이미 0319 로 승격됐고 그 형태(`sessionBusy` 소비처 잠금)는 이번 변경이 만들지 않는다. 그 밖에 겹치는 행 0.
- [x] 현재 변경 산출물의 운영 gate 가 열거됐다 — §7-A 4행.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기는 프레임과 프로세스 기동뿐이다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — "UI 스레드에서 강조하지 않는다"는 가드(AC3)와 행동(AC8·AC12)을 짝지었다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §9 책임표·§10.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 5행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] 상한·총량·one-way door 를 필요한 곳에서 계산했다 — §14·§17.
- [x] 게이트 명령이 대상 subtree 의 현재 `AGENTS.md` 와 충돌하지 않는다 — §19.
- [x] 본문 완성 후 Decision Ledger 와 기존 결정을 교차검증했고 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 필드와 표의 열은
> [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md) 의 `[구현자 기입]` 을 그대로 쓴다.

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] 구현 보고

## [구현자 기입] Review Signals — 사실만

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|

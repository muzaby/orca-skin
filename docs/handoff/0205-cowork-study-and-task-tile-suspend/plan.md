# Plan — 0205-cowork-study-and-task-tile-suspend

> 절차 정본은 [`SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0205-cowork-study-and-task-tile-suspend` |
| 작성자 | Claude Code |
| 일자 | 2026-08-28 |
| 매핑 | — |
| 상태 | DRAFT → READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0204 의 V 노드를 바꾸지 않는다(§16) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: cowork 의 반환 메시지 렌더링 모델을 라이브 세션에서 분석했으나 그 결과가 대화 스크롤백에만 있다. 동시에 `작업` 타일은 cowork 양식을 절반만 따른 상태로(0204 D-022 — `출력`·`컨텍스트` 는 빈 자리) 사용자에게 열려 있다.
- 완료 후 달라지는 것: 분석 결과가 `docs/etc/study/cowork/` 사례 연구로 남고, `작업` 타일은 cowork 렌더링을 도입할 때까지 사용자 진입점이 닫힌다.
- 성공을 사용자 관점에서 한 문장으로: 반쯤 만든 `작업` 패널이 화면에서 사라지고, 그것을 마저 만들 때 읽을 조사 문서가 저장소에 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "cowork와 관련된 구현은 자료조사를 더 하고 구현할 것이다" | 사용자 턴 (2026-08-28) |
| 명시 요구 | "1. 분석한 내용을 cowork 분석을 주제로로 정리한다. 첨부파일도 함께." | 사용자 턴 (2026-08-28) |
| 명시 요구 | "첨부 원본 3개는 업로드 하지 말 것" | 사용자 턴 (2026-08-28, 후속) |
| 명시 요구 | "2. 현재 구현된 작업 패널은 cowork 구현전까지 숨긴다." | 사용자 턴 (2026-08-28) |
| 명시 요구 | "3. orca는 현재까지 구현된 TaskXXX 처리만 지원한다." | 사용자 턴 (2026-08-28) |
| 명시 요구 | 숨김 대상은 `작업` 타일만 — `백그라운드 작업` 은 남긴다 | 사용자 턴 (AskUserQuestion, 2026-08-28) |
| 추론 의도 | 타일 버튼의 미확인 완료 배지도 함께 끈다 — 가리킬 타일이 없어진다 | 설계자 판단, D-006 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | cowork 렌더링 모델의 **구현은 이번 handoff 에서 하지 않는다** — 조사 결과 정리와 진입점 정지까지다 | "cowork와 관련된 구현은 자료조사를 더 하고 구현할 것이다" | 사용자 턴 | ACTIVE | — |
| D-002 | 분석 결과는 `docs/etc/study/cowork/` 에 **외부 사례 연구**로 둔다 | `docs/AGENTS.md §문서를 어디에 두는가` 가 "전략 논거·외부 사례 연구 → `etc/`" 를 지정하고, `etc/study/<project>/` 에 claude·goose·hermes-agent·opencode 선례가 있다 | 사용자 턴 + docs/AGENTS.md | ACTIVE | — |
| D-003 | 첨부 원본 3개(DOM 덤프)는 **저장소에 올리지 않는다**. 문서는 원본에서 뽑은 파생 표를 증거로 갖고, 캡처 대상·방법·일자만 출처로 적는다 | "첨부 원본 3개는 업로드 하지 말 것". `muzaby/orca-skin` 은 공개 저장소이고(익명 API 200) 덤프에 사용자명 `rlaeo` 4곳·PC명 1곳·다운로드 파일명 목록이 있다 | 사용자 턴 | ACTIVE | D-003a 를 대체 |
| D-003a | 식별자만 마스킹한 뒤 원본을 커밋한다 | 공개 저장소의 식별자 노출을 줄이면서 재검증 가능성을 남긴다 | 사용자 턴 (AskUserQuestion) | **SUPERSEDED** | → D-003 (사용자가 같은 세션에서 업로드 금지로 변경) |
| D-004 | `작업`(task) 타일을 **정지**한다 — 타일 메뉴에서 빼고 활성화 경로를 막는다. 타일 내용 코드·테스트·i18n 은 **그대로 둔다** | "현재 구현된 작업 패널은 cowork 구현전까지 숨긴다" — *숨긴다*·*구현 전까지* 는 제거가 아니라 진입점 차단이다 | 사용자 턴 | ACTIVE | — |
| D-005 | `백그라운드 작업`(subagent)·`계획`(plan) 타일은 건드리지 않는다 | 사용자가 두 선택지 중 "`작업` 타일만" 을 선택했다. `백그라운드 작업` 은 cowork 이전 기능의 복구(0204 D-016)라 cowork 도입 조건과 무관하다 | 사용자 턴 (AskUserQuestion) | ACTIVE | — |
| D-006 | 타일 버튼의 **미확인 완료 배지도 함께 정지**한다 | 배지를 끄는 3지점이 모두 `작업` 타일 도달을 전제한다(§8). 타일을 못 열면 배지는 켜진 채 영구 고착한다 | 설계자 판단 | ACTIVE | 0204 D-004 의 통지 수단을 정지 기간 동안 무효화한다 — 제거가 아니라 함께 복귀 |
| D-007 | `unseenSettledTaskKeys` 의 **이벤트 파생은 그대로 둔다** — 화면 표시만 끈다 | "orca는 현재까지 구현된 TaskXXX 처리만 지원한다" 는 현행 유지다. 파생을 끊으면 복귀 시 이벤트 경로를 다시 만들어야 한다 | 사용자 턴 #3 | ACTIVE | — |
| D-008 | `reserved1` 의 지위는 **바꾸지 않는다** — 메뉴 비노출은 유지하되 활성화 차단 대상이 아니다 | 요구는 `작업` 타일만이다(D-005). `reserved1` 까지 차단하면 3타일 기하 회귀 테스트(`chatReducer.plan.test.ts:86` "열이 비면 열 인덱스 키 폭/행분할도 splice") 를 reducer 경로로 재현할 수 없다 | 설계자 판단 + 실측 | ACTIVE | — |
| D-009 | TaskXXX 파생(`taskBoard.ts`·`shared/task-tool.ts`)과 타일 내용 렌더는 **확장하지도 제거하지도 않는다** | "orca는 현재까지 구현된 TaskXXX 처리만 지원한다" | 사용자 턴 #3 | ACTIVE | — |
| D-010 | 정지가 무효화하는 **0204 테스트 단언은 정지 사실을 단언하도록 다시 쓴다** — 삭제하지 않는다 | `OPEN_TASK` 가 타일을 붙인다는 단언 2건(0204 AT-30 증거)이 D-004 와 정면 충돌한다. 지우면 복귀 시 무엇이 바뀌었는지 알 수 없다 | 설계자 판단 + 실측(§8) | ACTIVE | — |
| D-011 | 활성화 차단은 **reducer 층**에 둔다 — 기하 헬퍼 `addTileColumnMajor` 에 넣지 않는다 | 가시성은 제품 정책이고 `rightPanelLayout.ts` 는 열/행 채우기 기하다. 기하 헬퍼에 넣으면 `rightPanelLayout.test.ts` 의 `'task'` **15건**(순수 기하, reducer 미경유)이 정책 때문에 깨진다 | 설계자 판단 + 실측(§8) | ACTIVE | — |
| D-012 | 이번 작업의 구현 주체는 **Claude** 다 — plan → impl → verify 절차는 낮추지 않는다 | 산출이 문서 4종 + 진입점 정지 + 테스트 재작성이라 `docs/handoff/AGENTS.md §역할 분담` 의 비기능 작업(리팩토링·정리)에 해당한다. 새 제품 기능을 만들지 않는다(D-001) | 설계자 판단 (역할 분담 규칙) | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-012 (신규 handoff).
- 변경된 결정: **D-003a → D-003** — 사용자가 AskUserQuestion 답변("식별자만 마스킹 후 원문 커밋") 직후 "첨부 원본 3개는 업로드 하지 말 것" 으로 바꿨다. 변심이지 실패가 아니다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0204 D-015(두 타일)·D-017 ~ D-022·D-027 — 타일 *정의와 내용* 은 그대로다. 정지는 진입점만 닫는다(§16).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 확인한 쌍 — D-004("메뉴에서 빼고 활성화를 막는다") ↔ AT-01·AT-02·AT-03 → 일치 · D-005("`백그라운드 작업` 은 남긴다") ↔ AT-01(메뉴 잔여 2종에 포함)·AT-05 → 일치 · D-006("배지도 정지") ↔ AT-04 → 일치 · D-007("파생은 그대로") ↔ AT-04 의 전제(이벤트가 키를 계속 쌓는다) → 일치 · D-008("`reserved1` 불변") ↔ AT-02 양성 짝이 `reserved1` 을 쓰지 않고 `subagent` 를 쓴다 → 비충돌 · D-009("TaskXXX 확장·제거 없음") ↔ AT-06 → 일치 · D-003("원본 미커밋") ↔ AT-07(원본 파일 0건) → 일치. **반대를 요구하는 AC 0건.**

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `작업` 타일은 3섹션 중 2섹션이 `SectionPlaceholder` 다(`TaskTileContent.tsx:327,330`). 반쯤 만든 표면을 노출한 채 두는 것이 문제이고, 진입점을 닫는 것이 그 원인을 직접 겨냥한다 |
| 이미 기존 코드가 충족하는가 | 아니오 — 부분만 | 메뉴 숨김 선례는 있다(`ChatTitleBar.tsx:23` — `reserved1` 인라인 필터). 그러나 활성화 차단은 없고 SSOT 도 없다 |
| 더 작은 해법이 있는가 | 있으나 부족하다 | 메뉴 필터만 고치면 `OPEN_TASK`(`chatReducer.ts:934`)가 남는다. 그 경로는 `chatActions.openTask` 로 export 돼 있고 소비자 0(`rg` 결과 0건)이라 지금은 무해하지만, 잠금이 관례로만 남는다 |
| 제거라면 능력 자체가 없어도 되는가 | **제거가 아니다** | 사용자 문장이 "숨긴다 … cowork 구현전까지" 다. 능력은 남기고 진입점만 닫는다(D-004) |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | 0204 plan 의 D-004(배지가 유일한 통지 수단)를 `chatReducer.ts:496,635` 와 대조 — 두 종류(agent Task 완료 · background 정착)가 같은 배열을 쓴다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **부분 충돌 1건** | 0204 D-004("완료 통지는 타일 칩 미확인 배지") 의 수단이 정지 기간 동안 무효가 된다 → D-006 이 명시 승계하고 §16 이 기록한다 |

- 사용자에게 올릴 결정: 없음 (첨부 처리·숨김 범위 2건은 이번 턴에 질의해 닫았다).
- 코드 조사로 닫은 사실: `작업` 타일의 생산 진입점은 타일 메뉴 하나다 — `chatActions.openTask` 소비자 `rg` 0건.

## 5. 동작 / 사용자 흐름

```text
[사용자가 타일 버튼을 연다]
  → [메뉴: 계획 · 백그라운드 작업 2종]      (작업 없음)
  → [작업 타일을 열 방법이 없다]
  ↘ [프로그램적 활성화가 시도돼도 패널은 변하지 않는다]

[Task 가 완료된다]
  → [unseenSettledTaskKeys 에 키가 쌓인다]  (파생 유지 — D-007)
  → [타일 버튼에 배지 없음]                 (D-006)
  ↘ [background 정착은 대화록 통지 행으로 계속 보인다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 타일 메뉴 열기 | `MENU_HIDDEN_RIGHT_PANEL_TILES` 를 뺀 목록 렌더 | `계획`·`백그라운드 작업` 2개 항목 |
| `TOGGLE_RIGHT_PANEL_TILE('task')` | 정지 술어가 참 → 상태 무변경(참조 동일) | 아무 일도 일어나지 않는다 |
| `SET_RIGHT_PANEL_TILE_ACTIVE('task', true)` | 같음 | 같음 |
| `OPEN_TASK(key)` | `selectedTaskKey` 는 설정되나 타일은 붙지 않는다 | 패널 변화 없음 |
| agent Task 완료 (`TaskUpdate` 결과) | `unseenSettledTaskKeys` 에 추가 | 배지 없음. 대화록의 `TaskUpdate` 도구 행은 그대로 보인다 |
| background 서브에이전트 정착 | `subagent_notice` 파트 추가 + 키 추가 | 대화록 통지 행(`백그라운드 작업 완료 …`) — 클릭 시 `백그라운드 작업` 타일 |

### 파생 UX / 엣지케이스

- empty / error: 해당 없음 — 정지는 상태가 아니라 상수다. 실패 경로가 없다.
- concurrency / multi-session: `rightPanelTiles` 는 세션별 in-memory 이고 DB 영속이 없다(`rg rightPanelTiles main/ shared/` 0건). 세션 전환·재시작이 정지를 되돌릴 수 없다.
- keyboard / a11y: 메뉴 항목이 사라지므로 `role="menuitemcheckbox"` 항목 수가 3 → 2. 배지 `aria-label`(`chat.taskTile.badgeAria`)은 렌더되지 않는다 — 카탈로그 키는 남긴다(D-004: 코드·문구 유지).
- 되돌리기: `SUSPENDED_RIGHT_PANEL_TILES` 를 비우면 세 지점이 함께 복귀한다.

## 6. 범위 / 비범위

- **범위**: cowork 사례 연구 문서 작성 · `docs/INDEX.md` 라우팅 갱신 · `작업` 타일 정지(메뉴·활성화·배지) · 정지로 무효가 된 기존 테스트 단언 재작성.
- **비범위**: cowork 렌더링 모델의 코드 도입(강등 규칙·타임라인·산출물 축) — D-001 · TaskXXX 파생 확장/제거 — D-009 · `백그라운드 작업`·`계획` 타일 — D-005 · 첨부 원본 커밋 — D-003.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| cowork 렌더링 구현 | 아니오 — 조사가 선행 조건이다 | 후속 handoff |
| `출력`·`컨텍스트` 섹션 충전(0204 D-022) | 아니오 | 후속 handoff — 정지 해제와 같은 턴 |
| 원본 DOM 덤프 보관 | 아니오 — 사용자가 저장소 밖에 갖고 있다 | 문서에 출처만 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 타일 메뉴에 `작업` 이 없고 `계획`·`백그라운드 작업` 은 있다 | 순수 테스트 — `visibleRightPanelTileDefinitions` 의 id 배열이 `['plan','subagent']` 와 정확히 같다(음성 `task`·`reserved1` + 양성 2종) | 타일 버튼 → Popover → `VISIBLE_TILE_REGISTRY.map` |
| R-02 | AT-02 / AC2 | 정지된 타일은 토글로 열리지 않고, 정지되지 않은 타일은 열린다 | reducer 테스트 — `TOGGLE_RIGHT_PANEL_TILE('task')` 는 `rightPanelTiles` 참조를 그대로 돌려주고, 같은 액션의 `'subagent'` 는 열에 추가한다 | 메뉴 클릭 → `chatActions.toggleRightPanelTile` → reducer |
| R-03 | AT-03 / AC3 | 프로그램적 활성화 경로도 정지된 타일을 붙이지 않는다 | reducer 테스트 — `SET_RIGHT_PANEL_TILE_ACTIVE('task',true)` 와 `OPEN_TASK` 뒤 `flattenColumns` 에 `'task'` 가 없다. `OPEN_TASK` 의 `selectedTaskKey` 설정은 그대로다 | `chatActions.setRightPanelTileActive` · `chatActions.openTask` |
| R-04 | AT-04 / AC4 | 미확인 완료가 있어도 타일 버튼에 배지가 뜨지 않는다 | 순수 테스트 — `showsUnseenTaskBadge(2, [], ['task'])` = false · `showsUnseenTaskBadge(2, [], [])` = true · `showsUnseenTaskBadge(0, [], [])` = false · `showsUnseenTaskBadge(2, ['task'], [])` = false. 별도로 프로덕션 기본값 `SUSPENDED_RIGHT_PANEL_TILES` 가 `'task'` 를 포함함을 단언 | `ChatTitleBar` → `showTaskBadge` |
| R-05 | AT-05 / AC5 | background 정착은 대화록에서 계속 보인다 | reducer 테스트 — `subagent.task settled(background)` 수신 후 마지막 메시지에 `subagent_notice` 파트가 있다 | 이벤트 → `appendAssistantPart` → `SubagentNoticeRow` |
| R-06 | AT-06 / AC6 | TaskXXX 파생과 타일 내용 렌더는 그대로다 | 기존 스위트 전건 green — `taskBoard.test.ts` · `rightPanelTiles.render.test.ts` · `chatReducer.task.test.ts`(D-010 으로 재작성한 2건 제외) | `taskBoard.ts` → `TaskTileContent` |
| R-07 | AT-07 / AC7 | `docs/etc/study/cowork/` 에 README + 3개 문서가 있고 원본 DOM 덤프는 저장소에 없다 | `ls docs/etc/study/cowork` 가 4개 `.md` · `git ls-files docs -- '*.txt' '*.html'` 에 덤프 0건 | 저장소 파일 |
| R-08 | AT-08 / AC8 | 문서가 원본 없이도 결론을 지지하는 파생 증거를 갖는다 | 문서 본문에 4개 표가 있다 — ① 턴 이벤트 시퀀스(49행) ② 타임라인 노트 21건의 사고/텍스트 분류 ③ 행 라벨 23건 ④ Orca 대조표 | 사람이 문서를 읽는다 |
| R-09 | AT-09 / AC9 | `docs/INDEX.md` 가 cowork 사례 연구를 라우팅하고 링크가 해석된다 | `node app/scripts/check-doc-inventory.mjs --check` 의 link 검사 통과 + INDEX `etc/` 행에 `cowork` 문자열 존재 | 에이전트가 INDEX 로 문서를 찾는다 |

### AC 검증 주의사항

- 기존 테스트 재사용: `chatReducer.task.test.ts` 의 `'각 타일 열기는 자기 타일만 패널에 붙인다'`·`'OPEN_TASK … 타일도 함께 열린다'` 케이스가 실재함을 확인했다(`:157`, `:217`). AT-06 은 이 둘을 **제외한** 잔여 케이스를 뜻한다.
- AT-01 은 목록 상수 자체가 계약이라 직접 단언이다(구조적 proxy 아님). 다만 `ChatTitleBar` 가 그 상수를 실제로 쓰는지는 이 오라클이 보지 못한다 — §10 EP-02 `실패 의미` 참조.
- AT-04 의 `suspended` 인자는 **테스트 seam** 이다. 정지 중에는 프로덕션 기본값으로 항상 false 라 양성 방향을 만들 수 없다 — 인자를 열어 양·음 두 방향을 모두 단언하고, 기본값이 `'task'` 를 포함한다는 별도 단언으로 프로덕션 결선을 잠근다.
- 사람 실기 항목: 없음. 메뉴 렌더는 `Popover` 가 `open` 상태로 게이트돼 SSR 스냅샷에서 비어 나오므로 목록 상수와 reducer 행동으로 내렸다.
- 총량/0건 기준: AT-07 의 "덤프 0건" 은 `git ls-files` 추적 목록의 차집합이다 — 작업 트리 파일 수가 아니다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 상속할 V 가 없다 — 0204 의 V 노드는 `작업` 타일의 *내용* 계약이고 이번 변경은 그 위의 *진입점* 을 닫는다(§16).
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R (사용자가 관측하는 메뉴·배지가 바뀐다).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 메뉴 구성 | NEW | — |
| R-02 | R | §7 토글 차단 | NEW | — |
| R-03 | R | §7 프로그램 경로 차단 | NEW | — |
| R-04 | R | §7 배지 정지 | NEW | — |
| R-05 | R | §7 background 통지 잔존 | NEW | — |
| R-06 | R | §7 TaskXXX 현행 유지 | NEW | — |
| R-07 | R | §7 문서 존재/원본 부재 | NEW | — |
| R-08 | R | §7 파생 증거 | NEW | — |
| R-09 | R | §7 라우팅 | NEW | — |
| AT-01 ~ AT-09 | AT | §7 각 행 | NEW | — |
| SD-01 | SD | §5·§13 — 완료 통지 경로의 종단 상태(키는 쌓이고 화면은 조용하다) | NEW | — |
| ST-01 | ST | §7 AT-04·AT-05 | NEW | — |
| AR-01 | AR | §9·§10 — 타일 활성화 funnel 이 정지 술어를 통과한다 | NEW | — |
| IT-01 | IT | §7 AT-02·AT-03 | NEW | — |
| MD-01 | MD | §10·§11 — 정지 SSOT 와 파생(메뉴 목록·배지 정책) | NEW | — |
| UT-01 | UT | §7 AT-01·AT-04 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 타일 버튼 → Popover → `VISIBLE_TILE_REGISTRY.map` → MenuItem | `visibleRightPanelTileDefinitions` id 배열 동등 비교(양성 2 + 음성 2) | not selected — 목록 자체가 계약이라 직접 단언이다 | EP-02 (1) |
| VP-02 | R-02·R-03 ↔ AT-02·AT-03 | REQUIRED | 메뉴/스토어 액션 → `chatReducer` → `activateTile` → `rightPanelTiles` | reducer 반환 상태에 `'task'` 부재 + `'subagent'` 존재 | not selected — 상태 전이 결과를 직접 관측한다 | EP-01 (5) |
| VP-03 | R-04 ↔ AT-04 | REQUIRED | `ChatTitleBar` → `showsUnseenTaskBadge` → 배지 노드 | 순수 함수 4조합 + 프로덕션 기본값 포함 단언 | not selected — 함수 반환값이 직접 결과다 | EP-03 (2) |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | `tool.call.completed`/`subagent.task settled` → reducer → `unseenSettledTaskKeys` + `subagent_notice` 파트 | 이벤트 시퀀스 후 키가 쌓이고(파생 유지) 통지 파트가 존재한다 | not selected — 종단 상태를 직접 읽는다 | EP-01 (5) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | `addTileColumnMajor` 를 부르는 reducer 지점 5곳이 전부 `activateTile` 경유 | `rg "addTileColumnMajor\(" chatReducer.ts` = 0 + `activateTile` 호출 5 | **required** — 한 지점만 고치고 나머지를 남기면 AT-02·AT-03 은 통과한다. 결함 변이: `activateTile` 의 정지 분기 제거 → VP-02 red | EP-01 (5) |
| VP-06 | R-06 ↔ AT-06 | REGRESSION | 0204 경로 — `taskBoard.ts` → `TaskTileContent`/`SubAgentTileContent` | 기존 스위트 green(D-010 재작성 2건 제외) | not selected | EP-04 (2) |
| VP-07 | R-07·R-08·R-09 ↔ AT-07·AT-08·AT-09 | REQUIRED | 저장소 파일 → `docs/INDEX.md` → 사람/에이전트 | 파일 목록 + `git ls-files` 차집합 + link 검사 | not selected — 파일 존재/부재가 직접 결과다 | EP-05 (2) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree(`app/**`) | renderer 코드 3파일 + 테스트 3파일을 바꾼다 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 실패만 blocking |
| 순수 테스트 | reducer·lib·rightpanel 스위트가 계약 증거다 | `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat` (`pretest` 우회 — `app/AGENTS.md §ABI 가이드`) | 같음 |
| repository(문서) | `docs/` 에 문서 4개 추가 + `INDEX.md` 갱신 | `cd app && node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus(커밋) | 설계 커밋 + 구현 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 타일 정의는 4종이고 정의 순서가 메뉴 순서다 | `app/src/renderer/src/features/chat/lib/rightPanelTiles.ts:7` |
| 메뉴 숨김은 인라인 필터 1건뿐 — SSOT 없음 | `components/ChatTitleBar.tsx:23` (`tile.id !== 'reserved1'`) |
| 타일을 여는 유일한 사용자 경로는 메뉴다 | `chatActions.openTask` 소비자 `rg` **0**건 |
| 배지는 `작업` 타일에 도달해야만 꺼진다 | `unseenSettledTaskKeys` 를 비우는 지점은 **3**곳 — `chatReducer.ts:927`(`SELECT_TASK`) · `:933`(`OPEN_TASK`) · `:974`(`ACKNOWLEDGE_SETTLED_TASKS`). 셋째의 유일한 소비자가 `TaskTileContent.tsx:314`(타일이 렌더되면 비운다)라 셋 다 타일 도달을 전제한다 |
| 배지 배열은 두 종류를 섞는다 | agent Task = `chatReducer.ts:496` · background = `:635` |
| background 정착은 대화록에도 남는다 | `chatReducer.ts:638` → `SubagentNoticeRow.tsx` |
| `rightPanelTiles` 는 영속되지 않는다 | `rg rightPanelTiles app/src/main app/src/shared` **0**건 · `initialChatState.rightPanelTiles = []`(`chatReducer.ts:241`) |
| `docs/etc` 는 문서 게이트의 prose·link 검사에서 **제외**된다 | `app/scripts/check-doc-inventory.mjs:230`(PROSE_EXCLUDED) · `:347`(LINK_EXCLUDED) |
| `etc/study/<project>/` 가 외부 사례 연구의 기존 자리다 | `docs/etc/study/` = claude · goose · hermes-agent · opencode · orca(폐기) |
| 저장소는 공개다 | `curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/muzaby/orca-skin` → `200` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `addTileColumnMajor` 호출부(reducer) | `rg "addTileColumnMajor\(" chatReducer.ts` | 5 | EP-01 의 분모. 565(plan 자동)·896(TOGGLE)·900(SET_ACTIVE)·934(OPEN_TASK)·945(OPEN_SUBAGENT_TASK) |
| 메뉴 목록 구성 지점 | `rg "VISIBLE_TILE_REGISTRY" app/src` | 2 | 정의 1(`:23`) + 사용 1(`:207`) |
| 배지 렌더 지점 | `rg "showTaskBadge\|unseenSettledTasks" ChatTitleBar.tsx` | 2 | 버튼 배지(`:66,189`) + 메뉴 내 카운트(`:222`) |
| reducer 경유 `'task'` 테스트 단언 | `rg "'task'" chatReducer.plan.test.ts` | 9 | 전부 `subagent` 로 치환 대상(D-011) |
| 타일 부착 단언 | `rg "toContain\('task'\)" chatReducer.task.test.ts` | 2 | `:157`·`:217` — D-010 재작성 대상 |
| 기하 헬퍼 직접 호출 테스트 | `rg -c "'task'" rightPanelLayout.test.ts` | 15 | reducer 미경유 — **불변**(D-011 의 근거) |
| 덤프 원본의 식별자 | `grep -c` on 3 files | `rlaeo` 4 · `DESKTOP-4EJ0NDG` 1 | D-003 의 근거. 저장소에 넣지 않으므로 마스킹 불요 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 타일 4종 · `addTileColumnMajor` 호출부 5 · 배지 지점 2 · 메뉴 지점 2 — 이번 세션에서 `rg` 로 직접 셌다.
- 내역 합 = 총계: EP 지점 합 = 5(EP-01) + 1(EP-02) + 2(EP-03) + 2(EP-04) + 2(EP-05) = **12**.
- "유일한" 반례 검색: "타일을 여는 유일한 사용자 경로는 메뉴" → `openTask` 소비자 0건 · `setRightPanelTileActive` 소비자는 `ApprovalCard` 의 `'plan'` 2건뿐(`ApprovalCard.tsx:206,249`) — `'task'` 를 넘기는 소비자 0건.
- 문서 앵커 존재 확인: `docs/AGENTS.md §문서를 어디에 두는가`(존재) · `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`(존재, `:112`).
- 기존 테스트 케이스 존재 확인: `chatReducer.task.test.ts` 의 두 케이스명과 줄번호를 직접 읽어 확인했다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `AR-01`, `SD-01`
- 현재 책임 소유자: 가시성 정책이 `ChatTitleBar` 의 모듈 상수에 인라인으로 산다. 활성화는 `chatReducer` 가 무조건 수행한다.
- 현재 entry → flow → state → consumer: 타일 버튼 → Popover 목록(`reserved1` 만 제외) → `toggleRightPanelTile` → reducer → `addTileColumnMajor` → `rightPanelTiles` → `RightPanel` 렌더.
- 현재 오류/취소/정리 경로: 없음(순수 상태 전이).
- 문제의 직접 원인: `작업` 타일이 메뉴에 있고 reducer 가 그것을 거절할 근거를 갖지 않는다. 가시성 규칙이 상수 하나에만 있어 다른 경로(`OPEN_TASK`)를 덮지 못한다.

```text
[타일 메뉴] → [toggleRightPanelTile] → [chatReducer] → [addTileColumnMajor] → [rightPanelTiles] → [RightPanel]
[OPEN_TASK] ────────────────────────────────┘ (같은 헬퍼, 게이트 없음)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `AR-01`, `MD-01`, `SD-01`
- 변경 후 책임 소유자: `lib/rightPanelTiles.ts` 가 **가시성 정책의 SSOT** 를 갖는다 — 정지 목록·메뉴 목록·배지 정책. `chatReducer` 는 `activateTile` 한 곳에서 그 술어를 소비한다.
- 변경 후 entry → flow → state → consumer: 같은 경로에 게이트가 하나 생긴다. 메뉴는 SSOT 파생 목록을 렌더하고, 활성화는 `activateTile` 을 통과한다.
- 변경 후 오류/취소/정리 경로: 없음 — 거절은 상태 참조를 그대로 돌려주는 무변경이다(`addTileColumnMajor` 의 중복 처리와 동형).
- 유지하는 기존 메커니즘: `addTileColumnMajor` 기하 · `removeTile` · `unseenSettledTaskKeys` 파생 · `TaskTileContent` 전체. 제거하는 것: 없음.

```text
[타일 메뉴(SSOT 파생 목록)] → [toggleRightPanelTile] ┐
[SET_ACTIVE] ─────────────────────────────────────── ┼→ [activateTile] → (정지?) → [addTileColumnMajor] → [rightPanelTiles]
[OPEN_TASK / OPEN_SUBAGENT_TASK / plan 자동] ──────── ┘         └ 정지면 무변경
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 가시성이 `ChatTitleBar` 인라인 필터 | `lib/rightPanelTiles.ts` 가 SSOT | 두 소비자(메뉴·reducer)가 같은 규칙을 봐야 한다 | MD-01 / VP-01·VP-03 · `rightPanelTiles.ts` |
| data/control flow | reducer 5지점이 기하 헬퍼를 직접 호출 | 5지점이 `activateTile` 경유 | 한 지점만 막으면 나머지가 남는다 | AR-01 / VP-05 · `chatReducer.ts` |
| state/contract | `rightPanelTiles` 에 어떤 id 도 들어갈 수 있다 | 정지된 id 는 들어가지 않는다 | R-02·R-03 | AR-01 / VP-02 |
| error/lifecycle | 배지는 타일을 열어야 꺼진다 | 배지가 뜨지 않는다. 키 파생은 유지 | 해제 경로가 닫혀 고착한다 | SD-01 / VP-03·VP-04 |
| test seam/관측점 | 메뉴는 Popover 안이라 렌더 관측 불가 | 목록 상수 + 배지 순수 함수로 내린다 | 사람 실기를 만들지 않는다 | MD-01 / VP-01·VP-03 · `rightPanelTiles.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `lib/rightPanelTiles.ts` | 타일 정의 + **가시성 정책 SSOT** | id → boolean · 정의 배열 | `ChatTitleBar` · `chatReducer` · `tileRegistry` |
| `lib/rightPanelLayout.ts` | 열/행 기하만 | 열 구조 → 열 구조 | `chatReducer` · `RightPanel` |
| `reducer/chatReducer.ts` | 활성화 상태 전이 | 액션 → `ChatState` | 스토어 |
| `components/ChatTitleBar.tsx` | 메뉴·배지 렌더 | SSOT 파생 → DOM | — |
| `docs/etc/study/cowork/` | 조사 증거 | — | 사람/에이전트 |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 | AR-01 / VP-02·VP-05 | 정지된 타일은 `rightPanelTiles` 에 들어가지 않는다 | `SUSPENDED_RIGHT_PANEL_TILES` | `activateTile` | `addTileColumnMajor` 를 부르던 reducer **5지점** — `:565` plan 자동 · `:896` TOGGLE · `:900` SET_ACTIVE · `:934` OPEN_TASK · `:945` OPEN_SUBAGENT_TASK | 한 지점이라도 헬퍼를 직접 부르면 그 경로로 정지가 뚫린다. AT-02·AT-03 은 두 지점만 보므로 통과한 채 남는다 → VP-05 가 `rg` 로 분모를 센다 |
| EP-02 | MD-01 / VP-01 | 메뉴 목록 = 정의 − 메뉴 비노출 | `MENU_HIDDEN_RIGHT_PANEL_TILES` | `ChatTitleBar` | 메뉴 렌더 시점 **1지점**(`:23` 정의 → `:207` 사용) | `ChatTitleBar` 가 SSOT 대신 자기 필터를 다시 쓰면 이 오라클은 침묵한다. **측정한 완화**: 그래도 클릭은 `activateTile` 에 막힌다 — 이번 턴 VP-02 테스트가 `TOGGLE_RIGHT_PANEL_TILE('task')` 무변경을 직접 관측한다. 즉 남는 결함은 "죽은 메뉴 항목이 보인다" 까지다 |
| EP-03 | MD-01 / VP-03 | 배지는 정지된 타일을 가리키지 않는다 | `showsUnseenTaskBadge` | `ChatTitleBar` | 배지 판정 **2지점** — `:66` 버튼 배지 · `:222` 메뉴 내 카운트 | `:222` 는 메뉴 목록에서 `task` 가 빠지면 자동으로 도달 불가다(VP-01 이 그 목록을 잠근다). `:66` 만 고치고 SSOT 를 안 쓰면 복귀 시 두 곳이 갈라진다 |
| EP-04 | R-06 / VP-06 | TaskXXX 파생·타일 내용은 불변 | `taskBoard.ts` · `TaskTileContent` | 기존 스위트 | 테스트 실행 시점 **2지점** — `taskBoard.test.ts` · `rightPanelTiles.render.test.ts` | 정지를 구현하며 파생을 함께 손대면 D-009 위반이 조용히 통과한다 |
| EP-05 | R-07·R-09 / VP-07 | 문서가 존재하고 원본은 없다 | 저장소 | 사람 + 문서 게이트 | 커밋 시점 **2지점** — `docs/etc/study/cowork/` 파일 목록 · `docs/INDEX.md` `etc/` 행 | `docs/etc` 는 link 검사에서 제외되므로(`check-doc-inventory.mjs:347`) 문서 **내부** 링크는 게이트가 보지 않는다 — 구현자가 상대 링크를 직접 열어 확인해야 한다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: `SUSPENDED_RIGHT_PANEL_TILES` 하나가 원천이고 `MENU_HIDDEN_RIGHT_PANEL_TILES` 는 그것을 spread 로 포함한다 — 정지 해제 시 배열 하나를 비우면 세 소비자가 함께 복귀한다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적었다면 그 범위를 이 턴에 측정한 근거: VP-01 행 — `activateTile` 이 막는 범위는 "클릭해도 안 열린다" 이고 "메뉴에 항목이 보인다" 는 막지 못한다. 두 축을 나눠 적었다.
- 선택적 필드의 `true/false/undefined` 의미: `showsUnseenTaskBadge` 의 3번째 인자는 **기본값 있는 seam** 이다 — 생략 시 프로덕션 정지 목록. `undefined` 를 fail-open 으로 해석하지 않는다(기본값이 정지 목록이므로 미지정이 곧 정지 적용).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/lib/rightPanelTiles.ts` | 가시성 SSOT | `SUSPENDED_RIGHT_PANEL_TILES` · `MENU_HIDDEN_RIGHT_PANEL_TILES` · `isRightPanelTileSuspended` · `visibleRightPanelTileDefinitions` · `showsUnseenTaskBadge` 추가. 정지 사유와 해제 조건(0205 D-004)을 주석으로 남긴다 | 순수 |
| `app/src/renderer/src/features/chat/lib/rightPanelTiles.test.ts` | 신규 | AT-01 · AT-04 | 순수 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 활성화 게이트 | `activateTile(cols, id)` 내부 헬퍼 추가 후 `addTileColumnMajor` 직접 호출 **5지점**을 전부 교체 | 순수 |
| `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx` | 메뉴·배지 | `VISIBLE_TILE_REGISTRY` 를 SSOT 파생으로 교체(`!== 'reserved1'` 인라인 제거), `showTaskBadge` 를 `showsUnseenTaskBadge` 호출로 교체 | — (상수/함수로 내림) |
| `app/src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts` | 기존 | reducer 경유 `'task'` **9건**을 `'subagent'` 로 치환. 정지 타일 거부 케이스(AT-02·AT-03) 추가 | 순수 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.task.test.ts` | 기존 | 타일 부착 단언 **2건**(`:157`·`:217`)을 정지 사실 단언으로 재작성(D-010). 선택 독립성 단언은 그대로 | 순수 |
| `docs/etc/study/cowork/README.md` | 신규 | 대상·조사 방식·일자·문서 표·**원본 미보관 사유**(D-003) | — |
| `docs/etc/study/cowork/01-턴-렌더링-모델.md` | 신규 | 턴 골격 · 강등 경계 규칙과 반증된 대안 2건 · 노트 21건 분류표 · pill 라벨 계산 규칙 | — |
| `docs/etc/study/cowork/02-사이드패널과-출력.md` | 신규 | 3섹션(진행 상황·출력·컨텍스트) · 산출물 카드 · 미리보기 패널 · 3중 투영표 | — |
| `docs/etc/study/cowork/03-orca-대조.md` | 신규 | Orca 현재 구현 대조표 · 적용 후보 · 미결 항목(스트리밍 시점·행 기본 펼침) | — |
| `docs/INDEX.md` | 기존 | `etc/` 행에 cowork 사례 연구 포인터 추가 | 링크 검사 |

### 문서 내용 계약 (AT-08)

네 표가 문서에 있어야 한다. 원본을 올리지 않으므로(D-003) 이 표들이 결론의 유일한 증거다.

1. **턴 이벤트 시퀀스 49행** — `PILL`·`PROSE`·`row`·`text`·`ARTIFACT` 순서. 강등 경계 규칙의 근거.
2. **타임라인 노트 21건 분류** — 사고 14 / 텍스트 7. `· 7 노트` 라벨과 텍스트 7건이 일치한다는 관측을 포함한다.
3. **행 라벨 23건** — `Added task: …`·`Started task`·`Requesting access…`·`downloads_analysis.md 생성됨` 등. 라벨 원천이 도구 이름이 아니라 도구 메타 문장이라는 결론의 근거.
4. **Orca 대조표** — 축별 cowork/Orca/판정. `messageSegments`·`ToolGroup`·`ReasoningBlock`·`toolMeta` 의 실제 경로를 인용한다.

문서는 `docs/AGENTS.md §작성 규칙` 을 따른다 — 한국어, 표 위주. 코드에서 셀 수 있는 Orca 수치는 쓰지 않고 정본 경로를 링크한다.

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: 불필요 — 대상 3파일 모두 순수 렌더/상태 모듈이다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `addTileColumnMajor` 의 "이미 있으면 무변경(참조 동일)" 계약을 `activateTile` 이 그대로 물려받는다 — 정지도 같은 무변경이라 호출부가 분기를 늘리지 않는다.
- 순서를 관측할 훅/로그/주입 경계: 해당 없음(순서 계약 없음).

## 12. End-to-end 영향

### producer → consumer

```text
tool.call.completed / subagent.task settled
  → chatReducer (unseenSettledTaskKeys 파생 · subagent_notice 파트)
  → ChatTitleBar(배지 — 정지) · TranscriptView(통지 행 — 유지) · RightPanel(작업 타일 — 도달 불가)
```

- producer 기준: 이벤트 경로는 손대지 않는다(D-007).
- consumer 파생 규칙: 배지 소비자만 정지 술어를 본다. 통지 행 소비자는 그대로다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `activeTiles.includes('task')` 는 정지 후 항상 false 라 배지 조건으로 홀로 쓰면 오히려 항상 참이 된다 — 그래서 정지 술어를 함께 본다(§10 VP-03).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `tileRegistry` (4종 매핑) | 불변 — 정의는 그대로다(0204 D-021) | AT-06 |
| `deriveRightPanelLayout` | 불변 — 입력에 `'task'` 가 오지 않을 뿐 | AT-06 |
| `rightPanelLayout.test.ts` (`'task'` 15건) | 불변 — 기하 헬퍼를 직접 부른다(D-011) | AT-06 |
| `RightPanelTile` 라벨 조회 | 불변 | AT-06 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 정지는 모듈 상수라 수명주기가 없다.
- 취소/중단: 해당 없음.
- 종료/quit/crash: 해당 없음 — `rightPanelTiles` 는 영속되지 않는다(§8).
- retry/timeout/partial failure: 해당 없음.
- cleanup/rollback: 정지 해제 = `SUSPENDED_RIGHT_PANEL_TILES` 를 빈 배열로. 세 소비자가 함께 복귀한다.
- **다중 저장소 쓰기**: 코드 변경에는 해당 없음. **문서 산출에는 있다** — 이번 판정·상태가 `plan.md` 와 `docs/handoff/INDEX.md` 두 곳에 산다. 둘이 갈라지면 "지금 누구 차례인가" 가 두 답을 낸다. 지점 2곳을 §10 EP 밖의 운영 사본으로 인식하고, 설계 커밋에서 함께 갱신한다(`INDEX.md` 비고 5줄 이내).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 해당 없음.
- 새 요청 수: 해당 없음.
- 구조적 목표(줄/파일/모듈 수): 없음.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: `VISIBLE_TILE_REGISTRY` 는 지금도 모듈 로드 시 1회 계산이고 SSOT 파생으로 바꿔도 같다 — 상수 배열이라 재계산 비용이 없다.
- `unseenSettledTaskKeys` 상한: 세션당 정착 Task 수. 해제 소비자가 없어져도 배열이 세션 수명 안에서만 자라므로 상한이 유지된다(D-007 유지 근거).

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 구현할 port/schema/config 를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 타일 정의 4종 유지 | 0204 D-021 | §9 "정의는 그대로다" | **유지** |
| 두 타일 분리(`작업`·`백그라운드 작업`) | 0204 D-015 | §6 비범위 · D-005 | **유지** |
| `작업` 타일 = cowork 3섹션 | 0204 D-017 | §11 "타일 내용 코드 불변" | **유지** — 도달만 막는다 |
| `출력`·`컨텍스트` 는 빈 상태 | 0204 D-022 | §1 목표("반쯤 만든 표면") | **유지** — 충전은 후속 |
| 완료 통지 = 타일 칩 미확인 배지 | 0204 D-004 | D-006 · §5 상태표 | **변경(정지)** — 수단이 가리킬 타일이 없다. 제거가 아니라 정지 해제 시 함께 복귀 |
| `OPEN_TASK` 가 자기 타일만 붙인다 | 0204 AT-30 증거 | D-010 · §11 테스트 2건 | **변경(재작성)** — 선택 독립성 단언은 유지, 타일 부착 단언만 정지 사실로 |
| 예약 타일은 메뉴에서 숨긴다 | `ChatTitleBar.tsx:23` 주석 | §11 인라인 필터 제거 | **유지(이전)** — 규칙은 같고 자리가 SSOT 로 옮겨간다 |
| 셀 수 있는 수치를 문서에 쓰지 않는다 | root `AGENTS.md` 원칙 4 | §11 문서 내용 계약 | **유지** — cowork 관측 수치는 외부 프로젝트라 인벤토리 대상이 아니다 |
| `etc/` 는 evidence 지 현재 규칙이 아니다 | `docs/INDEX.md §Evidence` | D-002 | **유지** — 조사 문서를 규칙으로 승격하지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 정지가 관례로만 남아 나중에 조용히 풀린다 | reducer 게이트 + `rg` 분모(VP-05)로 지점을 센다 |
| `ChatTitleBar` 가 SSOT 를 우회해도 오라클이 침묵한다 | §10 VP-01 `실패 의미` 에 남는 결함 범위를 측정해 적었다 — "죽은 메뉴 항목이 보인다" 까지 |
| 원본을 안 올려 제3자가 결론을 재검증할 수 없다 | 파생 표 4종을 문서 안에 넣는다(AT-08). 원본은 사용자가 보관 |
| 배지 정지로 agent Task 완료 신호가 약해진다 | 대화록의 `TaskUpdate` 도구 행이 남는다. background 는 통지 행이 남는다(AT-05) |
| `docs/etc` 가 link 게이트 밖이라 문서 내부 링크가 썩는다 | §10 VP-07 에 명시 — 구현자가 상대 링크를 직접 확인한다 |

- 되돌리기 어려운 결정: 없음. 정지는 배열 하나이고 문서는 추가다.
- 신규 의존성: 없음 → 사용자 승인 불요.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/lib/rightPanelTiles.ts` (+ `.test.ts` 신규)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.task.test.ts`
- `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx`
- `docs/etc/study/cowork/{README,01-턴-렌더링-모델,02-사이드패널과-출력,03-orca-대조}.md`
- `docs/INDEX.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`
- ABI/네트워크 등 환경 제약: DB 를 실행하지 않는 순수 변경이므로 `npm test` 를 쓰지 않는다 — `pretest` 가 ABI 를 Node 로 뒤집는다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat`
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-003a → D-003 대체 관계 기록.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "숨긴다 … 구현 전까지" 를 정지로, 제거로 읽지 않았다(§4).
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성돼 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임 없음 — 이동 1건(`ChatTitleBar` 인라인 필터 → `rightPanelTiles.ts` SSOT), §16 에 기록.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 7행.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없어 Baseline V 를 만들었고 유효 V 를 재구성할 수 있다.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R/SD/AR/MD 4레벨.
- [x] 영향받은 INHERITED node 없음 — 0204 V 를 상속하지 않는다. VP-06 만 기존 스위트를 REGRESSION 으로 잡는다.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거가 필요한 pair(VP-05)만 선택 이유·변이를 갖는다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐고 관련 없는 기존 실패를 새 blocking 범위로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 메뉴 렌더를 목록 상수로 내렸다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — 메뉴 목록은 그 자체가 계약이고, 클릭 결과는 VP-02 가 행동으로 본다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 4행.
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 교차검증했고 `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: Part I·Part II 를 그대로 수행했다. 설계가 지정한 SSOT 이름·`activateTile` 통로·5지점 교체·테스트 재작성 범위가 코드와 맞았다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-02·VP-05 (EP-01) | 정지된 타일은 `rightPanelTiles` 에 안 들어간다 | `:565` plan 자동 · `:896` TOGGLE · `:900` SET_ACTIVE · `:934` OPEN_TASK · `:945` OPEN_SUBAGENT_TASK (5) | **5/5** | `rg "addTileColumnMajor\(" chatReducer.ts` → **1건**(`:1044` `activateTile` 정의 내부) · `rg "activateTile\(state" chatReducer.ts` → **5건**(565·896·900·934·945) | — |
| VP-01 (EP-02) | 메뉴 목록 = 정의 − 메뉴 비노출 | 메뉴 렌더 1지점 | **1/1** | `ChatTitleBar.tsx:29` 가 `MENU_HIDDEN_RIGHT_PANEL_TILES` 를 소비 · 테스트 `메뉴 목록은 계획·백그라운드 작업 둘이고 정의 순서를 지킨다` green | — |
| VP-03 (EP-03) | 배지는 정지된 타일을 가리키지 않는다 | `:66` 버튼 배지 · `:222` 메뉴 내 카운트 (2) | **2/2** | `:74` 가 `showsUnseenTaskBadge(unseenSettledTasks, activeTiles)` 로 교체 · `:232` 는 `VISIBLE_TILE_REGISTRY.map` 안이라 `task` 부재로 도달 불가(주석으로 명시) | — |
| VP-06 (EP-04) | TaskXXX 파생·타일 내용 불변 | `taskBoard.test.ts` · `rightPanelTiles.render.test.ts` (2) | **2/2** | 두 스위트 무수정 green — `git diff --numstat` 에 두 파일 없음(내용 변경 7파일 목록에 부재) | — |
| VP-07 (EP-05) | 문서 존재 + 원본 부재 | `docs/etc/study/cowork/` · `docs/INDEX.md` `etc/` 행 (2) | **2/2** | `ls docs/etc/study/cowork` → `README.md`·`01-턴-렌더링-모델.md`·`02-사이드패널과-출력.md`·`03-orca-대조.md` 4건 · `docs/INDEX.md:60` 에 `etc/study/cowork` 문자열 존재 | — |

- 합계 **12/12**.
- §10에 없는데 같은 불변식이 필요했던 지점: 없음.
- **문서 내부 링크 수동 확인**(§10 VP-07 — `docs/etc` 는 link 게이트 밖): 4파일의 상대 링크 **13건 전수 해석, 깨짐 0**.

**V-pair 자기확인** — `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `visibleRightPanelTileDefinitions` id = `['plan','subagent']` | not selected — 목록이 곧 계약 |
| VP-02 | REQUIRED | SELF_PASS | TOGGLE/SET_ACTIVE `'task'` → `colTiles` `[]` · 참조 동일. 양성 짝 `'subagent'` → `[['subagent']]` | not selected — 상태 전이 직접 관측 |
| VP-03 | REQUIRED | SELF_PASS | `showsUnseenTaskBadge` 5조합(양성 1 · 음성 4) | not selected — 반환값이 곧 결과 |
| VP-04 | REQUIRED | SELF_PASS | `background 완료 통지가 배지를 켜고…` 케이스가 `unseenSettledTaskKeys=['bg:a1']` 누적 + `subagent_notice` 파트 유지 | not selected — 종단 상태 직접 읽음 |
| VP-05 | REQUIRED | SELF_PASS | `addTileColumnMajor` 직접 호출 0(정의 내부 제외), `activateTile` 5 | **required** — 아래 잠금표 M1·M2 |
| VP-06 | REGRESSION | SELF_PASS | 45파일 437케이스 green, 두 회귀 스위트 무수정 | not selected |
| VP-07 | REQUIRED | SELF_PASS | 문서 4건 + INDEX 행 + 링크 13/13 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| `chatReducer.ts:1044` — `activateTile` 의 정지 분기 제거(`return addTileColumnMajor(cols, id)`) | `VP-05 선택 증거` | `TOGGLE 은 정지된 타일을 열지 않는다` 외 **5건** (2파일) | 잠김 |
| `chatReducer.ts:934` — 5형제 중 `OPEN_TASK` **한 지점만** 게이트 우회 | `VP-05 선택 증거`(부분 폐쇄 감도) | `각 타일 열기는 자기 타일만 패널에 붙인다` 외 **2건** | 잠김 — 부분 폐쇄를 본다 |
| `rightPanelTiles.ts` — `SUSPENDED_RIGHT_PANEL_TILES` 를 `[]` 로(정지 해제 시뮬레이션) | 이번 턴에 만든 SSOT 의 방향 확인 | **9건** (3파일) | 잠김 — 해제 시 되돌아갈 단언 9건의 목록이기도 하다 |

- 세 변이 모두 복원 후 45파일 437케이스 green 재확인.
- 그 밖의 hunk: 해당 없음 — 직접 oracle.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 신규 문구 **0** — 정지는 기존 표면을 빼는 변경이다. `chat.taskTile.badgeAria` 는 렌더되지 않지만 카탈로그에 남긴다(D-004) | 해제 시 함께 복귀 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 실패 경로를 만들지 않았다 — 거절은 무변경(참조 동일)이고 §5 표의 `TOGGLE…`·`SET_ACTIVE…`·`OPEN_TASK` 세 행이 그것이다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | **해당 없음 — 누를 것이 없다.** 메뉴 항목이 사라져 사용자가 정지된 타일을 요청할 UI 가 없다. 무변경 거절은 프로그램 경로에만 존재한다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 경로를 건드리지 않았다 | — |

**적어 두는 것(범위 밖, 고치지 않음)**: agent Task 완료의 in-app 신호가 배지 하나였고 그것이 꺼졌다. 대화록의 `TaskUpdate` 도구 행은 남지만 그것은 *통지*가 아니라 *이력*이다. background 정착은 `subagent_notice` 행이 있어 영향이 없다(AT-05). 정지 기간 동안 agent Task 완료는 사용자가 대화록을 읽어야만 안다 — 0204 D-004 의 의도보다 약하고, 해제 전까지 그 상태다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `npm run lint` 가 이 환경에서 **7분에도 끝나지 않는다**. 중단된 `--fix` 가 무관한 파일 **25건의 내용**(prettier union 줄바꿈)과 **521건의 줄바꿈**을 고쳤다 | ✅ 선조치 — 무관한 파일 전부 `git checkout` 복구 후 변경 파일만 `eslint --no-fix` 로 판정 | `app/AGENTS.md §ABI 가이드` 가 경고한 그 함정. 복구 후 `git diff --numstat` = 내 7파일뿐 |
| 2 | `typecheck:node`·`typecheck:test` 가 3 error — `cheerio`·`turndown`·`turndown-plugin-gfm` 모듈 미해결 | ⚠️ 보고만 — 환경 기인, 변경 무관 | 세 패키지는 `package.json:39,49,50` 에 있으나 `node_modules` 에 없다. **내 renderer 변경을 stash 한 트리에서 동일한 3건 재현** |
| 3 | `unseenSettledTaskKeys` 를 비우는 지점이 §8 이 적은 2곳이 아니라 **3곳**이었다(`ACKNOWLEDGE_SETTLED_TASKS`) | ✅ 설계 단계에서 선조치 — plan §8·D-006 을 실측값으로 정정한 뒤 READY | 셋째의 유일한 소비자가 `TaskTileContent.tsx:314` 라 결론(모두 타일 도달 전제)은 그대로 |

### 설계 대비 명시적 차이 (r1)

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **없음.** SSOT 이름·`activateTile` 위치·테스트 재작성 범위 전부 §11 그대로다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체물 없음(차이 0). 정지 목록은 모듈 상수라 수명이 없다 | — |
| 공유 | 해당 없음 — `SUSPENDED_RIGHT_PANEL_TILES` 는 읽기 전용 상수이고 비울 수 있는 주체가 없다 | — |
| 재진입 | 해당 없음 — `activateTile` 은 순수 함수다 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 코드 4 — `lib/rightPanelTiles.ts` · `reducer/chatReducer.ts` · `components/ChatTitleBar.tsx` · (신규) `lib/rightPanelTiles.test.ts` / 테스트 2 — `chatReducer.plan.test.ts` · `chatReducer.task.test.ts` / 문서 5 — `docs/etc/study/cowork/` 4건 + `docs/INDEX.md` |
| 실행 명령 | `./node_modules/.bin/vitest run src/renderer/src/features/chat` · `npm run typecheck:web` · `eslint --no-fix <변경 6파일>` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출**(exit code 아님) | vitest **45파일 437케이스 all passed** (기준선 423 + 신규 14 = 437, 검산 일치) · `typecheck:web` **출력 0줄** · eslint 변경 6파일 **0 error 0 warning** · doc gate **출력 0줄, exit 0**. **환경 기인 분리**: `typecheck:node`·`typecheck:test` 각 3 error = `Cannot find module 'cheerio'|'turndown'|'turndown-plugin-gfm'` — renderer 변경을 stash 한 트리에서 동일 재현, 변경 무관 |
| V-pair 자기확인 | `SELF_PASS 7 / SELF_BLOCKED 0`; pair별 상세는 위 표 |
| 강제 지점 전수 | **12/12** |
| **AC 자기보고**(`Criteria-Met`) | **9/9** — AT-01 `visibleRightPanelTileDefinitions`=`['plan','subagent']` ✅ / AT-02 TOGGLE `'task'` 무변경 + `'subagent'` 추가 ✅ / AT-03 SET_ACTIVE·OPEN_TASK 뒤 `'task'` 부재 + `selectedTaskKey` 유지 ✅ / AT-04 배지 5조합 ✅ / AT-05 `subagent_notice` 파트 유지 케이스 green ✅ / AT-06 `taskBoard.test.ts`·`rightPanelTiles.render.test.ts` 무수정 green ✅ / AT-07 문서 4건 + `git ls-files docs '*.txt' '*.html'` 차집합 **0줄** ✅ / AT-08 표 4종 존재 — 이벤트 시퀀스 **49행**(그중 `row` 23 · `text` 21) · 노트 분류 **사고 14 + 텍스트 7 = 21** · 라벨 표 **9행**(23개 행이 갖는 라벨 형태 수, 개별 23건은 시퀀스 표가 갖는다) · 대조표 **9축** ✅ / AT-09 `docs/INDEX.md:60` + doc gate link 검사 통과 ✅ |
| **합계 검산** | `✅ 9 · ⚠️ 0 · ❌ 0 = 총 9` — 분모 재계수: plan §7 의 R-01~R-09 = 9행, 이번 라운드 분모 변경 없음 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — r1 이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음(구현 실패 0). 다만 §8 조사가 `unseenSettledTaskKeys` 해제 지점을 2로 적었다가 설계 단계 실측에서 3으로 정정됐다 — READY 전에 잡혔다.
- 반복해서 부딪히는 환경 한계: ① `npm run lint` 전체 실행이 7분+ 미완(범위를 좁혀야 판정 가능) ② `cheerio`·`turndown`·`turndown-plugin-gfm` 미설치로 `typecheck:node`/`:test` 상시 3 error.
- 현재 라운드 수: **1**

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | … | … | … | … |

# Plan — 0213-task-tile-resume

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 정지의 근거는 [`0205`](../0205-cowork-study-and-task-tile-suspend/plan.md), 타일 내용의 근거는 [`0204`](../0204-taskxxx-right-panel/plan.md), 이번에 도달시킬 기능은 [`0212`](../0212-taskxxx-surface-gaps/plan.md) 가 갖는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0213-task-tile-resume` |
| 작성자 | Claude Code |
| 일자 | 2026-09-02 |
| 기준 브랜치 | `claude/handoff-213-diagnosis-c7zifr` (`46047ac` — 0212·0211 병합 후. 설계 시점 표기 `9ea09e4` 는 0211 병합 이전이라 기준선 분모가 달랐다 — 2026-09-02 정정) |
| 매핑 | 없음 (PR 미개설) |
| 상태 | DRAFT → **READY** |
| V mode | `Baseline V` |
| 기준 V | 없음 (`none`) — 근거는 §7-A |
| 유효 V | `0213:V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 — **도달**: 0212 가 구현한 7개 요구 중 **3개(R-01 기능 존재 게이트 · R-02 `activeForm` · R-03 `addBlocks` 역방향)는 사용자에게 도달할 표면이 0이다.** 유일한 소비처인 `작업` 타일이 0205 로 정지돼 있다(`useTaskBoard` 프로덕션 참조 1건, 그 파일이 정지 대상).
- 해결하려는 문제 — **표시**: 정지를 풀면 `출력`·`컨텍스트` 두 빈 섹션이 함께 나온다. 채울 재료(아티팩트 도구·cowork 렌더링 모델)가 아직 없다.
- 해결하려는 문제 — **관측 구멍 2건**: ① 할 일의 `blockedBy` 가 상세를 열어야만 보인다 — 목록에서 막힌 항목과 그냥 대기 중인 항목이 구분되지 않는다. ② 기능 부재 안내가 `items.length === 0` 조건이라 **서브에이전트가 돌고 있으면 침묵**한다(목록에는 두 종류가 함께 들어온다).
- 완료 후 달라지는 것: 사용자가 타일 메뉴에서 `작업` 을 열 수 있고, 그 카드가 할 일 목록 하나만 보이며, 막힌 항목이 목록에서 바로 읽히고, 할 일 목록 기능이 없는 CLI 는 서브에이전트 유무와 무관하게 원인을 말한다.
- 성공을 사용자 관점에서 한 문장으로: **`작업` 타일이 열리고, 열면 지금 무엇이 되고 무엇이 막혔는지가 한 화면에 있고, 아직 못 채운 자리는 아예 보이지 않는다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "다음 핸드오프로 **'작업 패널 보완'**을 진행하겠다. **212에서 구현한 기능을 지원하는것.**" | 사용자 턴 (2026-09-02) |
| 명시 요구 | "**출력, 컨텍스트는 아티팩트도구개발,cowork지원 전까지 숨김처리한다.**" | 같은 턴 |
| 명시 결정 | 섹션 껍데기 = **헤더 제거, 목록만** / 의존 = **행에 막힘 표시 추가** / 안내 = **할 일이 0건이면 안내** | 같은 턴 AskUserQuestion 응답 |
| 조사 산출 | 정지 소비 **3지점** · 정지를 단언하는 테스트 **3파일 12케이스** · 메뉴 목록 SSOT **두 벌**(프로덕션이 읽는 쪽 미잠금) | 이번 세션 실측 (§8) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `작업` 타일의 **정지를 해제한다** — `SUSPENDED_RIGHT_PANEL_TILES` 를 비운다 | 사용자가 "212에서 구현한 기능을 지원하는것" 을 이번 handoff 의 목표로 지정했다. 0212 R-01·R-02·R-03 의 유일한 소비처가 이 타일이다(§8) | 사용자 턴 | ACTIVE | **0205 D-004 를 대체** — 그 결정의 조건("cowork 구현전까지")을 사용자가 이번 턴에 바꿨다 |
| D-002 | `출력`·`컨텍스트` 두 섹션은 **아티팩트 도구 개발 · cowork 지원 전까지 숨긴다** | 사용자 원문 — "출력, 컨텍스트는 아티팩트도구개발,cowork지원 전까지 숨김처리한다" | 사용자 턴 | ACTIVE | **0204 D-022 를 대체** — D-022 는 "빈 상태만 만들고 충전은 다음 handoff" 였고 이번 결정이 충전 조건을 새로 건다 |
| D-003 | 섹션 껍데기(`TileSection`)를 `작업` 타일에서 **벗기고 할 일 목록을 카드에 직접 둔다** | 사용자가 세 선택지 중 "헤더 제거 — 목록만" 을 골랐다. 섹션이 하나뿐이면 접기 헤더가 의미를 잃고, 접었을 때 타일 전체가 빈 카드로 보인다 | 사용자 턴 (AskUserQuestion) | ACTIVE | **0204 D-017 을 숨김 기간 한정으로 보완**(대체 아님) — 두 섹션이 돌아올 때 껍데기를 다시 씌운다 |
| D-004 | `TaskTileSections.tsx` 와 두 섹션의 i18n 키 4개는 **지우지 않는다** | 사용자 문장이 *"숨김처리"* 다 — 제거가 아니다. 0205 D-004 가 정확히 같은 형태로 "코드·테스트·i18n 은 그대로 둔다" 를 썼고 그 덕에 이번 복귀가 배열 하나였다 | 설계자 판단 + 0205 선례 | ACTIVE | — |
| D-005 | 할 일 행에 **막힘 표시**를 낸다 — 문구 SSOT 는 기존 `chat.taskTile.blockedByValue` 다 | 사용자가 "행에 막힘 표시 추가" 를 골랐다. 0212 R-03 이 만든 역방향 간선이 상세에만 있어 목록에서 안 읽힌다. 새 키를 만들면 상세와 목록이 갈라진다 | 사용자 턴 + 실측(`ko.ts:597`) | ACTIVE | — |
| D-006 | 막힘 표시는 **`completed` 가 아닌 행**에만 낸다 | 끝난 항목의 의존은 이미 무의미한 정보다. 완료 행은 취소선이 상태를 말하고 그 옆에 `#2 완료 필요` 가 붙으면 거짓으로 읽힌다 | 설계자 판단 | ACTIVE | D-005 를 보완 |
| D-007 | 기능 부재 안내 조건을 `items 0건` → **`할 일(agent) 항목 0건`** 으로 바꾼다. 안내는 목록을 **대체하지 않고 그 위에** 선다 | 사용자가 "할 일이 0건이면 안내" 를 골랐다. `TaskCreate` 없는 CLI 라는 사실은 서브에이전트 유무와 무관하게 참이고, 서브에이전트 행을 감추면 정보 손실이다 | 사용자 턴 (AskUserQuestion) | ACTIVE | **0212 AC2·AC3 의 "빈 상태 전용" 조건을 정정한다** — 0212 D-003·D-005 의 판정 규칙 자체는 불변 |
| D-008 | 타일 메뉴 목록의 **SSOT 를 하나로 합친다** — `ChatTitleBar` 가 자기 필터를 갖지 않고 `visibleRightPanelTileDefinitions` 에서 파생한다 | 지금 필터가 두 벌이고(`rightPanelTiles.ts:58` · `ChatTitleBar.tsx:28`) **프로덕션이 읽는 쪽은 테스트가 없다**. 0205 AT-01 의 오라클이 프로덕션이 안 읽는 상수를 단언한다(§8 전수 조사) | 설계자 판단 + 실측 | ACTIVE | — |
| D-009 | **TaskXXX 파생(`taskBoard.ts`·`shared/task-tool.ts`)은 확장하지도 제거하지도 않는다** | 0205 D-009 를 그대로 승계한다. 이번 변경은 전부 *렌더가 이미 있는 값을 어떻게 보이는가* 다 — 막힘 표시는 `item.blockedBy` 를, 안내 조건은 `item.kind` 를 읽을 뿐이다 | 0205 D-009 승계 | ACTIVE | — |
| D-010 | 0205 가 **정지를 단언하도록 다시 쓴 테스트는 원래 방향으로 되돌린다** — 새로 쓰지 않는다 | 0205 D-010 이 "삭제하지 않는다 … 지우면 복귀 시 무엇이 바뀌었는지 알 수 없다" 로 남긴 자리다. `chatReducer.task.test.ts:157` 주석이 복귀 문장까지 적어 두었다 | 0205 D-010 의 의도 | ACTIVE | — |

### 설계 정정 (2026-09-02 · 구현 착수 진단)

구현 베이스에서 plan 을 코드와 대조해 **규범 행 3건 · 사실 행 다수**를 정정했다. 제품 의도·AC·ACTIVE Decision 은 바뀌지 않았다.

| # | 무엇 | 코드에서 본 것 | 고친 곳 |
|---|---|---|---|
| C-01 | **VP-03 의 선택된 적대 증거가 성립하지 않는다** | D-001 로 `SUSPENDED=[]` 가 되면 `tileRegistry.filter(!MENU_HIDDEN)` 과 `visibleRightPanelTileDefinitions` 가 **같은 4종**을 낸다 — 자기 필터를 되살려도 AT-01 이 green 이다 | §7-A VP-03 — SSOT 술어를 좁히는 변이로 교체 |
| C-02 | **3섹션을 단언하는 테스트가 전수 조사에 없다** | `rightPanelTiles.render.test.ts:138` 0204 AT-29 가 세 섹션 제목·본문 귀속·`aria-expanded` 3개를 단언한다 — AC8·AC9 의 정반대다 | §8 전수 조사 행 신설 · §11 · §18 |
| C-03 | **기준선 표의 분모가 이 베이스와 다르다** | 설계 표기는 0211 병합 이전(280파일/2800케이스/80 channels). 구현 베이스 실측은 **307파일/2983케이스/82 channels** 전건 green | §메타 기준 브랜치 · §7-A 기준선 표 |
| C-04 | 인용 좌표 4건이 크게 어긋난다 | `chatReducer.ts:1185`→**1507** · `chatStore.ts:1446`→**1550** · `ko.ts:597`→**606** · `taskBoard.ts:302-308`→**93-99**. 소소한 ±2줄 4건도 함께 | §8 · §10 · §17 |
| C-05 | `rightPanelTiles.test.ts` 원복 분모 | 방향 반전이 필요한 케이스는 **4**다 — `타일 정의 자체는 4종 그대로다` 는 이미 green | §11 |

### 갱신 메모

- **이번 턴 신규: D-001 ~ D-010.** `SUPERSEDED` 는 **다른 handoff 의 2건** — 0205 D-004(정지)와 0204 D-022(두 섹션 빈 상태)다. 둘 다 사용자가 조건을 바꾼 것이고 실패로 인한 정정이 아니다.
- **0205 D-006(배지 정지)은 자기 조건으로 종료된다** — 그 행이 "제거가 아니라 함께 복귀" 라고 적었고, 배지 술어가 같은 배열을 읽으므로 D-001 로 자동 복귀한다. 별도 결정을 만들지 않는다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 **그대로 유지**되는 결정: 0204 **D-015**(두 타일 분리) · **D-018**(id 오름차순 단일 목록) · **D-019**(할 일 + background 를 함께 나열, background 행에만 중단 버튼) · **D-031**(순서는 의존이 아니다) · **D-004**(미확인 완료 배지) · 0212 **D-006/D-007**(`activeForm` 교체와 `subject` 고정 라벨) · **D-021/D-022**(전환 버튼 조건 · `paused` 중단 유지).
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** 확인한 쌍 — D-001↔AT-01·02·03·04·05·07 · D-002·D-003↔AT-08·09 · D-004↔AT-08(문구 부재는 렌더 부재지 키 삭제가 아니다 — 카탈로그 키 존재를 AT-08 이 요구하지 않는다) · D-005↔AT-11 · D-006↔AT-13 · D-007↔AT-15·16·17·18 · D-008↔AT-01 · D-009↔AT-10(목록 내용 불변) · D-010↔AT-02·03·04·05 · **0204 D-018·D-019↔AT-10 비충돌**(한 목록·두 종류가 그대로다) · **0204 D-015↔AT-01 비충돌**(타일은 여전히 넷) · **0212 D-022↔AT-21 비충돌**(`paused` 중단 버튼은 회귀로 잠근다). **반대를 요구하는 AC 0건.**

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 0212 R-01·R-02·R-03 의 소비처가 `TaskTileContent` 하나이고(`rg useTaskBoard` → **프로덕션 1건**) 그 파일이 정지 대상이다. 코드를 더 만들 것이 없고 진입점만 연다 |
| 이미 기존 코드가 충족하는가 — 진행 상황 | **충족** | 목록·상태 아이콘·`activeForm` 교체·전환/중단 버튼·상세가 전부 구현·검증돼 있다(0212 r3 PASS) |
| 이미 기존 코드가 충족하는가 — 막힘 표시 | **미충족** | `taskDetailRows` 만 `blockedBy` 를 낸다(`taskBoard.ts:336-341`). `TaskRow` 둘째 줄은 `item.background &&` 조건이라 할 일 행에는 둘째 줄 자체가 없다 |
| 이미 기존 코드가 충족하는가 — 안내 조건 | **미충족** | `TaskProgressList` 가 `items.length === 0` 로 판정한다. `items` 는 할 일 + background 합집합이다(`taskBoard.ts:308`) |
| 더 작은 해법이 있는가 — 정지 해제 | 있다 — 채택 | 배열 하나(`SUSPENDED_RIGHT_PANEL_TILES`)를 비우면 3소비처가 함께 복귀한다. 0205 가 그렇게 설계했다 |
| 더 작은 해법이 있는가 — 두 섹션 | 있다 — 채택 | 렌더에서 두 `TileSection` 블록을 빼는 것이 전부다. 파일·키는 남는다(D-004) |
| **제거인가 이동인가** | **제거가 아니다** | 사용자 문장이 "숨김처리" 다. 0205 와 같은 형태 — 능력은 남기고 화면에서만 뺀다 |
| 선행 자료의 주장을 코드와 대조했는가 | 했다 — **1건 정정** | 0205 AT-01 의 오라클(`visibleRightPanelTileDefinitions`)은 **프로덕션 참조가 0**이다. 실제 메뉴는 `ChatTitleBar.tsx:28` 의 별도 필터가 만든다 → D-008 |
| ACTIVE 결정·기존 규칙과 충돌하는가 | 충돌 0 | 0204 D-015·D-018·D-019·D-031 은 목록 구조 결정이고 이번 변경이 건드리지 않는다. 0205 D-009(파생 불변)는 D-009 로 승계한다 |

- 사용자에게 올릴 결정: **없음** — 세 건(섹션 껍데기·행 의존 표시·안내 조건)을 이번 턴에 물어 D-003·D-005·D-007 로 확정했다.
- 코드 조사로 닫은 사실: 정지 소비 3지점 · 정지 단언 테스트 12케이스 · 메뉴 SSOT 두 벌 · `blockedByValue` 키 실재 · `TaskProgressList` 가 props-only View 라 기존 렌더 하네스를 그대로 쓴다는 것 (전부 §8).
- **요구보다 좁아진 지점**: 0212 가 만든 것 중 **`백그라운드 작업` 타일에 이미 도달하는 R-04·R-05·R-06·R-07 은 이번 범위가 아니다** — 이번에 여는 것은 `작업` 타일 경로다. 회귀로만 잠근다(R-90·R-91·R-92).

## 5. 동작 / 사용자 흐름

```text
[사용자가 타일 버튼을 연다]
  → [메뉴: 계획 · 백그라운드 작업 · 작업 · 변경사항 4종]   (정의 순서)
  → [`작업` 선택]
     → [카드에 할 일 목록이 바로 뜬다 — 섹션 헤더 없음]
        ↘ 할 일 행: 아이콘 · 제목(`in_progress` 면 현재진행형) · (막혔으면) `#2 완료 필요`
        ↘ 서브에이전트 행: 아이콘 · 제목 · 전환/중단 버튼 · 경과·토큰·사유
     ↘ [할 일이 0건이고 CLI 에 TaskCreate 가 없다] → 목록 위에 원인 + CLI 버전
        ↘ 서브에이전트가 돌고 있으면 그 행들은 안내 **아래에 그대로** 나열된다

[Task 가 완료된다]
  → [unseenSettledTaskKeys 에 키가 쌓인다]
  → [타일이 닫혀 있으면 타일 버튼에 배지]
  → [타일을 열면 배지가 꺼진다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 타일 메뉴 열기 | 정지 목록이 비어 필터가 아무것도 빼지 않는다 | `계획`·`백그라운드 작업`·`작업`·`변경사항` 4개 항목 |
| `TOGGLE_RIGHT_PANEL_TILE('task')` | 활성화 게이트가 통과 → `addTileColumnMajor` | `작업` 타일이 열 구조에 붙는다 |
| `SET_RIGHT_PANEL_TILE_ACTIVE('task', true)` | 같음 | 같음 |
| `OPEN_TASK(key)` | 선택 + 타일 활성화 | 상세 화면이 뜬 `작업` 타일 (0204 AT-30 원문) |
| 미확인 완료 있음 + 타일 닫힘 | `showsUnseenTaskBadge` → `true` | 타일 버튼에 배지 |
| 타일 열림 | `TaskTileContent` 의 `acknowledgeSettledTasks` | 배지가 꺼진다 |
| 할 일 0 · background 0 · `TaskCreate` 없음 | 안내 분기 | 원인 + CLI 버전만 |
| 할 일 0 · background > 0 · `TaskCreate` 없음 | 안내 + 목록 | 원인 + CLI 버전 **위에**, 서브에이전트 행이 아래에 |
| 할 일 0 · background 0 · `TaskCreate` 있음/판정불가 | 빈 문구 | `Claude 가 Task 를 만들거나 …` |
| 할 일 > 0 | 목록만 | 안내·빈 문구 둘 다 없음 |
| 할 일 행에 `blockedBy` 있음 · `completed` 아님 | 둘째 줄 파생 | `#2 완료 필요` |
| 같은 행이 `completed` 로 바뀜 | 둘째 줄 소거 | 취소선 제목만 (D-006) |

### 파생 UX / 엣지케이스

- empty / error: 빈 상태 세 갈래는 0212 가 정한 그대로이고 **조건의 분모만** 바뀐다(D-007). 새 실패 경로 0.
- concurrency / multi-session: `rightPanelTiles` 는 세션별 in-memory 이고 DB 영속이 없다(`rg rightPanelTiles main/ shared/` **0건**) — 이번 변경이 그 성질을 바꾸지 않는다. 앱 재시작 시 타일 구성이 사라지는 것은 **기존 동작이고 이번 비범위**다(§6).
- keyboard / a11y: 메뉴 `role="menuitemcheckbox"` 항목 수가 3 → **4**. 배지 `aria-label`(`chat.taskTile.badgeAria`)이 다시 렌더된다. 막힘 줄은 행 안의 보조 텍스트라 `aria-label`(= `subject`)을 바꾸지 않는다 — 0212 D-007 유지.
- 되돌리기: `SUSPENDED_RIGHT_PANEL_TILES` 에 `'task'` 를 다시 넣으면 3소비처가 함께 정지한다. 두 섹션 복귀는 `TaskTileContent` 반환에 `TileSection` 블록을 되살리는 것이고 파일·키가 남아 있다(D-004).

## 6. 범위 / 비범위

- **범위**: `작업` 타일 정지 해제(메뉴·활성화·배지 3소비처) · 두 섹션 렌더 제거와 껍데기 벗기기 · 할 일 행 막힘 표시 · 기능 부재 안내 조건 정정 · 메뉴 목록 SSOT 단일화 · 0205 가 뒤집은 테스트 12케이스 원복.
- **비범위**: `출력`·`컨텍스트` 충전(D-002) · `TaskTileSections.tsx`·i18n 키 삭제(D-004) · TaskXXX 파생 확장(D-009) · **`변경사항` 타일 실데이터 IPC** · **패널 구성 영속** · **in-app 토스트 통지** · 서브에이전트 `output_file` · `백그라운드 작업` 타일 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 두 섹션 충전 | 아니오 — 재료(아티팩트 도구·cowork)가 선행 조건이다 | D-002 — 조건 충족 후 후속 handoff |
| `변경사항` 타일 실데이터 3채널 | 아니오 — 계약 신설이라 독립 | 후속 handoff (0206 §6 이 이미 미룸) |
| 패널 구성 영속 | 아니오 — 설정 키 하나 추가라 언제 해도 같다 | 후속 |
| in-app 토스트 | 아니오 — 새 UI 표면 | 후속 (0204 D-004) |
| 메뉴 `.map()` 렌더 홉 잠금 | **아니오지만 지금은 불가** | DOM 환경(`jsdom`)이 의존성에 없다 — 0212 P9 와 같은 한계. §10 EP-02 에 미잠금으로 명시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 타일 메뉴에 `작업` 이 정의 순서대로 뜬다 | **관측 지점은 `ChatTitleBar` 가 실제로 map 하는 상수다** — 그 상수의 id 목록이 `['plan','subagent','task','diff']` 임을 단언한다. `visibleRightPanelTileDefinitions` 만 보는 단언은 이 AC 를 닫지 않는다(현재 프로덕션 참조 0) | 메뉴 열기 → `VISIBLE_TILE_REGISTRY` → `MenuItem` |
| R-01 | AT-02 / AC2 | `TOGGLE_RIGHT_PANEL_TILE('task')` 가 타일을 연다 | reducer 단위 — 액션 후 열 구조에 `'task'` 가 있다 (0205 가 뒤집은 단언의 원복) | `chatReducer` `activateTile` |
| R-01 | AT-03 / AC3 | `SET_RIGHT_PANEL_TILE_ACTIVE('task', true)` 도 연다 | reducer 단위 — 같은 축의 두 번째 진입점 | 같은 경로 |
| R-01 | AT-04 / AC4 | `OPEN_TASK(key)` 가 선택과 함께 타일을 붙인다 | reducer 단위 — `selectedTaskKey` 설정 **그리고** `toContain('task')` (0204 AT-30 원문 복귀) | `chatReducer` `OPEN_TASK` |
| R-01 | AT-05 / AC5 | 미확인 완료가 있고 타일이 닫혀 있으면 배지가 뜬다 | 두 층 — 술어 단위(`showsUnseenTaskBadge(2, [])` → `true`)와 **`ChatTitleBar` 렌더에 배지 노드가 있다**. 술어만 보는 단언은 이 AC 를 닫지 않는다 | store → `ChatTitleBar:74` → 배지 span |
| R-01 | AT-06 / AC6 | 타일을 보고 있으면 배지가 뜨지 않는다 | 같은 두 층의 음성 짝 — `showsUnseenTaskBadge(2, ['task'])` → `false`, 렌더에 배지 노드 부재 | 같은 경로 |
| R-01 | AT-07 / AC7 | 정지 목록이 비어 어떤 타일도 활성화를 막지 않는다 | 술어 단위 — `SUSPENDED_RIGHT_PANEL_TILES` 가 `[]` 이고 4종 전부 `isRightPanelTileSuspended` = `false` | `rightPanelTiles.ts` SSOT |
| R-02 | AT-08 / AC8 | `작업` 타일 카드에 `출력`·`컨텍스트` 문구와 일러스트가 없다 | 렌더 테스트 — 타일 본문에 두 섹션 제목·설명 4문구가 **전부 부재**. 양성 짝은 AT-10 | `TaskTileContent` 목록 반환 |
| R-02 | AT-09 / AC9 | `진행 상황` 섹션 헤더도 없다 — 목록이 카드에 직접 붙는다 | 렌더 테스트 — `진행 상황` 문구와 `aria-expanded` 속성이 부재. 양성 짝은 AT-10 | 같은 경로 |
| R-02 | AT-10 / AC10 | 목록 내용은 그대로다 | 렌더 테스트 — 할 일 제목과 background 제목이 **id 순으로 함께** 보인다(0204 D-018·D-019 회귀) | 같은 경로 |
| R-03 | AT-11 / AC11 | `blockedBy` 가 있는 할 일 행이 막힘 문구를 보인다 | 렌더 테스트 — 행 산출에 `#2 완료 필요` 가 있다. **문구는 `chat.taskTile.blockedByValue` 로 조립한다** — 상세와 같은 키다 | fold `item.blockedBy` → `TaskRow` 둘째 줄 |
| R-03 | AT-12 / AC12 | `blockedBy` 가 없으면 그 줄이 없다 | 렌더 테스트 — AT-11 의 음성 짝. 같은 목록의 다른 행에 문구 부재 | 같은 경로 |
| R-03 | AT-13 / AC13 | `completed` 행은 막힘 표시를 내지 않는다 | 렌더 테스트 — 같은 `blockedBy` 를 가진 항목을 `completed` 로 두면 문구가 사라진다(D-006) | 같은 경로 |
| R-03 | AT-14 / AC14 | background 행은 기존 메타 줄을 그대로 보인다 | 렌더 테스트 — 같은 목록에서 background 행이 `background · 경과 · 토큰` 을 낸다. **두 분기가 같은 자리를 쓰므로 맞바꿈에 red 여야 한다** | 같은 둘째 줄 슬롯 |
| R-04 | AT-15 / AC15 | 할 일 0 · background > 0 · `TaskCreate` 없음 → 안내가 뜨고 **background 행도 함께** 보인다 | 렌더 테스트 — 안내 문구 + CLI 버전 + background 제목이 **동시에** 있다. 안내만 보는 단언은 이 AC 를 닫지 않는다 | `TaskProgressList` 안내 분기 + 목록 |
| R-04 | AT-16 / AC16 | 할 일 > 0 이면 `TaskCreate` 가 없어도 안내가 없다 | 렌더 테스트 — 0212 의 기존 케이스가 그대로 green (분모가 좁아져도 이 방향은 불변) | 같은 경로 |
| R-04 | AT-17 / AC17 | 판정 불가(`null`)면 안내하지 않는다 | 렌더 테스트 — 0212 AC3 회귀. 거짓 안내 금지(0212 D-005) | 같은 경로 |
| R-04 | AT-18 / AC18 | 전부 비고 `TaskCreate` 있으면 기존 빈 문구다 | 렌더 테스트 — 0212 AC1 회귀. 안내와 빈 문구가 서로의 음성 짝이다 | 같은 경로 |
| R-90 | AT-19 / AC19 | `activeForm` 제목 교체와 `subject` 고정 라벨이 그대로다 (회귀) | 기존 `taskSurface0212.render.test.ts` AT-05·06·08 케이스가 green — 껍데기를 벗겨도 행 렌더는 불변 | `taskBoard` fold → `TaskRow` |
| R-91 | AT-20 / AC20 | 전환 버튼이 두 타일 모두에서 그대로다 (회귀) | 기존 0212 AT-23·24 케이스가 green | `canBackgroundTask` → 두 타일 |
| R-92 | AT-21 / AC21 | `paused` 행의 중단 버튼과 background 행에만 붙는 제어가 그대로다 (회귀) | 기존 0212 AT-18·19 케이스가 green (0204 D-019 · 0212 D-022) | `canStopTask` → 두 타일 |

### AC 검증 주의사항

- **관측 지점 규칙.** AT-01·AT-05·AT-15 의 `검증 수단` 칸은 **어디에 서서 관측하는지**를 함께 적는다. 0212 가 네 라운드를 쓴 축이 "oracle 이 경로의 한 홉 앞에 선다" 였고, 이번 handoff 의 세 지점이 정확히 그 형태다 — 메뉴 상수는 프로덕션이 안 읽는 쪽이 잠겨 있었고(§8), 배지는 술어만 잠겨 있고, 안내는 조건만 잠겨 있다.
- 기존 테스트 재사용: AT-19·20·21 의 회귀 대상은 **케이스명까지 확인했다** — `taskSurface0212.render.test.ts` 의 `AT-05·AT-08`·`AT-06`·`AT-23`·`AT-24`·`AT-18`·`AT-19` 가 실존한다(§8). 파일명은 계약이 아니다.
- 사람 실기 항목: **없음.** 메뉴 항목 유무·배지 노드·행 문구는 전부 순수 렌더 또는 reducer 로 관측된다. 다만 **메뉴 `.map()` 의 최종 렌더 홉은 이 라운드에 잠글 수 없다** — `Popover` 가 닫힌 상태에서 `null` 을 반환해 정적 렌더에 안 나오고, 여는 데 DOM 환경이 필요하다(§10 EP-02).
- N회/총량 기준: **없음.** 이번 AC 에 호출 횟수·총량 식이 없다.
- 총량/0건 기준: **AT-07·AT-08·AT-09·AT-12·AT-13·AT-17 이 부재를 단언한다.** 각각 같은 pair 안에 양성 짝이 있다 — AT-07↔AT-02·03(열린다) · AT-08·09↔AT-10(목록은 보인다) · AT-12·13↔AT-11(다른 행은 보인다) · AT-17↔AT-15(다른 조건에서는 뜬다). 짝 없는 부재 단언 **0건**.
- 순서 기준: AT-01 이 순서를 단언한다(정의 순서 4종). 관측 지점은 프로덕션 상수의 배열 순서다.
- **AC 분모 21.** R 별 분포는 R-01(7) · R-02(3) · R-03(4) · R-04(4) · R-90(1) · R-91(1) · R-92(1) 이고 합 = **21** (검산 일치). SKILL §5 의 25건 상한 이내라 분할 검토는 수행하지 않는다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 0205 의 V 를 상속하지 않는다 — 0205 V 는 `작업` 타일 **정지** 3축을 잠갔고 이번 작업은 그 3축을 **전부** 뒤집는다. 일부 변경이 아니므로 Delta V 가 성립하지 않는다.
- 기준 V 상속 근거: 없음 (`none`).
- 변경이 시작되는 수준: **R** — 사용자가 타일에 도달하고 화면 구성이 바뀐다. 아래로 SD·AR·MD 를 포함한다.
- 0204·0212 가 잠근 표시 계약 중 이번 변경 경로가 닿는 것은 `INHERITED` 노드로 등록해 `REGRESSION` pair 로 닫는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5·§7 — `작업` 타일 도달(메뉴·활성화·배지) | NEW | — |
| R-02 | R | §5·§7 — 카드 구성(목록만, 껍데기 없음) | NEW | — |
| R-03 | R | §5·§7 — 할 일 행 막힘 표시 | NEW | — |
| R-04 | R | §5·§7 — 기능 부재 안내 조건 | CHANGED | 0212 AC2·AC3 의 "빈 상태 전용" 조건을 정정 |
| R-90 | R | 0212 §7 — `activeForm` 제목 교체 · `subject` 고정 라벨 | INHERITED | `0212:ΔV1 @229a0e67 (r3 PASS)` · `taskSurface0212.render.test.ts` AT-05·06·08 |
| R-91 | R | 0212 §7 — 전환 버튼이 두 타일에 같은 술어로 | INHERITED | `0212:ΔV1 @229a0e67 (r3 PASS)` · 같은 파일 AT-23·24 |
| R-92 | R | 0204 D-019 · 0212 D-022 — background 행에만 제어, `paused` 도 중단 가능 | INHERITED | `0212:ΔV1 @229a0e67 (r3 PASS)` · 같은 파일 AT-18·19 |
| SD-01 | SD | §5 — 정지 해제 후 타일 수명(열기 → 배지 소거 → 닫기) | NEW | — |
| AR-01 | AR | §10 EP-02 — 메뉴 목록 SSOT 단일화(`ChatTitleBar` 가 파생 소비) | NEW | — |
| AR-02 | AR | §10 EP-01 — 정지 SSOT 와 3소비처 | CHANGED | 0205 의 같은 3지점을 반대 방향으로 |
| MD-01 | MD | §10 EP-04 — 막힘 표시 파생(존재 · `completed` 제외 · 형제 슬롯) | NEW | — |
| MD-02 | MD | §10 EP-05 — 안내 조건 술어(할 일 0건) | CHANGED | 0212 의 `items.length === 0` 을 대체 |
| MD-90 | MD | 0204 D-018·D-019 — id 오름차순 단일 목록, 두 종류 함께 | INHERITED | `0204:ΔV2 @7b45fa3 (r5 PASS)` · `taskBoard.test.ts` AT-10a |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | AR-02 ↔ AT-07 | REQUIRED | `SUSPENDED_RIGHT_PANEL_TILES` → 3소비처 | 배열 값과 술어 반환 | not selected — 값을 직접 읽는다 | EP-01 (3) |
| VP-02 | R-01 ↔ AT-02·03·04 | REQUIRED | 액션 → `activateTile` → 열 구조 | 액션 후 열 구조의 `'task'` 포함 | **required** — 정지 배열을 `['task']` 로 되돌리는 변이를 심어 **세 액션이 모두 red** 인지 본다(0205 §10 EP-01 이 진입점 5곳을 셌다 — 한 곳만 red 면 통로가 하나가 아니다) | EP-01 (3) |
| VP-03 | AR-01 ↔ AT-01 | REQUIRED | 메뉴 열기 → `VISIBLE_TILE_REGISTRY` → `MenuItem` | **`ChatTitleBar` 가 map 하는 상수의 id 목록** — `visibleRightPanelTileDefinitions` 만 보는 단언은 이 pair 를 닫지 않는다 | **required** — **SSOT 쪽** `visibleRightPanelTileDefinitions` 의 술어를 좁히는 변이(`tile.id !== 'task'`)를 심어 소비자가 따라가는지(AT-01 red) 본다. 자기 필터를 되살리는 변이는 `SUSPENDED=[]` 에서 두 파생의 산출이 같아 red 가 되지 않는다 — 2026-09-02 설계 정정 | EP-02 (2) |
| VP-04 | SD-01 ↔ AT-05·06 | REQUIRED | store → `ChatTitleBar:74` → 배지 span | 술어 반환 **그리고** 렌더 산출의 배지 노드 유무 | **required** — `showTaskBadge` 를 `false` 로 고정하는 변이를 심어 렌더 단언이 red 인지 본다(술어 단언만으로는 배선이 잠기지 않는다) | EP-03 (2) |
| VP-05 | R-02 ↔ AT-08·09·10 | REQUIRED | `TaskTileContent` 목록 반환 → 카드 | 두 섹션 문구·헤더 부재 + 목록 존재 | not selected — 부재 3건 전부 AT-10 을 양성 짝으로 갖는다 | EP-06 (1) |
| VP-06 | MD-01 ↔ AT-11·12·13 | REQUIRED | fold `item.blockedBy` → `TaskRow` 둘째 줄 | 행 산출의 막힘 문구 | not selected — 문구를 직접 읽고 AT-12·13 이 AT-11 의 음성 짝이다 | EP-04 (2) |
| VP-07 | MD-01 ↔ AT-14 | REQUIRED | 같은 둘째 줄 슬롯의 background 분기 | background 메타 문구 | **required** — 막힘 줄과 background 메타 줄이 **같은 자리를 쓰는 형제 슬롯**이라 두 분기의 산출을 맞바꾸는 변이를 심는다(존재만 보는 단언은 두 문구가 모두 남아 침묵한다) | EP-04 (2) |
| VP-08 | MD-02 ↔ AT-15·16·17·18 | REQUIRED | `TaskProgressList` 안내 분기 → 카드 | 안내 문구·CLI 버전·background 제목의 **동시** 존재 | **required** — 술어를 `items.length === 0` 으로 되돌리는 변이를 심어 AT-15 가 red 인지 본다 | EP-05 (1) |
| VP-09 | R-90 ↔ AT-19 | REGRESSION | 같은 fold → 행 경로 | 0212 의 기존 직접 oracle | not selected — 기존 직접 oracle | EP-06 (1) |
| VP-10 | R-91 ↔ AT-20 | REGRESSION | `canBackgroundTask` → 두 타일 | 0212 의 기존 직접 oracle | not selected — 기존 직접 oracle | EP-06 (1) |
| VP-11 | R-92 ↔ AT-21 | REGRESSION | `canStopTask` → 두 타일 | 0212 의 기존 직접 oracle | not selected — 기존 직접 oracle | EP-06 (1) |
| VP-12 | MD-90 ↔ AT-10 | REGRESSION | 같은 fold 경로 | `taskBoard.test.ts` AT-10a 순서 단언 | not selected — 기존 직접 oracle | EP-06 (1) |

- **`NOT_REQUIRED` 0건** — Baseline V 라 비영향 판정 대상이 없다.
- 유효 V: **12 pair**(REQUIRED 8 · REGRESSION 4).

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| **선행 조건 — 의존성 설치** | 워크트리는 `node_modules` 를 물려받지 않는다 | `cd app && npm ci` → 그 뒤 `npm rebuild better-sqlite3`(Node ABI). electron 바이너리가 없으면 `node node_modules/electron/install.js` | 미설치는 게이트 미실행 |
| subtree — `app/**` 정적 | `app/src/renderer` 를 바꾼다 | `npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| subtree — 관련 스위트 | reducer·렌더·타일 SSOT 가 바뀐다. **경로 필터를 주지 않는다**(0212 P10 — 필터가 새 디렉토리를 조용히 건너뛴다) | `./node_modules/.bin/vitest run` | 이번 변경이 깬 케이스만 blocking |
| repository — 문서 인벤토리 | 채널·variant 증감은 없으나 문서 링크가 늘어난다 | `node scripts/check-doc-inventory.mjs --check` | 실패는 blocking |
| repository — IPC 계약 | **해당 없음** — 신규 채널·variant 0 | — | — |

> **변경 전 초록 기준선 (구현 베이스 `46047ac` 실측, 2026-09-02 재측정)** — 구현 턴이 "내가 깬 것"과 "원래 그랬던 것"을 가르는 분모다. 설계 시점 표기(`9ea09e4` · 280파일 2800케이스 · 80 channels)는 0211 병합 이전 트리라 분모가 달랐다.
>
> | 게이트 | 결과 |
> |---|---|
> | `npm run typecheck` (node·web·test 3구성) | **`error TS` 0건** (exit 0) |
> | `./node_modules/.bin/vitest run` (필터 없음) | **307파일 2983케이스 전건 green** (exit 0) |
> | `node --test "scripts/*.test.mjs"` | **67 pass / 0 fail** (8 suites) |
> | `node scripts/check-doc-inventory.mjs --check` | `generated ok (9 items, 82 channels)` · `prose ok` · `links ok` |
> | `npm run lint` | **0 error / 1 warning** — 기존분(`useTranscriptVirtualizer.ts:22` React Compiler `incompatible-library`) |

> **알려진 기준선(이번 변경과 무관)**: ① `npm ci` 직후에는 `better-sqlite3` 가 **Electron ABI** 로 깔려 있어 DB 로드 스위트 **10파일 54케이스**가 `NODE_MODULE_VERSION 140 ≠ 127` · `Module did not self-register` 로 red 다 — 전부 `src/main/**` 이고 renderer red 는 **0**이다. `npm rebuild better-sqlite3`(Node ABI) 한 번으로 전건 green 이 된다(위 표가 그 상태다). 게이트 절차로 요구하지 않는다는 `app/AGENTS.md` 원칙과 충돌하지 않는다 — **DB 스위트까지 초록 분모를 잡기 위한 선택**이다. ② `infra/git/mutation-queue.test.ts` 가 병렬 실행에서 드물게 `AssertionError` 로 red 였다는 보고가 있다(0212 P11) — 이 베이스 2회 전체 실행에서 **재현 0회**다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 정지 SSOT 는 배열 하나이고 소비가 **3지점**이다 | `rightPanelTiles.ts:43` · 소비 `ChatTitleBar.tsx:29`(메뉴) · `chatReducer.ts:1507`(활성화) · `rightPanelTiles.ts:76`(배지) |
| **메뉴 목록 필터가 두 벌이다** | `rightPanelTiles.ts:58` `visibleRightPanelTileDefinitions` ↔ `ChatTitleBar.tsx:28` `VISIBLE_TILE_REGISTRY`. 둘이 같은 배열을 읽지만 서로를 모른다 |
| **프로덕션이 읽는 쪽은 잠기지 않았다** | `rg visibleRightPanelTileDefinitions` → 정의 1 · **테스트 1** · 프로덕션 **0**. 실제 메뉴는 `VISIBLE_TILE_REGISTRY` 가 만든다 |
| `ChatTitleBar` 는 테스트가 **0건**이다 | `rg -l ChatTitleBar --include=*.test.*` → **0** |
| `Popover` 는 닫혀 있으면 `null` 을 반환한다 | `Popover.tsx:39` 반환 타입 + `:43` 주석("패널은 open 동안 항상 마운트") — 메뉴 항목은 정적 렌더에 안 나온다 |
| 배지 훅과 세션 훅이 **같은 모듈**이다 | `chatStore.ts:1550` `useUnseenSettledTaskCount` · 같은 파일 `useChatSession` → `vi.mock` 한 번으로 둘을 덮는다 |
| `TaskProgressList` 는 **props-only View** 라 SSR 렌더가 된다 | `TaskTileContent.tsx:258` 주석 + 기존 하네스 `taskSurface0212.render.test.ts` `renderProgress` |
| `TaskRow` 둘째 줄은 `item.background &&` 조건이라 **할 일 행에는 둘째 줄이 없다** | `TaskTileContent.tsx:246-250` |
| 막힘 문구 키가 **이미 있다** | `ko.ts:606` `blockedByValue: '#{{ids}} 완료 필요'` · `en.ts` 대응 키 `'needs #{{ids}}'` — 소비처는 상세의 `detailValueText`(`TaskTileContent.tsx:128-129`) |
| 목록은 할 일 + background **합집합**이다 | `taskBoard.ts:93-99` `taskBoardOrdered` 의 `[...sorted, ...backgrounds]` → `items.length === 0` 은 둘 다 비었을 때만 참 |
| 죽은 export 를 막는 린트가 **없다** | `eslint.config.mjs`·`package.json` 에 `no-unused-modules`·`knip`·`ts-prune` **0건** — D-004 가 게이트를 깨지 않는다 |
| 우측 패널 레이아웃은 타일 수 상한이 없다 | `rightPanelLayout.ts:42-50` `addTileColumnMajor` — 열당 `ROWS_PER_COL = 2`, 열은 무제한 |
| 타일 구성은 DB 영속이 없다 | `rg rightPanelTiles src/main src/shared` → **0건** · 초기값 `chatReducer.ts:274` `[]` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 정지 배열 소비처 (비테스트) | `rg "SUSPENDED_RIGHT_PANEL_TILES\|MENU_HIDDEN_RIGHT_PANEL_TILES\|isRightPanelTileSuspended\|showsUnseenTaskBadge" src` | **3** | 메뉴 · 활성화 · 배지 — §10 EP-01 의 분모 |
| `useTaskBoard` 프로덕션 소비처 | `rg "useTaskBoard\b" src` (테스트 제외) | **1** | `TaskTileContent.tsx:380` — 정지가 곧 0212 R-01·02·03 의 도달 0 |
| `visibleRightPanelTileDefinitions` 프로덕션 참조 | `rg` (정의·테스트 제외) | **0** | 0205 AT-01 의 오라클이 프로덕션을 안 본다 → D-008 |
| `ChatTitleBar` 테스트 | `rg -l ChatTitleBar --include=*.test.*` | **0** | 메뉴·배지 배선이 무잠금 |
| 정지를 단언하는 테스트 케이스 | 3파일 직접 열거 | **12** | `rightPanelTiles.test.ts` 5(메뉴3·술어1·배지1) · `chatReducer.plan.test.ts` 5 · `chatReducer.task.test.ts` 2 |
| `blockedByValue` 소비처 | `rg "blockedByValue"` (i18n 제외) | **1** | `TaskTileContent.tsx:129` 상세 — 행이 추가되면 2가 된다(EP-04) |
| `TileSection`·`SectionPlaceholder` 소비처 | `rg` (정의 제외) | **3** | `TaskTileContent.tsx:400·408·411` — 전부 이번에 제거 대상 |
| **3섹션 껍데기를 단언하는 테스트** | `rg "TileSection\|SectionPlaceholder\|sectionBodies\|aria-expanded" src` (i18n 제외) | **1케이스** | `rightPanelTiles.render.test.ts:138` 0204 AT-29 — 세 섹션 제목·본문 귀속·`aria-expanded` 3개를 단언한다. **AC8·AC9 의 정반대라 이번 변경이 red 로 만든다** → §11 에 갱신 대상으로 넣는다. `diffPanelDesign.test.ts:61` 은 `TaskTileSections.tsx` **소스 문자열**만 읽어 D-004(파일 보존) 아래 green 이다 (2026-09-02 신설) |
| 0212 회귀 케이스 실존 | `rg "AT-05·AT-08\|AT-06\|AT-23\|AT-24\|AT-18\|AT-19" taskSurface0212.render.test.ts` | **7** | AT-19·20·21 의 회귀 대상이 실재한다 |
| 우측 패널 타일 정의 | `rightPanelTiles.ts:8-13` | **4** | `plan`·`subagent`·`task`·`diff` — 정의 순서가 곧 메뉴 순서 |

### 수치 / 전칭 표현 검산

- 재측정 수치: AC **21** = R-01(7) + R-02(3) + R-03(4) + R-04(4) + R-90·91·92(3). 내역 합 = 총계 ✅.
- pair **12** = REQUIRED 8(VP-01·02·03·04·05·06·07·08) + REGRESSION 4(VP-09·10·11·12). 내역 합 = 총계 ✅.
- 강제 지점 **11** = EP-01(3) + EP-02(2) + EP-03(2) + EP-04(2) + EP-05(1) + EP-06(1). 내역 합 = 총계 ✅.
- "유일한/항상/절대" 반례 검색: 본문의 전칭 표현은 **`useTaskBoard` 프로덕션 소비처 1건**과 **`visibleRightPanelTileDefinitions` 프로덕션 참조 0건** 둘이고, 각각 위 전수 조사 행이 N 으로 뒷받침한다.
- 문서 앵커 존재 확인: 0205 `D-004`(plan:47) · `D-006`(plan:49) · `D-009`(plan:52) · `D-010`(plan:53) · 0204 `D-015`(plan:58) · `D-017`(plan:61) · `D-018`(plan:62) · `D-019`(plan:63) · `D-022`(plan:66) · `D-031`(plan:75) 전부 grep 확인 ✅.
- 기존 테스트 케이스 존재 확인: `chatReducer.task.test.ts:157` 주석이 **복귀 문장까지 적어 두었다** — *"정지 해제 시 이 단언이 `toContain('task')` 로 돌아간다(0204 AT-30 의 원래 문장)"* ✅.
- 인용 커밋 실재: `0212:ΔV1 @229a0e67` · `0204:ΔV2 @7b45fa3` — 전자는 `git cat-file -t` = `commit` ✅, **후자는 shallow clone 이라 조회 불가**(0212 r2 §0 과 같은 한계, plan 결함이 아니다).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
rightPanelTiles.ts
  SUSPENDED = ['task']
     ├─→ MENU_HIDDEN ─→ visibleRightPanelTileDefinitions ─→ (프로덕션 소비 0)  ← 잠긴 쪽
     │                └→ ChatTitleBar.VISIBLE_TILE_REGISTRY ─→ 메뉴 3항목      ← 안 잠긴 쪽
     ├─→ chatReducer.activateTile ─→ 'task' 요청을 무시
     └─→ showsUnseenTaskBadge ─→ 항상 false

TaskTileContent (도달 불가)
  └─ TileSection(진행 상황) → TaskProgressList
     ├─ items.length === 0 ─→ 안내 | 빈 문구        ← background 가 있으면 침묵
     └─ TaskRow
        ├─ 제목 (activeForm 교체)
        └─ item.background && 메타 줄               ← 할 일 행은 둘째 줄 없음(blockedBy 안 보임)
  ├─ TileSection(출력) → SectionPlaceholder
  └─ TileSection(컨텍스트) → SectionPlaceholder
```

문제 셋: ① 세 소비처가 타일을 막아 0212 산출 3건이 도달 0. ② 메뉴 필터가 두 벌이고 프로덕션 쪽이 무잠금. ③ 안내 조건과 둘째 줄 조건이 각각 한 갈래씩 놓친다.

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
rightPanelTiles.ts
  SUSPENDED = []                                    ← D-001
     ├─→ MENU_HIDDEN ─→ visibleRightPanelTileDefinitions ─┐
     │                                                    │  ← D-008: 한 벌
     │        ChatTitleBar.VISIBLE_TILE_REGISTRY ─────────┘ (파생 소비) ─→ 메뉴 4항목
     ├─→ chatReducer.activateTile ─→ 'task' 를 연다
     └─→ showsUnseenTaskBadge ─→ 미확인 && 닫힘이면 true ─→ 배지 span

TaskTileContent (도달 가능)
  └─ TaskProgressList                                ← D-003: 껍데기 없음
     ├─ agentCount === 0 && 미지원 ─→ 안내 (목록 위)  ← D-007
     ├─ items.length === 0 && !미지원 ─→ 빈 문구
     └─ TaskRow
        ├─ 제목 (activeForm 교체 — 불변)
        └─ 둘째 줄 = background ? 메타 : (blockedBy && !completed ? 막힘 : 없음)   ← D-005·D-006
  (출력·컨텍스트 블록 없음 — 파일·키는 남는다)        ← D-002·D-004
```

### AS-IS → TO-BE Delta

| # | 변경 | V / 구현·검증 연결 |
|---|---|---|
| 1 | `SUSPENDED_RIGHT_PANEL_TILES` = `[]` | AR-02 / VP-01 · EP-01 |
| 2 | `ChatTitleBar` 가 자기 필터를 버리고 `visibleRightPanelTileDefinitions` 에서 파생 | AR-01 / VP-03 · EP-02 |
| 3 | `TaskTileContent` 반환에서 `TileSection` 3블록 제거, 목록 직접 배치 | R-02 / VP-05 · EP-06 |
| 4 | `TaskRow` 둘째 줄에 막힘 분기 추가 | MD-01 / VP-06·VP-07 · EP-04 |
| 5 | `TaskProgressList` 안내 조건을 할 일 0건으로, 안내를 목록 위로 | MD-02 / VP-08 · EP-05 |
| 6 | 0205 가 뒤집은 테스트 12케이스 원복 | R-01 / VP-02 · EP-01 |
| 7 | `ChatTitleBar` 렌더 테스트 신설(`vi.mock('../store/chatStore')`) | SD-01 / VP-04 · EP-03 |

- **AS-IS 에서 사라진 책임: 0건.** `TileSection`·`SectionPlaceholder` 는 호출부만 없어지고 파일·i18n 키는 남는다(D-004).

### 핵심 책임 분리

- `rightPanelTiles.ts` — **가시성 정책 SSOT**. 어떤 타일이 정지·비노출인지, 배지를 띄우는지. 순수 모듈이라 렌더 없이 단위 테스트된다.
- `ChatTitleBar.tsx` — 그 정책의 **소비자**. 자기 정책을 갖지 않는다(D-008).
- `chatReducer.ts` — 활성화 게이트 **한 곳**(`activateTile`). 0205 가 진입점 5곳을 하나로 모은 구조를 그대로 쓴다.
- `TaskTileContent.tsx` — 표시. `TaskProgressList`·`TaskRow` 는 **props-only View** 라 store 없이 렌더된다.
- `taskBoard.ts` — 파생. **이번에 건드리지 않는다**(D-009).

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 · AR-02/VP-01·VP-02 | 정지 목록은 **비어 있다** — 소비 **3지점**(메뉴 필터 · `chatReducer.ts:1507` 활성화 게이트 · `rightPanelTiles.ts:76` 배지). **D-008 적용 후 메뉴 필터 지점은 `ChatTitleBar.tsx` 에서 `rightPanelTiles.ts:59` 로 옮겨간다** — 수는 3 그대로다 | `rightPanelTiles.ts` `SUSPENDED_RIGHT_PANEL_TILES` | 3소비처 | 메뉴 렌더 · 매 활성화 액션 · 매 배지 판정 | 한 지점만 열면 나머지 둘이 조용히 막는다 — 메뉴에는 있는데 눌러도 안 열리거나, 열리는데 배지가 영영 안 뜬다 |
| EP-02 · AR-01/VP-03 | 메뉴 목록은 **한 벌**이다 — 정의 `rightPanelTiles.ts:58` · 소비 `ChatTitleBar.tsx:28`. **지점 2** | `visibleRightPanelTileDefinitions` | 렌더 | 모듈 로드 시 1회 | 두 벌이면 정책을 고쳐도 화면이 안 바뀌고 테스트는 초록이다(현재 상태) |
| EP-03 · SD-01/VP-04 | 배지 판정은 **술어가 소유**하고 `ChatTitleBar` 는 결과만 그린다. **지점 2**(`:76` 호출 · `:200` 렌더) | `showsUnseenTaskBadge` | 렌더 | 매 렌더 | 호출을 지우거나 결과를 무시하면 완료를 알리는 유일한 수단이 사라진다(0204 D-004) |
| EP-04 · MD-01/VP-06·VP-07 | 행 둘째 줄은 **background 메타와 막힘 표시가 공유**한다 — 문구는 `blockedByValue` 하나. **지점 2**(행 `TaskRow` · 상세 `detailValueText`) | `chat.taskTile.blockedByValue` | 렌더 | 매 행 렌더 | 두 분기를 맞바꾸면 서브에이전트 행이 의존을, 할 일 행이 경과를 말한다. 문구를 복사하면 목록과 상세가 갈라진다 |
| EP-05 · MD-02/VP-08 | 안내 조건은 **할 일(agent) 항목 0건**이고 안내는 목록을 **대체하지 않는다**. **지점 1** | `TaskProgressList` 분기 | 렌더 | 매 렌더 | `items` 전체로 세면 서브에이전트가 돌 때 침묵한다. 목록을 대체하면 그 행들이 사라진다 |
| EP-06 · R-02·R-90·R-91·R-92/VP-05·VP-09·VP-10·VP-11·VP-12 | `작업` 타일 본문은 **목록 하나**다 — `TileSection`·`SectionPlaceholder` 호출 0. **지점 1** | `TaskTileContent` 목록 반환 | 렌더 | 매 렌더 | 껍데기가 남으면 접었을 때 타일이 빈 카드가 된다. 목록까지 지우면 0212 산출이 다시 도달 0이 된다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 가시성 정책은 `rightPanelTiles.ts` 하나(EP-01·EP-02) · 의존 문구는 `blockedByValue` 하나(EP-04).
- **`실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: 없음** — 여섯 행 전부 자기 실패 결과를 직접 서술한다.
- **이 라운드에 잠글 수 없는 지점 1건**: `ChatTitleBar.tsx:217` 의 메뉴 `.map()` **최종 렌더**. `Popover` 가 닫힌 상태에서 `null` 을 반환하고(§8) 여는 데 DOM 환경이 필요한데 `jsdom`·`happy-dom` 이 의존성에 없다(0212 P9 와 같은 한계). EP-02 는 그 앞 홉(파생 상수)까지 잠근다 — 구현자는 이 자리를 `N/N` 에 넣지 않고 미잠금으로 보고한다.
- 선택적 필드의 의미: `agentTools` — `undefined`/`null`=판정 불가(안내 없음) · 배열에 `TaskCreate` 없음=기능 없음(안내). 0212 D-005 그대로다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/…/lib/rightPanelTiles.ts` | 가시성 SSOT | `SUSPENDED_RIGHT_PANEL_TILES` 를 `[]` 로. 주석의 "정지" 절을 **복귀 사실과 재정지 방법**으로 갱신 | 순수 단위 |
| `app/src/renderer/…/components/ChatTitleBar.tsx` | 메뉴·배지 소비 | `VISIBLE_TILE_REGISTRY` 를 `visibleRightPanelTileDefinitions.map((t) => tileById(t.id))` 로 파생하고 **export**. `MENU_HIDDEN_RIGHT_PANEL_TILES` 직접 import 제거 | 상수 단언 + 렌더(`vi.mock`) |
| `app/src/renderer/…/rightpanel/TaskTileContent.tsx` | 표시 | 반환에서 `TileSection` 3블록 제거 → `TaskProgressList` 직접 배치. `TaskRow` 둘째 줄에 막힘 분기. `TaskProgressList` 안내 조건·배치 변경 | 렌더 (기존 `renderProgress` 하네스) |
| `app/src/renderer/…/rightpanel/TaskTileSections.tsx` | (숨김) | **변경 없음** — 호출부만 사라진다(D-004). 헤더 주석에 "0213 이 호출부를 뺐다 · 복귀 조건" 한 줄 추가 | — |
| `app/src/renderer/…/shared/i18n/resources/{ko,en}.ts` | 문구 | **변경 없음** — `sections.*` 4키는 남고(D-004) `blockedByValue` 를 재사용한다(D-005) | — |
| `app/src/renderer/…/lib/rightPanelTiles.test.ts` | 테스트 | **4케이스** 원복 — 메뉴 4종·`MENU_HIDDEN` 빈 배열·`SUSPENDED` 빈 배열·배지 기본값 `true`. `타일 정의 자체는 4종 그대로다` 케이스는 이미 green 이라 대상이 아니다(설계 시점 `5` 는 describe 블록 케이스 수를 센 것 — 2026-09-02 정정) | 순수 |
| `app/src/renderer/…/reducer/chatReducer.plan.test.ts` | 테스트 | `정지된 타일의 활성화 차단` describe 5케이스를 **열린다** 방향으로 원복 | 순수 |
| `app/src/renderer/…/reducer/chatReducer.task.test.ts` | 테스트 | 2단언 원복 — `not.toContain('task')` → `toContain('task')`(0204 AT-30 원문) | 순수 |
| `app/src/renderer/…/rightpanel/rightPanelTiles.render.test.ts` | 테스트 | **0204 AT-29(3섹션) 케이스를 새 계약으로 대체** — 래퍼가 목록 View 를 부른다(양성) + `<section>`·`aria-expanded` 부재(음성). 구 장치가 잡던 *래퍼→본문 배선 삭제* 를 새 장치도 red 로 잡아야 한다 | 렌더 |
| `app/src/renderer/…/rightpanel/taskSurface0212.render.test.ts` | 테스트 | 케이스명·주석만 — `안내는 항목이 있으면 뜨지 않는다 — 빈 상태 전용이다` 가 D-007 이 정정한 조건을 말한다. 단언은 불변(green) | 렌더 |
| `app/src/renderer/…/components/ChatTitleBar.render.test.ts` | **신규** | `vi.mock('../store/chatStore')` 로 배지 훅·세션 훅을 시드해 배지 노드 유무를 단언. `VISIBLE_TILE_REGISTRY` id 목록도 함께 | 렌더 |
| `app/src/renderer/…/rightpanel/taskTile0213.render.test.ts` | **신규** | 껍데기 부재·막힘 표시 3케이스·안내 조건 4케이스 | 렌더 |
| `docs/handoff/INDEX.md` · `docs/handoff/0213-…/plan.md` | 보드·설계 | 상태 갱신 | 문서 게이트 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: 신규 없음. `rightPanelTiles.ts` 는 이미 L0 순수이고 `TaskProgressList`·`TaskRow` 는 props-only View 다(§8).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `taskSurface0212.render.test.ts` 의 `renderProgress` 가 `taskBoardFromMessages → taskBoardOrdered → TaskProgressList` 를 그대로 통과시킨다 — 신규 케이스가 같은 하네스를 쓴다. `vi.mock('electron')` 선례가 7파일 있고 store mock 선례는 0212 D13 이 지목했다.
- 순서를 관측할 훅/로그/주입 경계: AT-01 의 정의 순서는 상수 배열을 직접 읽어 관측한다 — 별도 훅이 필요 없다.

## 12. End-to-end 영향

### producer → consumer

```text
[가시성 정책]  rightPanelTiles.SUSPENDED = []
   → ChatTitleBar.VISIBLE_TILE_REGISTRY  → 메뉴 4항목        (AT-01)
   → chatReducer.activateTile            → 열 구조에 'task'  (AT-02·03·04)
   → showsUnseenTaskBadge                → 배지 span         (AT-05·06)

[표시]  TaskTileContent
   → TaskProgressList(items, agentTools, cliVersion)
       → 안내 | 빈 문구 | 목록                                (AT-15~18)
       → TaskRow → 제목 · 둘째 줄(메타 | 막힘)                (AT-11~14 · AT-19)
```

### 부팅/등록/초기화 변경 시 기존 소비처

| 소비처 | 이번 변경의 영향 | 확인 |
|---|---|---|
| `ChatTitleBar` 메뉴 | 항목 3 → **4** | AT-01 |
| `chatReducer` 활성화 5지점 | 전부 `activateTile` 경유라 게이트 하나가 열린다 | AT-02·03·04 |
| 배지 3 소거 지점(`SELECT_TASK`·`OPEN_TASK`·`ACKNOWLEDGE_SETTLED_TASKS`) | 타일 도달이 가능해져 **정상 동작을 되찾는다**(0205 D-006 이 지적한 고착이 풀린다) | AT-05·06 |
| `백그라운드 작업` 타일 | **무영향** — 이번 변경이 그 컴포넌트를 건드리지 않는다 | AT-20·21 |
| `taskBoard.ts` 파생 | **무영향** — 렌더만 바뀐다(D-009) | AT-10 · VP-12 |
| `diff`·`plan` 타일 | **무영향** — 정지 목록에 없었다 | AT-07 |

## 13. Lifecycle / 오류 / 정리

- 타일 열기 → `TaskTileContent` 의 `useEffect` 가 `acknowledgeSettledTasks` 를 부른다(기존). 배지가 꺼진다.
- 타일 닫기 → `removeTileFromColumns` 가 그 열에서만 제거하고 빈 열은 드롭한다(기존).
- 실패 경로: **이번 변경이 새로 만드는 실패 경로 0.** 정지 해제는 분기 제거이고 막힘 표시·안내 조건은 순수 파생이다.
- 정리: 제거하는 것은 렌더 호출 3건뿐이다. 상태·구독·타이머를 만들거나 없애지 않는다.

## 14. 성능 / 상한 / 최적화

- `VISIBLE_TILE_REGISTRY` 는 모듈 상수라 파생 방식을 바꿔도 렌더당 비용이 0이다(기존 주석이 같은 이유를 적는다).
- 막힘 줄은 행당 문자열 하나이고 `blockedBy` 는 이미 fold 가 들고 있다 — 추가 순회 0.
- 안내 조건이 `items.filter(kind==='agent')` 를 요구하면 목록 길이만큼 1회 순회가 는다. 목록은 세션당 할 일 수준(수십)이라 상한이 문제되지 않는다 — **길이를 세는 것으로 충분하므로 새 배열을 만들지 않는다**(`some`/카운트).
- one-way door: **없음.** 되돌리기는 배열에 `'task'` 를 다시 넣는 것이고 두 섹션 복귀는 블록 3개를 되살리는 것이다.

## 15. 외부 구현 포트 / 문서 계약

- **해당 없음** — 신규 IPC 채널·NormalizedEvent variant·설정 키·외부 구현 포트가 0이다. `docs/IPC_CONTRACT.md` 갱신 대상 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 이번 작업과의 관계 |
|---|---|
| 0205 D-004 (타일 정지) | **대체** — D-001. 조건("cowork 구현전까지")을 사용자가 바꿨다 |
| 0205 D-006 (배지 정지) | **조건 종료** — 자기 행이 "함께 복귀" 라 적었고 같은 배열을 읽어 자동 복귀한다 |
| 0205 D-009 (파생 불변) | **승계** — D-009 |
| 0205 D-010 (테스트 재작성) | **의도대로 소비** — D-010, 12케이스를 원복한다 |
| 0204 D-022 (두 섹션 빈 상태) | **대체** — D-002. 충전 조건이 아티팩트 도구·cowork 로 새로 걸렸다 |
| 0204 D-017 (3섹션 양식) | **숨김 기간 한정 보완** — D-003. 두 섹션이 돌아올 때 껍데기를 다시 씌운다 |
| 0204 D-015·D-018·D-019·D-031 | **유지** — 두 타일·id 단일 목록·두 종류 함께·순서≠의존이 그대로다 |
| 0204 D-004 (미확인 완료 배지) | **복원** — 정지 기간 동안 무효였던 통지 수단이 돌아온다 |
| 0212 D-006·D-007·D-021·D-022 | **유지 + 회귀로 잠금** — R-90·R-91·R-92 |
| 0212 AC2·AC3 (안내 조건) | **정정** — D-007. 판정 규칙(0212 D-003·D-005)은 불변이고 분모만 좁힌다 |
| 0212 P10 (게이트 명령이 `src/preload` 를 건너뛴다) | **이번 게이트가 선반영** — §7-A 가 경로 필터 없는 `vitest run` 을 쓴다 |
| `docs/AGENTS.md §작성규칙 2` (코드 수치 재서술 금지) | 이 plan 은 채널·슬라이스 수를 적지 않는다 — 인벤토리 대상 값 0 |
| `app/src/renderer/AGENTS.md` (4-layer 의존 방향) | `ChatTitleBar`(components) → `lib/rightPanelTiles`(lib) 는 기존 방향이고 새 역방향 import 를 만들지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| **메뉴 `.map()` 최종 홉이 무잠금으로 남는다** | §10 에 미잠금으로 명시하고 그 앞 홉(파생 상수)을 잠근다. 구현자가 `N/N` 으로 보고하지 않도록 EP-02 가 지점을 2로 못박는다 |
| `TaskTileSections.tsx` 가 참조 0인 파일이 된다 | D-004 의 의도적 결과다. 죽은 export 를 막는 린트가 없어 게이트를 깨지 않고(§8), 헤더 주석이 복귀 조건을 적어 검증자가 죽은 표면과 구분한다 |
| 안내가 목록 위로 오면서 레이아웃이 바뀐다 | 안내는 기존과 같은 `px-p2 text-caption text-ink3` 블록이고 목록 위 한 단락이다. 시각 실기가 아니라 렌더 단언으로 관측한다 |
| 정지 해제로 0212 의 미검증 표면이 사용자에게 노출된다 | 0212 는 r3 PASS 이고 AC 27/27 이다. 남은 것은 클릭 홉 오라클 부재(P9)뿐이고 **동작 결함이 아니라 잠금 부재**다 |
| 두 타일이 서브에이전트를 겹쳐 보인다 | **설계다** — 0204 D-015·D-019 가 그렇게 정했다(`작업` = 전체 진행, `백그라운드 작업` = 자식 대화록 상세) |

## 18. 영향 받는 파일 / 문서

- 수정: `rightPanelTiles.ts` · `ChatTitleBar.tsx` · `TaskTileContent.tsx` · `TaskTileSections.tsx`(주석만)
- 수정(테스트): `rightPanelTiles.test.ts` · `chatReducer.plan.test.ts` · `chatReducer.task.test.ts` · `rightpanel/rightPanelTiles.render.test.ts`(AT-29 대체) · `taskSurface0212.render.test.ts`(문구만)
- 신규(테스트): `ChatTitleBar.render.test.ts` · `taskTile0213.render.test.ts`
- 수정(문서): `docs/handoff/INDEX.md` · 이 `plan.md`
- **변경 없음**: `taskBoard.ts` · `shared/task-tool.ts` · i18n 카탈로그 · `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: [`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`](../../../app/AGENTS.md) · [`app/src/renderer/AGENTS.md`](../../../app/src/renderer/AGENTS.md)(4-layer 의존 방향)
- ABI/네트워크 등 환경 제약: DB 스위트를 건드리지 않으므로 `npm test` 를 쓰지 않는다.
- **선행: `cd app && npm ci` → `npm rebuild better-sqlite3` → (필요 시) `node node_modules/electron/install.js`**
- 기본 정적 게이트: `npm run lint && npm run typecheck`
- 관련 테스트: **`./node_modules/.bin/vitest run`** — 경로 필터를 주지 않는다(0212 P10)
- 스크립트 게이트: `node --test "scripts/*.test.mjs"`
- 문서 게이트: `node scripts/check-doc-inventory.mjs --check`
- 사람 실기: **없음** (§7 주의사항 — 메뉴 `.map()` 홉은 사람 실기가 아니라 DOM 환경 부재로 미잠금이다)

## READY self-review

- [x] 여러 턴의 결정이 Decision Ledger 에 보존되어 있다 — D-001~D-010 전부 ACTIVE, OPEN 0건. `SUPERSEDED` 는 다른 handoff 2건(0205 D-004 · 0204 D-022)이고 각각 대체 관계를 적었다.
- [x] Part I 만 읽어도 완료 상태를 설명할 수 있다 — §5 흐름 + §5 상태표 12행 + §7 AC 21행.
- [x] 조건절·이유절을 재해석하지 않았다 — 사용자 문장 두 개를 §2·D-001·D-002 에 **원문으로** 인용했다("212에서 구현한 기능을 지원하는것" · "아티팩트도구개발,cowork지원 전까지 숨김처리한다"). **"숨김처리" 를 "제거" 로 바꾸지 않았다**(D-004).
- [x] 사용자에게 물어야 할 제품 결정과 코드로 닫을 사실을 구분했다 — 세 건을 물어 D-003·D-005·D-007 로 확정했고, 정지 소비처·SSOT 두 벌·키 실재는 조사로 닫았다.
- [x] 수치·전칭·앵커·기존 테스트 인용을 실측했다 — §8 검산 절. 전칭 2건(`useTaskBoard` 1 · `visibleRightPanelTileDefinitions` 0)에 전수 조사 행이 있고, 0204·0205 앵커 10건과 0212 회귀 케이스 7건을 grep 확인했다. 미확인 인용 **1건**(`7b45fa3` — shallow clone 한계, 명시했다).
- [x] **인용한 게이트를 직접 돌렸다** — typecheck 0 · vitest **307파일 2983케이스** · scripts 67/67 · doc-inventory 3줄 ok · lint 0 error/1 warning (§7-A 기준선 표, 2026-09-02 구현 베이스에서 재측정).
- [x] 저장소 규칙을 설계 입력으로 확인했다 — 죽은 export 린트 부재(D-004 가 게이트를 안 깬다) · renderer 4-layer 방향 · 0212 P10 의 게이트 명령 정정 반영.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다 — §7 표 3개 칸, 21행 전부.
- [x] Baseline V 를 썼고 유효 V 를 재구성할 수 있다 — §7-A, 상속하지 않는 근거(0205 V 를 부분이 아니라 전부 뒤집는다) 포함.
- [x] 모든 `NEW`·`CHANGED` node 에 같은 레벨 `REQUIRED` pair 가 있다 — R-01(VP-02) · R-02(VP-05) · R-03(VP-06·07) · R-04(VP-08) · SD-01(VP-04) · AR-01(VP-03) · AR-02(VP-01) · MD-01(VP-06·07) · MD-02(VP-08).
- [x] 영향받은 `INHERITED` node 는 `REGRESSION` 이다 — R-90(VP-09) · R-91(VP-10) · R-92(VP-11) · MD-90(VP-12). `NOT_REQUIRED` 0건.
- [x] 각 pair 가 production path · §10 전수 · 직접 oracle 을 갖고, 적대 증거는 **VP-02·VP-03·VP-04·VP-07·VP-08** 다섯만 선택했다 — 정지 배열 복귀 1 · **SSOT 술어 좁힘** 1 · 배선 소거 1 · 형제 맞바꿈 1 · 조건 복귀 1, 각각 이유 명시. VP-03 은 2026-09-02 에 교체했다 — 원래 등록한 *자기 필터 복귀* 변이는 `SUSPENDED=[]` 에서 두 파생의 산출이 같아 성립하지 않는다(실측).
- [x] **"X 가 쓰인다" 의 검사 장치가 X 를 지웠을 때 실패한다** — VP-03 이 SSOT **술어를 좁혀** 소비자가 따라오는지로, VP-04 가 배지 렌더 배선 소거로 그렇게 잠근다. `ChatTitleBar` 가 무잠금이고 기존 테스트가 침묵한다는 것이 실측이다(§8).
- [x] **자리를 말하는 불변식은 형제 맞바꿈에도 실패한다** — VP-07 이 둘째 줄의 두 분기(background 메타 ↔ 막힘)를 맞바꾸는 변이를 등록했다.
- [x] 음성 단언에 양성 짝이 있다 — 부재 단언 6건 전부(§7 주의사항에 짝을 열거).
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AT-01·05·15 의 `검증 수단` 칸이 관측 지점을 명시한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 EP-01~EP-06 · §11 seam 칸.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 6행.
- [x] 상한·one-way door 를 계산했다 — §14. one-way door 0건.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다 — `npm test` 미사용, `vitest run` 직접 호출.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 사람 실기 0건. 미잠금 1지점은 DOM 환경 부재이고 §10·§17 에 사유와 함께 적었다.
- [x] 범위/비범위가 도달 경로를 스스로 막지 않는다 — 비범위 6건 전부 이번 R 4개의 경로 밖이다.
- [x] 본문 완성 후 교차검증했고 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 관측으로 적었다 — 충돌 0, 확인 쌍 13개 열거.
- [x] 산출물 문장 규칙을 지켰다 — 판정 먼저, 표 한 칸 3줄 이내, Part I/II 사실 중복 없음(정지 3소비처는 Part I 에 결과만, Part II 에 좌표).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] r1 — 설계 리뷰

**판정: 규범 정정 5건 후 구현 가능.** 정정은 별도 설계 커밋으로 분리했다(§3 `설계 정정` 표 C-01~C-05) — 제품 의도·AC·ACTIVE Decision 은 바뀌지 않았다.

| # | 성격 | 처리 |
|---|---|---|
| C-01 | **PLAN_GAP** — VP-03 의 선택된 적대 증거가 성립하지 않는다 | 설계 커밋에서 SSOT 술어 좁힘으로 교체. 실측 근거는 아래 M2b |
| C-02 | **PLAN_GAP** — 전수 조사에 없던 반대 단언 1케이스 | 설계 커밋에서 §8 행 신설 · §11 · §18 |
| C-03 | 사실 정정 — 기준선 분모가 이 베이스와 다르다 | 구현 베이스에서 재측정해 표 교체 |
| C-04 | 사실 정정 — 인용 좌표 4건(+소소 4건) | §8·§10·§17 |
| C-05 | 사실 정정 — 원복 분모 5 → 4 | §11 |
| C-06 | 구현 세부 — 신규 테스트의 `Message` fixture 에 `createdAt` 필수 | 선조치. **vitest 는 통과하고 typecheck 만 잡았다** — 게이트를 exit code 로 판정했으면 놓쳤다 |

**설계 대비 명시적 차이 1건 — 의존 문구 조립을 함수로 모았다.** plan §10 EP-04 는 SSOT 를 i18n 키(`blockedByValue`) 하나로 뒀고, 구현은 그 위에 `blockedByText(tr, ids)` 헬퍼를 신설해 행·상세 두 소비자가 **같은 조립**을 부르게 했다(키만 공유하면 구분자 하나로 두 화면이 갈라진다). 대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다:

| 축 | 새 실패 모드 | 다시 확인한 계약 |
|---|---|---|
| 만료 | **해당 없음** — 순수 함수, 상태 0 | — |
| 공유 | 두 소비자가 한 함수를 쓴다 — 한쪽 요구가 갈리면 **함수를 갈라야** 한다. 지금은 두 요구가 같다(`', #'` 조인) | EP-04 2지점 전수(아래) · AC11 · 0212 상세 회귀 green |
| 재진입 | **해당 없음** — 순수 | — |
| 다른 무효화 축 | **해당 없음** — 캐시·구독·타이머 0 | — |

**배치 차이 1건.** §11 은 AC8·AC9(껍데기 부재)를 신규 파일에 두라고 했으나 **형제 파일 `rightPanelTiles.render.test.ts` 의 대체 케이스**에서 닫았다. 이유: 그 파일의 구 AT-29 가 *래퍼 → 본문 View 배선* 을 잡던 장치이고, 같은 자리에서 승계해야 덮개 회귀가 없다(아래 M6 이 그 하한을 실측한다). 계약은 같은 곳에서 한 번 닫힌다.

## [구현자 기입] r1 — 강제 지점 전수와 V-pair 자기확인

### §10 강제 지점 — **11/11**

| EP | 불변식의 주어 | 검색 명령 | 지점 | 닫음 | 관측값 |
|---|---|---|---|---|---|
| EP-01 | 정지 정책을 **읽는** 프로덕션 지점 | `rg -n "isRightPanelTileSuspended\(\|SUSPENDED_RIGHT_PANEL_TILES\|MENU_HIDDEN_RIGHT_PANEL_TILES" src --glob '!**/*.test.ts'` | 3 | **3/3** | 메뉴 필터 `rightPanelTiles.ts:61` · 활성화 게이트 `chatReducer.ts:1507` · 배지 판정 `rightPanelTiles.ts:79`. 나머지 2줄(`:54`·`:77`)은 함수 기본인자 seam 이지 소비가 아니다 |
| EP-01 차집합 | 게이트를 **우회하는** 활성화 경로 | `rg -n "addTileColumnMajor" src --glob '!**/*.test.ts'` | — | **0줄** | 정의 `rightPanelLayout.ts:42` · import `chatReducer.ts:34` · 호출 `chatReducer.ts:1507`(게이트 내부). 게이트 밖 호출 **0** |
| EP-02 | 타일 메뉴 목록을 **만드는** 지점 | `rg -n "visibleRightPanelTileDefinitions\|VISIBLE_TILE_REGISTRY" src --glob '!**/*.test.ts'` | 2 | **2/2** | 정의 `rightPanelTiles.ts:60` · 소비 `ChatTitleBar.tsx:30`. `ChatTitleBar.tsx:220` 최종 `.map()` 은 **미잠금**(§10 대로 분모에 넣지 않았다) |
| EP-03 | 배지 판정 결과를 **쓰는** 지점 | `rg -n "showTaskBadge\|showsUnseenTaskBadge" ChatTitleBar.tsx` | 2 | **2/2** | 호출 `:79` · 렌더 `:202` |
| EP-04 | 의존 문구를 **화면에 내는** 지점 | `rg -n "blockedByValue\|blockedByText\|blockedRowText\|blockedRow" src --glob '!**/*.test.ts' --glob '!**/i18n/**'` | 2 | **2/2** | 행 `TaskTileContent.tsx:184`→`:267` · 상세 `:141`. 문구 리터럴 `blockedByValue` 는 `:120` **1곳뿐** — 복사 0 |
| EP-05 | 기능 부재 안내를 **판정하는** 지점 | `rg -n "taskTile.unsupported\|agentTools" src/renderer --glob '!**/*.test.ts'` | 1 | **1/1** | 판정 `TaskTileContent.tsx:302`. `chatReducer` 행은 상태 필드(생산자), `:410`·`:430` 은 전달 |
| EP-06 | 타일 본문에 섹션 **껍데기를 두는** 지점 | `rg -n "TileSection\|SectionPlaceholder" src --glob '!**/*.test.ts' \| grep -v TaskTileSections.tsx` | 1 | **1/1** | 호출 **0건**(남은 1줄은 주석). 정의 파일은 보존 — D-004 |

**합계 검산: EP-01(3) + EP-02(2) + EP-03(2) + EP-04(2) + EP-05(1) + EP-06(1) = 11 · 닫음 11 → `11/11`.** 미잠금 1지점(`ChatTitleBar.tsx:220`)은 분모 밖이다.

### V-pair 자기확인 — 12 pair

| Pair | 자기 상태 | 재현 명령 / 관측값 |
|---|---|---|
| VP-01 (AR-02↔AT-07) | `SELF_PASS` | `rightPanelTiles.test.ts` — `SUSPENDED` `[]` · 4종 술어 전부 false · seam 양성 짝 green |
| VP-02 (R-01↔AT-02·03·04) | `SELF_PASS` | reducer 두 파일 60케이스 green. 적대 증거 **M1** 아래 |
| VP-03 (AR-01↔AT-01) | `SELF_PASS`(제한 명시) | `ChatTitleBar.render.test.ts` 5케이스 green. 배선 관측은 **SSOT 변이와 짝지어야** 성립한다 — 아래 M2·M2b |
| VP-04 (SD-01↔AT-05·06) | `SELF_PASS` | 술어 2방향 + 렌더 3케이스 green. 적대 증거 **M3** |
| VP-05 (R-02↔AT-08·09·10) | `SELF_PASS` | `rightPanelTiles.render.test.ts` 12케이스 green |
| VP-06 (MD-01↔AT-11·12·13) | `SELF_PASS` | `taskTile0213.render.test.ts` 막힘 3케이스 green |
| VP-07 (MD-01↔AT-14) | `SELF_PASS` | 적대 증거 **M4** |
| VP-08 (MD-02↔AT-15·16·17·18) | `SELF_PASS` | 안내 4케이스 green. 적대 증거 **M5** |
| VP-09 (R-90↔AT-19) | `SELF_PASS` | `taskSurface0212.render.test.ts` AT-05·06·08 green |
| VP-10 (R-91↔AT-20) | `SELF_PASS` | 같은 파일 AT-23·24 green |
| VP-11 (R-92↔AT-21) | `SELF_PASS` | 같은 파일 AT-18·19 green |
| VP-12 (MD-90↔AT-10) | `SELF_PASS` | `taskBoard.test.ts` AT-10a + 렌더 단일 목록 케이스 green |

## [구현자 기입] r1 — 이번 라운드 수정의 잠금

선택 증거 5(VP-02·03·04·07·08) · 인용 변이 0(파생 이슈 없음 — r1) · 새 oracle 1(구 AT-29 를 대체한 배선 케이스) = **표 행 6**. 대조군 M2b 는 C-01 의 근거라 한 줄 더 둔다.

| 변이 | 심은 곳 | 기대 | 관측 |
|---|---|---|---|
| **M1** VP-02 — `SUSPENDED` 를 `['task']` 로 되돌림 | `rightPanelTiles.ts:45` | 세 액션 전부 red | **5 red** — `TOGGLE 이 작업 타일을 연다` · `SET_RIGHT_PANEL_TILE_ACTIVE(true) 도…` · `이미 열려 있는 타일 옆에 붙는다` · `background 완료 통지가 배지를…`(OPEN_TASK) · `각 타일 열기는 자기 타일만…` |
| **M2** VP-03 — SSOT 술어를 `tile.id !== 'task'` 로 좁힘 | `rightPanelTiles.ts:60` | 소비자가 따라가 red | **1 red** — `메뉴가 정의 순서대로 4종을 담는다` |
| **M2b** 대조군 — 구 등록 변이(자기 필터 복귀) **단독** | `ChatTitleBar.tsx:30` | (plan 은 red 를 기대했다) | **5 green — 성립하지 않는다.** C-01 의 실측 근거 |
| **M2+M2b** 자기 필터 + SSOT 좁힘 | 두 곳 | 배선이 끊겼음이 보인다 | **1 red** — `목록·순서가 visibleRightPanelTileDefinitions 와 같고…` |
| **M3** VP-04 — `showTaskBadge` 를 `false` 고정 | `ChatTitleBar.tsx:79` | 렌더 단언 red | **1 red** — `미확인이 있고 타일이 닫혀 있으면 배지 노드가 렌더된다`. **같은 실행에서 술어 스위트 10케이스는 전부 green** — "술어만 잠그면 배선이 안 잠긴다" 의 직접 증거 |
| **M4** VP-07 — 둘째 줄 두 분기 산출 맞바꿈 | `TaskTileContent.tsx:262` | 형제 맞바꿈 red | **4 red** — `AT-11·AT-12` · `AT-14` · 0212 회귀 2건(`중단 행이 생산자가 실은 사유를…` · `사유가 없으면 UI 문구로…`) |
| **M5** VP-08 — 안내 분모를 `items.length > 0` 로 되돌림 | `TaskTileContent.tsx:301` | AT-15 red | **1 red** — `AT-15 — 할 일 0 · 서브에이전트 진행 중이면 안내와 목록이 함께 선다` |
| **M6** 새 oracle — 래퍼에서 `TaskProgressList` 호출 제거 | `TaskTileContent.tsx:427` | 구 AT-29 하한 승계 | **1 red** — `껍데기 없이 목록 View 만 그린다 — 래퍼→본문 배선은 그대로다` |

**VP-03 의 제한을 그대로 적는다.** `SUSPENDED` 가 비면 `tileRegistry.filter(!MENU_HIDDEN)` 과 `visibleRightPanelTileDefinitions` 는 **같은 4종**을 낸다 — 두 구현이 행동으로 구별되지 않는다. 그래서 자기 필터 복귀 **단독** 변이는 어떤 단언으로도 red 가 되지 않는다(M2b 실측). 배선은 SSOT 를 함께 변이시켜야 보이고(M2+M2b), 그 짝이 이 pair 가 가진 감도의 전부다. 정지된 타일이 다시 생기면 단독 변이도 red 가 된다.

## [구현자 기입] r1 — Product/UX 파생 검토

- **새 사용자 대면 문자열 0.** 막힘 표시는 기존 `chat.taskTile.blockedByValue` 를 재사용한다(D-005) — 소비자는 행·상세 둘이고 둘 다 화면에 도달한다(EP-04 전수).
- **이번에 만든 실패 경로 0.** 정지 해제는 분기 제거이고 막힘 표시·안내 조건은 순수 파생이다. Part I 상태 전이표 12행이 전부 구현에 대응한다 — 표에 없는 행 0.
- **"아무 일도 안 일어남" 의 반대다.** 이전에는 메뉴에 항목 자체가 없어 사용자가 열 방법이 없었고, 0212 산출 3건이 도달 0이었다. 이번 변경이 그 침묵을 없앤다.
- **늦게 도착한 응답 / 동시성**: 해당 없음 — 렌더 파생만 바뀌고 요청·구독·타이머를 만들지 않는다.
- **빈 상태**: 세 갈래가 유지되고 분모만 좁아졌다. 안내는 목록을 대체하지 않는다.

### 파생 이슈 (이번 범위 밖 — 결정권자 몫)

| # | 이슈 | 근거 | 성격 |
|---|---|---|---|
| I-01 | 안내 블록과 목록 사이 간격이 `gap-px`(1px)라 한 덩어리로 읽힐 수 있다 | `TaskTileContent.tsx:306` 컨테이너가 `flex flex-col gap-px` 다 | **사람 실기** — 렌더 단언으로는 잡히지 않는 시각 사안 |
| I-02 | `TaskTileSections.tsx` 가 참조 0인 파일이 됐다 | D-004 의 의도적 결과. 죽은 export 린트가 없어 게이트는 통과한다 | 다음 정리 handoff 가 "안 쓰는 파일" 로 오인해 지울 위험 — 헤더 주석이 복귀 조건을 적어 뒀다 |
| I-03 | 타일 구성이 DB 영속이 아니라 앱 재시작 시 사라진다 | 기존 동작(§6 비범위). **정지가 풀려 사용자가 타일을 열게 되면서 처음 눈에 띈다** | 후속 handoff 후보 |
| I-04 | `작업`·`백그라운드 작업` 두 타일이 서브에이전트를 겹쳐 보인다 | 0204 D-015·D-019 의 설계다 | 정지 해제로 그 중복이 **처음 사용자에게 보인다** — 설계 재확인 대상 |

## [구현자 기입] r1 — 놓친 잠재 문제 + 대응

- **게이트를 exit code 로 판정했으면 놓칠 뻔했다.** `vitest run` 은 신규 테스트 7건을 green 으로 통과시켰고 `npm run typecheck` 만 `TS2352`(`Message` fixture 의 `createdAt` 누락)를 잡았다. 두 게이트를 따로 관측해서 걸렸다 — 산출을 읽지 않고 exit 0 만 봤으면 타입 결함이 남았다.
- **`--reporter=basic` 은 이 vitest 버전에 없다.** `Failed to load custom Reporter from basic` 으로 **한 케이스도 실행하지 않고** 죽는다(exit 1). 기준선을 그 명령으로 재면 0건을 green 으로 오독한다 — 기본 리포터로 다시 쟀다.
- **`git checkout --` 로 변이를 되돌리면 미커밋 구현분까지 날아간다.** 첫 변이 회차에서 실제로 `rightPanelTiles.ts` 의 구현이 HEAD 로 되돌아갔다. 파일 백업 방식으로 하네스를 바꾸고 구현을 복원한 뒤 전 변이를 다시 측정했다 — 위 표는 재측정값이다.
- **`npm ci` 직후 better-sqlite3 는 Electron ABI 다.** DB 로드 10파일 54케이스가 red 였고 전부 `src/main/**` 이다(renderer red 0). `npm rebuild better-sqlite3` 로 전건 green 분모를 잡았다.

## [구현자 기입] r1 — 구현 보고

### AC 전수 — `✅ 21 · ⚠️ 0 · ❌ 0 = 총 21` (검산 일치)

| AC | 판정 | 재현 명령 — 관측한 케이스 |
|---|---|---|
| AC1 | ✅ | `ChatTitleBar.render.test.ts` — `메뉴가 정의 순서대로 4종을 담는다` |
| AC2 | ✅ | `chatReducer.plan.test.ts` — `TOGGLE 이 작업 타일을 연다` |
| AC3 | ✅ | 같은 파일 — `SET_RIGHT_PANEL_TILE_ACTIVE(true) 도 작업 타일을 붙인다` |
| AC4 | ✅ | `chatReducer.task.test.ts` — `background 완료 통지가…`(`selectedTaskKey` + `toContain('task')`) · `각 타일 열기는 자기 타일만…` |
| AC5 | ✅ | 술어 `프로덕션 기본값(인자 생략)으로도 배지가 뜬다` + 렌더 `미확인이 있고 타일이 닫혀 있으면 배지 노드가 렌더된다` |
| AC6 | ✅ | 술어 `타일을 이미 보고 있으면 띄우지 않는다` + 렌더 `타일을 보고 있으면 배지 노드가 없다` |
| AC7 | ✅ | `rightPanelTiles.test.ts` — `프로덕션 정지 목록이 비어 4종 어느 것도 활성화를 막지 않는다` |
| AC8 | ✅ | `rightPanelTiles.render.test.ts` — `껍데기 없이 목록 View 만 그린다`(출력·컨텍스트 4문구 부재) |
| AC9 | ✅ | 같은 케이스 — `진행 상황` 부재 · `aria-expanded` 부재 · `sectionBodies` 빈 객체 |
| AC10 | ✅ | 같은 파일 — `목록에 상태 그룹 헤더가 없다 — 한 줄로 나열한다 (AC10)` (할 일 2 + background 1 동시) |
| AC11 | ✅ | `taskTile0213.render.test.ts` — `AT-11·AT-12` 양성 |
| AC12 | ✅ | 같은 케이스 음성 — `#2 완료 필요` 가 **1회만** |
| AC13 | ✅ | 같은 파일 — `AT-13 — completed 행은 같은 의존을 갖고도 문구를 내지 않는다` |
| AC14 | ✅ | 같은 파일 — `AT-14 — background 행은 자기 메타 줄을 그대로 낸다` |
| AC15 | ✅ | 같은 파일 — `AT-15 — 할 일 0 · 서브에이전트 진행 중이면 안내와 목록이 함께 선다` |
| AC16 | ✅ | 같은 파일 `AT-16` + `taskSurface0212.render.test.ts` `안내는 할 일이 있으면 뜨지 않는다` |
| AC17 | ✅ | 같은 파일 `AT-17` + 0212 `AT-03 — tools 판정 불가(null)면 안내하지 않는다` |
| AC18 | ✅ | 같은 파일 `AT-18` + 0212 `AT-01 — TaskCreate 가 있으면 안내가 뜨지 않는다` |
| AC19 | ✅ | 0212 `AT-05·AT-08 — 제목은 현재진행형이고 aria-label 은 subject 다` · `AT-06` green |
| AC20 | ✅ | 0212 `AT-23` · `AT-24` green |
| AC21 | ✅ | 0212 `AT-18` · `AT-19` green |

### 관측한 게이트 산출

| 게이트 | 명령 | 관측값 |
|---|---|---|
| 정적 — 타입 | `npm run typecheck` | **exit 0 · `error TS` 0건** (node·web·test 3구성) |
| 정적 — lint | `npm run lint` | **0 error / 1 warning** — 기존분 `useTranscriptVirtualizer.ts:22`. 실행 후 트리에 **내 편집분 11파일만** 남았다(autofix 추가분 0) |
| 관련 스위트 | `./node_modules/.bin/vitest run` (필터 없음) | **exit 0 · 309파일 2997케이스 전건 green** (기준선 307/2983 대비 +2파일 +14케이스 = 신규 두 파일) |
| 스크립트 | `node --test "scripts/*.test.mjs"` | **67 pass / 0 fail** (8 suites) |
| 문서 | `node scripts/check-doc-inventory.mjs --check` | `generated ok (9 items, 82 channels)` · `prose ok` · `links ok` |
| IPC 계약 | — | **해당 없음** — 신규 채널·variant 0 |

## [구현자 기입] r1 — Review Signals

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: 그렇다. **"oracle 이 프로덕션 경로의 한 홉 앞에 선다"** 축이다 — 0212 가 네 라운드를 쓴 축이고, 이번 handoff 가 그 형태를 셋 발견했다(메뉴 상수·배지 술어·안내 조건). plan §7 `관측 지점 규칙` 이 그것을 미리 적었고 그대로 걸렸다.
- **막았어야 할 plan 지침·AC 가 있었는가**: C-01 은 **plan 의 적대 증거 선택 단계**가 막았어야 했다. `READY self-review` 에 "X 가 쓰인다 의 검사 장치가 X 를 지웠을 때 실패한다" 체크가 있었고 체크됐는데, **그 변이를 실제로 심어 보지 않은 채** 체크됐다. 설계 단계가 변이를 *등록* 만 하고 *성립성* 은 보지 않는다는 것이 이 축의 형태다(0207 이 같은 이유로 두 행을 내렸다).
- C-02 는 **§8 전수 조사의 술어 선택**이 막았어야 했다. 조사는 "정지를 단언하는 테스트" 를 셌고, 이번 변경이 뒤집는 것은 그것만이 아니었다 — **"이번 변경이 red 로 만들 기존 단언"** 이 술어여야 했다.
- **반복해서 부딪히는 환경 한계**: ① DOM 환경(`jsdom`·`happy-dom`) 부재 — 메뉴 `.map()` 최종 홉이 0212 P9 에 이어 또 미잠금이다. ② `npm ci` 직후 better-sqlite3 ABI 가 Electron 이라 DB 스위트 10파일이 red 로 시작한다.
- **현재 라운드 수**: **1**.


## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | (검증 턴에서 채운다) | | | | |

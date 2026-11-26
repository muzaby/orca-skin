# Plan — 0332-right-panel-global-depth

> 0330 기준 사용자 피드백 중 **우측 패널** 추가 요구 5건을 받는 후속 handoff다. transcript 항목은 [0331](../0331-transcript-feedback-followup/plan.md)이 받는다(0331 D-001).
> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0332-right-panel-global-depth` |
| 작성자 | Claude Code (V1) · Codex (ΔV1 추가 요구) |
| 일자 | 2026-11-26 |
| 매핑 | 0330 사용자 피드백(2026-11-26) · 형제 handoff 0331 |
| 상태 | DRAFT — 추가 모션 요구와 직전 계획 리뷰 보완을 합친 뒤 READY 재판정 |
| V mode | `Delta V` |
| 기준 V | 0332 V1 (`ea866261`) |
| 이번 V revision | `ΔV1` — 패널·본문 동시 재배치, 깊이 이동, 앱 공통 전환 |
| 유효 V | `V1 + ΔV1` |
| 기준 트리 | `18b5d5f`(0330 verify 3의 앱 코드) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 우측 패널이 세션마다 따로 열리고 닫히며, 세션을 옮길 때마다 다시 열리는 애니메이션이 재생된다. Work/Code 사이 폭이 튀고, 열기·닫기는 순간 전환이다. 타일을 여러 열·행으로 동시에 놓는 그리드는 쓰지 않는 복잡도다.
- 완료 후 달라지는 것: 패널은 좌측 nav처럼 앱 전역에서 열림·폭을 가진 하나의 프레임이다. 세션을 옮겨도 프레임은 그대로이고 내용만 바뀐다. 폭 차이와 열기·닫기는 부드럽게 전환된다. 패널은 한 화면씩 깊이(스택)로 이동한다.
- 성공을 사용자 관점에서 한 문장으로: 패널을 한 번 열어 두면 어느 세션에서도 같은 자리·같은 종류의 화면으로 남고, 들어가고 나오는 이동이 뒤로 가기 하나로 일관된다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “우측 패널을 좌측 nav처럼 전역 관리로 전환. 열림/닫힘 상태를 전역으로 관리하며 프레임을 세션에 귀속하지 말 것.” | 사용자 피드백 2026-11-26 |
| 명시 요구 | “유측 패널이 열린 상태로 세션 이동 시, 우측 패널이 다시 열리는 효과 제거.” | 같음 |
| 명시 요구 | “work/code 간 세션 이동 시, 기본 우측 패널의 사이즈가 다름. 트랜지션 효과로 사이즈 조정. 또한 우측 패널이 열기/닫기로 상태가 변할때 트랜지션 효과로 나타났다 사라지도록 변경할 것.” | 같음 |
| 추가 명시 요구 | “모든 gui 상태 변화는 트랜지션( smooth) 으로 렌더링 … 우측패널 on/off 시 우측패널이 나타나고 사라짐, 동시에 transcript 영역 재조정. 우측패널 depth 이동.” | 사용자 추가 피드백 2026-11-26. 스크롤바 이동은 0331 AC12 |
| 명시 요구 | “이제 우측 패널은 depth 이동이 기본으로 할 것. 기존의 4x4 지원은 폐기. 관련 코드도 모두 제거할 것” | 같음 |
| 명시 요구 | 질의 답 — depth: “스택 이동”(설명 “패널은 한 화면만 보인다. 다른 타일·상세·산출물을 열면 그 위로 한 단계 들어가고(push), 뒤로 가기로 직전 화면에 돌아온다. 닫기는 패널 전체를 닫는다.”) | 이번 턴 AskUserQuestion |
| 명시 요구 | 질의 답 — 세션 이동: “화면 종류 유지”(설명 “Work/Code별로 마지막에 본 화면 종류를 전역으로 기억해 새 세션의 같은 화면을 보인다. 지원하지 않는 종류면 그 모드의 기본 화면.”) · 질문 전제 “상세·산출물처럼 그 세션에만 있는 깊은 화면은 이동 시 닫힙니다” | 같음 |
| 추론 의도 | ‘4x4’ = 현재 여러 열 × 열당 2행 타일 그리드(`ROWS_PER_COL = 2`) — 질문 문구로 확인받음 | 질의 1 전제 |
| 추론 의도 | “좌측 nav처럼” = 좌측 nav의 `sidebarCollapsed`·`sidebarWidth`처럼 설정에 저장되어 앱 재시작 뒤에도 유지 — 추론 | `TweakProvider.tsx:20-21` · `protocol.ts:810-816` |
| 추론 의도 | 자동 이벤트(턴 시작·세션 열기의 기본 타일)는 전역 열림을 바꾸지 않는다 — 좌측 nav는 스스로 열리지 않는다 — 추론 | 질의 2 전제 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 패널 프레임(열림·폭)은 세션이 아니라 앱 전역 상태다. 좌측 nav처럼 설정에 저장한다 — `rightPanelOpen`·`rightPanelWidths { work, code }` | “좌측 nav처럼 전역 관리 … 프레임을 세션에 귀속하지 말 것” | 사용자 피드백 | ACTIVE | 세션별 `rightPanelTiles`·`rightPanelColWidths` 대체 |
| D-002 | 열린 채 세션을 옮기면 프레임 DOM은 그대로이고 진입 애니메이션이 재생되지 않는다. 내용만 새 세션으로 바뀐다 | “다시 열리는 효과 제거” | 사용자 피드백 | ACTIVE | — |
| D-003 | 폭은 Work/Code별 전역 값(기본 360px, 범위는 `sidePaneBounds`)이고, 폭이 다른 종류의 세션으로 옮기면 200ms 동안 폭이 전환된다. 열기는 0→폭, 닫기는 폭→0 전환이며 닫는 동안 내용은 남는다. 드래그 중·`prefers-reduced-motion`은 전환 없음 | “트랜지션 효과로 사이즈 조정 … 나타났다 사라지도록” · 수치 200ms는 기존 `transition-[flex-basis] duration-200`을 따른 설계자 기본값 | 사용자 피드백 | ACTIVE | — |
| D-004 | 정착한 패널은 한 화면만 보인다(스택). 다른 타일·상세·산출물·작업 상세를 열면 push, 뒤로(헤더 버튼·Escape)로 pop, 닫기는 패널 전체를 닫고 스택을 비운다. 이미 스택에 있는 타일을 열면 그 층까지 pop한다. 메뉴·토글에서 지금 맨 위 화면을 다시 고르면 닫는다 | 답 “스택 이동” | 질의 | ACTIVE | 0205~0215 타일 그리드 · OpenCode 상세 덮기 규칙(`rendering.md` “상세에는 추가 제목·뒤로 행 없이”) 대체 |
| D-005 | 여러 열·행 타일 그리드와 그 코드(열 구조 상태·열/행 폭·분할·리플로우 슬라이드·가로 스크롤·`columnMode`)를 모두 제거한다 | “기존의 4x4 지원은 폐기. 관련 코드도 모두 제거할 것” | 사용자 피드백 | ACTIVE | — |
| D-006 | Work/Code별 마지막 루트 화면 종류(타일 id)를 앱 실행 동안 전역 기억한다. 세션을 옮기면 새 세션 종류의 기억 화면으로 스택을 다시 세우고, 그 하네스·종류가 지원하지 않으면 기본 화면(`initialTile ?? taskTarget`)이다. 상세·산출물·작업 상세 층은 닫힌다 | 답 “화면 종류 유지” · 질문 전제 “깊은 화면은 이동 시 닫힙니다” | 질의 | ACTIVE | — |
| D-007 | 자동 진입: 턴 시작·세션 열기의 기본 타일 활성화는 열림을 바꾸지 않는다. 계획 검토 요청은 활성 세션이고 패널이 열려 있을 때만 `plan`을 push한다. 사용자 조작 진입(메뉴·카드·버튼)은 닫혀 있으면 연다 | “좌측 nav처럼” — 설계자 기본값 | 설계자 | ACTIVE | `chatReducer` `BEGIN_TURN`·`LOAD_SESSION`·`RECV_EVENT`의 `activateTile` 대체 |
| D-008 | 확대(expand)·초점 복귀·산출물 뷰어 기능은 유지한다 — 스택의 맨 위 화면에 적용된다 | 피드백 대상 아님 | 설계자 | ACTIVE | — |
| D-009 | 패널을 열고 닫거나 폭을 바꿀 때 transcript가 같은 프레임·같은 진행률로 남은 폭을 차지한다. 깊이 진입과 뒤로 가기는 패널 안에서 반대 방향으로 전환한다 | 사용자 추가 모션 요구 | 사용자 | ACTIVE | D-002~004 보완 |
| D-010 | 앱 전체의 가시 상태 전환에는 [디자인 시스템 §7](../../arch/frontend/design-system.md#앱-전체-gui-전환-원칙)을 적용한다. 조립 화면은 영역 간 타이밍, 공통 컴포넌트와 기능 컴포넌트는 각자 소유하는 상태의 전환을 담당한다 | 모든 GUI 상태 변화에 적용 | 사용자 | ACTIVE | 0331 AC12는 transcript 스크롤 담당 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-008.
- 변경된 결정(앞선 handoff): 타일 그리드(0205~0215) · OpenCode 상세 덮기 규칙 · 세션별 패널 상태 — 대체 근거는 각 행.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001↔AC1 · D-002↔AC2 · D-003↔AC4·AC5 · D-004↔AC6·AC8 · D-005↔AC7 · D-006↔AC3 · D-007↔AC9 · D-008↔AC10. ΔV1은 D-009↔AC11·AC12, D-010↔AC13 및 0331 AC12다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 재열림 효과의 원인 | 원인 3개 — 열이 세션별 무작위 id로 key되어 세션마다 remount(`animate-tile-in` 재생) · OpenCode 패널은 세션 key로 통째 remount · 열 상태 자체가 세션 상태 | `rightPanelLayout.ts:70`(`crypto.randomUUID`) · `TilePanel.tsx:186` `key={column.id}` · `RightPanel.tsx:29` · `RightPanelColumn.tsx:82` |
| Work/Code 폭이 왜 다른가 | 열 폭 기본은 둘 다 360px — Code는 여러 열(열마다 360+8px)이 동시에 열려 넓어지고 Work는 `task` 한 열이다. OpenCode 상세는 부모 열 폭 +8px | `chatReducer.ts:609` · `TilePanel.tsx:206` · `opencode/rightpanel/Panel.tsx:25,55` |
| 이미 스택이 있는가 | 일부 — 산출물 뷰어 → 상세 → 타일 층이 이미 덮기 순서다(`rendering.md`). 타일끼리는 그리드 | `TilePanel.tsx:213-258` |
| 전역 저장소 선례 | 좌측 nav = `Tweaks.sidebarCollapsed`·`sidebarWidth` → `settingsApi.set` → `SettingsSchema` | `TweakProvider.tsx:61-74` · `protocol.ts:810-816,877-878` |
| 더 작은 해법 | 세션별 상태를 지우지 않고 키만 고정하면 재열림은 사라지지만 D-001(전역)·D-005(코드 제거)를 못 지킨다 | — |
| 기존 결정 충돌 | 그리드·상세 덮기 규칙을 사용자 결정으로 대체(§16) | `rendering.md` 우측 패널 절 |

- 사용자에게 올릴 결정: 없음(이번 턴 질의로 닫음 — D-004·D-006).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[닫힘] ─메뉴·카드·토글→ [열림: 루트 화면] ─다른 타일·상세·산출물→ [push]
   ↑                          │ 뒤로/Escape → [pop]
   └──── 닫기(헤더) ──────────┘
세션 이동(열림): 프레임 유지 · 폭 전환(종류가 다르면) · 스택 = [새 종류의 기억 화면]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 닫힘 + 사용자 진입(타일 X) | open=true · 스택 [X] · 폭 0→W 전환 | 패널이 나타나는 동안 transcript 가용 폭이 함께 줄어든다 |
| 열림 + 다른 타일 Y 진입 | 스택 push Y | Y 화면으로 전진 전환 · 헤더에 뒤로 |
| 열림 + 스택에 있는 타일 진입 | 그 층까지 pop | 직전 방향의 역방향 전환으로 목적 화면에 복귀 |
| 열림 + 맨 위 화면을 메뉴·토글에서 다시 선택 | 닫기 | 폭 W→0 전환 후 사라짐 |
| 뒤로·Escape(깊이 > 1) | pop | 직전 화면(초점은 진입 원점 복귀) |
| 닫기 | open=false · 스택 비움 | 패널이 사라지는 동안 transcript가 함께 넓어진다 |
| 세션 이동(열림, 같은 종류) | 스택 = [기억 화면 또는 기본] · 프레임 유지 | 프레임은 제자리. 새 세션 내용만 부드럽게 등장 |
| 세션 이동(열림, 다른 종류) | 위 + 폭 W1→W2 전환 | 폭이 부드럽게 바뀜 |
| 세션 이동(닫힘) | 변화 없음 | 닫힌 채 |
| 폭 드래그 | 그 종류의 전역 폭 저장 · 전환 없음 | 손을 따라 폭 변경 |
| 앱 재시작 | 설정에서 open·폭 복원 · 스택 = 기본 화면 | 직전 열림 상태 |
| 턴 시작·세션 열기 기본 타일 | 열림 불변 | 변화 없음 |
| 계획 검토 요청(활성·열림) | push `plan` | 계획 화면 |

### 파생 UX / 엣지케이스

- empty: 열린 패널의 루트 타일에 내용이 없으면 그 타일의 기존 빈 상태를 보인다.
- cancel / close: 닫는 전환 중 다시 열면 현재 폭에서 열림 방향으로 이어간다.
- concurrency / multi-session: 비활성 세션의 이벤트는 프레임·스택을 바꾸지 않는다.
- keyboard / a11y: 뒤로 버튼 접근성 이름 ‘뒤로’ · Escape는 깊이 > 1에서 pop · 닫기 뒤 초점은 진입 원점 또는 transcript.
- theme / motion: `motion-reduce`에서 전환 0.
- 좁은 창: 폭은 `sidePaneBounds(host)`로 자른다(최소 320 · 최대 min(960, host−240)).

## 6. 범위 / 비범위

- **범위**: §2 명시 요구 5건 · 패널 진입점 전수 이주 · 관련 문서(`rendering.md`·`state.md`·`design-components.md`).
- **비범위**: 산출물 카탈로그 화면의 뷰어(`useArtifactCatalogViewer` — transcript 우측 패널이 아님) · 좌측 nav 자체 · 패널 내용 컴포넌트의 기능·데이터 변경. 이 범위 구분은 프레임 개편에 적용한다. AC13의 앱 전체 모션 점검에는 좌측 nav·카탈로그·패널 내부도 포함한다.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 루트 화면 종류의 재시작 뒤 유지 | 아니오 | 실행 동안만(D-006) |
| 설정 키 이름 | **예 — 저장 형식** | `rightPanelOpen`·`rightPanelWidths` 확정(§10 EP-1) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 세션 A에서 열고 B로 옮기면 열린 채, B에서 닫고 A로 가면 닫힌 채다. 설정 저장 → 재시작 뒤 같은 열림·폭 | 세션 전환 전후 열림 · `settingsApi.set` 호출 값 · 설정 스키마 기본·범위 | 진입 → 전역 store → `settingsApi` → `SettingsSchema` → 다음 부팅 load |
| R-02 | AT-02 / AC2 | 열린 채 같은 종류·다른 종류 세션으로 옮겨도 프레임 루트 DOM 노드가 같고, 프레임 자체의 재열림 0회(자식 내용의 전환은 허용) | DOM 노드 동일성 · 프레임 자신의 이벤트와 실제 폭·불투명도 | `ChatTile` → `RightPanelFrame` |
| R-03 | AT-03 / AC3 | Code에서 변경사항을 보다 다른 Code 세션으로 가면 변경사항, Work 세션으로 가면 Work 기억 화면(없으면 `task`), OpenCode에서 Claude 전용 화면이면 기본 화면. 상세·산출물·작업 상세 층은 닫힌다 | 세션 전환 뒤 스택 | 전역 store `switchSession` |
| R-04 | AT-04 / AC4 | Work 폭 360·Code 폭 520인 상태에서 종류가 다른 세션으로 옮기면 200ms 동안 폭이 전환된다 — 중간 프레임 폭이 두 값 사이. 같은 폭이면 전환 0. 드래그 중 전환 0. reduced motion 즉시 | Electron 실기 프레임별 계산 폭 | 실제 Chromium |
| R-05 | AT-05 / AC5 | 열기: 폭 0→W 전환(중간 프레임 존재), 닫기: W→0 전환 동안 내용 DOM 유지 후 제거. reduced motion 즉시 | Electron 실기 프레임별 폭·내용 존재 | 실제 Chromium |
| R-06 | AT-06 / AC6 | 안정 상태에 보이는 타일 1개 이하. 깊이 전환 중 입력·접근성 대상은 도착 층 하나(나가는 층은 퇴장 동안만 보일 수 있다). push·pop·이미 있는 타일 pop·맨 위 재선택 닫기·닫기(스택 비움)·Escape pop · 뒤로 버튼은 깊이 > 1에서만 · 산출물 열기는 닫힌 패널을 열고 맨 위에 뷰어 | 스택 상태 · 안정 상태의 가시 화면 수·전환 중 조작 대상 수·헤더 버튼 | 진입점 → 전역 store → `RightPanelFrame` |
| R-07 | AT-07 / AC7 | 그리드 코드 0 — 열/행 상태·핸들·슬라이드·가로 스크롤·`columnMode` 식별자가 production에 없다. 열/행 분할 핸들 DOM 0 | 음성 검색 0 + AC6 양성 | 저장소 소스 |
| R-08 | AT-08 / AC8 | 진입점 전수(타이틀 메뉴·Git 행 diff 토글·작업 상태·셸 백그라운드·서브에이전트 카드 4·OpenCode 요약 2·작업 목록 선택·산출물 카드·타일 닫기·OpenCode 상세 닫기)가 스택 규칙으로 동작 | 진입점마다 스택·열림 | 각 컴포넌트 → store |
| R-09 | AT-09 / AC9 | 턴 시작·세션 열기는 열림을 바꾸지 않는다. 계획 검토 요청은 활성·열림일 때만 `plan` push, 닫힘·비활성이면 변화 0 | 이벤트 전후 열림·스택 | `chatReducer` 이벤트 → store |
| R-R1 | AT-R1 / AC10 | 확대·복원·확대 중 닫기·초점 복귀·산출물 뷰어 복사/저장은 회귀 없다 | 기존 테스트 green(스택 맨 위 화면에 대해) | `ResizableSidePane` · `ArtifactViewer` |
| R-11 | AT-11 / AC11 | 열기·닫기·모드 폭 변경·도중 반전에서 패널과 transcript의 공통 경계가 매 프레임 함께 움직인다. 빈 띠·겹침·한 프레임 늦은 재배치 0회 | Electron `pairedWidth`. 같은 프레임에 두 DOMRect를 측정(§10-A) | ChatTile → 공통 프레임·transcript |
| R-12 | AT-12 / AC12 | 타일·상세·아티팩트의 push와 pop/pop-to가 서로 반대 방향으로 부드럽게 진행된다. 프레임은 유지되고 도착 화면만 조작할 수 있다 | Electron `depthMotion`. 중간 위치, 포커스·Escape, 빠른 뒤로, 세션 교체, 축소 모션 | 사용자 진입점 → 패널 스택 → 콘텐츠 층 |
| R-13 | AT-13 / AC13 | 앱 전체의 가시 상태 전환을 소유자별로 열거하고 공통·개별 구현에서 순간 교체되는 경로를 수정한다 | §10-A 적용표에서 경로별 동작과 실제 표시 증거를 대조. 열린 항목을 둔 채 앱 전체 적용 완료로 판정하지 않는다 | 페이지·셸 → 공통 UI 또는 기능 컴포넌트 |

### AC 검증 주의사항

- 기존 테스트 재사용: 그리드를 단언하는 테스트 17파일(§8 전수)은 삭제하거나 스택 기대로 고친다. `TilePanel.detail.test.ts`·`Panel.lifecycle.test.ts`·`Panel.interaction.test.ts`의 초점·지각 응답 단언은 유지 대상이다.
- 사람 실기 항목: 없음. AC4·AC5·AC11·AC12는 전환이라 jsdom이 아니라 Electron 실기 스크립트로 잰다(바이너리 없으면 exit 3).
- 0건 기준: AC7 음성 검색은 AC6의 양성 스택 동작과 짝짓는다 — 식별자만 지우고 기능이 죽은 경우를 AC6이 잡는다.

## 7-A. V / Trace Matrix

- V1은 Baseline V다. ΔV1은 R-11~13·AT-11~13과 VP-17~19를 추가하고 기존 프레임·스택 검증(VP-02·05·06·10)을 확장한다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-09 · AT-01~AT-09 | R/AT | §7 | NEW | — |
| R-R1 · AT-R1 | R/AT | 확대·초점·뷰어 | INHERITED | `rendering.md` 우측 패널 절 · `TilePanel.detail.test.ts`·`ArtifactViewer.actions.test.ts` |
| R-11~R-13 · AT-11~AT-13 | R/AT | 동시 재배치 · 깊이 전환 · 앱 공통 전환 적용 | NEW (ΔV1) | §7 · §10-A |
| SD-01 | SD | 프레임 수명: 닫힘 → 열림(전환) → push/pop → 세션 이동(유지·폭 전환) → 닫힘(전환) → 재시작 복원 | NEW | §5 |
| AR-01 | AR | 설정 저장 경계: `SettingsSchema` ↔ data host 설정 저장 ↔ 창 전역 store | NEW | §10 EP-1 |
| AR-02 | AR | 진입점 ↔ 전역 store ↔ 프레임 | NEW | §10 EP-2·EP-3 |
| MD-01 | MD | 스택 리듀서(push·pop·pop-to·toggle·reset·switch) | NEW | §10 EP-4 |
| MD-02 | MD | 프레임 전환 상태(닫힘·여는 중·열림·닫는 중 · 폭 목표) | NEW | §10 EP-5 |
| MD-03 | MD | 그리드 제거 | NEW | §10 EP-6 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 진입 → store → settings | 신규 `rightPanelStore.test.ts` `AC1 open state survives session switches`(A 열기→B 열림 · B 닫기→A 닫힘) · `shared/theme/TweakProvider.store.test.ts` 신규 케이스 `AC1 persists rightPanelOpen and widths` · `main/infra/settings-store.test.ts` 신규 케이스 `AC1 settings defaults and bounds`(누락 → false·360 · 범위 밖 → 기본) | required — store가 세션 키별로 값을 다시 갖게 한 변이(A/B 교차 입력 red) | EP-1(6) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `ChatTile` → 프레임 | 신규 `RightPanelFrame.render.test.ts` `AC2 keeps the frame node across session switches`(같은 종류·다른 종류 · Claude↔OpenCode) · `gate:xvfb-run -a node scripts/check-right-panel.mjs` `switch`(프레임 재열림 0, 자식 이벤트 제외) | required — 프레임에 `key={sessionKey}`를 다시 단 변이 | EP-3(4) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `switchSession` | `rightPanelStore.test.ts` `AC3 restores the remembered screen per kind` — 입력: Code diff→Code · Code diff→Work(기억 있음/없음) · OpenCode에서 미지원 화면 · 상세·뷰어·작업 상세 층 닫힘 | not selected — 분기마다 입력 | EP-4(7) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | Chromium | `gate:… check-right-panel.mjs` `kindWidth`(360↔520 중간 폭 존재 · 같은 폭 전환 0 · 드래그 중 0 · reduced motion 0) | required — 전환 클래스 제거 변이 | EP-5(4) · EP-7 |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | Chromium | 같은 스크립트 `openClose`(열기 중간 폭 · 닫기 중 내용 유지 → 끝나면 제거) | required — 닫는 중 상태 없이 즉시 unmount 변이 | EP-5(4) · EP-7 |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 진입 → store → 프레임 | `rightPanelStore.test.ts` `AC6 stack rules` — push · pop · pop-to · 맨 위 재선택 닫기 · 닫기 비움 · 깊이 1 Escape 무동작 · 산출물 열기 · 신규 `RightPanelFrame.render.test.ts` `AC6 renders one screen and a back button only when deeper` | not selected | EP-4(7) · EP-8 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | 소스 | `gate:rg` 음성(§10 EP-6 명령 → 0) + VP-06 양성 | required — 음성 장치 민감도: 식별자 1개를 남긴 상태에서 명령이 1을 내는지 | EP-6(16파일) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | 진입점 → store | 진입점마다 신규/고친 렌더 테스트 1개(§10 EP-2 자리별 좌표 열) | not selected | EP-2(17) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | reducer → store | `chatStore.panelTiles.test.ts` 고침 `AC9 automatic events do not open the panel`(`BEGIN_TURN`·`LOAD_SESSION` · 계획 검토: 활성·열림 → push / 닫힘 → 0 / 비활성 → 0) | not selected | EP-3(4) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | 프레임 수명 전체 | `gate:… check-right-panel.mjs` `lifecycle`(열기 → push 2 → 뒤로 → 다른 종류 세션 → 닫기 → 재시작 흉내 복원) · VP-17·18의 전환 도중 입력 | not selected | EP-1·EP-4·EP-5·EP-7·EP-8 |
| VP-11 | AR-01 ↔ IT-01 | REQUIRED | 창 → settings 채널 → data 설정 저장 | `main/infra/settings-store.test.ts` 신규 케이스 `AC1 round-trips right panel settings`(쓰기 → 읽기 → zod) | not selected | EP-1 |
| VP-12 | AR-02 ↔ IT-02 | REQUIRED | 진입점 → store → 프레임 | VP-08 좌표 + `RightPanelFrame.render.test.ts` `AC8 store push renders the screen` | not selected | EP-2 |
| VP-13 | MD-01 ↔ UT-01 | REQUIRED | 스택 리듀서 | VP-03·VP-06 좌표(순수 리듀서 `rightPanelStack.ts`) | required — pop-to 분기 제거 변이(중복 push 입력 red) | EP-4 |
| VP-14 | MD-02 ↔ UT-02 | REQUIRED | 전환 상태 | 신규 `rightPanelFrameState.test.ts` — 닫힘→여는 중→열림→닫는 중→닫힘 · 닫는 중 재열림 · reduced motion 즉시 · 드래그 중 전환 끔 | not selected | EP-5 |
| VP-15 | MD-03 ↔ UT-03 | REQUIRED | 소스 | VP-07 | — | EP-6 |
| VP-16 | R-R1 ↔ AT-R1 | REGRESSION | 확대·뷰어 | `TilePanel.detail.test.ts`(초점 복귀 단언 유지 · 파일명 바뀌면 이관) · `ArtifactViewer.actions.test.ts` · `ResizableSidePane` 테스트 green | not selected | 0 — 내용 컴포넌트 비변경 |
| VP-17 | R-11 ↔ AT-11 | REQUIRED | ChatTile → 패널 경계와 transcript | `pairedWidth`의 실제 경계 좌표와 읽던 글줄·하단 고정 | transcript 폭만 마지막에 바꾸면 중간 프레임 실패 | EP-7 |
| VP-18 | R-12 ↔ AT-12 | REQUIRED | 스택 → 패널 콘텐츠 전환 | `depthMotion`에서 정방향·역방향·빠른 역전·축소 모션 | 즉시 교체로 되돌리면 중간 위치 표본 누락으로 실패 | EP-8 |
| VP-19 | R-13 ↔ AT-13 | REQUIRED | 각 화면 진입 → 공통 또는 기능 소유 뷰 | 앱 경로·전환별 소유자 및 관측 결과(§10-A). 공용 구현은 실기와 소비 화면 연결 증거를 재사용 | 공통 구현을 우회하는 화면은 해당 경로의 독립 증거 필요 | EP-9 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/**` 변경 | `app/AGENTS.md` 로컬 확인 목록 전부 | 이번 변경 유발 실패 |
| Electron 실기 | AC2·AC4·AC5·AC11·AC12·ST-01 | `xvfb-run -a node scripts/check-right-panel.mjs`(신규 — 0 통과·1 실패·3 바이너리 없음) | exit 1만 blocking |
| 문서 인벤토리 | 설정 키 2개 추가 | `node scripts/check-doc-inventory.mjs --check`(재생성) | 재생성 누락 |
| repository | handoff 산출물 | INDEX 행·trailer 파싱 | 현재 변경만 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 패널 상태는 세션 상태(`ChatState`)다 — 열 구조·이름표·열 폭·행 분할 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:392-399,565-568` |
| 열은 세션마다 `crypto.randomUUID()` id로 만들고 그 id로 key된다 | `lib/rightPanelLayout.ts:70` · `TilePanel.tsx:186` |
| 타일 래퍼는 mount마다 `animate-tile-in`을 재생한다 | `RightPanelColumn.tsx:82` · `styles/app.css:195-199` |
| OpenCode 패널은 세션 key로 통째 remount(`resetBySession: true`) | `components/rightpanel/RightPanel.tsx:29` · `harnesses/registries/rightpanel.ts:25` |
| 열 폭 기본 360 · 상세 폭 = 부모 열 + 8 · 측면 창 범위 320~min(960, host−240) | `chatReducer.ts:609` · `opencode/rightpanel/Panel.tsx:25,55` · `shared/hooks/sidePaneResize.ts:6-13` |
| 층 순서: 산출물 뷰어 → 상세 → 타일(가려진 층 mounted·hidden·inert) | `TilePanel.tsx:213-258` · `docs/arch/frontend/rendering.md` 우측 패널 절 |
| Work 작업 상세는 세션 상태 `selectedTask` + 내부 뒤로(`selectTask(null)`) | `TaskPanelContent.tsx:34,99` · `TaskProgressList.tsx:118` |
| 좌측 nav 전역 저장: `Tweaks` → `settingsApi.set` → `SettingsSchema` | `shared/theme/TweakProvider.tsx:14-74` · `shared/protocol.ts:810-816,877-878` |
| 자동 타일 활성화 9곳 | `chatReducer.ts` `BEGIN_TURN:1040` · `RECV_EVENT:1427` · `LOAD_SESSION:1825` · `TOGGLE:2056` · `SET_ACTIVE:2061` · `SELECT_DIFF_REQUIREMENT:2151` · `OPEN_TASK:2312` · `OPEN_SUBAGENT_TASK:2323` · `OPEN_PROCESS_TOOL:2339` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 그리드 식별자(production) | §10 EP-6 명령 | 101줄 · 16파일 | 제거 대상 |
| 그리드 식별자(테스트) | 같은 패턴 `--glob '*.test.*' -l` | 17파일 | 삭제 또는 스택 기대로 수정 |
| 패널 진입 호출 | `rg -n "chatActions\.(toggleRightPanelTile\|setRightPanelTileActive\|removeRightPanelTile\|openSubagentTask\|openProcessTool\|openTask\|selectTask\|closePanelDetail\|setRightPanelColWidth\|setRightPanelRowSplit)\(" app/src/renderer/src --glob '!*.test.*'` | 18 | 진입 15 · 폭 3(EP-2) |
| 산출물 뷰어 열기 | `rg -n "openArtifactViewer\(" app/src/renderer/src --glob '!*.test.*'` | 3 | 선언 1 · transcript 카드 1 · 카탈로그 1(비범위) |
| 재열림 원인 | `rg -n "animate-tile-in\|resetBySession\|key=\{column.id\}" app/src/renderer/src --glob '!*.test.*'` | 9 | EP-3 ①② (주석 1줄 포함) |
| `activateTile` | `rg -n "activateTile\(" …/chatReducer.ts` | 10 | 호출 9 · 선언 1 |

### 수치 / 전칭 표현 검산

- 진입 18 = 진입 15(`ChatTitleBar:224`·`GitRow:151`·`PendingAssistantStatus:21`·`ForegroundShellActions:80`·`opencode/tiles.tsx:129,211`·`opencode/ToolCard:69`·`AgentTaskBody:48`·`AgentTaskRow:91`·`SubagentNoticeRow:57`·`TaskProgressList:118`·`TaskPanelContent:34,99`·`RightPanelTile:52`·`opencode/Panel:49`) + 폭 3(`opencode/Panel:57`·`PanelResizeSeparators:66,92`).
- 문서 앵커: `rendering.md` “공통 호스트의 표시 우선순위는 artifact 뷰어 → 상세 → 기존 타일” 문장 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01 · AR-01 · AR-02.
- 진입 → `chatReducer`(세션 `rightPanelTiles` 열 구조) → `RightPanel`(OpenCode는 세션 key remount) → `TilePanel`(열마다 `RightPanelColumn` · 열/행 핸들 · 가로 스크롤) + 상세·뷰어 덮기.
- 세션 이동 = 다른 세션 상태 → 다른 열 id → remount → `animate-tile-in`.

```text
chatActions.* → chatReducer(session.rightPanelTiles) → RightPanel[key?] → TilePanel → RightPanelColumn × N(행 ≤ 2)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임: 전역 프레임 상태(열림·종류별 폭)는 `Tweaks`(설정 저장), 스택·기억 화면은 chat feature의 전역 store `rightPanelStore`(세션 상태 밖), 화면 렌더는 `RightPanelFrame`(세션 key 없음) → 정착하면 맨 위 층만 보이고 아래 층은 mounted·hidden·inert(기존 덮기 규칙 일반화).

```text
진입점 → rightPanelStore.navigate/back/close(활성 세션만) ─┐
Tweaks.rightPanelOpen·rightPanelWidths ←──── 열기/닫기/폭 ─┤
ChatTile → RightPanelFrame(key 없음 · 폭 전환) → 스택 맨 위 화면(타일 / OpenCode 상세 / 작업 상세 / 산출물 뷰어)
세션 활성 키 변경 → rightPanelStore.switchSession(kind, backend) → 스택 = [기억 화면 ∨ 기본]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 상태 소유 | 세션 `ChatState` | 전역 `Tweaks`(열림·폭) + `rightPanelStore`(스택·기억) | D-001·D-006 | AR-01·MD-01 / VP-01·VP-03 |
| 배치 | 열 × 행 그리드 | 한 화면 스택 | D-004·D-005 | MD-01·MD-03 / VP-06·VP-07 |
| 세션 이동 | remount + 진입 애니메이션 | 프레임 유지 · 스택 재설정 | D-002·D-006 | SD-01 / VP-02·VP-03 |
| 폭 | 열마다 세션 값 | 종류별 전역 값 · 전환 | D-003 | MD-02 / VP-04 |
| 열기·닫기 | 즉시 | 폭 전환 · 닫는 중 내용 유지 | D-003 | MD-02 / VP-05 |
| 상세 닫기 | 타일 닫기 override | 뒤로 = pop · 닫기 = 패널 | D-004 | MD-01 / VP-06 |
| 자동 활성화 | 9곳 `activateTile` | 사용자 진입만 열기 · 계획 검토 조건부 push | D-007 | AR-02 / VP-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/protocol.ts`·`shared/ipc.ts` | 설정 키 스키마 | zod | main 설정 저장·renderer |
| `renderer/src/shared/theme/TweakProvider.tsx` | `rightPanelOpen`·`rightPanelWidths` 로드·저장 | `settingsApi` | ChatTile·프레임 |
| `features/chat/lib/rightPanelStack.ts`(신규, 순수) | 스택 리듀서 | (스택, 동작) → 스택 | store |
| `features/chat/store/rightPanelStore.ts`(신규) | 스택·기억 화면·활성 세션 적용 | 동작 → 상태 | 진입점·프레임 |
| `features/chat/lib/rightPanelFrameState.ts`(신규, 순수) | 전환 상태 | (상태, 이벤트) → 상태 | 프레임 |
| `features/chat/harnesses/common/rightpanel/RightPanelFrame.tsx`(신규 — `TilePanel` 대체) | 폭 전환·층 렌더·헤더 뒤로/닫기 | store·Tweaks | `RightPanel` |
| `features/chat/reducer/chatReducer.ts` | 패널 상태 제거 · 자동 활성화 → 효과 반환 없음(진입은 store로) | — | — |

## 10. 계약 / 타입 / 강제 지점

자리 줄 번호는 기준 트리 `18b5d5f`, 검색은 `app/`에서 실행한다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 · 제외 줄(사유) | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-01·VP-11 · **EP-1** | `rightPanelOpen: boolean`(기본 false) · `rightPanelWidths: { work: int, code: int }`(320~960, 기본 360) | `shared/protocol.ts` `SettingsSchema` | data·창 | 6자리 — ① `protocol.ts` `SettingsSchema`(`:810` 곁) ② `protocol.ts` 부분 쓰기 스키마(`:877` 곁) ③ `shared/ipc.ts` `Settings` 형(`:1163` 곁) ④ `TweakProvider.tsx` `Tweaks`·`DEFAULTS`(`:14-44`) ⑤ `TweakProvider.tsx` load 투영(`:96-108`) ⑥ 프레임의 쓰기(`setTweak` — 열기/닫기·드래그 끝) | `rg -n "sidebarCollapsed\|sidebarWidth" src/shared src/renderer/src/shared/theme src/main --glob '!*.test.*'` → 12줄(키 2개 × 위치 ①~⑤의 형제 자리 — 새 키가 같은 위치에 생긴다) · ⑥은 신규 호출 · 제외: `app/Header.tsx`·`app/Sidebar.tsx`(좌측 nav 소비처) | 세션마다 열림이 다르거나 재시작 뒤 잃는다 |
| AR-02 / VP-08·VP-12 · **EP-2** | 사용자 진입은 store `navigate(screen, origin)`·`back()`·`close()`로만 패널을 바꾼다 | `rightPanelStore.ts` | 창 | 17자리 — 진입 15(§8 검산 목록, 자리별 좌표: `ChatTitleBar.render.test.ts` · `GitRow` 렌더 · `PendingAssistantStatus` · `ForegroundShellActions` · `opencode/tiles` 2 · `opencode/ToolCard` · `AgentTaskBody` · `AgentTaskRow` · `SubagentNoticeRow` · `TaskProgressList` · `TaskPanelContent` 2 · `RightPanelTile` 닫기 · `opencode/Panel` 상세 닫기) + 산출물 `ArtifactCards.tsx:115` + 폭 쓰기 1(프레임 드래그 — `opencode/Panel:57`·`PanelResizeSeparators:66,92`를 대체) | §8 진입 검색 → 18 + `openArtifactViewer\(` → 3 · 제외: `artifactViewerStore.ts:109`(선언) · `useArtifactCatalogViewer.tsx:43`(카탈로그 — 비범위) · `PanelResizeSeparators:92`(행 분할 — 삭제, EP-6) | 진입점이 열지 못하거나 그리드식으로 덧붙인다 |
| SD-01·R-09 / VP-02·VP-09 · **EP-3** | 프레임은 세션 key로 remount되지 않고 진입 애니메이션이 없다 · 자동 이벤트는 열림 불변 | `RightPanelFrame.tsx` · `chatReducer.ts` | 창 | 4자리 — ① `RightPanel.tsx:29` 세션 key 제거(`resetBySession` 계약 삭제 `contracts.ts:170`·`registries/rightpanel.ts:15,25`) ② `animate-tile-in` 사용처 제거(`RightPanelColumn.tsx:82` 삭제 · `app.css:195-199` 사용처 0이면 삭제) ③ 자동 활성화 3(`BEGIN_TURN:1040`·`LOAD_SESSION:1825` 제거 · `RECV_EVENT:1427` 조건부 push) ④ 사용자 활성화 6(`TOGGLE`·`SET_ACTIVE`·`SELECT_DIFF_REQUIREMENT`·`OPEN_TASK`·`OPEN_SUBAGENT_TASK`·`OPEN_PROCESS_TOOL`)의 `activateTile`을 store `navigate`로 | `rg -n "animate-tile-in\|resetBySession\|key=\{column.id\}\|activateTile\(" src/renderer/src --glob '!*.test.*'` → 19 · 운반 17 · 제외 2: `activateTile` 선언(`:2481` — 삭제) · `RightPanelColumn.tsx:70`(주석) | 세션 이동마다 다시 열리거나 자동 이벤트가 패널을 연다 |
| MD-01 / VP-03·VP-06·VP-13 · **EP-4** | 스택: `navigate(X)` = 닫힘이면 [X]로 열기 · 맨 위 = X면 닫기(토글 진입만) · 스택에 X면 그 층까지 pop · 아니면 push / `back` = 깊이 > 1이면 pop / `close` = 비움 / `switchSession(kind, backend)` = [기억(kind) 지원 ∨ 기본] · 루트가 바뀔 때 기억(kind) 갱신 | `rightPanelStack.ts` | 창 | 7자리 — ① `navigate` 열기 분기 ② 토글 닫기 분기 ③ pop-to 분기 ④ push 분기 ⑤ `back` ⑥ `close` ⑦ `switchSession`(기억 화면 · 지원 검사 `isRightPanelTileVisible` · 기본 `initialTile ?? taskTarget`) | 신규 파일 — `rg -n "case '\|function " src/renderer/src/features/chat/lib/rightPanelStack.ts`로 구현자가 자리-분기 대응표를 `[구현자 기입]`에 고정 | push·pop 규칙이 갈려 뒤로가 엉뚱한 화면으로 간다 |
| MD-02 / VP-04·VP-05·VP-14 · **EP-5** | 전환: 상태 `closed`·`opening`·`open`·`closing` · 폭 목표(종류별) · `transition-[width,opacity] duration-200 motion-reduce:transition-none` · 드래그 중 전환 끔 · `closing` 동안 내용 유지 → `transitionend`(또는 200ms 타이머 안전망)에서 `closed` | `rightPanelFrameState.ts` | 창 | 4자리 — ① 열기 이벤트 ② 닫기 이벤트(내용 유지) ③ 종류·폭 목표 변경 ④ 드래그 시작/끝 | 신규 파일 — 같은 방식으로 `[구현자 기입]`에 고정 | 순간 전환이거나 닫는 동안 내용이 사라진다 |
| MD-03 / VP-07·VP-15 · **EP-6** | 그리드 코드 0 | — | 창 | 16파일 101줄(§8) — `rightPanelLayout.ts`(파일 삭제) · `useColumnSlideOnReflow.ts`(삭제) · `rightPanelViewport.ts`(삭제) · `RightPanelColumn.tsx`(삭제) · `PanelResizeSeparators.tsx`(삭제) · `chatReducer.ts`(상태·동작·`PANEL_DEFAULT_ROW_SPLIT`) · `chatStore.ts`·`RightPanel.tsx`·`ApprovalCard.tsx`·`opencode/rightpanel/Panel.tsx`·`ChatTitleBar.tsx`·`GitRow.tsx`·`opencode/rightPanel.ts`·`claude/rightPanel.ts`·`rightPanelTiles.ts`(`columnMode`)·`TilePanel.tsx`(→ `RightPanelFrame`) | `rg -n "ROWS_PER_COL\|rightPanelColWidths\|rightPanelRowSplits\|addTileColumnMajor\|removeTileFromColumns\|deriveRightPanelLayout\|RightPanelColumns\b\|RightPanelColumnState\|columnMode\|ColumnResizeSeparator\|RowSeparator\|useColumnSlideOnReflow\|adjustPanelViewport\|SET_RIGHT_PANEL_COL_WIDTH\|SET_RIGHT_PANEL_ROW_SPLIT\|PANEL_DEFAULT_ROW_SPLIT\|setRightPanelColWidth\|setRightPanelRowSplit\|flattenColumns\|columnsContain\|rightPanelColumnsForAgent\|RightPanelHandle\|standard-grid\|task-focus" src --glob '!*.test.*' --glob '!*.testfixture.*'` → 완료 조건 0 | 쓰지 않는 그리드가 남아 다음 변경이 그 위에 쌓인다 |

- 자리 목록은 위 검색 출력과 차집합 0이어야 한다(`site_census.mjs`). EP-4·EP-5는 신규 파일이라 구현자가 구현 직후 분기 대응표를 고정하고 검증자는 그 표로 센다 — 규칙 칸의 분기 수(EP-4 7 · EP-5 4)와 같아야 한다.
- **선언 경계**: 프레임 개편에서 제외한 산출물 카탈로그 뷰어·패널 내부 기능(앱 공통 모션은 EP-9) · 기억 화면의 재시작 뒤 유지(D-006 실행 동안만) · Electron 바이너리 없는 환경의 AC2(실기 부분)·AC4·AC5·AC11·AC12(exit 3, 미판정).
- 열린 입력 집합: 해당 없음. EP-6 음성 검색은 제거 식별자의 닫힌 목록이다.
- 같은 규칙 여러 레이어: 지원 화면 판정은 기존 `isRightPanelTileVisible` 하나(store·메뉴 공용).
- 선택적 필드: 설정 키 누락 → 기본값(false·360) · 범위 밖 → 기본값(`catch`) — 좌측 nav와 같은 손상 복구.

## 10-A. 패널과 앱 전체의 가시 전환 (ΔV1)

**EP-7 · 함께 움직이는 경계.** `ChatTile`의 두 형제 영역은 한 레이아웃을 공유한다. `RightPanelFrame`의 외부 폭만 보간하고 transcript는 매 프레임 남은 폭으로 배치한다. 창 가장자리, 고정 간격, 분리자 폭을 제외한 가용 폭이 두 영역의 합이다. 패널 표면만 transform으로 밀어 두고 본문 폭을 나중에 바꾸면 실패다. 200ms 전환 중 반대 입력이 오면 현재 폭에서 역전한다. 세션 이동 때 계속 열린 프레임에는 열기 모션을 반복하지 않는다.

`pairedWidth`는 고정 창에서 시작·중간·끝에 두 영역의 실제 경계를 같은 프레임에서 기록한다. 고정 간격을 뺀 경계 차이는 1 CSS px 이내이며, 한쪽이 움직이면 다른 쪽도 같은 프레임에 자리를 내주거나 채워야 한다. 펼친 긴 본문에서 줄바꿈을 포함해 하단을 보던 사용자는 하단, 위를 읽던 사용자는 같은 본문 글줄을 유지한다. 정상·빠른 반전·축소 모션을 각각 검사한다.

**EP-8 · 깊이와 세션 이동.** `rightPanelStore`는 push·pop·pop-to·세션 교체의 의미를 결정하고, 공통 프레임 안의 콘텐츠 층이 이동을 그린다. 앞으로 가면 새 층이 오른쪽에서 들어오고 뒤로 가면 반대로 돌아간다. 같은 타일 재요청은 해당 스택 규칙을 따른다. 전환 중 이전 층은 `inert`와 접근성 숨김을 적용하고 도착 층이 입력을 받는다. 이전·도착 층의 빠른 교대, 포커스 복귀, 중단된 전환의 늦은 종료 이벤트를 검사한다. 세션 교체는 이전 세션 내용을 폐기하고 새 내용만 등장시키며 닫혀 있던 패널을 열지 않는다.

**EP-9 · 앱 전체 적용 책임.** 셸·페이지 전환과 두 영역 사이 레이아웃은 해당 조립 화면이, 토글·메뉴·모달·탭·알림 등은 `shared/ui`가, 채팅·설정 등 고유한 뷰는 해당 feature가 소유한다. 구현 첫 단계에 `app/src/renderer/src/{app,pages,features,shared/ui}`와 앱의 각 renderer 진입점을 따라 기존·신규 화면의 보이는 상태 전이를 목록화한다. 각 행에 사용자 조작/비동기 사건, 전후 화면, 공통 위임 위치 또는 자체 구현, 일반·축소 모션 결과를 기록한다. 공통 컴포넌트로 수렴하는 행은 실기 결과를 공유하며 개별 구현은 해당 화면에서 확인한다. 지연 없이 이어져야 하는 입력·스트리밍은 전환 재시작이나 입력 유실이 없는지도 확인한다.

구현·실측 증거는 0331의 세션 열기·스크롤(AC12), 0332의 프레임·깊이(AC11·12), 다른 화면의 담당 컴포넌트(AC13)로 연결한다. 기존 0324의 renderer 한 작업 50ms 예산을 적용하고, 긴 transcript로 패널 조작과 스크롤 도중 장기 작업을 기록한다. 전체 적용 판정에는 화면별 근거가 필요하다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/protocol.ts`·`app/src/shared/ipc.ts` | 설정 키 | EP-1 ①②③ | zod 단위 |
| `app/src/renderer/src/shared/theme/TweakProvider.tsx` | 전역 열림·폭 | EP-1 ④⑤ | Provider 단위 |
| `…/features/chat/lib/rightPanelStack.ts`(신규) | 스택 리듀서 | EP-4 | 순수 단위 |
| `…/features/chat/store/rightPanelStore.ts`(신규) | 스택·기억·활성 세션 | zustand · `ChatTile`이 활성 키 변경 때 `switchSession` | store 단위 |
| `…/features/chat/lib/rightPanelFrameState.ts`(신규) | 전환 상태 | EP-5 | 순수 단위 |
| `…/harnesses/common/rightpanel/RightPanelFrame.tsx`(신규) | 프레임 | `TilePanel` 층 렌더 규칙 승계(정착 시 맨 위만 표시, 퇴장 중에는 §10-A EP-8 적용) · 헤더 뒤로/닫기 · `ResizableSidePane` 폭 | 렌더 단위 + Electron |
| `…/harnesses/common/rightpanel/{TilePanel,RightPanelColumn,PanelResizeSeparators}.tsx` · `lib/{rightPanelLayout,rightPanelViewport}.ts` · `hooks/useColumnSlideOnReflow.ts` | 그리드 | 삭제(+테스트) | EP-6 |
| `…/harnesses/opencode/rightpanel/Panel.tsx`·`navigation.ts` | OpenCode 상세 | 지역 reducer → store 층(`detail`) | 기존 lifecycle·interaction 테스트 이관 |
| `…/harnesses/common/rightpanel/{RightPanelTile,TaskPanelContent,TaskProgressList}.tsx` | 닫기·작업 상세 | 닫기 = `close` · 작업 상세 = 층(`taskDetail`) push/pop | 렌더 단위 |
| `…/reducer/chatReducer.ts`·`store/chatStore.ts` | 패널 상태 제거 | EP-3 ③④ · EP-6 | reducer 단위 |
| `…/components/{ChatTitleBar,ApprovalCard,composer/GitRow,rightpanel/RightPanel,ChatTile}.tsx` | 진입·표시 | EP-2 · 메뉴 = 화면 선택(맨 위 표시) | 렌더 단위 |
| `app/scripts/check-right-panel.mjs`(+`.test.mjs` 순수 판정부) | 실기 | `switch`·`kindWidth`·`openClose`·`lifecycle`·`pairedWidth`·`depthMotion` · 기존 `check-transcript-selection.mjs`의 `resolveElectron`·`runElectron` 재사용 | Electron |
| `docs/arch/frontend/{rendering,state,design-components}.md` | 문서 | 그리드 서술 삭제 · 스택·전역 프레임 서술 · 카탈로그 행 갱신 | 인벤토리 가드 |

### 테스트 가능성

- 순수 seam: `rightPanelStack.ts`·`rightPanelFrameState.ts`(React·DOM 없음).
- 기존 메커니즘 재사용: 층 표시 규칙은 `TilePanel.tsx:213-258`의 hidden·inert 패턴을 그대로 일반화한다 — 대상(작업 상세)도 같은 형상.
- 순서 관측: Electron 스크립트가 rAF마다 프레임 계산 폭·애니메이션 이벤트를 기록한다.

## 12. End-to-end 영향

```text
진입점 → rightPanelStore(스택) ┐
Tweaks(열림·폭) ──────────────┼→ RightPanelFrame → 맨 위 화면 컴포넌트(기존 타일 registry)
활성 세션 변경 → switchSession ┘
```

- producer 기준: 열림·폭은 `Tweaks`, 스택은 store가 정한다. 프레임은 둘을 읽기만 한다.
- consumer 파생 규칙: ‘계획 열림’(`ApprovalCard`)·‘diff 열림’(`GitRow`) = 열림 ∧ 맨 위 화면 = 그 타일.
- 합성값 우회: 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `TweakProvider` load 투영 | 키 2개 증가 — 로드 실패 시 기본값(닫힘) | AC1 |
| 설정 쓰기 핸들러(data host) | 부분 쓰기 스키마에 키 추가 | AC1·VP-11 |
| `docs/generated/inventory.md` 설정 키 수 | 재생성 | gate |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 load 전 기본 닫힘 → load 뒤 저장값.
- 취소/중단: 닫는 전환 중 열기 → `opening`으로 전환(현재 폭에서).
- 종료: 창 unmount → 전환 타이머·드래그 정리(`ResizableSidePane` 기존 정리 유지).
- retry/partial: 설정 저장 실패 → `setTweak` 기존 롤백 + 보고(좌측 nav와 같다).
- **다중 저장소 쓰기**: 열림·폭은 설정 파일 하나 · 스택은 메모리 — 원자성 문제 없음. 문서 사본: `plan.md` + `INDEX.md`.

## 14. 성능 / 상한 / 최적화

- 새 요청: 열기/닫기·드래그 끝마다 설정 쓰기 1(드래그 중 0).
- 렌더: 동시에 그리는 타일이 최대 N열×2행 → 정착 시 1화면. 깊이 전환 동안은 나가는 층과 도착 층만 그린다.
- 잃는 부수 효과: 여러 타일 동시 보기 — 사용자 결정(D-005).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음(배포 포트 비변경). 하네스 registry 계약 `resetBySession` 필드 삭제는 내부 계약(`contracts.ts`).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 열 구조 SSOT·column-major 채우기 | `rightPanelLayout.ts` 헤더 주석 · 0205~0215 | D-005 · EP-6 | 변경(삭제) |
| 상세는 추가 제목·뒤로 없이 기존 헤더 · 닫기 override가 상세만 닫음 | `rendering.md` 우측 패널 절 | D-004 · AC6 | 변경 — 뒤로 = pop, 닫기 = 패널 |
| 층 순서 뷰어 → 상세 → 타일 · 가려진 층 mounted·hidden·inert | `rendering.md` | §9 TO-BE | 유지(일반화) |
| 정지·메뉴 비노출 축(`SUSPENDED_RIGHT_PANEL_TILES`) | `rightPanelTiles.ts:52-80` | 메뉴 화면 선택 | 유지 |
| 확대는 가장 가까운 pane 전체를 덮음 | `rendering.md` · `ResizableSidePane` | D-008 · VP-16 | 유지 |
| 좌측 nav 저장 방식 | `TweakProvider` | D-001 | 유지(선례 적용) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 그리드 삭제로 테스트 17파일이 바뀌어 회귀를 놓친다 | 초점·지각 응답·확대 단언은 이관 대상으로 표시(VP-16) — 삭제는 그리드 단언만 |
| 자동 열기 제거로 Work 첫 진입에서 작업 패널이 보이지 않는다 | D-007 사용자 기본값 · 사용자가 한 번 열면 전역 유지 |
| `transitionend`가 오지 않는 경우(reduced motion·숨김) | 일반 모션은 200ms 타이머를 안전망으로 사용한다. 축소 모션에서는 같은 commit에서 종료한다(EP-5 ②) |

- 되돌리기 어려운 결정: 설정 키 `rightPanelOpen`·`rightPanelWidths`(저장 형식 — §6).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/**`(§11) · `app/src/renderer/src/shared/theme/TweakProvider.tsx` · `app/src/shared/{protocol,ipc}.ts` · `app/scripts/check-right-panel.mjs`(신규) · `app/src/renderer/src/styles/app.css`
- `docs/arch/frontend/{rendering,state,design-components}.md` · `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` · `app/src/renderer/AGENTS.md`(디자인 시스템·카탈로그 갱신 의무).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: VP 좌표 + 필터 없는 vitest.
- IMPL_DONE 전: `app/AGENTS.md` 로컬 확인 목록 전부 + `xvfb-run -a node scripts/check-right-panel.mjs`.
- 사람 실기: 없음.

## V1 READY self-review (ΔV1 종합 판정 대기)

- [x] Decision Ledger가 질의 답 2건·피드백 4건·설계자 기본값(D-007·D-008)을 보존한다.
- [x] Part I만으로 완료 상태가 보인다.
- [x] 조건절을 재해석하지 않았다 — “관련 코드도 모두 제거” → EP-6 완료 조건 0, “닫기는 패널 전체” → EP-4 ⑥.
- [x] 사용자 결정(질의)과 조사 사실을 갈랐다.
- [x] 수치·앵커 실측 — §8 검산(진입 18 = 15 + 3).
- [x] 후보 표 겹침: 0327 행 `usePanelSelection.ts:60`(다른 패널 선택 범위 해제)은 패널 선택이라 스택 층 닫힘(EP-4 ⑦)과 겹친다 — 그 형태가 실제 결함으로 보이면 승격, 이번엔 경계.
- [x] 각 AC 행동 단언·검증·경로.
- [x] Baseline V · NEW node마다 REQUIRED · 회귀 1 REGRESSION.
- [x] pair 좌표·§10 · 적대 증거는 방향 확인 필요 pair만.
- [x] 규칙 칸 분기 ↔ 입력: EP-4 7분기 → VP-03·VP-06 입력 · EP-5 4분기 → VP-14 입력.
- [x] 선언 경계 · 열린 입력 해당 없음.
- [x] 운영 gate 열거.
- [x] 사람 실기 0 · 전환은 Electron.
- [x] structural proxy 단독 AC 없음 — AC7 음성은 AC6 양성과 짝.
- [x] 배타 상태: 전환 상태 union 4값 · 스택 층 union(`tile`·`detail`·`taskDetail`·`artifact`).
- [x] 신규 계약 SSOT·강제·seam.
- [x] 부팅/등록 소비처 — §12.
- [x] one-way door — 설정 키(§6·§17).
- [x] 게이트 명령 충돌 없음.
- [x] ACTIVE ↔ AC 대조 — §3.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> EP-4·EP-5는 신규 파일이라 구현 직후 **분기 ↔ 자리 대응표**를 `강제 지점 전수`에 고정한다(규칙 칸 분기 수와 같아야 한다).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|

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
| **관측한 게이트 산출** | … |
| **추가·수정 테스트의 subtree 규칙** | … |
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

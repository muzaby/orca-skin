# Plan — 0034-multi-right-panels

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 작업은 **기능 구현(우측 멀티 보조 패널)** 이므로 구현 주체 = **Codex**. Claude 는 본 `plan.md` 설계만, 구현 후 `verify.md` 로 검증한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0034-multi-right-panels` |
| 작성자 | Claude Code |
| 일자 | 2026-06-21 |
| 매핑 | PHASES 행 (검증 PASS 시 승격) / PR (push 후) |
| 상태 | DRAFT → READY |

## Context (왜)

현재 렌더러는 우측 보조 패널을 **1개("계획" 타일)** 만 띄운다 — `ChatTile.tsx` 의 `planTileOpen` 단일 도킹(`ChatTile.tsx:99-123`)과 `ChatState.planTileOpen`/`planTileWidth` 단일 필드(`chatReducer.ts`). 진입점은 `ChatTitleBar` 의 `panelR` 토글 버튼 하나다(`ChatTitleBar.tsx:60-68`).

사용자는 이를 **최대 4개**까지 *2열 × 2행* 그리드로 확장하길 원한다 — `계획` · `서브 에이전트 출력` · `예약(reserved)` · `예약(reserved)`. 활성화 순서대로 슬라이드 효과로 등장하고, 케밥 메뉴로 활성/비활성·이름변경·삭제할 수 있어야 한다. 모든 패널 경계는 기존 planTile 분리선과 동일한 핸들바로 리사이즈 가능해야 한다.

**의도한 결과**: 단일 계획 타일을 *제네릭 n-패널 레일* 로 일반화한다. 패널 종류·개수를 하드코딩하지 않고 레지스트리로 구동해, 향후 패널 추가가 "레지스트리 1행 추가" 로 끝나게 한다. 이번 범위는 **프레임워크 + 기존 계획 패널 이관 + 나머지 3종 스텁(빈 상태)** 이며, 서브에이전트/예약 데이터 배선과 IPC 는 후속 핸드오프로 분리한다(본 작업 IPC 변경 0).

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조한다. 번호 순.

**#1 제네릭 상태 모델 (개수·종류 하드코딩 0)**
1. (1-a) `ChatState` 의 `planTileOpen`/`planTileWidth` 단일 필드가 멀티 패널 모델로 대체된다: 활성 패널 순서 목록(`rightPanels: RightPanelId[]`) + 라벨 오버라이드(`rightPanelLabels`) + 열별 폭(`rightPanelColWidths: number[]`) + 열 내 행 분할 비율(`rightPanelRowSplits` — 열당 0~1). `planContent` 는 유지.
2. (1-b) `RightPanelId` 는 `'plan' | 'subagent' | …` 형태로 **컴포넌트/리듀서에 하드코딩되지 않는다** — 패널 종류의 단일 출처는 `panelRegistry` 이고, 레일·케밥·리듀서는 *활성 목록* 과 *파생 레이아웃* 으로만 동작한다(레지스트리에 항목 1개를 추가해도 레일/리듀서/케밥 코드는 무수정).
3. (1-c) 제품 상한(한 열 2행)은 단일 상수 `ROWS_PER_COL = 2` 로만 표현하고, 열 수는 `Math.ceil(active.length / ROWS_PER_COL)` 로 파생한다(상한 4 를 다른 곳에 박지 않는다).
4. (1-d) 신규 리듀서 액션 6종: `TOGGLE_RIGHT_PANEL(id)` · `SET_RIGHT_PANEL_ACTIVE(id, active)` · `RENAME_RIGHT_PANEL(id, label)` · `REMOVE_RIGHT_PANEL(id)` · `SET_RIGHT_PANEL_COL_WIDTH(col, width)` · `SET_RIGHT_PANEL_ROW_SPLIT(col, frac)`. 폭은 clamp `PANEL_MIN_WIDTH/PANEL_MAX_WIDTH`(기존 `PLAN_TILE_MIN/MAX_WIDTH = 280/640` 일반화), 분할은 `[0.2, 0.8]` 등으로 clamp.

**#2 계획 패널 이관 (회귀 0)**
5. (2-a) `permission.requested`/`plan_review` 도착 시 기존처럼 `계획` 패널을 **자동 활성화**(활성 목록에 추가)하고 `planContent` 를 세팅한다(현 `chatReducer.ts:264-271` 동작 보존).
6. (2-b) `계획` 패널 본문은 기존 `PlanTile` 내용(마크다운 / "아직 플랜이 없습니다" 빈 상태 / 복사 버튼)을 그대로 렌더한다.

**#3 열-우선 그리드 채움 (파생)**
7. (3-a) 활성 패널은 **활성화 순서대로 열-우선(column-major)** 으로 채워진다: 1개→1열 전체높이, 2개→1열 2행, 3개→2열(1열 2행·2열 1행 전체높이), 4개→2열 2행. 이 배치는 *활성 개수에서 파생* 되며 DOM 구조/`data-*` 마커로 검증 가능하다.
8. (3-b) 그리드 템플릿은 동적 계산값이므로 인라인 `style`(grid-template) 로, 정적 클래스는 Tailwind 로 표현한다(스타일 규약 준수).

**#4 슬라이드 애니메이션**
9. (4-a) 새 **열**의 첫 패널(1·3번째) 은 `slide-in-right`(우측→좌측, opacity 동반)로, 열 내 **2번째 행**(2·4번째) 은 `slide-in-up`(아래→위)로 진입한다.
10. (4-b) 키프레임/유틸은 `styles/app.css` 에 `@keyframes` + `@utility` 로 추가(기존 `epitaxy-shine` 패턴 동형). 진입 시 1회만 실행되고 무관한 reflow(다른 패널 토글·리사이즈)에 재생성되지 않는다. `@media (prefers-reduced-motion: reduce)` 에서 애니메이션을 끈다.

**#5 케밥 메뉴 2종**
11. (5-a) `ChatTitleBar` 의 `panelR` 토글 버튼이 **케밥 버튼**으로 교체되고, `Popover`(`align='end'`) 메뉴를 연다 — **그룹1**: 활성 패널 토글 목록(레지스트리에서 파생, 활성 항목 체크 표시), **구분선**, **그룹2**: `이름 변경` · `삭제`.
12. (5-b) 각 패널 헤더 **최우측 케밥**(원 요청)은 그 패널에 대한 `비활성화(닫기)` · `이름 변경` · `삭제` 를 제공한다.
13. (5-c) `이름 변경` = 라벨 오버라이드(`rightPanelLabels`), `삭제` = 활성 목록에서 제거(고정 4종이라 정의 파괴가 아닌 비활성화와 동의어). 두 동작이 케밥 목록과 레일에 즉시 반영된다.

**#6 스텁 패널**
14. (6-a) `서브 에이전트` · `예약(reserved) 1` · `예약(reserved) 2` 는 `PlanTile` 빈-상태와 동형의 empty-state 컴포넌트를 렌더한다(데이터 배선 없음 — 후속 핸드오프).

**#7 리사이즈 핸들바 (모든 경계, planTile 동일 구도·스타일)**
15. (7-a) 경계마다 핸들바를 둔다: **외곽**(transcript↔레일, 세로) · **열 사이**(세로, n열 일반화) · **열 내 행 사이**(가로). 핸들 집합은 활성 배치에서 파생 렌더(1열2행=가로1, 2열1행=세로1, 2열2행=세로1+가로2).
16. (7-b) 핸들 마크업·스타일은 기존 planTile 분리선(`ChatTile.tsx:101-114` — `app-frame-tile-separator group/sep` + 중앙 `bg-border-strong` 캡슐 span, hover/active opacity 토글)을 **그대로 재사용**한다. 가로 핸들은 같은 마크업을 90°(캡슐 `h-1 w-10`, `cursor-row-resize`, `data-axis="horizontal"`).
17. (7-c) 드래그 메커니즘은 `useDragResize` 재사용. 단 현 훅은 x축(`clientX`) 전용이므로 **y축(행 분할) 지원을 추가**하거나(예: `axis?: 'x'|'y'` 옵션) 동등한 y축 핸들러를 둔다. 폭 clamp 280–640 유지.

**#8 경계·테스트·게이트**
18. (8-a) 신규 파일은 모두 `features/chat/**` 하위 — 레이어 경계 위반 0(`npm run lint` boundaries green).
19. (8-b) reducer 신규 액션 단위 테스트 + 레이아웃 파생(개수→열/행·경계 목록) 순수 함수 테스트 + plan_review 자동활성 회귀 테스트. 게이트 4종 green.

## 범위 / 비범위

- **범위**: 위 #1~#8. `features/chat` 렌더러 한정 — 멀티 패널 레일·그리드·애니메이션·케밥 2종·리사이즈 핸들 3축·reducer/store 액션·스텁 패널 3종·계획 패널 이관.
- **비범위**:
  - 서브에이전트 출력 / 예약 패널의 **실데이터 배선·IPC·main 변경** (후속 핸드오프). 이번엔 빈 상태 스텁만.
  - 패널 활성 집합의 **세션 간/디스크 영속** — 기존 `planTileOpen` 과 동일하게 `ChatState`(세션 메모리) 범위 유지. 영속이 필요하면 별도 작업.
  - 키보드 단축키·드래그 재배치(reorder)·패널 분리(detach) 등 고급 상호작용.

## 설계

### 제네릭 원칙
- `panelRegistry: { id: RightPanelId; defaultLabel: string; Content: React.ComponentType }[]` 가 **패널 종류의 단일 출처**. 케밥 토글 목록·레일 콘텐츠 매핑·기본 라벨이 전부 여기서 파생.
- 레이아웃은 순수 함수로 분리(`lib/rightPanelLayout.ts` 예): `activeIds → { columns: RightPanelId[][], handles: HandleDescriptor[] }`. `ROWS_PER_COL = 2` 만 상수, 열 수는 파생. 이 함수가 그리드 템플릿과 핸들 목록을 동시에 산출 → 컴포넌트는 map 만.

### 상태 모델 (`features/chat/reducer/chatReducer.ts`)
- 제거: `planTileOpen`, `planTileWidth`, `PLAN_TILE_MIN/MAX_WIDTH`(→ `PANEL_MIN/MAX_WIDTH` 일반화). 유지: `planContent`.
- 추가: `rightPanels: RightPanelId[]`(활성 순서) · `rightPanelLabels: Record<RightPanelId, string>` · `rightPanelColWidths: number[]`(열 인덱스) · `rightPanelRowSplits: number[]`(열 인덱스 → 상단 행 비율, 기본 0.5). `initialChatState` 는 빈 활성 목록.
- `chatStore.ts` 의 `chatActions` 갱신: 기존 `togglePlanTile/openPlanTile/closePlanTile/setPlanTileWidth` → `toggleRightPanel(id)`·`setRightPanelActive(id,on)`·`renameRightPanel(id,label)`·`removeRightPanel(id)`·`setRightPanelColWidth(col,w)`·`setRightPanelRowSplit(col,f)`. `plan_review` 자동활성 경로는 reducer 내부에서 활성 목록에 `'plan'` 추가하도록 수정.

### 컴포넌트 (`features/chat/components/rightpanel/` 신규)
- `RightPanelRail.tsx` — 그리드 컨테이너. 활성 목록·폭·분할 구독, `rightPanelLayout` 으로 열/행/핸들 파생, 분리선(`useDragResize`)·진입 애니메이션 호스팅. `ChatTile.tsx:99-123` 의 단일 도킹을 `<RightPanelRail/>` 로 교체.
- `RightPanel.tsx` — 범용 패널 크롬(헤더 = 라벨 + 최우측 케밥, 본문 슬롯, `app-frame-tile`/`effect-primary-elevated`/`rounded-r6` 등 기존 타일 스타일 재사용).
- `panelRegistry.ts` — id→{defaultLabel, Content} 매핑.
- 콘텐츠: `PlanPanel`(기존 `PlanTile` 본문 추출 — 헤더는 `RightPanel` 로 흡수), `SubAgentPanel`, `ReservedPanel`(예약1/2 공용 스텁).
- `lib/rightPanelLayout.ts` — 순수 레이아웃·핸들 파생(단위 테스트 대상).

### 케밥 (`shared/ui/Popover.tsx` 재사용)
- `ChatTitleBar.tsx`: `panelR` `Button` → 케밥 아이콘 `Button` + `Popover(align='end')`. 메뉴 행은 `panelRegistry` map(토글) + 구분선 + 이름변경/삭제.
- `RightPanel` 헤더 케밥: 동일 `Popover`, 항목은 그 패널 대상.

### 재사용
- `useDragResize`(`shared/hooks/useDragResize.ts`) — 외곽/열 핸들 그대로, 행 핸들은 y축 확장.
- `Popover`(`shared/ui/Popover.tsx`, `align='end'`), `Button`/`Icon`/`CopyIconButton`(`shared/ui/`), `Markdown`(`features/chat/components/markdown/Markdown`).
- 애니메이션 패턴: `styles/app.css` 의 `@keyframes epitaxy-shine` + `@utility` 동형.
- 레이어 경계: 신규는 모두 `features/chat/**` 하위 → 하향 의존 유지(상위참조 0).

## 영향 받는 파일

- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` — 상태 필드·액션·clamp 일반화 (+ `chatReducer.test.ts` 신규/확장)
- `app/src/renderer/src/features/chat/store/chatStore.ts` — `chatActions` 교체 + `plan_review` 자동활성 경로
- `app/src/renderer/src/features/chat/components/ChatTile.tsx` — 단일 도킹 → `<RightPanelRail/>`
- `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx` — `panelR` 버튼 → 케밥 + Popover
- `app/src/renderer/src/features/chat/components/PlanTile.tsx` — 본문을 `rightpanel/PlanPanel` 로 추출
- 신규: `app/src/renderer/src/features/chat/components/rightpanel/{RightPanelRail,RightPanel,panelRegistry,PlanPanel,SubAgentPanel,ReservedPanel}.tsx`
- 신규: `app/src/renderer/src/features/chat/lib/rightPanelLayout.ts` (+ 단위 테스트)
- `app/src/renderer/src/shared/hooks/useDragResize.ts` — y축(행) 지원 추가
- `app/src/renderer/src/styles/app.css` — `slide-in-right`/`slide-in-up` 키프레임·유틸
- UI 라벨은 기존 관례대로 **인라인 한국어 문자열**(i18n 미도입). **IPC/`IPC_CONTRACT.md` 변경 0.**

## 참고 문서

- `docs/arch/frontend/dom-architecture.md` — `app-frame-*` 마커·`data-axis`/`data-context`·Tile 구조 (핸들/패널 마크업 규약)
- `docs/arch/frontend/state.md` — Zustand chat store + reducer 슬라이스 경계
- `app/AGENTS.md` "스타일링"/"단일 파일 분해 가이드" — 동적 style 한정·group 스코프 격리·신규 파일 위치
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불필요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test` (better-sqlite3 Node ABI 재빌드 후 전체 green — 0019 패턴).
- 신규 테스트: reducer 액션(토글/순서 유지/이름변경/삭제/열폭·행분할 clamp) · `rightPanelLayout` 파생(개수 1~4 → 열/행/핸들 목록, 제네릭 — 5개 가정 입력도 열 수 파생 확인) · `plan_review` 자동활성 회귀.

## 미정 (사용자 결정 가능 — 보수적 기본값으로 진행)

- `삭제` 의 정확한 의미: 고정 4종 레지스트리에선 `삭제` == `비활성화`(레일에서 제거, 라벨 오버라이드도 초기화) 로 진행. 사용자 정의 패널 추가가 생기면 재검토.
- 새 열의 좌/우 도킹 방향(새 열이 우측 끝에 붙고 기존 열이 좌측 시프트)·정확한 폭/높이 기본값은 시각 검증으로 확정.

## 사용자 입장 확인 사항 (수동 GUI 검증 — 사람 책임, verify §책임 분리)

`npm run dev` 로 확인:
1. 케밥에서 패널을 1→2→3→4개 순차 활성화 시 열-우선 채움·슬라이드 방향(새 열=우→좌, 2번째 행=아래→위)이 의도대로인지.
2. 모든 경계 핸들바가 planTile 분리선과 동일한 모양·hover 거동으로 리사이즈되는지(외곽/열간 세로, 행간 가로).
3. 패널별 케밥과 타이틀바 케밥의 활성/비활성·이름변경·삭제가 일관되게 반영되는지.
4. `계획` 패널: plan_review 자동 오픈·마크다운/빈 상태·복사 회귀 없음.
5. `prefers-reduced-motion` 환경에서 애니메이션이 꺼지는지.

---

## [Codex 기입] 구현 체크리스트

- [ ] reducer 상태 모델 일반화 + 액션 6종 + clamp + plan_review 자동활성
- [ ] chatStore `chatActions` 교체
- [ ] `lib/rightPanelLayout.ts` 순수 파생 + 테스트
- [ ] `rightpanel/` 컴포넌트 6종(Rail/Panel/registry/Plan/SubAgent/Reserved)
- [ ] ChatTile 도킹 교체
- [ ] ChatTitleBar 케밥 + Popover
- [ ] useDragResize y축 지원
- [ ] app.css slide 키프레임·유틸 + reduced-motion
- [ ] reducer/layout 단위 테스트
- [ ] 게이트 4종 통과

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

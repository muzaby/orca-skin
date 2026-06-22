# Plan — 0036-ui-polish-batch

## 메타

| 항목 | 값 |
|---|---|
| slug | `0036-ui-polish-batch` |
| 작성자 | Claude Code |
| 일자 | 2026-06-22 |
| 매핑 | PHASES 후속(UI 보정) / PR (push 후) |
| 상태 | READY → IMPL_DONE (비기능 = Claude 직접 구현) |

## Context (왜)

검증 엔지니어용 Electron 앱 Orca 의 UI 에 누적된 자잘한 버그·미구현 7건을 일괄 보정한다.
버그 수정은 비기능 작업이므로 협업 규약(`docs/handoff/AGENTS.md`)상 **Claude 가 핸드오프 문서를 만들고
직접 구현까지 수행**한다(plan → impl → verify 순차). IPC/DB 변경은 없고 모두 렌더러 표현 계층 문제다.
7건 중 3건(1·2·7)이 공용 floating UI 컴포넌트 `shared/ui/Popover.tsx` 에 모인다.

## 인수 기준 (Acceptance Criteria)

1. **케밥 메뉴 너비 일치**: 프로젝트 케밥 등 모든 Popover 메뉴의 팝오버 패널 너비가 콘텐츠 너비와 일치해, 마우스 호버 영역이 메뉴 너비와 정확히 일치한다(빈 우측 영역 없음).
2. **위쪽 공간 부족 시 아래로 flip**: 컴포저 컨트롤 메뉴(기본 `placement='top'`)가 앵커 위 공간이 부족하면 렌더 영역을 벗어나지 않도록 아래 방향으로 자동 전환된다. 공간이 충분하면 기존대로 위로 연다. 모든 컨트롤 메뉴에 적용.
3. **자동화 nav 비활성화**: 사이드바 nav 의 '자동화' 항목이 클릭 비활성(navigate 안 함)이며 빗금(사선) 배경으로 "준비 중"을 표시한다(확장·접힘 양쪽).
4. **'플러그인 탐색' 제거**: Skills & MCP 랜딩(`CustomizeLanding`)에서 '플러그인 탐색' 카드가 제거되어 카드가 2개(MCP 연결·새 스킬 만들기)다.
5. **툴카드 본문 border**: transcript 에서 툴카드 그룹을 펼친 본문, 그리고 단일 툴카드를 펼친 본문 모두에 border 가 표시된다(그룹 내 개별 카드 본문 border 와 일관).
6. **타이틀바 부제 제거**: `app-frame-titlebar`(ChatTitleBar) 제목 아래의 adapter(backendLabel·green dot)·session id 부제가 제거된다.
7. **도넛 패널 우측 정렬**: 컴포저 컨텍스트 사용량 도넛 패널 팝오버가 컴포저 우측 라인(도넛 버튼 우측)에 정렬된다.

## 범위 / 비범위

- **범위**: 위 7건의 렌더러 UI 보정 + 공용 `Popover` 의 width/flip 동작 개선.
- **비범위**: IPC/DB/어댑터 변경, 자동화(`/routines`) 화면 실제 구현, 케밥 메뉴 동작 배선(시각만).

## 설계

### 1·2·7 — `shared/ui/Popover.tsx`
- **너비(1)**: 패널 className 의 기본 `min-w-[240px]` 제거 → 패널이 콘텐츠 너비를 그대로 따른다(flex-col 자식 stretch 로 호버=패널 보장). 기존에 이 기본 min-w 에 의존하던 두 메뉴(`ChatTitleBar` 타일·`SkillDetail` 케밥)에는 `className="min-w-[200px]"` 명시.
- **flip(2)**: 패널을 `open` 동안 항상 마운트하되 위치 확정 전엔 `visibility:hidden` 으로 측정 가능 상태 유지(기존엔 `pos` 미확정 시 `return null` 이라 높이 측정 불가). `useLayoutEffect` 에서 `panelRef.offsetHeight` 측정 → 요청 placement 의 가용 공간(`rect.top`/`innerHeight-rect.bottom`)과 비교, `panelH + GAP + EDGE_MARGIN` 초과면 반대 방향으로 flip. 측정→재배치는 layout effect 1패스(paint 전)로 수렴, setState 루프/플리커 없음.
- **정렬(7)**: 기존 `align` prop 재사용 — 컴포저 telemetry Popover 에 `align="end"` 부여.

### 3 — `app/Sidebar.tsx`
- `NavItem` 에 `disabled?: boolean` 추가, '자동화'에 `disabled: true`. 렌더 분기에서 `onClick` no-op + `disabled`/`aria-disabled` + hover/active 제거 + `cursor-not-allowed`. 빗금은 신규 CSS 없이 토큰 기반 Tailwind arbitrary 배경 상수 `NAV_DISABLED_HATCH`(`repeating-linear-gradient(45deg, …, var(--color-border) …)`)로 확장·접힘 공통 적용.

### 4·5·6 — 단순 제거/속성 추가
- 4: `CustomizeLanding` 세 번째 `ActionCard` 삭제 + 미사용 `onBrowsePlugins` prop 정리(호출부 `SkillsCustomizeView` 포함).
- 5: `ToolGroup` 그룹 컨테이너에 `border border-t5` 추가; `ToolCard` standalone(`!inGroup`) 분기에 border 추가(`bg-bg` 유지).
- 6: `ChatTitleBar` 부제 `<div>` 삭제 + 미사용 `backendLabel` prop·`Dot` import·`sessionId` selector 제거. 호출부 `ChatTile` 의 `<ChatTitleBar backendLabel=…>` → `<ChatTitleBar/>` (단 `backendLabel` 은 Composer 가 계속 사용 → ChatTile prop 자체는 유지).

### 재사용 / 경계
- `Popover` 의 `align`/`placement` prop 은 이미 존재 — 7은 신규 API 불필요.
- 스타일은 Tailwind 시맨틱 토큰(`border-t5`=`--color-border`·`text-t5`·`bg-bg`)만, 신규 CSS 파일 0(AGENTS 규약).
- 모든 변경이 `shared/ui` 또는 각 `features/<X>`·`app/` 내부 → 레이어 경계 위반 0.

## 영향 받는 파일

- `app/src/renderer/src/shared/ui/Popover.tsx` (1·2)
- `app/src/renderer/src/features/chat/components/ChatTitleBar.tsx` (1·6)
- `app/src/renderer/src/features/chat/components/ChatTile.tsx` (6)
- `app/src/renderer/src/features/skills/components/customize/SkillDetail.tsx` (1)
- `app/src/renderer/src/features/chat/components/Composer.tsx` (7)
- `app/src/renderer/src/app/Sidebar.tsx` (3)
- `app/src/renderer/src/features/skills/components/customize/CustomizeLanding.tsx` + `SkillsCustomizeView.tsx` (4)
- `app/src/renderer/src/features/chat/components/transcript/ToolGroup.tsx` + `ToolCard.tsx` (5)

## 참고 문서

- `docs/arch/frontend/dom-architecture.md` (`app-frame-*` 마커·floating UI)
- `app/AGENTS.md` §스타일링(시맨틱 토큰·신규 CSS 금지)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무관.

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: 없음(순수 표현 계층·시각 검증으로 갈음). Popover flip 은 jsdom 레이아웃 측정 한계로 단위테스트 부적합 → 사람 시각 검증.

---

## [구현 보고] (Claude 직접 구현)

| 항목 | 내용 |
|---|---|
| 변경 파일 | Popover.tsx · ChatTitleBar.tsx · ChatTile.tsx · SkillDetail.tsx · Composer.tsx · Sidebar.tsx · CustomizeLanding.tsx · SkillsCustomizeView.tsx · ToolGroup.tsx · ToolCard.tsx (렌더러 10파일) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅(node+web+test) / test ✅ 416 passed — 실패 11건은 `db/queries.test.ts` better-sqlite3 ABI 환경 제한(0019 계열, 변경 무관: stash 후에도 동일 실패 확인) |
| 인수 기준 | 1~7 전부 코드 반영(시각 검증은 사람) |
| 블로커 / 역질문 | 없음 |

## [사람 확인 대기]

- UI 시각 검증(`npm run dev`): ①케밥 호버=메뉴 폭 일치 ②컴포저 메뉴 상단 근처에서 아래로 flip ③자동화 빗금+클릭 무반응 ④랜딩 카드 2개 ⑤툴카드 그룹/단일 펼침 본문 border ⑥타이틀바 부제 사라짐 ⑦도넛 패널 우측 정렬.
- PR 머지 승인.

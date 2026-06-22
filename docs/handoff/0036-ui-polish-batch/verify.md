# Verify — 0036-ui-polish-batch

## 메타

| 항목 | 값 |
|---|---|
| slug | `0036-ui-polish-batch` |
| 검증자 | Claude Code |
| 일자 | 2026-06-22 |
| 대상 커밋 | `cd246c2`(7건) + `5fcb839`(추가 8·9) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> plan 의 인수 기준 1~9 를 코드와 1:1 대조. 증거는 `파일:라인` + diff.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 케밥 메뉴 너비=콘텐츠 너비(빈 우측 영역 없음) | ✅ | `shared/ui/Popover.tsx` 패널 className 에서 기본 `min-w-[240px]` 제거(`app-frame-floating fixed z-50 rounded-lg …`). 기존 의존 2곳에 명시 보강: `ChatTitleBar.tsx:83` `className="min-w-[200px]"`, `SkillDetail.tsx:117` `className="min-w-[200px]"`. 잔여 Popover 소비자는 자체 너비(`Header` `min-w-[160px]`·`SessionRow` `w-[140px]`) 보유 또는 콘텐츠폭 의도. |
| 2 | 위쪽 공간 부족 시 아래로 flip(컨트롤 메뉴) | ✅ | `Popover.tsx:42-66` 측정 기반: `panelRef.offsetHeight` 읽어 `placement==='top' && panelH+GAP+EDGE_MARGIN > spaceAbove` → `resolved='bottom'`(역방향도 대칭). 패널을 open 동안 항상 마운트하되 `pos` 미확정 시 `visibility:hidden`(top/left 0)으로 측정 가능(`Popover.tsx:88-108`, 기존 `return null` 제거). 컴포저 컨트롤 메뉴 다수가 `placement="top"`. |
| 3 | '자동화' nav 비활성+빗금(확장·접힘) | ✅ | `app/Sidebar.tsx` `NavItem.disabled?` 추가→'자동화' `disabled:true`. 두 렌더 분기 모두 `onClick={it.disabled ? undefined : …}`·`disabled`·`aria-disabled`·`cursor-not-allowed`·`text-t5`·`NAV_DISABLED_HATCH`(시맨틱 토큰 `repeating-linear-gradient`) 적용(`Sidebar.tsx:100-110`,`147-160`). |
| 4 | '플러그인 탐색' 카드 제거(랜딩 카드 2개) | ✅ | `CustomizeLanding.tsx` 세 번째 `ActionCard`(board/플러그인 탐색) 삭제 + `onBrowsePlugins` prop 제거, 호출부 `SkillsCustomizeView.tsx:65` `onBrowsePlugins` 인자 제거. 남은 카드 = MCP 연결·새 스킬 만들기 2개. |
| 5 | 툴카드 그룹/단일 펼침 본문 border | ✅ | `ToolGroup.tsx:65` 그룹 컨테이너에 `border border-t5` 추가. `ToolCard.tsx:134` 본문 className 을 `border border-t5` 무조건 적용 + `inGroup ? '' : 'bg-bg'`(단일은 bg 유지). |
| 6 | 타이틀바 adapter/session id 부제 제거 | ✅ | `ChatTitleBar.tsx` 부제 `<div>`(Dot+backendLabel·sessionId slice) 삭제 + `backendLabel` prop·`Dot` import·`sessionId` selector 제거. 호출부 `ChatTile.tsx:49` `<ChatTitleBar />`(backendLabel 미전달, ChatTile prop 자체는 Composer 용으로 유지). |
| 7 | 도넛(telemetry) 패널 우측 정렬 | ✅ | `Composer.tsx:495` telemetry `<Popover … align="end">` 부여(`align` 기존 prop 재사용). |
| 8 | 컨트롤 팝오버 zone 정렬(우측 zone `align="end"`) | ✅ | `Composer.tsx:525`(effort)·`539`(model)·`495`(telemetry) `align="end"`. 좌측 zone(mode `505`·attach `514`)은 기본 `align="start"` 유지. |
| 9 | `+` 메뉴 '현재 프레임' 제거 + Skill→`/` 자동완성 단일 경로 | ✅ | `AttachMenu.tsx` '현재 프레임' `<button>`(cam) 삭제(첨부·Skill 2항목). `Composer.tsx:163-178` 신규 `openSkillPicker`: attach 닫고 입력란에 `/`(끝이 공백/개행 아니면 ` /`) 삽입→`useSkillAutocomplete` 가 직접 `/` 입력과 동일하게 open. `SkillsMenu` Popover·`menuOpen`/`closeMenu`/`insertSkillFromMenu`·import 제거 + `composer/SkillsMenu.tsx` 파일 삭제(타 사용처 0). |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck(node+web+test) ✅ / test **427/427**(Node ABI 재빌드 후 green) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 1~9 전부 충족(위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | eslint(boundaries 포함) 0 위반. 변경은 `shared/ui`·`features/<chat,skills>`·`app/` 내부 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 한국어·표 형식 유지 |
| AGENTS.md 위생 스캔 | ✅ | ✅ | AGENTS.md 무변경 — N/A |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(7+8·9건) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0(package.json/lock 무변경) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm install            # postinstall: electron-builder install-app-deps (better-sqlite3 Electron ABI)
$ npm run lint                     # ✅ 무출력(--fix 변경 0)
$ npm run typecheck                # ✅ typecheck:node / :web / :test 전부 통과
$ npm test                         # 416 passed | 11 failed (db/queries.test.ts)
$ npm rebuild better-sqlite3       # Node ABI 재빌드
$ npx vitest run src/main/db/queries.test.ts   # ✅ 11 passed → 전체 427/427 green
```

- 1차 11 red 는 전부 `src/main/db/queries.test.ts`("Module did not self-register: better_sqlite3.node") — `postinstall` 이 Electron ABI 로 빌드, vitest 는 Node ABI 137 로 실행하는 **dual-ABI 환경 충돌(handoff 0019 계열)**. 본 변경(렌더러 표현 계층)과 무관. `npm rebuild better-sqlite3`(Node ABI) 후 11/11 green = 환경 한정 확정.

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 N/A.
- 신규 CSS 파일 0(빗금은 Tailwind arbitrary `[background-image:…]` + 시맨틱 토큰 `var(--color-border)`). 신규 의존성 0. IPC 무변경(채널 40 유지) → `IPC_CONTRACT.md` 무관.

## PHASES.md 정합성

- "완료 (커밋 `cd246c2`+`5fcb839`)" 행으로 승격. 형식(handoff slug·비기능=Claude·게이트 427/427·경계 0·의존성 0) 기존 톤 일치.

## 결론 / 다음 단계

- **상태: PASS** — 인수 9/9 충족, 게이트 lint/typecheck/test **427/427**(Node ABI 재빌드 후 green), 레이어 경계 0, 신규 의존성 0, IPC 무변경.
- `INDEX.md` `verify/PASS` → `PHASES.md` 승격. 사람 확인 대기: UI 시각 검증 9건(케밥 호버폭·메뉴 flip·자동화 빗금·랜딩 2카드·툴카드 border·타이틀바 부제·도넛 우측·zone 정렬·`+`→`/` 자동완성)·PR 머지.

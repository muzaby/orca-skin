# Verify — 0034-multi-right-panels

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0034-multi-right-panels` |
| 검증자 | Claude Code |
| 일자 | 2026-06-22 |
| 대상 커밋 | 기반(Codex) `2591cbd` + 후속(Claude R1~R7) `f1903e4`·`9845fc2`·`deb8694`·`735b36c`·`b7cd0b8`·`6132774`·`686fee1` (`origin/main` `7c0f438` 위로 리베이스) |
| 라운드 | 1 |
| 상태 | PASS (에이전트 검증 항목) |

## 검증 범위 주석

기반 구현은 **Codex**(`2591cbd`, plan 의 인수 1~19 대상, 게이트 422/422). 이후 동일 세션에서 **사용자 피드백 7라운드(R1~R7)** 를 **Claude 가 직접 구현**(plan→impl→verify 동일 주체, 비기능). 일부 원안 기준(타일 케밥·방향성 slide-in)은 **사용자 피드백으로 의도적으로 대체(superseded)** 됐다 — 아래 매트릭스에 ⤳ 로 표기하고 현재 트리 기준으로 판정한다.

## 요구사항 충족 매트릭스

> plan 인수 1~19 를 현재 트리와 1:1 대조. 증거는 `파일:라인`(리베이스 후 `686fee1`).

| # | 인수 기준 | 충족 | 증거 / 비고 |
|---|---|---|---|
| 1-a | 단일 planTile 필드 → 멀티 패널 상태 모델 | ✅ ⤳ | `chatReducer.ts` `rightPanelTiles`(R4 평탄→열구조, R7 `{id,tiles}[]`)·`rightPanelColWidths`·`rightPanelRowSplits`·`planContent` 유지 |
| 1-b | 종류 하드코딩 0 — `tileRegistry` 단일 출처 | ✅ | `rightpanel/tileRegistry.ts`(plan/subagent/reserved1/2 + `HeaderActions` 매핑), 레일·리듀서는 활성목록·파생 레이아웃으로만 동작 |
| 1-c | 상한은 `ROWS_PER_COL=2` 만, 열 수 파생 | ✅ | `lib/rightPanelLayout.ts:3` `ROWS_PER_COL`, `addTileColumnMajor`/`deriveRightPanelLayout` 가 파생 |
| 1-d | 리듀서 액션 6종 + clamp | ✅ | `chatReducer.ts` TOGGLE/SET_ACTIVE/RENAME/REMOVE/SET_COL_WIDTH/SET_ROW_SPLIT, `clampPanelWidth`(280–640)·`clampPanelRowSplit`(0.2–0.8) |
| 2-a | plan_review 도착 시 계획 타일 자동 활성 | ✅ | `chatReducer.ts` plan_review → `addTileColumnMajor(state.rightPanelTiles,'plan')` + `planContent` 세팅. 테스트 `chatReducer.plan.test.ts` |
| 2-b | 계획 본문(마크다운/빈상태/복사) 회귀 0 | ✅ ⤳ | `rightpanel/PlanTileContent.tsx`(마크다운·빈상태) + R1 으로 복사버튼이 본문→헤더(`PlanTileHeaderActions`) 이동 |
| 3-a | 활성 순서 column-major 채움 | ✅ | `addTileColumnMajor`(첫 빈 슬롯 append, 없으면 새 열) + 위치 안정 제거(`removeTileFromColumns`). 회귀 테스트 `rightPanelLayout.test.ts`·`chatReducer.plan.test.ts`(좌측열 제거 비리플로우) |
| 3-b | 그리드/분할은 동적 `style`, 정적은 Tailwind | ✅ | `RightPanel.tsx` `RightPanelColumn` `style={{width}}`·tile `style={{flexBasis}}`, 나머지 Tailwind |
| 4-a | 새 열/2번째 행 방향성 slide-in | ✅ ⤳ | **R4~R7 대체**: 인덱스 기반 slide-in-right/up 이 형제 제거 시 오연출 → 위치무관 `animate-tile-in`(등장) + 열 제거 시 FLIP 가로 슬라이드(`useColumnSlideOnReflow`) + 행 제거 시 `justify-end` grow 방향. 사용자 확인 사항 |
| 4-b | 키프레임 + reduced-motion | ✅ | `styles/app.css` `@keyframes tile-in`·`@utility animate-tile-in` + `@media (prefers-reduced-motion: reduce)`. 컴포넌트 `motion-reduce:animate-none`/`motion-reduce:transition-none` |
| 5-a | 타이틀바 케밥 + Popover(토글/구분선/이름변경·삭제) | ✅ ⤳ | `ChatTitleBar.tsx` 케밥+`Popover`. **R5 정제**: 타일 선택 시 `setOpen(false)`(메뉴 닫힘) + 설정(톱니바퀴) 아이콘 제거 |
| 5-b | 각 타일 헤더 최우측 케밥(비활성/이름변경/삭제) | ⤳ | **R1 대체(사용자 결정)**: 타일 헤더 케밥 제거 → 기본 **닫기(x)** 버튼(계획 타일은 복사+닫기). 이름변경/삭제는 타이틀바 케밥에 존속(기능 손실 0). `RightPanelTile.tsx` |
| 5-c | 이름변경=라벨 오버라이드, 삭제=비활성 | ✅ | `chatReducer.ts` RENAME(`rightPanelTileLabels`)·REMOVE(`removeTile` + 폭/분할 splice) |
| 6-a | 스텁 패널 3종 empty-state | ✅ | `rightpanel/SubAgentTileContent.tsx`·`ReservedTileContent.tsx` |
| 7-a | 모든 경계 핸들바(외곽/열간/행간) 파생 | ✅ ⤳ | `RightPanel.tsx` `ColumnResizeSeparator`(외곽+열간 통합, R7)·`RowSeparator`. **R3 버그수정**: 우측 도킹 방향(오른쪽 모서리 기준+invert) — 외곽·열간 핸들 마우스 방향 일치 |
| 7-b | 핸들 마크업/스타일 planTile 분리선 재사용 | ✅ | `VerticalSeparator`/`RowSeparator` `app-frame-tile-separator group/sep` + `SEPARATOR_CAPSULE`, 가로 `h-1 w-10`·`cursor-row-resize`·`data-axis="horizontal"` |
| 7-c | `useDragResize` y축 지원 | ✅ | `shared/hooks/useDragResize.ts` `axis?:'x'|'y'`·`invert`. RowSeparator `axis:'y'` |
| 8-a | 신규 파일 `features/chat/**` — 경계 위반 0 | ✅ | 변경 전부 `features/chat/**` + `shared/{ui,hooks}` 하향 의존. `npm run lint`(boundaries) green |
| 8-b | reducer/layout 단위 테스트 + plan_review 회귀 + 게이트 4종 | ✅ | `rightPanelLayout.test.ts`(헬퍼·파생·id 보존)·`chatReducer.plan.test.ts`(액션·위치안정·폭 splice·plan 자동활성). 게이트 아래 |

**19/19 충족**(2건은 사용자 피드백으로 대체된 형태로 충족 — 5-b 닫기버튼·4-a 통합 애니메이션).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | PASS 427/427 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 19/19 |
| 레이어 경계 위반 0 | ✅ | — | PASS (cross-feature import 0, boundaries green) |
| 문서 형식/링크/한국어 | ✅ | — | PASS |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | N/A (AGENTS.md 무변경) |
| 제품 의도 부합(피드백 반영) | ✖ 보조 | ✅ 결정 | R1~R7 사용자 피드백 직접 반영(수렴) |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** (아래 목록) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck && npm run lint && npm test   # (origin/main 리베이스 후)
typecheck  ✅ (typecheck:node + typecheck:web + typecheck:test 모두 통과)
lint       ✅ (eslint --cache --fix ./src, boundaries 포함 — 위반 0)
test       ✅ Test Files 60 passed (60) / Tests 427 passed (427)
```
(better-sqlite3 Node ABI 재빌드 후 전체 green. 리베이스 충돌 0 — main 의 projects/landing 변경과 본 작업의 `features/chat/rightpanel` 변경 파일 도메인 비중첩.)

## 위생 검토

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 대상 아님.
- 신규/변경 컴포넌트 raw hex 0(시맨틱 토큰). 인라인 `style` 은 동적값(width·flex-basis·FLIP transform)만.
- 레이어 경계: 변경 전부 `features/chat/**`(components/rightpanel·hooks·lib·reducer) + `shared/{ui,hooks}` 하향 의존. cross-feature import grep 0.
- IPC 무변경(채널 40 유지) → `IPC_CONTRACT.md` 갱신 불필요.
- 리팩토링(R7) 위생: 열 안정 id 도입으로 `entering` 우회책 제거, 애니메이션 메커니즘 3→2(FLIP+anchorBottom). `crypto.randomUUID` 외 신규 의존성 0.

## PHASES.md 정합성

- `docs/PHASES.md` 에 0034 행 승격(범위·커밋, 후속 R1~R7 요약 포함). 형식·한국어 컨벤션 유지. (0034 는 기존 미승격 — 본 검증으로 추가.)

## 결론 / 다음 단계

- 상태: **PASS** — 인수 19/19 충족(2건 사용자 피드백 대체형), 게이트 427/427, 레이어 경계 0, 신규 의존성 0.
- `INDEX.md` 0034 → `verify/PASS`, 다음=—. `PHASES.md` 승격.
- **사람 확인 대기**(검증 책임 분리표) — UI 시각 검증:
  1. 타일 추가 시 신규 타일만 등장 연출(기존 타일 무재생).
  2. 좌측 열 제거 → 우측 열 무동작(채팅 확장)·우측 열 제거 → 좌측 열 우측 슬라이드.
  3. 2행에서 위 행 제거 → 남은 행 **위로** grow, 아래 행 제거 → 아래로 grow.
  4. 외곽/열간/행간 리사이즈 마우스 방향 일치(R3).
  5. 타일 헤더 닫기(x)/계획 복사·타이틀바 케밥 선택 시 메뉴 닫힘·설정 아이콘 제거(R1·R5).
  6. `prefers-reduced-motion` 즉시 반영.
- PR 머지는 사용자 결정(요청 시 생성).

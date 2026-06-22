# Verify — 0035-project-right-panel-cards

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0035-project-right-panel-cards` |
| 검증자 | Claude Code |
| 일자 | 2026-06-22 |
| 대상 커밋 | `cf5c6fb` (라운드1 `6292227` · 라운드2 `182d61d`·`309b6a3` · simplify `cf5c6fb`) |
| 라운드 | 1 |
| 상태 | PASS (에이전트 검증 항목) |

## 요구사항 충족 매트릭스

> plan 의 인수 기준 1~13 을 코드와 1:1 대조. 증거는 `origin/main`(=`2591cbd`) 대비 현 트리.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 지침/파일 두 독립 카드(`rounded-r6 border bg-panel`·`gap-4`) | ✅ | `SidebarCard.tsx:22` (chrome) · `ProjectInstructionsSidebar.tsx:24` (`flex flex-col gap-4`) |
| 2 | 지침 헤더 `+` 버튼 → `EditInstructionsModal` 오픈 | ✅ | `ProjectInstructionsCard.tsx:15` (`onAdd={onEdit}`) → `ProjectInstructionsSidebar.tsx` (`onEdit={() => setEditOpen(true)}` + 모달 마운트) |
| 3 | 지침 있으면 3줄 clamp, 없으면 안내 카피 | ✅ | `ProjectInstructionsCard.tsx:16-24` (`line-clamp-3` / 빈-상태 카피) |
| 4 | 파일 헤더 `+` 버튼, `준비 중` 배지 제거 | ✅ | `SidebarCard.tsx:24-37` (`onAdd` 미전달→disabled 버튼) · 배지 문자열 grep 0 |
| 5 | 점선 드롭존 + 겹친 문서 일러스트 + 카피 | ✅ | `ProjectFilesCard.tsx:9-13` (`border-dashed` + `<FileDropIllustration/>`) · `FileDropIllustration.tsx` |
| 6 | 토큰 대응(raw hex 0)·xl 미만 스택 | ✅ | 새 파일 raw hex grep 0 (`var(--color-panel)` 토큰만) · `ProjectLandingPage.tsx:38` (`grid-cols-1 … xl:grid-cols-5`) |
| 7 | 게이트 통과 | ✅ | 아래 §게이트 — lint/typecheck/test 422/422 |
| 8 | 구조 구분선 제거(헤더 border-b·aside border-l/t), 카드 테두리 유지 | ✅ | `ProjectLandingHeader.tsx:15` (border-b 없음) · `ProjectLandingPage.tsx:51` (`<aside className="min-w-0 xl:col-span-2">` 무경계) · 카드 테두리는 기준 1 |
| 9 | 제목 라인 우측 핀+케밥, 메뉴 `세부사항 수정`/`삭제`(빨강), 동작 미배선 | ✅ | `ProjectInfoHero.tsx` 핀(`Icon name="pin"`)·케밥(`Popover` align end)·`삭제` `text-rust hover:bg-rust-soft`, onClick=메뉴닫기만 |
| 10 | 지침 빈-상태 카피에서 "Claude" 제거 | ✅ | `ProjectInstructionsCard.tsx:21` `응답을 맞춤화하는 지침을 추가하세요.` · 카드 grep "Claude" 0 |
| 11 | 파일 카피에 "폴더" 명시 | ✅ | `ProjectFilesCard.tsx:12` `… PDF, 문서, 폴더 또는 기타 텍스트 …` |
| 12 | 중앙:우측 6:4 중앙정렬 단일 블록, 고정 gap, 초과폭=바깥여백 | ✅ | `ProjectLandingPage.tsx:38` (`mx-auto max-w-[1200px] … xl:grid-cols-5 xl:gap-x-10`) + `:39` col-span-3 / `:51` col-span-2 |
| 13 | 컴포저 좌우 라인을 형제 콘텐츠와 정렬(flush) | ✅ | `ProjectLandingPage.tsx:41` (`<Composer … flush />`) → `Composer.tsx:330` `<ColumnWrap flush>` / `:591` flush 시 `w-full min-w-0`(리딩 거터 제거). ChatTile 경로는 기본 `ReadingColumn` 유지(무회귀) |

**13/13 충족** (에이전트 판정 가능 범위).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | PASS 422/422 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 13/13 |
| 레이어 경계 위반 0 | ✅ | — | PASS (cross-feature import grep 0, lint boundaries green) |
| 문서 형식/링크/한국어 | ✅ | — | PASS |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | N/A (AGENTS.md 무변경) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** (카드 톤·일러스트·핀/케밥 메뉴·6:4·1200px 초과 바깥여백·컴포저 정렬·테마 3종·xl 미만 스택) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 (PR #111) |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint       ✅ (eslint --cache --fix ./src, boundaries 포함 — 위반 0)
typecheck  ✅ (typecheck:node + typecheck:web + typecheck:test 모두 통과)
test       ✅ Test Files 60 passed (60) / Tests 422 passed (422)
```
(better-sqlite3 Node ABI 재빌드 후 전체 green — 시각 변경이라 신규 단위 테스트 없음, `app/AGENTS.md` 원칙 4: UI 는 시각 검증으로 갈음.)

## 위생 검토

- AGENTS.md 변경 없음 → 키/토큰/이메일/IP 스캔 대상 아님.
- 새 컴포넌트 raw hex 0 (시맨틱 토큰 + `var(--color-panel)` 만). 인라인 `style` 0.
- 레이어 경계: 변경 전부 `features/projects` + `features/chat` 내부 + `shared/ui`(Icon·Popover·ReadingColumn) 하향 의존. cross-feature import grep 0.
- IPC 무변경(채널 40 유지) → `IPC_CONTRACT.md` 갱신 불필요.

## PHASES.md 정합성

- `docs/PHASES.md` 페이즈 표에 0035 행 승격(범위·PR #111·커밋 `cf5c6fb`). 형식·한국어 컨벤션 유지.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 13/13 충족, 게이트 422/422, 레이어 경계 0, 신규 의존성 0.
- `INDEX.md` 0035 → `verify/PASS`, 다음=—. `PHASES.md` 승격 완료.
- **사람 확인 대기**(검증 책임 분리표): UI 시각 검증 + PR #111 머지 승인. 머지는 사용자 결정.

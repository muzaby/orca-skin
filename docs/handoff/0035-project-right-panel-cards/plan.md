# Plan — 0035-project-right-panel-cards

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0035-project-right-panel-cards` |
| 작성자 | Claude Code |
| 일자 | 2026-06-22 |
| 매핑 | PHASES "현재 작업 중" / PR (생성 시 기재) |
| 상태 | DRAFT → READY → IMPL_DONE |
| 구현 주체 | Claude (비기능 = 시각 스타일링, 직접 구현) |

## Context (왜)

프로젝트 선택 시 보이는 상세 화면(`ProjectLandingPage`)의 우측 패널(`ProjectInstructionsSidebar`)은
전체 7:5 레이아웃은 첨부 이미지(Claude 데스크톱 프로젝트 뷰)와 동일하나, "지침"·"파일" 섹션의
**디자인 묘사(경계선·라운드 처리 등)가 부족**했다. 기존은 `border-b` 구분선만 있는 평면 레이아웃이고
"지침"엔 `편집` 텍스트 버튼, "파일"엔 `준비 중` 배지 + 단일 `doc` 아이콘이었다. 목표는 **이미지 완전
재현**: 두 섹션을 테두리+라운드 카드로, 헤더 버튼을 `+` 아이콘으로, 배지 제거, 파일 드롭존에 겹친
문서 일러스트 추가.

## 인수 기준 (Acceptance Criteria)

1. 우측 패널이 "지침"·"파일" **두 개의 독립 카드**로 렌더된다 — 각 카드 `rounded-r6 border border-border bg-panel`, 카드 사이 간격(`gap-4`)·패널 내부 패딩(`p-5`).
2. "지침" 카드 헤더: 좌측 `지침`(serif, `text-[13px] font-semibold text-ink`) + 우측 **`+` 아이콘 버튼**(`Icon name="plus"`), 클릭 시 기존 `EditInstructionsModal` 이 열린다(동작 무회귀).
3. 지침이 있으면 본문에 미리보기(말줄임, 3줄 clamp), 없으면 `Claude 의 응답을 맞춤화하는 지침 추가` 안내(`text-ink3`).
4. "파일" 카드 헤더: 좌측 `파일` + 우측 `+` 아이콘 버튼. **`준비 중` 배지 제거.**
5. "파일" 드롭존: 점선 카드(`rounded-r5 border border-dashed border-border`) 안에 **겹친 문서 일러스트**(인라인 SVG, `aria-hidden`) + 카피 `이 프로젝트에서 참조할 PDF, 문서 또는 기타 텍스트를 추가하세요.`.
6. 세 테마(classic/dark/cool)에서 카드 테두리·표면·텍스트가 토큰으로 정상 대응(raw hex 없음). xl 미만 단일 컬럼에서도 깨지지 않는다.
7. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.

## 범위 / 비범위

- **범위**: 우측 패널 시각 스타일링 + 컴포넌트 분해(신규 파일 3개).
- **비범위**: 파일 업로드 실제 동작(드롭존은 placeholder 유지·`+` disabled), IPC/스토어/모달 로직 변경, 좌측 컬럼·`<aside>` 골격.

## 설계

- **컴포넌트 분해(신규 3개, 모두 `features/projects/components/`)** — 레이어 경계 유지:
  - `ProjectInstructionsCard.tsx` — "지침" 카드(헤더 `+` 버튼 → `onEdit`, 본문 3줄 clamp).
  - `ProjectFilesCard.tsx` — "파일" 카드(헤더 `+` 버튼[disabled] + 점선 드롭존).
  - `FileDropIllustration.tsx` — 겹친 문서 일러스트(1회성 인라인 SVG; Icon.tsx 는 single-path 규약이라 추가 안 함).
- `ProjectInstructionsSidebar.tsx` 는 **조립 셸**로 축소: 스토어 조회 + `EditInstructionsModal` 보유 + 두 카드 배치(`flex flex-col gap-4 p-5`).
- **재사용**: 카드 chrome 어휘는 기존 `ProjectCard`·`Modal`(`rounded-r6 border border-border bg-panel`)과 동일 토큰. `+` 버튼 hover 는 `bg-fill-uncontained-hover`. 아이콘 `Icon name="plus"`(존재). 일러스트 `+` 배지 원 채움은 `var(--color-panel)` 로 테마 추종.
- 스타일 전부 Tailwind v4 + 시맨틱 토큰. 인라인 `style` 없음(일러스트는 SVG attribute).

## 영향 받는 파일

- `app/src/renderer/src/features/projects/components/ProjectInstructionsSidebar.tsx` (셸로 축소)
- `app/src/renderer/src/features/projects/components/ProjectInstructionsCard.tsx` (신규)
- `app/src/renderer/src/features/projects/components/ProjectFilesCard.tsx` (신규)
- `app/src/renderer/src/features/projects/components/FileDropIllustration.tsx` (신규)

## 참고 문서

- `docs/arch/frontend/layers.md` (features 경계) · `app/AGENTS.md` 스타일링 절(시맨틱 토큰).
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불필요.

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`. 신규 단위 테스트 불요(순수 시각, UI 시각 검증으로 갈음 — `app/AGENTS.md` 원칙 4).

---

## 구현 체크리스트

- [x] `FileDropIllustration.tsx` 겹친 문서 + `+` 배지 인라인 SVG(`currentColor`·`aria-hidden`).
- [x] `ProjectInstructionsCard.tsx` 카드 chrome + `+` 버튼(모달 트리거) + 3줄 clamp / 빈 안내.
- [x] `ProjectFilesCard.tsx` 카드 chrome + `+` 버튼(disabled) + 점선 드롭존 + 일러스트 + 카피.
- [x] `ProjectInstructionsSidebar.tsx` 셸 축소(카드 스택 `gap-4 p-5` + 모달 보유).
- [x] `준비 중` 배지·`편집` 텍스트 버튼·단일 `doc` 아이콘 제거.

## 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | sidebar 1(축소) + 신규 3(InstructionsCard·FilesCard·FileDropIllustration) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck(node+web+test) ✅ / test ✅ **422/422** (better-sqlite3 Node ABI 재빌드 후 전체 green) |
| 레이어 경계 | 0 위반 (전부 `features/projects` 내부 + `shared/ui/Icon`) |
| 신규 의존성 | 0 |
| 블로커 / 역질문 | 없음 |
| 사람 확인 대기 | UI 시각 검증(카드 톤·일러스트·테마 3종·xl 미만 스택) — `app/AGENTS.md` 원칙 4 |
| 대상 커밋 | `6292227` (라운드 1) |

---

## 라운드 2 — 랜딩 페이지 리파인 (사용자 리뷰 5건)

직전 라운드(PR #111) 머지 전 사용자 리뷰로 랜딩 페이지 레이아웃·헤더·카피를 추가 조정.

### 추가 인수 기준

8. **구조 구분선 제거**: `ProjectLandingHeader` 의 `border-b`, `<aside>` 의 `border-l`/`border-t` 제거. **지침/파일 카드 테두리는 유지**(사용자 결정).
9. **제목(h1) 라인 우측에 핀 + 케밥**: 케밥 메뉴 `세부사항 수정` / `삭제`(빨강 `text-rust`). 동작 배선은 범위 밖(시각만, 메뉴 닫기만).
10. **지침 빈-상태 카피에서 "Claude" 제거**: `응답을 맞춤화하는 지침을 추가하세요.`
11. **파일 카피에 "폴더" 명시**: `… PDF, 문서, 폴더 또는 기타 텍스트를 추가하세요.`
12. **중앙:우측 = 6:4, 고정 마진, 중앙 정렬 단일 블록**: `max-w-[1200px] mx-auto grid xl:grid-cols-5`(col-span-3:2) + `xl:gap-x-10`(고정). 창이 1200px 초과 시 패널 간 간격이 아니라 좌우 바깥 여백이 증가.

### 라운드 2 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `pages/ProjectLandingPage.tsx`(6:4 중앙 블록·aside 경계 제거) · `ProjectLandingHeader.tsx`(border-b 제거) · `ProjectInfoHero.tsx`(제목 라인 핀+케밥 Popover 메뉴) · `ProjectInstructionsCard.tsx`/`ProjectFilesCard.tsx`(카피) · `ProjectInstructionsSidebar.tsx`(p-5 제거, 컬럼이 패딩 담당) · `shared/ui/Icon.tsx`(`pin` 추가) |
| 재사용 | `shared/ui/Popover`(placement bottom·align end, `SessionRow`/`ChatTitleBar` 패턴) · 삭제 빨강 `text-rust`/`hover:bg-rust-soft` |
| 게이트 결과 | lint ✅ / typecheck(node+web+test) ✅ / test ✅ **422/422** |
| 레이어 경계 | 0 위반 (`features/projects` + `shared/ui` 하향) |
| 신규 의존성 | 0 |
| 사람 확인 대기 | UI 시각 검증(구분선 제거·6:4 비율·1200px 초과 시 바깥 여백 증가·제목 핀/케밥 메뉴) |
| 대상 커밋 | (push 후 기재) |

# Plan — 0131-simplify-121-130-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0131-simplify-121-130-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-20 |
| 매핑 | PHASES Phase 4 행 (0121~0130 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 121부터 130까지 리팩토링 하라` — 0121~0130 이 도입한 코드 변경을 4관점(재사용·단순화·효율·altitude)으로 리뷰하고 발견을 적용 | 라이브 세션 요청 (2026-07-20) |
| 명시 요구 | "핸드오프 131 만들어서 이 리팩토링 기록해줘" — /simplify 결과를 핸드오프 문서로 남긴다 | 라이브 세션 요청 (2026-07-20) |
| 추론 의도 | /simplify 는 동작 보존 품질 정리 — IPC 계약·타입 표면·런타임 방출값·렌더 DOM·UI 표시는 불변이어야 한다 (추론: /simplify 스킬 정의 + 0106/0120 선례) | `docs/handoff/0120-simplify-107-119-cleanup/plan.md` |

## Context (왜)

0121~0130 범위(`835cc2e..a49408d`, 코드 184파일 · +5526/−892 — 디자인 통일성 감사 0121 ·
composer 상태 팝오버 0122 · 중앙 로깅 0123~0124 · settings 변경 respawn 0125~0126 ·
continuity 도넛/언어 0127 · 모델 변경 respawn 0128 · 사이드바 고정/제목 자동너비 0129 ·
폐쇄망 외부확장 지점 0130)를 4관점 리뷰했다.

**이 묶음은 그 자체가 디자인 일관성·리팩토링·확장점 정비 작업**이라 대부분 이미 정리돼 있다 —
0121 이 Button/MenuItem/Modal 을 공용화하고, 0127 이 continuity 제목 마커 이중 하드코딩을
`shared/continuity-lang` 로 수렴했으며, 0122 는 소비자를 잃은 `formatApproxCost`·`cost.approx`
를 동반 제거했다. dedup 후 적용 대상은 **1건**: 0129 가 신규 추가한 `PinnedSection` 이
`SessionRow` 의 hover-reveal 케밥(⋮) 버튼 마크업(버튼 크롬 + a11y 속성)을 그대로 복제한 것.
이는 **이번 범위(0129)가 도입한 중복**이라 정리 대상이고, 0121 이 세운 공용화 방향과 동일하게
공용 컴포넌트로 수렴한다. 스킵 1건(S1)은 false positive 로 판정해 기록만 남긴다.

## 자료조사 (Research)

> 4관점 리뷰(재사용·단순화·효율·altitude) 에이전트 4기 병렬 실행 시도 → **전기 세션 한도로
> 실패**(8:20am UTC 리셋). 재실행해도 리셋 전까지 동일 실패라, 리뷰를 직접 인라인으로 수행했다.
> 모든 발견은 현재 파일 내용 기준 재검증됨.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `SessionRow` 의 hover-reveal 케밥 버튼(`h-5 w-5 … hidden group-hover/session:grid` + `type/onClick/title/aria-haspopup/aria-expanded` + `<Icon name="kebab">`)을 0129 신규 `PinnedSection.PinnedProjectRow` 가 그대로 복제 — group 이름(`session`↔`pinproj`)과 `aria-label` 만 상이 | `SessionRow.tsx:122-137`(수정 전) ↔ `PinnedSection.tsx:132-148`(수정 전) |
| 두 케밥은 a11y 속성(`aria-haspopup="menu"`·`aria-expanded`)까지 동일 — 한쪽만 수정 시 접근성 드리프트. 0121 이 같은 이유로 raw `<button>` 을 `MenuItem`/`Button` 으로 수렴한 선례 | `docs/handoff/0121-design-consistency-audit/plan.md` |
| Tailwind JIT 는 `group-hover/<name>:grid` 리터럴이 소스에 있어야 variant 를 생성 — 공용 컴포넌트는 group 클래스를 prop 리터럴로 받아 호출부 소스에 남겨야 함 | `PinnedSection.tsx:113`(부모 `group/pinproj`)·`SessionRow.tsx:104`(부모 `group/session`) |
| 0127 이 continuity 제목 마커 이중 하드코딩(renderer draft ↔ main initialTitle)을 `shared/continuity-lang.ts` 단일 조립점으로 이미 수렴 — 추가 중복 없음 | `app/src/shared/continuity-lang.ts`·`chatStore.ts:749-767` |
| 0122 가 소비자를 잃은 `formatApproxCost`·`cost.approx`·`features/cost/lib/formatCost.ts` 를 삭제 — 잔재 참조 grep 0 확인 | `git diff` 0122 범위 (삭제 커밋) |
| 0121 의 Button/MenuItem/Modal 수렴, useEscToClose 공용화, danger variant — 재발견 없음(이미 정리됨) | `Modal.tsx`·`Button.tsx`·`MenuItem.tsx`·`useEscToClose.ts` |

## 인수 기준 (Acceptance Criteria)

> 전부 동작 보존(관찰 가능 동작·렌더 DOM·클래스·a11y 속성·타입 표면·IPC 무변경) 전제.

1. **F1** — 신규 `shared/ui/KebabButton.tsx`(hover-reveal 케밥 트리거 표준)가 추가되고, `SessionRow` 와 `PinnedSection.PinnedProjectRow` 가 이를 사용한다. 두 파일에서 raw `<button … name="kebab">` 잔존 grep 0. `KebabButton` 은 base 클래스 + `open ? 'grid' : \`hidden ${revealClass}\`` + `title=common.more` + `aria-haspopup="menu"`/`aria-expanded={open}` 를 내부 소유하고, group 노출 클래스(`revealClass`)·`ariaLabel`·`open`·`onToggle`·`ref` 를 받는다.
2. **동작 보존** — 치환 후 렌더 DOM 이 불변: SessionRow 케밥(`group-hover/session:grid`·aria-label=`sessions.menuAria`)·PinnedProjectRow 케밥(`group-hover/pinproj:grid`·aria-label=`common.more`) 의 클래스/속성/아이콘(`kebab` size 14)이 수정 전과 동일.
3. **게이트 green** — lint 0 error · typecheck 3분할 0 · vitest 1059/1059 + scripts 25/25(`chat-turn.continuity` 1스위트 로드 실패 = electron 바이너리 egress 403 환경 베이스라인, 0128~0130 verify 동일 기준). 레이어 경계 0 · 신규 의존성 0 · IPC 채널/스키마 무변경.

## 범위 / 비범위 (스킵 판정 기록)

- **범위**: 위 인수 1~3 (F1 케밥 버튼 공용화 1건).
- **비범위 (스킵 1건 — 발견했으나 적용하지 않음)**:
  - **S1 (재사용 — false positive)**: `opacity-0 group-hover/<name>:opacity-100` hover-노출 패턴이 코드베이스 다수(구분선 `RightPanel`/`Sidebar`, 메시지 메타 `MessageMeta`/`PendingSteerTurn`, 첨부 썸네일 `AttachmentThumb`, 코드블록 `CodeBlock`, `ProjectCard` 핀 등)에 있으나, **서로 다른 요소에 붙는 한 줄 className 유틸**이라 공용 버튼 컴포넌트로 묶을 대상이 아니다(요소·자식·의미가 제각각). 케밥(F1)만이 동일 *버튼 컴포넌트* 의 복제였다 — 유지.
  - 0121 Button/MenuItem/Modal 수렴·0127 continuity-lang 수렴·0122 formatCost 삭제·0130 SSO 확장점·Popover resize 재배치·UpdateDialog Modal 이관 — 이미 정리됨(발견 아님).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 신규 파일 1개(`shared/ui/KebabButton.tsx`) — 기존 `Icon`·`useI18n` 만 의존. **신규 의존성: 없음.**
- Tailwind JIT 전제: 두 호출부가 `revealClass="group-hover/session:grid"`·`"group-hover/pinproj:grid"` 를 리터럴로 넘겨 소스에 남으므로 variant 생성 유지(컴포넌트 주석에 명기).
- 레이어: `shared/ui` 는 feature 하위가 import 하는 최하위층 — 경계 무위반.

## 설계

- 재사용: 케밥 버튼 크롬 + a11y 속성을 `shared/ui/KebabButton` 이 단일 소유. 가변부(group 노출 클래스·aria-label·open 상태·토글 핸들러·ref)만 prop. `MenuItem`/`Button`(0121)과 동일한 "행/메뉴 표준 컴포넌트" 결.
- `forwardRef` 로 `kebabRef`(Popover anchor) 전달 유지 — Popover 연동 무변경.
- `title` 은 항상 `common.more` 라 내부 고정, `ariaLabel` 만 행 유형별로 주입(SessionRow=`sessions.menuAria`, PinnedProjectRow=`common.more`).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- N/A — 순수 마크업 추출. 렌더 결과(클래스·속성·아이콘)가 수정 전과 바이트 동일이라 시각·상호작용·접근성 무변화.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| Tailwind 가 group-hover variant 를 못 생성해 케밥이 안 나타남 | `revealClass` 를 호출부 리터럴로 전달 → 두 문자열이 소스에 그대로 남아 JIT 스캔 유지. 컴포넌트 주석에 전제 명기. typecheck/lint 로 기계 검증 |
| 4관점 리뷰 에이전트 실패로 발견 폭이 좁을 가능성 | 세션 한도로 병렬 에이전트 불가 → 직접 인라인 리뷰(신규/대폭 변경 파일 전수)로 대체. 이 묶음이 리팩토링 계열이라 애초 발견이 희소한 것이 주 원인(단일 finding) |

- 되돌리기 어려운 결정: 없음 (마크업 이동, 시그니처·동작·IPC·DB 무변경).
- **단독 결정 금지 항목**: 없음.

## 영향 받는 파일

- renderer(신규): `shared/ui/KebabButton.tsx`
- renderer(수정): `features/sessions/components/SessionRow.tsx` · `features/sessions/components/PinnedSection.tsx`

## 참고 문서

- `docs/handoff/0120-simplify-107-119-cleanup/{plan,verify}.md` — /simplify 정리 선례(스킵 판정 관례)
- `docs/handoff/0121-design-consistency-audit/plan.md` — Button/MenuItem 공용화 원 설계(F1 방향 근거)
- `docs/handoff/0129-sidebar-pin-title-autosize/plan.md` — 중복이 도입된 PinnedSection 원 설계

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (+ `node --test scripts/*.test.mjs`).
- 신규 테스트: 불필요 — 동작 보존(렌더 DOM 불변) 마크업 추출이라 기존 스위트(무수정 green)가 회귀 가드. 해당 컴포넌트 직접 커버 테스트는 없음(순수 시각).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·핸드오프 문서)를 붙였고, 에이전트 실패 경위를 기록했다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다(grep 0·DOM 불변·무수정 green).
- [x] 의존 기술 — 신규 의존성 0·Tailwind JIT 전제를 식별했다.
- [x] 파생 UX — 순수 마크업 추출이라 N/A 로 표기했다(DOM 불변 근거 포함).
- [x] 리스크 — group-hover variant 생성·리뷰 에이전트 실패 리스크와 완화책을 적었다.

---

> **[구현자 기입]** 본 건은 비기능 = Claude 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: F1. 발견이 1건인 것은 이 묶음(0121~0130)이 리팩토링·확장점 정비 계열이라 이미 정리돼 있기 때문 — 억지 발견을 만들지 않고 실제 중복 1건만 수렴.
- 이견 / 우려: S1 을 finding 으로 올리지 않은 판단이 핵심 — hover-노출은 흔한 유틸 패턴이라 "공용 컴포넌트화" 가 오히려 요소 다양성을 억지로 뭉개 altitude 를 낮춘다. 케밥만이 동일 버튼의 복붙이었다.

## [구현자 기입] 구현 체크리스트

- [x] F1 적용 (신규 1 + 수정 2파일)
- [x] 스킵 1건(S1) 근거 기록
- [x] 게이트 + 영향 스위트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 3개(신규 `KebabButton.tsx` + `SessionRow.tsx`·`PinnedSection.tsx`) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npx vitest run` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 0 error(경고 1 = 0102 TanStack↔React Compiler 기존) / typecheck 3종 ✅ 0 / vitest ✅ **1059/1059**(135/136 파일 — `chat-turn.continuity` 1스위트 로드 실패는 electron 바이너리 egress 403 환경 베이스라인, 0128~0130 verify 동일) / scripts ✅ 25/25 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `d65d1f7` |

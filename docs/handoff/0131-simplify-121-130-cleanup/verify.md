# Verify — 0131-simplify-121-130-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0131-simplify-121-130-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-20 |
| 대상 커밋 | `d65d1f7` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 발견 1건 = 이 묶음이 리팩토링·확장점 정비 계열이라 이미 정리됨 | 타당 — 인라인 전수 리뷰로 0121 Button/MenuItem 수렴·0127 continuity-lang 수렴·0122 formatCost 삭제 등을 재확인, 실제 신규 중복은 케밥 1건뿐 | 매트릭스 #1·범위 S1 근거에 반영 |
| S1(hover-노출 유틸)을 finding 으로 올리지 않음 | 타당 — 서로 다른 요소의 한 줄 className 이라 공용 버튼화가 부적절(false positive) | plan 비범위 S1 로 기록 |
| 4관점 병렬 에이전트가 세션 한도로 실패 → 인라인 리뷰 대체 | 타당 — 리셋 전 재실행도 동일 실패라 대체가 유일 경로. 발견 희소는 대상 코드 성격이 주 원인 | 자료조사 경위에 기록 |

## 요구사항 충족 매트릭스

> 동작 보존 검증 원칙: "치환 원형 잔존 grep 0" + "렌더 DOM(클래스·a11y) 불변" + "기존 테스트 무수정 green".

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | F1 `KebabButton` 공용화 + 두 호출부 수렴 | ✅ | 신규 `shared/ui/KebabButton.tsx`(base + `open ? 'grid' : \`hidden ${revealClass}\`` + `title=common.more`·`aria-haspopup="menu"`·`aria-expanded={open}` 내부 소유, `forwardRef`). `SessionRow.tsx`·`PinnedSection.tsx` 가 `<KebabButton>` 사용, 두 파일에서 raw `<button … name="kebab">` 잔존 grep 0 |
| 2 | 동작 보존(렌더 DOM 불변) | ✅ | SessionRow: `revealClass="group-hover/session:grid"`·`ariaLabel={tr('sessions.menuAria')}`. PinnedProjectRow: `revealClass="group-hover/pinproj:grid"`·`ariaLabel={tr('common.more')}`. base 클래스·`kebab` size 14·`ref`·onClick(stopPropagation+toggle) 수정 전과 동일 — 클래스/속성/아이콘 바이트 동일 |
| 3 | 게이트 green | ✅ | 아래 "게이트 재실행 결과" — lint 0 error·typecheck 3분할 0·vitest **1059/1059**·scripts 25/25·boundaries 0·신규 의존성 0·IPC 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (베이스라인 분리 아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 3/3 |
| 레이어 경계 위반 0 | ✅ | — | boundaries lint 0 (`shared/ui` 최하위층) |
| 문서 형식/링크/한국어 | ✅ | — | 준수 |
| AGENTS.md 위생 스캔 | — | — | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 동작 보존 리팩토링 — 해당 최소 |
| UI/UX 시각 검증 | ✖ | ✅ | 사이드바 케밥(최근 대화·고정 프로젝트) hover 노출·메뉴 열림 1회 실기 확인 권장(DOM 불변이라 시각 무변화 확인) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        → 0 error, 1 warning(기존 0102 TanStack↔React Compiler)
$ npm run typecheck             → node/web/test 3분할 모두 0
$ npx vitest run                → 1059/1059 passed (135/136 파일)
                                  ※ chat-turn.continuity.test.ts 1스위트 로드 실패
                                    = electron 바이너리 egress 403 환경 베이스라인
                                    (0128~0130 verify 와 동일, 코드 무관)
$ node --test scripts/*.test.mjs → 25/25 pass
```

> 참고: 본 세션은 electron postinstall(바이너리 다운로드)이 프록시 403 이라 `npm ci --ignore-scripts`
> 로 설치 후 `node scripts/ensure-sqlite-abi.mjs node` 로 better-sqlite3 ABI 를 리빌드해 DB 스위트를
> green 으로 돌렸다. 남는 1스위트(continuity)는 electron 바이너리 자체가 필요해 CI(egress 열림)가 최종.

## PHASES.md 정합성

- Phase 4 표에 0131 행 승격(커밋 `d65d1f7`), INDEX 행 `verify/PASS`. 형식 확인 ✅.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 4관점 병렬 에이전트가 세션 한도로 실패 — 인라인 전수 리뷰로 대체했으나 4기 병렬만큼의 독립 교차검증은 아니다. 다만 대상 코드가 리팩토링 계열이라 표면적 발견이 희소한 것이 주 원인이고, 신규/대폭 변경 파일(신규 shared 유틸·0129 PinnedSection·0121 Modal/Button/Popover·0130 login·engine/project 컴포넌트·chatStore continuity)을 전수 대조했다.
- 구현 단계: `KebabButton` 의 Tailwind group-variant 전제(호출부 리터럴)를 주석으로만 남겼다 — 잘못된 `revealClass` 를 넘기면 노출이 깨질 수 있으나, 두 호출부가 유일 소비자이고 typecheck/lint + 실기 1회로 갈음.
- 검증 단계: 케밥은 순수 시각 컴포넌트라 단위 테스트가 없다 — DOM 불변(클래스·속성 바이트 동일)을 코드 대조로 확인했고, 최종 시각 확인은 사람 실기.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 파생 이슈 없음(단일 finding, 동작 보존). 사람 확인 대기: 사이드바 케밥 hover/메뉴 실기 1회·PR 머지.

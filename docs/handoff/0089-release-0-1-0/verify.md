# Verify — 0089-release-0-1-0

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0089-release-0-1-0` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `3495770` |
| 라운드 | 1 |
| 상태 | PASS (코드 범위 — AC7 릴리즈 실행은 PR 머지 후 후속 절차) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견: `gate.ts` 모듈 경계 상수는 prod dead-code 제거 불가 → 설계 수정 r1(인라인 가드) | 타당 — 1차 빌드 grep 로 `SSO로 로그인` 잔존 실측, 수정 후 0건 재실측 | AC1 소급 수정 반영, 매트릭스 #1 증거로 채택 |
| 선조치 ⚠️ #2 SSO 스텁 문자열 번들 잔존 | 도달 불가(호출 UI 부재) 확인 — 비차단 | 파생 이슈 불요(실 SSO 배선 시 자연 해소, plan 비범위 명시) |
| 선조치 ⚠️ #3 더미 업데이트 mock 문자열 잔존(0086 기존) | 본 핸드오프 이전부터 존재·도달 불가 — 비차단 | 파생 이슈 불요(비범위) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | prod 로그인 게이트 비활성 (인라인 `import.meta.env.DEV` 가드, 설계 수정 r1) | ✅ | `RootGate.tsx` `gatePassed = !import.meta.env.DEV \|\| bypass \|\| authenticated` + 렌더/effect 2곳. 번들 grep `SSO로 로그인` 0건 |
| 2 | dev 동작 무변경 (게이트·SSO 스텁·디버그 패널·bypass 토글) | ✅ | DEV=true 시 `!true \|\| b \|\| a` ≡ 기존 `b \|\| a` (동치). `LoginFrame.tsx:72` DebugPanel·`SsoDebugSection` 무변경 |
| 3 | prod 부트 실패 셸 유지 + LoginView 미렌더 | ✅ | `RootGate.tsx` `bootPhase === 'failed'` 분기 유지, `LoginFrame.tsx` `{import.meta.env.DEV && <LoginView />}` |
| 4 | 디버그 패널 prod 제거 회귀 없음 | ✅ | 번들 grep `로그인 우회`·`Wire 메시지` 0건, main 번들 `orca:debug` 0건 |
| 5 | package.json 메타데이터 실값 + version 0.1.0 유지 | ✅ | `app/package.json:2-7` — description/author(muzaby)/homepage(repo URL), version `0.1.0` 불변 |
| 6 | 게이트 통과 (lint/typecheck/test/build) | ✅ | 아래 §게이트 재실행 결과 |
| 7 | 릴리즈 실행 (머지 후 v0.1.0 태그 → release.yml → draft 자산 3종) | ⏳ 후속 | PR 머지 대기 — 사람 게이트(머지 승인·draft Publish) 뒤에만 수행 가능. 절차는 plan §설계·release-operations.md |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 충족 + AC7 후속 |
| 레이어 경계 위반 0 | ✅ | — | lint(boundaries) 0 — app→features/login 하향만 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 정합 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 게이트 스킵·메타데이터·릴리즈 범위 모두 라이브 세션에서 사용자 확정 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기: 설치본 첫 실행(로그인 없이 진입)·dev 게이트 실기 |
| PR 머지 승인 · draft Publish | ✖ | ✅ | 사람 게이트 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # ✅ 0 (eslint boundaries 포함)
$ npm run typecheck             # ✅ node/web/test 3종 0
$ npx vitest run                # ✅ Tests 773 passed (773) — Test Files 3 failed = electron
                                #    바이너리 403 프록시 차단 환경 제한(0019/0083/0087 동일 계열, 변경 무관)
$ node --test "scripts/"*.test.mjs   # ✅ 24/24
$ npx electron-vite build       # ✅ (typecheck 선행 완료 상태에서 실행)
$ grep 번들 검증                 # 'SSO로 로그인'·'로그인 우회'·'Wire 메시지' 0건 / main 'orca:debug' 0건
```

## 위생 검토

- AGENTS.md 변경 없음. plan/verify 에 키/토큰/비밀 없음.

## PHASES.md 정합성

- 0089 행을 페이즈 표 말미(0088 다음)에 승격, 커밋 hash 기재. INDEX 행 `verify/PASS` 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 모듈 경계 상수의 Rollup 폴드 한계를 사전 조사에서 놓침 — 번들 grep 검증 단계를 계획에 넣어둔 덕에 구현 턴에서 잡힘(검증 가능한 AC 의 가치 재확인).
- 구현 단계: 특이사항 없음. dead 스텁 문자열(⚠️ #2/#3)은 도달 불가 확인으로 갈음.
- 검증 단계: Windows 실 설치본 검증은 이 환경에서 불가 — release.yml(windows-latest) + 사용자 수동 체크리스트(release-operations.md)에 위임.

## 결론 / 다음 단계

- 상태: **PASS** (코드 범위). PHASES 승격 완료.
- 다음: push → PR 생성 → 사용자 머지 → 머지 커밋에 `v0.1.0` 태그 push → release.yml green·draft 자산 3종 확인 → **draft Publish = 사용자**(수동 시나리오 체크리스트 포함, release-operations.md §릴리스 절차 5–6).

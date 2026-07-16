# Verify — 0113-ci-pr-win-path-test-fix

> 정본 규칙 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0113-ci-pr-win-path-test-fix` |
| 검증자 | Claude Code |
| 일자 | 2026-07-16 |
| 대상 커밋 | `<impl-hash>` (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS (로컬 게이트 범위) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 우선순위 블록은 `process.platform` 미mock → `bin` 을 런타임 platform 에서 파생 | 타당 | 구현이 `const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'` 로 반영, 기준 1 증거로 확인 |
| 선조치 #1: `path.win32` 시뮬레이션으로 회귀 사전확인 | 타당 | 매트릭스 기준 1 증거에 시뮬 결과 첨부 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | POSIX 테스트 4건 호스트-독립화 | ✅ | `claude-executable.test.ts` line 30·55·116·145(`join(...)`·`bin`). win32 시뮬 4/4 PASS(findOnPath posix·officialInstallPath posix·priority1·priority2) |
| 2 | 소스 무변경 | ✅ | `git status` — `claude-executable.ts` 변경 없음 |
| 3 | `ci.yml` PR 트리거(paths 동일) + 주석 | ✅ | `.github/workflows/ci.yml` `on.pull_request.paths`(`app/**`·`.github/workflows/**`) + 헤더 갱신 |
| 4 | `app/AGENTS.md` CI 표 갱신 | ✅ | CI 표 `ci.yml` 행: `main push + 모든 PR + 수동 dispatch`, "PR CI 추가(0113 — 0088 supersede)" |
| 5 | 로컬 게이트 green | ✅ | vitest 대상 17/17 · lint 0 error(1 pre-existing warn) · typecheck node/web/test 3/3 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/대상 test | ✅ | — | green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 5/5 |
| 레이어 경계 위반 0 | ✅ | — | 테스트/워크플로/문서만 — 영향 0 |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 비밀/이메일/IP 혼입 0 |
| **전체 `npm test`(DB 스위트 포함)** | ✖ egress 차단 | — | **windows CI 몫** |
| **windows-latest 실기(gate green)** | ✖ | ✅ | **PR CI 최종 판정 대기** |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ ./node_modules/.bin/vitest run src/main/adapters/claude-executable.test.ts
 Test Files  1 passed (1)   Tests  17 passed (17)

$ npm run lint       → ✖ 1 problem (0 errors, 1 warning[pre-existing, useTranscriptVirtualizer])
$ npm run typecheck  → typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅

$ node -e '<path.win32 시뮬>'  →
 findOnPath posix: PASS / officialInstallPath posix: PASS
 priority test1 (PATH wins): PASS / priority test2 (official fallback): PASS
```

> 전체 `npm test`(better-sqlite3 DB 스위트)와 windows-latest 실기는 egress 차단 환경에서 불가 — 실제 PR CI(windows, egress 열림)가 최종 권위. 이는 환경 제약이지 코드 회귀가 아니다(`app/AGENTS.md` ABI 게이트 가이드).

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴: 혼입 0 (CI 표 문구·트리거 설명만).
- 변동성/일회성/장문 혼입: 없음 — 트리거 규칙(영속 규칙)만 갱신.

## PHASES.md 정합성

- 본 작업은 CI 위생 성격 — PASS(windows CI green 확인) 후 `docs/PHASES.md` 반영은 관례대로. PR#/커밋은 push 후 INDEX 기재.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: Windows-only 실패라 로컬 재현 불가 리스크를 처음부터 명시 — 적절.
- 구현: 소스 무변경·기존 패턴 확장으로 최소 diff.
- 검증: 이번 verify 는 리눅스 로컬 + win32 시뮬까지만 — **진짜 최종 증거는 PR 의 windows-latest gate green**(사람/CI 확인 대기). 이 한계를 책임표에 분리 기록.

## 결론 / 다음 단계

- 상태: **PASS**(로컬 게이트 + win32 시뮬 범위). windows-latest PR CI green 이 최종 확정 — PR 생성 후 관찰.
- Next-Action: `none`(구현 완료). windows CI 결과 확인은 PR 활동 구독으로.

# Verify — 0005-title-completion-fixes

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0005-title-completion-fixes` |
| 검증자 | Claude Code |
| 일자 | 2026-06-10 |
| 대상 커밋 | `c13bd44` (코드) + `5f6e0e1` (규칙 문서) |
| 라운드 | 1 |
| 상태 | PASS |

> 주의: 본 작업은 구현 주체 분담 규칙(비기능=Claude)의 첫 적용으로 **구현자와 검증자가 동일(Claude)** 하다. 기계 판정 항목은 grep/게이트 출력으로 객관화했고, 가치판단 항목(실제 Haiku 모델 사용 확인 등)은 사람 검증으로 명시 분리했다.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `CLAUDE_TITLE_MODEL === 'haiku'` | ✅ | `claude-code.ts:43` `const CLAUDE_TITLE_MODEL = 'haiku'` |
| 2 | options 에 `settingSources` 키 부재 | ✅ | `grep -n "settingSources" claude-code.ts` → 주석 1건만 매칭(코드 키 0건) |
| 3 | model = `CompleteRequest.model` 단일 채널 | ✅ | `claude-code.ts:159` `private async runCompletion(req: CompleteRequest)` — 위치 인자 1개 |
| 4 | 재시도: 1차 `'haiku'` → 비-abort 실패 시 warn + model 생략 1회 / `isLikelyModelSelectionError` 삭제 | ✅ | `claude-code.ts:150-156` try/catch (`req.signal?.aborted` rethrow → `console.warn` → `model: undefined` 재시도); `grep isLikelyModelSelectionError` → 0건 |
| 5 | 분담 규칙 3개 문서 반영 | ✅ | 루트 `AGENTS.md` "협업 워크플로우" 구현 주체 분담 항목, `docs/handoff/AGENTS.md` 역할 표 + 인용 블록, `docs/git-template.md` 필드 표·작성 규칙 (커밋 `5f6e0e1`) |
| 6 | 게이트 통과 | ✅ | 아래 게이트 결과 — lint ✅ / typecheck ✅ / test 283 passed |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 통과 (283 tests) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | main 단일 파일 변경 — boundaries 영향 없음, lint 통과 |
| 문서 형식/링크/한국어 | ✅ | — | 한국어·표 위주 유지 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 0건 (아래 위생 검토) |
| **실제 'haiku' 모델로 응답 생성 확인** | ✖ (환경상 실 호출 불가) | ✅ | **사람 확인 대기** — 새 채팅 첫 턴 후 제목 생성 로그/사용량에서 haiku 사용 확인 |
| settings env 적용 확인 (실환경) | ✖ | ✅ | 사람 확인 대기 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 피드백 3건 원문과 1:1 대응 |
| 신규 의존성 승인 | — | — | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint      : eslint --cache --fix ./src → 통과 (출력 0)
typecheck : tsc --noEmit (node + web) → 통과
test      : vitest run → Test Files 41 passed (41) / Tests 283 passed (283)
```

> 참고: 본 검증 환경에서 better-sqlite3 prebuild 가 Electron ABI(140)로 깔려 있어 Node 구동 vitest 와 불일치 → `npm rebuild better-sqlite3` 후 전체 통과. 저장소 코드와 무관한 로컬 환경 사항.

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: 변경된 `AGENTS.md`·`docs/handoff/AGENTS.md` 에서 해당 패턴 0건.
- 변동성/일회성 정보 혼입: 없음 — 추가분은 영속 규칙(구현 주체 분담)만.

## PHASES.md 정합성

- 본 작업은 0004 의 후속 버그수정으로 PHASES 행을 새로 만들지 않는다(plan 메타 명시). PHASES 무변경 — 정합.

## 결론 / 다음 단계

- 상태: **PASS**. INDEX `verify/PASS` 갱신.
- 사람 확인 항목: 실환경에서 ① 새 채팅 첫 턴 후 자동 제목이 haiku 로 생성되는지(사용량 패널/로그), ② settings env 가 title completion 에 적용되는지.

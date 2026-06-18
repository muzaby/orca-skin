# Verify — 0030-system-prompt-policy-structure

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0030-system-prompt-policy-structure` |
| 검증자 | Claude Code |
| 일자 | 2026-06-18 |
| 대상 커밋 | (본 커밋) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `prompts/` 신설 + `buildAppend` 단일 문자열 | ✅ | `app/src/main/prompts/{policies/python-runtime.md,registry.ts,loader.ts,buildAppend.ts,platformHints.json,platformHints.ts,index.ts}`. `buildAppend.ts:26` `.join('\n\n')` → string |
| 2 | python-runtime 바이트 동일 + 상수 제거 | ✅ | `loader.test.ts` "python-runtime 본문이 구 PY_AGENT_RULES 와 바이트 동일" PASS. `runtime/env.ts` 상수·`runtime/index.ts` export 삭제. `grep PY_AGENT_RULES app/src` → prompts 모듈/테스트의 이주-출처 주석 외 0건 |
| 3 | loader `.md?raw` + 정합 검증 throw | ✅ | `loader.ts:8` `./policies/python-runtime.md?raw`; `assemblePolicies` 누락/잉여 throw. `loader.test.ts` 누락·잉여·트림 3케이스 PASS |
| 4 | builder `stableAppend` + 출력 바이트 동일 | ✅ | `builder.ts` 생성자 `stableAppend: string`; 조립 `instructions ? \`${instructions}\n\n${this.stableAppend}\` : this.stableAppend` — 구 `pyAgentRules` 와 동일 형태(순서 보존) |
| 5 | router startup 주입 + 무캐시 | ✅ | `router.ts` `buildAppend({platform: process.platform}, loadPolicies())` → `stableAppend` 주입. DB 지침은 `builder.build()` 가 매 턴 조회(무캐시 불변) |
| 6 | 순수 단위 테스트 | ✅ | `buildAppend.test.ts`(6) + `loader.test.ts`(3) = 9 PASS (electron 비의존) |
| 7 | 교정 가이드 + §5 OQ-A/B/C | ✅ | `docs/arch/backend/system-prompt.md` §1~5 — §5 가 settingSources/env분리/옵션캐싱을 분석+권고(현행 유지)+게이트(사용자 결정 후 별도 핸드오프)로 등재 |
| 8 | 참조 정정 5문서 | ✅ | `docs/AGENTS.md`(인벤토리 행)·`adapters.md §1.4`·`standardization.md §5.4`·`terms.md`·`GLOSSARY.md` PY_AGENT_RULES → prompts/ |
| 9 | 게이트·경계·의존성 | ✅ | lint ✅ / typecheck(node+web+test) ✅ / test 406/406. prompts 상위 import 0(경계 위반 0). 신규 의존성 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck ✅ / test 406/406 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 충족 |
| 레이어 경계 위반 0 | ✅ | — | prompts 상위 import 0, lint boundaries 통과 |
| 문서 형식/링크/한국어 | ✅ | — | docs 톤 준수, 링크 상대경로 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0 |
| 무회귀(바이트 동일) | ✅ 테스트 잠금 | — | loader.test PASS |
| 버킷2 Open Questions(OQ-A/B/C) | ✖ 단독 결정 금지 | ✅ 결정 | **사람 확인 대기** — 현행 유지 권고, 변경 시 별도 핸드오프 |
| 실환경 턴 1회 정책 append 적용 | ✖ | ✅ | **사람 확인 대기** |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        → ✅ (eslint --cache --fix, 0 error)
$ cd app && npm run typecheck   → ✅ node + web + test 3패스 0 error
$ cd app && npm test            → ✅ Test Files 56 passed, Tests 406 passed
  (better-sqlite3 Node ABI 재빌드 후 전체 green — 미재빌드 시 db/queries.test.ts 9건은
   0019 dual-ABI 환경 클래스로 본 변경과 무관)
```

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: 신규 파일·문서에 0건.
- 변동성/일회성/장문 코드설명서 혼입: 없음 — `system-prompt.md` 는 결정·구조 중심, 변동성 이력은 미포함.

## PHASES.md 정합성

- 완료 행을 페이즈 표로 승격(비기능 = Claude 직접 구현). INDEX `0030` verify/PASS.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 9/9, 게이트 4종 통과, 경계·의존성 0.
- 사람 확인 대기: 버킷2 OQ-A/B/C 재검토 결정(현행 유지 권고) · 실환경 정책 append 적용.

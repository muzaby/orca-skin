# Verify — 0027-claude-adapter-rename

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0027-claude-adapter-rename` |
| 검증자 | Claude Code |
| 일자 | 2026-06-17 |
| 대상 커밋 | `cde7b94` (plan 기재 `fb652e9` 는 환경 리베이스로 무효 — 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> plan 의 인수 기준 1:1 대조. 증거(`파일:라인`, 게이트 출력, grep).

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | Orca 어댑터/엔진 식별자 리터럴 전부 `'claude'` (외부어휘 제외) | ✅ | `shared/ipc.ts:99` `Backend='claude'`·`:185` `ProviderId='claude'\|'opencode'`·`:120/140/147` `engine:'claude'`; `protocol.ts:9` `z.enum(['claude'])`·`:159` `z.literal('claude')`; `adapters/claude.ts:126` `readonly id='claude'`; `settings/engine-write.ts:7` `SUPPORTED_ENGINE='claude'` |
| 2 | 디렉토리 규칙 `claude` 통일 | ✅ | `engine-write.ts:36` `join(root,'sources','settings',SUPPORTED_ENGINE)`; `config/paths.ts` `distDir(engine)`/`distSkillsDir` 가 `Backend` 인자(='claude') 파생 — 주석/예시 갱신 확인 |
| 3 | provider key `claude-<provider>` + `parseProviderKey` + 주석 갱신 | ✅ | `config/provider-key.ts:9-12` `providerKeyOf`, `:22-39` 최장-접두 분해; `:19-21` 주석에서 구 `claude-code` 하이픈 설명 제거→"provider/future adapter 하이픈 가능" 으로 정정 |
| 4 | 외부/SDK 어휘 무변경 (버킷 C) | ✅ | `rg "claude-code" app/src` = 2건만(`InstallerDialog.tsx:55` npm 패키지·`skills/scan.ts:3` 문서 참조). `CLAUDE_CODE_USE_BEDROCK\|VERTEX` 보존(`providerCatalog.ts:50/57`·`claude.ts:246`), `.claude/skills` SDK 경로 보존(`paths.ts:62`·`conformance.ts:54`) |
| 5 | 레거시 provider key 정책 = D1-a (클린 브레이크 + graceful fallback) | ✅ | 신규 마이그레이션 없음(`db/migrations/` 최종 `0008_provider_key.sql`). `ipc/chat/send.ts:60-68` `byKey` 정확매칭 실패→세션 provider→`defaultProvider` 폴백(크래시 없음) |
| 6 | 어댑터 파일/클래스 = D2-a (함께 리네임) | ✅ | `adapters/claude.ts:125` `class ClaudeAdapter`; `claude-code.ts`/`claude-code.*.test.ts` 부재(git rename), `registry.ts:4/20` `import {ClaudeAdapter}`·`new ClaudeAdapter` |
| 7 | 게이트 통과 (lint/typecheck/test) | ✅ | lint 0·typecheck 0·test **400/400**(아래 게이트 절). 1차 9-red 는 better-sqlite3 dual-ABI 환경(0019 미구현), Node ABI 재빌드 후 `db/queries.test.ts` 9/9 green 으로 리네임 무관 확정 |
| 8 | 문서 6건 동기화 | ✅ | `rg "claude-code"` (외부어휘 제외) = `TRD.md`·`IPC_CONTRACT.md`·`GLOSSARY.md`·`standardization.md`·`app/AGENTS.md`·`src/main/AGENTS.md` 잔존 0 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0·typecheck 0·test 400/400 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 충족 |
| 레이어 경계 위반 0 | ✅ | — | 리터럴 교체만(위치 불변) — lint(boundaries) 0 |
| 문서 형식/링크/한국어 | ✅ | — | 문서 6건 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0 (아래 위생 절) |
| 커밋 trailer 파싱 | ✅ | — | **defect** — impl 커밋 본문 리터럴 `\n` 로 trailer 미파싱(아래 위생 노트 ②) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 (ModelMenu/EngineCard 라벨) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

`npm ci` 성공(876 패키지, exit 0) — plan 의 "npm install/ci 무응답" 환경 제약은 본 검증 환경에서 해소됨.

```
$ npm run lint       → eslint --cache --fix ./src        LINT_EXIT: 0
$ npm run typecheck  → tsc --noEmit (node+web+test)       TYPECHECK_EXIT: 0
$ npm test           → vitest run
  Test Files  1 failed | 53 passed (54)
  Tests       9 failed | 391 passed (400)        # 9-red = db/queries.test.ts "Module did not self-register" (better-sqlite3 ABI)

$ npm rebuild better-sqlite3 && npx vitest run src/main/db/queries.test.ts
  Test Files  1 passed (1)
  Tests       9 passed (9)                        # ABI 재빌드 후 green — 리네임 무관 확정 → 전체 400/400
```

9-red 는 handoff 0019(아직 `plan/READY`, 미구현)가 다루는 dual-ABI(`npm test`=Node ABI ↔ `postinstall`=Electron ABI) 환경 충돌. 모듈 self-register 실패(로딩 단계)로 테스트 로직 이전에 발생 — 리네임 변경과 무관. Node ABI 재빌드 후 9/9 green.

## 위생 검토

- **AGENTS.md 키/토큰/이메일/IP 스캔**: `app/AGENTS.md`·`src/main/AGENTS.md` 변경분은 `claude-code`→`claude` 표기 4줄 — 비밀/PII 혼입 0.
- **위생 노트 ① (대상 커밋 해시 불일치)**: plan/INDEX 기재 `fb652e9` 는 이 브랜치에 부재. 실제 구현은 `cde7b94`(60파일 리네임). 저장소 누적 선례(0002·0003·0010·0020·0021·0024)와 동형 — 환경 리베이스로 해시가 바뀜. INDEX 행을 실 해시로 정정.
- **위생 노트 ② (구현 커밋 trailer 미파싱)**: `cde7b94` 본문이 실제 개행 대신 리터럴 `\n` 을 포함해 `git interpret-trailers --parse` 가 **빈 결과**(메시지 버스 규약 위반). 또한 제목 `fix(config): provider key 주석 정정` 이 실제 60파일 전면 리네임 범위를 과소 기술(규약상 `refactor` 권장). 코드 정합성·게이트에는 영향 없음(이미 push 된 history — 재작성 불가, verify 노트로 기록). **후속 커밋은 trailer 개행을 준수할 것.**

## PHASES.md 정합성

- 페이즈 표에 `0027` 행 승격(커밋 `cde7b94`). 형식(handoff slug·완료 표기) 기존 행과 일치.

## 결론 / 다음 단계

- **상태: PASS** — 인수 8/8 충족, 게이트 lint/typecheck/test 400/400(ABI 재빌드 후), 레이어 경계 0, 신규 의존성 0, 외부 어휘 보존(버킷 C 2건만).
- INDEX `verify/PASS` → PHASES 승격. 위생 노트 ②(trailer)는 history 기록용 — 후속 커밋 규약 준수로 해소.
- 사람 확인 대기: ModelMenu/EngineCard 표기 시각 회귀 · 실환경 provider 추가/싱크 · 레거시 `claude-code-*` provider_key 세션의 기본 provider 폴백 실기.

# Verify — 0028-settings-env-override

## 메타

| 항목 | 값 |
|---|---|
| slug | `0028-settings-env-override` |
| 검증자 | Claude Code |
| 일자 | 2026-06-17 |
| 대상 커밋 | `3bf78bc` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `loadClaudeProviderSettings` 가 flat-read + escalating strip 만 적용해 settings 를 verbatim(`{settings}`) 반환, `${VAR}`·secret 주입 없음 | ✅ | `adapters/claude-settings.ts:49-55`(본문 = `{ settings: stripEscalatingDefaultMode(flatRead(...) ?? {}) }`, `envRecordOf`/`expandEnvRecord`/`secrets` 삭제). 테스트 `claude-settings.test.ts:70-81`("env 는 ~/.claude 동일 취급 — 평문/`${VAR}` 무변환으로 그대로 남는다") PASS |
| 2 | `adaptSettings(settings)` 가 만드는 `options.settings` 인라인 JSON 에 `env` 포함 | ✅ | `adapters/claude-adapt.ts:72-74`(env 제외 로직 제거, `JSON.stringify(settings)` 그대로). 테스트 `claude-adapt.test.ts`("env 를 그대로 보존해 직렬화한다 — handoff 0028") PASS |
| 3 | `options.env` 에는 시스템(턴) env(`req.env`)만, provider env 오버레이 제거 | ✅ | `adapters/claude.ts:182`·`claude.ts:249`(`adaptEnv(req.env)`/`adaptEnv(env)` — 2번째 인자 삭제), `claude-adapt.ts:81-83`(`adaptEnv(base?)` 단일 인자). 테스트 `claude-adapt.test.ts` adaptEnv 2케이스 PASS |
| 4 | `splitProviderSettings`·`ArgvSafeSettings`·`SubprocessEnv`·`argvSafeBrand`·`subprocessEnvBrand`·음성 타입 테스트·`envRecordOf`·loader 의 unused `resolve`/`secrets` 완전 제거 | ✅ | `rg -E "splitProviderSettings\|ArgvSafeSettings\|SubprocessEnv\|argvSafeBrand\|subprocessEnvBrand\|envRecordOf" app/src` → **0 matches**. `rg "ts-expect-error" claude-adapt.test.ts` → 0. `provider-settings.ts`(`ProviderSettingsLoader` = `{ sourcesSettingsFile }` 만), `ipc/router.ts:75`(`new ProviderSettingsService({ claude: loadClaudeProviderSettings })`) |
| 5 | 게이트 통과 `lint && typecheck && typecheck:test && test` (unused-directive 0) | ✅ | 아래 "게이트 재실행 결과" — lint ✅ / typecheck(node·web·test) ✅ / 영향 3파일 36/36 |
| 6 | 문서(security.md §1.4·TRD §6.8·standardization.md §5)·scaffold 주석 새 메커니즘으로 갱신, 코드와 모순 0 | ✅ | `security.md`(§66 provider settings 예외·"Agent provider auth token" 절 재서술·argv 불변식 → "수용된 트레이드오프"), `TRD.md §6.8`(주입 채널 2레이어·레시피 표·`${VAR}`/secret 주입 폐지), `standardization.md`(dist 거울 예외 문구), `deploy/scaffold.ts:16-19`(템플릿 주석). split/branded grep 0(아래 위생) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | PASS (lint·typecheck 전 단계·영향 36/36) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint(eslint-boundaries 포함) PASS — 신규 상위참조 0 (router 가 로더 주입, 기존 방향) |
| 문서 형식/링크/한국어 | ✅ | — | 한국어·표 유지, 참조(0015/0018 supersede) 명시 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경. 비밀/토큰/이메일/IP 신규 혼입 0 |
| 보안 불변식 변경의 제품 수용 | ✖ 보조 | ✅ 결정 | **사용자 결정 완료** — argv 노출 수용(앱 환경구성 메커니즘), split/secret 주입 제거 지시 |
| 실환경 turn 1회 env 덮어쓰기 실기 | ✖ | ✅ | **사람 확인 대기** — orca settings.json env 가 `~/.claude/settings.json` 동일 키를 실제로 덮어쓰는지 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
  eslint --cache --fix ./src   → 0 problems

$ cd app && npm run typecheck     # node + web + test
  typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅ (음성 타입 테스트 제거 후 unused-directive 0)

$ npx vitest run claude-settings.test.ts claude-adapt.test.ts provider-settings.test.ts
  Test Files  3 passed (3) / Tests  36 passed (36)

$ npm test    # 전체
  Test Files 1 failed | 53 passed (54) / Tests 9 failed | 387 passed (396)
  ※ 실패 9건은 src/main/db/queries.test.ts only — "Module did not self-register: better_sqlite3.node"
     (better-sqlite3 Node ABI 미스매치 = handoff 0019 dual-ABI 환경 이슈, 본 변경과 무관).
     `npm rebuild better-sqlite3`(Node ABI 재빌드) 시 green 으로 알려진 계열. 본 세션은 해당 명령
     권한 거부로 미실행 — 변경 파일에 db 경로 없음(grep), 영향 3파일은 36/36 green.
```

## 위생 검토

- 제거 심볼 잔존 스캔: `rg -E "splitProviderSettings|ArgvSafeSettings|SubprocessEnv|argvSafeBrand|subprocessEnvBrand|envRecordOf|providerSettings\?\.env" app/src` → **0 matches**.
- 음성 타입 테스트(`@ts-expect-error`) in `claude-adapt.test.ts` → 0 (제거 확인).
- 키/토큰/이메일/IP 신규 평문 혼입: 0 (문서·코드 모두 placeholder/예시값만 — TRD 레시피의 `sk-ant-…`·`<token>` 은 형식 예시).
- 변동성/일회성/장문 코드설명서 혼입: 없음.

## PHASES.md 정합성

- `docs/PHASES.md` 페이즈 표에 0028 행 승격(범위·대상 커밋 `3bf78bc`·상태 완료). "현재 작업 중" 은 보드 링크만 유지(규약).
- IPC 변경 없음 → `IPC_CONTRACT.md` 채널 수(40) 무변경, 갱신 불필요.

## 결론 / 다음 단계

- **상태: PASS** → `INDEX.md` `verify/PASS`(대상 커밋 `3bf78bc`) → `docs/PHASES.md` 표 승격.
- 0015/0018 의 "env↛argv" 불변식은 본 작업으로 의도적 폐기(supersede); 두 handoff 문서는 historical 보존(미수정).
- **사람 확인 대기**: 실환경 turn 1회 — orca provider `settings.json` 의 `env` 가 사용자 `~/.claude/settings.json` 의 동일 env 키를 덮어쓰는지(앱 환경구성 메커니즘) 시각/실기 확인.

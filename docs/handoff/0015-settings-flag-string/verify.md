# Verify — 0015-settings-flag-string

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(버그수정) — Claude 설계+구현+검증 단독 수행(0005/0011~0014 전례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0015-settings-flag-string` |
| 검증자 | Claude Code |
| 일자 | 2026-06-12 |
| 대상 커밋 | `210f0ac` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 로더 계약 `{settings, env}` + `ResolvedProviderSettings.env` + 서비스 env 캐시 | ✅ | `settings/provider-settings.ts` `ProviderSettingsLoader`/`ResolvedProviderSettings`/`CacheEntry`·`resolve()` env 동반; `provider-settings.test.ts` "blob({settings, env})으로 돌려준다" |
| 2 | claude 로더가 settings(env 제거)/env 분리 반환 — 미확장 `${VAR}` 유출 0 | ✅ | `adapters/claude-settings.ts` 말미 `{settings, env}`; `claude-settings.test.ts` "${VAR} 를 확장해 env 로 분리"/"settings.env 유출 0" |
| 3 | `adaptSettings` 가 `JSON.stringify` 문자열 주입(빈 settings 생략, `settingSources:[]` 불변) | ✅ | `adapters/claude-adapt.ts` `adaptSettings`; `claude-adapt.test.ts` "인라인 JSON 문자열로 직렬화"(typeof string + round-trip parse) |
| 4 | 신규 `adaptEnv(base, blob)` = `mergeEnvLayers` 오버레이(provider 우선, 빈 결과 `{}`) | ✅ | `claude-adapt.ts` `adaptEnv`; `claude-adapt.test.ts` adaptEnv 3케이스(빈 생략/오버레이 우선/base 단독) |
| 5 | claude-code.ts 양 경로 `adaptEnv` 사용, settings 주입은 `adaptSettings` 단일 출처·문자열만 | ✅ | `adapters/claude-code.ts` sendMessage/runCompletion `...adaptEnv(...)`; `grep -n "{ env" claude-code.ts` → 직접 env 주입 0 |
| 6 | send/title-generation/misc/turn-registry 무변경 (renderer/IPC 0) | ✅ | `git show --stat 210f0ac` — `ipc/**`·renderer 파일 0건, blob 패스스루 |
| 7 | 게이트 + 테스트 갱신/신규 | ✅ | 아래 게이트 — 375 passed(372→+3) |
| 8 | 문서 갱신 (TRD §6.8 · security.md · standardization.md §5.1 · PHASES · INDEX) | ✅ | TRD "런타임 주입(격리모드)" 두 갈래 분리절 · security.md "argv 평문 불변식" · standardization §5.1 flag settings 문자열 노트 · PHASES/INDEX 행 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 PASS |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계 위반 0 | ✅ | — | renderer 변경 0, SDK 어휘 격리 유지(claude-adapt/claude-settings/claude-code) |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| argv 평문 불변식 (settings 문자열에 비밀 미포함) | ✅ 코드 | ✅ 실기 확인 | env 는 adaptEnv 로만 — 코드상 보장. 실기 process-list 확인은 사람 |
| **settings 가 실제 적용되는가** (model/permissions, `--settings '<json>'` 수용) | ✖ | ✅ `npm run dev` + 턴 1회 | **사람 확인 대기 (1순위)** — 0014 의 조용한 실패를 고친 핵심이라 실기 필수 |
| **env(ANTHROPIC_API_KEY 등)가 세션에 반영되는가** | ✖ | ✅ 실기 | 사람 확인 대기 |
| OAuth 자격증명 격리모드 동작 (0014 항목 유효) | ✖ | ✅ 실기 | 사람 확인 대기 |
| bedrock/vertex 실환경 env 레시피 | ✖ | ✅ 실기 | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test && npm run build
lint      : PASS (0 problems)
typecheck : PASS (node + web)
test      : 50 files, 375 passed (375)   # 0014 의 372 → +3 (adaptEnv 3케이스)
build     : electron-vite build ✓ (out/)
```

(참고: `db/queries.test.ts` 는 better-sqlite3 Node ABI 재빌드 후 green — 0010 r2/0014 와 동일 환경 조치, 코드 무관.)

## 위생 검토

- 키/토큰/이메일/IP 패턴: 신규 코드·테스트·문서에 실비밀 0 (플레이스홀더 `${VAR}`/가짜 토큰 `secret-token`/`prov` 만).
- argv 평문 불변식: `adaptSettings` 는 `blob.settings`(env 제거 객체)만 직렬화, `blob.env` 는 `adaptEnv` 가 subprocess env 로만 사용 — 평문 비밀이 argv 로 새지 않음을 코드로 확인.

## PHASES.md 정합성

- 형식/커밋 기재 확인: 0014 행 다음에 0015 행 추가, 대상 커밋 `210f0ac`. INDEX 와 동기화.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. Next-Action: none.
- 사람 확인 대기 1순위: **실기 턴 1회로 settings(model/permissions) 적용 + env 반영 확인** — 0014 의 조용한 실패(`--settings "[object Object]"`)를 고친 것이 본 핸드오프 핵심이므로 GUI 실행 검증이 종결 조건이다.

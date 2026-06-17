# Plan — 0028-settings-env-override

> 비기능(버그수정) = **Claude 직접 구현**. plan → impl → verify 를 Claude 가 순차 수행한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0028-settings-env-override` |
| 작성자 | Claude Code |
| 일자 | 2026-06-17 |
| 매핑 | PHASES "현재 작업 중" (보드 링크) / PR (미정) |
| 브랜치 | `claude/settings-env-override-fix-3a8jzo` |
| 상태 | DRAFT → READY |

## Context (왜)

`Query()` 는 `settingSources` 에 user/project/local 을 모두 상속(격리 해제, handoff 0023/0024)해 사용자 `~/.claude/settings.json`·skill 을 세션에 끌어온다. 이 상태에서 Orca provider 설정(`~/.config/orca/sources/settings/<adapter>/<provider>/settings.json`)의 `env` 는 **앱 환경구성**으로서 사용자 전역 `~/.claude/settings.json` 의 env 를 덮어써야 한다.

그러나 현재(handoff 0015/0018)는 그 `env` 를 `options.settings` 에서 떼어내(`splitProviderSettings`) `options.env`(subprocess/시스템 env)로만 흘린다. `options.env` 는 시스템 env 레이어라 settingSources 의 `~/.claude/settings.json` env 를 이기지 못한다 → **앱 환경구성이 사용자 전역 설정을 덮어쓰지 못하는 버그**.

**사용자 결정**:
1. provider `settings.json` 은 `~/.claude/settings.json` 과 **똑같은 파일**로 취급한다 — auth key 등은 env 에 직접 적어 관리(Claude 정책 그대로). 따라서 Orca 고유의 **`${VAR}` 확장·secret-store 토큰 주입(`provider:<key>`→`ANTHROPIC_API_KEY`)을 제거**한다(토큰 저장 UI 미구현 — anticipatory dead code, 기능 영향 0).
2. env 는 `options.settings` 에 **그대로 실어**(settings 레이어 = `~/.claude` 덮어쓰기), `options.env` 엔 시스템(턴) env 만 둔다. argv 평문 노출은 이 앱-환경구성 메커니즘의 **수용된 트레이드오프**(same-user process list 한정). 디스크 평문 0 은 유지(provider settings.json 은 dist 미배포, sources 파일만 verbatim).
3. 위로 인해 0015/0018 의 split 분리·branded 타입·음성 테스트 + `${VAR}`/secret 주입 경로는 **legacy/unused → 제거**한다.

> 본 작업은 handoff **0015 / 0018 의 "비밀(env)↛argv" 불변식을 의도적으로 폐기(supersede)** 한다. 0015/0018 문서는 historical 로 보존(미수정)하고, 정본 문서(security.md·TRD §6.8·standardization.md)를 새 동작으로 갱신한다.

## 인수 기준 (Acceptance Criteria)

1. `loadClaudeProviderSettings` 는 settings.json 을 flat-read + escalating defaultMode strip 만 적용해 `{ settings }` 로 **verbatim** 반환한다 — `env` 는 파일에 적힌 그대로(평문/`${VAR}` 무변환) settings 안에 남는다. `${VAR}` 확장·secret-store 토큰 주입 코드는 존재하지 않는다.
2. `adaptSettings(settings)` 가 만드는 `options.settings` 인라인 JSON 에 `env` 가 **포함**된다.
3. `options.env` 에는 턴/시스템 env(`req.env`)만 실린다 — provider env 오버레이 제거.
4. 다음이 코드베이스에서 **완전 제거**(잔존 import/참조 0): `splitProviderSettings`·`ArgvSafeSettings`·`SubprocessEnv`·`argvSafeBrand`·`subprocessEnvBrand`·음성 타입 테스트(`@ts-expect-error`); claude 로더의 `envRecordOf`·`${VAR}` 확장·secret 주입; `ProviderSettingsLoader`/`ProviderSettingsService` 의 unused `resolve`/`secrets`(=`makeResolver`) 파라미터.
5. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test` (음성 테스트 제거로 unused-directive 에러 0).
6. 관련 문서(security.md §1.4, TRD §6.8, standardization.md §5)·scaffold 주석이 새 메커니즘(provider settings == ~/.claude, env verbatim→settings, argv 노출 수용, `${VAR}`/secret 주입 폐지)으로 갱신되어 코드와 모순 0.

## 범위 / 비범위

- **범위**: provider settings 해석→주입 경로의 env 위치 변경 + Orca `${VAR}`/secret 주입 폐지 + split/branded 레거시 제거 + 그 unused 파라미터 배선 정리 + 테스트/문서 정합.
- **비범위**: `settingSources` 정책(격리 해제 그대로), `disallowedTools`(D1 보류), `stripEscalatingDefaultMode`(env 무관 권한 trust 필터 — 유지), MCP 의 `${VAR}`/secret-store 경로(mcp.json — 무관, 유지), 턴 env(orca.json)의 `expandEnvRecord`/`mergeEnvLayers`(시스템 env 경로 — 유지), 모델선택용 `provider-key.ts`(`parseProviderKey` 등 — 유지), 토큰 저장 UI(미구현이라 손댈 것 없음).

## 설계

### 데이터 흐름 (변경 후)
- 해석: `adapters/claude-settings.ts` → `flatRead` + `stripEscalatingDefaultMode` → `{ settings }`(env verbatim 포함).
- 주입(`adapters/claude.ts` 두 경로 — sendMessage·runCompletion): `adaptSettings(settings)` → `options.settings`(env 포함 인라인 JSON), `adaptEnv(req.env)` → `options.env`(시스템 env).

### 파일별 변경
- **`app/src/main/adapters/claude-settings.ts`** — 본문을 `return { settings: stripEscalatingDefaultMode(flatRead(sourcesSettingsFile) ?? {}) }` 로 축소. `envRecordOf` + env 후처리 블록(`${VAR}` 확장·secret 주입) 제거. import 에서 `expandEnvRecord`·`splitProviderSettings` 제거. 인자에서 `providerKey`/`resolve`/`secrets` 제거. 헤더 주석을 "verbatim(=~/.claude/settings.json 동일 취급)" 으로 갱신.
- **`app/src/main/settings/provider-settings.ts`** — 제거: `argvSafeBrand`/`subprocessEnvBrand`, `ArgvSafeSettings`/`SubprocessEnv`, `splitProviderSettings`, `SecretReader`/`Resolver` import. 신설: `export type ProviderSettings = Record<string, unknown>`. `ResolvedProviderSettings` → `{ providerKey; provider; settings: ProviderSettings }`(env 제거). `ProviderSettingsLoader` → `(args: { sourcesSettingsFile: string }) => Promise<{ settings: ProviderSettings }>`. `ProviderSettingsService` 생성자에서 `makeResolver`/`secrets` 제거(`constructor(loaders, root)`), `resolve()` 는 `{ sourcesSettingsFile }` 만 전달, `CacheEntry`/반환에서 env 제거. `env-merge` 배럴 re-export(`expandEnvRecord`,`mergeEnvLayers`) 유지(turn-env 경로 사용).
- **`app/src/main/ipc/router.ts`** (L74-79) — `new ProviderSettingsService({ claude: loadClaudeProviderSettings })` 로 단순화(`makeResolver`/`secretStore` 인자 제거). `secretStore` 인스턴스 자체는 RouterContext(L106)·MCP 용 유지.
- **`app/src/main/adapters/claude-adapt.ts`** — `adaptSettings(settings?: ProviderSettings)`(JSON 직렬화 그대로, env 포함 가능; 주석에서 "env 제외/argv 차단" 제거). `adaptEnv(base?: Record<string,string>)`(provider-env 2번째 인자 삭제). `mergeEnvLayers`·`SubprocessEnv`·`ArgvSafeSettings` import 제거.
- **`app/src/main/adapters/claude.ts`** (L181-182, L248-249) — `adaptEnv(…, req.providerSettings?.env)` → `adaptEnv(req.env)`/`adaptEnv(env)`. 주변 주석(L172-174, L245-247) 갱신.
- **`app/src/main/adapters/types.ts`·`extensions/types.ts`** — `ResolvedProviderSettings` 에서 env 가 빠지므로 관련 주석("subprocess env 분리")만 정합 갱신.
- **`app/src/main/deploy/scaffold.ts`** (L16-17) — 템플릿 주석을 "env 는 평문/직접 기입(=~/.claude/settings.json 동일, Orca 무변환)" 으로 갱신(템플릿값 `{ env: {} }` 유지).

### 재사용 기존 자산
- `flatRead`·`stripEscalatingDefaultMode` (`adapters/claude-settings.ts`) — 그대로 유지.
- `expandEnvRecord`·`mergeEnvLayers` (`settings/env-merge.ts`) — turn-env(`ipc/chat/send.ts buildTurnEnv`) + MCP 경로가 계속 사용. 배럴 re-export 유지.
- `parseProviderKey`/`providerKeyOf` (`config/provider-key.ts`) — 모델선택 키 어휘, 무관·유지.

### 레이어 경계
- 변경은 L1 domain(`settings/`)·L2 adapters(`adapters/`)·L3 ipc(`ipc/router.ts` 컴포지션 루트) 내부. 상위참조 신설 없음 — `router.ts` 가 로더를 주입하는 기존 방향 유지(`eslint-plugin-boundaries` 무위반 예상).

## 영향 받는 파일

- 코드: `app/src/main/adapters/{claude-settings,claude-adapt,claude,types}.ts`, `app/src/main/settings/provider-settings.ts`, `app/src/main/ipc/router.ts`, `app/src/main/extensions/types.ts`, `app/src/main/deploy/scaffold.ts`
- 테스트: `app/src/main/adapters/{claude-settings,claude-adapt}.test.ts`, `app/src/main/settings/provider-settings.test.ts`
- 문서: `docs/arch/backend/security.md`, `docs/TRD.md`, `docs/arch/backend/standardization.md`
- 핸드오프: 본 `plan.md` + `verify.md`, `docs/handoff/INDEX.md`, `docs/PHASES.md`

## 참고 문서

- `docs/arch/backend/security.md §1.4` (argv/secret 불변식 — 본 변경으로 재서술)
- `docs/TRD.md §6.8` (provider settings 런타임 주입)
- `docs/arch/backend/standardization.md §5` (배포·주입 — split 언급 갱신)
- `docs/handoff/0010`(provider-key)·`0015`·`0018` (supersede 대상 — historical 보존, 본문 미수정)
- IPC 변경 없음 (`IPC_CONTRACT.md` 갱신 불필요 — 채널/페이로드 무변경).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규/갱신 테스트: ① `adaptSettings` 가 env 포함 settings 를 출력 JSON 에 보존, ② `loadClaudeProviderSettings` 가 settings.json env 를 verbatim(`${VAR}` 무변환) 통과.

---

## [구현] 체크리스트 (Claude 직접)

- [ ] `claude-settings.ts` 로더 verbatim 축소 + env 후처리/secret 주입 제거
- [ ] `provider-settings.ts` split/branded 제거 + `ProviderSettings` 타입 + 서비스/로더 시그니처 축소
- [ ] `router.ts` 서비스 생성자 인자 정리
- [ ] `claude-adapt.ts` `adaptSettings`/`adaptEnv` 시그니처·주석 갱신
- [ ] `claude.ts` 두 query 경로 `adaptEnv` 호출 + 주석 갱신
- [ ] `types.ts`/`extensions/types.ts`/`scaffold.ts` 주석 정합
- [ ] 테스트 3종 갱신(음성 타입 테스트 제거 포함)
- [ ] 문서 3종(security/TRD/standardization) 갱신
- [ ] 게이트 4종 통과
- [ ] INDEX/PHASES 갱신 + 구현 커밋(trailer) push

## [구현] 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (구현 후 기입) |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | (구현 후 기입) |
| 블로커 / 역질문 | (구현 후 기입) |
| 대상 커밋 | (구현 후 기입) |

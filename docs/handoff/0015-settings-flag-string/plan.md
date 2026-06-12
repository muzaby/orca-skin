# Plan — 0015-settings-flag-string

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(버그수정) 작업 — **Claude 직접 구현** 규약 적용 (0005/0011~0014 전례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0015-settings-flag-string` |
| 작성자 | Claude Code |
| 일자 | 2026-06-12 |
| 매핑 | PHASES "provider settings 주입 결함 수정" 행 (0014 후속 버그수정) |
| 상태 | READY (Claude 직접 구현) |

## Context (왜)

0014 가 구축한 격리모드 주입(`query({settings: <객체>, settingSources: []})`)에 **런타임 결함**이 있다 (사용자 보고). 조사 결과:

1. **SDK d.ts 는 `Options.settings?: string | Settings` 로 객체를 허용한다고 명시하지만, 런타임 transport 는 문자열만 지원한다.** 설치본 0.3.143 과 최신 0.3.175 모두 `sdk.mjs` 에서 `options.settings` 참조는 단 1곳 — CLI argv 에 그대로 push (`push("--settings", value)`, 직렬화 없음). **SDK 업그레이드로 해결 불가.**
2. Node `spawn` 은 객체 argv 원소를 `"[object Object]"` 로 강제 변환한다 (empirical 확인 — throw 아님). 즉 CLI 는 `--settings "[object Object]"` 를 받았고 **provider settings 는 적용된 적이 없다** (조용한 실패).
3. `--settings` 플래그는 "JSON 파일 경로 **또는 인라인 JSON 문자열**" 을 받는다 (`docs/spec/claude/cli-reference.md` `--settings` 행 + sdk.mjs 의 sandbox 병합 코드가 인라인 JSON 문자열을 전제). `settingSources: []` 격리와 `resolveSettings({cwd, settingSources:['project']})` 읽기 경로는 유효 — **결함은 주입 채널뿐.**

**수정 방향**: SSOT(`sources/settings/claude-code/<provider>/settings.json`) → dist → 로더 해석 파이프라인은 유지하고, 주입만 ① settings(env 제외) = **인라인 JSON 문자열**(flag 레이어), ② env = **subprocess env** 로 분리한다.

### env 를 settings 문자열에서 분리하는 이유 (구조 결정)

- argv 는 process list 로 같은 사용자에게 가시 — env 에는 secret-store 토큰(`ANTHROPIC_API_KEY`)·확장된 `${VAR}` 값이 들어 있어 **argv 에 실으면 평문 비밀 노출** (security.md 불변식 위반). spawn env 로 전달하면 argv 에 남지 않는다.
- 격리모드(타 소스 0)에서 settings.env(flag 레이어)와 subprocess env 는 효과가 동등 — 0009 claude-env 가 쓰던 검증된 채널.
- 부수 효과: argv 길이(Windows ~32K) 부담 제거 — env 제외 settings 는 소형.

### 검토 후 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| SDK 업그레이드 (0.3.175) | 동일 결함 — `options.settings` 를 직렬화 없이 argv push |
| dist 파일 *경로*를 `--settings` 로 전달 | dist 파일에는 미확장 `${VAR}` env 가 있어 literal 값이 세션 env 로 샘 |
| `handle.applyFlagSettings()` 컨트롤 요청 | 스트리밍 입력 모드에서 첫 메시지 처리와 race — 적용 시점 보장 없음 |

## 인수 기준 (Acceptance Criteria)

1. `ProviderSettingsLoader` 반환 계약이 `{ settings: Record<string, unknown>; env: Record<string, string> }` 로 바뀐다 — `settings` 는 어댑터-네이티브 설정에서 transport-env 를 뺀 것, `env` 는 확장·secret 주입이 끝난 subprocess env 오버레이. `ResolvedProviderSettings` 에 `env` 필드가 추가되고 `ProviderSettingsService` 캐시가 env 를 동반 캐시한다.
2. claude 로더(`adapters/claude-settings.ts`)가 env 후처리(${VAR} 확장 → secret 토큰 → 원본 env 키 치환) 결과를 settings 에 되넣지 않고 `{settings(env 제거), env}` 로 분리 반환한다 — 미확장 `${VAR}` 가 어느 쪽으로도 새지 않는다.
3. `adaptSettings(blob)` 가 `Options.settings` 에 **`JSON.stringify(blob.settings)` 문자열**을 주입한다 (키 0 이면 옵션 생략 — 기존 동작 유지, `settingSources: []` 불변).
4. 신규 순수 함수 `adaptEnv(base, blob)` 가 `mergeEnvLayers(base, blob?.env ?? {})` 로 subprocess env 를 병합한다 (provider env 가 턴 env 를 이김 — 구 claude-env 의 agent-overlay 정책 계승, 결과 없으면 `{}`).
5. `claude-code.ts` 의 sendMessage / runCompletion 양 경로가 `...(env ? {env} : {})` 대신 `...adaptEnv(...)` 를 쓴다 — settings 주입처는 `adaptSettings` 단일 출처이고 문자열만 생산한다.
6. `send.ts`/`title-generation.ts`/`misc.ts`/`turn-registry.ts` 는 blob 패스스루로 **변경 없음** (renderer/IPC 변경 0).
7. 게이트 통과(lint/typecheck/test/build) + 테스트 갱신·신규: `claude-settings.test.ts`(분리 반환 shape), `claude-adapt.test.ts`(JSON 문자열 round-trip · 빈 settings 생략 · `adaptEnv` 병합/우선순위/빈 결과), `provider-settings.test.ts`(서비스 env 캐시·반환).
8. 문서 갱신: TRD §6.8(주입 메커니즘 정정 — 인라인 JSON 문자열 + subprocess env, SDK transport 제약 명기), security.md(argv 비-비밀 / 비밀은 spawn env 근거), standardization.md §5.2 구현 노트, PHASES, INDEX.

## 범위 / 비범위

- **범위**: 위 8 항목. main 프로세스(어댑터 경계 + 로더 계약) + 문서.
- **비범위**: renderer/IPC 변경(0 목표), dist 레이아웃·deployer·scaffold 변경(0014 유지), opencode 로더 구현, SDK 버전 변경.

## 설계

- 주입 채널: `query({ settings: JSON.stringify(<env 제외 effective>), settingSources: [], env: <턴 env + provider env 병합> })`. flag 레이어 의미는 0014 와 동일 — 채널 표현만 객체→문자열.
- **재사용**: `mergeEnvLayers`/`expandEnvRecord`(`settings/provider-settings.ts` 기존 export), 로더의 env 후처리 로직(이동 없이 반환 shape 만 변경), `adaptSettings` 의 키-0 생략 패턴.
- 어댑터-중립 일반화 유지: env 분리는 로더 계약 차원 — opencode 로더도 자기 포맷에서 "settings 채널 vs subprocess env" 분리를 스스로 결정한다.
- 레이어 경계: 전부 main 내부. SDK 어휘는 기존 격리 모듈(`claude-settings.ts`/`claude-adapt.ts`/`claude-code.ts`) 밖으로 새지 않는다.

## 영향 받는 파일

- `app/src/main/settings/provider-settings.ts` (+`provider-settings.test.ts`) — 로더 계약 · `ResolvedProviderSettings.env` · 캐시
- `app/src/main/adapters/claude-settings.ts` (+`claude-settings.test.ts`) — 분리 반환
- `app/src/main/adapters/claude-adapt.ts` (+`claude-adapt.test.ts`) — `adaptSettings` 문자열화 + `adaptEnv` 신설
- `app/src/main/adapters/claude-code.ts` — 양 경로 env 호출부 교체 + 주석 정정
- `docs/TRD.md` · `docs/arch/backend/security.md` · `docs/arch/backend/standardization.md` · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/TRD.md §6.8/§6.8.1` (본 작업으로 정정)
- `docs/spec/claude/cli-reference.md` `--settings` 행 (인라인 JSON 문자열 허용 근거)
- `docs/arch/backend/security.md` (평문 불변식) · `standardization.md §5.2`
- IPC 변경 없음 (채널 36 유지)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 신규/갱신 테스트: 인수 기준 7 참조. 회귀 기준선 372 passed.

## 위험

| 위험 | 완화 |
|---|---|
| CLI 버전별 인라인 JSON `--settings` 파싱 차이 | 공식 CLI 레퍼런스 명시 + sdk.mjs sandbox 병합 코드가 동일 전제. 실패 시 dist 에 env-제거 사본을 추가 배포해 *경로* 전달로 전환 (후속) |
| settings.env(flag 레이어) → subprocess env 의미 차이 | 격리모드라 타 소스와의 우선순위 충돌 없음. 0009 검증된 채널 |
| SDK 가 추후 객체 직렬화 지원 | 문자열은 그때도 유효(`string \| Settings`) — 회귀 없음 |
| 실기 미검증 (settings 적용 여부) | verify "사람 확인 대기" — 턴 1회로 model/permissions 적용 + env 반영 확인. 0014 의 OAuth 격리모드 실기 항목도 그대로 유효 |

---

## [Claude 기입] 구현 체크리스트

- [ ] 인수 기준 1~6 구현
- [ ] 인수 기준 7 게이트 + 테스트
- [ ] 인수 기준 8 문서

## [Claude 기입] 구현 보고

(구현 착수 시 기입)

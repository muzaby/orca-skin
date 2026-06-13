# Plan — 0018-settings-branded-types

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). **구조 견고화 3/3** — 디자인 리뷰(스탭1·2)의 후속 구현.
> 스탭2 **문제 3 (비밀/직렬화 경계가 관례로만)** 의 채택안 **3-A "Branded 타입 + Smart Constructor"** 를 구현한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0018-settings-branded-types` |
| 작성자 | Claude Code |
| 일자 | 2026-06-13 |
| 매핑 | PHASES "구조 견고화(비밀 경계 타입화)" 행 (디자인 리뷰 스탭3) |
| 상태 | READY (다음=Codex — 사용자 지시로 구현은 Codex) |
| 선행 | `0017` 머지 후 착수(분해된 settings 모듈 위에 브랜딩). |

## Context (왜)

0015 버그(provider settings 가 `--settings "[object Object]"` 로 조용히 미적용)의 본질은 *SDK 타입(d.ts)이 보증한 계약 ≠ 런타임 실제 동작* 이었다. 그 수정은 `{settings, env}` 를 분리해 settings 만 argv(인라인 JSON)로, env 는 subprocess env 로 보내는 것이었는데 — **"비밀(API키 등)은 argv 로 가면 안 되고 env 로만" 이라는 불변식이 `delete settings.env` 한 줄 + 주석으로만 지켜진다**(`adapters/claude-settings.ts:108-109` → `claude-adapt.ts:74-81` 에서 `JSON.stringify(blob.settings)` 로 argv 화).

- 누군가 settings 에 비밀 머금는 필드(예: `apiKeyHelper`, 토큰류)를 추가하면 다시 **argv 평문 노출** — 0015 가 고친 바로 그 버그의 변종. **타입이 막아주지 않는다.**

**비유**: "현금은 금고(env)에만, 우편엽서(settings→argv)엔 절대" 규칙을 사람이 손으로 분류한다. 새 우편물 종류가 생기면 깜빡 현금을 엽서에 적을 수 있고, 컴파일러(자동 분류기)는 안 막는다 — 0015 가 딱 이거였다.

**채택안(3-A)**: settings/env 를 **nominal(branded) 타입**으로 구분하고, 분리는 **단 하나의 smart constructor** 에서만 일어나 brand 를 부여한다. `adaptSettings` 는 argv-안전 타입만 받으므로 **"env→argv 경로"가 컴파일 에러**가 된다(Parse, don't validate).

### 검토 후 기각한 대안 (스탭2)

| 대안 | 기각 사유 |
|---|---|
| 3-B 캡슐화 클래스 | 현재 blob 을 "불투명 객체 + mtime 캐시" 로 다루는 설계와 마찰 — 사용자 미채택 |
| 3-C 런타임 가드만 | 런타임 검출(컴파일타임 아님)·블랙리스트는 미지 키 못 잡음 — 사용자가 3-A 단독 채택. 단 기존 "유출 0" 테스트는 유지 |

## 인수 기준 (Acceptance Criteria)

1. **Branded 타입 정의**: `ArgvSafeSettings`(env 가 제거되어 `--settings` argv 로 안전한 설정 객체)와 `SubprocessEnv`(spawn env 로 갈 env)를 nominal 타입으로 둔다 — 일반 `Record<string, unknown>` / `Record<string,string>` 를 **직접 대입할 수 없다**(브랜드 미보유). 위치는 0017 분해 결과에 정합(`settings/provider-settings.ts` 계약 또는 `settings/env-merge.ts`).
2. **단일 Smart Constructor**: brand 부여(=env 제거 + 분리)는 **오직 한 함수**(예 `splitProviderSettings(effective): { settings: ArgvSafeSettings; env: SubprocessEnv }`)에서만 일어난다. claude 로더(`adapters/claude-settings.ts`)는 기존 `delete settings.env` 인라인 로직을 이 생성자 호출로 대체한다 — 생성자 밖에서는 settings/env 를 임의로 분리·브랜딩할 수 없다.
3. **계약 타입 브랜딩**: `ResolvedProviderSettings.settings: ArgvSafeSettings`, `.env: SubprocessEnv`. `ProviderSettingsLoader` 반환 타입(`settings/provider-settings.ts:58-67`)도 브랜디드. 캐시(`CacheEntry`)도 브랜디드 타입 보존.
4. **소비 경계 타입 강제**: `adaptSettings(blob)` 가 `ArgvSafeSettings` 만 수용하고 `JSON.stringify` 한다. `adaptEnv` 가 `SubprocessEnv` 만 수용한다(`adapters/claude-adapt.ts`). **임의 객체(또는 env 머금은 객체)를 `adaptSettings` 에 넘기면 컴파일 에러** 임을 `@ts-expect-error` 음성 타입 테스트로 고정한다.
5. `delete settings.env` 식의 ad-hoc 분리가 코드베이스에서 사라진다(생성자 1곳으로 흡수). verify 가 grep 대조.
6. 게이트 통과 + 테스트: 기존 `claude-settings.test.ts` 의 "유출 0"/"`${VAR}` 분리" 유지 + **음성 타입 테스트**(env 키 포함 객체 → `adaptSettings` 거부, `@ts-expect-error`) + `claude-adapt.test.ts` round-trip.
7. 문서: `docs/arch/backend/security.md`(비밀↛argv 불변식을 **런타임 관례 → 컴파일타임 타입** 으로 격상 기술), `standardization.md §5.2` 노트, `TRD §6.8` 정정.

## 범위 / 비범위

- **범위**: 인수 1~7. main 의 settings/adapters 타입 경계 + 음성 타입 테스트 + 보안 문서.
- **비범위**: 런타임 가드(3-C 비채택), 분리 로직의 *동작* 변경(0015 의 `{settings, env}` 의미 그대로 — 타입만 브랜딩), dist/deployer/scaffold·IPC·renderer 변경(0).

## 설계

- **타입 브랜딩 방식**: `type ArgvSafeSettings = Record<string, unknown> & { readonly __brand: 'ArgvSafeSettings' }` 같은 교차 타입 또는 기존 opaque 유틸. 브랜드 부여는 `as` 단언이 생성자 **내부에만** 존재하도록 격리(그 함수가 신뢰 경계 — 테스트로 굳힘).
- **0015 구조 보존**: 반환 shape `{settings, env}` 와 주입 채널(`adaptSettings`=인라인 JSON 문자열, `adaptEnv`=subprocess env)은 그대로. 바뀌는 건 *타입* 뿐 — 런타임 동작 무변경(회귀 0 목표).
- **opencode 일반화**: 미래 opencode 로더도 동일 smart constructor 를 통해 `{ArgvSafeSettings, SubprocessEnv}` 를 만들어야 한다 — 계약 타입이 강제.
- **재사용**: `adapters/claude-settings.ts:108-109` 분리 로직(→ 생성자로 이전), `mergeEnvLayers`/`expandEnvRecord`(0017 분해 후 `env-merge.ts`), `adaptSettings`/`adaptEnv`(0015 신설).
- 레이어 경계: 전부 main(settings L1 + adapters L2). SDK 어휘는 기존 격리 모듈 밖으로 새지 않는다(0017 boundaries 와 정합).

## 영향 받는 파일

- `app/src/main/settings/provider-settings.ts`(또는 0017 분해 모듈) — branded 타입 + smart constructor + 계약/캐시 타입
- `app/src/main/adapters/claude-settings.ts` (+`claude-settings.test.ts`) — 분리 로직→생성자, 음성/유출 테스트
- `app/src/main/adapters/claude-adapt.ts` (+`claude-adapt.test.ts`) — `adaptSettings`/`adaptEnv` 시그니처 브랜디드 + `@ts-expect-error` 테스트
- `docs/arch/backend/security.md` · `docs/arch/backend/standardization.md` · `docs/TRD.md` · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/arch/backend/security.md`(평문 비밀 불변식 — 본 작업으로 컴파일타임 격상)
- `docs/handoff/0015-settings-flag-string/plan.md`(분리 주입의 근거·구조)
- 스탭1·2 진단(B1 — 0015 재발 클래스)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- **핵심 게이트**: `npm run typecheck` 가 음성 타입 테스트(`@ts-expect-error`)를 만족(=env 객체→adaptSettings 가 에러). 회귀 기준선 유지.

## 위험

| 위험 | 완화 |
|---|---|
| 브랜딩이 mtime 캐시/직렬화와 마찰 | 캐시는 브랜디드 타입을 그대로 저장 — 동일 타입이라 마찰 없음. `JSON.parse` 결과 브랜딩은 생성자 내부 단언으로 격리 |
| `as` 단언이 신뢰 구멍 | 단언을 생성자 1곳에 가두고 "유출 0" + round-trip 테스트로 그 함수만 집중 검증 |
| 음성 타입 테스트의 CI 신뢰성 | `@ts-expect-error` 는 typecheck 게이트가 검출(주석이 불필요해지면 에러) — 표준 패턴 |
| 0017 분해 위치 의존 | 선행=0017. 분해 결과 모듈에 타입 배치(단일 브랜치 순차) |

---

## [Codex 기입] 구현 체크리스트

- [ ] 인수 1~3 (branded 타입 · smart constructor · 계약 타입)
- [ ] 인수 4 (adaptSettings/adaptEnv 시그니처 + 음성 타입 테스트)
- [ ] 인수 5~6 (ad-hoc 분리 제거 · 게이트 · 테스트)
- [ ] 인수 7 (보안 문서 격상)

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` / `build` |
| 게이트 결과 | lint ☐ / typecheck ☐ / test ☐ (N passed) / build ☐ |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

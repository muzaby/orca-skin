# Verify — 0018-settings-branded-types

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 구현 주체 = Claude(비기능 직접 구현).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0018-settings-branded-types` |
| 검증자 | Claude Code |
| 일자 | 2026-06-14 |
| 대상 커밋 | `37e95e1` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | Branded `ArgvSafeSettings`/`SubprocessEnv` — 일반 Record 직접 대입 불가 | ✅ | `provider-settings.ts` phantom `unique symbol` 교차 타입. typecheck:test 의 음성 테스트가 평문 객체 대입을 거부 확인. |
| 2 | 단일 smart constructor 가 brand 부여(env 제거+분리) | ✅ | `splitProviderSettings(effective, env)` — `as` 단언이 이 함수에만 존재(grep: `as ArgvSafeSettings`/`as SubprocessEnv` 1곳). `claude-settings.ts` 가 `delete settings.env` 대신 이 생성자 호출. |
| 3 | 계약 타입 브랜딩 (`ResolvedProviderSettings`·`ProviderSettingsLoader`·`CacheEntry`) | ✅ | `provider-settings.ts:ResolvedProviderSettings.settings: ArgvSafeSettings`/`.env: SubprocessEnv`, 로더 반환·`CacheEntry` 동일. |
| 4 | `adaptSettings`=ArgvSafeSettings만 / `adaptEnv`=SubprocessEnv만, env 객체→컴파일 에러 `@ts-expect-error` 고정 | ✅ | `claude-adapt.ts:adaptSettings(settings?: ArgvSafeSettings)`·`adaptEnv(_, env?: SubprocessEnv)`. `claude-adapt.test.ts` 음성 테스트 2건(`{env,model}`→adaptSettings, `{A}`→adaptEnv) — `typecheck:test` 통과(에러 검출). |
| 5 | `delete settings.env` ad-hoc 분리 제거(생성자 1곳 흡수) | ✅ | grep: `delete settings.env` 는 `provider-settings.ts:62`(생성자 내부) 1곳뿐, `claude-settings.ts` 에서 제거됨. |
| 6 | 게이트 + 테스트("유출 0"/`${VAR}` 유지 + 음성 타입 + round-trip) | ✅ | `claude-settings.test.ts` 무수정 통과(브랜드 phantom=런타임 0, `toEqual` 영향 없음). `claude-adapt.test.ts` round-trip + 음성 2건. test 377 passed. |
| 7 | 보안 문서 격상(security.md 런타임→컴파일타임, standardization, TRD §6.8) | ✅ | `security.md §1.4`(branded+생성자 컴파일타임 강제 단락 추가), `standardization.md §5.1`(노트), `TRD.md §6.8`(타입 격상 노트). |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 PASS |
| 인수 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 |
| 음성 타입 테스트 실효성 | ✅ typecheck:test | — | `@ts-expect-error` 2건 = 에러 정상 검출(브랜드 제거 시 빌드 실패) |
| 런타임 동작 무변경(0015 의미 보존) | ✅ 회귀 테스트 | 실기 1회 | 377 무회귀, 단 실환경 settings/env 적용은 사람 확인 |
| 문서 형식/한국어 | ✅ | — | 3문서 갱신 |
| typecheck:test 신설(게이트 확장) | ✅ 제안·구현 | 이견 시 조정 | main 테스트 타입체크 — 빌드 emit 무영향 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test && npm run build
lint        ✅ error 0 (boundaries·no-cycle 포함)
typecheck   ✅ node + web + test(@ts-expect-error 음성 타입 검출)
test        ✅ Test Files 50 passed / Tests 377 passed (+2 음성)
build       ✅ electron-vite build
```

## 위생 검토 (문서 변경)

- security.md/standardization/TRD: 키/토큰/이메일/IP 0. 결정 사항(불변식 격상) 중심 서술.

## PHASES.md 정합성

- INDEX 0018 행 plan/READY → verify/PASS, 대상 커밋 기재.
- PHASES "구조 견고화(비밀 경계 타입화)" 행 승격. 구조 견고화 3/3 시리즈 완료.

## 결론 / 다음 단계

- **상태: PASS** (인수 7/7). 구조 견고화 3-part 시리즈(0016·0017·0018) 완료.
- 런타임 동작 무변경 — 타입만. 사람 확인 대기: 실환경 턴 1회 settings/env 적용(0015 와 동일 경로, 회귀 0 목표).

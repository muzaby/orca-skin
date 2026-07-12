# Verify — 0098-static-provider-usage-correction

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0098-static-provider-usage-correction` |
| 검증자 | Claude Code |
| 일자 | 2026-07-12 |
| 대상 커밋 | `b9de3d2` |
| 라운드 | 1 |
| 상태 | **FAIL** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: `Correction*` → `ExternalUsageReport`(authoritative) 리네이밍, `summary` 로컬 유지 + `effectiveLimit`만 보정 | **타당** — API 가 진실이고 로컬 집계 표시는 유지한다는 사용자 확정(plan §16.3)과 일치. 도넛·서브탭 모두 `summaryForLimit`+`effectiveLimit.limitUsd` 로 일관 | 매트릭스 §7 반영 |
| 놓친 문제 #1: `static-providers` 최상위 디렉터리 boundary 리스크 → `features/providers/static` + `contracts/usage-report` + `features/usage` 배치 | **타당** — main DAG 준수. `npm run lint`(eslint-boundaries) 위반 0 재현 | 매트릭스 §11 반영 |
| 놓친 문제 #5: `npm test` glob 을 `node --test scripts/*.test.mjs` 로 조정 | **타당** — node:test 24개 실행 확인 | 게이트 재실행 반영 |
| `Criteria-Met: 11/11` 자기신고 | **일부 기각** — 기능 코어는 대부분 충족하나, §11 이 **명시적으로 열거한 신규 단위 테스트** 5범주 중 4범주가 부재하고, §3/§D/범위(line 73)의 **문서화된 예시(다단계 인증) 훅 모듈**이 없으며, §9 stale/offline 배지가 미렌더. 아래 매트릭스 참조 | 미충족 체크리스트 + 파생 이슈 D1~D4 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 정적 provider 모듈 규약(`{config, hook?}`, 코어는 레지스트리 순회·이름 미하드코딩) | ✅ | `contracts/usage-report.ts:19` `StaticUsageProviderModule` · `features/providers/static/index.ts:9` `STATIC_USAGE_PROVIDERS` · `external-usage-service.ts:28` `for (const p of deps.providers)` |
| 2 | 플러그인 통합(코어 무편집: 서비스·스케줄러·IPC·핸들러·tracker·enumeration) | ⚠️ 부분 | 프레임워크 1회 배선 완료(`bootstrap.ts`·`misc.ts`·`context.ts`), 추가 표면 = 배럴(`static/index.ts`) 배열 1항. **단 "새 모듈 추가로 코어 무편집" 회귀 테스트 부재**(§11 요구) → D3 |
| 3 | hook 이 기본 확장 단위(다단계 인증·집계·매핑 임의 async) | ❌ | 프레임워크는 `providerFor` 로 `usage.provider ?? createHttpUsageReportProvider(config)` 를 지원(`external-usage-service.ts:77`)하나, **`hook.ts` 다단계 인증 예시 모듈이 하나도 없음** — `STATIC_USAGE_PROVIDERS` 3항 모두 `usage` 미정의(`static/index.ts:9-13`). 인터페이스만 존재, §D/범위(line 73) "문서화된 예시 모듈" 미이행 → D1 |
| 4 | CorrectionContext 충분성(providerKey/fetch/signal/secret/env/settings/store/logger/clock) | ⚠️ 부분 | `ExternalUsageContext`(`contracts/usage-report.ts:3`) 전 필드 존재·서비스가 주입(`external-usage-service.ts:93`). 단 `secret.set` 이 `void`(동기)로 plan §B 의 `Promise<void>` 와 불일치 → 훅이 write-back 완료를 await 불가(경미) → D1 에 병기. store 토큰 캐시 재사용 **테스트 부재** |
| 5 | 선언적 config 옵션 sugar(엔드포인트·JSON path·`${SECRET/ENV}`·타임아웃·에러=null) | ⚠️ 부분 | `http-usage-report.ts` 구현 완비(expand·pathValue·timeout via signal·catch→null). **단 전용 단위 테스트 0** — `http-usage-report` 참조 테스트 파일 없음(grep) → D2 |
| 6 | 주기 새로고침 → 훅 실행(수동 버튼 + 30s 틱) | ⚠️ 부분 | 수동: `useProviderUsage.ts` refresh → `refreshProviderUsageReport` per key ✅. 스케줄러: `bootstrap.ts` `scheduler.schedule('provider-usage-report-refresh', {cron:'*/5 * * * *'})` ✅. **단 "30s 틱" 인터벌 부재**(수동만) — 경미 → D4 병기 |
| 7 | 외부값 override(월 사용량=`usedUsd`, 한도=`limitUsd`) | ✅ | `external-usage.ts:15` `effectiveLimitFromReport` · 도넛/탭 `summaryForLimit`(`useProviderUsageLimits.ts`·`ProviderUsageTab.tsx`). 테스트 ✅ `external-usage-service.test.ts:58-64` |
| 8 | 영속(오프라인 stale, 성공 upsert / 실패 마지막 스냅샷 / 없으면 로컬) | ⚠️ 부분 | 구현 완비: `queries.ts` `upsert/getProviderUsageReport` · `external-usage-service.ts:104,142`(stale=true). **단 실 DB upsert/read 테스트 부재** — 서비스 테스트는 in-memory fake db 사용(`external-usage-service.test.ts:17`) → D2 |
| 9 | 스탤니스 표시(source + fetchedAt "마지막 동기화" + 오프라인 배지) | ⚠️ 부분 | `ProviderUsageTab.tsx` `fetchedAt` 기반 `relativeTimeLabel` ✅. **단 stale/offline 배지 미렌더** — 탭에 `stale` 참조 0(grep) → D4 |
| 10 | 스케줄러 백그라운드 갱신(레지스트리 전체 순회·provider-불특정·signal 타임아웃) | ✅ | `bootstrap.ts` `scheduler.register(...refreshAll(providerKeys))` · `external-usage-service.ts:90` `AbortController`+5s timeout → `null` 폴백 |
| 11 | 동적 provider 불변 + 경계·게이트·계약 + **신규 단위 테스트** | ❌ | 경계 위반 0(lint ✅)·신규 의존성 0·`IPC_CONTRACT.md` 갱신 ✅·게이트 green ✅. **그러나 §11 이 열거한 신규 테스트 5범주 중 4범주 부재**: generic fetcher 매핑 ❌ · 영속(실 DB) ❌ · 스키마(zod) ❌ · 다단계 인증 훅 예시(store 캐시·signal→null·secret write-back) ❌. 병합(override)만 ✅ → D1/D2 |

**요약**: 11 중 ✅ 4 (1·7·10·부분게이트) · ⚠️ 부분 5 (2·4·5·6·8·9) · ❌ 2 (3·11). 기능 코어는 견고하나 **명시적 테스트 요구(§11)·예시 모듈(§3/§D)·stale 배지(§9)** 미이행으로 FAIL.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck ✅ / test ✅ (Vitest 826 + node:test 24) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 위 매트릭스 — §3·§11 미충족 |
| 레이어 경계 위반 0 | ✅ | — | eslint-boundaries 위반 0 (features/providers/static·contracts/usage-report·features/usage 배치) |
| 문서 형식/링크/한국어 | ✅ | — | `IPC_CONTRACT.md` §6 갱신 형식 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 변경 없음(스킵) |
| 제품 의도 부합(로컬 summary 유지·한도만 보정) | ✖ 보조 | ✅ 결정 | 구현 방향 사용자 확정과 일치(보조 의견) |
| UI/UX 시각 검증(stale 배지·바 렌더) | ✖ | ✅ | 사람 확인 대기(단 배지 미구현은 코드 대조로 확정) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 해당 없음(FAIL) |

## 게이트 재실행 결과

> 신규 클론이라 `node_modules` 부재 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 패키지 설치(electron **바이너리** 다운로드는 조직 egress 정책상 github release 403 차단 — 런타임 실행 불요, 타입/테스트에 무관). `node scripts/ensure-sqlite-abi.mjs node` 로 better-sqlite3 Node ABI 빌드. electron 바이너리 미설치로 `require('electron')` 하는 2개 테스트파일이 초기 실패 → `node_modules/electron/path.txt` 스텁 후 통과(4/4). 이는 **환경 제약**이지 구현 회귀 아님.

```
$ npm run lint       → LINT_EXIT=0  (eslint-boundaries 포함 위반 0)
$ npm run typecheck  → TC_EXIT=0    (node / web / test 3분할 통과)
$ npm test           → TEST_EXIT=0  (Test Files 111 passed · Tests 826 passed · node:test 24 pass 0 fail)
```

## 위생 검토 (AGENTS.md 변경 시)

- 본 커밋은 `AGENTS.md` 미변경 → 스캔 스킵. `plan.md` 구현자 기입 섹션에 키/토큰/IP 없음.

## PHASES.md 정합성

- FAIL 이므로 `docs/PHASES.md` 표 승격 보류. `INDEX.md` 만 `verify/FAIL`, 라운드 2, 다음=Codex 로 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan §11·게이트(line 185)가 요구 테스트를 열거했으나 *어느 테스트가 어느 파일에 산다*는 매핑까지는 명시하지 않아 구현자가 "게이트 green"을 "테스트 요구 충족"으로 등치할 여지를 남겼다. 다음 plan 은 요구 테스트를 `파일명::케이스` 로 못박는 편이 낫다.
- **구현 단계**: 기능 코어(프레임워크·서비스·IPC·렌더러 일관)는 완성도가 높으나, §11 이 1급 인수 기준으로 요구한 신규 테스트와 §D/범위의 예시 훅 모듈을 "비범위(실 endpoint 주입)"로 과확대 해석해 스텁·테스트까지 생략했다. 실 endpoint 는 비범위지만 **템플릿 예시 모듈 + 그 단위 테스트**는 범위(line 73)다.
- **검증 단계**: 최초 lint 를 `npm ci` 전에 실행해 `LINT_EXIT` 를 확인하지 않고 통과로 오인할 뻔했다(재실행으로 교정). UI stale 배지 부재는 코드 대조로 확정했으나 실제 시각 검증은 사람 몫으로 남긴다.

## [FAIL] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **기준 §3 / §D / 범위(line 73)**: 다단계 인증 **예시 훅 모듈**(`features/providers/static/<name>/hook.ts` 상당, `usage.provider` 채운 항목)을 1건 추가한다 — OAuth client-credentials 또는 bearer 캐시 형태로 `ctx.store` 토큰 TTL 캐시 재사용·`ctx.secret` read/write·`ctx.signal` 취소를 시연하는 템플릿(실 endpoint 는 config 주입 지점만).
- [ ] **기준 §11 (a) generic fetcher 매핑 테스트**: `http-usage-report.ts` 단위 테스트 신규 — `${SECRET:}`/`${ENV:}` 확장 · JSON path 매핑(`quota*`/`totalCostUsd`/`asOf`) · 타임아웃(signal abort) · `res.ok=false`/throw → `null`.
- [ ] **기준 §11 (b) 다단계 인증 훅 예시 테스트**: 위 예시 모듈에 대해 store 캐시 hit/miss·만료 재발급·`signal` 타임아웃 → `null`·`secret.set` write-back 검증.
- [ ] **기준 §11 (c) 영속 upsert/read 테스트**: 실 `DbQueries.upsertProviderUsageReport`/`getProviderUsageReport`(0014 마이그레이션) 왕복 테스트 — `queries.test.ts` 에 추가(현재는 마이그레이션 import 만).
- [ ] **기준 §11 (d) 병합/폴백/stale 테스트 확장**: `applyProviderCorrection`(=`effectiveLimitFromReport`) 의 **null 폴백**(report 없음 → local)·**stale**(캐시 재사용) 경로를 `external-usage-service.test.ts` 또는 순수 함수 테스트로 커버(현재 external override 1케이스만).
- [ ] **기준 §11 (e) IPC zod 스키마 테스트**: `RefreshProviderUsageReportSchema` 파싱(유효/무효 `providerKey`) + `ProviderUsageEntry` 확장 필드 왕복 스키마 검증.
- [ ] **기준 §2 코어 무편집 회귀 테스트**: 레지스트리(배럴) 배열에 항목 추가 시 서비스가 순회만으로 인식함을 보이는 회귀 테스트(코어 파일 미편집 불변식).
- [ ] **기준 §9 stale/offline 배지**: `ProviderUsageTab.tsx` 에 `effectiveLimit.stale`/`source==='local'`(외부 미보고) 기반 배지 렌더 + i18n ko/en. (현재 `fetchedAt` 상대시각만 표시.)
- [ ] **(경미) 기준 §4**: `ExternalUsageContext.secret.set` 을 `Promise<void>` 로 정렬(훅이 write-back 완료 await 가능하도록) — plan §B 계약 일치.
- [ ] **(경미) 기준 §6**: "30s 틱" 자동 새로고침(설정 사용량 탭 오픈 중) 추가 검토 — 스케줄러(5분)로 백그라운드는 충족하나 plan 이 탭 내 30s 틱을 명시.

## 결론 / 다음 단계

- **상태: FAIL (라운드 1)**. 기능 코어(플러그인 프레임워크·authoritative report·effectiveLimit·영속·스케줄러·IPC·렌더러 일관·경계·게이트)는 견고하다. 그러나 §11 이 1급 인수 기준으로 열거한 **신규 단위 테스트 5범주 중 4범주**와 §3/§D/범위의 **예시 훅 모듈**, §9 **stale 배지**가 미이행이다.
- **다음 주체 = Codex (라운드 2)**. 위 "미충족 요구사항" 체크리스트와 plan 하단 "파생 이슈 (D1~D4)" 를 기준으로 재구현한다. 기능 재작성이 아니라 **테스트·예시 모듈·배지 보강** 중심(코어 변경 최소).

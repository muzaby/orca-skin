# Verify — 0098-static-provider-usage-correction

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0098-static-provider-usage-correction` |
| 검증자 | Claude Code |
| 일자 | 2026-07-13 |
| 대상 커밋 | `84454c2` (r2) · `b9de3d2` (r1 기능 코어) |
| 라운드 | 2 |
| 상태 | **PASS** |

## r1 → r2 요약 (무엇이 달라졌나)

r1(FAIL) 은 세 부류를 지적했다: ① §11 이 열거한 신규 단위 테스트 5범주 중 4범주 부재 ② §3/§D 다단계 인증 예시 훅 모듈 부재 ③ §9 stale/offline 배지 미렌더. r2 는 **2026-07-13 사용자 결정으로 범위를 재조정**했다:

- **hook 내부 인증/매핑(OAuth·STS·SigV4·페이지네이션)은 포맷화하지 않는다** — hook 은 provider 소유, 프레임워크는 `ExternalUsageContext` 제공 + `ExternalUsageReport|null` 소비 경계만. 테스트는 hook *내부*가 아니라 **ctx 전달·report 영속·null→캐시 폴백·registry 순회**만 검증.
- **stale/offline UI 배지 + 30s 틱은 후속 핸드오프로 분리** — 자동 새로고침은 5분 스케줄러 유지.

이 재조정으로 r1 의 §3/§D(예시 훅)·§9(배지)·§6(30s 틱) 는 **미이행(FAIL)이 아니라 사용자 결정에 의한 연기**로 성격이 바뀌었고, r2 는 남은 테스트 요구(§2·§5·§8·§11)를 채웠다. plan §D1~D4 및 게이트(line 185) 도 이 결정에 맞춰 개정됨(r2 커밋).

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트(r2) | 검증자 판단 | 반영 |
|---|---|---|
| r1 "다단계 인증 예시 hook" 요구는 hook 세부 표준화로 과확대될 수 있어 경로/계약 문서화 + 최소 contract 테스트로 축소 | **타당** — plan §4(프레임워크는 경계만 소유)·§D(인증은 훅 소유, 코어 비관여)의 원설계 의도와 일치. 사용자 결정(2026-07-13)이 이를 확정 | 매트릭스 §3 재해석 |
| `STATIC_USAGE_PROVIDERS` 배럴에 코어 무분기 규약 주석 추가 | **타당** — `static/index.ts:9-24` JSDoc 이 "코어는 `StaticUsageProviderModule[]` 만 소비, provider-name 분기 금지" 를 명문화 | 매트릭스 §2 반영 |
| `secret.set` Promise 계약 변경은 후속 보류 | **타당(경미)** — 현행 동기 `void` 유지. hook write-back 은 동기 secret-store 라 실동작 무영향. plan §B `Promise<void>` 와의 표기 불일치는 후속 contract polish | §4 잔여로 병기 |
| `Criteria-Met: 8/8` 자기신고 | **인정** — 재조정된 인수(테스트 4범주 + 코어 무편집 회귀 + 계약 문서화)를 모두 충족. 연기 항목(§9 배지·§6 30s 틱)은 사용자 결정으로 범위 밖 | 매트릭스 참조 |

## 요구사항 충족 매트릭스 (원 plan 11기준 + r2 재조정 반영)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 정적 provider 모듈 규약(`{config, hook?}`, 코어는 레지스트리 순회·이름 미하드코딩) | ✅ | `contracts/usage-report.ts` `StaticUsageProviderModule` · `features/providers/static/index.ts:9-27` `STATIC_USAGE_PROVIDERS`(+규약 JSDoc) · `external-usage-service.ts:28` `for (const p of deps.providers)` |
| 2 | 플러그인 통합(코어 무편집) **+ 회귀 테스트** | ✅ | 프레임워크 1회 배선 유지. **신규 회귀 테스트** `external-usage-service.test.ts` "treats static provider modules as provider-agnostic registry entries" — `alpha`/`beta` 2모듈을 배럴 배열로만 주입 → `hasProvider` 인식·`refreshAll` 이 순회만으로 양쪽 호출(코어 분기 0). D3 해소 |
| 3 | hook 이 기본 확장 단위(임의 async) — **r2 재조정: 경로/계약 경계** | ✅(재조정) | `providerFor`(`external-usage-service.ts:77`) 가 `usage.provider ?? createHttpUsageReportProvider(config)` 지원. hook 내부(인증/매핑)는 **provider 소유**(사용자 결정)로 포맷화 제외. 계약 경계 문서화(`static/index.ts` JSDoc) + **ctx 전달 테스트**("calls provider-owned usage hook with framework context") 로 경계 검증. D1 해소 |
| 4 | ExternalUsageContext 충분성(providerKey/fetch/signal/secret/env/settings/store/logger/clock) | ✅ | `external-usage-service.ts:93-103` 9필드 전부 주입. **테스트**가 각 필드 실전달 확인 — `ctx.env===process.env`·`signal instanceof AbortSignal`·`store.set/get` 왕복·`secret.set` write-back(`secrets.get('provider:claude-enterprise:refresh-token')==='next-token'`, 접두사 `createSecretFacade` `external-usage.ts:54`)·`logger` 호출. 잔여: `secret.set` Promise화(경미, 후속) |
| 5 | 선언적 config 옵션 sugar(엔드포인트·JSON path·`${SECRET/ENV}`·타임아웃·에러=null) **+ 테스트** | ✅ | `http-usage-report.ts` 구현 + **신규 단위 테스트** `http-usage-report.test.ts`: `${ENV:}`/`${SECRET:}` 확장·JSON path 매핑(`quota*`/`total`/`asOf`)·POST body 직렬화 검증 / `res.ok=false`·throw → `null`. D2(a) 해소 |
| 6 | 주기 새로고침 → 훅 실행 — **r2 재조정: 5분 스케줄러**(30s 틱 연기) | ✅(재조정) | 수동 `useProviderUsage.ts` → `refreshProviderUsageReport` per key. 스케줄러 `bootstrap.ts` `cron:'*/5 * * * *'`. **30s 틱은 사용자 결정으로 후속 핸드오프 연기**(미이행 아님) |
| 7 | 외부값 override(월 사용량=`usedUsd`, 한도=`limitUsd`) | ✅ | `external-usage.ts` `effectiveLimitFromReport` · 도넛/탭 일관. 테스트 "keeps local summary but resolves effective limit from authoritative API report" |
| 8 | 영속(오프라인 stale) **+ 실 DB 테스트** | ✅ | `external-usage-service.ts:104,142`(성공 upsert / 미보고→캐시 stale=true). **신규 실 DB 왕복 테스트** `queries.test.ts` "provider_usage_report_cache 는 실제 마이그레이션+쿼리로 upsert/read 를 왕복" — 0014 마이그레이션 실적용 후 upsert→get→재upsert(갱신) 검증. **null→캐시 폴백 테스트** `external-usage-service.test.ts` "falls back to cached report when hook returns null"(stale=true). D2(b)(d) 해소 |
| 9 | 스탤니스 표시(source + fetchedAt "마지막 동기화") — **r2 재조정: 상대시각만**(배지 연기) | ✅(재조정) | `ProviderUsageTab.tsx` `fetchedAt` 기반 `relativeTimeLabel` 표시. **stale/offline 배지는 사용자 결정으로 후속 핸드오프 연기**. 데이터 모델에는 `source`/`stale` 보존(override 은폐 방지) |
| 10 | 스케줄러 백그라운드 갱신(레지스트리 전체 순회·provider-불특정·signal 타임아웃) | ✅ | `bootstrap.ts` `refreshAll(providerKeys)` · `external-usage-service.ts:90` `AbortController`+5s timeout → `null` 폴백 |
| 11 | 동적 provider 불변 + 경계·게이트·계약 + **신규 단위 테스트** | ✅ | 경계 위반 0(lint ✅)·신규 의존성 0(`package.json` r1→r2 diff 공집합)·`IPC_CONTRACT.md` r1 갱신 유지(r2 IPC 무변경)·게이트 green. **§11 테스트 5범주 이행**: (a) generic fetcher 매핑=`http-usage-report.test.ts` ✅ (b) 실 DB 영속=`queries.test.ts` ✅ (c) IPC zod=`protocol.send.test.ts` `RefreshProviderUsageReportSchema`(빈 문자열/미제공 거부) ✅ (d) 병합/null 폴백/stale=`external-usage-service.test.ts` ✅ (e) 다단계 인증 훅 예시=**사용자 결정으로 경로/ctx 경계 테스트로 대체**(재조정) ✅ |

**요약**: 원 11기준 중 ✅ 8 (1·2·4·5·7·8·10·11) · ✅(재조정) 3 (3·6·9 — hook 내부·30s 틱·배지는 2026-07-13 사용자 결정으로 후속 분리). **미충족(FAIL) 항목 0.** 게이트 green + r1 FAIL 3부류(테스트·예시훅·배지) 는 각각 **이행(테스트)·재조정(예시훅→계약경계)·연기(배지, 사용자 결정)** 로 종결.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 / typecheck 0 / test — Vitest **833**/833(112파일) + node:test **24**/24 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 위 매트릭스 — 미충족 0 |
| 레이어 경계 위반 0 | ✅ | — | eslint-boundaries 위반 0(`features/providers/static`·`contracts/usage-report`·`features/usage` 배치 유지, 신규 테스트도 경계 준수) |
| 신규 단위 테스트 실행 | ✅ | — | r2 신규/확장 4파일 45/45 통과(`http-usage-report`·`external-usage-service`·`protocol.send`·`queries`) |
| 문서 형식/링크/한국어 | ✅ | — | plan §D1~D4·게이트(line 185) r2 개정 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 미변경(스킵). plan/테스트에 키/토큰/IP 없음(placeholder `${SECRET:TOKEN}`·`secret-token` 픽스처만) |
| 제품 의도 부합(로컬 summary 유지·한도만 보정) | ✖ 보조 | ✅ 결정 | 사용자 확정과 일치(보조 의견) |
| 범위 재조정 승인(hook 내부·배지·30s 틱 연기) | ✖ 기록 | ✅ 결정 | 2026-07-13 사용자 결정(plan §D1·D4·게이트 line 185 기재) |
| UI/UX 시각 검증(effective limit 바·상대시각) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

> 신규 클론 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(electron **바이너리** 다운로드는 조직 egress 정책상 release 403 차단 — 타입/테스트 무관). postinstall 의 electron-ABI 재빌드는 바이너리 부재로 실패하나, `node scripts/ensure-sqlite-abi.mjs node` 로 better-sqlite3 Node ABI 를 빌드해 Vitest 실행. `require('electron')` 하는 2 테스트파일이 초기 실패(`Electron failed to install correctly`) → `node_modules/electron/path.txt` 스텁 후 4/4 통과. 이는 **환경 제약**(0092~0097 동일 베이스라인)이지 구현 회귀 아님.

```
$ npm run lint       → LINT_EXIT=0   (eslint-boundaries 포함 위반 0)
$ npm run typecheck  → TC_EXIT=0     (node / web / test 3분할 통과)
$ npx vitest run     → 112 files · 833 tests passed  (electron path.txt 스텁 후)
$ node --test scripts/*.test.mjs → 24 pass / 0 fail
```

(스텁 전 원시 `npm test` 는 electron 의존 2 suite 로드 실패 → 그 2파일 스텁 후 833 전량 green. r1 826 → r2 833 = 신규 테스트 +7건.)

## 위생 검토

- 본 라운드는 `AGENTS.md` 미변경 → 스캔 스킵. r2 신규 테스트의 비밀 값은 픽스처(`secret-token`·`${SECRET:TOKEN}` placeholder)뿐, 실 자격증명 없음.

## PHASES.md 정합성

- PASS → `docs/PHASES.md` Phase 4 표에 0098 행 승격(대상 커밋 `84454c2`, 기능 코어 `b9de3d2`). `INDEX.md` `verify/PASS`, 다음=`—`.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 원 plan §11 이 요구 테스트를 열거하되 *파일::케이스* 매핑이 없어 r1 에서 "게이트 green ≠ 테스트 요구 충족" 간극이 났다(r1 자기리뷰 지적). r2 는 사용자 결정으로 범위를 좁히며 이 요구를 파일 단위로 못박아 해소했다 — 다음 plan 부터 요구 테스트는 `파일::케이스` 로 고정하는 관례가 자리잡음.
- **구현 단계**: r2 는 코어 재작성 없이 테스트·규약 주석만 추가(최소 침습)해 회귀 위험을 낮췄다. 다만 `secret.set` Promise화 같은 계약 표기 불일치는 후속으로 남겨 plan §B 와 코드 사이 미세 드리프트가 잔존한다(경미).
- **검증 단계**: 범위 재조정(§3·§6·§9)이 "사용자 결정에 의한 연기"임을 plan(§D1·D4·게이트)·INDEX·커밋 trailer 세 곳에서 교차 확인했다. 다만 effective-limit 바·상대시각의 실제 렌더 톤과 stale 데이터의 사용자 체감은 코드 대조로만 확정했고 시각 검증은 사람 몫으로 남긴다.

## 결론 / 다음 단계

- **상태: PASS (라운드 2)**. 게이트 3종 green(lint 0·typecheck 0·Vitest 833 + scripts 24), 레이어 경계 0, 신규 의존성 0. r1 FAIL 3부류가 각각 **테스트 이행 / 계약경계 재조정 / 사용자 결정 연기**로 종결됐다. 플러그인 프레임워크(모듈 규약·authoritative report·effectiveLimit·영속·스케줄러·IPC·렌더러 일관·코어 무편집 회귀)가 테스트로 고정됐다.
- **다음 주체 = — (종료)**. PHASES 표 승격.
- **후속 핸드오프 대상(사용자 결정)**: stale/offline UI 배지(§9) · 설정 탭 30s 틱(§6) · 실 bedrock/vertex/custom endpoint·응답 매핑·자격증명 실값(비범위) · `secret.set` Promise 계약 정렬(경미).
- **사람 확인 대기**: effective-limit 바·상대시각 시각 검증 · 실환경 provider report fetch · PR 머지.

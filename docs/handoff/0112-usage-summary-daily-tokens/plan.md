# Plan — 0112-usage-summary-daily-tokens

## 메타

| 항목 | 값 |
|---|---|
| slug | `0112-usage-summary-daily-tokens` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | 설정 사용량 탭 사용량 요약 (브랜치 `claude/settings-usage-summary-5f8dql`) |
| 상태 | READY |

> 사용자 직접 지시(라이브 세션)로 **Claude 가 설계+구현을 수행**한다 — 기능 구현이지만 사용자가
> 본 세션에서 Claude 에게 직접 요청·플랜 승인까지 완료(구현 주체 분담 규칙의 사용자 재량 케이스).

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | 설정 > 사용량에서 "주기적 실행" 그룹 제거 | 라이브 세션(2026-07-16): "주기적 실행 그룹을 제거할 것" |
| 명시 요구 2 | 사용량 요약 구현 — tokens per day 차트, 단위 M·소수 1자리(예: 190.5M), 사용 모델 나열, 최근 7일/최근 30일/전체 3개 탭 | 라이브 세션: "사용량 요약의 내용을 추가할 것…" |
| 명시 요구 3 | Orca 디자인 준수 | 라이브 세션: "orca 디자인 준수할 것" |
| 사용자 확정 1 | 토큰 = input+output+cache_creation+cache_read **전체 합산** | 라이브 세션 AskUserQuestion 응답 |
| 사용자 확정 2 | 주기적 실행은 **UI만 제거** (main 스케줄러·tweak 유지) | 라이브 세션 AskUserQuestion 응답 |
| 사용자 확정 3 | 차트 라이브러리 사용 허용 — "간단하면서 제일 트렌디하고 경량" | 라이브 세션(플랜 승인 시) |
| 추론 의도 | '전체' 범위가 매우 길면 일 단위 막대가 서브픽셀로 붕괴 → 90일 초과 시 주 단위 표시 집계 (추론) | 표시 가독성 파생 |
| 추론 의도 | 0.1M 미만 값의 '0.0M' 표기 회피 → K 폴백 (추론, M 1자리는 기본 유지) | 요구 예시(190.5M)가 대형 값 기준 |

## Context (왜)

사용량 탭 전역 요약은 0081 이후 "추후 구현 예정" 플레이스홀더였고, 0099 로 주기적 실행 설정 그룹이 들어와 있었다. 사용자는 플레이스홀더를 실제 `/cost` 유사 요약(일별 토큰 차트 + 모델별 내역 + 기간 탭)으로 구현하고, 주기적 실행 UI 는 제거하길 원한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| UsageTab 은 주기적 실행 그룹(66–139행) + coming-soon 카드(141–145행)로 구성, SyncRow/CostRefreshView 는 ProviderUsageTab 이 재사용 | `app/src/renderer/src/features/settings/components/UsageTab.tsx`(구), `ProviderUsageTab.tsx:11` |
| 원장은 `turn_usage`(턴별 토큰 4종+cost+created_at epoch ms) + `turn_model_usage`(턴×모델) — 일별/모델별 집계 쿼리는 부재 | `app/src/main/infra/db/migrations/0006_turn_usage.sql`, `queries.ts:256–298` |
| 일 경계는 OS 로컬 타임존(JS Date 생성자) — SQLite `date(...,'localtime')` 과 동일 OS 존 | `app/src/shared/time/clock.ts:21–27` |
| IPC 미러링 패턴: `costProviderSummaries` — CHANNELS → zod(protocol.ts) → `handle(channel, schema, {fallback}, fn)`(misc.ts) → preload `cost.*` → renderer `costApi` → hook | `app/src/main/app/handlers/misc.ts:247–259`, `app/src/preload/index.ts:174–187`, `features/cost/hooks/useProviderUsage.ts` |
| lazy prepared statement 선례(설정 모달 열림 시에만 필요한 쿼리) | `queries.ts` `scheduleStartStmt()` 계열 |
| 차트 라이브러리 부재 — recharts 도입은 사용자 승인 완료(확정 3). recharts v3 = SVG + 선언적 React, CSS 변수 직결 | `app/package.json`, TRD §4 |
| `usageSchedule.ts`(+test)의 소비자는 UsageTab 뿐 → UI 제거와 함께 삭제 가능 | grep `usageSchedule` (UsageTab·자기 test·i18n 만) |
| main 스케줄러는 tweak `scheduler.usageRecompute` 를 계속 소비 — UI 제거와 무관하게 유지 | `app/src/main/features/scheduler/`, `bootstrap.ts:195–203`, `shared/hooks/useTweaks.ts` |
| i18n 은 ko/en 패리티가 컴파일(`typeof ko`)+테스트(`resources.test.ts`)로 강제 | `app/src/renderer/src/shared/i18n/resources/` |
| `formatMonthDay` 는 0100 F4 에서 소비자 부재로 배럴 제거 — 신규 소비자 생겨 재노출 | `shared/i18n/index.ts` |

## 인수 기준 (Acceptance Criteria)

1. 설정 > 사용량 탭에 "주기적 실행" 그룹(토글·주기 select·cron input)이 더 이상 렌더되지 않는다. `usageSchedule.ts`/`usageSchedule.test.ts` 및 관련 i18n 키가 삭제된다.
2. main 스케줄러(`features/scheduler`)·tweak 스키마(`SchedulerSettings`)·`useTweaks` scheduler 필드는 변경되지 않는다(UI 만 제거).
3. 새 IPC `orca:cost:usageStats`(`{range:'7d'|'30d'|'all'}` → `UsageStats`)가 zod 검증 + fallback 정책으로 등록되고, preload/`costApi` 로 노출된다.
4. `sumUsageByDaySince`/`sumUsageByModelSince` 가 OS 로컬 일자 버킷/모델별 합산을 반환한다 — 로컬 자정 경계 분리·`@since` 필터·null→0·정렬(일 오름차순/총 토큰 내림차순)이 DB 테스트로 고정된다.
5. 사용량 탭에 최근 7일/최근 30일/전체 3개 기간 탭이 있고, 전환 시 해당 범위 데이터를 조회한다.
6. 일별 토큰 차트(tokens per day)가 렌더된다 — 토큰 = 4종 전체 합산, 7일 탭 = 연속 7일(빈 날 0), 30일 = 연속 30일, 전체 = 최초 사용일부터(90일 초과 시 주 단위 표시 집계 + 안내 문구).
7. 토큰 수 표기는 백만 단위 소수 1자리(예: 190.5M). 0.1M 미만은 K 폴백, 1천 미만은 원시값(`formatTokens` 단위 테스트).
8. 사용 모델이 총 토큰 내림차순으로 나열되고 각 행에 총 토큰·입력/출력/캐시 내역·비용·비율 Meter 가 표시된다.
9. Orca 디자인 준수 — 시맨틱 토큰만 사용(차트 = `--color-indigo`, 그리드/축 = `--color-border`, 텍스트 = ink 스케일), 신규 라벨은 ko/en 동시 추가(패리티 테스트 green), raw hex 0.
10. 로딩(`usage.loading`)·빈 데이터(점선 카드) 상태가 처리된다.
11. 게이트: `npm run lint`(error 0) + `npm run typecheck` 3종 + vitest 전체 green(환경 제약 시 순수 스위트 + DB 스위트 분리 보고). `docs/IPC_CONTRACT.md`(65→66)·TRD §4(recharts) 동시 갱신.

## 범위 / 비범위

- **범위**: UsageTab 전역 요약 구현, 주기적 실행 UI 제거, cost IPC 1채널 추가, recharts 도입.
- **비범위**: provider 서브탭(한도 바)·도넛/컴포저 사용량 UI 변경, main 스케줄러/tweak 제거, provider별 요약 필터, 외부 권위 report 와의 정합(0111 소관).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성**: `recharts@^3` — **사용자 승인 완료**(라이브 세션, "간단·트렌디·경량" 기준 선정). TRD §4 표에 행 추가.
- 기존 모듈 재사용: `handle`(infra/ipc), `UsageTracker`, `SettingsGroup`/`parts.tsx`, `Meter`(info 톤), `Icon`, `useI18n`/`formatMonthDay`, `fmtUsd`.
- 전제: `turn_usage.created_at` = epoch ms, 일 경계 = OS 로컬 타임존(clock.ts 와 동일 의미론).

## 설계

- **데이터 흐름**: `queries.ts` lazy stmt 2개(`sumUsageByDaySince`/`sumUsageByModelSince`, `@since` epoch ms·'all'=0) → `UsageTracker.usageStats(range)`(camelCase 매핑, 비캐시) → `orca:cost:usageStats`(fallback=빈 요약) → preload/`costApi.usageStats` → `useUsageStats(range)`(기간별 캐시 + 최신값 교체, cancelled 플래그).
- **순수 헬퍼** `src/shared/usage/stats.ts`(main·renderer 공유): `rangeSince`/`localDayKey`/`totalTokens`(4종 합산 단일 지점)/`fillDailySeries`(제로필+미래키 클램프+730일 캡)/`aggregateWeekly`(월요일 시작, clock.ts weekStart 동일 기준).
- **UI**: `UsageTab.tsx` 재작성 — `RangeTabs`(SettingsModal 선택 패턴 인라인) + 헤드라인(총 토큰 M 표기+총비용) + `SettingsGroup`(일별 토큰 → `TokensPerDayChart.tsx`) + `SettingsGroup`(모델별 → `ModelUsageList`). 차트는 recharts `BarChart`, 바 `var(--color-indigo)`, 커스텀 툴팁(bg-panel/border 토큰).
- **레이어 경계**: 신규 파일은 전부 기존 요소 내부(shared/usage · infra/db · features/usage · app/handlers · renderer features/settings) — boundaries 변경 없음. settings feature 는 `shared/api/ipc` 직접 소비(기존 GeneralTab 선례).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 로딩: `usage.loading` 문구. 빈 데이터: 점선 카드(`settings.usage.empty`). 탭 전환: 기간별 캐시로 깜빡임 방지, 재조회로 최신화.
- '전체' 90일 초과: 주 단위 막대 + `weeklyNote` 안내. 730일 캡(시계 오염 행 방어), 오늘 이후 키 클램프.
- 테마: white/dark 모두 시맨틱 토큰 경유(indigo 는 두 테마 공용 지정색). 접근성: 차트 `role="img"`+aria-label, 탭 `role="tablist"`/`aria-selected`, 막대 hover 툴팁.
- 언어: ko/en 라벨, 축 날짜는 `formatMonthDay(locale)`.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| SQLite `'localtime'` vs V8 로컬 일자 계산의 DST 경계 미세 불일치 | 둘 다 OS 존 추종 + 자정 교차 DB 테스트. 표시 전용이라 영향 낮음 |
| 'all' 범위 전 테이블 스캔 | 인덱스(created_at) 스캔 + 희소 행 전송 — 데스크톱 규모 무해. 렌더러는 730캡+주간 집계 |
| 주기적 실행 UI 제거로 `scheduler.usageRecompute` 인앱 토글 소멸 | 의도된 결정(사용자 확정 2). 설정 파일로는 여전히 변경 가능, 사용량은 매 턴/조회 시 갱신 |
| recharts 번들 증가 | Electron 데스크톱 — 사용자 승인 하 수용. 설정 모달 한정 사용 |

- 되돌리기 어려운 결정: 없음(스키마·마이그레이션 무변경, UI/IPC 는 되돌리기 가능).
- Open Question: 없음 — 단독 결정 후보 3건(토큰 합산·제거 범위·차트 라이브러리)은 모두 사용자 확정 완료.

## 영향 받는 파일

- `app/src/shared/{ipc,protocol}.ts` · `app/src/shared/usage/stats.ts`(+test, 신규)
- `app/src/main/infra/db/{types,queries}.ts`(+queries.test.ts) · `app/src/main/features/usage/tracker.ts` · `app/src/main/app/handlers/misc.ts`
- `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` · `app/src/renderer/src/shared/i18n/index.ts`
- `app/src/renderer/src/features/settings/` — `components/UsageTab.tsx`(재작성) · `components/TokensPerDayChart.tsx`(신규) · `hooks/useUsageStats.ts`(신규) · `lib/usageFormat.ts`(+test) · `lib/usageSchedule.{ts,test.ts}`(삭제)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `app/package.json`(recharts)
- `docs/IPC_CONTRACT.md` · `docs/TRD.md §4` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/TRD.md §4` (스택 — recharts 행 추가)
- `docs/IPC_CONTRACT.md` §2.12 (cost 도메인, §6 변경 절차 동시 갱신)
- `docs/arch/frontend/layers.md` (4-layer 경계)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`(환경 제약 시 vitest 직접 실행 + DB 스위트 분리 보고).
- 신규 테스트: `shared/usage/stats.test.ts`(순수 변환기) · `queries.test.ts` 0112 블록(DB 집계) · `usageFormat.test.ts`(포맷).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 인용으로 남겼고, 추론(주간 집계·K 폴백)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 파일:라인/문서 레퍼런스를 붙였다.
- [x] 인수 기준 — 11개 번호, 조사 근거, 검증 가능.
- [x] 의존 기술 — recharts 는 사용자 승인 완료로 표기.
- [x] 파생 UX — 로딩/빈상태/탭 전환/테마/접근성/언어를 펼쳤다.
- [x] 리스크 — DST·스캔 비용·토글 소멸·번들 증가와 완화책을 적었다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전반(동일 세션에서 설계·구현 연속 수행).
- 이견 / 우려: 없음. 단 `formatMonthDay` 배럴 재노출은 0100 F4(소비자 부재로 제거)의 되돌림 — 신규 소비자(차트 축 라벨)가 생긴 정당한 재노출로 주석에 사유를 남겼다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | recharts 커스텀 Tooltip 의 타입 — recharts 제네릭 대신 구조적 최소 타입(`{active?, payload?}`)으로 수용 | ✅ 구현함 | 라이브러리 내부 타입 결합 최소화 |
| 2 | 헤드라인 총합은 제로필 전 희소 rows 합산으로 계산(주간 집계와 무관하게 정확) | ✅ 구현함 | 표시 집계는 차트 전용이라는 설계 의도 유지 |

## [구현자 기입] 구현 체크리스트

- [x] 공유 타입/채널/스키마 + `shared/usage/stats.ts`(+test)
- [x] DB lazy stmt 2 + row 타입 + queries 테스트(0112 블록)
- [x] `UsageTracker.usageStats` + 핸들러(fallback) + preload + costApi + `useUsageStats`
- [x] UsageTab 재작성(RangeTabs/헤드라인/차트/모델목록/빈·로딩 상태) + `TokensPerDayChart`(recharts)
- [x] `formatTokens`(+test) · usageSchedule 삭제 · i18n ko/en 갱신
- [x] IPC_CONTRACT 65→66 · TRD §4 recharts · INDEX 행

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 전체 (신규 5·삭제 2 포함) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint ✅(error 0, 경고 1=0102 기지) / typecheck 3종 ✅ / vitest — 커밋 메시지·INDEX 비고 참조 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 INDEX 기재) |

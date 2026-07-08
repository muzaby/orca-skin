# 0080 — 사용량 UI 피드백 (색상 · 동기화 · 도넛 클릭 · provider별 한도)

> 0079(사용량 한도 UI) 후속 사용자 피드백 4건. 비기능+소기능 = **Claude 직접 구현**(plan → impl → verify). 라이브 Codex 부재.

## 0. 자료조사

- **0079 산출물**(`b24bf52`): 설정 사용량 탭(`UsageTab`)·도넛 팝오버(`UsagePanel`)·공용 파생 `computeUsageLimits`(`@app/src/shared/usage/limits.ts`)·`useUsageLimits`·costStore. 진입점 정리는 `INDEX.md` 0079 행.
- 프로그레스바 색: `Meter`(`shared/ui/Meter.tsx`)·`UsageCircle`(`shared/ui/UsageCircle.tsx`) 둘 다 low tier = `good`(초록). 토큰 `--color-good/warn/bad`, 파랑 후보 = `--color-indigo`(#4a5b8c, `styles/tokens.css`, `@theme` 안이라 `bg-indigo` 유틸 생성됨).
- 실사용량 원장: `turn_usage`(session_id FK) + `sessions.provider_key`(0008/0010, agent key 예 'claude-bedrock'). → provider별 귀속 = `turn_usage ⨝ sessions(provider_key)` 로 파생 가능(신규 원장 불필요).
- provider 목록(renderer): shared `agentStore`(`agent:list` = `sources/settings/<adapter>/<provider>/`). `AgentEnvironment.key` = provider_key.
- cost IPC: `orca:cost:summary`(캐시 반환)·`summaryEvent`. 핸들러 `app/handlers/misc.ts`. tracker `features/usage/tracker.ts`.
- 레이어: `features/settings` 는 `features/cost` 를 직접 import 불가(교차-feature 금지) → app 레이어(`SidebarUserButton`)가 cost 훅 호출해 props 주입(0079 `usageLimits` 와 동형).

## 1. 사용자 의도 (명시)

1. **도넛패널/설정 사용량 progress bar 색을 파랑→노랑→빨강** 순으로.
2. **설정.사용량 → 사용량 한도 하단에 동기화 버튼** ("마지막 업데이트: 방금/N분 전 + 새로고침 버튼, 클릭 시 inflight 애니메이션").
3. **도넛 패널의 사용량 한도 클릭 영역을 우측 `>` 로만** 한정.
4. **설정.사용량 하위에 provider 서브항목** 추가 — 각자 사용량 한도/한도 설정 제공(**provider별 DB 한도 필요**).

**Q&A 확정**(AskUserQuestion): ④ 사용량 = **실 provider별 집계**(turn_usage ⨝ provider_key), 한도 = **provider별 독립 한도(신규 DB 테이블) + 전역 '월간 사용 한도' 유지**.

## 2. 의존 기술·전제

- 신규 의존성 0. 신규 DB 테이블 1(`provider_limits`, migration 0012). 신규 IPC 채널 2(cost 2→4).
- 색상 토큰 `--color-indigo` 재사용(신규 토큰 0).

## 3. 인수 기준 (verify 1:1 대조)

1. `Meter` 자동 톤이 **파랑(`bg-indigo`)→노랑(`bg-warn`)→빨강(`bg-bad`)** (임계 0.6/0.85 유지). `UsageCircle` progress arc 도 동일 정렬(초록 제거).
2. 설정 사용량 '사용량 한도' 하단에 **"마지막 업데이트: <상대시각>" + 새로고침 버튼**. 클릭 시 `orca:cost:summary` 재조회 + inflight 동안 아이콘 `animate-spin`, 중복 클릭 무시. 상대시각 라벨은 시간 경과에 따라 갱신.
3. `orca:cost:summary` 핸들러가 **recompute()** 로 최신 집계를 반환(동기화가 최신값을 받음).
4. 도넛 `UsagePanel` 의 '사용량 한도' 헤더에서 **`>` 아이콘 버튼만** 설정 이동(라벨 텍스트는 비클릭).
5. migration `0012_provider_limits`(provider_key PK · limit_usd nullable · updated_at) 추가 + migrate.ts 등록. 머지된 마이그레이션 무수정.
6. `DbQueries`: `sumUsageByBoundariesForProvider`(provider_key 조인·필터, NULL provider 세션 제외) · `getProviderLimit` · `setProviderLimit`(upsert). 단위 테스트 동반.
7. `UsageTracker.providerSummary(key)` = provider 한정 `CostSummary`(요청 시 DB 스캔, 캐시 안 함).
8. IPC 2채널(`cost:providerSummaries`·`cost:setProviderLimit`) + preload + `costApi` + zod 스키마 + `ProviderUsageEntry` 타입 + IPC_CONTRACT 갱신(57채널·cost 4).
9. 설정 모달 좌측 nav 에서 '사용량' 하위에 **구성된 provider 서브항목**(agentStore 파생) 표시. 각 서브탭 = 자기 실사용 한도 바 + 자기 월 한도 설정(`setProviderLimit`). 전역 '사용량' 탭은 '월간 사용 한도'(전체) 유지.
10. 교차-feature import 0(settings↛cost) — app 레이어가 `useCostRefresh`·`useProviderUsage` 를 주입. 게이트 lint(경계)/typecheck/test 통과.

## 4. 파생 UX·엣지케이스

- provider 서브탭 진입 시 아직 미조회면 바가 로딩("불러오는 중"). provider 목록 비면 서브항목 0(전역 탭만).
- provider 삭제(목록에서 사라짐) 후 해당 provider 탭이면 "provider 를 찾을 수 없습니다".
- 한도 null(무제한) = 바 muted·"무제한". 미래 timestamp/1분 미만 = "방금".
- 동기화 inflight 중복 클릭 무시(store `refreshing` 가드).

## 5. 리스크·트레이드오프

- provider별 실사용은 `sessions.provider_key` 에 의존 — 레거시 NULL provider_key 세션 사용량은 어떤 provider 에도 안 잡힌다(전역엔 잡힘). 의도된 동작(테스트 고정).
- `cost:summary` 를 recompute 로 바꿔 매 조회가 1 SQL 스캔 — 단일 쿼리라 비용 무시 가능(설정/부팅 빈도).
- 색상 변경은 컨텍스트 창 바에도 적용(일관성) — 도넛/설정 외 컨텍스트 바도 파랑 시작. 피드백 의도(일관 색 언어)에 부합.

## 5. 설계 self-review 체크리스트

- [x] 인수 기준 번호화(1:1 대조 가능)
- [x] Open Question(provider 한도 구조·실집계) = 사용자 Q&A 로 확정
- [x] 신규 의존성 0
- [x] 레이어 경계 해소책 명시(app 주입)
- [x] 머지된 마이그레이션 무수정(새 파일 0012)

## [구현자 기입] — Claude 직접 구현

- **변경 파일**:
  - 색상: `shared/ui/Meter.tsx`(info 톤=`bg-indigo`, low→info) · `shared/ui/UsageCircle.tsx`(low→indigo).
  - 도넛: `features/chat/components/UsagePanel.tsx`(헤더 `>` 버튼만 클릭).
  - 동기화: `features/cost/store/costStore.ts`(lastUpdatedAt·refreshing·refreshCost) · `features/cost/hooks/useCostRefresh.ts`(30s 틱 상대시각) · `shared/time/relative.ts`(+test) · `app/handlers/misc.ts`(summary→recompute).
  - provider별: `infra/db/migrations/0012_provider_limits.sql` + `migrate.ts` · `infra/db/queries.ts`(3 메서드+stmt) · `features/usage/tracker.ts`(providerSummary) · `shared/ipc.ts`(`ProviderUsageEntry`·채널 2) · `shared/protocol.ts`(스키마 2·재노출) · `preload/index.ts` · `shared/api/ipc.ts` · `app/handlers/misc.ts`(핸들러 2) · `features/cost/hooks/useProviderUsage.ts`.
  - 설정 UI: `features/settings/store/settingsModalStore.ts`(provider 탭 id) · `components/UsageLimitViews.tsx`(공용 바+편집기) · `components/UsageTab.tsx`(sync row) · `components/ProviderUsageTab.tsx` · `components/SettingsModal.tsx`(nav 서브항목+라우팅) · `lib/usageFormat.ts` · `shared/ui/Icon.tsx`(className) · `app/SidebarUserButton.tsx`(주입).
  - 테스트: `shared/time/relative.test.ts` · `infra/db/queries.test.ts`(provider 3건) + 4 DB 테스트 헬퍼에 migration0012 추가.
- **게이트**: `npm run lint` 0(경계 0) · `npm run typecheck` 3종 0 · `npx vitest run` **753/753 runnable green**(3 스위트 electron 바이너리 403 환경 제한 = import 실패, 본 변경 무관·0050 계열).
- **설계 리뷰**: 인수 10/10 구현. 교차-feature 회피는 app 주입(0079 동형)로 해소.
- **놓친 잠재 문제 + 대응**: (a) 타 DB 테스트 헬퍼가 하드코딩 migration 목록 → 0012 누락 시 `DbQueries` 생성자가 stmt 준비 실패 → 4 파일에 migration0012 추가(선조치). (b) `Icon` 에 className 미지원 → spin 위해 prop 추가(범용 개선).

# 0080 검증 — 사용량 UI 피드백 (PASS r1)

## 결과 요약

**PASS** — 인수 10/10 충족. 게이트 lint 0(경계 0)·typecheck 3종 0·test **753/753 runnable green**(3 스위트 electron 바이너리 403 환경 제한으로 import 실패 = 본 변경 무관, 0050 계열). 신규 의존성 0, 신규 IPC 채널 2(cost 2→4), 신규 DB 테이블 1(`provider_limits`).

## 요구사항 충족 매트릭스

| # | 기준 | 증거 | 판정 |
|---|---|---|---|
| 1 | Meter/UsageCircle 파랑→노랑→빨강 | `Meter.tsx` `meterToneForRatio`(≥.85 bad·≥.6 warn·else `info`=`bg-indigo`) · `UsageCircle.tsx` `progressStroke`(else `--color-indigo`) | ✅ |
| 2 | 동기화 버튼(마지막 업데이트+새로고침 spin) | `UsageTab.tsx` `SyncRow`(`animate-spin` while refreshing) · `useCostRefresh.ts`(30s 틱·relativeTimeLabel) · `costStore.refreshCost`(refreshing 가드) | ✅ |
| 3 | summary 조회 = recompute | `app/handlers/misc.ts` `costSummary → ctx.cost.recompute()` | ✅ |
| 4 | 도넛 `>` 만 클릭 | `UsagePanel.tsx` 라벨 span + 분리된 `>` icon 버튼(`aria-label="사용량 한도 설정 열기"`) | ✅ |
| 5 | migration 0012 | `0012_provider_limits.sql`(provider_key PK·limit_usd nullable·updated_at) + `migrate.ts` 등록. 기존 마이그레이션 무수정 | ✅ |
| 6 | provider 쿼리 3종 + 테스트 | `queries.ts` `sumUsageByBoundariesForProvider`(JOIN sessions·NULL 제외)·`getProviderLimit`·`setProviderLimit`(upsert) · `queries.test.ts` 3건(집계·NULL 비귀속·한도 upsert) | ✅ |
| 7 | tracker.providerSummary | `tracker.ts` providerSummary(요청 시 DB 스캔, 미캐시) | ✅ |
| 8 | IPC 2채널+배선+문서 | `ipc.ts`(`ProviderUsageEntry`·채널 2) · `protocol.ts`(스키마 2·재노출) · `preload` · `costApi` · `misc.ts` 핸들러 2 · IPC_CONTRACT §2.12(57채널·cost 4) | ✅ |
| 9 | 설정 nav provider 서브항목+서브탭 | `SettingsModal.tsx`(usage 하위 provider 버튼·`provider:<key>` 라우팅) · `ProviderUsageTab.tsx`(자기 바+한도) · 전역 탭 '월간 사용 한도' 유지 | ✅ |
| 10 | 교차-feature 0 + 게이트 | settings 는 cost 미import(구조적 `ProviderUsageController` 로컬 선언) · app `SidebarUserButton` 주입 · lint/typecheck/test green | ✅ |

## 게이트 재실행

- `npm run lint` → 0 error 0 warning(경계 위반 0).
- `npm run typecheck`(node/web/test) → 0.
- `npx vitest run` → **753 passed**, 3 failed suites = `writer.test.ts`·`chat-turn.continuity.test.ts`·`chat-turn.runtime-resilience.test.ts`(electron 바이너리 install 403 = import-time 실패, 테스트 본문 무관·본 변경 무관).

## 검증 책임 분리 (사람 확인 대기)

| 항목 | 판정자 |
|---|---|
| lint/typecheck/test·경계 0·1:1 대조 | ✅ 에이전트 |
| `npm run dev` 도넛/설정 색상·동기화 spin·provider 서브탭 시각 | ⏳ 사람 |
| provider별 실집계 실환경(다중 provider 세션) | ⏳ 사람 |
| 상대시각 라벨 어감·PR 머지 | ⏳ 사람 |

## 검증 자기 리뷰

- 설계: provider 실집계가 `sessions.provider_key` 에 의존한다는 전제를 인수 6/파생에 명시 — 레거시 NULL 세션 비귀속을 테스트로 고정해 회귀 방지.
- 구현: 4개 DB 테스트 헬퍼의 하드코딩 migration 목록에 0012 를 함께 추가(선조치) — 장기적으로는 `applyMigrations` 공유가 낫지만 본 범위 밖(파생 이슈 후보).
- 검증: UI 시각/실환경 다중 provider 는 에이전트 판정 불가 → 사람 확인 위임.

# Verify — 0091-scheduler-periodic-execution

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0091-scheduler-periodic-execution` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `9805bc4` (INDEX 기재 Codex-env `cf76574` → 본 브랜치 실 `9805bc4`, 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: scheduler=순수 엔진 + action 주입으로 교차 feature 회피 | 타당 — lint boundaries 위반 0 확인 | AC2·AC5 증거에 반영 |
| 보완: cron 검증을 `shared/protocol.ts` zod refine 이 아닌 main 전용 `infra/cron.ts` 로 분리 | 타당 — renderer 번들에 croner 유입 방지. `protocol.ts` 는 순수 string 스키마(`z.string().trim().min(1)`)만, 실검증은 `SettingsStore.patch`→`assertValidCron` | AC4 증거 반영 |
| 선조치 #2: nested scheduler 설정 shallow merge 유실 → `SettingsStore.patch` scheduler 전용 deep merge | 타당 — `mergeSettings` 가 `usageRecompute` 까지 명시 병합 | AC4 증거 반영 |
| 선조치 #3: insert-only → started insert + finish update 2-API | 타당 — 단일 실행 lifecycle 1행 표현 | AC3 증거 반영 |
| 선조치 #4: shutdown early-return 이 stopAll 누락 → `stopAll()` 을 supervisor/bus 검사보다 먼저 | 타당 — `bootstrap.ts:324` 가 `if (!this.supervisor…) return` 앞에서 `scheduler?.stopAll()` 호출 | AC6 증거 반영 |
| 선조치 #5: croner protect skip 이 이력 미기록 → 내부 running set 으로 `skipped` 이력 기록 | 타당 — `scheduler.ts:77-81` + 테스트 `records skipped when the same job overlaps` | AC2/AC5 증거 반영 |

> 선조치 5건 모두 **선조치 가능 경계**(구현 세부·놓친 엣지케이스) 안. ⚠️(사용자 결정 필요) 항목 없음.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `croner` 의존성 추가·게이트 청결 | ✅ | `app/package.json` deps `croner`(설치 검증 10.0.1) · `app/AGENTS.md:17` 스택 표 + `docs/TRD.md:86` "확정 (0091)" · lint/typecheck 청결(아래 게이트) |
| 2 | `features/scheduler/` Scheduler 엔진 (register/start·stop/croner 발화/`protect`/`nextRun`/dispose, 경계 준수, 단위 테스트) | ✅ | `scheduler.ts` — `register`(22)·`schedule`(27, `new Cron(spec.cron,{protect:true},…)` 34)·`unschedule`(47)·`nextRun`(61)·`stopAll`(65, `disposed=true`)·주입 action 포트(생성자 recorder). 타 feature 직접 import 0(croner+shared 타입+`./cron-validate`만) → lint boundaries PASS. 테스트 4종 `scheduler.test.ts`: nextRun·success/error·skipped(겹침 protect)·dispose |
| 3 | `0013_schedules.sql` `schedule_runs` + `DbQueries` insert/list + 멱등 | ✅ | `migrations/0013_schedules.sql`(`schedule_runs` id·job_key·started_at·finished_at·status(CHECK)·error + 인덱스, `CREATE TABLE IF NOT EXISTS`) · `queries.ts` `insertScheduleRunStarted`/`finishScheduleRun`/`listScheduleRuns`(lazy prepared) · `migrate.ts:35` 목록 등록 · 멱등: `_migrations` 메타 + 테스트 `migrate.test.ts:98` "부분 적용된 DB 를 최신까지 전진"(schedule_runs 존재 확인) + `queries.test.ts:536` lifecycle 1행 |
| 4 | `SettingsSchema`/`PatchSchema` `scheduler.usageRecompute{enabled,cron}` + 재스케줄 + 잘못된 cron 거부 | ✅ | `protocol.ts:386-402` 스키마(기본 `enabled=false`·`cron='0 */1 * * *'`) + `:459` patch nested optional · 재스케줄: `misc.ts:98-102` `settingsSet`→`ctx.scheduler.applySettings(next.scheduler)`→`scheduler.ts:40` dispose후 재생성 · 잘못된 cron 거부: `settings-store.ts:38` `assertValidCron(next.…cron)`(croner try/catch, `infra/cron.ts`) → set 실패 전파 |
| 5 | 빌트인 usage-recompute job: action→recompute+broadcast, `schedule_runs` 기록, 틱 검증 | ✅ | `bootstrap.ts:184-186` `register('usage-recompute', () => cost.recordAndBroadcast())`(=`tracker.ts:39` recompute+broadcast) · 기록: `scheduler.ts:74-91` invoke 가 start→action→finish(success/error/skipped) · 틱 구동 검증: `scheduler.test.ts` runNow 로 success/error/skipped 이력 대조 |
| 6 | `Bootstrap.start()` initDb+UsageTracker 후 생성·주입·start, `shutdown()` 이 closeDb 앞 stop/dispose(닫힌 DB 접근 0, `disposed` 가드) | ✅ | 생성 순서: `bootstrap.ts:172`(cost)→`:183`(Scheduler(DbRunRecorder(db)))→`:184` register→`:188` applySettings · shutdown: `bootstrap.ts:324` `this.scheduler?.stopAll()` 이 supervisor/bus early-return(`:325`) **앞** · `index.ts:176-179` will-quit → `shutdown()` → `closeDb()` 순서 · 가드: `scheduler.ts:75` invoke `if (this.disposed) return` |
| 7 | Tweaks 토글+간격/cron 입력, 기존 `settingsSet` 만(신규 IPC 0, `IPC_CONTRACT` 무변경) | ✅ | `GeneralTab.tsx:132-195` "주기적 실행" 그룹(Toggle + 프리셋 select + cron input) · `useTweaks.ts` `scheduler` 바인딩·`setTweak('scheduler',…)`→`settingsApi.set` · 신규 채널 0(`shared/ipc.ts` diff 는 타입만, CHANNELS 무변경) · `IPC_CONTRACT.md` 커밋 stat 부재 |
| 8 | 게이트 그린(boundaries 0) | ✅ | 아래 게이트 재실행: lint PASS · typecheck 3종 PASS · vitest 791 passed(3 suite=electron 바이너리 403 환경, 무관) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint PASS · typecheck PASS · vitest 791 passed |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 충족(위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries PASS(scheduler 슬라이스 교차 import 0) |
| 문서 형식/링크/한국어 | ✅ | — | AGENTS/TRD 스택 표 갱신 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 유입 0(스택 표 1행만) |
| 신규 의존성 승인 | ✖ 제안 | ✅ | croner — plan 기재 사용자 승인 완료 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(Tweaks 토글·프리셋·cron 입력 시각) |
| 실환경 주기 발화 실기 | ✖ | ✅ | 사람 확인 대기(`npm run dev` 에서 enabled+짧은 cron→틱 발화·costSummary 갱신·schedule_runs 적재) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

> 환경 제약: electron 바이너리 egress 403(0019 verify 기록). `npm install --ignore-scripts` 후 better-sqlite3 Node ABI 만 재빌드해 게이트 실행.

```
$ npm run lint
> eslint --cache --fix ./src ./scripts        # PASS (에러 0, boundaries 위반 0)

$ npm run typecheck
> typecheck:node PASS / typecheck:web PASS / typecheck:test PASS

$ node scripts/ensure-sqlite-abi.mjs node     # [sqlite-abi] node: rebuilt
$ npx vitest run
 Test Files  3 failed | 102 passed (105)
      Tests  791 passed (791)
# 실패 3 suite = chat-turn.continuity / chat-turn.runtime-resilience / history/writer
#   — 전부 "Electron failed to install correctly"(electron 바이너리 403 환경 제한),
#     본 변경과 무관(scheduler/src 무접점). 격리 재실행으로 대리 검증:
$ npx vitest run features/scheduler/scheduler.test.ts infra/db/migrate.test.ts infra/db/queries.test.ts
 Test Files  3 passed (3)  ·  Tests  29 passed (29)
```

## 위생 검토 (AGENTS.md 변경 시)

- `app/AGENTS.md` 변경 = 스택 표 1행(`| 스케줄링 | croner … |`) + 의존성 정책 목록에 `croner` 추가. 키/토큰/이메일/IP 패턴 스캔 결과: 유입 0.
- 변동성/일회성/장문 코드설명서 혼입 여부: 없음(스택 사실만).

## PHASES.md 정합성

- 형식/커밋 기재: 본 verify 로 PHASES "페이즈 표" 에 `0091` 승격 행 추가(커밋 `9805bc4`).
- 관찰(드리프트): 직전 `0090` verify 커밋(`2a1fecc`)은 INDEX/verify.md 만 갱신하고 PHASES 승격을 생략했다. 본 verify 는 [`../AGENTS.md`](../AGENTS.md) "PASS → PHASES 표 행 승격" 정본 규칙을 따라 0091 을 승격한다(0090 소급 승격은 본 핸드오프 범위 밖).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 충실 — 자료조사 레퍼런스·리스크·비범위 경계(owner-coupling·catch-up)가 명확. cron 검증 위치(shared vs main)를 설계가 명시하지 않아 구현자 선조치로 보정됨(작은 갭).
- 구현 단계: 선조치 5건이 설계 갭(nested merge·이력 lifecycle·shutdown 순서·protect 이력)을 실무적으로 메움. `runNow` 를 IPC 로 노출하지 않아 "수동 즉시 실행" UI 는 없으나 AC 비요구(관측 패널과 함께 후속).
- 검증 단계: electron 바이너리 403 으로 3 suite 미로드 → 격리 재실행 + `src` 무접점 논증으로 대리. 실 cron 틱의 wall-clock 발화(스케줄된 `new Cron` 이 실제 시각에 콜백)와 Tweaks↔재스케줄 end-to-end 는 단위 대리 검증뿐, 실기(사람)는 대기.

## 결론 / 다음 단계

- **상태: PASS** — 인수 8/8 충족, 게이트 그린(electron 3 suite 는 환경 제한·무관), 레이어 경계 0, 신규 의존성 croner 승인 반영. PHASES 승격.
- 후속(비범위, plan §범위/비범위): 사용자정의 스케줄 CRUD + Routines UI + `/routines` 라우트 / 무인 대화 실행 job(headless owner 추상화 선결) / 놓친 실행 catch-up / 관측 패널(마지막 실행 시각·상태·`runNow` 수동 트리거).
- 사람 확인 대기: Tweaks 시각 검증 · 실환경 주기 발화 실기(enabled+짧은 cron→틱·costSummary·schedule_runs) · PR 머지.

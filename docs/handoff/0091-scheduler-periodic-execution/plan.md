# Plan — 0091-scheduler-periodic-execution

> 흐름: 의도 → 조사 → 설계 → 리스크. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0091-scheduler-periodic-execution` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PHASES "현재 작업 중" / 브랜치 `claude/periodic-execution-scheduling-txkjws` |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "앱 내부에서 주기적 실행 기능 지원 + 스케줄링 모듈 제공. 주 사용처 = 주기적 새로고침 · 주기적 대화 실행(자동화, futurescope)" | 라이브 세션 요청 |
| 명시 결정 | 범위=스케줄러 코어+주기적 새로고침 / 엔진=croner(cron 표현식) / 첫 새로고침 대상=사용량 집계 recompute | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | (해석) "모듈"=재사용 가능한 main-프로세스 스케줄링 엔진. 주기적 대화 실행은 *같은 엔진의 job kind* 로 후속 확장하되 지금은 owner-coupling 미해결로 포트만 설계 | 조사 근거(아래 §자료조사) |

## Context (왜)

Orca 에는 주기 실행 기반 시설이 없다. 사용자가 원하는 첫 실사용처는 백그라운드 "주기적 새로고침"(사용량 집계 자동 갱신)이며, 장기적으로 "주기적 대화 실행"(자동화/Routines)까지 같은 엔진 위에 올린다. 이 핸드오프는 **재사용 가능한 스케줄러 엔진 + 첫 소비처(사용량 recompute)** 를 심고, 무인 대화 실행은 확장 포트만 남긴다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 스케줄링/cron/주기실행 그린필드 — PRD/TRD 에 항목 없음, arch 는 `자동화/Routines`(`/routines`)를 Future Scope·nav 미노출로 예약만 | `@docs/arch/frontend/ux-domains.md:83` · `@docs/arch/frontend/overview.md:71` · `@docs/PHASES.md:153-155` |
| "Conversation" 은 금지 어휘 — 단위는 Session+Turn. 모듈명은 예약된 `자동화/Routines` 에 정렬 | `@docs/GLOSSARY.md §3` |
| main 에 스케줄러·cron·주기 setInterval 전무. 기존 타이머는 전부 1회성 timeout | `app/src/main/features/chat/timers.ts` · `app/src/main/features/chat/title-generation.ts:49` · `app/src/main/features/approvals/broker.ts:58` |
| 새로고침은 전부 on-demand. 사용량 = `UsageTracker.recompute()` (costSummary "동기" 버튼이 호출) | `app/src/main/features/usage/tracker.ts:28` · `app/src/main/app/handlers/misc.ts:236` |
| main→renderer 브로드캐스트 패턴 (costSummary 등) | `app/src/main/infra/ipc/send.ts` (`broadcastConcurrency` 계열) |
| 신규 feature 배선 4접점: 슬라이스 / shared 채널·zod / handler / bootstrap+shutdown. 슬라이스 교차 import 금지→구조적 포트 주입 | `@app/src/main/AGENTS.md` §"feature 수직 슬라이스" · `app/eslint.config.mjs` |
| 슬라이스 클래스 패턴 = db + 주입 콜백을 생성자로 받는 Electron-무관 순수 클래스 | `app/src/main/features/usage/tracker.ts` 생성자 |
| DB = better-sqlite3@12, prepared stmt(`DbQueries`), 마이그레이션 `NNNN_<name>.sql`(현재 0012), `?raw` 인라인, `_migrations` 메타, 머지된 파일 수정 금지 | `app/src/main/infra/db/queries.ts` · `app/src/main/infra/db/migrate.ts` · `app/src/main/infra/db/migrations/0012_provider_limits.sql` |
| 경량 설정 = SettingsStore(electron-store)+zod `SettingsSchema`; `settingsSet` 채널로 패치(신규 handler 불필요) | `app/src/main/infra/settings-store.ts` · `@app/src/shared/protocol.ts` |
| 부팅 배선/정리 단일 seam = `Bootstrap.start()`/`Bootstrap.shutdown()`(index.ts `will-quit`→shutdown→closeDb) | `app/src/main/app/bootstrap.ts` · `app/src/main/index.ts` |
| 턴 파이프라인은 렌더러 WebContents 에 owner-coupling — `TurnCoordinator<WebContents>`, `destroyed`/`render-process-gone` 자동 abort. 무인 대화 실행의 최대 난제 | `app/src/main/app/chat-turn.ts:504-514,517` |
| croner = zero-dep TS-native cron. `protect` 옵션으로 겹침 실행 방지, DST/TZ 처리, `.nextRun()` 제공 | 외부 https://github.com/hexagon/croner (README) |
| 의존성 정책: 스택 표 밖 패키지는 사용자 승인 — **croner 승인됨** | `@app/AGENTS.md` §의존성 정책 · 라이브 세션 응답 |
| 데스크톱 앱은 상시가동 아님 — 스케줄은 앱 실행 중에만 발화(OS-레벨 cron 아님). OpenCode 도 인앱 60분 자동갱신 방식 | `@docs/etc/study/opencode/09-cost-token-module.md:293` |

## 인수 기준 (Acceptance Criteria)

1. `croner` 가 `app/package.json` 의존성에 추가되고(승인됨), 설치·게이트가 깨끗이 통과한다.
2. 신규 슬라이스 `app/src/main/features/scheduler/` 에 `Scheduler` 엔진이 존재한다 — job 등록 / start·stop / croner 기반 발화 / `protect`(겹침 방지) / 다음 실행시각(`nextRun`) 노출 / dispose. 레이어 경계 준수(타 feature 직접 import 0, job action 은 주입된 구조적 포트). 단위 테스트: 스케줄링·nextRun·겹침 protect·dispose.
3. 마이그레이션 `app/src/main/infra/db/migrations/0013_schedules.sql` 가 실행 이력 테이블 `schedule_runs`(id · job_key · started_at · finished_at · status · error)를 추가하고, `DbQueries` 에 insert/list 메서드가 생기며, 멱등 적용된다(마이그레이션 테스트).
4. `SettingsSchema`/`SettingsPatchSchema` 에 `scheduler.usageRecompute { enabled: boolean, cron: string }` 가 추가(zod, 기본값)되고, `settingsSet` 패치 시 스케줄러가 재스케줄(dispose 후 재생성)한다. 잘못된 cron 문자열은 set 시점에 거부(zod refine + croner 파싱 try/catch)한다.
5. 빌트인 "사용량 recompute" job: 발화 시 주입된 action → `UsageTracker.recompute()` + costSummary 브로드캐스트를 호출하고, `schedule_runs` 행(started/finished/status)을 기록한다. 틱을 구동해 검증한다.
6. `Bootstrap.start()` 가 initDb + UsageTracker 이후 Scheduler 를 인스턴스화·주입·(enabled 면)start 하고, **`Bootstrap.shutdown()` 이 closeDb 이전에 모든 Cron 을 stop/dispose** 한다(닫힌 DB 접근 0 — `disposed` 가드).
7. 렌더러 Tweaks 에 "주기적 사용량 새로고침" 토글 + 간격/cron 입력이 추가되고, **기존 `settingsSet` 경로만** 사용한다(신규 IPC 채널 0, `IPC_CONTRACT.md` 무변경).
8. 게이트 그린: `cd app && npm run lint && npm run typecheck && npm test` (boundaries 위반 0).

## 범위 / 비범위

- **범위**: main-프로세스 스케줄러 엔진(croner) · 실행 이력 영속(`schedule_runs`) · 설정 기반 구성 · 빌트인 "사용량 recompute" job 1종 · Tweaks 토글(기존 settings 경로).
- **비범위(후속 핸드오프)**:
  - 사용자 정의 스케줄 CRUD + `Routines` UI 화면 + `/routines` 라우트 등록.
  - **주기적/무인 대화 실행 job** — 턴 파이프라인 owner-coupling(`chat-turn.ts:504-514`) 해소(headless owner 추상화)가 선결. 본 설계는 job action 포트로 *확장 지점만* 남긴다.
  - 앱 종료 중 놓친 실행 catch-up/replay.
  - skills 재스캔·설치상태 재확인 등 다른 리프레셔의 스케줄 연결(엔진은 지원, 미배선).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성**: `croner`(zero-dep, TS-native) — **사용자 승인 완료**. `app/package.json` + `app/AGENTS.md`/`docs/TRD.md` 스택 표에 반영.
- 재사용 전제: `UsageTracker.recompute()`, costSummary 브로드캐스트(`infra/ipc/send.ts`), `DbQueries`/마이그레이션 패턴, `SettingsStore`/`settingsSet`, `Bootstrap` DI+shutdown seam.
- 전제: 스케줄은 앱 실행 중에만 발화(데스크톱 특성). 사용자 기대치는 Tweaks 설명 문구로 관리.

## 설계

- **슬라이스** `features/scheduler/`:
  - `types.ts` — `JobKey`(`'usage-recompute'` | 후속) · `ScheduleSpec`(cron 문자열) · `JobRun`(이력) · `JobAction = () => Promise<void>`(구조적 포트).
  - `scheduler.ts` — `Scheduler` 클래스. 생성자에 `runRecorder`(DB 기록) + `now`(테스트용 clock) 주입. `register(key, action)` / `schedule(key, spec)`(croner `Cron`, `{ protect: true }`) / `unschedule(key)` / `runNow(key)` / `stopAll()`(dispose, `disposed=true`) / `nextRun(key)`. 발화 콜백: run 기록(started)→action→기록(finished/status/error). Electron·feature 무관 순수 로직.
  - `run-recorder.ts` — `DbQueries` 얇은 래퍼(insert/list `schedule_runs`).
  - `index.ts` — 배럴.
- **결합 절단**: `Scheduler` 는 `features/usage` 를 import 하지 않는다. 컴포지션 루트가 `usage-recompute` action(`async () => { usageTracker.recompute(); broadcastCostSummary(...) }`)을 **주입**한다(`app/src/main/AGENTS.md` 해소책 3 — concrete 주입).
- **영속**: `0013_schedules.sql` 는 이번 컷에서 **`schedule_runs`(관측성)만** 추가. 빌트인 job *정의* 는 코드, *enabled/cron 오버라이드* 는 설정. 사용자 정의 `schedules` 테이블은 CRUD/UI 가 오는 후속 컷으로 연기(YAGNI).
- **설정**: `SettingsSchema.scheduler.usageRecompute { enabled=false, cron='0 */1 * * *'(예: 매시) }`. 렌더러는 기존 `settingsSet` 로 패치. main 은 settings 변경을 감지해 재스케줄 — `settingsSet` handler 가 `ctx.scheduler.applySettings(next)` 호출(또는 SettingsStore 변경 훅 구독).
- **배선**(`bootstrap.ts`): initDb→DbQueries→UsageTracker 뒤에 `Scheduler` 생성, `register('usage-recompute', action)`, 설정 반영 후 start. `RouterContext`(`app/context.ts`)에 `scheduler` 노출(재스케줄 handler 접근용). `Bootstrap.shutdown()` 에 `scheduler.stopAll()` 을 **closeDb 앞**에 추가.
- **레이어 준수**: 슬라이스=같은-slice·contracts·adapters·infra·shared 만. action 주입은 app. 신규 top-level 디렉토리 없음(features 하위). 새 IPC 채널 없음 → `shared/ipc.ts` 채널 상수 무변경.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **겹침 실행**: 이전 run 미완 시 다음 발화 skip — croner `protect: true`.
- **잘못된 cron**: set 시 zod refine + croner 파싱 검증→거부(설정 미반영). 런타임 파싱 실패 job 은 disabled + 이력에 error status.
- **동시성**: `recompute()` 는 DB 집계 재스캔(수동 동기 버튼이 이미 아무 때나 호출)이라 활성 턴 중에도 안전.
- **종료 순서**: Cron 콜백이 closeDb 이후 DB 접근하면 크래시 → shutdown 에서 `stopAll()` 선행 + `disposed` 가드.
- **설정 변경**: 실행 중 토글/간격 변경 → 기존 Cron dispose 후 재생성(재스케줄).
- **빈/로딩/에러 상태(UI)**: Tweaks 토글 off=미발화. 마지막 실행 시각/상태 표기는 후속(관측 패널) — 이번엔 토글+설명만.
- **테마/a11y**: Tweaks 기존 토글 컴포넌트 재사용 → 3테마·키보드 자동 충족.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 데스크톱 앱은 상시가동 아님 → "주기"는 앱 실행 중만 | 새로고침 유스케이스엔 충분. Tweaks 설명 문구로 기대치 관리. catch-up 은 비범위 |
| 종료 시 타이머가 닫힌 DB 접근 → 크래시 | `shutdown()` 이 closeDb 앞에서 `stopAll()`, `disposed` 가드(AC6). dispose 테스트 |
| 무인 대화 실행 owner-coupling | 이번 비범위. job action 포트로 확장점만 남김. 후속 핸드오프에서 headless owner 설계 |
| 신규 의존성 croner | 승인됨. zero-dep·TS-native·소형. 스택 표 반영 |
| 겹침/중복 실행 | croner `protect`(AC2) |

- 되돌리기 어려운 결정: 마이그레이션 `0013` 은 머지 후 수정 금지 — 변경은 새 파일. 테이블 스키마 보수적으로(관측 최소 컬럼).
- 단독 결정 금지(해소됨): 범위·엔진·첫 대상은 사용자 확정. 사용자 정의 CRUD/Routines UI 노출 시점은 후속에서 재질의.

## 영향 받는 파일

- **NEW** `app/src/main/features/scheduler/{types.ts, scheduler.ts, run-recorder.ts, index.ts, scheduler.test.ts}`
- **NEW** `app/src/main/infra/db/migrations/0013_schedules.sql`
- `app/src/main/infra/db/{migrate.ts(append), queries.ts(메서드), types.ts}`
- `app/src/shared/protocol.ts` (`SettingsSchema`/`SettingsPatchSchema`)
- `app/src/main/app/{bootstrap.ts(생성·주입·start·shutdown), context.ts(scheduler 노출), handlers/misc.ts 또는 settings 훅(재스케줄)}`
- 렌더러 Tweaks 토글 (`app/src/renderer/src/features/.../Tweaks*`)
- `app/package.json` (croner) · `app/AGENTS.md`/`docs/TRD.md` 스택 표

## 참고 문서

- `docs/arch/backend/overview.md` (main 레이어) · `app/src/main/AGENTS.md` (슬라이스·포트 규칙)
- `docs/arch/backend/persistence.md` (DB/마이그레이션)
- IPC 변경 **없음** → `docs/IPC_CONTRACT.md` 무변경(명시).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: Scheduler 엔진(nextRun·겹침 protect·dispose·action 호출) / 마이그레이션 멱등 / 설정 재스케줄 / recompute action 연동.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구·결정을 라이브 세션 출처로 인용, 추론은 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(파일:라인·@docs·웹 URL).
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — croner 신규 의존성 사용자 승인 표기.
- [x] 파생 UX — 겹침·종료순서·동시성·잘못된 cron·설정변경·테마 전개.
- [x] 리스크 — 상시가동/DB 종료순서/owner-coupling/의존성 + Open Question 사용자 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint / typecheck / test |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | 구현자 코멘트 §… / 사용자 / verify r<N> | … | open / 구현중 / 해결 |

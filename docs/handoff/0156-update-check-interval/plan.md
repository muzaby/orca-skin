# Plan — 0156-update-check-interval

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0156-update-check-interval` |
| 작성자 | Claude Code |
| 일자 | 2026-07-29 |
| 매핑 | PHASES Phase 4 행 (인앱 자동 업데이트 0084~0086 후속) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "앱 업데이트 체크를 다음의 상황으로 수정한다 — 앱 (재)시작 시 1회 (현행) / 앱 시작 후 6시간 주기 (추가) → settings 에 노출할 것" | 라이브 세션 요청 (2026-07-29) |
| 명시 요구 (질의 확정) | 주기 기준 = **앱 시작 시각 기준 6시간 간격**. 벽시계 정렬 cron(`0 */6 * * *`) 아님 | 라이브 세션 질의응답 (2026-07-29) |
| 명시 요구 (질의 확정) | settings 노출 = **자동 확인 on/off 토글 + 주기 선택(1·6·12·24시간, 기본 6시간)**. cron 문자열 비노출 | 라이브 세션 질의응답 (2026-07-29) |
| 명시 요구 (질의 확정) | 토글은 **주기 체크만** 제어. 시작 시 1회 체크는 현행대로 항상 수행 | 라이브 세션 질의응답 (2026-07-29) |
| 추론 의도 | 주기 확인은 *사용자가 명시 요청하지 않은* 확인이므로, 실패 시 시작 확인과 동일하게 조용히 삼켜야 한다(`status:'error'` 로 UI 를 흔들지 않음) — 추론 | `updater.ts:116-148` 의 `startup` 분기 동작에서 유추 |
| 추론 의도 | 설정 변경은 즉시 반영돼야 한다(재시작 요구 없음) — 추론 | 기존 `usageRecompute` 가 `misc.ts:107` 에서 즉시 재적용되는 선례 |

## Context (왜)

현재 업데이트 확인은 **앱 부팅 시 1회뿐**이다. `index.ts:259` 가 `Bootstrap.checkForUpdatesOnStartup()` 을 fire-and-forget 으로 부르고, 그 외 주기 실행 경로가 없다. 수동 확인 IPC(`orca:update:check`)는 존재하지만 렌더러에 호출자가 없다(`updateStore.updateActions.check()` = dead path).

결과적으로 앱을 며칠씩 켜두는 사용자는 새 릴리스가 게시돼도 **재시작 전까지 알 수 없다**. 릴리스가 `v*` 태그 push 시 즉시 게시되는 현 파이프라인(`release.yml`, 0087~0089)과 어긋난다.

본 작업은 시작 시 1회를 그대로 두고 **주기 확인을 추가**하며, 그 주기를 설정 모달에 노출한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 시작 시 확인은 `router.checkForUpdatesOnStartup()` 단 한 줄 — `Bootstrap.start()` 성공 후 fire-and-forget | `app/src/main/index.ts:259`, `app/src/main/app/bootstrap.ts:393-395` |
| 주기 실행 경로·`setInterval` 기반 업데이트 확인은 **존재하지 않는다**. main 의 `setInterval` 은 로그 flush 타이머 1개뿐 | `app/src/main/infra/log/file-transport.ts:40,54` (grep 전수) |
| `UpdateController.check(startup)` 은 `disabled \|\| !app.isPackaged` 면 `feed-not-configured` 로 조기 반환 → **dev 빌드에서 무해하게 inert** | `app/src/main/app/updater.ts:116-120` |
| `check()` 의 `startup=true` 는 에러를 `status:'idle' + lastError` 로 조용히 삼키고, `false` 는 `status:'error'` 로 표면화한다 | `app/src/main/app/updater.ts:116-148` |
| `check()` 는 `checking\|downloading\|installing` 중 재진입을 자체 디바운스한다 | `app/src/main/app/updater.ts:116-148` |
| `Scheduler`(croner) 가 이미 존재 — `register`/`schedule`/`unschedule`/`runNow`/`nextRun`/`stopAll`, 겹침 방지(`running` set → `'skipped'` 기록), `RunRecorder` 로 `schedule_runs` 영속, `scheduler.job.fired\|failed` 로깅 | `app/src/main/features/scheduler/scheduler.ts:13-106` |
| `ScheduleSpec` 이 **cron 문자열 전용** — "시작 시각 기준 N시간 간격" 을 표현할 수단이 없다 | `app/src/main/features/scheduler/types.ts` |
| `JobKey` 는 열린 유니온(`'usage-recompute' \| (string & {})`) 이라 새 key 추가에 타입 변경이 필수는 아니다 | `app/src/main/features/scheduler/types.ts` |
| 컴포지션 루트가 job action 을 주입해 feature 교차 import 를 회피하는 것이 확립된 패턴 | `app/src/main/app/bootstrap.ts:231-244`, `app/src/main/AGENTS.md` "주기 실행 경로(0091)" |
| `Scheduler.stopAll()` 은 `shutdown()` 에서 `closeDb` 앞에 이미 호출된다 | `app/src/main/app/bootstrap.ts:416` |
| 설정 변경 시 `misc.ts` 가 `scheduler.applySettings(next.scheduler)` 로 **즉시 재스케줄** 한다 | `app/src/main/app/handlers/misc.ts:105-113` |
| `SettingsStore.mergeSettings` 는 손으로 쓴 `scheduler.usageRecompute` 특례 병합이라 **새 중첩 키가 자동 확장되지 않는다** — 브랜치를 추가하지 않으면 형제 키가 날아간다 | `app/src/main/infra/settings-store.ts:67-84` |
| 모든 설정 키에 `.default()` 가 있어야 깨진 디스크 데이터도 부팅을 막지 않는다. 전체 파싱 실패 시 `recoverKnownSettings` 가 키 단위로 구제 | `app/src/shared/protocol.ts:408-479`, `app/src/main/infra/settings-migration.ts` |
| **0112 에서 cron UI 를 의도적으로 제거**했고, `Tweaks` projection 에 scheduler 를 두지 않기로 명시 결정 | `app/src/renderer/src/shared/hooks/useTweaks.ts:21-22` |
| `useTweaks.setTweak` 은 flat 패치(`{[key]: val}`)만 만들어 **중첩 `scheduler.updateCheck` 를 표현할 수 없다** | `app/src/renderer/src/shared/hooks/useTweaks.ts:62-71` |
| 중첩/대용량 설정은 `settingsApi` 직접 호출로 처리하는 선례가 있다(`accountInstructions`) | `app/src/renderer/src/features/settings/components/GeneralTab.tsx:38-40,46-63` |
| 설정 행 레이아웃 프리미티브 `SettingsGroup`/`SettingsRow` + `Toggle`(role="switch") 존재. 공용 `Select` 프리미티브는 **없고** raw `<select>` + 고정 클래스 문자열을 복사하는 관례 | `app/src/renderer/src/features/settings/components/parts.tsx`, `.../GeneralTab.tsx:125-135`, `app/src/renderer/src/shared/ui/Toggle.tsx` |
| 옵션 라벨은 모듈 상수에 **i18n 키만** 두고 렌더에서 `tr()` 해석 (언어 전환 stale 방지) | `app/src/renderer/src/features/settings/components/GeneralTab.tsx:13` |
| ko/en 카탈로그 leaf 키 집합 동등성·빈 문자열 금지·placeholder parity 를 테스트가 강제 | `app/src/renderer/src/shared/i18n/resources/resources.test.ts` |
| vitest 는 `environment:'node'` + `include:['src/**/*.test.ts']` — **`.tsx` 미수집, 컴포넌트 테스트 인프라 없음**. UI 는 시각 검증으로 갈음 | `app/vitest.config.ts`, `app/AGENTS.md` 에이전트 원칙 4 |
| 설정 키 카탈로그·`SettingsPatch` 형태가 문서에 박제돼 있어 동시 갱신 필요 | `docs/TRD.md §6.7` (339행), `docs/IPC_CONTRACT.md:100` |
| croner 는 이미 채택된 의존성(TRD 스택 표) — 신규 의존성 0 | `app/AGENTS.md` 의존성 정책, `app/package.json:41` |
| croner 의 `interval` 옵션은 "실행 사이의 **최소** 간격"이라 패턴과 합성되며, 첫 발화 시점이 패턴에 종속된다 — "시작 기준 정확히 N시간" 표현에 부적합 | `app/node_modules/croner/dist/croner.d.ts:197-200,686` |

## 인수 기준 (Acceptance Criteria)

1. **AC1** — 앱 시작 시 1회 확인이 종전과 동일하게 동작한다. `index.ts:259` → `checkForUpdatesOnStartup()` 경로에 **동작 변경이 없다**(파라미터 리네임 외 diff 없음).
2. **AC2** — `scheduler.updateCheck.enabled=true` 이면 `applySettings` 시점(=앱 시작) 기준 `intervalHours` 간격으로 `UpdateController.check(background=true)` 가 반복 발화한다. 첫 발화는 시작 즉시가 아니라 **1주기 후**다(시작 확인과 중복 금지).
3. **AC3** — `enabled=false` 이면 주기 잡이 스케줄되지 않거나 해제되며, **시작 시 1회 확인은 그대로 수행**된다.
4. **AC4** — 설정 모달 '일반' 탭에 '업데이트' 그룹이 노출된다: 자동 확인 `Toggle` + 확인 주기 `<select>`(1·6·12·24시간). 토글 off 면 select 가 `disabled`.
5. **AC5** — UI 변경이 `orca:settings:set` 으로 영속되고, `misc.ts` 의 `applySettings` 경로로 **재시작 없이** 스케줄에 반영된다.
6. **AC6** — `{scheduler:{updateCheck:{…}}}` 부분 패치가 `scheduler.usageRecompute` 를 보존하고, 그 역도 성립한다.
7. **AC7** — 깨진 디스크 값(`intervalHours: 7`, `enabled: 'yes'` 등)이 기본값(`{enabled:true, intervalHours:6}`)으로 복원되고 부팅을 막지 않는다.
8. **AC8** — 주기 잡 실행이 `RunRecorder` 로 기록되고, 이전 실행이 진행 중이면 `'skipped'` 로 남는다(기존 `invoke()` 경로 재사용).
9. **AC9** — `Scheduler.stopAll()`(shutdown) 이 interval 잡도 정지시켜 타이머가 새지 않는다.
10. **AC10** — ko/en i18n 신규 키가 parity 를 만족한다(`resources.test.ts` green).
11. **AC11** — 게이트: `npm run lint` 0 error(기존 warning 1 = 0102 베이스라인 허용) · `npm run typecheck` 3분할 0 error · 영향 vitest 스위트 green. 레이어 경계 위반 0, **신규 의존성 0**, DB 마이그레이션 0.
12. **AC12** — `docs/TRD.md §6.7` 의 `scheduler` shape 와 `docs/IPC_CONTRACT.md` 의 `SettingsPatch` 표기가 코드와 일치한다.

## 범위 / 비범위

- **범위**: `Scheduler` interval 스펙 · `scheduler.updateCheck` 설정 스키마/병합 · `update-check` 잡 배선 · 설정 UI 2행 + i18n · 문서 동기화 · 단위 테스트.
- **비범위**:
  - 수동 "지금 확인" 버튼 / 마지막 확인 시각 표기 — **의도적 스킵**. 사용자 선택지(토글+주기) 밖이며, `updateActions.check()` dead path 해소는 별건.
  - 자동 다운로드·자동 설치 정책 변경 — **의도적 스킵**. `autoDownload=false`·`autoInstallOnAppQuit=false` 유지(0084~0086 결정).
  - `orca.json` 업데이트 피드(`update.*`) 설정 변경 — **의도적 스킵**. 피드는 부팅 시 read-only 설정으로 별도 계층.
  - `usageRecompute` 를 interval 로 전환 — **의도적 스킵**. cron 이 적절한 잡이며 동작 변경은 범위 밖.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `features/scheduler`(croner 래퍼·`RunRecorder`) · `app/updater.ts`(`UpdateController.check`) · `infra/settings-store`(zod 검증 영속) · `shared/ui/Toggle` · `features/settings/components/parts`.
- 전제: `check()` 는 dev(`!app.isPackaged`)에서 조기 반환하므로 **주기 잡의 실제 발화는 패키징 빌드에서만 관측 가능**하다. 단위 테스트는 스케줄러 계층에서 발화 타이밍을 검증한다.
- 전제: `Scheduler.applySettings` 는 `schedule()` 호출 전 액션이 `register` 돼 있어야 한다(미등록 key 는 throw) → 등록 순서를 `applySettings` 앞에 둔다.
- **신규 의존성: 없음.** croner·electron-store·zod 모두 채택 완료 목록(`app/AGENTS.md` 의존성 정책).

## 설계

### 1. `Scheduler` 에 interval 스펙 추가 (`features/scheduler`)

`types.ts`
- `JobKey = 'usage-recompute' | 'update-check' | (string & {})` — 열린 유니온이지만 알려진 key 를 문서화한다.
- `ScheduleSpec = { enabled?: boolean } & ({ cron: string } | { intervalMs: number })` (판별 유니온).

`scheduler.ts`
- 내부 `ScheduledJob` 을 `{ handle: { stop(): void; nextRun(): Date | null }, spec }` 형태의 **얇은 핸들**로 통일 → `unschedule`/`stopAll`/`nextRun` 은 분기 없이 동작.
- `schedule()`: `'cron' in spec` 이면 종전대로 `assertValidCron` + `new Cron(..., { protect: true }, …)`. 아니면 `intervalMs` 를 양의 정수로 검증(위반 시 throw — cron 검증과 대칭)하고 `setInterval` 핸들을 만든다.
- **croner 의 `interval` 옵션은 쓰지 않는다** — 이 옵션은 "실행 사이의 **최소** 간격"이라 패턴 매치와 합성돼야 하고(`croner.d.ts:197-200`, `:686`), 첫 발화 시점이 패턴에 종속된다. `setInterval` 은 시맨틱이 자명하고 fake timer 로 결정적 테스트가 가능하다.
- 겹침 방지·`RunRecorder`·로깅은 기존 `invoke()` 를 그대로 탄다.
- `applySettings()` 에 `update-check` 추가 — `intervalHours * 60 * 60 * 1000`.

### 2. 설정 스키마 (`src/shared/protocol.ts` + `infra/settings-store.ts`)

- `SchedulerUpdateCheckSettingsBaseSchema = z.object({ enabled: z.boolean(), intervalHours: z.union([literal(1),literal(6),literal(12),literal(24)]) })`, default `{ enabled: true, intervalHours: 6 }` (기본 **켜짐**).
- `SchedulerSettingsSchema` 에 `updateCheck` 추가 + `.default()` 동시 갱신.
- `SettingsPatchSchema.scheduler` 에 `updateCheck: …partial().optional()`.
- `UPDATE_CHECK_INTERVAL_HOURS` 상수를 export 해 렌더러 select 옵션이 재사용(값 중복 방지).
- `mergeSettings()` 의 scheduler 분기에 `updateCheck` 병합 브랜치 추가 (**AC6 의 직접 근거**).

### 3. 컴포지션 루트 배선 (`app/bootstrap.ts`)

`scheduler.register('usage-recompute', …)` 직후, **`applySettings` 호출 이전에**:

```ts
scheduler.register('update-check', async () => {
  await this.updates?.check(true)
})
```

`this.updates` 는 ctx 조립(`bootstrap.ts:363`) 전까지 null 이지만 **액션은 발화 시점에 평가**되므로 안전하다(첫 발화는 최소 1시간 뒤). 부팅 실패 시 optional chaining 으로 no-op. feature 교차 import 없이 컴포지션 루트가 액션을 주입하는 기존 패턴 준수(`src/main/AGENTS.md`).

### 4. `check()` 파라미터 의미 정정 (`app/updater.ts`)

`check(startup: boolean)` 의 `true` 는 실제로는 "사용자가 명시 요청하지 않은 확인 → 에러를 조용히 삼킨다"는 뜻이다. 주기 확인도 같은 성질이므로 `true` 를 넘기되, 이름이 거짓말하지 않도록 **파라미터를 `background` 로 리네임**한다(정의 1 + 호출부 2). 동작 변경 없음.

### 5. 설정 UI (renderer)

- `GeneralTab.tsx` — '알림' 그룹 뒤에 '업데이트' `SettingsGroup` 신설, `SettingsRow` 2행(토글 / select). select 는 `GeneralTab.tsx:128` 의 클래스 문자열을 그대로 복사해 기존 select 3종과 시각적으로 동일하게. 토글 off 면 `disabled`.
- 옵션 라벨 상수는 **i18n 키만** 보유, 렌더에서 `tr()` 해석.
- 값 바인딩 — **`useTweaks` 는 건드리지 않는다**(flat 패치 한계 + 0112 결정). `accountInstructions` 선례를 따라 전용 훅 `features/settings/hooks/useUpdateCheckSetting.ts` 신설: mount 시 `settingsApi.get()` 로드, 낙관적 로컬 반영 + `settingsApi.set({scheduler:{updateCheck:patch}})`, reject 시 롤백(`useTweaks.ts:62-71` 패턴 이식).

### 6. i18n (`shared/i18n/resources/{ko,en}.ts`)

`settings.general` 아래: `updates` · `updateAuto` / `updateAutoDesc` / `updateAutoToggle` · `updateInterval` / `updateIntervalDesc` · `updateInterval1h` / `updateInterval6h` / `updateInterval12h` / `updateInterval24h`. ko/en 동일 구조.

### 7. 문서 동기화

`docs/TRD.md` §6.7 `scheduler` 행 shape + §2 F13 행 소비처, `docs/IPC_CONTRACT.md:100` `SettingsPatch` 표기.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: 설정 모달 mount 직후 `settingsApi.get()` 이 resolve 되기 전까지 스키마 기본값(`{true, 6}`)을 표시한다. 모달은 사용자가 열 때만 mount 되고 IPC 는 로컬이라 flash 는 무시 가능(`useTweaks` 와 동일 트레이드오프).
- **에러**: `settingsApi.set` reject 시 로컬 상태를 롤백해 UI 가 거짓 상태로 굳지 않게 한다. 주기 확인 자체의 실패는 `background=true` 경로라 `status:'idle' + lastError` 로 조용히 흡수 — 사용자를 방해하지 않는다.
- **동시성**: 주기 확인이 이전 확인과 겹치면 (a) `Scheduler.invoke` 의 `running` 가드가 `'skipped'` 기록, (b) `UpdateController.check` 자체 디바운스가 2중 방어. 다운로드/설치 진행 중 발화도 `check()` 디바운스가 흡수한다.
- **설정 변경 타이밍**: 토글/주기 변경 시 `applySettings` → `schedule()` 이 기존 잡을 `unschedule` 후 재생성하므로 **간격이 그 시점부터 다시 anchor** 된다. 예측 가능하고 사용자가 "지금부터 N시간" 으로 이해하기 쉬운 동작.
- **빈 상태 / dev**: `!app.isPackaged` 면 `check()` 가 `feed-not-configured` 로 조기 반환 → 잡은 발화하되 무해. `schedule_runs` 에는 `success` 로 남는다(확인 시도 자체는 성공).
- **접근성**: `Toggle` 은 `role="switch"` + `aria-checked` 를 이미 제공. `<select>` 는 네이티브라 키보드/스크린리더 기본 지원. `disabled` 상태가 시각·의미 양쪽에 반영된다.
- **테마**: 기존 `SettingsRow` + select 클래스 문자열이 시맨틱 토큰(`border-border`·`bg-bg`·`text-ink`)만 쓰므로 white/dark 자동 대응. 신규 raw hex 0.
- **멀티 윈도우**: 설정은 main 단일 스토어라 값 자체는 일관되나, 다른 창의 설정 모달은 자기 로컬 상태를 갱신하지 않는다. 현행 `useTweaks` 와 동일한 기존 한계로 본 작업 범위 밖.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `ScheduleSpec` 을 유니온으로 넓히면 기존 `spec.cron` 접근부가 타입 에러를 낸다 | 접근부가 `schedule()` 내부 1곳뿐(`scheduler.ts:33-39`). `'cron' in spec` 내로우잉으로 처리하고 typecheck 로 전수 확인 |
| `setInterval` 은 croner 와 달리 시스템 절전/시각 변경에 대해 보장이 다르다 | 업데이트 확인은 **정확한 시각이 요구되지 않는** 잡이라 드리프트가 무해. 정시성이 필요한 `usageRecompute` 는 cron 유지 |
| 기본값을 `enabled:true` 로 두면 기존 사용자도 주기 확인이 켜진 채 업그레이드된다 | 요구 자체가 "주기 확인 추가"이므로 의도된 동작. 끄고 싶으면 설정에서 즉시 off 가능 |
| `intervalHours` 를 리터럴 유니온으로 좁히면 향후 값 추가 시 저장된 설정이 스키마를 벗어난다 | `recoverKnownSettings` 가 키 단위로 기본값 복원하므로 부팅은 안전. 값 목록은 `UPDATE_CHECK_INTERVAL_HOURS` 단일 출처로 관리 |
| dev 에서 실제 발화를 관측할 수 없다 | 스케줄러 단위 테스트(fake timer)로 타이밍을, 설정 UI + `settings.patch.applied` 로그로 배선을 검증. 실기 확인은 사람 몫으로 분리 표기 |
| UI 컴포넌트 테스트 인프라가 없어 설정 행은 기계 검증 불가 | `app/AGENTS.md` 원칙 4(UI = 시각 검증)에 따라 사람 확인 항목으로 분리 |

- 되돌리기 어려운 결정: 없음. 스키마 키 추가는 `recoverKnownSettings` 로 하위호환되고, interval 스펙은 기존 cron 경로에 영향을 주지 않는다. DB 마이그레이션 없음.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 없음 (주기 기준·노출 범위·토글 범위 3건 모두 본 세션에서 사용자 확정).

## 영향 받는 파일

- `app/src/shared/protocol.ts` — `scheduler.updateCheck` 스키마 + patch 스키마 + `UPDATE_CHECK_INTERVAL_HOURS`
- `app/src/shared/ipc.ts` — `Settings` 타입의 scheduler shape
- `app/src/main/features/scheduler/types.ts` — `JobKey` · `ScheduleSpec`
- `app/src/main/features/scheduler/scheduler.ts` — interval 지원 + `applySettings`
- `app/src/main/features/scheduler/scheduler.test.ts` — 확장
- `app/src/main/infra/settings-store.ts` — `mergeSettings` 브랜치
- `app/src/main/infra/settings-store.test.ts` — 확장
- `app/src/main/app/bootstrap.ts` — `update-check` 등록
- `app/src/main/app/updater.ts` · `app/src/main/app/handlers/update.ts` — `background` 리네임
- `app/src/renderer/src/features/settings/components/GeneralTab.tsx` — '업데이트' 그룹
- `app/src/renderer/src/features/settings/hooks/useUpdateCheckSetting.ts` — **신규**
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` — 신규 키 10개
- `docs/TRD.md` · `docs/IPC_CONTRACT.md` — 스키마 동기화

## 참고 문서

- `docs/TRD.md §2 F13`(스케줄러) · `§6.7`(Settings 키 카탈로그)
- `docs/IPC_CONTRACT.md §2.4`(settings 채널·`SettingsPatch`)
- `docs/arch/backend/runtime-ipc.md §3.1`(자동 업데이트) · `§3.1-b`(스케줄러)
- `app/src/main/AGENTS.md`(레이어 DAG · 주기 실행 경로 0091) · `app/AGENTS.md`(의존성 정책 · 게이트 가이드)

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립 기본 루프) + 영향 스위트 `./node_modules/.bin/vitest run …`.
- egress 차단 환경이면 better-sqlite3 DB 로드 스위트 실패는 **알려진 베이스라인**으로 분리 보고(`app/AGENTS.md` 게이트 가이드).
- 신규 테스트 요구: scheduler interval 발화/해제/겹침(순수 로직) · settings 중첩 병합·기본값 복원(IPC 스키마).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 질의 확정 3건과 추론 2건을 구분 표기했다.
- [x] 자료조사 — 21개 발견 전부에 `파일:라인` 또는 `@docs/…` 레퍼런스를 붙였다. 확인 불가한 croner `interval` 옵션 동작은 주장하지 않고 **회피 설계**로 처리했다.
- [x] 인수 기준 — 12개 번호, 전부 코드 대조·단위 테스트·게이트로 검증 가능하다(AC4 만 사람 시각 확인 병행).
- [x] 의존 기술 — 기댈 모듈과 3개 전제를 식별했고, **신규 의존성 0** 임을 명시했다.
- [x] 파생 UX — 로딩·에러·동시성·설정 변경 타이밍·dev inert·접근성·테마·멀티윈도우를 펼쳤다.
- [x] 리스크 — 6개 트레이드오프와 완화책을 적었고, 되돌리기 어려운 결정 없음·Open Question 없음을 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 건은 *기능 추가*라 원칙상 Codex 대상이나, 사용자가 라이브 세션에서 직접 요청했고 Codex 가 없는 환경이므로 **Claude 가 plan → impl → verify 를 연속 수행**한다(`../AGENTS.md` 구현 주체 분담의 예외 — 커밋 trailer 형식은 동일).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 §1 의 "croner `interval` 옵션 회피" 는 옳다. 타입 정의를 실제로 확인해 보면(`croner.d.ts:197-200`) `interval` 은 *최소* 간격이라 패턴과 합성해야 하고, 잘못 쓰면 "6시간 주기" 가 "매분 발화 후 6시간 스로틀" 로 둔갑한다. `setInterval` 은 시맨틱이 자명하고 fake timer 로 검증된다.
- 동의: 설계 §5 의 "`useTweaks` 미개입" 도 옳다. `setTweak` 을 중첩 대응으로 고치면 `Tweaks` 전체의 계약이 바뀌어 blast radius 가 이 작업 범위를 크게 넘는다.
- 이견 / 우려: 설계 §3 의 `register('update-check', …)` 위치. plan 은 "`applySettings` 이전" 만 명시했는데, `this.updates` 가 그 시점에 null 이라는 사실이 코드만 봐선 위험해 보인다. 주석으로 "액션은 발화 시점 평가" 를 남기지 않으면 다음 사람이 순서를 '고치려' 들 수 있다 → 주석 추가로 대응.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `nextRun()` 이 cron 잡에만 의미가 있었다. interval 잡에서 무엇을 반환할지 설계가 정하지 않았다 | ✅ 구현함 — 스케줄 시각 + n·interval 로 **다음 발화 예정 시각**을 계산해 반환(`nextAt` 추적). 호출자(현재 없음)가 두 스펙을 구분하지 않아도 되게 유지 | `scheduler.ts:63-65` 의 기존 시그니처 `Date \| null` 보존 |
| 2 | `setInterval` 타이머가 Node 이벤트 루프를 붙잡아 종료를 지연시킬 수 있다 | ✅ 구현함 — `stopAll()` 이 `clearInterval` 하도록 핸들에 포함(AC9). 추가로 `unref()` 는 **쓰지 않음** — Electron main 은 앱 생명주기가 이벤트 루프를 잡고 있어 불필요하고, `unref()` 는 테스트에서 fake timer 동작만 흐린다 | `bootstrap.ts:416` (`stopAll()` → `closeDb`) |
| 3 | `intervalMs` 검증 실패 시 `applySettings` 가 throw 하면 부팅이 죽을 수 있다 | ✅ 확인함 — `bootstrap.ts:235-243` 이 이미 `applySettings` 를 try/catch 로 감싸 "periodic jobs disabled" 경고 후 진행한다. 새 검증도 같은 안전망 아래 놓인다 | `bootstrap.ts:235-243` |
| 4 | 설정 모달을 여러 번 열고 닫을 때 훅의 in-flight `settingsApi.set` 응답이 unmount 후 도착할 수 있다 | ✅ 구현함 — `useUpdateCheckSetting` 의 로드 effect 에 `cancelled` 플래그(useTweaks 선례), 저장 실패 롤백은 최신 값 기준 함수형 업데이트로 처리 | `useTweaks.ts:42-60` 패턴 |

## [구현자 기입] 구현 체크리스트

- [x] `types.ts` — `JobKey` 에 `'update-check'`, `ScheduleSpec` 판별 유니온
- [x] `scheduler.ts` — interval 핸들 + `schedule()` 분기 + `applySettings` 확장
- [x] `protocol.ts` — `updateCheck` 스키마/기본값/patch/`UPDATE_CHECK_INTERVAL_HOURS`
- [x] `ipc.ts` — `Settings.scheduler` 타입
- [x] `settings-store.ts` — `mergeSettings` 브랜치
- [x] `bootstrap.ts` — `update-check` 등록 (+ 순서 주석)
- [x] `updater.ts` / `handlers/update.ts` — `background` 리네임
- [x] `useUpdateCheckSetting.ts` 신규 + `GeneralTab.tsx` '업데이트' 그룹
- [x] ko/en i18n 키 10개
- [x] `scheduler.test.ts` / `settings-store.test.ts` 확장
- [x] `docs/TRD.md` · `docs/IPC_CONTRACT.md` 동기화

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | [검증 턴 기입] |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run <영향 스위트>` |
| 게이트 결과 | [검증 턴 기입] |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | [검증 턴 기입] |

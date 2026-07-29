# Verify — 0156-update-check-interval

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0156-update-check-interval` |
| 검증자 | Claude Code |
| 일자 | 2026-07-29 |
| 대상 커밋 | `eca3b01` (설계 `a345236`) |
| 라운드 | 1 |
| 상태 | **PASS** (UI 시각 확인 + 패키징 실기는 사람 대기) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 — croner `interval` 회피가 옳다(타입 정의상 *최소* 간격) | 타당. `node_modules/croner/dist/croner.d.ts:197-200` 이 "The minimum interval between job executions" 로 명시, `:686` 이 startAt+interval 조합의 이전 실행 추정을 설명한다. 패턴 없이 "시작 + N" 을 표현할 수 없다 | 설계·주석(`scheduler.ts:139-140`)에 근거 인용으로 고정 |
| 설계 리뷰 — 이견: `register('update-check')` 순서가 코드만 보면 위험해 보인다 | 타당. `applySettings` 가 미등록 key 에 throw 하므로(`scheduler.ts:38`) 순서가 불변식이다 | `bootstrap.ts:235-240` 에 "순서를 바꾸지 말 것" 주석 확인 — AC 외 개선으로 수용 |
| 선조치 #1 ✅ interval 잡의 `nextRun()` 계산 | 타당. 시그니처(`Date \| null`)를 유지해 호출자가 스펙을 구분할 필요 없음 | `scheduler.ts:141-151` 확인, 테스트가 `nextRun` null/비-null 을 대조 |
| 선조치 #2 ✅ `unref()` 미사용 결정 | 타당. Electron main 은 앱 생명주기가 루프를 잡고, `stopAll()` 이 `clearInterval` 한다. `unref()` 는 fake timer 검증만 흐린다 | AC9 테스트("stopAll clears the interval timer")로 고정 |
| 선조치 #3 ✅ `applySettings` throw 안전망 확인 | 타당. `bootstrap.ts:241-249` 의 기존 try/catch 가 새 검증도 덮는다 | 매트릭스 AC7 증거에 반영 |
| 선조치 #4 ✅ 훅의 unmount 후 응답 처리 | 타당. 로드 effect 에 `cancelled` 플래그, 저장은 함수형 업데이트 | `useUpdateCheckSetting.ts:19-26,29-38` 확인 |

⚠️(사용자 결정 필요) 항목: **없음**.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 시작 시 1회 확인 동작 무변경 | ✅ | `git diff` 상 `app/src/main/index.ts` **무변경**(commit stat 에 미등장). `bootstrap.ts:399` `checkForUpdatesOnStartup()` 은 `check(true)` 그대로 — 파라미터 리네임(`startup`→`background`)뿐이며 분기 의미 동일(`updater.ts:116-152`) |
| 2 | `enabled=true` 면 시작 기준 `intervalHours` 간격 발화, 첫 발화는 1주기 뒤 | ✅ | `scheduler.ts:63-66`(applySettings) + `:141-151`(intervalHandle). 테스트 `scheduler.test.ts` "fires repeatedly at the interval, first run one period after scheduling" — 6h−1ms 에 0회, 6h 에 1회, +12h 에 3회 |
| 3 | `enabled=false` 면 주기 잡 미스케줄/해제, 시작 1회 확인은 유지 | ✅ | `scheduler.ts:43`(`enabled===false` 조기 반환, `unschedule` 후). 테스트 "does not schedule when disabled, and unschedules a previously enabled job". 시작 확인은 AC1 과 같이 `index.ts` 경로 무변경 |
| 4 | 설정 '일반' 탭에 업데이트 그룹(토글 + select), off 면 select disabled | ✅ (시각 확인 대기) | `GeneralTab.tsx:201-231` — `SettingsGroup title={tr('settings.general.updates')}` + `Toggle`(`:207-210`) + `<select disabled={!updateCheck.enabled}>`(`:218-219`). i18n 키 10개 ko/en 존재 |
| 5 | 변경이 영속 + 재시작 없이 스케줄 반영 | ✅ | `useUpdateCheckSetting.ts:29-38` → `settingsApi.set({scheduler:{updateCheck}})` → `handlers/misc.ts:105-113` 의 `ctx.scheduler.applySettings(next.scheduler)`. 테스트 "applySettings drives both the cron and the interval job from settings" 가 재적용만으로 주기 확인이 멈추는 것을 고정 |
| 6 | 중첩 패치가 형제 그룹 보존 (양방향) | ✅ | `settings-store.ts:83-88` 병합 브랜치. 테스트 2건 — "updateCheck 부분 패치가 usageRecompute 와 자기 형제 필드를 보존한다", "usageRecompute 패치가 updateCheck 를 되돌리지 않는다" |
| 7 | 깨진 디스크 값이 기본값 복원, 부팅 안 막음 | ✅ | `protocol.ts:439-447`(모든 키 default) + `settings-migration.ts` 의 `recoverKnownSettings`. 테스트 "허용되지 않는 intervalHours 가 디스크에 있으면 기본값으로 복원된다"(`7`→`6`). 부팅 안전망 = `bootstrap.ts:241-249` try/catch |
| 8 | 주기 잡 실행이 기록되고 겹침 시 `'skipped'` | ✅ | interval 경로가 기존 `invoke()` 를 그대로 탄다(`scheduler.ts:44-46,96-121`). 테스트 "records interval runs and skips an overlapping run" — rows 2건, 2번째 `{status:'skipped', error:'Previous run is still active'}` |
| 9 | `stopAll()` 이 interval 타이머 정지 | ✅ | `scheduler.ts:90`(`job.handle.stop()`) → `:148`(`clearInterval`). 테스트 "stopAll clears the interval timer" — stopAll 후 10s 진행해도 0회 |
| 10 | ko/en i18n parity | ✅ | `resources.test.ts` green (leaf 키 집합 동등·빈 값 금지·placeholder parity). `ko.ts:723-732` ↔ `en.ts:729-740` |
| 11 | 게이트 · 경계 위반 0 · 신규 의존성 0 · 마이그레이션 0 | ✅ | 아래 "게이트 재실행 결과". `package.json` diff 0 라인, `src/main/infra/db/migrations/` 신규 파일 0 |
| 12 | TRD §6.7 / IPC_CONTRACT 가 코드와 일치 | ✅ | `docs/TRD.md` §6.7 `scheduler` 행 + §2 F13 행, `docs/IPC_CONTRACT.md` §2.4 `SettingsPatch` + `Settings` 인터페이스 — 모두 `updateCheck: { enabled; intervalHours: 1\|6\|12\|24 }` 로 갱신 |

**12/12 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(warning 1 베이스라인) · typecheck 3/3 · vitest 149 files/1249 tests · scripts 28/28 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 12/12, 증거 `파일:라인` 첨부 |
| 레이어 경계 위반 0 | ✅ | — | `eslint-plugin-boundaries` 0 error. 신규 훅은 `features/settings/hooks/` 에 배치(4-layer 준수), main 은 컴포지션 루트가 액션 주입(feature 교차 import 0) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX 한국어, 링크 유효 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | `AGENTS.md` **무변경** — 스캔 대상 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 주기 기준·노출 범위·토글 범위 3건은 본 세션에서 사용자 확정. 최종 확인은 사람 |
| Open Questions | ✖ | ✅ | 해당 없음 (PRD §11 / TRD §15 미접촉) |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — 설정 모달 '업데이트' 그룹 레이아웃·white/dark 대비·select disabled 표현 |
| 패키징 빌드 실기 | ✖ | ✅ | **사람 확인 대기** — `check()` 가 `!app.isPackaged` 에서 조기 반환(`updater.ts:117`)하므로 실제 발화는 NSIS 빌드에서만 관측 가능 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음 (신규 의존성 0) |
| PR 머지 승인 | ✖ | ✅ | 사람 결정 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
  → useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library (0102 기존 베이스라인)

$ npm run typecheck
typecheck:node ✅ / typecheck:web ✅ / typecheck:test ✅  (0 error)

$ ./node_modules/.bin/vitest run
 Test Files  149 passed (149)
      Tests  1249 passed (1249)

$ node --test scripts/*.test.mjs
# tests 28 / # pass 28 / # fail 0
```

> ABI 메모: 이 환경은 egress 가 열려 있어 `npm rebuild better-sqlite3`(Node ABI) + `node node_modules/electron/install.js` 로 **DB 로드 스위트까지 실기 green** 을 얻었다 — `app/AGENTS.md` 의 "DB 스위트 실패 = 알려진 베이스라인" 예외를 **사용하지 않았다**.

## 위생 검토 (AGENTS.md 변경 시)

- `AGENTS.md` 파일 변경 없음 → 위생 스캔 대상 없음.
- 신규 문서(`plan.md`·`verify.md`)에 키/토큰/이메일/IP 패턴 없음. 변동성 정보(커밋 hash·게이트 결과)는 핸드오프 문서에만 두었고 `AGENTS.md` 로 새지 않았다.

## PHASES.md 정합성

- `docs/PHASES.md` "현재 작업 중" 섹션은 보드 링크만 유지 — 규약대로 **손대지 않았다**.
- Phase 4 표에 `0156` 행을 승격 기재(범위·커밋).

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 첫 초안에서 croner `interval` 옵션을 "확인 불가" 로 적었는데, 실제로는 타입 정의를 읽어 근거를 댈 수 있었다(의존성 설치 후 정정). *조사 가능한 것을 리스크로 미루지 말 것* 이 교훈. 또한 `Tweaks` projection 을 쓸지 전용 훅을 쓸지는 설계에서 갈랐지만, "왜 useTweaks 를 못 쓰는가" 의 근거(`setTweak` flat 패치)를 코드 라인으로 고정한 건 조사 단계 후반이었다.
- **구현 단계**: `UPDATE_CHECK_INTERVAL_HOURS` 를 처음에 `protocol.ts`(zod, main 전용)에 두었다가 렌더러가 참조할 수 없음을 깨닫고 `ipc.ts`(renderer-safe)로 옮겼다. `MOCK_SCENARIO_IDS` 선례를 먼저 봤다면 한 번에 갔을 자리다.
- **검증 단계**: 이번 verify 가 **실제 발화를 보지 못했다** — dev 에서 `check()` 가 조기 반환하므로 스케줄러 계층까지만 기계 검증했고, "잡이 발화하면 UpdateController 가 실제로 확인한다" 는 배선은 코드 대조에 의존한다. `bootstrap.ts` 의 액션 주입을 단위 테스트로 고정하지 않은 것도 남는 틈이다(컴포지션 루트라 테스트 하네스가 없음). 후속으로 `Bootstrap` 배선 스모크 테스트를 만들면 이 틈이 닫힌다.

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 12/12, 게이트 전량 green, 신규 의존성 0, DB 마이그레이션 0, IPC 채널 수 무변경(설정 payload 형태만 확장).
- `docs/PHASES.md` Phase 4 표로 승격 완료.
- **사람 확인 대기 2건**: (a) 설정 모달 '업데이트' 그룹 시각 검증, (b) 패키징 빌드에서 주기 발화 실기 — 주기를 1시간으로 바꾼 뒤 `schedule_runs` 의 `update-check` 행 + `scheduler.job.fired` 로그로 확인.

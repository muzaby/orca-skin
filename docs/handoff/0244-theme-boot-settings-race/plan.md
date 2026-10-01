# Plan — 0244-theme-boot-settings-race

## 메타

| 항목 | 값 |
|---|---|
| slug | `0244-theme-boot-settings-race` |
| 작성자 | Claude Code |
| 일자 | 2026-09-30 |
| 매핑 | 이슈2(다크모드 재시작 초기화) — 사용자 라이브 세션 |
| 상태 | IMPL_DONE (r1.2) |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 다크 모드를 저장하고 앱을 다시 켜면 라이트 모드로 뜬다. 저장값은 디스크에 남아 있고, **읽기만 실패**한다.
- 완료 후 달라지는 것: 재시작 직후 첫 화면부터 저장한 테마·글자 크기·폰트·UI 언어·사이드바 폭/접힘·알림·지출 한도가 적용된다.
- 성공을 사용자 관점에서 한 문장으로: 설정을 바꾸고 껐다 켜도 바꾼 설정 그대로 열린다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "다크모드 설정 후 앱 종료, 재시작 시 라이트 모드로 돌아가는 현상 발견" · "다크모드 초기화도 이슈도 포함할 것" · "Plan 및 impl을 모두 진행하라" | 라이브 세션 |
| 추론 의도 | 같은 경합으로 함께 초기화되는 Tweaks 7종도 복구 대상이다 — 사용자가 본 것은 테마지만 원인이 같은 읽기 한 번이다(추론) | `TweakProvider.tsx:77` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 다크모드 재시작 초기화를 이번 작업에 포함한다 | "다크모드 초기화도 이슈도 포함할 것" | 사용자 턴 | ACTIVE | — |
| D-002 | 설계·구현을 모두 이번 세션에서 진행한다 | "Plan 및 impl을 모두 진행하라" | 사용자 턴 | ACTIVE | — |
| D-003 | `orca:settings:get` 을 창 생성 전에 등록한다. `orca:settings:set` 은 지금 자리(부팅 끝)에 둔다 | 읽기는 `SettingsStore` 만 필요하고 DB·스케줄러가 필요 없다. 쓰기는 `scheduler.applySettings` 가 필요하다 | 설계자 — 버그수정 | ACTIVE | — |
| D-004 | 테마 읽기가 실패하면 main 부팅 완료를 기다려 한 번 더 읽고, 그래도 실패하면 `loadFailed` 로 보고한다 | 등록 순서가 다시 어긋나도 설정이 조용히 기본값으로 남지 않게 한다 | 설계자 — 버그수정 | ACTIVE | — |
| D-005 | 같은 부류의 `update:state` · `session:cwd` 조기 호출은 이번 범위 밖이다 | 사용자에게 보이는 증상이 없다(§4) | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-005 (신규 handoff).
- 변경된 결정: 없음.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-003 ↔ AC1·AC2, D-004 ↔ AC3·AC4·AC5, D-005 ↔ §6 비범위(AC 없음).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 원인은 저장이 아니라 **등록 전 읽기**다 | `app/src/main/index.ts:304-306` 창 먼저 · `app/src/main/app/bootstrap.ts:808` `register(ctx)` 가 첫 `await`(`:520`) 뒤 |
| 이미 기존 코드가 충족하는가 | 아니오 — 부팅 게이트(`main-ready`)는 **부트 스텝이 부르는 호출만** 보호한다 | `app/src/renderer/src/app/boot/steps.ts:82` · `TweakProvider` 는 `App.tsx` 최상단이라 게이트 밖 |
| 더 작은 해법이 있는가 | renderer 쪽만 고치면(부팅 완료 뒤 읽기) 부팅 내내 라이트로 보인 뒤 바뀐다 — main 조기 등록이 더 작고 깜빡임도 없다 | `bootstrap.ts:411` 인증 핸들러 조기 등록 선례 |
| 선행 자료의 주장을 코드와 대조했는가 | `IPC_CONTRACT.md:69` "미등록 핸들러 invoke 창을 구조적으로 차단" 은 **틀렸다** — 게이트 밖 호출자가 있다 | `TweakProvider.tsx:77` · `chatStore.ts:1785` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0109 "창 먼저" 결정을 유지한다 — 순서를 되돌리지 않고 읽기 핸들러만 앞당긴다 | `index.ts:299-306` 주석 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: 저장은 정상(`settings.patch` 는 바꾼 키만 병합), 재시작 첫 `settings:get` 이 `No handler registered` 로 거절되고 `TweakProvider.load` 에 catch 가 없어 기본값 `white` 가 남는다.

## 5. 동작 / 사용자 흐름

```text
[앱 시작]
  → main: settings:get 등록 → 창 생성 → start() 부팅 계속
  → renderer: TweakProvider 마운트 → settings:get → 저장값 적용(첫 화면부터 다크)
  ↘ settings:get 실패 → main 부팅 완료 대기 → 한 번 더 읽기 → 적용
      ↘ 또 실패 → 오류 토스트 "불러오지 못했습니다"(loadFailed) + 기본값 유지
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 재시작 · 저장값 dark | 첫 읽기 성공 | 부팅 화면부터 다크 |
| 첫 읽기 실패 · 부팅 성공 | 부팅 완료 후 재시도 성공 | 부팅 중 라이트 → 부팅 완료 시 다크 |
| 두 번 모두 실패 | `reportError(loadFailed)` | 오류 토스트 + 라이트(기본값) — 조용히 기본값으로 남지 않는다 |
| 읽는 중 Provider 해제 | 응답 폐기 | 상태 변화 없음 |

### 파생 UX / 엣지케이스

- theme: 저장값을 적용하기 전까지 한 프레임은 기본 테마다(창 배경색 연동은 비범위).
- concurrency: 읽기 도중 사용자가 토글을 바꾸는 경합은 기존 동작 그대로다(비범위).
- 폐쇄망: 해당 없음.

## 6. 범위 / 비범위

- **범위**: `settings:get` 조기 등록(main) · `TweakProvider` 읽기 실패 복구와 보고(renderer) · 계약 문서 정정(`IPC_CONTRACT.md` 69·122행).
- **비범위**: `update:state` 조기 호출(보이는 증상 없음 — 대화상자를 열 때 `actionError` 를 지운다, `updateStore.ts:55`) · `session:cwd` 조기 호출(init 이벤트가 같은 값으로 덮는다, `chatStore.ts:1770`) · 창 배경색 테마 연동.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `update:state`·`session:cwd` 조기 호출 | 아니오 | 비범위(D-005) — 보고만 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `settings:get` 은 `start()` 의 첫 `await` 전에 등록된다 — 창보다 먼저 | 소스 스캔 테스트: `start()` 본문에서 등록 호출 위치 < 첫 `await` 위치. 등록 호출을 지우거나 `await` 뒤로 옮기면 실패 | `index.ts` `router.start()` → `start()` 동기 구간 → `ipcMain.handle(settingsGet)` → `createWindow` |
| R-01 | AT-02 / AC2 | 조기 등록 핸들러는 `SettingsStore.getAll()` 결과를 그대로 돌려주고, 설정 채널은 두 모듈 합쳐 **정확히 1회씩** 등록된다 | 핸들러 테스트: 반환값 = `getAll()` · 등록 전수 테스트: 기존 채널 집합과 동일·중복 0 | `registerSettingsReadHandler` · `registerSettingsHandlers` |
| R-02 | AT-03 / AC3 | 첫 읽기가 실패하면 main 부팅 완료를 기다린 뒤 다시 읽어 저장값을 적용한다 | store 테스트: `get` 1회 reject → `whenReady` resolve → `get` 2회차 `{theme:'dark'}` → `t.theme === 'dark'` | `TweakProvider` `useEffect(load)` → `settingsApi.get` → `bootApi.whenReady` |
| R-02 | AT-04 / AC4 | 재시도도 실패하면 `loadFailed` 오류를 보고하고 기본값을 유지한다 | store 테스트: 오류 토스트 title `loadFailed` · `t` 가 초기값과 같은 참조 | `reportError` → `errorToastStore` |
| R-02 | AT-05 / AC5 | Provider 해제(cleanup) 뒤 도착한 응답·재시도는 상태를 바꾸지 않는다 | store 테스트: reject 후 cleanup → 재시도 성공해도 `t` 불변, 토스트 0 | `load()` 반환 cleanup |
| R-01 | AT-06 / AC6 | Windows 설치본에서 다크 저장 → 종료 → 재시작하면 부팅 화면부터 다크다 | 사람 실기 — 실제 부팅 순서(electron)는 vitest 로 띄울 수 없다 | 설치본 실행 |

### AC 검증 주의사항

- 기존 테스트 재사용: `TweakProvider.store.test.ts` "loads the settings projection, cancels only that request…" 케이스가 정상 경로·취소를 이미 단언한다 — 유지하고 실패 경로만 추가한다. `misc-split.test.ts` 는 설정 두 채널을 `registerSettingsHandlers` 한 모듈에서 기대한다 — 모듈 집합에 `registerSettingsReadHandler` 를 넣어 갱신한다.
- 사람 실기 항목: AC6 — 창·부팅 순서는 electron 런타임에서만 관측된다. 순서 자체는 AC1 이 순수하게 잠근다.
- 순서 기준 관측 지점: `bootstrap.ts` 소스의 `start()` 본문 — `stripCommentsAndStrings` 로 주석·문자열을 지운 뒤 위치를 비교한다(`infra/source-scan` 선례: `no-stray-auth-subscribe.test.ts`).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 재시작 시 저장 Tweaks 적용 | NEW | — |
| R-02 | R | §5 읽기 실패 복구·보고 | NEW | — |
| AT-01..06 | AT | §7 | NEW | — |
| SD-01 | SD | §9 부팅 순서 — 읽기 핸들러가 창보다 먼저 | NEW | — |
| ST-01 | ST | AC1 소스 스캔 | NEW | — |
| AR-01 | AR | §10 설정 채널 등록 분할(조기 읽기/후기 쓰기, 중복 0) | NEW | — |
| IT-01 | IT | AC2 등록 전수 | NEW | — |
| MD-01 | MD | §11 `createTweakStore().load` 실패 복구 | NEW | — |
| UT-01 | UT | AC3~AC5 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-06 | REQUIRED | 설치본 시작 → `start()` → `createWindow` → `TweakProvider.load` → `dataset.theme` | 사람 실기: 부팅 화면 테마 | not selected — 실기 직접 관측 | EP-01·EP-02 (2) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | `start()` 동기 구간 → `registerSettingsReadHandler(this.settings)` | AC1 위치 비교 | **required** — 구조적 proxy. 변이 ① 호출 삭제 ② 호출을 첫 `await` 뒤로 이동 — 둘 다 red 여야 한다. 자리: `bootstrap.ts` `start()` | EP-01 (1) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | `registerSettingsReadHandler` + `registerSettingsHandlers` → `ipcMain.handle` | AC2 등록 집합 = 기대 집합, 중복 0 · 반환값 = `getAll()` | **required** — 전수 oracle. 변이: `registerSettingsHandlers` 에 `settingsGet` 재등록 → red | EP-02 (2) |
| VP-04 | MD-01 ↔ UT-01 | REQUIRED | `load()` → `settingsApi.get` ✗ → `bootApi.whenReady` → `settingsApi.get` → `setState` / `reportError` | AC3~AC5 상태·토스트 단언 | not selected — 직접 행동 oracle | EP-03 (3) |
| VP-05 | R-02 ↔ AT-03..05 | REQUIRED | VP-04 와 같은 경로 | AC3~AC5 | not selected — 직접 행동 oracle | EP-03 (3) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| 관련 vitest | 수정 모듈의 테스트 | `./node_modules/.bin/vitest run src/main/app/handlers src/main/app/bootstrap.settings-early.test.ts src/renderer/src/shared/theme` | 동일 |
| 문서 인벤토리 | `docs/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 동일 |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 창을 `start()` 완료 전에 만든다(0109) | `app/src/main/index.ts:304-306` |
| `SettingsStore` 는 Bootstrap 필드 — 생성자에서 만들어지고 DB가 필요 없다 | `app/src/main/app/bootstrap.ts:149` |
| `start()` 첫 `await` 는 `:520` — 그 앞 동기 구간에서 인증 핸들러를 조기 등록한다 | `bootstrap.ts:411-483` |
| `settings:get`·`set` 은 `register(ctx)`(`:808`)가 `registerSettingsHandlers` 로 등록 | `app/src/main/app/handlers/settings.ts:8-26` |
| `TweakProvider.load` 는 `settingsApi.get().then(...)` — catch 없음 | `app/src/renderer/src/shared/theme/TweakProvider.tsx:77` |
| 부팅 게이트 `bootApi.whenReady` 는 `start()` promise 를 돌려준다 | `index.ts:305` · `renderer/src/shared/api/ipc.ts:130` |
| 오류 보고 제목 `loadFailed` 가 이미 있다 | `app/src/shared/app-error.ts:4` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 부팅 게이트 밖에서 마운트 즉시 invoke 하는 renderer 호출 | `App.tsx` Provider 6종의 `useEffect` 전수 열람 | 4 | `settings:get`×2(`TweakProvider`·`chatStore` 언어 캐시) · `update:state` · `session:cwd` — 앞 둘은 조기 등록으로 해결, 뒤 둘은 D-005 |
| `settingsGet` 등록 지점 | `rg -n "CHANNELS.settingsGet" app/src/main` | 1 | `handlers/settings.ts:9` 하나 |
| `registerSettingsHandlers` 호출부 | `rg -n "registerSettingsHandlers\(" app/src` | 2 | `bootstrap.ts` · `misc-split.test.ts` |

### 수치 / 전칭 표현 검산

- "구조적으로 차단"(IPC_CONTRACT 69행) 반례: 위 전수 4건 → 문서 정정.
- 기존 테스트 케이스 존재: `TweakProvider.store.test.ts` 3케이스 · `TweakProvider.lifecycle.test.ts` 2케이스 · `misc-split.test.ts` 1케이스 열람 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`
- 현재 책임 소유자: `register(ctx)` 가 설정 두 채널을 부팅 끝에 함께 등록.
- 현재 entry → flow: 창 생성 → renderer `TweakProvider` → `settings:get` invoke → 미등록 → reject → `.then` 미실행.
- 현재 오류 경로: 처리 없음 — `renderer.unhandled.rejection` 로그만 남고 기본값 유지.

```text
index.ts: start() ─┬─ (동기) 인증 핸들러 등록 ─ await DB… ─ … ─ register(ctx): settings:get/set
                   └─ createWindow ─ renderer: TweakProvider.load → settings:get ✗ (No handler)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`
- 변경 후 책임 소유자: 읽기는 `start()` 동기 구간, 쓰기는 `register(ctx)`.
- 변경 후 entry → flow: `start()` 첫 줄 근처 `registerSettingsReadHandler(this.settings)` → 창 → `settings:get` 성공.
- 변경 후 오류 경로: 실패 시 `bootApi.whenReady()` 후 1회 재시도 → 실패면 `reportError(loadFailed)`.

```text
index.ts: start() ─┬─ (동기) registerSettingsReadHandler · 인증 핸들러 ─ await … ─ register(ctx): settings:set
                   └─ createWindow ─ renderer: TweakProvider.load → settings:get ✓
                                                              ↘ ✗ → whenReady → get → ✓ / reportError
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 설정 두 채널을 `registerSettingsHandlers` 가 함께 | 읽기 `registerSettingsReadHandler` · 쓰기 `registerSettingsHandlers` | 읽기만 DB 무관 | AR-01 / VP-03 · `handlers/settings.ts` |
| data/control flow | 읽기 등록이 첫 `await` 뒤 | 첫 `await` 앞 | 창보다 먼저 | SD-01 / VP-02 · `bootstrap.ts` |
| error/lifecycle | 읽기 실패 무처리 | 부팅 대기 후 1회 재시도 → 보고 | 조용한 기본값 방지 | MD-01 / VP-04 · `TweakProvider.tsx` |
| test seam | 없음 | 소스 스캔 · 핸들러 · store 테스트 | 순서·전수·실패 경로 관측 | ST-01·IT-01·UT-01 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/handlers/settings.ts` | 설정 IPC 등록 — 읽기/쓰기 분리 | `SettingsStore` → `Settings` | `bootstrap.ts` |
| `app/bootstrap.ts` `start()` | 조기 등록 순서 | — | `index.ts` |
| `renderer/shared/theme/TweakProvider.tsx` | Tweaks 읽기·복구·보고 | `settingsApi` · `bootApi` → store | `App.tsx` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| SD-01 / VP-02 | EP-01 `settings:get` 은 `start()` 첫 `await` 전에 등록 | `bootstrap.ts` `start()` | Bootstrap | 앱 시작 동기 구간 | 창이 뜬 뒤 첫 읽기가 거절된다 |
| AR-01 / VP-03 | EP-02 설정 채널 등록은 모듈 합산 1회씩 — ① 읽기 모듈이 `settingsGet` 등록 ② 쓰기 모듈이 `settingsGet` 을 등록하지 않음 | `handlers/settings.ts` | 두 등록 함수 | 등록 시 | 중복이면 Electron 이 두 번째 `handle` 에서 throw — 부팅 실패 |
| MD-01 / VP-04 | EP-03 읽기 실패 복구 — ① 재시도 전 `whenReady` 대기 ② 재시도 1회 ③ 최종 실패 `reportError(loadFailed)` | `TweakProvider.tsx` `load` | renderer | 마운트 시 | 조용한 기본값 / 무한 재시도 |

- 선택적 필드: 해당 없음.
- 외부 SDK 경계: 해당 없음 — Electron `ipcMain.handle` 은 채널당 1회만 허용한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/app/handlers/settings.ts` | 설정 IPC | `registerSettingsReadHandler(settings: Pick<SettingsStore,'getAll'>)` 신설 → `settingsGet`. `registerSettingsHandlers` 는 `settingsSet` 만 | 기존 `misc-split.test.ts` (electron mock) |
| `app/src/main/app/bootstrap.ts` | 부팅 순서 | `start()` 첫 동기 구간(인증 스택 앞)에서 `registerSettingsReadHandler(this.settings)` + 이유 주석 | 신규 소스 스캔 테스트 |
| `app/src/main/app/bootstrap.settings-early.test.ts` | 순서 잠금 | `stripCommentsAndStrings(bootstrap.ts)` → `start()` 본문에서 호출 위치 < 첫 `await` | 순수 |
| `app/src/main/app/handlers/misc-split.test.ts` | 등록 전수 | 모듈 집합에 읽기 등록 추가 · 반환값 단언 | 기존 |
| `app/src/renderer/src/shared/theme/TweakProvider.tsx` | 읽기 복구 | `load` 에 실패 분기: `bootApi.whenReady()` → 재시도 → 실패면 `reportError` · 취소 가드 유지 | store 테스트 |
| `app/src/renderer/src/shared/theme/TweakProvider.store.test.ts` | 실패 경로 | AC3~AC5 케이스 · `bootApi` mock | 순수 |
| `app/src/renderer/src/shared/theme/TweakProvider.lifecycle.test.ts` | mock 정합 | `bootApi` mock 추가(정상 경로 불변) | 기존 |
| `docs/IPC_CONTRACT.md` | 계약 정정 | 69행 "구조적 차단" 범위 정정 · 122행 조기 등록 명시 | 문서 |

### 테스트 가능성

- electron 의존부와 분리할 순수 파일: 순서 판정은 소스 스캔(파일 읽기만) — `bootstrap.ts` 를 import 하지 않는다.
- 기존 메커니즘 재사용: `infra/source-scan` 의 `stripCommentsAndStrings` 를 쓴다(`no-stray-auth-subscribe.test.ts` 선례).
- 순서 관측: 소스 위치 비교.

## 12. End-to-end 영향

### producer → consumer

```text
SettingsStore.getAll → settings:get(조기) → TweakProvider.load → store.t → dataset.theme/lang/font
                                          → chatStore 언어 캐시(기존 호출, 코드 변경 없음)
```

- producer 기준: 디스크 electron-store 값.
- consumer 파생 규칙: `Tweaks` 투영 8필드(기존).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 부트 스텝 `landing-target`(`getLastSessionId`·`applyLandingAgentKind`) | 게이트 뒤라 영향 없음 — 이미 등록된 핸들러를 쓴다 | AC2 |
| `chatStore` 언어 캐시 | 이제 첫 읽기가 성공한다 | AC1 |
| `bypassStore` 등 기존 `settingsApi.get` 소비처 | 등록 시점만 앞당겨짐 — 반환값 동일 | AC2 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 등록은 `start()` 1회 — `start()` 는 `index.ts` 에서 한 번만 불린다.
- 취소/중단: `load()` cleanup 이 재시도 체인 전체를 무시하게 한다.
- 종료/quit/crash: 해당 없음.
- retry/timeout: 재시도 1회. `whenReady` reject(부팅 실패)면 재시도 없이 보고 — 부팅 실패 화면이 따로 뜬다.
- 다중 저장소 쓰기: 해당 없음(읽기만).

## 14. 성능 / 상한 / 최적화

- 요청 수: 성공 시 1회(현행 동일), 실패 시 최대 2회.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 배포 포트 불변.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0109 창 먼저 부팅 | `index.ts:299-306` | §9 TO-BE | 유지 |
| 0181/0188 인증 핸들러 조기 등록 | `bootstrap.ts:411` · `app/AGENTS.md` | §11 같은 동기 구간에 등록 | 유지(선례 확장) |
| `IPC_CONTRACT.md:69` 게이트 "구조적 차단" | 문서 | §11 문서 정정 | 변경 — 코드와 어긋난 문서 정정 |
| 0179 설정 핸들러 분리 | `handlers/settings.ts:1` | §11 읽기/쓰기 분리 | 유지(한 파일 안에서 두 함수) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 조기 등록 후 `register` 가 같은 채널을 또 등록하면 부팅이 throw | AC2 중복 0 전수 + VP-03 변이 |
| 소스 스캔이 포맷 변경에 민감 | 식별자 호출과 `await` 토큰만 본다 — VP-02 변이 2종으로 민감도 확인 |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/app/handlers/settings.ts` · `app/src/main/app/bootstrap.ts` · `app/src/main/app/bootstrap.settings-early.test.ts`(신규) · `app/src/main/app/handlers/misc-split.test.ts`
- `app/src/renderer/src/shared/theme/TweakProvider.tsx` · `TweakProvider.store.test.ts` · `TweakProvider.lifecycle.test.ts`
- `docs/IPC_CONTRACT.md` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크: 이 변경은 DB 를 쓰지 않는다 — `npm test` 대신 `vitest run <suite>`.
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate 의 vitest 명령.
- 사람 실기: AC6.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001·D-002 사용자, D-003~D-005 설계자.
- [x] Part I만 읽어도 완료 상태가 이해된다.
- [x] 조건절·이유절을 재해석하지 않았다 — "포함할 것"을 범위로, "Plan 및 impl"을 D-002 로.
- [x] 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 표 4행 ↔ AC1·AC3·AC4·AC5.
- [x] AS-IS와 TO-BE가 같은 축으로 있다.
- [x] Delta 각 행이 파일·AC로 추적된다.
- [x] 사라진 책임 없음 — 읽기 등록은 이동(`register` → `start()` 동기 구간).
- [x] 수치·전칭·앵커를 실측했다 — §8 전수 표.
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 가진다.
- [x] Baseline V.
- [x] NEW node 전부 같은 레벨 REQUIRED pair.
- [x] INHERITED node 없음.
- [x] 구조적 proxy(VP-02)·전수(VP-03)에만 적대 증거를 선택했다.
- [x] 운영 gate 열거.
- [x] 사람 실기로 미룬 순수 로직 없음 — 순서는 AC1 이 잠근다.
- [x] semantic 목표(첫 읽기 성공)를 AC1 순서 + AC2 반환값 + AC6 실기로 닫는다.
- [x] 신규 계약의 SSOT·강제 지점·seam.
- [x] 부팅 변경의 기존 소비처 전수(§12 표).
- [x] producer/consumer 확인.
- [x] 상한 계산(§14).
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: §9 TO-BE 그대로 — 읽기 등록은 `start()` **첫 문장**(`bootstrap.ts:396`)에 뒀다. §11 은 "인증 스택 앞"이라 적었고 첫 문장은 그 조건을 만족한다.
- 이견 / 현실성 문제: 없음. `legacy-migration` 이 critical 로 throw 할 수 있어 그보다 앞이 더 안전하다(§13 부팅 실패 시에도 테마 읽기 가능).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-02 | EP-01 첫 `await` 전 등록 | 1 | 1/1 | `rg -n "registerSettingsReadHandler\(" app/src/main --glob '!*.test.ts'` → 호출 1건 `bootstrap.ts:396` · `bootstrap.settings-early.test.ts` 2케이스 green | — |
| VP-03 | EP-02 등록 1회씩 (① 읽기 모듈 `settingsGet` ② 쓰기 모듈 비등록) | 2 | 2/2 | `rg -n "CHANNELS.settingsGet" app/src/main --glob '!*.test.ts'` → 1건 `handlers/settings.ts:16` · `misc-split.test.ts` 2케이스 green | — |
| VP-04·VP-05 | EP-03 (① `whenReady` 대기 ② 재시도 1회 ③ 최종 보고) | 3 | 3/3 | `TweakProvider.tsx:87`·`:89`·`:109` · store 테스트 4케이스 green | — |

- §10에 없는데 같은 불변식이 필요했던 지점: `chatStore.ts:1785` 언어 캐시 — 같은 채널이라 EP-01 로 함께 닫힘(코드 변경 없음). `update:state`·`session:cwd` 는 D-005 비범위.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | 사람 실기(AC6) 대기 | not selected |
| VP-02 | REQUIRED | SELF_PASS | 2케이스 green | ① 삭제 → 2 red · ② `register(ctx)` 앞으로 이동 → 1 red |
| VP-03 | REQUIRED | SELF_PASS | 2케이스 green | 쓰기 모듈에 `settingsGet` 재등록 → 2 red |
| VP-04 | REQUIRED | SELF_PASS | store 4케이스 green | not selected — 직접 행동 oracle |
| VP-05 | REQUIRED | SELF_PASS | VP-04 와 같은 4케이스 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `bootstrap.ts:396` 호출 삭제 | VP-02 선택 증거 ① · 새 소스 스캔 oracle 민감도 | 최초 | `bootstrap.settings-early.test.ts` 2건 | 잠김 |
| `bootstrap.ts` 호출을 `this.register(ctx)` 직전(첫 `await` 뒤)으로 이동 | VP-02 선택 증거 ② | 최초 | "등록 호출은 start() 의 첫 await 보다 앞선다" 1건 | 잠김 |
| `handlers/settings.ts` `registerSettingsHandlers` 에 `settingsGet` 재등록 | VP-03 선택 증거 · 전수 oracle(`misc-split`) 민감도 | 최초 | `misc-split.test.ts` 2건 | 잠김 |

- **분모 검산**: `선택 증거 3 · 인용 변이 0 · 새 oracle 2(소스 스캔·등록 전수 — 위 행과 공유) = 표 행 3`.
- **덮개 회귀**: 해당 없음(최초 라운드).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음 — 기존 `loadFailed` 제목을 `reportError` → 오류 토스트가 표시 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 — `load()` 의 `cancelled` 클로저 그대로 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | "두 번 모두 실패" · "첫 읽기 실패·부팅 성공" · "읽는 중 해제" 3행 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 최종 실패는 토스트. 부팅 실패면 `BootFailureFrame` 이 앞에 있어 토스트가 가려질 수 있다 | 보고만 — 부팅 실패 화면이 원인을 이미 보인다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해제 뒤 응답·재시도 폐기(케이스 "stops the retry chain…") | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `arch/backend/overview.md §3.1` 부트 시퀀스가 0109 이전 순서(부팅 후 창)로 적혀 있었다 | ✅ 선조치 — 동기 구간 조기 등록 3종과 창 병행을 현재 상태로 기술 | `overview.md` 3단계 0 항목 |
| 2 | `app/src/main/AGENTS.md` 컴포지션 루트 행이 조기 등록을 인증 스택만 적었다 | ✅ 선조치 — 설정 읽기 조기 등록 한 줄 추가 | `app/src/main/AGENTS.md` app 행 |
| 3 | `update:state` 조기 호출 실패가 `actionError` 로 남는다(대화상자를 열면 지워짐) · `session:cwd` 조기 호출 실패는 unhandled rejection 로그 | ⚠️ 보고만 — D-005 비범위 | `updateStore.ts:55` · `chatStore.ts:1770` |

### 설계 대비 명시적 차이

- 없음. (등록 위치를 "인증 스택 앞" 중 가장 앞인 첫 문장으로 골랐다 — §11 의 범위 안.)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/handlers/settings.ts` · `app/src/main/app/bootstrap.ts` · `app/src/main/app/bootstrap.settings-early.test.ts`(신규) · `app/src/main/app/handlers/misc-split.test.ts` · `app/src/renderer/src/shared/theme/TweakProvider.tsx` · `TweakProvider.store.test.ts` · `TweakProvider.lifecycle.test.ts` · `docs/IPC_CONTRACT.md` · `docs/arch/backend/overview.md` · `app/src/main/AGENTS.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npm rebuild better-sqlite3` 후 `./node_modules/.bin/vitest run src/renderer/src/shared/theme src/main/app/handlers src/main/app/bootstrap.settings-early.test.ts` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | lint 0 error · 1 warning(`useVirtualizer` incompatible-library — 이번 변경 밖 파일) · typecheck node/web/test exit 0 · vitest **19파일 130케이스 pass**(Node ABI 재빌드 전에는 DB 로드 5파일이 `NODE_MODULE_VERSION 140 vs 127` 로 실패 — 환경) · doc-inventory ok |
| V-pair 자기확인 | `SELF_PASS 4 / SELF_BLOCKED 1`(VP-01 실기) |
| 강제 지점 전수 | 6/6 (EP-01 1 · EP-02 2 · EP-03 3) |
| **AC 자기보고** | AC1 ✅ 소스 스캔 2케이스 · AC2 ✅ 등록 전수 2케이스 · AC3 ✅ "retries once after main boot…" · AC4 ✅ "reports loadFailed…" 2케이스 · AC5 ✅ "stops the retry chain…" · AC6 ⚠️ Windows 실기 대기 |
| **합계 검산** | `✅ 5 · ⚠️ 1 · ❌ 0 = 총 6` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(최초 라운드).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 0109 plan 이 부팅 게이트로 "미등록 핸들러 invoke" 를 막는다고 적었으나 게이트 밖 호출자를 세지 않았다(IPC_CONTRACT 69행 정정).
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI — `npm ci` 뒤 Electron ABI 라 DB 스위트가 실패, `npm rebuild better-sqlite3` 로 해소.
- 현재 라운드·impl 턴: `r1`.

## [구현자 기입] 설계 리뷰 (r1.2 — 필수 gate red 수정)

- 판정: plan 변경 없음. r1 이 renderer 에 catch 2개를 새로 만들었는데 `reportSites.registry.test.ts`(renderer catch 전수 레지스트리)에 행이 없어 "accounts for all baseline catches…" 1케이스가 red 였다.
- 발견 경위: 0245 구현 턴의 전체 vitest. r1 보고의 vitest 는 수정 디렉토리 3곳만 돌렸다(아래 Review Signals).
- 재현: r1 커밋 트리에서 `vitest run src/renderer/src/shared/errors/reportSites.registry.test.ts` → `+ "shared/theme/TweakProvider.tsx:1"`, `:2` 미등록 · 199 중 1 fail.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r1.2

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| (저장소 gate) | renderer 의 모든 catch 는 disposition 과 함께 레지스트리에 있다 | — (§10 밖 저장소 위생 규칙) | 2/2 | r1 이 만든 catch 전수 `git show <r1> -- app/src/renderer ':!*.test.ts' \| grep '^+' \| grep -cE '\bcatch\b'` → 2 (`TweakProvider.tsx:85` 폴백 · `:104` 보고) · 레지스트리 204 pass | — |

- 불변식: **새 catch 는 만든 턴에 레지스트리 행(폴백=EXCLUDE · 보고=TOAST)을 함께 갖는다.** `:85` 는 부팅 뒤 한 번 더 읽는 폴백이라 EXCLUDE, `:104` 는 `settings.tweak.load-failed`·`loadFailed` 보고라 TOAST `T36`.
- 같은 파일 T7 의 `line` 표기를 62 → 63 으로 맞췄다(r1 의 import 추가로 한 줄 밀림 — 판정은 ordinal 기준이라 동작 무관).

## [구현자 기입] 이번 라운드 수정의 잠금 — r1.2

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 레지스트리에서 새 두 행 삭제 | r1 gate red 재현 | r1 = red(1) | "accounts for all baseline catches…" 1건 | 잠김 |
| `:104` 의 `reportError` 제거 | 레지스트리 내장 "detects removal of T36" | 새 행 | 내장 변이 케이스가 `matches=false` 를 단언(204 pass 에 포함) | 잠김 |

- 분모 검산: `선택 증거 0 · 인용 변이 1(gate red) · 새 oracle 1(T36 행) = 표 행 2`.
- 덮개 회귀: 없음 — r1 의 등록 변이 3건은 이번에 건드린 파일 밖이다.

## [구현자 기입] Product/UX 파생 검토 — r1.2

- 해당 없음 — 테스트 레지스트리만 바꿨고 동작·문구 변화가 없다.

## [구현자 기입] 놓친 잠재 문제 + 대응 — r1.2

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 4 | r1 의 "관련 vitest" 가 저장소 전역 위생 스위트를 포함하지 않았다 | ✅ r1.2 는 전체 vitest 로 판정 | 아래 게이트 산출 |

## [구현자 기입] 구현 보고 — r1.2

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/shared/errors/reportSites.registry.test.ts` |
| 실행 명령 | r1 트리 + 이 수정으로 `ELECTRON_OVERRIDE_DIST_PATH=<빈 디렉토리> ./node_modules/.bin/vitest run`(전체) · `npm run lint` · `npm run typecheck` |
| **관측한 게이트 산출** | r1 트리 + 수정: vitest 전체 **600파일 pass · 1 skip · 5716케이스 pass · 실패 0** · lint 0 error · 1 warning(`useVirtualizer` — 변경 밖) · typecheck node/web/test exit 0 · 레지스트리 단독 204 pass |
| V-pair 자기확인 | r1 과 같음 — `SELF_PASS 4 / SELF_BLOCKED 1`(VP-01 실기) |
| **AC 자기보고** | r1 과 같음 — `✅ 5 · ⚠️ 1 · ❌ 0 = 총 6` (분모 변화 없음) |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- 같은 축인가: 새 축 — r1 의 동작 불변식은 그대로이고, 저장소 위생 gate 를 실행 범위에서 뺀 것이 원인이다.
- 막았어야 할 plan 지침: §7-A 운영 gate 가 vitest 를 수정 디렉토리로 한정했고, renderer catch 레지스트리를 설계 입력(저장소 규칙)으로 적지 않았다.
- 반복 환경 한계: electron 바이너리 미설치 — electron 을 import 하는 8파일이 `Electron failed to install correctly` 로 import 단계에서 실패. `ELECTRON_OVERRIDE_DIST_PATH` 로 경로 해석만 우회하면 36케이스 전부 실행된다.
- 현재 라운드·impl 턴: `r1.2`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | bootstrap 안 읽기 등록 2회 변이(M4)를 잡는 테스트 없음 — production 은 1건 | VP-03 / EP-02 형제 자리 | 기록 | NON_BLOCKING | open |
| D2 | 첫 `await` 앞 `setTimeout` 지연 등록(M5)이 소스 스캔 통과 | VP-02 구조적 proxy 한계 | 기록 | NON_BLOCKING | open |
| D3 | 해제 뒤 실패 분기의 바깥 catch `cancelled` 가드(M9) 미잠금 | VP-04 / AC5 | 다음 수정 때 케이스 추가 후보 | NON_BLOCKING | open |
| D4 | plan 메타 커밋 `553ab87` 이 구현 trailer 를 실음 | 커밋 프로토콜 | 기록 | NON_BLOCKING | open |

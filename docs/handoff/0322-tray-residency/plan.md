# Plan — 0322-tray-residency

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0322-tray-residency` |
| 작성자 | Claude Code |
| 일자 | 2026-11-16 |
| 매핑 | TRD §10 anchor "시스템 트레이" |
| 상태 | READY |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `none` |
| 이번 V revision | `ΔV4` — 메뉴 `종료`의 `app` 바인딩 잠금 채택(§23, verify r1 D1). ΔV1은 §20, ΔV2는 §21, ΔV3은 §22 |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Windows에서 창의 X를 누르면 프로세스가 끝난다(`app/src/main/index.ts:289-293`). 진행 중 턴·예약 작업이 함께 끝난다.
- 완료 후 달라지는 것: X는 창만 숨기고 앱은 트레이 아이콘으로 남는다. 트레이 메뉴 `열기`·`종료`로 창을 되찾거나 앱을 끝낸다.
- 성공을 사용자 관점에서 한 문장으로: X를 눌러도 앱이 살아 있고, 트레이에서 다시 열거나 끝낼 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "'x'닫기 버튼 클릭시, 이제 프로세스 종료를 하지 않는다. 트레이아이콘으로 상주하도록 변경. Tray icon 메뉴에서는 열기, 종료 두 개 메뉴만 제공하라." | 라이브 세션 2026-11-16 |
| 명시 요구 | 헤더 메뉴 `종료` 항목도 X와 같이 "트레이로 숨김" | 라이브 세션 질의 응답 2026-11-16 |
| 명시 요구 | 적용 플랫폼은 "Windows만" | 라이브 세션 질의 응답 2026-11-16 |
| 추론 의도 | 트레이 아이콘 좌클릭은 `열기`와 같다 (추론 — Windows 관례) | D-005 |
| 명시 요구 | "트레이 생성 실패는 프로그램 오류로 봐야한다" | 라이브 세션 2026-11-16 (2턴) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 창 닫기(X)는 프로세스를 끝내지 않고 창을 숨긴다. 앱은 트레이 아이콘으로 상주한다 | "이제 프로세스 종료를 하지 않는다. 트레이아이콘으로 상주하도록 변경" | 사용자 2026-11-16 | ACTIVE | — |
| D-002 | 트레이 메뉴는 `열기`·`종료` 두 항목만 갖는다 | "열기, 종료 두 개 메뉴만 제공하라" | 사용자 2026-11-16 | ACTIVE | — |
| D-003 | 헤더 메뉴 `종료` 항목은 X와 같이 창을 트레이로 숨긴다. IPC 채널을 새로 만들지 않는다 | 질의 응답 "트레이로 숨김" | 사용자 2026-11-16 | ACTIVE | — |
| D-004 | 상주는 Windows(`win32`)에만 적용한다. macOS·Linux는 현재 동작 그대로다 | 질의 응답 "Windows만" | 사용자 2026-11-16 | ACTIVE | — |
| D-005 | 트레이 아이콘 좌클릭은 `열기`와 같은 동작이다 | 설계자 추론 — 메뉴 항목이 아니라 D-002와 충돌하지 않는다 | 설계자 | ACTIVE | — |
| D-006 | 트레이 생성이 실패하면 X는 기존처럼 앱을 끝낸다 | 설계자 추론 — 숨은 창을 되찾을 수단이 없는 상태를 만들지 않는다 | 설계자 | SUPERSEDED | D-008 |
| D-007 | 트레이 메뉴 라벨은 한국어 `열기`·`종료` 고정이다 | 설계자 추론 — 사용자가 라벨을 한국어로 지정했다. `uiLocale='en'` 반영은 §10 선언 경계 | 설계자 | SUPERSEDED | D-009 |
| D-008 | 트레이 생성 실패는 프로그램 오류다. 대체 동작(비상주 폴백)을 설계하지 않고 예외를 삼키지 않는다 | "트레이 생성 실패는 프로그램 오류로 봐야한다" | 사용자 2026-11-16 (2턴) | ACTIVE | D-006 대체 |
| D-009 | 트레이 메뉴 라벨은 UI 언어 설정(`uiLocale`)을 따른다 — `ko`: `열기`·`종료`, `en`: `Open`·`Quit`. 설정을 바꾸면 재시작 없이 바뀐다 | "트레이 아이콘 메뉴 라벨은 i18n 적용 안되는가?" → "적용하라". 영어 라벨은 헤더 메뉴 `Quit`(`en.ts:1346`)에 맞춘 설계자 제안 | 사용자 2026-11-16 (4턴) | ACTIVE | D-007 대체 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-007 (신규 handoff).
- 변경된 결정: D-006 → D-008 (사용자 2턴 — 폴백을 없애고 오류로 취급).
- 변경된 결정(ΔV2): D-007 → D-009 (사용자 4턴 — 라벨에 i18n 적용).
- ΔV4(verify r1 D1 채택): Decision 변경 없음 — D-002 `종료`의 잠금만 좁혔다.
- 추론 결정 D-005와 D-009의 영어 라벨 문구는 사용자가 뒤집으면 ΔV로 정정한다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-001↔AC1·AC4·AC5·AC9 · D-002↔AC2 · D-003↔AC9(단계 4, renderer diff 0) · D-004↔AC6 · D-005↔AC3 · D-008↔AC7 · D-009↔AC2·AC11.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 종료 원인은 `window-all-closed → app.quit()` 한 곳(`index.ts:289-293`) |
| 이미 기존 코드가 충족하는가 | 아니오 | `rg "Tray" app/src/main` → 0건 |
| 더 작은 해법이 있는가 | 없음 | `window-all-closed`만 막으면 창이 파괴돼 되살릴 때 창 컨트롤 IPC가 중복 등록된다(`index.ts:219-234` 주석). 닫기를 숨김으로 바꾸는 쪽이 작다 |
| 선행 자료를 코드와 대조했는가 | 대조함 | TRD §10 "(anchor) 시스템 트레이 — UI/Main 진입점 미지정"(`docs/TRD.md:499`) — 이번에 사용자가 진입점을 정했다 |
| 기존 채택 결정과 충돌하는가 | 1건 조정 | 종료 경로가 `before-quit` 지연(`native-settings-lifecycle.ts:30-44`)과 업데이트 설치(`updater.ts:194`)를 지난다 — 둘 다 숨김에 막히면 안 된다(AC4) |

- 사용자에게 올릴 결정: 없음 (헤더 `종료`·적용 플랫폼은 질의로 닫았다).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[X 클릭 · 헤더 '종료' · Alt+F4]            (Windows)
  → 창과 작업표시줄 버튼이 사라진다. 트레이 아이콘은 남는다. 프로세스·진행 중 턴·예약 작업 유지
  → [트레이 좌클릭 | 메뉴 '열기' | 앱 재실행]  → 같은 창이 같은 상태로 다시 보인다
  → [트레이 메뉴 '종료']                      → 기존 종료 절차(저장 드레인 → 정리) 뒤 프로세스 종료, 아이콘 제거
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 창 표시 중 · 닫기 요청 (Windows, 트레이 있음) | 창 위치·크기 저장(기존) 뒤 닫기를 취소하고 창을 숨긴다 | 창 사라짐 · 트레이 아이콘 유지 |
| 상주 중 · 트레이 좌클릭 또는 `열기` | 최소화 복원 → 표시 → 포커스(`focusMainWindow`) | 창 복귀 |
| 상주 중 · 앱 재실행(설치본) | 기존 `second-instance` 경로가 같은 창을 표시 | 창 복귀, 새 프로세스 없음 |
| 임의 상태 · 트레이 `종료` | `app.quit()` → 기존 종료 절차 | 프로세스 종료 · 아이콘 제거 |
| 임의 상태 · 업데이트 "재시작 후 설치" | 종료가 시작된 뒤의 닫기는 숨기지 않는다 | 설치·재시작 진행 |
| Windows 로그오프·재시작 | 세션 종료 통지 뒤의 닫기는 숨기지 않는다 | OS 종료를 막지 않는다 |
| 트레이 생성 실패 (Windows) | 예외를 삼키지 않는다 — 전역 미처리 오류 경로(`index.ts:76-85`)로 보고된다 | 오류 보고. 이후 동작은 계약하지 않는다(§10 경계 B6) |
| macOS·Linux | 변경 없음 | 현재 동작 그대로 |

### 파생 UX / 엣지케이스

- loading / empty / error: 트레이 생성 실패만 해당 — 프로그램 오류(D-008).
- close / restart: 최소화 상태에서 닫기(작업표시줄 메뉴)도 숨김이고, `열기`가 복원까지 한다(`index.ts:65`).
- concurrency: 종료 드레인 중(첫 `before-quit`이 취소된 구간)의 X는 숨기지 않고 닫는다 — 어차피 종료 중이다.
- 상주 중 renderer: 숨은 창은 최소화된 창과 같은 조건으로 계속 돈다. 진행 중 턴·예약 작업의 프롬프트 전달 경로는 바뀌지 않는다.
- 헤더 메뉴 라벨: `종료`(`ko.ts:1352`) 라벨은 그대로 둔다 — 라벨 변경 요청이 없다(§6).
- keyboard / a11y / theme: 해당 없음 (renderer diff 0).

## 6. 범위 / 비범위

- **범위**: Windows 닫기 → 숨김 · 트레이 아이콘과 2항목 메뉴 · 종료 경로 보존 · 관련 문서 3곳.
- **비범위**: renderer 변경 · IPC 채널 추가 · 설정 토글("닫기 시 종료") · 첫 숨김 안내 풍선 · macOS/Linux.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 헤더 `종료` 라벨이 숨김 동작과 어긋남 | 아니오 | 보고 — 사용자 판단 |
| OS 알림 클릭 시 숨은 창 열기 (`handlers/misc.ts:112-116`은 클릭 처리 없음) | 아니오 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

AC1~AC8의 검증 수단은 신규 `app/src/main/app/tray-residency.test.ts`가 `installTrayResidency`에 가짜 포트를 넘겨 관측한다. 프로덕션 도달 경로는 `index.ts` 조립(EP-03) → 같은 함수다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | Windows에서 종료 중이 아니면 닫기는 취소되고 창이 숨는다 | `platform:'win32'` → 창 `close` 발화 → `preventDefault` 1회 · `hide` 1회 | X/헤더 종료 → `oo:window:close` → `mainWindow.close()` → `close` |
| R-02 | AC2 (ΔV2) | 트레이 메뉴는 두 항목뿐이고 순서대로 창 열기·앱 종료를 한다. 라벨은 `uiLocale`을 따른다 | `uiLocale:'ko'` → 라벨 배열 `toEqual(['열기','종료'])` · `'en'` → `toEqual(['Open','Quit'])`. 두 입력 모두 첫 항목 click → `open` 1·`quit` 0, 둘째 → `quit` 1·`open` 0 · `quit`의 호출 `this` = `deps.app`로 넘긴 객체(`quit.mock.contexts[0]` `toBe`, ΔV4) | 트레이 우클릭 메뉴 |
| R-02 | AC3 | 트레이 아이콘 좌클릭은 창을 연다 | 트레이 `click` 발화 → `open` 1회 · `quit` 0회 | 트레이 좌클릭 |
| R-03 | AC4 | 종료가 시작된 뒤의 닫기는 숨기지 않는다 | `before-quit` 발화 뒤 `close` → `preventDefault` 0 · `hide` 0 | 트레이 종료 · `updater.quitAndInstall` → `app.quit()` |
| R-03 | AC5 | OS 세션 종료 통지 뒤의 닫기는 숨기지 않는다 | 창 `session-end` 발화 뒤 `close` → `preventDefault` 0 · `hide` 0 | Windows 로그오프·재시작 |
| R-04 | AC6 | Windows가 아니면 트레이를 만들지 않고 닫기를 숨기지 않는다 | `platform:'darwin'`·`'linux'` 각각 → `createTray` 0회 · `close` → `preventDefault` 0 | macOS·Linux 부팅 |
| R-05 | AC7 (ΔV1) | 트레이 생성 실패는 삼켜지지 않고 호출자에게 그대로 던져진다 | `win32` · `createTray`가 `E`를 던짐 → `installTrayResidency(...)`가 같은 `E`로 던진다(`toThrow(E)`) | Windows 부팅 → `whenReady` reject → `unhandledRejection` 보고 |
| R-06 | AC8 | 프로세스 종료 때 트레이 아이콘을 없앤다 | `will-quit` 발화 → `tray.destroy` 1회. 트레이가 없으면(AC6 입력) 던지지 않는다 | `will-quit` |
| R-01~06·R-08 | AC9 | 실제 Windows에서 §19 실기 9단계가 관측된다 | 사람 실기 — §19 | 설치본 또는 `npm run dev` |
| R-08 | AC11 (ΔV2) | UI 언어를 바꾸면 트레이 메뉴 라벨이 재시작 없이 바뀐다. 다른 설정 변경은 메뉴를 다시 만들지 않는다 | `ko`로 설치 → 저장소가 `'en'`을 돌려주게 한 뒤 `onPatch` 리스너를 `changedKeys:['uiLocale']`로 호출 → `setContextMenu` 2회째 인자의 라벨 `['Open','Quit']`·click 배선 유지(둘째 항목 `quit`의 `this` = `deps.app`, ΔV4). `changedKeys:['theme']` → `setContextMenu` 횟수 불변 | 설정 화면 언어 변경 → `settings:set` → `SettingsStore.onPatch` |
| R-07 | AC10 | 문서 3곳이 새 동작을 현재형으로 서술한다 | `node scripts/check-doc-inventory.mjs --check` 통과 + §18 문서 행의 문장 존재 | 문서 |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음. `native-settings-lifecycle.test.ts`는 회귀 gate로만 돈다(본 변경이 그 파일을 고치지 않는다).
- 사람 실기 항목: AC9 — 실제 셸 트레이·작업표시줄·OS 세션 종료는 Electron 런타임 밖에서 관측할 수 없다. 판정 로직은 AC1~AC8로 전부 내렸다.
- 총량/0건 기준: AC2의 "두 항목뿐"은 길이 포함 `toEqual`로 본다 — 세 번째 항목 추가가 red여야 한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` pair 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01~R-04·R-06·R-07 | R | §7 | NEW | — |
| R-05 | R | §7 AC7 — 트레이 생성 실패 = 프로그램 오류 | CHANGED (ΔV1) | V1 R-05(비상주 폴백) 대체 |
| R-02 | R | §7 AC2 — 라벨이 `uiLocale`을 따름 | CHANGED (ΔV2) | V1 R-02(한국어 고정) 대체 |
| R-08 | R | §7 AC11 — 언어 변경 즉시 반영 | NEW (ΔV2) | — |
| AT-01 | AT | §7 AC9 · §19 실기 | NEW | — |
| SD-01 | SD | §5 상태 전이 — 상주/종료 중 두 상태의 수명주기 | NEW | — |
| ST-01 | ST | AC1→AC3→AC4→AC8을 한 설치 인스턴스에서 차례로 | NEW | — |
| AR-01 | AR | §9 — `index.ts` 조립이 Electron 객체를 포트로 넘기는 경계 | NEW | — |
| IT-01 | IT | §19 실기 단계 1·2·5 (조립 2자리) | NEW | — |
| MD-01 | MD | §10 EP-01·EP-02·EP-04·EP-05 — `installTrayResidency` 규칙 | NEW · EP-05는 ΔV2 | — |
| UT-01 | UT | AC1~AC8 | NEW | — |
| SD-02 | SD | 종료 드레인(`registerNativeSettingsQuit`) | INHERITED | `native-settings-lifecycle.ts:20-45` |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | `installTrayResidency` → 포트 리스너 → `preventDefault`/`hide`/`open`/`quit`/`destroy` | 신규 `tray-residency.test.ts` — AC1~AC8·AC11, 분기 입력은 §10 | M1~M15 (§10 아래) — 판정이 조건식 하나라 방향 확인 필요 | EP-01(1) · EP-02(4) · EP-04(1) · EP-05(2) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | 설치 → `close`(숨김) → 트레이 `click` → `before-quit` → `close`(통과) → `will-quit` | 같은 파일의 수명주기 1케이스 — 한 인스턴스에서 순서대로 `hide` 1 → `open` 1 → `preventDefault` 총 1 → `destroy` 1 | not selected — 단계별 관측이 직접 oracle | EP-01·EP-04 재사용 (0 추가) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | `whenReady` → `createWindow` → `installTrayResidency({app, createTray:new Tray…})` → `.attach(창)` | 사람 실기 §19 단계 1(attach)·2(install·open)·5(quit) | not selected — 기계 좌표 없음(§10 선언 경계 B1) | EP-03(2) |
| VP-04 | R-01~06 ↔ AT-01 | REQUIRED | X → IPC → `close` → 숨김 → 트레이 → 복귀/종료 | 사람 실기 §19 전 단계 | not selected | 0 — 하위 pair가 자리를 갖는다 |
| VP-05 | SD-02 ↔ 기존 ST | REGRESSION | `before-quit` 2회 발화(드레인 전후) → 최종 종료 | `native-settings-lifecycle.test.ts:'defers actual before-quit events once until accepted saves finish, then permits final quit'` + AC4 입력 "`before-quit` 2회 뒤 `close`" | not selected | 0 — 그 파일 diff 0 |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/` subtree | `app/src/main/**` 수정 + 테스트 추가 | §19 | 이번 변경이 유발한 실패만 blocking |
| 문서 인벤토리 | `docs/**` 3곳 수정 | `node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 종료 원인은 비-darwin `window-all-closed → app.quit()` | `app/src/main/index.ts:289-293` |
| X와 헤더 `종료`는 같은 IPC를 부른다 | `WinControls.tsx:55` · `Header.tsx:153` → `oo:window:close` → `index.ts:230-232` |
| `close` 리스너가 이미 창 위치·크기를 저장한다 | `index.ts:195-198` |
| `focusMainWindow`는 복원·`show()`·포커스를 이미 한다 | `index.ts:62-68` |
| `second-instance`는 설치본에서만 걸리고 `focusMainWindow`를 부른다 | `index.ts:51-59` |
| 창 컨트롤 IPC는 `createWindow` 안에서 1회 등록 — 창을 다시 만들면 중복 등록 | `index.ts:219-234` |
| `before-quit`은 첫 발화를 취소하고 드레인 뒤 `app.quit()`을 다시 부른다 | `native-settings-lifecycle.ts:30-44` |
| 업데이트 설치는 `updater.quitAndInstall(false, true)` | `app/src/main/app/updater.ts:194` |
| `index.ts`는 모듈 부작용 때문에 import하는 테스트가 없다 | `infra/browser-window-devtools.test.ts:3-6` |
| 순수 구조 포트로 Electron 수명주기를 시험한 선례 | `native-settings-lifecycle.ts:20-27` + 동명 테스트 |
| 아이콘 자산은 1254×1254 PNG, 이미 `?asset`으로 import | `index.ts:8` · `file resources/logo.png` |
| 표시명 상수 | `app/src/shared/product.ts` `PRODUCT_DISPLAY_NAME` |
| 외부 API (Electron 39) | `Tray`: `new Tray(image)` · `setToolTip` · `setContextMenu` · `'click'` · `destroy()`. `Menu.buildFromTemplate`. `BrowserWindow` `'session-end'`(Windows). 이 환경은 `node_modules` 미설치(`ls node_modules` → 0)라 타입을 대조하지 못했다 — 구현자가 `node_modules/electron/electron.d.ts`로 확인하고, 다르면 `PLAN_GAP`으로 보고한다 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 프로세스 종료 호출 | `rg "app\.quit\(|app\.exit|app\.relaunch" app/src/main` (테스트 제외) | 3 | `index.ts:53`(락 실패) · `:291`(전 창 닫힘) · `native-settings-lifecycle.ts:42`(드레인 뒤) — 전부 `before-quit`을 지난다 |
| `before-quit` 리스너 | `rg "before-quit" app/src/main` (테스트 제외) | 1 | `native-settings-lifecycle.ts:30` — 종료를 영구 취소하는 리스너 없음 |
| 창 닫기 IPC 소비처 | `rg "windowApi\.close" app/src/renderer` | 2 | `WinControls.tsx:55` · `Header.tsx:153` |
| 창 표시·숨김 호출 | `rg "\.show\(\)|\.hide\(\)|\.focus\(\)" app/src/main` (테스트 제외) | 4 | `index.ts:66·67·191` + 알림 `misc.ts:115`(창 아님) |
| 트레이 사용 | `rg "new Tray\(" app/src/main` | 0 | 신규 |

### 수치 / 전칭 표현 검산

- "종료 경로는 전부 `before-quit`을 지난다": `app.quit()` 3자리 + `quitAndInstall`(electron-updater가 `app.quit()` 호출) — `app.exit` 0건이라 반례 없음.
- 문서 앵커: `docs/TRD.md:499` · `docs/IPC_CONTRACT.md:319` · `docs/arch/backend/overview.md:58` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: SD-01, AR-01
- 책임 소유자: `index.ts` 단독.

```text
X / 헤더 종료 → oo:window:close → mainWindow.close()
  → 'close'(위치 저장) → 창 파괴 → 'window-all-closed' → app.quit()
  → 'before-quit'(드레인) → 'will-quit'(shutdown · closeLog · closeDb)
```

### TO-BE

- 관련 V node: SD-01, AR-01, MD-01
- 책임 소유자: 판정·메뉴·수명주기 = 신규 `app/tray-residency.ts`(Electron import 없음). Electron 객체 생성·주입 = `index.ts`.
- 유지: `close`의 위치 저장 · `window-all-closed` · `before-quit` 드레인 · `will-quit` 정리 · `focusMainWindow` · 창 컨트롤 IPC.

```text
whenReady → createWindow() → installTrayResidency(포트) ─ win32면 createTray() · 메뉴[열기, 종료] · 'click'→open
                          → .attach(창)          (createTray 가 던지면 그대로 전파 — D-008)

X / 헤더 종료 → oo:window:close → mainWindow.close()
  → 'close'(위치 저장) → 'close'(상주 판정)
       ├ 상주 ∧ ¬종료중 → preventDefault + hide          (프로세스 유지)
       └ 그 밖           → 통과 → 기존 종료 경로
트레이 click / '열기' → focusMainWindow
트레이 '종료' → app.quit() → 'before-quit'(종료중 = true · 드레인) → 창 닫힘(통과) → 'will-quit'(tray.destroy · 기존 정리)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 연결 |
|---|---|---|---|---|
| 책임 | `index.ts`가 닫기=종료 | 판정은 `tray-residency.ts`, 조립은 `index.ts` | 시험 가능한 seam | MD-01 / VP-01 |
| control flow | 닫기 → 파괴 → 종료 | 닫기 → 숨김 (종료 중이면 통과) | D-001 | SD-01 / VP-02 · AC1·AC4·AC5 |
| state | 없음 | `resident`(설치 시 확정) · `quitting`(단방향 false→true) | 종료 경로 보존 | EP-01 |
| lifecycle | 정리 = shutdown·log·db | + `tray.destroy()` | 유령 아이콘 방지 | EP-04 / AC8 |
| 조립 | — | `index.ts` 2자리 | 주입 | AR-01 / VP-03 · EP-03 |

### 핵심 책임 분리

| 모듈 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `app/tray-residency.ts` | 상주 여부 확정 · 메뉴 구성 · 닫기 판정 · 트레이 정리 | 구조 포트 → `{ attach(win) }` | `index.ts` |
| `index.ts` | `Tray`·`Menu`·`nativeImage`·`focusMainWindow`·로거를 포트로 묶어 넘김 | — | Electron |

## 10. 계약 / 타입 / 강제 지점

```ts
// app/src/main/app/tray-residency.ts — electron 을 import 하지 않는다
export type TrayLocale = 'ko' | 'en'
export const TRAY_MENU_LABELS: Record<TrayLocale, { open: string; quit: string }> = {
  ko: { open: '열기', quit: '종료' },
  en: { open: 'Open', quit: 'Quit' }
}
export interface TrayMenuItem { label: string; click: () => void }
export interface TrayPort<M> {
  setToolTip(text: string): void
  setContextMenu(menu: M): void
  on(event: 'click', listener: () => void): unknown
  destroy(): void
}
export interface ResidentWindowPort {
  on(event: 'close', listener: (event: { preventDefault(): void }) => void): unknown
  on(event: 'session-end', listener: () => void): unknown
  hide(): void
}
export function installTrayResidency<M>(deps: {
  platform: NodeJS.Platform
  app: { on(event: 'before-quit' | 'will-quit', listener: () => void): unknown; quit(): void }
  createTray(): TrayPort<M>              // 던지면 그대로 전파한다 (D-008)
  buildMenu(items: TrayMenuItem[]): M
  tooltip: string
  open(): void
  settings: {                            // SettingsStore 가 구조적으로 만족한다 (ΔV2)
    getAll(): { uiLocale: TrayLocale }
    onPatch(listener: (next: unknown, changedKeys: readonly string[]) => void): void
  }
}): { attach(win: ResidentWindowPort): void }
```

| V node / pair | 계약 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01 — EP-01 | 닫기 판정: `resident ∧ ¬quitting`이면 `preventDefault`+`hide`, 아니면 아무것도 하지 않는다 | `tray-residency.ts` | `attach`의 `close` 리스너 | 1자리 — `attach` 안 `close` 리스너 | `rg -n "\.on\('close'" app/src/main/app/tray-residency.ts` → 1 | 숨겨야 할 때 종료되거나, 종료해야 할 때 숨어 종료·업데이트·로그오프가 막힌다 |
| MD-01 / VP-01 — EP-02 | 트레이 표면: 메뉴 첫 항목 `→open` · 둘째 항목 `→app.quit`(호출 `this` = `deps.app`, ΔV4) · 아이콘 `click→open` · `setToolTip(tooltip)` | `TRAY_MENU_LABELS` | 설치 시 1회 | 4자리 — 메뉴 항목 2 · `click` 1 · 툴팁 1 | `rg -n "label: labels\.|\.on\('click'|\.setToolTip\(" app/src/main/app/tray-residency.ts` → 4 | 메뉴가 엉뚱한 동작을 하거나 항목 수가 D-002와 다르다 |
| AR-01 / VP-03 — EP-03 | 조립: 설치 1회(`whenReady`, `createWindow` 바로 뒤) · 그 창에 `attach` | `index.ts` | 부팅 | 2자리 — `installTrayResidency(` 호출 · `.attach(` 호출 | `rg -o "installTrayResidency\(|\.attach\(" app/src/main/index.ts` → 2 | 모듈이 green이어도 실제 앱은 X로 종료된다 |
| MD-01 / VP-01 — EP-04 | 정리: `will-quit`에서 만든 트레이만 `destroy` | `tray-residency.ts` | 종료 | 1자리 — `will-quit` 리스너 | `rg -n "\.on\('will-quit'" app/src/main/app/tray-residency.ts` → 1 | 종료 뒤 트레이에 유령 아이콘 |
| MD-01 / VP-01 — EP-05 (ΔV2) | 라벨 언어: 메뉴 라벨 = `TRAY_MENU_LABELS[settings.getAll().uiLocale]`, 패치에 `uiLocale`이 있으면 메뉴를 다시 만들어 `setContextMenu` | `TRAY_MENU_LABELS` | 설치 시 + 설정 변경 시 | 2자리 — 라벨 선택(`getAll()`) · `onPatch` 구독 | `rg -n "\.getAll\(\)|\.onPatch\(" app/src/main/app/tray-residency.ts` → 2 | 영어 UI에 한국어 메뉴가 뜨거나, 언어를 바꿔도 재시작 전까지 옛 라벨이 남는다 |

검색 명령은 구현 뒤 트리 기준이다(현재는 전부 0 — 신규 파일). 구현자는 출력과 목록의 차집합 0을 보고한다.

**EP-01 규칙 분기 ↔ UT 입력 (1:1)**

| # | 분기 | 입력 | 기대 |
|---|---|---|---|
| B1 | 상주 ∧ 종료 중 아님 | `win32` · 트레이 성공 · `close` | `preventDefault` 1 · `hide` 1 (AC1) |
| B2 | 종료 중 (`before-quit`) | B1 + `before-quit` 1회, 그리고 2회(드레인 전후) 각각 뒤 `close` | 둘 다 0 (AC4) |
| B3 | 종료 중 (`session-end`) | B1 + 창 `session-end` 뒤 `close` | 둘 다 0 (AC5) |
| B4 | 비상주 — 플랫폼 | `darwin` · `linux` 각각 · `close` | 둘 다 0 · `createTray` 0 (AC6) |
| B5 | 숨김 반복 | B1에서 `close` 2회 | `preventDefault` 2 · `hide` 2 — 숨김이 `quitting`을 켜지 않는다 |

**EP-05 분기 ↔ UT 입력**: `uiLocale` `ko` / `en` 초기 라벨(AC2) · 패치에 `uiLocale` 포함 → 현재 값으로 메뉴 재구성 / 미포함 → 재구성 없음(AC11) · 비-win32 → `onPatch` 호출 0(AC6 입력에 단언 추가).

**EP-02 생성 분기**: 성공 → 표면 4자리 / `createTray`가 던짐 → 같은 오류 전파(AC7).

**EP-02 `종료` 바인딩 (ΔV4)**: 규칙 = 둘째 항목 click이 `app.quit`을 `deps.app`에 묶인 채 부른다. 입력 = AC2 `ko`·`en` 각각의 설치 메뉴 + AC11 재구성 메뉴 → 기대 = `quit.mock.contexts`의 모든 원소가 `deps.app`로 넘긴 객체와 `toBe`.

**EP-04 분기**: 트레이 있음 → `destroy` 1 / 트레이 없음(B4 입력) → `will-quit`이 던지지 않고 `destroy` 0.

**등록 변이 (VP-01, 심을 자리 = `tray-residency.ts`)**

| ID | 변이 | 종류 | red여야 하는 AC |
|---|---|---|---|
| M1 | 판정에서 `¬quitting` 항 제거 | 제거 | AC4 · AC5 |
| M2 | 메뉴 두 항목의 `click` 맞바꿈 | 맞바꿈 | AC2 |
| M3 | `platform === 'win32'` 조건 제거 | 제거 | AC6 |
| M4 | `preventDefault()` 호출 제거 | 제거 | AC1 |
| M5 (ΔV1) | `createTray()` 호출을 `try/catch`로 감싸 오류를 삼킴 | 다른 값 | AC7 |
| M6 | 트레이 `click` 리스너 제거 | 제거 | AC3 |
| M7 | `session-end` 리스너 제거 | 제거 | AC5 |
| M8 | `destroy()` 호출 제거 | 제거 | AC8 |
| M9 | 메뉴에 세 번째 항목 추가 | 다른 값 | AC2 |
| M10 | `before-quit` 리스너 제거 | 제거 | AC4 |
| M11 | `hide()` 호출 제거 | 제거 | AC1 |
| M12 (ΔV2) | `TRAY_MENU_LABELS`의 `ko`·`en` 값 맞바꿈 | 맞바꿈 | AC2 |
| M13 (ΔV2) | `settings.onPatch` 구독 제거 | 제거 | AC11 |
| M14 (ΔV2) | 라벨 선택을 `'ko'` 고정으로 | 고정값 | AC2(`en`) · AC11 |
| M15 (ΔV2) | `changedKeys.includes('uiLocale')` 조건 제거 | 제거 | AC11(`theme` 입력) |
| M16 (ΔV4) | 둘째 항목을 `click: deps.app.quit`로(분리 참조 — `this` 소실). 심을 자리 = `applyMenu` 안 둘째 항목 1곳(설치·재구성 공용) | 호출 대체 | AC2(`ko`·`en`) · AC11 |

- **선언 경계**
  - B1 — `index.ts` 조립 2자리(EP-03)는 vitest 실행 구간 밖이다. `index.ts`를 import하는 테스트가 없고(§8), 좌표는 사람 실기 §19뿐이다.
  - B2 — `quitting`은 되돌리지 않는다. `before-quit` 뒤 종료가 영구 취소되는 경로는 다루지 않는다: `before-quit` 리스너 1개가 `finally`에서 항상 `app.quit()`을 다시 부른다(`native-settings-lifecycle.ts:40-43`).
  - B3 — 툴팁은 제품명(`PRODUCT_DISPLAY_NAME`)이라 번역하지 않는다. 라벨 문구는 renderer i18n 리소스와 별개 사본이다 — main은 renderer 리소스를 import할 수 없고(레이어), 두 사본의 일치는 판정하지 않는다.
  - B4 — 창이 없는 상태의 `열기`는 아무것도 하지 않는다(`index.ts:64`). Windows에서 창은 종료 때만 파괴되므로 상주 중에는 도달하지 않는다.
  - B5 — macOS·Linux 동작은 판정하지 않는다(D-004). AC6은 "건드리지 않음"만 잠근다.
  - B6 — 트레이 생성 실패 뒤의 앱 상태(창·X 동작·남은 부팅 단계)는 계약하지 않는다(D-008). 예외가 삼켜지지 않는 것만 잠근다(AC7).
  - B7 (ΔV4) — `open`의 호출 `this`는 판정하지 않는다. production `open`은 자유 함수 `focusMainWindow`(`index.ts:62`)라 `this`·인자를 읽지 않는다 — verify r1 X5 `동치`.
  - B8 (ΔV4) — 콜백 값이 아닌 직접 호출식(`deps.settings.getAll()`·`deps.app.on(…)`·`tray.setContextMenu(…)` 등)의 바인딩은 판정하지 않는다. ΔV4가 잠그는 것은 포트 메서드가 메뉴 템플릿에 값으로 넘어가는 `종료` 자리뿐이다.
- 열린 입력 집합을 판정하는 산출물: 해당 없음.
- 같은 규칙의 여러 레이어: 없음 — 판정은 `close` 리스너 한 곳. X·헤더·Alt+F4가 모두 `close` 이벤트로 모인다.
- 외부 SDK 경계: `index.ts`가 `createTray: () => new Tray(…)`, `buildMenu: (items) => Menu.buildFromTemplate(items)`로 넘긴다. `as any`/`as never` 없이 구조적으로 맞아야 한다 — 안 맞으면 `PLAN_GAP`.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/app/tray-residency.ts` (신규) | §10 계약 | `resident = platform==='win32'`. `createTray`의 예외는 잡지 않는다. `before-quit`·`session-end` → `quitting = true`. `will-quit` → `tray?.destroy()` | 순수 — electron import 없음 |
| `app/src/main/app/tray-residency.test.ts` (신규) | AC1~AC8 · VP-02 수명주기 | 가짜 `app`/트레이/창 포트(리스너 맵 + `vi.fn`) | unit 풀 |
| `app/src/main/index.ts` | 조립 | `import { Tray, Menu, nativeImage }` 추가. `createWindow`가 만든 창을 반환하게 하고, `whenReady`에서 `createWindow(...)` **바로 뒤에** 설치 + `attach(창)`. `try/catch`로 감싸지 않는다 | 사람 실기 |
| `docs/TRD.md` §10 | anchor 갱신 | "시스템 트레이" 항목을 구현 완료로 표기 | — |
| `docs/IPC_CONTRACT.md:319` | 채널 의미 | `oo:window:close` 설명에 "Windows에서는 창을 숨기고 트레이에 상주" 추가 | doc-inventory gate |
| `docs/arch/backend/overview.md` | 현재 상태 | `index.ts` 서술에 트레이 상주와 `app/tray-residency.ts` 추가(이력 서술 금지) | doc-inventory gate |

`index.ts` 조립 세부:

- `createTray`: `new Tray(nativeImage.createFromPath(logo).resize({ width: 32, height: 32 }))` — 1254px 원본을 셸에 그대로 넘기지 않는다. 선명도는 §19 단계 8.
- `tooltip`: `PRODUCT_DISPLAY_NAME`. `open`: `focusMainWindow`. `settings`: `router.settings` — 키 필터(`uiLocale`)와 라벨 선택은 모듈이 한다.
- 순서 근거: 창을 먼저 만들어야 트레이 생성이 던져도 창 없는 프로세스가 남지 않는다. `close` 위치 저장 리스너(`:195`)가 먼저 등록되는 순서도 유지된다. `activate`(macOS)로 다시 만든 창은 `attach`하지 않는다 — 비-win32는 숨기지 않는다(경계 B5).
- 트레이 인스턴스 참조는 모듈(`tray-residency.ts` 클로저)이 쥔다 — GC로 아이콘이 사라지지 않게 한다.
- `window-all-closed`(`:289-293`)·`will-quit`(`:306-312`)·창 컨트롤 IPC는 고치지 않는다.

### 테스트 가능성

- 분리할 순수 파일: `tray-residency.ts` — `electron`·`index.ts`를 import하지 않는다(import graph 절단).
- 기존 메커니즘 재사용: `native-settings-lifecycle.ts`의 구조 포트 패턴과 같은 형상이다.
- 순서 관측: VP-02가 한 인스턴스의 호출 로그 배열로 본다.

## 12. End-to-end 영향

```text
X/헤더(renderer, diff 0) → oo:window:close(diff 0) → 'close' → tray-residency 판정 → hide | 통과
```

- producer 기준: `close` 이벤트. consumer 파생 규칙: 없음 — renderer는 숨김을 알 필요가 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `registerNativeSettingsQuit` (`before-quit`) | 리스너가 하나 더 붙는다. 새 리스너는 `preventDefault`를 부르지 않아 드레인 순서와 무관 | VP-05 · AC4(2회 입력) |
| `will-quit` 정리 (`index.ts:306`) | 리스너가 하나 더 붙는다. 서로 독립 | AC8 |
| `SettingsStore.onPatch` (`settings-store.ts:78`, 기존 구독 = `settings-reactions.ts`) | 리스너가 하나 더 붙는다. 저장소는 리스너를 차례로 부르고(`:90`) 새 리스너는 `uiLocale` 외 키에 반응하지 않는다 | AC11 |
| `close` 위치 저장 (`index.ts:195`) | 숨길 때마다도 저장된다(먼저 등록돼 먼저 실행) | AC9 단계 2 |
| 예약 작업·스케줄러 | 상주 중에도 계속 발화 — 의도된 결과 | — |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `whenReady`에서 창 생성 직후 1회. 락을 못 얻은 두 번째 인스턴스는 `:248`에서 먼저 반환하므로 트레이를 만들지 않는다.
- 종료: `before-quit`(플래그) → 창 닫힘 통과 → `window-all-closed` → `will-quit`(`destroy`).
- 오류: 트레이 생성 실패 → 예외 전파 → `whenReady` reject → `unhandledRejection` 핸들러가 `app.unhandled.rejection`으로 보고(D-008). `whenReady`의 남은 단계(시작 완료 로그·백그라운드 업데이트 확인)는 실행되지 않는다 — 프로그램 오류의 결과이고 계약하지 않는다(경계 B6).
- renderer-gone: 창은 파괴되지 않는다. 변경 없음.
- 다중 저장소 쓰기: 해당 없음.

## 14. 성능 / 상한 / 최적화

- 해당 없음 — 트레이 1개, 리스너 5개(`before-quit`·`will-quit`·`close`·`session-end`·`onPatch`). 메뉴 재구성은 언어 변경 때만이다.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| TRD §10 "(anchor) 시스템 트레이 — 진입점 미지정" | `docs/TRD.md:499` | §11 문서 행 | 변경 — 사용자가 진입점을 정했다(D-001·D-002) |
| 종료 전 저장 드레인 | `native-settings-lifecycle.ts` | §12 소비처 표 | 유지 |
| main 레이어 DAG — `app`은 컴포지션 루트 | `app/src/main/AGENTS.md` | §11 신규 파일 위치 `app/` | 유지 |
| 창 보안 옵션·DevTools | `browser-window-devtools.test.ts` | 창 생성자 인자 diff 0 | 유지 |
| IPC 변경 절차 | `IPC_CONTRACT.md §6` | 채널 추가 0 · §2 설명만 갱신 | 유지 |
| "croner — 앱 실행 중만 발화" | `app/AGENTS.md` 스택 표 | §12 | 유지 — 상주 중도 "실행 중"이다 |
| 신규 의존성 승인 | `app/AGENTS.md` | 추가 0 (`Tray`·`Menu`는 electron 내장) | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 숨김이 Windows 로그오프·재시작을 막는다 | `session-end` → `quitting`(AC5). 실제 OS 동작은 §19 단계 7 |
| 숨김이 업데이트 설치를 막는다 | `before-quit` → `quitting`(AC4). §19 단계 6 |
| 사용자가 앱이 꺼졌다고 오해 | 안내 풍선은 비범위(§6) — 요청 없음 |
| Electron 타입이 §10 포트와 다르다 | 구현자가 타입 대조 후 `PLAN_GAP` 보고(§8) |
| 트레이 생성 실패 시 남은 부팅 단계가 건너뛰어진다 | 수용 — D-008. 숨기지 않고 오류로 드러낸다 |
| dev 재시작 시 유령 아이콘 | `will-quit` `destroy`(AC8). 강제 종료 시 잔상은 Windows 셸 특성 |

- 되돌리기 어려운 결정: 없음 — 채널·스키마·저장 형식 변경 0.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/app/tray-residency.ts` · `tray-residency.test.ts` (신규)
- `app/src/main/index.ts`
- `docs/TRD.md` · `docs/IPC_CONTRACT.md` · `docs/arch/backend/overview.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `§로컬 확인`.
- 환경 제약: 설계 턴 환경은 `node_modules` 미설치 — 아래 명령은 구현자가 실행한다.
- 가드: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`
- 정적: `npm run lint` · `npm run typecheck`
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`
- 사람 실기 (AC9, Windows — 단계 3·6은 설치본):
  1. X 클릭 → 창과 작업표시줄 버튼이 사라지고 작업 관리자에 프로세스가 남는다.
  2. 트레이 아이콘 좌클릭 → 같은 창이 같은 위치·크기·대화 상태로 돌아온다. 메뉴 `열기`도 같다.
  3. 상주 중 앱을 다시 실행 → 숨은 창이 돌아오고 프로세스가 늘지 않는다.
  4. 헤더 메뉴 `종료` → 단계 1과 같은 결과.
  5. 트레이 우클릭 → 항목이 `열기`·`종료` 둘뿐이다. `종료` → 프로세스가 끝나고 아이콘이 사라진다.
  6. 업데이트 "재시작 후 설치" → 설치되고 새 버전이 뜬다.
  7. 상주 중 Windows 로그오프 → "앱이 종료를 방해" 화면 없이 진행된다.
  8. 트레이 아이콘이 100%·150% 배율에서 식별된다.
  9. 설정에서 UI 언어를 English로 바꾼다 → 재시작 없이 트레이 메뉴가 `Open`·`Quit`이 된다. 한국어로 되돌리면 `열기`·`종료`.

## READY self-review

- [x] Decision Ledger가 결정을 보존한다 — D-001~D-009, D-006·D-007 SUPERSEDED, 추론 1건 표시.
- [x] Part I만으로 완료 상태가 읽힌다 — §5 상태 전이 8행.
- [x] 조건절을 재해석하지 않았다 — "두 개 메뉴만"은 AC2 길이 단언 + M9.
- [x] 사용자 결정과 조사 사실을 갈랐다 — 질의 2건(D-003·D-004), 나머지는 §8.
- [x] AS-IS·TO-BE·Delta가 같은 축이다 — §9.
- [x] 수치·전칭을 실측했다 — §8 전수 조사 5행.
- [x] 저장소 규칙·후보 표 확인 — 후보 표에 `index.ts`·창 수명과 겹치는 행 0(`awk '/새 handoff 후보/,0' INDEX.md | rg -i "index\.ts|window|tray|quit"` → 무관 1행).
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 갖는다 — §7.
- [x] Baseline V, NEW node 전부 같은 레벨 REQUIRED pair — VP-01~04. 영향받은 INHERITED는 REGRESSION(VP-05).
- [x] pair마다 경로·§10 자리·검색 명령·좌표 — EP-01~05 (자리 10).
- [x] 규칙 칸 분기 ↔ UT 입력 — EP-01 B1~B5, EP-02 생성 2분기, EP-04 2분기, EP-05 4분기.
- [x] 선언 경계 B1~B6, 열린 입력 집합 산출물 아님.
- [x] 운영 gate 3행.
- [x] 사람 실기로 미룬 순수 로직 없음 — 판정·메뉴·정리는 AC1~AC8.
- [x] structural proxy만으로 검증하는 AC 없음 — AC10만 문서 존재이고 대상이 문서다.
- [x] "쓰인다" 불변식의 장치가 제거에 red — M1~M15, 형제 맞바꿈 M2·M12.
- [x] 배타 상태: `resident`는 플랫폼으로 확정, `quitting`은 단방향.
- [x] 부팅 등록 변경의 기존 소비처 — §12 4행.
- [x] 게이트 명령이 `app/AGENTS.md`와 일치.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙.

## 20. ΔV1 — 트레이 생성 실패를 프로그램 오류로 (2026-11-16, 구현 전)

- 출처: 사용자 2턴 "트레이 생성 실패는 프로그램 오류로 봐야한다". 실패가 아니라 요구 변경이라 라운드는 1 그대로다.
- 대체: D-006(비상주 폴백) → D-008. V1의 AC7("던지지 않고 `failed` 보고·닫기 통과")·EP-01 분기 "비상주 — 트레이 실패"·포트 `failed`·M5("catch 제거")는 폐기했고, 위 본문은 정정된 문장이다.

| Node / 행 | provenance | V1 | ΔV1 |
|---|---|---|---|
| R-05 · AC7 | CHANGED | 실패 시 비상주로 계속 | 같은 오류를 던진다 |
| MD-01 EP-01 | CHANGED | 분기 6 (B5 = 트레이 실패) | 분기 5 — `resident`가 플랫폼만으로 정해진다 |
| MD-01 EP-02 | CHANGED | — | 생성 분기 2(성공 / 전파) 추가 |
| AR-01 EP-03 | CHANGED | 설치가 `createWindow` 앞 | `createWindow` 바로 뒤 — 실패해도 창이 있다 |
| M5 | CHANGED | `catch` 제거 → red | 오류를 삼키는 `try/catch` 추가 → red |
| 선언 경계 | NEW | — | B6 |

- pair: VP-01(AC7·M5)·VP-03(EP-03 순서)만 영향. VP-02·VP-04·VP-05는 문장 변경 없음.
- `ACTIVE 결정 ↔ AC` 대조(ΔV1 뒤): 충돌 0 — D-008("예외를 삼키지 않는다") ↔ AC7("같은 `E`로 던진다").

## 21. ΔV2 — 트레이 메뉴 라벨에 i18n 적용 (2026-11-16, 구현 전)

- 출처: 사용자 3·4턴 "트레이 아이콘 메뉴 라벨은 i18n 적용 안되는가?" → "적용하라". 요구 변경이라 라운드는 1 그대로다.
- 대체: D-007(한국어 고정) → D-009. V1의 AC2 라벨 단언(`['열기','종료']` 단일 입력)·선언 경계 B3("`uiLocale`을 따르지 않는다")·§6 미룬 항목 "라벨의 `uiLocale` 반영"은 폐기했고, 위 본문은 정정된 문장이다.
- 조사: `uiLocale`은 `z.enum(['ko','en']).default('ko')`(`app/src/shared/protocol.ts:829`). main의 `uiLocale` 소비처는 0(`rg uiLocale app/src/main` → 주석 1건). 변경 통지는 `SettingsStore.onPatch(listener(next, changedKeys))`(`settings-store.ts:78-90`), 같은 포트 형상의 선례는 `settings-reactions.ts:15-17`.

| Node / 행 | provenance | 이전 | ΔV2 |
|---|---|---|---|
| R-02 · AC2 | CHANGED | 라벨 한국어 고정 | `ko`·`en` 두 입력 |
| R-08 · AC11 | NEW | — | 언어 변경 즉시 반영 · 다른 키는 무반응 |
| MD-01 EP-05 | NEW | — | 2자리 (라벨 선택 · 구독) |
| §10 포트 | CHANGED | `settings` 없음 | `settings: { getAll, onPatch }` |
| M12~M15 | NEW | — | 등록 변이 4 |
| 선언 경계 B3 | CHANGED | 라벨 미번역 | 툴팁 미번역 · renderer 리소스와 별개 사본 |
| §19 실기 | CHANGED | 8단계 | 9단계 |

- pair: VP-01(AC2·AC11·EP-05·M12~M15)·VP-04(실기 단계 9)만 영향. EP-03 자리 수는 2 그대로다 — `settings`는 설치 호출의 인자다.
- `ACTIVE 결정 ↔ AC` 대조(ΔV2 뒤): 충돌 0 — D-002("두 개 메뉴만") ↔ AC2(두 언어 모두 길이 2) · D-009 ↔ AC2·AC11.

## 22. ΔV3 — §10 자리 검색 명령 정정 (2026-11-16, 구현 턴 중 PLAN_GAP)

- 출처: 구현 r1 중 발견한 plan 내부 불일치(검색 출력 ↔ 자리 목록). 같은 파일에 §10 포트 타입 선언이 있어 EP-01·02·04·05의 검색이 타입 선언 줄까지 세었다 — 옛 명령 출력은 2·7·2·4로 목록 1·4·1·2와 달랐다.
- 정정: 술어를 "리스너 등록·호출 자리"로 좁혔다(`.on('close'` · `label: labels.` · `.on('click'` · `.setToolTip(` · `.on('will-quit'` · `.getAll()` · `.onPatch(`). 타입 선언은 앞에 `.`이 없어 걸리지 않는다.
- 불변: 자리 목록(10자리)·규칙 칸·AC·등록 변이·pair는 그대로다. 새 의무 0.

## 23. ΔV4 — 메뉴 `종료`의 `app` 바인딩 잠금 (2026-11-16, verify r1 RETURN_TO_PLAN)

- 판정: verify r1 D1(확장 후보, 창 안)을 **채택**한다. 출처 = `verify.md` §4 X1 · §13 D1 — `click: deps.app.quit`(분리 참조)로 바꿔도 16케이스 green이었다.
- 채택 이유: Electron `app.quit`은 네이티브 `App` 인스턴스 메서드라 분리 호출하면 바인딩이 깨질 수 있는 형태다. 테스트 가짜 `quit`이 `vi.fn`이라 `this`를 보지 않았다. 의무가 단언 1줄·변이 1개라 창 안에서 닫힌다.
- 조사: 자리 검색 `rg -n "click: \(\) => deps\.|\.on\('click'" app/src/main/app/tray-residency.ts` → 3(`:76` 열기 · `:77` 종료 · `:83` 아이콘). 술어를 "포트를 부르는 click 콜백"(`click: () => deps.`)으로 둔 것은 `:28` 타입 선언 `click: () => void`를 빼기 위해서다 — 구현 r2 중 정정(옛 명령 `click:` 출력 4). 포트 메서드를 값으로 넘기는 자리 중 `this`가 의미 있는 곳은 `:77` 하나 — `:76`·`:83`의 `open`은 B7. `mock.contexts` 선례: `src/main/features/plugins/mail/store/index.test.ts:386`(vitest `^4.1.7`).

| Node / 행 | provenance | 이전 | ΔV4 |
|---|---|---|---|
| R-02 · AC2 | CHANGED | 둘째 항목 → `quit` 1회 | + `quit`의 `this` = `deps.app` (`ko`·`en` 둘 다) |
| R-08 · AC11 | CHANGED | 재구성 메뉴 click 배선 유지 | + 재구성 메뉴의 `quit` `this` = `deps.app` |
| MD-01 EP-02 | CHANGED | 둘째 항목 `→app.quit` | 규칙 칸에 바인딩 추가 · 입력 칸 3(AC2×2·AC11). 자리 수 4 그대로 |
| M16 | NEW | — | `click: deps.app.quit` → AC2·AC11 red |
| 선언 경계 B7·B8 | NEW | — | `open` 바인딩 · 직접 호출식 바인딩은 판정 밖 |

- 구현 의무(새 의무 1): `tray-residency.test.ts` AC2(`it.each` 두 입력)·AC11 케이스에 `expect(h.app.quit.mock.contexts).toEqual([h.app])`류 단언을 넣는다 — `h.app`은 `installTrayResidency`에 `deps.app`으로 넘긴 그 객체여야 한다(현재 `setup`이 `app`을 그대로 넘김 — 사본이면 단언이 무의미). production 코드(`:77` 화살표)는 이미 맞아 바꾸지 않는다.
- 자기 잠금: M16을 `:77`에 심어 AC2 두 입력·AC11이 red인지 확인하고, 직전 verify `잡음` 행 중 이번 diff가 닿는 M2a·M9·M12·M14·S3·S5·S6·S9(같은 케이스 단언)를 다시 돌린다.
- pair: VP-01만 영향(AC2·AC11·EP-02·M16). VP-02~VP-05 문장 변경 없음. EP-01~05 자리 목록·검색 명령 불변.
- `ACTIVE 결정 ↔ AC` 대조(ΔV4 뒤): 충돌 0 — D-002("열기, 종료 두 개 메뉴") ↔ AC2(길이 2 + `종료` = 실제 `app` 종료) · D-009 ↔ AC11(재구성 뒤에도 같은 바인딩).

---

> **[구현자 기입]** 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 구현 주체는 Claude다 — 사용자가 이 세션에서 구현 턴을 직접 지시했다(`docs/handoff/AGENTS.md §역할 분담`).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: Part I 전부와 §9~§13. Electron 39 타입이 §10 포트와 구조적으로 맞는다 — `npm run typecheck` 0 error, `as any`/`as never` 0.
- 이견 / 현실성 문제: §10 자리 검색 명령 4개가 같은 파일의 타입 선언까지 세었다 → `PLAN_GAP`으로 멈추고 ΔV3(§22)로 정정한 뒤 재개했다(별도 설계 커밋).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

좌표의 파일은 전부 `app/src/main/app/tray-residency.test.ts`다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | EP-01 닫기 판정 | `close` 리스너 (1) | 1/1 | `rg -c "\.on\('close'"` → 1 · `'AC1 — Windows 에서 종료 중이 아니면…'` · `'B5 — 숨김은…'` · `'AC4 — before-quit %i회…'`(1·2) · `'AC5 — OS 세션 종료…'` · `'AC6 — %s 에서는…'`(darwin·linux) | 이벤트의 `preventDefault`·창 `hide` — 호출 횟수 0/1/2로 분기 구별 | — |
| VP-01 | EP-02 트레이 표면 | 메뉴 항목 2 · `click` 1 · 툴팁 1 (4) | 4/4 | `rg -c "label: labels\.\|\.on\('click'\|\.setToolTip\("` → 4 · 항목 2 → `'AC2 — %s: 메뉴는 두 항목뿐…'` · click → `'AC3 — 트레이 아이콘 좌클릭…'` · 툴팁 → `'툴팁은 받은 문자열 그대로다'` | 항목: 라벨 배열 + `open`/`quit` 서로 다른 mock · 툴팁: `'Orcinus orca'` 정확 일치 | — |
| VP-01 | EP-02 생성 분기 | 성공 / 전파 | 2/2 | 성공 = 위 행 · 전파 → `'AC7 — 트레이 생성 실패는 삼키지 않고…'` | 던진 `Error` 인스턴스 동일성(`toThrow(error)`) | — |
| VP-01 | EP-04 정리 | `will-quit` 리스너 (1) | 1/1 | `rg -c "\.on\('will-quit'"` → 1 · `'AC8 — 프로세스 종료 때…'` · 트레이 없음 분기 → `'AC6 — %s 에서는…'` | `tray.destroy` 0 → 1 · 비-win32는 0 유지 | — |
| VP-01 | EP-05 라벨 언어 | 라벨 선택 · `onPatch` 구독 (2) | 2/2 | `rg -c "\.getAll\(\)\|\.onPatch\("` → 2 · `'AC2 — %s…'`(ko·en) · `'AC11 — UI 언어가 바뀌면…'` · 비-win32 구독 0 → `'AC6 — %s 에서는…'` | `uiLocale` `ko`≠`en` 라벨 · `changedKeys` `['theme']` vs `['theme','uiLocale']` → `setContextMenu` 1 vs 2 | — |
| VP-03 | EP-03 조립 | `installTrayResidency(` · `.attach(` (2) | 0/2 | `rg -o "installTrayResidency\(\|\.attach\(" app/src/main/index.ts \| wc -l` → 2 (존재만) | 기계 좌표 없음 — §10 선언 경계 B1 | 2자리 — 사람 실기 §19 단계 1·2·5 |

- 자리 검색 출력과 목록의 차집합: EP-01·02·04·05·03 = 1·4·1·2·2, 목록과 같다(차집합 0).
- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 (verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 위 표 (16케이스 passed) | required — M1~M15 전부 red |
| VP-02 | REQUIRED | SELF_PASS | `'숨김 → 열기 → 종료 시작 → 닫힘 통과 → 정리 순서로 한 인스턴스가 지난다'` | not selected — 단계별 직접 관측 |
| VP-03 | REQUIRED | SELF_BLOCKED | 없음 — 사람 실기 대기(B1) | not selected |
| VP-04 | REQUIRED | SELF_BLOCKED | 없음 — 사람 실기 §19 대기 | not selected |
| VP-05 | REGRESSION | SELF_PASS | `native-settings-lifecycle.test.ts:'defers actual before-quit events once…'`(passed, 그 파일 diff 0) + `'AC4 — before-quit 2회…'` | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

하네스: `mutate.py`, oracle = `./node_modules/.bin/vitest run src/main/app/tray-residency.test.ts`. 마지막 테스트 수정 뒤 전 행을 다시 돌렸다. 심은 파일은 전부 `app/src/main/app/tray-residency.ts`.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `if (quitting) return` 제거 | VP-01 등록 | 최초 | 4 | 잠김 |
| M2 메뉴 두 `click` 맞바꿈 | VP-01 등록 | 최초 | 4 | 잠김 |
| M3 `resident = true` | VP-01 등록 | 최초 | 2 | 잠김 |
| M4 `preventDefault()` 제거 | VP-01 등록 | 최초 | 3 | 잠김 |
| M5 `createTray()`를 `try/catch`로 삼킴 | VP-01 등록 | 최초 | 1 | 잠김 |
| M6 트레이 `click` 리스너 제거 | VP-01 등록 | 최초 | 2 | 잠김 |
| M7 `session-end` 리스너 제거 | VP-01 등록 | 최초 | 1 | 잠김 |
| M8 `destroy()` 호출 제거 | VP-01 등록 | 최초 | 2 | 잠김 |
| M9 메뉴 세 번째 항목 추가 | VP-01 등록 | 최초 | 3 | 잠김 |
| M10 `before-quit` 리스너 제거 | VP-01 등록 | 최초 | 3 | 잠김 |
| M11 `hide()` 제거 | VP-01 등록 | 최초 | 3 | 잠김 |
| M12 라벨 표 `ko`↔`en` 맞바꿈 | VP-01 등록 | 최초 | 3 | 잠김 |
| M13 `onPatch` 구독 제거 | VP-01 등록 | 최초 | 1 | 잠김 |
| M14 라벨 선택 `'ko'` 고정 | VP-01 등록 | 최초 | 2 | 잠김 |
| M15 `changedKeys` 조건 제거 | VP-01 등록 | 최초 | 1 | 잠김 |
| S1 `setToolTip` 호출 제거 | sweep — EP-02 툴팁 | 최초 | 1 | 잠김 |
| S2 `setToolTip('x')` | sweep — EP-02 툴팁(다른 값) | 최초 | 1 | 잠김 |
| S3 두 항목의 라벨 맞바꿈 | sweep — EP-02 형제 슬롯 | 최초 | 3 | 잠김 |
| S4 `attach`의 `if (!resident) return` 제거 | sweep — 규칙 칸 분기 B4(diff 자리) | 최초 | 2 | 잠김 |
| S5 메뉴 첫 항목 제거 | sweep — EP-02 항목 | 최초 | 4 | 잠김 |
| S6 메뉴 둘째 항목 제거 | sweep — EP-02 항목 | 최초 | 4 | 잠김 |
| S7 트레이 `click` → `app.quit()` | sweep — EP-02 click(호출 대체) | 최초 | 2 | 잠김 |
| S8 `will-quit` 리스너 제거 | sweep — EP-04 | 최초 | 2 | 잠김 |
| S9 설치 시 `applyMenu()` 제거 | sweep — EP-05 초기 라벨(diff 자리) | 최초 | 4 | 잠김 |

- **분모 검산**: `선택 증거 15 · 인용 변이 0 · 새 oracle 0 · sweep 9 = 표 행 24`. 열거 항목 대응 — EP-01 자리(M1·M4·M11) · EP-02 4자리(M2·M6·S1·S5·S6) · EP-04(M8·S8) · EP-05 2자리(M13·M14) · 규칙 칸 분기(M3·M7·M10·M15·S4·S9) · 생성 분기(M5).
- EP-03 2자리(`index.ts`)에는 변이를 심지 않았다 — 실행하는 테스트가 없어 green이 자명하다(선언 경계 B1).
- **덮개 회귀**: 해당 없음 (이전 라운드 없음).
- 원복 확인: 하네스 출력 "모든 파일 원문 그대로".

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구에 소비자가 있는가 | 있음 — 메뉴 라벨 4개는 `buildMenu` → `setContextMenu`로 간다 | — |
| seam을 만들려고 production을 재배치했는가 | `createWindow`가 창을 반환하게만 바꿨다. `closed`·`close` 리스너의 스코프는 그대로다 | — |
| 이번에 만든 실패 경로가 Part I 상태표의 어느 행인가 | "트레이 생성 실패 (Windows)" 행 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 트레이 실패는 `app.unhandled.rejection`으로 보고된다. 다만 사용자가 보는 화면 변화는 실기로만 확인된다 | §19 대상 아님 — 보고만 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 응답 없음 | — |
| 숨김 직후 사용자가 앱이 꺼졌다고 오해 | 안내 없음 — §6 비범위 | 보고만 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | §10 검색 명령이 타입 선언을 함께 셌다 | 📝 PLAN_GAP → ΔV3로 정정 | 옛 출력 2·7·2·4 vs 목록 1·4·1·2 |
| 2 | 저장소에 `uiLocale`이 없는 값이면 라벨 조회가 `undefined` | ⚠️ 보고만 — 도달하지 않는다 | `protocol.ts:829` `z.enum(['ko','en']).catch('ko').default('ko')` |
| 3 | 트레이 생성이 던지면 `whenReady`의 남은 단계가 건너뛰어진다 | ⚠️ 보고만 — 선언 경계 B6 | §13 |
| 4 | macOS `activate`로 다시 만든 창은 `attach`되지 않는다 | ⚠️ 보고만 — 비-win32는 숨기지 않는다(B5) | `index.ts` `activate` 핸들러 |

### 설계 대비 명시적 차이

- `app` 포트의 `on`을 유니온 인자 하나가 아니라 이벤트별 오버로드 둘로 선언했다. 계약의 의미는 같다.
- deps 타입을 `TrayResidencyDeps<M>` 인터페이스로 이름 붙여 export했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 타입 선언 형태만 다르다 | — |
| 공유 | 해당 없음 | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 — `typecheck` 0 error로 Electron `App`이 포트를 만족함을 확인 | EP-03 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `app/src/main/app/tray-residency.ts`(108줄)·`tray-residency.test.ts`(270줄) · 수정 `app/src/main/index.ts` · `docs/TRD.md` · `docs/IPC_CONTRACT.md` · `docs/arch/backend/overview.md` |
| 실행 명령 | 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음) · `node --test scripts/*.test.mjs` · `mutate.py` 24행 |
| **관측한 게이트 산출** | 가드 4종 exit 0 · lint 0 error·2 warning(renderer 기존 파일) · typecheck 0 error · `node --test` 868/868 · vitest 970파일 중 69 failed·897 passed, 9078케이스 중 330 failed·8617 passed |
| 기준선 분리 | 변경 전 트리(`git stash -u`)의 같은 명령: 69 failed·896 passed / 330 failed·8601 passed. 실패 파일·케이스 목록의 차집합 ∅. 원인은 환경 — `NODE_MODULE_VERSION`(better-sqlite3가 Electron ABI) 68회 · `Electron failed to install` 3회. `[test-pools]` 0건 |
| 돌리지 못한 단계 | `npm test`(pretest ABI 전환)·Windows CI·`npm run dev` 실기 — 이 환경은 Electron 바이너리가 없다 |
| **추가·수정 테스트의 subtree 규칙** | 테스트 파일 1(`tray-residency.test.ts`) · 시간 예산 위반 0(`check-test-budgets` exit 0, 타이머 없음) · 호스트 격리 위반 0(home·env 미사용) · 풀 = unit(자식 프로세스·git·SQLite 신호 없음, 가드 실패 0) |
| V-pair 자기확인 | `SELF_PASS 3 / SELF_BLOCKED 2`(VP-03·VP-04 사람 실기) |
| 강제 지점 전수 | 8/10 — 남긴 2자리는 EP-03(`index.ts`, 사람 실기) |
| **AC 자기보고** | AC1~AC8·AC11 ✅ — 해당 케이스 16 passed · AC10 ✅ — `check-doc-inventory --check` exit 0, `rg "tray-residency" docs/TRD.md docs/IPC_CONTRACT.md docs/arch/backend/overview.md` → 3파일 · AC9 ⚠️ 사람 실기 |
| **합계 검산** | `✅ 10 · ⚠️ 1 · ❌ 0 = 총 11` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 (첫 라운드).
- 막았어야 할 plan 지침이 있었는가: 자리 검색 명령을 신규 파일에 대해 썼고 설계 시점에는 돌릴 대상이 없었다. 계약 타입을 같은 파일에 두면 문자열이 겹친다는 점을 설계가 보지 않았다.
- 반복해서 부딪히는 환경 한계: Electron 바이너리 부재로 `index.ts` 조립과 실제 트레이를 실행할 수 없다.
- 현재 라운드·impl 턴: `r1`.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| 1 | 메뉴 `종료` click이 `app.quit` 분리 호출(`click: deps.app.quit`, this 소실)로 바뀌어도 16케이스 green — 테스트 `app.quit`이 `vi.fn`이라 `this`를 관측하지 못한다(변이 X1) | VP-01 EP-02 둘째 항목 · `verify.md` §4·§13 D1 | 설계자: 채택(가짜 `app.quit`이 `this === app` 단언 + 등록 변이 추가) 또는 경계 선언 | 확장 | PLAN_GAP(창 안) | open |

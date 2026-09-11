# Plan — 0227-logo-asset-replacement

## 메타

| 항목 | 값 |
|---|---|
| slug | `0227-logo-asset-replacement` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 해당 없음 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 앱 아이콘 자산이 구 `icon.png`/`icon.ico`다. 사용자가 새 로고 2종을 확정했다.
- 완료 후 달라지는 것: 실행 중 창·작업표시줄 아이콘과 패키징 산출물 아이콘이 새 orca 로고가 된다.
- 성공을 사용자 관점에서 한 문장으로: Orca 를 실행하면 새 로고가 창·작업표시줄·설치본 아이콘으로 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "1번이미지: logo.png", "2번이미지: logo-with-claude.png" | 2026-09-11 라이브 세션 |
| 명시 요구 | "app/build, app/resources에 첨부하고 기존의 icon.png, icon.ico를 제거하라." | 2026-09-11 라이브 세션 |
| 명시 요구 | "logo.png로 코드 포함하여 대체하라." | 2026-09-11 라이브 세션 |
| 추론 의도 | 아이콘이 현재 쓰이는 **모든 경로**(BrowserWindow + electron-builder)가 새 자산을 가리켜야 한다 — "코드 포함하여 대체" 를 배선 전체로 읽었다 | 요구 문장 + `app/electron-builder.yml` 의 `directories.buildResources: build` |
| 추론 의도 | `logo-with-claude.png` 는 자산으로만 추가하고 코드 참조를 만들지 않는다 — 사용자가 대체 대상으로 `logo.png` 만 지정했다 | 요구 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 1번 이미지를 `logo.png`, 2번 이미지를 `logo-with-claude.png` 로 저장한다 | 사용자 파일명 지정 | 사용자 턴 | ACTIVE | — |
| D-002 | 두 파일을 `app/build/` 와 `app/resources/` **양쪽** 에 둔다 | "app/build, app/resources에 첨부하고" | 사용자 턴 | ACTIVE | — |
| D-003 | `icon.png`·`icon.ico` 를 두 디렉토리에서 **제거** 한다 | "기존의 icon.png, icon.ico를 제거하라" — 이동이 아니라 제거 | 사용자 턴 | ACTIVE | — |
| D-004 | 코드·빌드 설정의 아이콘 참조를 `logo.png` 로 대체한다. Windows 도 `.ico` 없이 `logo.png` 를 쓴다 | "logo.png로 코드 포함하여 대체하라" + D-003 으로 `.ico` 자체가 사라진다 | 사용자 턴 | ACTIVE | — |
| D-005 | `logo-with-claude.png` 는 코드에서 참조하지 않는다 | 사용자가 대체 대상으로 `logo.png` 만 지정 | 추론(§2) | ACTIVE | — |
| D-006 | `electron-builder.yml` 에 `win`·`mac`·`linux` 별 `icon: build/logo.png` 를 명시한다 | `buildResources` 의 기본 탐색명은 `icon.*` 라 D-003 이후 자동 해석이 끊긴다 | 추론(§8) | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-006 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 없음 (Baseline).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-002 ↔ AT-02(4개 자산 존재), D-003 ↔ AT-02(구 자산 0건), D-004 ↔ AT-03·AT-04, D-005 ↔ AT-03(코드 참조는 `logo.png` 1종), D-006 ↔ AT-04.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 브랜딩 자산 교체는 자산·참조 두 곳이 원인 전부다 |
| 이미 기존 코드가 충족하는가 | 아니오 | `app/src/main/index.ts:6-7` 이 `resources/icon.png`·`resources/icon.ico` 를 import |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | "아이콘 표시" 능력은 유지, "`.ico` 다해상도 자산" 능력만 없앤다 | D-003·D-004 — 사용자가 `.ico` 제거를 명시했고 Electron `BrowserWindow.icon` 은 PNG 를 받는다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — `docs/handoff/0078.../plan.md:186` 의 "아이콘(`resources/icon.*`)은 그대로 유지" 는 당시 `files` 제외 논의의 부수 문장이고, 지금 사용자 결정이 상위다 | 해당 파일 2건(`:34`·`:186`) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음. `app/src/main/index.ts:178-181` 주석이 "Windows 는 다해상도 투명 .ico" 를 잠갔으므로 주석도 함께 고친다 | 코드 주석 |

- 사용자에게 올릴 결정: 없음 — 파일명·배치·제거·대체가 모두 명시됐다.
- 코드 조사로 닫은 사실: 아이콘 참조 지점은 `app/src/main/index.ts` 1파일과 `electron-builder.yml` 의 암묵 규약뿐이다(§8 전수).

## 5. 동작 / 사용자 흐름

```text
[앱 실행 / 설치본 열기]
  → [main 프로세스가 BrowserWindow 생성 시 번들된 logo.png 를 icon 으로 지정 (win32·linux)]
  → [창·작업표시줄에 새 orca 로고가 보인다]
  ↘ [자산이 없으면 빌드가 실패한다 — 런타임 무음 폴백 없음]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| Windows 에서 `npm run dev` | `icon: logo` 로 창 생성 | 창·작업표시줄에 새 로고 |
| Linux 에서 `npm run dev` | `icon: logo` 로 창 생성 | 창·작업표시줄에 새 로고 |
| macOS 에서 실행 | `icon` 미지정 유지 | dock 은 앱 번들 아이콘(패키징 산출) 을 따른다 |
| `electron-builder --win/--mac/--linux` | `build/logo.png` 를 플랫폼 아이콘으로 변환 | 설치본·실행 파일 아이콘이 새 로고 |

### 파생 UX / 엣지케이스

- loading / empty / error: 해당 없음 — 아이콘은 정적 자산이다.
- cancel / retry / close / restart: 해당 없음.
- concurrency / multi-session: 해당 없음.
- keyboard / a11y / theme: 로고는 흑백 + 투명 배경이라 다크 배경에서 대비가 낮아질 수 있다 — 사람 실기 확인 항목(AT-01).
- 외부환경/오프라인/폐쇄망: 해당 없음 — 번들 자산이다.

## 6. 범위 / 비범위

- **범위**: `app/build`·`app/resources` 자산 교체, `app/src/main/index.ts` 참조 대체, `app/electron-builder.yml` 아이콘 경로 명시.
- **비범위**: `logo-with-claude.png` 의 코드 사용처 신설(D-005), renderer 내 로고 표시, `.icns`/`.ico` 재생성, README·docs 브랜딩 문구.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `logo-with-claude.png` 사용처 | 아니오 — 자산은 이미 저장소에 있다 | 후속 |
| Windows 다해상도 `.ico` 재도입 | 아니오 — electron-builder 가 PNG 에서 생성한다 | 후속(필요 시) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | Windows·Linux 에서 앱을 실행하면 창·작업표시줄 아이콘이 새 orca 로고다 | 사람 실기 — `npm run dev` 후 창 아이콘 육안 확인(플랫폼 2종) | `index.ts createWindow → BrowserWindow({icon}) → OS` |
| R-02 | AT-02 / AC2 | 저장소에 `icon.png`·`icon.ico` 가 없고 `logo.png`·`logo-with-claude.png` 가 `app/build`·`app/resources` 각각에 있다 | `git ls-files | grep -E '(^|/)icon\.(png|ico)$'` = 0 **및** 4개 경로 존재 + 업로드 원본과 sha256 일치 | 저장소 트리 자체 |
| R-03 | AT-03 / AC3 | main 번들이 `resources/logo.png` 를 유일한 아이콘 자산으로 참조하고 win32·linux 분기가 모두 그것을 쓴다 | `electron-vite build` 산출 `out/main/` 에 로고 자산이 emit 되고, `grep -rn 'resources/icon\.\(png\|ico\)' app/src` = 0 · `grep -rn "resources/logo.png?asset" app/src` = 1 | `import logo … ?asset → vite 번들 → BrowserWindow.icon` |
| R-04 | AT-04 / AC4 | 패키징이 `build/logo.png` 를 win·mac·linux 아이콘으로 쓴다 | `electron-builder.yml` 의 `win.icon`·`mac.icon`·`linux.icon` 3지점이 `build/logo.png` **및** 패키징 실기(사람/CI) 시 산출물 아이콘 확인 | `electron-builder --win/--mac/--linux → 설치본` |
| R-05 | AT-05 / AC5 | 기존 정적 게이트가 이번 변경으로 깨지지 않는다 | `npm run lint` · `npm run typecheck` 무오류 | 저장소 게이트 |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음 — `grep -rn 'iconIco\|resources/icon' app/src --include='*.test.ts'` = 0건, 아이콘을 다루는 기존 테스트가 없다.
- 사람 실기 항목: AT-01(육안 아이콘)·AT-04(패키징 산출물) 뿐이다. 둘 다 OS 셸 렌더링·electron-builder 변환 결과라 순수 테스트로 내릴 수 없다. `app/AGENTS.md §제약 환경 게이트` 가 `dev`/`electron-builder` 실기를 사람/CI 몫으로 명시한다.
- N회/총량 기준: AT-03 의 `1` 은 `grep -rn "resources/logo.png?asset" app/src` 의 import 문 수다. 소비 지점은 `BrowserWindow` 옵션 1곳이고 §10 이 전수를 갖는다.
- 총량/0건 기준: AT-02 의 `0` 은 `git ls-files` 스윕이라 `node_modules` 와 무관하다. AT-03 의 `0` 은 `resources/icon.` 접두사로 좁혀 `favicon.ico` 문자열 3건(§8)을 배제한다. 음성 스윕만으로는 "자산이 산다" 를 잠그지 못하므로 AT-02 후반부(4경로 존재 + sha256)와 AT-03(빌드 emit)이 양성 짝이다.

## 7-A. V / Trace Matrix

- V mode 판정: `Baseline V` — 이 작업이 상속할 명시적 기존 V 가 없다.
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R (사용자 관측 결과가 바뀐다).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 창 아이콘 표시 | NEW | — |
| R-02 | R | §7 자산 인벤토리 | NEW | — |
| R-03 | R | §7 코드 참조 단일화 | NEW | — |
| R-04 | R | §7 패키징 아이콘 | NEW | — |
| R-05 | R | §7 게이트 회귀 | NEW | — |
| AT-01…AT-05 | AT | §7 | NEW | — |
| AR-01 | AR | §9·§10 — `?asset` 번들 배선이 `resources/logo.png` 로 해석된다 | NEW | — |
| AR-02 | AR | §9·§10 — `buildResources` 암묵 해석을 명시 `icon` 경로로 대체 | NEW | — |
| IT-01·IT-02 | IT | §7 AT-03·AT-04 증거 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `createWindow → BrowserWindow({icon}) → OS 셸` | 사람 실기 육안 | not selected — 결과를 직접 본다 | EP-01 (1) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 저장소 트리 → 빌드 입력 | 파일 존재 + sha256 대조 + 파일명 스윕 0건 | not selected — 존재/부재를 직접 센다 | EP-03 (1) |
| VP-03 | R-03 ↔ AT-03 / IT-01 | REQUIRED | `import ?asset → vite main 번들 → out/main` | `electron-vite build` 가 로고를 emit; 자산을 지우면 빌드가 실패한다 | required — 방향 확인용으로 `resources/logo.png` 를 임시 이동해 빌드 실패를 본다 | EP-01·EP-02 (2) |
| VP-04 | R-04 ↔ AT-04 / IT-02 | REQUIRED | `electron-builder.yml → app-builder 아이콘 변환 → 설치본` | yml 3지점 값 대조 + 패키징 실기 | not selected — 값과 산출물을 직접 본다 | EP-04 (3) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 저장소 게이트 | `npm run lint`·`npm run typecheck` 출력 | not selected | 0 — 게이트 자체가 관측이다 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/` subtree 정적 게이트 | `app/src/main/index.ts`·`electron-builder.yml` 을 고친다 | `npm run lint && npm run typecheck` | 이번 변경이 유발한 실패만 blocking |
| main 번들 빌드 | `?asset` 해석이 이번 변경의 핵심 배선이다 | `./node_modules/.bin/electron-vite build` (prebuild 훅 우회, ABI 중립) | 자산 미해석은 blocking |
| 문서 인벤토리 | `docs/handoff/` 문서를 추가·갱신한다 | `node app/scripts/check-doc-inventory.mjs --check` | 링크·수치 위반만 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 아이콘 import 는 2줄뿐이다 | `app/src/main/index.ts:6-7` |
| 소비 지점은 `BrowserWindow` 옵션의 플랫폼 분기 1곳이다 | `app/src/main/index.ts:182-186` |
| `electron-builder.yml` 에 `icon` 키가 없다 — `directories.buildResources: build` 의 기본 탐색명(`icon.ico`/`icon.png`) 에 의존한다 | `app/electron-builder.yml:3-4`, `grep -c '^\s*icon:' app/electron-builder.yml` = 0건 |
| electron-builder 26 은 PNG(≥256×256) 를 받아 플랫폼 아이콘으로 변환한다 | `electron-builder@^26.0.12` (`app/package.json:69`), 벤더 문서의 `icon` 항목 |
| 새 자산은 1254×1254 PNG(RGBA) 로 변환 하한을 넘는다 | `file` 출력 — `PNG image data, 1254 x 1254` |
| `resources/**` 는 `asarUnpack` 대상이라 패키징 시 실디스크로 풀린다 | `app/electron-builder.yml:17-18` |
| 아이콘을 다루는 테스트·문서 계약이 없다 | 아래 전수 조사 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 코드의 아이콘 자산 참조 | `grep -rn 'resources/icon\.\(png\|ico\)' app/src` | 2 | `index.ts:6,7` — 교체 대상 전부 |
| 아이콘 주석 | `grep -rn 'build/icon' app/src` | 1 | `index.ts:180` 주석 — 함께 정정 |
| 설정의 아이콘 키 | `grep -c '^\s*icon:' app/electron-builder.yml` | 0 | 명시 경로 신설이 필요하다 |
| 스크립트의 아이콘 취급 | `grep -ri 'icon' app/scripts \| grep -vi iconv` | 0 | 릴리스 검증 스크립트는 아이콘을 모른다 |
| 문서의 아이콘 계약 | `grep -rn 'icon\.\(png\|ico\)' docs`(0227·favicon 제외) | 1 | `0078.../plan.md:34` 과거 서술. `resources/icon.*` 표기 1건(`:186`)이 더 있다 |
| 아이콘 관련 테스트 | `grep -rn 'iconIco\|resources/icon' app/src --include='*.test.ts'` | 0 | 재사용할 기존 케이스 없음 |
| `favicon.ico` 문자열 | `grep -rn 'favicon\.ico' app/src` | 3 | OAuth 콜백 무시 경로 — 이번 대상 아님 |
| 구 자산 파일 | `git ls-files \| grep -E '(^\|/)icon\.(png\|ico)$'` | 4 | 삭제 대상 전부 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 코드 참조 2건 = import 2줄, 소비 1곳(분기 2가지) — 내역 합 일치.
- "아이콘 참조는 `index.ts` 가 유일" 반례 검색: `grep -rl 'resources/icon\.\(png\|ico\)' app/src app/scripts app/electron-builder.yml` → `app/src/main/index.ts` 1파일.
- 문서 앵커 확인: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 실재(`grep -n '제약 환경' app/AGENTS.md` = 1건).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `AR-01`, `AR-02`
- 현재 책임 소유자: `app/src/main/index.ts`(런타임 창 아이콘) + `app/electron-builder.yml` 의 `buildResources` 관례(패키징 아이콘).
- 현재 entry → flow → consumer: `import icon/iconIco ?asset` → vite 가 `out/main` 으로 자산 emit → `BrowserWindow({icon})` → OS 셸.
- 현재 오류/취소/정리 경로: 자산이 없으면 vite 해석 실패로 빌드가 끊긴다. 런타임 폴백 없음.
- 구조적 제약: 패키징 아이콘 경로가 **파일명 관례**(`build/icon.*`)에만 살아 코드에 보이지 않는다.

```text
[main/index.ts import icon.png / icon.ico ?asset]
  → [electron-vite main 번들]
  → [BrowserWindow({ icon })]
  → [OS 창·작업표시줄]

[build/icon.ico · build/icon.png]  (암묵 규약)
  → [electron-builder buildResources 자동 탐색]
  → [설치본 아이콘]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `AR-01`, `AR-02`
- 변경 후 책임 소유자: 동일 두 파일. 패키징 경로만 관례 → 명시 설정으로 올라온다.
- 변경 후 entry → flow → consumer: `import logo ?asset` 1줄 → 번들 → win32·linux 양 분기가 같은 `logo` 사용 → OS 셸.
- 변경 후 오류/취소/정리 경로: 동일 — 자산 부재는 빌드 실패로 드러난다(VP-03 의 방향 확인).
- 유지/제거: 플랫폼 분기 구조와 macOS 미지정 규칙은 유지, `.ico` 전용 분기 값과 `buildResources` 암묵 탐색은 제거.

```text
[main/index.ts import logo.png ?asset]
  → [electron-vite main 번들]
  → [BrowserWindow({ icon: logo })]   (win32 · linux 동일)
  → [OS 창·작업표시줄]

[electron-builder.yml win/mac/linux icon: build/logo.png]  (명시)
  → [app-builder 아이콘 변환]
  → [설치본 아이콘]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 패키징 아이콘이 파일명 관례에 암묵 존재 | `electron-builder.yml` 이 경로를 명시 | D-003 이 관례 파일명을 없앤다 | AR-02 / VP-04 · `electron-builder.yml` |
| data/control flow | 아이콘 자산 2종(png·ico) | 자산 1종(`logo.png`) | D-004 | AR-01 / VP-03 · `index.ts` |
| state/contract | win32=`.ico`, linux=`.png` | win32·linux 모두 `logo.png` | D-003 으로 `.ico` 부재 | AR-01 / VP-01 · `index.ts` |
| error/lifecycle | 자산 부재 = 빌드 실패 | 동일(유지) | 변경 없음 | AR-01 / VP-03 |
| test seam/관측점 | 없음 | `electron-vite build` 산출 + yml 값 대조 | 기존 테스트 seam 이 0건이다 | IT-01·IT-02 / VP-03·VP-04 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/main/index.ts` | 런타임 창 아이콘 지정 | `resources/logo.png?asset` → `BrowserWindow.icon` | main 부팅 경로 |
| `app/electron-builder.yml` | 패키징 아이콘 경로 | `build/logo.png` → 설치본 | `build:win`/`build:mac`/`build:linux` |
| `app/build/`·`app/resources/` | 자산 보관 | PNG 4개 | vite `?asset` · electron-builder |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-01·VP-03 | 런타임 아이콘 자산 = `resources/logo.png` | `app/src/main/index.ts` import 1줄 | vite `?asset` 해석 | **EP-01** `index.ts` import · **EP-02** `BrowserWindow` 분기 2가지(win32·linux) | 잘못된 경로면 빌드가 실패한다(무음 폴백 없음) |
| AR-01 / VP-02 | 자산 인벤토리 4개 존재 · 구 자산 0건 | 저장소 트리 | 커밋 | **EP-03** `app/build`·`app/resources` 두 디렉토리 | 한쪽만 반영되면 D-002 위반 |
| AR-02 / VP-04 | 패키징 아이콘 = `build/logo.png` | `app/electron-builder.yml` | electron-builder | **EP-04** `win.icon`·`mac.icon`·`linux.icon` 3지점 | 미지정 시 기본 Electron 아이콘으로 조용히 회귀한다 |

- 같은 규칙이 여러 레이어에 있다: 런타임(`resources/`)과 패키징(`build/`)이 **같은 이미지의 서로 다른 사본**이다. 통합 SSOT 는 만들지 않는다 — 사용자가 두 디렉토리 배치를 명시했다(D-002). 대신 sha256 동일성을 AT-02 가 잠근다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: 없음.
- 선택적 필드의 `true/false/undefined` 의미: `BrowserWindow.icon` 미지정(darwin) = OS 가 앱 번들 아이콘을 쓴다 — 기존 동작 유지.
- 외부 SDK 경계의 실제 요구 타입/의미: electron-builder `icon` 은 projectDir 기준 상대 경로 문자열이며 PNG 는 256×256 이상이어야 한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/build/logo.png`·`app/build/logo-with-claude.png` | 패키징 자산 | 신규(1번·2번 이미지) | 파일 존재 + sha256 |
| `app/resources/logo.png`·`app/resources/logo-with-claude.png` | 런타임 자산 | 신규 | 동일 |
| `app/build/icon.png`·`app/build/icon.ico`·`app/resources/icon.png`·`app/resources/icon.ico` | — | 삭제 | 파일명 스윕 0건 |
| `app/src/main/index.ts` | 창 아이콘 | import 2줄 → 1줄(`logo`), win32·linux 분기 모두 `logo`, 주석 정정 | `electron-vite build` emit |
| `app/electron-builder.yml` | 패키징 아이콘 | `win`·`mac`·`linux` 에 `icon: build/logo.png` 추가 | yml 값 대조 |
| `docs/handoff/INDEX.md` | 보드 | 0227 행 추가 | `check-doc-inventory --check` |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: 신설하지 않는다 — `index.ts` 의 변경은 상수 참조 1개이고, 이를 위해 순수 seam 을 만들면 실제 배선(`?asset`)이 seam 밖에 남아 오라클이 약해진다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `?asset` 은 이미 같은 디렉토리의 PNG 에 쓰이고 있었다(`index.ts:6`).
- 순서를 관측할 훅/로그/주입 경계: 해당 없음 — 순서 계약이 없다.

## 12. End-to-end 영향

### producer → consumer

```text
저장소 자산 → vite ?asset / electron-builder icon → BrowserWindow.icon / 설치본 → OS 셸
```

- producer 기준: 1254×1254 PNG 1종이 런타임·패키징 양쪽의 원본이다.
- consumer 파생 규칙: OS·electron-builder 가 필요한 해상도로 스케일/변환한다.
- 파생 가능한 합성값이 정본을 우회하는가: 아니오 — 참조 지점이 §10 의 4개 EP 뿐이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `BrowserWindow` 생성(win32) | `.ico` → `.png` 로 아이콘 소스 형식이 바뀐다 | AT-01 |
| `BrowserWindow` 생성(linux) | 파일명만 바뀐다 | AT-01 |
| electron-builder 패키징 | 자동 탐색 → 명시 경로 | AT-04 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 창 생성 시 1회 지정. 이후 변경 없음.
- 취소/중단·종료/quit/crash·retry/timeout·cleanup/rollback: 해당 없음 — 정적 자산이다.
- **다중 저장소 쓰기**: 해당 있음(문서 산출물). 이번 판정·상태는 `plan.md` 와 `docs/handoff/INDEX.md` 두 곳에 산다 — 같은 커밋에서 함께 갱신하고, 어긋나면 `plan.md` 가 정본이다. 자산 사본(`build/` · `resources/`)은 원자적 쓰기가 아니지만 같은 커밋에 함께 담기므로 중간 상태가 관측되지 않는다.

## 14. 성능 / 상한 / 최적화

- 새 출력/요청의 상한: 해당 없음.
- 저장소 크기: 구 자산 제거 −1,520KB, 신규 자산 추가 4개(각 수십 KB 수준) — 실측은 구현 턴이 기입한다.
- 구조적 목표: 해당 없음.
- 캐시/호출 축소로 잃는 부수 효과: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 만드는 port/schema/config 가 없다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "Windows 는 다해상도 투명 `.ico`" | `app/src/main/index.ts:178` 주석 | §9 TO-BE · §11 주석 정정 | **변경** — D-003 으로 `.ico` 자산이 사라진다 |
| "아이콘(`resources/icon.*`)은 그대로 유지" | `docs/handoff/0078.../plan.md:186` | §4 검토 행 | **변경** — 당시 논점은 `files` 제외였고 현재 사용자 결정이 상위다 |
| macOS 는 `BrowserWindow.icon` 미지정 | `app/src/main/index.ts:181` 주석 | §5 상태표 darwin 행 | 유지 |
| `asarUnpack: resources/**` | `app/electron-builder.yml:17` | §8 | 유지 |
| 기본 게이트 = lint + typecheck (ABI 중립) | `app/AGENTS.md §제약 환경 게이트` | §19 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| PNG 아이콘이 Windows 작은 크기에서 `.ico` 보다 흐릴 수 있다 | 사용자 결정(D-003)이고 원본이 1254px 라 다운스케일 여유가 있다. 실측은 AT-01 사람 실기 |
| 폐쇄 환경에서 `electron-builder` 실기를 이 턴에 못 돌린다 | AT-04 를 사람/CI 실기로 명시(`app/AGENTS.md §제약 환경 게이트` 선례) |
| 로고가 투명 배경이라 다크 테마 작업표시줄에서 대비가 낮을 수 있다 | AT-01 육안 확인 항목에 포함 |

- 되돌리기 어려운 결정: 없음 — 자산 교체는 되돌릴 수 있다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/build/{logo.png,logo-with-claude.png}` (신규) · `app/build/{icon.png,icon.ico}` (삭제)
- `app/resources/{logo.png,logo-with-claude.png}` (신규) · `app/resources/{icon.png,icon.ico}` (삭제)
- `app/src/main/index.ts`
- `app/electron-builder.yml`
- `docs/handoff/0227-logo-asset-replacement/{plan.md,verify.md}` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`
- ABI/네트워크 등 환경 제약: `npm run dev`·`electron-builder` 실기는 이 환경에서 불가 — 사람/CI 몫(AT-01·AT-04).
- 기본 정적 게이트: `npm run lint` · `npm run typecheck`
- 관련 테스트: 아이콘 전용 테스트는 없다. 배선 증거는 `./node_modules/.bin/electron-vite build` 의 main 번들 산출이다.
- 문서 게이트: `node app/scripts/check-doc-inventory.mjs --check`
- 사람 실기: Windows·Linux 창 아이콘 육안(AT-01), 패키징 산출물 아이콘(AT-04).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 결정을 보존한다 — D-001~D-006 전부 ACTIVE, SUPERSEDED·OPEN 0건.
- [x] Part I 만 읽어도 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 재해석하지 않았다 — "제거하라" 를 삭제로, "logo.png로 대체" 를 단일 자산으로 읽었다.
- [x] Product/UX 의 각 핵심 동작이 AC·Technical Design 에 연결된다 — §5 상태표 4행 ↔ AT-01·AT-04.
- [x] AS-IS·TO-BE 가 같은 축으로 있다.
- [x] Delta 5행이 모두 §11 파일 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임(`buildResources` 암묵 탐색)은 §9 TO-BE 에서 명시 설정으로 **대체** 라고 적었다.
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 7행.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 가진다.
- [x] Baseline V 를 썼고 유효 V = V1 로 재구성 가능하다.
- [x] R 레벨에서 시작해 AR↔IT 까지 선택했고 NEW node 마다 REQUIRED pair 가 있다. SD↔ST·MD↔UT 는 상태·수명주기·알고리즘 변경이 없어 노드를 만들지 않았다.
- [x] INHERITED node 가 없어 REGRESSION·NOT_REQUIRED 행도 없다(Baseline).
- [x] 각 pair 가 production path·§10 전수·직접 oracle 을 갖고, 적대 증거는 VP-03 만 이유와 함께 선택했다.
- [x] 운영 gate 3종이 열거됐고 무관한 기존 실패를 blocking 으로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 남긴 2건은 OS 렌더링·패키징 변환 결과다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AT-03 이 빌드 emit 을, VP-03 이 자산 제거 시 실패를 확인한다.
- [x] "X 가 쓰인다" 불변식의 장치가 X 를 지웠을 때 실패한다 — `resources/logo.png` 제거 시 `electron-vite build` 실패(VP-03 적대 증거).
- [x] 정책 파라미터 없음 — 해당 없음.
- [x] 참조 구현 사용 없음 — 해당 없음.
- [x] 신규 계약(§10 4개 EP)의 SSOT·강제 지점·관측 수단이 있다.
- [x] 기존 소비처를 전수 확인했다(§12 표 3행 = §10 EP 4개의 소비 측).
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·one-way door: 되돌리기 어려운 결정 없음.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다 — lint+typecheck 기본, `npm test` 미사용.
- [x] 본문 완성 후 Decision Ledger 교차검증 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| … | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| … | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 관측한 게이트 산출 | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| AC 자기보고 | … |
| 합계 검산 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드 수: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

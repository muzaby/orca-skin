# Plan — 0115-single-instance-lock

## 메타

| 항목 | 값 |
|---|---|
| slug | `0115-single-instance-lock` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | PHASES 승격 대기 / PR (push 후) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 앱 인스턴스는 1개만. 중복 실행 방지 | 라이브 세션 요청: "앱 실행 시 1개만 실행되도록. 여러 개의 프로세스가 생성되면 안된다." |
| 확정 결정 1 | 적용 범위 = **패키징 빌드만**(dev 제외) | 라이브 세션 AskUserQuestion 응답("패키징 빌드만") |
| 확정 결정 2 | 두 번째 실행 시 = **기존 창 포커스**(복원+focus) | 라이브 세션 AskUserQuestion 응답("기존 창 포커스") |

## Context (왜)

현재 Orca 는 단일 인스턴스 보호가 전혀 없다 — 저장소 전체에 `requestSingleInstanceLock`/`second-instance` 0건. 설치본을 두 번 실행하면 두 번째 앱 인스턴스(별도 main 프로세스 + 자식 프로세스 트리)가 그대로 뜨고, 같은 `<userData>/orca.db`(WAL) 를 두 프로세스가 동시에 여는 경합 위험이 있다.

> 용어 주의: Electron 정상 실행 시에도 항상 여러 OS 프로세스(main + renderer + GPU + utility)를 갖는다(Chromium 멀티프로세스). 본 작업이 막는 것은 **앱을 두 번 띄웠을 때의 두 번째 *인스턴스*(중복 main 프로세스)** 다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| main 엔트리·app 라이프사이클 전부가 한 파일. 삽입점은 module scope(`whenReady` 이전) | `app/src/main/index.ts:19-55`, `:153-184` |
| `index.ts` 는 app 컴포지션 루트 레이어 — 1회성 라이프사이클 배선 위치 | `@app/src/main/AGENTS.md` (레이어 매핑: app = `src/main/index.ts` 포함) |
| `createWindow` 는 `void` 반환 — `mainWindow` 참조 미보관(클로저 로컬). 포커스에 쓸 창 핸들 없음 → 모듈 스코프 참조 필요 | `app/src/main/index.ts:76-148` |
| 기존 `activate` 는 창 0개일 때만 재생성 | `app/src/main/index.ts:181-183` |
| 창 `isMinimized`/`minimize`/`maximize` API 이미 사용 — 동일 API 재사용 | `app/src/main/index.ts:112-135` |
| `index.ts` 무테스트(app 라이프사이클 유닛테스트 부재) → 게이트 lint/typecheck, 실검증은 패키징 실기 | `app/src/main/app/*.test.ts` 는 헬퍼만 커버 |
| dev(electron-vite HMR)에서 락을 걸면 이전 프로세스가 락을 늦게 놓을 때 새 인스턴스가 즉시 종료되는 경합 → `app.isPackaged` 게이트(사용자 결정 일치) | Electron `app.requestSingleInstanceLock()` 문서 |

## 인수 기준 (Acceptance Criteria)

1. 패키징 빌드에서 앱 실행 중일 때 두 번째 실행 시도는 새 인스턴스(창/main 프로세스)를 만들지 않는다 — 두 번째 프로세스는 `app.quit()` 으로 즉시 종료.
2. 두 번째 실행 시도 시 기존 창이 복원(최소화면 restore)되고 포커스된다.
3. `app.requestSingleInstanceLock()` 는 패키징 빌드에서만(`app.isPackaged`) 호출된다 — dev(HMR) 에서는 락을 걸지 않는다.
4. 락을 얻지 못한 인스턴스는 창 생성·`Bootstrap.start()`(DB/시드/배포)를 수행하지 않는다.
5. 기존 라이프사이클(`window-all-closed`·`will-quit`·`activate`·dev userData 격리·protocol 등록·보안 `webPreferences`) 회귀 없음.
6. 게이트: `npm run lint`(0 error) + `npm run typecheck`(3/3). 순수 테스트 스위트 회귀 없음.

## 범위 / 비범위

- **범위**: `app/src/main/index.ts` 에 단일 인스턴스 락(패키징 한정) + `second-instance` 포커스 핸들러 + 창 참조 보관.
- **비범위**: 다중 윈도우, 딥링크/CLI 인자(`commandLine`) 파싱, DB 파일 락 자체 방어, dev 단일 인스턴스(사용자 명시 제외).

## 의존 기술 / 전제

- Electron `app.requestSingleInstanceLock()`·`app.on('second-instance')`·`app.isPackaged`·`BrowserWindow` 포커스 API — **모두 Electron 코어, 신규 의존성 0**.
- 전제: 단일 창 모델(코드 주석 "다중 윈도우 도입 시 router 로 옮긴다" 정합).

## 설계

`app/src/main/index.ts` 만 수정. 4개 지점:

1. 모듈 스코프 `let mainWindowRef: BrowserWindow | null = null` 를 `routerRef` 옆에 추가.
2. `createWindow` 가 `mainWindowRef = mainWindow` 로 보관, `closed` 에서 `mainWindowRef = null` 해제. 반환 `void` 유지.
3. `whenReady` 이전 module scope:
   ```ts
   const hasSingleInstanceLock = app.isPackaged ? app.requestSingleInstanceLock() : true
   if (!hasSingleInstanceLock) app.quit()
   else app.on('second-instance', () => focusMainWindow())
   ```
   `focusMainWindow()`: `mainWindowRef ?? BrowserWindow.getAllWindows()[0]` → 최소화면 `restore()`, `show()`, `focus()`.
4. `whenReady` 콜백 최상단 `if (!hasSingleInstanceLock) return`.

- 재사용: 창 API(`isMinimized`/`show`/`focus`)는 기존 `bindWindowControls`(`index.ts:125-135`) 패턴. 신규 유틸/파일 없음.
- 레이어 경계: app 컴포지션 루트 1파일 내부 — boundaries 위반 없음.

## 파생 UX / 엣지케이스

- 최소화 상태 2차 실행: `restore()` 후 포커스(트레이 없음).
- 부팅 중 second-instance: `mainWindowRef` null → `getAllWindows()[0]` 도 없으면 no-op(무크래시).
- macOS: 앱 살아있는 상태 재실행은 기존 `activate` 담당, second-instance 는 별개 프로세스 케이스 — 양립.
- dev: 락 미적용 → HMR 재시작·수동 다중 `npm run dev` 영향 없음.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| dev 단일 인스턴스 미적용 | 사용자 결정(패키징만). 최종 UX 는 패키징 기준이라 무관 |
| second-instance 시점 창 부재 가능 | null 가드 no-op |
| `index.ts` 무테스트 → 자동 검증 한계 | lint/typecheck + 패키징 설치본 2회 실행 사람 실기(인수 1·2) |

- 되돌리기 어려운 결정: 없음(단일 파일 순수 추가).
- 단독 결정 금지 항목: 없음(범위·2차 동작 모두 사용자 확정).

## 영향 받는 파일

- `app/src/main/index.ts` (유일 — 락 + second-instance + 창 참조)

## 참고 문서

- `docs/arch/backend/` (Main 구조), `app/src/main/AGENTS.md` (레이어 매핑)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무영향.

## 게이트

- `cd app && npm run lint && npm run typecheck` (제약 환경 ABI-중립 기본 게이트).
- 신규 테스트 요구: 없음 — 변경은 electron-runtime app 라이프사이클(무테스트 표면). 인수 1·2 는 패키징 실기.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 확정 결정 2건 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`·문서 레퍼런스.
- [x] 인수 기준 — 번호 매김, 검증 가능.
- [x] 의존 기술 — Electron 코어만, 신규 의존성 0 명시.
- [x] 파생 UX — 최소화/부팅중/macOS/dev 엣지케이스 전개.
- [x] 리스크 — 트레이드오프·완화 기록, Open Question 없음.

---

> **[구현자 기입]** — 본 작업은 비기능(robustness) → Claude 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 4지점 그대로 구현. 단일 파일·순수 추가라 구멍 없음.
- 이견 / 우려: 없음. `mainWindowRef` 해제를 `closed` 에서 `if (mainWindowRef === mainWindow)` 가드로 처리해(재생성 창이 이미 등록된 경우 stale null 방지) 다중 창 재생성(`activate`) 시나리오까지 안전.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `closed` 해제가 새 창이 이미 `mainWindowRef` 를 차지한 뒤 이전 창의 close 이벤트로 null 을 덮어쓸 수 있음 | ✅ 구현: `if (mainWindowRef === mainWindow) mainWindowRef = null` 항등 가드 | `activate` 재생성 경로 대비 |

## [구현자 기입] 구현 체크리스트

- [x] `mainWindowRef` 모듈 스코프 + `focusMainWindow()` 헬퍼
- [x] 패키징 한정 `requestSingleInstanceLock` + `app.quit()` + `second-instance` 핸들러
- [x] `createWindow` 창 참조 보관/해제
- [x] `whenReady` 조기 반환
- [x] lint / typecheck 게이트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/index.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run src/main/app` |
| 게이트 결과 | lint ✅ (0 error, 기존 warning 1) / typecheck ✅ (3/3) / 순수 app 테스트 12 passed (electron-binary egress 차단으로 `chat-turn.continuity` 스위트 로드 불가 = 알려진 베이스라인, 본 변경 무관) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |

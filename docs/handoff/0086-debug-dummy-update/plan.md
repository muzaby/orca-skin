# Plan — 0086-debug-dummy-update

> 디버그 패널에서 0084/0085 인앱 자동 업데이트 UX 를 실제 서버 없이 재현하는 dev 전용 테스트 하네스. 비기능(개발 도구) = Claude 직접 구현.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0086-debug-dummy-update` |
| 작성자 | Claude Code |
| 일자 | 2026-07-09 |
| 매핑 | 0085 후속 (dev 테스트 하네스) / 브랜치 `claude/debug-panel-update-test-tajgnl` |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 84, 85에 대해 디버그 패널에서 테스트를 진행하고 싶다" | 라이브 세션 요청 |
| 명시 요구 | 1) 디버그 패널 내 "업데이트" 그룹 생성 | 라이브 세션 요청 |
| 명시 요구 | 2) 더미 업데이트 토글 버튼 배치 — enable 시 앱 헤더 오른쪽 화살표 버튼 우측에 구글 Material 다운로드 버튼 + 우측 상단 파란색 동그라미(svg) | 라이브 세션 요청 |
| 명시 요구 | 3) 버튼 클릭 시 업데이트 로직 실행(mock, 실제 업데이트 없음) | 라이브 세션 요청 |
| 명시 요구 | 이 버튼은 실제 최신 릴리스 시에도 노출되고 **실제 업데이트 동작**으로 이어져야 하며, 디버그 토글에 따라 **기능 배선이 다르게** 돼야 함 | 라이브 세션 (plan 검토 피드백) |
| 추론 의도 | 파란 동그라미는 "업데이트 있음(available)" 표시 → `status === 'available'` 파생 | "새 버전 등록 시 노출"(0085) + "파란 동그라미" 해석 |

## Context (왜)

0084/0085 는 electron-updater 기반 인앱 자동 업데이트를 완성했으나(헤더 조건부 다운로드 버튼 + `UpdateDialog` + idle-gated 설치), 실제 업데이트는 **GitHub Releases 에 새 릴리스가 올라와야만** 트리거된다. 개발 중 이 UX(버튼 노출 → 다운로드 진행 → 설치)를 눈으로 확인/테스트할 방법이 없다. 이 작업은 dev 전용 디버그 토글로 실제 서버 없이 흐름을 재현하되, **실제 업데이트 경로는 그대로 유지**한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 헤더 업데이트 버튼은 `status` 가 `available\|downloading\|ready\|installing` 일 때만 노출(`showUpdateButton`), 클릭 시 `updateActions.openDialog` | `app/src/renderer/src/app/Header.tsx:36-38,96-106` |
| 업데이트 store: `useUpdateStore`(zustand) + `updateActions`(check/download/quitAndInstall) + `initUpdate`/`subscribeUpdate`(IPC 미러) | `app/src/renderer/src/features/update/store/updateStore.ts` |
| 디버그 그룹은 별도 추상 없이 `PanelSection` 헤더 + 컨트롤 나열 관례. 크로스-feature 그룹은 슬롯 주입(SSO 패턴) | `app/src/renderer/src/features/debug/components/DebugPanel.tsx`, `features/login/components/SsoDebugSection.tsx` |
| DebugPanel 은 `import.meta.env.DEV` 가드 하에만 마운트, `ssoSection` 슬롯 주입 | `app/src/renderer/src/app/OverlayLayer.tsx:60-64` |
| 파란색: 기존 `--color-indigo`(#2a78d6) 토큰 존재(`bg-indigo` 사용 사례 `Meter.tsx`), 새 토큰 불요 | `app/src/renderer/src/styles/tokens.css:40`, `shared/ui/Meter.tsx:11` |
| `download` 아이콘 = Material Symbols glyph 이미 정의·헤더 사용 중 | `app/src/renderer/src/shared/ui/Icon.tsx`, `Header.tsx:100` |

## 인수 기준 (Acceptance Criteria)

1. 디버그 패널에 "업데이트" `PanelSection` + "더미 업데이트" `PanelToggle` 이 노출된다.
2. 토글 ON → 헤더 앞으로가기(arrowR) 버튼 우측에 Material `download` 버튼이 노출되고, 우측 상단에 파란 동그라미(inline SVG)가 표시된다.
3. 다운로드 버튼 클릭 → 다이얼로그를 통해 다운로드 진행(0→100%) → ready → 설치 시 **앱 종료 없이** installing 후 리셋되는 mock 흐름이 돈다(실제 `updateApi` 호출 없음).
4. 토글 OFF → 헤더 버튼·뱃지가 사라진다.
5. **실제 경로 보존**: 헤더 버튼·뱃지는 `updateState.status` 만으로 파생되고, `download()`/`quitAndInstall()` 은 `dummyMode === false` 일 때 기존 `updateApi` 실경로를 그대로 탄다(무변경).
6. 게이트 통과(lint/typecheck/build). 레이어 경계 위반 0.

## 범위 / 비범위

- **범위**: dev 디버그 토글 + mock 흐름 + 헤더 파란 뱃지. 렌더러 전용.
- **비범위**: 실제 electron-updater 로직·IPC·메인 프로세스 변경(0085 그대로). 코드 서명/CI/채널(OQ3 후속).

## 의존 기술 / 전제

- 기존 `useUpdateStore`/`updateActions`/`UpdateDialog`, `PanelSection`/`PanelToggle`, `--color-indigo` 토큰 재사용.
- 신규 의존성 없음.

## 설계

- **store(`updateStore.ts`)**: `dummyMode: boolean` 추가. `setDummy(on)` = mock `available`(`DUMMY_AVAILABLE`) 주입 / off 시 초기화. `download()`/`quitAndInstall()` 를 `if (dummyMode) { mock } else { 기존 실 IPC }` 로 감싼다(else 무변경). `initUpdate`/`subscribeUpdate.onState` 는 `dummyMode` 면 skip(실 idle 상태가 mock 을 덮지 않게). `useUpdateDummy` 셀렉터 추가.
- **`UpdateDebugSection.tsx`**(신규): SsoDebugSection 미러 — `PanelSection "업데이트"` + `PanelToggle "더미 업데이트"`. `features/update` 가 export.
- **DebugPanel**: `updateSection?: ReactNode` 슬롯 추가. **OverlayLayer**: `<UpdateDebugSection />` 주입.
- **Header**: 업데이트 `<Button>` 을 `<span className="relative flex">` 로 감싸고 `status === 'available'` 일 때 absolute inline SVG 파란 원(`text-indigo` + `fill="currentColor"`) 오버레이.
- 경계: debug→update 교차 import 금지 → update export + app 주입(SSO 동일). 시맨틱 토큰 사용.

## 파생 UX / 엣지케이스

- 진행 타이머는 모듈 스코프(`dummyTimer`/`dummyTimeout`)로 보관하고 토글 off·재진입 시 정리(중복 방지).
- 실제 업데이트와 더미 UI 동일 경로(status 파생) → 두 경우 시각적으로 구분 없음(의도).
- dev 전용: prod 빌드는 DebugPanel 미마운트라 더미 진입점 없음.
- 테마: `text-indigo` 는 두 테마 공통 토큰(별도 대응 불요).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 더미 상태가 실 IPC 이벤트로 덮일 수 있음 | `initUpdate`/`onState` 를 `dummyMode` 가드로 skip |
| 더미 quitAndInstall 이 실제 앱 종료로 이어지면 안 됨 | dummy 분기는 `updateApi.quitAndInstall()` 호출 없이 installing→리셋만 |

## 영향 받는 파일

- `app/src/renderer/src/features/update/store/updateStore.ts`
- `app/src/renderer/src/features/update/components/UpdateDebugSection.tsx`(신규)
- `app/src/renderer/src/features/update/index.ts`
- `app/src/renderer/src/features/debug/components/DebugPanel.tsx`
- `app/src/renderer/src/app/OverlayLayer.tsx`
- `app/src/renderer/src/app/Header.tsx`

## 참고 문서

- `docs/handoff/0085-auto-update-ux/{plan,verify}.md`
- IPC 변경 없음 → `IPC_CONTRACT.md` 무변경.

## 게이트

- `cd app && npm run lint && npm run typecheck` + `npx electron-vite build`. (test 는 DB 네이티브 바인딩 환경 제약 — 아래 구현 보고 참조.)
- 신규 테스트: 타이머 의존 흐름이라 단위 테스트 대신 육안 검증으로 갈음(AGENTS §4 UI 예외).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론은 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·실경로 보존 명시.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 파생 UX — 타이머 정리·테마·dev 전용 엣지.
- [x] 리스크 — 상태 클로버·실 종료 방지 완화책 명시.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 = 구현. SSO 슬롯 주입 패턴이 debug→update 경계를 그대로 해소하고, status 파생 UI 라 실/더미 배선 분리가 자연스럽다.
- 이견 / 우려: 없음. `--color-indigo` 재사용으로 "파란 토큰 부재" 이슈를 회피(신규 색 토큰 결정 불요).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 더미 다운로드 중 재클릭/재토글 시 타이머 중첩 | ✅ 구현 — `clearDummyTimers()` 를 setDummy/download/quitAndInstall 진입부에서 호출 | 모듈 스코프 단일 타이머 |
| 2 | `initUpdate` await 사이에 더미 토글 켜질 경우 late-write | ✅ 구현 — await 전후 `dummyMode` 이중 체크 | `updateStore.ts:145-155` |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | updateStore.ts · UpdateDebugSection.tsx(신규) · update/index.ts · DebugPanel.tsx · OverlayLayer.tsx · Header.tsx |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `npx electron-vite build` |
| 게이트 결과 | typecheck ✅ / lint(boundaries) ✅ / build ✅. test = 30 실패는 전부 better-sqlite3 네이티브 바인딩 미빌드(`--ignore-scripts` 환경 제약, DB 테스트 한정, 본 변경 무관) |
| 블로커 / 역질문 | 없음. 실제 electron 실행(육안 검증)은 프록시 403 으로 이 환경에서 electron 바이너리 다운로드 불가 → 로컬 `npm run dev` 육안 검증은 사용자 확인 대기 |
| 대상 커밋 | c8520c7 |

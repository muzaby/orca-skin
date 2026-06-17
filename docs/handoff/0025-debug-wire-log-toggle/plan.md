# Plan — 0025-debug-wire-log-toggle

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0025-debug-wire-log-toggle` |
| 작성자 | Claude Code |
| 일자 | 2026-06-17 |
| 매핑 | PR #95 / PHASES "디버그 패널 Wire 로그 토글" 행 |
| 상태 | DRAFT → READY → 구현 완료 (비기능 = Claude 직접 구현) |

## Context (왜)

검증/디버깅 시 main 프로세스가 renderer 로 보내는 **wire message**(정규화 이벤트 `NormalizedEvent` — `orca:chat:event` 채널의 전송 단위)를 눈으로 확인할 방법이 없다. SDK→정규화 변환 결과나 이벤트 순서를 추적하려면 어디든 덤프가 필요하다.

이 작업은 **디버그 패널에 "Wire 메시지" on/off 토글(기본 off)** 을 추가하고, 켜지면 main 이 보내는 모든 wire message 를 **`npm run dev` 터미널(main 프로세스 콘솔)** 에 출력한다.

> 사용자 확정(`AskUserQuestion`): 출력 대상 = **메인 프로세스 터미널**, 형태 = **콘솔만(채팅 패널 출력 없음)**. 따라서 채팅 transcript/DB 는 일절 건드리지 않는다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. 디버그 패널에 "Wire 메시지" 토글(`PanelToggle`)이 추가되고 기본값은 **off** 다.
2. 토글 ON 시 main `sendChatEvent` 가 모든 `NormalizedEvent` 를 `[wire] <type> …` 형태로 터미널(`console.log`)에 출력한다.
3. 토글 OFF / 기본 상태에서는 무출력이다 — 프로덕션 경로는 항상 무출력(DEV 전용 가드 + 플래그 기본 `false`).
4. 토글 상태는 기존 `DebugMockState` + `debugGetMock`/`debugSetMock` IPC 채널을 재사용한다 — **신규 IPC 채널 0**(debug 도메인 2채널 유지).
5. 채팅 transcript/DB 는 무변경이다(콘솔 전용 — 사용자 확정).
6. 게이트(typecheck/lint/test) 통과, 레이어 경계 0(동일 레이어 import), 신규 의존성 0.

## 범위 / 비범위

- **범위**: 디버그 패널 토글 UI + main 측 outbound wire message 콘솔 덤프 + `DebugMockState` 필드 1개 확장.
- **비범위**: 채팅 패널/transcript 출력, inbound(`orca:chat:send`) 로깅, 구조화 로거(electron-log 등) 도입, 로그 필터/레벨/포맷 옵션, 프로덕션 빌드 노출.

## 설계

- **유일 chokepoint**: 모든 wire message 는 `sendChatEvent(wc, ev)`(`src/main/ipc/context.ts`)를 거쳐 renderer 로 나간다. 여기서 토글이 켜져 있으면 `console.log` 한다.
- **토글 상태**: 기존 DEV 전용 `DebugMockState`(main `IpcRouter.debugMock`, `debugGetMock`/`debugSetMock` IPC 동기화) 채널을 재사용한다. 새 IPC 채널/도메인을 만들지 않는다.
- `sendChatEvent` 은 자유 함수라 `ctx` 접근이 없다(`persist.ts`·`send.ts` 등 여러 곳에서 `wc, ev` 만으로 호출). → `context.ts` 에 **모듈 스코프 플래그 + setter `setWireLog`** 를 둬 `debugSetMock` 핸들러가 동기화한다. 플래그 기본 `false` + 토글 핸들러가 `import.meta.env.DEV` 가드라 **프로덕션 경로는 항상 무출력**.
- **재사용 자산**:
  - `PanelToggle`(`src/renderer/src/shared/ui/FloatingPanel.tsx`) — Mock 모드/사이드바 접기와 동일한 토글.
  - `useDebugMock`(`src/renderer/src/features/debug/hooks/useDebugMock.ts`) — patch → `debugApi.setMock` IPC 동기화 자동 처리.
  - `DebugMockState` / `debugGetMock` / `debugSetMock`(`src/shared/ipc.ts`·`protocol.ts`·`ipc/handlers/misc.ts`).
  - `sendChatEvent`(`src/main/ipc/context.ts`) — 단일 outbound wire chokepoint.
- **레이어 경계**: `context.ts`·`misc.ts` 모두 L3 ipc(동일 레이어 import). renderer 변경은 `features/debug` 내부 + `shared/ui` 재사용. 역방향/cross-feature import 0.

## 영향 받는 파일

- `app/src/shared/ipc.ts` — `DebugMockState.wireLog: boolean` 추가.
- `app/src/shared/protocol.ts` — `DebugMockPatchSchema` 에 `wireLog: z.boolean()` 추가(`.partial()` 유지).
- `app/src/main/ipc/context.ts` — 모듈 스코프 `wireLogEnabled` + `setWireLog()` + `sendChatEvent` 분기 로깅.
- `app/src/main/ipc/handlers/misc.ts` — DEV 블록에서 등록 시 초기 동기화 + `debugSetMock` 핸들러 동기화(`setWireLog` import).
- `app/src/main/ipc/router.ts` — 초기 `debugMock` 객체에 `wireLog: false`.
- `app/src/renderer/src/features/debug/hooks/useDebugMock.ts` — `DEFAULT_DEBUG_MOCK.wireLog: false`.
- `app/src/renderer/src/features/debug/components/DebugPanel.tsx` — "Wire 메시지" `PanelToggle` 추가.
- `app/src/main/adapters/mock.test.ts` — `DebugMockState` 리터럴 4곳에 `wireLog: false` 반영(타입 게이트).

## 참고 문서

- `docs/IPC_CONTRACT.md §2.13`(debug 도메인 2채널 — 채널 수/계약 무변경이라 본 작업은 갱신 불필요).
- `app/src/main/AGENTS.md`(main 레이어 DAG — L3 ipc 동일 레이어 import).
- 관련 선례 핸드오프: `0003-debug-panel-mock-adapter`(`DebugMockState`/debug IPC 도입).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 없음. 동작이 `console.log` 부수효과(순수 변환·reducer·스키마 분기 아님)라 단위 테스트 대상이 아니며, 실기 검증은 GUI 수동(`npm run dev`). 기존 `mock.test.ts` 의 `DebugMockState` 리터럴만 신규 필드에 맞춰 갱신.

---

## [Codex 기입] 구현 체크리스트

> 비기능 = Claude 직접 구현. 아래는 Claude 가 기입한 구현 보고.

- [x] `DebugMockState.wireLog` 타입 + zod 스키마 확장
- [x] `sendChatEvent` 분기 로깅 + 모듈 스코프 플래그/setter
- [x] `debugSetMock` 핸들러 + 등록 시 초기 동기화
- [x] `router.ts` 초기값 + `useDebugMock` 기본값
- [x] `DebugPanel` 토글 UI
- [x] `mock.test.ts` 리터럴 갱신
- [x] 게이트 4종(typecheck/lint/test) green

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `shared/ipc.ts` · `shared/protocol.ts` · `main/ipc/context.ts` · `main/ipc/handlers/misc.ts` · `main/ipc/router.ts` · `renderer/.../debug/hooks/useDebugMock.ts` · `renderer/.../debug/components/DebugPanel.tsx` · `main/adapters/mock.test.ts` |
| 실행 명령 | `npm install` → `npm run typecheck` / `npm run lint` / `npx vitest run src/main/adapters/mock.test.ts` |
| 게이트 결과 | typecheck ✅ (node+web+test) / lint ✅ (boundaries 0) / test ✅ (mock.test.ts 4 passed) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `878ef2b` |

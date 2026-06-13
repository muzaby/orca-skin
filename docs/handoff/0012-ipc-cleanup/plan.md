# Plan — 0012-ipc-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(리팩토링) 작업 — Claude 직접 구현.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0012-ipc-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | 단계적 아키텍처 리팩토링 스테이지 2/3 (IPC) |
| 상태 | READY |

## Context (왜)

IPC 계층 감사(2026-06-11)에서 확인된 부채:

- **runtime 3채널이 고아** — `orca:runtime:{status,prepare,statusEvent}` 는 preload 에 노출되나 renderer 래퍼·UI(과거 `features/runtime` RuntimeStatus 위젯)가 제거되어 호출자가 없다. **사용자 결정: 채널 제거** (PythonRuntime 자체는 SDK env 주입에 필요 — main 내부 유지, 진행상태는 dev 터미널 로깅).
- **검증 패턴 비일관** — `.parse()`(reject) vs `safeParse()`(무해 폴백) 혼용이 채널마다 임의적이고 등록 보일러플레이트가 반복된다.
- **IPC_CONTRACT.md 드리프트** — 총수(38↔39)·도메인 수(15↔16) 상단 요약 미갱신, agent 도메인이 문서 말미에 부록처럼 분리, §4 에러 코드가 폐기된 `sdk.*` 모델(실코드는 `ErrorCategory` 8종), §3 renderer 처리 컬럼이 0008 이전 reducer 어휘(`pendingDelta` 등).

## 인수 기준 (Acceptance Criteria)

1. runtime 3채널 제거: `CHANNELS` 키 · preload `orca.runtime.*` · main 핸들러 2개 · statusEvent 브로드캐스트. `RuntimeStage`/`RuntimeStatus` 타입은 `src/main/runtime/` 으로 이동(와이어 타입 아님). dev 터미널 로깅은 유지.
2. `ipc/registry.ts` 의 `handle(channel, schema, invalid, fn)` 헬퍼 도입 — 전 invoke 채널이 단일 경로로 safeParse 검증. 채널별 실패 정책(`'reject'` | `{fallback}`)을 등록부에 **명시**해 현행 동작 보존(동작 변경 0).
3. `handlers/{session,project,mcp,misc}.ts` · `chat/approvals.ts` · `chat/send.ts`(chatCancel) 가 헬퍼 경유로 전환된다.
4. IPC_CONTRACT.md 갱신: 총 36채널·도메인 15(runtime 제거, agent 정식 §2.2-b 편입)·§2.11 제거 이력 표기·§4 ErrorCategory 8종으로 교체·§3 renderer 컬럼 0008 어휘로 정정·§6 변경 절차 경로(`ipc/handlers/`) 갱신·검증 실패 정책 명문화.
5. 게이트: lint · typecheck · test 전체 그린 · build.
6. renderer 동작 무변경 — renderer 소스 diff 0 (preload 타입 축소는 미사용 표면이라 무영향).

## 범위 / 비범위

- **범위**: `shared/ipc.ts`·`shared/protocol.ts`·`preload/`·`src/main/ipc/**`·`src/main/runtime/`(타입 이동)·`docs/IPC_CONTRACT.md`.
- **비범위**: 채널 의미 변경, renderer 코드(스테이지 3), `backend:select`(코드에 원래 없음 — 문서 예약 표기 유지).

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.

---

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `shared/ipc.ts`(runtime 3채널·타입 제거) · `shared/protocol.ts`(재export 정리) · `preload/index.ts`(orca.runtime 제거) · `main/runtime/PythonRuntime.ts`(+RuntimeStage/RuntimeStatus 정의 이동) · 신규 `ipc/registry.ts`(handle/handlePlain) · `ipc/handlers/{session,project,mcp,misc}.ts`·`ipc/chat/{approvals,send}.ts` 헬퍼 전환 · `ipc/router.ts`(브로드캐스트 제거, dev 로깅 유지) · 문서 4건(IPC_CONTRACT·arch/backend/overview·TRD §5 주석·docs/AGENTS.md 인벤토리) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (351/351) / build ✅ |
| 비고 | 채널 39→36. renderer 소스 diff 0 (인수 6). 채널별 실패 정책은 현행 보존 — `'reject'` vs `{fallback}` 을 등록부에 명시 (인수 2). |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `03cc1f5` |

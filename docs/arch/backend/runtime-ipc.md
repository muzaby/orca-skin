# Backend Architecture — Runtime & IPC (동시성·IPC 핸들러·시스템 통합)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [provider-runtime.md](./provider-runtime.md), [../../IPC_CONTRACT.md](../../IPC_CONTRACT.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 동시성 모델

### 1.1 현재 상태 (Phase 3)

- **단일 inflight**: `ChatState.inflight: boolean` — 한 시점에 한 요청만.
- `chat:send` invoke → `CapabilityBuilder.build()` → 어댑터의 `sendMessage` AsyncIterable 소비 → 각 ChatEvent 를 `webContents.send('orca:chat:event', ...)` 로 발행.
- `chat:cancel` invoke → 해당 sessionId 의 `AbortController.abort()` → SDK `query()` 중단.

**InflightTurn 상태 머신** (`ipc/router.ts` 내부): 새 채팅에서 `init` 이벤트 도착 전까지 user 메시지를 in-memory 에 보관하는 상태 머신.

| 상태 | 동작 |
|---|---|
| 새 채팅 시작 (`sessionId: null`) | `pendingUserText` 에 user 메시지 보관. DB insert 보류. |
| `init` 이벤트 도착 | `db.insertSession()` + `db.appendMessage(pendingUserText)` → `pendingUserText = null` (중복 방지) |
| resume 경로 (`sessionId !== null`) | `init` 이전에 user 메시지를 즉시 `db.appendMessage()`. pendingUserText 없음. |
| `assistant_message` 이벤트 | `db.appendMessage()` + `updateSessionPreview()` (`last_message_preview` / `updated_at`) |
| `result` 이벤트 | InflightTurn 클리어. renderer 에 `inflight = false` 전달. |

### 1.2 Phase 4 멀티세션 anchor

- 각 세션이 독립된 `AbortController` 보유
- 요청별 상태는 `requestRegistry: Map<sessionId, RequestState>` 로 추적 (도입 예정)
- 세션 종료/삭제 시 해당 세션의 모든 진행 중 요청 취소
- 동시 요청 수 제한: **없음** (사용자 결정 시 변경 가능)

### 1.3 Rate Limit / 재시도

- SDK 가 내부적으로 처리. Orca 어댑터 레벨의 재시도 로직은 **없음**.
- 사용자에게 보여줄 에러: `error / sdk.crashed` 또는 `error / internal` (recoverable: true 표기).

---


## 2. IPC 핸들러 구조

### 2.1 등록 패턴

`app/src/main/ipc/router.ts`:

```typescript
ipcMain.handle('orca:chat:send', async (event, req) => {
  const validated = SendChatMessageSchema.parse(req)  // zod 검증
  const caps = capabilityBuilder.build(validated.sessionId, validated.projectId)
  const resolvedMcp = mcpStore.buildQueryOptions()
  const adapter = registry.getActive()
  const turn = new InflightTurn(validated)
  for await (const ev of adapter.sendMessage(validated.sessionId, validated.text, cwd, caps, resolvedMcp, abortCtrl.signal)) {
    turn.persist(ev, db)           // InflightTurn 상태 머신 (§1.1)
    event.sender.send('orca:chat:event', ev)
  }
})
```

- **총 31 채널** (IPC_CONTRACT §2): `ipcMain.handle` invoke + `webContents.send` push. 도메인 12개 (chat · backend · install · settings · skills · files · session · project · window · search · mcp · runtime).
- 모든 invoke 는 zod 스키마 (`app/src/shared/protocol.ts`) 로 페이로드 검증.

### 2.2 명명 규칙

[IPC_CONTRACT.md](./IPC_CONTRACT.md) §1 참조. `orca:<domain>:<action>`.

### 2.3 에러 처리

- 모든 핸들러는 try/catch
- 에러는 직렬화 가능한 형태로 변환: `{ code: ErrorCode, message: string, recoverable: boolean }` ([IPC_CONTRACT.md](./IPC_CONTRACT.md) §4)
- 민감 정보 (자격증명 / 파일 전체 경로 등) 는 마스킹 의무

---

## 3. 시스템 통합

### 3.1 자동 업데이트

- **PRD OQ3 미정** — electron-updater 채택 미확정.
- 빌드 채널 (stable / beta) / 업데이트 확인 주기 / 사용자 확인 정책 모두 TBD.

### 3.2 로깅

- **라이브러리 TBD** (adapters.md §2.4 참조). 후보: electron-log.
- 레벨: error / warn / info / debug (도입 시).
- 프로덕션 기본: info. 사용자 설정으로 debug 활성화 가능.
- 크래시 리포팅: PRD OQ4 미정 (Sentry 등).

### 3.3 플랫폼 차이

| 항목 | macOS | Windows | Linux |
|---|---|---|---|
| safeStorage 가용성 (Phase 3+) | Keychain | DPAPI | libsecret (추가 의존성) |
| 단축키 modifier | Cmd | Ctrl | Ctrl |
| 메뉴 위치 | 시스템 상단바 | 윈도우 내부 | 윈도우 내부 |
| userData 경로 | `~/Library/Application Support/orca/` | `%APPDATA%/orca/` | `~/.config/orca/` |

---


# Backend Architecture — Runtime & IPC (동시성·IPC 핸들러·시스템 통합)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-07-10 (handoff 0094 — 자동 업데이트 구현·scheduler·채널 총계 64 동기화)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [overview.md](./overview.md) §3(프로세스 구조), [provider-runtime.md](./provider-runtime.md), [../../IPC_CONTRACT.md](../../IPC_CONTRACT.md), [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md) (레이어 DAG·버스 파이프라인)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 동시성 모델

> 구 "단일 inflight" 모델은 **폐기**됐다. 멀티세션(세션별 SessionRuntime) + 세션별 pending message queue + 장수명 세션 채널로 대체(handoff 0011·0013·0051·0066·0067·0068·0069). 정본 코드: `features/sessions/{session-runtime,supervisor,runtime-pool}.ts` · `features/chat/{pending-message-queue,turn-coordinator}.ts`.

### 1.1 계층 개관 (턴이 흐르는 축)

한 사용자 프롬프트는 **세로축**(세션 자원 거버넌스)과 **가로축**(턴 파이프라인)이 교차하는 지점에서 처리된다:

| 구동체 | 레이어 | 책임 |
|---|---|---|
| **RuntimeSupervisor** | `features/sessions` | SessionRuntime 집합 소유 — 등록/승격/조회 + 단일 멱등 teardown(`release`)·abort. **turn teardown(release) ≠ runtime close(releaseRuntime)** 분리. |
| **SessionRuntime** | `features/sessions` | 세션 1개의 런타임 핸들. `send()` 1회 = 턴 프레임 1개. close 정책 2종(§1.3). 상태: `cold·live·busy·interrupting·error·closed`. |
| **RuntimePool** | `features/sessions` | Persistent(장수명) idle 핸들을 세션 키로 보관. LRU 축출(기본 cap 5, bootstrap 주입). **IdleCloseTimer 폐기(0067)** — 세션 수명 = 프로그램 종료 or LRU 축출만. |
| **TurnCoordinator** | `features/chat` | 한 SessionRuntime 의 `NormalizedEvent` 스트림 소비 → 턴-로컬 reduce → **2 병렬 독립 sink(persist ∥ forward)** 팬아웃. retry·stall·중단/실패 settle·terminal 합성 소유. |
| **PendingMessageQueue** | `features/chat` | **모든 사용자 프롬프트**가 커밋(DB 영속) 전 지나는 세션별 스테이징 통로(§1.4). |
| **ActiveTurnTracker** | `features/sessions` | 프로젝트별 active turn 회계(IPC `concurrency` 도메인). RuntimeSupervisor 의 runtime cap count 와 **별개**. |

- 서로 다른 세션은 **동시 턴**을 돌린다(멀티세션). `chat:cancel` 은 해당 세션의 턴만 중단(장수명 채널은 `interrupt` 로 채널을 살린 채 현재 턴만 멈춤 — 0067).
- 구독 순서·팬아웃 배선의 SSOT 는 `app/bootstrap.ts` 한 곳(§2.4).

### 1.2 SessionRuntime 상태 (`contracts/session-state.ts`)

| 상태 | 의미 |
|---|---|
| `cold` | 생성 직후, 아직 spawn 전. |
| `busy` | 턴 진행 중(`beginSend`). |
| `live` | 턴 종료, 채널/핸들 유휴(재사용/축출 대상). |
| `interrupting` | 취소·stall·retry 로 중단 신호 발신됨(잔여 드레인은 배경에서 terminal 까지 → `live` 복귀). |
| `error` | 프레임/스트림 에러(취소·timeout 이 아닌). |
| `closed` | 채널 해체(teardown/close). |

`abortCause` = `user_cancelled · stall · retry · null` — 취소(`interrupt`)와 stall 타임아웃을 구분한다.

### 1.3 장수명 세션 채널 (close 정책)

- **`persistent`** + 어댑터 `pushTurn` 구현(claude): 한 번의 spawn(SDK `query`/서브프로세스)이 세션 수명 동안 살아남는다. **단일 채널 pump**가 provider 원본 메시지 단위 `ProviderMessageBatch`를 소비하며 **프레임(1 프레임 = 1 턴)** 으로 절단한다. 배치 전 이벤트를 같은 목적지에 넣은 뒤 terminal 전이를 적용하므로 한 원본 메시지의 `[telemetry,error]`가 서로 다른 턴으로 갈라지지 않는다. terminal에서는 프레임만 닫고 채널은 유지하며 후속 턴은 `pushTurn`으로 잇는다.
- **`oneshot`** 또는 `pushTurn` 미구현(mock): 턴-스코프(매 턴 fresh spawn, terminal 에서 핸들 close) — 0067 이전 동작 보존.
- **프레임 밖 이벤트**(CLI 가 자기 큐 잔존분을 자동 픽업해 시작한 턴): `unframed` 버퍼 + `onUnframedEvent` 콜백으로 노출 → 자동 연속 프레임 오픈(배선은 `app/chat-turn.ts`).
- **채널 사망 시**(서브프로세스 종료·스트림 에러): 다음 `send` 는 spawn+resume 콜드 패스. 이월 잔여(미소비 flushed 재주입 + held)는 `takeForRespawn` 이 프렐류드 배치로 앞세운다.
- **provider 경계 respawn(0118)**: env/providerSettings 는 spawn-바운드(`pushTurn` 미전달)이므로, 유휴 세션 send 에서 providerKey 가 바뀌면(`crossesProviderBoundary`, `features/providers`) 호출자(`app/chat-turn.ts`)가 `teardownChannel()` 로 채널을 내려 그 턴을 spawn+resume 콜드 패스로 보낸다 — 위 이월 경로가 그대로 동작.
- **settings 변경 respawn(0125)**: 같은 provider 라도 `settings.json` 이 제자리 수정(토큰 로테이션·base URL 교체)되면 spawn 시점 주입본(`SessionRuntime.spawnedProviderSettings` 기록)과 이번 턴 해석본의 내용 비교(`providerSettingsChangedSinceSpawn`, `features/providers`)로 동일하게 respawn 한다 — 미변경 상시 경로는 resolve 캐시 동일 참조 fast-path.
- **연속 턴 settings 재판정(0126)**: 자동 연속 턴(0067 AC7) 루프도 반복마다 원 턴 providerKey 고정으로 settings 를 재해석해 0125 판정을 재실행한다(변경 시 teardown → 신선한 blob 으로 respawn). provider/model 은 원 턴 계승 불변("선택은 다음 사용자 send 부터", 0119). busy send 의 provider 경계는 main 백스톱(`reserveOnBusySession` 의 `crossesProviderBoundary` 거부)이 렌더러 0119 가드를 이중화한다.

### 1.4 세션별 pending message queue (`features/chat/pending-message-queue.ts`)

모든 프롬프트는 커밋 전 이 큐를 지난다(0066 → 0067 완전 일원화). 세션 상태가 주입 경로를 가른다:

- **세션 idle(사용자 턴)**: `chat:send` 가 enqueue 직후 아이템 단위 배치를 떠서(`flushItem`) 턴 프롬프트로 주입(스폰 초기 메시지 또는 `pushTurn`).
- **어시스턴트 턴(busy)**: `chat:send` 는 **예약(held)만** 한다(구 `chat:steer` 흡수). 항목 수명:

| 상태 | 의미 | 취소 |
|---|---|---|
| **held** | enqueue 직후. stdin 미주입. | ✅ 100% 가능(`chat:steerCancel`·중단 시 `cancelAllHeld`) |
| **flushed** | 게이트 훅(`PostToolBatch`, `flushHeld` 병합 단일 배치) 또는 턴 프롬프트(`flushItem`/`takeForRespawn`, 아이템 단위)로 stdin 주입됨. | ✖ 불가 |
| **consumed** | 소비 확정(`markConsumed`). 배치 성격에 따라 신호 2종(0069) ↓ | — |

- **consumed 신호(0069)**: ① **턴-시작 배치**(프롬프트·프렐류드) = 프레임의 **첫 모델 출력**(coordinator `MODEL_OUTPUT_EVENTS` 앵커 — 응답 시작이 곧 소비 증거, echo 불요) ② **steer 배치**(mid-turn 게이트 flush) = CLI **user echo**(uuid 매칭 — 응답 진행은 소비 증거가 못 되므로 echo 가 유일 정밀 신호).
- **커밋(user row 영속 · preview · renderer 승격)** = **echo 관측 단일 경로**(`message.committed`) — `chat:send` 시점 선영속은 **없다**. renderer 는 `message.queued/committed/cancelled` 로 큐를 간접 관찰한다.
- 훅(`PostToolBatch`/`UserPromptSubmit`)은 **주입 제어 계층**이지 커밋 신호가 아니다(0068 실측 — `UserPromptSubmit` 은 uuid 부재 + init 이전 발화라 상관 불가).

### 1.5 자원 상한 (cap / LRU)

- cap count 대상 = **SessionRuntime population**(active registry + idle pool). eviction victim = **idle runtime only**(active 턴 핸들을 닫아 cap 을 맞추지 않는다).
- 기본 정책 `UnlimitedRuntimeCapPolicy`(무제한). `BoundedRuntimeCapPolicy`(cap 초과 시 idle 축출)는 동일 production 경로로 검증 가능하되 reject/queue admission UX 는 별도 소관(handoff 0056).

### 1.6 Rate Limit / 재시도

- SDK Rate Limit 은 내부 처리. **턴 재시도는 TurnCoordinator 소유**(`MAX_RETRIES = 2`, backoff `[1s, 2s]`) — 프레임 에러 시 `send()` 재호출(respawn+resume 콜드 패스). stall 타이머도 coordinator.
- 사용자에게 보여줄 에러: `error / sdk.crashed` 또는 `error / internal` (recoverable 표기, [provider-runtime.md](./provider-runtime.md) ErrorClassifier).

---


## 2. IPC 핸들러 구조

### 2.1 등록 패턴

핸들러는 컴포지션 루트(`app/handlers/*` · `app/chat-turn.ts`)가 등록하고, 모든 invoke 는 `infra/ipc/handle.ts` 의 `handle(channel, schema, policy, fn)` 헬퍼를 경유한다 — **safeParse(zod `app/src/shared/protocol.ts`) + 채널별 실패 정책**(`'reject'` | `{ fallback }`, [IPC_CONTRACT.md](../../IPC_CONTRACT.md) §1)을 단일 경로로 강제한다. 턴 이벤트는 어댑터가 직접 `webContents.send` 하지 않고 **버스 팬아웃**(§2.4)을 통과한 뒤 `infra/ipc/send.ts` 의 push 헬퍼로 나간다:

```typescript
// app/chat-turn.ts (개념) — chat:send 는 모든 프롬프트의 단일 입구
handle(CHANNELS.chatSend, SendChatMessageSchema, /* 실패=error 이벤트 */, async (req, wc) => {
  queue.enqueue(sessionId, payload)        // 세션별 pending message queue (§1.4)
  // idle → flushItem 으로 턴 스폰/pushTurn, busy → held(예약)만
  // TurnCoordinator 가 SessionRuntime 스트림을 소비 → bus.emit('turn.event')
  //   → usage → history(영속) → title → relay(sendChatEvent → wc.send)  (§2.4 순서)
})
```

- **채널 총계는 [IPC_CONTRACT.md](../../IPC_CONTRACT.md) §2 가 SSOT** — 현재 **총 65 채널**(도메인: `chat`·`boot`·`backend`·`agent`·`engine`·`install`·`update`·`settings`·`skills`·`files`·`session`·`project`·`window`·`search`·`mcp`·`cost`·`concurrency`·`permission`·`debug`(dev)). **본 문서는 총계를 재서술하지 않는다**(드리프트 방지 — 변경 시 SSOT 1곳만 갱신). `chat` 도메인 5채널(`send`·`event`·`cancel`·`stopSubagent`·`steerCancel`).
- 채널 상수는 `app/src/shared/ipc.ts` 의 `CHANNELS`(문자열 리터럴 직접 사용 금지). `debug` 2채널은 `import.meta.env.DEV` 에서만 `ipcMain.handle` 등록.

### 2.2 명명 규칙

[IPC_CONTRACT.md](../../IPC_CONTRACT.md) §1 참조. `orca:<domain>:<action>`.

### 2.3 에러 처리

- 핸들러 실패 정책은 등록부에 명시(`'reject'` = zod 에러로 reject, `{ fallback }` = 무해 폴백). `chat:send` 는 특례 — 실패를 `error` 이벤트로 회신.
- 에러는 직렬화 가능한 형태로 변환: `{ code: ErrorCode, message: string, recoverable: boolean }` ([IPC_CONTRACT.md](../../IPC_CONTRACT.md) §4). 정규화는 `infra/errors` + [provider-runtime.md](./provider-runtime.md) ErrorClassifier.
- 민감 정보 (자격증명 / 파일 전체 경로 등) 는 마스킹 의무.

### 2.4 단일 턴 이벤트 파이프라인 (`infra/bus`)

어댑터 스트림 + 합성 이벤트는 `bus.emit('turn.event')`(TypedBus, `contracts/bus-events.ts`) **단일 팬아웃**으로 흐른다. **구독 등록 순서 = 불변식의 SSOT, `app/bootstrap.ts` 한 곳이 소유**:

```
usage(집계) → history(영속) → title(제목) → relay(renderer 중계)
```

- `usage`·`history` = **critical**(throw = 턴 실패 전파), `title`·`relay` = **격리**(구독자 throw 가 파이프라인을 안 죽임).
- 순서 근거·회귀 테스트는 [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)("단일 턴 이벤트 파이프라인") + `features/chat/turn-coordinator.test.ts`. 버스를 타면 안 되는 forward-only 이벤트(합성 error·turn.retrying·`message.committed`)는 coordinator 가 `forward` sink 를 직접 호출한다.

---

## 3. 시스템 통합

### 3.1 자동 업데이트 (✅ 구현 완료 — 0084~0086)

- **electron-updater 채택** (`app/updater.ts` 의 `UpdateController`). 피드 = GitHub Releases(`latest.yml`/blockmap, 릴리스 파이프라인은 `docs/guides/release-operations.md`).
- 정책: **`autoDownload=false`** — 다운로드·설치 모두 사용자 명시 액션으로만 진입(다운로드 → `quitAndInstall`). 앱 시작 시 1회 자동 체크(`checkForUpdatesOnStartup`), 상태/진행은 `update` 도메인 6채널로 브로드캐스트(`UpdateState.status = idle|checking|available|downloading|ready|installing|error`, IPC_CONTRACT §2 참조).
- **재시작 게이트**: `shared/update-restart.ts` 가 진행 중 턴/세션 상태로 설치 가능 여부를 재계산(0086 에서 브로드캐스트 중복·게이트 재계산 정리). 설치 진입 시 `prepareForUpdateInstall` 이 idle 런타임을 close.
- dev 검증용 더미 업데이트 토글이 디버그 패널에 있다(0086 — 헤더 파란 뱃지 포함, prod 미노출).
- 빌드 채널(stable/beta) 분리·코드 서명은 미정(현재 unsigned NSIS — security.md §1.7).

### 3.1-b 스케줄러 (주기 실행 — 0091)

- `features/scheduler/`(croner, `infra/cron.ts` 래퍼) — job 등록(`register`)·겹침 방지(`protect`)·다음 실행(`nextRun`)·실행 이력(`schedule_runs`, persistence.md §1.3).
- 첫 소비처: **주기 사용량 recompute** — 컴포지션 루트가 action(`cost.recordAndBroadcast`)을 주입, `SettingsSchema.scheduler.usageRecompute{enabled,cron}` 로 제어(신규 IPC 0 — 기존 `settings:set` 경로).
- `shutdown()` 은 `closeDb` 앞에 `Scheduler.stopAll()` (`disposed` 가드).

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

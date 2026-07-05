# Plan — 0067-long-lived-session-queue

> Long-lived 세션 채널 전환 + Pending Message Queue 완전 일원화. 구조 전환(비기능+아키텍처) = Claude 직접 plan → impl → verify. 설계는 라이브 세션에서 사용자 승인 완료(2026-07-05, plan-mode ExitPlanMode 승인).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0067-long-lived-session-queue` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES 후속 승격 |
| 상태 | READY |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 확정 1 | **long-lived 직행** — 세션은 프로그램 종료 또는 LRU 축출 시 종료(어시스턴트 completed 기준 아님). resume 잇기가 아니므로 큐 flush 단순화 | 라이브 세션(2026-07-05) |
| 명시 확정 2 | 동시 런타임 최대 **5** | 〃 |
| 명시 확정 3 | **모든 사용자 프롬프트는 pending message queue 경유** — 구조 페이로드(첨부 포함) 일반화, 주입 분기는 SDK/어댑터 역할 | 〃 (2026-07-04~05) |
| 명시 확정 4 | renderer **pending-first**(연회색+기울임 시작→정식 승격). 훅 역할분담: UserPromptSubmit=일반 메시지 타이밍 / PostToolBatch=steer flush | 〃 |
| 명시 확정 5 | **중단 버튼 = held 전량 취소 + 전체 텍스트 composer 입력 복원(편집 가능)** | 〃 (plan 리뷰 코멘트) |
| 명시 확정 6 | 임시 세션 id — int 카운터 대신 **renderer draft UUID 키를 `clientKey` 로 전달** 하는 대안에 동의 | 〃 ("A답변은 대안에 동의") |
| 검토 결론(승인) | 커밋(승격) 신호 = **echo 단일**(훅은 주입 제어 계층: PostToolBatch flush 게이트 + UserPromptSubmit 프레임 오픈 신호) — 훅 승격의 구조적 구멍(uuid 부재·판정-이전 발화·drain-이전 발화) 근거로 채택 | ExitPlanMode 승인 |

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 현행은 persistent(0054)도 매 턴 새 query — terminal 에서 `live.close()`, "result 도착 시 입력 스트림을 닫아 서브프로세스 종료" | `session-runtime.ts:74-96` · `claude.ts:251-254` |
| SDK 스트리밍 입력 = 장기 실행 권장 경로(다중 메시지·이미지 블록·인터럽트·훅) | `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md` |
| 라이브 컨트롤(setModel/setPermissionMode/interrupt/stopTask) 이미 `LiveTurn` 배선 | `claude.ts:396-409` |
| echo 커밋 신호 실측 검증(D5) — `--replay-user-messages`, uuid=source_uuid 보존, **턴 첫 프롬프트도 echo 됨**(현행은 매칭 실패 무시로 흡수) | `claude.ts:301-308` · handoff 0060 |
| P1(mid-turn drain)은 UserPromptSubmit 미발화(attachment 파이프라인), PostToolBatch 는 drain 직전 발화(뒤에 abort/blocking 체크) | 사용자 제공 명세 v3/v4 §7.1·§2 [V] |
| UserPromptSubmit hook input 은 `prompt: string` 뿐(uuid 무) + block 판정 참여(타 훅 block 시 프롬프트 폐기) | 명세 §7.2 [V] · `@docs/spec/claude/agent-sdk/hooks.md` |
| 0055 거버넌스(RuntimePool/CapPolicy/LruEviction/closeAll) 재사용 가능 — cap 기본값·IdleCloseTimer 만 변경 | `supervisor.ts` · `runtime-pool.ts` |

## 인수 기준 (Acceptance Criteria)

1. **장수명 세션 채널**: claude 어댑터의 query/서브프로세스가 턴 종료(result)에도 살아남아 같은 세션의 후속 턴을 `push` 로 처리한다. 세션 종료 = 명시 close(LRU 축출·프로그램 종료·respawn 경계·에러)뿐.
2. **프레임 demux**: SessionRuntime 이 공유 스트림을 턴 프레임으로 절단 — 프레임은 terminal 에서 끝나되 채널은 유지. TurnCoordinator/HistoryWriter/UsageTracker 의 "1 프레임=1 턴" 소비 모델 보존(코디네이터 시그니처 무변).
3. **취소 = interrupt**: chat:cancel 이 서브프로세스를 죽이지 않고 `interrupt()` — 이후 같은 채널로 후속 턴 정상. + **held 전량 취소 + `message.cancelled` 발신, renderer 가 텍스트를 composer draft 로 복원(편집 가능)** (확정 5).
4. **거버넌스**: 동시 런타임 cap 5(LRU evict-idle), IdleCloseTimer 폐기, 종료 시 전체 close. 게이트 env(`ORCA_PERSISTENT_RUNTIME`) 제거 — long-lived 가 기본.
5. **큐 완전 일원화**: 모든 사용자 프롬프트가 구조 페이로드(`content: TurnInputContent` + attachmentViews)로 큐에 삽입된 뒤 상태별 주입 — idle=즉시 push(스폰 시 초기 프롬프트), busy=held→PostToolBatch 게이트 flush. `chat:steer` 채널은 `chat:send` 로 흡수(main 판정), 채널 54→53.
6. **커밋 = echo 단일 경로**: user row 영속·preview/provider_key·renderer 승격이 전부 echo 관측 시점. 턴 첫 프롬프트 echo 도 큐 매칭 커밋. chat-turn carryover 블록·chatStore send 시점 로컬 커밋 제거.
7. **자동 연속 턴**: 턴 종료 시 held 잔여 → 자동 push → CLI 픽업 → 새 프레임 자동 구동(사용자 개입 없이 이어짐). 명시 취소된 턴에서는 발동하지 않음(AC3 이 우선).
8. **renderer pending-first**: 모든 사용자 메시지가 연회색+기울임으로 시작, `message.queued/committed/cancelled` 이벤트로 상태 전이(steer.* → 일반화 rename, `message.user` 는 committed 로 통합). Composer inflight 분기 제거(단일 send).
9. **clientKey**: renderer draft UUID 키가 `SendChatMessage.clientKey` 로 전달돼 세션 키 발급 전 라우팅/큐 키로 사용, init 에서 실 id remap (확정 6).
10. **admission 제거**: busy send=enqueue 이므로 `AdmissionController/Policy` 삭제(0056 supersede), 새-채팅 슬롯 중복만 최소 가드.
11. **mock 어댑터 분기**: 장수명 미지원 어댑터는 현행 턴-스코프 경로로 동작(capability 분기) — mock 시나리오 회귀 0.
12. **게이트**: lint/typecheck 3종/vitest green, 레이어 경계 0, 신규 의존성 0. 문서 동기화(IPC_CONTRACT 채널 53·variant 표, arch, AGENTS).

## 범위 / 비범위

- **범위**: 위 AC 전부 (main + renderer + shared 계약 + 문서).
- **비범위**: provider/effort/settings/extensions 의 라이브 전환(= respawn 경계로 문서화), 앱 종료 시 held pending 영속(버림 — 한계 문서화), opencode, CLI 큐 잔존분(C7/C8) 자동 픽업 의존(비의존 설계 — orca push 가 트리거).

## 설계 요지

승인된 계획 전문 = 본 plan 의 상위 설계 원문(라이브 세션 승인본). 핵심:

- **W1 세션 채널**: `streaming-input` push(content blocks, uuid) 확장 + 세션-스코프 스트림(초기 메시지도 push 로) / `claude.ts` result 미폐쇄·`LiveTurn.push` 노출 / `session-runtime.ts` 프레임 demux(단일 pump → 현재 프레임 sink, terminal 에서 프레임 종료, 프레임 밖 이벤트 버퍼+UserPromptSubmit 훅=프레임 오픈 1차 신호) / 콜백(requestApproval·takeSteerFlush·PostCompact) 세션-레벨 인디렉션(현재 프레임 ref 해석).
- **W2 거버넌스**: capacity 5 기본 + LRU evict-idle(0055 기계), IdleCloseTimer 폐기, shutdown closeAll.
- **W3 큐 일원화**: 큐 아이템 `{id, uuid, content, attachmentViews, createdAt}` / `chat:send`=enqueue→상태별 flush / echo 단일 커밋(HistoryWriter 이동) / 자동 연속 루프(coordinator.run 후 held 잔여 push→새 프레임) / 중단=interrupt+held 전량 취소+draft 복원 / admission 삭제 / clientKey.
- **W4 renderer**: pending-first + `message.queued/committed/cancelled` + 로컬 커밋 제거 + Composer 단일 send + inflight 이벤트 파생.
- **W5 문서·게이트**.

## 리스크 / 실측 항목 (wire log, W1 중)

1. 장수명 스트림의 턴별 result 프레이밍 실측. 2. result 후 push→CLI 픽업 레이턴시·echo 순서. 3. interrupt 후 채널 생존. 4. 5 프로세스 메모리. 5. 앱 종료 held 버림 한계 문서화.

## 설계 self-review 체크리스트

- [x] 의도 분리(명시 확정 6건 + 검토 결론) 기재
- [x] 조사 레퍼런스 전건 명시
- [x] 인수 기준 12건 번호화
- [x] 신규 의존성 0
- [x] Open Question — cap 수치(0055 OQ)는 사용자 확정(5)으로 해소

## [구현자 기입]

### 설계 리뷰

- 설계 골격대로 W1~W5 순 착지. "1 프레임=1 턴" 보존 전략이 유효 — TurnCoordinator/HistoryWriter/UsageTracker 시그니처 무변으로 관통했다.

### 놓친 잠재 문제 + 대응 (✅ 선조치)

- ✅ **취소 신호 분리**: 턴 AbortController 를 어댑터에 넘기면 turn-1 취소가 채널을 죽인다 → `wrapRequest` 가 신호를 **채널 신호**로 치환하고, 프로세스 제어는 `markAborted` 가 소유(채널=interrupt·프레임 마감+draining, 턴-스코프=채널 abort — mock 취소 의미 보존).
- ✅ **draining 중 send 는 respawn**: interrupt 잔여 드레인과 새 턴 이벤트의 소속을 구분할 수 없어 채널을 teardown 후 resume 스폰(안전 열화).
- ✅ **releaseRuntime 이 'interrupting' 도 보존** — 취소 직후 반납 시점에 드레인이 미완이라 'live' 만 보존하면 AC3(취소 후 채널 재사용)이 깨진다.
- ✅ **takeForRespawn 의 소비 확정 잔존분 폐기** — 신규 큐 테스트가 이중 커밋 후보를 적발, 구 drainForFlush 의 폐기 규칙 계승.
- ✅ **중단 draft 복원의 이중 복원 방지** — 복원을 main `message.cancelled`(held 만) 이벤트 기반으로: flushed 항목은 ids 에 없어 draft 로 새지 않고 echo 커밋으로 화해. hover 단건은 낙관 제거가 선행돼 자연 no-op.
- ⚠️ **CLI 자동 픽업(C7/C8 잔존분) 자동 프레임 오픈 미배선** — unframed 버퍼+`onUnframedEvent` 콜백까지만(이벤트는 다음 프레임 앞 합류로 무유실). 근거: 해당 CLI 동작은 [I](미실측)이고, orca 가 flush 를 항상 소유하므로 발생 창이 좁다. wire 실측에서 확인되면 후속 라운드에서 자동 TurnContext 오픈 배선.

### 변경 파일 / 게이트 결과

- main: `adapters/{streaming-input,claude,claude-adapt,turn,types}` · `features/sessions/{session-runtime,supervisor,runtime-pool,runtime-cap-policy}`(admission 3종·idle-close-timer 삭제) · `features/chat/{pending-message-queue,turn-coordinator,turn-sinks,abort}` · `features/history/writer` · `contracts/turn` · `app/{chat-turn,bootstrap}`.
- 계약: `shared/{ipc,protocol}`(chatSteer 채널 삭제 54→53·`message.queued/committed/cancelled`·`clientKey/clientRequestId`) · `preload`.
- renderer: `chatStore`(pending-first·단일 send·draftRestore) · `chatReducer`(BEGIN_TURN·커밋 첨부) · `Composer`(steer 분기 삭제) · `ChatTile`(draft 복원 합류) · `TranscriptView`(유휴 pending 표시·빈 transcript pending) · `PendingSteerTurn`(일반화 주석).
- 게이트: lint 0 · typecheck 3종 0 · vitest **685 passed (88파일)** · electron-vite build green. 신규 의존성 0.

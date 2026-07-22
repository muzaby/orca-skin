# Plan — 0138-listen-turn-optin-foreground

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0138-listen-turn-optin-foreground` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES (verify PASS 시 승격) — `0135`/`0136` 후속(회귀 원복) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "서브에이전트 및 도구 호출이 inflight 표기된다. 그러나 도구 사용이 다 완료되었음에도 main 은 계속 inflight 표시만 한다. steer 메시지를 넣어도 커밋이 안되고 계속 inflight 에 머물러 있고. 중단 후 다시 보내면 queueing 되었던 메시지가 한 번에 나오는 상황." → 수석엔지니어 관점 비판적 검토 | 라이브 세션 요청(2026-07-22) |
| 명시 결정 | 검토 후 두 갈래("135 를 엄격하게 구현" vs "136 을 구현하여 대체") 중 **"135 엄격 구현 (권장)"** 채택 | 라이브 AskUserQuestion 응답(2026-07-22) |
| 관찰 근거 | "원래 보고했던 이상현상(메인은 백그라운드 툴이 동작중이라고 보고, 정작 툴은 완료)은 사라짐. foreground 강제가 실제로 먹히는지는 잘 모름" | 라이브 응답 Q2 |

## Context (왜)

`0136` 이 CLI 2.1.198+ 의 백그라운드 서브에이전트를 **listen 턴**(입력 push 없는 프레임 소비, stall 미무장)으로 라이브 수용하도록 얹었는데, 이 listen 턴이 **정반대 회귀**를 만들었다: 백그라운드 태스크가 도는 동안 listen 턴이 세션을 "턴 진행 중"(activeTurns++·`hasSession`)으로 잡고 백로그 배달로 inflight 를 점등한 채, CLI 완료 알림 턴이 깨끗한 terminal 로 닫히지 않는 엣지에서 **영구 개방**된다(stall 미무장이라 타임아웃도 없음). 그 상태에서 사용자 send 는 held 로 적재되나 릴리즈 밸브(`endListenFrame`)가 프레임 정체성·타이밍에 취약해 flush 되지 않고, 중단 후 재전송 때 누적 held 가 벌크로 쏟아진다.

**정적 확정(자료조사)**: `subagent.task started` 는 SDK `task_started` system 메시지에서만 방출된다(`claude-map.ts:103-104`). `task_started`/`task_notification` 은 CLI 2.1.198+ 의 **백그라운드** 메커니즘이다 — 진짜 foreground 서브에이전트는 평범한 Agent 도구 호출(`tool.call.started`→`completed`)이라 트래커에 등록되지 않는다. **따라서 listen 턴이 열리는 것 ⟺ 서브에이전트가 실제로 백그라운드로 돈다**. 사용자가 증상을 봤다는 것은 기본 설정에서도 서브에이전트가 백그라운드로 돌고 있다는 뜻(= `0135` 의 `run_in_background:false` 주입이 CLI 2.1.215 에서 무효이거나 opt-in 경로).

사용자 결정("135 엄격")에 따라, 본 핸드오프는 **기본 경로에서 백그라운드 수용(listen 턴)을 완전히 배제**한다. 백그라운드 서브에이전트 수용은 `ORCA_SUBAGENT_BACKGROUND` **opt-in 뒤로만** 유지한다(0136 인프라 보존, 기본 경로에서만 비활성).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 턴-후 루프가 `backgroundTasks.ids().size>0` + 채널 생존이면 listen 턴을 연다 | `app/src/main/app/chat-turn.ts:777-804` |
| listen 턴은 `activeTurns.increment` + NOOP stall 타이머 → 무기한 개방 가능 | `turn-coordinator.ts:237,243`, `:45-49` |
| listen 프레임은 terminal 이 올 때까지 `consumeFrame` 블록 | `session-runtime.ts:175-188` |
| 릴리즈 밸브는 `this.frame === this.listenFrame` 일 때만 — gap 발화 시 no-op | `session-runtime.ts:363-370` |
| `subagent.task started` 는 `task_started`(백그라운드) 에서만 방출 — foreground 미등록 | `claude-map.ts:103-104,183-190` |
| `backgroundSubagents = ORCA_SUBAGENT_BACKGROUND==='1'` opt-in, 기본 off | `chat-turn.ts:208` |
| `run_in_background:false` 주입(0135)은 canUseTool opt-out — 실효는 라이브 미검증(PASS\*) | `claude.ts:122-128`, 0135 verify |
| 합성 정착 재사용 헬퍼(채널 사망·콜드 spawn 정리) | `chat-turn.ts:222-236`(`settleDeadBackgroundTasks`) |
| 채널 사망 시 미프레임 백로그는 다음 openFrame 이 합류(순서 보존) | `session-runtime.ts:280-287` |

## 인수 기준 (Acceptance Criteria)

1. **기본(off) 경로 listen 턴 배제**: `backgroundSubagents` 가 off(기본)면 턴-후 루프는 `backgroundTasks` 에 태스크가 남아 있어도 **listen 턴을 열지 않고 종료(break)** 한다. → 세션이 턴-종료 후 즉시 유휴로 복귀(inflight off·`hasSession` false).
2. **opt-in(on) 경로 불변**: `ORCA_SUBAGENT_BACKGROUND=1` 경로의 listen 턴·릴리즈 밸브·합성 정착(0136)은 기존 그대로 동작한다.
3. **held flush·steer 정상화**: 기본 경로에서 백그라운드 서브에이전트가 떠도 메인 턴 종료 후 세션이 유휴이므로, 이후 사용자 send 는 held 예약이 아니라 신규 턴으로 정상 커밋된다(중단→재전송 벌크 소멸).
4. **진행 중 실작업 미절단**: 기본 경로 종료 시 미정착 태스크를 **강제 실패 정착하지 않는다**(진짜로 도는 백그라운드 서브에이전트를 조기 실패로 truncate 하지 않음). 그 완료 이벤트는 기존 unframed→다음 openFrame 백로그 합류로 다음 사용자 send 때 화해된다(멱등 upsert).
5. **진단 가시성(D4)**: 기본(off)인데 턴-종료 시 미정착 백그라운드 태스크가 남아 있으면 경고 로그(`chat.subagent.background-unexpected`, sessionId·count·사유)를 1회 남긴다 — `run_in_background:false` 주입이 라이브에서 무효인지 필드에서 판정하는 신호.
6. 게이트: `npm run lint` + `npm run typecheck` 0 error + 순수 vitest green(0136 신규 스위트 회귀 0). electron 로드 스위트(`chat-turn.continuity`)·라이브 실기는 egress/사람 몫으로 분리 보고.

## 범위 / 비범위

- **범위**: `app/src/main/app/chat-turn.ts` 턴-후 루프의 listen 턴 개시 분기 1곳(기본 경로 게이트 + 진단 로그).
- **비범위**:
  - **listen 턴 런타임 자체의 하드닝**(inflight 분리·bounded settle·밸브 견고화) — 사용자가 "136 대체" 대신 "135 엄격" 을 택함. opt-in 경로는 현행 유지.
  - **SDK 핀 롤백**(0134 `3472608` 되돌림으로 CLI 기본 foreground 복원) — AC5 진단 로그가 필드에서 "기본에서도 백그라운드 지속" 을 확인하고, AC4 의 "다음 send 화해" 코스메틱(백그라운드 툴 행이 다음 send 전까지 '실행 중')이 수용 불가일 때의 **에스컬레이션 후보**. 0134 는 컨텍스트 도넛 분모(실측 contextWindow)를 위해 핀을 올렸으므로 롤백은 그 트레이드오프를 별도 평가해야 한다 — 본 핸드오프 밖.
  - claude-map 매핑(async_launched 영수증)·session-runtime listen 프레임·트래커 구조 — 무변(opt-in 이 계속 씀).
  - 렌더러 무변.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기본 경로에서 백그라운드 서브에이전트가 떠도, 메인 턴 종료(break) 후 그 완료 이벤트는 기존 unframed 버퍼→다음 openFrame 백로그 합류 경로로 배달돼 화해된다(0067 인프라 재사용). 신규 의존성 0.
- `settleSubagentTask`/`upsertToolResultPart` 의 toolRunId 멱등성(0136 자료조사)은 그대로 — 늦은 권위 결과가 안전하게 화해.

## 설계

`chat-turn.ts` 턴-후 루프(현 777~804)의 `pending===0` 블록 진입부에 **기본 경로 조기 종료** 를 추가한다:

```
if (pendingMessages.pending(sessionId).length === 0) {
  // 135 엄격(0138): 기본(foreground)에서는 listen 턴을 열지 않는다. 백그라운드 수용은
  // ORCA_SUBAGENT_BACKGROUND opt-in 뒤로만. 기본 경로에 미정착 태스크가 남으면(주입 무효
  // 등) 진단 로그만 남기고 종료 — 실작업 절단 없이 세션을 유휴로 복귀(inflight off).
  if (!backgroundSubagents) {
    const stuck = backgroundTasks.ids(sessionId).size
    if (stuck > 0) {
      backgroundTasks.clear(sessionId)   // 트래커만 비움(합성 정착 X — truncate 방지)
      getLogger().child('chat').warn('chat.subagent.background-unexpected', {
        sessionId, count: stuck,
        reason: 'foreground default but task_started tracked — run_in_background:false ineffective?'
      })
    }
    break
  }
  if (backgroundTasks.ids(sessionId).size === 0 || !runtime.channelAlive) break
  … (opt-in listen 턴 — 기존 그대로) …
  continue
}
```

- `backgroundTasks.clear` 는 **트래커 상태만** 비운다(다음 턴에 stale 조회로 다시 판정하지 않게). 합성 tool_result 정착은 하지 않는다(AC4 — truncate 방지). 채널 사망 시 정리(`settleDeadBackgroundTasks`)와 콜드 spawn 리셋은 기존 경로 그대로 백스톱.
- 레이어: app 컴포지션 루트 내부 단일 파일 — 경계 변화 0.

**대안 검토(기각)**: 기본 경로에서 미정착 태스크를 `settleDeadBackgroundTasks` 로 즉시 실패 정착 → '실행 중' 코스메틱 stuck 은 없지만, 진짜로 도는 백그라운드 서브에이전트를 조기 실패로 truncate 하고 이후 권위 결과 도착 시 실패→정상 플리커를 만든다. AC4(미절단) 우선으로 기각 — 트래커만 비우고 다음 send 백로그 화해에 맡긴다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **주입이 실효**(정상 foreground): `task_started` 자체가 없어 트래커가 비어 있고 진단 로그도 안 뜬다 — 본 게이트는 no-op. 서브에이전트는 종전 foreground UX(메인 턴이 결과를 기다림, child transcript 라이브).
- **주입이 무효**(백그라운드 지속): 메인 턴은 런치 영수증 직후 종료→inflight off. 백그라운드 툴 행은 async_launched '실행 중' 으로 남았다가 **다음 사용자 send** 의 백로그 배달로 settled 화해. 진단 로그가 필드에 남아 SDK 핀 롤백 필요 여부를 판정.
- **opt-in(on)**: 0136 listen 턴 UX 그대로(라이브 배달·밸브·합성 정착). 본 게이트 미적용.
- **held/steer**: 기본 경로 종료 후 세션 유휴 → 다음 send 는 신규 턴. 메인 턴 진행 중의 held 는 기존 턴-종료 자동 연속(held flush)이 그대로 처리.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 주입 무효 시 백그라운드 툴 행이 다음 send 전까지 '실행 중' 코스메틱 잔존 | 턴-inflight 고착(실제 증상)은 완전 해소가 우선. 코스메틱은 다음 send 화해 + 진단 로그 기반 SDK 핀 롤백(비범위)이 근본책 |
| 트래커 clear 로 opt-in 아닌 세션의 늦은 settled 이벤트가 무주인 | settled 는 버스에서 `settleSubagentTask`(toolRunId 멱등)로 여전히 tool_result 를 화해 — 트래커는 listen 개시 판정 전용이라 clear 무해 |
| listen 인프라가 기본 경로에서 dead code 화 | opt-in 경로가 계속 사용 — 제거 아님. 테스트(0136 신규 스위트)도 유지 |

- 되돌리기 어려운 결정: 없음 — 게이트 1줄, 즉시 revert 가능.
- 단독 결정 금지 항목: SDK 핀 롤백(0134 트레이드오프 재평가) → 진단 로그 근거 확보 후 사용자에게.

## 영향 받는 파일

- `app/src/main/app/chat-turn.ts` (턴-후 루프 게이트 + 진단 로그)

## 참고 문서

- `docs/handoff/0135-subagent-foreground-restore/plan.md`, `docs/handoff/0136-background-subagent-runtime/plan.md`
- `docs/arch/backend/provider-runtime.md` §서브에이전트 백그라운드 라이프사이클

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 순수 vitest(0136 신규 스위트 회귀 0). chat-turn 루프 실기는 electron 로드(`chat-turn.continuity`)라 CI/사람 몫.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 요청·방향 결정(135 엄격) 인용.
- [x] 자료조사 — listen 개시 조건·`task_started` 백그라운드 전용성 정적 확정(파일:라인).
- [x] 인수 기준 — 기본 배제/opt-in 불변/미절단/진단 로그, 검증 가능.
- [x] 의존 기술 — 다음 send 백로그 화해·멱등 정착 재사용, 신규 의존성 0.
- [x] 파생 UX — 주입 실효/무효/opt-in 3분기 열거.
- [x] 리스크 — 코스메틱 잔존·SDK 핀 롤백(비범위) 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 정적 확정("listen 턴 개시 ⟺ 백그라운드 실행")으로 게이트 지점이 단일(chat-turn 루프 1곳)임을 코드로 재확인. `backgroundSubagents` off 에서 조기 종료가 D1~D3(inflight 고착·steer 미커밋·벌크)를 기본 경로에서 결정적으로 제거한다.
- 이견 / 우려: 없음. 미절단(트래커만 clear) 선택으로 진짜 도는 백그라운드 서브에이전트의 truncate 를 피하고 다음 send 백로그 화해에 맡긴 것이 최소 표면.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| O1 | 중단 직후 즉시 재전송 시 draining/respawn 레이스로 retryable 에러 1회 표출(재전송 시 소멸) — 사용자 라이브 관찰 | ⚠️ 보고만(비범위). 본 수정이 "오랜 inflight" 전제를 기본 경로에서 없애 트리거를 실질 제거하나, draining 레이스 자체는 listen 턴 무관 독립 이슈 — 수정 후 라이브 재현 시 별도 핸드오프에서 정면 진단(teardown 완료 await 또는 draining 중 retryable 억제) | `session-runtime.ts:191`(draining teardown), `chat-turn.ts:914`(chatCancel) |

## [구현자 기입] 구현 체크리스트

- [x] AC1 기본(off) 경로 listen 턴 배제(트래커 clear + 진단 로그 + break)
- [x] AC2 opt-in(on) 경로 불변(기존 분기 그대로)
- [x] AC3/AC4 held flush 정상화·미절단(강제 정착 X — 트래커만 clear)
- [x] AC5 진단 로그 `chat.subagent.background-unexpected`
- [x] AC6 게이트(lint/typecheck/순수 vitest)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/chat-turn.ts` (턴-후 루프 게이트 1곳) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run`(0136 프리미티브 5스위트) |
| 게이트 결과 | lint 0 error(1 pre-existing warning: useTranscriptVirtualizer, 무관) / typecheck 3분할 0 error / 순수 vitest 132/132(background-tasks·turn-coordinator·session-runtime·canusetool·claude-map — 회귀 0). IPC/DB 변경 0, 레이어 경계 0 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |

## [구현자 기입] 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/순수 vitest | ✅ | — | 통과 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | AC1~6 |
| 기본 경로 inflight 고착·steer 정상화 라이브 실기 | ✖ | ✅ | electron 로드 — 사람/CI 대기 |
| 진단 로그로 foreground 주입 실효 판정(D4) → SDK 핀 롤백 필요 여부 | ✖ | ✅ | 필드 로그 확보 후 결정 |
| O1 draining 레이스 잔여 재현 여부 | ✖ | ✅ | 수정 후 라이브 관찰 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

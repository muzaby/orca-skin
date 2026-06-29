# OpenCode 오케스트레이션 패턴 분석

> 가이드라인 문서 [`orchestration_report_ko.md`](./orchestration_report_ko.md) 의 top-down 오케스트레이션 구성요소를 기준으로,
> 실제 OpenCode 코드베이스(`packages/core`)가 각 요소를 **어떻게 구현했는지** 대조 분석한다.
> 라이프사이클 분석은 [`opencode_lifecycle_analysis_ko.md`](./opencode_lifecycle_analysis_ko.md) 참조.

---

## 0. 들어가며 — 가이드라인 vs 실제 코드의 거리

가이드라인 문서는 OpenCode·Codex CLI·Claude Code의 *블로그/설계 수준* 서술을 종합한 것이다. 거기서 OpenCode는 "per-agent JSONL inbox + session injection + autoWake + peer-to-peer `team_message`" 로 묘사된다.

실제 이 리포지토리(`packages/core`, V2 런타임)를 분석하면 그림이 더 정확해진다:

- **메시징의 실체는 파일 기반 JSONL inbox가 아니라, SQLite 이벤트 소싱 로그 위의 `SessionInput` admission(steer/queue) + session injection 이다.** "append-only"·"audit log"·"session injection"·"autoWake" 라는 개념적 골격은 일치하지만, 매체는 *per-agent JSONL 파일*이 아니라 *durable 이벤트 스토어*다.
- **`team_message` / `team_broadcast` / `team_claim` 같은 first-class 팀 도구는 현재 V2 코드에 존재하지 않는다.** peer-to-peer 팀 메시징은 가이드라인의 이상적 모델이며, 실제 OpenCode V2가 구현한 것은 *세션 간 입력 주입 + auto-wake* 라는 더 낮은 레벨의 프리미티브다.
- 서브에이전트를 *생성하는* `task` 도구는 V2에 **아직 미포팅**(`tool/builtins.ts:24-28` TODO)이며, 세션 스키마의 `parentID` 만 준비되어 있다.

아래에서는 가이드라인 7개 구성요소를 따라가되, **실제 구현 메커니즘**을 코드로 보인다.

---

## 1. 리드 에이전트 / 하네스 계층

가이드라인: "하네스가 전체 맥락을 쥐고, LLM을 언제 재호출할지 결정하며, 하위 에이전트에 위임한다."

### 1.1 Primary agent = 중심 루프

- OpenCode의 하네스는 **primary 에이전트 + `SessionRunner`** 의 조합이다.
- 에이전트는 `mode: "primary" | "subagent" | "all"` 로 역할이 갈린다 (`agent.ts:26`). 기본 primary는 **`build`**, 그 외 `plan` 등이 설정으로 추가된다 (`agent.ts:13`, `config/agent.ts`).
- "언제 LLM을 다시 호출할지"의 결정 로직이 곧 **`SessionRunner.run` 의 이중 루프**다 (`session/runner/llm.ts:373-396`):
  - 도구 호출이 있으면 다음 턴 (`needsContinuation`),
  - 없으면 *대기 중 steer 입력*까지 확인 후 종료,
  - `MAX_STEPS=25` 로 폭주 방어.

### 1.2 하네스의 책임 매핑

| 가이드라인 책임 | OpenCode 구현 | 위치 |
|---|---|---|
| 계획·작업 분해 | primary 에이전트(예: `plan`) + `todowrite` 도구 | `tool/todowrite.ts`, `config/agent.ts` |
| 도구 게이트·정책 집행 | 권한 ruleset + materialize 필터 + `Policy` | `permission.ts`, `tool/registry.ts:105`, `policy.ts` |
| 세션 관리 | 이벤트 소싱 durable 세션 + `steer`/`queue` | `session/input.ts`, `session/store.ts` |
| subagent spawn | parentID 자식 세션(그릇만 준비), task 도구 미포팅 | `session/info.ts:16`, `builtins.ts:24` |

> 가이드라인이 말한 "모델은 프로그래머블 런타임의 한 구성요소" 라는 명제를, OpenCode는 *Effect Layer로 조립된 서비스 그래프 안에서 `llm.stream` 이 한 컴포넌트* 인 형태로 문자 그대로 구현한다 (`runner/llm.ts:245`).

---

## 2. 메시지 버스와 통신 — 실제 구현

가이드라인은 두 방식을 든다: ① 파일 기반 inbox(Claude Code), ② append-only JSONL + session injection(OpenCode). **OpenCode V2의 실제 구현은 ②의 정신을 *이벤트 소싱 DB* 로 구현한 형태다.**

### 2.1 입력 admission = 메시지 버스의 실체

세션 간/사용자→세션 메시지는 모두 **`SessionInput`** 으로 흐른다 (`session/input.ts`).

- 메시지는 `admit` 으로 **이벤트 로그에 append** 된다 (`PromptLifecycle.Admitted`, `session/input.ts:54-94`). → 가이드라인의 "append-only / audit log" 에 정확히 대응. 단 매체는 JSONL 파일이 아니라 **aggregate sequence가 붙은 이벤트 스토어**.
- 입력은 두 *delivery* 를 가진다 (`session/input.ts:18`):
  - **`steer`**: 진행 중 턴에 끼어드는 메시지 → 다음 안전 경계에서 promote (`promoteSteers`, `:300-321`).
  - **`queue`**: 작업 종료 후 하나씩 처리 (`promoteNextQueued`, `:323-343`).
- promote 시 `Promoted` 이벤트가 발행되며, 이는 **target 세션의 히스토리에 synthetic user message로 주입**된다 (`toMessage`, `:345-353`; runner에서의 promote 호출 `runner/llm.ts:193-200`). → 가이드라인의 "session injection" 그대로.

### 2.2 autoWake = idle 루프 재기동

가이드라인: "메시지를 보내면 idle recipient prompt loop를 autoWake로 다시 시작한다."

OpenCode 실제 구현 (`session.ts:176-186`):

```ts
const enqueueWake = (admitted) =>
  execution.wake(admitted.sessionID, admitted.admittedSeq)   // ← durable seq 기준 wake
    .pipe(..., Effect.forkIn(scope, { startImmediately: true }))
```

- `prompt()` 가 입력을 admit한 뒤 (`resume !== false` 이면) `enqueueWake` 를 호출 (`session.ts:348-373`).
- `wake` 는 **fire-and-forget** 으로 fork되어, idle 상태였던 세션의 drain 루프를 깨운다 → 가이드라인의 "fire-and-forget spawn + auto-wake" 패턴.
- 깨우는 대상이 *다른 세션*이면 곧 세션 간 통신이 된다.

### 2.3 통신 토폴로지 — 가이드라인과의 차이

- 가이드라인은 OpenCode를 "full peer-to-peer `team_message`" 로 묘사하지만, **현 V2 코드에는 `team_*` 도구가 없다.** 실제로는 *어떤 호출자든 `SessionV2.prompt(targetSessionID, …, delivery)` 로 임의 세션에 입력을 주입할 수 있다* 는 **저수준 P2P 프리미티브**가 있을 뿐이다 (`session.ts:137-158`).
- 즉 "peer-to-peer 가능"은 맞지만, 그것을 *팀 채널/브로드캐스트*로 추상화한 상위 계층은 이 리포지토리에 아직 없다.

> **요약**: 가이드라인의 "append-only JSONL + session injection + autoWake" 3요소는 OpenCode에 실재한다. 단 *매체가 이벤트 소싱 DB* 이고(파일 JSONL 아님), 그 위의 *팀 메시징 추상화는 미구현* 이다.

---

## 3. 실행 및 동시성 모델 — 핵심: Run Coordinator

가이드라인이 OpenCode의 강점으로 꼽은 "two-level state machine, fire-and-forget + auto-wake, crash 후 수동 recovery" 의 **실제 엔진**이 `session/run-coordinator.ts` 다. 이 파일이 OpenCode 오케스트레이션의 심장이다.

### 3.1 키(=세션)당 최대 1개의 drain 체인

코디네이터는 *세션 키마다 동시에 하나의 drain 세대만* 실행한다. 서로 다른 세션은 동시 실행 (`run-coordinator.ts:16-28`):

```
idle --run/wake--> draining --run/wake--> draining + 1개 coalesced rerun --> idle
```

- **`run`**: 명시적 drain 요청. 체인을 시작하거나 합류하며, 호출자에게 "explicit-run 의미론"을 보장 (`:221-242`).
- **`wake`**: "durable work가 생겼을 수 있다"는 advisory 신호. idle이면 체인 시작, draining이면 *하나의* follow-up으로 coalesce. 반복 wake는 합쳐진다 (`:161-175`, `coalesce` `:53-56`).
- **`interrupt`**: 현재 소유 체인을 멈추고, *interrupt 경계 이전의 advisory wake는 억제*, 이후 것은 정리 후 실행 (`:193-217`).

### 3.2 두 종류의 demand 우선순위

`run`(explicit) 이 `wake`(advisory) 를 지배한다. follow-up 병합 시 run이 이기고, wake는 가장 최신 durable seq를 유지 (`coalesce`, `:53-56`):

```ts
if (left?._tag === "run" || right._tag === "run") return { _tag: "run" }
return { _tag: "wake", seq: maxSeq(left?.seq, right.seq) }
```

이것이 가이드라인이 말한 **two-level state machine** 의 실체다 — *coarse 한 demand 종류(run/wake)* 와 *fine 한 진행 상태(Entry의 current/pending/stopping/owner)* 를 분리 관리 (`Entry` 타입 `:41-50`).

### 3.3 seq fencing = 오래된 작업 거부

- 모든 wake/interrupt는 durable `seq` 를 동반한다. interrupt 이후 들어온 **stale wake는 `isAfterInterrupt`/`acceptsWake` 로 차단** (`:248-255`).
- 라이프사이클 분석(§7)에서 본 `failInterruptedTools` 와 결합해, interrupt 시 유령 도구·stale 턴을 정리한다.

### 3.4 fire-and-forget + auto-wake의 완성

- spawn(=prompt+wake)은 **즉시 반환**(`forkIn(scope, startImmediately)`, `session.ts:184`)하고,
- 실제 작업은 코디네이터가 소유한 owner fiber가 수행 (`start`, `run-coordinator.ts:93-110`).
- 동기 drain이 JS 스택에서 재귀하지 않도록 successor는 `Effect.yieldNow` 후 시작 (`:98-104`).

> 가이드라인: "blocking spawn은 병렬성↓, non-blocking spawn은 lead가 일찍 종료." OpenCode의 답은 **fire-and-forget으로 즉시 반환하되, durable seq 기반 wake로 idle lead를 정확히 재기동** — 이 트레이드오프 해법이 `run-coordinator.ts` 전체에 코드로 구현되어 있다.

### 3.5 크래시 회복 — "자동 재시작 안 함"

가이드라인: "서버 재시작 시 busy agent를 ready로 전환하고, lead에게 재개 판단을 맡긴다. 자동 재시작은 비용 폭주 때문에 피한다."

OpenCode V2의 현 구현:

- durable 이벤트 로그가 모든 상태를 보존하므로, 재기동 후 히스토리는 복원된다.
- run 진입 시 `failInterruptedTools` 로 중단 도구를 마감 (`runner/llm.ts:115-135`, `:380`).
- **자동 재시도/재시작은 의도적으로 미구현** — `runner/llm.ts:50` `[ ] Bound provider retries`, `:46` 멀티노드 durable ownership TODO. → 가이드라인의 "runaway cost 방지" 철학과 정확히 일치.

---

## 4. Subagent와 격리

가이드라인: "독립 context window, 도구·권한 격리, worktree/credential 격리. 핵심은 프롬프트가 아니라 인프라로 경계를 강제."

### 4.1 독립 컨텍스트 = 자식 세션

- 서브에이전트는 `parentID` 를 가진 **별도 세션**으로 표현된다 (`session/info.ts:16`). 세션마다 독립 히스토리·Context Epoch·모델·권한을 갖는다 → context bloat 격리.
- 에이전트는 `mode: subagent` 와 `hidden` 으로 사용자 선택 목록에서 숨겨진다 (`agent.ts:26-27`, `:100-101`).

### 4.2 도구·권한 격리 = materialize 필터링

가이드라인의 "탐색용 subagent가 `team_message` 를 못 쓰게 deny/hidden" 원칙을, OpenCode는 **권한 ruleset 기반 도구 materialize 제거**로 일반화해 구현한다 (`tool/registry.ts:105-117`):

```ts
materialize(permissions = []) {
  if (whollyDisabled(permission(tool, name), permissions)) registrations.delete(name)
  // → 금지 도구는 모델의 tool 정의에서 아예 사라진다(숨김 + 차단 동시 달성)
}
```

- 각 에이전트의 `permissions: Ruleset` (`agent.ts:30`)가 그 에이전트가 볼 도구 집합을 결정한다.
- 이는 가이드라인이 강조한 **"프롬프트가 아니라 인프라에서 경계 강제"** 를 정확히 구현한 핵심 사례다. (탐색 에이전트에게 조율 도구를 *프롬프트로 금지*하는 게 아니라, *정의에서 제거*한다.)

### 4.3 worktree/credential 격리 — 현황

- 가이드라인의 "agent별 git worktree, container, credential 격리"는 OpenCode에서 **Location/workspace 추상 + 컨테이너 패키지** 수준에 단초가 있다 (`location.ts`, `packages/containers`, 세션의 `location.workspaceID`). 다만 Codex처럼 *agent thread별 worktree 자동 생성* 같은 완성된 형태는 V2 코어에 아직 없다.
- `task` 서브에이전트 도구 자체가 미포팅(`builtins.ts:24`)이므로, 격리된 자동 spawn의 전 과정은 마이그레이션 대기 중이다.

> **현황**: 격리의 *정책 메커니즘*(per-agent 권한 + materialize 제거 + 자식 세션 컨텍스트)은 견고하게 구현됨. *자동 spawn·worktree 격리*의 상위 워크플로는 미완.

---

## 5. Multi-agent Deliberation과 Consensus

가이드라인: "위험·모호한 결정에 서로 다른 persona의 독립 agent를 띄우고, consensus scoring + two-gate validation."

- **현 OpenCode V2 코어에는 deliberation/consensus/grader 프리미티브가 존재하지 않는다.** confidence trigger, `IDLE→RESEARCH→DELIBERATION→RANKING→…` state machine, two-gate validation, managed multiagent 는 가이드라인이 종합한 *상위 워크플로/외부 프레임워크* 개념이다.
- OpenCode가 제공하는 것은 그 *하부 빌딩블록* 이다:
  - 독립 세션(서로 다른 system prompt·권한)을 여러 개 만들 수 있는 능력 (`agent.ts`, `parentID` 세션),
  - 세션 간 메시지 주입(§2),
  - run-coordinator 기반 병렬 실행(§3).
- 따라서 deliberation은 이 프리미티브 위에 **플러그인/상위 도구로 구축할 여지**가 있으나, 코어 자체에 내장되어 있지는 않다.

> **결론**: 이 섹션은 가이드라인 ↔ 실제 구현의 간극이 가장 큰 영역이다. OpenCode는 "여러 독립 에이전트를 띄울 수단"은 갖췄지만 "합의 평가 워크플로"는 코어 책임으로 두지 않았다.

---

## 6. 메모리, 컨텍스트, 상태

가이드라인: "파일 기반 메모리, compaction, goal, session handoff."

### 6.1 파일 기반 프로젝트 메모리

- OpenCode는 `AGENTS.md`(루트·디렉터리별)와 `opencode.json` 을 **세션 시작 시 시스템 컨텍스트로 로드**한다. 이는 가이드라인의 `CLAUDE.md`/`MEMORY.md` 역할에 대응 (시스템 컨텍스트 로더 `system-context/*`, runner에서 `loadSystemContext` `runner/llm.ts:170-173`).

### 6.2 Compaction = handoff 문서의 내장형

- 가이드라인의 "session handoff (`Status/Files changed/Decision/Blocked/Next`)" 구조가, OpenCode에서는 **compaction 요약 템플릿**으로 코어에 내장되어 있다 (`session/compaction.ts:16-51`): `Goal / Constraints / Progress(Done·In Progress·Blocked) / Key Decisions / Next Steps / Critical Context / Relevant Files`.
- 즉 OpenCode는 handoff를 *수동 문서 작성*이 아니라 *컨텍스트 오버플로 시 자동 요약*으로 처리한다 (트리거 `:230-241`, 오버플로 복구 `:177-229`). 이전 요약을 anchored 방식으로 병합 (`:166-173`).

### 6.3 Context Epoch = 컨텍스트 일관성 관리

- 라이프사이클 §6에서 본 **Context Epoch / Context Snapshot / Safe Provider-Turn Boundary** (`CONTEXT.md`, `context-epoch.ts`)가 장기 작업 중 시스템 컨텍스트 변화를 *순서 보장하며 lazy 하게* 반영한다. 가이드라인의 "compaction + session persistence" 를 더 정교화한 모델이다.

### 6.4 Goal / multi-day workflow

- 가이드라인의 Codex `/goal`(다일간 stateful task)에 직접 대응하는 코어 프리미티브는 OpenCode V2에 없다. 다만 *durable 이벤트 세션 + 자동 compaction* 자체가 세션 경계를 넘는 상태 보존을 제공하므로, 동일 목적의 기반은 마련되어 있다.

---

## 7. 권한과 샌드박싱

가이드라인: "hook 기반 safety gate, permission profile, OS 샌드박싱(Seatbelt/Landlock)."

### 7.1 Permission profile = ruleset

- OpenCode는 `opencode.json` 의 `permissions: Ruleset` 로 `edit/bash/webfetch/task/...` 권한을 선언한다 (`config/agent.ts:23`, `permission/schema.ts`).
- 평가: 마지막 매칭 규칙 우선 + 와일드카드, 기본 `ask` (`permission.ts:101-110`). 결정은 `allow|deny|ask`, 사용자 응답은 `once|always|reject` (`permission.ts:48`, `:86-99`).
- **에이전트별 권한 분리** (`agent.ts:30`)로 가이드라인의 "각 에이전트가 어떤 도구를 쓸 수 있는지 제어"를 구현.

### 7.2 Hook = 플러그인 / safety gate

- 가이드라인의 "Claude Code hook = 모델이 skip 못 하는 결정적 실행 계층" 에 대응하는 것이 **권한 materialize 필터 + 플러그인**이다. 금지 도구는 모델에게 노출조차 안 되므로(`registry.ts:105`) *모델이 우회할 수 없는* 게이트가 된다.
- 플러그인(`packages/plugin`)이 도구 실행 전후·에이전트 라이프사이클에 개입하는 hook 역할을 한다.

### 7.3 OS 샌드박싱

- 가이드라인의 Codex Seatbelt/Landlock/seccomp 수준의 *코어 내장 OS 샌드박스*는 OpenCode V2 코어 도구에 강하게 드러나지 않는다. 격리는 주로 **권한 ruleset + Location/workspace + 컨테이너 패키지**(`packages/containers`)로 달성한다. `bash` 등 도구 leaf가 자체적으로 권한 assert를 수행한다 (`tool/AGENTS.md`, `tool/tool.ts`).

> **요약**: 선언적 권한·에이전트별 분리·materialize 게이트는 견고. 단 OpenCode의 1차 경계는 *OS 샌드박스*보다 *권한 룰셋 + 워크스페이스/컨테이너* 쪽에 무게가 실려 있다.

---

## 8. 복원력과 회복

- **Two-level 상태 관리**: run-coordinator의 *demand 종류(run/wake)* ↔ *Entry 진행 상태(current/pending/stopping/owner)* 분리 (`run-coordinator.ts:41-56`). 가이드라인의 "coarse member status ↔ fine execution status" 분리에 대응.
- **서버 재시작 후 처리**: durable 로그 복원 + `failInterruptedTools` 마감 + **자동 재시작 회피**(TODO로 명시, `runner/llm.ts:46,50`). 가이드라인의 "busy→ready 전환 후 lead에게 위임, runaway cost 방지" 철학과 일치.
- **백프레셔 한계**: 가이드라인이 지적한 "backpressure 없어 빠른 sender가 느린 receiver를 flood" 는 OpenCode의 약점으로 그대로 유효하다 — wake는 coalesce되지만, admit 자체는 무제한 append 가능하다 (`session/input.ts:54`).
- **단일 프로세스 한계**: 멀티노드 ownership 미구현(`runner/llm.ts:46`)으로, 여러 서버 인스턴스가 같은 스토리지를 공유하는 시나리오는 아직 약하다. 가이드라인의 OpenCode "한계" 서술과 부합.

---

## 9. 플랫폼 요약 — 가이드라인 서술 vs 실제 코드

가이드라인 "OpenCode" 절의 각 주장을 코드로 검증한 결과:

| 가이드라인 주장 | 실제 코드 검증 | 판정 |
|---|---|---|
| TypeScript core + effect-based event system | `Effect`/`Layer`/`EventV2` 전면 사용 | ✅ 일치 |
| Build/Plan primary agent + `@general/@explore/@scout` subagent | primary/subagent 모드는 존재(`agent.ts`), 명명된 `@explore/@scout` 빌트인은 코어에 미확인 | ⚠️ 부분 |
| per-agent JSONL inbox + session injection + autoWake | session injection·autoWake는 실재(`session.ts:176`), 단 매체는 **이벤트 소싱 DB**(JSONL 파일 아님) | ⚠️ 정신 일치/매체 상이 |
| peer-to-peer messaging | 저수준 `prompt(targetSession, …)` P2P 주입은 가능, 단 `team_*` 추상화는 없음 | ⚠️ 프리미티브만 |
| fire-and-forget spawn + auto-wake | `run-coordinator.ts` 가 정확히 이 패턴 구현 | ✅ 일치 |
| two-level state machine | run/wake demand ↔ Entry 상태 분리 | ✅ 일치 |
| append-only `O(1)` write + audit log | 이벤트 로그 append + seq | ✅ 일치(DB 기반) |
| crash recovery 기본 수동 | 자동 재시작 미구현, TODO 명시 | ✅ 일치 |
| single-process / backpressure 없음 | 멀티노드 TODO, admit 무제한 | ✅ 일치(한계) |
| `team_create/spawn/message/broadcast/claim` 도구 | **V2 코어에 없음** | ❌ 미구현 |
| `task` 서브에이전트 도구 | **V2 미포팅**(`builtins.ts:24`) | ❌ 미구현 |
| multi-agent deliberation/consensus/grader | 코어에 없음(프리미티브만 존재) | ❌ 미구현 |

---

## 10. 결론

OpenCode 오케스트레이션을 한 문장으로 요약하면 **"durable 이벤트 세션 위에서, 세션당 1개의 drain 체인을 `run/wake/interrupt` 상태머신으로 조율하고, 입력 admission(steer/queue)을 통신 백본으로 삼는 구조"** 다.

가이드라인의 7대 교훈에 비춰 본 OpenCode:

1. **계획/실행 분리** — primary(`build`/`plan`) ↔ 서브에이전트 모드로 *구조는* 갖췄으나, 자동 위임(`task`)은 미완.
2. **에이전트/컨텍스트 격리** — ✅ per-agent 권한 + materialize 도구 제거 + 자식 세션 컨텍스트. (가장 강한 부분.)
3. **메시징 = first-class** — ✅ `SessionInput` admission(steer/queue) + session injection + autoWake. 단 *팀 채널 추상화는 미구현*.
4. **권한은 인프라로 강제** — ✅ 금지 도구를 모델 정의에서 제거하는 materialize 필터가 모범 사례.
5. **상태·recovery를 state machine으로** — ✅ `run-coordinator.ts` 의 정교한 coalescing/seq-fencing 상태머신. 자동 재시작은 의도적 미채택.
6. **고위험 결정에 consensus** — ❌ 코어 미구현. 프리미티브(독립 세션·병렬 실행) 위에 상위 계층으로 쌓을 여지.
7. **상호운용성** — Location/workspace/컨테이너로 기반은 있으나, cross-tool worktree 격리 등은 발전 중.

**핵심 통찰**: 가이드라인 문서가 OpenCode를 "P2P 팀 메시징 + 파일 inbox" 로 묘사한 것은 *상위 워크플로 관점*의 추상이고, 실제 코드의 정수는 그보다 **한 층 아래의 견고한 프리미티브** — *이벤트 소싱 입력 admission* 과 *run-coordinator 상태머신* — 에 있다. OpenCode는 화려한 멀티에이전트 협업 기능을 코어에 박아 넣기보다, **재현 가능하고 복구 가능한 단일 세션 실행을 durable 수준에서 완성한 뒤** 그 위에 오케스트레이션을 점진적으로 올리는 *bottom-up* 전략을 택했다. `run-coordinator.ts` 한 파일이 그 베팅의 상징이다.

# OpenCode 라이프사이클 관리 구조 분석

> 가이드라인 문서 [`lifecycle_management_ko.md`](./lifecycle_management_ko.md) 의 계층 모델을 기준으로,
> 실제 OpenCode 코드베이스(`packages/core`)가 각 라이프사이클 계층을 **어떻게 구현했는지** 대조 분석한다.
> 모든 분석은 현 리포지토리의 소스 코드(`file:line`)에 근거한다.

---

## 0. 출발점: V1 → V2 마이그레이션 중인 런타임

OpenCode의 코어는 현재 두 세대의 런타임이 공존한다.

- **V1 (레거시)**: `packages/core/src/v1/*`. 거대한 `SessionPrompt` 모놀리식 루프. 서브에이전트(`task`), LSP 등 일부 기능이 여기에 남아 있다.
- **V2 (현행)**: `packages/core/src/session/*`, `agent.ts`, `tool/*`, `permission.ts` 등. **Effect 런타임 + Layer 기반 의존성 주입**으로 재작성된 *durable(내구성) 세션 런타임*.

V2의 설계 의도는 `session/runner/llm.ts:37-85` 주석에 명시되어 있다.

```
Keep this as orchestration over smaller collaborators rather than rebuilding
the legacy `SessionPrompt` monolith.
```

즉 가이드라인 문서가 말하는 "단순한 루프 + 명시적 상태 관리"를 OpenCode는 **이벤트 소싱(event sourcing) 기반의 durable 상태머신**으로 구현한다. 이 점이 Claude Code/Copilot CLI의 인메모리 루프와 가장 크게 갈리는 지점이다.

가이드라인 문서는 Sagents·OpenAI Agents SDK·TechAhead 등 여러 프레임워크의 *이상적/블로그적* 모델을 종합한 것이므로, 아래에서는 **실제 코드와 일치하는 부분**과 **OpenCode가 다르게(혹은 아직) 구현한 부분**을 함께 표시한다.

---

## 1. 애플리케이션 계층 – 사용자 인터페이스

가이드라인의 "대화 UI / 연결 계층"에 대응한다.

| 구성요소 | OpenCode 구현 | 위치 |
|---|---|---|
| TUI | Go 기반 터미널 UI | `packages/tui` |
| HTTP/SSE 서버 | Hono 기반 API. 라우트·핸들러·SSE 스트리밍 | `packages/server/src/{api,routes,handlers}.ts` |
| SDK | 외부 클라이언트용 타입 SDK | `packages/sdk/js` |
| 데스크탑/웹/콘솔 | Tauri 데스크탑, 웹 앱, 콘솔 | `packages/{desktop,app,console}` |

- **연결 계층**: 가이드라인이 말한 "JSON-RPC 전송 레이어"에 해당하는 것이 서버의 HTTP + SSE 스트림이다. 서버는 코어의 `EventV2` 이벤트 버스를 SSE로 중계하여, 도구 호출 결과·상태 변경을 클라이언트에 **스트리밍**한다.
- 사용자 입력은 결국 코어의 `SessionV2.prompt(...)` (`session.ts:137`, `:348`) 하나로 수렴한다. UI가 무엇이든 코어 진입점은 단일하다.

> **요약**: 가이드라인의 "UI 표준화" 목표를 OpenCode는 *멀티 서피스(TUI/웹/데스크탑) → 단일 코어 API*로 달성한다.

---

## 2. 리소스/인프라 계층 – 프로세스 감시 및 스코핑

가이드라인은 Sagents의 `ProcessRegistry`/`AgentSupervisor` supervision 트리를 사례로 든다. OpenCode는 **OS 프로세스 단위 supervisor 트리를 두지 않고**, Effect의 `Layer` + `Scope`로 리소스 수명을 관리한다.

### 2.1 Layer 기반 의존성 주입 = 경량 supervision

- 모든 서비스(`Session`, `SessionRunner`, `ToolRegistry`, `PermissionV2`, `Database` …)는 `Context.Service` 로 정의되고 `Layer.effect(...)` 로 조립된다. 예: `agent.ts:74,78`, `session/runner/llm.ts:90`.
- `Effect.addFinalizer` / `Scope` 가 종료 시 정리를 보장한다. 예: 코디네이터 종료 핸들러 `session/run-coordinator.ts:76-83`.

### 2.2 Location 스코핑 = 가이드라인의 "리소스 스코핑"

가이드라인의 `FileSystemSupervisor`(사용자·프로젝트·조직 범위 파일시스템)에 대응하는 것이 **`Location`** 추상이다.

- 세션은 `location: { directory, workspaceID }` 를 가진다 (`session/info.ts:35-39`).
- 실행 라우팅은 세션의 Location → 해당 Location의 서비스 맵으로 이뤄진다. `session/execution/local.ts:18-24`:
  ```ts
  return yield* SessionRunner.Service.use((runner) => runner.run(...))
    .pipe(Effect.provide(locations.get(session.location)))
  ```
- 턴 실행 전 Location 불일치를 검사해 잘못된 워크스페이스에서의 실행을 차단한다. `session/runner/llm.ts:181-182`.

### 2.3 분산/내구성 실행

- 가이드라인의 "분산 확장(Horde Registry)/Temporal 내구성 실행"은 OpenCode에서 **아직 미구현이며 명시적 TODO**다. `session/runner/llm.ts:46-47`:
  ```
  [ ] Replace local ownership with durable multi-node ownership when clustered.
  ```
- 대신 OpenCode는 **이벤트 소싱 + SQLite durable store**(아래 §3)로 *단일 노드 내구성*을 먼저 확보했다. 프로세스가 죽어도 이벤트 로그가 남으므로 재기동 후 재구성이 가능하다.

> **차이점**: Sagents는 OS 프로세스 supervisor로, OpenCode는 *Effect Layer/Scope + Location 스코프 + durable 이벤트 로그* 로 같은 목표(리소스 격리·수명 관리·복구)를 달성한다.

---

## 3. 세션 관리 – 이벤트 소싱 기반 durable 히스토리

가이드라인의 핵심 계층. OpenCode의 가장 차별화된 부분이다.

### 3.1 세션 식별과 메타데이터

- 세션 ID: `ses_` + 해시 (`session.ts`의 `SessionSchema.ID`). 각 대화는 고유 세션.
- 세션 레코드는 `parentID`, `agent`, `model`, `cost`, `tokens`(input/output/reasoning/cache), `location`, `time.{created,updated,archived}` 를 보유 (`session/info.ts:11-46`).
- **`parentID` 의 존재**가 핵심: 서브에이전트는 부모 세션을 가리키는 자식 세션으로 모델링된다 (§8 참조).

### 3.2 저장 백엔드: SQLite + Drizzle + 이벤트 소싱

가이드라인은 "SQLite/Redis/Mongo 등 다양한 세션 구현"을 언급한다. OpenCode는 **SQLite(drizzle-orm) 단일 백엔드 + 이벤트 소싱**으로 통일한다.

- 모든 상태 변화는 `EventV2.publish(...)` 로 **이벤트 로그에 먼저 기록**되고, 프로젝터가 이를 읽기 모델(테이블)로 투영한다.
  - 입력 admission: `SessionInput.admit` → `PromptLifecycle.Admitted` 이벤트 발행 (`session/input.ts:54-94`).
  - 투영: `SessionInput.projectAdmitted`/`projectPromoted` 가 `SessionInputTable` 에 반영 (`session/input.ts:109-175`).
  - 메시지/툴/스텝 이벤트는 `session/event.ts`, 프로젝션은 `session/projector.ts`.
- 이벤트에는 aggregate sequence(`seq`)가 붙어 **순서·멱등성·충돌 감지**를 보장한다. 충돌 시 `LifecycleConflict` 로 die (`session/input.ts:50-52`, `:126`, `:141`).

### 3.3 입력 admission: `steer` vs `queue` (= 가이드라인의 "대화 히스토리/세션 주입")

OpenCode 세션 관리의 백본은 **`SessionInput`** 이다. 사용자/시스템 입력은 즉시 히스토리에 합쳐지지 않고, 두 가지 *delivery* 로 **admit(승인)** 된다 (`session/input.ts:18`).

- **`steer`**: 진행 중인 턴에 *끼어드는* 입력. 다음 안전 경계에서 즉시 promote 된다.
- **`queue`**: 현재 작업이 끝난 뒤 처리할 *대기열* 입력. 한 번에 하나씩 promote.

승인된 입력은 `promoteSteers` / `promoteNextQueued` 로 `Promoted` 이벤트를 발행하며 비로소 모델이 볼 히스토리에 합류한다 (`session/input.ts:300-343`). 이 메커니즘은:

- 가이드라인이 말한 "도구 호출과 결과를 포함한 이전 메시지 내역을 매 호출 시 전달"을 **durable·재현 가능한 방식**으로 구현하고,
- 동시에 §9의 오케스트레이션(다른 세션이 보낸 메시지 주입)의 기반이 된다.

### 3.4 세션 재개 = durable 이벤트 로그의 자연스러운 귀결

가이드라인의 "세션 재개"는 OpenCode에서 **별도 기능이 아니라 구조적 속성**이다. 모든 상태가 이벤트 로그에 있으므로 프로세스 재기동 후 `SessionStore.context(sessionID)` 로 히스토리를 그대로 복원한다 (`session/store.ts`, `session/runner/llm.ts:112-114`).

> **요약 매핑**
> | 가이드라인 | OpenCode 구현 |
> |---|---|
> | 세션 ID | `SessionSchema.ID` (`ses_…`) |
> | 대화 히스토리 | 이벤트 소싱 + `SessionStore.context()` 투영 |
> | 저장 백엔드 | SQLite + drizzle, 이벤트 로그 |
> | 세션 재개 | durable 이벤트 로그로 자동 복원 |
> | 인메모리 캐시/벡터DB/관계형 3계층 | **미채택** — 단일 durable 이벤트 스토어 + 요약(compaction)으로 대체 |

---

## 4. 에이전트 코어 – 도구 호출과 반복 루프

가이드라인의 "단일 에이전트 루프 / 도구 엔진·스케줄러"에 대응. OpenCode의 루프는 `session/runner/llm.ts` 의 `run` (`:373-396`)과 `runTurn`/`runTurnAttempt` (`:175-371`) 에 있다.

### 4.1 이중 루프 구조

```
run(sessionID)                       ← 활동(openActivity) 단위 바깥 루프
 └ for step in 0..MAX_STEPS(25)       ← 모델 스텝 단위 안쪽 루프
     └ runTurn → runTurnAttempt        ← 단일 provider 턴
         └ llm.stream(request)         ← 정확히 1회 provider 호출
             └ tool-call 마다 settle    ← 도구 실행 후 결과 재투입
```

- **바깥 루프** (`:383-395`): `steer`/`queue` 입력이 남아 있는 한 활동을 이어간다. 가이드라인의 "도구 호출 → 결과 피드백 → 반복"의 *durable 버전*.
- **안쪽 루프** (`:385-390`): 한 활동 안에서 모델이 도구를 계속 호출하면(`needsContinuation`) 다음 턴을 시작. **`MAX_STEPS = 25`** 로 무한 루프를 방어 (`:88`, `:391-392` → `StepLimitExceededError`).
- 종료 조건: 도구 호출 없는 텍스트 응답 → `needsContinuation=false` → 루프 종료. (Claude Code의 `nO` 루프와 동일한 철학이나, 여기선 *대기 중 steer 입력*까지 확인 후 종료: `:388`.)

### 4.2 단일 provider 턴 = `runTurnAttempt`

한 턴의 실제 처리 순서 (`:175-339`):

1. 세션·에이전트·모델 해석, Location 일치 검사 (`:180-214`).
2. **Context Epoch 초기화/준비** + 시스템 컨텍스트·스킬·레퍼런스 가이드 로드 (`:170-210`, §6).
3. `steer`/`queue` 입력 promote (`:193-200`).
4. 히스토리 → LLM 메시지 변환 (`toLLMMessages`), **도구 정의 materialize**(권한 필터링, §5) (`:215-227`).
5. 필요 시 **선제 compaction** (`compactIfNeeded`, §6) (`:228-229`).
6. `llm.stream(request)` **단일 스트림** 소비 (`:245-284`):
   - 텍스트/추론/usage/provider-error/tool-call 이벤트를 **증분적으로 durable 기록** (`publish`).
   - `tool-call` 이벤트마다: durable 기록 → `toolMaterialization.settle(...)` 로 **즉시(eager) 실행 시작** → `FiberSet` 에 적재 (`:256-280`).
7. 스트림 종료 후 **모든 도구 파이버 settle 대기** (`awaitToolFibers`, `:137-138`, `:312`).
8. 도구가 하나라도 있었으면 `needsContinuation=true` 반환 → 다음 턴 (`:336`).

### 4.3 도구 스케줄링: eager start + 일괄 await

가이드라인은 Copilot CLI의 "읽기 전용 병렬 / 상태 변경 순차" 정책을 든다. OpenCode V2는 더 단순하게 **모든 로컬 도구를 eager 하게 시작하고(`FiberSet.run`), 턴 경계에서 전부 await** 한다 (`:259-280`, `:312`). 순서·동시성 제약은 개별 도구(leaf)와 권한 계층이 책임진다(§5, `tool/AGENTS.md`).

> **요약**: Claude Code의 인메모리 `nO` 루프 ≈ OpenCode의 `run`/`runTurn`. 단, OpenCode는 *durable 이벤트 기록 + 스텝 한도 + steer 재확인* 을 루프에 내장했다.

---

## 5. 도구와 권한 관리

가이드라인의 "도구 인터페이스 / 권한 시스템 / Hook"에 대응.

### 5.1 도구 인터페이스 (불투명 canonical 값)

- 모든 도구는 `Tool.make({ description, input, output, execute, toModelOutput })` 라는 **단일 불투명 타입**으로 표현된다 (`tool/tool.ts`, 설계 문서 `tool/AGENTS.md`).
- 빌트인 도구: `bash`, `edit`, `apply-patch`, `read`, `write`, `glob`, `grep`, `webfetch`, `websearch`, `skill`, `todowrite`, `question` (`tool/builtins.ts:30-43`).
- **출력 바운딩**: 레지스트리가 모델에 가는 출력 크기를 강제하고, 초과분은 *Managed Tool Output File* 로 분리(`CONTEXT.md` 용어 정의, `tool-output-store.ts`).
- ⚠️ **미포팅 도구**: `task`(서브에이전트), LSP, `repo_clone`, `plan_exit` 등은 V2에 아직 없음 — `tool/builtins.ts:24-28` TODO에 명시.

### 5.2 권한 시스템: ruleset(allow/ask/deny) + 와일드카드

가이드라인의 "위험 명령 확인"을 OpenCode는 **선언적 권한 룰셋**으로 일반화한다.

- 권한 결정 effect는 `allow | deny | ask` 세 가지 (`permission/schema.ts`, `permission.ts:16-17`).
- 평가는 **마지막으로 매칭된 규칙 우선(findLast) + 와일드카드 매칭**, 매칭 없으면 기본 `ask` (`permission.ts:101-110`):
  ```ts
  rulesets.flat().findLast(r => Wildcard.match(action, r.action) && Wildcard.match(resource, r.resource))
    ?? { action, resource: "*", effect: "ask" }
  ```
- **에이전트별 권한**: 각 에이전트가 자신의 `permissions: Ruleset` 를 가진다 (`agent.ts:30`, `config/agent.ts:23`). 누락 시 전체 deny 폴백 (`permission.ts:18`).
- **요청/응답 흐름**: `ask` → `PermissionV2.Event.Asked` 이벤트 발행 → 사용자가 `once|always|reject` 응답 (`permission.ts:50-83`). `reject` 는 `RejectedError`, `deny` 는 `DeniedError`, 수정 요청은 `CorrectedError` (`permission.ts:86-99`).
- **별도의 `Policy` 계층**: 시스템 전역 allow/deny 문장을 와일드카드로 평가하는 상위 정책 (`policy.ts:24-46`).

### 5.3 권한이 도구 materialize에 직접 반영

가이드라인의 "도구 사용 가능 여부 제어"를 OpenCode는 **턴마다 도구 목록을 권한으로 필터링**해 구현한다 (`tool/registry.ts:105-117`):

```ts
materialize(permissions = []) {
  // 권한상 전면 금지된 도구는 레지스트리에서 제거 → 모델에게 정의조차 노출 안 함
  if (whollyDisabled(permission(tool, name), permissions)) registrations.delete(name)
}
```

즉 **금지된 도구는 모델의 tool 정의에서 아예 사라진다.** 이는 가이드라인 오케스트레이션 문서가 강조한 "프롬프트가 아니라 인프라에서 강제"를 정확히 구현한 사례다.

### 5.4 Hook = 플러그인

가이드라인의 RunHooks/AgentHooks에 대응하는 것이 **플러그인 시스템**(`packages/plugin`, `core/src/plugin/*`)이다. 플러그인은 도구·에이전트·스킬을 추가하고 라이프사이클에 개입한다. `opencode.tools.register(...)` 로 애플리케이션 도구를 등록 (`tool/application-tools.ts`, `tool/AGENTS.md`).

---

## 6. 상태 및 메모리 관리 – Context Epoch와 Compaction

가이드라인의 "단기/장기/콜드 3계층 메모리, 92% 컨텍스트 요약"에 대응. OpenCode는 **3계층 메모리 인프라 대신 *Context Epoch + 자동 compaction*** 으로 컨텍스트를 관리한다.

### 6.1 System Context / Context Epoch / Context Snapshot

`CONTEXT.md` 가 정의하는 정교한 모델:

- **System Context**: 모델에 주는 초기 지시 + 시간순 업데이트의 구조화된 집합. 여러 *Context Source*(stable key + JSON codec + 렌더러)로 조립 (`system-context/*`, `system-context/registry.ts`).
- **Context Epoch**: 한 에이전트의 baseline 시스템 컨텍스트가 *불변으로 유지되는 구간*. compaction이나 baseline 교체 시 종료 (`session/context-epoch.ts`).
- **Context Snapshot**: 마지막으로 provider 턴에 admit된 각 source 값의 JSON 스냅샷. 변경 감지에 사용.
- 컨텍스트 변경은 **푸시가 아니라 안전 경계(Safe Provider-Turn Boundary)에서 lazy 하게 샘플링**되어 *Mid-Conversation System Message* 로 한 번에 합쳐진다 (`CONTEXT.md` Relationships).

이는 가이드라인의 "요청별 메모리 주입 / 필요한 기억만 삽입"을 **이벤트 순서 보장과 결합한** 형태다.

### 6.2 Compaction (= 가이드라인의 "92% 요약")

`session/compaction.ts`:

- **트리거**: `compactIfNeeded` 가 매 턴 토큰 추정치를 계산해, `context - max(output, buffer)` 를 초과하면 compaction (`:230-241`). 기본 buffer `20_000` 토큰 (`:12`).
- **오버플로 복구**: provider가 context-overflow로 실패하면 `compactAfterOverflow` 가 사후 요약 후 턴을 재구성 (`:177-229`, 호출부 `runner/llm.ts:291-297`).
- **요약 형식**: 가이드라인이 말한 "Markdown 장기 메모리"를 **고정 템플릿**으로 구현 — `Goal / Constraints / Progress(Done·In Progress·Blocked) / Key Decisions / Next Steps / Critical Context / Relevant Files` (`:16-51`). 이전 요약이 있으면 *anchored summary 업데이트* 방식으로 병합 (`:166-173`).
- **분할 보존**: 최근 `keep.tokens`(기본 8000) 분량은 원문 유지, 그 앞부분만 요약 (`:133-164`).

> **차이점**: 가이드라인의 벡터DB/관계형DB/콜드스토리지 3계층은 OpenCode에 없다. OpenCode는 *단일 durable 이벤트 로그 + 구조화 요약(anchored summary)* 으로 장기 메모리를 대체하며, 영구 프로젝트 메모리는 코드/설정 파일(`AGENTS.md`, `opencode.json`)이 담당한다.

---

## 7. 관측성, 이벤트 및 종료/복구

### 7.1 이벤트 버스 = 관측성의 단일 소스

- `EventV2` 가 모든 도메인 이벤트(세션/툴/스텝/권한/compaction/prompt-lifecycle)를 발행한다. 이벤트는 곧 durable 로그이자 UI 스트림 소스다.
- 서버가 이를 SSE로 중계 → TUI/웹이 실시간 상태 표시. (가이드라인의 Sagents `:status_changed`, Copilot `turn_start/turn_end` 에 대응.)
- 도구 상태: `pending → running → completed | error`. 스텝: `Step.Started/Failed`. (`session/event.ts`, `runner/llm.ts:121-133`, `:302-309`.)

### 7.2 종료(interrupt)와 복구

- **Interrupt**: `SessionV2.interrupt(sessionID)` → 활성 이벤트 seq 기준으로 `execution.interrupt` 호출 (`session.ts:407-418`). 코디네이터가 소유 체인을 fiber interrupt 하고, *interrupt 이전의 advisory wake는 억제* (`run-coordinator.ts:193-217`, `:248-255`).
- **중단된 도구 정리**: 다음 run 진입 시 `failInterruptedTools` 가 `pending/running` 상태로 남은 도구를 `Tool.Failed("interrupted")` 로 마감 (`runner/llm.ts:115-135`, 호출 `:380`). → *유령 도구 상태* 방지.
- **복구**: durable 이벤트 로그 덕분에 프로세스가 죽어도 히스토리는 보존된다. 단, 가이드라인의 "자동 재시도/Temporal 내구성 실행"은 **의도적으로 미채택** — `runner/llm.ts:50` `[ ] Bound provider retries`, `:46` 멀티노드 ownership TODO. (오케스트레이션 문서의 "자동 재시작 회피" 철학과 일치: 비용 폭주·stale task 방지.)

---

## 8. 서브에이전트와 에이전트 정의

가이드라인의 "서브에이전트·핸드오프·오케스트레이션"에 대응. (상세는 [오케스트레이션 분석 문서](./opencode_orchestration_analysis_ko.md) 참조.)

### 8.1 에이전트 모델

- 에이전트는 `AgentV2.Info` 로 정의: `id, model, system, mode, hidden, color, steps, permissions` (`agent.ts:20-44`).
- **`mode: "primary" | "subagent" | "all"`** 가 선택 가능성을 결정한다 (`agent.ts:26`). `selectable()` 은 `subagent` 모드나 `hidden` 에이전트를 사용자 선택 목록에서 제외 (`agent.ts:100-101`).
- 기본 에이전트는 **`build`** (`agent.ts:13`, `:106-107`). 설정으로 `plan` 등 추가 가능 (`config/agent.ts`).

### 8.2 서브에이전트 = 자식 세션

- 서브에이전트 실행은 **`parentID` 를 가진 별도 세션**으로 모델링된다 (`session/info.ts:16`). 독립 세션이므로 자체 컨텍스트 윈도우·권한·모델을 가진다 = 가이드라인의 "독립 context window".
- 그러나 **서브에이전트를 *생성하는* `task` 도구는 V2에 아직 미포팅** (`tool/builtins.ts:24-28` TODO). 따라서 현재 V2 단독으로는 자동 서브에이전트 분기가 제한적이며, 해당 기능은 V1(`v1/session.ts`) 경로에 의존한다.

> **현황 정리**: V2는 *서브에이전트를 받을 그릇*(parentID 세션, subagent 모드, 에이전트별 권한)은 갖췄으나, *분기 트리거*(task 도구)는 마이그레이션 대기 중이다.

---

## 9. 통합 요약 – OpenCode 라이프사이클 Top-Down

| 가이드라인 계층 | OpenCode 구현 | 핵심 위치 |
|---|---|---|
| **애플리케이션** | TUI(Go)·HTTP/SSE 서버(Hono)·SDK·데스크탑/웹, 단일 코어 API `SessionV2.prompt` | `packages/{tui,server,sdk}`, `session.ts:137` |
| **리소스/프로세스 감시** | OS supervisor 대신 *Effect Layer + Scope + Location 스코프*; 멀티노드는 TODO | `*/layer`, `execution/local.ts`, `runner/llm.ts:46` |
| **세션 관리** | 이벤트 소싱 + SQLite(drizzle); `steer`/`queue` 입력 admission; durable 재개 | `session/input.ts`, `session/store.ts`, `session/info.ts` |
| **에이전트 루프** | `run`(활동) → `runTurn`(스텝, MAX_STEPS=25) → `llm.stream` 단일 턴; 도구 eager+await | `session/runner/llm.ts:175-396` |
| **도구·권한** | 불투명 `Tool.make`; ruleset(allow/ask/deny)+와일드카드; **금지 도구는 materialize에서 제거** | `tool/tool.ts`, `permission.ts`, `tool/registry.ts:105` |
| **상태·메모리** | System Context / Context Epoch / Snapshot; 토큰 임계 자동 compaction + anchored summary 템플릿 | `CONTEXT.md`, `context-epoch.ts`, `compaction.ts` |
| **관측성·이벤트** | `EventV2` 단일 이벤트 버스 → durable 로그 + SSE 스트림; 도구/스텝 상태 이벤트 | `event.ts`, `session/event.ts` |
| **종료·복구** | seq 기반 interrupt; `failInterruptedTools`; durable 로그로 재개; **자동 재시도 미채택(의도적)** | `session.ts:407`, `runner/llm.ts:115`, `:50` |
| **서브에이전트** | parentID 자식 세션 + subagent 모드 + 에이전트별 권한; **task 도구는 V2 미포팅** | `agent.ts`, `session/info.ts:16`, `builtins.ts:24` |

---

## 10. 결론

OpenCode의 라이프사이클 관리를 한 문장으로 요약하면 **"이벤트 소싱 기반 durable 세션 런타임 위에, 권한으로 게이트된 단순 반복 루프를 얹은 구조"** 다.

가이드라인 문서가 종합한 일반 모델과 비교하면:

1. **일치**: 단일 코어 진입점, 도구 호출↔결과 반복 루프, 스텝 한도, 권한 게이트, 컨텍스트 요약, 서브에이전트의 독립 컨텍스트, "자동 재시작 회피" 철학.
2. **OpenCode의 고유 강점**:
   - **이벤트 소싱**으로 세션 재개·관측성·복구를 *구조적 부산물*로 얻는다(별도 기능이 아님).
   - **`steer`/`queue` 입력 admission**이 세션 관리와 오케스트레이션을 잇는 단일 백본이다.
   - **권한을 도구 materialize에 직접 반영**해, 금지 도구를 모델에게 노출조차 하지 않는다.
   - **Context Epoch + anchored summary**로 컨텍스트 일관성과 장기 메모리를 동시에 관리한다.
3. **미완/차이**: 멀티노드 durable ownership, provider 재시도 바운딩, **V2의 `task` 서브에이전트 도구**는 아직 마이그레이션 중(코드 내 TODO로 명시). 가이드라인이 묘사한 벡터DB/관계형DB 3계층 메모리는 채택하지 않고 단일 이벤트 로그 + 요약으로 대체했다.

즉 OpenCode는 가이드라인의 "단순한 루프 + 명시적 상태 관리"라는 공통 원칙을, **Effect 기반 durable 이벤트 런타임**이라는 비교적 독자적인 방식으로 밀어붙인 사례다. 디버깅 가능성과 복구 가능성을 *저장 모델 수준*에서 확보한 것이 가장 큰 설계적 베팅이다.

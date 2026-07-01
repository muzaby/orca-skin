# Orca 라이프사이클 · 오케스트레이션 설계 (드래프트)

> **상태**: 📝 드래프트 — 핸드오프(`0050`) 정식화 *이전* 의 설계방향 초안. 확정 전. **엔지니어링 리뷰(2026-06-28, `/plan-eng-review`) 결정 8건 반영** — 표기 `[리뷰 N]`.
> **기준자(yardstick)**: [`lifecycle_management_ko.md`](./lifecycle_management_ko.md) (라이프사이클 8계층) · [`orchestration_report_ko.md`](./orchestration_report_ko.md) (오케스트레이션 7요소).
> **real-world 레퍼런스**: [`study/opencode/`](./study/opencode/) · [`study/hermes-agent/`](./study/hermes-agent/).
> **읽는 법**: 각 절은 **개념론(기준) → opencode 실제 → hermes 실제 → Orca 결정** 순. 표기 `[op]`/`[h]`/`→ Orca`.

---

## 0. 이 문서가 답하는 질문

1. 라이프사이클·오케스트레이션 **개념론**(8계층 + 7요소)에 비추어, opencode·hermes는 real world에서 각 계층을 *어떻게* 지었는가.
2. 개념론이 *다루지 않는* 각 시스템의 **독자 기능**은 무엇이고, 그게 왜 생겼는가.
3. 하네스를 SDK에 위임하는 **Orca**는 그 계층들을 *얼마나 가볍게* 지어야 하는가.

핵심 명제 한 줄: **opencode·hermes 분석 문서가 길었던 8할은 "하네스를 직접 만드느라"이고, Orca는 그 전부를 SDK에서 빌린다 → Orca는 "빌려온 하네스의 여집합"만 설계한다.**

---

## 1. 핵심 렌즈 — 하네스 소유 스펙트럼

세 시스템을 가르는 단 하나의 축: **하네스(agent loop · tool 스케줄 · subagent · compaction)를 누가 소유하는가.**

```
   하네스를 누가 소유하나?

  자체 구축 ◀─────────────────────────────────────────────────▶ 전적 위임
  ┌────────────────────┐   ┌────────────────────┐        ┌────────────────────┐
  │     opencode       │   │    hermes-agent    │        │       Orca         │
  │ Effect 이벤트소싱    │   │ 동기 루프 +         │        │ SDK query() 내부가  │
  │ runtime +           │   │ IterationBudget +   │        │ 곧 하네스           │
  │ run-coordinator     │   │ delegate_task       │        │ (Electron 셸)       │
  └────────────────────┘   └────────────────────┘        └────────────────────┘
   "핵심 복잡도 = 하네스 그 자체"                          "핵심 복잡도 = 여집합"
```

이 한 장이 모든 결정을 지배한다. op·hermes가 공들인 루프·예산·*세션-내* compaction·도구 스케줄은 Orca에서 **설계 대상이 아니다**(SDK가 소유). Orca가 새로 설계할 곳은 그 *바깥*(세션/턴/워크플로 수명)이다 — 단 "바깥"에는 §1.5의 *워크플로 하네스*가 포함된다.

### 소유 경계 (SDK ↔ Orca)

```
┌────────────────────────── SDK ( query() ) 가 소유 ──────────────────────────┐
│  agent loop (tool→result 반복) · step 한도(maxTurns) · tool 실행/스케줄        │
│  subagent(Task) · compaction · context window · hook 런타임 실행              │
│  권한 평가 파이프라인의 마지막 게이트(canUseTool 호출 지점)                     │
└────────────────────────────────────────────────────────────────────────────┘
              ▲ NormalizedEvent (정규화 스트림)      ▲ canUseTool (권한 콜백)
              │                                      │
┌────────────────────────────── Orca 가 소유 ────────────────────────────────┐
│  세션 수명 (DB = SSOT)  ·  턴/핸들 수명  ·  ★ 멀티세션 동시성·격리             │
│  권한 게이트 정책 (PermissionBridge)  ·  영속/복구/관측  ·  UI/연결(IPC)       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 경량 오케스트레이션의 정의 — 2층 하네스

"하네스를 위임"한다고 Orca가 하네스를 *전혀* 안 갖는 건 아니다. **하네스는 2층**이다: SDK는 *턴 하네스*, Orca는 그 위의 *워크플로 하네스*. Orca의 오케스트레이션은 **에이전트 오케스트레이션이 아니라 턴/세션 오케스트레이션**이며, 이것이 "경량"의 정확한 의미다.

```
┌─────────────── Orca 워크플로 하네스 (다중턴 / 다중세션) ───────────────┐
│  · 다중턴 입력 admission (steer / queue) — 한 세션 내                   │
│  · 워크플로 context 전략 — ① /compact 액션(SDK 압축 트리거) ② session handoff │
│  · goal / multi-day — handoff 문서(Status/Decision/Next)로 세션 넘김     │
│  · app 전용 system message 주입                                         │
│  · (확장) 별도 평가 세션 — 본대화 비오염                                │
└────────────────────────────┬────────────────────────────────────────┘
          조율: 여러 query() 턴 / 세션을 "하나의 작업"으로 엮음
                             ▼
┌─────────────── SDK 턴 하네스 ( query() 내부 ) ───────────────┐
│  agent loop · tool 스케줄 · subagent · 세션-내 compaction       │
└──────────────────────────────────────────────────────────────┘
```

**경량인 이유**: Orca는 아래층(루프·도구·subagent·세션-내 compaction)을 *절대 재구현하지 않고*, 그 위에서 **턴/세션을 엮는 얇은 워크플로 층**만 가진다. 따라서 §2의 "compaction 위임"은 *세션-내부* 한정이며, **워크플로-레벨 context 전략(session handoff)은 Orca가 소유**한다(§2 §6 참조).

---

## 2. 라이프사이클 8계층 — real-world 대조 + Orca 결정

### §1 애플리케이션 / 연결 계층

| | 구현 |
|---|---|
| 개념론 | 대화 UI(CLI/IDE/웹) + 전송(transport) 계층이 프롬프트↔이벤트를 중계 |
| `[op]` | TUI·HTTP/SSE·SDK·데스크탑 멀티서피스 → 단일 코어 `SessionV2.prompt`. **SSE 스트림이 전송 계층** |
| `[h]` | CLI·게이트웨이·TUI·ACP·크론 다중 진입점 → 단일 `COMMAND_REGISTRY`. JSON-RPC(tui_gateway/ACP) |
| **→ Orca** | **이미 충족.** 단일 코어 진입 = IPC `chat:send` → `adapter.sendMessage`. 전송 = preload contextBridge(`window.orca`) + **`NormalizedEvent` 스트림이 SSE 대응물**. **결정: 멀티서피스 야망 폐기(데스크탑 단일).** 변경 없음 |

### §2 리소스 / 프로세스 감시 ★Orca 최대 공백

| | 구현 |
|---|---|
| 개념론 | Supervisor 트리로 에이전트 프로세스를 동적 시작·종료, 파일시스템 스코프 분리, inactivity/presence 종료 |
| `[op]` | OS supervisor 대신 Effect `Layer`+`Scope` 수명관리 + `Location` 스코프. 멀티노드는 명시적 TODO |
| `[h]` | `ProcessRegistry`(백그라운드 작업·서브에이전트 수명 추적) + 교체식 6 터미널 백엔드 + Modal/Daytona **동면-깨우기** |
| **→ Orca** | `query()`가 CLI 서브프로세스를 띄우지만 Orca는 그걸 **턴 단위 `TurnRegistry`로만** 추적(턴 끝나면 소멸). **결정①(척추): 세션-스코프 핸들 레지스트리 `SessionRuntimeRegistry: Map<sessionId, LiveSession>`** = hermes `ProcessRegistry` 경량판. **결정②: IdleCloseTimer**(무활동 N분 → 핸들만 닫고 DB 유지, 재진입 시 resume 재오픈; StallTimer 와 분리 — 리뷰 3, **P1·Persistent 전용**) = op `Scope` finalizer / hermes idle-timeout 대응. **결정③: 분산/내구실행 비채택**(데스크탑 단일 — op도 TODO). 리소스 스코핑 = `WorkspaceManager`(cwd/allowed-dirs) + Electron `sandbox:true` |

### §3 세션 관리

| | 구현 |
|---|---|
| 개념론 | 세션 ID 매핑, 도구 호출+결과 포함 히스토리 전달, 저장 백엔드, 세션 재개 |
| `[op]` | 이벤트 소싱 + SQLite. 입력 admission **`steer`/`queue`** = 세션관리·오케스트레이션의 단일 백본. durable resume은 구조적 부산물 |
| `[h]` | 게이트웨이 `SessionStore`(reset: `none/idle/daily/both`, **활성 프로세스 있으면 만료 금지**) + SQLite `SessionDB`(FTS5) + 턴 중간 점진 flush |
| **→ Orca** | **DB=SSOT 이미 채택**(better-sqlite3 + `message_parts` 사실상 event-sourced + FTS5). resume은 컨텍스트용, 출처는 DB. **결정④: 입력 admission `steer`/`queue` 도입** — `createTurnInputStream`의 `queue`+`wake`를 cross-turn으로 살려 `push(msg)` 추가(op `SessionInput` 경량 직역). **결정⑤: hermes "활성 중 만료 금지" 불변식 차용** — idle-close는 `busy`에서 절대 발동 안 함 |

### §4 에이전트 코어 — 루프 ★결정적 분기점

| | 구현 |
|---|---|
| 개념론 | "도구 호출 → 결과 피드백 → 반복" 단일 루프 + 도구 스케줄러 + step 한도 |
| `[op]` | `run`(활동)→`runTurn`(스텝, `MAX_STEPS=25`)→`llm.stream` 단일 턴. 도구 eager+턴경계 await. **루프 직접 소유** |
| `[h]` | 동기 단일 루프 + `IterationBudget`(부모90/서브50) + interrupt/steer + grace call. **루프 직접 소유** |
| **→ Orca** | **루프를 만들지 않는다.** `query()` 내부가 곧 `nO` 루프이고 `MAX_STEPS`/`IterationBudget` 대응물은 SDK `maxTurns`. **결정⑥: Orca의 "코어 루프" = 에이전트 루프가 아니라 *핸들 위 이벤트 소비 + 입력 주입 루프*** (`send.ts`의 `for await … NormalizedEvent`). Orca 코어 복잡도는 루프가 아니라 **핸들 수명 + 입력 admission + 이벤트 정규화**에 산다 |

### §5 도구 / 권한

| | 구현 |
|---|---|
| 개념론 | JSON 인터페이스 도구 + 위험 명령 확인 + Hook |
| `[op]` | 선언적 ruleset(allow/ask/deny)+와일드카드, **금지 도구는 materialize에서 제거**(모델에 정의조차 미노출) |
| `[h]` | 자동발견 레지스트리 + toolset + 다층 승인(hardline/dangerous/YOLO) + 가드레일 |
| **→ Orca** | **대부분 구축됨.** `PermissionBridge` + `canUseTool`의 `RISKY_TOOLS` 게이트 + `disallowedTools` materialize 제거(D1 보류). **결정⑦: "프롬프트 아닌 인프라 강제"** = canUseTool(런타임 게이트) + disallowedTools(정의 제거) 2단. **결정⑧: 강화** = per-tool risk 등급 + `AuditLog`. `AppCommandPolicy`는 OpenCode/slash 도입 전까지 seam |

### §6 상태 / 메모리

| | 구현 |
|---|---|
| 개념론 | 단기/벡터DB/관계형/콜드 3~4계층 메모리 + 80~92% 임계 요약 |
| `[op]` | Context Epoch/Snapshot + 토큰임계 자동 compaction + anchored summary 템플릿. **3계층 비채택** |
| `[h]` | `MemoryManager`(요청별 주입) + 플러그형 장기메모리 + **0.75 임계** 압축 + 스킬 Curator |
| **→ Orca** | **메커니즘/트리거 2층 분리(핵심).** compaction *메커니즘*(자동 임계 + 수동 `/compact`, 요약 실행) → **SDK 소유**(재구현 ✗). compaction *트리거/액션*("언제") → **Orca 소유** = `/compact`를 세션 핸들에 주입(SDK 입력, `slash-commands.md`) + `compact_boundary`(pre_tokens/trigger) 관측. 별도로 *cross-session* context → **session handoff**(요약→새 세션 seed). 3계층은 op·h도 안 씀 → **비채택**. **결정⑨: 메모리 = DB(대화) + 파일 메모리(`CLAUDE.md`/`AGENTS.md`, SDK 로드) + Orca 전용 system message(`buildAppend`, 이미)**. cross-session recall = **이미 있는 FTS5**. **결정⑮: goal/multi-day = session handoff(P1).** **결정⑯: (확장) 본대화 비오염 *별도 평가 세션* seam**(deliberation 경량판). **결정⑱: compaction 액션 = Orca 노출(`/compact` 주입 + `compact_boundary` 정규화), 알고리즘은 SDK.** 압축은 *jsonl(모델 컨텍스트)* 만 줄이고 **Orca DB(SSOT)·검색은 무손실**(⑰ 배당) |

### §7 관측성 / 이벤트 / 종료·복구

| | 구현 |
|---|---|
| 개념론 | 상태 이벤트(idle/running/error) 브로드캐스트, 턴 경계 이벤트, 종료·복구·세션재개 |
| `[op]` | `EventV2` 단일 durable 버스 → SSE. seq 기반 interrupt + `failInterruptedTools` + **자동 재시도 의도적 미채택** |
| `[h]` | `HookRegistry`(agent:start/step/end) + observability 플러그인 + 단계적 teardown + 점진 DB 영속 |
| **→ Orca** | `NormalizedEvent`가 이미 단일 버스. 공백 = 상태 이벤트 + 복구. **결정⑩: 세션 상태머신 도입**(§4 다이어그램). **결정⑪: `failInterruptedTools` 대응** — resume 시 `tool_call`만 있고 `tool_result` 없는 dangling part를 "interrupted"로 마감(현재 없음). **결정⑫: 자동 재시작 없음**(op·h 완전 수렴 — runaway 비용 방지) |

### §8 서브에이전트 / 협력

| | 구현 |
|---|---|
| 개념론 | 독립 context window, 도구·권한 격리, handoff, 오케스트레이터 |
| `[op]` | `parentID` 자식 세션 + subagent 모드 + per-agent 권한. **단 `task` 도구는 V2 미포팅**(그릇만) |
| `[h]` | `delegate_task`(동기/비동기 background + auto-wake 재주입) + role 격리(leaf/orchestrator) + ACP 이종 vendor + Kanban/Cron durable 협업 |
| **→ Orca** | **세션 내부 subagent를 SDK에 전적 위임** — 코드상 이미 SDK Task subagent를 *렌더만* 함(자체 delegate 머신 없음). **결정⑬: hermes `delegate_task`·Kanban·message-bus 같은 *멀티에이전트* 오케스트레이션을 만들지 않는다**(경량 베팅 핵심). **결정⑭: Orca 오케스트레이션 스코프 = 세션 간 동시성 + 다중턴/세션 *워크플로* 하네스(§1.5)**. 즉 multi-*agent*는 비채택이되 multi-*turn/session*은 채택. cross-session lead/worker(에이전트 협업)는 opencode식 **bottom-up 연기** |

---

## 3. 오케스트레이션 7요소 — 압축 매핑

대부분 §1–§8에서 흡수. 결론만:

| 오케스트레이션 요소 | Orca 처리 |
|---|---|
| 1. 리드/하네스 | **SDK가 하네스**, Orca는 셸 (§4) |
| 2. 메시지 버스 | 세션 내부 불필요(단일 세션). cross-session 버스 **연기** (§8) |
| 3. 실행/동시성 | 세션-스코프 핸들 레지스트리 + per-session AbortController + 상태머신 = **op `run-coordinator` 경량판**. "키당 1 drain"은 이미 `TurnRegistry`가 세션당 1 inflight로 강제 |
| 4. subagent 격리 | SDK 위임 + SDK agents per-agent 권한 (§8) |
| 5. deliberation/consensus | **비채택** — op·h도 코어 미내장 (§8) |
| 6. 메모리/handoff | DB + 파일 메모리 + FTS5 + **워크플로 context 전략(session handoff = goal/multi-day)** (§6) |
| 7. 권한/샌드박스 | canUseTool + disallowedTools + Electron sandbox + WorkspaceManager (§5) |

> **이중 저장 입장(의도적 분리, 결정⑰)**: SDK jsonl과 Orca sqlite는 중복이 아니라 *두 소비자를 위한 두 메모리*다 — **jsonl = SDK `resume` 컨텍스트 재구성용**(Orca가 SSOT로 읽지 않음), **sqlite = Orca SSOT**(UI 렌더·FTS5·cross-session). 통합하지 않는다. 경계 선언: *표시·검색의 진실 = DB, SDK 컨텍스트 연속성의 진실 = jsonl.*

---

## 4. 개념론이 다루지 않는 독자 기능

개념론(8계층/7요소)은 *공통 골격* 만 다룬다. 아래는 각 시스템이 그 위에 **독자적으로 얹은** 기능 — 그리고 Orca가 빌리는지/버리는지.

### 4.1 opencode 독자 기능

| 독자 기능 | 무엇인가 | 왜 생겼나 | Orca |
|---|---|---|---|
| **이벤트 소싱 durable runtime** | 모든 상태변화를 이벤트 로그에 먼저 기록 → 세션재개·관측·복구가 *기능*이 아니라 저장모델의 **구조적 부산물** | 단일노드 내구성을 저장모델 수준에서 확보 | **부분 차용** — DB SSOT + `message_parts`로 유사 효과(완전 이벤트소싱은 과함) |
| **`run-coordinator`** | 세션 키당 1 drain 체인, `run`/`wake`/`interrupt`를 coalesce, **seq fencing**으로 stale 거부. fire-and-forget+auto-wake의 실체 | 멀티세션 동시성·중복 wake·중단 정합을 한 상태머신으로 | **경량 차용** — 세션당 1 inflight(이미 `TurnRegistry`) + 핸들 레지스트리. coalescing/seq-fencing 정교함은 필요 시만 |
| **입력 admission `steer`/`queue`** | 진행 턴에 끼어드는 `steer` vs 종료 후 처리 `queue`. 세션관리↔오케스트레이션의 **단일 백본** | 동기 히스토리 합류를 durable·재현가능하게 | **차용(핵심)** — streaming-input generator `push`로 직역 |
| **권한 materialize 제거** | 금지 도구를 모델 tool 정의에서 **삭제**(숨김+차단 동시) | "프롬프트 아닌 인프라 강제" | **차용 예정** — `disallowedTools` 는 **D1 보류(미구현, sendMessage 경로에 미주입)**. 현 강제수단 = canUseTool(런타임 게이트) 1단뿐 [리뷰 4] |
| **Context Epoch + anchored summary** | 컨텍스트 변화를 안전 경계에서 lazy 반영 + 고정 템플릿 요약 병합 | 장기 작업 중 컨텍스트 일관성 | **비채택** — compaction은 SDK 위임 |

### 4.2 hermes-agent 독자 기능

| 독자 기능 | 무엇인가 | 왜 생겼나 | Orca |
|---|---|---|---|
| **`IterationBudget` 일급화** | 부모90/서브50 독립 예산 + `execute_code` 환불 + **grace call**(예산 소진 후 마지막 1회) | 개념론이 "개발자 구현 사항"으로 남긴 예산을 코어로 | **비채택** — 반복 한도는 SDK `maxTurns` 위임(필요 시 앱-레벨 캡 P1) |
| **동기 루프 위 interrupt/steer** | 단순 루프의 디버깅 용이성 유지하며 실시간 재지향 | 멀티턴 제어를 단순 루프에서 | **차용(개념)** — 단 Orca는 루프 비소유라 *핸들* 위 interrupt/steer로 구현 |
| **닫힌 학습 루프 + Curator** | 스킬을 에이전트가 *생성→사용→보관* 수명 대상으로. `active/stale/archived` 자동전이, **"절대 삭제 안 함"** 불변식 | self-improving 제품 정체성 | **비채택** — Orca 제품 범위 밖 |
| **교체식 6 터미널 백엔드 + serverless 동면-깨우기** | local/Docker/SSH/Singularity/Modal/Daytona. 유휴 동면, 요청 시 깨움 | 실행환경 격리·확장을 인프라로 | **비채택** — 데스크탑 로컬 실행(WorkspaceManager+sandbox로 충분) |
| **다층 승인(hardline/dangerous/YOLO)** | 절대차단 / 승인요청 / 세션 신뢰 자동승인 3층 | 위험 명령 세분 제어 | **부분 차용** — PermissionBridge + canUseTool(이미). 등급 세분은 P1(결정⑧) |
| **용량초과 시 큐잉 아닌 즉시 거부** | 비동기 위임 capacity 초과를 *거부* (runaway 누적 방지) | 백프레셔를 거부로 대체 | **간접 차용** — 세션당 1 inflight가 같은 효과 |
| **ACP 이종 vendor 오케스트레이션 + Kanban/Cron** | Codex 등 외부 에이전트를 worker로, durable 작업 큐 | cross-tool·세션 넘는 협업 | **연기** — cross-session 오케스트레이션 범위 |
| **role 격리(leaf/orchestrator)** | leaf는 조정/메모리 도구 호출 불가, `_strip_blocked_tools`로 toolset에서 제거 | 조정 채널 오염 차단 | **위임** — SDK subagent 권한이 담당 |

### 4.3 한눈 요약

```
op·hermes 독자 기능의 대다수 = "하네스를 직접 만들기 때문에 필요한 것"
                                    │
                       Orca는 하네스를 위임 → 대부분 불필요
                                    │
        ┌───────────────────────────┼───────────────────────────┐
   차용(경량판)                  비채택                        연기
   ───────────                  ──────                        ────
   steer/queue (op)             IterationBudget (h)           ACP/Kanban/Cron (h)
   run-coord→세션당1inflight     Context Epoch/compaction (op)  cross-session 버스 (op/h)
   materialize 제거→disallowed   Curator/닫힌학습 (h)           deliberation/consensus
   다층승인→PermissionBridge      교체식 백엔드/serverless (h)
```

---

## 5. Orca 경량 설계 방향

### 5.1 단 하나의 신규 구조물 — SessionRuntime

이 재설계의 신규 구조물은 **세션-스코프 SessionRuntime + 상태머신 + 핸들 레지스트리** 하나다. 나머지는 *이미 구축*(§1,§3,§5,§6)이거나 *SDK 위임*(§4,§6,§8)이다.

### 5.2 핸들 수명 — 턴-스코프 → 세션-스코프 (척추)

```
[현재] 턴-스코프 핸들
  turn1: query() ─ live handle ─ result ─ close() ✕핸들 소멸
  turn2: query() ─ live handle ─ result ─ close() ✕
   ↳ steer / queue / cross-turn interrupt  불가

[목표] 세션-스코프 long-lived 핸들
  세션 open: query() ─ live handle ───────────────────────────── … ── close()(idle)
                         │ turn1 │   │ turn2 │   │ push(steer/queue) │
   ↳ 핸들이 턴 경계를 넘어 생존 → steer · queue · interrupt 전부 열림
   ↳ 비용: 열린 세션 수만큼 살아있는 서브프로세스 → idle-close 정책으로 관리
```

> 코드 현실: `streaming-input.ts`에 `queue`+`wake` 플럼빙이 *이미* 있고, `interrupt`/`setPermissionMode`도 *이미* 핸들에 위임됨. 빠진 건 **수명**(턴→세션) 하나.

### 5.2.1 두 입력 모드 = 한 메커니즘 + close 정책 (결정⑳)

"싱글턴 / 스트리밍 둘 다 지원"은 *다른 메커니즘 2개*가 아니라 **streaming-input 메커니즘 1개 + close 정책 2종**이다. 현재 채팅 경로는 *이미* streaming-input(`prompt: AsyncIterable`)을 쓰고, `claude.ts:335`의 `if (msg.type === 'result') input.close()` 한 줄이 "싱글턴처럼" 닫을 뿐이다.

```
SessionRuntime (핸들 소유 — 소비 인터페이스 모드-무관)
  send(): AsyncIterable<NormalizedEvent> · interrupt() · setMode() · close()
   ├─ OneShot   : query() 새 핸들/턴, result 도착 시 close   (= 현재 코드)
   └─ Persistent: 핸들 1개 레지스트리 보관, send()=generator push, idle/explicit close
```

- **모드 의존 계층 = 핸들 수명(close 정책 + 레지스트리) 하나뿐.** 소비자(`send.ts`)·`claude-map`·persist·PermissionBridge·telemetry는 NormalizedEvent만 소비 → **모드 무관**(Persistent 추가가 이들을 안 건드림).
- OneShot = "Persistent + close-on-result"의 퇴화형 → **SessionRuntime 1개를 close 정책으로 파라미터화**하면 둘 다 지원.
- **모드 선택**: capability 게이트(streaming 미지원 백엔드 → OneShot 강제) + config/세션 단위. 워크플로 하네스(steer/queue·`/compact`) 필요 시 Persistent.
- **혼동 금지**: `runCompletion`의 literal `prompt: string`(single-message)은 hook·interrupt·image를 잃는 *별개* 모드 — 비채팅 one-off(제목생성) 전용으로만 잔존. 채팅 "두 모드"는 **둘 다 AsyncIterable**.

> **[리뷰 1·7] SDK 계약 검증 + P0=OneShot 단일 구현.** "result 후 push 로 세션 유지"는 미증명 로컬 추상이 아니라 SDK 의 *문서화된 기본 권장 모드*다 — `docs/spec/claude/agent-sdk/streaming-vs-single-mode.md` 가 "장기 실행 프로세스 · Queue Message · Interrupt · **Session stays alive** · 여러 턴 컨텍스트 지속"을 공식 보장. Persistent 를 척추로 두는 것은 정당. **단 P0 는 OneShot 단일 구현으로 출시**하고, 이 절의 인터페이스(① `send(): AsyncIterable<NormalizedEvent>` ② close 정책 파라미터 ③ 모드무관 소비자 ④ `interrupt`/`push`/`setMode` 시그니처 예약)를 **P1 에서 Persistent 가 *소비자 0수정* pure-addition 으로 들어오도록** 미리 고정하는 것을 P0 수용 기준에 박는다. ⚠ `maxTurns` 는 스트리밍 세션 *전체*에 걸리는 run 바운드(공식 예제 `maxTurns:10`)이므로, persistent 세션(P1)은 **per-turn step 한도를 잃는다** → 필요 시 앱-레벨 per-turn 캡(P1, §6-9).

### 5.3 세션 상태머신

```
            ┌─────────────────────────────────────────────┐
            │                                             │
  cold ──prompt──▶ live(idle) ──turn──▶ busy ──result──▶ live(idle)
   ▲                  │                  │  │
   │                  │                  │  └─interrupt─▶ interrupting ─▶ live(idle)
   │                  │                  └─ StallTimer(무이벤트 N초)→turn abort→error/idle
   │                  │
   │                  └─ IdleCloseTimer(live-idle N분, P1) ─▶ closed (busy 중 미발동 ⑤)
   │                                                            │
   │                    closed (핸들 폐기, DB 유지) ──reopen(resume)──▶ live
   │
   └─ 부팅/크래시: 모든 세션 cold + DB dangling tool part 마감(failInterruptedTools)
                    · 어떤 상태든 fatal → error
```

- **Coarse 상태**(`cold/live/busy/interrupting/error/closed`)만 명시 머신으로 — UI·복구가 보는 단순 상태(op two-level의 coarse 층).
- **[리뷰 2] 상태 SSOT = SessionRuntime 단일 소유, 비영속**(부팅 시 무조건 `cold` 재구축 — DB 에 status 컬럼 두지 않음). `InflightTurn` 의 `cancelled/timedOut/live` 는 이 상태의 *파생*으로 정리한다 — 별도 SSOT(상태머신 객체 + 플래그 둘) 를 두면 "머신은 busy 인데 핸들은 null" drift 가 난다.
- **Fine 상태**는 `NormalizedEvent` 스트림에서 *파생*(별도 머신 없음 — op 대비 경량화).
- **[리뷰 3] 두 타이머 명시 분리**: **StallTimer**(busy 중 무이벤트 → turn abort, 현 `IDLE_TIMEOUT_MS`(send.ts) 개칭) vs **IdleCloseTimer**(live-idle 중 핸들 회수, P1·Persistent 전용). 트리거 조건이 정반대(busy 중 vs busy 아님)이므로 같은 'idle' 로 합치면 *작업 중 핸들을 닫는* 버그 클래스가 열린다.
- **입력 admission**: `steer`(interrupt+push) / `queue`(push, 현 턴 후) — §3 결정④. (UX 는 P1·Persistent 전용)

### 5.4 14개 결정 요약

| # | 결정 | 계층 |
|---|---|---|
| ① | 세션-스코프 핸들 레지스트리(`SessionRuntimeRegistry`) | §2 |
| ② | **IdleCloseTimer**(live-idle 핸들 회수) — StallTimer 와 분리(리뷰 3), **P1·Persistent 전용**. ✅ 실구현 0054(`lifecycle/timers.ts:createIdleCloseTimer`, RuntimePool 소유, 게이트 OFF=비발동) | §2 |
| ③ | 분산/내구실행 비채택 | §2 |
| ④ | 입력 admission `steer`/`queue` 도입 | §3 |
| ⑤ | "활성 중 만료 금지" 불변식 | §3 |
| ⑥ | 루프 비소유 — 코어 = 이벤트 소비+입력 주입 루프 | §4 |
| ⑦ | 권한 = canUseTool(**현행 1단**) + disallowedTools(**D1 보류·미구현**) 2단(목표) — 리뷰 4 | §5 |
| ⑧ | per-tool risk 등급 + AuditLog | §5 |
| ⑨ | 메모리 = DB + 파일 메모리 + Orca system message. **세션-내 compaction=SDK / 워크플로 context=Orca**. 3계층 비채택 | §6 |
| ⑩ | 세션 상태머신 도입 — **SessionRuntime 단일 소유·비영속, InflightTurn 은 파생**(리뷰 2) | §7 |
| ⑪ | resume 시 dangling tool 마감(failInterruptedTools) | §7 |
| ⑫ | 자동 재시작 없음 | §7 |
| ⑬ | 자체 *멀티에이전트* delegate/Kanban/message-bus 비구현 | §8 |
| ⑭ | 오케스트레이션 스코프 = **다중턴/세션 워크플로(handoff)만** — *세션 간 동시성*은 §2 자원/프로세스 라이프사이클로 귀속(cap/LRU/idle-close 가 세는 유닛 = SessionRuntime; §A 정제 2026-06-29). 0051 의 출시 `orchestration/` 코드명 유지 결정은 0061 에서 `lifecycle/concurrency.ts` fold 로 해소했고, `orchestration/` 이름은 Future handoff/fork/continuity 서비스용으로 예약한다. | §1.5 §8 §A |
| ⑮ | goal/multi-day = session handoff (P1) | §6 |
| ⑯ | (확장) 본대화 비오염 별도 평가 세션 seam | §6 |
| ⑰ | 이중 저장 의도적 분리 (jsonl=SDK resume / sqlite=SSOT) | §3 |
| ⑱ | **compaction 액션 = Orca 트리거(`/compact` 주입 + `compact_boundary` 정규화) / 알고리즘=SDK** | §6 |
| ⑲ | **context 액션(`/compact`·handoff)은 사용자 선택(user-gated)** — Orca는 soft 임계에서 *추천만* surface(ApprovalCard 재사용), 실행은 사용자 클릭. 자동 실행 없음 → SDK 자동 압축이 유일 자동 경로(충돌 회피) | §6 |
| ⑳ | **OneShot·Persistent 입력 모드 둘 다 지원 = streaming-input 메커니즘 1개 + close 정책 2종.** SessionRuntime을 close 정책으로 파라미터화. 모드 선택 = capability+config. literal string 모드는 비채팅 one-off 전용. **[리뷰 1] P0 는 OneShot 단일 구현 출시 / Persistent 는 P1**(인터페이스만 P0 고정, 모드무관 소비자 계약) | §5.2.1 |

### 5.5 시퀀싱

> **[리뷰 1] 재분할.** Persistent 머신(long-lived 핸들·cross-turn 수명·IdleCloseTimer·핸들 cap)은 그것을 정당화하는 steer/queue UX 와 함께 **P1 로 이동**. P0 는 *고가치 견고성*(상태머신·dangling 복구)과 *인터페이스 고정*에 집중한다(Beck: make the change easy, then make the easy change).

| 우선순위 | 항목 |
|---|---|
| **P0** | **SessionRuntime 인터페이스 + OneShot 단일 구현**(close 정책 파라미터·모드무관 소비자·`interrupt`/`push`/`setMode` 시그니처 예약 → Persistent P1 pure-addition 보장, ⑳·리뷰 1) + 핸들 레지스트리(**축출 훅 예약**, 리뷰 6) + 세션 상태머신(**SessionRuntime 단일 소유·비영속**, ⑩·리뷰 2) + **StallTimer 개칭**(IDLE_TIMEOUT_MS, 리뷰 3) + resume/부팅 시 dangling tool 마감(⑪) + **P0 테스트 4종**(상태머신 전이·dangling 마감·모드불변(⑳)·StallTimer 회귀 — 리뷰 5) |
| **P1** | **Persistent 핸들 구현 + cross-turn 수명 + IdleCloseTimer + 핸들 cap·LRU 축출**(②⑥·리뷰 6) + 입력 admission `steer`/`queue` UX(Persistent 전용, ④) + 멀티세션 동시 라이브 핸들·동시성 정책 + **compaction 액션(`/compact` 주입 + `compact_boundary`→`context.compacted` NormalizedEvent 신규 매핑) + user-gated 추천(⑲)** + **goal/multi-day = session handoff(메커니즘만, 영속 1급화는 Future)** + AuditLog + per-tool risk + **이벤트 ordering/seq·backpressure·렌더러 재연결·Windows 프로세스-트리 정리·maxTurns per-turn 캡**(외부 리뷰 잔여, §6) |
| **연기 / Future** | **resume cold-fallback(DB 이력 재구성 — 현행은 "이 대화는 이어할 수 없습니다" 에러 종료, 리뷰 8)** · goal 영속 1급화(#4) · cross-session *멀티에이전트* 오케스트레이션/message-bus · deliberation/consensus · 별도 평가 세션(seam만) · OpenCode 어댑터 |

---

## 6. 미해결 / 확인 필요

1. ~~입력 admission UX 깊이~~ **✅ 결정(리뷰 1): P0 는 OneShot 단일 구현 — steer/queue UX 와 Persistent 는 모두 P1.** P0 인터페이스가 Persistent pure-addition 을 보장하도록 설계만 고정한다(⑳, §5.2.1).
2. ~~멀티세션 동시 라이브 핸들 상한~~ **✅ 결정(리뷰 6): cap + LRU 축출.** P0 SessionRuntimeRegistry 인터페이스에 축출 훅만 예약(미사용 시 비용 0), P1 에서 한도 초과 시 가장 오래된 live-idle 핸들부터 close(busy 미축출 — ⑤). idle-close 단독으로는 활발한 N세션 동시 사용 시 서브프로세스 폭증을 못 막음.
3. ~~context 액션 트리거 정책~~ **✅ 결정(⑲): 사용자 선택(user-gated).** Orca는 soft 임계에서 추천만 surface, 실행은 사용자. 잔여 세부: (a) soft 임계 수치, (b) handoff 요약 생성 주체(메인 세션 1턴 vs 별도 평가 세션 ⑯), (c) 추천 surface를 ApprovalCard로 재사용할지 전용 UI로 둘지.
4. ~~goal 영속 모델~~ **✅ 결정: Future Scope.** goal/multi-day(⑮)의 DB 1급화는 미루고, 당장은 session handoff 메커니즘(요약→새 세션)만 P1 후보로 둔다.
5. **별도 평가 세션 ⑯ 범위**: seam만 둘지(연기), 아니면 첫 소비자(예: 자동 제목·요약·handoff 생성)를 함께 정의할지.
6. **AuditLog fail-closed**: state-changing 액션의 감사 실패 시 차단할지(보안) 경고만 할지.
7. ~~resume 무효화 정책~~ **✅ 결정(리뷰 8): 현행 = resume 실패 시 "이 대화는 이어할 수 없습니다" 에러 종료.** SDK jsonl 부재/손상(예: `~/.claude` 삭제) 시 DB 이력으로 컨텍스트를 재구성하는 cold-fallback 은 **Future Scope**. ("DB SSOT vs jsonl 연속성"(⑰)의 무효화/화해 규칙은 그때 정의.)
8. ~~disallowedTools 상태~~ **✅ 결정(리뷰 4): 미구현(D1 보류)로 문서 통일.** 현 강제수단은 canUseTool(런타임 게이트) 1단뿐 — §4.1 "이미" 표기 정정 완료. 구현 여부는 별도 결정(D1 이 의도적 보류).
9. **maxTurns per-turn 캡(리뷰 7 설계노트, P1)**: `maxTurns` 는 스트리밍 세션 *전체*에 걸리는 run 바운드라, persistent 세션(P1)은 per-turn step 한도를 잃는다 — 앱-레벨 per-turn 캡 도입 여부를 P1 에서 결정.
10. **외부 리뷰(codex) 잔여 P1 항목**: 이벤트 ordering/seq-id + dedupe(신뢰가능 recovery 전제) · backpressure 바운드 버퍼 · 렌더러 재연결(롱러닝 턴이 원 렌더러 생존 비의존 — 현 `onOwnerGone` 은 abort만) · Windows 프로세스-트리 정리 · interrupt 부분결과 마킹 보장 · `/compact` 가 control 채널인지 검증(아니면 "인프라로 위장한 제품 동작") · session handoff provenance/"context vs instruction" 구분.

---

## A. 용어·2축 정제 (라이브 세션 2026-06-29 — 0051)

> 본 절은 §1~§6 *위에 얹는* 정제다. 발단: "'세션'이 두 가지(Orca 가 관리하는 대화 vs SDK 가 관리하는 실행 컨텍스트)를 뭉쳐 가리킨다" → 용어를 가르면 결정 ⑭ 의 *동시성=오케스트레이션* 분류가 닫힌다. (핸드오프 정본 `docs/handoff/0051-lifecycle-taxonomy-refinement/`.)

### A.1 엔티티 3분리 (포함관계)

`Session` 한 단어가 세 개념을 뭉쳤다. 분리한다(정의는 `GLOSSARY.md` §1 정본):

```
Orca Session  ── 대화 기록의 진실(DB = 궁극 SSOT). 영속·무자원. CRUD 단위("새 대화").
  └ SessionRuntime  ── Orca Session 실행용 일시적 핸들. 휘발·유자원(서브프로세스). 상태 SSOT.
      └ SDK resume context  ── SDK query/resume 외부 binding(jsonl). 손실적·발산 가능. 진실 아님.
```

- **카디널리티**: Orca Session : SessionRuntime = **1:N**(open→idle-close→reopen). Session : SDK context 는 같은 id 를 공유하나 compaction 으로 *내용*이 발산(결정 ⑰).
- **진실의 한정**: DB 는 *대화 기록*의 진실이다. *라이브 모델이 조건화하는 컨텍스트*의 진실은 **SDK resume context** 이며 Orca 가 무손실 재현하지 못한다 → resume 실패 시 DB 기반 이어가기는 **reseed/bootstrap(복구 아님)**.

### A.2 결정 ⑭ 교정 — 동시성은 오케스트레이션이 아니다

cap/LRU/idle-close/registry 가 *세는 유닛*은 **SessionRuntime**(자원)이지 Orca Session(무자원 DB 행)이 아니다. 따라서 "세션 간 동시성"은 **§2 리소스/프로세스 라이프사이클**이지 오케스트레이션이 아니다. §2(결정 ①②)와 §3 element3·결정 ⑭ 가 같은 레지스트리를 *이중 청구*하던 봉합선을 닫는다.

- **오케스트레이션에 남는 것** = "Orca Session 을 가로질러 *인과적으로 엮기*" = **handoff** 뿐(워크플로 하네스 §1.5). 자원/프로세스로 환원 안 되는 유일 층.
- 판별식: **없으면 *리소스가 샌다* → 라이프사이클 / 없으면 *작업이 안 엮인다* → 오케스트레이션.**
- **코드명 분기 해소(0061)**: 0051 결정 2 로 일시 유지하던 `orchestration/concurrency.ts` 는 `lifecycle/concurrency.ts` 로 접었다. `ConcurrencyRegistry` 는 프로젝트별 active turn 회계이며, runtime cap/LRU 가 세는 active+idle SessionRuntime population 과 섞지 않는다. `orchestration/` 이름은 현재 코드에 두지 않고, Future handoff/fork/continuity 같은 진짜 오케스트레이션 서비스가 착지할 때 재생성한다.

### A.3 두 축 모델 — 세로(소유/라이프사이클) + 가로(턴 파이프라인)

§1~§5 는 *세로축*(누가 무엇을 소유)만 그렸다. 실제 가장 빈번한 경로는 *가로축*(턴 실행)이고, 이를 구동하는 **TurnCoordinator**(현 `InflightTurn`/`send.ts`)가 1급으로 빠져 있었다.

**세로축(유닛)**: App Lifecycle(앱) · Session/Event Store(Orca Session) · Runtime **Supervisor**/Registry(SessionRuntime 집합: cap/LRU/busy 보호) · **TurnCoordinator**(턴) · SessionRuntime(단일 실행·상태 SSOT·timers·admission) · SDK Adapter(정규화·canUseTool bridge) · SDK(loop/tool/subagent/compaction, 위임).

**가로축(파이프라인)** — 선형 사슬이 아니라 stream→reduce→2 sink + 권한 재진입:

```
입력 →admission →acquire →SessionRuntime.send →Adapter.query ─(SDK)─▶ event stream
   → normalize(Adapter) → reduce(TurnCoordinator: 델타 누적, settled parts만 commit)
        ├─▶ persist (Store, main-side · renderer 생존 무관)
        └─▶ forward (renderer, best-effort fan-out)
   ⟲ 권한: SDK canUseTool ──콜백 위로──▶ TurnCoordinator/PermissionBridge → renderer 승인 → 복귀
            (파이프라인 "단계"가 아니라 query 를 멈춰 세우는 재진입 IoC)
   terminal(result→telemetry): busy→idle 전이 + close 정책 트리거
```

교정점: ① **TurnCoordinator 1급화**(양축). ② **권한 = 재진입 콜백**(단계 아님). ③ **persist ∥ forward = 병렬 독립 sink**(순차 아님), **persist 는 renderer 비의존**. ④ "EventStore append" 과장 주의 — 델타는 비영속, **settled parts 만 commit**(리듀서 = Coordinator). ⑤ **dangling tool 마감은 P0(이미 구현, `{reason:'aborted'}`)**.

> **코드 안착(handoff)**: TurnCoordinator = `lifecycle/turn-coordinator.ts`(handoff 0052). Runtime **Supervisor**(세로축 unit #3) = `lifecycle/supervisor.ts`(handoff 0053 척추: SessionRuntimeRegistry 소유 + 단일 멱등 `release`/`abortTurn` — `abortTurn` 은 0054 에서 `lifecycle/abort.ts` 로 분리). 0054 가 그 위에 **Persistent 거버넌스**를 더했다: `lifecycle/runtime-pool.ts`(idle 핸들 보존/IdleCloseTimer 회수) + Supervisor `acquireRuntime`/`releaseRuntime`(turn teardown≠runtime close). 0055 가 cap/LRU eviction 정책 seam 과 `ConcurrencyRegistry` Supervisor 소유를 안착했고, 0061 이 프로젝트별 active turn 회계 모듈을 `lifecycle/concurrency.ts` 로 접어 이름 분기를 해소했다. SessionRuntime = `lifecycle/session-runtime.ts`(close-policy 파라미터: OneShot 기본 / Persistent 게이트, 0050→0054).

### A.4 Conversation Continuity / Knowledge Curation (Future 서비스 층)

handoff·fork·DB reseed·대화 종료/archive 시 평가·요약 → **Orca 전용 knowledge artifact / KB entry**(특정 `memory.md` 파일 아님; SDK 로 생성하되 SDK context/SDK memory file 갱신 아님). 이 Future 서비스가 코드로 착지할 때 `src/main/orchestration/` 이름을 재생성한다. 불변식:

- **Runtime close ≠ Conversation close** — IdleClose/LRU 가 핸들을 닫아도 대화는 안 끝난다. knowledge export 는 *conversation close/archive hook*(자원 close 아님).
- **1 Orca Session : ≤1 user-facing SessionRuntime.** 평가·요약은 원 세션 visible runtime 을 오염시키지 않고 **별도 internal evaluation session**(ownerless system runtime, `runCompletion` 류 — 결정 ⑯ 별도 평가 세션)에서 실행. 이 평가 런타임의 **cap 회계 포함 여부는 P1 경계 결정**(Future 기능이나 P1 Supervisor 에 영향).
- 구조적 위치 = 수동 storage 층이 아니라 **Store + Runtime 위 서비스/정책 층**(실행을 요구).

### A.5 Staging (P0 출시분 / P1 / Future)

| 단계 | 항목 |
|---|---|
| **P0 (0050 출시)** | 3엔티티 개념 분리 · OneShot SessionRuntime · 상태 SSOT · StallTimer 분리 · **dangling 마감(DB-only)** · PermissionBridge/canUseTool(승인 = P0 의 제약된 mid-turn 입력 채널) |
| **P1** | ~~TurnCoordinator 1급화~~(✅ 0052) · ~~Runtime Supervisor 척추(소유자 추출 + idempotent close/abort 단일 경로)~~(✅ 0053) · ~~Persistent runtime(close-policy 핸들) + IdleCloseTimer 실구현 + Supervisor 거버넌스(acquire/release, 게이트 OFF=OneShot)~~(✅ 0054) · ~~Supervisor cap/LRU(self-idle vs LRU eviction 합류) + ConcurrencyRegistry 소유 이관~~(✅ 0055) · ~~`orchestration/concurrency` 이름 분기 해소~~(✅ 0061) · steer/queue admission(일반 mid-turn 입력) |
| **Future** | handoff/fork · DB-based reseed · internal evaluation session 기반 평가·요약 · knowledge artifact/KB entry · lineage 영속화 |

> **P1 구현 현황**: 가로축 TurnCoordinator(0052) → 세로축 Runtime Supervisor 척추 + 단일 멱등 close/abort(0053) → **Persistent runtime(close-policy 파라미터, 결정 ⑳) + IdleCloseTimer 실구현 + RuntimePool/Supervisor 거버넌스(acquireRuntime/releaseRuntime, turn teardown≠runtime close)(0054)** → cap/LRU eviction 정책 seam + ConcurrencyRegistry Supervisor 소유 이관(0055) → `orchestration/concurrency` 이름 분기 해소(0061)까지 안착. 0054+ 는 **게이트 뒤**(`ORCA_PERSISTENT_RUNTIME`, 기본 OneShot)라 출시 경로 동작 보존이고, 남은 P1 은 steer/queue admission + true streaming-input 이다. idle/LRU/cap 은 핸들이 idle 로 살아남는 **Persistent 가 전제**라 0053 척추가 정책을 비웠고, 0054 가 그 Persistent 핸들 + 시간경계(IdleClose)를 세웠다.

## 7. 부록 — 용어

| 용어 | 뜻 |
|---|---|
| **하네스(harness)** | 모델을 신뢰 가능한 작업자로 만드는 실행 환경(루프·도구·권한·subagent). Orca는 SDK가 소유 |
| **SessionRuntime** | 세션 1개의 살아있는 실행 단위 — Query 핸들 + AbortController + coarse 상태 |
| **핸들 수명** | `query()` 반환 Query 핸들이 사는 기간. 턴-스코프(현재) vs 세션-스코프(목표) |
| **입력 admission** | 사용자/시스템 입력을 히스토리에 합류시키는 방식. `steer`(끼어들기) / `queue`(대기) |
| **failInterruptedTools** | 중단된 턴의 미완료 도구를 "interrupted"로 마감(유령 상태 방지). op 용어 차용 |
| **NormalizedEvent** | provider 중립 이벤트 — Orca의 단일 이벤트 버스(op `EventV2` 대응물) |

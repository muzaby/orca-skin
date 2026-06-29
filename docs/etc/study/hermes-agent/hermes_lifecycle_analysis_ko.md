# Hermes Agent의 라이프사이클 관리 구조 분석

> 가이드라인 문서 [`lifecycle_management_ko.md`](./lifecycle_management_ko.md)에서 정리한
> 일반적인 LLM 채팅 애플리케이션의 계층(애플리케이션 → 리소스 → 세션 → 에이전트 루프 →
> 도구/권한 → 상태/메모리 → 관측성/종료 → 서브에이전트)을 기준 틀로 삼아, **Nous Research의
> Hermes Agent**가 각 계층을 실제 코드에서 어떻게 구현했는지 분석한다. 인용은 모두 이
> 저장소의 실제 파일/심볼을 가리킨다.

Hermes는 README에서 스스로를 "self-improving AI agent"로 정의한다. 핵심 라이프사이클
설계 철학은 가이드라인이 강조한 **"단순한 동기 루프 + 명시적 상태 관리"**와 정확히 일치한다.
`AGENTS.md`는 메인 루프를 가리켜 *"The core loop is inside `run_conversation()` — entirely
synchronous, with interrupt checks, budget tracking, and a one-turn grace call"* 라고 못박는다
(`AGENTS.md:339-356`). 즉 Claude Code의 `nO` 루프와 같은 계보의 단순 루프를 채택하되,
거기에 **반복 예산(iteration budget)**, **인터럽트/스티어링**, **크래시 복원 영속화**를
얹은 형태다.

---

## 1. 애플리케이션 계층 — 다중 진입점(Entry Point)

가이드라인은 이 계층을 "UI/CLI/IDE 플러그인 + 연결(transport) 계층"으로 정의했다. Hermes는
하나의 에이전트 코어(`AIAgent`)를 **여러 프론트엔드가 공유**하는 구조로, 진입점이 가장 다양한
편이다.

| 진입점 | 구현 위치 | 역할 |
|---|---|---|
| 인터랙티브 CLI | `cli.py`의 `HermesCLI` (~14k LOC) | prompt_toolkit 기반 터미널 UI, 슬래시 명령 디스패치 |
| 메시징 게이트웨이 | `gateway/run.py` + `gateway/platforms/*` | Telegram·Discord·Slack·WhatsApp·Signal·Email 등을 단일 프로세스로 |
| TUI | `ui-tui/`(Ink/React) + `tui_gateway/`(Python JSON-RPC 백엔드) | `hermes --tui` |
| ACP 어댑터 | `acp_adapter/` | VS Code·Zed·JetBrains IDE 통합 (Agent Client Protocol) |
| 크론 | `cron/scheduler.py` | 무인 스케줄 실행 |
| 배치/연구 | `batch_runner.py`, `mini_swe_runner.py` | 병렬 트라젝토리 생성 |

* **연결(transport) 계층**: 가이드라인이 말한 "JSON-RPC 전송 레이어"는 Hermes에서 두 군데에
  나타난다. TUI는 `tui_gateway`가 Python↔Ink 사이를 JSON-RPC로 잇고(`AGENTS.md:417-436`),
  IDE는 `acp_adapter`가 ACP(JSON-RPC over stdio)를 처리한다. 게이트웨이는 플랫폼별 어댑터
  (`gateway/platforms/base.py`를 상속한 `telegram.py`, `slack` 등)가 외부 메신저 이벤트를
  내부 표준 메시지로 정규화한다.
* **명령 레지스트리 단일화**: 모든 슬래시 명령은 `hermes_cli/commands.py`의 단일
  `COMMAND_REGISTRY`(`CommandDef` 리스트)에서 파생된다. CLI 디스패치, 게이트웨이 디스패치,
  Telegram 봇 메뉴, Slack 서브커맨드, 자동완성, `/help`가 모두 이 한 곳에서 생성된다
  (`AGENTS.md:372-413`). 가이드라인이 강조한 "프론트엔드 표준화"를 코드 레벨에서 강제한 사례다.

---

## 2. 리소스/인프라 계층 — 프로세스·터미널 백엔드·격리

가이드라인의 Sagents 사례(`ProcessRegistry`, `FileSystemSupervisor`, presence 기반 종료)와
대응되는 부분이다. Hermes는 Erlang식 supervision 트리 대신 **프로세스 레지스트리 + 교체 가능한
터미널 백엔드**로 같은 책임을 수행한다.

* **프로세스 감시 — `ProcessRegistry`**: `tools/process_registry.py`의 `ProcessSession`/
  `ProcessRegistry`(140행~)는 백그라운드 셸 작업·비동기 서브에이전트의 수명을 추적한다. 각
  세션은 `_completion_event`(threading.Event)를 들고 있어, 작업 완료 시 이를 set하고
  (`process_registry.py:888`) 대기 측을 깨운다. 이는 가이드라인의 Sagents `ProcessSupervisor`에
  대응하는, Hermes의 동적 라이프사이클 관리 코어다.
* **리소스 스코핑 — 교체 가능한 터미널 백엔드**: 가이드라인의 "파일시스템 스코프"에 해당하는
  것이 `tools/environments/`다. README는 *"Six terminal backends — local, Docker, SSH,
  Singularity, Modal, and Daytona"*를 광고한다. 에이전트의 모든 셸/파일 작업은 선택된 백엔드
  안에서 실행되므로, 사용자·프로젝트 범위에 맞춰 로컬 셸·컨테이너·원격 호스트로 **실행 경계를
  치환**할 수 있다.
* **분산/내구 실행(serverless persistence)**: 가이드라인이 든 "OpenAI Agents SDK + Temporal
  내구 실행"에 대응하는 것이 Modal/Daytona 백엔드다. README는 *"your agent's environment
  hibernates when idle and wakes on demand"*라고 설명한다 — 즉 유휴 시 환경을 동면시키고
  요청 시 깨우는 serverless 영속성으로, 노드 크래시·재배치를 인프라 계층에 위임한다.
* **종료 포렌식**: `gateway/shutdown_forensics.py`, `gateway/memory_monitor.py`가 비정상 종료
  원인 수집과 메모리 압박 감시를 담당한다. 가이드라인의 "presence 기반 종료/리소스 낭비 방지"의
  Hermes판이며, 세션 만료는 §3에서 다룬다.

---

## 3. 세션 관리 — 대화 ID·재설정 정책·영속 저장

가이드라인은 세션 ID 매핑, 대화 히스토리 전달, 저장 백엔드, 세션 재개를 요구한다. Hermes는
**게이트웨이 세션(논리)**과 **SessionDB(물리 영속)**의 두 계층으로 이를 구현한다.

### 3.1 세션 매핑과 재설정 정책 — `gateway/session.py`

* `SessionStore`(702행~)는 `SessionSource`(플랫폼·발신자·채팅 ID)로부터 결정적
  `session_key`를 생성(`_generate_session_key`)하고 `SessionEntry`로 상태를 보관한다.
* 가이드라인의 "inactivity 타임아웃 / presence 기반 종료"를 **재설정 정책(reset policy)**으로
  일반화했다. `_is_session_expired`/`_should_reset`(`session.py:786-855`)는 정책 모드를
  `none | idle | daily | both`로 나눠, `idle_minutes` 경과 또는 일일 리셋 시각 도래 시 세션을
  만료시킨다. **핵심 안전장치**: 활성 백그라운드 프로세스가 있으면(`_has_active_processes_fn`)
  절대 만료시키지 않는다 — 작업 중인 에이전트가 유휴 타임아웃에 죽는 것을 막는다.
* 세션 일시중단/재개: `suspend_session`, `mark_resume_pending`, `clear_resume_pending`,
  `switch_session`, `rewind_session`, `prune_old_entries`가 가이드라인의 "세션 재개"를
  넘어서는 풍부한 수명 연산을 제공한다.

### 3.2 영속 저장 — `hermes_state.py`의 `SessionDB`

* `AGENTS.md:225`는 `hermes_state.py`를 *"SessionDB — SQLite session store (FTS5 search)"*로
  요약한다. 가이드라인이 언급한 "SQLite/Redis 등 다양한 세션 구현" 중 Hermes는 **SQLite +
  FTS5 전문검색**을 기본 채택했고, 이것이 README가 말한 *"FTS5 session search with LLM
  summarization for cross-session recall"* 기능의 토대다.
* 영속화는 루프 안에서 점진적으로 일어난다: `_flush_messages_to_session_db`
  (`run_agent.py:1568`), `_persist_session`(1499), `_save_session_log`(2247). 가이드라인의
  "크래시 후 중단 지점 재개"는 Hermes에서 **턴 중간에도 메시지를 DB로 흘려보내는 crash-resilience
  영속화**로 구현된다(`conversation_loop.py`의 turn context 주석 참조).
* **대화 히스토리 전달**: 가이드라인이 강조한 "이전 도구 호출+결과를 매 호출 시 함께 전달"은
  루프가 `messages` 리스트를 누적하며 매 API 호출에 그대로 싣는 구조로 자명하게 충족된다
  (`conversation_loop.py:527`의 `messages = _ctx.messages`).

---

## 4. 에이전트 코어 — 동기 루프 + 반복 예산 + 인터럽트

이 계층이 Hermes 라이프사이클의 심장이다. 실제 루프는 `agent/conversation_loop.py`의
`run_conversation`(469행~)에 있고, `run_agent.py`의 동명 메서드는 얇은 포워더다
(`run_agent.py:5227-5248`).

### 4.1 단일 동기 루프

```python
while (api_call_count < agent.max_iterations
       and agent.iteration_budget.remaining > 0) or agent._budget_grace_call:
    if agent._interrupt_requested: break          # 인터럽트 체크
    api_call_count += 1
    ... # API 호출 → 도구 실행 → messages.append → 반복
```
(`conversation_loop.py:563-575`)

가이드라인이 묘사한 Claude Code `nO`/Copilot CLI tool-use 루프와 동일한 골격이다. 도구 호출이
있으면 결과를 `messages`에 붙이고 반복하며, 도구 없는 텍스트 응답이 나오면 종료한다. 종료 사유는
`_turn_exit_reason`("interrupted_by_user", "budget_exhausted", …)으로 명시적으로 기록되어
관측성에 쓰인다(`conversation_loop.py:547`).

### 4.2 반복 예산(IterationBudget) — Hermes 고유 강화점

가이드라인은 "예산 제한은 개발자가 직접 구현해야 한다"고 지적했는데, Hermes는 이를
일급(first-class)으로 제공한다(`agent/iteration_budget.py`).

* 스레드 안전 `consume()`/`refund()` 카운터. 부모 에이전트는 `max_iterations`(기본 **90**),
  서브에이전트는 `delegation.max_iterations`(기본 **50**)의 **독립 예산**을 가진다.
* `execute_code`(프로그래밍적 도구 호출) 턴은 `refund()`로 예산을 돌려받아, 한 번의 스크립트
  실행으로 여러 도구를 호출해도 예산을 갉아먹지 않는다 — 가이드라인이 말한 "다단계 파이프라인을
  무비용 턴으로 접는" 설계와 직결된다.
* **grace call**: 예산이 소진돼도 모델에 마지막 한 번의 기회를 주는 `_budget_grace_call`
  플래그가 있어, 깔끔한 마무리 응답을 유도한다.

### 4.3 인터럽트와 스티어링 — 실시간 재지향

가이드라인에는 없지만 Hermes가 강화한 부분이다.

* `interrupt(message)`(`run_agent.py:2333`)와 `_interrupt_requested` 플래그로 루프를 즉시
  탈출시킨다. CLI는 Ctrl+C, 게이트웨이는 `/stop` 또는 새 메시지가 이를 트리거한다(README의
  "interrupt-and-redirect").
* `steer(text)`(`run_agent.py:2434`)와 `_drain_pending_steer`(2470)는 **모델이 사고 중일
  때 들어온 사용자 메시지를 다음 반복 시작 시 주입**해, 도구 배치를 깨지 않으면서 진행 방향을
  바꾼다(`conversation_loop.py:624-660`). 가이드라인 모델보다 한 단계 정교한 멀티턴 제어다.

### 4.4 도구 스케줄러 — 병렬/순차 디스패치

가이드라인의 "읽기 전용은 병렬, 상태 변경은 순차"(Copilot CLI) 규칙이 Hermes에도 그대로 있다.
`_execute_tool_calls`(`run_agent.py:5125`)는 `_should_parallelize_tool_batch`로 배치를
판정해 `_execute_tool_calls_concurrent`(읽기 전용 또는 경로가 겹치지 않는 파일 작업) 또는
`_execute_tool_calls_sequential`로 분기한다. 실제 실행은 `agent/tool_executor.py`로 위임된다.

### 4.5 플래닝/TODO

가이드라인의 "Claude Code TodoWrite"에 대응하는 것이 Hermes의 todo 스토어다. 루프 진입 전
`_hydrate_todo_store`(`run_agent.py:3210`)가 히스토리에서 TODO 상태를 복원하고, 스킬 사용
간격을 추적하는 `_iters_since_skill` 카운터(`conversation_loop.py:620`)가 자기개선 루프
(스킬 nudge)를 구동한다.

---

## 5. 도구와 권한 관리

가이드라인은 "JSON 인터페이스 도구 + 위험 명령 확인 + Hook"을 요구한다. Hermes는 이를
**자동 발견 도구 레지스트리 + 다층 승인 시스템 + 토큰 절약형 게이트**로 구현한다.

* **도구 발견·디스패치**: `tools/registry.py`(무의존, 모든 도구 파일이 import 시
  `register()` 호출) → `model_tools.py`의 `discover_builtin_tools()`/`handle_function_call()`
  → `run_agent.py`로 이어지는 의존 사슬(`AGENTS.md:289-299`). 40+개 도구가 토큰 절약을 위해
  **toolset**(`toolsets.py`) 단위로 묶여 선택적으로 로드된다.
* **권한/승인 — `tools/approval.py`**: 가이드라인의 "위험한 Bash 명령 확인"을 두 단계로 강화했다.
  `detect_hardline_command`(절대 차단, `_hardline_block_result`)와
  `detect_dangerous_command`(승인 요청)로 나뉘고, 세션 단위 **YOLO 모드**(`enable_session_yolo`)로
  신뢰 세션은 승인을 건너뛴다. 게이트웨이는 `register_gateway_notify`/`resolve_gateway_approval`로
  원격 메신저에서 승인 버튼을 띄운다. **중요 정책**: `AGENTS.md:1207`는 게이트웨이에 메시지 가드가
  *둘* 있으며 승인/제어 명령은 양쪽 모두 우회해야 한다고 경고한다.
* **가드레일**: `agent/tool_guardrails.py`의 `ToolGuardrailDecision`이 도구 실행 전후 검증을
  수행하고, 위반 시 `_toolguard_controlled_halt_response`로 루프를 통제된 방식으로 멈춘다
  (`run_agent.py:5087-5121`). 가이드라인의 OpenAI Agents SDK "guardrails 프리미티브"에 대응한다.

---

## 6. 상태 및 메모리 관리 — 닫힌 학습 루프

가이드라인의 "3계층 메모리(작업/벡터/관계형) + 80% 임계 요약"에 대응하는 Hermes의 구현은
README가 자랑하는 **"closed learning loop"**다.

* **메모리 매니저 — `agent/memory_manager.py`**: `MemoryManager`(313행~)는 복수의
  `MemoryProvider`를 등록(`add_provider`)하고, 요청별로 필요한 기억만 주입한다. 라이프사이클
  훅이 명확하다 — `on_turn_start`(704), `prefetch_all`/`queue_prefetch_all`(452/474),
  `sync_all`(515, 백그라운드 ThreadPool), `on_session_end`(718), `on_pre_compress`(777).
  이는 가이드라인의 "컨텍스트 관리자 / 메모리 라우터 / 통합 엔진" 3역할을 한 클래스에 응집한
  형태다.
* **플러그형 장기 메모리**: `plugins/memory/`에 honcho(변증법적 사용자 모델링), mem0,
  supermemory 등이 있다(`AGENTS.md:750`). 가이드라인의 "벡터 DB / 관계형 DB" 선택지를 플러그인
  교체로 흡수한다.
* **컨텍스트 압축 — `agent/context_engine.py` + `trajectory_compressor.py`**: 가이드라인은
  Claude Code의 "92% 임계 요약"을 들었는데, Hermes의 기본 임계는 **`threshold_percent = 0.75`**
  (`context_engine.py:64`)이다. `should_compress()`(83)가 매 턴 후 검사하고,
  `should_compress_preflight()`(110)가 턴 시작 전 선제 압축까지 수행한다. 실제 요약은
  `TrajectoryCompressor`(`trajectory_compressor.py:332`)가 담당하며, 이 압축기는 README가
  말한 "다음 세대 도구호출 모델 학습용 트라젝토리 압축"과 코드를 공유한다.
* **자기개선(스킬 생성)**: 복잡한 작업 후 에이전트가 스스로 스킬을 만들고, 사용 중 개선하며,
  주기적 nudge로 지식을 영속화한다(README). 이 스킬들의 라이프사이클은 §8 Curator가 관리한다.

---

## 7. 관측성, 이벤트, 종료/복구

### 7.1 이벤트와 Hook — `gateway/hooks.py`

가이드라인의 "RunHooks/AgentHooks 라이프사이클 이벤트"에 정확히 대응한다. `HookRegistry`는
`HOOK.yaml`(메타) + `handler.py`(`async def handle`)로 구성된 사용자 훅을 발견·로드하고
(`discover_and_load`), 핵심 라이프사이클 지점에서 발화한다:

* `agent:start` — 메시지 처리 시작
* `agent:step` — 도구호출 루프의 매 턴 (`conversation_loop.py:591`의 `step_callback`이 이를 발화)
* `agent:end` — 처리 완료

`emit()`은 `agent:start`에 대해 `agent` 기반 와일드카드 핸들러까지 해석한다
(`_resolve_handlers`, `hooks.py:162`). 가이드라인이 강조한 "관측성·감사 로그·커스텀 동작"의
삽입점이다. 추가로 `plugins/observability/`가 메트릭·트레이스·로그 플러그인을 제공한다.

### 7.2 로깅·진단

`hermes_logging.py`가 프로파일 인식 `agent.log`(INFO+)/`errors.log`(WARNING+)/`gateway.log`를
분리 기록하고(`AGENTS.md:227,262`), `agent/stream_diag.py`가 스트리밍 파싱 오류를 진단한다.

### 7.3 종료와 복구

가이드라인의 "비활성 종료 / 내구 실행 / 세션 재개"에 대응하는 Hermes의 정리(teardown) 경로:

* `shutdown_memory_provider`(`run_agent.py:2983`) → `commit_memory_session`(3010) →
  `release_clients`(3096) → `close`(3143)의 단계적 종료. 종료 시 메모리를 커밋해 닫힌
  학습 루프를 닫는다.
* 크래시 복구는 §3.2의 점진적 DB 영속화 + §2의 `ProcessRegistry` 완료 이벤트로 달성된다.
  가이드라인의 Temporal식 "자동 재개"는 인프라(Modal/Daytona 동면-깨우기)에 위임된다.

---

## 8. 스킬 라이프사이클 — Curator (가이드라인 외 확장)

가이드라인의 "서브에이전트/메모리"를 넘어 Hermes가 추가한 독자적 라이프사이클 관리 대상이
**스킬(절차적 기억)**이다. `agent/curator.py`가 이를 관리한다(`AGENTS.md:987-1017`).

* 백그라운드 리뷰 루프(`should_run_now`, `run_curator_review`)가 에이전트가 만든 스킬의 사용
  통계(`tools/skill_usage.py`의 `.usage.json`: `use_count`, `last_activity_at`, `state`)를
  추적해 `active → stale → archived` 상태 전이를 자동 적용한다(`apply_automatic_transitions`).
* **불변식**: ① `created_by: "agent"` 스킬만 건드린다(번들/허브 스킬 불가). ② **절대 삭제하지
  않는다** — 최대 파괴 행위는 `~/.hermes/skills/.archive/`로의 보관(복원 가능). ③ pin된 스킬은
  모든 자동 전이에서 면제. 가이드라인의 "사용자는 데이터를 잃지 않는다"는 안전 원칙을 코드 불변식으로
  못박은 사례다.

---

## 9. 통합 요약 — Hermes 라이프사이클 계층 매핑

| 가이드라인 계층 | Hermes 구현 | 핵심 위치 |
|---|---|---|
| **애플리케이션/연결** | CLI·게이트웨이·TUI·ACP·크론 다중 진입점, 단일 `COMMAND_REGISTRY` | `cli.py`, `gateway/run.py`, `acp_adapter/`, `hermes_cli/commands.py` |
| **리소스/프로세스 감시** | `ProcessRegistry` + 6종 교체식 터미널 백엔드 + 동면-깨우기 | `tools/process_registry.py`, `tools/environments/` |
| **세션 관리** | 게이트웨이 `SessionStore`(idle/daily 정책) + SQLite `SessionDB`(FTS5) | `gateway/session.py`, `hermes_state.py` |
| **에이전트 루프** | 동기 단일 루프 + `IterationBudget`(90/50) + 인터럽트/스티어 + grace call | `agent/conversation_loop.py`, `agent/iteration_budget.py` |
| **도구/권한** | 자동발견 레지스트리 + toolset + 다층 승인(hardline/dangerous/YOLO) + 가드레일 | `tools/registry.py`, `tools/approval.py`, `agent/tool_guardrails.py` |
| **상태/메모리** | `MemoryManager` + 플러그형 장기메모리 + 0.75 임계 압축 | `agent/memory_manager.py`, `agent/context_engine.py`, `trajectory_compressor.py` |
| **관측성/Hook** | `HookRegistry`(agent:start/step/end) + observability 플러그인 | `gateway/hooks.py`, `plugins/observability/` |
| **종료/복구** | 단계적 teardown + 점진 DB 영속화 + 완료 이벤트 | `run_agent.py:2983-3143`, `gateway/shutdown_forensics.py` |
| **스킬 라이프사이클(확장)** | Curator: active/stale/archived 자동전이, 절대 삭제 안 함 | `agent/curator.py`, `tools/skill_usage.py` |

---

## 10. 결론 — Hermes 라이프사이클의 특징

가이드라인이 도출한 공통 원칙 **"단순한 루프 + 명시적 상태 관리"**를 Hermes는 충실히 따른다.
그 위에 다음 세 가지를 차별점으로 더한다.

1. **예산을 일급으로** — 가이드라인이 "개발자 구현 사항"으로 남긴 반복/비용 예산을
   `IterationBudget`로 코어에 내장하고, 부모/서브에이전트 독립 예산과 `execute_code` 환불까지
   설계했다.
2. **실시간 제어 가능한 동기 루프** — 인터럽트와 스티어링으로, 단순 루프의 디버깅 용이성을
   유지하면서도 멀티턴 재지향을 지원한다.
3. **닫힌 학습 루프를 라이프사이클로** — 메모리뿐 아니라 **스킬**까지 생성·사용·보관의 수명
   대상으로 삼고(Curator), "절대 삭제 안 함" 같은 안전 불변식을 코드로 강제한다.

전체적으로 Hermes는 가이드라인의 8계층을 거의 일대일로 충족하면서, **세션 영속(SQLite/FTS5)**,
**교체식 실행 환경(6 백엔드 + serverless)**, **스킬 큐레이션**이라는 세 축에서 가이드라인보다
한 단계 더 나아간 라이프사이클 관리를 보여준다. 다중 에이전트 조정 측면은 동반 문서
[`hermes_orchestration_analysis_ko.md`](./hermes_orchestration_analysis_ko.md)에서 다룬다.

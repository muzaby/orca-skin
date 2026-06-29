# Hermes Agent의 오케스트레이션 패턴 분석

> 가이드라인 문서 [`orchestration_report_ko.md`](./orchestration_report_ko.md)가 정리한
> top-down 오케스트레이션 구성요소(리드/하네스 → 메시지 버스 → 실행/동시성 → 서브에이전트 격리
> → deliberation/consensus → 메모리/상태 → 권한/샌드박싱 → 복원력)를 기준 틀로, **Hermes
> Agent**가 여러 에이전트의 조정·작업 분해·세션 간 상태·정책 집행을 실제로 어떻게 구현했는지
> 분석한다. 인용은 모두 이 저장소의 실제 파일/심볼이다.

가이드라인은 오케스트레이션을 *"단순한 기본 모델을 신뢰 가능한 작업자로 바꾸는 하네스 계층"*으로
정의했다. Hermes에서 이 하네스는 **`AIAgent` 코어 + `delegate_task` 위임 + Kanban 작업 큐 +
Cron 스케줄러 + Hook 게이트**의 조합으로 나타난다. 특히 Hermes는 OpenCode가 권한 부여한
"fire-and-forget spawn + auto-wake" 패턴을 비동기 위임에서 **거의 동일하게** 채택했다는 점이
주목할 만하다.

---

## 1. 리드 에이전트 / 하네스 계층

가이드라인의 "리드 에이전트가 전체 맥락을 보유하고 LLM 재호출/위임을 결정한다"에 대응한다.
Hermes에서 리드는 부모 `AIAgent` 인스턴스이며, 하네스 책임은 다음에 분산된다.

* **계획과 작업 분해**: 부모는 `delegate_task` 도구로 하위 작업을 잘라낸다
  (`tools/delegate_tool.py:2065`). 가이드라인의 driver/worker 구조처럼, 부모가 아키텍처와
  전체 맥락을 유지하고 worker 서브에이전트에 집중 작업을 위임한다. Cron의 `context_from`은
  job A의 출력을 job B 프롬프트로 체이닝해(`AGENTS.md:1038`) 세션을 넘는 작업 분해도 지원한다.
* **도구 게이트와 정책 집행**: 도구 호출 전후로 가드레일/Hook이 실행되고, 각 에이전트가 쓸 수
  있는 toolset이 제어된다(§7). 가이드라인의 OpenCode `opencode.json` allow/ask/deny에
  대응하는 것이 Hermes의 `config.yaml` + `tools/approval.py` 승인 정책이다.
* **세션 관리/상태 회복**: 게이트웨이 `SessionStore`가 턴 간 맥락을 유지하고 활성 서브에이전트를
  추적한다(라이프사이클 문서 §3). 가이드라인의 "`CLAUDE.md`/`MEMORY.md` 파일 기반 메모리 로드"는
  Hermes에서 `AGENTS.md`/`CLAUDE.md`를 작업 디렉터리에서 로드하는 방식으로 동일하게 존재한다
  (Cron `workdir` 필드도 해당 디렉터리의 `AGENTS.md`/`CLAUDE.md`를 로드, `AGENTS.md:1038`).
* **subagent spawn**: 독립 context window + 독립 터미널 세션 + 독립 도구 권한을 가진 새
  `AIAgent`를 생성한다(`_build_child_agent`, `delegate_tool.py:972`). 가이드라인이 던진 핵심
  설계 질문 *"spawn 후 기다릴 것인가, 비동기로 깨울 것인가"*에 Hermes는 **둘 다** 답을 가진다
  (§3 참조).

---

## 2. 메시지/통신 채널

가이드라인은 file-based inbox(Claude Code)와 append-only JSONL + session injection(OpenCode)
두 방식을 대비했다. Hermes는 목적에 따라 **세 가지 통신 표면**을 구분해 쓴다.

### 2.1 위임 결과의 동기 반환 (1차 채널)

기본 `delegate_task`는 **동기**다. 부모는 자식의 요약을 받아 자기 루프에 통합한 뒤 진행한다
(`AGENTS.md:954-959`). 가이드라인의 "결과를 메인 루프에 통합해 단일 메시지 히스토리 유지"(Claude
Code 패턴)와 같은 계열로, 별도 메시지 버스 없이 함수 반환값이 곧 채널이다.

### 2.2 비동기 완료 이벤트의 세션 재주입 (auto-wake)

가이드라인이 OpenCode의 강점으로 꼽은 *"append → session injection → autoWake로 idle loop를
깨운다"*가 Hermes의 비동기 위임에 거의 그대로 구현돼 있다(`tools/async_delegation.py`).

* `dispatch_async_delegation`(152행~)은 daemon 스레드풀에 작업을 던지고 **즉시 핸들을
  반환**한다(`{"status": "dispatched", "delegation_id": ...}`) — 가이드라인의 fire-and-forget.
* 작업 완료 시 `_finalize`(266) → `_push_completion_event`(282)가 완료 이벤트를 큐에 넣고,
  `dispatch` 시점에 캡처해 둔 `session_key`로 **원래 세션에 결과를 재주입**한다
  (`process_registry.py:1550`의 *"re-injection block"*, *"When this re-enters the
  conversation the agent…"*). 이것이 Hermes판 auto-wake다. 코드 주석 자체가
  *"its result will re-enter the chat"*라고 명시한다(`async_delegation.py:220`).

### 2.3 영속 작업 큐 — Kanban (피어 협업 표면)

가이드라인의 file-based inbox / JSONL 토폴로지에 대응하는 **다중 워커 협업 표면**이 Kanban이다
(`AGENTS.md:1057-1094`). SQLite 백엔드 보드로, 여러 프로파일/워커가 공유 작업을 주고받는다.
파일/JSONL polling 대신 **트랜잭셔널 DB claim**을 써서, 가이드라인이 지적한 file-inbox의
`O(N)` rewrite·중복 전달 문제를 구조적으로 회피한다.

**통신 토폴로지**: 기본 위임은 가이드라인의 Claude Code처럼 **lead 중심**(부모↔자식)이다.
하지만 Kanban은 dispatcher를 통해 워커들이 공유 보드를 매개로 **간접 피어 협업**을 하도록 해,
OpenCode식 P2P에 가까운 확장을 별도 계층에서 제공한다.

---

## 3. 실행 및 동시성 모델

가이드라인의 spawn semantics·동시성 예산·크래시 회복에 정확히 대응한다.

* **Spawn semantics — blocking과 non-blocking 둘 다**:
  - **Blocking(기본)**: `delegate_task(background=false)`. 부모가 자식 완료까지 대기.
    부모가 인터럽트되면 자식도 취소된다(`AGENTS.md:957-959`). 가이드라인이 말한 "병렬성은
    낮지만 단순한" 모드.
  - **Non-blocking**: `background=true` → §2.2의 auto-wake. 가이드라인이 우려한 "lead가 할
    일 다 했다고 종료" 문제를, 완료 이벤트 재주입으로 해소한다.
* **동시성 예산과 거부(reject) 정책**: 배치 위임은 `delegation.max_concurrent_children`
  (기본 3)으로 캡되고(`delegate_tool.py:2170-2178`), 비동기는 `max_async_children`로 캡된다.
  **중요**: 용량 초과 시 큐잉이 아니라 **즉시 거부**한다(`async_delegation.py:215-225`) —
  *"a runaway model can't pile up unbounded background work"*. 가이드라인의 "active execution
  기준 동시성, runaway 비용 방지"(Codex/OpenCode)와 같은 철학이다.
* **깊이 제한**: `delegation.max_spawn_depth`(기본 2). 초과 시 명확한 오류 반환
  (`delegate_tool.py:2119-2134`). 가이드라인이 경고한 runaway recursion 방지.
* **운영자 킬스위치**: `set_spawn_paused`/`is_spawn_paused`(`delegate_tool.py:160-172`)로
  TUI(`/agents`에서 `p`)가 **이미 실행 중인 자식은 건드리지 않고 새 fan-out만 동결**한다
  (`delegate_tool.py:2094-2101`). 가이드라인의 OpenCode "busy→ready 전환 후 lead에게 위임"과
  동기는 같되, Hermes는 자동 재시작 대신 수동 게이트를 택했다.
* **크래시 회복**: Kanban dispatcher가 stale claim을 회수하고, `failure_limit`(기본 2) 연속
  실패 시 작업을 자동 block 처리해 spin loop를 막는다(`AGENTS.md:1075,1090`). 가이드라인의
  "자동 재시작은 비용 폭주를 부르므로 정책적으로"와 정확히 일치한다.

---

## 4. Subagent와 격리

가이드라인의 "독립 context window / 도구·권한 격리 / worktree·credential 격리"에 대응한다.

* **독립 컨텍스트 + 독립 터미널**: `_build_child_agent`(`delegate_tool.py:972`)는 자체 system
  prompt(`_build_child_system_prompt:656`)와 context window, 그리고 **독립 터미널 세션**을
  가진 자식 `AIAgent`를 만든다. 부모 컨텍스트 bloat를 막는 가이드라인 원칙 그대로다.
* **역할 기반 도구 격리**: 가이드라인이 강조한 *"탐색용 subagent가 team 도구에 접근하면 조정
  채널을 오염시킨다"*를 Hermes는 **role**로 해결한다(`AGENTS.md:968-974`):
  - `role="leaf"`(기본): 집중 워커. `delegate_task`, `clarify`, `memory`, `send_message`,
    `execute_code`를 **호출 불가**. (조정/메모리 채널 오염 차단)
  - `role="orchestrator"`: `delegate_task`를 유지해 자기 워커를 spawn 가능.
    `delegation.orchestrator_enabled`로 게이트.
  차단은 프롬프트가 아니라 `_strip_blocked_tools`(`delegate_tool.py:759`)가 **toolset에서
  실제로 제거**해 강제한다 — 가이드라인의 *"prompt로 제약하지 말고 인프라에서 경계를 강제하라"*와
  동일.
* **MCP toolset 상속 제어**: `inherit_mcp_toolsets`/`_preserve_parent_mcp_toolsets`
  (`delegate_tool.py:530-619`)로 자식이 부모의 MCP 도구를 물려받을지 세밀 제어한다.
* **worktree/credential 격리**: 자식은 §1의 교체식 터미널 백엔드(컨테이너/SSH 등)에서 실행돼
  파일 충돌·자격증명 누수를 인프라 계층에서 분리한다. 위임 자격증명은
  `_resolve_delegation_credentials`(`delegate_tool.py:2651`)가 **위임 전용 provider:model**을
  해석해 부모와 다른 모델/키로 자식을 돌릴 수 있게 한다(가이드라인의 cross-tool credential 격리에
  대응).
* **Cross-tool 격리(ACP)**: 가이드라인의 *"Claude Code/Gemini CLI/Codex 등 서로 다른 vendor
  agent를 각자 격리 실행하는 hypervisor"*에 대응하는 것이 Hermes의 ACP 위임이다.
  `delegate_task(acp_command=..., acp_args=...)`로 자식을 **외부 ACP 에이전트(예: Codex)**로
  띄울 수 있다(`delegate_tool.py:2236-2243`, `acp_adapter/`). 즉 Hermes 하네스가 이종 vendor
  에이전트를 worker로 오케스트레이션한다.

---

## 5. Multi-agent deliberation과 consensus

가이드라인은 위험한 결정에서 독립 관점·consensus scoring·two-gate validation을 권한다.
**Hermes는 가이드라인이 묘사한 형식적 consensus state machine(IDLE→RESEARCH→DELIBERATION→…)을
코어에 내장하지는 않았다.** 대신 같은 목표를 다른 메커니즘으로 근사한다.

* **검증 서브에이전트**: 위험/모호 작업을 별도 context의 서브에이전트로 분리해 검증·리뷰시키는
  패턴(가이드라인 Claude Code의 "verification subagent")을 `delegate_task`로 직접 구성할 수
  있다. 백그라운드 리뷰는 `_spawn_background_review`(`run_agent.py:1426`)로도 트리거된다.
* **다관점 분담**: 배치 위임으로 여러 워커에 서로 다른 `context`/`role`을 주어 독립 조사를
  병렬 수행시키고, 부모가 결과를 종합한다 — 가이드라인의 "research 단계 독립 조사 후 findings
  종합"의 경량판.
* **deliberation 스킬화**: 가이드라인식 confidence trigger·two-gate consensus는 Hermes에서
  **스킬/플러그인**으로 구현하는 것이 자연스럽다(self-improving 스킬 시스템). 즉 Hermes는
  consensus를 코어 불변식이 아니라 **조립 가능한 패턴**으로 남겨, 비용이 정당한 고위험 결정에만
  사용자가 선택적으로 얹도록 설계했다.

> **분석 메모**: 이 지점이 Hermes가 가이드라인 대비 가장 "느슨한" 영역이다. Anthropic
> Managed Multiagent의 rubric grader 같은 강제 합의 게이트는 기본 제공되지 않으며, 필요 시
> orchestrator role + 배치 위임으로 직접 구성해야 한다.

---

## 6. 메모리, 컨텍스트, 세션 간 상태

가이드라인의 파일 기반 메모리 / compaction / goal / handoff에 대응한다(라이프사이클 문서 §6과
중첩되므로 오케스트레이션 관점만 짚는다).

* **파일 기반 cross-session 메모리**: `MEMORY.md`/`AGENTS.md`/`CLAUDE.md`를 세션 시작 시
  로드 — 가이드라인의 Claude Code 방식과 동일. context window가 사라져도 파일은 남아
  세션 간 조정 상태를 보존한다.
* **Compaction**: 0.75 임계 자동 압축 + preflight 압축(`agent/context_engine.py`).
  가이드라인의 pre/post-compaction 전략에 대응.
* **Multi-day workflow**: 가이드라인의 Codex `/goal`(세션 넘는 stateful task)에 대응하는
  것이 **Cron + Kanban**이다. Cron의 `context_from` 체이닝과 Kanban의 durable 보드가
  "restart/compaction을 넘는 진행 추적"을 담당한다.
* **Session handoff**: 영속 SQLite `SessionDB`(FTS5)와 Kanban 작업 코멘트/링크가 후속
  세션·워커의 인계 표면이 된다.

---

## 7. 권한과 샌드박싱

가이드라인의 "Hook 기반 결정적 safety gate / permission profile / sandboxing model"에 대응한다.

* **Hook = 모델이 skip 못 하는 결정적 계층**: `gateway/hooks.py`의 `HookRegistry`가
  `agent:start/step/end`에서 발화한다. 가이드라인의 *"Bash에서 credential leak 검사 후 exit
  code 2로 차단"* 패턴은 Hermes에서 `tools/approval.py`의 `detect_hardline_command`(절대 차단)와
  `agent/tool_guardrails.py`의 `ToolGuardrailDecision`(통제된 halt)로 구현된다. 프롬프트가
  아니라 코드 게이트라는 점이 가이드라인 원칙과 일치한다.
* **Permission profile**: 가이드라인의 OpenCode `opencode.json` / Codex permission profile에
  대응하는 것이 Hermes `config.yaml`의 `delegation:` 섹션
  (`max_concurrent_children`, `max_spawn_depth`, `child_timeout_seconds`,
  `orchestrator_enabled`, `subagent_auto_approve`, `inherit_mcp_toolsets`, `AGENTS.md:976-979`)와
  세션 YOLO 토글이다. `subagent_auto_approve`는 자식의 승인 콜백을 자동 승인/거부로 설정한다
  (`_subagent_auto_approve`/`_subagent_auto_deny`, `delegate_tool.py:73-100`).
* **Sandboxing model**: 가이드라인의 Seatbelt/Landlock·`workspace-write`/`read-only` 모드에
  대응하는 것이 §1·§4의 교체식 터미널 백엔드다. Docker/Singularity/Modal/Daytona 백엔드는 각각
  컨테이너·serverless 격리를 제공하고, 클라우드 백엔드는 격리 컨테이너에서 자식을 실행한다.

---

## 8. 복원력과 회복

가이드라인의 "크래시·네트워크·모델 루프 실패 대비, state machine 추적, 자동 재시작 회피"에
대응한다.

* **수동 회복 우선 정책**: Hermes는 자동 재시작 대신 (1) 운영자 spawn pause 킬스위치, (2)
  Kanban `failure_limit` 자동 block, (3) `interrupt_subagent`/`interrupt_all`
  (`async_delegation.py:349`)로 명시적 중단을 택한다. 가이드라인이 강조한 *"자동 재시작은
  runaway cost를 부르므로 정책적으로 결정"*과 동일한 선택이다.
* **완료 이벤트 기반 추적**: `ProcessRegistry`의 `_completion_event`와 비동기 위임 레코드
  (`_records`, status: running/completed/error)가 진행 상태를 추적한다. 가이드라인의 "fine/coarse
  이중 state machine"만큼 형식화되진 않았지만, status 필드 + 완료 이벤트로 같은 회복 정보를 제공한다.
* **타임아웃 하드닝**: 위임 자식은 `delegation.child_timeout_seconds`로, **Cron 세션은 3분 하드
  인터럽트**로 캡된다(`AGENTS.md:1042`). runaway 루프가 스케줄러를 독점하지 못하게 하는 강제
  경계다.
* **Hook/가드 기반 무근거 합의 방지**: 가이드라인의 "spawn budget·consensus validation·hook
  gate로 runaway recursion 방지"는 Hermes에서 spawn 예산(§3) + 가드레일(§7)로 달성된다.

---

## 9. Hermes 오케스트레이션 요약 — 플랫폼 대비

가이드라인의 OpenCode/Codex/Claude Code 비교 표에 Hermes를 끼워 넣으면:

* **아키텍처**: Python 코어(`AIAgent`)가 중심. 위임은 in-process 스레드풀(`delegate_task` 동기,
  `async_delegation` 비동기 daemon 풀), 영속 협업은 SQLite Kanban 보드, 무인 실행은 Cron 틱
  루프. 실행 환경은 6종 터미널 백엔드로 추상화.
* **메시징**: 동기 위임(함수 반환) + 비동기 완료 이벤트 **세션 재주입(auto-wake)** + Kanban
  보드 claim. OpenCode의 JSONL+injection 패턴을 비동기 위임에서 채택.
* **Spawn/동시성**: fire-and-forget + auto-wake, 용량 초과 시 **큐잉 아닌 거부**, 깊이/동시성/
  타임아웃 캡, 운영자 pause 킬스위치.
* **권한**: role 기반 toolset 격리(leaf/orchestrator) + 다층 승인(hardline/dangerous/YOLO) +
  Hook/가드레일 결정적 게이트 + `config.yaml delegation:` profile.
* **강점**: ① 동기·비동기 위임 동시 지원, ② role로 도구 격리를 인프라에서 강제, ③ ACP로 이종
  vendor 에이전트(Codex 등) 오케스트레이션, ④ Kanban+Cron으로 세션 넘는 durable 작업,
  ⑤ 위임 전용 provider:model로 worker별 모델 선택.
* **한계(분석 메모)**: 가이드라인식 **형식적 consensus/deliberation state machine과 rubric
  grader는 코어 기본 제공이 아님**(§5). 기본 위임 토폴로지는 lead 중심이며 full P2P는 Kanban
  계층에서 간접 달성. 기본 위임이 동기라 장기 작업은 명시적으로 `background=true`/Cron/Kanban으로
  옮겨야 한다(`AGENTS.md:981-983`: *"delegate_task is **not** durable"*).

---

## 10. 결론 — 가이드라인 7대 교훈에 비춘 Hermes

가이드라인이 도출한 일반 설계 교훈에 Hermes를 대조하면 대부분을 충족한다.

1. **계획/실행 분리** ✅ — 부모(driver) + leaf worker, Cron `context_from` 체이닝.
2. **에이전트/컨텍스트 격리** ✅ — 독립 context+터미널, role 기반 toolset 제거, 교체식 백엔드.
3. **메시징을 first-class로** ◐ — 동기 반환 + auto-wake 재주입 + Kanban claim의 세 표면. 단,
   backpressure는 "거부" 정책으로 대체(가이드라인이 지적한 OpenCode의 flood 문제를 거부로 회피).
4. **권한/Hook을 인프라에서 강제** ✅ — `_strip_blocked_tools`, 가드레일, 하드라인 차단.
5. **상태 추적/recovery를 명시적으로** ◐ — status 필드 + 완료 이벤트 + 수동 회복 정책. 다만
   OpenCode식 이중 state machine만큼 형식화되진 않음.
6. **고위험 결정에 consensus/grading** ◐ — 코어 미내장, orchestrator+배치 위임으로 조립.
   Hermes에서 가장 보강 여지가 큰 영역.
7. **상호운용성 고려** ✅ — ACP 위임으로 Codex 등 이종 하네스를 worker로, 위임 전용 자격증명
   해석으로 cross-tool 실행.

종합하면 Hermes의 오케스트레이션은 가이드라인이 수렴 지점으로 제시한 다섯 원칙
(**lead/worker 분리 · context 격리 · 명시적 도구 권한 · state machine 회복 · 파일 기반
메모리/handoff로 세션 경계 넘기**)을 견고하게 구현한다. 차별점은 **fire-and-forget+auto-wake
위임**, **role 기반 도구 격리의 인프라적 강제**, **ACP를 통한 이종 vendor 오케스트레이션**,
그리고 **Kanban+Cron의 durable 협업 큐**다. 반대로 가이드라인이 비중 있게 다룬 **형식적
multi-agent deliberation/consensus**는 Hermes에서 의도적으로 코어 밖 조립 가능 패턴으로 남겨져
있어, 고위험 자율 결정을 다룰 때 가장 먼저 보강을 검토할 영역이다.

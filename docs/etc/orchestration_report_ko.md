# LLM 기반 채팅 애플리케이션의 오케스트레이션 패턴

## 소개

**OpenCode**, **Codex CLI**, **Claude Code** 같은 최신 코딩 보조 도구는 대규모 언어 모델(LLM)을 **오케스트레이션 계층** 안에 감싼 형태로 동작한다. 이 계층은 *하네스(harness)* 또는 *에이전트 모드(agent mode)* 라고도 불린다. 목적은 단순한 기본 모델을 신뢰 가능한 작업자로 바꾸는 것이다. 이를 위해 모델을 언제 다시 실행할지, 어떤 도구를 호출할 수 있는지, 다른 에이전트와 어떻게 통신할지, 오류나 중단 상황에서 어떻게 회복할지를 통제한다.

앞서 다룬 **라이프사이클 관리**가 애플리케이션, 리소스, 세션, 상태의 생애주기를 포괄한다면, 이 문서의 초점인 오케스트레이션은 **여러 에이전트의 조정, 작업 분해, 세션 간 상태 관리, 정책 집행**에 더 가깝다.

이 문서는 top-down 관점에서, 먼저 일반적인 오케스트레이션 패턴을 설명한 뒤 OpenCode, Codex CLI, Claude Code가 이를 어떻게 구현하는지 분석한다.

## Top-down 오케스트레이션 구성요소

### 1. 리드 에이전트 / 하네스 계층

가장 상위에는 **리드 에이전트** 또는 **하네스**가 있다. 하네스는 전체 작업 맥락을 보유하고, LLM을 언제 다시 호출할지 결정하며, 필요하면 하위 에이전트에게 작업을 위임한다. Claude Code에서 하네스는 hook, skill, agent, workflow 정의를 조합한 프로그래머블 런타임으로 구현된다. 즉 모델 자체가 시스템 전체가 아니라, 프로그래밍 가능한 실행 환경 안의 하나의 구성요소로 취급된다.

OpenCode와 Codex CLI도 유사한 역할을 둔다. OpenCode에서는 Build Agent, Plan Agent 같은 primary agent가 중심 루프를 담당하고, Codex CLI에서는 durable thread가 세션 단위의 중심 실행 컨테이너 역할을 한다.

**하네스의 주요 책임은 다음과 같다.**

- **계획과 작업 분해**: 전체 문제를 이해하고 어떤 부분을 하위 에이전트에게 맡길지 결정한다. driver/worker 구조에서는 Claude Code 같은 driver가 아키텍처와 전체 맥락을 유지하고, Codex 같은 worker에게 긴 실행 작업을 위임한다.
- **도구 게이트와 정책 집행**: 도구 호출 전후에 hook을 실행하고, 각 에이전트가 어떤 도구를 사용할 수 있는지 제어한다. OpenCode는 `opencode.json`을 통해 edit, bash, webfetch, task 호출에 allow/ask/deny 정책을 부여한다.
- **세션 관리**: 턴 간 맥락을 유지하고, 활성 subagent를 추적하며, 크래시 이후 상태 회복을 지원한다. OpenCode는 event 기반 상태와 pinned session을 사용하고, Claude Code는 `CLAUDE.md`, `MEMORY.md` 같은 파일 기반 메모리를 세션 시작 시 로드한다.
- **subagent spawn**: 각자 독립적인 context window와 tool 권한을 가진 새 세션을 생성한다. spawn은 in-process, tmux pane, iTerm pane, remote container 등 다양한 방식으로 가능하다. 중요한 설계 문제는 “spawn 후 기다릴 것인가, 아니면 비동기로 깨울 것인가”이다. OpenCode는 fire-and-forget spawn과 auto-wake를 결합하는 방식이 효과적이라고 본다. 즉 spawn은 즉시 반환하고, 하위 에이전트가 메시지를 보내면 idle 상태의 lead loop를 다시 깨운다.

### 2. 메시지 버스와 통신

여러 에이전트가 협업하려면 작업 할당, 결과, 질문, 상태 변경을 전달할 **구조화된 메시지 채널**이 필요하다. 크게 두 가지 방식이 등장했다.

#### 1) 파일 기반 inbox

Claude Code의 Agent Teams는 `~/.claude/teams/{team-name}/inboxes/{recipient}.json` 같은 경로에 각 에이전트별 JSON inbox 파일을 두고, recipient가 주기적으로 poll 하여 메시지를 읽는다.

이 방식은 in-process, tmux, iTerm 같은 서로 다른 spawn backend를 모두 지원하기 좋다. 특히 별도 OS 프로세스나 터미널 pane으로 실행되는 에이전트끼리는 공유 가능한 표면이 파일 시스템뿐일 수 있다. 다만 JSON array를 매번 읽고, deserialize하고, 새 메시지를 push한 뒤 다시 serialize/write 해야 하므로 메시지 추가 비용이 `O(N)`이 된다.

#### 2) Append-only JSONL + session injection

OpenCode는 각 에이전트별 JSONL 파일에 메시지를 append하고, 같은 메시지를 target session에 synthetic user message로 주입한다. 이후 `autoWake`가 idle 상태의 recipient prompt loop를 다시 시작한다.

이 방식에서는 새 메시지가 단순 append이므로 `O(1)` 쓰기가 가능하고, inbox 자체가 audit log 역할도 한다. 메시지 read 상태와 delivery receipt도 정규 team message 형태로 처리할 수 있다.

#### 통신 토폴로지

통신 경로도 중요하다. Claude Code는 주로 lead 중심이다. teammate끼리 직접 메시지를 주고받을 수도 있지만, 일반적인 패턴은 **teammate → leader → teammate**이다.

OpenCode는 full peer-to-peer messaging을 허용한다. 어떤 teammate든 다른 teammate에게 직접 `team_message`를 보낼 수 있다. 이 구조는 lead가 단순 message router가 되는 부담을 줄이고, lead가 실제 조율과 판단에 집중하게 한다.

### 3. 실행 및 동시성 모델

Subagent와 worker thread는 동시에 실행될 수 있다. 따라서 오케스트레이션 프레임워크는 spawn semantics, concurrency limit, isolation을 관리해야 한다.

- **Spawn semantics**: blocking spawn은 subagent가 끝날 때까지 기다리므로 병렬성이 떨어진다. 반대로 non-blocking spawn은 lead loop가 할 일을 다 했다고 판단하고 종료해 버릴 수 있다. OpenCode는 fire-and-forget spawn을 유지하되, subagent가 메시지를 보내면 auto-wake로 idle lead session을 다시 깨우는 방식을 택했다.
- **동시성 예산과 state machine**: OpenCode는 teammate의 상태를 두 개의 state machine으로 관리한다. 하나는 `ready`, `busy`, `shutdown`, `error` 같은 coarse member status이고, 다른 하나는 prompt loop의 정확한 진행 지점을 표현하는 fine-grained execution status이다. 이를 분리하면 UI는 상세 상태를 보여줄 수 있고, recovery/cleanup 로직은 단순한 상태만 보면 된다.
- **크래시 회복**: 서버가 재시작되면 OpenCode는 `busy`로 표시된 agent를 scan하고 강제로 `ready`로 전환한다. 그 뒤 lead에게 “이 worker들은 중단되었으니 필요하면 다시 지시하라”는 시스템 메시지를 주입한다. 자동 재시작을 하지 않는 이유는, 오래된 작업이 밤새 API 비용을 태우는 runaway 상황을 막기 위해서다.
- **Codex의 동시성 제어**: Codex CLI의 multi-agent v2는 spawned thread 수가 아니라 **active execution** 기준으로 concurrency를 계산한다. idle agent는 slot을 차지하지 않는다. 또한 inter-agent message payload를 암호화하고, agent residency LRU를 통해 어떤 agent를 메모리에 유지할지 관리한다. `close_agent`는 실행 중인 agent를 실제로 중단한다는 의미를 명확히 하기 위해 `interrupt_agent`로 이름이 바뀌었다.

### 4. Subagent와 격리

Subagent는 긴 실행, 탐색, 검증, 리뷰 같은 작업을 main session 밖으로 분리하는 핵심 메커니즘이다.

- **독립 context window**: 각 subagent는 자체 context window와 system prompt를 가진다. Claude Code는 이를 통해 main session의 context bloat를 막는다. OpenCode는 `@general`, `@explore`, `@scout` 같은 subagent를 두어 복잡한 다단계 작업, read-only 탐색, repository research를 분담한다.
- **도구 및 권한 격리**: subagent가 team coordination tool에 접근하면 안 된다. 예를 들어 탐색용 subagent가 `team_message`를 쓸 수 있으면 grep 결과나 중간 reasoning을 팀 채널에 대량으로 뿌려 coordination channel을 오염시킬 수 있다. OpenCode는 `team_create`, `team_spawn`, `team_message`, `team_broadcast`, `team_tasks`, `team_claim` 같은 팀 도구를 subagent 세션에서 deny하고, tool registry에서도 숨긴다.
- **worktree와 credential 격리**: Claude Code는 worktree isolation을 지원하여 subagent가 별도 git worktree에서 실행될 수 있다. Codex는 agent thread별로 별도 git worktree를 생성하여 동일 파일 수정 충돌을 방지한다. 더 넓은 cross-tool hypervisor 구조에서는 Claude Code, Gemini CLI, Codex 같은 서로 다른 tool vendor agent를 각자 container, worktree, credential로 격리하여 실행한다. 핵심 원칙은 prompt로 제약하는 것이 아니라, 인프라 계층에서 경계를 강제하는 것이다.

### 5. Multi-agent deliberation과 consensus

단일 에이전트가 안전하게 결정하기 어려운 문제에서는 **multi-agent deliberation**이 필요하다. 이는 여러 독립 관점을 통해 맹점을 줄이고, consensus scoring으로 결정을 보강하는 방식이다.

- **최소 viable deliberation**: 두 agent를 서로 다른 system prompt로 띄운다. 예를 들어 하나는 특정 접근을 찬성하고, 다른 하나는 반대하게 한다. 위험하거나 모호하거나 되돌리기 어려운 결정일 때만 deliberation을 실행한다.
- **Confidence trigger**: 모든 작업에 다중 에이전트를 쓰면 비용과 복잡도가 커진다. 따라서 ambiguity, domain complexity, stakes, context dependency를 기준으로 confidence를 계산하고, 일정 threshold 아래일 때만 full deliberation을 실행한다.
- **단계형 state machine**: 일반적인 deliberation workflow는 `IDLE → RESEARCH → DELIBERATION → RANKING → PRD_GENERATION → COMPLETE` 같은 단계를 따른다. 연구 단계에서는 agent들이 서로의 결과를 보지 않고 독립적으로 조사한다. 이후 모든 findings를 보고 대안들을 생성하고, impact, quality, feasibility, reusability, risk 같은 차원으로 점수화한다.
- **Two-gate validation**: 첫 번째 gate는 deliberation agent가 끝날 때 consensus score, 최소 참여 agent 수, dissent 문서화 여부를 검사한다. 두 번째 gate는 session 종료 전 pride check로, 관점 다양성, 모순 투명성, 대안 수, confidence 향상 여부를 확인한다.
- **Managed multiagent orchestration**: Anthropic의 Managed Multiagent는 lead agent가 작업을 specialist에게 분해하여 병렬 수행하게 하고, 별도 grader가 rubric에 따라 결과를 평가하는 구조다. self-hosted 방식에서는 spawn logic, validation gate, tracing을 직접 구현하지만, managed 방식은 표준 delegation + rubric grading을 서비스로 제공하는 대신 세밀한 제어는 줄어든다.

### 6. 메모리, 컨텍스트, 상태

장기 작업에서는 상태 관리가 오케스트레이션의 핵심이다.

- **파일 시스템 기반 메모리**: Claude Code는 `CLAUDE.md`, `MEMORY.md` 같은 파일에 프로젝트 규칙, 의사결정, 오류, 반복 패턴을 기록하고 세션 시작 시 로드한다. context window가 사라져도 파일은 남기 때문에 cross-session memory로 기능한다.
- **Compaction과 context window 관리**: 대화가 길어지면 이전 turn은 요약되어야 한다. OpenCode와 Codex는 각각 자동 요약, pre/post-compaction hook, session persistence 전략을 사용한다.
- **Goal과 multi-day workflow**: Codex의 `/goal`은 여러 세션에 걸친 stateful task를 만든다. 예를 들어 “OAuth2로 인증 마이그레이션” 같은 목표가 restart와 compaction을 넘어 진행 상태를 추적한다.
- **Session handoff**: 장기 작업을 다음 세션으로 넘기기 위해 `Status`, `Files changed`, `Decision`, `Blocked`, `Next` 같은 구조의 handoff 문서를 남긴다. 이는 토큰을 적게 쓰면서도 후속 세션이 바로 이어받게 하는 방식이다.

### 7. 권한과 샌드박싱

오케스트레이션은 자율성을 높이지만, 동시에 안전 경계가 필요하다.

- **Hook 기반 safety gate**: Claude Code의 hook은 모델이 skip할 수 없는 결정적 실행 계층이다. 예를 들어 Bash 명령에서 credential leak을 검사하고, exit code 2로 tool call을 차단할 수 있다.
- **Permission profile**: OpenCode는 `opencode.json`에서 edit, bash, webfetch, task 권한을 세밀하게 정의한다. Codex CLI는 `default`, `permissive`, `suggest` 같은 permission profile을 제공하여 자동 실행과 승인 흐름의 균형을 맞춘다.
- **Sandboxing model**: Codex CLI는 macOS에서는 Seatbelt, Linux에서는 Landlock/seccomp를 사용해 filesystem, syscall, process, network, mount, user namespace를 제한한다. 실행 모드는 `workspace-write`, `read-only`, `danger-full-access` 등으로 나뉜다. Cloud execution에서는 agent가 격리 container에서 실행되고, setup phase 이후에는 network가 기본적으로 차단된다.

### 8. 복원력과 회복

오케스트레이션 시스템은 크래시, 네트워크 장애, 모델 루프 실패에 대비해야 한다.

OpenCode는 두 개의 state machine으로 agent status를 추적하고, 서버 재시작 후 busy agent를 ready로 전환한 뒤 lead에게 재개 여부를 맡긴다. 자동 재시작을 피하는 것은 비용 폭주와 stale task 재실행을 막기 위한 선택이다.

Codex CLI의 multi-agent v2는 inter-agent message 암호화, agent-residency LRU, active execution 기준 concurrency로 fleet 운영에 가까운 구조를 갖춘다.

Claude Code 계열의 하네스는 spawn budget, consensus validation, hook 기반 gate를 통해 runaway recursion이나 무근거 합의를 방지한다.

## 플랫폼별 오케스트레이션 요약

### OpenCode

- **아키텍처**: TypeScript core와 effect-based event system을 기반으로 한다. Build Agent와 Plan Agent 같은 primary agent가 중심이 되고, `@general`, `@explore`, `@scout`, background subagent가 복잡한 작업, 코드 탐색, repository research를 분담한다.
- **메시징**: per-agent JSONL inbox에 메시지를 저장하고, session injection과 autoWake로 idle loop를 깨운다. Peer-to-peer messaging을 지원하여 teammate 간 직접 통신이 가능하다.
- **Spawn과 동시성**: fire-and-forget spawn을 사용하되 auto-wake로 lead를 다시 활성화한다. member lifecycle과 execution status를 분리한 two-level state machine을 사용한다.
- **권한**: `opencode.json`에서 edit, bash, webfetch, task, skill 등에 allow/ask/deny 정책을 부여한다.
- **강점**: multi-provider 지원, event-driven messaging, append-only JSONL로 인한 `O(1)` write, peer-to-peer communication, 명시적 state machine, background subagent.
- **한계**: single-process 구조이므로 여러 server instance가 같은 storage를 공유하기 어렵다. backpressure가 없어 빠른 sender가 느린 receiver를 flood할 수 있다. crash 이후 recovery는 기본적으로 수동이다.

### Codex CLI

- **아키텍처**: Rust 기반이며 thread model을 사용한다. Thread는 durable session container, turn은 user input에서 시작되는 agent work unit, item은 lifecycle event를 가진 atomic I/O로 볼 수 있다. App Server는 stdio reader, message processor, thread manager, core thread로 구성되고 JSON-RPC/JSONL 스트림으로 통신한다.
- **실행 모드**: local execution, cloud sandbox execution, remote/mobile execution이 가능하다. `/goal`은 다일간 workflow를 세션 간 유지한다.
- **Multi-agent v2**: message payload 암호화, active execution 기준 concurrency, agent residency LRU, `interrupt_agent` lifecycle API를 제공한다. worker/explorer agent type과 TOML-defined custom agent를 지원한다.
- **샌드박싱**: macOS Seatbelt, Linux Landlock/seccomp, git worktree per thread, cloud container isolation을 제공한다.
- **강점**: 장시간 실행에 강하고 worker 역할에 적합하다. token efficiency가 높으며, thread/worktree 기반 parallelism과 remote/browser/mobile surface를 제공한다.
- **한계**: OpenCode처럼 peer-to-peer messaging이 first-class primitive로 보이지는 않는다. 복합 cross-harness orchestration은 대개 BEADS + Metaswarm 같은 외부 framework에 의존한다.

### Claude Code

- **하네스 패턴**: LLM을 programmable runtime의 한 구성요소로 취급한다. hook은 필수 실행을 보장하고, skill은 domain knowledge를 자동 활성화하며, subagent는 context isolation을 제공한다.
- **Agent Teams**: lead session이 teammate Claude instance를 spawn한다. 메시지는 파일 기반 JSON inbox로 전달되고, leader가 polling한다. task 파일은 dependency와 ownership을 추적한다.
- **Subagent 패턴**: exploration, research, verification을 별도 context로 분리한다. team messaging 도구는 subagent에서 deny/hidden 처리하여 coordination channel 오염을 막는다.
- **Multi-agent deliberation**: 위험하거나 모호한 결정에는 서로 다른 prompt를 가진 독립 agent를 spawn하고, consensus scoring과 two-gate validation으로 결정을 보강한다.
- **Managed multiagent**: lead agent가 specialist에게 병렬로 일을 나눠주고, 별도 grader가 rubric에 따라 결과를 평가하는 managed service 형태도 제공된다.
- **강점**: hook/skill 기반 결정적 자동화, `CLAUDE.md`/`MEMORY.md` 기반 메모리, self-hosted/managed multiagent 선택지, subagent verification.
- **한계**: 파일 기반 messaging은 polling과 JSON array rewrite 때문에 비용이 커질 수 있다. Agent Teams는 기본적으로 shared working directory를 쓰며, lead가 죽으면 coordination state가 사라질 수 있다. context preloading과 verification subagent 때문에 token 사용량이 높아질 수 있다.

## 일반 LLM 채팅 애플리케이션 설계 교훈

1. **계획과 실행을 분리하라.**  
   Lead agent는 전체 맥락과 판단을 유지하고, worker agent는 긴 실행이나 기계적 변환을 담당하게 한다. driver/worker 구조는 복잡한 작업에서 특히 유용하다.

2. **에이전트와 컨텍스트를 격리하라.**  
   각 agent는 독립 context window, 작업 디렉터리, 권한을 가져야 한다. 이렇게 해야 context bloat, 파일 충돌, credential leak을 줄일 수 있다.

3. **메시징을 first-class primitive로 설계하라.**  
   파일 기반 polling, JSONL append + session injection, message broker 등 어떤 방식을 쓰든 메시지 전달, read state, receipt, backpressure, audit log를 명시적으로 설계해야 한다.

4. **권한과 hook은 프롬프트가 아니라 인프라에서 강제하라.**  
   “항상 테스트해라”라는 prompt보다, Edit 이후 자동 test hook이 더 신뢰 가능하다. 모델이 skip할 수 없는 계층이 필요하다.

5. **상태 추적과 recovery를 명시적으로 구현하라.**  
   agent lifecycle, prompt-loop execution, cancellation, crash recovery를 state machine으로 관리해야 한다. 자동 재시작은 편리하지만 runaway cost를 부를 수 있으므로 정책적으로 결정해야 한다.

6. **중요한 결정에는 consensus와 grading을 사용하라.**  
   단일 agent는 자신의 가정을 반박하기 어렵다. 위험하거나 되돌리기 어려운 결정에는 독립 agent, 다른 persona, 별도 grader, consensus score가 효과적이다.

7. **상호운용성을 고려하라.**  
   실제 현장에서는 Claude Code, Codex, OpenCode, Gemini CLI 같은 여러 하네스를 함께 쓰는 경우가 많다. 따라서 session adapter, worktree isolation, structured return packet, cross-tool memory translation을 고려해야 한다.

## 결론

오케스트레이션은 LLM을 신뢰 가능한 코딩 보조자로 바꾸는 핵심 인프라다. OpenCode, Codex CLI, Claude Code는 메시징, 동시성, subagent 격리, deliberation에서 서로 다른 접근을 취하지만, 공통적으로 다음 원칙에 수렴한다.

- lead와 worker를 분리한다.
- context와 작업 공간을 격리한다.
- 도구 권한을 명시적으로 제어한다.
- 상태와 recovery를 state machine으로 관리한다.
- 고위험 결정에는 독립 agent와 consensus를 사용한다.
- 긴 작업은 파일 기반 메모리, handoff, goal로 세션 경계를 넘긴다.

이 구조를 잘 설계하면 LLM 채팅 애플리케이션은 단순한 대화 UI를 넘어, 여러 에이전트가 병렬로 일하고 서로 검증하며 장기 작업을 수행하는 **agentic runtime**으로 발전할 수 있다.

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK에서 Claude Code 기능 사용하기

> 프로젝트 지침, 스킬, 훅 및 기타 Claude Code 기능을 SDK 에이전트에 로드합니다.

Agent SDK는 Claude Code와 동일한 기반 위에 구축되어 있으므로, SDK 에이전트는 동일한 파일시스템 기반 기능에 접근할 수 있습니다: 프로젝트 지침(`CLAUDE.md` 및 규칙), 스킬, 훅 등입니다.

`settingSources`를 생략하면 `query()`는 Claude Code CLI와 동일한 파일시스템 설정을 읽습니다: 사용자, 프로젝트 및 로컬 설정, CLAUDE.md 파일, `.claude/` 스킬, 에이전트 및 명령입니다. 이 없이 실행하려면 `settingSources: []`를 전달하면 에이전트가 프로그래밍 방식으로 구성한 것으로만 제한됩니다. 관리형 정책 설정 및 전역 `~/.claude.json` 구성은 이 옵션과 관계없이 읽혀집니다. [settingSources가 제어하지 않는 것](#what-settingsources-does-not-control)을 참조하세요.

각 기능이 수행하는 작업과 사용 시기에 대한 개념적 개요는 [Claude Code 확장](/ko/features-overview)을 참조하세요.

## settingSources로 파일시스템 설정 제어하기

설정 소스 옵션(Python의 [`setting_sources`](/ko/agent-sdk/python#claudeagentoptions), TypeScript의 [`settingSources`](/ko/agent-sdk/typescript#settingsource))은 SDK가 로드하는 파일시스템 기반 설정을 제어합니다. 특정 소스를 선택하려면 명시적 목록을 전달하거나, 사용자, 프로젝트 및 로컬 설정을 비활성화하려면 빈 배열을 전달합니다.

이 예제는 `settingSources`를 `["user", "project"]`로 설정하여 사용자 수준 및 프로젝트 수준 설정을 모두 로드합니다:

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

  async for message in query(
      prompt="Help me refactor the auth module",
      options=ClaudeAgentOptions(
          # "user" loads from ~/.claude/, "project" loads from ./.claude/ in cwd.
          # Together they give the agent access to CLAUDE.md, skills, hooks, and
          # permissions from both locations.
          setting_sources=["user", "project"],
          allowed_tools=["Read", "Edit", "Bash"],
      ),
  ):
      if isinstance(message, AssistantMessage):
          for block in message.content:
              if hasattr(block, "text"):
                  print(block.text)
      if isinstance(message, ResultMessage) and message.subtype == "success":
          print(f"\nResult: {message.result}")
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Help me refactor the auth module",
    options: {
      // "user" loads from ~/.claude/, "project" loads from ./.claude/ in cwd.
      // Together they give the agent access to CLAUDE.md, skills, hooks, and
      // permissions from both locations.
      settingSources: ["user", "project"],
      allowedTools: ["Read", "Edit", "Bash"]
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") console.log(block.text);
      }
    }
    if (message.type === "result" && message.subtype === "success") {
      console.log(`\nResult: ${message.result}`);
    }
  }
  ```
</CodeGroup>

각 소스는 특정 위치에서 설정을 로드합니다. 여기서 `<cwd>`는 `cwd` 옵션을 통해 전달하는 작업 디렉토리이거나, 설정되지 않은 경우 프로세스의 현재 디렉토리입니다. 전체 타입 정의는 [`SettingSource`](/ko/agent-sdk/typescript#settingsource)(TypeScript) 또는 [`SettingSource`](/ko/agent-sdk/python#settingsource)(Python)을 참조하세요.

| 소스          | 로드되는 항목                                                                     | 위치                                                                                                                           |
| :---------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `"project"` | 프로젝트 CLAUDE.md, `.claude/rules/*.md`, 프로젝트 스킬, 프로젝트 훅, 프로젝트 `settings.json` | `<cwd>/.claude/` (`settings.json` 및 훅의 경우); `<cwd>` 및 모든 상위 디렉토리(CLAUDE.md 및 규칙의 경우); `<cwd>` 및 저장소 루트까지의 모든 상위 디렉토리(스킬의 경우) |
| `"user"`    | 사용자 CLAUDE.md, `~/.claude/rules/*.md`, 사용자 스킬, 사용자 설정                       | `~/.claude/`                                                                                                                 |
| `"local"`   | CLAUDE.local.md, `.claude/settings.local.json`                              | `<cwd>/.claude/` (`settings.local.json`의 경우); `<cwd>` 및 모든 상위 디렉토리(CLAUDE.local.md의 경우)                                      |

`settingSources`를 생략하는 것은 `["user", "project", "local"]`과 동일합니다.

`cwd` 옵션은 SDK가 프로젝트 수준 입력을 찾는 위치를 결정합니다. CLAUDE.md와 규칙은 `<cwd>`와 모든 상위 디렉토리에서 로드됩니다. 스킬은 `<cwd>`와 저장소 루트까지의 모든 상위 디렉토리에서 로드됩니다. 프로젝트 `settings.json`과 훅은 `<cwd>/.claude/`에서만 로드되며 상위 디렉토리 폴백이 없습니다.

### settingSources가 제어하지 않는 것

`settingSources`는 사용자, 프로젝트 및 로컬 설정을 다룹니다. 몇 가지 입력은 해당 값과 관계없이 읽혀집니다:

| 입력                                             | 동작                  | 비활성화하려면                                                                              |
| :--------------------------------------------- | :------------------ | :----------------------------------------------------------------------------------- |
| 관리형 정책 설정                                      | 호스트에 있을 때 항상 로드됨    | 관리형 설정 파일 제거                                                                         |
| `~/.claude.json` 전역 구성                         | 항상 읽음               | `env`의 `CLAUDE_CONFIG_DIR`로 재배치                                                      |
| `~/.claude/projects/<project>/memory/`의 자동 메모리 | 기본적으로 시스템 프롬프트에 로드됨 | 설정에서 `autoMemoryEnabled: false` 설정 또는 `env`에서 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 설정 |

<Warning>
  다중 테넌트 격리를 위해 기본 `query()` 옵션에 의존하지 마세요. 위의 입력이 `settingSources`와 관계없이 읽혀지므로, SDK 프로세스는 호스트 수준 구성 및 디렉토리별 메모리를 선택할 수 있습니다. 다중 테넌트 배포의 경우 각 테넌트를 자체 파일시스템에서 실행하고 `settingSources: []` 및 `env`에서 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`을 설정합니다. [안전한 배포](/ko/agent-sdk/secure-deployment)를 참조하세요.
</Warning>

## 프로젝트 지침(CLAUDE.md 및 규칙)

`CLAUDE.md` 파일 및 `.claude/rules/*.md` 파일은 에이전트에 프로젝트에 대한 지속적인 컨텍스트를 제공합니다: 코딩 규칙, 빌드 명령, 아키텍처 결정 및 지침입니다. `settingSources`에 `"project"`가 포함되면(위의 예제처럼), SDK는 세션 시작 시 이 파일들을 컨텍스트에 로드합니다. 그러면 에이전트는 모든 프롬프트에서 반복하지 않고도 프로젝트 규칙을 따릅니다.

### CLAUDE.md 로드 위치

| 수준            | 위치                                                            | 로드 시기                                                               |
| :------------ | :------------------------------------------------------------ | :------------------------------------------------------------------ |
| 프로젝트(루트)      | `<cwd>/CLAUDE.md` 또는 `<cwd>/.claude/CLAUDE.md`                | `settingSources`에 `"project"` 포함                                    |
| 프로젝트 규칙       | `<cwd>/.claude/rules/*.md` 및 모든 상위 디렉토리의 `.claude/rules/*.md` | `settingSources`에 `"project"` 포함                                    |
| 프로젝트(상위 디렉토리) | `cwd` 위의 디렉토리에 있는 `CLAUDE.md` 파일                              | `settingSources`에 `"project"` 포함, 세션 시작 시 로드                        |
| 프로젝트(하위 디렉토리) | `cwd`의 하위 디렉토리에 있는 `CLAUDE.md` 파일                             | `settingSources`에 `"project"` 포함, 에이전트가 해당 서브트리의 파일을 읽을 때 필요에 따라 로드 |
| 로컬            | `<cwd>/CLAUDE.local.md` 및 모든 상위 디렉토리의 `CLAUDE.local.md`       | `settingSources`에 `"local"` 포함                                      |
| 사용자           | `~/.claude/CLAUDE.md`                                         | `settingSources`에 `"user"` 포함                                       |
| 사용자 규칙        | `~/.claude/rules/*.md`                                        | `settingSources`에 `"user"` 포함                                       |

모든 수준은 누적됩니다: 프로젝트 및 사용자 CLAUDE.md 파일이 모두 존재하면 에이전트는 둘 다 봅니다. 수준 간에 하드 우선순위 규칙은 없습니다. 지침이 충돌하면 결과는 Claude가 해석하는 방식에 따라 달라집니다. 충돌하지 않는 규칙을 작성하거나 더 구체적인 파일에서 명시적으로 우선순위를 명시합니다("이 프로젝트 지침은 충돌하는 모든 사용자 수준 기본값을 재정의합니다").

<Tip>
  `systemPrompt`를 통해 CLAUDE.md 파일을 사용하지 않고도 컨텍스트를 직접 주입할 수 있습니다. [시스템 프롬프트 수정](/ko/agent-sdk/modifying-system-prompts)을 참조하세요. 대화형 Claude Code 세션과 SDK 에이전트 간에 동일한 컨텍스트를 공유하려면 CLAUDE.md를 사용합니다.
</Tip>

CLAUDE.md 콘텐츠를 구조화하고 구성하는 방법은 [Claude의 메모리 관리](/ko/memory)를 참조하세요.

## 스킬

스킬은 에이전트에 전문 지식과 호출 가능한 워크플로우를 제공하는 마크다운 파일입니다. `CLAUDE.md`(모든 세션에서 로드)와 달리 스킬은 필요에 따라 로드됩니다. 에이전트는 시작 시 스킬 설명을 받고 관련이 있을 때 전체 콘텐츠를 로드합니다.

스킬은 `settingSources`를 통해 파일시스템에서 발견됩니다. `query()`에서 `skills` 옵션을 생략하면 발견된 사용자 및 프로젝트 스킬이 활성화되고 Skill 도구를 사용할 수 있으며, CLI 동작과 일치합니다. 활성화된 스킬을 제어하려면 `skills`를 `"all"`, 스킬 이름 목록 또는 모두 비활성화하려면 `[]`로 전달합니다. SDK는 `skills`가 설정되면 Skill 도구를 자동으로 활성화하므로 `allowedTools`에 추가할 필요가 없습니다.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

  # Skills in .claude/skills/ are discovered automatically
  # when settingSources includes "project"
  async for message in query(
      prompt="Review this PR using our code review checklist",
      options=ClaudeAgentOptions(
          setting_sources=["user", "project"],
          skills="all",
          allowed_tools=["Read", "Grep", "Glob"],
      ),
  ):
      if isinstance(message, ResultMessage) and message.subtype == "success":
          print(message.result)
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Skills in .claude/skills/ are discovered automatically
  // when settingSources includes "project"
  for await (const message of query({
    prompt: "Review this PR using our code review checklist",
    options: {
      settingSources: ["user", "project"],
      skills: "all",
      allowedTools: ["Read", "Grep", "Glob"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

<Note>
  스킬은 파일시스템 아티팩트(`.claude/skills/<name>/SKILL.md`)로 생성되어야 합니다. SDK에는 스킬을 등록하기 위한 프로그래밍 방식 API가 없습니다. 전체 세부 정보는 [SDK의 에이전트 스킬](/ko/agent-sdk/skills)을 참조하세요.
</Note>

스킬 생성 및 사용에 대한 자세한 내용은 [SDK의 에이전트 스킬](/ko/agent-sdk/skills)을 참조하세요.

## 훅

SDK는 훅을 정의하는 두 가지 방법을 지원하며, 이들은 나란히 실행됩니다:

* **파일시스템 훅:** `settings.json`에 정의된 셸 명령, `settingSources`에 관련 소스가 포함될 때 로드됩니다. 이는 [대화형 Claude Code 세션](/ko/hooks-guide)에 대해 구성하는 것과 동일한 훅입니다.
* **프로그래밍 방식 훅:** `query()`에 직접 전달되는 콜백 함수입니다. 이들은 애플리케이션 프로세스에서 실행되며 구조화된 결정을 반환할 수 있습니다. [훅으로 실행 제어](/ko/agent-sdk/hooks)를 참조하세요.

두 유형 모두 동일한 훅 수명 주기 동안 실행됩니다. 프로젝트의 `.claude/settings.json`에 이미 훅이 있고 `settingSources: ["project"]`를 설정하면 추가 구성 없이 SDK에서 해당 훅이 자동으로 실행됩니다.

훅 콜백은 도구 입력을 받고 결정 딕셔너리를 반환합니다. `{}`(빈 딕셔너리)를 반환하면 도구가 진행되도록 허용합니다. `{"decision": "block", "reason": "..."}`를 반환하면 실행이 방지되고 이유가 도구 결과로 Claude에 전송됩니다. 전체 콜백 서명 및 반환 유형은 [훅 가이드](/ko/agent-sdk/hooks)를 참조하세요.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, ResultMessage


  # PreToolUse hook callback. Positional args:
  #   input_data: HookInput dict with tool_name, tool_input, hook_event_name
  #   tool_use_id: str | None, the ID of the tool call being intercepted
  #   context: HookContext, carries session metadata
  async def audit_bash(input_data, tool_use_id, context):
      command = input_data.get("tool_input", {}).get("command", "")
      if "rm -rf" in command:
          return {"decision": "block", "reason": "Destructive command blocked"}
      return {}  # Empty dict: allow the tool to proceed


  # Filesystem hooks from .claude/settings.json run automatically
  # when settingSources loads them. You can also add programmatic hooks:
  async for message in query(
      prompt="Refactor the auth module",
      options=ClaudeAgentOptions(
          setting_sources=["project"],  # Loads hooks from .claude/settings.json
          hooks={
              "PreToolUse": [
                  HookMatcher(matcher="Bash", hooks=[audit_bash]),
              ]
          },
      ),
  ):
      if isinstance(message, ResultMessage) and message.subtype == "success":
          print(message.result)
  ```

  ```typescript TypeScript theme={null}
  import { query, type HookInput, type HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

  // PreToolUse hook callback. HookInput is a discriminated union on
  // hook_event_name, so narrowing on it gives TypeScript the right
  // tool_input shape for this event.
  const auditBash = async (input: HookInput): Promise<HookJSONOutput> => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const toolInput = input.tool_input as { command?: string };
    if (toolInput.command?.includes("rm -rf")) {
      return { decision: "block", reason: "Destructive command blocked" };
    }
    return {}; // Empty object: allow the tool to proceed
  };

  // Filesystem hooks from .claude/settings.json run automatically
  // when settingSources loads them. You can also add programmatic hooks:
  for await (const message of query({
    prompt: "Refactor the auth module",
    options: {
      settingSources: ["project"], // Loads hooks from .claude/settings.json
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [auditBash] }]
      }
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

### 어느 훅 유형을 사용할지

| 훅 유형                         | 최적 사용                                                                                                                                                                                            |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **파일시스템** (`settings.json`)  | CLI와 SDK 세션 간에 훅 공유. `"command"`(셸 스크립트), `"http"`(엔드포인트에 POST), `"mcp_tool"`(연결된 MCP 서버의 도구 호출), `"prompt"`(LLM이 프롬프트 평가), `"agent"`(검증자 에이전트 생성)를 지원합니다. 이들은 주 에이전트 및 생성하는 모든 하위 에이전트에서 실행됩니다. |
| **프로그래밍 방식** (`query()`의 콜백) | 애플리케이션 특정 로직; 구조화된 결정 반환; 프로세스 내 통합. 주 세션으로만 범위가 지정됩니다.                                                                                                                                          |

<Note>
  TypeScript SDK는 Python을 넘어 `SessionStart`, `SessionEnd`, `TeammateIdle` 및 `TaskCompleted`를 포함한 추가 훅 이벤트를 지원합니다. 전체 이벤트 호환성 표는 [훅 가이드](/ko/agent-sdk/hooks)를 참조하세요.
</Note>

프로그래밍 방식 훅에 대한 전체 세부 정보는 [훅으로 실행 제어](/ko/agent-sdk/hooks)를 참조하세요. 파일시스템 훅 구문은 [훅](/ko/hooks)을 참조하세요.

## 올바른 기능 선택하기

Agent SDK는 에이전트의 동작을 확장하는 여러 방법에 접근할 수 있게 합니다. 어느 것을 사용할지 확실하지 않으면 이 표는 일반적인 목표를 올바른 접근 방식에 매핑합니다.

| 원하는 것                                             | 사용                                            | SDK 표면                                                                          |
| :------------------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------ |
| 에이전트가 항상 따르는 프로젝트 규칙 설정                           | [CLAUDE.md](/ko/memory)                       | `settingSources: ["project"]`가 자동으로 로드합니다                                       |
| 에이전트가 관련이 있을 때 로드하는 참고 자료 제공                      | [Skills](/ko/agent-sdk/skills)                | `settingSources` + `skills` 옵션                                                  |
| 재사용 가능한 워크플로우 실행(배포, 검토, 릴리스)                     | [User-invocable skills](/ko/agent-sdk/skills) | `settingSources` + `skills` 옵션                                                  |
| 격리된 하위 작업을 새로운 컨텍스트에 위임(연구, 검토)                   | [Subagents](/ko/agent-sdk/subagents)          | `agents` 매개변수 + `allowedTools: ["Agent"]`                                       |
| 공유 작업 목록 및 직접 에이전트 간 메시징으로 여러 Claude Code 인스턴스 조정 | [Agent teams](/ko/agent-teams)                | SDK 옵션을 통해 직접 구성되지 않습니다. 에이전트 팀은 한 세션이 팀 리더로 작동하여 독립적인 팀원 간의 작업을 조정하는 CLI 기능입니다 |
| 도구 호출에서 결정론적 로직 실행(감사, 차단, 변환)                    | [Hooks](/ko/agent-sdk/hooks)                  | 콜백이 있는 `hooks` 매개변수 또는 `settingSources`를 통해 로드된 셸 스크립트                          |
| Claude에 외부 서비스에 대한 구조화된 도구 접근 제공                  | [MCP](/ko/agent-sdk/mcp)                      | `mcpServers` 매개변수                                                               |

<Tip>
  **Subagents 대 agent teams:** Subagents는 임시적이고 격리됩니다: 새로운 대화, 한 가지 작업, 부모에게 반환된 요약. Agent teams는 공유 작업 목록을 공유하고 직접 메시지를 주고받는 여러 독립적인 Claude Code 인스턴스를 조정합니다. Agent teams는 CLI 기능입니다. [What subagents inherit](/ko/agent-sdk/subagents#what-subagents-inherit) 및 [agent teams 비교](/ko/agent-teams#compare-with-subagents)를 참조하세요.
</Tip>

활성화하는 모든 기능은 에이전트의 컨텍스트 윈도우에 추가됩니다. 기능별 비용 및 이 기능들이 함께 계층화되는 방식은 [Extend Claude Code](/ko/features-overview#understand-context-costs)를 참조하세요.

## 관련 리소스

* [Claude Code 확장](/ko/features-overview): 모든 확장 기능의 개념적 개요, 비교 표 및 컨텍스트 비용 분석
* [SDK의 스킬](/ko/agent-sdk/skills): 프로그래밍 방식으로 스킬을 사용하는 전체 가이드
* [하위 에이전트](/ko/agent-sdk/subagents): 격리된 하위 작업을 위한 하위 에이전트 정의 및 호출
* [훅](/ko/agent-sdk/hooks): 주요 실행 지점에서 에이전트 동작 가로채기 및 제어
* [권한](/ko/agent-sdk/permissions): 모드, 규칙 및 콜백으로 도구 접근 제어
* [시스템 프롬프트](/ko/agent-sdk/modifying-system-prompts): CLAUDE.md 파일 없이 컨텍스트 주입

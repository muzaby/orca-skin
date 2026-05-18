> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK의 서브에이전트

> 서브에이전트를 정의하고 호출하여 컨텍스트를 격리하고, 작업을 병렬로 실행하며, Claude Agent SDK 애플리케이션에서 특화된 지침을 적용합니다.

서브에이전트는 메인 에이전트가 집중된 부작업을 처리하기 위해 생성할 수 있는 별도의 에이전트 인스턴스입니다.
서브에이전트를 사용하여 집중된 부작업의 컨텍스트를 격리하고, 여러 분석을 병렬로 실행하며, 메인 에이전트의 프롬프트를 비대하게 만들지 않으면서 특화된 지침을 적용합니다.

이 가이드에서는 `agents` 매개변수를 사용하여 SDK에서 서브에이전트를 정의하고 사용하는 방법을 설명합니다.

## 개요

서브에이전트를 세 가지 방법으로 생성할 수 있습니다.

* **프로그래밍 방식**: `query()` 옵션에서 `agents` 매개변수 사용 ([TypeScript](/ko/agent-sdk/typescript#agentdefinition), [Python](/ko/agent-sdk/python#agentdefinition))
* **파일 시스템 기반**: `.claude/agents/` 디렉토리에 마크다운 파일로 에이전트 정의 ([서브에이전트를 파일로 정의](/ko/sub-agents) 참조)
* **기본 제공 범용**: Claude는 언제든지 Agent 도구를 통해 기본 제공 `general-purpose` 서브에이전트를 호출할 수 있습니다.

이 가이드는 SDK 애플리케이션에 권장되는 프로그래밍 방식에 중점을 둡니다.

서브에이전트를 정의할 때, Claude는 각 서브에이전트의 `description` 필드를 기반으로 호출할지 여부를 결정합니다. 서브에이전트를 사용해야 할 때를 설명하는 명확한 설명을 작성하면, Claude가 자동으로 적절한 작업을 위임합니다. 프롬프트에서 서브에이전트를 이름으로 명시적으로 요청할 수도 있습니다(예: "code-reviewer 에이전트를 사용하여...").

## 서브에이전트 사용의 이점

### 컨텍스트 격리

각 서브에이전트는 자체 새로운 대화에서 실행됩니다. 중간 도구 호출 및 결과는 서브에이전트 내부에 유지되며, 최종 메시지만 부모에게 반환됩니다. [서브에이전트가 상속하는 것](#what-subagents-inherit)을 참조하여 서브에이전트의 컨텍스트에 정확히 무엇이 있는지 확인하세요.

**예시:** `research-assistant` 서브에이전트는 수십 개의 파일을 탐색할 수 있으며, 그 콘텐츠 중 어느 것도 메인 대화에 누적되지 않습니다. 부모는 서브에이전트가 읽은 모든 파일이 아닌 간결한 요약을 받습니다.

### 병렬화

여러 서브에이전트를 동시에 실행하여 복잡한 워크플로우의 속도를 대폭 향상시킬 수 있습니다.

**예시:** 코드 리뷰 중에 `style-checker`, `security-scanner`, `test-coverage` 서브에이전트를 동시에 실행하여 리뷰 시간을 분 단위에서 초 단위로 단축할 수 있습니다.

### 특화된 지침 및 지식

각 서브에이전트는 특정 전문 지식, 모범 사례 및 제약 조건이 있는 맞춤형 시스템 프롬프트를 가질 수 있습니다.

**예시:** `database-migration` 서브에이전트는 SQL 모범 사례, 롤백 전략 및 데이터 무결성 검사에 대한 상세한 지식을 가질 수 있으며, 이는 메인 에이전트의 지침에서는 불필요한 노이즈입니다.

### 도구 제한

서브에이전트는 특정 도구로 제한되어 의도하지 않은 작업의 위험을 줄입니다.

**예시:** `doc-reviewer` 서브에이전트는 Read 및 Grep 도구에만 액세스할 수 있으므로, 문서 파일을 분석할 수 있지만 실수로 수정할 수 없습니다.

## 서브에이전트 생성

### 프로그래밍 방식 정의 (권장)

`agents` 매개변수를 사용하여 코드에서 직접 서브에이전트를 정의합니다. 이 예시는 읽기 전용 액세스가 있는 코드 리뷰어와 명령을 실행할 수 있는 테스트 러너라는 두 개의 서브에이전트를 생성합니다. Claude가 Agent 도구를 통해 서브에이전트를 호출하므로 `allowedTools`에 `Agent` 도구를 포함해야 합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition


  async def main():
      async for message in query(
          prompt="Review the authentication module for security issues",
          options=ClaudeAgentOptions(
              # Agent tool is required for subagent invocation
              allowed_tools=["Read", "Grep", "Glob", "Agent"],
              agents={
                  "code-reviewer": AgentDefinition(
                      # description tells Claude when to use this subagent
                      description="Expert code review specialist. Use for quality, security, and maintainability reviews.",
                      # prompt defines the subagent's behavior and expertise
                      prompt="""You are a code review specialist with expertise in security, performance, and best practices.

  When reviewing code:
  - Identify security vulnerabilities
  - Check for performance issues
  - Verify adherence to coding standards
  - Suggest specific improvements

  Be thorough but concise in your feedback.""",
                      # tools restricts what the subagent can do (read-only here)
                      tools=["Read", "Grep", "Glob"],
                      # model overrides the default model for this subagent
                      model="sonnet",
                  ),
                  "test-runner": AgentDefinition(
                      description="Runs and analyzes test suites. Use for test execution and coverage analysis.",
                      prompt="""You are a test execution specialist. Run tests and provide clear analysis of results.

  Focus on:
  - Running test commands
  - Analyzing test output
  - Identifying failing tests
  - Suggesting fixes for failures""",
                      # Bash access lets this subagent run test commands
                      tools=["Bash", "Read", "Grep"],
                  ),
              },
          ),
      ):
          if hasattr(message, "result"):
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Review the authentication module for security issues",
    options: {
      // Agent tool is required for subagent invocation
      allowedTools: ["Read", "Grep", "Glob", "Agent"],
      agents: {
        "code-reviewer": {
          // description tells Claude when to use this subagent
          description:
            "Expert code review specialist. Use for quality, security, and maintainability reviews.",
          // prompt defines the subagent's behavior and expertise
          prompt: `You are a code review specialist with expertise in security, performance, and best practices.

  When reviewing code:
  - Identify security vulnerabilities
  - Check for performance issues
  - Verify adherence to coding standards
  - Suggest specific improvements

  Be thorough but concise in your feedback.`,
          // tools restricts what the subagent can do (read-only here)
          tools: ["Read", "Grep", "Glob"],
          // model overrides the default model for this subagent
          model: "sonnet"
        },
        "test-runner": {
          description:
            "Runs and analyzes test suites. Use for test execution and coverage analysis.",
          prompt: `You are a test execution specialist. Run tests and provide clear analysis of results.

  Focus on:
  - Running test commands
  - Analyzing test output
  - Identifying failing tests
  - Suggesting fixes for failures`,
          // Bash access lets this subagent run test commands
          tools: ["Bash", "Read", "Grep"]
        }
      }
    }
  })) {
    if ("result" in message) console.log(message.result);
  }
  ```
</CodeGroup>

### AgentDefinition 구성

| 필드                | 유형                                                          | 필수  | 설명                                                                                                               |
| :---------------- | :---------------------------------------------------------- | :-- | :--------------------------------------------------------------------------------------------------------------- |
| `description`     | `string`                                                    | 예   | 이 에이전트를 사용할 때를 설명하는 자연어 설명                                                                                       |
| `prompt`          | `string`                                                    | 예   | 에이전트의 역할과 동작을 정의하는 시스템 프롬프트                                                                                      |
| `tools`           | `string[]`                                                  | 아니오 | 허용된 도구 이름의 배열입니다. 생략하면 모든 도구를 상속합니다.                                                                             |
| `disallowedTools` | `string[]`                                                  | 아니오 | 에이전트의 도구 세트에서 제거할 도구 이름의 배열                                                                                      |
| `model`           | `string`                                                    | 아니오 | 이 에이전트의 모델 재정의입니다. `'sonnet'`, `'opus'`, `'haiku'`, `'inherit'` 또는 전체 모델 ID와 같은 별칭을 허용합니다. 생략하면 메인 모델로 기본 설정됩니다. |
| `skills`          | `string[]`                                                  | 아니오 | 시작 시 에이전트의 컨텍스트에 미리 로드할 스킬 이름 목록입니다. 나열되지 않은 스킬은 Skill 도구를 통해 호출 가능합니다.                                          |
| `memory`          | `'user' \| 'project' \| 'local'`                            | 아니오 | 이 에이전트의 메모리 소스                                                                                                   |
| `mcpServers`      | `(string \| object)[]`                                      | 아니오 | 이 에이전트가 사용할 수 있는 MCP 서버(이름 또는 인라인 구성)                                                                            |
| `maxTurns`        | `number`                                                    | 아니오 | 에이전트가 중지되기 전의 최대 에이전트 턴 수                                                                                        |
| `background`      | `boolean`                                                   | 아니오 | 호출될 때 이 에이전트를 비차단 백그라운드 작업으로 실행합니다.                                                                              |
| `effort`          | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max' \| number` | 아니오 | 이 에이전트의 추론 노력 수준                                                                                                 |
| `permissionMode`  | `PermissionMode`                                            | 아니오 | 이 에이전트 내의 도구 실행을 위한 권한 모드                                                                                        |

Python SDK에서 이러한 필드 이름은 와이어 형식과 일치하도록 camelCase를 사용합니다. 자세한 내용은 [`AgentDefinition` 참조](/ko/agent-sdk/python#agentdefinition)를 참조하세요.

<Note>
  서브에이전트는 자신의 서브에이전트를 생성할 수 없습니다. 서브에이전트의 `tools` 배열에 `Agent`를 포함하지 마세요.
</Note>

### 파일 시스템 기반 정의 (대안)

`.claude/agents/` 디렉토리에 마크다운 파일로 서브에이전트를 정의할 수도 있습니다. 이 방식에 대한 자세한 내용은 [Claude Code 서브에이전트 문서](/ko/sub-agents)를 참조하세요. 프로그래밍 방식으로 정의된 에이전트는 같은 이름의 파일 시스템 기반 에이전트보다 우선합니다.

<Note>
  사용자 정의 서브에이전트를 정의하지 않더라도, `Agent`가 `allowedTools`에 있으면 Claude는 기본 제공 `general-purpose` 서브에이전트를 생성할 수 있습니다. 이는 특화된 에이전트를 만들지 않고도 연구 또는 탐색 작업을 위임하는 데 유용합니다.
</Note>

## 서브에이전트가 상속하는 것

서브에이전트의 컨텍스트 윈도우는 새로 시작되지만(부모 대화 없음) 비어 있지 않습니다. 부모에서 서브에이전트로의 유일한 채널은 Agent 도구의 프롬프트 문자열이므로, 서브에이전트가 필요한 파일 경로, 오류 메시지 또는 결정을 해당 프롬프트에 직접 포함하세요.

| 서브에이전트가 받는 것                                           | 서브에이전트가 받지 않는 것                                    |
| :----------------------------------------------------- | :------------------------------------------------- |
| 자신의 시스템 프롬프트(`AgentDefinition.prompt`)와 Agent 도구의 프롬프트 | 부모의 대화 기록 또는 도구 결과                                 |
| 프로젝트 CLAUDE.md (`settingSources`를 통해 로드됨)              | 미리 로드된 스킬 콘텐츠(`AgentDefinition.skills`에 나열된 경우 제외) |
| 도구 정의 (부모에서 상속되거나 `tools`의 부분 집합)                      | 부모의 시스템 프롬프트                                       |

<Note>
  부모는 서브에이전트의 최종 메시지를 Agent 도구 결과로 그대로 받지만, 자신의 응답에서 요약할 수 있습니다. 서브에이전트 출력을 사용자 대면 응답에서 그대로 유지하려면, **메인** `query()` 호출에 전달하는 프롬프트 또는 `systemPrompt` 옵션에 그렇게 하도록 지시하는 지침을 포함하세요.
</Note>

## 서브에이전트 호출

### 자동 호출

Claude는 작업과 각 서브에이전트의 `description`을 기반으로 서브에이전트를 호출할 시기를 자동으로 결정합니다. 예를 들어, "쿼리 튜닝을 위한 성능 최적화 전문가"라는 설명이 있는 `performance-optimizer` 서브에이전트를 정의하면, Claude는 프롬프트에서 쿼리 최적화를 언급할 때 이를 호출합니다.

Claude가 작업을 올바른 서브에이전트와 일치시킬 수 있도록 명확하고 구체적인 설명을 작성하세요.

### 명시적 호출

Claude가 특정 서브에이전트를 사용하도록 보장하려면, 프롬프트에서 이름으로 언급하세요.

```text theme={null}
"Use the code-reviewer agent to check the authentication module"
```

이는 자동 일치를 우회하고 명명된 서브에이전트를 직접 호출합니다.

### 동적 에이전트 구성

런타임 조건에 따라 에이전트 정의를 동적으로 생성할 수 있습니다. 이 예시는 다양한 엄격함 수준의 보안 리뷰어를 생성하며, 엄격한 리뷰에는 더 강력한 모델을 사용합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition


  # Factory function that returns an AgentDefinition
  # This pattern lets you customize agents based on runtime conditions
  def create_security_agent(security_level: str) -> AgentDefinition:
      is_strict = security_level == "strict"
      return AgentDefinition(
          description="Security code reviewer",
          # Customize the prompt based on strictness level
          prompt=f"You are a {'strict' if is_strict else 'balanced'} security reviewer...",
          tools=["Read", "Grep", "Glob"],
          # Key insight: use a more capable model for high-stakes reviews
          model="opus" if is_strict else "sonnet",
      )


  async def main():
      # The agent is created at query time, so each request can use different settings
      async for message in query(
          prompt="Review this PR for security issues",
          options=ClaudeAgentOptions(
              allowed_tools=["Read", "Grep", "Glob", "Agent"],
              agents={
                  # Call the factory with your desired configuration
                  "security-reviewer": create_security_agent("strict")
              },
          ),
      ):
          if hasattr(message, "result"):
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

  // Factory function that returns an AgentDefinition
  // This pattern lets you customize agents based on runtime conditions
  function createSecurityAgent(securityLevel: "basic" | "strict"): AgentDefinition {
    const isStrict = securityLevel === "strict";
    return {
      description: "Security code reviewer",
      // Customize the prompt based on strictness level
      prompt: `You are a ${isStrict ? "strict" : "balanced"} security reviewer...`,
      tools: ["Read", "Grep", "Glob"],
      // Key insight: use a more capable model for high-stakes reviews
      model: isStrict ? "opus" : "sonnet"
    };
  }

  // The agent is created at query time, so each request can use different settings
  for await (const message of query({
    prompt: "Review this PR for security issues",
    options: {
      allowedTools: ["Read", "Grep", "Glob", "Agent"],
      agents: {
        // Call the factory with your desired configuration
        "security-reviewer": createSecurityAgent("strict")
      }
    }
  })) {
    if ("result" in message) console.log(message.result);
  }
  ```
</CodeGroup>

## 서브에이전트 호출 감지

서브에이전트는 Agent 도구를 통해 호출됩니다. 서브에이전트가 호출될 때를 감지하려면, `name`이 `"Agent"`인 `tool_use` 블록을 확인하세요. 서브에이전트의 컨텍스트 내에서의 메시지에는 `parent_tool_use_id` 필드가 포함됩니다.

<Note>
  도구 이름은 Claude Code v2.1.63에서 `"Task"`에서 `"Agent"`로 변경되었습니다. 현재 SDK 릴리스는 `tool_use` 블록에서 `"Agent"`를 내보내지만 여전히 `system:init` 도구 목록과 `result.permission_denials[].tool_name`에서 `"Task"`를 사용합니다. `block.name`에서 두 값을 모두 확인하면 SDK 버전 간 호환성이 보장됩니다.
</Note>

이 예시는 스트리밍된 메시지를 반복하여 서브에이전트가 호출될 때와 후속 메시지가 해당 서브에이전트의 실행 컨텍스트 내에서 시작될 때를 기록합니다.

<Note>
  메시지 구조는 SDK 간에 다릅니다. Python에서는 콘텐츠 블록이 `message.content`를 통해 직접 액세스됩니다. TypeScript에서는 `SDKAssistantMessage`가 Claude API 메시지를 래핑하므로 콘텐츠는 `message.message.content`를 통해 액세스됩니다.
</Note>

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition, ToolUseBlock


  async def main():
      async for message in query(
          prompt="Use the code-reviewer agent to review this codebase",
          options=ClaudeAgentOptions(
              allowed_tools=["Read", "Glob", "Grep", "Agent"],
              agents={
                  "code-reviewer": AgentDefinition(
                      description="Expert code reviewer.",
                      prompt="Analyze code quality and suggest improvements.",
                      tools=["Read", "Glob", "Grep"],
                  )
              },
          ),
      ):
          # Check for subagent invocation. Match both names: older SDK
          # versions emitted "Task", current versions emit "Agent".
          if hasattr(message, "content") and message.content:
              for block in message.content:
                  if isinstance(block, ToolUseBlock) and block.name in (
                      "Task",
                      "Agent",
                  ):
                      print(f"Subagent invoked: {block.input.get('subagent_type')}")

          # Check if this message is from within a subagent's context
          if hasattr(message, "parent_tool_use_id") and message.parent_tool_use_id:
              print("  (running inside subagent)")

          if hasattr(message, "result"):
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Use the code-reviewer agent to review this codebase",
    options: {
      allowedTools: ["Read", "Glob", "Grep", "Agent"],
      agents: {
        "code-reviewer": {
          description: "Expert code reviewer.",
          prompt: "Analyze code quality and suggest improvements.",
          tools: ["Read", "Glob", "Grep"]
        }
      }
    }
  })) {
    const msg = message as any;

    // Check for subagent invocation. Match both names: older SDK versions
    // emitted "Task", current versions emit "Agent".
    for (const block of msg.message?.content ?? []) {
      if (block.type === "tool_use" && (block.name === "Task" || block.name === "Agent")) {
        console.log(`Subagent invoked: ${block.input.subagent_type}`);
      }
    }

    // Check if this message is from within a subagent's context
    if (msg.parent_tool_use_id) {
      console.log("  (running inside subagent)");
    }

    if ("result" in message) {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

## 서브에이전트 재개

서브에이전트를 재개하여 중단한 지점에서 계속할 수 있습니다. 재개된 서브에이전트는 이전의 모든 도구 호출, 결과 및 추론을 포함한 전체 대화 기록을 유지합니다. 서브에이전트는 새로 시작하는 대신 정확히 중단한 지점에서 계속됩니다.

서브에이전트가 완료되면, Claude는 Agent 도구 결과에서 에이전트 ID를 받습니다. 서브에이전트를 프로그래밍 방식으로 재개하려면:

1. **세션 ID 캡처**: 첫 번째 쿼리 중에 메시지에서 `session_id` 추출
2. **에이전트 ID 추출**: 메시지 콘텐츠에서 `agentId` 파싱
3. **세션 재개**: 두 번째 쿼리의 옵션에서 `resume: sessionId`를 전달하고, 프롬프트에 에이전트 ID 포함

<Note>
  서브에이전트의 트랜스크립트에 액세스하려면 같은 세션을 재개해야 합니다. 각 `query()` 호출은 기본적으로 새 세션을 시작하므로, 같은 세션에서 계속하려면 `resume: sessionId`를 전달하세요.

  기본 제공 에이전트가 아닌 사용자 정의 에이전트를 사용하는 경우, 두 쿼리 모두에서 `agents` 매개변수에 같은 에이전트 정의를 전달해야 합니다.
</Note>

아래 예시는 이 흐름을 보여줍니다. 첫 번째 쿼리는 서브에이전트를 실행하고 세션 ID와 에이전트 ID를 캡처하고, 두 번째 쿼리는 세션을 재개하여 첫 번째 분석의 컨텍스트가 필요한 후속 질문을 합니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

  // Helper to extract agentId from message content
  // Stringify to avoid traversing different block types (TextBlock, ToolResultBlock, etc.)
  function extractAgentId(message: SDKMessage): string | undefined {
    if (message.type !== "assistant" && message.type !== "user") return undefined;
    // Stringify the content so we can search it without traversing nested blocks
    const content = JSON.stringify(message.message.content);
    const match = content.match(/agentId:\s*([a-f0-9-]+)/);
    return match?.[1];
  }

  let agentId: string | undefined;
  let sessionId: string | undefined;

  // First invocation - use the Explore agent to find API endpoints
  for await (const message of query({
    prompt: "Use the Explore agent to find all API endpoints in this codebase",
    options: { allowedTools: ["Read", "Grep", "Glob", "Agent"] }
  })) {
    // Capture session_id from ResultMessage (needed to resume this session)
    if ("session_id" in message) sessionId = message.session_id;
    // Search message content for the agentId (appears in Agent tool results)
    const extractedId = extractAgentId(message);
    if (extractedId) agentId = extractedId;
    // Print the final result
    if ("result" in message) console.log(message.result);
  }

  // Second invocation - resume and ask follow-up
  if (agentId && sessionId) {
    for await (const message of query({
      prompt: `Resume agent ${agentId} and list the top 3 most complex endpoints`,
      options: { allowedTools: ["Read", "Grep", "Glob", "Agent"], resume: sessionId }
    })) {
      if ("result" in message) console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  import json
  import re
  from claude_agent_sdk import query, ClaudeAgentOptions


  def extract_agent_id(text: str) -> str | None:
      """Extract agentId from Agent tool result text."""
      match = re.search(r"agentId:\s*([a-f0-9-]+)", text)
      return match.group(1) if match else None


  async def main():
      agent_id = None
      session_id = None

      # First invocation - use the Explore agent to find API endpoints
      async for message in query(
          prompt="Use the Explore agent to find all API endpoints in this codebase",
          options=ClaudeAgentOptions(allowed_tools=["Read", "Grep", "Glob", "Agent"]),
      ):
          # Capture session_id from ResultMessage (needed to resume this session)
          if hasattr(message, "session_id"):
              session_id = message.session_id
          # Search message content for the agentId (appears in Agent tool results)
          if hasattr(message, "content"):
              # Stringify the content so we can search it without traversing nested blocks
              content_str = json.dumps(message.content, default=str)
              extracted = extract_agent_id(content_str)
              if extracted:
                  agent_id = extracted
          # Print the final result
          if hasattr(message, "result"):
              print(message.result)

      # Second invocation - resume and ask follow-up
      if agent_id and session_id:
          async for message in query(
              prompt=f"Resume agent {agent_id} and list the top 3 most complex endpoints",
              options=ClaudeAgentOptions(
                  allowed_tools=["Read", "Grep", "Glob", "Agent"], resume=session_id
              ),
          ):
              if hasattr(message, "result"):
                  print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

서브에이전트 트랜스크립트는 메인 대화와 독립적으로 유지됩니다.

* **메인 대화 압축**: 메인 대화가 압축될 때, 서브에이전트 트랜스크립트는 영향을 받지 않습니다. 이들은 별도의 파일에 저장됩니다.
* **세션 지속성**: 서브에이전트 트랜스크립트는 해당 세션 내에서 유지됩니다. 같은 세션을 재개하여 Claude Code를 다시 시작한 후 서브에이전트를 재개할 수 있습니다.
* **자동 정리**: 트랜스크립트는 `cleanupPeriodDays` 설정(기본값: 30일)에 따라 정리됩니다.

## 도구 제한

서브에이전트는 `tools` 필드를 통해 제한된 도구 액세스를 가질 수 있습니다.

* **필드 생략**: 에이전트는 사용 가능한 모든 도구를 상속합니다(기본값).
* **도구 지정**: 에이전트는 나열된 도구만 사용할 수 있습니다.

이 예시는 코드를 검토할 수 있지만 파일을 수정하거나 명령을 실행할 수 없는 읽기 전용 분석 에이전트를 생성합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition


  async def main():
      async for message in query(
          prompt="Analyze the architecture of this codebase",
          options=ClaudeAgentOptions(
              allowed_tools=["Read", "Grep", "Glob", "Agent"],
              agents={
                  "code-analyzer": AgentDefinition(
                      description="Static code analysis and architecture review",
                      prompt="""You are a code architecture analyst. Analyze code structure,
  identify patterns, and suggest improvements without making changes.""",
                      # Read-only tools: no Edit, Write, or Bash access
                      tools=["Read", "Grep", "Glob"],
                  )
              },
          ),
      ):
          if hasattr(message, "result"):
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Analyze the architecture of this codebase",
    options: {
      allowedTools: ["Read", "Grep", "Glob", "Agent"],
      agents: {
        "code-analyzer": {
          description: "Static code analysis and architecture review",
          prompt: `You are a code architecture analyst. Analyze code structure,
  identify patterns, and suggest improvements without making changes.`,
          // Read-only tools: no Edit, Write, or Bash access
          tools: ["Read", "Grep", "Glob"]
        }
      }
    }
  })) {
    if ("result" in message) console.log(message.result);
  }
  ```
</CodeGroup>

### 일반적인 도구 조합

| 사용 사례    | 도구                                      | 설명                               |
| :------- | :-------------------------------------- | :------------------------------- |
| 읽기 전용 분석 | `Read`, `Grep`, `Glob`                  | 코드를 검토할 수 있지만 수정하거나 실행할 수 없습니다.  |
| 테스트 실행   | `Bash`, `Read`, `Grep`                  | 명령을 실행하고 출력을 분석할 수 있습니다.         |
| 코드 수정    | `Read`, `Edit`, `Write`, `Grep`, `Glob` | 명령 실행 없이 전체 읽기/쓰기 액세스            |
| 전체 액세스   | 모든 도구                                   | 부모의 모든 도구를 상속합니다(`tools` 필드 생략). |

## 문제 해결

### Claude가 서브에이전트에 위임하지 않음

Claude가 서브에이전트에 위임하는 대신 작업을 직접 완료하는 경우:

1. **Agent 도구 포함**: 서브에이전트는 Agent 도구를 통해 호출되므로 `allowedTools`에 포함되어야 합니다.
2. **명시적 프롬핑 사용**: 프롬프트에서 서브에이전트를 이름으로 언급하세요(예: "code-reviewer 에이전트를 사용하여...").
3. **명확한 설명 작성**: Claude가 작업을 적절히 일치시킬 수 있도록 서브에이전트를 사용해야 할 때를 정확히 설명하세요.

### 파일 시스템 기반 에이전트가 로드되지 않음

`.claude/agents/`에 정의된 에이전트는 시작 시에만 로드됩니다. Claude Code가 실행 중인 동안 새 에이전트 파일을 생성하면, 세션을 다시 시작하여 로드하세요.

### Windows: 긴 프롬프트 실패

Windows에서는 매우 긴 프롬프트가 있는 서브에이전트가 명령줄 길이 제한(8191자)으로 인해 실패할 수 있습니다. 프롬프트를 간결하게 유지하거나 복잡한 지침에는 파일 시스템 기반 에이전트를 사용하세요.

## 관련 문서

* [Claude Code 서브에이전트](/ko/sub-agents): 파일 시스템 기반 정의를 포함한 포괄적인 서브에이전트 문서
* [SDK 개요](/ko/agent-sdk/overview): Claude Agent SDK 시작하기

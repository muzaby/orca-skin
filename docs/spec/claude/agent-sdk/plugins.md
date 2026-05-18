> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK의 플러그인

> Agent SDK를 통해 명령어, 에이전트, 스킬 및 훅을 추가하여 Claude Code를 확장하는 사용자 정의 플러그인 로드

플러그인을 사용하면 프로젝트 전체에서 공유할 수 있는 사용자 정의 기능으로 Claude Code를 확장할 수 있습니다. Agent SDK를 통해 로컬 디렉터리에서 플러그인을 프로그래밍 방식으로 로드하여 에이전트 세션에 사용자 정의 슬래시 명령어, 에이전트, 스킬, 훅 및 MCP 서버를 추가할 수 있습니다.

## 플러그인이란 무엇입니까?

플러그인은 다음을 포함할 수 있는 Claude Code 확장 패키지입니다:

* **Skills**: Claude가 자율적으로 사용하는 모델 호출 기능(`/skill-name`으로도 호출 가능)
* **Agents**: 특정 작업을 위한 전문화된 서브에이전트
* **Hooks**: 도구 사용 및 기타 이벤트에 응답하는 이벤트 핸들러
* **MCP servers**: Model Context Protocol을 통한 외부 도구 통합

<Note>
  `commands/` 디렉터리는 레거시 형식입니다. 새로운 플러그인의 경우 `skills/`를 사용하십시오. Claude Code는 하위 호환성을 위해 두 형식을 모두 계속 지원합니다.
</Note>

플러그인 구조 및 플러그인 생성 방법에 대한 완전한 정보는 [플러그인](/ko/plugins)을 참조하십시오.

## 플러그인 로드

옵션 구성에서 로컬 파일 시스템 경로를 제공하여 플러그인을 로드합니다. `type` 필드는 `"local"`이어야 하며, 이는 SDK가 허용하는 유일한 값입니다. [마켓플레이스](/ko/plugin-marketplaces)를 통해 배포되거나 원격 저장소에서 플러그인을 사용하려면 먼저 다운로드한 후 로컬 디렉터리 경로를 제공합니다. SDK는 다양한 위치에서 여러 플러그인을 로드하는 것을 지원합니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Hello",
    options: {
      plugins: [
        { type: "local", path: "./my-plugin" },
        { type: "local", path: "/absolute/path/to/another-plugin" }
      ]
    }
  })) {
    // Plugin commands, agents, and other features are now available
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions


  async def main():
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(
              plugins=[
                  {"type": "local", "path": "./my-plugin"},
                  {"type": "local", "path": "/absolute/path/to/another-plugin"},
              ]
          ),
      ):
          # Plugin commands, agents, and other features are now available
          pass


  asyncio.run(main())
  ```
</CodeGroup>

### 경로 사양

플러그인 경로는 다음과 같을 수 있습니다:

* **상대 경로**: 현재 작업 디렉터리를 기준으로 확인됨(예: `"./plugins/my-plugin"`)
* **절대 경로**: 전체 파일 시스템 경로(예: `"/home/user/plugins/my-plugin"`)

<Note>
  경로는 플러그인의 루트 디렉터리(`.claude-plugin/plugin.json`을 포함하는 디렉터리)를 가리켜야 합니다.
</Note>

## 플러그인 설치 확인

플러그인이 성공적으로 로드되면 시스템 초기화 메시지에 나타납니다. 플러그인을 사용할 수 있는지 확인할 수 있습니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Hello",
    options: {
      plugins: [{ type: "local", path: "./my-plugin" }]
    }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      // 로드된 플러그인 확인
      console.log("Plugins:", message.plugins);
      // 예: [{ name: "my-plugin", path: "./my-plugin" }]

      // 플러그인에서 사용 가능한 명령어 확인
      console.log("Commands:", message.slash_commands);
      // 예: ["/help", "/compact", "my-plugin:custom-command"]
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage


  async def main():
      async for message in query(
          prompt="Hello",
          options=ClaudeAgentOptions(
              plugins=[{"type": "local", "path": "./my-plugin"}]
          ),
      ):
          if isinstance(message, SystemMessage) and message.subtype == "init":
              # 로드된 플러그인 확인
              print("Plugins:", message.data.get("plugins"))
              # 예: [{"name": "my-plugin", "path": "./my-plugin"}]

              # 플러그인에서 사용 가능한 명령어 확인
              print("Commands:", message.data.get("slash_commands"))
              # 예: ["/help", "/compact", "my-plugin:custom-command"]


  asyncio.run(main())
  ```
</CodeGroup>

## 플러그인 스킬 사용

플러그인의 스킬은 충돌을 피하기 위해 플러그인 이름으로 자동 네임스페이스됩니다. 슬래시 명령어로 호출될 때 형식은 `plugin-name:skill-name`입니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Load a plugin with a custom /greet skill
  for await (const message of query({
    prompt: "/my-plugin:greet", // Use plugin skill with namespace
    options: {
      plugins: [{ type: "local", path: "./my-plugin" }]
    }
  })) {
    // Claude executes the custom greeting skill from the plugin
    if (message.type === "assistant") {
      console.log(message.message.content);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, TextBlock


  async def main():
      # Load a plugin with a custom /greet skill
      async for message in query(
          prompt="/demo-plugin:greet",  # Use plugin skill with namespace
          options=ClaudeAgentOptions(
              plugins=[{"type": "local", "path": "./plugins/demo-plugin"}]
          ),
      ):
          # Claude executes the custom greeting skill from the plugin
          if isinstance(message, AssistantMessage):
              for block in message.content:
                  if isinstance(block, TextBlock):
                      print(f"Claude: {block.text}")


  asyncio.run(main())
  ```
</CodeGroup>

<Note>
  CLI를 통해 플러그인을 설치한 경우(예: `/plugin install my-plugin@marketplace`), SDK에서 설치 경로를 제공하여 사용할 수 있습니다. CLI로 설치된 플러그인은 `~/.claude/plugins/`에서 확인하십시오.
</Note>

## 완전한 예제

플러그인 로드 및 사용을 보여주는 전체 예제입니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";
  import * as path from "path";

  async function runWithPlugin() {
    const pluginPath = path.join(__dirname, "plugins", "my-plugin");

    console.log("Loading plugin from:", pluginPath);

    for await (const message of query({
      prompt: "What custom commands do you have available?",
      options: {
        plugins: [{ type: "local", path: pluginPath }],
        maxTurns: 3
      }
    })) {
      if (message.type === "system" && message.subtype === "init") {
        console.log("Loaded plugins:", message.plugins);
        console.log("Available commands:", message.slash_commands);
      }

      if (message.type === "assistant") {
        console.log("Assistant:", message.message.content);
      }
    }
  }

  runWithPlugin().catch(console.error);
  ```

  ```python Python theme={null}
  #!/usr/bin/env python3
  """Example demonstrating how to use plugins with the Agent SDK."""

  from pathlib import Path
  import anyio
  from claude_agent_sdk import (
      AssistantMessage,
      ClaudeAgentOptions,
      SystemMessage,
      TextBlock,
      query,
  )


  async def run_with_plugin():
      """Example using a custom plugin."""
      plugin_path = Path(__file__).parent / "plugins" / "demo-plugin"

      print(f"Loading plugin from: {plugin_path}")

      options = ClaudeAgentOptions(
          plugins=[{"type": "local", "path": str(plugin_path)}],
          max_turns=3,
      )

      async for message in query(
          prompt="What custom commands do you have available?", options=options
      ):
          if isinstance(message, SystemMessage) and message.subtype == "init":
              print(f"Loaded plugins: {message.data.get('plugins')}")
              print(f"Available commands: {message.data.get('slash_commands')}")

          if isinstance(message, AssistantMessage):
              for block in message.content:
                  if isinstance(block, TextBlock):
                      print(f"Assistant: {block.text}")


  if __name__ == "__main__":
      anyio.run(run_with_plugin)
  ```
</CodeGroup>

## 플러그인 구조 참조

플러그인 디렉터리는 `.claude-plugin/plugin.json` 매니페스트 파일을 포함해야 합니다. 선택적으로 다음을 포함할 수 있습니다:

```text theme={null}
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required: plugin manifest
├── skills/                   # Agent Skills (invoked autonomously or via /skill-name)
│   └── my-skill/
│       └── SKILL.md
├── commands/                 # Legacy: use skills/ instead
│   └── custom-cmd.md
├── agents/                   # Custom agents
│   └── specialist.md
├── hooks/                    # Event handlers
│   └── hooks.json
└── .mcp.json                # MCP server definitions
```

플러그인 생성에 대한 자세한 정보는 다음을 참조하십시오:

* [플러그인](/ko/plugins) - 완전한 플러그인 개발 가이드
* [플러그인 참조](/ko/plugins-reference) - 기술 사양 및 스키마

## 일반적인 사용 사례

### 개발 및 테스트

전역으로 설치하지 않고 개발 중에 플러그인을 로드합니다:

```typescript theme={null}
plugins: [{ type: "local", path: "./dev-plugins/my-plugin" }];
```

### 프로젝트별 확장

팀 전체의 일관성을 위해 프로젝트 저장소에 플러그인을 포함합니다:

```typescript theme={null}
plugins: [{ type: "local", path: "./project-plugins/team-workflows" }];
```

### 여러 플러그인 소스

다양한 위치의 플러그인을 결합합니다:

```typescript theme={null}
plugins: [
  { type: "local", path: "./local-plugin" },
  { type: "local", path: "~/.claude/custom-plugins/shared-plugin" }
];
```

## 문제 해결

### 플러그인이 로드되지 않음

플러그인이 초기화 메시지에 나타나지 않으면:

1. **경로 확인**: 경로가 플러그인 루트 디렉터리(`.claude-plugin/`을 포함하는)를 가리키는지 확인합니다
2. **plugin.json 검증**: 매니페스트 파일이 유효한 JSON 구문을 가지고 있는지 확인합니다
3. **파일 권한 확인**: 플러그인 디렉터리를 읽을 수 있는지 확인합니다

### 스킬이 나타나지 않음

플러그인 스킬이 작동하지 않으면:

1. **네임스페이스 사용**: 플러그인 스킬은 슬래시 명령어로 호출될 때 `plugin-name:skill-name` 형식이 필요합니다
2. **초기화 메시지 확인**: 스킬이 올바른 네임스페이스와 함께 `slash_commands`에 나타나는지 확인합니다
3. **스킬 파일 검증**: 각 스킬이 `skills/` 아래의 자체 하위 디렉터리에 `SKILL.md` 파일을 가지고 있는지 확인합니다(예: `skills/my-skill/SKILL.md`)

### 경로 확인 문제

상대 경로가 작동하지 않으면:

1. **작업 디렉터리 확인**: 상대 경로는 현재 작업 디렉터리에서 확인됩니다
2. **절대 경로 사용**: 안정성을 위해 절대 경로 사용을 고려합니다
3. **경로 정규화**: 경로 유틸리티를 사용하여 경로를 올바르게 구성합니다

## 참고 항목

* [플러그인](/ko/plugins) - 완전한 플러그인 개발 가이드
* [플러그인 참조](/ko/plugins-reference) - 기술 사양
* [슬래시 명령어](/ko/agent-sdk/slash-commands) - SDK에서 슬래시 명령어 사용
* [서브에이전트](/ko/agent-sdk/subagents) - 전문화된 에이전트 작업
* [스킬](/ko/agent-sdk/skills) - Agent Skills 사용

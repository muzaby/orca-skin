> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 실시간으로 응답 스트리밍하기

> 텍스트와 도구 호출이 스트리밍될 때 Agent SDK에서 실시간 응답 받기

기본적으로 Agent SDK는 Claude가 각 응답 생성을 완료한 후 완전한 `AssistantMessage` 객체를 생성합니다. 텍스트와 도구 호출이 생성될 때 증분 업데이트를 받으려면 옵션에서 `include_partial_messages`(Python) 또는 `includePartialMessages`(TypeScript)를 `true`로 설정하여 부분 메시지 스트리밍을 활성화하십시오.

<Tip>
  이 페이지는 출력 스트리밍(실시간으로 토큰 수신)을 다룹니다. 입력 모드(메시지 전송 방법)는 [에이전트에 메시지 전송하기](/ko/agent-sdk/streaming-vs-single-mode)를 참조하십시오. [CLI를 통해 Agent SDK를 사용하여 응답 스트리밍하기](/ko/headless)도 가능합니다.
</Tip>

## 스트리밍 출력 활성화

스트리밍을 활성화하려면 옵션에서 `include_partial_messages`(Python) 또는 `includePartialMessages`(TypeScript)를 `true`로 설정하십시오. 이렇게 하면 SDK가 도착하는 대로 원본 API 이벤트를 포함하는 `StreamEvent` 메시지를 생성하며, 일반적인 `AssistantMessage` 및 `ResultMessage`도 함께 생성합니다.

코드는 다음을 수행해야 합니다:

1. 각 메시지의 유형을 확인하여 `StreamEvent`를 다른 메시지 유형과 구분합니다
2. `StreamEvent`의 경우 `event` 필드를 추출하고 해당 `type`을 확인합니다
3. `delta.type`이 `text_delta`인 `content_block_delta` 이벤트를 찾습니다. 이 이벤트에는 실제 텍스트 청크가 포함됩니다

아래 예제는 스트리밍을 활성화하고 도착하는 텍스트 청크를 인쇄합니다. 중첩된 유형 확인에 주목하십시오: 먼저 `StreamEvent`, 그 다음 `content_block_delta`, 그 다음 `text_delta`:

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  from claude_agent_sdk.types import StreamEvent
  import asyncio


  async def stream_response():
      options = ClaudeAgentOptions(
          include_partial_messages=True,
          allowed_tools=["Bash", "Read"],
      )

      async for message in query(prompt="List the files in my project", options=options):
          if isinstance(message, StreamEvent):
              event = message.event
              if event.get("type") == "content_block_delta":
                  delta = event.get("delta", {})
                  if delta.get("type") == "text_delta":
                      print(delta.get("text", ""), end="", flush=True)


  asyncio.run(stream_response())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "List the files in my project",
    options: {
      includePartialMessages: true,
      allowedTools: ["Bash", "Read"]
    }
  })) {
    if (message.type === "stream_event") {
      const event = message.event;
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          process.stdout.write(event.delta.text);
        }
      }
    }
  }
  ```
</CodeGroup>

## StreamEvent 참조

부분 메시지가 활성화되면 객체로 래핑된 원본 Claude API 스트리밍 이벤트를 받습니다. 유형은 각 SDK에서 다른 이름을 가집니다:

* **Python**: `StreamEvent` (`claude_agent_sdk.types`에서 가져오기)
* **TypeScript**: `type: 'stream_event'`를 가진 `SDKPartialAssistantMessage`

둘 다 누적된 텍스트가 아닌 원본 Claude API 이벤트를 포함합니다. 텍스트 델타를 직접 추출하고 누적해야 합니다. 각 유형의 구조는 다음과 같습니다:

<CodeGroup>
  ```python Python theme={null}
  @dataclass
  class StreamEvent:
      uuid: str  # Unique identifier for this event
      session_id: str  # Session identifier
      event: dict[str, Any]  # The raw Claude API stream event
      parent_tool_use_id: str | None  # Parent tool ID if from a subagent
  ```

  ```typescript TypeScript theme={null}
  type SDKPartialAssistantMessage = {
    type: "stream_event";
    event: BetaRawMessageStreamEvent; // From Anthropic SDK
    parent_tool_use_id: string | null;
    uuid: UUID;
    session_id: string;
  };
  ```
</CodeGroup>

`event` 필드는 [Claude API](https://platform.claude.com/docs/en/build-with-claude/streaming#event-types)의 원본 스트리밍 이벤트를 포함합니다. 일반적인 이벤트 유형은 다음과 같습니다:

| 이벤트 유형                | 설명                         |
| :-------------------- | :------------------------- |
| `message_start`       | 새 메시지의 시작                  |
| `content_block_start` | 새 콘텐츠 블록의 시작(텍스트 또는 도구 사용) |
| `content_block_delta` | 콘텐츠에 대한 증분 업데이트            |
| `content_block_stop`  | 콘텐츠 블록의 끝                  |
| `message_delta`       | 메시지 수준 업데이트(중지 이유, 사용량)    |
| `message_stop`        | 메시지의 끝                     |

## 메시지 흐름

부분 메시지가 활성화되면 다음 순서로 메시지를 받습니다:

```text theme={null}
StreamEvent (message_start)
StreamEvent (content_block_start) - text block
StreamEvent (content_block_delta) - text chunks...
StreamEvent (content_block_stop)
StreamEvent (content_block_start) - tool_use block
StreamEvent (content_block_delta) - tool input chunks...
StreamEvent (content_block_stop)
StreamEvent (message_delta)
StreamEvent (message_stop)
AssistantMessage - complete message with all content
... tool executes ...
... more streaming events for next turn ...
ResultMessage - final result
```

부분 메시지가 활성화되지 않은 경우(Python의 `include_partial_messages`, TypeScript의 `includePartialMessages`), `StreamEvent`를 제외한 모든 메시지 유형을 받습니다. 일반적인 유형에는 `SystemMessage`(세션 초기화), `AssistantMessage`(완전한 응답), `ResultMessage`(최종 결과) 및 대화 기록이 압축된 시점을 나타내는 컴팩트 경계 메시지(TypeScript의 `SDKCompactBoundaryMessage`; Python의 서브타입 `"compact_boundary"`를 가진 `SystemMessage`)가 포함됩니다.

## 텍스트 응답 스트리밍

생성되는 텍스트를 표시하려면 `delta.type`이 `text_delta`인 `content_block_delta` 이벤트를 찾습니다. 이 이벤트에는 증분 텍스트 청크가 포함됩니다. 아래 예제는 도착하는 각 청크를 인쇄합니다:

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  from claude_agent_sdk.types import StreamEvent
  import asyncio


  async def stream_text():
      options = ClaudeAgentOptions(include_partial_messages=True)

      async for message in query(prompt="Explain how databases work", options=options):
          if isinstance(message, StreamEvent):
              event = message.event
              if event.get("type") == "content_block_delta":
                  delta = event.get("delta", {})
                  if delta.get("type") == "text_delta":
                      # Print each text chunk as it arrives
                      print(delta.get("text", ""), end="", flush=True)

      print()  # Final newline


  asyncio.run(stream_text())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Explain how databases work",
    options: { includePartialMessages: true }
  })) {
    if (message.type === "stream_event") {
      const event = message.event;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
    }
  }

  console.log(); // Final newline
  ```
</CodeGroup>

## 도구 호출 스트리밍

도구 호출도 증분적으로 스트리밍됩니다. 도구가 시작될 때를 추적하고, 생성되는 입력을 받고, 완료될 때를 볼 수 있습니다. 아래 예제는 현재 호출되는 도구를 추적하고 스트리밍되는 JSON 입력을 누적합니다. 세 가지 이벤트 유형을 사용합니다:

* `content_block_start`: 도구 시작
* `content_block_delta` with `input_json_delta`: 입력 청크 도착
* `content_block_stop`: 도구 호출 완료

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions
  from claude_agent_sdk.types import StreamEvent
  import asyncio


  async def stream_tool_calls():
      options = ClaudeAgentOptions(
          include_partial_messages=True,
          allowed_tools=["Read", "Bash"],
      )

      # Track the current tool and accumulate its input JSON
      current_tool = None
      tool_input = ""

      async for message in query(prompt="Read the README.md file", options=options):
          if isinstance(message, StreamEvent):
              event = message.event
              event_type = event.get("type")

              if event_type == "content_block_start":
                  # New tool call is starting
                  content_block = event.get("content_block", {})
                  if content_block.get("type") == "tool_use":
                      current_tool = content_block.get("name")
                      tool_input = ""
                      print(f"Starting tool: {current_tool}")

              elif event_type == "content_block_delta":
                  delta = event.get("delta", {})
                  if delta.get("type") == "input_json_delta":
                      # Accumulate JSON input as it streams in
                      chunk = delta.get("partial_json", "")
                      tool_input += chunk
                      print(f"  Input chunk: {chunk}")

              elif event_type == "content_block_stop":
                  # Tool call complete - show final input
                  if current_tool:
                      print(f"Tool {current_tool} called with: {tool_input}")
                      current_tool = None


  asyncio.run(stream_tool_calls())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Track the current tool and accumulate its input JSON
  let currentTool: string | null = null;
  let toolInput = "";

  for await (const message of query({
    prompt: "Read the README.md file",
    options: {
      includePartialMessages: true,
      allowedTools: ["Read", "Bash"]
    }
  })) {
    if (message.type === "stream_event") {
      const event = message.event;

      if (event.type === "content_block_start") {
        // New tool call is starting
        if (event.content_block.type === "tool_use") {
          currentTool = event.content_block.name;
          toolInput = "";
          console.log(`Starting tool: ${currentTool}`);
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "input_json_delta") {
          // Accumulate JSON input as it streams in
          const chunk = event.delta.partial_json;
          toolInput += chunk;
          console.log(`  Input chunk: ${chunk}`);
        }
      } else if (event.type === "content_block_stop") {
        // Tool call complete - show final input
        if (currentTool) {
          console.log(`Tool ${currentTool} called with: ${toolInput}`);
          currentTool = null;
        }
      }
    }
  }
  ```
</CodeGroup>

## 스트리밍 UI 구축

이 예제는 텍스트와 도구 스트리밍을 응집력 있는 UI로 결합합니다. 에이전트가 현재 도구를 실행 중인지 추적하기 위해 `in_tool` 플래그를 사용하여 도구가 실행되는 동안 `[Using Read...]`와 같은 상태 표시기를 표시합니다. 도구에 없을 때 텍스트가 정상적으로 스트리밍되고, 도구 완료가 "done" 메시지를 트리거합니다. 이 패턴은 다단계 에이전트 작업 중에 진행 상황을 표시해야 하는 채팅 인터페이스에 유용합니다.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
  from claude_agent_sdk.types import StreamEvent
  import asyncio
  import sys


  async def streaming_ui():
      options = ClaudeAgentOptions(
          include_partial_messages=True,
          allowed_tools=["Read", "Bash", "Grep"],
      )

      # Track whether we're currently in a tool call
      in_tool = False

      async for message in query(
          prompt="Find all TODO comments in the codebase", options=options
      ):
          if isinstance(message, StreamEvent):
              event = message.event
              event_type = event.get("type")

              if event_type == "content_block_start":
                  content_block = event.get("content_block", {})
                  if content_block.get("type") == "tool_use":
                      # Tool call is starting - show status indicator
                      tool_name = content_block.get("name")
                      print(f"\n[Using {tool_name}...]", end="", flush=True)
                      in_tool = True

              elif event_type == "content_block_delta":
                  delta = event.get("delta", {})
                  # Only stream text when not executing a tool
                  if delta.get("type") == "text_delta" and not in_tool:
                      sys.stdout.write(delta.get("text", ""))
                      sys.stdout.flush()

              elif event_type == "content_block_stop":
                  if in_tool:
                      # Tool call finished
                      print(" done", flush=True)
                      in_tool = False

          elif isinstance(message, ResultMessage):
              # Agent finished all work
              print(f"\n\n--- Complete ---")


  asyncio.run(streaming_ui())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Track whether we're currently in a tool call
  let inTool = false;

  for await (const message of query({
    prompt: "Find all TODO comments in the codebase",
    options: {
      includePartialMessages: true,
      allowedTools: ["Read", "Bash", "Grep"]
    }
  })) {
    if (message.type === "stream_event") {
      const event = message.event;

      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          // Tool call is starting - show status indicator
          process.stdout.write(`\n[Using ${event.content_block.name}...]`);
          inTool = true;
        }
      } else if (event.type === "content_block_delta") {
        // Only stream text when not executing a tool
        if (event.delta.type === "text_delta" && !inTool) {
          process.stdout.write(event.delta.text);
        }
      } else if (event.type === "content_block_stop") {
        if (inTool) {
          // Tool call finished
          console.log(" done");
          inTool = false;
        }
      }
    } else if (message.type === "result") {
      // Agent finished all work
      console.log("\n\n--- Complete ---");
    }
  }
  ```
</CodeGroup>

## 알려진 제한 사항

일부 SDK 기능은 스트리밍과 호환되지 않습니다:

* **확장 사고**: `max_thinking_tokens`(Python) 또는 `maxThinkingTokens`(TypeScript)를 명시적으로 설정하면 `StreamEvent` 메시지가 생성되지 않습니다. 각 턴 후에만 완전한 메시지를 받습니다. 사고는 기본적으로 SDK에서 비활성화되므로 활성화하지 않으면 스트리밍이 작동합니다.
* **구조화된 출력**: JSON 결과는 스트리밍 델타가 아닌 최종 `ResultMessage.structured_output`에만 나타납니다. 자세한 내용은 [구조화된 출력](/ko/agent-sdk/structured-outputs)을 참조하십시오.

## 다음 단계

이제 실시간으로 텍스트와 도구 호출을 스트리밍할 수 있으므로 다음 관련 항목을 살펴보십시오:

* [대화형 vs 일회성 쿼리](/ko/agent-sdk/streaming-vs-single-mode): 사용 사례에 맞는 입력 모드 선택
* [구조화된 출력](/ko/agent-sdk/structured-outputs): 에이전트에서 입력된 JSON 응답 받기
* [권한](/ko/agent-sdk/permissions): 에이전트가 사용할 수 있는 도구 제어

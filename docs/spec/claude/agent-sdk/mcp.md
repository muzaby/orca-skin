> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 외부 도구와 MCP로 연결하기

> MCP 서버를 구성하여 에이전트를 외부 도구로 확장합니다. 전송 유형, 대규모 도구 세트를 위한 도구 검색, 인증 및 오류 처리를 다룹니다.

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro)는 AI 에이전트를 외부 도구 및 데이터 소스에 연결하기 위한 개방형 표준입니다. MCP를 사용하면 에이전트가 데이터베이스를 쿼리하고, Slack 및 GitHub와 같은 API와 통합하며, 사용자 정의 도구 구현을 작성하지 않고도 다른 서비스에 연결할 수 있습니다.

MCP 서버는 로컬 프로세스로 실행되거나, HTTP를 통해 연결되거나, SDK 애플리케이션 내에서 직접 실행될 수 있습니다.

<Note>
  이 페이지는 Agent SDK에 대한 MCP 구성을 다룹니다. Claude Code CLI에 MCP 서버를 추가하여 모든 프로젝트에서 로드되도록 하려면 [MCP 설치 범위](/ko/mcp#mcp-installation-scopes)를 참조하세요.
</Note>

## 빠른 시작

이 예제는 [HTTP 전송](#httpsse-servers)을 사용하여 [Claude Code 문서](https://code.claude.com/docs) MCP 서버에 연결하고 [`allowedTools`](#allow-mcp-tools)를 와일드카드와 함께 사용하여 서버의 모든 도구를 허용합니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Use the docs MCP server to explain what hooks are in Claude Code",
    options: {
      mcpServers: {
        "claude-code-docs": {
          type: "http",
          url: "https://code.claude.com/docs/mcp"
        }
      },
      allowedTools: ["mcp__claude-code-docs__*"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "claude-code-docs": {
                  "type": "http",
                  "url": "https://code.claude.com/docs/mcp",
              }
          },
          allowed_tools=["mcp__claude-code-docs__*"],
      )

      async for message in query(
          prompt="Use the docs MCP server to explain what hooks are in Claude Code",
          options=options,
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

에이전트는 문서 서버에 연결하고, hooks에 대한 정보를 검색하며, 결과를 반환합니다.

## MCP 서버 추가

`query()`를 호출할 때 코드에서 MCP 서버를 구성하거나 [`settingSources`](#from-a-config-file)를 통해 로드되는 `.mcp.json` 파일에서 구성할 수 있습니다.

### 코드에서

`mcpServers` 옵션에서 MCP 서버를 직접 전달합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "List files in my project",
    options: {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
        }
      },
      allowedTools: ["mcp__filesystem__*"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "filesystem": {
                  "command": "npx",
                  "args": [
                      "-y",
                      "@modelcontextprotocol/server-filesystem",
                      "/Users/me/projects",
                  ],
              }
          },
          allowed_tools=["mcp__filesystem__*"],
      )

      async for message in query(prompt="List files in my project", options=options):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

### 구성 파일에서

프로젝트 루트에 `.mcp.json` 파일을 만듭니다. `project` 설정 소스가 활성화되면 파일이 선택되며, 기본 `query()` 옵션에서는 활성화됩니다. `settingSources`를 명시적으로 설정하는 경우 이 파일이 로드되도록 `"project"`를 포함합니다:

```json theme={null}
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
    }
  }
}
```

## MCP 도구 허용

MCP 도구는 Claude가 사용하기 전에 명시적 권한이 필요합니다. 권한이 없으면 Claude는 도구를 사용할 수 있음을 알 수 있지만 호출할 수 없습니다.

### 도구 명명 규칙

MCP 도구는 `mcp__<server-name>__<tool-name>` 명명 패턴을 따릅니다. 예를 들어, `"github"`라는 이름의 GitHub 서버와 `list_issues` 도구는 `mcp__github__list_issues`가 됩니다.

### allowedTools로 액세스 권한 부여

`allowedTools`를 사용하여 Claude가 사용할 수 있는 MCP 도구를 지정합니다:

```typescript hidelines={1,-1} theme={null}
const _ = {
  options: {
    mcpServers: {
      // your servers
    },
    allowedTools: [
      "mcp__github__*", // All tools from the github server
      "mcp__db__query", // Only the query tool from db server
      "mcp__slack__send_message" // Only send_message from slack server
    ]
  }
};
```

와일드카드(`*`)를 사용하면 각 도구를 개별적으로 나열하지 않고도 서버의 모든 도구를 허용할 수 있습니다.

<Note>
  **MCP 액세스를 위해 권한 모드보다 `allowedTools`를 선호합니다.** `permissionMode: "acceptEdits"`는 MCP 도구를 자동으로 승인하지 않습니다(파일 편집 및 파일 시스템 Bash 명령만). `permissionMode: "bypassPermissions"`는 MCP 도구를 자동으로 승인하지만 다른 모든 안전 프롬프트도 비활성화하므로 필요한 것보다 더 광범위합니다. `allowedTools`의 와일드카드는 원하는 MCP 서버만 정확히 부여하고 다른 것은 부여하지 않습니다. 전체 비교는 [권한 모드](/ko/agent-sdk/permissions#permission-modes)를 참조하세요.
</Note>

### 사용 가능한 도구 검색

MCP 서버가 제공하는 도구를 확인하려면 서버의 문서를 확인하거나 서버에 연결하고 `system` init 메시지를 검사합니다:

```typescript theme={null}
for await (const message of query({ prompt: "...", options })) {
  if (message.type === "system" && message.subtype === "init") {
    console.log("Available MCP tools:", message.mcp_servers);
  }
}
```

## 전송 유형

MCP 서버는 다양한 전송 프로토콜을 사용하여 에이전트와 통신합니다. 서버의 문서를 확인하여 지원하는 전송을 확인합니다:

* 문서에 **실행할 명령**이 있으면(예: `npx @modelcontextprotocol/server-github`), stdio를 사용합니다
* 문서에 **URL**이 있으면 HTTP 또는 SSE를 사용합니다
* 코드에서 자신의 도구를 구축하는 경우 SDK MCP 서버를 사용합니다

### stdio 서버

stdin/stdout을 통해 통신하는 로컬 프로세스입니다. 같은 머신에서 실행하는 MCP 서버에 이를 사용합니다:

<Tabs>
  <Tab title="코드에서">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: {
                GITHUB_TOKEN: process.env.GITHUB_TOKEN
              }
            }
          },
          allowedTools: ["mcp__github__list_issues", "mcp__github__search_issues"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "github": {
                  "command": "npx",
                  "args": ["-y", "@modelcontextprotocol/server-github"],
                  "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
              }
          },
          allowed_tools=["mcp__github__list_issues", "mcp__github__search_issues"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "github": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-github"],
          "env": {
            "GITHUB_TOKEN": "${GITHUB_TOKEN}"
          }
        }
      }
    }
    ```
  </Tab>
</Tabs>

### HTTP/SSE 서버

클라우드 호스팅 MCP 서버 및 원격 API에 HTTP 또는 SSE를 사용합니다:

<Tabs>
  <Tab title="코드에서">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            "remote-api": {
              type: "sse",
              url: "https://api.example.com/mcp/sse",
              headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`
              }
            }
          },
          allowedTools: ["mcp__remote-api__*"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "remote-api": {
                  "type": "sse",
                  "url": "https://api.example.com/mcp/sse",
                  "headers": {"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
              }
          },
          allowed_tools=["mcp__remote-api__*"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "remote-api": {
          "type": "sse",
          "url": "https://api.example.com/mcp/sse",
          "headers": {
            "Authorization": "Bearer ${API_TOKEN}"
          }
        }
      }
    }
    ```
  </Tab>
</Tabs>

스트리밍 가능한 HTTP 전송의 경우 `"type": "http"` 대신 사용합니다. `.mcp.json` 및 기타 JSON 구성 파일에서 `"streamable-http"`는 `"http"`의 별칭으로 허용됩니다. 프로그래밍 방식의 `mcpServers` 옵션은 `"http"`만 허용합니다.

### SDK MCP 서버

별도의 서버 프로세스를 실행하는 대신 애플리케이션 코드에서 직접 사용자 정의 도구를 정의합니다. 구현 세부 사항은 [사용자 정의 도구 가이드](/ko/agent-sdk/custom-tools)를 참조하세요.

## MCP 도구 검색

많은 MCP 도구를 구성한 경우 도구 정의가 컨텍스트 윈도우의 상당 부분을 소비할 수 있습니다. 도구 검색은 컨텍스트에서 도구 정의를 보류하고 각 턴에 Claude가 필요로 하는 도구만 로드하여 이를 해결합니다.

도구 검색은 기본적으로 활성화됩니다. 구성 옵션 및 세부 사항은 [도구 검색](/ko/agent-sdk/tool-search)을 참조하세요.

사용자 정의 SDK 도구와 함께 도구 검색을 사용하는 방법을 포함한 자세한 내용은 [도구 검색 가이드](/ko/agent-sdk/tool-search)를 참조하세요.

## 인증

대부분의 MCP 서버는 외부 서비스에 액세스하기 위해 인증이 필요합니다. 서버 구성에서 환경 변수를 통해 자격 증명을 전달합니다.

### 환경 변수를 통해 자격 증명 전달

`env` 필드를 사용하여 API 키, 토큰 및 기타 자격 증명을 MCP 서버에 전달합니다:

<Tabs>
  <Tab title="코드에서">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: {
                GITHUB_TOKEN: process.env.GITHUB_TOKEN
              }
            }
          },
          allowedTools: ["mcp__github__list_issues"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "github": {
                  "command": "npx",
                  "args": ["-y", "@modelcontextprotocol/server-github"],
                  "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
              }
          },
          allowed_tools=["mcp__github__list_issues"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "github": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-github"],
          "env": {
            "GITHUB_TOKEN": "${GITHUB_TOKEN}"
          }
        }
      }
    }
    ```

    `${GITHUB_TOKEN}` 구문은 런타임에 환경 변수를 확장합니다.
  </Tab>
</Tabs>

디버그 로깅이 포함된 완전한 작동 예제는 [저장소에서 문제 나열](#list-issues-from-a-repository)을 참조하세요.

### 원격 서버용 HTTP 헤더

HTTP 및 SSE 서버의 경우 서버 구성에서 직접 인증 헤더를 전달합니다:

<Tabs>
  <Tab title="코드에서">
    <CodeGroup>
      ```typescript TypeScript hidelines={1,-1} theme={null}
      const _ = {
        options: {
          mcpServers: {
            "secure-api": {
              type: "http",
              url: "https://api.example.com/mcp",
              headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`
              }
            }
          },
          allowedTools: ["mcp__secure-api__*"]
        }
      };
      ```

      ```python Python theme={null}
      options = ClaudeAgentOptions(
          mcp_servers={
              "secure-api": {
                  "type": "http",
                  "url": "https://api.example.com/mcp",
                  "headers": {"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
              }
          },
          allowed_tools=["mcp__secure-api__*"],
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title=".mcp.json">
    ```json theme={null}
    {
      "mcpServers": {
        "secure-api": {
          "type": "http",
          "url": "https://api.example.com/mcp",
          "headers": {
            "Authorization": "Bearer ${API_TOKEN}"
          }
        }
      }
    }
    ```

    `${API_TOKEN}` 구문은 런타임에 환경 변수를 확장합니다.
  </Tab>
</Tabs>

### OAuth2 인증

[MCP 사양은 OAuth 2.1을 지원합니다](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization). SDK는 OAuth 흐름을 자동으로 처리하지 않지만 애플리케이션에서 OAuth 흐름을 완료한 후 헤더를 통해 액세스 토큰을 전달할 수 있습니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  // After completing OAuth flow in your app
  const accessToken = await getAccessTokenFromOAuthFlow();

  const options = {
    mcpServers: {
      "oauth-api": {
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    },
    allowedTools: ["mcp__oauth-api__*"]
  };
  ```

  ```python Python theme={null}
  # After completing OAuth flow in your app
  access_token = await get_access_token_from_oauth_flow()

  options = ClaudeAgentOptions(
      mcp_servers={
          "oauth-api": {
              "type": "http",
              "url": "https://api.example.com/mcp",
              "headers": {"Authorization": f"Bearer {access_token}"},
          }
      },
      allowed_tools=["mcp__oauth-api__*"],
  )
  ```
</CodeGroup>

## 예제

### 저장소에서 문제 나열

이 예제는 [GitHub MCP 서버](https://github.com/modelcontextprotocol/servers/tree/main/src/github)에 연결하여 최근 문제를 나열합니다. 이 예제에는 MCP 연결 및 도구 호출을 확인하기 위한 디버그 로깅이 포함됩니다.

실행하기 전에 `repo` 범위로 [GitHub 개인 액세스 토큰](https://github.com/settings/tokens)을 만들고 환경 변수로 설정합니다:

```bash theme={null}
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "List the 3 most recent issues in anthropics/claude-code",
    options: {
      mcpServers: {
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: {
            GITHUB_TOKEN: process.env.GITHUB_TOKEN
          }
        }
      },
      allowedTools: ["mcp__github__list_issues"]
    }
  })) {
    // Verify MCP server connected successfully
    if (message.type === "system" && message.subtype === "init") {
      console.log("MCP servers:", message.mcp_servers);
    }

    // Log when Claude calls an MCP tool
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use" && block.name.startsWith("mcp__")) {
          console.log("MCP tool called:", block.name);
        }
      }
    }

    // Print the final result
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  import os
  from claude_agent_sdk import (
      query,
      ClaudeAgentOptions,
      ResultMessage,
      SystemMessage,
      AssistantMessage,
  )


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={
              "github": {
                  "command": "npx",
                  "args": ["-y", "@modelcontextprotocol/server-github"],
                  "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
              }
          },
          allowed_tools=["mcp__github__list_issues"],
      )

      async for message in query(
          prompt="List the 3 most recent issues in anthropics/claude-code",
          options=options,
      ):
          # Verify MCP server connected successfully
          if isinstance(message, SystemMessage) and message.subtype == "init":
              print("MCP servers:", message.data.get("mcp_servers"))

          # Log when Claude calls an MCP tool
          if isinstance(message, AssistantMessage):
              for block in message.content:
                  if hasattr(block, "name") and block.name.startswith("mcp__"):
                      print("MCP tool called:", block.name)

          # Print the final result
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

### 데이터베이스 쿼리

이 예제는 [Postgres MCP 서버](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)를 사용하여 데이터베이스를 쿼리합니다. 연결 문자열은 서버에 대한 인수로 전달됩니다. 에이전트는 자동으로 데이터베이스 스키마를 검색하고, SQL 쿼리를 작성하며, 결과를 반환합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Connection string from environment variable
  const connectionString = process.env.DATABASE_URL;

  for await (const message of query({
    // Natural language query - Claude writes the SQL
    prompt: "How many users signed up last week? Break it down by day.",
    options: {
      mcpServers: {
        postgres: {
          command: "npx",
          // Pass connection string as argument to the server
          args: ["-y", "@modelcontextprotocol/server-postgres", connectionString]
        }
      },
      // Allow only read queries, not writes
      allowedTools: ["mcp__postgres__query"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  import os
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      # Connection string from environment variable
      connection_string = os.environ["DATABASE_URL"]

      options = ClaudeAgentOptions(
          mcp_servers={
              "postgres": {
                  "command": "npx",
                  # Pass connection string as argument to the server
                  "args": [
                      "-y",
                      "@modelcontextprotocol/server-postgres",
                      connection_string,
                  ],
              }
          },
          # Allow only read queries, not writes
          allowed_tools=["mcp__postgres__query"],
      )

      # Natural language query - Claude writes the SQL
      async for message in query(
          prompt="How many users signed up last week? Break it down by day.",
          options=options,
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

## 오류 처리

MCP 서버는 여러 이유로 연결에 실패할 수 있습니다: 서버 프로세스가 설치되지 않았을 수 있고, 자격 증명이 유효하지 않을 수 있으며, 원격 서버에 도달할 수 없을 수 있습니다.

SDK는 각 쿼리의 시작 부분에서 subtype `init`이 있는 `system` 메시지를 내보냅니다. 이 메시지에는 각 MCP 서버의 연결 상태가 포함됩니다. `status` 필드를 확인하여 에이전트가 작업을 시작하기 전에 연결 실패를 감지합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Process data",
    options: {
      mcpServers: {
        "data-processor": dataServer
      }
    }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      const failedServers = message.mcp_servers.filter((s) => s.status !== "connected");

      if (failedServers.length > 0) {
        console.warn("Failed to connect:", failedServers);
      }
    }

    if (message.type === "result" && message.subtype === "error_during_execution") {
      console.error("Execution failed");
    }
  }
  ```

  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage, ResultMessage


  async def main():
      options = ClaudeAgentOptions(mcp_servers={"data-processor": data_server})

      async for message in query(prompt="Process data", options=options):
          if isinstance(message, SystemMessage) and message.subtype == "init":
              failed_servers = [
                  s
                  for s in message.data.get("mcp_servers", [])
                  if s.get("status") != "connected"
              ]

              if failed_servers:
                  print(f"Failed to connect: {failed_servers}")

          if (
              isinstance(message, ResultMessage)
              and message.subtype == "error_during_execution"
          ):
              print("Execution failed")


  asyncio.run(main())
  ```
</CodeGroup>

## 문제 해결

### 서버가 "failed" 상태를 표시합니다

init 메시지를 확인하여 연결에 실패한 서버를 확인합니다:

```typescript theme={null}
if (message.type === "system" && message.subtype === "init") {
  for (const server of message.mcp_servers) {
    if (server.status === "failed") {
      console.error(`Server ${server.name} failed to connect`);
    }
  }
}
```

일반적인 원인:

* **누락된 환경 변수**: 필수 토큰 및 자격 증명이 설정되어 있는지 확인합니다. stdio 서버의 경우 `env` 필드가 서버가 예상하는 것과 일치하는지 확인합니다.
* **서버가 설치되지 않음**: `npx` 명령의 경우 패키지가 존재하고 Node.js가 PATH에 있는지 확인합니다.
* **잘못된 연결 문자열**: 데이터베이스 서버의 경우 연결 문자열 형식을 확인하고 데이터베이스에 액세스할 수 있는지 확인합니다.
* **네트워크 문제**: 원격 HTTP/SSE 서버의 경우 URL에 도달할 수 있고 방화벽이 연결을 허용하는지 확인합니다.

### 도구가 호출되지 않음

Claude가 도구를 보지만 사용하지 않는 경우 `allowedTools`로 권한을 부여했는지 확인합니다:

```typescript hidelines={1,-1} theme={null}
const _ = {
  options: {
    mcpServers: {
      // your servers
    },
    allowedTools: ["mcp__servername__*"] // Required for Claude to use the tools
  }
};
```

### 연결 시간 초과

MCP SDK는 서버 연결에 대해 기본 60초 시간 초과를 가집니다. 서버가 더 오래 시작되는 경우 연결이 실패합니다. 더 많은 시작 시간이 필요한 서버의 경우 다음을 고려합니다:

* 사용 가능한 경우 더 가벼운 서버 사용
* 에이전트를 시작하기 전에 서버 사전 준비
* 느린 초기화 원인에 대한 서버 로그 확인

## 관련 리소스

* **[사용자 정의 도구 가이드](/ko/agent-sdk/custom-tools)**: SDK 애플리케이션과 함께 프로세스 내에서 실행되는 자신의 MCP 서버를 구축합니다
* **[권한](/ko/agent-sdk/permissions)**: `allowedTools` 및 `disallowedTools`로 에이전트가 사용할 수 있는 MCP 도구를 제어합니다
* **[TypeScript SDK 참조](/ko/agent-sdk/typescript)**: MCP 구성 옵션을 포함한 전체 API 참조
* **[Python SDK 참조](/ko/agent-sdk/python)**: MCP 구성 옵션을 포함한 전체 API 참조
* **[MCP 서버 디렉토리](https://github.com/modelcontextprotocol/servers)**: 데이터베이스, API 등을 위한 사용 가능한 MCP 서버를 찾아봅니다

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 많은 도구로 확장하기 - 도구 검색

> 수백 개 또는 수천 개의 도구로 에이전트를 확장하고, 필요한 것만 동적으로 발견하여 로드합니다.

도구 검색을 통해 에이전트는 수백 개 또는 수천 개의 도구로 작업할 수 있으며, 필요에 따라 동적으로 도구를 발견하고 로드합니다. 모든 도구 정의를 미리 컨텍스트 윈도우에 로드하는 대신, 에이전트가 도구 카탈로그를 검색하고 필요한 도구만 로드합니다.

이 접근 방식은 도구 라이브러리가 확장될 때 두 가지 문제를 해결합니다:

* **컨텍스트 효율성:** 도구 정의는 컨텍스트 윈도우의 큰 부분을 차지할 수 있습니다(50개의 도구는 10-20K 토큰을 사용할 수 있음). 이로 인해 실제 작업을 위한 공간이 줄어듭니다.
* **도구 선택 정확도:** 30-50개 이상의 도구가 동시에 로드되면 도구 선택 정확도가 저하됩니다.

도구 검색은 기본적으로 활성화되어 있습니다. 이 페이지에서는 [작동 방식](#how-tool-search-works), [구성 방법](#configure-tool-search), [도구 발견 최적화 방법](#optimize-tool-discovery)을 다룹니다.

## 도구 검색의 작동 방식

도구 검색이 활성화되면 도구 정의는 컨텍스트 윈도우에서 제외됩니다. 에이전트는 사용 가능한 도구의 요약을 받고, 작업에 이미 로드되지 않은 기능이 필요할 때 관련 도구를 검색합니다. 가장 관련성이 높은 3-5개의 도구가 컨텍스트에 로드되며, 이후 턴에서도 계속 사용할 수 있습니다. 대화가 길어서 SDK가 이전 메시지를 압축하여 공간을 확보하면, 이전에 발견한 도구가 제거될 수 있으며, 에이전트는 필요에 따라 다시 검색합니다.

도구 검색은 Claude가 처음 도구를 발견할 때(검색 단계) 한 번의 추가 왕복을 추가하지만, 큰 도구 세트의 경우 모든 턴에서 더 작은 컨텍스트로 인한 이점이 있습니다. 도구가 약 10개 미만인 경우, 모든 것을 미리 로드하는 것이 일반적으로 더 빠릅니다.

기본 API 메커니즘에 대한 자세한 내용은 [API의 도구 검색](https://platform.claude.com/docs/ko/agents-and-tools/tool-use/tool-search-tool)을 참조하십시오.

<Note>
  도구 검색에는 Claude Sonnet 4 이상 또는 Claude Opus 4 이상이 필요합니다. Haiku 모델은 도구 검색을 지원하지 않습니다.
</Note>

## 도구 검색 구성

도구 검색은 기본적으로 켜져 있습니다. Vertex AI에서는 기본적으로 비활성화되어 있으며, Claude Sonnet 4.5 이상 및 Claude Opus 4.5 이상에서 지원됩니다. `ANTHROPIC_BASE_URL`이 비공식 호스트를 가리킬 때도 비활성화됩니다. 대부분의 프록시는 `tool_reference` 블록을 전달하지 않기 때문입니다. `ENABLE_TOOL_SEARCH` 환경 변수로 기본값을 재정의할 수 있습니다:

| 값        | 동작                                                                                                                                                    |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| (설정 안 함) | 도구 검색이 켜져 있습니다. 도구 정의는 지연되고 필요에 따라 발견됩니다. Vertex AI 또는 비공식 `ANTHROPIC_BASE_URL`에서는 미리 로드로 폴백됩니다.                                                      |
| `true`   | 도구 검색이 항상 켜져 있습니다. SDK는 Vertex AI 및 프록시를 통해서도 베타 헤더를 전송합니다. Sonnet 4.5 또는 Opus 4.5보다 이전 Vertex AI 모델이나 `tool_reference` 블록을 지원하지 않는 프록시에서는 요청이 실패합니다. |
| `auto`   | 모든 도구 정의의 결합된 토큰 수를 모델의 컨텍스트 윈도우와 비교합니다. 10%를 초과하면 도구 검색이 활성화됩니다. 10% 미만이면 모든 도구가 정상적으로 컨텍스트에 로드됩니다.                                                  |
| `auto:N` | `auto`와 동일하지만 사용자 정의 백분율입니다. `auto:5`는 도구 정의가 컨텍스트 윈도우의 5%를 초과할 때 활성화됩니다. 낮은 값은 더 빨리 활성화됩니다.                                                          |
| `false`  | 도구 검색이 꺼져 있습니다. 모든 도구 정의는 매 턴마다 컨텍스트에 로드됩니다.                                                                                                          |

도구 검색은 원격 MCP 서버에서 오든 [사용자 정의 SDK MCP 서버](/ko/agent-sdk/custom-tools)에서 오든 모든 등록된 도구에 적용됩니다. `auto`를 사용할 때, 임계값은 모든 서버의 모든 도구 정의의 결합된 크기를 기반으로 합니다.

`query()`의 `env` 옵션에서 값을 설정합니다. 이 예제는 많은 도구를 노출하는 원격 MCP 서버에 연결하고, 와일드카드로 모두 사전 승인하며, 도구 정의가 컨텍스트 윈도우의 5%를 초과할 때 도구 검색이 활성화되도록 `auto:5`를 사용합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Find and run the appropriate database query",
    options: {
      mcpServers: {
        "enterprise-tools": {
          // Connect to a remote MCP server
          type: "http",
          url: "https://tools.example.com/mcp"
        }
      },
      allowedTools: ["mcp__enterprise-tools__*"], // Wildcard pre-approves all tools from this server
      env: {
        ENABLE_TOOL_SEARCH: "auto:5" // Activate tool search when tools exceed 5% of context
      }
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
              "enterprise-tools": {
                  "type": "http",
                  "url": "https://tools.example.com/mcp",
              }
          },
          allowed_tools=[
              "mcp__enterprise-tools__*"
          ],  # Wildcard pre-approves all tools from this server
          env={
              "ENABLE_TOOL_SEARCH": "auto:5"  # Activate tool search when tools exceed 5% of context
          },
      )

      async for message in query(
          prompt="Find and run the appropriate database query",
          options=options,
      ):
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```
</CodeGroup>

`ENABLE_TOOL_SEARCH`를 `"false"`로 설정하면 도구 검색이 비활성화되고 모든 도구 정의가 매 턴마다 컨텍스트에 로드됩니다. 이는 검색 왕복을 제거하므로, 도구 세트가 작을 때(약 10개 미만의 도구) 정의가 컨텍스트 윈도우에 편하게 맞을 때 더 빠를 수 있습니다.

## 도구 발견 최적화

검색 메커니즘은 도구 이름과 설명에 대해 쿼리를 일치시킵니다. `search_slack_messages`와 같은 이름은 `query_slack`보다 더 넓은 범위의 요청에 대해 표시됩니다. 특정 키워드가 있는 설명("키워드, 채널 또는 날짜 범위별로 Slack 메시지 검색")은 일반적인 설명("Slack 쿼리")보다 더 많은 쿼리와 일치합니다.

사용 가능한 도구 카테고리를 나열하는 시스템 프롬프트 섹션을 추가할 수도 있습니다. 이는 에이전트에게 검색할 수 있는 도구의 종류에 대한 컨텍스트를 제공합니다:

```text theme={null}
You can search for tools to interact with Slack, GitHub, and Jira.
```

## 제한 사항

* **최대 도구:** 카탈로그에 10,000개의 도구
* **검색 결과:** 검색당 가장 관련성이 높은 3-5개의 도구 반환
* **모델 지원:** Claude Sonnet 4 이상, Claude Opus 4 이상(Haiku 제외)

## 관련 문서

* [API의 도구 검색](https://platform.claude.com/docs/ko/agents-and-tools/tool-use/tool-search-tool): 사용자 정의 구현을 포함한 도구 검색의 전체 API 문서
* [MCP 서버 연결](/ko/agent-sdk/mcp): MCP 서버를 통해 외부 도구에 연결
* [사용자 정의 도구](/ko/agent-sdk/custom-tools): SDK MCP 서버로 자신의 도구 구축
* [TypeScript SDK 참조](/ko/agent-sdk/typescript): 전체 API 참조
* [Python SDK 참조](/ko/agent-sdk/python): 전체 API 참조

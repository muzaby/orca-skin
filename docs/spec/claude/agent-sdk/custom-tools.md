> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Claude에 사용자 정의 도구 제공

> Claude Agent SDK의 인프로세스 MCP 서버로 사용자 정의 도구를 정의하여 Claude가 함수를 호출하고, API를 사용하며, 도메인별 작업을 수행할 수 있도록 합니다.

사용자 정의 도구는 Claude가 대화 중에 호출할 수 있는 자신의 함수를 정의하도록 하여 Agent SDK를 확장합니다. SDK의 인프로세스 MCP 서버를 사용하면 Claude에 데이터베이스, 외부 API, 도메인별 로직 또는 애플리케이션에 필요한 다른 기능에 대한 액세스 권한을 부여할 수 있습니다.

이 가이드에서는 입력 스키마 및 핸들러를 사용하여 도구를 정의하고, 이를 MCP 서버로 번들링하고, `query`에 전달하며, Claude가 액세스할 수 있는 도구를 제어하는 방법을 다룹니다. 또한 오류 처리, 도구 주석, 이미지와 같은 비텍스트 콘텐츠 반환에 대해서도 다룹니다.

## 빠른 참조

| 원하는 작업                     | 수행 방법                                                                                                                                                                                  |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 도구 정의                      | 이름, 설명, 스키마 및 핸들러를 사용하여 [`@tool`](/ko/agent-sdk/python#tool) (Python) 또는 [`tool()`](/ko/agent-sdk/typescript#tool) (TypeScript)을 사용합니다. [사용자 정의 도구 만들기](#create-a-custom-tool)를 참조하세요. |
| Claude에 도구 등록              | `create_sdk_mcp_server` / `createSdkMcpServer`로 래핑하고 `query()`의 `mcpServers`에 전달합니다. [사용자 정의 도구 호출](#call-a-custom-tool)을 참조하세요.                                                       |
| 도구 사전 승인                   | 허용된 도구에 추가합니다. [허용된 도구 구성](#configure-allowed-tools)을 참조하세요.                                                                                                                           |
| Claude의 컨텍스트에서 기본 제공 도구 제거 | 원하는 기본 제공 도구만 나열하는 `tools` 배열을 전달합니다. [허용된 도구 구성](#configure-allowed-tools)을 참조하세요.                                                                                                    |
| Claude가 도구를 병렬로 호출하도록 허용   | 부작용이 없는 도구에 `readOnlyHint: true`를 설정합니다. [도구 주석 추가](#add-tool-annotations)를 참조하세요.                                                                                                     |
| 루프를 중지하지 않고 오류 처리          | 예외를 발생시키는 대신 `isError: true`를 반환합니다. [오류 처리](#handle-errors)를 참조하세요.                                                                                                                   |
| 이미지 또는 파일 반환               | 콘텐츠 배열에서 `image` 또는 `resource` 블록을 사용합니다. [이미지 및 리소스 반환](#return-images-and-resources)을 참조하세요.                                                                                         |
| 머신 판독 가능한 JSON 결과 반환       | 결과에 `structuredContent`를 설정합니다. [구조화된 데이터 반환](#return-structured-data)을 참조하세요.                                                                                                         |
| 많은 도구로 확장                  | [도구 검색](/ko/agent-sdk/tool-search)을 사용하여 필요에 따라 도구를 로드합니다.                                                                                                                             |

## 사용자 정의 도구 만들기

도구는 TypeScript의 [`tool()`](/ko/agent-sdk/typescript#tool) 헬퍼 또는 Python의 [`@tool`](/ko/agent-sdk/python#tool) 데코레이터에 인수로 전달되는 네 부분으로 정의됩니다:

* **이름:** Claude가 도구를 호출하는 데 사용하는 고유 식별자입니다.
* **설명:** 도구가 수행하는 작업입니다. Claude는 이를 읽고 도구를 호출할 시기를 결정합니다.
* **입력 스키마:** Claude가 제공해야 하는 인수입니다. TypeScript에서는 항상 [Zod 스키마](https://zod.dev/)이며, 핸들러의 `args`는 자동으로 입력됩니다. Python에서는 `{"latitude": float}`와 같이 이름을 유형에 매핑하는 딕셔너리이며, SDK가 JSON Schema로 변환합니다. Python 데코레이터는 열거형, 범위, 선택적 필드 또는 중첩된 객체가 필요할 때 전체 [JSON Schema](https://json-schema.org/understanding-json-schema/about) 딕셔너리도 허용합니다.
* **핸들러:** Claude가 도구를 호출할 때 실행되는 비동기 함수입니다. 검증된 인수를 받고 다음을 포함하는 객체를 반환해야 합니다:
  * `content` (필수): 각각 `"text"`, `"image"` 또는 `"resource"`의 `type`을 가진 결과 블록의 배열입니다. 비텍스트 블록은 [이미지 및 리소스 반환](#return-images-and-resources)을 참조하세요.
  * `structuredContent` (선택사항): 머신 판독 가능한 데이터로 결과를 보유하는 JSON 객체이며, `content`와 함께 반환됩니다. [구조화된 데이터 반환](#return-structured-data)을 참조하세요.
  * `isError` (선택사항): Claude가 반응할 수 있도록 도구 실패를 신호하려면 `true`로 설정합니다. [오류 처리](#handle-errors)를 참조하세요.

도구를 정의한 후 [`createSdkMcpServer`](/ko/agent-sdk/typescript#createsdkmcpserver) (TypeScript) 또는 [`create_sdk_mcp_server`](/ko/agent-sdk/python#create_sdk_mcp_server) (Python)를 사용하여 서버로 래핑합니다. 서버는 별도의 프로세스가 아닌 애플리케이션 내에서 인프로세스로 실행됩니다.

### 날씨 도구 예제

이 예제는 `get_temperature` 도구를 정의하고 MCP 서버로 래핑합니다. 도구만 설정합니다. `query`에 전달하고 실행하려면 아래의 [사용자 정의 도구 호출](#call-a-custom-tool)을 참조하세요.

<CodeGroup>
  ```python Python theme={null}
  from typing import Any
  import httpx
  from claude_agent_sdk import tool, create_sdk_mcp_server


  # 도구 정의: 이름, 설명, 입력 스키마, 핸들러
  @tool(
      "get_temperature",
      "Get the current temperature at a location",
      {"latitude": float, "longitude": float},
  )
  async def get_temperature(args: dict[str, Any]) -> dict[str, Any]:
      async with httpx.AsyncClient() as client:
          response = await client.get(
              "https://api.open-meteo.com/v1/forecast",
              params={
                  "latitude": args["latitude"],
                  "longitude": args["longitude"],
                  "current": "temperature_2m",
                  "temperature_unit": "fahrenheit",
              },
          )
          data = response.json()

      # 콘텐츠 배열 반환 - Claude는 이를 도구 결과로 봅니다
      return {
          "content": [
              {
                  "type": "text",
                  "text": f"Temperature: {data['current']['temperature_2m']}°F",
              }
          ]
      }


  # 도구를 인프로세스 MCP 서버로 래핑합니다
  weather_server = create_sdk_mcp_server(
      name="weather",
      version="1.0.0",
      tools=[get_temperature],
  )
  ```

  ```typescript TypeScript theme={null}
  import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  // 도구 정의: 이름, 설명, 입력 스키마, 핸들러
  const getTemperature = tool(
    "get_temperature",
    "Get the current temperature at a location",
    {
      latitude: z.number().describe("Latitude coordinate"), // .describe()는 Claude가 보는 필드 설명을 추가합니다
      longitude: z.number().describe("Longitude coordinate")
    },
    async (args) => {
      // args는 스키마에서 입력됩니다: { latitude: number; longitude: number }
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m&temperature_unit=fahrenheit`
      );
      const data: any = await response.json();

      // 콘텐츠 배열 반환 - Claude는 이를 도구 결과로 봅니다
      return {
        content: [{ type: "text", text: `Temperature: ${data.current.temperature_2m}°F` }]
      };
    }
  );

  // 도구를 인프로세스 MCP 서버로 래핑합니다
  const weatherServer = createSdkMcpServer({
    name: "weather",
    version: "1.0.0",
    tools: [getTemperature]
  });
  ```
</CodeGroup>

전체 매개변수 세부 정보, JSON Schema 입력 형식 및 반환 값 구조를 포함하여 [`tool()`](/ko/agent-sdk/typescript#tool) TypeScript 참조 또는 [`@tool`](/ko/agent-sdk/python#tool) Python 참조를 참조하세요.

<Tip>
  매개변수를 선택사항으로 만들려면: TypeScript에서 Zod 필드에 `.default()`를 추가합니다. Python에서 딕셔너리 스키마는 모든 키를 필수로 취급하므로 스키마에서 매개변수를 생략하고, 설명 문자열에서 언급하고, 핸들러에서 `args.get()`으로 읽습니다. 아래의 [`get_precipitation_chance` 도구](#add-more-tools)는 두 패턴을 모두 보여줍니다.
</Tip>

### 사용자 정의 도구 호출

`mcpServers` 옵션을 통해 생성한 MCP 서버를 `query`에 전달합니다. `mcpServers`의 키는 각 도구의 정규화된 이름에서 `{server_name}` 세그먼트가 됩니다: `mcp__{server_name}__{tool_name}`. 도구가 권한 프롬프트 없이 실행되도록 `allowedTools`에 해당 이름을 나열합니다.

이 스니펫은 [위의 예제](#weather-tool-example)의 `weatherServer`를 재사용하여 Claude에 특정 위치의 날씨를 묻습니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={"weather": weather_server},
          allowed_tools=["mcp__weather__get_temperature"],
      )

      async for message in query(
          prompt="What's the temperature in San Francisco?",
          options=options,
      ):
          # ResultMessage는 모든 도구 호출이 완료된 후의 최종 메시지입니다
          if isinstance(message, ResultMessage) and message.subtype == "success":
              print(message.result)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "What's the temperature in San Francisco?",
    options: {
      mcpServers: { weather: weatherServer },
      allowedTools: ["mcp__weather__get_temperature"]
    }
  })) {
    // "result"는 모든 도구 호출이 완료된 후의 최종 메시지입니다
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

### 더 많은 도구 추가

서버는 `tools` 배열에 나열한 만큼 많은 도구를 보유합니다. 서버에 둘 이상의 도구가 있으면 `allowedTools`에서 각각을 개별적으로 나열하거나 와일드카드 `mcp__weather__*`를 사용하여 서버가 노출하는 모든 도구를 포함할 수 있습니다.

아래 예제는 [날씨 도구 예제](#weather-tool-example)의 `weatherServer`에 두 번째 도구인 `get_precipitation_chance`를 추가하고 배열의 두 도구로 다시 빌드합니다.

<CodeGroup>
  ```python Python theme={null}
  # 동일한 서버에 대한 두 번째 도구 정의
  @tool(
      "get_precipitation_chance",
      "Get the hourly precipitation probability for a location. "
      "Optionally pass 'hours' (1-24) to control how many hours to return.",
      {"latitude": float, "longitude": float},
  )
  async def get_precipitation_chance(args: dict[str, Any]) -> dict[str, Any]:
      # 'hours'는 스키마에 없습니다 - .get()으로 읽어서 선택사항으로 만듭니다
      hours = args.get("hours", 12)
      async with httpx.AsyncClient() as client:
          response = await client.get(
              "https://api.open-meteo.com/v1/forecast",
              params={
                  "latitude": args["latitude"],
                  "longitude": args["longitude"],
                  "hourly": "precipitation_probability",
                  "forecast_days": 1,
              },
          )
          data = response.json()
      chances = data["hourly"]["precipitation_probability"][:hours]

      return {
          "content": [
              {
                  "type": "text",
                  "text": f"Next {hours} hours: {'%, '.join(map(str, chances))}%",
              }
          ]
      }


  # 배열의 두 도구로 서버를 다시 빌드합니다
  weather_server = create_sdk_mcp_server(
      name="weather",
      version="1.0.0",
      tools=[get_temperature, get_precipitation_chance],
  )
  ```

  ```typescript TypeScript theme={null}
  // 동일한 서버에 대한 두 번째 도구 정의
  const getPrecipitationChance = tool(
    "get_precipitation_chance",
    "Get the hourly precipitation probability for a location",
    {
      latitude: z.number(),
      longitude: z.number(),
      hours: z
        .number()
        .int()
        .min(1)
        .max(24)
        .default(12) // .default()는 매개변수를 선택사항으로 만듭니다
        .describe("How many hours of forecast to return")
    },
    async (args) => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&hourly=precipitation_probability&forecast_days=1`
      );
      const data: any = await response.json();
      const chances = data.hourly.precipitation_probability.slice(0, args.hours);

      return {
        content: [{ type: "text", text: `Next ${args.hours} hours: ${chances.join("%, ")}%` }]
      };
    }
  );

  // 배열의 두 도구로 서버를 다시 빌드합니다
  const weatherServer = createSdkMcpServer({
    name: "weather",
    version: "1.0.0",
    tools: [getTemperature, getPrecipitationChance]
  });
  ```
</CodeGroup>

이 배열의 모든 도구는 매 턴마다 컨텍스트 윈도우 공간을 소비합니다. 수십 개의 도구를 정의하는 경우 [도구 검색](/ko/agent-sdk/tool-search)을 참조하여 필요할 때 로드합니다.

### 도구 주석 추가

[도구 주석](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations)은 도구의 동작을 설명하는 선택적 메타데이터입니다. TypeScript의 `tool()` 헬퍼에 다섯 번째 인수로 전달하거나 Python의 `@tool` 데코레이터에 대해 `annotations` 키워드 인수를 통해 전달합니다. 모든 힌트 필드는 부울입니다.

| 필드                | 기본값     | 의미                                                           |
| :---------------- | :------ | :----------------------------------------------------------- |
| `readOnlyHint`    | `false` | 도구는 환경을 수정하지 않습니다. 도구를 다른 읽기 전용 도구와 병렬로 호출할 수 있는지 여부를 제어합니다. |
| `destructiveHint` | `true`  | 도구는 파괴적인 업데이트를 수행할 수 있습니다. 정보 제공용입니다.                        |
| `idempotentHint`  | `false` | 동일한 인수로 반복 호출해도 추가 효과가 없습니다. 정보 제공용입니다.                      |
| `openWorldHint`   | `true`  | 도구는 프로세스 외부의 시스템에 도달합니다. 정보 제공용입니다.                          |

주석은 메타데이터이지 강제 사항이 아닙니다. `readOnlyHint: true`로 표시된 도구도 핸들러가 수행하는 경우 디스크에 쓸 수 있습니다. 주석을 핸들러에 정확하게 유지합니다.

이 예제는 [날씨 도구 예제](#weather-tool-example)의 `get_temperature` 도구에 `readOnlyHint`를 추가합니다.

<CodeGroup>
  ```python Python theme={null}
  from claude_agent_sdk import tool, ToolAnnotations


  @tool(
      "get_temperature",
      "Get the current temperature at a location",
      {"latitude": float, "longitude": float},
      annotations=ToolAnnotations(
          readOnlyHint=True
      ),  # Claude가 이를 다른 읽기 전용 호출과 일괄 처리하도록 합니다
  )
  async def get_temperature(args):
      return {"content": [{"type": "text", "text": "..."}]}
  ```

  ```typescript TypeScript theme={null}
  tool(
    "get_temperature",
    "Get the current temperature at a location",
    { latitude: z.number(), longitude: z.number() },
    async (args) => ({ content: [{ type: "text", text: `...` }] }),
    { annotations: { readOnlyHint: true } } // Claude가 이를 다른 읽기 전용 호출과 일괄 처리하도록 합니다
  );
  ```
</CodeGroup>

[TypeScript](/ko/agent-sdk/typescript#toolannotations) 또는 [Python](/ko/agent-sdk/python#toolannotations) 참조에서 `ToolAnnotations`를 참조하세요.

## 도구 액세스 제어

[날씨 도구 예제](#weather-tool-example)는 서버를 등록하고 `allowedTools`에 도구를 나열했습니다. 이 섹션에서는 도구 이름이 구성되는 방식과 여러 도구가 있거나 기본 제공 도구를 제한하려는 경우 액세스 범위를 지정하는 방법을 다룹니다.

### 도구 이름 형식

MCP 도구가 Claude에 노출될 때 이름은 특정 형식을 따릅니다:

* 패턴: `mcp__{server_name}__{tool_name}`
* 예제: `weather` 서버의 `get_temperature`라는 도구는 `mcp__weather__get_temperature`가 됩니다

### 허용된 도구 구성

`tools` 옵션과 허용/거부 목록은 별도의 계층에서 작동합니다. `tools`는 Claude의 컨텍스트에 나타나는 기본 제공 도구를 제어합니다. 허용 및 거부 도구 목록은 Claude가 호출을 시도한 후 호출이 승인되거나 거부되는지 여부를 제어합니다.

| 옵션                        | 계층  | 효과                                                                                               |
| :------------------------ | :-- | :----------------------------------------------------------------------------------------------- |
| `tools: ["Read", "Grep"]` | 가용성 | 나열된 기본 제공 도구만 Claude의 컨텍스트에 있습니다. 나열되지 않은 기본 제공 도구는 제거됩니다. MCP 도구는 영향을 받지 않습니다.                  |
| `tools: []`               | 가용성 | 모든 기본 제공 도구가 제거됩니다. Claude는 MCP 도구만 사용할 수 있습니다.                                                  |
| 허용된 도구                    | 권한  | 나열된 도구는 권한 프롬프트 없이 실행됩니다. 나열되지 않은 도구는 계속 사용 가능합니다. 호출은 [권한 흐름](/ko/agent-sdk/permissions)을 거칩니다. |
| 거부된 도구                    | 권한  | 나열된 도구에 대한 모든 호출이 거부됩니다. 도구는 Claude의 컨텍스트에 남아 있으므로 Claude는 호출이 거부되기 전에 시도할 수 있습니다.               |

Claude가 사용할 수 있는 기본 제공 도구를 제한하려면 거부된 도구보다 `tools`를 선호합니다. `tools`에서 도구를 생략하면 컨텍스트에서 제거되므로 Claude는 시도하지 않습니다. `disallowedTools`에 나열하면 호출을 차단하지만 도구를 표시하므로 Claude는 시도하는 데 턴을 낭비할 수 있습니다. 전체 평가 순서는 [권한 구성](/ko/agent-sdk/permissions)을 참조하세요.

## 오류 처리

핸들러가 오류를 보고하는 방식에 따라 에이전트 루프가 계속되는지 중지되는지가 결정됩니다:

| 발생하는 상황                                                                 | 결과                                                                        |
| :---------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| 핸들러가 포착되지 않은 예외를 발생시킵니다                                                 | 에이전트 루프가 중지됩니다. Claude는 오류를 보지 못하고 `query` 호출이 실패합니다.                     |
| 핸들러가 오류를 포착하고 `isError: true` (TS) / `"is_error": True` (Python)를 반환합니다 | 에이전트 루프가 계속됩니다. Claude는 오류를 데이터로 보고 재시도하거나, 다른 도구를 시도하거나, 실패를 설명할 수 있습니다. |

아래 예제는 핸들러 내에서 두 가지 종류의 실패를 포착합니다. 0이 아닌 HTTP 상태는 응답에서 포착되어 오류 결과로 반환됩니다. 네트워크 오류 또는 잘못된 JSON은 주변 `try/except` (Python) 또는 `try/catch` (TypeScript)로 포착되어 오류 결과로도 반환됩니다. 두 경우 모두 핸들러는 정상적으로 반환되고 에이전트 루프가 계속됩니다.

<CodeGroup>
  ```python Python theme={null}
  import json
  import httpx
  from typing import Any


  @tool(
      "fetch_data",
      "Fetch data from an API",
      {"endpoint": str},  # 간단한 스키마
  )
  async def fetch_data(args: dict[str, Any]) -> dict[str, Any]:
      try:
          async with httpx.AsyncClient() as client:
              response = await client.get(args["endpoint"])
              if response.status_code != 200:
                  # Claude가 반응할 수 있도록 실패를 도구 결과로 반환합니다.
                  # is_error는 이를 실패한 호출로 표시하지 않으면 이상한 데이터로 표시합니다.
                  return {
                      "content": [
                          {
                              "type": "text",
                              "text": f"API error: {response.status_code} {response.reason_phrase}",
                          }
                      ],
                      "is_error": True,
                  }

              data = response.json()
              return {"content": [{"type": "text", "text": json.dumps(data, indent=2)}]}
      except Exception as e:
          # 여기서 포착하면 에이전트 루프가 살아있습니다. 포착되지 않은 예외는
          # 전체 query() 호출을 종료합니다.
          return {
              "content": [{"type": "text", "text": f"Failed to fetch data: {str(e)}"}],
              "is_error": True,
          }
  ```

  ```typescript TypeScript theme={null}
  tool(
    "fetch_data",
    "Fetch data from an API",
    {
      endpoint: z.string().url().describe("API endpoint URL")
    },
    async (args) => {
      try {
        const response = await fetch(args.endpoint);

        if (!response.ok) {
          // Claude가 반응할 수 있도록 실패를 도구 결과로 반환합니다.
          // isError는 이를 실패한 호출로 표시하지 않으면 이상한 데이터로 표시합니다.
          return {
            content: [
              {
                type: "text",
                text: `API error: ${response.status} ${response.statusText}`
              }
            ],
            isError: true
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        // 여기서 포착하면 에이전트 루프가 살아있습니다. 포착되지 않은 throw는
        // 전체 query() 호출을 종료합니다.
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
  ```
</CodeGroup>

## 이미지 및 리소스 반환

도구 결과의 `content` 배열은 `text`, `image` 및 `resource` 블록을 허용합니다. 동일한 응답에서 이들을 혼합할 수 있습니다.

### 이미지

이미지 블록은 이미지 바이트를 base64로 인코딩하여 인라인으로 전달합니다. URL 필드가 없습니다. URL에 있는 이미지를 반환하려면 핸들러에서 가져오고, 응답 바이트를 읽고, 반환하기 전에 base64로 인코딩합니다. 결과는 시각적 입력으로 처리됩니다.

| 필드         | 유형        | 참고                                                              |
| :--------- | :-------- | :-------------------------------------------------------------- |
| `type`     | `"image"` |                                                                 |
| `data`     | `string`  | Base64로 인코딩된 바이트입니다. `data:image/...;base64,` 접두사 없이 원본 base64만 |
| `mimeType` | `string`  | 필수입니다. 예: `image/png`, `image/jpeg`, `image/webp`, `image/gif`  |

<CodeGroup>
  ```python Python theme={null}
  import base64
  import httpx


  # URL에서 이미지를 가져와 Claude에 반환하는 도구를 정의합니다
  @tool("fetch_image", "Fetch an image from a URL and return it to Claude", {"url": str})
  async def fetch_image(args):
      async with httpx.AsyncClient() as client:  # 이미지 바이트를 가져옵니다
          response = await client.get(args["url"])

      return {
          "content": [
              {
                  "type": "image",
                  "data": base64.b64encode(response.content).decode(
                      "ascii"
                  ),  # 원본 바이트를 base64로 인코딩합니다
                  "mimeType": response.headers.get(
                      "content-type", "image/png"
                  ),  # 응답에서 MIME 유형을 읽습니다
              }
          ]
      }
  ```

  ```typescript TypeScript theme={null}
  tool(
    "fetch_image",
    "Fetch an image from a URL and return it to Claude",
    {
      url: z.string().url()
    },
    async (args) => {
      const response = await fetch(args.url); // 이미지 바이트를 가져옵니다
      const buffer = Buffer.from(await response.arrayBuffer()); // base64 인코딩을 위해 버퍼로 읽습니다
      const mimeType = response.headers.get("content-type") ?? "image/png";

      return {
        content: [
          {
            type: "image",
            data: buffer.toString("base64"), // 원본 바이트를 base64로 인코딩합니다
            mimeType
          }
        ]
      };
    }
  );
  ```
</CodeGroup>

### 리소스

리소스 블록은 URI로 식별되는 콘텐츠 조각을 포함합니다. URI는 Claude가 참조할 레이블입니다. 실제 콘텐츠는 블록의 `text` 또는 `blob` 필드에 있습니다. 도구가 나중에 이름으로 주소를 지정하는 것이 합리적인 것을 생성할 때 사용합니다. 예를 들어 생성된 파일 또는 외부 시스템의 레코드입니다.

| 필드                  | 유형           | 참고                                           |
| :------------------ | :----------- | :------------------------------------------- |
| `type`              | `"resource"` |                                              |
| `resource.uri`      | `string`     | 콘텐츠의 식별자입니다. 모든 URI 스키마                      |
| `resource.text`     | `string`     | 텍스트인 경우 콘텐츠입니다. `blob` 대신 이것을 제공하되 둘 다는 아닙니다 |
| `resource.blob`     | `string`     | 바이너리인 경우 base64로 인코딩된 콘텐츠입니다                 |
| `resource.mimeType` | `string`     | 선택사항                                         |

이 예제는 도구 핸들러 내에서 반환된 리소스 블록을 보여줍니다. URI `file:///tmp/report.md`는 Claude가 나중에 참조할 수 있는 레이블입니다. SDK는 해당 경로에서 읽지 않습니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: "file:///tmp/report.md", // Claude가 참조할 레이블이지 SDK가 읽는 경로가 아닙니다
          mimeType: "text/markdown",
          text: "# Report\n..." // 실제 콘텐츠, 인라인
        }
      }
    ]
  };
  ```

  ```python Python theme={null}
  return {
      "content": [
          {
              "type": "resource",
              "resource": {
                  "uri": "file:///tmp/report.md",  # Claude가 참조할 레이블이지 SDK가 읽는 경로가 아닙니다
                  "mimeType": "text/markdown",
                  "text": "# Report\n...",  # 실제 콘텐츠, 인라인
              },
          }
      ]
  }
  ```
</CodeGroup>

이 블록 모양은 MCP `CallToolResult` 유형에서 나옵니다. 전체 정의는 [MCP 사양](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result)을 참조하세요.

## 구조화된 데이터 반환

`structuredContent`는 `content` 배열과 별개인 결과의 선택적 JSON 객체입니다. 이를 사용하여 텍스트 문자열이나 이미지에서 구문 분석하는 대신 Claude가 정확한 필드로 읽을 수 있는 원본 값을 반환합니다.

`structuredContent`가 설정되면 Claude는 JSON과 `content`의 모든 이미지 또는 리소스 블록을 받습니다. `content`의 텍스트 블록은 구조화된 데이터를 복제한다고 가정하므로 전달되지 않습니다. 아래 예제는 차트를 이미지 블록으로 렌더링하고 동일한 핸들러에서 `structuredContent`의 뒤에 있는 데이터 포인트를 반환합니다.

```typescript TypeScript theme={null}
return {
  content: [
    {
      type: "image",
      data: chartPngBuffer.toString("base64"),
      mimeType: "image/png"
    }
  ],
  structuredContent: {
    series: "temperature_2m",
    unit: "fahrenheit",
    points: [62.1, 63.4, 65.0, 64.2]
  }
};
```

<Note>
  Python `@tool` 데코레이터는 핸들러의 반환 딕셔너리에서 `content` 및 `is_error`만 전달합니다. Python에서 `structuredContent`를 반환하려면 인프로세스 SDK 서버 대신 [독립형 MCP 서버](/ko/agent-sdk/mcp)를 실행합니다.
</Note>

## 예제: 단위 변환기

이 도구는 길이, 온도 및 무게 단위 간에 값을 변환합니다. 사용자는 "100킬로미터를 마일로 변환" 또는 "72°F는 섭씨온도로 몇 도인가"라고 물을 수 있으며, Claude는 요청에서 올바른 단위 유형과 단위를 선택합니다.

두 가지 패턴을 보여줍니다:

* **열거형 스키마:** `unit_type`은 고정된 값 집합으로 제한됩니다. TypeScript에서 `z.enum()`을 사용합니다. Python에서 딕셔너리 스키마는 열거형을 지원하지 않으므로 전체 JSON Schema 딕셔너리가 필요합니다.
* **지원되지 않는 입력 처리:** 변환 쌍을 찾을 수 없으면 핸들러는 `isError: true`를 반환하므로 Claude는 실패를 정상 결과로 취급하는 대신 사용자에게 무엇이 잘못되었는지 알릴 수 있습니다.

<CodeGroup>
  ```python Python theme={null}
  from typing import Any
  from claude_agent_sdk import tool, create_sdk_mcp_server


  # TypeScript의 z.enum()은 JSON Schema의 "enum" 제약이 됩니다.
  # 딕셔너리 스키마는 동등한 것이 없으므로 전체 JSON Schema가 필요합니다.
  @tool(
      "convert_units",
      "Convert a value from one unit to another",
      {
          "type": "object",
          "properties": {
              "unit_type": {
                  "type": "string",
                  "enum": ["length", "temperature", "weight"],
                  "description": "Category of unit",
              },
              "from_unit": {
                  "type": "string",
                  "description": "Unit to convert from, e.g. kilometers, fahrenheit, pounds",
              },
              "to_unit": {"type": "string", "description": "Unit to convert to"},
              "value": {"type": "number", "description": "Value to convert"},
          },
          "required": ["unit_type", "from_unit", "to_unit", "value"],
      },
  )
  async def convert_units(args: dict[str, Any]) -> dict[str, Any]:
      conversions = {
          "length": {
              "kilometers_to_miles": lambda v: v * 0.621371,
              "miles_to_kilometers": lambda v: v * 1.60934,
              "meters_to_feet": lambda v: v * 3.28084,
              "feet_to_meters": lambda v: v * 0.3048,
          },
          "temperature": {
              "celsius_to_fahrenheit": lambda v: (v * 9) / 5 + 32,
              "fahrenheit_to_celsius": lambda v: (v - 32) * 5 / 9,
              "celsius_to_kelvin": lambda v: v + 273.15,
              "kelvin_to_celsius": lambda v: v - 273.15,
          },
          "weight": {
              "kilograms_to_pounds": lambda v: v * 2.20462,
              "pounds_to_kilograms": lambda v: v * 0.453592,
              "grams_to_ounces": lambda v: v * 0.035274,
              "ounces_to_grams": lambda v: v * 28.3495,
          },
      }

      key = f"{args['from_unit']}_to_{args['to_unit']}"
      fn = conversions.get(args["unit_type"], {}).get(key)

      if not fn:
          return {
              "content": [
                  {
                      "type": "text",
                      "text": f"Unsupported conversion: {args['from_unit']} to {args['to_unit']}",
                  }
              ],
              "is_error": True,
          }

      result = fn(args["value"])
      return {
          "content": [
              {
                  "type": "text",
                  "text": f"{args['value']} {args['from_unit']} = {result:.4f} {args['to_unit']}",
              }
          ]
      }


  converter_server = create_sdk_mcp_server(
      name="converter",
      version="1.0.0",
      tools=[convert_units],
  )
  ```

  ```typescript TypeScript theme={null}
  import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
  import { z } from "zod";

  const convert = tool(
    "convert_units",
    "Convert a value from one unit to another",
    {
      unit_type: z.enum(["length", "temperature", "weight"]).describe("Category of unit"),
      from_unit: z
        .string()
        .describe("Unit to convert from, e.g. kilometers, fahrenheit, pounds"),
      to_unit: z.string().describe("Unit to convert to"),
      value: z.number().describe("Value to convert")
    },
    async (args) => {
      type Conversions = Record<string, Record<string, (v: number) => number>>;

      const conversions: Conversions = {
        length: {
          kilometers_to_miles: (v) => v * 0.621371,
          miles_to_kilometers: (v) => v * 1.60934,
          meters_to_feet: (v) => v * 3.28084,
          feet_to_meters: (v) => v * 0.3048
        },
        temperature: {
          celsius_to_fahrenheit: (v) => (v * 9) / 5 + 32,
          fahrenheit_to_celsius: (v) => ((v - 32) * 5) / 9,
          celsius_to_kelvin: (v) => v + 273.15,
          kelvin_to_celsius: (v) => v - 273.15
        },
        weight: {
          kilograms_to_pounds: (v) => v * 2.20462,
          pounds_to_kilograms: (v) => v * 0.453592,
          grams_to_ounces: (v) => v * 0.035274,
          ounces_to_grams: (v) => v * 28.3495
        }
      };

      const key = `${args.from_unit}_to_${args.to_unit}`;
      const fn = conversions[args.unit_type]?.[key];

      if (!fn) {
        return {
          content: [
            {
              type: "text",
              text: `Unsupported conversion: ${args.from_unit} to ${args.to_unit}`
            }
          ],
          isError: true
        };
      }

      const result = fn(args.value);
      return {
        content: [
          {
            type: "text",
            text: `${args.value} ${args.from_unit} = ${result.toFixed(4)} ${args.to_unit}`
          }
        ]
      };
    }
  );

  const converterServer = createSdkMcpServer({
    name: "converter",
    version: "1.0.0",
    tools: [convert]
  });
  ```
</CodeGroup>

서버가 정의되면 날씨 예제와 동일한 방식으로 `query`에 전달합니다. 이 예제는 루프에서 세 가지 다른 프롬프트를 보내 동일한 도구가 다양한 단위 유형을 처리하는 것을 보여줍니다. 각 응답에 대해 `AssistantMessage` 객체(Claude가 해당 턴 중에 수행한 도구 호출을 포함)를 검사하고 각 `ToolUseBlock`을 인쇄한 후 최종 `ResultMessage` 텍스트를 인쇄합니다. 이를 통해 Claude가 도구를 사용하는 시기와 자신의 지식에서 답변하는 시기를 볼 수 있습니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import (
      query,
      ClaudeAgentOptions,
      ResultMessage,
      AssistantMessage,
      ToolUseBlock,
  )


  async def main():
      options = ClaudeAgentOptions(
          mcp_servers={"converter": converter_server},
          allowed_tools=["mcp__converter__convert_units"],
      )

      prompts = [
          "Convert 100 kilometers to miles.",
          "What is 72°F in Celsius?",
          "How many pounds is 5 kilograms?",
      ]

      for prompt in prompts:
          async for message in query(prompt=prompt, options=options):
              if isinstance(message, AssistantMessage):
                  for block in message.content:
                      if isinstance(block, ToolUseBlock):
                          print(f"[tool call] {block.name}({block.input})")
              elif isinstance(message, ResultMessage) and message.subtype == "success":
                  print(f"Q: {prompt}\nA: {message.result}\n")


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const prompts = [
    "Convert 100 kilometers to miles.",
    "What is 72°F in Celsius?",
    "How many pounds is 5 kilograms?"
  ];

  for (const prompt of prompts) {
    for await (const message of query({
      prompt,
      options: {
        mcpServers: { converter: converterServer },
        allowedTools: ["mcp__converter__convert_units"]
      }
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            console.log(`[tool call] ${block.name}`, block.input);
          }
        }
      } else if (message.type === "result" && message.subtype === "success") {
        console.log(`Q: ${prompt}\nA: ${message.result}\n`);
      }
    }
  }
  ```
</CodeGroup>

## 다음 단계

사용자 정의 도구는 비동기 함수를 표준 인터페이스로 래핑합니다. 동일한 서버에서 이 페이지의 패턴을 혼합할 수 있습니다: 단일 서버는 데이터베이스 도구, API 게이트웨이 도구 및 이미지 렌더러를 함께 보유할 수 있습니다.

여기서:

* 서버가 수십 개의 도구로 증가하면 [도구 검색](/ko/agent-sdk/tool-search)을 참조하여 Claude가 필요할 때까지 로드를 연기합니다.
* 자신의 도구를 빌드하는 대신 외부 MCP 서버(파일 시스템, GitHub, Slack)에 연결하려면 [MCP 서버 연결](/ko/agent-sdk/mcp)을 참조하세요.
* 어떤 도구가 자동으로 실행되는지 대 승인이 필요한지 제어하려면 [권한 구성](/ko/agent-sdk/permissions)을 참조하세요.

## 관련 문서

* [TypeScript SDK 참조](/ko/agent-sdk/typescript)
* [Python SDK 참조](/ko/agent-sdk/python)
* [MCP 문서](https://modelcontextprotocol.io)
* [SDK 개요](/ko/agent-sdk/overview)

> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 훅으로 에이전트 동작 가로채기 및 제어

> 훅을 사용하여 에이전트 실행의 주요 지점에서 에이전트 동작을 가로채고 사용자 정의합니다

훅은 도구가 호출되거나 세션이 시작되거나 실행이 중지되는 등 에이전트 이벤트에 응답하여 코드를 실행하는 콜백 함수입니다. 훅을 사용하면 다음을 수행할 수 있습니다.

* **위험한 작업 차단** 실행 전에 파괴적인 셸 명령이나 무단 파일 액세스 같은 위험한 작업을 차단합니다
* **로깅 및 감사** 규정 준수, 디버깅 또는 분석을 위해 모든 도구 호출을 기록합니다
* **입력 및 출력 변환** 데이터를 정제하거나 자격 증명을 주입하거나 파일 경로를 리디렉션합니다
* **인간 승인 요구** 데이터베이스 쓰기 또는 API 호출 같은 민감한 작업에 대해 승인을 요구합니다
* **세션 수명 주기 추적** 상태를 관리하거나 리소스를 정리하거나 알림을 보냅니다

이 가이드에서는 훅이 어떻게 작동하는지, 훅을 구성하는 방법, 그리고 도구 차단, 입력 수정, 알림 전달 같은 일반적인 패턴의 예제를 제공합니다.

## 훅이 작동하는 방식

<Steps>
  <Step title="이벤트가 발생합니다">
    에이전트 실행 중에 무언가가 발생하고 SDK가 이벤트를 발생시킵니다. 도구가 호출되려고 할 때(`PreToolUse`), 도구가 결과를 반환했을 때(`PostToolUse`), 서브에이전트가 시작되거나 중지되었을 때, 에이전트가 유휴 상태일 때, 또는 실행이 완료되었을 때입니다. [전체 이벤트 목록](#available-hooks)을 참조하세요.
  </Step>

  <Step title="SDK가 등록된 훅을 수집합니다">
    SDK는 해당 이벤트 유형에 대해 등록된 훅을 확인합니다. 여기에는 `options.hooks`에 전달하는 콜백 훅과 해당 [`settingSources`](/ko/agent-sdk/typescript#settingSources) 또는 [`setting_sources`](/ko/agent-sdk/python#setting_sources) 항목이 활성화된 경우 설정 파일의 셸 명령 훅이 포함되며, 기본 `query()` 옵션에서는 활성화됩니다.
  </Step>

  <Step title="매처가 실행할 훅을 필터링합니다">
    훅에 [`matcher`](#matchers) 패턴(예: `"Write|Edit"`)이 있으면 SDK는 이벤트의 대상(예: 도구 이름)에 대해 테스트합니다. 매처가 없는 훅은 해당 유형의 모든 이벤트에 대해 실행됩니다.
  </Step>

  <Step title="콜백 함수가 실행됩니다">
    각 일치하는 훅의 [콜백 함수](#callback-functions)는 발생하는 상황에 대한 입력을 받습니다. 도구 이름, 인수, 세션 ID 및 기타 이벤트별 세부 정보입니다.
  </Step>

  <Step title="콜백이 결정을 반환합니다">
    작업(로깅, API 호출, 유효성 검사)을 수행한 후 콜백은 에이전트에게 수행할 작업을 알려주는 [출력 객체](#outputs)를 반환합니다. 작업을 허용하거나, 차단하거나, 입력을 수정하거나, 대화에 컨텍스트를 주입합니다.
  </Step>
</Steps>

다음 예제는 이러한 단계를 함께 보여줍니다. `PreToolUse` 훅(단계 1)을 `"Write|Edit"` 매처(단계 3)로 등록하므로 콜백은 파일 쓰기 도구에만 발생합니다. 트리거되면 콜백은 도구의 입력(단계 4)을 받고 파일 경로가 `.env` 파일을 대상으로 하는지 확인한 후 `permissionDecision: "deny"`를 반환하여 작업을 차단합니다(단계 5):

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import (
      AssistantMessage,
      ClaudeSDKClient,
      ClaudeAgentOptions,
      HookMatcher,
      ResultMessage,
  )


  # 도구 호출 세부 정보를 받는 훅 콜백을 정의합니다
  async def protect_env_files(input_data, tool_use_id, context):
      # 도구의 입력 인수에서 파일 경로를 추출합니다
      file_path = input_data["tool_input"].get("file_path", "")
      file_name = file_path.split("/")[-1]

      # .env 파일을 대상으로 하는 경우 작업을 차단합니다
      if file_name == ".env":
          return {
              "hookSpecificOutput": {
                  "hookEventName": input_data["hook_event_name"],
                  "permissionDecision": "deny",
                  "permissionDecisionReason": "Cannot modify .env files",
              }
          }

      # 빈 객체를 반환하여 작업을 허용합니다
      return {}


  async def main():
      options = ClaudeAgentOptions(
          hooks={
              # PreToolUse 이벤트에 대한 훅을 등록합니다
              # 매처는 Write 및 Edit 도구 호출만 필터링합니다
              "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[protect_env_files])]
          }
      )

      async with ClaudeSDKClient(options=options) as client:
          await client.query("Update the database configuration")
          async for message in client.receive_response():
              # 어시스턴트 및 결과 메시지를 필터링합니다
              if isinstance(message, (AssistantMessage, ResultMessage)):
                  print(message)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

  // HookCallback 타입으로 훅 콜백을 정의합니다
  const protectEnvFiles: HookCallback = async (input, toolUseID, { signal }) => {
    // 타입 안전성을 위해 입력을 특정 훅 타입으로 캐스팅합니다
    const preInput = input as PreToolUseHookInput;

    // tool_input을 캐스팅하여 속성에 액세스합니다(SDK에서 unknown으로 입력됨)
    const toolInput = preInput.tool_input as Record<string, unknown>;
    const filePath = toolInput?.file_path as string;
    const fileName = filePath?.split("/").pop();

    // .env 파일을 대상으로 하는 경우 작업을 차단합니다
    if (fileName === ".env") {
      return {
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          permissionDecision: "deny",
          permissionDecisionReason: "Cannot modify .env files"
        }
      };
    }

    // 빈 객체를 반환하여 작업을 허용합니다
    return {};
  };

  for await (const message of query({
    prompt: "Update the database configuration",
    options: {
      hooks: {
        // PreToolUse 이벤트에 대한 훅을 등록합니다
        // 매처는 Write 및 Edit 도구 호출만 필터링합니다
        PreToolUse: [{ matcher: "Write|Edit", hooks: [protectEnvFiles] }]
      }
    }
  })) {
    // 어시스턴트 및 결과 메시지를 필터링합니다
    if (message.type === "assistant" || message.type === "result") {
      console.log(message);
    }
  }
  ```
</CodeGroup>

## 사용 가능한 훅

SDK는 에이전트 실행의 다양한 단계에 대한 훅을 제공합니다. 일부 훅은 두 SDK 모두에서 사용 가능하지만 다른 훅은 TypeScript 전용입니다.

| 훅 이벤트                | Python SDK | TypeScript SDK | 트리거되는 조건                               | 사용 사례 예                              |
| -------------------- | ---------- | -------------- | -------------------------------------- | ------------------------------------ |
| `PreToolUse`         | 예          | 예              | 도구 호출 요청(차단 또는 수정 가능)                  | 위험한 셸 명령 차단                          |
| `PostToolUse`        | 예          | 예              | 도구 실행 결과                               | 모든 파일 변경 사항을 감사 추적에 기록               |
| `PostToolUseFailure` | 예          | 예              | 도구 실행 실패                               | 도구 오류 처리 또는 기록                       |
| `PostToolBatch`      | 아니오        | 예              | 전체 도구 호출 배치가 해결되며, 다음 모델 호출 전에 배치당 한 번 | 전체 배치에 대해 한 번 규칙 주입                  |
| `UserPromptSubmit`   | 예          | 예              | 사용자 프롬프트 제출                            | 프롬프트에 추가 컨텍스트 주입                     |
| `Stop`               | 예          | 예              | 에이전트 실행 중지                             | 종료 전 세션 상태 저장                        |
| `SubagentStart`      | 예          | 예              | 서브에이전트 초기화                             | 병렬 작업 생성 추적                          |
| `SubagentStop`       | 예          | 예              | 서브에이전트 완료                              | 병렬 작업의 결과 집계                         |
| `PreCompact`         | 예          | 예              | 대화 압축 요청                               | 요약 전에 전체 기록 보관                       |
| `PermissionRequest`  | 예          | 예              | 권한 대화가 표시될 예정                          | 사용자 정의 권한 처리                         |
| `SessionStart`       | 아니오        | 예              | 세션 초기화                                 | 로깅 및 원격 측정 초기화                       |
| `SessionEnd`         | 아니오        | 예              | 세션 종료                                  | 임시 리소스 정리                            |
| `Notification`       | 예          | 예              | 에이전트 상태 메시지                            | 에이전트 상태 업데이트를 Slack 또는 PagerDuty로 전송 |
| `Setup`              | 아니오        | 예              | 세션 설정/유지 관리                            | 초기화 작업 실행                            |
| `TeammateIdle`       | 아니오        | 예              | 팀원이 유휴 상태가 됨                           | 작업 재할당 또는 알림                         |
| `TaskCompleted`      | 아니오        | 예              | 백그라운드 작업 완료                            | 병렬 작업의 결과 집계                         |
| `ConfigChange`       | 아니오        | 예              | 구성 파일 변경                               | 동적으로 설정 다시 로드                        |
| `WorktreeCreate`     | 아니오        | 예              | Git worktree 생성                        | 격리된 작업 공간 추적                         |
| `WorktreeRemove`     | 아니오        | 예              | Git worktree 제거                        | 작업 공간 리소스 정리                         |

## 훅 구성

훅을 구성하려면 에이전트 옵션의 `hooks` 필드에 전달합니다(Python의 `ClaudeAgentOptions`, TypeScript의 `options` 객체).

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      hooks={"PreToolUse": [HookMatcher(matcher="Bash", hooks=[my_callback])]}
  )

  async with ClaudeSDKClient(options=options) as client:
      await client.query("Your prompt")
      async for message in client.receive_response():
          print(message)
  ```

  ```typescript TypeScript theme={null}
  for await (const message of query({
    prompt: "Your prompt",
    options: {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [myCallback] }]
      }
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

`hooks` 옵션은 다음과 같은 딕셔너리(Python) 또는 객체(TypeScript)입니다.

* **키**는 [훅 이벤트 이름](#available-hooks)입니다(예: `'PreToolUse'`, `'PostToolUse'`, `'Stop'`).
* **값**은 [매처](#matchers) 배열이며, 각각 선택적 필터 패턴과 [콜백 함수](#callback-functions)를 포함합니다.

### 매처

매처를 사용하여 콜백이 발생할 때를 필터링합니다. `matcher` 필드는 훅 이벤트 유형에 따라 다른 값과 일치하는 정규식 문자열입니다. 예를 들어 도구 기반 훅은 도구 이름과 일치하고, `Notification` 훅은 알림 유형과 일치합니다. 각 이벤트 유형에 대한 매처 값의 전체 목록은 [Claude Code 훅 참조](/ko/hooks#matcher-patterns)를 참조하세요.

| 옵션        | 타입               | 기본값         | 설명                                                                                                                                                                                                                                                      |
| --------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matcher` | `string`         | `undefined` | 이벤트의 필터 필드와 일치하는 정규식 패턴입니다. 도구 훅의 경우 도구 이름입니다. 기본 제공 도구에는 `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `Agent` 등이 포함됩니다([도구 입력 타입](/ko/agent-sdk/typescript#tool-input-types)에서 전체 목록 참조). MCP 도구는 `mcp__<server>__<action>` 패턴을 사용합니다. |
| `hooks`   | `HookCallback[]` | -           | 필수입니다. 패턴이 일치할 때 실행할 콜백 함수의 배열                                                                                                                                                                                                                          |
| `timeout` | `number`         | `60`        | 초 단위의 타임아웃                                                                                                                                                                                                                                              |

가능할 때마다 `matcher` 패턴을 사용하여 특정 도구를 대상으로 합니다. `'Bash'` 매처는 Bash 명령에만 실행되지만 패턴을 생략하면 콜백이 이벤트의 모든 발생에 대해 실행됩니다. 도구 기반 훅의 경우 매처는 **도구 이름**으로만 필터링하며, 파일 경로나 다른 인수로는 필터링하지 않습니다. 파일 경로로 필터링하려면 콜백 내에서 `tool_input.file_path`를 확인합니다.

<Tip>
  **도구 이름 발견:** [도구 입력 타입](/ko/agent-sdk/typescript#tool-input-types)에서 기본 제공 도구 이름의 전체 목록을 참조하거나, 매처 없이 훅을 추가하여 세션이 수행하는 모든 도구 호출을 기록합니다.

  **MCP 도구 이름 지정:** MCP 도구는 항상 `mcp__`로 시작하고 그 뒤에 서버 이름과 작업이 옵니다. `mcp__<server>__<action>`. 예를 들어 `playwright`라는 서버를 구성하면 해당 도구는 `mcp__playwright__browser_screenshot`, `mcp__playwright__browser_click` 등으로 이름이 지정됩니다. 서버 이름은 `mcpServers` 구성에서 사용하는 키에서 나옵니다.
</Tip>

### 콜백 함수

#### 입력

모든 훅 콜백은 세 가지 인수를 받습니다.

* **입력 데이터:** 이벤트 세부 정보를 포함하는 입력된 객체입니다. 각 훅 유형은 자체 입력 형태를 가집니다(예: `PreToolUseHookInput`은 `tool_name`과 `tool_input`을 포함하고, `NotificationHookInput`은 `message`를 포함합니다). [TypeScript](/ko/agent-sdk/typescript#hookinput) 및 [Python](/ko/agent-sdk/python#hookinput) SDK 참조에서 전체 타입 정의를 참조하세요.
  * 모든 훅 입력은 `session_id`, `cwd`, `hook_event_name`을 공유합니다.
  * `agent_id`와 `agent_type`은 훅이 서브에이전트 내에서 발생할 때 채워집니다. TypeScript에서는 기본 훅 입력에 있으며 모든 훅 유형에서 사용 가능합니다. Python에서는 `PreToolUse`, `PostToolUse`, `PostToolUseFailure`에만 있습니다.
* **도구 사용 ID** (`str | None` / `string | undefined`): 동일한 도구 호출에 대해 `PreToolUse` 및 `PostToolUse` 이벤트를 연결합니다.
* **컨텍스트:** TypeScript에서는 취소를 위한 `signal` 속성(`AbortSignal`)을 포함합니다. Python에서는 이 인수는 향후 사용을 위해 예약되어 있습니다.

#### 출력

콜백은 두 가지 필드 범주를 포함하는 객체를 반환합니다.

* **최상위 필드**는 대화를 제어합니다. `systemMessage`는 모델에 표시되는 메시지를 대화에 주입하고, `continue`(Python에서는 `continue_`)는 이 훅 후에 에이전트가 계속 실행되는지 여부를 결정합니다.
* \*\*`hookSpecificOutput`\*\*은 현재 작업을 제어합니다. 내부의 필드는 훅 이벤트 유형에 따라 다릅니다. `PreToolUse` 훅의 경우 `permissionDecision`(`"allow"`, `"deny"`, `"ask"`, 또는 `"defer"`), `permissionDecisionReason`, `updatedInput`을 설정하는 곳입니다. `"defer"`를 반환하면 쿼리가 종료되어 [나중에 재개](/ko/hooks#defer-a-tool-call-for-later)할 수 있습니다. `PostToolUse` 훅의 경우 `additionalContext`를 설정하여 도구 결과에 정보를 추가하거나 `updatedToolOutput`을 설정하여 Claude가 보기 전에 도구의 출력을 완전히 바꿀 수 있습니다.

변경 없이 작업을 허용하려면 `{}`를 반환합니다. SDK 콜백 훅은 [Claude Code 셸 명령 훅](/ko/hooks#json-output)과 동일한 JSON 출력 형식을 사용하며, 이는 모든 필드와 이벤트별 옵션을 문서화합니다. SDK 타입 정의는 [TypeScript](/ko/agent-sdk/typescript#synchookjsonoutput) 및 [Python](/ko/agent-sdk/python#synchookjsonoutput) SDK 참조를 참조하세요.

<Note>
  여러 훅 또는 권한 규칙이 적용되는 경우 **deny**는 **defer**보다 우선하고, **defer**는 **ask**보다 우선하고, **ask**는 **allow**보다 우선합니다. 훅이 `deny`를 반환하면 다른 훅에 관계없이 작업이 차단됩니다.
</Note>

#### 비동기 출력

기본적으로 에이전트는 훅이 반환될 때까지 기다립니다. 훅이 부작용(로깅, 웹훅 전송)을 수행하고 에이전트의 동작에 영향을 미칠 필요가 없으면 대신 비동기 출력을 반환할 수 있습니다. 이는 에이전트에게 훅이 완료될 때까지 기다리지 않고 즉시 계속하도록 알립니다.

<CodeGroup>
  ```python Python theme={null}
  async def async_hook(input_data, tool_use_id, context):
      # 백그라운드 작업을 시작한 후 즉시 반환합니다
      asyncio.create_task(send_to_logging_service(input_data))
      return {"async_": True, "asyncTimeout": 30000}
  ```

  ```typescript TypeScript theme={null}
  const asyncHook: HookCallback = async (input, toolUseID, { signal }) => {
    // 백그라운드 작업을 시작한 후 즉시 반환합니다
    sendToLoggingService(input).catch(console.error);
    return { async: true, asyncTimeout: 30000 };
  };
  ```
</CodeGroup>

| 필드             | 타입       | 설명                                                                             |
| -------------- | -------- | ------------------------------------------------------------------------------ |
| `async`        | `true`   | 비동기 모드를 신호합니다. 에이전트는 기다리지 않고 진행합니다. Python에서는 예약된 키워드를 피하기 위해 `async_`를 사용합니다. |
| `asyncTimeout` | `number` | 백그라운드 작업에 대한 선택적 타임아웃(밀리초)                                                     |

<Note>
  비동기 출력은 에이전트가 이미 진행했으므로 차단, 수정 또는 작업에 컨텍스트를 주입할 수 없습니다. 로깅, 메트릭 또는 알림 같은 부작용에만 사용합니다.
</Note>

## 예제

### 도구 입력 수정

이 예제는 Write 도구 호출을 가로채고 `file_path` 인수를 다시 작성하여 `/sandbox`를 앞에 붙여 모든 파일 쓰기를 샌드박스 디렉토리로 리디렉션합니다. 콜백은 수정된 경로와 함께 `updatedInput`을 반환하고 `permissionDecision: 'allow'`를 반환하여 다시 작성된 작업을 자동 승인합니다.

<CodeGroup>
  ```python Python theme={null}
  async def redirect_to_sandbox(input_data, tool_use_id, context):
      if input_data["hook_event_name"] != "PreToolUse":
          return {}

      if input_data["tool_name"] == "Write":
          original_path = input_data["tool_input"].get("file_path", "")
          return {
              "hookSpecificOutput": {
                  "hookEventName": input_data["hook_event_name"],
                  "permissionDecision": "allow",
                  "updatedInput": {
                      **input_data["tool_input"],
                      "file_path": f"/sandbox{original_path}",
                  },
              }
          }
      return {}
  ```

  ```typescript TypeScript theme={null}
  const redirectToSandbox: HookCallback = async (input, toolUseID, { signal }) => {
    if (input.hook_event_name !== "PreToolUse") return {};

    const preInput = input as PreToolUseHookInput;
    const toolInput = preInput.tool_input as Record<string, unknown>;
    if (preInput.tool_name === "Write") {
      const originalPath = toolInput.file_path as string;
      return {
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          permissionDecision: "allow",
          updatedInput: {
            ...toolInput,
            file_path: `/sandbox${originalPath}`
          }
        }
      };
    }
    return {};
  };
  ```
</CodeGroup>

<Note>
  `updatedInput`을 사용할 때는 수정된 입력을 자동 승인하기 위해 `permissionDecision: 'allow'`를 포함하거나 사용자에게 표시하기 위해 `permissionDecision: 'ask'`를 포함해야 합니다. `'defer'`를 사용하면 `updatedInput`은 무시됩니다. 항상 원본 `tool_input`을 변경하지 않고 새 객체를 반환합니다.
</Note>

### 컨텍스트 추가 및 도구 차단

이 예제는 `/etc` 디렉토리에 쓰려는 시도를 차단하고 모델과 사용자 모두에게 이유를 설명합니다.

* `permissionDecision: 'deny'`는 도구 호출을 중지합니다.
* `permissionDecisionReason`은 모델에 이유를 알려주므로 재시도를 피합니다.
* `systemMessage`는 사용자에게 발생한 상황을 보여줍니다.

<CodeGroup>
  ```python Python theme={null}
  async def block_etc_writes(input_data, tool_use_id, context):
      file_path = input_data["tool_input"].get("file_path", "")

      if file_path.startswith("/etc"):
          return {
              # 최상위 필드: 사용자에게 표시되는 메시지
              "systemMessage": "Remember: system directories like /etc are protected.",
              # hookSpecificOutput: 작업을 차단합니다
              "hookSpecificOutput": {
                  "hookEventName": input_data["hook_event_name"],
                  "permissionDecision": "deny",
                  "permissionDecisionReason": "Writing to /etc is not allowed",
              },
          }
      return {}
  ```

  ```typescript TypeScript theme={null}
  const blockEtcWrites: HookCallback = async (input, toolUseID, { signal }) => {
    const preInput = input as PreToolUseHookInput;
    const toolInput = preInput.tool_input as Record<string, unknown>;
    const filePath = toolInput?.file_path as string;

    if (filePath?.startsWith("/etc")) {
      return {
        // 최상위 필드: 사용자에게 표시되는 메시지
        systemMessage: "Remember: system directories like /etc are protected.",
        // hookSpecificOutput: 작업을 차단합니다
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          permissionDecision: "deny",
          permissionDecisionReason: "Writing to /etc is not allowed"
        }
      };
    }
    return {};
  };
  ```
</CodeGroup>

### 특정 도구 자동 승인

기본적으로 에이전트는 특정 도구를 사용하기 전에 권한을 요청할 수 있습니다. 이 예제는 `permissionDecision: 'allow'`를 반환하여 읽기 전용 파일 시스템 도구(Read, Glob, Grep)를 자동 승인하여 사용자 확인 없이 실행되도록 하면서 다른 모든 도구는 일반 권한 확인을 받습니다.

<CodeGroup>
  ```python Python theme={null}
  async def auto_approve_read_only(input_data, tool_use_id, context):
      if input_data["hook_event_name"] != "PreToolUse":
          return {}

      read_only_tools = ["Read", "Glob", "Grep"]
      if input_data["tool_name"] in read_only_tools:
          return {
              "hookSpecificOutput": {
                  "hookEventName": input_data["hook_event_name"],
                  "permissionDecision": "allow",
                  "permissionDecisionReason": "Read-only tool auto-approved",
              }
          }
      return {}
  ```

  ```typescript TypeScript theme={null}
  const autoApproveReadOnly: HookCallback = async (input, toolUseID, { signal }) => {
    if (input.hook_event_name !== "PreToolUse") return {};

    const preInput = input as PreToolUseHookInput;
    const readOnlyTools = ["Read", "Glob", "Grep"];
    if (readOnlyTools.includes(preInput.tool_name)) {
      return {
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          permissionDecision: "allow",
          permissionDecisionReason: "Read-only tool auto-approved"
        }
      };
    }
    return {};
  };
  ```
</CodeGroup>

### 여러 훅 등록

이벤트가 발생하면 일치하는 모든 훅이 병렬로 실행됩니다. 권한 결정의 경우 가장 제한적인 결과가 우선합니다. 단일 `deny`는 다른 훅이 반환하는 것에 관계없이 도구 호출을 차단합니다. 완료 순서가 비결정적이므로 다른 훅이 먼저 실행되었다고 가정하지 않고 각 훅이 독립적으로 작동하도록 작성합니다.

아래 예제는 모든 도구 호출에 대해 세 가지 독립적인 확인을 등록합니다.

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      hooks={
          "PreToolUse": [
              HookMatcher(hooks=[authorization_check]),
              HookMatcher(hooks=[input_validator]),
              HookMatcher(hooks=[audit_logger]),
          ]
      }
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    hooks: {
      PreToolUse: [
        { hooks: [authorizationCheck] },
        { hooks: [inputValidator] },
        { hooks: [auditLogger] }
      ]
    }
  };
  ```
</CodeGroup>

### 정규식 매처로 필터링

정규식 패턴을 사용하여 여러 도구를 일치시킵니다. 이 예제는 서로 다른 범위의 세 가지 매처를 등록합니다. 첫 번째는 파일 수정 도구에만 `file_security_hook`을 트리거하고, 두 번째는 모든 MCP 도구(이름이 `mcp__`로 시작하는 도구)에 대해 `mcp_audit_hook`을 트리거하고, 세 번째는 이름에 관계없이 모든 도구 호출에 대해 `global_logger`를 트리거합니다.

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      hooks={
          "PreToolUse": [
              # 파일 수정 도구 일치
              HookMatcher(matcher="Write|Edit|Delete", hooks=[file_security_hook]),
              # 모든 MCP 도구 일치
              HookMatcher(matcher="^mcp__", hooks=[mcp_audit_hook]),
              # 모든 것 일치(매처 없음)
              HookMatcher(hooks=[global_logger]),
          ]
      }
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    hooks: {
      PreToolUse: [
        // 파일 수정 도구 일치
        { matcher: "Write|Edit|Delete", hooks: [fileSecurityHook] },

        // 모든 MCP 도구 일치
        { matcher: "^mcp__", hooks: [mcpAuditHook] },

        // 모든 것 일치(매처 없음)
        { hooks: [globalLogger] }
      ]
    }
  };
  ```
</CodeGroup>

### 서브에이전트 활동 추적

`SubagentStop` 훅을 사용하여 서브에이전트가 작업을 완료할 때를 모니터링합니다. [TypeScript](/ko/agent-sdk/typescript#hookinput) 및 [Python](/ko/agent-sdk/python#hookinput) SDK 참조에서 전체 입력 타입을 참조하세요. 이 예제는 서브에이전트가 완료될 때마다 요약을 기록합니다.

<CodeGroup>
  ```python Python theme={null}
  async def subagent_tracker(input_data, tool_use_id, context):
      # 서브에이전트가 완료될 때 세부 정보를 기록합니다
      print(f"[SUBAGENT] Completed: {input_data['agent_id']}")
      print(f"  Transcript: {input_data['agent_transcript_path']}")
      print(f"  Tool use ID: {tool_use_id}")
      print(f"  Stop hook active: {input_data.get('stop_hook_active')}")
      return {}


  options = ClaudeAgentOptions(
      hooks={"SubagentStop": [HookMatcher(hooks=[subagent_tracker])]}
  )
  ```

  ```typescript TypeScript theme={null}
  import { HookCallback, SubagentStopHookInput } from "@anthropic-ai/claude-agent-sdk";

  const subagentTracker: HookCallback = async (input, toolUseID, { signal }) => {
    // SubagentStopHookInput으로 캐스팅하여 서브에이전트별 필드에 액세스합니다
    const subInput = input as SubagentStopHookInput;

    // 서브에이전트가 완료될 때 세부 정보를 기록합니다
    console.log(`[SUBAGENT] Completed: ${subInput.agent_id}`);
    console.log(`  Transcript: ${subInput.agent_transcript_path}`);
    console.log(`  Tool use ID: ${toolUseID}`);
    console.log(`  Stop hook active: ${subInput.stop_hook_active}`);
    return {};
  };

  const options = {
    hooks: {
      SubagentStop: [{ hooks: [subagentTracker] }]
    }
  };
  ```
</CodeGroup>

### 훅에서 HTTP 요청 만들기

훅은 HTTP 요청 같은 비동기 작업을 수행할 수 있습니다. 처리되지 않은 예외가 에이전트를 중단할 수 있으므로 훅 내에서 오류를 포착하고 전파하지 않습니다.

이 예제는 각 도구가 완료된 후 웹훅을 전송하여 어떤 도구가 실행되었는지와 언제 실행되었는지를 기록합니다. 훅은 실패한 웹훅이 에이전트를 중단하지 않도록 오류를 포착합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  import json
  import urllib.request
  from datetime import datetime


  def _send_webhook(tool_name):
      """도구 사용 데이터를 외부 웹훅에 POST하는 동기 헬퍼입니다."""
      data = json.dumps(
          {
              "tool": tool_name,
              "timestamp": datetime.now().isoformat(),
          }
      ).encode()
      req = urllib.request.Request(
          "https://api.example.com/webhook",
          data=data,
          headers={"Content-Type": "application/json"},
          method="POST",
      )
      urllib.request.urlopen(req)


  async def webhook_notifier(input_data, tool_use_id, context):
      # 도구가 완료된 후(PostToolUse)에만 발생하고, 전에는 아닙니다
      if input_data["hook_event_name"] != "PostToolUse":
          return {}

      try:
          # 이벤트 루프를 차단하지 않도록 스레드에서 차단 HTTP 호출을 실행합니다
          await asyncio.to_thread(_send_webhook, input_data["tool_name"])
      except Exception as e:
          # 오류를 기록하지만 발생시키지 않습니다. 실패한 웹훅이 에이전트를 중단해서는 안 됩니다
          print(f"Webhook request failed: {e}")

      return {}
  ```

  ```typescript TypeScript theme={null}
  import { query, HookCallback, PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

  const webhookNotifier: HookCallback = async (input, toolUseID, { signal }) => {
    // 도구가 완료된 후(PostToolUse)에만 발생하고, 전에는 아닙니다
    if (input.hook_event_name !== "PostToolUse") return {};

    try {
      await fetch("https://api.example.com/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: (input as PostToolUseHookInput).tool_name,
          timestamp: new Date().toISOString()
        }),
        // 훅이 타임아웃되면 요청이 취소되도록 신호를 전달합니다
        signal
      });
    } catch (error) {
      // 다른 오류와 별도로 취소를 처리합니다
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Webhook request cancelled");
      }
      // 다시 발생시키지 않습니다. 실패한 웹훅이 에이전트를 중단해서는 안 됩니다
    }

    return {};
  };

  // PostToolUse 훅으로 등록합니다
  for await (const message of query({
    prompt: "Refactor the auth module",
    options: {
      hooks: {
        PostToolUse: [{ hooks: [webhookNotifier] }]
      }
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

### Slack으로 알림 전달

`Notification` 훅을 사용하여 에이전트에서 시스템 알림을 받고 외부 서비스로 전달합니다. 알림은 특정 이벤트 유형에 대해 발생합니다. `permission_prompt`(Claude가 권한 필요), `idle_prompt`(Claude가 입력 대기 중), `auth_success`(인증 완료), `elicitation_dialog`(Claude가 사용자에게 프롬프트 중), `elicitation_response`(사용자가 유도 질문에 답함), `elicitation_complete`(유도 질문이 종료됨). 각 알림에는 인간이 읽을 수 있는 설명이 있는 `message` 필드와 선택적으로 `title`이 포함됩니다.

이 예제는 모든 알림을 Slack 채널로 전달합니다. [Slack 수신 웹훅 URL](https://api.slack.com/messaging/webhooks)이 필요하며, 이는 Slack 작업 공간에 앱을 추가하고 수신 웹훅을 활성화하여 생성합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  import json
  import urllib.request

  from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, HookMatcher


  def _send_slack_notification(message):
      """수신 웹훅을 통해 Slack에 메시지를 보내는 동기 헬퍼입니다."""
      data = json.dumps({"text": f"Agent status: {message}"}).encode()
      req = urllib.request.Request(
          "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
          data=data,
          headers={"Content-Type": "application/json"},
          method="POST",
      )
      urllib.request.urlopen(req)


  async def notification_handler(input_data, tool_use_id, context):
      try:
          # 이벤트 루프를 차단하지 않도록 스레드에서 차단 HTTP 호출을 실행합니다
          await asyncio.to_thread(_send_slack_notification, input_data.get("message", ""))
      except Exception as e:
          print(f"Failed to send notification: {e}")

      # 빈 객체를 반환합니다. 알림 훅은 에이전트 동작을 수정하지 않습니다
      return {}


  async def main():
      options = ClaudeAgentOptions(
          hooks={
              # 알림 이벤트에 대한 훅을 등록합니다(매처 필요 없음)
              "Notification": [HookMatcher(hooks=[notification_handler])],
          },
      )

      async with ClaudeSDKClient(options=options) as client:
          await client.query("Analyze this codebase")
          async for message in client.receive_response():
              print(message)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query, HookCallback, NotificationHookInput } from "@anthropic-ai/claude-agent-sdk";

  // Slack으로 알림을 보내는 훅 콜백을 정의합니다
  const notificationHandler: HookCallback = async (input, toolUseID, { signal }) => {
    // NotificationHookInput으로 캐스팅하여 메시지 필드에 액세스합니다
    const notification = input as NotificationHookInput;

    try {
      // 알림 메시지를 Slack 수신 웹훅에 POST합니다
      await fetch("https://hooks.slack.com/services/YOUR/WEBHOOK/URL", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Agent status: ${notification.message}`
        }),
        // 훅이 타임아웃되면 요청이 취소되도록 신호를 전달합니다
        signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Notification cancelled");
      } else {
        console.error("Failed to send notification:", error);
      }
    }

    // 빈 객체를 반환합니다. 알림 훅은 에이전트 동작을 수정하지 않습니다
    return {};
  };

  // 알림 이벤트에 대한 훅을 등록합니다(매처 필요 없음)
  for await (const message of query({
    prompt: "Analyze this codebase",
    options: {
      hooks: {
        Notification: [{ hooks: [notificationHandler] }]
      }
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

## 일반적인 문제 해결

### 훅이 발생하지 않음

* 훅 이벤트 이름이 올바르고 대소문자를 구분하는지 확인합니다(`preToolUse`가 아닌 `PreToolUse`).
* 매처 패턴이 도구 이름과 정확히 일치하는지 확인합니다.
* 훅이 `options.hooks`의 올바른 이벤트 유형 아래에 있는지 확인합니다.
* `Stop` 및 `SubagentStop` 같은 도구가 아닌 훅의 경우 매처는 다른 필드와 일치합니다([매처 패턴](/ko/hooks#matcher-patterns) 참조).
* 에이전트가 [`max_turns`](/ko/agent-sdk/python#claudeagentoptions) 제한에 도달하면 훅이 발생하지 않을 수 있습니다. 세션이 훅을 실행하기 전에 종료되기 때문입니다.

### 매처가 예상대로 필터링하지 않음

매처는 **도구 이름**만 일치하며, 파일 경로나 다른 인수는 일치하지 않습니다. 파일 경로로 필터링하려면 훅 내에서 `tool_input.file_path`를 확인합니다:

```typescript theme={null}
const myHook: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const filePath = toolInput?.file_path as string;
  if (!filePath?.endsWith(".md")) return {}; // 마크다운이 아닌 파일 건너뛰기
  // 마크다운 파일 처리...
  return {};
};
```

### 훅 타임아웃

* `HookMatcher` 구성에서 `timeout` 값을 증가시킵니다.
* TypeScript에서 세 번째 콜백 인수의 `AbortSignal`을 사용하여 취소를 정상적으로 처리합니다.

### 도구가 예기치 않게 차단됨

* `permissionDecision: 'deny'` 반환에 대해 모든 `PreToolUse` 훅을 확인합니다.
* 훅에 로깅을 추가하여 반환하는 `permissionDecisionReason`을 확인합니다.
* 매처 패턴이 너무 광범위하지 않은지 확인합니다(빈 매처는 모든 도구와 일치).

### 수정된 입력이 적용되지 않음

* `updatedInput`이 최상위 수준이 아닌 `hookSpecificOutput` 내부에 있는지 확인합니다:

  ```typescript theme={null}
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { command: "new command" }
    }
  };
  ```

* 입력 수정이 적용되려면 `permissionDecision: 'allow'` 또는 `'ask'`도 반환해야 합니다.

* `hookSpecificOutput`에 `hookEventName`을 포함하여 출력이 어떤 훅 유형에 대한 것인지 식별합니다.

### Python에서 세션 훅을 사용할 수 없음

`SessionStart` 및 `SessionEnd`는 TypeScript에서 SDK 콜백 훅으로 등록할 수 있지만 Python SDK에서는 사용할 수 없습니다(`HookEvent`는 이를 생략합니다). Python에서는 설정 파일(예: `.claude/settings.json`)에 정의된 [셸 명령 훅](/ko/hooks#hook-events)으로만 사용 가능합니다. SDK 애플리케이션에서 셸 명령 훅을 로드하려면 [`setting_sources`](/ko/agent-sdk/python#settingsource) 또는 [`settingSources`](/ko/agent-sdk/typescript#settingsource)를 사용하여 적절한 설정 소스를 포함합니다:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      setting_sources=["project"],  # .claude/settings.json을 로드합니다(훅 포함)
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    settingSources: ["project"] // .claude/settings.json을 로드합니다(훅 포함)
  };
  ```
</CodeGroup>

Python SDK 콜백으로 초기화 로직을 실행하려면 `client.receive_response()`의 첫 번째 메시지를 트리거로 사용합니다.

### 서브에이전트 권한 프롬프트 증가

여러 서브에이전트를 생성할 때 각각 별도로 권한을 요청할 수 있습니다. 서브에이전트는 부모 에이전트 권한을 자동으로 상속하지 않습니다. 반복된 프롬프트를 피하려면 `PreToolUse` 훅을 사용하여 특정 도구를 자동 승인하거나 서브에이전트 세션에 적용되는 권한 규칙을 구성합니다.

### 서브에이전트를 사용한 재귀 훅 루프

서브에이전트를 생성하는 `UserPromptSubmit` 훅은 해당 서브에이전트가 동일한 훅을 트리거하면 무한 루프를 만들 수 있습니다. 이를 방지하려면:

* 훅 입력에서 서브에이전트 표시기를 확인한 후 생성합니다.
* 공유 변수 또는 세션 상태를 사용하여 이미 서브에이전트 내부에 있는지 추적합니다.
* 훅을 최상위 에이전트 세션에만 실행되도록 범위를 지정합니다.

### systemMessage가 출력에 나타나지 않음

`systemMessage` 필드는 사용자에게 메시지를 표시합니다. 기본적으로 SDK는 메시지 스트림에서 훅 출력을 표시하지 않으므로 `includeHookEvents`(`Python에서는 include_hook_events`)를 설정하지 않으면 메시지가 나타나지 않을 수 있습니다. 대신 모델에 컨텍스트를 전달하려면 [`additionalContext`](/ko/hooks#add-context-for-claude)를 반환합니다.

훅 결정을 애플리케이션에 안정적으로 표시해야 하면 별도로 기록하거나 전용 출력 채널을 사용합니다.

## 관련 리소스

* [Claude Code 훅 참조](/ko/hooks): 전체 JSON 입력/출력 스키마, 이벤트 문서 및 매처 패턴
* [Claude Code 훅 가이드](/ko/hooks-guide): 셸 명령 훅 예제 및 연습
* [TypeScript SDK 참조](/ko/agent-sdk/typescript): 훅 타입, 입력/출력 정의 및 구성 옵션
* [Python SDK 참조](/ko/agent-sdk/python): 훅 타입, 입력/출력 정의 및 구성 옵션
* [권한](/ko/agent-sdk/permissions): 에이전트가 수행할 수 있는 작업 제어
* [사용자 정의 도구](/ko/agent-sdk/custom-tools): 에이전트 기능을 확장하는 도구 구축

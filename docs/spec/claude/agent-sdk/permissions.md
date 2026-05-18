> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 권한 구성

> 권한 모드, 훅, 선언적 허용/거부 규칙을 사용하여 에이전트가 도구를 사용하는 방식을 제어합니다.

Claude Agent SDK는 Claude가 도구를 사용하는 방식을 관리하기 위한 권한 제어를 제공합니다. 권한 모드와 규칙을 사용하여 자동으로 허용되는 항목을 정의하고, [`canUseTool` 콜백](/ko/agent-sdk/user-input)을 사용하여 런타임에 나머지 모든 항목을 처리합니다.

<Note>
  이 페이지는 권한 모드와 규칙을 다룹니다. 사용자가 런타임에 도구 요청을 승인하거나 거부하는 대화형 승인 흐름을 구축하려면 [승인 및 사용자 입력 처리](/ko/agent-sdk/user-input)를 참조하세요.
</Note>

## 권한 평가 방식

Claude가 도구를 요청할 때 SDK는 다음 순서로 권한을 확인합니다:

<Steps>
  <Step title="훅">
    먼저 [훅](/ko/agent-sdk/hooks)을 실행합니다. 훅은 호출을 완전히 거부하거나 통과시킬 수 있습니다. `allow`를 반환하는 훅은 아래의 거부 및 요청 규칙을 건너뛰지 않습니다. 훅 결과와 관계없이 이러한 규칙들이 평가됩니다.
  </Step>

  <Step title="거부 규칙">
    `deny` 규칙(`disallowed_tools` 및 [settings.json](/ko/settings#permission-settings)에서)을 확인합니다. 거부 규칙이 일치하면 `bypassPermissions` 모드에서도 도구가 차단됩니다.
  </Step>

  <Step title="권한 모드">
    활성 [권한 모드](#permission-modes)를 적용합니다. `bypassPermissions`는 이 단계에 도달한 모든 항목을 승인합니다. `acceptEdits`는 파일 작업을 승인합니다. 다른 모드는 통과합니다.
  </Step>

  <Step title="허용 규칙">
    `allow` 규칙(`allowed_tools` 및 settings.json에서)을 확인합니다. 규칙이 일치하면 도구가 승인됩니다.
  </Step>

  <Step title="canUseTool 콜백">
    위의 어느 것으로도 해결되지 않으면 결정을 위해 [`canUseTool` 콜백](/ko/agent-sdk/user-input)을 호출합니다. `dontAsk` 모드에서는 이 단계를 건너뛰고 도구가 거부됩니다.
  </Step>
</Steps>

<img src="https://mintcdn.com/claude-code/FEspvVUyRuaWjm0s/images/agent-sdk/permissions-flow.svg?fit=max&auto=format&n=FEspvVUyRuaWjm0s&q=85&s=a1759b0cf4541281a9ffd8f5348228e8" alt="권한 평가 흐름 다이어그램" width="920" height="260" data-path="images/agent-sdk/permissions-flow.svg" />

이 페이지는 **허용 및 거부 규칙**과 **권한 모드**에 중점을 둡니다. 다른 단계의 경우:

* **훅:** 도구 요청을 허용, 거부 또는 수정하는 사용자 정의 코드를 실행합니다. [훅으로 실행 제어](/ko/agent-sdk/hooks)를 참조하세요.
* **canUseTool 콜백:** 런타임에 사용자에게 승인을 요청합니다. [승인 및 사용자 입력 처리](/ko/agent-sdk/user-input)를 참조하세요.

## 허용 및 거부 규칙

`allowed_tools` 및 `disallowed_tools`(TypeScript: `allowedTools` / `disallowedTools`)는 위의 평가 흐름에서 허용 및 거부 규칙 목록에 항목을 추가합니다. 도구가 Claude에서 사용 가능한지 여부가 아니라 도구 호출이 승인되는지 여부를 제어합니다.

| 옵션                               | 효과                                                                                 |
| :------------------------------- | :--------------------------------------------------------------------------------- |
| `allowed_tools=["Read", "Grep"]` | `Read` 및 `Grep`은 자동으로 승인됩니다. 여기에 나열되지 않은 도구는 여전히 존재하며 권한 모드 및 `canUseTool`로 통과합니다. |
| `disallowed_tools=["Bash"]`      | `Bash`는 항상 거부됩니다. 거부 규칙은 먼저 확인되며 `bypassPermissions`를 포함한 모든 권한 모드에서 유지됩니다.        |

잠금된 에이전트의 경우 `allowedTools`를 `permissionMode: "dontAsk"`와 쌍으로 사용합니다. 나열된 도구는 승인되고 다른 모든 항목은 프롬프트 대신 완전히 거부됩니다:

```typescript theme={null}
const options = {
  allowedTools: ["Read", "Glob", "Grep"],
  permissionMode: "dontAsk"
};
```

<Warning>
  **`allowed_tools`는 `bypassPermissions`를 제한하지 않습니다.** `allowed_tools`는 나열한 도구만 사전 승인합니다. 나열되지 않은 도구는 허용 규칙과 일치하지 않으며 권한 모드로 통과하며, 여기서 `bypassPermissions`는 이를 승인합니다. `allowed_tools=["Read"]`를 `permission_mode="bypassPermissions"`와 함께 설정하면 `Bash`, `Write`, `Edit`을 포함한 모든 도구가 여전히 승인됩니다. `bypassPermissions`가 필요하지만 특정 도구를 차단하려면 `disallowed_tools`를 사용합니다.
</Warning>

`.claude/settings.json`에서 허용, 거부 및 요청 규칙을 선언적으로 구성할 수도 있습니다. 이러한 규칙은 `project` 설정 소스가 활성화될 때 읽혀지며, 기본 `query()` 옵션에 대해 활성화됩니다. `setting_sources`(TypeScript: `settingSources`)를 명시적으로 설정하면 적용되도록 `"project"`를 포함합니다. 규칙 구문은 [권한 설정](/ko/settings#permission-settings)을 참조하세요.

## 권한 모드

권한 모드는 Claude가 도구를 사용하는 방식에 대한 전역 제어를 제공합니다. `query()`를 호출할 때 권한 모드를 설정하거나 스트리밍 세션 중에 동적으로 변경할 수 있습니다.

### 사용 가능한 모드

SDK는 다음 권한 모드를 지원합니다:

| 모드                     | 설명          | 도구 동작                                                                                                    |
| :--------------------- | :---------- | :------------------------------------------------------------------------------------------------------- |
| `default`              | 표준 권한 동작    | 자동 승인 없음; 일치하지 않는 도구는 `canUseTool` 콜백을 트리거합니다                                                            |
| `dontAsk`              | 프롬프트 대신 거부  | `allowed_tools` 또는 규칙으로 사전 승인되지 않은 항목은 거부됩니다; `canUseTool`은 호출되지 않습니다                                    |
| `acceptEdits`          | 파일 편집 자동 수락 | 파일 편집 및 [파일 시스템 작업](#accept-edits-mode-acceptedits)(`mkdir`, `rm`, `mv` 등)이 자동으로 승인됩니다                   |
| `bypassPermissions`    | 모든 권한 확인 무시 | 모든 도구는 권한 프롬프트 없이 실행됩니다(주의해서 사용)                                                                         |
| `plan`                 | 계획 모드       | 읽기 전용 도구가 실행되고 Claude는 소스 파일을 편집하지 않고 분석 및 계획합니다                                                         |
| `auto`(TypeScript만 해당) | 모델 분류 승인    | 모델 분류기가 각 도구 호출을 승인하거나 거부합니다. 가용성은 [자동 모드](/ko/permission-modes#eliminate-prompts-with-auto-mode)를 참조하세요 |

<Warning>
  **하위 에이전트 상속:** 부모가 `bypassPermissions`, `acceptEdits` 또는 `auto`를 사용할 때 모든 하위 에이전트는 해당 모드를 상속하며 하위 에이전트별로 재정의할 수 없습니다. 하위 에이전트는 주 에이전트와 다른 시스템 프롬프트와 덜 제한된 동작을 가질 수 있으므로 `bypassPermissions`를 상속하면 승인 프롬프트 없이 전체 자율 시스템 액세스 권한이 부여됩니다.
</Warning>

### 권한 모드 설정

쿼리를 시작할 때 권한 모드를 한 번 설정하거나 세션이 활성화된 동안 동적으로 변경할 수 있습니다.

<Tabs>
  <Tab title="쿼리 시간에">
    쿼리를 생성할 때 `permission_mode`(Python) 또는 `permissionMode`(TypeScript)를 전달합니다. 이 모드는 동적으로 변경되지 않는 한 전체 세션에 적용됩니다.

    <CodeGroup>
      ```python Python theme={null}
      import asyncio
      from claude_agent_sdk import query, ClaudeAgentOptions


      async def main():
          async for message in query(
              prompt="Help me refactor this code",
              options=ClaudeAgentOptions(
                  permission_mode="default",  # Set the mode here
              ),
          ):
              if hasattr(message, "result"):
                  print(message.result)


      asyncio.run(main())
      ```

      ```typescript TypeScript theme={null}
      import { query } from "@anthropic-ai/claude-agent-sdk";

      async function main() {
        for await (const message of query({
          prompt: "Help me refactor this code",
          options: {
            permissionMode: "default" // Set the mode here
          }
        })) {
          if ("result" in message) {
            console.log(message.result);
          }
        }
      }

      main();
      ```
    </CodeGroup>
  </Tab>

  <Tab title="스트리밍 중">
    `set_permission_mode()`(Python) 또는 `setPermissionMode()`(TypeScript)를 호출하여 세션 중간에 모드를 변경합니다. 새 모드는 모든 후속 도구 요청에 즉시 적용됩니다. 이를 통해 제한적으로 시작하여 신뢰가 구축됨에 따라 권한을 완화할 수 있습니다. 예를 들어 Claude의 초기 접근 방식을 검토한 후 `acceptEdits`로 전환할 수 있습니다.

    <CodeGroup>
      ```python Python theme={null}
      import asyncio
      from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions


      async def main():
          async with ClaudeSDKClient(
              options=ClaudeAgentOptions(
                  permission_mode="default",  # Start in default mode
              )
          ) as client:
              await client.query("Help me refactor this code")

              # Change mode dynamically mid-session
              await client.set_permission_mode("acceptEdits")

              # Process messages with the new permission mode
              async for message in client.receive_response():
                  if hasattr(message, "result"):
                      print(message.result)


      asyncio.run(main())
      ```

      ```typescript TypeScript theme={null}
      import { query } from "@anthropic-ai/claude-agent-sdk";

      async function main() {
        const q = query({
          prompt: "Help me refactor this code",
          options: {
            permissionMode: "default" // Start in default mode
          }
        });

        // Change mode dynamically mid-session
        await q.setPermissionMode("acceptEdits");

        // Process messages with the new permission mode
        for await (const message of q) {
          if ("result" in message) {
            console.log(message.result);
          }
        }
      }

      main();
      ```
    </CodeGroup>
  </Tab>
</Tabs>

### 모드 세부 정보

#### 편집 수락 모드(`acceptEdits`)

Claude가 프롬프트 없이 코드를 편집할 수 있도록 파일 작업을 자동으로 승인합니다. 다른 도구(예: 파일 시스템 작업이 아닌 Bash 명령)는 여전히 일반 권한이 필요합니다.

**자동 승인 작업:**

* 파일 편집(Edit, Write 도구)
* 파일 시스템 명령: `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp`, `sed`

둘 다 작업 디렉토리 또는 `additionalDirectories` 내의 경로에만 적용됩니다. 해당 범위 외의 경로 및 보호된 경로에 대한 쓰기는 여전히 프롬프트합니다.

**사용 시기:** Claude의 편집을 신뢰하고 프로토타이핑 중이거나 격리된 디렉토리에서 작업할 때와 같이 더 빠른 반복을 원할 때입니다.

#### 요청 안 함 모드(`dontAsk`)

모든 권한 프롬프트를 거부로 변환합니다. `allowed_tools`, `settings.json` 허용 규칙 또는 훅으로 사전 승인된 도구는 정상적으로 실행됩니다. 다른 모든 항목은 `canUseTool`을 호출하지 않고 거부됩니다.

**사용 시기:** 헤드리스 에이전트에 대해 고정된 명시적 도구 표면을 원하고 `canUseTool`이 없을 때의 자동 거부보다 하드 거부를 선호할 때입니다.

#### 권한 무시 모드(`bypassPermissions`)

프롬프트 없이 모든 도구 사용을 자동으로 승인합니다. 훅은 여전히 실행되며 필요한 경우 작업을 차단할 수 있습니다.

<Warning>
  극도의 주의를 기울여 사용하세요. Claude는 이 모드에서 전체 시스템 액세스 권한을 가집니다. 모든 가능한 작업을 신뢰하는 제어된 환경에서만 사용하세요.

  `allowed_tools`는 이 모드를 제한하지 않습니다. 나열한 도구뿐만 아니라 모든 도구가 승인됩니다. 거부 규칙(`disallowed_tools`), 명시적 `ask` 규칙 및 훅은 모드 확인 전에 평가되며 여전히 도구를 차단할 수 있습니다.
</Warning>

#### 계획 모드(`plan`)

Claude를 읽기 전용 도구로 제한합니다. Claude는 파일을 읽고 읽기 전용 셸 명령을 실행하여 코드베이스를 탐색할 수 있지만 소스 파일을 편집하지 않습니다. Claude는 계획을 최종화하기 전에 요구 사항을 명확히 하기 위해 `AskUserQuestion`을 사용할 수 있습니다. 이러한 프롬프트 처리는 [승인 및 사용자 입력 처리](/ko/agent-sdk/user-input#handle-clarifying-questions)를 참조하세요.

**사용 시기:** Claude가 변경 사항을 실행하지 않고 제안하기를 원할 때, 예를 들어 코드 검토 중이거나 변경 사항이 적용되기 전에 승인해야 할 때입니다.

## 관련 리소스

권한 평가 흐름의 다른 단계의 경우:

* [승인 및 사용자 입력 처리](/ko/agent-sdk/user-input): 대화형 승인 프롬프트 및 명확히 하는 질문
* [훅 가이드](/ko/agent-sdk/hooks): 에이전트 수명 주기의 주요 지점에서 사용자 정의 코드 실행
* [권한 규칙](/ko/settings#permission-settings): `settings.json`의 선언적 허용/거부 규칙

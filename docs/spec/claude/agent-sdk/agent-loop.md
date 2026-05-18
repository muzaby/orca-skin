> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 에이전트 루프의 작동 원리

> 메시지 생명주기, 도구 실행, 컨텍스트 윈도우, 그리고 SDK 에이전트를 구동하는 아키텍처를 이해합니다.

Agent SDK를 사용하면 Claude Code의 자율 에이전트 루프를 자신의 애플리케이션에 임베드할 수 있습니다. SDK는 도구, 권한, 비용 제한, 출력에 대한 프로그래밍 방식의 제어를 제공하는 독립형 패키지입니다. 이를 사용하기 위해 Claude Code CLI를 설치할 필요가 없습니다.

에이전트를 시작하면 SDK는 [Claude Code를 구동하는 동일한 실행 루프](/ko/how-claude-code-works#the-agentic-loop)를 실행합니다: Claude가 프롬프트를 평가하고, 도구를 호출하여 조치를 취하고, 결과를 받고, 작업이 완료될 때까지 반복합니다. 이 페이지에서는 해당 루프 내에서 무엇이 일어나는지 설명하므로 에이전트를 효과적으로 구축, 디버그 및 최적화할 수 있습니다.

## 루프 한눈에 보기

모든 에이전트 세션은 동일한 주기를 따릅니다:

<img src="https://mintcdn.com/claude-code/gvy2DIUELtNA8qD3/images/agent-loop-diagram.svg?fit=max&auto=format&n=gvy2DIUELtNA8qD3&q=85&s=192e1bd6c8a2950a16e5ee0b94e27e26" alt="에이전트 루프: 프롬프트 입력, Claude 평가, 도구 호출 또는 최종 답변으로 분기" width="680" height="150" data-path="images/agent-loop-diagram.svg" />

1. **프롬프트 수신.** Claude가 프롬프트, 시스템 프롬프트, 도구 정의, 대화 기록과 함께 프롬프트를 받습니다. SDK는 세션 메타데이터를 포함하는 서브타입 `"init"`이 있는 [`SystemMessage`](#message-types)를 생성합니다.
2. **평가 및 응답.** Claude가 현재 상태를 평가하고 진행 방법을 결정합니다. 텍스트로 응답하거나, 하나 이상의 도구 호출을 요청하거나, 둘 다 할 수 있습니다. SDK는 텍스트와 도구 호출 요청을 포함하는 [`AssistantMessage`](#message-types)를 생성합니다.
3. **도구 실행.** SDK가 요청된 각 도구를 실행하고 결과를 수집합니다. 각 도구 결과 세트가 다음 결정을 위해 Claude에게 다시 피드백됩니다. [hooks](/ko/agent-sdk/hooks)를 사용하여 도구 호출을 실행 전에 가로채고, 수정하거나, 차단할 수 있습니다.
4. **반복.** 2단계와 3단계가 주기로 반복됩니다. 각 전체 주기는 한 턴입니다. Claude는 도구 호출이 없는 응답을 생성할 때까지 도구를 계속 호출하고 결과를 처리합니다.
5. **결과 반환.** SDK는 텍스트 응답(도구 호출 없음)이 있는 최종 [`AssistantMessage`](#message-types)를 생성한 후, 최종 텍스트, 토큰 사용량, 비용, 세션 ID가 있는 [`ResultMessage`](#message-types)를 생성합니다.

간단한 질문("여기 어떤 파일이 있나요?")은 `Glob`을 호출하고 결과로 응답하는 한두 턴이 걸릴 수 있습니다. 복잡한 작업("auth 모듈을 리팩토링하고 테스트를 업데이트하세요")은 많은 턴에 걸쳐 수십 개의 도구 호출을 연결할 수 있으며, 파일을 읽고, 코드를 편집하고, 테스트를 실행하며, Claude가 각 결과에 따라 접근 방식을 조정합니다.

## 턴과 메시지

턴은 루프 내의 한 왕복입니다: Claude가 도구 호출을 포함하는 출력을 생성하고, SDK가 해당 도구를 실행하고, 결과가 자동으로 Claude에게 다시 피드백됩니다. 이는 코드에 제어를 반환하지 않고 발생합니다. Claude가 도구 호출이 없는 출력을 생성할 때까지 턴이 계속되며, 이 시점에서 루프가 끝나고 최종 결과가 전달됩니다.

프롬프트 "auth.ts의 실패한 테스트 수정"에 대한 전체 세션이 어떻게 보일 수 있는지 생각해 봅시다.

먼저 SDK가 프롬프트를 Claude에게 보내고 세션 메타데이터가 있는 [`SystemMessage`](#message-types)를 생성합니다. 그러면 루프가 시작됩니다:

1. **턴 1:** Claude가 `Bash`를 호출하여 `npm test`를 실행합니다. SDK는 도구 호출이 있는 [`AssistantMessage`](#message-types)를 생성하고, 명령을 실행한 후, 출력(3개 실패)이 있는 [`UserMessage`](#message-types)를 생성합니다.
2. **턴 2:** Claude가 `auth.ts`와 `auth.test.ts`에서 `Read`를 호출합니다. SDK가 파일 내용을 반환하고 `AssistantMessage`를 생성합니다.
3. **턴 3:** Claude가 `Edit`를 호출하여 `auth.ts`를 수정한 후, `Bash`를 호출하여 `npm test`를 다시 실행합니다. 3개 테스트 모두 통과합니다. SDK는 `AssistantMessage`를 생성합니다.
4. **최종 턴:** Claude가 도구 호출이 없는 텍스트 전용 응답을 생성합니다: "auth 버그를 수정했고, 3개 테스트 모두 통과합니다." SDK는 이 텍스트가 있는 최종 `AssistantMessage`를 생성한 후, 비용 및 사용량이 있는 [`ResultMessage`](#message-types)를 생성합니다.

이는 4턴이었습니다: 도구 호출이 있는 3턴, 최종 텍스트 전용 응답 1턴.

`max_turns` / `maxTurns`로 루프를 제한할 수 있으며, 이는 도구 사용 턴만 계산합니다. 예를 들어, 위의 루프에서 `max_turns=2`는 편집 단계 전에 중지했을 것입니다. `max_budget_usd` / `maxBudgetUsd`를 사용하여 지출 임계값에 따라 턴을 제한할 수도 있습니다.

제한이 없으면 Claude가 자체적으로 완료될 때까지 루프가 실행되며, 이는 잘 정의된 작업에는 괜찮지만 개방형 프롬프트("이 코드베이스를 개선하세요")에서는 오래 실행될 수 있습니다. 예산을 설정하는 것은 프로덕션 에이전트에 좋은 기본값입니다. 옵션 참조는 아래의 [턴과 예산](#turns-and-budget)을 참조하세요.

## 메시지 타입

루프가 실행되면 SDK는 메시지 스트림을 생성합니다. 각 메시지는 루프의 어느 단계에서 왔는지 알려주는 타입을 전달합니다. 5가지 핵심 타입은:

* **`SystemMessage`:** 세션 생명주기 이벤트. `subtype` 필드가 이를 구분합니다: `"init"`은 첫 번째 메시지(세션 메타데이터)이고, `"compact_boundary"`는 [압축](#automatic-compaction) 후에 발생합니다. TypeScript에서 압축 경계는 `SDKSystemMessage`의 서브타입이 아니라 자체 [`SDKCompactBoundaryMessage`](/ko/agent-sdk/typescript#sdkcompactboundarymessage) 타입입니다.
* **`AssistantMessage`:** 최종 텍스트 전용 응답을 포함하여 각 Claude 응답 후에 생성됩니다. 해당 턴의 텍스트 콘텐츠 블록과 도구 호출 블록을 포함합니다.
* **`UserMessage`:** 각 도구 실행 후 Claude에게 다시 전송되는 도구 결과 콘텐츠와 함께 생성됩니다. 루프 중간에 스트리밍하는 모든 사용자 입력에 대해서도 생성됩니다.
* **`StreamEvent`:** 부분 메시지가 활성화된 경우에만 생성됩니다. 원본 API 스트리밍 이벤트(텍스트 델타, 도구 입력 청크)를 포함합니다. [스트림 응답](/ko/agent-sdk/streaming-output)을 참조하세요.
* **`ResultMessage`:** 에이전트 루프의 끝을 표시합니다. 최종 텍스트 결과, 토큰 사용량, 비용, 세션 ID를 포함합니다. `subtype` 필드를 확인하여 작업이 성공했는지 또는 제한에 도달했는지 확인합니다. `prompt_suggestion`과 같은 소수의 후행 시스템 이벤트가 이후에 도착할 수 있으므로 결과에서 중단하지 말고 스트림을 완료까지 반복합니다. [결과 처리](#handle-the-result)를 참조하세요.

이 5가지 타입은 두 SDK 모두에서 전체 에이전트 루프 생명주기를 다룹니다. TypeScript SDK는 또한 추가 관찰성 이벤트(hook 이벤트, 도구 진행, 속도 제한, 작업 알림)를 생성하여 추가 세부 정보를 제공하지만 루프를 구동하는 데 필요하지 않습니다. [Python 메시지 타입 참조](/ko/agent-sdk/python#message-types)와 [TypeScript 메시지 타입 참조](/ko/agent-sdk/typescript#message-types)에서 전체 목록을 참조하세요.

### 메시지 처리

처리하는 메시지는 구축하는 것에 따라 다릅니다:

* **최종 결과만:** `ResultMessage`를 처리하여 출력, 비용, 작업이 성공했는지 또는 제한에 도달했는지 확인합니다.
* **진행 상황 업데이트:** `AssistantMessage`를 처리하여 Claude가 각 턴에서 무엇을 하고 있는지, 어떤 도구를 호출했는지 확인합니다.
* **라이브 스트리밍:** 부분 메시지를 활성화하여(`include_partial_messages` Python, `includePartialMessages` TypeScript) 실시간으로 `StreamEvent` 메시지를 받습니다. [실시간 스트림 응답](/ko/agent-sdk/streaming-output)을 참조하세요.

메시지 타입을 확인하는 방법은 SDK에 따라 다릅니다:

* **Python:** `claude_agent_sdk`에서 가져온 클래스에 대해 `isinstance()`로 메시지 타입을 확인합니다(예: `isinstance(message, ResultMessage)`).
* **TypeScript:** `type` 문자열 필드를 확인합니다(예: `message.type === "result"`). `AssistantMessage`와 `UserMessage`는 원본 API 메시지를 `.message` 필드에 래핑하므로 콘텐츠 블록은 `message.content`가 아니라 `message.message.content`에 있습니다.

<Accordion title="예제: 메시지 타입 확인 및 결과 처리">
  <CodeGroup>
    ```python Python theme={null}
    from claude_agent_sdk import query, AssistantMessage, ResultMessage

    async for message in query(prompt="Summarize this project"):
        if isinstance(message, AssistantMessage):
            print(f"Turn completed: {len(message.content)} content blocks")
        if isinstance(message, ResultMessage):
            if message.subtype == "success":
                print(message.result)
            else:
                print(f"Stopped: {message.subtype}")
    ```

    ```typescript TypeScript theme={null}
    import { query } from "@anthropic-ai/claude-agent-sdk";

    for await (const message of query({ prompt: "Summarize this project" })) {
      if (message.type === "assistant") {
        console.log(`Turn completed: ${message.message.content.length} content blocks`);
      }
      if (message.type === "result") {
        if (message.subtype === "success") {
          console.log(message.result);
        } else {
          console.log(`Stopped: ${message.subtype}`);
        }
      }
    }
    ```
  </CodeGroup>
</Accordion>

## 도구 실행

도구는 에이전트에게 조치를 취할 수 있는 능력을 제공합니다. 도구가 없으면 Claude는 텍스트로만 응답할 수 있습니다. 도구를 사용하면 Claude는 파일을 읽고, 명령을 실행하고, 코드를 검색하고, 외부 서비스와 상호작용할 수 있습니다.

### 내장 도구

SDK는 Claude Code를 구동하는 동일한 도구를 포함합니다:

| 카테고리        | 도구                                               | 기능                                      |
| :---------- | :----------------------------------------------- | :-------------------------------------- |
| **파일 작업**   | `Read`, `Edit`, `Write`                          | 파일 읽기, 수정, 생성                           |
| **검색**      | `Glob`, `Grep`                                   | 패턴으로 파일 찾기, 정규식으로 콘텐츠 검색                |
| **실행**      | `Bash`                                           | 셸 명령, 스크립트, git 작업 실행                   |
| **웹**       | `WebSearch`, `WebFetch`                          | 웹 검색, 페이지 가져오기 및 파싱                     |
| **검색**      | `ToolSearch`                                     | 모든 도구를 미리 로드하는 대신 필요에 따라 도구를 동적으로 찾고 로드 |
| **오케스트레이션** | `Agent`, `Skill`, `AskUserQuestion`, `TodoWrite` | 서브에이전트 생성, 스킬 호출, 사용자에게 질문, 작업 추적       |

내장 도구 외에도 다음을 수행할 수 있습니다:

* **[MCP 서버](/ko/agent-sdk/mcp)로 외부 서비스 연결**(데이터베이스, 브라우저, API)
* **[사용자 정의 도구 핸들러](/ko/agent-sdk/custom-tools)로 사용자 정의 도구 정의**
* **[설정 소스](/ko/agent-sdk/claude-code-features)를 통해 프로젝트 스킬 로드** 재사용 가능한 워크플로우

### 도구 권한

Claude는 작업에 따라 호출할 도구를 결정하지만, 해당 호출이 실행되도록 허용할지 여부를 제어합니다. 특정 도구를 자동 승인하거나, 다른 도구를 완전히 차단하거나, 모든 것에 대해 승인을 요구할 수 있습니다. 3가지 옵션이 함께 작동하여 실행되는 것을 결정합니다:

* **`allowed_tools` / `allowedTools`** 나열된 도구를 자동 승인합니다. `["Read", "Glob", "Grep"]`이 허용된 도구 목록에 있는 읽기 전용 에이전트는 프롬프트 없이 해당 도구를 실행합니다. 나열되지 않은 도구는 여전히 사용 가능하지만 권한이 필요합니다.
* **`disallowed_tools` / `disallowedTools`** 다른 설정에 관계없이 나열된 도구를 차단합니다. 도구가 실행되기 전에 규칙이 확인되는 순서는 [권한](/ko/agent-sdk/permissions)을 참조하세요.
* **`permission_mode` / `permissionMode`** 허용 또는 거부 규칙으로 다루지 않는 도구에 어떤 일이 발생하는지 제어합니다. 사용 가능한 모드는 [권한 모드](#permission-mode)를 참조하세요.

`"Bash(npm *)"` 같은 규칙으로 개별 도구의 범위를 지정할 수도 있습니다. 전체 규칙 구문은 [권한](/ko/agent-sdk/permissions)을 참조하세요.

도구가 거부되면 Claude는 도구 결과로 거부 메시지를 받고 일반적으로 다른 접근 방식을 시도하거나 진행할 수 없다고 보고합니다.

### 병렬 도구 실행

Claude가 단일 턴에서 여러 도구 호출을 요청하면 두 SDK 모두 도구에 따라 동시 또는 순차적으로 실행할 수 있습니다. 읽기 전용 도구(`Read`, `Glob`, `Grep`, 읽기 전용으로 표시된 MCP 도구)는 동시에 실행할 수 있습니다. 상태를 수정하는 도구(`Edit`, `Write`, `Bash`)는 충돌을 피하기 위해 순차적으로 실행됩니다.

사용자 정의 도구는 기본적으로 순차 실행입니다. 사용자 정의 도구에 대해 병렬 실행을 활성화하려면 주석에서 `readOnlyHint`를 설정합니다. [TypeScript](/ko/agent-sdk/typescript#tool)와 [Python](/ko/agent-sdk/python#tool) SDK 모두 MCP SDK의 이 필드 이름을 사용합니다.

## 루프 실행 방식 제어

루프가 취하는 턴 수, 비용, Claude가 추론하는 깊이, 도구가 실행 전에 승인을 요구하는지 여부를 제한할 수 있습니다. 이 모든 것은 [`ClaudeAgentOptions`](/ko/agent-sdk/python#claudeagentoptions)(Python) / [`Options`](/ko/agent-sdk/typescript#options)(TypeScript)의 필드입니다.

### 턴과 예산

| 옵션                                       | 제어 대상       | 기본값   |
| :--------------------------------------- | :---------- | :---- |
| 최대 턴(`max_turns` / `maxTurns`)           | 최대 도구 사용 왕복 | 제한 없음 |
| 최대 예산(`max_budget_usd` / `maxBudgetUsd`) | 중지 전 최대 비용  | 제한 없음 |

제한 중 하나에 도달하면 SDK는 해당 오류 서브타입(`error_max_turns` 또는 `error_max_budget_usd`)이 있는 `ResultMessage`를 반환합니다. 이러한 서브타입을 확인하는 방법은 [결과 처리](#handle-the-result)를 참조하고, 구문은 [`ClaudeAgentOptions`](/ko/agent-sdk/python#claudeagentoptions) / [`Options`](/ko/agent-sdk/typescript#options)를 참조하세요.

### 노력 수준

`effort` 옵션은 Claude가 적용하는 추론의 양을 제어합니다. 낮은 노력 수준은 턴당 더 적은 토큰을 사용하고 비용을 줄입니다. 모든 모델이 노력 매개변수를 지원하는 것은 아닙니다. 어떤 모델이 지원하는지는 [노력](https://platform.claude.com/docs/en/build-with-claude/effort)을 참조하세요.

| 수준         | 동작           | 적합한 경우                      |
| :--------- | :----------- | :-------------------------- |
| `"low"`    | 최소 추론, 빠른 응답 | 파일 조회, 디렉토리 나열              |
| `"medium"` | 균형 잡힌 추론     | 일상적인 편집, 표준 작업              |
| `"high"`   | 철저한 분석       | 리팩토링, 디버깅                   |
| `"xhigh"`  | 확장된 추론 깊이    | 코딩 및 에이전트 작업; Opus 4.7에서 권장 |
| `"max"`    | 최대 추론 깊이     | 깊은 분석이 필요한 다단계 문제           |

`effort`를 설정하지 않으면 Python SDK는 매개변수를 설정하지 않은 상태로 두고 모델의 기본 동작으로 미룹니다. TypeScript SDK는 기본값으로 `"high"`를 사용합니다.

<Note>
  `effort`는 각 응답 내에서 추론 깊이에 대한 지연 시간과 토큰 비용을 교환합니다. [확장 사고](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)는 출력에서 보이는 사고의 연쇄 블록을 생성하는 별도의 기능입니다. 이들은 독립적입니다: `effort: "low"`를 확장 사고 활성화로 설정하거나, `effort: "max"`를 비활성화로 설정할 수 있습니다.
</Note>

간단하고 잘 정의된 작업(파일 나열 또는 단일 grep 실행)을 수행하는 에이전트의 경우 비용과 지연 시간을 줄이기 위해 낮은 노력을 사용합니다. 전체 세션에 대해 최상위 `query()` 옵션에서 `effort`를 설정하거나, [`AgentDefinition`](/ko/agent-sdk/subagents#agentdefinition-configuration)의 `effort` 필드로 서브에이전트당 설정하여 세션 수준을 재정의합니다.

### 권한 모드

권한 모드 옵션(Python의 `permission_mode`, TypeScript의 `permissionMode`)은 에이전트가 도구를 사용하기 전에 승인을 요청하는지 여부를 제어합니다:

| 모드                    | 동작                                                                                                                 |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `"default"`           | 허용 규칙으로 다루지 않는 도구는 승인 콜백을 트리거합니다; 콜백이 없으면 거부                                                                       |
| `"acceptEdits"`       | 파일 편집 및 일반적인 파일시스템 명령(`mkdir`, `touch`, `mv`, `cp` 등)을 자동 승인합니다; 다른 Bash 명령은 기본 규칙을 따릅니다                           |
| `"plan"`              | 읽기 전용 도구 실행; Claude는 소스 파일을 편집하지 않고 탐색하고 계획을 생성합니다                                                                 |
| `"dontAsk"`           | 절대 프롬프트하지 않습니다. [권한 규칙](/ko/settings#permission-settings)으로 사전 승인된 도구가 실행되고, 나머지는 거부됩니다                            |
| `"auto"`(TypeScript만) | 모델 분류기를 사용하여 각 도구 호출을 승인하거나 거부합니다. 가용성 및 동작은 [자동 모드](/ko/permission-modes#eliminate-prompts-with-auto-mode)를 참조하세요 |
| `"bypassPermissions"` | 요청하지 않고 모든 허용된 도구를 실행합니다. Unix에서 루트로 실행할 때는 사용할 수 없습니다. 에이전트의 조치가 관심 있는 시스템에 영향을 미칠 수 없는 격리된 환경에서만 사용합니다           |

대화형 애플리케이션의 경우 `"default"`를 도구 승인 콜백과 함께 사용하여 승인 프롬프트를 표시합니다. 개발 머신의 자율 에이전트의 경우 `"acceptEdits"`는 파일 편집 및 일반적인 파일시스템 명령(`mkdir`, `touch`, `mv`, `cp` 등)을 자동 승인하면서 다른 `Bash` 명령을 허용 규칙 뒤에 유지합니다. CI, 컨테이너 또는 기타 격리된 환경에 대해 `"bypassPermissions"`를 예약합니다. 전체 세부 정보는 [권한](/ko/agent-sdk/permissions)을 참조하세요.

### 모델

`model`을 설정하지 않으면 SDK는 Claude Code의 기본값을 사용하며, 이는 인증 방법 및 구독에 따라 다릅니다. 특정 모델을 고정하거나 더 빠르고 저렴한 에이전트를 위해 더 작은 모델을 사용하려면 명시적으로 설정합니다(예: `model="claude-sonnet-4-6"`). 사용 가능한 ID는 [모델](https://platform.claude.com/docs/en/about-claude/models)을 참조하세요.

## 컨텍스트 윈도우

컨텍스트 윈도우는 세션 중에 Claude가 사용할 수 있는 총 정보량입니다. 세션 내의 턴 사이에 재설정되지 않습니다. 모든 것이 누적됩니다: 시스템 프롬프트, 도구 정의, 대화 기록, 도구 입력, 도구 출력. 턴 전체에서 동일하게 유지되는 콘텐츠(시스템 프롬프트, 도구 정의, CLAUDE.md)는 자동으로 [프롬프트 캐시됩니다](https://platform.claude.com/docs/en/build-with-claude/prompt-caching). 이는 반복된 접두사에 대한 비용과 지연 시간을 줄입니다.

### 컨텍스트를 소비하는 것

SDK에서 각 구성 요소가 컨텍스트에 어떻게 영향을 미치는지는 다음과 같습니다:

| 소스               | 로드 시기                                                             | 영향                                                                                                      |
| :--------------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **시스템 프롬프트**     | 모든 요청                                                             | 작은 고정 비용, 항상 존재                                                                                         |
| **CLAUDE.md 파일** | 세션 시작, [`settingSources`](/ko/agent-sdk/claude-code-features)를 통해 | 모든 요청에서 전체 콘텐츠(프롬프트 캐시되므로 첫 번째 요청만 전체 비용 지불)                                                            |
| **도구 정의**        | 모든 요청                                                             | 각 도구가 스키마를 추가합니다; 모든 도구를 한 번에 로드하는 대신 [MCP 도구 검색](/ko/agent-sdk/mcp#mcp-tool-search)을 사용하여 필요에 따라 도구 로드 |
| **대화 기록**        | 턴에 걸쳐 누적                                                          | 각 턴으로 증가: 프롬프트, 응답, 도구 입력, 도구 출력                                                                        |
| **스킬 설명**        | 세션 시작, 설정 소스를 통해                                                  | 짧은 요약; 전체 콘텐츠는 호출될 때만 로드                                                                                |

큰 도구 출력은 상당한 컨텍스트를 소비합니다. 큰 파일을 읽거나 자세한 출력이 있는 명령을 실행하면 단일 턴에서 수천 개의 토큰을 사용할 수 있습니다. 컨텍스트는 턴에 걸쳐 누적되므로 많은 도구 호출이 있는 더 긴 세션은 짧은 세션보다 훨씬 더 많은 컨텍스트를 구축합니다.

### 자동 압축

컨텍스트 윈도우가 제한에 가까워지면 SDK는 자동으로 대화를 압축합니다: 더 오래된 기록을 요약하여 공간을 확보하고, 가장 최근의 교환과 주요 결정을 유지합니다. SDK는 이것이 발생할 때 스트림에서 `type: "system"`과 `subtype: "compact_boundary"`가 있는 메시지를 생성합니다(Python에서는 `SystemMessage`; TypeScript에서는 별도의 `SDKCompactBoundaryMessage` 타입).

압축은 더 오래된 메시지를 요약으로 바꾸므로 대화 초기의 특정 지침이 보존되지 않을 수 있습니다. 지속적인 규칙은 초기 프롬프트가 아니라 CLAUDE.md에 속합니다([`settingSources`](/ko/agent-sdk/claude-code-features)를 통해 로드됨). CLAUDE.md 콘텐츠는 모든 요청에서 다시 주입되기 때문입니다.

압축 동작을 여러 가지 방법으로 사용자 정의할 수 있습니다:

* **CLAUDE.md의 요약 지침:** 압축기는 다른 컨텍스트처럼 CLAUDE.md를 읽으므로 요약할 때 보존할 내용을 알려주는 섹션을 포함할 수 있습니다. 섹션 헤더는 자유 형식입니다(매직 문자열이 아님); 압축기는 의도와 일치합니다.
* **`PreCompact` hook:** 압축 전에 사용자 정의 로직을 실행합니다(예: 전체 기록을 보관). hook은 `trigger` 필드(`manual` 또는 `auto`)를 받습니다. [hooks](/ko/agent-sdk/hooks)를 참조하세요.
* **수동 압축:** `/compact`를 프롬프트 문자열로 보내 필요에 따라 압축을 트리거합니다. (이 방식으로 전송된 슬래시 명령은 CLI 전용 바로 가기가 아니라 SDK 입력입니다. [SDK의 슬래시 명령](/ko/agent-sdk/slash-commands)을 참조하세요.)

<Accordion title="예제: CLAUDE.md의 요약 지침">
  프로젝트의 CLAUDE.md에 섹션을 추가하여 압축기에 보존할 내용을 알립니다. 헤더 이름은 특별하지 않습니다; 명확한 레이블을 사용합니다.

  ```markdown CLAUDE.md theme={null}
  # 요약 지침

  이 대화를 요약할 때 항상 보존합니다:
  - 현재 작업 목표 및 수용 기준
  - 읽거나 수정한 파일 경로
  - 테스트 결과 및 오류 메시지
  - 결정 및 그 뒤의 추론
  ```
</Accordion>

### 컨텍스트 효율성 유지

장기 실행 에이전트를 위한 몇 가지 전략:

* **서브작업에 서브에이전트 사용.** 각 서브에이전트는 새로운 대화로 시작합니다(이전 메시지 기록 없음, 자신의 시스템 프롬프트 및 CLAUDE.md 같은 프로젝트 수준 컨텍스트는 로드함). 부모의 턴을 보지 않으며, 최종 응답만 도구 결과로 부모에게 반환됩니다. 주 에이전트의 컨텍스트는 전체 서브작업 기록이 아니라 해당 요약으로 증가합니다. [서브에이전트가 상속하는 것](/ko/agent-sdk/subagents#what-subagents-inherit)을 참조하세요.
* **도구를 선택적으로 사용합니다.** 모든 도구 정의는 컨텍스트 공간을 차지합니다. [`AgentDefinition`](/ko/agent-sdk/subagents#agentdefinition-configuration)의 `tools` 필드를 사용하여 서브에이전트를 필요한 최소 세트로 범위를 지정하고, [MCP 도구 검색](/ko/agent-sdk/mcp#mcp-tool-search)을 사용하여 모든 도구를 미리 로드하는 대신 필요에 따라 도구를 로드합니다.
* **MCP 서버 비용을 주시합니다.** 각 MCP 서버는 모든 도구 스키마를 모든 요청에 추가합니다. 많은 도구가 있는 몇 개의 서버는 에이전트가 작업을 수행하기 전에 상당한 컨텍스트를 소비할 수 있습니다. `ToolSearch` 도구는 모든 도구를 미리 로드하는 대신 필요에 따라 도구를 로드하여 도움이 될 수 있습니다. [MCP 도구 검색](/ko/agent-sdk/mcp#mcp-tool-search)을 참조하세요.
* **일상적인 작업에 낮은 노력을 사용합니다.** 파일을 읽거나 디렉토리를 나열하기만 하면 되는 에이전트의 경우 [노력](#effort-level)을 `"low"`로 설정합니다. 이는 토큰 사용량과 비용을 줄입니다.

기능별 컨텍스트 비용의 자세한 분석은 [컨텍스트 비용 이해](/ko/features-overview#understand-context-costs)를 참조하세요.

## 세션 및 연속성

SDK와의 각 상호작용은 세션을 생성하거나 계속합니다. `ResultMessage.session_id`에서 세션 ID를 캡처합니다(두 SDK 모두에서 사용 가능). TypeScript SDK는 또한 init `SystemMessage`의 직접 필드로 노출합니다; Python에서는 `SystemMessage.data`에 중첩됩니다.

재개할 때 이전 턴의 전체 컨텍스트가 복원됩니다: 읽은 파일, 수행된 분석, 취한 조치. 원본을 수정하지 않고 다른 접근 방식으로 분기하기 위해 세션을 포크할 수도 있습니다.

재개, 계속, 포크 패턴의 전체 가이드는 [세션 관리](/ko/agent-sdk/sessions)를 참조하세요.

<Note>
  Python에서 `ClaudeSDKClient`는 여러 호출에 걸쳐 세션 ID를 자동으로 처리합니다. 세부 정보는 [Python SDK 참조](/ko/agent-sdk/python#choosing-between-query-and-claudesdkclient)를 참조하세요.
</Note>

## 결과 처리

루프가 끝나면 `ResultMessage`는 무엇이 일어났는지 알려주고 출력을 제공합니다. `subtype` 필드(두 SDK 모두에서 사용 가능)는 종료 상태를 확인하는 주요 방법입니다.

| 결과 서브타입                               | 무엇이 일어났는가                           | `result` 필드 사용 가능? |
| :------------------------------------ | :---------------------------------- | :----------------: |
| `success`                             | Claude가 정상적으로 작업을 완료했습니다            |          예         |
| `error_max_turns`                     | 완료 전에 `maxTurns` 제한에 도달했습니다         |         아니오        |
| `error_max_budget_usd`                | 완료 전에 `maxBudgetUsd` 제한에 도달했습니다     |         아니오        |
| `error_during_execution`              | 오류가 루프를 중단했습니다(예: API 실패 또는 취소된 요청) |         아니오        |
| `error_max_structured_output_retries` | 구조화된 출력 검증이 구성된 재시도 제한 후 실패했습니다     |         아니오        |

`result` 필드(최종 텍스트 출력)는 `success` 변형에만 존재하므로 항상 읽기 전에 서브타입을 확인합니다. 모든 결과 서브타입은 `total_cost_usd`, `usage`, `num_turns`, `session_id`를 전달하므로 비용을 추적하고 오류 후에도 재개할 수 있습니다. Python에서 `total_cost_usd`와 `usage`는 선택적으로 입력되며 일부 오류 경로에서 `None`일 수 있으므로 형식을 지정하기 전에 보호합니다. `usage` 필드 해석에 대한 세부 정보는 [비용 및 사용량 추적](/ko/agent-sdk/cost-tracking)을 참조하세요.

결과는 또한 모델이 최종 턴에서 생성을 중지한 이유를 나타내는 `stop_reason` 필드(`TypeScript에서 string | null`, Python에서 `str | None`)를 포함합니다. 일반적인 값은 `end_turn`(모델이 정상적으로 완료됨), `max_tokens`(출력 토큰 제한에 도달함), `refusal`(모델이 요청을 거부함)입니다. 오류 결과 서브타입에서 `stop_reason`은 루프가 끝나기 전의 마지막 어시스턴트 응답의 값을 전달합니다. 거부를 감지하려면 `stop_reason === "refusal"`(TypeScript) 또는 `stop_reason == "refusal"`(Python)을 확인합니다. 전체 타입은 [`SDKResultMessage`](/ko/agent-sdk/typescript#sdkresultmessage)(TypeScript) 또는 [`ResultMessage`](/ko/agent-sdk/python#resultmessage)(Python)을 참조하세요.

## Hooks

[Hooks](/ko/agent-sdk/hooks)는 루프의 특정 지점에서 발생하는 콜백입니다: 도구가 실행되기 전, 반환된 후, 에이전트가 완료될 때 등. 일반적으로 사용되는 일부 hooks는:

| Hook                             | 발생 시기               | 일반적인 사용          |
| :------------------------------- | :------------------ | :--------------- |
| `PreToolUse`                     | 도구가 실행되기 전          | 입력 검증, 위험한 명령 차단 |
| `PostToolUse`                    | 도구가 반환된 후           | 출력 감사, 부작용 트리거   |
| `UserPromptSubmit`               | 프롬프트가 전송될 때         | 프롬프트에 추가 컨텍스트 주입 |
| `Stop`                           | 에이전트가 완료될 때         | 결과 검증, 세션 상태 저장  |
| `SubagentStart` / `SubagentStop` | 서브에이전트가 생성되거나 완료될 때 | 병렬 작업 결과 추적 및 집계 |
| `PreCompact`                     | 컨텍스트 압축 전           | 요약 전에 전체 기록 보관   |

Hooks는 에이전트의 컨텍스트 윈도우 내가 아니라 애플리케이션 프로세스에서 실행되므로 컨텍스트를 소비하지 않습니다. Hooks는 또한 루프를 단락시킬 수 있습니다: 도구 호출을 거부하는 `PreToolUse` hook은 실행을 방지하고 Claude는 거부 메시지를 대신 받습니다.

두 SDK 모두 위의 모든 이벤트를 지원합니다. TypeScript SDK는 Python이 아직 지원하지 않는 추가 이벤트를 포함합니다. 전체 이벤트 목록, SDK별 가용성, 전체 콜백 API는 [hooks로 실행 제어](/ko/agent-sdk/hooks)를 참조하세요.

## 모두 함께 사용

이 예제는 이 페이지의 주요 개념을 실패한 테스트를 수정하는 단일 에이전트로 결합합니다. 허용된 도구(자동 승인되므로 에이전트가 자율적으로 실행됨), 프로젝트 설정, 턴 및 추론 노력에 대한 안전 제한으로 에이전트를 구성합니다. 루프가 실행되면 잠재적 재개를 위해 세션 ID를 캡처하고, 최종 결과를 처리하고, 총 비용을 인쇄합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def run_agent():
      session_id = None

      async for message in query(
          prompt="Find and fix the bug causing test failures in the auth module",
          options=ClaudeAgentOptions(
              allowed_tools=[
                  "Read",
                  "Edit",
                  "Bash",
                  "Glob",
                  "Grep",
              ],  # Listing tools here auto-approves them (no prompting)
              setting_sources=[
                  "project"
              ],  # Load CLAUDE.md, skills, hooks from current directory
              max_turns=30,  # Prevent runaway sessions
              effort="high",  # Thorough reasoning for complex debugging
          ),
      ):
          # Handle the final result
          if isinstance(message, ResultMessage):
              session_id = message.session_id  # Save for potential resumption

              if message.subtype == "success":
                  print(f"Done: {message.result}")
              elif message.subtype == "error_max_turns":
                  # Agent ran out of turns. Resume with a higher limit.
                  print(f"Hit turn limit. Resume session {session_id} to continue.")
              elif message.subtype == "error_max_budget_usd":
                  print("Hit budget limit.")
              else:
                  print(f"Stopped: {message.subtype}")
              if message.total_cost_usd is not None:
                  print(f"Cost: ${message.total_cost_usd:.4f}")


  asyncio.run(run_agent())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  let sessionId: string | undefined;

  for await (const message of query({
    prompt: "Find and fix the bug causing test failures in the auth module",
    options: {
      allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"], // Listing tools here auto-approves them (no prompting)
      settingSources: ["project"], // Load CLAUDE.md, skills, hooks from current directory
      maxTurns: 30, // Prevent runaway sessions
      effort: "high" // Thorough reasoning for complex debugging
    }
  })) {
    // Save the session ID to resume later if needed
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }

    // Handle the final result
    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log(`Done: ${message.result}`);
      } else if (message.subtype === "error_max_turns") {
        // Agent ran out of turns. Resume with a higher limit.
        console.log(`Hit turn limit. Resume session ${sessionId} to continue.`);
      } else if (message.subtype === "error_max_budget_usd") {
        console.log("Hit budget limit.");
      } else {
        console.log(`Stopped: ${message.subtype}`);
      }
      console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
    }
  }
  ```
</CodeGroup>

## 다음 단계

이제 루프를 이해했으므로 구축하는 것에 따라 다음 위치로 이동합니다:

* **아직 에이전트를 실행하지 않았나요?** [빠른 시작](/ko/agent-sdk/quickstart)으로 시작하여 SDK를 설치하고 끝에서 끝까지 실행되는 전체 예제를 확인합니다.
* **프로젝트에 연결할 준비가 되었나요?** [CLAUDE.md, 스킬, 파일시스템 hooks 로드](/ko/agent-sdk/claude-code-features)하여 에이전트가 프로젝트 규칙을 자동으로 따르도록 합니다.
* **대화형 UI를 구축하고 있나요?** [스트리밍](/ko/agent-sdk/streaming-output)을 활성화하여 루프가 실행되면서 라이브 텍스트 및 도구 호출을 표시합니다.
* **에이전트가 할 수 있는 것에 대해 더 엄격한 제어가 필요하신가요?** [권한](/ko/agent-sdk/permissions)으로 도구 접근을 잠그고, [hooks](/ko/agent-sdk/hooks)를 사용하여 실행 전에 도구 호출을 감사, 차단 또는 변환합니다.
* **장기 또는 비용이 많이 드는 작업을 실행하고 있나요?** 격리된 작업을 [서브에이전트](/ko/agent-sdk/subagents)로 오프로드하여 주 컨텍스트를 깔끔하게 유지합니다.

에이전트 루프의 더 광범위한 개념적 그림(SDK 특정이 아님)은 [Claude Code의 작동 원리](/ko/how-claude-code-works)를 참조하세요.

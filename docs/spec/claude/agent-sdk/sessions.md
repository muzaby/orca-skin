> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 세션으로 작업하기

> 세션이 에이전트 대화 기록을 어떻게 유지하는지, 그리고 이전 실행으로 돌아가기 위해 continue, resume, fork를 언제 사용할지에 대해 알아봅니다.

세션은 에이전트가 작업하는 동안 SDK가 누적하는 대화 기록입니다. 여기에는 프롬프트, 에이전트가 수행한 모든 도구 호출, 모든 도구 결과, 그리고 모든 응답이 포함됩니다. SDK는 이를 자동으로 디스크에 기록하므로 나중에 돌아올 수 있습니다.

세션으로 돌아간다는 것은 에이전트가 이전의 전체 컨텍스트를 가지고 있다는 의미입니다. 이미 읽은 파일, 이미 수행한 분석, 이미 내린 결정들이 모두 있습니다. 후속 질문을 할 수 있고, 중단에서 복구할 수 있으며, 다른 접근 방식을 시도하기 위해 분기할 수 있습니다.

<Note>
  세션은 **대화**를 유지하며, 파일 시스템은 유지하지 않습니다. 에이전트가 수행한 파일 변경 사항을 스냅샷하고 되돌리려면 [파일 체크포인팅](/ko/agent-sdk/file-checkpointing)을 사용하세요.
</Note>

이 가이드에서는 앱에 맞는 올바른 접근 방식을 선택하는 방법, 세션을 자동으로 추적하는 SDK 인터페이스, 세션 ID를 캡처하고 `resume` 및 `fork`를 수동으로 사용하는 방법, 그리고 호스트 간에 세션을 재개할 때 알아야 할 사항을 다룹니다.

## 접근 방식 선택하기

필요한 세션 처리의 양은 애플리케이션의 형태에 따라 다릅니다. 세션 관리는 컨텍스트를 공유해야 하는 여러 프롬프트를 보낼 때 중요합니다. 단일 `query()` 호출 내에서 에이전트는 이미 필요한 만큼 많은 턴을 수행하며, 권한 프롬프트와 `AskUserQuestion`은 [루프 내에서 처리됩니다](/ko/agent-sdk/user-input) (호출을 종료하지 않습니다).

| 구축 중인 것                                          | 사용할 것                                                                                                                  |
| :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| 일회성 작업: 단일 프롬프트, 후속 없음                           | 추가 작업 없음. 단일 `query()` 호출로 처리됩니다.                                                                                      |
| 한 프로세스 내에서 다중 턴 채팅                               | [`ClaudeSDKClient` (Python) 또는 `continue: true` (TypeScript)](#automatic-session-management). SDK가 ID 처리 없이 세션을 추적합니다. |
| 프로세스 재시작 후 중단한 지점에서 계속하기                         | `continue_conversation=True` (Python) / `continue: true` (TypeScript). 디렉토리의 가장 최근 세션을 재개하며, ID가 필요하지 않습니다.            |
| 특정 과거 세션 재개하기 (가장 최근이 아닌)                        | 세션 ID를 캡처하고 `resume`에 전달합니다.                                                                                           |
| 원본을 잃지 않고 대체 접근 방식 시도하기                          | 세션을 포크합니다.                                                                                                             |
| 상태 비저장 작업, 디스크에 아무것도 기록하고 싶지 않음 (TypeScript만 해당) | [`persistSession: false`](/ko/agent-sdk/typescript#options)를 설정합니다. 세션은 호출 기간 동안만 메모리에 존재합니다. Python은 항상 디스크에 유지합니다.   |

### Continue, resume, fork

Continue, resume, fork는 `query()`에 설정하는 옵션 필드입니다 (Python의 [`ClaudeAgentOptions`](/ko/agent-sdk/python#claudeagentoptions), TypeScript의 [`Options`](/ko/agent-sdk/typescript#options)).

**Continue**와 **resume**은 모두 기존 세션을 선택하고 여기에 추가합니다. 차이점은 해당 세션을 찾는 방식입니다:

* **Continue**는 현재 디렉토리의 가장 최근 세션을 찾습니다. 아무것도 추적할 필요가 없습니다. 앱이 한 번에 하나의 대화를 실행할 때 잘 작동합니다.
* **Resume**은 특정 세션 ID를 사용합니다. ID를 추적합니다. 여러 세션이 있을 때 (예: 다중 사용자 앱의 사용자당 하나) 또는 가장 최근이 아닌 세션으로 돌아가고 싶을 때 필요합니다.

**Fork**는 다릅니다: 원본의 기록 복사본으로 시작하는 새 세션을 만듭니다. 원본은 변경되지 않습니다. 다른 방향을 시도하면서 돌아갈 수 있는 옵션을 유지하려면 fork를 사용합니다.

## 자동 세션 관리

두 SDK 모두 호출 간에 세션 상태를 추적하는 인터페이스를 제공하므로 ID를 수동으로 전달할 필요가 없습니다. 단일 프로세스 내에서 다중 턴 대화에 이를 사용합니다.

### Python: `ClaudeSDKClient`

[`ClaudeSDKClient`](/ko/agent-sdk/python#claudesdkclient)는 세션 ID를 내부적으로 처리합니다. `client.query()`에 대한 각 호출은 자동으로 동일한 세션을 계속합니다. [`client.receive_response()`](/ko/agent-sdk/python#claudesdkclient)를 호출하여 현재 쿼리의 메시지를 반복합니다. 클라이언트는 비동기 컨텍스트 관리자로 사용해야 합니다.

이 예제는 동일한 `client`에 대해 두 개의 쿼리를 실행합니다. 첫 번째는 에이전트에게 모듈을 분석하도록 요청하고, 두 번째는 해당 모듈을 리팩토링하도록 요청합니다. 두 호출 모두 동일한 클라이언트 인스턴스를 통과하므로 두 번째 쿼리는 명시적인 `resume` 또는 세션 ID 없이 첫 번째의 전체 컨텍스트를 가집니다:

```python Python theme={null}
import asyncio
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
)


def print_response(message):
    """Print only the human-readable parts of a message."""
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock):
                print(block.text)
    elif isinstance(message, ResultMessage):
        cost = (
            f"${message.total_cost_usd:.4f}"
            if message.total_cost_usd is not None
            else "N/A"
        )
        print(f"[done: {message.subtype}, cost: {cost}]")


async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Glob", "Grep"],
    )

    async with ClaudeSDKClient(options=options) as client:
        # First query: client captures the session ID internally
        await client.query("Analyze the auth module")
        async for message in client.receive_response():
            print_response(message)

        # Second query: automatically continues the same session
        await client.query("Now refactor it to use JWT")
        async for message in client.receive_response():
            print_response(message)


asyncio.run(main())
```

Python SDK 참조에서 [`ClaudeSDKClient`와 독립형 `query()` 함수를 언제 사용할지](/ko/agent-sdk/python#choosing-between-query-and-claudesdkclient)에 대한 세부 정보를 확인하세요.

### TypeScript: `continue: true`

안정적인 TypeScript SDK (이 문서 전체에서 사용되는 `query()` 함수, 때때로 V1이라고 불림)는 Python의 `ClaudeSDKClient`와 같은 세션 보유 클라이언트 객체가 없습니다. 대신 각 후속 `query()` 호출에서 `continue: true`를 전달하면 SDK가 현재 디렉토리의 가장 최근 세션을 찾아 재개합니다. ID 추적이 필요하지 않습니다.

이 예제는 두 개의 별도 `query()` 호출을 수행합니다. 첫 번째는 새 세션을 만들고, 두 번째는 `continue: true`를 설정하여 SDK가 디스크의 가장 최근 세션을 찾아 재개하도록 지시합니다. 에이전트는 첫 번째 호출의 전체 컨텍스트를 가집니다:

```typescript TypeScript theme={null}
import { query } from "@anthropic-ai/claude-agent-sdk";

// First query: creates a new session
for await (const message of query({
  prompt: "Analyze the auth module",
  options: { allowedTools: ["Read", "Glob", "Grep"] }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}

// Second query: continue: true resumes the most recent session
for await (const message of query({
  prompt: "Now refactor it to use JWT",
  options: {
    continue: true,
    allowedTools: ["Read", "Edit", "Write", "Glob", "Grep"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

<Note>
  `createSession()`을 제공한 실험적 [V2 세션 API](/ko/agent-sdk/typescript-v2-preview)는 `send` / `stream` 패턴으로 더 이상 사용되지 않습니다. V1 `query()` 함수와 이 페이지에 설명된 세션 옵션을 사용하세요.
</Note>

## `query()`와 함께 세션 옵션 사용하기

### 세션 ID 캡처하기

Resume과 fork에는 세션 ID가 필요합니다. 결과 메시지의 `session_id` 필드에서 읽습니다 (Python의 [`ResultMessage`](/ko/agent-sdk/python#resultmessage), TypeScript의 [`SDKResultMessage`](/ko/agent-sdk/typescript#sdkresultmessage)). 이는 성공 또는 오류와 관계없이 모든 결과에 존재합니다. TypeScript에서 ID는 초기 `SystemMessage`의 직접 필드로도 더 일찍 사용 가능합니다. Python에서는 `SystemMessage.data` 내에 중첩되어 있습니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


  async def main():
      session_id = None

      async for message in query(
          prompt="Analyze the auth module and suggest improvements",
          options=ClaudeAgentOptions(
              allowed_tools=["Read", "Glob", "Grep"],
          ),
      ):
          if isinstance(message, ResultMessage):
              session_id = message.session_id
              if message.subtype == "success":
                  print(message.result)

      print(f"Session ID: {session_id}")
      return session_id


  session_id = asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  let sessionId: string | undefined;

  for await (const message of query({
    prompt: "Analyze the auth module and suggest improvements",
    options: { allowedTools: ["Read", "Glob", "Grep"] }
  })) {
    if (message.type === "result") {
      sessionId = message.session_id;
      if (message.subtype === "success") {
        console.log(message.result);
      }
    }
  }

  console.log(`Session ID: ${sessionId}`);
  ```
</CodeGroup>

### ID로 재개하기

세션 ID를 `resume`에 전달하여 특정 세션으로 돌아갑니다. 에이전트는 세션이 중단된 곳에서 전체 컨텍스트로 선택합니다. 재개하는 일반적인 이유:

* **완료된 작업에 대해 후속 조치하기.** 에이전트가 이미 무언가를 분석했습니다. 이제 파일을 다시 읽지 않고 해당 분석에 따라 조치하기를 원합니다.
* **제한에서 복구하기.** 첫 번째 실행이 `error_max_turns` 또는 `error_max_budget_usd`로 끝났습니다 ([결과 처리](/ko/agent-sdk/agent-loop#handle-the-result) 참조). 더 높은 제한으로 재개합니다.
* **프로세스 재시작하기.** 종료 전에 ID를 캡처했으며 대화를 복원하고 싶습니다.

이 예제는 [세션 ID 캡처하기](#capture-the-session-id)의 세션을 후속 프롬프트로 재개합니다. 재개하고 있으므로 에이전트는 이미 이전 분석을 컨텍스트에 가지고 있습니다:

<CodeGroup>
  ```python Python theme={null}
  # Earlier session analyzed the code; now build on that analysis
  async for message in query(
      prompt="Now implement the refactoring you suggested",
      options=ClaudeAgentOptions(
          resume=session_id,
          allowed_tools=["Read", "Edit", "Write", "Glob", "Grep"],
      ),
  ):
      if isinstance(message, ResultMessage) and message.subtype == "success":
          print(message.result)
  ```

  ```typescript TypeScript theme={null}
  // Earlier session analyzed the code; now build on that analysis
  for await (const message of query({
    prompt: "Now implement the refactoring you suggested",
    options: {
      resume: sessionId,
      allowedTools: ["Read", "Edit", "Write", "Glob", "Grep"]
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

<Tip>
  `resume` 호출이 예상된 기록 대신 새 세션을 반환하면 가장 일반적인 원인은 일치하지 않는 `cwd`입니다. 세션은 `~/.claude/projects/<encoded-cwd>/*.jsonl` 아래에 저장되며, 여기서 `<encoded-cwd>`는 모든 영숫자가 아닌 문자가 `-`로 바뀐 절대 작업 디렉토리입니다 (따라서 `/Users/me/proj`는 `-Users-me-proj`가 됩니다). resume 호출이 다른 디렉토리에서 실행되면 SDK가 잘못된 위치를 찾습니다. 세션 파일도 현재 머신에 존재해야 합니다.
</Tip>

머신 간 또는 서버리스 환경에서 세션을 재개하려면 [`SessionStore` 어댑터](/ko/agent-sdk/session-storage)를 사용하여 트랜스크립트를 공유 스토리지로 미러링합니다.

### 대체 방안을 탐색하기 위해 포크하기

포킹은 원본의 기록 복사본으로 시작하지만 그 지점에서 분기하는 새 세션을 만듭니다. 포크는 자신의 세션 ID를 가집니다. 원본의 ID와 기록은 변경되지 않습니다. 두 개의 독립적인 세션을 별도로 재개할 수 있는 두 개의 세션 ID로 끝납니다.

<Note>
  포킹은 대화 기록을 분기하며, 파일 시스템은 분기하지 않습니다. 포크된 에이전트가 파일을 편집하면 해당 변경 사항은 실제이며 동일한 디렉토리에서 작업하는 모든 세션에 표시됩니다. 파일 변경 사항을 분기하고 되돌리려면 [파일 체크포인팅](/ko/agent-sdk/file-checkpointing)을 사용합니다.
</Note>

이 예제는 [세션 ID 캡처하기](#capture-the-session-id)를 기반으로 합니다: `session_id`에서 인증 모듈을 이미 분석했으며 JWT 중심 스레드를 잃지 않고 OAuth2를 탐색하고 싶습니다. 첫 번째 블록은 세션을 포크하고 포크의 ID (`forked_id`)를 캡처합니다. 두 번째 블록은 원본 `session_id`를 재개하여 JWT 경로를 계속합니다. 이제 두 개의 세션 ID가 두 개의 별도 기록을 가리킵니다:

<CodeGroup>
  ```python Python theme={null}
  # Fork: branch from session_id into a new session
  forked_id = None
  async for message in query(
      prompt="Instead of JWT, implement OAuth2 for the auth module",
      options=ClaudeAgentOptions(
          resume=session_id,
          fork_session=True,
      ),
  ):
      if isinstance(message, ResultMessage):
          forked_id = message.session_id  # The fork's ID, distinct from session_id
          if message.subtype == "success":
              print(message.result)

  print(f"Forked session: {forked_id}")

  # Original session is untouched; resuming it continues the JWT thread
  async for message in query(
      prompt="Continue with the JWT approach",
      options=ClaudeAgentOptions(resume=session_id),
  ):
      if isinstance(message, ResultMessage) and message.subtype == "success":
          print(message.result)
  ```

  ```typescript TypeScript theme={null}
  // Fork: branch from sessionId into a new session
  let forkedId: string | undefined;

  for await (const message of query({
    prompt: "Instead of JWT, implement OAuth2 for the auth module",
    options: {
      resume: sessionId,
      forkSession: true
    }
  })) {
    if (message.type === "system" && message.subtype === "init") {
      forkedId = message.session_id; // The fork's ID, distinct from sessionId
    }
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }

  console.log(`Forked session: ${forkedId}`);

  // Original session is untouched; resuming it continues the JWT thread
  for await (const message of query({
    prompt: "Continue with the JWT approach",
    options: { resume: sessionId }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
  ```
</CodeGroup>

## 호스트 간에 재개하기

세션 파일은 이를 만든 머신에 로컬입니다. 다른 호스트 (CI 워커, 임시 컨테이너, 서버리스)에서 세션을 재개하려면 두 가지 옵션이 있습니다:

* **세션 파일 이동하기.** 첫 번째 실행에서 `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`을 유지하고 `resume`을 호출하기 전에 새 호스트의 동일한 경로로 복원합니다. `cwd`가 일치해야 합니다.
* **세션 재개에 의존하지 않기.** 필요한 결과 (분석 출력, 결정, 파일 diff)를 애플리케이션 상태로 캡처하고 새 세션의 프롬프트에 전달합니다. 이는 종종 트랜스크립트 파일을 주변에 배송하는 것보다 더 견고합니다.

두 SDK 모두 디스크의 세션을 열거하고 메시지를 읽기 위한 함수를 노출합니다: TypeScript의 [`listSessions()`](/ko/agent-sdk/typescript#listsessions) 및 [`getSessionMessages()`](/ko/agent-sdk/typescript#getsessionmessages), Python의 [`list_sessions()`](/ko/agent-sdk/python#list_sessions) 및 [`get_session_messages()`](/ko/agent-sdk/python#get_session_messages). 이를 사용하여 사용자 정의 세션 선택기, 정리 로직 또는 트랜스크립트 뷰어를 구축합니다.

두 SDK 모두 개별 세션을 조회하고 변경하기 위한 함수도 노출합니다: Python의 [`get_session_info()`](/ko/agent-sdk/python#get_session_info), [`rename_session()`](/ko/agent-sdk/python#rename_session), [`tag_session()`](/ko/agent-sdk/python#tag_session), 그리고 TypeScript의 [`getSessionInfo()`](/ko/agent-sdk/typescript#getsessioninfo), [`renameSession()`](/ko/agent-sdk/typescript#renamesession), [`tagSession()`](/ko/agent-sdk/typescript#tagsession). 이를 사용하여 태그별로 세션을 구성하거나 인간이 읽을 수 있는 제목을 제공합니다.

## 관련 리소스

* [에이전트 루프 작동 방식](/ko/agent-sdk/agent-loop): 세션 내에서 턴, 메시지, 컨텍스트 누적을 이해합니다
* [파일 체크포인팅](/ko/agent-sdk/file-checkpointing): 세션 간 파일 변경 사항 추적 및 되돌리기
* [Python `ClaudeAgentOptions`](/ko/agent-sdk/python#claudeagentoptions): Python의 전체 세션 옵션 참조
* [TypeScript `Options`](/ko/agent-sdk/typescript#options): TypeScript의 전체 세션 옵션 참조

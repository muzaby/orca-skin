> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 비용 및 사용량 추적

> Claude Agent SDK를 사용하여 토큰 사용량을 추적하고, 비용을 예측하며, 프롬프트 캐싱을 구성하는 방법을 알아봅니다.

Claude Agent SDK는 Claude와의 각 상호작용에 대한 상세한 토큰 사용량 정보를 제공합니다. 이 가이드에서는 사용량을 적절히 추적하고 비용 보고를 이해하는 방법을 설명합니다. 특히 병렬 도구 사용 및 다단계 대화를 다룰 때 유용합니다.

완전한 API 문서는 [TypeScript SDK 참조](/ko/agent-sdk/typescript) 및 [Python SDK 참조](/ko/agent-sdk/python)를 참조하십시오.

<Warning>
  `total_cost_usd` 및 `costUSD` 필드는 클라이언트 측 추정값이며, 권위 있는 청구 데이터가 아닙니다. SDK는 빌드 시간에 번들된 가격 테이블에서 로컬로 계산하므로 다음과 같은 경우에 실제 청구 금액과 달라질 수 있습니다:

  * 가격 변경
  * 설치된 SDK 버전이 모델을 인식하지 못함
  * 클라이언트가 모델링할 수 없는 청구 규칙 적용

  이 필드는 개발 통찰력 및 대략적인 예산 책정을 위해 사용하십시오. 권위 있는 청구의 경우 [Usage and Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api) 또는 [Claude Console](https://platform.claude.com/usage)의 Usage 페이지를 사용하십시오. 이 필드에서 최종 사용자에게 청구하거나 재정 결정을 트리거하지 마십시오.
</Warning>

## 토큰 사용량 이해

TypeScript 및 Python SDK는 다른 필드 이름으로 동일한 사용량 데이터를 노출합니다:

* **TypeScript**는 각 어시스턴트 메시지(`message.message.id`, `message.message.usage`)에 대한 단계별 토큰 분석, 결과 메시지의 `modelUsage`를 통한 모델별 비용, 결과 메시지의 누적 합계를 제공합니다.
* **Python**은 각 어시스턴트 메시지(`message.usage`, `message.message_id`)에 대한 단계별 토큰 분석, 결과 메시지의 `model_usage`를 통한 모델별 비용, 결과 메시지의 누적 합계(`total_cost_usd` 및 `usage` dict)를 제공합니다.

두 SDK 모두 동일한 기본 비용 모델을 사용하고 동일한 세분성을 노출합니다. 차이점은 필드 이름 지정 및 단계별 사용량이 중첩된 위치입니다.

비용 추적은 SDK가 사용량 데이터를 어떻게 범위 지정하는지 이해하는 것에 달려 있습니다:

* **`query()` 호출:** SDK의 `query()` 함수 한 번의 호출입니다. 단일 호출은 여러 단계를 포함할 수 있습니다(Claude가 응답하고, 도구를 사용하고, 결과를 받고, 다시 응답합니다). 각 호출은 끝에 하나의 [`result`](/ko/agent-sdk/typescript#sdk-result-message) 메시지를 생성합니다.
* **단계:** `query()` 호출 내의 단일 요청/응답 사이클입니다. 각 단계는 토큰 사용량이 있는 어시스턴트 메시지를 생성합니다.
* **세션:** 세션 ID로 연결된 일련의 `query()` 호출입니다(`resume` 옵션 사용). 세션 내의 각 `query()` 호출은 자신의 비용을 독립적으로 보고합니다.

다음 다이어그램은 단일 `query()` 호출의 메시지 스트림을 보여주며, 각 단계에서 토큰 사용량이 보고되고 끝에 누적 추정값이 표시됩니다:

<img src="https://mintcdn.com/claude-code/Dujg43sxTkuhSELI/images/agent-sdk/message-usage-flow.svg?fit=max&auto=format&n=Dujg43sxTkuhSELI&q=85&s=c542f51ff58547ef9c0e57b16d03f33c" alt="쿼리가 두 단계의 메시지를 생성하는 다이어그램입니다. 단계 1은 동일한 ID와 사용량을 공유하는 4개의 어시스턴트 메시지(한 번만 계산)를 가지고 있고, 단계 2는 새로운 ID를 가진 1개의 어시스턴트 메시지를 가지고 있으며, 최종 결과 메시지는 추정된 total_cost_usd를 표시합니다." width="760" height="520" data-path="images/agent-sdk/message-usage-flow.svg" />

<Steps>
  <Step title="각 단계는 어시스턴트 메시지를 생성합니다">
    Claude가 응답할 때, 하나 이상의 어시스턴트 메시지를 보냅니다. TypeScript에서 각 어시스턴트 메시지는 `id` 및 토큰 개수(`input_tokens`, `output_tokens`)가 있는 [`usage`](https://platform.claude.com/docs/en/api/messages) 객체를 포함하는 중첩된 `BetaMessage`(`message.message`를 통해 액세스)를 포함합니다. Python에서 `AssistantMessage` 데이터클래스는 `message.usage` 및 `message.message_id`를 통해 동일한 데이터를 직접 노출합니다. Claude가 한 번에 여러 도구를 사용할 때, 해당 턴의 모든 메시지는 동일한 ID를 공유하므로 ID로 중복 제거하여 중복 계산을 피하십시오.
  </Step>

  <Step title="결과 메시지는 누적 추정값을 제공합니다">
    `query()` 호출이 완료되면, SDK는 `total_cost_usd` 및 누적 `usage`가 있는 결과 메시지를 내보냅니다. 이는 TypeScript([`SDKResultMessage`](/ko/agent-sdk/typescript#sdk-result-message)) 및 Python([`ResultMessage`](/ko/agent-sdk/python#result-message)) 모두에서 사용 가능합니다. 여러 `query()` 호출을 수행하는 경우(예: 다중 턴 세션에서), 각 결과는 해당 개별 호출의 비용만 반영합니다. 추정된 합계만 필요한 경우, 단계별 사용량을 무시하고 이 단일 값을 읽을 수 있습니다.
  </Step>
</Steps>

## 쿼리의 총 비용 얻기

결과 메시지([TypeScript](/ko/agent-sdk/typescript#sdk-result-message), [Python](/ko/agent-sdk/python#result-message))는 `query()` 호출에 대한 에이전트 루프의 끝을 표시합니다. 여기에는 `total_cost_usd`가 포함되어 있으며, 이는 해당 호출의 모든 단계에 걸친 누적 추정 비용입니다. 이는 성공 및 오류 결과 모두에 대해 작동합니다. 세션을 사용하여 여러 `query()` 호출을 수행하는 경우, 각 결과는 해당 개별 호출의 비용만 반영합니다.

다음 예제는 `query()` 호출의 메시지 스트림을 반복하고 `result` 메시지가 도착할 때 총 비용을 인쇄합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({ prompt: "Summarize this project" })) {
    if (message.type === "result") {
      console.log(`Total cost: $${message.total_cost_usd}`);
    }
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ResultMessage
  import asyncio


  async def main():
      async for message in query(prompt="Summarize this project"):
          if isinstance(message, ResultMessage):
              print(f"Total cost: ${message.total_cost_usd or 0}")


  asyncio.run(main())
  ```
</CodeGroup>

## 단계별 및 모델별 사용량 추적

이 섹션의 예제는 TypeScript 필드 이름을 사용합니다. Python에서 동등한 필드는 단계별 사용량의 경우 [`AssistantMessage.usage`](/ko/agent-sdk/python#assistant-message) 및 `AssistantMessage.message_id`이고, 모델별 분석의 경우 [`ResultMessage.model_usage`](/ko/agent-sdk/python#result-message)입니다.

### 단계별 사용량 추적

각 어시스턴트 메시지는 `id` 및 토큰 개수가 있는 `usage` 객체를 포함하는 중첩된 `BetaMessage`(`message.message`를 통해 액세스)를 포함합니다. Claude가 도구를 병렬로 사용할 때, 여러 메시지는 동일한 `id`를 공유하고 동일한 사용량 데이터를 가집니다. 이미 계산한 ID를 추적하고 중복을 건너뛰어 부풀려진 합계를 피하십시오.

<Warning>
  병렬 도구 호출은 중첩된 `BetaMessage`가 동일한 `id`를 공유하고 동일한 사용량을 가진 여러 어시스턴트 메시지를 생성합니다. 정확한 단계별 토큰 개수를 얻으려면 항상 ID로 중복 제거하십시오.
</Warning>

다음 예제는 모든 단계에 걸쳐 입력 및 출력 토큰을 누적하고, 각 고유 메시지 ID를 한 번만 계산합니다:

```typescript theme={null}
import { query } from "@anthropic-ai/claude-agent-sdk";

const seenIds = new Set<string>();
let totalInputTokens = 0;
let totalOutputTokens = 0;

for await (const message of query({ prompt: "Summarize this project" })) {
  if (message.type === "assistant") {
    const msgId = message.message.id;

    // Parallel tool calls share the same ID, only count once
    if (!seenIds.has(msgId)) {
      seenIds.add(msgId);
      totalInputTokens += message.message.usage.input_tokens;
      totalOutputTokens += message.message.usage.output_tokens;
    }
  }
}

console.log(`Steps: ${seenIds.size}`);
console.log(`Input tokens: ${totalInputTokens}`);
console.log(`Output tokens: ${totalOutputTokens}`);
```

### 모델별 사용량 분석

결과 메시지는 [`modelUsage`](/ko/agent-sdk/typescript#model-usage)를 포함하며, 이는 모델 이름을 모델별 토큰 개수 및 비용에 매핑합니다. 이는 여러 모델을 실행할 때(예: 서브에이전트의 경우 Haiku, 메인 에이전트의 경우 Opus) 토큰이 어디로 가는지 확인하려는 경우 유용합니다.

다음 예제는 쿼리를 실행하고 사용된 각 모델에 대한 비용 및 토큰 분석을 인쇄합니다:

```typescript theme={null}
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({ prompt: "Summarize this project" })) {
  if (message.type !== "result") continue;

  for (const [modelName, usage] of Object.entries(message.modelUsage)) {
    console.log(`${modelName}: $${usage.costUSD.toFixed(4)}`);
    console.log(`  Input tokens: ${usage.inputTokens}`);
    console.log(`  Output tokens: ${usage.outputTokens}`);
    console.log(`  Cache read: ${usage.cacheReadInputTokens}`);
    console.log(`  Cache creation: ${usage.cacheCreationInputTokens}`);
  }
}
```

## 여러 호출에 걸쳐 비용 누적

각 `query()` 호출은 자신의 `total_cost_usd`를 반환합니다. SDK는 세션 수준 합계를 제공하지 않으므로, 애플리케이션이 여러 `query()` 호출을 수행하는 경우(예: 다중 턴 세션 또는 다양한 사용자에 걸쳐), 합계를 직접 누적하십시오.

다음 예제는 두 개의 `query()` 호출을 순차적으로 실행하고, 각 호출의 `total_cost_usd`를 실행 합계에 추가하고, 호출별 및 결합된 비용을 모두 인쇄합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Track cumulative cost across multiple query() calls
  let totalSpend = 0;

  const prompts = [
    "Read the files in src/ and summarize the architecture",
    "List all exported functions in src/auth.ts"
  ];

  for (const prompt of prompts) {
    for await (const message of query({ prompt })) {
      if (message.type === "result") {
        totalSpend += message.total_cost_usd;
        console.log(`This call: $${message.total_cost_usd}`);
      }
    }
  }

  console.log(`Total spend: $${totalSpend.toFixed(4)}`);
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ResultMessage
  import asyncio


  async def main():
      # Track cumulative cost across multiple query() calls
      total_spend = 0.0

      prompts = [
          "Read the files in src/ and summarize the architecture",
          "List all exported functions in src/auth.ts",
      ]

      for prompt in prompts:
          async for message in query(prompt=prompt):
              if isinstance(message, ResultMessage):
                  cost = message.total_cost_usd or 0
                  total_spend += cost
                  print(f"This call: ${cost}")

      print(f"Total spend: ${total_spend:.4f}")


  asyncio.run(main())
  ```
</CodeGroup>

## 오류, 캐싱 및 토큰 불일치 처리

정확한 비용 추적을 위해 실패한 대화, 캐시 토큰 가격 책정 및 가끔 발생하는 보고 불일치를 고려하십시오.

### 출력 토큰 불일치 해결

드물게 동일한 ID를 가진 메시지에 대해 다른 `output_tokens` 값을 관찰할 수 있습니다. 이 경우:

1. **최고값 사용:** 그룹의 최종 메시지는 일반적으로 정확한 합계를 포함합니다.
2. **결과 메시지 선호:** 결과 메시지의 `total_cost_usd`는 모든 단계에 걸친 SDK의 누적 추정값을 반영하므로, 단계별 값을 직접 합산하는 것보다 더 신뢰할 수 있습니다. 여전히 추정값이며 실제 청구와 다를 수 있습니다.
3. **불일치 보고:** [Claude Code GitHub 저장소](https://github.com/anthropics/claude-code/issues)에서 문제를 제출하십시오.

### 실패한 대화의 비용 추적

성공 및 오류 결과 메시지 모두 `usage` 및 `total_cost_usd`를 포함합니다. 대화가 중간에 실패하면, 실패 지점까지 토큰을 소비했습니다. 항상 `subtype`에 관계없이 결과 메시지에서 비용 데이터를 읽으십시오.

### 캐시 토큰 추적

Agent SDK는 반복된 콘텐츠에 대한 비용을 줄이기 위해 [프롬프트 캐싱](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)을 자동으로 사용합니다. 캐싱을 직접 구성할 필요가 없습니다. 사용량 객체는 캐시 추적을 위한 두 가지 추가 필드를 포함합니다:

* `cache_creation_input_tokens`: 새 캐시 항목을 생성하는 데 사용된 토큰(표준 입력 토큰보다 높은 요금으로 청구됨).
* `cache_read_input_tokens`: 기존 캐시 항목에서 읽은 토큰(감소된 요금으로 청구됨).

캐싱 절감액을 이해하려면 이들을 `input_tokens`과 별도로 추적하십시오. TypeScript에서 이 필드는 [`Usage`](/ko/agent-sdk/typescript#usage) 객체에 입력됩니다. Python에서 이들은 [`ResultMessage.usage`](/ko/agent-sdk/python#result-message) dict의 키로 나타납니다(예: `message.usage.get("cache_read_input_tokens", 0)`).

### 프롬프트 캐시 TTL을 1시간으로 연장

SDK에서 작성한 캐시 항목은 API 키로 인증하거나 Amazon Bedrock, Google Cloud Vertex AI 또는 Microsoft Foundry에서 실행할 때 기본적으로 5분 TTL을 사용합니다. 워크로드가 동일한 시스템 프롬프트 및 컨텍스트에 대해 많은 짧은 세션을 실행하고 세션 간에 5분보다 긴 간격이 있는 경우, 캐시는 세션 간에 만료되고 각 새 세션은 전체 입력 가격을 지불합니다.

캐시 쓰기에 1시간 TTL을 요청하려면 [`ENABLE_PROMPT_CACHING_1H`](/ko/env-vars) 환경 변수를 설정하십시오. 셸 또는 컨테이너 환경에서 내보내거나 `options.env`를 통해 전달할 수 있습니다.

다음 예제는 Bedrock에서 실행되는 에이전트에 대해 1시간 TTL을 활성화합니다:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      env={
          "CLAUDE_CODE_USE_BEDROCK": "1",
          "ENABLE_PROMPT_CACHING_1H": "1",
      },
  )
  ```

  ```typescript TypeScript theme={null}
  const options = {
    env: {
      ...process.env,
      CLAUDE_CODE_USE_BEDROCK: "1",
      ENABLE_PROMPT_CACHING_1H: "1",
    },
  };
  ```
</CodeGroup>

1시간 TTL을 가진 캐시 쓰기는 5분 쓰기보다 높은 요금으로 청구되므로, 이를 활성화하면 더 높은 쓰기 비용으로 더 많은 캐시 읽기를 거래합니다. 자세한 내용은 [프롬프트 캐싱 가격 책정](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)을 참조하십시오. Claude 구독 사용자는 이미 자동으로 1시간 TTL을 받으며 이 변수를 설정할 필요가 없습니다.

## 관련 문서

* [TypeScript SDK 참조](/ko/agent-sdk/typescript) - 완전한 API 문서
* [SDK 개요](/ko/agent-sdk/overview) - SDK 시작하기
* [SDK 권한](/ko/agent-sdk/permissions) - 도구 권한 관리

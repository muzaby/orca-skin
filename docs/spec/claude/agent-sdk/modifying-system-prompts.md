> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 시스템 프롬프트 수정

> `claude_code` 프리셋과 사용자 정의 시스템 프롬프트 중에서 선택하고, CLAUDE.md, 출력 스타일, append, 또는 완전히 사용자 정의된 프롬프트로 동작을 사용자 정의합니다.

시스템 프롬프트는 Claude의 동작, 기능 및 응답 스타일을 정의합니다. CLI 또는 IDE와 같은 코딩 도구에서 인간이 작업을 감시하고 조종하는 경우 `claude_code` 프리셋으로 시작합니다. 다른 표면, 정체성 또는 권한 모델을 가진 에이전트의 경우 자신의 프롬프트를 작성합니다.

이 페이지에서 다루는 내용:

* [시스템 프롬프트 작동 방식](#how-system-prompts-work), 프리셋, `append`가 있는 프리셋, 사용자 정의 프롬프트 중에서 선택하기 위한 결정 테이블 포함
* [에이전트 동작 사용자 정의](#customize-agent-behavior) CLAUDE.md 파일, 출력 스타일, `append`, 또는 사용자 정의 문자열 사용
* [네 가지 접근 방식 비교](#compare-the-four-approaches) 지속성, 범위 및 보존되는 항목별
* [접근 방식 결합](#combine-approaches) 사용자 정의 방법을 함께 계층화

## 시스템 프롬프트 작동 방식

시스템 프롬프트는 대화 전체에서 Claude의 동작 방식을 형성하는 초기 명령 집합입니다. Agent SDK에는 이에 대한 세 가지 시작점이 있습니다:

* **최소 기본값**: TypeScript에서 `systemPrompt`를 설정하지 않거나 Python에서 `system_prompt`를 설정하지 않으면, SDK는 도구 호출을 다루지만 Claude Code의 코딩 지침, 응답 스타일 및 프로젝트 컨텍스트를 생략하는 최소 프롬프트를 사용합니다. 이는 기본적으로 전체 Claude Code 프롬프트를 사용하는 `claude -p`와 다릅니다. CLI에서 마이그레이션하고 일치하는 동작을 원하면 `claude_code` 프리셋을 설정합니다.
* **`claude_code` 프리셋**: Claude Code CLI가 사용하는 전체 시스템 프롬프트로, 도구 사용 명령, 코드 스타일 및 형식 지침, 응답 톤 및 상세도 규칙, 보안 및 안전 명령, 작업 디렉토리 및 환경에 대한 컨텍스트를 포함합니다. TypeScript에서 `systemPrompt: { type: "preset", preset: "claude_code" }`를 설정하거나 Python에서 `system_prompt={"type": "preset", "preset": "claude_code"}`를 설정하고, 선택적으로 `append`를 사용하여 끝에 자신의 명령을 추가합니다.
* **사용자 정의 문자열**: 직접 작성한 프롬프트입니다. SDK는 제공하는 것만 전송합니다.

### 시작점 결정

결정 요소는 에이전트가 Claude Code와 얼마나 유사한지입니다: 저장소에서 작동하는 코딩 에이전트로, 인간이 스트리밍 출력을 보고 작업을 조종합니다. 제품이 그것으로부터 멀어질수록, 자신의 프롬프트를 더 많이 작성하고 싶을 것입니다.

| 구축 중인 것                                                     | 사용                             | 얻을 수 있는 것                                                    |
| :---------------------------------------------------------- | :----------------------------- | :----------------------------------------------------------- |
| 인간이 보고 조종하는 CLI 또는 IDE와 같은 코딩 도구이며, Claude Code의 기본값이 원하는 것 | `claude_code` 프리셋              | 전체 Claude Code 프롬프트: 도구 지침, 안전 규칙, 터미널 친화적 응답, 저장소 규칙 인식     |
| 동일한 종류의 도구에 코딩 표준, 출력 형식 또는 도메인 컨텍스트와 같은 제품별 규칙 추가          | `append`가 있는 `claude_code` 프리셋 | 위의 모든 것에 프리셋 후에 추가된 명령. 제거되는 것이 없으므로 이것이 가장 낮은 위험의 사용자 정의입니다 |
| 다른 표면, 정체성 또는 권한 모델을 가진 에이전트, 또는 비코딩 에이전트                   | 사용자 정의 프롬프트 문자열                | 작성한 것만. 에이전트가 여전히 필요로 하는 도구 지침 및 안전 명령을 교체할 책임이 있습니다         |
| 에이전트 페르소나가 없는 얇은 도구 호출 루프로, 사용자 프롬프트에서 모든 동작을 제공합니다         | `systemPrompt` 옵션 없음           | 최소 기본값: 도구 호출 지원 및 그 이상 없음                                   |

"Claude Code와 다름"은 일반적으로 다음 중 하나를 의미합니다:

* **다른 표면**: 출력이 이를 트리거한 사람에 의해 터미널에서 읽혀지지 않습니다. 채팅 UI, 구조화된 출력 소비자 및 비코딩 자동화는 각각 출력이 렌더링되고 검토되는 방식과 일치하는 프롬프트가 필요합니다. CI 작업이 린트 오류를 수정하거나 diff를 검토하는 것과 같은 무인 코딩 자동화는 작업 자체가 프리셋이 작성된 것이기 때문에 여전히 프리셋에 맞습니다.
* **다른 정체성**: 에이전트는 자신을 Claude Code로 제시하지 않아야 합니다. 지원 봇, 데이터 분석 어시스턴트 또는 도메인별 에이전트는 자신의 이름, 범위 및 페르소나가 필요합니다.
* **다른 권한 모델**: 에이전트는 인간이 각 단계를 승인하지 않고 자율적으로 실행되거나 좁은 리소스 집합에서 작동합니다. Claude Code의 프롬프트는 인간이 전체 도구 세트에 액세스할 수 있는 루프에 있다고 가정합니다.
* **비코딩 작업**: Claude Code의 프롬프트 대부분은 코딩 지침입니다. 연구, 콘텐츠 또는 운영 에이전트의 경우, 해당 지침은 실제로 필요한 명령과 경쟁합니다.

[비교 표](#compare-the-four-approaches)는 각 사용자 정의 방법이 보존하는 것을 보여줍니다.

## 에이전트 동작 사용자 정의

출력 스타일, `append`, 그리고 사용자 정의 프롬프트 문자열은 각각 시스템 프롬프트를 직접 변경합니다. CLAUDE.md는 다른 경로를 따릅니다: SDK가 이를 읽고 그 내용을 시스템 프롬프트가 아닌 프로젝트 컨텍스트로 대화에 주입하므로, 선택한 시스템 프롬프트와 함께 동작을 형성합니다. [Skills](/ko/agent-sdk/skills), [hooks](/ko/agent-sdk/hooks), 그리고 [permissions](/ko/agent-sdk/permissions)도 시스템 프롬프트 외부에서 동작을 형성하며 자체 페이지에서 다룹니다.

### 프로젝트 수준 명령을 위한 CLAUDE.md 파일

CLAUDE.md 파일은 Claude에 지속적인 프로젝트 컨텍스트와 명령을 제공합니다. SDK는 그 내용을 시스템 프롬프트가 아닌 대화에 주입하므로, 모든 시스템 프롬프트 구성과 함께 작동합니다. CLAUDE.md에 무엇을 넣을지, 어디에 배치할지, 그리고 효과적인 명령을 작성하는 방법에 대해서는 [Claude가 프로젝트를 기억하는 방법](/ko/memory)을 참조하십시오. 이 섹션은 SDK에 특정한 내용을 다룹니다: CLAUDE.md가 로드되는 방식입니다.

SDK는 일치하는 설정 소스가 활성화될 때 CLAUDE.md를 읽습니다: `'project'`는 작업 디렉토리에서 `CLAUDE.md` 또는 `.claude/CLAUDE.md`를 로드하고, `'user'`는 `~/.claude/CLAUDE.md`를 로드합니다. 기본 `query()` 옵션은 두 소스를 모두 활성화하므로 CLAUDE.md가 자동으로 로드됩니다. TypeScript에서 `settingSources`를 명시적으로 설정하거나 Python에서 `setting_sources`를 명시적으로 설정하면, 필요한 소스를 포함하십시오. CLAUDE.md 로딩은 `claude_code` 프리셋이 아닌 설정 소스에 의해 제어됩니다.

#### SDK와 함께 CLAUDE.md 로드

CLAUDE.md를 로드하려면, `settingSources`를 CLAUDE.md가 있는 수준을 포함하도록 설정하십시오. 아래 예제는 프로젝트 수준 CLAUDE.md를 `claude_code` 프리셋과 함께 로드하므로, Claude는 전체 코딩 에이전트 프롬프트와 프로젝트의 규칙을 모두 가지고 있습니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const messages = [];

  for await (const message of query({
    prompt: "Add a new React component for user profiles",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code" // Use Claude Code's system prompt
      },
      settingSources: ["project"] // Loads CLAUDE.md from project
    }
  })) {
    messages.push(message);
  }

  // Now Claude has access to your project guidelines from CLAUDE.md
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions

  messages = []

  async for message in query(
      prompt="Add a new React component for user profiles",
      options=ClaudeAgentOptions(
          system_prompt={
              "type": "preset",
              "preset": "claude_code",  # Use Claude Code's system prompt
          },
          setting_sources=["project"],  # Loads CLAUDE.md from project
      ),
  ):
      messages.append(message)

  # Now Claude has access to your project guidelines from CLAUDE.md
  ```
</CodeGroup>

CLAUDE.md는 프로젝트의 모든 세션에서 지속되며, git을 통해 팀과 공유되고, 코드 변경 없이 자동으로 검색됩니다. 빈 `settingSources` 배열을 전달하면 로드되지 않습니다.

### 지속적인 구성을 위한 출력 스타일

출력 스타일은 Claude의 시스템 프롬프트를 수정하는 저장된 구성입니다. 마크다운 파일로 저장되며 세션 및 프로젝트 전체에서 재사용할 수 있습니다.

#### 출력 스타일 생성

출력 스타일은 [frontmatter](/ko/output-styles#frontmatter)에 메타데이터가 있는 마크다운 파일이며, 그 뒤에 프롬프트 내용이 있습니다. 모든 프로젝트에서 사용 가능한 사용자 수준 스타일의 경우 `~/.claude/output-styles/`에 저장하거나, 팀과 커밋하고 공유할 수 있는 프로젝트 수준 스타일의 경우 저장소의 `.claude/output-styles/`에 저장하십시오.

기본적으로, 사용자 정의 출력 스타일은 `claude_code` 프리셋의 소프트웨어 엔지니어링 명령을 자신의 명령으로 바꿉니다. 이를 유지하고 명령을 그 위에 계층화하려면, frontmatter에서 `keep-coding-instructions: true`를 설정하십시오. 에이전트가 여전히 소프트웨어 엔지니어링 작업을 수행할 때 이를 유지하십시오. 역할을 완전히 바꿀 때는 이를 제외하십시오.

아래 예제는 코딩 명령을 유지하는 코드 리뷰 담당자 페르소나를 정의합니다. 코드 리뷰는 Claude Code의 보안 및 코드 품질 지침의 이점을 여전히 얻기 때문입니다. 프로젝트 전체에서 사용 가능하도록 `~/.claude/output-styles/code-reviewer.md`로 저장하십시오:

```markdown ~/.claude/output-styles/code-reviewer.md theme={null}
---
name: Code Reviewer
description: Thorough code review assistant
keep-coding-instructions: true
---

You are an expert code reviewer.

For every code submission:
1. Check for bugs and security issues
2. Evaluate performance
3. Suggest improvements
4. Rate code quality (1-10)
```

#### 출력 스타일 활성화

생성되면, 다음을 통해 출력 스타일을 활성화합니다:

* **CLI**: `/config`를 실행하고 출력 스타일을 선택합니다
* **설정**: `.claude/settings.local.json`에서 `outputStyle`을 설정합니다
* **TypeScript SDK**: `options.outputStyle`을 스타일의 이름으로 설정합니다

Python SDK는 프로그래밍 방식으로 출력 스타일을 선택하는 옵션이 없습니다. `.claude/settings.local.json`에 쓸 수 없는 코드 전용 배포의 경우, `append` 또는 사용자 정의 프롬프트 문자열을 대신 사용하십시오.

**SDK 사용자를 위한 참고:** 출력 스타일은 `settingSources: ['user']` 또는 `settingSources: ['project']`(TypeScript) / `setting_sources=["user"]` 또는 `setting_sources=["project"]`(Python)을 옵션에 포함할 때 로드됩니다.

### `claude_code` 프리셋에 추가

Claude Code 프리셋을 `append` 속성과 함께 사용하여 모든 기본 제공 기능을 유지하면서 사용자 정의 명령을 추가할 수 있습니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const messages = [];

  for await (const message of query({
    prompt: "Help me write a Python function to calculate fibonacci numbers",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: "Always include detailed docstrings and type hints in Python code."
      }
    }
  })) {
    messages.push(message);
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions

  messages = []

  async for message in query(
      prompt="Help me write a Python function to calculate fibonacci numbers",
      options=ClaudeAgentOptions(
          system_prompt={
              "type": "preset",
              "preset": "claude_code",
              "append": "Always include detailed docstrings and type hints in Python code.",
          }
      ),
  ):
      messages.append(message)
  ```
</CodeGroup>

#### 사용자 및 머신 전체에서 프롬프트 캐싱 개선

기본적으로, 동일한 `claude_code` 프리셋과 `append` 텍스트를 사용하는 두 세션은 다른 작업 디렉토리에서 실행되는 경우 프롬프트 캐시 항목을 공유할 수 없습니다. 이는 프리셋이 `append` 텍스트 앞의 시스템 프롬프트에 세션별 컨텍스트를 포함하기 때문입니다: 작업 디렉토리, git 저장소 여부, 플랫폼, 활성 셸, OS 버전, 그리고 자동 메모리 경로. 해당 컨텍스트의 차이는 다른 시스템 프롬프트를 생성하고 캐시 미스를 초래합니다. CLAUDE.md 내용은 SDK가 이를 시스템 프롬프트가 아닌 대화에 주입하기 때문에 시스템 프롬프트 캐시에 영향을 주지 않습니다.

세션 전체에서 시스템 프롬프트를 동일하게 만들려면, TypeScript에서 `excludeDynamicSections: true`를 설정하거나 Python에서 `"exclude_dynamic_sections": True`를 설정하십시오. 세션별 컨텍스트는 첫 번째 사용자 메시지로 이동하여, 정적 프리셋과 `append` 텍스트만 시스템 프롬프트에 남으므로 동일한 구성이 사용자 및 머신 전체에서 캐시 항목을 공유합니다.

<Note>
  `excludeDynamicSections`는 `@anthropic-ai/claude-agent-sdk` v0.2.98 이상 또는 Python의 경우 `claude-agent-sdk` v0.1.58 이상이 필요합니다. 프리셋 객체 형식에만 적용되며 `systemPrompt`가 문자열일 때는 효과가 없습니다.
</Note>

다음 예제는 공유 `append` 블록을 `excludeDynamicSections`와 쌍으로 만들어 다양한 디렉토리에서 실행되는 에이전트 플릿이 동일한 캐시된 시스템 프롬프트를 재사용할 수 있도록 합니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Triage the open issues in this repo",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: "You operate Acme's internal triage workflow. Label issues by component and severity.",
        excludeDynamicSections: true
      }
    }
  })) {
    // ...
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions

  async for message in query(
      prompt="Triage the open issues in this repo",
      options=ClaudeAgentOptions(
          system_prompt={
              "type": "preset",
              "preset": "claude_code",
              "append": "You operate Acme's internal triage workflow. Label issues by component and severity.",
              "exclude_dynamic_sections": True,
          },
      ),
  ):
      ...
  ```
</CodeGroup>

**트레이드오프:** 작업 디렉토리, git 저장소 플래그, 플랫폼, 활성 셸, OS 버전, 그리고 자동 메모리 경로는 여전히 Claude에 도달하지만, 시스템 프롬프트가 아닌 첫 번째 사용자 메시지의 일부로 도달합니다. 사용자 메시지의 명령은 시스템 프롬프트의 동일한 텍스트보다 약간 덜 가중치를 가지므로, Claude는 현재 디렉토리 또는 자동 메모리 경로에 대해 추론할 때 이를 덜 강하게 의존할 수 있습니다. 교차 세션 캐시 재사용이 최대한 권위 있는 환경 컨텍스트보다 더 중요할 때 이 옵션을 활성화하십시오.

비대화형 CLI 모드의 동등한 플래그는 [`--exclude-dynamic-system-prompt-sections`](/ko/cli-reference)를 참조하십시오.

### 사용자 정의 시스템 프롬프트

사용자 정의 문자열을 `systemPrompt`로 제공하여 기본값을 완전히 자신의 명령으로 바꿀 수 있습니다.

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  const customPrompt = `You are a Python coding specialist.
  Follow these guidelines:
  - Write clean, well-documented code
  - Use type hints for all functions
  - Include comprehensive docstrings
  - Prefer functional programming patterns when appropriate
  - Always explain your code choices`;

  const messages = [];

  for await (const message of query({
    prompt: "Create a data processing pipeline",
    options: {
      systemPrompt: customPrompt
    }
  })) {
    messages.push(message);
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions

  custom_prompt = """You are a Python coding specialist.
  Follow these guidelines:
  - Write clean, well-documented code
  - Use type hints for all functions
  - Include comprehensive docstrings
  - Prefer functional programming patterns when appropriate
  - Always explain your code choices"""

  messages = []

  async for message in query(
      prompt="Create a data processing pipeline",
      options=ClaudeAgentOptions(system_prompt=custom_prompt),
  ):
      messages.append(message)
  ```
</CodeGroup>

## 네 가지 방식 모두 비교

네 가지 사용자 정의 방법은 위치, 공유 방식, `claude_code` 사전에서 보존되는 내용이 다릅니다.

| 기능            | CLAUDE.md | 출력 스타일        | `systemPrompt`과 함께 추가 | 사용자 정의 `systemPrompt` |
| ------------- | --------- | ------------- | --------------------- | --------------------- |
| **지속성**       | 프로젝트별 파일  | 파일로 저장        | 세션만                   | 세션만                   |
| **재사용성**      | 프로젝트별     | 프로젝트 전체       | 코드 중복                 | 코드 중복                 |
| **관리**        | 파일 시스템    | CLI + 파일      | 코드에서                  | 코드에서                  |
| **기본 도구**     | 유지됨       | 유지됨           | 유지됨                   | 손실됨(포함되지 않은 경우)       |
| **기본 제공 안전**  | 유지됨       | 유지됨           | 유지됨                   | 추가해야 함                |
| **환경 컨텍스트**   | 자동        | 자동            | 자동                    | 제공해야 함                |
| **사용자 정의 수준** | 추가만       | 기본값 바꾸기 또는 확장 | 추가만                   | 완전 제어                 |
| **버전 제어**     | 프로젝트와 함께  | 예             | 코드와 함께                | 코드와 함께                |
| **범위**        | 프로젝트별     | 사용자 또는 프로젝트   | 코드 세션                 | 코드 세션                 |

"추가와 함께"는 TypeScript에서 `systemPrompt: { type: "preset", preset: "claude_code", append: "..." }`를 사용하거나 Python에서 `system_prompt={"type": "preset", "preset": "claude_code", "append": "..."}`를 사용하는 것을 의미합니다. CLAUDE.md는 시스템 프롬프트 자체를 변경하지 않습니다. SDK는 프로젝트 컨텍스트로 대화에 내용을 주입합니다.

## 사용 사례 및 모범 사례

### CLAUDE.md를 사용할 때

CLAUDE.md는 세션에서 사용하는 시스템 프롬프트와 관계없이 프로젝트의 모든 세션에 적용되어야 하는 지침에 사용합니다: 코딩 표준, 일반적인 명령, 아키텍처 컨텍스트, 팀 규칙. CLAUDE.md는 저장소에 커밋되므로 설명하는 코드와 동기화된 상태를 유지합니다. 전체 지침은 [CLAUDE.md에 추가할 때](/ko/memory#when-to-add-to-claude-md)를 참조하십시오.

CLAUDE.md 파일은 `project` 설정 소스가 활성화될 때 로드되며, 이는 기본 `query()` 옵션에 대해 활성화됩니다. TypeScript에서 `settingSources`를 명시적으로 설정하거나 Python에서 `setting_sources`를 명시적으로 설정하는 경우, 프로젝트 수준 CLAUDE.md 로드를 유지하기 위해 `'project'`를 포함합니다.

### 출력 스타일을 사용할 때

출력 스타일은 애플리케이션 코드를 변경하지 않고 CLI와 SDK 전체에서 재사용하려는 페르소나를 위한 것입니다. `.claude/output-styles`의 파일로 존재하므로 동일한 페르소나는 CLI의 `/config`에서 그리고 일치하는 설정 소스를 로드하는 모든 SDK 세션에서 사용할 수 있습니다.

**최적의 용도:**

* 세션 전체에서 지속적인 동작 변경
* 팀 공유 구성
* 코드 검토자, 데이터 과학자 또는 DevOps 어시스턴트와 같은 전문화된 어시스턴트
* 버전 관리가 필요한 복잡한 프롬프트 수정

**예제:**

* 전용 SQL 최적화 어시스턴트 생성
* 보안 중심 코드 검토자 구축
* 특정 교육학을 가진 교육 어시스턴트 개발

### `systemPrompt`과 함께 추가를 사용할 때

`claude_code` 프리셋이 이미 제품에 맞고 추가 지침만 계층화하면 되는 경우 `append`를 사용합니다. 프리셋의 도구 지침, 안전 규칙, 코딩 규칙을 다시 구현하지 않고도 유지합니다.

**최적의 용도:**

* 특정 코딩 표준 또는 선호도 추가
* 출력 형식 사용자 정의
* 도메인별 지식 추가
* 응답 상세도 수정
* 도구 지침을 잃지 않고 Claude Code의 기본 동작 향상

### 사용자 정의 `systemPrompt`를 사용할 때

[시작점 결정](#decide-on-a-starting-point)에 설명된 대로 에이전트의 표면, 정체성 또는 권한 모델이 Claude Code의 것과 다른 경우 사용자 정의 프롬프트를 사용합니다. 에이전트가 필요한 도구 지침 및 안전 규칙을 포함하여 전체 지침 집합을 정의합니다.

**최적의 용도:**

* Claude의 동작에 대한 완전한 제어
* 전문화된 단일 세션 작업
* 새로운 프롬프트 전략 테스트
* 기본 도구가 필요하지 않은 상황
* 고유한 동작을 가진 전문화된 에이전트 구축

## 방식 결합

이러한 방식들은 구성됩니다. 지속적인 출력 스타일 또는 CLAUDE.md는 장기적인 동작을 설정하고, `append`는 저장된 구성을 건드리지 않으면서 세션별 지침을 그 위에 계층화합니다.

### 출력 스타일과 세션별 추가 결합

아래 예제는 Code Reviewer 출력 스타일이 이미 활성화되어 있다고 가정합니다. `append` 블록은 세션별 초점 영역을 페르소나 위에 계층화하므로, 단일 검토 세션이 저장된 출력 스타일을 변경하지 않으면서 OAuth 및 토큰 저장소에 우선순위를 지정할 수 있습니다:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  // Assuming "Code Reviewer" output style is active (via /config or settings)
  // Add session-specific focus areas
  const messages = [];

  for await (const message of query({
    prompt: "Review this authentication module",
    options: {
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: `
          For this review, prioritize:
          - OAuth 2.0 compliance
          - Token storage security
          - Session management
        `
      }
    }
  })) {
    messages.push(message);
  }
  ```

  ```python Python theme={null}
  from claude_agent_sdk import query, ClaudeAgentOptions

  # Assuming "Code Reviewer" output style is active (via /config or settings)
  # Add session-specific focus areas
  messages = []

  async for message in query(
      prompt="Review this authentication module",
      options=ClaudeAgentOptions(
          system_prompt={
              "type": "preset",
              "preset": "claude_code",
              "append": """
              For this review, prioritize:
              - OAuth 2.0 compliance
              - Token storage security
              - Session management
              """,
          }
      ),
  ):
      messages.append(message)
  ```
</CodeGroup>

## 참고 항목

* [출력 스타일](/ko/output-styles): CLI용 출력 스타일을 생성, 관리 및 공유합니다. 파일 형식 및 저장 위치를 포함합니다.
* [Claude가 프로젝트를 기억하는 방식](/ko/memory): CLAUDE.md에 무엇을 넣을지, 어디에 배치할지, 효과적인 프로젝트 지침을 작성하는 방법
* [TypeScript SDK 참조](/ko/agent-sdk/typescript): `systemPrompt`, `settingSources`, `outputStyle`을 포함한 전체 `Options` 타입
* [Python SDK 참조](/ko/agent-sdk/python): `system_prompt` 및 `setting_sources`를 포함한 전체 `ClaudeAgentOptions` 타입
* [설정](/ko/settings): 출력 스타일 및 기타 구성이 저장되는 위치를 포함한 `settings.json` 참조

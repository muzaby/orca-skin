> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK의 Agent Skills

> Claude Agent SDK를 사용하여 전문화된 기능으로 Claude를 확장하기

## 개요

Agent Skills는 Claude가 관련성이 있을 때 자율적으로 호출하는 전문화된 기능으로 Claude를 확장합니다. Skills는 지침, 설명 및 선택적 지원 리소스를 포함하는 `SKILL.md` 파일로 패키징됩니다.

Skills의 이점, 아키텍처 및 작성 지침을 포함한 포괄적인 정보는 [Agent Skills 개요](https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/overview)를 참조하십시오.

## SDK와 Skills의 작동 방식

Claude Agent SDK를 사용할 때 Skills는 다음과 같이 작동합니다:

1. **파일 시스템 아티팩트로 정의됨**: `.claude/skills/` 디렉토리의 `SKILL.md` 파일로 생성됨
2. **파일 시스템에서 로드됨**: Skills는 `settingSources`(TypeScript) 또는 `setting_sources`(Python)에 의해 관리되는 파일 시스템 위치에서 로드됨
3. **자동으로 발견됨**: 파일 시스템 설정이 로드되면 Skill 메타데이터가 시작 시 사용자 및 프로젝트 디렉토리에서 발견되고, 트리거될 때 전체 콘텐츠가 로드됨
4. **모델에 의해 호출됨**: Claude는 컨텍스트를 기반으로 사용할 시기를 자율적으로 선택합니다
5. **`skills` 옵션을 통해 필터링됨**: 발견된 Skills는 기본적으로 활성화됩니다. 세션에서 사용 가능한 Skills를 제어하려면 Skill 이름 목록, `"all"` 또는 `[]`를 전달하십시오.

프로그래밍 방식으로 정의할 수 있는 subagents와 달리 Skills는 파일 시스템 아티팩트로 생성되어야 합니다. SDK는 Skills를 등록하기 위한 프로그래밍 API를 제공하지 않습니다.

<Note>
  Skills는 파일 시스템 설정 소스를 통해 발견됩니다. 기본 `query()` 옵션을 사용하면 SDK는 사용자 및 프로젝트 소스를 로드하므로 `~/.claude/skills/`, `<cwd>/.claude/skills/` 및 `<cwd>`의 상위 디렉토리부터 저장소 루트까지의 `.claude/skills/`에 있는 Skills를 사용할 수 있습니다. `settingSources`를 명시적으로 설정하는 경우 Skill 발견을 유지하려면 `'user'` 또는 `'project'`를 포함하거나, [`plugins` 옵션](/ko/agent-sdk/plugins)을 사용하여 특정 경로에서 Skills를 로드하십시오.
</Note>

## SDK와 함께 Skills 사용하기

`query()`의 `skills` 옵션을 설정하여 세션에서 사용 가능한 Skills를 제어합니다. 생략하면 발견된 Skills가 활성화되고 Skill 도구를 사용할 수 있으며, 이는 CLI 동작과 일치합니다. 모든 발견된 Skill을 활성화하려면 `"all"`을 전달하고, 특정 Skill만 활성화하려면 Skill 이름 목록을 전달하거나, 모두 비활성화하려면 `[]`를 전달하십시오. `skills`를 설정하면 SDK가 Skill 도구를 자동으로 활성화하므로 `allowedTools`에 나열할 필요가 없습니다.

구성되면 Claude는 파일 시스템에서 Skills를 자동으로 발견하고 사용자의 요청과 관련이 있을 때 호출합니다.

<CodeGroup>
  ```python Python theme={null}
  import asyncio
  from claude_agent_sdk import query, ClaudeAgentOptions


  async def main():
      options = ClaudeAgentOptions(
          cwd="/path/to/project",  # Project with .claude/skills/
          setting_sources=["user", "project"],  # Load Skills from filesystem
          skills="all",  # Enable every discovered Skill
          allowed_tools=["Read", "Write", "Bash"],
      )

      async for message in query(
          prompt="Help me process this PDF document", options=options
      ):
          print(message)


  asyncio.run(main())
  ```

  ```typescript TypeScript theme={null}
  import { query } from "@anthropic-ai/claude-agent-sdk";

  for await (const message of query({
    prompt: "Help me process this PDF document",
    options: {
      cwd: "/path/to/project", // Project with .claude/skills/
      settingSources: ["user", "project"], // Load Skills from filesystem
      skills: "all", // Enable every discovered Skill
      allowedTools: ["Read", "Write", "Bash"]
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

특정 Skills만 활성화하려면 해당 이름을 전달합니다. 이름은 `SKILL.md`의 `name` 필드 또는 Skill의 디렉토리 이름과 일치합니다. 플러그인에서 제공하는 Skills의 경우 `plugin:skill`을 사용합니다.

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(skills=["pdf", "docx"])
  ```

  ```typescript TypeScript theme={null}
  const options = { skills: ["pdf", "docx"] };
  ```
</CodeGroup>

`skills` 옵션은 컨텍스트 필터이지 샌드박스가 아닙니다. 나열되지 않은 Skills는 모델에서 숨겨지고 Skill 도구에 의해 거부되지만, 해당 파일은 디스크에 남아 있으며 Read 및 Bash를 통해 접근할 수 있습니다.

## Skill 위치

Skills는 `settingSources`/`setting_sources` 구성을 기반으로 파일 시스템 디렉토리에서 로드됩니다:

* **프로젝트 Skills** (`.claude/skills/`): git을 통해 팀과 공유 - `setting_sources`에 `"project"`가 포함될 때 로드됨
* **사용자 Skills** (`~/.claude/skills/`): 모든 프로젝트에 걸친 개인 Skills - `setting_sources`에 `"user"`가 포함될 때 로드됨
* **플러그인 Skills**: 설치된 Claude Code 플러그인과 함께 번들됨

## Skills 생성하기

Skills는 YAML frontmatter 및 Markdown 콘텐츠가 포함된 `SKILL.md` 파일을 포함하는 디렉토리로 정의됩니다. `description` 필드는 Claude가 Skill을 호출하는 시기를 결정합니다.

**예제 디렉토리 구조**:

```bash theme={null}
.claude/skills/processing-pdfs/
└── SKILL.md
```

SKILL.md 구조, 다중 파일 Skills 및 예제를 포함한 Skills 생성에 대한 완전한 지침은 다음을 참조하십시오:

* [Claude Code의 Agent Skills](/ko/skills): 생성, 예제 및 문제 해결을 포함한 완전한 가이드
* [Agent Skills 모범 사례](https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices): 작성 지침 및 명명 규칙
* [Agent Skills 쿡북](https://platform.claude.com/cookbook/skills-notebooks-01-skills-introduction): 예제 Skills 및 템플릿

## 도구 제한

<Note>
  SKILL.md의 `allowed-tools` frontmatter 필드는 Claude Code CLI를 직접 사용할 때만 지원됩니다. **SDK를 통해 Skills를 사용할 때는 적용되지 않습니다**.

  SDK를 사용할 때는 쿼리 구성의 주 `allowedTools` 옵션을 통해 도구 접근을 제어합니다.
</Note>

SDK 애플리케이션에서 Skills의 도구 접근을 제어하려면 `allowedTools`를 사용하여 특정 도구를 사전 승인합니다. `canUseTool` 콜백이 없으면 목록에 없는 모든 것이 거부됩니다:

<Note>
  첫 번째 예제의 import 문이 다음 코드 스니펫에서 가정됩니다.
</Note>

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      setting_sources=["user", "project"],  # Load Skills from filesystem
      skills="all",
      allowed_tools=["Read", "Grep", "Glob"],
  )

  async for message in query(prompt="Analyze the codebase structure", options=options):
      print(message)
  ```

  ```typescript TypeScript theme={null}
  for await (const message of query({
    prompt: "Analyze the codebase structure",
    options: {
      settingSources: ["user", "project"], // Load Skills from filesystem
      skills: "all",
      allowedTools: ["Read", "Grep", "Glob"],
      permissionMode: "dontAsk" // Deny anything not in allowedTools
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

## 사용 가능한 Skills 발견하기

SDK 애플리케이션에서 사용 가능한 Skills를 확인하려면 Claude에게 간단히 물어보십시오:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      setting_sources=["user", "project"],  # Load Skills from filesystem
      skills="all",
  )

  async for message in query(prompt="What Skills are available?", options=options):
      print(message)
  ```

  ```typescript TypeScript theme={null}
  for await (const message of query({
    prompt: "What Skills are available?",
    options: {
      settingSources: ["user", "project"], // Load Skills from filesystem
      skills: "all"
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

Claude는 현재 작업 디렉토리 및 설치된 플러그인을 기반으로 사용 가능한 Skills를 나열합니다.

## Skills 테스트하기

설명과 일치하는 질문을 하여 Skills를 테스트합니다:

<CodeGroup>
  ```python Python theme={null}
  options = ClaudeAgentOptions(
      cwd="/path/to/project",
      setting_sources=["user", "project"],  # Load Skills from filesystem
      skills="all",
      allowed_tools=["Read", "Bash"],
  )

  async for message in query(prompt="Extract text from invoice.pdf", options=options):
      print(message)
  ```

  ```typescript TypeScript theme={null}
  for await (const message of query({
    prompt: "Extract text from invoice.pdf",
    options: {
      cwd: "/path/to/project",
      settingSources: ["user", "project"], // Load Skills from filesystem
      skills: "all",
      allowedTools: ["Read", "Bash"]
    }
  })) {
    console.log(message);
  }
  ```
</CodeGroup>

Claude는 설명이 요청과 일치하면 관련 Skill을 자동으로 호출합니다.

## 문제 해결

### Skills를 찾을 수 없음

**settingSources 구성 확인**: Skills는 `user` 및 `project` 설정 소스를 통해 발견됩니다. `settingSources`/`setting_sources`를 명시적으로 설정하고 해당 소스를 생략하면 Skills가 로드되지 않습니다:

<CodeGroup>
  ```python Python theme={null}
  # Skills not loaded: setting_sources excludes user and project
  options = ClaudeAgentOptions(setting_sources=[], skills="all")

  # Skills loaded: user and project sources included
  options = ClaudeAgentOptions(
      setting_sources=["user", "project"],
      skills="all",
  )
  ```

  ```typescript TypeScript theme={null}
  // Skills not loaded: settingSources excludes user and project
  const options = {
    settingSources: [],
    skills: "all"
  };

  // Skills loaded: user and project sources included
  const options = {
    settingSources: ["user", "project"],
    skills: "all"
  };
  ```
</CodeGroup>

`settingSources`/`setting_sources`에 대한 자세한 내용은 [TypeScript SDK 참조](/ko/agent-sdk/typescript#settingsource) 또는 [Python SDK 참조](/ko/agent-sdk/python#settingsource)를 참조하십시오.

**작업 디렉토리 확인**: SDK는 `cwd` 옵션의 `.claude/skills/` 및 저장소 루트까지의 모든 상위 디렉토리에서 Skills를 로드합니다. `cwd`가 `.claude/skills/`를 포함하는 디렉토리를 가리키거나 그 아래에 있으며, 동일한 저장소 내에 있는지 확인하십시오:

<CodeGroup>
  ```python Python theme={null}
  # Ensure your cwd points to the directory containing .claude/skills/
  options = ClaudeAgentOptions(
      cwd="/path/to/project",  # .claude/skills/ here or in a parent directory
      setting_sources=["user", "project"],  # Loads skills from these sources
      skills="all",
  )
  ```

  ```typescript TypeScript theme={null}
  // Ensure your cwd points to the directory containing .claude/skills/
  const options = {
    cwd: "/path/to/project", // .claude/skills/ here or in a parent directory
    settingSources: ["user", "project"], // Loads skills from these sources
    skills: "all"
  };
  ```
</CodeGroup>

위의 "SDK와 함께 Skills 사용하기" 섹션을 참조하여 완전한 패턴을 확인하십시오.

**파일 시스템 위치 확인**:

```bash theme={null}
# Check project Skills
ls .claude/skills/*/SKILL.md

# Check personal Skills
ls ~/.claude/skills/*/SKILL.md
```

### Skill이 사용되지 않음

**`skills` 옵션 확인**: `skills` 목록을 전달한 경우 Skill의 이름이 포함되어 있는지 확인하십시오. `[]`를 전달하면 모든 Skills가 비활성화됩니다.

**설명 확인**: 구체적이고 관련 키워드를 포함하는지 확인하십시오. 효과적인 설명 작성에 대한 지침은 [Agent Skills 모범 사례](https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices#writing-effective-descriptions)를 참조하십시오.

### 추가 문제 해결

일반적인 Skills 문제 해결(YAML 구문, 디버깅 등)은 [Claude Code Skills 문제 해결 섹션](/ko/skills#troubleshooting)을 참조하십시오.

## 관련 문서

### Skills 가이드

* [Claude Code의 Agent Skills](/ko/skills): 생성, 예제 및 문제 해결을 포함한 완전한 Skills 가이드
* [Agent Skills 개요](https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/overview): 개념적 개요, 이점 및 아키텍처
* [Agent Skills 모범 사례](https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices): 효과적인 Skills를 위한 작성 지침
* [Agent Skills 쿡북](https://platform.claude.com/cookbook/skills-notebooks-01-skills-introduction): 예제 Skills 및 템플릿

### SDK 리소스

* [SDK의 Subagents](/ko/agent-sdk/subagents): 프로그래밍 옵션이 있는 유사한 파일 시스템 기반 에이전트
* [SDK의 Slash Commands](/ko/agent-sdk/slash-commands): 사용자 호출 명령
* [SDK 개요](/ko/agent-sdk/overview): 일반 SDK 개념
* [TypeScript SDK 참조](/ko/agent-sdk/typescript): 완전한 API 문서
* [Python SDK 참조](/ko/agent-sdk/python): 완전한 API 문서

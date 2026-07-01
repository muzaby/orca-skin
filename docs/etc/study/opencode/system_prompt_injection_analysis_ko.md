# opencode 시스템 프롬프트 주입 전체 분석

> 대상: `packages/opencode/src/session/*`, `packages/opencode/src/session/llm/request.ts`, `packages/opencode/src/provider/transform.ts`
> 매 LLM 요청마다 어떤 시스템 프롬프트가 **무엇을 / 어떤 방식으로 / 어떤 포맷으로** 주입되는지 정리한다.

---

## 0. 한눈에 보기

```
[LLM 요청 1회]
  ├─ 조립(prompt.ts)          : env + instructions + skills (+ 구조화출력) 를 input.system 배열로
  ├─ 병합(llm/request.ts)     : 베이스 프롬프트 + input.system + user.system 을 순서대로 결합
  ├─ 플러그인 훅              : experimental.chat.system.transform 로 배열 수정 가능
  ├─ 2조각 압축               : [헤더, 나머지 전체] 형태로 재구성 (캐시 최적화)
  ├─ ModelMessage 변환        : 각 조각을 { role: "system", content } 로
  └─ 캐시 breakpoint(transform): 앞쪽 system 2개에 cacheControl ephemeral 부착
```

최종 시스템 프롬프트는 아래 순서로 이어 붙는다 (`llm/request.ts:58-66`):

```ts
const system = [
  [
    ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)), // ① 베이스
    ...input.system,                                                                      // ② 코어
    ...(input.user.system ? [input.user.system] : []),                                    // ③ 유저
  ].filter((x) => x).join("\n"),
]
```

---

## 1. 주입 종류 전체 목록

| # | 종류 | 소스 | 포맷 | 조건 |
|---|------|------|------|------|
| ① | 베이스 프롬프트 (에이전트) | `agent.prompt` | 자유 텍스트 | 에이전트에 prompt 설정 시 |
| ① | 베이스 프롬프트 (모델별) | `system.ts:provider()` → `.txt` | 마크다운/텍스트 | 에이전트 prompt 없을 때 |
| ② | 실행환경(env) | `system.ts:environment()` | `<env>` 태그 블록 | 항상 |
| ② | 프로젝트 references | `system.ts:environment()` | `<available_references>` XML 유사 | reference 존재 시 |
| ② | 지침 파일 (instructions) | `instruction.ts:system()` | `Instructions from: <경로>\n<내용>` | 파일/URL 존재 시 |
| ② | 스킬 목록 (skills) | `system.ts:skills()` | 텍스트 + verbose 스킬 목록 | 스킬 권한 켜짐 |
| ② | 구조화 출력 지시 | `prompt.ts:STRUCTURED_OUTPUT_SYSTEM_PROMPT` | 자유 텍스트 | format=json_schema |
| ③ | 유저 시스템 프롬프트 | `user.system` | 자유 텍스트 | 메시지에 실렸을 때 |
| — | 플러그인 변형 | `experimental.chat.system.transform` | 배열 in-place 수정 | 플러그인 등록 시 |

> 참고: **리마인더(`reminders.ts`)** 와 **MAX_STEPS**(`prompt/max-steps.txt`)는 system 이 아니라
> **합성 user/assistant 메시지**로 주입되므로 시스템 프롬프트 범주에서 제외한다(§6 참고).

---

## 2. ① 베이스 프롬프트 (택일)

`llm/request.ts:60` 에서 **에이전트 커스텀 프롬프트가 있으면 그것만**, 없으면 **모델별 기본 프롬프트**를 사용한다 (둘은 배타적).

### 2.1 에이전트 커스텀 프롬프트
- 소스: `input.agent.prompt`
- 커스텀 에이전트 정의에 지정된 자유 텍스트를 그대로 사용.

### 2.2 모델별 기본 프롬프트 — `system.ts:25 provider()`
모델 API ID로 `.txt` 파일을 선택 (`session/prompt/*.txt`):

```ts
if (id.includes("gpt-4") || id.includes("o1") || id.includes("o3")) return [PROMPT_BEAST]
if (id.includes("gpt")) return id.includes("codex") ? [PROMPT_CODEX] : [PROMPT_GPT]
if (id.includes("gemini-")) return [PROMPT_GEMINI]
if (id.includes("claude"))  return [PROMPT_ANTHROPIC]
if (id.includes("trinity")) return [PROMPT_TRINITY]
if (id.includes("kimi"))    return [PROMPT_KIMI]
return [PROMPT_DEFAULT]
```

| 파일 | 대상 모델 |
|------|-----------|
| `anthropic.txt` | claude |
| `beast.txt` | gpt-4 / o1 / o3 |
| `gpt.txt` | 그 외 gpt |
| `codex.txt` | gpt codex |
| `gemini.txt` | gemini-* |
| `trinity.txt` | trinity |
| `kimi.txt` | kimi |
| `default.txt` | 그 외 전부 |

이 파일들이 에이전트 정체성·도구 사용 규칙 등 핵심 지시를 담은 **본문**이며, 가장 앞(헤더)에 위치한다.

---

## 3. ② 코어 3종 — `input.system` (`prompt.ts:1309-1317`)

매 스텝마다 세 소스를 병렬(`Effect.all`)로 만들어 배열로 합친다:

```ts
const [skills, env, instructions, modelMsgs] = yield* Effect.all([
  sys.skills(agent),
  sys.environment(model),
  instruction.system().pipe(Effect.orDie),
  MessageV2.toModelMessagesEffect(msgs, model),
])
const system = [...env, ...instructions, ...(skills ? [skills] : [])]
if (format.type === "json_schema") system.push(STRUCTURED_OUTPUT_SYSTEM_PROMPT)
```

### 3.1 실행환경 env — `system.ts:55 environment()`
런타임 상태(`InstanceState.context`)를 **호출 시점에 동적으로** 읽어 `<env>` 태그 블록으로 만든다:

```
You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}
Here is some useful information about the environment you are running in:
<env>
  Working directory: ${ctx.directory}
  Workspace root folder: ${ctx.worktree}
  Is directory a git repo: ${ctx.project.vcs === "git" ? "yes" : "no"}
  Platform: ${process.platform}
  Today's date: ${new Date().toDateString()}
</env>
```

- 정적 상수가 아니라 매 요청마다 재생성 → 디렉토리 이동/날짜 변화 반영.
- 값: 모델 ID, 작업 디렉토리, worktree 루트, git 여부, OS platform, 오늘 날짜.

**프로젝트 references** (있을 때만 두 번째 배열 요소로 추가):
```
Project references provide additional directories that can be accessed when relevant.
<available_references>
  <reference>
    <name>...</name>
    <path>...</path>
    <description>...</description>   # description 있을 때만
  </reference>
  ...
</available_references>
```
- `Reference.Service.list()` 결과 중 `description !== undefined` 만 필터, 이름순 정렬.
- 플러그인 부팅(`PluginBoot.wait()`) 완료 후 조회.

### 3.2 지침 파일 instructions — `instruction.ts:155 system()`
프로젝트/글로벌 지침 파일과 원격 URL을 읽어 텍스트 조각 배열로 반환. 포맷은 조각마다:

```
Instructions from: <절대경로 또는 URL>
<파일/응답 내용>
```

수집 대상 (`systemPaths()` + URL):
- **글로벌**: `~/.config/opencode/AGENTS.md`, `~/.claude/CLAUDE.md`
  - (`disableClaudeCodePrompt` 플래그면 CLAUDE.md 제외)
  - 존재하는 첫 파일 하나만 (`break`)
- **프로젝트**: `AGENTS.md` → `CLAUDE.md` → `CONTEXT.md`(deprecated) 순으로 `directory`→`worktree` 상향 탐색, **첫 매치 파일군만** 채택 (조상마다 중첩 방지)
  - `OPENCODE_DISABLE_PROJECT_CONFIG` 플래그면 프로젝트 탐색 생략
- **설정 `config.instructions`**:
  - 로컬 경로/글로브 → 매칭 파일 모두 추가 (`~/` 는 홈으로 확장)
  - `http(s)://` URL → 5초 타임아웃 fetch, 실패 시 빈 문자열
- 파일 읽기 동시성 8, URL fetch 동시성 4. 내용이 빈 조각은 제외.

### 3.3 스킬 skills — `system.ts:94 skills()`
```
Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
<Skill.fmt(list, { verbose: true })>
```
- 에이전트 권한에서 `skill` 이 disabled 면 `undefined` 반환(주입 안 됨).
- `skill.available(agent)` 로 사용 가능 목록을 받아 **verbose 포맷**으로 나열.
- 주석: 시스템 프롬프트에는 verbose, 도구 설명에는 간략 버전을 쓰는 게 흡수율이 좋다고 명시.

### 3.4 구조화 출력 지시 — `prompt.ts:78 / 1317`
유저 메시지 포맷이 `json_schema` 일 때만 push:
```
IMPORTANT: The user has requested structured output. You MUST use the StructuredOutput tool
to provide your final response. Do NOT respond with plain text - you MUST call the
StructuredOutput tool with your answer formatted according to the schema.
```

---

## 4. ③ 유저 시스템 프롬프트 + 병합/변형

### 4.1 유저 프롬프트
- `input.user.system` — 해당 메시지에 실린 사용자 지정 시스템 프롬프트 (있을 때만, 가장 뒤).

### 4.2 병합 (`llm/request.ts:58-66`)
①+②+③ 을 순서대로 이어 `\n` 으로 join 하여 **초기 1요소 배열**로 만든다.

### 4.3 플러그인 훅 (`request.ts:69-73`)
```ts
yield* input.plugin.trigger("experimental.chat.system.transform",
  { sessionID, model }, { system })
```
- 플러그인이 `system` 배열을 in-place로 수정 가능 (조각 추가/변경).

### 4.4 2조각 압축 (`request.ts:74-78`)
```ts
if (system.length > 2 && system[0] === header) {
  const rest = system.slice(1)
  system.length = 0
  system.push(header, rest.join("\n"))   // [헤더, 나머지 전체]
}
```
- 플러그인이 조각을 늘렸어도 **헤더 1개 + 나머지 합친 1개**의 2요소로 재정리.
- 목적: 뒤(§5)의 캐시 breakpoint 가 앞쪽 system 2개에만 붙으므로, 캐시 히트 극대화.

---

## 5. ModelMessage 변환 & 캐싱

### 5.1 system[] → 메시지 (`request.ts:99-112`)
- **OpenAI OAuth** (`isOpenaiOauth`): system 을 메시지가 아니라 `options.instructions = system.join("\n")` 로 전달.
- **워크플로우/그 외**: 각 조각을 `{ role: "system", content: x }` ModelMessage 로 만들어 대화 메시지 앞에 붙임.

### 5.2 캐시 breakpoint (`provider/transform.ts:323 applyCaching()`)
```ts
const system = msgs.filter(m => m.role === "system").slice(0, 2)   // 앞쪽 system 2개
const final  = msgs.filter(m => m.role !== "system").slice(-2)     // 마지막 대화 2개
```
- 선택된 메시지에 provider별 캐시 옵션 부착:
  - anthropic / openrouter / alibaba: `cacheControl: { type: "ephemeral" }`
  - bedrock: `cachePoint: { type: "default" }`
  - openaiCompatible: `cache_control: { type: "ephemeral" }`
  - copilot: `copilot_cache_control: { type: "ephemeral" }`
- anthropic/bedrock 은 **메시지 레벨** 옵션, 그 외는 마지막 content 파트 레벨에 부착.
- §4.4 의 2조각 압축이 여기서 "앞쪽 system 2개"에 정확히 대응 → 베이스+코어가 캐시 경계 안에 들어감.

---

## 6. 시스템 프롬프트가 아닌 인접 주입 (구분용)

| 주입 | 위치 | 실제 role | 비고 |
|------|------|-----------|------|
| MAX_STEPS | `prompt.ts:1325` | `assistant` (합성) | 마지막 스텝일 때만, 대화 메시지로 |
| 리마인더 | `reminders.ts` | `user`/`assistant` 파트 (`synthetic:true`) | plan 모드 전환 등 상황별 |

이들은 role 이 system 이 아니므로 시스템 프롬프트 캐시/구성과 별개다.

---

## 7. 전체 순서 요약

```
① 베이스        agent.prompt  또는  모델별 *.txt         (헤더)
② env           <env> 블록 (+ <available_references>)
② instructions  Instructions from: <경로>\n<내용>  (다수)
② skills        스킬 안내 + verbose 목록
② 구조화출력    (json_schema 일 때만)
③ user.system   메시지 지정 프롬프트
─ 플러그인 훅으로 배열 수정 →  [헤더, 나머지 전체] 2조각 압축
─ role:"system" ModelMessage 로 변환 (OpenAI OAuth 은 instructions 필드)
─ 앞쪽 system 2개에 provider별 cacheControl 부착
```

### 참여 파일
- `session/system.ts` — env / skills / 모델별 베이스 선택
- `session/instruction.ts` — AGENTS.md·CLAUDE.md·config.instructions·URL 수집
- `session/prompt.ts` — 코어 3종 조립, 구조화출력·MAX_STEPS
- `session/llm/request.ts` — 최종 병합·플러그인 훅·2조각 압축·ModelMessage 변환
- `provider/transform.ts` — 캐시 breakpoint 부착

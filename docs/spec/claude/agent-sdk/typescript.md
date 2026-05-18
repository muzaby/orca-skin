> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Agent SDK 참조 - TypeScript

> TypeScript Agent SDK의 완전한 API 참조로, 모든 함수, 타입 및 인터페이스를 포함합니다.

<script src="/components/typescript-sdk-type-links.js" defer />

## 설치

```bash theme={null}
npm install @anthropic-ai/claude-agent-sdk
```

<Note>
  SDK는 선택적 종속성으로 플랫폼용 네이티브 Claude Code 바이너리를 번들로 제공합니다(예: `@anthropic-ai/claude-agent-sdk-darwin-arm64`). Claude Code를 별도로 설치할 필요가 없습니다. 패키지 관리자가 선택적 종속성을 건너뛰면 SDK는 `Native CLI binary for <platform> not found` 오류를 발생시킵니다. 이 경우 [`pathToClaudeCodeExecutable`](#options)을 별도로 설치된 `claude` 바이너리로 설정하세요.
</Note>

## 함수

### `query()`

Claude Code와 상호작용하기 위한 주요 함수입니다. 메시지가 도착할 때 스트리밍하는 비동기 생성기를 만듭니다.

```typescript theme={null}
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

#### 매개변수

| 매개변수      | 타입                                                               | 설명                                      |
| :-------- | :--------------------------------------------------------------- | :-------------------------------------- |
| `prompt`  | `string \| AsyncIterable<`[`SDKUserMessage`](#sdkusermessage)`>` | 문자열 또는 스트리밍 모드용 비동기 반복 가능 객체로서의 입력 프롬프트 |
| `options` | [`Options`](#options)                                            | 선택적 구성 객체 (아래 Options 타입 참조)            |

#### 반환값

[`Query`](#query-object) 객체를 반환하며, 이는 추가 메서드를 포함하는 `AsyncGenerator<`[`SDKMessage`](#sdkmessage)`, void>`를 확장합니다.

### `startup()`

프롬프트를 사용할 수 있기 전에 CLI 서브프로세스를 생성하고 초기화 핸드셰이크를 완료하여 미리 준비합니다. 반환된 [`WarmQuery`](#warmquery) 핸들은 나중에 프롬프트를 수락하고 이미 준비된 프로세스에 작성하므로, 첫 번째 `query()` 호출은 서브프로세스 생성 및 초기화 비용을 지불하지 않고 해결됩니다.

```typescript theme={null}
function startup(params?: {
  options?: Options;
  initializeTimeoutMs?: number;
}): Promise<WarmQuery>;
```

#### 매개변수

| 매개변수                  | 타입                    | 설명                                                                                       |
| :-------------------- | :-------------------- | :--------------------------------------------------------------------------------------- |
| `options`             | [`Options`](#options) | 선택적 구성 객체입니다. `query()`의 `options` 매개변수와 동일합니다                                           |
| `initializeTimeoutMs` | `number`              | 서브프로세스 초기화를 기다릴 최대 시간(밀리초)입니다. 기본값은 `60000`입니다. 초기화가 시간 내에 완료되지 않으면 프로미스는 타임아웃 오류로 거부됩니다 |

#### 반환값

서브프로세스가 생성되고 초기화 핸드셰이크를 완료하면 해결되는 `Promise<`[`WarmQuery`](#warmquery)`>`를 반환합니다.

#### 예제

`startup()`을 조기에 호출합니다(예: 애플리케이션 부팅 시). 그런 다음 프롬프트가 준비되면 반환된 핸들에서 `.query()`를 호출합니다. 이렇게 하면 서브프로세스 생성 및 초기화가 중요 경로에서 벗어납니다.

```typescript theme={null}
import { startup } from "@anthropic-ai/claude-agent-sdk";

// 시작 비용을 미리 지불합니다
const warm = await startup({ options: { maxTurns: 3 } });

// 나중에 프롬프트가 준비되면 이것은 즉시입니다
for await (const message of warm.query("What files are here?")) {
  console.log(message);
}
```

### `tool()`

SDK MCP 서버와 함께 사용하기 위한 타입 안전 MCP 도구 정의를 만듭니다.

```typescript theme={null}
function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations }
): SdkMcpToolDefinition<Schema>;
```

#### 매개변수

| 매개변수          | 타입                                                                | 설명                                              |
| :------------ | :---------------------------------------------------------------- | :---------------------------------------------- |
| `name`        | `string`                                                          | 도구의 이름                                          |
| `description` | `string`                                                          | 도구가 수행하는 작업에 대한 설명                              |
| `inputSchema` | `Schema extends AnyZodRawShape`                                   | 도구의 입력 매개변수를 정의하는 Zod 스키마 (Zod 3 및 Zod 4 모두 지원) |
| `handler`     | `(args, extra) => Promise<`[`CallToolResult`](#calltoolresult)`>` | 도구 로직을 실행하는 비동기 함수                              |
| `extras`      | `{ annotations?: `[`ToolAnnotations`](#toolannotations)` }`       | 클라이언트에 동작 힌트를 제공하는 선택적 MCP 도구 주석                |

#### `ToolAnnotations`

`@modelcontextprotocol/sdk/types.js`에서 다시 내보냅니다. 모든 필드는 선택적 힌트입니다. 클라이언트는 보안 결정을 위해 이들을 신뢰해서는 안 됩니다.

| 필드                | 타입        | 기본값         | 설명                                                                            |
| :---------------- | :-------- | :---------- | :---------------------------------------------------------------------------- |
| `title`           | `string`  | `undefined` | 도구의 사람이 읽을 수 있는 제목                                                            |
| `readOnlyHint`    | `boolean` | `false`     | `true`이면 도구는 환경을 수정하지 않습니다                                                    |
| `destructiveHint` | `boolean` | `true`      | `true`이면 도구는 파괴적인 업데이트를 수행할 수 있습니다 (`readOnlyHint`가 `false`일 때만 의미 있음)        |
| `idempotentHint`  | `boolean` | `false`     | `true`이면 동일한 인수로 반복 호출해도 추가 효과가 없습니다 (`readOnlyHint`가 `false`일 때만 의미 있음)      |
| `openWorldHint`   | `boolean` | `true`      | `true`이면 도구는 외부 엔티티와 상호작용합니다 (예: 웹 검색). `false`이면 도구의 도메인은 폐쇄적입니다 (예: 메모리 도구) |

```typescript theme={null}
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchTool = tool(
  "search",
  "Search the web",
  { query: z.string() },
  async ({ query }) => {
    return { content: [{ type: "text", text: `Results for: ${query}` }] };
  },
  { annotations: { readOnlyHint: true, openWorldHint: true } }
);
```

### `createSdkMcpServer()`

애플리케이션과 동일한 프로세스에서 실행되는 MCP 서버 인스턴스를 만듭니다.

```typescript theme={null}
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance;
```

#### 매개변수

| 매개변수              | 타입                            | 설명                              |
| :---------------- | :---------------------------- | :------------------------------ |
| `options.name`    | `string`                      | MCP 서버의 이름                      |
| `options.version` | `string`                      | 선택적 버전 문자열                      |
| `options.tools`   | `Array<SdkMcpToolDefinition>` | [`tool()`](#tool)로 만든 도구 정의의 배열 |

### `listSessions()`

가벼운 메타데이터를 포함한 과거 세션을 발견하고 나열합니다. 프로젝트 디렉토리별로 필터링하거나 모든 프로젝트에서 세션을 나열합니다.

```typescript theme={null}
function listSessions(options?: ListSessionsOptions): Promise<SDKSessionInfo[]>;
```

#### 매개변수

| 매개변수                       | 타입        | 기본값         | 설명                                                |
| :------------------------- | :-------- | :---------- | :------------------------------------------------ |
| `options.dir`              | `string`  | `undefined` | 세션을 나열할 디렉토리입니다. 생략하면 모든 프로젝트에서 세션을 반환합니다         |
| `options.limit`            | `number`  | `undefined` | 반환할 최대 세션 수                                       |
| `options.includeWorktrees` | `boolean` | `true`      | `dir`이 git 저장소 내에 있을 때 모든 worktree 경로에서 세션을 포함합니다 |

#### 반환 타입: `SDKSessionInfo`

| 속성             | 타입                    | 설명                                                |
| :------------- | :-------------------- | :------------------------------------------------ |
| `sessionId`    | `string`              | 고유 세션 식별자 (UUID)                                  |
| `summary`      | `string`              | 표시 제목: 사용자 정의 제목, 자동 생성된 요약 또는 첫 번째 프롬프트          |
| `lastModified` | `number`              | 에포크 이후 밀리초 단위의 마지막 수정 시간                          |
| `fileSize`     | `number \| undefined` | 세션 파일 크기(바이트)입니다. 로컬 JSONL 저장소에만 채워집니다            |
| `customTitle`  | `string \| undefined` | 사용자가 설정한 세션 제목 (`/rename`을 통해)                    |
| `firstPrompt`  | `string \| undefined` | 세션의 첫 번째 의미 있는 사용자 프롬프트                           |
| `gitBranch`    | `string \| undefined` | 세션 끝의 git 분기                                      |
| `cwd`          | `string \| undefined` | 세션의 작업 디렉토리                                       |
| `tag`          | `string \| undefined` | 사용자가 설정한 세션 태그 ([`tagSession()`](#tagsession) 참조) |
| `createdAt`    | `number \| undefined` | 첫 번째 항목의 타임스탬프에서 에포크 이후 밀리초 단위의 생성 시간             |

#### 예제

프로젝트의 10개 최신 세션을 인쇄합니다. 결과는 `lastModified` 내림차순으로 정렬되므로 첫 번째 항목이 가장 최신입니다. 모든 프로젝트에서 검색하려면 `dir`을 생략합니다.

```typescript theme={null}
import { listSessions } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({ dir: "/path/to/project", limit: 10 });

for (const session of sessions) {
  console.log(`${session.summary} (${session.sessionId})`);
}
```

### `getSessionMessages()`

과거 세션 트랜스크립트에서 사용자 및 어시스턴트 메시지를 읽습니다.

```typescript theme={null}
function getSessionMessages(
  sessionId: string,
  options?: GetSessionMessagesOptions
): Promise<SessionMessage[]>;
```

#### 매개변수

| 매개변수             | 타입       | 기본값         | 설명                                                |
| :--------------- | :------- | :---------- | :------------------------------------------------ |
| `sessionId`      | `string` | 필수          | 읽을 세션 UUID ([`listSessions()`](#listsessions) 참조) |
| `options.dir`    | `string` | `undefined` | 세션을 찾을 프로젝트 디렉토리입니다. 생략하면 모든 프로젝트를 검색합니다          |
| `options.limit`  | `number` | `undefined` | 반환할 최대 메시지 수                                      |
| `options.offset` | `number` | `undefined` | 시작 부분에서 건너뛸 메시지 수                                 |

#### 반환 타입: `SessionMessage`

| 속성                   | 타입                      | 설명                  |
| :------------------- | :---------------------- | :------------------ |
| `type`               | `"user" \| "assistant"` | 메시지 역할              |
| `uuid`               | `string`                | 고유 메시지 식별자          |
| `session_id`         | `string`                | 이 메시지가 속한 세션        |
| `message`            | `unknown`               | 트랜스크립트의 원본 메시지 페이로드 |
| `parent_tool_use_id` | `null`                  | 예약됨                 |

#### 예제

```typescript theme={null}
import { listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const [latest] = await listSessions({ dir: "/path/to/project", limit: 1 });

if (latest) {
  const messages = await getSessionMessages(latest.sessionId, {
    dir: "/path/to/project",
    limit: 20
  });

  for (const msg of messages) {
    console.log(`[${msg.type}] ${msg.uuid}`);
  }
}
```

### `getSessionInfo()`

전체 프로젝트 디렉토리를 스캔하지 않고 ID로 단일 세션의 메타데이터를 읽습니다.

```typescript theme={null}
function getSessionInfo(
  sessionId: string,
  options?: GetSessionInfoOptions
): Promise<SDKSessionInfo | undefined>;
```

#### 매개변수

| 매개변수          | 타입       | 기본값         | 설명                                        |
| :------------ | :------- | :---------- | :---------------------------------------- |
| `sessionId`   | `string` | 필수          | 조회할 세션의 UUID                              |
| `options.dir` | `string` | `undefined` | 프로젝트 디렉토리 경로입니다. 생략하면 모든 프로젝트 디렉토리를 검색합니다 |

[`SDKSessionInfo`](#return-type-sdksessioninfo)를 반환하거나, 세션을 찾을 수 없으면 `undefined`를 반환합니다.

### `renameSession()`

사용자 정의 제목 항목을 추가하여 세션의 이름을 바꿉니다. 반복 호출은 안전합니다. 가장 최신 제목이 우선합니다.

```typescript theme={null}
function renameSession(
  sessionId: string,
  title: string,
  options?: SessionMutationOptions
): Promise<void>;
```

#### 매개변수

| 매개변수          | 타입       | 기본값         | 설명                                        |
| :------------ | :------- | :---------- | :---------------------------------------- |
| `sessionId`   | `string` | 필수          | 이름을 바꿀 세션의 UUID                           |
| `title`       | `string` | 필수          | 새 제목입니다. 공백을 제거한 후 비어 있지 않아야 합니다          |
| `options.dir` | `string` | `undefined` | 프로젝트 디렉토리 경로입니다. 생략하면 모든 프로젝트 디렉토리를 검색합니다 |

### `tagSession()`

세션에 태그를 지정합니다. `null`을 전달하여 태그를 지웁니다. 반복 호출은 안전합니다. 가장 최신 태그가 우선합니다.

```typescript theme={null}
function tagSession(
  sessionId: string,
  tag: string | null,
  options?: SessionMutationOptions
): Promise<void>;
```

#### 매개변수

| 매개변수          | 타입               | 기본값         | 설명                                        |
| :------------ | :--------------- | :---------- | :---------------------------------------- |
| `sessionId`   | `string`         | 필수          | 태그를 지정할 세션의 UUID                          |
| `tag`         | `string \| null` | 필수          | 태그 문자열 또는 지우려면 `null`                     |
| `options.dir` | `string`         | `undefined` | 프로젝트 디렉토리 경로입니다. 생략하면 모든 프로젝트 디렉토리를 검색합니다 |

### `resolveSettings()`

CLI와 동일한 병합 엔진을 사용하여 주어진 디렉토리에 대한 효과적인 Claude Code 설정을 해결하며, Claude CLI를 생성하지 않습니다. `query()` 호출을 호출하기 전에 어떤 구성을 볼 수 있는지 검사하는 데 사용합니다.

<Note>
  이 함수는 알파 버전이며 안정화 전에 API가 변경될 수 있습니다. CLI 시작과의 패리티를 위해 macOS plist 및 Windows HKLM/HKCU를 포함한 MDM 소스를 읽지만, 관리자가 구성한 `policyHelper` 서브프로세스를 실행하지 않습니다. `permissions.defaultMode` 필드는 프로젝트 설정을 포함한 모든 계층에서 그대로 반환됩니다. CLI가 권한 상승 모드를 적용하기 전에 적용하는 신뢰 필터는 적용되지 않습니다.
</Note>

```typescript theme={null}
function resolveSettings(
  options?: ResolveSettingsOptions
): Promise<ResolvedSettings>;
```

#### 매개변수

`resolveSettings()`는 단일 옵션 객체를 수락합니다. 모든 필드는 선택적입니다.

| 매개변수                            | 타입                                    | 기본값             | 설명                                                                             |
| :------------------------------ | :------------------------------------ | :-------------- | :----------------------------------------------------------------------------- |
| `options.cwd`                   | `string`                              | `process.cwd()` | 프로젝트 및 로컬 설정을 상대적으로 해결할 디렉토리                                                   |
| `options.settingSources`        | [`SettingSource`](#settingsource)`[]` | 모든 소스           | 로드할 파일 시스템 소스입니다. 사용자, 프로젝트 및 로컬 설정을 건너뛰려면 `[]`를 전달합니다. 관리 정책 설정은 모든 경우에 로드됩니다 |
| `options.managedSettings`       | `Settings`                            | `undefined`     | 관리 정책 우선순위 수준에서 병합된 제한적 정책 계층 설정입니다. `model`과 같은 제한적이지 않은 키는 자동으로 삭제됩니다        |
| `options.serverManagedSettings` | `Settings`                            | `undefined`     | `/api/claude_code/settings`의 서버 관리 설정 페이로드입니다. 제한적이지 않은 키는 필터링 없이 통과합니다        |

#### 반환 타입: `ResolvedSettings`

`resolveSettings()`는 병합된 설정과 각 키에 기여한 소스를 설명하는 객체를 반환합니다.

| 속성           | 타입                                                  | 설명                                         |
| :----------- | :-------------------------------------------------- | :----------------------------------------- |
| `effective`  | `Settings`                                          | 모든 활성화된 소스를 우선순위 순서로 적용한 후 병합된 설정          |
| `provenance` | `Partial<Record<keyof Settings, ProvenanceEntry>>`  | `effective`의 각 최상위 키에 대해 값을 제공한 소스         |
| `sources`    | `Array<{ source, settings, path?, policyOrigin? }>` | 소스별 원본 설정, 가장 낮은 우선순위에서 가장 높은 우선순위 순서로 정렬됨 |

#### 예제

아래 예제는 프로젝트 디렉토리에 대한 설정을 해결하고 정리 기간을 제어하는 소스를 인쇄합니다.

```typescript theme={null}
import { resolveSettings } from "@anthropic-ai/claude-agent-sdk";

const { effective, provenance } = await resolveSettings({
  cwd: "/path/to/project",
  settingSources: ["user", "project", "local"],
});

console.log(`Cleanup period: ${effective.cleanupPeriodDays} days`);
console.log(`Set by: ${provenance.cleanupPeriodDays?.source}`);
```

## 메시지 타입

### `SDKMessage`

쿼리에서 반환된 모든 가능한 메시지의 합집합 타입입니다.

```typescript theme={null}
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKPluginInstallMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKTaskUpdatedMessage
  | SDKFilesPersistedEvent
  | SDKToolUseSummaryMessage
  | SDKRateLimitEvent
  | SDKPermissionDeniedMessage
  | SDKPromptSuggestionMessage;
```

### `SDKAssistantMessage`

어시스턴트 응답 메시지입니다.

```typescript theme={null}
type SDKAssistantMessage = {
  type: "assistant";
  uuid: UUID;
  session_id: string;
  message: BetaMessage;
  parent_tool_use_id: string | null;
  error?: SDKAssistantMessageError;
};
```

`message` 필드는 Anthropic SDK의 [`BetaMessage`](https://platform.claude.com/docs/ko/api/messages/create)입니다. `id`, `content`, `model`, `stop_reason` 및 `usage`와 같은 필드를 포함합니다.

### `SDKUserMessage`

사용자 입력 메시지입니다.

```typescript theme={null}
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;
  session_id?: string;
  message: MessageParam;
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  shouldQuery?: boolean;
};
```

## 타입

### `Options`

`query()` 함수의 구성 객체입니다.

```typescript theme={null}
type Options = {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agent?: string;
  agents?: Record<string, AgentDefinition>;
  allowDangerouslySkipPermissions?: boolean;
  allowedTools?: string[];
  betas?: SdkBeta[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  debug?: boolean;
  debugFile?: string;
  disallowedTools?: string[];
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  enableFileCheckpointing?: boolean;
  env?: Record<string, string | undefined>;
  executable?: 'bun' | 'deno' | 'node';
  executableArgs?: string[];
  extraArgs?: Record<string, string | null>;
  fallbackModel?: string;
  forkSession?: boolean;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  maxBudgetUsd?: number;
  maxTurns?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
  outputStyle?: string;
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  permissionPromptToolName?: string;
  persistSession?: boolean;
  plugins?: SdkPluginConfig[];
  promptSuggestions?: boolean;
  resume?: string;
  resumeSessionAt?: string;
  sandbox?: SandboxSettings;
  sessionId?: string;
  sessionStore?: SessionStore;
  settings?: string | Settings;
  settingSources?: SettingSource[];
  skills?: string[] | 'all';
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string; excludeDynamicSections?: boolean };
  thinking?: ThinkingConfig;
  toolConfig?: ToolConfig;
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
};
```

### `Query` 객체

`query()` 함수에서 반환된 인터페이스입니다.

```typescript theme={null}
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  applyFlagSettings(settings: { [K in keyof Settings]?: Settings[K] | null }): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  reconnectMcpServer(serverName: string): Promise<void>;
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

### `PermissionMode`

```typescript theme={null}
type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan"
  | "dontAsk"
  | "auto";
```

### `CanUseTool`

도구 사용을 제어하기 위한 사용자 정의 권한 함수 타입입니다.

```typescript theme={null}
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  }
) => Promise<PermissionResult>;
```

### `SandboxSettings`

샌드박스 동작의 구성입니다.

```typescript theme={null}
type SandboxSettings = {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: SandboxNetworkConfig;
  filesystem?: SandboxFilesystemConfig;
  ignoreViolations?: Record<string, string[]>;
};
```

### `SandboxNetworkConfig`

```typescript theme={null}
type SandboxNetworkConfig = {
  allowedDomains?: string[];
  deniedDomains?: string[];
  allowManagedDomainsOnly?: boolean;
  allowLocalBinding?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
};
```

### `SandboxFilesystemConfig`

```typescript theme={null}
type SandboxFilesystemConfig = {
  allowWrite?: string[];
  denyWrite?: string[];
  denyRead?: string[];
};
```

### `ThinkingConfig`

Claude의 사고/추론 동작을 제어합니다.

```typescript theme={null}
type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens?: number }
  | { type: "disabled" };
```

### `McpServerConfig`

MCP 서버의 구성입니다.

```typescript theme={null}
type McpServerConfig =
  | { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "sdk"; name: string; instance: McpServer }
  | { type: "claudeai-proxy"; url: string; id: string };
```

### `AgentDefinition`

프로그래밍 방식으로 정의된 서브에이전트의 구성입니다.

```typescript theme={null}
type AgentDefinition = {
  description: string;
  tools?: string[];
  disallowedTools?: string[];
  prompt: string;
  model?: string;
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  initialPrompt?: string;
  maxTurns?: number;
  background?: boolean;
  memory?: "user" | "project" | "local";
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  permissionMode?: PermissionMode;
};
```

## 참고 항목

* [SDK 개요](/ko/agent-sdk/overview) - 일반 SDK 개념
* [Python SDK 참조](/ko/agent-sdk/python) - Python SDK 문서
* [CLI 참조](/ko/cli-reference) - 명령줄 인터페이스

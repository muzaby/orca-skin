# 4. 핵심 모듈

각 모듈을 **책임 / 입출력 / 의존성** 으로 정리. 파일 경로는 `packages/opencode/src` 기준.

## 4.1 SessionPrompt — 에이전트 루프 (`session/prompt.ts`, 67KB)

- **책임**: 시스템 전체의 오케스트레이터. 사용자 메시지 생성, `runLoop` 구동, 서브태스크
  위임(`handleSubtask`), 압축/오버플로 분기, 제목 생성, 셸 모드, 슬래시 커맨드 처리.
- **입력**: `PromptInput`(`:1576`) — sessionID, 파트(텍스트/파일/agent), 모델, tools 토글,
  format(text|json_schema) 등.
- **출력**: `SessionV1.WithParts` — 최종 assistant 메시지(+파트).
- **의존성**: `Session`(상태), `SessionProcessor`, `Compaction`, `Agent`, `SessionTools`,
  `SessionRunState`, `Permission`, `MCP`, `ToolRegistry`, `Truncate`, `Plugin`.

## 4.2 SessionProcessor — 스트림 처리·툴 디스패치 (`session/processor.ts`, 43KB)

- **책임**: 한 LLM 라운드의 스트림을 소비하며 메시지/파트 상태를 갱신. reasoning/text/tool
  이벤트 처리, 툴콜 상태머신(`pending→running→completed/error`), 둠 루프 감지, 재시도 정책
  적용, 인터럽트/중단 처리.
- **입력**: `Input`(assistantMessage, sessionID, model) → `handle.process(StreamInput)`.
- **출력**: `"continue" | "stop" | "compact"` + 부수효과로 메시지 파트 영속화·이벤트 발행.
- **핵심 상태**: `ctx.toolcalls`(콜ID→진행상태 맵), `ctx.needsCompaction`, `ctx.blocked`,
  `ctx.shouldBreak`(`:78`,`:966`).
- **의존성**: `LLM`(스트림), `Permission`, `Database`, `Image`(첨부 정규화), `EventV2` 버스.

## 4.3 LLM 경계 — 이중 런타임 (`session/llm.ts` + `session/llm/*`)

- **책임**: 프로바이더 호출을 `LLMEvent` 스트림으로 정규화. 네이티브/AI SDK 선택.
- **구성**:
  - `llm.ts:54-58` — `Interface.stream: (StreamInput) => Stream<LLMEvent>`.
  - `native-runtime.ts` — `@opencode-ai/llm` 위의 어댑터. 지원 여부를 런타임에 판정
    (`RuntimeStatus = supported | unsupported{reason}`), 지원 시 직접 스트림 + 자체
    `ToolRuntime.dispatch` 로 툴 실행(`:106-133`).
  - `ai-sdk.ts` — `streamText` 결과를 `LLMEvent` 로 변환하는 어댑터.
  - `request.ts` / `native-request.ts` — 요청 조립(메시지/툴/프로바이더 옵션 변환).
- **입력**: model, provider, auth, messages(`ModelMessage[]`), tools, toolChoice, 샘플링 옵션.
- **출력**: `Stream<LLMEvent>` (reasoning-start/delta/end, text, tool-input-*, tool-call,
  tool-result, finish ...).
- **의존성(하위)**: `@opencode-ai/llm`(`packages/llm`) — 프로바이더 프로토콜 11종, 라우팅,
  인증, 툴 런타임. `ai`(Vercel SDK) — 폴백.

## 4.4 Tool 레이어 (`tool/tool.ts`, `tool/registry.ts`, `tool/*.ts`)

- **책임**: 툴을 정의·등록·모델에게 기술·실행. 내장 13종 + 커스텀(파일 기반) + 플러그인 + MCP.
- **툴 정의**(`tool/tool.ts`): `Tool.Def` = `{ id, description, parameters(Schema), jsonSchema?,
  execute(args, ctx): Effect<ExecuteResult> }`. `Tool.define(id, init)` 가 파서 클로저를 1회
  컴파일하고 실행을 스팬/검증/출력 truncate 로 감싼다(`wrap`, `:97-149`).
- **내장 툴**(`registry.ts:219-236`): `invalid, question, shell, read, glob, grep, edit, write,
  task, fetch(webfetch), todo, search(websearch), skill, patch(apply_patch)`, 그리고 플래그
  기반 `lsp`, `plan`.
- **모델별 툴 선택**(`registry.ts:267-279`): GPT 계열(`gpt-` & non-oss & non-gpt-4)은
  `apply_patch`, 그 외엔 `edit`/`write`. 웹서치는 프로바이더가 지원할 때만.
- **입출력**: `tools({modelID, providerID, agent}) → Tool.Def[]` (에이전트 권한/모델 필터링됨).
- **의존성**: `Permission`, `Truncate`, `Agent`, `Plugin`, `Ripgrep`, `MCP`.

## 4.5 Permission — 권한 게이트 (`permission/index.ts`)

- **책임**: 위험 동작(셸 실행, 파일 쓰기, MCP 호출, 둠 루프 등)에 대한 allow/ask/deny 결정과
  사용자 승인 대기.
- **메커니즘**(`:78-118`): 룰셋 평가 → `allow` 통과, `deny` 면 `DeniedError`, `ask` 면
  **`Deferred` 를 만들어 `pending` 맵에 넣고 이벤트 발행 후 응답을 await** (실질적으로 툴
  실행을 블록). `reply`(`:120-178`)가 `once/always/reject` 로 Deferred 를 해소하며, `always`
  는 같은 패턴의 다른 pending 들도 일괄 승인.
- **입력**: `{ permission, patterns, sessionID, metadata, always, ruleset }`.
- **출력**: `void`(승인) 또는 `DeniedError/RejectedError/CorrectedError`.
- **의존성**: `EventV2` 버스(승인 요청/응답 송수신).

## 4.6 Compaction — 컨텍스트 관리 (`session/compaction.ts`, 21KB)

- **책임**: 컨텍스트 한도 관리. (a) 오버플로 감지, (b) 요약 기반 압축(head 요약 + 최근 tail
  보존), (c) 프루닝(오래된 툴 출력 비우기).
- **핵심 함수**:
  - `isOverflow`(`:178`) — 토큰/모델 기반 오버플로 판정.
  - `select`(`:198-249`) — 보존할 최근 turn 들을 토큰 예산 안에서 선택, 경계 turn 은
    `splitTurn` 으로 부분 보존. 기본 `tail_turns=2`.
  - `prune`(`:253-`) — 뒤에서부터 `PRUNE_PROTECT(40,000)` 토큰 분량의 툴콜은 보호하고 그보다
    오래된 툴 출력은 지워 컨텍스트를 회수.
  - `process`(`:299-`) — 실제 요약 LLM 호출로 압축 메시지 생성.
- **입력**: 메시지 배열, 모델, sessionID. **출력**: 압축 메시지 영속화 + `"stop"/계속`.
- **의존성**: `SessionProcessor`(요약도 한 번의 process 라운드), `Config`, `Token`.

## 4.7 Agent — 에이전트 정의 (`agent/agent.ts`)

- **책임**: 에이전트(=권한+모델+프롬프트+steps 묶음) 정의·조회. 내장 `default`(primary),
  `plan`(편집 금지) 등 + 설정/파일 기반 커스텀.
- **자료구조**(`:35-54`): `Info = { name, mode("subagent"|"primary"|"all"), description,
  permission(Ruleset), model?, steps? }`.
- **의존성**: `Permission`(설정→룰셋 변환), `Config`, `ModelV2`.

## 4.8 Session / Storage / Database (`session/session.ts`, `storage/*`)

- **책임**: 세션·메시지·파트의 CRUD 와 영속화. 세션 메타, 아카이브, fork, revert,
  메시지 v2 이벤트 미러링.
- **영속화 이중화**: `storage/storage.ts`(JSON 파일, 마이그레이션 포함) + `Database`(SQLite).
  메시지는 v2 이벤트로도 미러링(`mirrorAssistant` 분기, processor 전반).
- **의존성**: `FSUtil`, `Git`, `Database`, `EventV2`.

## 4.9 메시지 모델 (`session/message-v2.ts`, `v1/session`)

- **책임**: 메시지/파트 자료구조와 변환. 모델 메시지(`ModelMessage[]`)로의 직렬화
  (`toModelMessagesEffect`), 압축 반영 필터(`filterCompactedEffect`), 최신 메시지 추출
  (`latest`).
- 파트 종류: text / reasoning / tool / file / agent / subtask 등(`SessionV1` 스키마).

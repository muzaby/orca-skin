# 6. 구현 디테일

핵심 자료구조·패턴을, 재구현 가능한 수준으로.

## 6.1 "툴"의 표현 — Effect 기반 정의 + 어댑터 변환

내부 표준은 opencode 자체의 `Tool.Def`(`tool/tool.ts:56-64`):

```ts
export interface Def<Parameters, M> {
  id: string
  description: string
  parameters: Parameters            // Effect Schema (Decoder)
  jsonSchema?: JSONSchema7
  execute(args, ctx: Context): Effect.Effect<ExecuteResult<M>>
  formatValidationError?(error): string
}
```

- `Tool.define(id, init)`(`:152`)이 `wrap`(`:97-149`)으로 실행을 감싼다: **파서 클로저 1회
  컴파일**(`Schema.decodeUnknownEffect` 호이스팅 — "allocates a new closure per call" 주석),
  인자 검증 실패 시 `InvalidArgumentsError`("rewrite the input so it satisfies the schema" —
  모델에게 되돌려줄 프로즈를 메시지로 생산, `:24-34`), 성공 후 출력 자동 truncate.
- `Context`(`:36-47`)는 실행 컨텍스트: `sessionID/messageID/agent/abort/callID/messages` +
  `metadata()`(진행상황 갱신) + `ask()`(권한 요청). 즉 툴은 자기 진행상황을 스트리밍하고
  권한을 물을 수 있다.
- 모델로 보낼 땐 `SessionTools.resolve`(`session/tools.ts`)가 `Tool.Def` → AI SDK `tool({
  description, inputSchema: jsonSchema(schema), execute })` 로 변환하며, execute 안에서
  `EffectBridge.make()`의 `run.promise(Effect)` 로 **Effect↔Promise 경계**를 넘는다(`:80-114`).

> 패턴: **공통 내부 표현(Tool.Def) + 출력 어댑터(AI SDK용/네이티브용)**. 같은 툴 정의가 두
> 런타임 양쪽에 그대로 쓰인다.

## 6.2 레지스트리 — 정적 내장 + 동적 소스 결합

`ToolRegistry`(`tool/registry.ts`)는 4 소스를 합친다:

- **내장**: 배열 리터럴(`:219-236`), 플래그로 조건부 포함(`lsp`, `plan`).
- **커스텀**: 워크스페이스의 `{tool,tools}/*.{js,ts}` 를 글롭 스캔(`:174`).
- **플러그인**: `fromPlugin`(`:114`)이 Zod 스키마 노출을 호환 유지하며 흡수.
- **MCP**: `mcp.tools()`(`session/tools.ts:117-`).

`tools({modelID, providerID, agent})`(`:267`)가 모델·프로바이더·에이전트 권한으로 필터링한 뒤
플러그인 훅(`tool.definition`)으로 설명/스키마를 후처리한다. **레지스트리 패턴 + 필터 파이프라인.**

## 6.3 스트림 이벤트 → 메시지 파트 상태머신

`processor.ts` 의 툴콜은 명시적 상태머신이다. `ctx.toolcalls[callID]` 가 진행을 추적하고,
파트 상태는 `pending → running → completed | error` 로 전이:

- `tool-input-start/delta/end`(`:427-466`) — 인자 스트리밍 누적(`raw` 문자열 이어붙이기).
- `tool-call`(`:468`) — 입력 확정, 상태 `running`(`:503-517`), 둠 루프 검사.
- `tool-result`(`:549`) — 성공 시 출력 정규화(이미지 첨부 리사이즈/누락 표기, `:572-592`)
  후 `completeToolCall`; 실패 시 `failToolCall`.

전이 헬퍼들(`updateToolCall/completeToolCall/failToolCall/settleToolCall`, `:187-246`)이
상태 일관성과 이벤트 발행(v2 미러링)을 캡슐화한다.

## 6.4 루프 제어 신호 — 문자열 유니온으로 흐름 표현

복잡한 제어흐름을 예외가 아니라 **작은 유니온 반환값**으로 표현한다:

- `processor.process()` → `"continue" | "stop" | "compact"`(`processor.ts:1030-1032`).
- `runLoop` 내부 outcome → `"break" | "continue"`(`prompt.ts:1274`,`:1335`,`:1362`,`:1372`).
- 압축 process → `"stop"` 시 루프 break(`prompt.ts:1210`).

→ 가독성 높은 명령형 루프. 디버깅 시 "왜 멈췄나"가 반환값으로 바로 읽힌다.

## 6.5 의존성 주입 — Effect Layer + LayerNode 그래프

서비스는 `Context.Service` 로 선언되고 `Layer.effect` 로 구현되며, 파일 끝에서
`LayerNode.make(layer, [deps...])` 로 의존 노드를 선언한다. 예:

- `permission/index.ts:226` `defaultLayer = layer.pipe(Layer.provide(EventV2Bridge.defaultLayer))`
- `tool/registry.ts:418` `LayerNode.make(layer.pipe(Layer.provide(Ripgrep.defaultLayer)), [...])`
- `session/run-state.ts:154` `LayerNode.make(layer, [BackgroundJob.node, SessionStatus.node])`

부팅 시 이 노드들이 위상 정렬되어 단일 런타임 레이어로 합쳐진다. **컴파일 타임에 의존성이
타입으로 강제**되는 게 핵심 — 서비스를 provide 하지 않으면 타입 에러.

## 6.6 모델별 시스템 프롬프트를 텍스트 리소스로 분리

`session/prompt/*.txt` 를 `import ... from "....txt"` 로 가져온다(예:
`import MAX_STEPS from "../session/prompt/max-steps.txt"`, `prompt.ts:19`). 모델 패밀리별
프롬프트(`anthropic.txt/gpt.txt/gemini.txt/...`), 모드별 프롬프트(`plan-mode.txt`,
`plan-reminder-anthropic.txt`), 상황별 주입(`max-steps.txt`)이 전부 코드가 아닌 리소스로
관리된다. 프롬프트 튜닝이 코드 변경 없이 가능.

## 6.7 메시지/스키마 — Effect Schema 로 런타임 검증 + 타입 도출

세션/메시지/에이전트/권한 모두 `Schema.Struct` 로 정의(`agent/agent.ts:35`,
`SessionV1`/`MessageV2`). 영속화 시 `decodeRoot`(`storage.ts:101`)로 검증하고, 타입은
`Schema.Schema.Type<...>` 로 도출한다. **단일 진실원천(스키마)에서 검증과 타입이 동시 파생** —
저장된 JSON 과 코드 타입의 드리프트를 구조적으로 방지.

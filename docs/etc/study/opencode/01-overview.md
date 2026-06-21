# 1. 개요

## 목적

opencode 는 터미널에서 동작하는 오픈소스 AI 코딩 에이전트다(README: "The open source AI
coding agent."). 파일을 읽고/쓰고, 셸을 실행하고, 코드를 검색하고, 서브에이전트에게 작업을
위임하면서 사용자의 코딩 작업을 자율적으로 수행한다. 단발 실행(`opencode run`), TUI,
서버(`serve`), GitHub/Slack 연동 등 여러 진입 형태를 가진다.

## 기술 스택

- **언어/런타임**: TypeScript, Bun 기반 모노레포(`turbo`, `bun.lock`). 27개 패키지.
- **핵심 패러다임**: [Effect](https://effect.website) — 함수형 이펙트 시스템.
  서비스/레이어(DI), 제너레이터 기반 `Effect.gen`, `Stream`, `Fiber`, `Deferred`,
  `Schema` 가 코드 전반의 골격이다. (`session/session.ts`, `session/prompt.ts` 모두
  `Effect.gen(function* () { ... })` 로 작성됨)
- **LLM 경계**: 두 갈래.
  1. **자체 네이티브 런타임** — `@opencode-ai/llm` (`packages/llm`) 패키지. 프로바이더별
     wire 프로토콜을 직접 구현(`anthropic-messages`, `openai-chat`, `openai-responses`,
     `gemini`, `bedrock-converse`, ...).
  2. **Vercel AI SDK (`ai`)** — `streamText` 기반 폴백 런타임.
  둘 다 동일한 `LLMEvent` 스트림으로 정규화된다 (`session/llm.ts:54-58`).
- **TUI**: 별도 Go 클라이언트(`packages/tui`)가 HTTP 로 서버와 통신.
- **영속화**: JSON 파일 기반 스토리지(`storage/storage.ts`) + SQLite 데이터베이스(`Database`
  서비스, `effect-sqlite-node`).

## 구현 형태 (분류)

**자체 구현 + 부분 프레임워크(LLM 프로토콜 레이어만)**, 그리고 **멀티에이전트**.

- 에이전트 루프, 프롬프트 조립, 툴 레이어, 권한, 압축, 세션/메시지 모델, 영속화는 **전부
  직접 구현**이다. 프레임워크(LangChain/LlamaIndex 류)는 쓰지 않는다.
- Vercel `ai` SDK 는 **LLM 스트리밍/툴콜 프로토콜의 폴백**으로만 쓰인다. 기본 경로는 자체
  네이티브 런타임이고, 네이티브가 해당 프로바이더를 지원하지 못할 때만 AI SDK 로 폴백한다
  (`session/llm.ts:227-281`). 즉 "프레임워크에 위임"이 아니라 "프로토콜 어댑터 한 겹"이다.
  → 이 경계 자체가 의도적 설계 결정이며 5장에서 특장점으로 다룬다.
- **멀티에이전트**: `task` 툴이 서브에이전트 세션을 스폰한다(동기/백그라운드 모두). 메인
  루프(`runLoop`)가 서브태스크를 같은 루프 안에서 위임 처리한다
  (`session/prompt.ts:1197-1200`, `handleSubtask`). 따라서 단일 루프 + 그 위의 오케스트레이션
  계층 구조다. 토폴로지 다이어그램은 2장 참조.

### 코드에서 확인되지 않은 부분 (정직한 고지)

- `packages/llm` 의 라우팅/엔드포인트 세부(`route/executor.ts`, `route/transport`)는 존재만
  확인했고 내부 디테일까지는 본 분석에서 깊게 파고들지 않았다. 본 보고서의 LLM 경계 서술은
  `session/llm/native-runtime.ts`·`native-request.ts` 와 `packages/llm/src/index.ts` 의 공개
  표면을 근거로 한다.

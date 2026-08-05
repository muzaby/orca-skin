# Agent SDK 문서 디렉토리 — 코딩 에이전트용 가이드

이 디렉토리는 **Claude Agent SDK** 공식 문서의 한국어 사양 스냅샷이다. 에이전트가 SDK를 사용하거나 이해해야 할 때의 1차 참고 자료. 모든 문서는 https://code.claude.com/docs/ 에서 영어 원본으로 제공되며, 이곳은 한국어 사본이다.

## 파일 한눈에 (주제별 카테고리)

### 시작하기 (3개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `overview.md` | SDK가 무엇인지, 아키텍처, 기본 제공 도구 표 | [ko](https://code.claude.com/docs/ko/agent-sdk/overview) / [en](https://code.claude.com/docs/en/agent-sdk/overview) |
| `quickstart.md` | 설치, 인증, 첫 에이전트 실행 — 의도적 버그 포함 예제 | [ko](https://code.claude.com/docs/ko/agent-sdk/quickstart) / [en](https://code.claude.com/docs/en/agent-sdk/quickstart) |
| `typescript.md` | TypeScript SDK 전체 API 레퍼런스 (함수, 타입, 메시지, 출력 스키마) | [ko](https://code.claude.com/docs/ko/agent-sdk/typescript) / [en](https://code.claude.com/docs/en/agent-sdk/typescript) |

### 핵심 아키텍처 (3개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `agent-loop.md` | 에이전틱 루프 생명주기, 메시지 타입, 턴 카운트 | [ko](https://code.claude.com/docs/ko/agent-sdk/agent-loop) / [en](https://code.claude.com/docs/en/agent-sdk/agent-loop) |
| `claude-code-features.md` | CLAUDE.md 파일 로딩, skills 발견, 파일시스템 훅 | [ko](https://code.claude.com/docs/ko/agent-sdk/claude-code-features) / [en](https://code.claude.com/docs/en/agent-sdk/claude-code-features) |
| `sessions.md` | 세션 영속성, 재개(resume), 포크(fork), SessionStore 어댑터 | [ko](https://code.claude.com/docs/ko/agent-sdk/sessions) / [en](https://code.claude.com/docs/en/agent-sdk/sessions) |

### 입출력 모드 (3개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `streaming-vs-single-mode.md` | 스트리밍 입력 vs 단일 메시지 입력 모드 비교 | [ko](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode) / [en](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) |
| `streaming-output.md` | 부분 메시지 스트림 활성화, StreamEvent 처리 | [ko](https://code.claude.com/docs/ko/agent-sdk/streaming-output) / [en](https://code.claude.com/docs/en/agent-sdk/streaming-output) |
| `structured-outputs.md` | JSON Schema, Zod, Pydantic 으로 구조화된 출력 | [ko](https://code.claude.com/docs/ko/agent-sdk/structured-outputs) / [en](https://code.claude.com/docs/en/agent-sdk/structured-outputs) |

### 도구·확장 (6개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `custom-tools.md` | `@tool` 데코레이터로 도구 정의, MCP 서버 래핑 | [ko](https://code.claude.com/docs/ko/agent-sdk/custom-tools) / [en](https://code.claude.com/docs/en/agent-sdk/custom-tools) |
| `mcp.md` | MCP 서버 구성, 트랜스포트 타입(stdio/sse/http), 인증 | [ko](https://code.claude.com/docs/ko/agent-sdk/mcp) / [en](https://code.claude.com/docs/en/agent-sdk/mcp) |
| `tool-search.md` | 도구 수 증가 시 도구 검색 활성화 (`ENABLE_TOOL_SEARCH`) | [ko](https://code.claude.com/docs/ko/agent-sdk/tool-search) / [en](https://code.claude.com/docs/en/agent-sdk/tool-search) |
| `subagents.md` | 서브에이전트 정의(`AgentDefinition`), 호출, 컨텍스트 격리 | [ko](https://code.claude.com/docs/ko/agent-sdk/subagents) / [en](https://code.claude.com/docs/en/agent-sdk/subagents) |
| `skills.md` | Agent Skills 발견, 로딩, 필터링, 에이전트 컨텍스트 | [ko](https://code.claude.com/docs/ko/agent-sdk/skills) / [en](https://code.claude.com/docs/en/agent-sdk/skills) |
| `plugins.md` | 플러그인 로드 및 설치, 스킬 네임스페이싱 | [ko](https://code.claude.com/docs/ko/agent-sdk/plugins) / [en](https://code.claude.com/docs/en/agent-sdk/plugins) |

### 제어·안전 (4개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `user-input.md` | 승인 처리, `canUseTool` 콜백, `AskUserQuestion` | [ko](https://code.claude.com/docs/ko/agent-sdk/user-input) / [en](https://code.claude.com/docs/en/agent-sdk/user-input) |
| `permissions.md` | 권한 평가 흐름, allow/deny 규칙, 권한 모드 | [ko](https://code.claude.com/docs/ko/agent-sdk/permissions) / [en](https://code.claude.com/docs/en/agent-sdk/permissions) |
| `hooks.md` | 훅 이벤트 종류, 콜백, 매처, 다중 훅 등록 | [ko](https://code.claude.com/docs/ko/agent-sdk/hooks) / [en](https://code.claude.com/docs/en/agent-sdk/hooks) |
| `modifying-system-prompts.md` | 시스템 프롬프트 커스터마이징, 프리셋, 추가, CLAUDE.md | [ko](https://code.claude.com/docs/ko/agent-sdk/modifying-system-prompts) / [en](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts) |

### 상호작용 (2개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `slash-commands.md` | 슬래시 명령 발견, 전송, 커스텀 명령 생성 | [ko](https://code.claude.com/docs/ko/agent-sdk/slash-commands) / [en](https://code.claude.com/docs/en/agent-sdk/slash-commands) |
| `todo-tracking.md` | Todo 생명주기, 자동 생성, 실시간 진행 상황 모니터링 | [ko](https://code.claude.com/docs/ko/agent-sdk/todo-tracking) / [en](https://code.claude.com/docs/en/agent-sdk/todo-tracking) |

### 운영·모니터링 (4개)

| 파일 | 설명 | 출처 |
|------|------|------|
| `file-checkpointing.md` | 파일 변경 추적, 복원, 체크포인트 UUID | [ko](https://code.claude.com/docs/ko/agent-sdk/file-checkpointing) / [en](https://code.claude.com/docs/en/agent-sdk/file-checkpointing) |
| `cost-tracking.md` | 토큰 사용량, 모델별 비용 추적 | [ko](https://code.claude.com/docs/ko/agent-sdk/cost-tracking) / [en](https://code.claude.com/docs/en/agent-sdk/cost-tracking) |
| `observability.md` | OpenTelemetry 트레이스, 메트릭, 로그 내보내기 | [ko](https://code.claude.com/docs/ko/agent-sdk/observability) / [en](https://code.claude.com/docs/en/agent-sdk/observability) |
| `hosting.md` | 호스팅 요구사항, 샌드박싱, 배포 패턴 (임시/장기/하이브리드/단일 컨테이너) | [ko](https://code.claude.com/docs/ko/agent-sdk/hosting) / [en](https://code.claude.com/docs/en/agent-sdk/hosting) |

## 읽는 순서 (작업 유형별)

### SDK 처음 접하는 경우
1. `overview.md` — SDK가 무엇인지, 아키텍처, 기본 도구
2. `quickstart.md` — 설치 및 첫 예제 실행
3. `agent-loop.md` — 에이전틱 루프 생명주기 이해
4. `sessions.md` — 세션 및 상태 관리

### TypeScript 코드 작성
- **1차 레퍼런스**: `typescript.md` (모든 함수, 타입, 메시지 정의)
- **구현 샘플**: `quickstart.md` → `custom-tools.md`

### 도구 추가 및 확장
1. `custom-tools.md` — 도구 정의 기본
2. `mcp.md` — MCP 서버 구성
3. `tool-search.md` (도구가 많아지면) — 도구 검색 활성화

### 권한 및 보안 설계
1. `permissions.md` — 권한 시스템 개요
2. `hooks.md` — 훅으로 세밀한 제어
3. `user-input.md` — 사용자 승인 처리

### 프로덕션 배포
1. `hosting.md` — 배포 패턴 및 요구사항
2. `observability.md` — 모니터링 및 관찰성
3. `cost-tracking.md` — 비용 추적

### 세션 및 상태 관리
1. `sessions.md` — 세션 개념 및 API
2. `file-checkpointing.md` — 파일 변경 추적 및 되감기

## 핵심 개념 (에이전트 필수 이해)

- **장기 실행 프로세스**: SDK는 상태 비저장 API가 아니다. `query()`는 CLI 서브프로세스를 생성·초기화하고 메시지를 스트리밍한다.
- **메시지 타입**: `assistant`, `user`, `result` (최종), `system` (초기화), 부분 메시지 등. 각각 구조가 다르다.
- **권한 시스템**: 도구 실행 전 권한 검사. 모드(`default`, `bypassPermissions`, `plan` 등) + `canUseTool` 콜백으로 제어.
- **세션 영속화**: 대화를 디스크에 저장·재개·포크 가능. `SessionStore` 어댑터로 외부 백엔드로 확장.
- **MCP 확장성**: 기본 도구 외에 MCP 서버로 외부 도구 통합. 도구 많으면 검색 활성화.
- **훅**: 에이전틱 루프의 여러 지점(`PreToolUse`, `PostToolUse`, `SessionStart` 등)에서 실행되는 콜백.

## 출처 및 주의사항

- **스냅샷**: 이 디렉토리의 모든 `.md`는 https://code.claude.com/docs/ 의 특정 시점 스냅샷이다.
- **한국어 사본**: 각 문서는 번역본. 영어 원본은 위 표의 `[en]` 링크에서 접근.
- **공식 문서 업데이트**: SDK 버전 업그레이드 시 이 파일들도 동기화 필요.
- **외부 링크**: 각 파일 상단의 `Documentation Index` 헤더가 원본 출처를 명시.

## 본 프로젝트와의 연관

**Orca 는 이 SDK 를 직접 사용한다** (2026-08-05 정정 — 이전 판의 "직접 사용하지 않더라도" 는 CLI spawn 시절 서술이고 2026-05-18 에 폐기됐다). `app/src/main/adapters/claude.ts` 의 `ClaudeAdapter` 가 `@anthropic-ai/claude-agent-sdk` 의 `query()` 를 호출하고, `claude-map.ts` 가 `SDKMessage` → `NormalizedEvent` 로 정규화한다. 버전은 lockfile 핀 고정(`package.json` `dependencies` 참조). 따라서 SDK 문서는 에이전트가 프로젝트의 CLI 통신 로직을 이해할 때 참고 가치가 있다.

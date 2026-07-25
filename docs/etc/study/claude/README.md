# Claude Agent SDK — 내부 분석 (챕터별)

> 분석 대상: **`@anthropic-ai/claude-agent-sdk@0.3.220`** (= Claude Code CLI `2.1.220`, commit `4073f595…`, build 2026-07-24).
> 분석 방식: **npm 패키지 실물 정독**(`sdk.d.ts` 307 KB · `sdk-tools.d.ts` 149 KB · `sdk.mjs` 미니파이 번들 · `manifest.json`) + 공식 문서 미러 `@docs/spec/claude/agent-sdk/` 대조 + `0.3.215` 와의 실측 diff.
> 추정한 부분은 **"코드에서 확인 안 됨"** 으로 명시했다.

## 30초 요약

- **무엇인가**: `query()` 하나로 **CLI 서브프로세스(275 MB 컴파일 바이너리)를 띄우고 stdio JSONL 로 대화하는** 장수명 세션 SDK. 상태 비저장 API 가 아니다.
- **wrapper 는 얇다**: 에이전트 루프·도구·권한 규칙은 전부 CLI 바이너리 안에 있고, `sdk.mjs` 가 하는 일은 옵션 정규화 · JSONL 프레이밍 · **역방향 RPC 라우팅**(호스트 콜백을 CLI 가 부르게 해주는 것) 뿐이다.
- **제어 채널은 대칭이다**: `control_request` 가 stdout 유니언에도 들어 있다. `canUseTool` · hooks · in-process MCP 도구는 **CLI 가 호스트에게 거는 RPC** 로 구현된다.
- **★ 핵심 — 서브에이전트는 기본이 백그라운드다**: `Agent` 도구는 결과 대신 **런치 영수증**(`status:"async_launched"`)을 즉시 돌려주고 **메인 턴은 그대로 종결**된다. 태스크가 끝나면 CLI 가 완료 알림을 **자기 입력 큐에 주입**하고 drain 루프가 **호출자 개입 없이 다음 턴을 연다**(auto-resume continuation).
- **따라서 호출자 계약은 polling 이 아니라 listen 이다**: 상태를 조회하는 API 자체가 존재하지 않는다. 이미 열린 stdout 스트림을 **턴 경계를 넘어 계속 소비**하면, 끝났던 대화가 서버 주도로 재개된다.
- **일반 도구는 여전히 동기다**: 비동기 전환은 도구 전반이 아니라 **백그라운드 실행 경로**(서브에이전트 기본 · Bash `run_in_background` opt-in · `backgroundTasks()` 런타임 승격)에 한정된다.
- **0.3.215 → 0.3.220 이 영역은 무변경**: 관련 타입 11종 블록 대조 결과 전부 동일. 이번 구간의 유일한 큐 관련 변화는 `interrupt` 의 `cancel_queued` 옵션 신설이다.

## 목차

| # | 챕터 | 내용 |
|---|---|---|
| 1 | [패키지 구조와 프로세스 모델](01-패키지-구조와-프로세스-모델.md) | 실물 인벤토리 · 미니파이/컴파일 경계(근거 등급 3층) · SDK↔CLI 버전 좌표 · `query()` 가 여는 장수명 서브프로세스 · 3-프로세스 계층 |
| 2 | [제어 프로토콜과 턴 큐](02-제어-프로토콜과-턴-큐.md) | stdout 프레임 5종 · RPC 상관/취소 규약 · 제어요청 36 subtype · capability 협상 · 재접속 재무장 · **입력 큐 + drain 루프** · edge/level 신호 이중화 |
| 3 | [tool calling 규약 (동기 기준선)](03-tool-calling-규약.md) | `tool_use`/`tool_result` shape · `parent_tool_use_id` · `tool_use_result` 이중 경로 · 도구 3계열 디스패치 · `canUseTool` 왕복 · `PermissionResult` · 훅 31종 · 평가 순서 |
| 4 | [subagent 호출 규약](04-subagent-호출-규약.md) | 도구 이름 `Agent` 확정 · `AgentDefinition` 전 필드 · `AgentInput`/`AgentOutput` · 컨텍스트 격리와 `forwardSubagentText` · `task_*` 메시지 필드 전수 · 태스크 제어 API |
| **5** ★ | [**비동기 턴 전환 — listen 모델**](05-비동기-턴-전환-listen-모델.md) | **기본값 전환 · 런치 영수증 · 턴 조기 종결 · push 통지 · auto-resume continuation · listen vs polling · 동기↔비동기 대조표 · opt-out 과 런타임 승격 · 소비자 체크리스트** |
| 6 | [콜스택 딥다이브](06-콜스택-딥다이브.md) | `Query`/`ProcessTransport` 2계층 · 초기화 4단계 · stdout 펌프 · 프레임 디스패치 · 멱등 가드와 응답 억제 센티널 · 종료(5초 SIGKILL) · **비동기 경로가 갈라지는 정확한 지점** |
| 7 | [버전 델타와 한계](07-버전-델타와-한계.md) | 0.3.215↔0.3.220 실측 diff · 확인한 것/못 한 것 정리 · **재현·관측 방법 5종** · 스냅샷 고지 |

다이어그램은 각 챕터에 인라인(mermaid)으로 총 **9개** — flowchart 5(컴포넌트 · 큐/drain · 도구 3계열 · 부모/자식 · 콜스택) · 시퀀스 3(제어 RPC · 동기 도구 호출 · 비동기 전체 흐름) · 상태 전이 1(턴/태스크).

## 근거 등급 (읽기 전 유의)

| 층 | 파일 | 등급 | 인용 방식 |
|---|---|---|---|
| 타입 계약 | `sdk.d.ts` · `sdk-tools.d.ts` | **1급** — 완전히 읽히고 JSDoc 이 규약을 직접 서술 | `sdk.d.ts:3487` |
| wrapper 구현 | `sdk.mjs` | **2급** — 미니파이(140줄). 클래스/메서드 식별자·로그 문자열만 생존 | `sdk.mjs::handleControlRequest` |
| CLI 하네스 | `claude` (275 MB) | **3급** — 문자열 grep 만 가능, 제어 흐름 **관측 불가** | "코드에서 확인 안 됨" |

`sdk.d.ts` 의 JSDoc 이 예외적으로 상세해서(한 필드에 1,300자 규약 설명이 붙기도 한다) **바이너리를 못 읽어도 wire 규약 자체는 1급 근거로 재구성된다** — 이것이 본 분석이 성립하는 이유다. 반대로 *판정 로직*(권한 우선순위, coalescing 규칙 등)은 바이너리 안에 있어 확정하지 못했고, 7장에 전부 열거해 두었다.

## 범위

- **다루는 것**: SDK 패키지 내부 — tool calling / subagent 호출의 wire 규약, 제어 프로토콜, 턴 라이프사이클, wrapper 콜스택.
- **다루지 않는 것**: 이 SDK 를 쓰는 애플리케이션 코드(어댑터·통합 레이어). 본 세트는 **SDK 자체**만 분석 대상으로 삼는다.

## 자매 분석

같은 형식의 real-world 에이전트 분석 세트:

- [`../opencode/`](../opencode/) — 자체 구현 에이전트 루프(Effect 기반), 이벤트소싱 durable 런타임
- [`../hermes-agent/`](../hermes-agent/) — from-scratch 동기 루프, 자가개선 데몬 스레드

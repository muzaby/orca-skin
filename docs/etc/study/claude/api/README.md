# 2부 — SDK API 딥다이브 (심볼축)

> 분석 대상: **`@anthropic-ai/claude-agent-sdk@0.3.220`** (= Claude Code CLI `2.1.220`).
> [1부(01~07)](../README.md)가 **주제축**(패키지 구조 · 제어 프로토콜 · tool calling · subagent · 비동기 턴 · 콜스택 · 버전 델타)이라면, 본 세트는 **심볼축**이다 — 실제로 호출되는 API 하나하나가 SDK 안에서 어떤 스택을 타는지.

## 두 개의 축, 같은 사실

| | 1부 | 2부 (여기) |
|---|---|---|
| 자르는 기준 | 주제 | **심볼** |
| 답하는 질문 | "제어 프로토콜은 어떻게 생겼나" | "**`interrupt()` 를 부르면** 무슨 일이 일어나나" |
| 읽는 시점 | SDK 를 처음 이해할 때 | 특정 API 의 동작·실패 모드를 확인할 때 |

2부는 1부에 있는 서술을 **복사하지 않는다.** 배경은 절 링크로 넘기고, 그 심볼 고유의 프레임·가드·실패 모드만 쓴다.

## 목차

| # | 문서 | 대상 심볼 | 다이어그램 |
|---|---|---|---|
| **0** | [진입점 분류](00-진입점-분류.md) — ★ **경계 문서** | (매핑만) 4계열 분류 · 미도달 목록 | flowchart 1 |
| 1 | [`query()` 호출 생명주기](01-query-호출-생명주기.md) | `query()` | sequence 1 |
| 2 | [입력 경로 `SDKUserMessage`](02-입력-경로-SDKUserMessage.md) | `SDKUserMessage` · base SDK `MessageParam` | flowchart 1 |
| 3 | [출력 경로 `SDKMessage`](03-출력-경로-SDKMessage.md) | `SDKMessage` (39 variant) · `tool_use_result` | flowchart 1 |
| 4 | [제어 메서드](04-제어-메서드-setModel-setPermissionMode-interrupt.md) | `setModel` · `setPermissionMode` · `interrupt` | sequence 1 |
| 5 | [태스크 제어](05-태스크-제어-stopTask-backgroundTasks.md) | `stopTask` · `backgroundTasks` | sequence 1 + state 1 |
| 6 | [역방향 콜백](06-역방향-콜백-canUseTool-hooks.md) | `CanUseTool`/`PermissionResult` · `HookCallback`/`HookEvent`/`HookJSONOutput` | sequence 1 + flowchart 1 |
| 7 | [`Options` 표면과 실행 파일 해석](07-Options-표면과-실행파일-해석.md) | `Options` · `extraArgs` · `pathToClaudeCodeExecutable` | flowchart 1 |

신규 다이어그램 **10** (flowchart 5 · sequence 4 · state 1). 1부 9 와 합쳐 총 19.

## 경계 규칙 (읽기 전 유의)

| 문서 | 애플리케이션 코드 언급 |
|---|---|
| `00-진입점-분류.md` | **허용 — 이 파일 하나뿐** |
| `01`~`07` | **없음.** 순수 SDK 분석이며, 애플리케이션 파일 인용·IPC 채널명·어댑터 어휘가 등장하지 않는다 |

0장은 "어떤 진입점이 어느 심볼로 들어가는가" 까지만 적고 콜스택은 서술하지 않는다. 1~7장은 그 심볼부터 CLI 경계까지만 본다. 두 문서군은 **0장 §0.2 매핑표**에서만 만난다.

## 근거 등급

[1부 README 의 근거 등급](../README.md#근거-등급-읽기-전-유의)을 **그대로 상속**한다 (여기서 재정의하지 않는다):

| 층 | 파일 | 등급 |
|---|---|---|
| 타입 계약 | `sdk.d.ts` (307 KB) · `sdk-tools.d.ts` (149 KB) | **1급** — 라인 인용 |
| wrapper 구현 | `sdk.mjs` (1.25 MB, 미니파이) | **2급** — 식별자·로그 문자열 인용 (`sdk.mjs::<메서드>` / `sdk.mjs "<문자열>"`) |
| CLI 하네스 | `claude` (컴파일 바이너리) | **3급** — 제어 흐름 **관측 불가** |

2부의 각 문서는 **6단 골격**으로 쓰였다:

① 시그니처(1급) → ② SDK 내부 콜스택(2급) → ③ wire 프레임(1급) → ④ 구현 디테일(2급) → ⑤ 다이어그램 → ⑥ **관측 불가 구간**(3급)

⑥ 은 부록이 아니라 필수 절이다. 확정한 것과 확정하지 못한 것의 경계를 심볼마다 남기는 것이 이 세트가 신뢰를 얻는 방식이다.

## 이 세트에서 확인된 것 (요약)

- **value import 는 `query` 하나뿐**이고, 나머지 표면은 전부 타입 계약과 `Query` 인스턴스 메서드다.
- **`prompt` 의 타입 하나가 세션 수명을 결정한다** — `string` 이면 첫 `result` 에 stdin 이 닫히고, `AsyncIterable` 이면 제너레이터가 끝날 때까지 열려 있다. 제어 메서드 5종은 후자에서만 동작한다.
- **`Options` 는 세 갈래로 흩어진다** — CLI 인자 / `initialize` 제어 요청 / wrapper 내부 상태. `hooks` 는 함수라 wire 를 못 건너므로 콜백 ID 로 치환된다.
- **`skills` 는 `allowedTools` 로 번역된다** — `Skill(name)` 항목이 덧붙는다.
- **태스크 제어는 식별자가 둘** — `stopTask` 는 `task_id`, `backgroundTasks` 는 `tool_use_id`. 매핑을 조회할 API 가 없어 소비자가 라이프사이클 메시지에서 직접 누적해야 한다.
- **역방향 콜백에만 서버 측 장치가 있다** — 중복 배달 가드 · 취소 배선(`options.signal`) · 응답 억제 센티널(`Symbol("suppressControlResponse")`).
- **상태 조회 API 가 없다.** 태스크도, 턴도 마찬가지다 — 호출자 계약은 polling 이 아니라 listen 이다([1부 5.6](../05-비동기-턴-전환-listen-모델.md#56-f-호출자-계약-listen--polling-이-아니다)).

## 스냅샷 고지

본 세트는 **`0.3.220` 시점의 패키지 실물**을 읽은 결과다. `sdk.mjs` 인용은 미니파이 번들의 식별자에 의존하므로, 번들러 설정이 바뀌면 식별자(`Hh`·`Uw`·`Np`·`pO`·`dO`·`Okt` 등)가 달라질 수 있다 — 그때는 **로그 문자열**(`[Query.streamInput] …`, `[ProcessTransport] stdin write failed …`)이 더 안정적인 앵커다.

타입 계약(`sdk.d.ts` 라인)은 버전을 올리면 이동한다. 버전 bump 시 규약 유효성을 재확인하는 절차는 [1부 §7.5](../07-버전-델타와-한계.md#75-재현관측으로-좁히는-방법).

---

← [1부 인덱스](../README.md) · [0장 — 진입점 분류](00-진입점-분류.md) →

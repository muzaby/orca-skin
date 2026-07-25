# Plan — 0147-agent-sdk-bump-async-turn-study

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0147-agent-sdk-bump-async-turn-study` |
| 작성자 | Claude Code |
| 일자 | 2026-07-25 |
| 매핑 | PHASES 미승격(문서/의존성 위생 — 페이즈 표는 Phase 단위 coarse-grained) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 문서 작성 및 구현하라. ① `package-lock.json` 제거 ② `package.json` 의 claude agent sdk 업데이트 ③ tool calling 및 subagent 호출 규약 및 내부 동작 분석 (callstack → deep dive, 다이어그램 활용) ④ `docs/etc/study/claude/` 경로에 요약 및 정리" | 라이브 세션 요청(2026-07-25) |
| 명시 요구 (포커스 지정) | "최근 버전에서 호출자가 **listen 형태**로 서브에이전트 및 도구 호출의 결과를 기다리는 것으로 보인다. 이 부분에서 **main 대화가 끝나는 형태**로, **polling 이 아닌 대화 재개가 가능한 형태**로 변화가 된 것으로 보인다. ① 이 의문이 맞는지 검토 후 ② 맞다면 의견을 계획에 반영하라." | 라이브 세션 요청(동일, 2차) |
| 명시 결정 | lock 제거 = **삭제 후 재생성** (지우고 `npm install` 로 깨끗하게 재해석해 다시 커밋). CI(`npm ci`)·릴리스 파이프라인 무변경. | 라이브 AskUserQuestion 응답(2026-07-25) |
| 명시 결정 | 3번 분석 범위 = **SDK 내부만** (SDK 패키지 소스 + `docs/spec/claude/agent-sdk/` 미러). Orca 어댑터 코드는 분석 대상 아님. | 라이브 AskUserQuestion 응답(동일) |
| 추론 의도 | 이 작업의 실용 목적은 **0135→0136→0138→0143 네 라운드에 걸친 같은 영역 반복 재발견을 끊는 것** — SDK 쪽 사실(비동기 턴 전환 규약)을 코드 근거로 문서에 고정한다. (요청 문구 "내부 동작 분석" + 핸드오프 이력에서 해석 — **추론**) | `0135`~`0143` plan.md |

## Context (왜)

Orca 는 `@anthropic-ai/claude-agent-sdk` 를 유일한 실사용 백엔드로 삼는다(`app/src/main/adapters/claude.ts:322` 의 `query()`). 그런데 저장소에는 SDK **공식 문서 미러**(`docs/spec/claude/agent-sdk/`, 27 파일)만 있고, SDK 가 실제로 어떤 wire 규약·콜스택으로 도구 호출과 서브에이전트를 처리하는지에 대한 **코드 근거 분석이 없다**.

그 공백의 대가가 이미 이력에 남아 있다. `0.3.143 → 0.3.215` 점프에서 CLI 2.1.198 의 "서브에이전트 기본 백그라운드" 전환을 정면으로 맞았고, 그 의미론을 확정하지 못한 채 `0135`(foreground 원복 시도 → 무효) → `0136`(백그라운드 수용) → `0138`(opt-in 회귀) → `0143`(백그라운드 기본화, 0135 폐기·0138 supersede) 네 라운드를 돌았다.

본 핸드오프는 (a) SDK 를 `0.3.220` 으로 올리고 lock 을 재생성하며, (b) 사용자가 지목한 **비동기 턴 전환(listen 모델)** 을 축으로 tool calling / subagent 호출 규약과 내부 콜스택을 `docs/etc/study/claude/` 에 고정한다 — `etc/study/opencode/` · `etc/study/hermes-agent/` 에 이은 3번째 real-world 분석 세트.

## 자료조사 (Research)

### A. 사용자 의문 검토 — **결론: 맞다**

저장소 핸드오프 이력이 인용한 SDK 패키지 실측 + CHANGELOG 로 6항 전부 확인했다.

| 사용자 관찰 | 검토 결과 | 레퍼런스 |
|---|---|---|
| "최근 버전에서 …" | **맞다.** CLI 2.1.198: *"Subagents now run in the background by default, so Claude keeps working while they run and **is notified when they finish**"* | 웹 https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md §2.1.198 (인용: `0135/plan.md:30`) |
| "main 대화가 끝나는 형태" | **맞다.** `Agent`/`Task` 가 **즉시 런치 영수증**을 tool_result 로 반환 — `{status:'async_launched', agentId, description, prompt, outputFile, …}` 가 wire `content` 가 아닌 **별도 필드 `tool_use_result`** 에 실린다. 메인 턴은 기다리지 않고 `result` 로 **종결**된다. | SDK 0.3.215 `sdk-tools.d.ts:146-175` (인용: `0136/plan.md:38`); 증상 기술 `0135/plan.md:24` |
| "polling 이 아니다" | **맞다.** 호출자가 상태를 되묻는 경로가 없다. SDK 는 **장수명 서브프로세스 + 열린 stdout 스트림**이고, 진행/완료는 **CLI 가 push** 한다 — `system` 메시지 `task_started`/`task_progress`/`task_notification`, 자식 assistant 메시지(`parent_tool_use_id` 태깅). | `0138/plan.md:27`, 소비부 `app/src/main/adapters/claude-map.ts:183-192` |
| "대화 재개가 가능한 형태" | **맞다.** 완료 알림이 **CLI 내부 큐로 주입**되고 **drain 루프가 즉시 다음 턴을 연다** — SDK 문서 표현 *"auto-resume continuations … the drain loop, which starts the next queued turn immediately"*. 종료된 대화가 **서버 주도로 재개**되어 완결된 새 턴(assistant → `result`)이 흘러나온다. | SDK 0.3.215 `sdk.d.ts` interrupt receipt 문단 (인용: `0136/plan.md:36`) |
| "호출자가 listen 형태로 기다린다" | **맞다.** 호출자에게 남는 역할은 **입력 push 없이 같은 스트림의 프레임을 계속 소비**하는 것. | `0136/plan.md:54`, `0143/plan.md` AC3 |
| (보완) 동기 opt-out | 존재. `run_in_background: false` — *"Set to false to run this agent synchronously when you need its result before continuing"*. 단 0135 의 주입 시도는 **라이브 무효** 판정되어 0143 에서 폐기됐다. | `sdk-tools.d.ts:500-503` (인용: `0135/plan.md:31`), 무효 판정 `0143/plan.md` Context |

**검토가 덧붙이는 정정 1건.** 사용자 표현 "서브에이전트 **및 도구** 호출" 중 — 확인된 범위는 **서브에이전트(`Agent`/`Task`) 및 백그라운드로 뜨는 실행 경로**다. **일반 도구는 여전히 동기**(같은 턴 안에서 `tool_result` 블록으로 회수). `0138/plan.md:27` 이 정적으로 확정: *"진짜 foreground 서브에이전트는 평범한 Agent 도구 호출(`tool.call.started`→`completed`)이라 트래커에 등록되지 않는다"*. 분석 문서는 이 경계를 **동기 기준선(03장) ↔ 비동기 전환(05장)** 으로 대조한다.

### B. 저장소 제약 / 기존 자산

| 발견 / 제약 | 레퍼런스 |
|---|---|
| CI·릴리스가 `npm ci` + `cache-dependency-path: app/package-lock.json` 에 의존 — lock 영구 제거는 불가, 재생성만 무해 | `.github/workflows/ci.yml:41-46`, `release.yml:39-51` |
| SDK 는 현재 유일하게 **정확 핀**(caret 없음)된 의존성 | `app/package.json:31` |
| 0.3.215 ↔ 0.3.220 의 peerDependencies 동일(`zod ^4.0.0`·`@anthropic-ai/sdk >=0.93.0`·`@modelcontextprotocol/sdk ^1.29.0`), optionalDependencies 도 동일 8종의 버전만 동행 상승 → **신규 의존성 0** | `npm view @anthropic-ai/claude-agent-sdk@{0.3.215,0.3.220}` 실측(본 세션) |
| SDK↔CLI 버전은 하위 번호 대응(SDK 0.3.215 ↔ CLI 2.1.215) → 이번 bump = CLI 2.1.215 → 2.1.220 | `0135/plan.md:24` |
| lock 재생성은 `npm install <pkg>@ver` 와 달리 **모든 transitive 를 caret 범위 내 재해석** — electron `^39.2.6`·vite `^7.2.6` 등이 함께 오를 수 있다 | npm 동작(lockfileVersion 3), `app/package.json:47-77` |
| egress 차단 환경에서 `postinstall`(=`ensure-sqlite-abi.mjs electron`)이 403 실패하는 것은 **알려진 베이스라인**이지 회귀가 아니다. lint/typecheck 는 ABI-중립 | `app/AGENTS.md` "제약 환경(egress 차단) 주의" |
| 자매 분석 세트의 톤·구성(챕터 분할·인덱스·mermaid·"코드에서 확인 안 됨" 표기 관례) | `docs/etc/study/opencode/00-index.md`, `docs/etc/study/hermes-agent/README.md` |
| `docs/etc/` 및 `etc/study/*` 는 `AGENTS.md` 없이 README/index 로 운영 — 신설 디렉토리도 동일 관례 | `ls docs/etc/`, `docs/etc/study/{opencode,hermes-agent}/` |
| 문서 인벤토리 표가 `etc/study/opencode/`·`etc/study/hermes-agent/` 행을 보유 — 신설 시 갱신 대상 | `docs/AGENTS.md` 문서 인벤토리 |
| 원문 미러(`docs/spec/**`)는 **편집 금지**, 통째 덮어쓰기로만 갱신 | `docs/AGENTS.md` §6 |
| `INDEX.md` 최대 번호 = `0146` → 신규 번호 `0147` | `docs/handoff/INDEX.md`, `AGENTS.md` "디렉토리 구조" |

> **범위 주의**: 위 A/B 의 Orca 코드·핸드오프 인용은 **본 plan 한정**이다. 산출물 `docs/etc/study/claude/` 본문은 사용자 확정 범위대로 **SDK 패키지 실물 소스 + `docs/spec/claude/agent-sdk/` 미러만** 근거로 삼는다(인수 기준 12).

## 인수 기준 (Acceptance Criteria)

1. `app/package-lock.json` 이 삭제 후 재생성되어 있고 `lockfileVersion: 3` · `packages[""].version === "0.3.1"`(package.json 일치)를 만족한다.
2. `app/package.json` 의 `@anthropic-ai/claude-agent-sdk` 가 `0.3.220` 이고 **정확 핀(caret 없음)** 을 유지한다. 다른 의존성 항목은 추가·삭제되지 않았다.
3. 재생성된 lock 에서 SDK 본체와 8개 플랫폼 optionalDependency 가 전부 `0.3.220` 이다.
4. `.github/workflows/{ci,release}.yml` 무변경(`npm ci` + `cache-dependency-path: app/package-lock.json` 유지).
5. `docs/etc/study/claude/` 에 `README.md` + 7개 챕터(`01`~`07`)가 존재하고, README 인덱스 표 링크가 전부 실재 파일을 가리킨다.
6. mermaid 다이어그램이 전체 **7개 이상**이며, 최소 1개는 동기 tool calling 시퀀스, **최소 2개는 비동기 턴 전환(05장)**, 최소 1개는 콜스택이다.
7. `03-tool-calling-규약.md` 가 (a) `tool_use`/`tool_result` shape (b) 도구 3계열(CLI 내장/외부 MCP/in-process SDK MCP) 디스패치 경로 (c) `canUseTool` 의 제어 프로토콜 왕복 (d) hook 개입 지점을 각각 SDK 패키지 `파일:라인` 근거와 함께 서술한다.
8. `04-subagent-호출-규약.md` 가 (a) 호출 도구 이름의 0.3.220 기준 확정 (b) `subagent_type`/`run_in_background` 입력 스키마 (c) `parent_tool_use_id` 태깅 (d) 컨텍스트 격리를 근거와 함께 서술한다.
9. **★ `05-비동기-턴-전환-listen-모델.md` 가 사용자 의문 6항을 전부 근거와 함께 확정한다**: (a) `run_in_background` 기본값 true 전환 (b) `{status:'async_launched', …}` 런치 영수증 shape 과 `tool_use_result` 전달 경로 (c) 메인 턴이 `result` 로 조기 종결되는 경계 (d) `task_started`/`task_progress`/`task_notification` push (e) 큐 주입 → drain 루프 → auto-resume continuation 기전 (f) 호출자 계약 = **listen(스트림 소비), polling 아님**. 추가로 (g) **동기 도구 ↔ 비동기 서브에이전트 경계 대조표** (h) `run_in_background:false` opt-out 의 문서상 계약을 포함한다.
10. `06-콜스택-딥다이브.md` 가 비동기 경로의 분기 지점(입력 push 없이 출력 루프만 도는 구간)을 콜스택 상에서 명시한다.
11. `07-버전-델타와-한계.md` 가 0.3.215 → 0.3.220 구간의 tool/subagent/턴 영역 변화 여부를 **실측 비교 결과로** 기록한다(변화 없으면 "없음"을 근거와 함께 명시).
12. 문서 어디에도 `app/src/**` 또는 `docs/handoff/**` 인용이 없다(확정 범위 준수). 확인 불가 항목은 **"코드에서 확인 안 됨"** 으로 명시되어 있다.
13. `docs/AGENTS.md` 문서 인벤토리 표에 `etc/study/claude/` 행이 추가되어 있다.
14. `docs/spec/claude/agent-sdk/**` 무변경(원문 미러 편집 금지).
15. 게이트: `cd app && npm run lint && npm run typecheck` 0 error. `npm test` 는 실행하되 egress 차단으로 better-sqlite3 ABI 가 막히면 **DB 로드 스위트 실패를 알려진 베이스라인으로 분리 보고**하고 나머지 green 을 확인한다.
16. `docs/handoff/0147-agent-sdk-bump-async-turn-study/{plan,verify}.md` 존재 + `INDEX.md` 행이 최종 상태로 갱신되어 있다.

## 범위 / 비범위

- **범위**: SDK bump(작업 2) + lock 재생성(작업 1) + `docs/etc/study/claude/` 8 파일(작업 3·4) + `docs/AGENTS.md` 인벤토리 1행 + 핸드오프 문서 3종(plan/verify/INDEX 행).
- **비범위**:
  - `app/src/**` 코드 변경 **0**. bump 로 타입 에러가 나면 단독 수정하지 않고 사용자에게 보고 후 결정(설계 변경 소관). 롤백(0.3.215 유지)도 선택지.
  - Orca 어댑터/런타임의 listen 턴 구현 재검토 — `0136`/`0143` 소유. 본 작업은 **SDK 쪽 사실을 문서로 고정**하는 것까지.
  - `claude.ts:78`·`claude.ts:333` 주석이 참조하는 실재하지 않는 "가이드 §4/§5/§6-A" 복원 — 별도 핸드오프(본 문서가 대체 근거가 될 수 있으나 주석 수정은 코드 변경).
  - `@anthropic-ai/sdk`·`@modelcontextprotocol/sdk` 가 peerDependency 로만 존재하고 `package.json` 에 미선언인 문제 — 별도 핸드오프(현재 동작 영향 없음).
  - `docs/spec/claude/agent-sdk/` 미러의 0.3.220 재동기화 — 사람이 수동으로 하는 절차(`docs/AGENTS.md` §6).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **기댈 것**: `npm install`(lock 재해석), `npm view`(버전 메타), SDK 패키지 실물(`node_modules/@anthropic-ai/claude-agent-sdk/`), `docs/spec/claude/agent-sdk/` 미러.
- **전제**: 레지스트리 egress 가 열려 있어 `npm install` 이 성공한다(본 세션 `npm view` 로 확인). electron 바이너리 egress 는 막혀 있을 수 있으며 이는 알려진 베이스라인이다.
- **전제**: `0135`~`0143` 이 0.3.215 에서 실측 인용한 지점(`sdk-tools.d.ts` AgentOutput/`run_in_background`, `sdk.d.ts` interrupt receipt)이 0.3.220 에서도 읽을 수 있다 — 최소 착지점.
- **신규 의존성**: **없음** (자료조사 B 3행 — peer/optional 동일, 버전만 상승). 사용자 승인 대상 아님.

## 설계

### 작업 1 — lock 삭제 후 재생성

1. `rm app/package-lock.json`
2. 작업 2(bump)를 **먼저 적용한 뒤** `cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`.
3. postinstall 이 exit 1 을 내도 **lock 은 정상 기록**되므로 채택. 막히면 `npm install --ignore-scripts`(해석 결과 동일) + `npm rebuild better-sqlite3`(Node ABI).
4. **직접 의존 중 resolved 버전이 바뀐 목록을 구현 보고에 명시** — caret 범위 재해석의 부수 효과를 가시화한다.

### 작업 2 — SDK bump

`app/package.json` 한 줄. 정확 핀 유지, `version` 필드 불변(`app/AGENTS.md` 원칙 6 — `npm run release:*` 전용).

### 작업 3+4 — 분석 문서

**착수 첫 단계는 패키지 실물 인벤토리**다. `ls -la` + 각 파일 성격(사람이 읽는 래퍼 / 미니파이 번들 / 컴파일 네이티브 바이너리)을 확정하고 챕터 깊이를 조정한다. CLI 가 네이티브 바이너리면(optionalDependencies 8종이 그 정황) 함수 단위 정독이 불가하므로, 읽을 수 있는 층(래퍼 + `.d.ts` + 번들의 grep 가능한 문자열·분기)으로 **wire 규약을 재구성**하고 확인 불가 구간은 "코드에서 확인 안 됨"으로 분리한다.

| 파일 | 내용 |
|---|---|
| `README.md` | 인덱스 표 + 분석 범위/방식 + **30초 요약**(핵심 = 동기 도구 루프 위에 얹힌 비동기 턴 전환) + 근거 한계. 자매 관례대로 `AGENTS.md` 는 두지 않는다. |
| `01-패키지-구조와-프로세스-모델.md` | 실물 인벤토리, `query()` 가 여는 **장수명 서브프로세스** 모델, 래퍼 층 ↔ CLI 층 경계, "장수명 + 열린 스트림"이 왜 이후 모든 비동기 거동의 전제인지. **다이어그램 1**(컴포넌트). |
| `02-제어-프로토콜과-턴-큐.md` | stdio JSONL 양방향 프레이밍 — 정방향 `SDKMessage`(`system`/`assistant`/`user`/`stream_event`/`result`) vs 역방향 `control_request`/`control_response`/`control_cancel_request`. initialize 핸드셰이크, request id 상관·취소. **CLI 내부 입력 큐 + drain 루프**(auto-resume 의 토대)를 여기서 세운다. **다이어그램 2**(시퀀스). |
| `03-tool-calling-규약.md` | **동기 기준선.** `tool_use`/`tool_result` shape, 도구 3계열 등록·디스패치 경로 차이, `canUseTool` 의 제어 프로토콜 왕복, `PermissionResult`(allow+`updatedInput` / deny+`message`), `permissionMode` 우선순위, hook(`PreToolUse`/`PostToolUse`) 개입 지점. **다이어그램 3**(도구 1회 호출 전 구간). |
| `04-subagent-호출-규약.md` | `AgentDefinition` 정의 경로, 호출 도구 이름 확정(`Task`/`Agent`), 입력 스키마(`subagent_type`·`run_in_background`), 컨텍스트 격리, `parent_tool_use_id` 태깅, `forwardSubagentText`. **다이어그램 4**(부모/자식 관계). |
| ★ `05-비동기-턴-전환-listen-모델.md` | **핵심 챕터** — 인수 기준 9 의 (a)~(h). **다이어그램 5**(런치→턴 종료→push→자동 턴 전체 시퀀스) + **다이어그램 6**(턴 상태 전이). |
| `06-콜스택-딥다이브.md` | `query()` → 옵션 정규화 → transport 생성/spawn → 핸드셰이크 → 입력 AsyncIterable 소비 → stdout 라인 파싱/디스패치 → 콜백 역방향 요청 → abort/close/정리. **비동기 경로가 갈라지는 지점** 명시. **다이어그램 7**(flowchart). |
| `07-버전-델타와-한계.md` | 버전 연혁(`run_in_background` 기본값 전환 축) + 0.3.215 → 0.3.220 실측 비교 + 확인 한계 + 재현/관측 수단(패키지에서 확인된 것만). |

**분량 목표**: 챕터당 80~250줄, 전체 900~1,400줄.

**작성 규칙**: 레퍼런스 없는 주장 금지(모든 규약 서술에 `node_modules/...:line` 또는 `@docs/spec/claude/agent-sdk/<file>.md`). Orca 코드·핸드오프 인용 금지. 원문 미러 읽기 전용.

### 참조 갱신

`docs/AGENTS.md` 문서 인벤토리 표에 `etc/study/hermes-agent/` 행 뒤로 `etc/study/claude/` 한 행 추가(root `AGENTS.md` 원칙 5).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

문서·의존성 작업이라 런타임 UX 파생은 **N/A**. 문서 산출물의 엣지케이스만:

- **한계 표기**: CLI 가 네이티브 바이너리라 함수 단위 근거를 못 얻는 구간 → 본문 "코드에서 확인 안 됨" + 07장 집약(인수 기준 12 가 강제).
- **버전 표류**: 문서가 0.3.220 스냅샷임을 README 와 07장에 명시 — 다음 bump 때 무엇을 다시 봐야 하는지(재현 절차)를 남긴다.
- **범위 누출**: Orca 코드가 편해서 인용하고 싶어지는 지점(특히 05장) → grep 검증(인수 기준 12)으로 기계 확인.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| CLI 가 컴파일 네이티브 바이너리라 "deep dive" 가 래퍼 층에 그칠 수 있음 | 인벤토리를 **먼저** 확정하고 챕터 깊이 조정. `0135`~`0143` 의 0.3.215 실측 인용 선례로 최소 착지점 확보. 확인 불가 구간은 07장 + 본문 표기로 정직하게 분리. |
| lock 재생성이 electron/vite 등 무관 패키지를 caret 범위 내에서 함께 올려 빌드가 흔들릴 수 있음 | 사용자 확정 방식이므로 수행하되, resolved 변경 목록을 구현 보고에 명시하고 lint+typecheck 로 게이트. 회귀 시 즉시 보고. |
| egress 차단으로 postinstall(electron ABI) 403 실패 | 알려진 베이스라인. `ELECTRON_SKIP_BINARY_DOWNLOAD=1` / `--ignore-scripts` 로 lock 확정, 1차 게이트는 ABI-중립 lint+typecheck. |
| 0.3.215→0.3.220 타입 변경으로 typecheck 가 깨질 수 있음 | 게이트 포함(AC15). 깨지면 **비범위(코드 변경 0)** 원칙대로 보고 후 사용자 결정 — 롤백 선택지 명시. |
| 0.3.220 이 서브에이전트/턴 거동을 또 바꿨을 가능성 | 그 자체가 07장 산출물(AC11). 거동 변화 확인 시 Orca 런타임 영향은 **보고만** 하고 후속 핸드오프로 분리. |

- **되돌리기 어려운 결정**: 없음. lock 은 git 이력으로 복원 가능, SDK 핀은 한 줄 롤백, 문서는 additive.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: typecheck 파괴 시 "bump 유지 + 코드 수정" vs "0.3.215 롤백" 선택. 0.3.220 거동 변화가 Orca 런타임에 영향 시 후속 대응 범위.

## 영향 받는 파일

- `app/package.json` (1줄)
- `app/package-lock.json` (삭제 → 재생성)
- `docs/etc/study/claude/README.md` + `01`~`07` (신규 8)
- `docs/AGENTS.md` (인벤토리 표 1행)
- `docs/handoff/0147-agent-sdk-bump-async-turn-study/{plan,verify}.md` (신규 2)
- `docs/handoff/INDEX.md` (1행)

## 참고 문서

- `docs/AGENTS.md` §6 — 외부 미러 2단 구조(원문 미러 편집 금지) + 문서 인벤토리 표
- `app/AGENTS.md` — 의존성 정책 · better-sqlite3 ABI/제약 환경 게이트 · 원칙 6(버전 수동 편집 금지)
- `docs/handoff/AGENTS.md` — 상태 머신 · 구현 주체 분담(비기능 = Claude 직접 구현)
- `docs/git-template.md` — 커밋 trailer 규약
- `docs/spec/claude/agent-sdk/` — 분석 2차 근거 (읽기 전용)
- `docs/etc/study/{opencode,hermes-agent}/` — 톤·구성·밀도 레퍼런스
- (검토 근거, **산출물 본문 인용 금지**) `docs/handoff/{0135,0136,0138,0143}/plan.md`
- IPC 변경: **없음** (`docs/IPC_CONTRACT.md` 무관)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- **신규 테스트 요구: 없음** — 코드 변경 0(문서 + 의존성 메타데이터). 기존 스위트가 SDK bump 회귀 감지 역할을 한다.
- 추가 기계 검증(AC 12·6·14): `grep -rn 'app/src/\|docs/handoff/' docs/etc/study/claude/` → 빈 출력, `grep -rc '```mermaid' docs/etc/study/claude/*.md` → 합계 7 이상, `git status --short docs/spec/` → 빈 출력.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건 + 포커스 지정 + AskUserQuestion 확정 2건을 라이브 세션 출처로 인용했고, 추론 의도는 "(추론)" 으로 표기했다.
- [x] 자료조사 — A(의문 검토 6항)·B(제약 11행) 모든 발견에 레퍼런스(웹 URL·`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 16개 번호, 자료조사 근거, 전부 기계 검증 가능(grep/파일 존재/게이트 출력).
- [x] 의존 기술 — 기댈 것·전제 명시, **신규 의존성 0** 을 실측으로 확정(승인 대상 아님).
- [x] 파생 UX — 런타임 UX 는 N/A 로 명시하고 문서 산출물 고유 엣지케이스 3종(한계 표기·버전 표류·범위 누출)을 펼쳤다.
- [x] 리스크 — 5건 + 되돌리기 난이도 + Open Question 2건(typecheck 파괴 시 선택, 0.3.220 거동 변화 대응)을 사용자 결정으로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. (본 핸드오프는 비기능 작업 → Claude 가 plan→impl→verify 직접 수행.)

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: 작업 1·2 의 순서(bump 먼저 → lock 재생성)는 정확했다. 한 번의 `npm install` 로 SDK 본체·플랫폼 optionalDependency 9종이 일괄 `0.3.220` 으로 해석됐다.
- **동의**: "착수 첫 단계는 패키지 실물 인벤토리" 라는 설계 §작업 3+4 의 지시가 결정적이었다. 인벤토리 결과 근거가 **3층으로 갈린다**는 사실(1급 `.d.ts` / 2급 미니파이 `sdk.mjs` / 3급 컴파일 바이너리)이 확인되어, 챕터별 깊이와 인용 방식을 그에 맞춰 설계할 수 있었다.
- **이견 1 — "제약 환경" 전제가 이 세션에는 틀렸다.** plan §작업 1 과 리스크 표는 egress 차단(electron 403)을 기정사실로 깔았으나, **본 세션은 egress 가 열려 있었다**. 그래서 `npm install` 이 electron ABI rebuild 까지 정상 완료(exit 0)했고, 방어적으로 넣었던 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 이 오히려 electron 바이너리를 빠뜨려 `chat-turn.continuity.test.ts` 1 스위트를 로드 실패시켰다. `node node_modules/electron/install.js` 로 회수해 **전 스위트 green** 을 달성했다. → AC15 의 "베이스라인 분리 보고" 예외 조항을 **쓰지 않고** 통과.
- **이견 2 — 챕터 6의 근거 등급을 plan 이 낙관했다.** plan 은 6장을 "함수 단위 콜스택 … 각 단계 `파일:라인`" 으로 규정했으나, `sdk.mjs` 는 140줄 미니파이라 **라인 인용이 원천적으로 무의미**하다. 인용 규약을 `sdk.mjs::<메서드명>` / `sdk.mjs "<원문 문자열>"` 로 바꿔 작성했다. 결과적으로 골격(클래스 2종·초기화 4단계·디스패치·멱등 가드·센티널·종료)은 전부 복원했으므로 인수 기준의 취지는 충족한다.
- **우려(잔여) — AC11 의 "실측 비교"를 plan 이 구체화하지 않았다.** 방법을 명시하지 않아 구현 턴에서 `npm pack @…@0.3.215` → tar 전개 → 블록 단위 diff 절차를 새로 설계해야 했다. 그 절차 자체를 7.5절 ⑤ 에 재사용 가능한 형태로 남겼다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | plan 이 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 를 무조건 권했는데, egress 가 열린 환경에서는 이것이 **스스로 게이트를 깨뜨린다**(electron 미설치 → DB/electron 로드 스위트 1건 실패). "제약 환경 대응"이 제약 없는 환경에서 역효과를 낸 사례. | ✅ 구현함 — `node node_modules/electron/install.js` 로 바이너리 회수 후 재실행, 146/146 · 1165/1165 green. | `npm test` 출력 |
| 2 | AC6 이 "mermaid 7개 이상"만 요구해 **종류 분포**를 강제하지 않았다. 자칫 flowchart 만 7개가 될 수 있었다. | ✅ 구현함 — flowchart 5 · sequence 3 · stateDiagram 1 = **9개**로 작성하고 README 에 분포를 명시. AC6 의 종류 요구(동기 시퀀스·05장 2개·콜스택)도 각각 충족. | `README.md` · `grep -c '```mermaid'` |
| 3 | AC12 는 `app/src/**`·`docs/handoff/**` 인용 금지만 기계 검사한다. 그런데 **범위 준수와 별개로, 문서 간 상호링크가 깨지면** 7챕터 세트의 가치가 급감한다. plan 에 링크 무결성 검사가 없었다. | ✅ 구현함 — 전 챕터의 상대경로 `.md` 링크를 전수 검사(깨진 링크 0). 절차를 verify 게이트에 추가. | verify.md 게이트 절 |
| 4 | 5장 작성 중 `BashInput.run_in_background` 와 `TaskOutputInput{block, timeout}` 을 발견했다. 후자는 **모델용 블로킹 조회 도구**이므로, "polling 이 아니다" 를 무자격으로 단언하면 **부정확**해진다. | ✅ 구현함 — 5.6절에 "예외 두 곳"을 신설해 (a) 모델의 `TaskOutput({block:true})` (b) 번들된 MCP SDK 의 `handleAutomaticTaskPolling`(5초 폴링, **Claude 백그라운드 경로와 무관**)을 분리 서술. 호출자 계약(listen)과 모델 계약(필요 시 block-read)이 다른 층임을 명시. | `05-…md` §5.6 |
| 5 | plan §1 검토는 "일반 도구는 여전히 동기" 라고 정정했는데, 실측 결과 **`Bash` 도 `run_in_background` 를 갖고 `backgroundTasks()` 는 "Bash commands and subagents" 를 대상으로 한다**. plan 의 정정이 과했다. | ✅ 구현함 — 5.1·5.8절에서 "서브에이전트는 기본 background(명시 opt-out) / Bash 는 기본 foreground(명시 opt-in)" 로 **기본값 방향의 차이**로 재정정. | `sdk-tools.d.ts:545-548`, `sdk.d.ts:2563-2575` |
| 6 | 이번 bump 구간에 **턴 큐 영역 변경이 실제로 있었다** — `interrupt` 의 `cancel_queued`/`cancelled` 신설(신규 capability `interrupt_cancel_queued_v1`). plan 은 "변화 없으면 없음을 명시" 만 상정했다. | ✅ 구현함 — 7.3절에 별도 항으로 기록하고, `cancel_queued:true` 가 **auto-resume continuation 이 열 예정이던 턴까지 취소할 수 있다**는 파생 위험을 명시. 단 서브에이전트/태스크 타입 11종은 전부 IDENTICAL 이므로 5장 규약은 무영향. | `07-…md` §7.3 |
| 7 | lock 재생성이 caret 범위 내에서 다른 패키지도 올릴 수 있다는 리스크는 plan 에 있었으나, **어떤 것이 올랐는지 확인 절차**가 없었다. | ✅ 구현함 — resolved 변경 목록을 추출해 아래 구현 보고에 기재. **electron·vite·better-sqlite3 는 불변**, react·typescript-eslint 계열 등 패치 상승만 발생. typecheck·lint·test 전부 green 으로 회귀 없음 확인. | 아래 구현 보고 |

## [구현자 기입] 구현 체크리스트

- [x] AC2 `app/package.json` SDK `0.3.215` → `0.3.220` (정확 핀 유지, 타 의존성 무변경)
- [x] AC1/AC3 `package-lock.json` 삭제 → `npm install` 재생성 (`lockfileVersion:3` · `orca@0.3.1` · SDK 관련 9 엔트리 전부 `0.3.220`)
- [x] AC4 `.github/workflows/**` 무변경 (`git diff --stat main -- .github/` 빈 출력)
- [x] 패키지 실물 인벤토리 + 근거 등급 3층 확정
- [x] AC5 `docs/etc/study/claude/` README + 01~07 (총 1,786줄)
- [x] AC6 mermaid 9개 (flowchart 5 · sequence 3 · state 1)
- [x] AC7 3장 — 블록 shape · 도구 3계열 · `canUseTool` 왕복 · 훅 개입 지점
- [x] AC8 4장 — 도구 이름 확정 · `AgentInput` 스키마 · `parent_tool_use_id` · 컨텍스트 격리
- [x] AC9 5장 — (a)~(h) 8항 전부
- [x] AC10 6장 — 비동기 경로 분기 지점을 콜스택 상에 명시 (§6.7)
- [x] AC11 7장 — 0.3.215↔0.3.220 실측 diff (블록 단위 11종 대조)
- [x] AC12 범위 준수 grep 0건 + "코드에서 확인 안 됨" 표기
- [x] AC13 `docs/AGENTS.md` 인벤토리 행 추가
- [x] AC14 `docs/spec/**` 무변경
- [x] AC15 게이트 lint 0 error / typecheck 3분할 0 / test 146+1165+28 all green
- [x] 문서 간 상호링크 전수 검사 (깨진 링크 0)
- [x] AC16 `{plan,verify}.md` + `INDEX.md` 행

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/package.json`(1줄) · `app/package-lock.json`(삭제→재생성) · `docs/AGENTS.md`(인벤토리 1행) · `docs/etc/study/claude/`(신규 8, 1,786줄) · `docs/handoff/0147-…/{plan,verify}.md`(신규 2) · `docs/handoff/INDEX.md`(1행). **`app/src/**` 변경 0.** |
| 실행 명령 | `npm install` · `npm run lint` · `npm run typecheck` · `npm test` · `npm pack @anthropic-ai/claude-agent-sdk@0.3.215`(델타 비교용) |
| 게이트 결과 | lint **0 error**(pre-existing warning 1 — `useTranscriptVirtualizer.ts:22` react-hooks/incompatible-library, 0146 에서도 동일) / typecheck **3분할 0 error** / vitest **146 files · 1165 tests all pass** + `node --test scripts/*.test.mjs` **28 pass, 0 fail**. 레이어 경계 위반 0(코드 무변경). |
| lock resolved 변경 (직접 의존) | **불변**: electron · vite · better-sqlite3 · zod · zustand · react-router-dom · electron-builder · electron-vite · tailwindcss · typescript · vitest. **상승**: `@anthropic-ai/claude-agent-sdk` 0.3.215→0.3.220(+플랫폼 8종) · `@anthropic-ai/sdk`(peer) · `@tanstack/react-virtual` · react · react-dom · recharts · prettier · undici · postcss · `@typescript-eslint/*` 계열 · react-i18next · `@modelcontextprotocol/sdk` 관련 transitive(hono·jose·es-toolkit 등). 전부 caret 범위 내 패치/마이너. |
| SDK 타입 델타 (0.3.215→0.3.220) | `sdk-tools.d.ts` 10줄 · `sdk.d.ts` 183줄. **서브에이전트/태스크/백그라운드 타입 11종 전부 IDENTICAL.** 유일한 관련 변경 = `AgentInput.mode` 유니언에서 deprecated `"bubble"` 제거(런타임 영향 0). 큐 영역은 `interrupt` 에 `cancel_queued`/`cancelled` 신설(capability `interrupt_cancel_queued_v1`). breaking change 0. |
| 블로커 / 역질문 | 없음. typecheck 가 코드 무변경으로 통과해 plan 의 Open Question("typecheck 파괴 시 bump 유지 vs 롤백")은 **발동하지 않았다**. |
| 대상 커밋 | (아래 verify.md 메타 참조) |

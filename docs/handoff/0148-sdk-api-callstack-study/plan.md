# Plan — 0148-sdk-api-callstack-study

## 메타

| 항목 | 값 |
|---|---|
| slug | `0148-sdk-api-callstack-study` |
| 작성자 | Claude Code |
| 일자 | 2026-07-26 |
| 매핑 | PHASES — 문서 작업(코드 무변경). PR: 브랜치 `claude/sdk-api-analysis-wbntv4` |
| 상태 | DRAFT → READY (비기능 = Claude 직접 구현) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "① claude sdk 를 사용하는 모든 api 를 확인하라 ② 각 api 에 대한 sdk callstack 및 다이어그램, flow를 조사하라 ③ `doc/etc/study/claude` 경로에 업데이트 하라 ④ 업데이트 시 조사할 내용은 기존의 study 방식과 동일하게 하라" | 라이브 세션 요청(2026-07-26) |
| 명시 요구 (확정 1) | 조사 축 = **SDK 표면 × Orca 진입점 교차** — SDK API 를 전수 카탈로그화하고 각 항목에 진입점과 콜스택을 붙인다 | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 (확정 2) | 배치 = `docs/etc/study/claude/` 하위 | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 (확정 3) ★ | "진입점만 따로 분류하고 진입점에서 이어지는 콜스택은 **orca와 분리된 sdk 본연의 분석**으로 이어지도록 하라. 디렉토리분류를 다시해도 좋다" + "**본연분석 = sdk deepdive**" | 라이브 세션 재지시(설계 반려 후) |
| 추론 의도 | (a) "따로 분류" = 경계를 **파일 단위**로 자른다 — Orca 어휘가 등장하는 문서는 `00-진입점-분류.md` 단 하나. (b) 그 결과 2부는 1부의 "SDK 자체만" 스탠스를 상속하므로 **README 범위 절 개정 불필요**(초안에서 철회). (c) 1부와 겹치는 배경은 재서술하지 않고 **절 링크** — 중복은 드리프트 원인. (d) "모든 api" 의 완결성은 채택/비채택·도달/미도달 경계를 그어야 성립하므로 **미사용 표면·미도달 채널도 표에 남긴다**. | 내 해석 (추론) |

## Context (왜)

`docs/etc/study/claude/` 에는 handoff `0147` 이 만든 **SDK 내부 분석 7편**(README + 01~07, 1,786줄, mermaid 9)이 있다. 이 세트는 **주제축**(패키지 구조 · 제어 프로토콜 · tool calling · subagent · 비동기 턴 · 콜스택 · 버전 델타)으로 잘려 있다.

없는 것은 **심볼축**이다 — "실제로 호출되는 SDK API 가 무엇이고, 그 API 하나하나가 SDK 안에서 어떤 스택을 타는가". 이 공백은 이미 비용으로 드러났다: 0135~0143 네 라운드에 걸친 백그라운드 서브에이전트 동작 재발견. `0147` 은 그 반복의 절반(비동기 턴 규약)만 끊었다.

본 핸드오프는 나머지 절반을 **2부 `api/` 세트**로 고정한다. 진입점 분류를 경계 문서 하나로 격리하고, 그 뒤의 모든 문서를 **SDK 딥다이브**로 유지한다(사용자 확정 3).

## 자료조사 (Research)

### SDK 접촉 지점 — 전수

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **유일한 value import 는 `query`**. 나머지는 전부 type-only (`CanUseTool`·`Options`·`PermissionResult`·`SDKMessage`) | `app/src/main/adapters/claude.ts:6-12` |
| `Query` 핸들 메서드 **5종** 호출 — `setModel`·`setPermissionMode`·`interrupt`·`stopTask`·`backgroundTasks` | `claude.ts:445,447,455,458,462,464,466` |
| hook 타입 8종 import | `claude-adapt.ts:7-16` |
| hook 타입 3종 import (가드 훅) | `workspace-guard.ts:15-19` |
| `SDKUserMessage` — 입력 스트림 요소 | `streaming-input.ts:11` |
| `SDKMessage` — 출력 스트림 소비 | `claude-map.ts:10` |
| 패키지/바이너리 해석 (`require.resolve` + asar 언팩 리맵) | `claude-executable.ts:16,19-21` |
| 버전 read (`package.json`) | `claude.ts:197` |
| base SDK `@anthropic-ai/sdk` 타입 2종 (`MessageParam`·`Base64ImageSource`) | `streaming-input.ts:12`, `claude.ts:24` |
| `query()` 호출은 **정확히 2경로** — `runCompletion`(1-shot) / `sendMessage`(장수명 채널) | `claude.ts:230-248`, `:322-391` |

### 진입점 — SDK 도달 경로

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `orca:chat:send` → `SessionRuntime.send` → 스폰 `adapter.sendMessage` / 후속 `live.pushTurn` | `app/chat-turn.ts:965`, `features/sessions/session-runtime.ts:186,224,249` |
| `orca:chat:cancel` → `markAborted` → `interrupt()` | `chat-turn.ts:981`, `session-runtime.ts:462` |
| `orca:chat:stopSubagent` → `backgroundTask()` → `stopTask()` | `chat-turn.ts:1013`, `features/chat/settle.ts:73-76` |
| `orca:permission:setMode` → `Query.setPermissionMode` | `features/approvals/coordinator.ts:85-94` |
| `orca:permission:respond` → **역방향** `canUseTool` 반환값 | `coordinator.ts:77` |
| `orca:backend:list` → `isInstalled()` (SDK *함수* 미호출, package.json read) | `app/handlers/misc.ts:65`, `claude.ts:195-202` |
| `orca:install:start` → 즉시 `done:true` (optionalDependencies 가 바이너리 해소) | `misc.ts:86`, `claude.ts:204-209` |
| 내부 트리거 자동 제목 생성 → `adapter.complete()` → `query()` | `features/chat/title-generation.ts:53` |

### 근거 가용성

| 발견 / 제약 | 레퍼런스 |
|---|---|
| SDK 패키지 실물 확보 — `sdk.d.ts` 307 KB · `sdk-tools.d.ts` 149 KB · `sdk.mjs` 1.25 MB(미니파이) · `manifest.json`. 버전 `0.3.220` = `package.json` 핀 일치 | `npm install --ignore-scripts` 결과, `app/node_modules/@anthropic-ai/claude-agent-sdk/` |
| 1부가 확립한 **근거 등급 3층** (1급 `.d.ts` / 2급 미니파이 `sdk.mjs` / 3급 컴파일 바이너리=관측 불가) | `@docs/etc/study/claude/README.md` "근거 등급" |
| 1부 6장이 딥다이브 밀도의 기준선 — `sdk.mjs` 생존 식별자·로그 문자열 인용 방식(`sdk.mjs::<메서드>`) | `@docs/etc/study/claude/06-콜스택-딥다이브.md` |
| 0147 의 기계 게이트 — `grep -rn 'app/src/\|docs/handoff/' docs/etc/study/claude/` → 빈 출력 | `@docs/handoff/0147-agent-sdk-bump-async-turn-study/verify.md:90` |
| 원문 미러 26편 (2차 근거) | `@docs/spec/claude/agent-sdk/` |

### 디렉토리 재분류 검토 — 01~07 은 **이동하지 않는다**

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 01~07 은 상호 relative 링크가 조밀(앵커 포함, `05-…md` 한 파일에 8건) — 같은 디렉토리 내 이동이면 링크는 살아남는다 | `docs/etc/study/claude/*.md` grep |
| 그러나 **완료된 `0147` 기록이 경로를 인용**한다 — 이동 시 소급 stale. 기록은 소급 수정 대상이 아니다 | `@docs/handoff/0147-…/plan.md:74,165,226,244`, `verify.md:40,90-91` |

→ **1부 제자리 유지 + 2부만 `api/` 하위 신설.** 축이 다르므로(주제축 vs 심볼축) 디렉토리 분리 자체가 분류 신호가 된다.

## 인수 기준 (Acceptance Criteria)

1. `docs/etc/study/claude/api/` 에 `README.md` + `00`~`07` 총 **9 파일**이 존재한다.
2. `api/00-진입점-분류.md` 가 진입점을 **4계열**(정방향 호출 / 역방향 콜백 / 스트림 / 비호출 표면)로 분류하고, 진입점 → SDK 심볼 매핑표에 `파일:라인` 근거를 단다.
3. `api/00` 이 **미도달 채널 목록**을 명시한다.
4. `api/00` 이 콜스택을 서술하지 않고 각 api 문서로 링크만 한다 (경계 선언 §0.4 존재).
5. **`api/01`~`07` 에 `app/src/` 인용·"Orca"·"어댑터"·`orca:` 채널명이 0** — `grep` 빈 출력로 기계 검증.
6. **딥다이브 깊이** — `api/01`~`07` 이 각각 6단 골격(①시그니처 ②SDK 내부 콜스택 ③wire 프레임 ④구현 디테일 ⑤다이어그램 ⑥관측 불가 구간)을 **모두** 채운다. ②는 `sdk.mjs` 식별자/로그 문자열 인용을 최소 1건, ⑥은 "코드에서 확인 안 됨" 항목을 최소 1건 포함한다. 시그니처 요약 수준은 FAIL.
7. 사용 중인 SDK 심볼이 **빠짐없이** 어느 api 문서엔가 배정된다 — `query` · `Query` 메서드 5종 · `CanUseTool`/`PermissionResult` · hook 타입 8종 · `SDKUserMessage` · `SDKMessage` · `Options` · 실행파일/패키지 해석 · base SDK 2타입.
8. 신규 mermaid **10개**(flowchart 5 · sequence 4 · state 1)가 인라인이며 문법 오류가 없다.
9. `api/README.md` 가 목차 + 근거 등급 상속 고지 + 1부 상호참조표 + 스냅샷 고지를 담는다.
10. 루트 `README.md` 에 2부 행이 추가되고 다이어그램 수가 19 로 갱신된다. **범위 절과 01~07 본문은 무변경.**
11. `docs/AGENTS.md` 인벤토리 행이 1부/2부 구조로 갱신된다.
12. 모든 사실 주장에 근거가 붙는다 — SDK 는 `.d.ts` 라인 또는 1부/원문 미러 링크, 진입점은 `파일:라인`. 미확인은 "코드에서 확인 안 됨" 분리 표기.
13. `app/src/**` · `app/package.json` 무변경 (코드 변경 0 · 신규 의존성 0).
14. handoff `0148-sdk-api-callstack-study/{plan.md,verify.md}` + `INDEX.md` 행 + `PHASES.md` 정합.

## 범위 / 비범위

- **범위**: `docs/etc/study/claude/api/` 9 파일 신설 · 루트 `README.md` 인덱스 최소 개정 · `docs/AGENTS.md` 인벤토리 1행 · 핸드오프 문서 3종(plan/verify/INDEX 행).
- **비범위**:
  - 01~07 본문 개정 (무변경 — AC10).
  - README **범위 절** 개정 (2부도 SDK 자체만 다루므로 불필요 — 초안에서 철회).
  - `app/**` 코드 변경 · SDK 버전 bump.
  - Orca 통합 레이어의 *설계 평가/개선 제안* — 본 세트는 기술(記述)이지 처방이 아니다. 개선안이 필요하면 별도 핸드오프.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 것: SDK 패키지 실물(`sdk.d.ts`·`sdk-tools.d.ts`·`sdk.mjs`·`manifest.json`) + 원문 미러 `@docs/spec/claude/agent-sdk/` + 1부 01~07.
- 전제: `npm install --ignore-scripts` 로 `node_modules` 확보 (완료 — `postinstall` 미실행이라 better-sqlite3 ABI 불변, `@app/AGENTS.md` egress/ABI 가이드 준수).
- **신규 의존성 없음.** `package.json` 무변경.

## 설계

### 최종 디렉토리

```
docs/etc/study/claude/
├── README.md                          # 인덱스에 2부 행 추가 (범위 절 유지)
├── 01~07-*.md                         # 무변경 — 1부: 주제축
└── api/                               # 신규 — 2부: 심볼축 SDK API 딥다이브
    ├── README.md
    ├── 00-진입점-분류.md               # ★ 경계 문서 — Orca 서술은 여기서 끝
    ├── 01-query-호출-생명주기.md
    ├── 02-입력-경로-SDKUserMessage.md
    ├── 03-출력-경로-SDKMessage.md
    ├── 04-제어-메서드-setModel-setPermissionMode-interrupt.md
    ├── 05-태스크-제어-stopTask-backgroundTasks.md
    ├── 06-역방향-콜백-canUseTool-hooks.md
    └── 07-Options-표면과-실행파일-해석.md
```

### 경계 규칙 (설계의 핵심 — 기계 검증)

| 문서 | Orca 언급 | 내용 |
|---|---|---|
| `api/00` | **허용 (유일)** | 진입점을 분류하고 각 진입점이 **어느 SDK 심볼로 들어가는지**까지만. 콜스택 서술 금지 — 해당 문서로 링크하고 끝낸다. |
| `api/01~07` | **금지** | 순수 SDK 딥다이브. `app/src/` 인용 0, "Orca"·"어댑터"·IPC 채널명 0. 1부와 동일한 근거 등급·인용 방식. |

### 딥다이브 6단 골격 (`api/01`~`07` 공통)

| 단 | 내용 | 근거 등급 |
|---|---|---|
| ① 시그니처 | 타입 계약 원문 인용 (`sdk.d.ts` / `sdk-tools.d.ts` 라인) | 1급 |
| ② 콜스택 | 호출 순간부터 CLI 경계까지 SDK 내부 프레임을 순서대로. `sdk.mjs::<메서드>` / `sdk.mjs "<문자열>"` 인용 | 2급 |
| ③ wire 프레임 | 오가는 JSONL 프레임 shape, request_id 상관, snake_case↔camelCase 매핑 | 1급 |
| ④ 구현 디테일 | 멱등 가드 · 취소 배선 · 센티널 · lazy/eager 성질 · 실패 모드 | 2급 |
| ⑤ 다이어그램 | mermaid (sequence 또는 flowchart) | — |
| ⑥ 관측 불가 구간 | CLI 바이너리 내부라 확정 못 하는 판정 로직을 "코드에서 확인 안 됨" 으로 열거 | 3급 |

⑥ 은 생략 가능한 부록이 아니다 — 1부가 신뢰를 얻은 이유가 확정/미확정 경계를 정직하게 그은 데 있다.

### 문서별 대상 심볼

| 문서 | 대상 심볼 | 다이어그램 |
|---|---|---|
| `01` | `query()` — 옵션 정규화 → 클래스 생성 → `connectSdkMcpServer` → 펌프 발사 → `initialize` → lazy spawn. string vs AsyncIterable 분기 | sequence 1 + flowchart 1 |
| `02` | `SDKUserMessage` — 필드 계약 · eager drain · stdin 프레이밍 · 큐 admission · generator return = 세션 종료 | flowchart 1 |
| `03` | `SDKMessage` — stdout 펌프 → 프레임 분기 → 유니언 전수 + `tool_use_result` 별도 경로 · `includePartialMessages` | flowchart 1 |
| `04` | `setModel`·`setPermissionMode`·`interrupt` — control RPC 왕복 · 상관/취소 · 스트리밍 입력 전제 · `cancel_queued` | sequence 1 |
| `05` | `stopTask`·`backgroundTasks` — `task_id` ↔ `tool_use_id` · foreground 거부 · 승격 의미 · 상태 전이 | sequence 1 + state 1 |
| `06` | `canUseTool`·`hooks` — 역방향 요청 shape · `PermissionResult` · `options.signal` · `HookEvent` · 평가 순서 · 응답 억제 센티널 | sequence 1 + flowchart 1 |
| `07` | `Options`·`pathToClaudeCodeExecutable` — 필드→CLI 플래그 번역 · `extraArgs` 이스케이프 · `settingSources` · `resume`+`forkSession` · 실행파일 해석 | flowchart 1 |

합계 신규 mermaid **10** (00 의 flowchart 1 포함).

### 중복 방지

1부와 2부는 **같은 사실을 다른 축으로 색인**한다. 2부는 1부 서술을 복사하지 않고 **절 링크 + 심볼 관점 델타**만 쓴다. 예: `api/04` 는 control RPC 일반론을 1부 2.1절 링크로 대체하고 `setPermissionMode` 고유의 subtype·전제·실패 모드만 서술한다.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

UI 없음 — 문서 작업이라 로딩/테마/a11y 는 `N/A`. 대신 **문서가 반드시 다뤄야 할 내용 엣지케이스**:

1. **역방향 화살표** — `canUseTool`/`hooks` 는 SDK 가 호스트를 부른다. 00 의 계열 B 와 06 다이어그램에서 방향 명시 구분.
2. **비호출 표면(계열 D)** — 패키지 버전 read·바이너리 경로 해석은 SDK *함수*를 안 부른다. 계열로 구분해야 전수가 정직해진다.
3. **`extraArgs` 이스케이프 해치** — `replay-user-messages` 는 `Options` 1급 필드가 아닌 bare flag. 타입 계약 밖 표면으로 07 에 별도 표기.
4. **두 식별자 체계** — `task_id`(태스크) vs `tool_use_id`(도구 호출). 05 의 핵심 혼동 지점.
5. **스트리밍 입력 모드 전제** — 제어 메서드는 `prompt` 가 AsyncIterable 일 때만 동작. 04·05 전제 조건 절에 명시.
6. **스냅샷 고지** — 2부는 `0.3.220` 스냅샷. 1부 7장과 같은 톤으로 `api/README.md` 말미에.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 1부와 2부 서술 중복 → 드리프트 | 2부는 링크 + 심볼 델타만. 중복 발견 시 verify FAIL |
| 경계 규칙이 무너져 api/01~07 에 Orca 가 샘 | **기계 게이트** — `grep` 빈 출력이 AC5 (0147 AC12 계승) |
| 문서 비대화 (1부 1,786줄 + 2부) | 표 위주 · 링크 우선. 2부 목표 1,000~1,300줄 |
| `npm install` 이 ABI 를 뒤집어 `dev/build` 를 깨뜨림 | `--ignore-scripts`(postinstall 미실행 = ABI 불변). 게이트는 ABI-중립 `lint`+`typecheck` 로 한정 |
| 01~07 미이동으로 디렉토리 비대칭 | README 인덱스가 두 축을 설명. 이동 시 `0147` 기록 stale 이 더 큰 비용 |

- 되돌리기 어려운 결정: 없음(문서 추가, 기존 본문 무변경).
- **단독 결정 금지 항목(Open Question)**: 없음 — PRD §11 / TRD §15 미저촉.

## 영향 받는 파일

- `docs/etc/study/claude/api/{README,00,01,02,03,04,05,06,07}.md` (신규 9)
- `docs/etc/study/claude/README.md` (인덱스 최소 개정)
- `docs/AGENTS.md` (인벤토리 1행)
- `docs/handoff/0148-sdk-api-callstack-study/{plan,verify}.md` · `docs/handoff/INDEX.md` · `docs/PHASES.md`
- **`app/**` 무변경** (`package-lock.json` 포함 — `npm install --ignore-scripts` 는 lock 을 바꾸지 않아야 하며, 바뀌면 되돌린다)

## 참고 문서

- `@docs/etc/study/claude/` 01~07 (1부 — 링크 대상)
- `@docs/spec/claude/agent-sdk/` (원문 미러 — 2차 근거)
- `@docs/IPC_CONTRACT.md` §2 (채널 계약 SSOT — 00 이 링크만)
- `@docs/handoff/0147-agent-sdk-bump-async-turn-study/` (형식·게이트 선례)
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` (ABI-중립). 문서 전용이라 `npm test` 는 불요 — DB 스위트가 ABI 를 Node 로 뒤집는 부작용만 있고 검증 가치가 없다.
- 신규 테스트 요구: 없음 (코드 변경 0).
- **문서 전용 기계 게이트** (AC 대조):
  - `grep -rn 'app/src/\|orca:\|Orca\|어댑터' docs/etc/study/claude/api/0[1-7]-*.md` → 빈 출력 (AC5)
  - `grep -c '```mermaid' docs/etc/study/claude/api/*.md` → 합계 10 (AC8)
  - `git diff --stat docs/etc/study/claude/0[1-7]-*.md` → 빈 출력 (AC10)
  - `git status --short app/` → 빈 출력 (AC13)

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고(재지시 3건 포함), 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 14개 번호가 매겨졌고, 자료조사에 근거하며, 기계 검증 가능한 항목을 포함한다.
- [x] 의존 기술 — SDK 패키지 실물 확보를 전제로 명시했고, 신규 의존성 0 을 확인했다.
- [x] 파생 UX — UI 없음(`N/A`)을 밝히고 내용 엣지케이스 6종으로 대체했다.
- [x] 리스크 — 경계 붕괴·중복·ABI 뒤집힘을 적고 완화책을 붙였다. Open Question 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (본 건은 비기능 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: (구현 턴에서 기입)
- 이견 / 우려: (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| | (구현 턴에서 기입) | | |

## [구현자 기입] 구현 체크리스트

- [ ] `api/00-진입점-분류.md`
- [ ] `api/01`~`07` 딥다이브 7편
- [ ] `api/README.md`
- [ ] 루트 `README.md` 인덱스 개정
- [ ] `docs/AGENTS.md` 인벤토리 1행
- [ ] 기계 게이트 4종 + lint/typecheck

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (구현 턴에서 기입) |
| 실행 명령 | `npm run lint` / `typecheck` + 문서 기계 게이트 4종 |
| 게이트 결과 | (구현 턴에서 기입) |
| 블로커 / 역질문 | (구현 턴에서 기입) |
| 대상 커밋 | (구현 턴에서 기입) |

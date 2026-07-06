# Plan — 0075-workspace-isolation-perms

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: 의도 → 조사 → 설계 → 리스크.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0075-workspace-isolation-perms` |
| 작성자 | Claude Code |
| 일자 | 2026-07-06 |
| 매핑 | PHASES 승격(구현 시) / PR (요청 시) |
| 상태 | DRAFT → READY (비기능 보안 하드닝 = Claude 직접 plan→impl→verify) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 74 핸드오프를 참고하여 **75 를 작성 및 구현**하라 — sandbox/docker/wsl/appcontainer 없이 **작업 폴더 밖(허용외) 모든 경로의 r/w 접근을 막는** workspace 격리를 **실제 코드로 구현**한다. | 라이브 세션 요청 |
| 명시 요구 | `~/.claude`(plugin/skill)·`~/.config/orca/`(plugin) 및 node/python skill **실행**에 필요한 경로의 **read 허용**(예외). read 없이도 동작하면 무시 가능. | 라이브 세션 요청 |
| 명시 요구 | `options.additionalDirectories` 는 추후 지정 주입 전까지 **기본 비움**(`[]`). | 라이브 세션 요청 |
| 명시 정정 | read 예외의 예외 — `~/.config/orca/projects/<...>`(세션 cwd)는 **write 가능**해야 한다(cwd 대상이므로). | 라이브 세션 정정 |
| 명시 정정(r2) | `~/.claude` 는 **write 도 허용**하라 — plan 모드 산출물·skill 설치 요구가 올 수 있음. | 라이브 세션 정정(r2) |
| 명시 결정(AskUserQuestion) | 격리 강도 = **경로 격리만**. `disallowedTools`(sudo/curl/wget) 미도입 — 네트워크/명령은 기존 canUseTool 승인 카드 담당. | 이번 세션 AskUserQuestion 응답 "경로 격리만 (권장)" |
| 명시 결정(AskUserQuestion) | read 예외를 **처음부터 포함**(test-first 최소권한 아님). | 이번 세션 AskUserQuestion 응답 "처음부터 포함 (권장)" |
| 추론 의도 | 격리 계층 = **PreToolUse 훅**(모드-독립), 안·예외는 `allow` 아닌 **pass-through** — 74 가이드의 설계 결론을 그대로 코드화. | 내 해석 — 74 가이드(§1·§3.1)에서 파생(§설계) |

## Context (왜)

74 핸드오프(`docs/handoff/0074-workspace-isolation-guide/`)는 SDK 코드레벨 workspace 격리의 **범용 가이드**(`docs/guides/workspace-isolation-permissions.md`)만 산출했고, 실제 Orca 어댑터에는 **미배선**이다. 오늘 `app/src/main/adapters/claude.ts` 의 `query()` 옵션에는 `additionalDirectories`·`disallowedTools`·workspace-guard 훅이 **전혀 없어**, 격리 표면은 `cwd`(세션별 디렉토리) + 위험도구 `canUseTool` 승인 카드뿐이다. 모델이 `Read /etc/passwd`·`Bash cat ../../secret` 로 작업 폴더 밖을 접근하는 것을 막을 계층이 없다.

75 는 74 가이드를 **실제 코드로 구현**한다: 작업 폴더 밖 모든 경로의 r/w 를 막는 **PreToolUse 워크스페이스 가드 훅**을 어댑터에 배선한다. 가드는 permissionMode 와 독립(평가 1순위)이고, 작업 폴더 *안*은 `allow` 가 아니라 **pass-through(`{}`)** 를 반환해 기존 승인 카드·plan·acceptEdits 흐름을 보존한다.

## 자료조사 (Research)

> "직접 fetch·검증"과 "내부 코드"를 구분한다.

### 외부 웹 (SDK 공식 문서 — 이번 세션 직접 fetch)

| # | 발견 / 제약 | 레퍼런스 (URL) |
|---|---|---|
| W1 | 권한 평가 순서 = Hooks → Deny → Ask → Permission mode → Allow → canUseTool. **Hooks 최우선**, hook `deny` 는 `bypassPermissions` 에서도 유효. 문서 권고: *"For checks that must run on every tool call, use a PreToolUse hook."* | https://code.claude.com/docs/en/agent-sdk/permissions |
| W2 | hook `allow` 는 mode·allow rule·canUseTool 을 **건너뛴다** → 안-경로에 `allow` 반환 시 승인 카드/plan/acceptEdits 우회. 그래서 안·예외는 pass-through(`{}`). | https://code.claude.com/docs/en/agent-sdk/permissions |
| W3 | `acceptEdits` 는 cwd/`additionalDirectories` **안** 파일연산만 자동 승인. `additionalDirectories` 가 SDK 내장 파일툴 write 스코프를 확장. | https://code.claude.com/docs/en/agent-sdk/permissions |
| W4 | `canUseTool` 계약(`{behavior:'allow',updatedInput}` / `{behavior:'deny',message}`) — 안-경로 pass-through 후 도달할 승인 계층. | https://code.claude.com/docs/en/agent-sdk/user-input |

### 내부 코드 (구현 지점 — Explore 확인)

| # | 발견 | 레퍼런스 |
|---|---|---|
| C1 | `sendMessage` 가 `query()` 옵션을 조립하며 `withPostCompactHook(mergeHooks(adaptHooks(...), steerGate), ...)` 로 훅을 합성한다. **여기에 PreToolUse 가드 조각을 mergeHooks 인자로 추가**한다. `cwd` 는 이미 옵션에 있다. | `app/src/main/adapters/claude.ts:307-366` |
| C2 | 어댑터 내부 훅 조각 패턴 = `makeSteerGateHook` 이 `{hooks:{PostToolBatch:[{hooks:[cb]}]}}` 반환. 가드도 **동형**으로 `{hooks:{PreToolUse:[{hooks:[cb]}]}}` 반환. `mergeHooks` 가 이벤트별 매처 concat. | `app/src/main/adapters/claude-adapt.ts:138,158` |
| C3 | 경로 판정 술어 `isWithinDir(child, parent)`(정규화+`..` 탈출 차단)·`orcaConfigDir()`(=`~/.config/orca`) 이미 존재 — 가이드의 `isInside` 대신 재사용. adapters→infra import 허용. | `app/src/main/infra/config/paths.ts:54,28` |
| C4 | 세션 cwd 는 `~/.config/orca/projects/default`(또는 `<이름>-<id>`) — `~/.config/orca` 의 하위. → write 판정은 cwd(writeRoots)만 봐야 read-only 예외가 cwd 쓰기를 막지 않는다(사용자 정정). | `app/src/main/infra/config/paths.ts:83-92` |
| C5 | 위험도구 승인은 `makeCanUseTool` 이 `canUseTool` 로 소비(Bash/Write/Edit → 승인 카드, 안전도구 → allow passthrough). 가드는 그 **앞** 계층이라 승인 로직 불변. | `app/src/main/adapters/claude.ts:89-176` |
| C6 | `runCompletion`(제목 생성)은 `tools:[]`·`allowedTools:[]` — 도구 없음 → 가드 불필요. | `app/src/main/adapters/claude.ts:225-237` |

## 인수 기준 (Acceptance Criteria)

1. `sendMessage`(`claude.ts`)의 `query()` 옵션에 **PreToolUse 워크스페이스 가드 훅**이 배선되어, cwd+`additionalDirectories`+read예외 **밖** 경로를 노린 `Read/Write/Edit/Glob/Grep/Bash` 를 `deny` 한다.
2. 작업 폴더 **안**·read 예외 경로는 훅이 **pass-through(`{}`)** 를 반환한다(`allow` 아님) — 기존 `makeCanUseTool` 승인 카드·`permissionMode`(plan/acceptEdits) 흐름이 그대로 도달·동작한다.
3. 예외 경로는 write 허용 여부로 2분한다(r2). **write 예외**: `~/.claude`(plan 산출물·skill 설치 — read+write 허용). **read-only 예외**: `~/.config/orca`·node/python 런타임(read 허용, write 차단). **단 세션 cwd(`~/.config/orca/projects/<...>`)는 write 허용** — write 판정은 `writeRoots`(=cwd+additionalDirs+`~/.claude`)만 참조하므로 read-only 예외가 cwd·`~/.claude` 쓰기를 막지 않는다.
4. `additionalDirectories` 기본 `[]`, **옵션과 훅이 단일 배열을 공유**(드리프트 0)하고 향후 주입 지점이 코드에 명시된다.
5. 격리는 **모드 독립**(훅이 평가 1순위) — `permissionMode` 를 강제하지 않고 `dontAsk` 를 도입하지 않는다.
6. 순수 로직(경로 판정·툴별 경로 추출·Bash 스크리닝)에 **단위 테스트**를 붙이고 게이트(lint/typecheck/test)를 통과한다.
7. `runCompletion`(제목 생성) 경로는 도구가 없어 가드 미적용 — 이유를 주석/plan 에 명시.
8. 74 가이드를 참조하되 구현 편차(`isWithinDir` 재사용·`runCompletion` 제외)를 문서화한다.

## 범위 / 비범위

- **범위**: `claude.ts sendMessage` 에 PreToolUse 가드 훅 배선 + `additionalDirectories:[]` 주입 + 신규 `workspace-guard.ts`(+테스트).
- **비범위**: `disallowedTools`(사용자 "경로 격리만" 결정)·`allowedTools` 표면 축소·`additionalDirectories` 실 주입 소스(TurnRequest plumbing)·opencode 어댑터·OS 레벨 격리.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 의존: `@anthropic-ai/claude-agent-sdk` 훅 타입(`HookCallback`·`PreToolUseHookSpecificOutput`), `node:path`·`node:os`, 기존 `isWithinDir`/`orcaConfigDir`/`mergeHooks`.
- 전제: 세션 cwd 는 `~/.config/orca/projects/` 하위(paths.ts). skill/plugin **로딩**은 CLI 내부라 훅 미개입 — 훅은 모델 툴 호출만 본다. node/python skill **실행**(Bash)·번들 파일 read 는 훅 개입이라 read 예외 필요.
- **신규 의존성**: 없음.

## 설계

### 신규 파일 `app/src/main/adapters/workspace-guard.ts`
`makeSteerGateHook`(claude-adapt.ts:138)와 동형 — `{ hooks: { PreToolUse: [{ hooks: [callback] }] } }` 반환.

- `export function makeWorkspaceGuardHook(workspaceRoot: string, additionalDirs?: string[]): object`
  - `writeRoots = [workspaceRoot, ...additionalDirs, ...writeExceptionRoots()]`(resolve; write 예외=`~/.claude`, r2). `readRoots = [...writeRoots, ...readOnlyExceptionRoots()]`(read-only 예외=`~/.config/orca`·런타임).
  - `callback: HookCallback` — `deny` = `{hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason}}`, 통과 = `{}`.
  - WRITE(`Write`,`Edit`) → `file_path` 를 **writeRoots 만** 검사. READ(`Read`,`Glob`,`Grep`) → `file_path`/`path` 를 readRoots 검사(경로 생략 시 pass). `Bash` → `screenBashCommand`. 그 외 → pass-through.
- **write 판정 불변식**: WRITE 분기는 read-only 예외를 절대 참조하지 않음 → cwd(`~/.config/orca/projects/...`) 하위 write 허용, `~/.config/orca/sources` write 차단(AC3).
- 순수 헬퍼 named export: `screenBashCommand(cmd, ws, readRoots)`·`readOnlyExceptionRoots()`·경로 추출 — 단위 테스트 대상.
- 재사용: `isWithinDir`·`orcaConfigDir`(paths.ts). 예외 = write:`~/.claude`(r2) · read-only:`orcaConfigDir()`·`dirname(process.execPath)`(런타임).
- Bash 스크리닝 = 가이드 §3.5 그대로(절대경로 토큰·`../` 탈출·홈 확장, `~/.claude`·`~/.config/orca` 예외). best-effort 한계 주석 명시.

### 배선 `app/src/main/adapters/claude.ts` `sendMessage`
1. `import { makeWorkspaceGuardHook } from './workspace-guard'`.
2. 옵션 조립부(:339)에서 로컬 `const additionalDirectories: string[] = []`(주입 지점 주석) 선언 후:
   - `mergeHooks(adaptHooks(...), makeWorkspaceGuardHook(cwd, additionalDirectories), steerGate|{})`.
   - 옵션에 `additionalDirectories,` 주입(동일 배열 — §4).

### 미변경
`runCompletion`(도구 없음)·`makeCanUseTool`·permissionMode 흐름·TurnRequest 스키마.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- Glob/Grep `path` 생략 = cwd(=workspace) 기준 → pass-through.
- 상대경로는 `path.resolve(ws, rawPath)` 후 판정(`../` 탈출 차단).
- Bash 정적 파싱은 `eval`·`$HOME`·파이프·base64 우회 미차단 — 한계(§리스크).
- `/usr/bin/python3 script.py` 류 정상 명령의 절대 interpreter 경로 오차단 가능 → 런타임 예외 루트 포함 + verify skill 실행 확인.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 | 완화 |
|---|---|
| Bash 정적 격리 불완전(`eval`/`$HOME`/파이프/base64) | 74 §8 한계 계승 — "OS 샌드박스 대체 아님, 실수/오작동 방지 수준". 주석·verify 명시. |
| Bash 절대경로 화이트리스트가 정상 명령 오차단 | 런타임 read 예외에 `dirname(process.execPath)` 포함 + verify skill 실행 확인, 오차단 시 readRoots 최소 추가. |
| E2E(실 CLI 가 밖 경로 deny)는 auth 필요 | 순수 로직 단위 테스트로 판정 커버, 모드별/skill 체크리스트는 verify 사람 검증 항목으로 분리. |

- 되돌리기 어려운 결정: 없음. **Open Question: 없음**(격리 강도·read 예외 모두 사용자 확정).

## 영향 받는 파일

- `app/src/main/adapters/workspace-guard.ts` (신규 — 가드 훅 + 순수 헬퍼)
- `app/src/main/adapters/workspace-guard.test.ts` (신규 — 단위 테스트)
- `app/src/main/adapters/claude.ts` (배선 — import + mergeHooks 인자 + additionalDirectories)
- `docs/handoff/INDEX.md` (본 행) · `docs/handoff/0075-workspace-isolation-perms/{plan,verify}.md`

## 참고 문서

- 74 가이드: `docs/guides/workspace-isolation-permissions.md` (설계 근거·훅 구현·모드별 표·한계)
- 74 핸드오프: `docs/handoff/0074-workspace-isolation-guide/{plan,verify}.md`
- 외부: W1~W4 URL(자료조사). 내부: `claude.ts`·`claude-adapt.ts`·`paths.ts`.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `workspace-guard.test.ts` — 밖 deny / 안 pass-through / read 예외 read허용·write차단 / cwd 하위 write 허용 / Bash 스크리닝 / additionalDirectories 확장.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구·정정·AskUserQuestion 결정을 라이브 세션 출처로 인용, 추론은 추론 표기.
- [x] 자료조사 — 발견마다 레퍼런스(URL·`파일:라인`) 부착, fetch/코드 구분.
- [x] 인수 기준 — 번호·검증가능·조사 근거.
- [x] 의존 기술 — 식별, 신규 의존성 0.
- [x] 파생 UX — Glob 생략·상대경로·Bash 한계·interpreter 오차단 펼침.
- [x] 리스크 — 정적격리 한계·오차단·E2E 제약 + 완화, Open Question 0.

---

> **[구현자 기입]** — 비기능 보안 하드닝이라 Claude 가 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 격리를 `makeSteerGateHook` 과 동형인 어댑터 내부 훅 조각으로 두고 `mergeHooks` 로 합성하는 배치가, 기존 훅 인프라(§C2)를 그대로 재사용하면서 permissionMode·canUseTool 을 건드리지 않는 최소 침습 지점이었다. `isWithinDir`/`orcaConfigDir` 재사용으로 신규 술어 0.
- 이견 / 우려: 없음. 단 §리스크의 Bash 정적 스크리닝 한계는 코드 주석·verify 에서 명시적으로 경고해야 오용을 막는다(반영함). SDK 타입(`Options.additionalDirectories`·`PreToolUseHookSpecificOutput`)을 d.ts 로 실검증(1168·2028행)해 배선 전 필드명을 확정했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | Bash 절대경로 정규식이 URL(`//host`)·literal `~/.claude` 를 오차단할 수 있음(rule1 이 rule3 예외보다 먼저 발화) | ✅ 코드 주석 + verify 한계로 명시. 구조 파일툴(Read/Write/Edit)은 절대경로 정상 판정이라 skill 실행은 절대경로 경유(§전제)로 통과 — Bash literal `~` 는 best-effort 한계로 수용 | 가이드 §3.5 한계 계승 |
| 2 | `guardToolAccess` 를 순수 함수로 분리 안 하면 콜백만 테스트 가능해 커버리지 약함 | ✅ 구현함 — `guardToolAccess`·`screenBashCommand`·`resolveGuardRoots`·`readOnlyExceptionRoots` 를 named export 로 분리해 순수 단위 테스트 | 요구6 |

## [구현자 기입] 구현 체크리스트

- [x] `workspace-guard.ts` + 순수 헬퍼 named export (`makeWorkspaceGuardHook`·`guardToolAccess`·`screenBashCommand`·`resolveGuardRoots`·`readOnlyExceptionRoots`)
- [x] `workspace-guard.test.ts` (22 케이스)
- [x] `claude.ts` 배선(import + `mergeHooks` 인자 + `additionalDirectories` 옵션, 동일 배열 공유)
- [x] 게이트 통과 (lint/typecheck/test)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/workspace-guard.ts`(신규; r2 에서 `writeExceptionRoots()` 분리) · `workspace-guard.test.ts`(신규 23 케이스) · `claude.ts`(import 1 + 옵션 `additionalDirectories` + `mergeHooks` 가드 인자) |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `npx vitest run` |
| 게이트 결과 | typecheck ✅(node·web·test 3종) / lint ✅(경계 위반 0, prettier 정렬만) / test: `workspace-guard.test.ts` **22/22** + 전체 **694 passed** / 21 failed(**전부 better-sqlite3 bindings 미빌드·electron 미설치 환경 제한 — `--ignore-scripts` 설치, 본 변경 무관**, 0007 이후 누적 계열) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (impl 커밋 — INDEX 기재) |

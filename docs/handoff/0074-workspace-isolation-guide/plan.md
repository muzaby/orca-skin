# Plan — 0074-workspace-isolation-guide

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: 의도 → 조사 → 설계 → 리스크.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0074-workspace-isolation-guide` |
| 작성자 | Claude Code |
| 일자 | 2026-07-06 |
| 매핑 | PR #192 / 커밋 `a6bc047` |
| 상태 | DRAFT → READY (비기능 = Claude 직접 plan→impl→verify) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | sandbox/docker/wsl/appcontainer 없이 **작업 폴더 밖 모든 경로의 r/w 차단**. SDK 코드레벨(`settings.json` 미사용)로만 구성. 그 **가이드 문서**를 작성하라. | 라이브 세션 요청 + 첨부 초안 `workspaceisolationguide.md` |
| 명시 요구 | `~/.claude`(plugin/skill)·`~/.config/orca/`(plugin) 및 node/python skill 실행에 필요한 read 는 허용. read 없이도 동작하면 무시 가능. | 라이브 세션 요청 |
| 명시 요구 | `options.additionalDirectories` 는 추후 주입 전까지 **기본 비움**(`[]`). | 라이브 세션 요청 |
| 명시 정정(결정적) | `plan` 모드·`AskUserQuestion`·`ExitPlanMode` 등 "계획 후 자동으로 작업이 넘어가는" 대화형 흐름은 **동작해야 하고**, *각 모드에서* 작업 폴더 밖으로 못 나가는 것이 목표. | 라이브 세션 정정("정정한다 … 각 모드에서 의도처럼 작업공간 밖으로 못넘어가게") |
| 명시 요구 | 범위 = **범용 독립 가이드**(특정 코드베이스 비종속). | AskUserQuestion 응답("범용 독립 가이드") |
| 명시 요구 | 이 작업을 **핸드오프 문서로 작성**하고 **출처 사이트를 모두 표기**하라. | 라이브 세션 요청("핸드오프 문서 작성하라 출처 사이트 모두 표기할것") |
| 추론 의도 | 초안의 `permissionMode: "dontAsk"` 전제는 위 정정과 충돌하므로 폐기하고, 격리를 모드-독립 계층(PreToolUse 훅)으로 옮긴다. | 내 해석 — 정정 요구에서 파생(§설계) |

## Context (왜)

사용자가 Agent SDK 코드레벨로 workspace 격리 권한 구성을 만들려 하고, 그 근거를 담은 **가이드 문서**를 원한다. 첨부 초안은 `permissionMode: "dontAsk"` + PreToolUse 훅 조합을 제안했다. 초안을 실제 SDK 문서와 대조·검증하고, 사용자 정정(대화·자동진행 흐름 유지)을 반영해 **모드-독립 격리** 설계로 다시 쓴 표준 가이드를 산출한다.

## 자료조사 (Research)

> **출처 사이트 전량 표기** (사용자 요구). "직접 fetch·검증"과 "사용자 제공 참조"를 구분한다.

### 외부 웹 (SDK 공식 문서)

| # | 발견 / 제약 | 레퍼런스 (URL) | 확인 방식 |
|---|---|---|---|
| W1 | `permissionMode` 유효값은 `default`·`dontAsk`·`acceptEdits`·`bypassPermissions`·`plan`·`auto`. `dontAsk` 는 **실재**하고 그 모드에서 `canUseTool` 은 호출되지 않는다 → 초안 전제는 사실. | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W2 | `dontAsk` 는 `AskUserQuestion`·`requiresUserInteraction` MCP 도구를 **자동 거부**한다(원문: *"In dontAsk mode both cases are denied instead, because that mode never prompts"*). → 초안 유지 시 대화형 흐름 붕괴. | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W3 | 권한 평가 순서 = Hooks → Deny → Ask → Permission mode → Allow → canUseTool. **Hooks 가 최우선**이고 hook `deny` 는 `bypassPermissions` 에서도 유효(*"a hook deny applies even in bypassPermissions mode"*). 문서 권고: *"For checks that must run on every tool call, use a PreToolUse hook."* | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W4 | hook `allow` 는 deny·ask 는 거치되 **mode·allow rule·canUseTool 을 건너뛴다** → 작업 폴더 안 경로에 `allow` 반환 시 승인 카드/plan/acceptEdits 로직이 우회됨. | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W5 | `allowedTools` 는 승인만 확장(미포함 툴도 존재→mode 로 낙하). `disallowedTools` 의 이름-only(`Bash`)는 툴 제거, 패턴(`Bash(rm *)`)은 명령별 deny(bypass 에서도 유효). | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W6 | `acceptEdits` 는 작업 폴더/`additionalDirectories` **안** 파일 연산만 자동 승인, 밖은 프롬프트. `plan` 은 편집을 canUseTool 로 라우팅. | https://code.claude.com/docs/en/agent-sdk/permissions | **직접 fetch·검증** |
| W7 | `canUseTool` 콜백 계약(런타임 승인·`AskUserQuestion`/`ExitPlanMode` 처리) — 초안이 다루지 않은 대화형 흐름의 근거. | https://code.claude.com/docs/en/agent-sdk/user-input | 사용자 제공 참조 (W1~W6 이 교차 커버) |
| W8 | `settings.json` permission rules(allow/deny/ask) 문법 — 본 구성은 코드레벨이라 미사용, 계층 대응 확인용. | https://code.claude.com/docs/en/settings | 사용자 제공 참조 |
| W9 | PreToolUse 훅 출력 스키마(`hookSpecificOutput`·`permissionDecision`·`permissionDecisionReason`) — W3 문서가 참조하는 훅 스펙. | https://code.claude.com/docs/en/agent-sdk/hooks | 참조(W1 문서에서 링크) |

### 사용자 첨부

| # | 발견 | 레퍼런스 |
|---|---|---|
| A1 | 초안: `dontAsk` + PreToolUse 훅 + 밖-경로 `deny`/안-경로 `allow` 3계층 제안. 검증 결과 dontAsk 계층이 정정과 충돌 → 재설계 기준선. | 첨부 `workspaceisolationguide.md` (라이브 세션 업로드) |

### 내부 코드·문서 (범용 가이드지만 검증 근거로 참조)

| # | 발견 | 레퍼런스 |
|---|---|---|
| C1 | 이 저장소가 실제로 SDK 를 쓰며 `canUseTool` 로 위험도구 승인·`AskUserQuestion`·`ExitPlanMode` 를 게이트한다 → dontAsk 채택 시 붕괴가 실증적. | `app/src/main/adapters/claude.ts:89`(`makeCanUseTool`)·`:111`(AskUserQuestion)·`:138`(ExitPlanMode) |
| C2 | 위험도구 승인 카드 화이트리스트(Bash/Write/Edit/…)가 canUseTool 로 소비됨. | `app/src/main/adapters/risky-tools.ts:6` |
| C3 | `settingSources` 생략→`~/.claude` 상속 + `disallowedTools` 차단, `~/.config/orca` plugin dist 로딩 배경. | `@docs/arch/backend/standardization.md §5.1` |

## 인수 기준 (Acceptance Criteria)

1. 가이드가 **SDK `options` 코드레벨** 구성만 다루고 `settings.json` 을 쓰지 않는다.
2. **작업 폴더 밖 r/w 차단을 PreToolUse 훅**으로 강제하고, 그 격리가 **모드-독립**(default·acceptEdits·plan·bypassPermissions 전부)임을 근거(W3)와 함께 명시한다.
3. `permissionMode: "dontAsk"` 를 **쓰지 않는** 이유(W2: 대화형 흐름 자동 거부)를 밝히고, `plan`/`AskUserQuestion`/`ExitPlanMode`/`acceptEdits` 자동진행이 유지됨을 보인다.
4. 훅이 작업 폴더 **안** 경로에 `allow` 가 아니라 **pass-through(`{}`)** 를 반환해야 하는 이유(W4)를 명시하고 구현에 반영한다.
5. read 예외(`~/.claude`·`~/.config/orca`·node/python 런타임)를 read 허용·write 차단으로 정의하고, **예외 없이 먼저 테스트**(최소권한) 를 권고한다.
6. `additionalDirectories` 기본 `[]` + 옵션·훅에 **동일 배열 공유** 확장 시나리오를 제시한다.
7. **모드별 격리 유지 표** + 검증 체크리스트 + Bash 정적격리 **한계** 를 포함한다.
8. **모든 출처 사이트**(W1~W9, A1, C1~C3)를 문서에 표기한다.

## 범위 / 비범위

- **범위**: 범용 독립 가이드 1건(`docs/guides/workspace-isolation-permissions.md`). 한국어, 코드/식별자 영어.
- **비범위**: orca 어댑터(`claude.ts`)에의 실제 배선·리팩토링. 가이드는 orca 코드에 종속되지 않는다(사용자 결정 "범용 독립"). 문서 인벤토리(`docs/AGENTS.md`) 등록도 하지 않는다 — 저장소 아키텍처 SSOT 가 아니라 독립 가이드이므로.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 의존: `@anthropic-ai/claude-agent-sdk` 의 `query()` `options`(`hooks.PreToolUse`·`permissionMode`·`allowedTools`·`disallowedTools`·`additionalDirectories`), `node:path`·`node:os`.
- 전제: 대상 앱이 대화형 흐름(plan/AskUserQuestion/ExitPlanMode)을 실제로 쓴다(정정 근거). 안 쓰면 dontAsk 도 가능하나 본 가이드는 유지를 기본값으로 삼는다.
- **신규 의존성**: 없음(문서만).

## 설계

- **격리 = PreToolUse 훅 단일 계층**(모드-독립). 밖=`deny`, 안·read예외=**pass-through(`{}`)**, `allow` 는 쓰지 않음(W4). permissionMode 는 앱이 자유 선택(default 권장).
- 재사용: 초안의 `isInside`/`readOnlyAllowRoots`/`screenBashCommand` 골격은 유지하되, 반환을 `allow→passThrough` 로 교정하고 `additionalDirs` 를 `makeWorkspaceGuardHook(ws, dirs)` 인자로 승격.
- 문서 구성 8절: ①설계 근거+평가순서 ②options 스켈레톤 ③훅 구현(pass-through 규칙) ④**모드별 격리 유지 표** ⑤additionalDirectories 확장 ⑥disallowedTools 보강 ⑦검증 체크리스트 ⑧요약+한계.
- 레이어 경계: 문서 파일이라 코드 경계 N/A. `docs/guides/` 신규 디렉토리.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- Glob/Grep `path` 생략 = cwd(=workspace) 기준 → pass-through.
- 상대경로는 workspace 기준 `path.resolve` 후 판정(../ 탈출 차단).
- Bash 는 정적 파싱이라 `eval`·`$HOME`·파이프·base64 우회 미차단 — 한계로 명시(엣지케이스를 숨기지 않음).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| Bash 허용 시 정적 격리 불완전 | §8 한계 명시 — "OS 샌드박스 대체 아님, 실수·오작동 방지 수준" 전제. 강한 격리는 본 범위 밖(OS 격리). |
| read 예외가 과다 권한이 될 수 있음 | 최소권한 test-first 권고(예외 없이 먼저 → 깨질 때만 최소 추가). |
| 옵션·훅 배열 드리프트 | 단일 배열(one array) 공유 패턴 강제(§5). |

- 되돌리기 어려운 결정: 없음(문서).
- **단독 결정 금지 항목(Open Question)**: 없음 — 범위·프롬프트 정책 모두 사용자 정정으로 확정됨.

## 영향 받는 파일

- `docs/guides/workspace-isolation-permissions.md` (신규)
- `docs/handoff/0074-workspace-isolation-guide/{plan,verify}.md` (신규)
- `docs/handoff/INDEX.md` (행 추가)

## 참고 문서

- 외부: W1~W9 URL(위 자료조사 표) — 정본.
- 내부: `@docs/arch/backend/standardization.md §5.1`(배경), `app/src/main/adapters/{claude.ts,risky-tools.ts}`(dontAsk 충돌 실증).

## 게이트

- 코드 게이트 **N/A**(문서 산출물). 대신 정합성 검토: 가이드 내 SDK 필드명/평가순서가 W1 문서와 모순 0, 모든 출처 표기 여부.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구·정정을 라이브 세션 출처로 인용, 추론은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(URL·`파일:라인`·`@docs`) 부착, fetch/제공 구분.
- [x] 인수 기준 — 번호·검증가능·조사 근거.
- [x] 의존 기술 — 식별, 신규 의존성 0.
- [x] 파생 UX — Glob 생략·상대경로·Bash 한계 펼침.
- [x] 리스크 — 정적격리 한계·과다권한·드리프트 + 완화, Open Question 0.

---

> **[구현자 기입]** — 비기능 작업이라 Claude 가 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 격리를 훅 단일 계층으로 옮긴 것이 정정 요구(대화형 흐름 유지)와 요구1(밖 차단)을 동시에 만족하는 유일 배치. W3(hook 최우선·bypass deny 유효)가 이를 뒷받침.
- 이견 / 우려: 없음. 단, 요구4(pass-through) 는 초안 대비 **동작 변경**이므로 가이드에서 "왜 allow 가 아닌가"를 명시적으로 경고 블록 처리해야 오용을 막는다(반영함).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 초안 Bash 스크리닝이 `writeRoots` 를 안 씀(read/write 구분 모호) | ✅ 구현함 — Bash 는 `readRoots` 기준 접근 판정으로 단순화(정적 파싱이 write 의도까지 못 가름을 한계로 명시) | W3 한계 |
| 2 | `additionalDirectories` 를 훅이 자동으로 못 읽음 | ✅ 구현함 — `makeWorkspaceGuardHook(ws, additionalDirs)` 인자화 + 옵션과 동일 배열 공유 패턴(§5) | 요구6 |

## [구현자 기입] 구현 체크리스트

- [x] 가이드 8절 작성(pass-through 규칙·모드별 표·출처 전량).
- [x] 커밋·푸시·draft PR(#192).

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `docs/guides/workspace-isolation-permissions.md`(신규 364줄) |
| 실행 명령 | 코드 게이트 N/A(문서) — 정합성 검토로 갈음 |
| 게이트 결과 | SDK 필드명·평가순서 W1 문서와 모순 0 / 출처 W1~W9·A1·C1~C3 전량 표기 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `a6bc047` (본 핸드오프 등록 커밋은 별도) |

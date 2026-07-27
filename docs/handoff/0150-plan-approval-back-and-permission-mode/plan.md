# Plan — 0150-plan-approval-back-and-permission-mode

## 메타

| 항목 | 값 |
|---|---|
| slug | `0150-plan-approval-back-and-permission-mode` |
| 작성자 | Claude Code |
| 일자 | 2026-07-27 |
| 매핑 | PHASES 행 (PASS 후 승격) / PR (브랜치 `claude/plan-mode-exitplanmode-review-3n7hmt`) |
| 상태 | DRAFT → READY → IMPL_DONE |
| 구현 주체 | **Claude 직접** (버그수정·UX 결함 보정 = 비기능, 0101 선례) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "계획 제안이 활성화 되었을때 composer 패널스택-도구승인카드에서 수정 버튼 클릭 시, '뒤로' 이동 버튼이 없다. 좌측 하단에 뒤로 버튼을 배치하라." | 라이브 세션 요청 |
| 명시 요구 ② | "수락 버튼 클릭 시 gui에서 편집 수락 모드로 변경이 되는데, 실제 sdk 를 통해 권한 변경이 이루어지고 있는지? (훅 혹은 query.setpermissionmode api등)" | 라이브 세션 요청 |
| 명시 결정 ③ | 뒤로 동작 = **항상 접기 · 내용 보존** (코멘트가 있어도 접히고, 작성 중 텍스트·코멘트 보존) | 라이브 세션 AskUserQuestion 답변 |
| 명시 결정 ④ | 권한 전환 통로 = **allow 응답의 `updatedPermissions`** | 라이브 세션 답변 ("그럼 … updatedPermissions 로 실어 보내는 걸로 가겠습니다" 에 대한 후속 확인 승인) |
| 추론 의도 | ②는 질문 형태지만 "GUI 와 SDK 가 어긋난다면 고쳐라"를 함의한다고 해석 (추론). 목표 모드는 현행 GUI 칩이 이미 주장하는 `accept_edits` 를 유지 — 제품 의도 변경 아님 | — |

## Context (왜)

### ① 되돌아갈 길이 없다

계획 승인 카드에서 `수정…` 을 누르면 카드가 in-place 확장되면서 좌측 `거부`/`수정…` 그룹이 통째로 사라지고 푸터가 `justify-end` 로 바뀐다(`ApprovalCard.tsx:280-294`). 확장 상태를 빠져나갈 수단이 없다. 더구나 확장 조건이 `reviseExpanded = reviseOpen || hasComments`(`:175`) 라 우측 plan 타일에서 인라인 코멘트를 하나라도 달면 카드가 **강제 확장**되어 `수락` 버튼에 아예 도달할 수 없다.

### ② 승인 시 권한 모드가 GUI 에만 반영된다

`approvePlan`(`chatStore.ts:1047-1053`)은 바로 옆 `setPermissionMode()`(IPC 발행판, `:1039-1045`)를 우회하고 reducer 액션을 직접 dispatch 한다. `orca:permission:setMode` 미발행 → main `PermissionModeController` 미갱신 → SDK 로 아무것도 안 간다. SDK 로 실제 나가는 것은 `{behavior:'allow', updatedInput:{plan:…}}` 뿐이다(`claude.ts:151-153`).

**CLI 바이너리 정적 분석으로 확인한 실제 결과**(아래 자료조사): 승인 시 `ExitPlanMode` 도구 핸들러가 세션 모드를 `plan → prePlanMode ?? 'default'` 로 되돌린다. Orca 는 spawn 옵션(`options.permissionMode:'plan'`)으로 plan 에 진입하므로 `prePlanMode` 가 없어 **`default`** 가 된다. 즉 GUI 칩은 `편집 수락(acceptEdits)` 이라 주장하는데 SDK 세션은 `default` 다.

`default` 에서는 파일 편집이 권한 모드 단계를 통과해 `canUseTool` 로 내려오고, `Edit`·`Write` 는 `RISKY_TOOLS`(`risky-tools.ts:6-12`)라 **매 편집마다 도구 승인 카드가 뜬다**. 사용자 눈에 보이는 증상이 바로 이것이다 — "칩은 편집 수락인데 편집마다 승인을 또 묻는다". 다음 `orca:chat:send` 페이로드의 `permissionMode` 가 `pushTurn`(`claude.ts:447`)에서 `setPermissionMode('acceptEdits')` 를 부르면서 **다음 턴부터** 뒤늦게 정합된다. 갭은 정확히 "승인이 의미를 갖는 그 턴" 이다.

원인은 SDK 표면 하나가 미탐색으로 남은 것이다 — `PermissionResultAllow.updatedPermissions: PermissionUpdate[]` 가 `type:'setMode'` 변형을 갖는데, 저장소의 동명 타입 `shared/ipc.ts:436` 은 앱 자체 타입(`{toolName, scope}`)이고 주석에 "SDK updatedPermissions 는 미사용" 이라 못박혀 있다.

## 자료조사 (Research)

### SDK 타입 (실물 확인)

| 발견 | 레퍼런스 |
|---|---|
| `PermissionUpdate` 6-variant union 중 `{ type:'setMode'; mode: PermissionMode; destination: PermissionUpdateDestination }` | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2133-2160` (특히 `:2149-2151`) |
| `PermissionUpdateDestination = 'userSettings' \| 'projectSettings' \| 'localSettings' \| 'session' \| 'cliArg'` | 동 `sdk.d.ts:2162` |
| `PermissionResult` allow 분기에 `updatedPermissions?: PermissionUpdate[]` | 동 `sdk.d.ts:2113-2118` |
| `CanUseTool` 3번째 인자 `suggestions?: PermissionUpdate[]` — 공개 타입 | 동 `sdk.d.ts:217` · 미러 `@docs/spec/claude/agent-sdk/typescript.md:539` |
| 문서화된 용례 = "승인 및 기억"(suggestions 를 `updatedPermissions` 로 에코) | `@docs/spec/claude/agent-sdk/user-input.md:302,334` · 웹 https://code.claude.com/docs/en/agent-sdk/python |

### CLI 바이너리 동작 (정적 문자열 분석, `claude-agent-sdk-linux-x64/claude` = 0.3.220)

| 발견 | 근거 (바이너리 내 코드 조각) |
|---|---|
| **브리지 경로가 `setMode` 를 적용한다** — SDK canUseTool 이 돌려준 `updatedPermissions` 를 순회하며 `setModeFromBridge(mode)` 호출 | `function $Wy(e,t){…for(let n of t)if(n.type==="setMode"){let o=e.setModeFromBridge(n.mode);…}` |
| 그 적용 지점이 **allow 직후·도구 실행 전** | `…L.behavior==="allow"){let P=…L.updatedPermissions??[];if($Wy(t,P),P.length)vxo(P);…d(t.buildAllow(…))` |
| `setModeFromBridge` 는 **도구가 읽는 것과 같은** tool permission context 를 쓴다 | `setModeFromBridge(d){return Ufe(d,En(r),r.setToolPermissionContext)}` |
| `ExitPlanMode` 핸들러는 **`mode==='plan'` 일 때만** `prePlanMode ?? 'default'` 로 되돌린다 | `let p=En(t);if(p.mode==="plan"){…let m=p.prePlanMode??"default";…return{…E,mode:m,prePlanMode:void 0}}` |
| ⇒ 우리 업데이트가 먼저 `acceptEdits` 로 바꾸므로 그 `if` 는 **스킵**되고 `acceptEdits` 가 살아남는다 | 위 두 줄의 합성 (핵심 순서 근거) |
| `destination:'session'` 은 설정 파일에 **기록되지 않는다** (persist 는 local/user/project 만) | `function jCs(e){return e==="localSettings"\|\|e==="userSettings"\|\|e==="projectSettings"}` → `async function LEe(e){if(!jCs(e.destination))return;…}` |
| CLI 자신이 write/create 상황에서 **정확히 같은 shape 을 suggestion 으로 만든다** | `…l.push({type:"setMode",mode:"acceptEdits",destination:"session"})` |
| CLI 자신의 `EnterPlanMode` 도 같은 통로를 쓴다 | `t.setToolPermissionContext((r)=>YS(bdr(r),{type:"setMode",mode:"plan",destination:"session"}))` |
| `bypassPermissions` 만 별도 거부 가드가 있다 (`acceptEdits` 는 무제약) | `case"setMode":if(t.mode==="bypassPermissions"&&!e.isBypassPermissionsModeAvailable)return w("Ignoring permission update…")` |

### 앱 코드

| 발견 | 레퍼런스 |
|---|---|
| ExitPlanMode allow 분기가 `{behavior:'allow', updatedInput:input}` 만 반환 | `app/src/main/adapters/claude.ts:151-153` (변경 전) |
| `approvePlan` 이 reducer 만 dispatch (IPC 미발행) | `app/src/renderer/src/features/chat/store/chatStore.ts:1047-1053` |
| `setPermissionMode()` 는 dispatch + `permissionApi.setMode` 발행 — 대비되는 정상 경로 | 동 `:1039-1045` |
| `permissionModes.setMode` 는 send 시점에만 호출. `getCurrentMode`/`forget` 프로덕션 호출처 0 | `app/src/main/app/chat-turn.ts:740-742` · `features/approvals/permission-mode-controller.ts:22,33` |
| `Edit`·`Write`·`MultiEdit`·`Bash`·`NotebookEdit` 가 risky → `default` 모드에서 매번 승인 카드 | `app/src/main/adapters/risky-tools.ts:6-12` |
| `reviseExpanded = reviseOpen \|\| hasComments` — 코멘트가 확장을 강제 | `ApprovalCard.tsx:175` (변경 전) |
| 푸터가 확장 시 `justify-end` 로 바뀌며 좌측이 빔 | `ApprovalCard.tsx:280-294` (변경 전) |
| back 버튼 선례(라벨 동반) | `features/settings/components/UsageLimitViews.tsx:75-84` · 아이콘 전용 `rightpanel/SubAgentTileContent.tsx:69-84` |
| 카드 루트 Escape 선례 (Esc=건너뛰기) | `AskUserQuestionCard.tsx:150` |
| composer Escape 는 autocomplete 로컬이라 비충돌 | `composer/ComposerInputController.tsx:272,295` |
| `Button.leadingIcon?: IconName` · `arrowL` 아이콘 존재 | `shared/ui/Button.tsx:31,122-124` · `shared/ui/Icon.tsx:121` |
| 권한 평가 순서: 훅 → deny → **권한모드** → allow 규칙 → `canUseTool` | `@docs/spec/claude/agent-sdk/permissions.md` (평가 흐름) |

## 인수 기준 (Acceptance Criteria)

1. `수정…` 확장 상태에서 카드 **좌측 하단**에 `뒤로` 버튼이 보이고, 누르면 접히며 `거부`/`수정…`/`수락` 상태로 복귀한다.
2. 뒤로로 접어도 작성 중이던 수정 텍스트와 인라인 코멘트가 **보존**되고, `수정…` 재클릭 시 복원된다.
3. 인라인 코멘트가 있어도 뒤로가 동작하고, 접힌 뒤 `수락`/`거부` 에 도달할 수 있다 (종전 불가).
4. 접힌 상태에서 코멘트를 새로 추가하면 다시 펼쳐지고 textarea 에 포커스가 간다.
5. 확장 상태에서 `Escape` 가 뒤로와 동일 동작. 접힌 상태에서는 소비하지 않는다.
6. `ExitPlanMode` allow 응답이 `updatedPermissions: [{type:'setMode', mode:'acceptEdits', destination:'session'}]` 을 포함한다 (단위 테스트로 고정). deny 는 포함하지 않는다.
7. 계획 승인 시 main `PermissionModeController` 가 해당 세션을 `accept_edits` 로 기록한다.
8. `계획 승인 → accept_edits` 규칙이 `shared/permission-mode.ts` 상수 1곳에만 존재한다 (렌더러·main 양쪽 참조).
9. 게이트: `npm run lint` 0 error · `npm run typecheck` 3종 0 · vitest 회귀 0.

## 범위 / 비범위

- **범위**: `PlanApprovalBody` 확장 상태 머신·푸터, ExitPlanMode allow 의 `updatedPermissions`, main controller 동기화, 공유 상수, i18n(ko/en), 어댑터 단위 테스트.
- **비범위**: `PermissionModeController.getCurrentMode`/`forget` 미호출 정리(별건 위생, D1) · `shared/ipc.ts:800-806` 의 죽은 `PermissionMode`(2종)·`fromUiPermissionMode` 제거(D2) · `suggestions`/`blockedPath` 소비 · 승인 후 계획 코멘트 읽기전용 모드.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `Button`/`Icon` 프리미티브, `toClaudePermissionMode`, `permissionModes`(ChatDeps), 기존 grid-rows 확장 애니메이션.
- **신규 의존성 0.** IPC 채널/스키마 무변경.
- 전제: `updatedPermissions` 가 도구 실행 **전에** 적용된다 — 바이너리 정적 근거는 위 표에 있으나 **런타임 실측은 미완**(이 환경 electron 실행 불가). 사람 실기 1순위 항목.

## 설계

### A. 뒤로 버튼 — `ApprovalCard.tsx` `PlanApprovalBody`

**A-1. 확장 상태를 순수 파생으로.** `reviseOpen: boolean` + `reviseExpanded = reviseOpen || hasComments` 를 버리고, "사용자가 마지막으로 접었을 때의 코멘트 수"를 상태로 둔다.

```ts
const [collapsedAtCount, setCollapsedAtCount] = useState<number | null>(0) // null = 명시적 펼침
const reviseExpanded = collapsedAtCount === null || comments.length > collapsedAtCount
```

| 상황 | `collapsedAtCount` | `comments.length` | 확장 |
|---|---|---|---|
| 초기 | 0 | 0 | ✗ |
| `수정…` 클릭 | null | — | ✓ |
| `뒤로` | `comments.length` | 동일 | ✗ |
| 코멘트 1개 추가(접힌 상태) | 0 | 1 | ✓ |
| 그 상태에서 `뒤로` → 2번째 코멘트 | 1 | 2 | ✓ |

코멘트가 확장을 *강제*하지 않으므로 뒤로가 항상 동작하고(AC1·3), 두 번째 코멘트도 다시 연다(AC4). `feedback`(로컬)·`planComments`(store)를 건드리지 않아 보존은 자동(AC2).

> **`useEffect` + `setState` 를 쓰지 않은 이유**: `react-hooks/set-state-in-effect` 가 lint **error** 다(React Compiler 규칙). 초기 구현에서 실제로 걸렸고, 순수 파생으로 재설계해 해소했다. 기존 포커스 effect 는 setState 를 안 하므로 그대로 두되 키를 `hasComments`(boolean) → `comments.length` 로 바꿔 2번째 코멘트에도 재포커스한다.

**A-2. 푸터 좌측 슬롯을 항상 채운다.** `justify-end`/`justify-between` 토글 제거 → `justify-between` 고정. 좌측이 확장 시 `뒤로`(`variant="uncontained"` + `leadingIcon="arrowL"`), 접힘 시 `거부`+`수정…` 그룹으로 스왑. 우측은 현행 유지.

**A-3. Escape.** 카드 루트 `onKeyDown` 에 확장 상태 한정 분기 추가(`AskUserQuestionCard.tsx:150` 선례). textarea 는 Enter 만 `stopPropagation` 하므로 입력 중에도 버블링된다. 접힌 상태에선 `preventDefault` 하지 않아 상위 핸들러를 보존한다.

**A-4. i18n.** `chat.approval.reviseBack` — ko `'뒤로'` / en `'Back'`.

### B. 권한 모드 실제 전환

**B-0. 공유 상수** — `shared/permission-mode.ts` 에 `PLAN_APPROVED_MODE: NormalizedPermissionMode = 'accept_edits'`. 렌더러 칩(`chatStore.approvePlan`)·SDK 세션(`adapters/claude.ts`)·main SSOT(`app/chat-turn.ts`) 세 소비자가 같은 값을 읽는다(AC8).

**B-1. 어댑터** — `adapters/claude.ts` ExitPlanMode allow 분기에 `updatedPermissions: [{type:'setMode', mode: toClaudePermissionMode(PLAN_APPROVED_MODE), destination:'session'}]` 동봉. **allow 와 같은 control_response 에 실려 원자 적용**되므로 별도 `setPermissionMode` control_request 의 순서 경쟁이 없다. `destination:'session'` = 인메모리(설정 파일 미기록).

**B-2. main SSOT** — `app/chat-turn.ts` `requestApproval` 의 `return resolution` 직전, 기존 `ask_question` 후처리와 대칭 위치에서 `plan_review + allow + dbSessionId` 일 때 `permissionModes.setMode(sid, PLAN_APPROVED_MODE)`. 레이어 준수: `adapters/` 는 `features/` 를 import 할 수 없으므로 controller 갱신은 컴포지션 루트(`app/`) 몫.

**B-3. 렌더러** — `approvePlan` 은 낙관적 dispatch 유지(상수만 참조). SDK 전환을 어댑터가 원자 처리하므로 IPC 를 더하지 않는다.

## 파생 UX / 엣지케이스

- **접힌 상태 + 코멘트 존재**: 칩이 확장 영역 안이라 함께 숨는다. 이때 `수락` 하면 코멘트는 `RESOLVE_PLAN`(`chatReducer.ts:677-684`)이 비운다 — 승인은 원래 코멘트를 소비하지 않으므로 종전과 동일. 우측 plan 타일 하이라이트는 남아 시각 단서가 유지된다.
- **`canRevise` 불변**: `feedback.trim() !== '' || hasComments`. 접혀 있어도 코멘트가 있으면 펼쳐 바로 제출 가능.
- **모션**: grid-rows 전환이 역방향 재생. `motion-reduce` 유지.
- **a11y**: 뒤로는 라벨 동반이라 `aria-label` 불요.
- **테마**: 기존 variant/토큰만 사용 — 신규 토큰·하드코딩 색 0.
- **동시성**: 카드는 활성 세션에만 렌더되고 상태가 로컬이라 멀티세션 간섭 없음.
- **`turn.dbSessionId` 부재(새 채팅 첫 턴)**: B-2 는 가드로 스킵. B-1 은 sessionId 무관하게 동작하므로 SDK 전환은 그대로 성립 — 렌더러 IPC 안을 버린 이유다.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `updatedPermissions` 적용 시점 vs `ExitPlanMode` 핸들러의 `plan→prePlanMode` 리셋 순서 | 바이너리 정적 근거로 "적용이 먼저 → `if(mode==='plan')` 스킵" 확인(자료조사 표). 다만 **런타임 실측 미완** → 사람 실기 1순위. 미적용으로 판명되면 `runtime.setPermissionMode` 폴백을 B-2 지점에 덧댄다 |
| 계획 승인이 SDK 에서 **실제로** 편집 자동수락을 켠다 (종전엔 `default` 라 매 편집 승인 카드) | 의도된 수정. 목표 모드는 GUI 칩이 이미 주장하던 값. 워크스페이스 밖 쓰기는 `PreToolUse` 가드 훅이 **모드와 무관하게** 계속 차단(`workspace-guard.ts:1-10`) |
| 접힌 상태에서 코멘트가 숨겨져 "코멘트 단 걸 잊고 수락" 가능 | plan 타일 하이라이트가 시각 단서로 남는다. 종전엔 코멘트가 있으면 수락 자체가 불가였으므로 순증 |
| `collapsedAtCount` 가 코멘트 **삭제** 를 추적하지 않음 (접기 후 코멘트를 지워도 카운트는 유지) | 의도. 삭제는 확장을 유발하지 않아야 한다(사용자가 접은 의사를 존중). 다시 열려면 `수정…` |

- 되돌리기 어려운 결정: 없음 (전부 국소 변경, IPC 계약 무변경).
- 단독 결정 금지 항목: 없음 — 목표 모드·뒤로 동작 모두 사용자 결정 획득.

## 영향 받는 파일

- `app/src/shared/permission-mode.ts` (B-0)
- `app/src/main/adapters/claude.ts` (B-1)
- `app/src/main/app/chat-turn.ts` (B-2)
- `app/src/renderer/src/features/chat/store/chatStore.ts` (B-3)
- `app/src/renderer/src/features/chat/components/ApprovalCard.tsx` (A-1~A-3)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` (A-4)
- `app/src/main/adapters/claude.canusetool.test.ts` (테스트)

## 참고 문서

- `@docs/arch/backend/provider-runtime.md §3` (권한 모드 정규화 계층 · `PermissionModeController`)
- `@docs/spec/claude/agent-sdk/permissions.md` (권한 평가 순서 · 모드 전수)
- `@docs/spec/claude/agent-sdk/user-input.md` (`canUseTool` · `updatedPermissions` 용례)
- `@docs/etc/study/claude/api/00-진입점-분류.md` · `06-역방향-콜백-canUseTool-hooks.md`
- IPC 변경 없음 → `docs/IPC_CONTRACT.md` 갱신 불요

## 게이트

- `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`
- 신규 테스트: 어댑터 `canUseTool` ExitPlanMode allow 의 `updatedPermissions` 고정 + deny 무동봉.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 2건·명시 결정 2건을 라이브 세션 출처로 인용, 추론은 추론으로 표기
- [x] 자료조사 — SDK 타입은 `sdk.d.ts` 라인, CLI 동작은 바이너리 코드 조각, 앱은 `파일:라인`, 외부는 웹 URL
- [x] 인수 기준 — 9개 번호, 조사 근거, 검증 가능
- [x] 의존 기술 — 신규 의존성 0 명시, 미확인 전제(적용 순서)를 리스크로 분리
- [x] 파생 UX — 접힘/코멘트/모션/a11y/테마/동시성/새 세션 엣지 전개
- [x] 리스크 — 4건 + 완화책. Open Question 없음(사용자 결정 획득)

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: B-1(`updatedPermissions`)은 설계대로가 옳았다. 별도 control_request 안(초기 후보)은 순서 경쟁이 남았을 뿐 아니라, CLI 가 `ExitPlanMode` 실행 시 모드를 되돌리므로 **경쟁에서 져 무효화됐을** 가능성이 높다. allow 응답 동봉이 유일하게 리셋보다 먼저 도착하는 통로다.
- **이견 / 우려 ①** — 설계 초안 Context 의 "그 턴의 SDK 세션 권한 모드는 계속 `plan`" 은 **틀렸다**. CLI 가 `prePlanMode ?? 'default'` 로 되돌리므로 실제로는 `default` 다. 증상도 "편집 차단"이 아니라 "편집마다 승인 카드 재출현"이다. 구현 턴에 바이너리 정적 분석으로 확정하고 Context·자료조사를 교정했다. 인수 기준·설계는 영향 없음(고칠 대상과 방법이 동일).
- **이견 / 우려 ②** — 설계 A-1 의 `useEffect` + `setReviseOpen(true)` 안은 lint **error**(`react-hooks/set-state-in-effect`)라 그대로 못 쓴다. 순수 파생(`collapsedAtCount`)으로 재설계했다 — 설계 의도(코멘트가 확장을 강제하지 않음)는 동일하게 만족하고 effect 가 하나 줄었다.
- **이견 / 우려 ③** — 설계 "미확인: TS `PermissionUpdate` 철자" 는 `npm ci`(egress 우회) 후 `sdk.d.ts:2149-2151` 로 해소됐다. 남은 미확인은 *적용 순서* 하나뿐이며, 이건 정적 분석으로 강한 근거를 확보했으나 런타임 실측은 여전히 사람 몫이다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 설계가 승인 후 CLI 모드를 `plan` 으로 오판 — 문제 서술과 실기 관측점이 어긋남 | ✅ 구현함 (바이너리 분석으로 `default` 확정, Context·자료조사·실기 항목 4 교정) | `let p=En(t);if(p.mode==="plan"){…m=p.prePlanMode??"default"…}` |
| 2 | `useEffect` 내 `setState` 가 lint error | ✅ 구현함 (`collapsedAtCount` 순수 파생으로 대체) | `react-hooks/set-state-in-effect` |
| 3 | 우리 업데이트가 도구의 모드 리셋에 덮일 위험 — 설계가 이 상호작용 자체를 몰랐다 | ✅ 구현함 (적용 시점이 도구 실행 **전**이고 같은 context 를 쓰는 것을 확인 → 리셋 분기 스킵). 잔여 런타임 확인은 ⚠️ 사람 실기 | `$Wy` 호출부 · `setModeFromBridge(d){return Ufe(d,En(r),r.setToolPermissionContext)}` |
| 4 | 코멘트 **삭제** 시 확장 정책 미정의 | ✅ 구현함 (삭제는 확장을 유발하지 않음 — 접은 의사 존중, 리스크 표에 기록) | 설계 결정 |
| 5 | `destination` 오선택 시 사용자 `settings.json` 오염 가능 | ✅ 구현함 (`'session'` 고정 + 테스트로 못박음 + 주석에 금지 사유) | `jCs`/`LEe` persist 게이트 |

## [구현자 기입] 구현 체크리스트

- [x] B-0 `PLAN_APPROVED_MODE` 상수
- [x] B-1 어댑터 `updatedPermissions`
- [x] B-2 `chat-turn.ts` controller 동기화
- [x] B-3 `chatStore.approvePlan` 상수 참조 + 주석 교정
- [x] A-1 `collapsedAtCount` 순수 파생
- [x] A-2 푸터 좌측 `뒤로`
- [x] A-3 Escape 바인딩
- [x] A-4 i18n ko/en
- [x] 어댑터 테스트 3건(기대값 갱신 1 + 신규 2)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `shared/permission-mode.ts` · `main/adapters/claude.ts` · `main/app/chat-turn.ts` · `main/adapters/claude.canusetool.test.ts` · `renderer/…/chat/store/chatStore.ts` · `renderer/…/chat/components/ApprovalCard.tsx` · `renderer/…/i18n/resources/{ko,en}.ts` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` |
| 게이트 결과 | lint ✅ **0 error**(warning 1 = `useTranscriptVirtualizer` TanStack↔React Compiler, 0102 이래 베이스라인) · typecheck ✅ 3/3 · vitest ✅ **1176/1176 pass**(테스트 실패 0. 파일 1 = `app/chat-turn.continuity` **로드 실패** — `Electron failed to install correctly`, egress 403 환경 제약, 코드 무관) · scripts ✅ 28/28 |
| 환경 메모 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 후 `npm rebuild better-sqlite3`(Node ABI)로 DB 로드 스위트까지 green 확보 |
| 블로커 / 역질문 | 없음. 단 **적용 순서 런타임 실측**은 이 환경에서 불가 — 사람 실기 필요 |
| 대상 커밋 | (push 후) |

## [검증 대기] 사람 실기 항목

1. `수정…` → 좌측 하단 `뒤로` 노출·접힘·복원 (AC1·2)
2. plan 타일에서 코멘트 1개 → 자동 확장 → `뒤로` → `수락` 도달 (AC3·4)
3. 확장 상태 `Escape` (AC5)
4. **`수락` 직후 같은 턴에서 Edit/Write 가 도구 승인 카드 없이 진행되는가** — 이번 수정의 핵심 관측점(AC6 의 실효). 종전에는 매 편집마다 카드가 떴다
5. 라이트/다크 2테마 시각 확인

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `PermissionModeController.getCurrentMode`/`forget` 프로덕션 호출처 0 — write-only 싱크 + 세션 삭제 시 Map 누수. 본 작업이 write 경로를 하나 더 늘렸다 | 조사(0150) | 세션 delete 경로에서 `forget` 호출 + 다음 턴이 controller 를 읽도록 배선, 또는 controller 폐기 | open |
| D2 | `shared/ipc.ts:800-806` 의 `PermissionMode`(2종)와 `fromUiPermissionMode` 가 죽은 코드 (주석도 "현 Composer UI 2종"이라 낡음 — 실제 6종 노출) | 조사(0150) | 제거 + 주석 교정 | open |

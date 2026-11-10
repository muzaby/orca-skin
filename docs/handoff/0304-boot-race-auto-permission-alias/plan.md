# Plan — 0304-boot-race-auto-permission-alias

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0304-boot-race-auto-permission-alias` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 매핑 | 사용자 버그리포트 3건(부트 레이스 · 답변 중 자동 승인 강등 · alias 자동 승인 미노출) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1 rev.2` — rev.1의 D-005·D-006을 D-008로 대체(구현 전 사용자 정정) |
| 유효 V | `V1 rev.2` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: (1) 앱 시작마다 `orca:session:cwd` 미등록 오류 로그와 원인 불명 오류 토스트가 뜬다. (2) 답변 중 모델을 바꾼 뒤 고른 `자동 승인`이 즉시 `수동 승인`(Work)/`편집 자동 수락`(Code)으로 되돌아간다. (3) 카탈로그가 `ANTHROPIC_DEFAULT_*_MODEL`을 5.5로 지정해도 alias(`sonnet`/`opus`/`haiku`)를 고르면 `자동 승인`/`자동` 메뉴가 없다.
- 완료 후 달라지는 것: 부팅이 조용하다. 사용자가 고른 권한 모드는 모델 전환·진행 중 답변 때문에 바뀌지 않는다. env로 버전이 확인된 alias는 버전 명시 모델과 같은 자동 승인 자격을 갖는다.
- 성공을 사용자 관점에서 한 문장으로: "부팅에 토스트가 없고, 자동 승인 가능한 모델에서 고른 자동 승인은 그대로 남는다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "앱 시작 때마다 orca:sessiom:cwd 미등록 에러 로그 + 이유 모를 에러 토스트 발생" — 원인: ChatProvider가 부팅 게이트 밖에서 `sessionApi.cwd()`를 부르는 부트 레이스 | 사용자 버그리포트 §1 |
| 명시 요구 2 | "답변 중 컴포저에서 sonnet/opus/haiku로 바꿔도 '자동승인'을 고르면 즉시 '수동 승인'(work), '편집 자동 수락'(code)으로 되돌아간다" | 사용자 버그리포트 §2 |
| 명시 요구 3 | "ANTHROPIC_DEFAULT_XXX_MODEL: 환경변수를 claude 모델 5.5 이상으로 설정했다. Alias로 sonnet/opus/haiku도 availableModels로 노출하고 있는데, 컴포저에서 해당 alias 선택 시, 자동 승인/자동 이 노출되지 않고 있다." | 사용자 버그리포트 §3 |
| 명시 요구(rev.2) | "Tobe의 3동작은 아직 턴이 시작되지 않은, ui 상 허용가능한 설정인지만 보여주는 것이다." — 답변 중 선택은 다음 턴 설정이고 진행 중 답변은 spawn 모델·기존 모드로 계속된다(0128) | 사용자 턴(rev.2) · `session-runtime.ts:270-272`(0128) · `docs/arch/frontend/state.md:88` |
| 명시 요구(rev.2) | 보내지 않은 칩 변경은 세션 이동에는 유지, 앱 재시작에는 휘발(D-009 원문) | 사용자 턴(rev.2) |
| 추론 의도 | 같은 부트 레이스를 가진 형제 호출(`updateApi.state()`)도 함께 닫는다 | §8 전수 조사 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 부팅 게이트 밖 mount 호출 중 main `register(ctx)`에서 등록되는 채널은 renderer가 `bootApi.whenReady()` 완료 뒤에만 invoke한다 | main 쪽 조기 등록은 `ctx.getCwd`(DB·작업공간 스텝 뒤)를 요구해 0244처럼 첫 문장으로 올릴 수 없다 | 버그리포트 §1 + §8 | ACTIVE | — |
| D-002 | main-ready 실패(reject)는 BootScreen 실패 UX가 소유한다 — 대기 중이던 cwd/update 조회는 invoke하지 않고 토스트를 내지 않는다 | 같은 실패를 두 번 보이지 않는다(0109 필수 스텝 규칙) | `steps.ts:80-89` | ACTIVE | — |
| D-003 | `sonnet`·`opus`·`haiku`·`fable` **bare alias**는 실행 env의 `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` 값으로 해석한 이름을 자동 승인 판정의 증거로 쓴다. env가 없으면 종전대로 자동 승인 불가 | "alias를 최신 모델의 증거로 쓰지 않는다"(`model-policy.ts:22-23,46-47`)는 유지 — env 값은 버전이 명시된 증거다 | 버그리포트 §3 · 기존 결정 | ACTIVE | — |
| D-004 | 자동 승인 버전 규칙(`supportsAutoPermission`: claude/claudecode 접두 + 계열 + 버전 >4.5)과 custom 이름 거부는 바꾸지 않는다 | `claudecode-haiku-5.5`는 이미 통과한다(§4 실측) — 리포트의 원인1 중 "커스텀 이름 항상 거부"는 bare alias에만 참이다 | §4 | ACTIVE | — |
| D-005 | live 채널에 대한 권한 변경은 **선택**과 **적용**을 가른다: 선택 = 종류 정책만 적용한 값(저장·응답·화면), 적용 = 선택을 spawn 모델 증거로 정착한 값(live SDK에만) | 답변 중 모델 전환은 다음 send의 respawn에서만 반영된다(0128). 낡은 spawn 모델로 선택을 덮으면 리포트 §2가 재현된다 | 버그리포트 §2 + 추론 의도 | SUPERSEDED | D-008 |
| D-006 | SDK `status`가 보고한 모드가 "현재 선택을 spawn 모델로 정착한 값"과 같으면 선택을 덮지 않는다. 그 밖의 SDK 보고(계획 모드 진입 등)는 종전대로 화면에 반영한다 | D-005의 적용값 echo가 화면을 다시 강등시키지 않게 한다 | `adapter.ts:908-920` · `permission-mode-observer.ts:21-28` | SUPERSEDED | D-008 (폐기 — live에 대체값을 넣지 않아 echo가 생기지 않음) |
| D-007 | 실행 모델 문자열(SDK `options.model`, 선택 식별자 `modelIdentity`)은 바꾸지 않는다 — alias는 alias로 넘기고 CLI/어댑터가 env로 해석한다 | 실행 경로·저장된 `last_model`·`modelDetails` 키 불변 | `model-identity.ts` · `context-policy.ts:69-82` | ACTIVE | — |
| D-008 | 답변 중(live) 고른 권한 모드는 **아직 시작되지 않은 다음 턴의 설정**이다. UI는 선택한 모델 기준으로 허용 여부만 보여 주고 그 선택을 저장한다. main은 live 채널이 선택을 **그대로** 받을 수 있을 때(spawn 증거로 정착해도 같은 값)만 live에 적용하고, 아니면 live를 건드리지 않는다 — 대체값(fallback)을 live에 넣지 않는다. 저장·응답 = 선택, 다음 send가 해소 모델로 정착 | 사용자: "Tobe의 3동작은 아직 턴이 시작되지 않은, ui 상 허용가능한 설정인지만 보여주는 것이다." | 사용자 턴(2026-11-10, rev.2) | ACTIVE | D-005·D-006 대체 |
| D-009 | 보내지 않은 컴포저 칩 변경(모델·권한)은 **메모리 임시 기록**이다. 앱을 끄지 않고 다른 세션에 갔다 돌아오면 변경 선택이 유지되고, 앱을 재시작하면 휘발되어 그 세션은 마지막 spawn 모델(`last_model`)과 그 모델의 기본 권한으로 돌아온다 | 사용자: "컴포저의 칩 변경 후, 메시지를 보내지않고 앱 종료 재시작시 해당 세션은 spawnd model을 유지. 앱 종료하지 않고 다른 세션을 이동했다가 돌아오는 경우는 변경 선택 유지" · "비유하자면 메모리에 임시 기록한것이고, 앱재시작시 휘발되어 날아간것" | 사용자 턴(2026-11-10, rev.2) | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: rev.1 D-001~D-007(신규 handoff) · rev.2 D-008·D-009.
- 변경된 결정: D-005·D-006 → D-008(사용자 정정 — 답변 중 선택은 다음 턴 설정이며 live에 대체값을 넣지 않는다). 기존 "alias는 증거가 아니다"는 D-003으로 **유지 + 증거원 추가**다(대체 아님).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0215 D-010(`자동` 미지원 시 Code=accept_edits, Work=default) · 0244 settings 읽기 조기 등록 · 0128 모델 변경 = respawn.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001↔AC1·AC2, D-002↔AC3, D-003↔AC4·AC5·AC6·AC7, D-004↔AC8, D-008↔AC9·AC10, D-009↔AC14·AC15, D-007↔AC12. AC11은 D-006과 함께 폐기(§7).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인1(부트 레이스)이 진짜 원인인가 | 타당 | 창이 `start()` 완료 전에 열림 `main/index.ts:305-307` · `registerSessionHandlers` 는 `register(ctx)` 안 `bootstrap.ts:1289` · `bootstrapChat` 이 `.catch` 없이 invoke `chatStore.ts:2216` → `unhandledrejection` → `renderer.unhandled.rejection` 토스트 `globalHandlers.ts:18-25` |
| 원인2-1 "커스텀 이름 항상 거부(haiku, claudecode-haiku-5.5 2개 모두)" | **전제 정정** | 정규식 실측(`node -e`): `claudecode-haiku-5.5`→true, `haiku`→false. bare alias만 거부된다(`model-policy.ts:42-58`). `claudecode-haiku-5.5` 실패는 원인2-2(낡은 spawnedModel)로 설명된다 |
| 원인2-2(낡은 spawnedModel)가 진짜 원인인가 | 타당 | `coordinator.ts:105-107` 이 `turn.live.spawnedModel` 로 정착 후 `setMode`·응답(`:121-122`) → renderer `APPLY_PERMISSION_MODE`(`chatStore.ts:1891`) |
| 요구3의 원인 | 조사로 닫음 | runtime 카탈로그 `availableModels:['haiku']` → `classifyModel` 이 `{alias:'haiku', model:'haiku'}`(`model-parser.ts:146-156`) · `parseRuntimeModels` 는 `runtimeEnv` 중 `ANTHROPIC_MODEL` 만 읽음(`:103-111`) → 메뉴 `supportsAutoPermission('haiku')`=false(`modes.ts:86`) · main send도 `resolved.model='haiku'`(`send.ts:545-549`) |
| 이미 기존 코드가 충족하는가 | 부분 | alias→env 해석 함수는 이미 있다(`resolveCliModel`, `context-policy.ts:69-82`) — 실행 경로만 쓰고 권한 판정은 안 쓴다 |
| 더 작은 해법이 있는가 | 검토 후 기각 | (a) main `sessionCwd` 조기 등록: `ctx.getCwd`가 작업공간 스텝 뒤라 불가. (b) runtime 파서가 alias를 env 값으로 **치환**: D-007(식별자·`modelDetails` 키) 위반 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 문서 계약 변경 1건 | `IPC_CONTRACT.md:607`·`provider-runtime.md:226` "live면 실제 spawnedModel로 정착한 모드를 … 저장·응답" → D-008로 **저장·응답 = 선택, live는 선택을 그대로 받을 때만 적용**. 근거: 리포트 §2 + 사용자 정정(rev.2) |

- 사용자에게 올릴 결정: 없음. 답변 중 선택의 의미는 사용자가 rev.2에서 확정했다(D-008).
- 코드 조사로 닫은 사실: 요구3 경로 · 원인2-1 정정 · 형제 레이스 `updateApi.state()`(§8).

## 5. 동작 / 사용자 흐름

```text
[부팅] 창 오픈 → Provider mount
  → bootstrapChat / initUpdate: bootApi.whenReady() 대기
  → main start() 완료 → cwd·update 상태 1회 조회 → 새 대화 cwd 시드
  ↘ main start() 실패 → BootScreen 실패 화면만(토스트 없음, 조회 없음)

[자동 승인 메뉴] alias haiku 선택(env ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-5-5)
  → 메뉴에 자동 승인/자동 노출 → 선택 → 칩 유지 → send 시 main도 자동으로 실행

[답변 중 전환] 답변 중 모델 A(자동 불가) → B(자동 가능)로 바꿈 → 자동 승인 선택
  → 칩: 자동 승인 유지(다음 턴 설정) · 진행 중 답변: A·기존 모드 그대로(live 미변경)
  → 다음 send: B로 respawn, 자동 승인으로 실행
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 창 오픈, main 미준비 | cwd·update 조회 보류 | 오류 로그·토스트 없음 |
| main-ready 성공 | 조회 각 1회 | 새 대화 cwd가 마지막/기본 경로로 채워짐 |
| main-ready 실패 | 조회 생략 | BootScreen 실패 화면만 |
| main-ready 후 cwd 조회 실패 | `chat.cwd.load-failed` 보고 | 이유가 적힌 `loadFailed` 토스트 1건 |
| idle, env 해석으로 5.5인 alias 선택 | 메뉴 판정 = 해석 이름 | 자동 승인 노출·선택 유지 |
| idle, env 없는 bare alias 선택 | 종전 판정 | 자동 승인 미노출(종전) |
| live, 선택이 spawn 모델에서도 허용 | live에 선택 그대로 적용 | 칩 = 선택 |
| live, 선택이 spawn 모델에서 불허 | live 미변경, 저장·응답 = 선택 | 칩 = 선택(자동 승인), 진행 답변은 기존 모드로 계속 |
| live, SDK가 모드 보고(예: plan) | 종전대로 반영(observer 무변경) | 칩 = 보고 모드 |
| 다음 send | 해소 모델 증거로 재정착 | 새 모델 기준 실행 |
| 보내지 않고 다른 세션 → 복귀(앱 유지) | 캐시 재진입(`preserveLocalState`) — 화면 상태 유지 | 바꾼 모델·권한 칩 유지 |
| 보내지 않고 앱 재시작 | 메모리 상태 소멸, DB `last_model` 로 복원 | 마지막 spawn 모델 + 그 모델의 기본 권한 |

### 파생 UX / 엣지케이스

- loading / empty / error: main-ready 후 cwd 실패만 토스트. update 상태 실패는 기존 `actionError`(UpdateDialog) 유지.
- cancel / retry / close / restart: 해당 없음 — 부팅 1회 조회, 권한은 기존 직렬화(`modeUpdates`) 유지.
- concurrency / multi-session: 권한 선택은 세션별(`PermissionModeController`) 그대로.
- 외부환경/오프라인/폐쇄망: alias 해석 env는 runtime 카탈로그(`runtimeEnv`)·settings `env` 값만 본다(§10 선언 경계).

## 6. 범위 / 비범위

- **범위**: 부팅 게이트 밖 mount 조회 2자리의 main-ready 대기 · alias 증거 해석의 producer→wire→renderer/main 소비 · live 중 권한 변경을 다음 턴 설정으로 저장(live는 그대로 받을 때만 적용) · 관련 문서(`IPC_CONTRACT.md` 두 행, `provider-runtime.md §3`, `rendering.md` 자동 승인 문장).
- **비범위**: 자동 승인 버전 규칙 변경 · custom 이름 허용 · 답변 중 모델 실전환 · OpenCode 권한 정책 · main 핸들러 조기 등록 구조 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 부팅 게이트 밖 신규 mount invoke를 막는 소스 가드 | 아니오 | 후속(선언 경계) |
| settings 외 env 레이어(app/custom/process)의 alias 해석 반영 | 아니오 | 선언 경계 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | main-ready 전에는 `session.cwd`를 invoke하지 않고, ready 후 정확히 1회 invoke해 미세션 엔트리 cwd를 채운다 | `chatStore.bootGate.test.ts`(신규): `boot.whenReady` 보류 promise → `session.cwd` 호출 0 → resolve → 1회 + 활성 엔트리 cwd = 반환값 | `App.tsx:20` ChatProvider → `bootstrapChat` → `bootApi.whenReady` → `sessionApi.cwd` |
| R-01 | AT-01 / AC2 | main-ready 전에는 `update.state`를 invoke하지 않고, ready 후 1회 invoke해 store에 반영한다 | `updateStore.bootGate.test.ts`(신규): 보류 → 0회 → resolve → 1회 + `useUpdateStore.state` = 반환값 | `UpdateProvider` → `initUpdate` → `bootApi.whenReady` → `updateApi.state` |
| R-01 | AT-01 / AC3 | main-ready reject면 cwd·update 조회 0회, `reportError` 0회, `actionError` 미설정 | 위 두 신규 테스트의 reject 케이스 | 같음 |
| R-01 | AT-01 / AC3b | main-ready 후 cwd 조회 reject면 `reportError({event:'chat.cwd.load-failed', title:'loadFailed'})` 1회이고 unhandled rejection이 없다 | `chatStore.bootGate.test.ts` reject 케이스 + `reportSites.registry.test.ts` 등록 행 | `bootstrapChat` |
| R-02 | AT-02 / AC4 | runtime 카탈로그 `availableModels:['haiku']` + `runtimeEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-5-5'` → 목록 항목 `resolvedModel='claude-haiku-5-5'`, `model='haiku'`(불변) | `model-parser.test.ts` `parseRuntimeModels` 케이스 | `runtime-catalog.ts:123` → `parseRuntimeModels` → `toAgentEnvironment` |
| R-02 | AT-02 / AC5 | 그 항목을 고르면 Work 메뉴에 `auto_classified`, Code 메뉴에 `auto_classified`가 있다; env 없는 bare alias는 없다 | `modes.test.ts`: `modeMenuOptions({alias:'haiku',model:'haiku',isCustom:false,resolvedModel:'claude-haiku-5-5'}, kind)` ∋ auto · `resolvedModel` 부재 ∌ auto | Composer → `ClaudeModeControl` → `modeMenuOptions` |
| R-02 | AT-02 / AC6 | 그 선택에서 `SET_PERMISSION_MODE(auto)` 후 state = auto(즉시 강등 없음) | `chatStore.modelPermission.test.ts`: `setModel(pk,'haiku','haiku',adapter,{resolvedModel:'claude-haiku-5-5'})` → `setPermissionMode('auto_classified')` → state auto | `Composer.tsx:198,205,211,435` → `setModel` → reducer |
| R-02 | AT-02 / AC7 | main send가 그 alias 턴을 `auto_classified`로 실행·발행한다 | `send` 권한 정착 테스트(신규 또는 `resolve-turn` 결과 주입): `resolved.permissionModel='claude-haiku-5-5'`, `model='haiku'` → `TurnRequest.permissionMode='auto_classified'` | `send.ts:545` |
| R-02 | AT-02 / AC8 | 버전 규칙 불변: `claudecode-haiku-5.5`·`claude-haiku-5-5`→true, `haiku`·`corp-sonnet-9`·`claude-haiku-4-5`→false | `model-identity.test.ts` 기존 + 추가 행 | `supportsAutoPermission` |
| R-03 | AT-03 / AC9 | live spawn 모델 자동 불가 + 선택 auto → live `setPermissionMode` 호출 0, 저장·응답 = `auto_classified`; spawn 모델이 선택을 그대로 받으면(예: bypass) live 1회 적용 | `coordinator.permission.test.ts` 기존 `it.each` 행 갱신(`code claude-sonnet-4-5` 등: SDK 미호출) + bypass 행 | `permissionSetMode` → `coordinator.ts:96-128` |
| R-03 | AT-03 / AC10 | live spawn 모델이 env 해석 alias(5.5)면 선택 auto가 live에도 auto로 적용된다 | `coordinator.permission.test.ts` 신규 행: `spawnedModel='haiku'`, `spawnedPermissionModel='claude-haiku-5-5'` → SDK `auto_classified` | 같음 + `session-runtime.ts:520` |
| R-03 | AT-03 / AC12 | 실행 모델 문자열 불변: alias 턴의 `TurnRequest.model`='haiku', `modelIdentity` 불변, 어댑터 `modelForCli` 결과 불변 | `context-policy.test.ts` 기존 `resolveCliModel` 케이스 유지 + send 테스트의 `TurnRequest.model` 단언 | `send.ts:616` · `adapter.ts:521` |
| R-04 | AT-05 / AC14 | 보내지 않은 칩 변경 뒤 캐시 재진입(`LOAD_SESSION` + `preserveLocalState`)하면 `modelFamily`·`modelAlias`·`modelResolved`·`permissionMode` 가 재진입 전 값 그대로다 | `chatReducer.model.test.ts:140` 케이스 확장 — 기존 단언(`providerKey`·`modelFamily`·`modelAlias`)에 `modelResolved`·`permissionMode`(auto, spawn과 다른 값) 추가 | `chatStore.ts:1736` → reducer `:1452` |
| R-04 | AT-05 / AC15 | 캐시 없는 로드(재시작)는 `modelFamily = last_model`, `modelResolved = null`, `permissionMode = coerce(DEFAULT, last_model)` 이고 칩 변경만으로는 `last_model` 쓰기가 없다 | reducer 테스트(`preserveLocalState` 없음) + 쓰기 경로 전수 `rg -n "updateSessionProviderKey\(" app/src/main --glob '!*.test.*'` → 정의 1 + 턴 영속 2(`writer.ts:186,353`) · 칩 변경 IPC(`permissionSetMode`) 저장은 메모리 `PermissionModeController` 뿐 | `reader.ts:88` → `LOAD_SESSION` |
| R-01·R-03 | AT-04 / AC13 | 실제 앱: 콜드 부팅 토스트·`No handler registered` 로그 0 · 답변 중 모델을 alias+env 5.5로 바꾸고 고른 자동 승인이 유지되고, 진행 중 답변은 기존 모드로 끝나며, 다음 답변이 자동 승인으로 실행 | 사람 실기(Windows 설치본) — 실제 SDK `status` 메시지·로그 파일은 테스트 하네스 밖 | 실제 부팅 · 실제 카탈로그 |

### AC 검증 주의사항

- 기존 테스트 재사용: `coordinator.permission.test.ts:65-76` `it.each` 5행 실재 확인 — AC9로 기대값이 바뀐다(선택 반환). `chatStore.lastCwd.test.ts:28` "keeps the chosen path when the boot query finishes late"는 `window.orca.boot` 를 주입하지 않으므로 하네스에 `boot.whenReady` 를 더해야 한다.
- 사람 실기 항목: AC13만. 로그·토스트 부재와 실제 SDK 동작은 실제 SDK·Electron이 필요하다. 순수 판정(AC1~AC12, AC11 폐기)은 전부 단위 테스트다.
- AC11 폐기(rev.2): D-006과 함께 사라진다 — live에 대체값을 넣지 않으므로 SDK가 그 값을 되돌려 보고할 경로가 없다. "화면이 다시 강등되지 않는다"는 목적은 AC9의 "비자격이면 live 호출 0"이 잠근다.
- N회 기준: AC1·AC2 "1회" — sink `sessionApi.cwd`/`updateApi.state` 프로덕션 호출부 전수 `rg -n "sessionApi\.cwd\(|updateApi\.state\(" app/src/renderer/src --glob '!*.test.*'` → 2건(각 sink 1자리). 관측 지점이 두 자리 전부를 모형한다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: VP-11(MD-04↔UT-04, AC11) → 폐기. 선택 적대 증거 없음. 목적(재강등 없음)은 VP-10의 AC9 "비자격이면 live 호출 0"이 든다.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1·AC2·AC3·AC3b — 조용한 부팅 | NEW | — |
| R-02 | R | §7 AC4~AC8 — env 해석 alias 자동 승인 자격 | NEW | — |
| R-03 | R | §7 AC9~AC12 — 답변 중 선택 유지 | NEW | — |
| AT-01·02·03 | AT | §7 | NEW | — |
| AT-04 | AT | §7 AC13 사람 실기 | NEW | — |
| R-04 | R | §7 AC14·AC15 — 보내지 않은 칩 변경은 메모리 임시 기록(D-009) | NEW | — |
| AT-05 | AT | §7 AC14·AC15 | NEW | — |
| SD-01 | SD | §9 부팅 순서: renderer invoke ⊂ main-ready 이후 | NEW | — |
| SD-02 | SD | §9 권한 선택 수명주기(idle→live 중 선택 저장→다음 send 정착) | NEW | — |
| AR-01 | AR | §9·§10 alias 증거 producer(파서) → wire(`resolvedModel`) → renderer 소비 | NEW | — |
| AR-02 | AR | §9·§10 증거 → `resolve-turn` → `TurnRequest.permissionModel` → `SessionRuntime.spawnedPermissionModel` → coordinator | NEW | — |
| MD-01 | MD | §10 `resolveClaudeModelAlias` 순수 해석 | NEW | — |
| MD-02 | MD | §10 `coercePermissionMode` 증거 선택(`resolvedModel ?? model`) | CHANGED | `shared/permission-mode.ts:95-112` |
| MD-03 | MD | §10 coordinator: 선택 저장·응답, live는 그대로 받을 때만 | CHANGED | `coordinator.ts:96-128` |
| MD-04 | MD | (rev.1) observer echo 억제 | SUPERSEDED | MD-03 — live에 대체값을 넣지 않아 불필요(D-008) |
| MD-05 | MD | §10 renderer reducer `modelResolved` | CHANGED | `chatReducer.ts` 권한 정착 5자리 |
| MD-06 | MD | §10 mount 조회의 main-ready 대기 | CHANGED | `chatStore.ts:2212-2229` · `updateStore.ts:151-161` |
| SD-R1 | SD | 0109 main-ready 필수 스텝 | INHERITED | `steps.test.ts:30,46` |
| SD-R2 | SD | 0244 settings 읽기 조기 등록 | INHERITED | `bootstrap.settings-early.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | ChatProvider/UpdateProvider mount → `whenReady` → invoke → store | AC1·AC2·AC3·AC3b 신규 테스트 | not selected — 직접 순서 관측(보류 promise) | EP-1 (2) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 카탈로그 → 파서 → `AgentModelView` → Composer → 메뉴/reducer · → `resolve-turn` → send 정착 | AC4~AC8 | not selected | EP-2 (5) · EP-3 (8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `permissionSetMode` → coordinator → (그대로 받으면) live SDK · 저장/응답 | AC9·AC10·AC12 | required — 호출 대체: (b) 분기에서 live에 `coerce` 결과(fallback)를 적용하는 변이 · 맞바꿈: 저장·응답에 정착값을 넣는 변이(자리 EP-4 ①②) | EP-4 (3) |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | `index.ts:305-307` started → renderer mount invoke 순서 | AC1·AC2 (보류 promise가 main 미완료를 모형) | not selected | EP-1 (2) |
| VP-05 | SD-02 ↔ ST-02 | REQUIRED | idle 선택 → live 중 선택 저장 → 다음 send 재정착 | `coordinator.permission.test.ts`(AC9·AC10) + send(AC7) | not selected | EP-3·EP-4 |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | `parseRuntimeModels`/`parseClaudeModels` → `toAgentEnvironment` → `AgentModelView.resolvedModel` → `setModel(options.resolvedModel)` → state `modelResolved` | `models.test.ts`(toAgentEnvironment 통과) · AC4 · AC6 | required — 제거: `toAgentEnvironment` 가 `resolvedModel` 을 떨어뜨리는 변이(자리 EP-2 ③) | EP-2 (5) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `resolve-turn` → `TurnRequest.permissionModel`(send·연속 턴) → `SessionRuntime.spawnedPermissionModel` → coordinator | AC7 · AC10 · `session-runtime` 기록 테스트(신규) · 연속 턴 `continuation.test.ts` 신규 행 | required — 제거: 연속 턴 요청에서 `permissionModel` 누락(자리 EP-3 ④⑤) | EP-3 (8) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | `resolveClaudeModelAlias(model, lookup)` | `model-identity.test.ts`(또는 신규 `model-policy.test.ts`) — 분기 입력 §10 EP-6 | not selected | EP-6 (2) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | `coercePermissionMode(mode, {alias, model, resolvedModel?}, kind)` | `permission-mode` 테스트: `resolvedModel` 5.5 + `model` alias → auto 유지 · `resolvedModel` 부재 → fallback | not selected | EP-3 ① |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | coordinator `permissionSetMode` | AC9·AC10 | VP-03과 공유 | EP-4 (3) |
| VP-11 | MD-04 ↔ UT-04 | SUPERSEDED — 폐기(D-008) | — | — | — | — |
| VP-12 | MD-05 ↔ UT-05 | REQUIRED | reducer `SET_MODEL`/`SET_PERMISSION_MODE`/`SET_AGENT_KIND` | AC6 + `SET_AGENT_KIND` 케이스 | not selected | EP-3 ⑥⑦⑧ |
| VP-13 | MD-06 ↔ UT-06 | REQUIRED | `bootstrapChat` · `initUpdate` | AC1~AC3b | not selected | EP-1 (2) |
| VP-14 | SD-R1 ↔ ST-R1 | REGRESSION | renderer boot steps | `steps.test.ts:30`·`:46` | — | 0 + 기존 계약 재실행 |
| VP-15 | SD-R2 ↔ ST-R2 | REGRESSION | `start()` 첫 문장 settings 읽기 등록 | `bootstrap.settings-early.test.ts` | — | 0 + 기존 계약 재실행 |
| VP-16 | R-04 ↔ AT-05 | REQUIRED | 칩 변경 → 세션 전환 → 캐시 재진입 유지 / 재시작 → `reader.ts:88` `last_model` → `LOAD_SESSION` 기본 정착 | AC14·AC15 좌표 | not selected — 직접 상태 단언 | EP-7 (2) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | `app/AGENTS.md` 로컬 확인 7종(§19) | 현재 변경이 유발한 실패만 blocking |
| renderer 오류 보고 레지스트리 | `chatStore.ts`·`updateStore.ts` catch 서수가 바뀜 | `reportSites.registry.test.ts` | 같음 |
| 문서 인벤토리 | `docs/IPC_CONTRACT.md`·`docs/arch/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | plan·INDEX·커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 같음 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 창이 `start()` 완료 전에 열리고 `boot:whenReady` 가 `started` 를 돌려준다 | `app/src/main/index.ts:305-307` |
| `sessionCwd` 는 `register(ctx)` → `registerSessionHandlers` 에서 등록 | `bootstrap.ts:897` → `:1289` · `handlers/session.ts:56-58` |
| `updateState` 도 `register(ctx)` 에서 등록 | `bootstrap.ts:1312` · `handlers/update.ts:5` |
| `settings:get` 은 `start()` 첫 문장에서 조기 등록(0244) — 대기 불필요 | `bootstrap.ts:452` |
| `TweakProvider` 는 실패 시 `whenReady` 후 재시도하는 선례 | `TweakProvider.tsx:87-95` |
| `ctx.getCwd` 는 작업공간 스텝·DB 뒤 조립 | `bootstrap.ts:785,868-889` |
| unhandled rejection은 `renderer.unhandled.rejection` 토스트 | `shared/errors/globalHandlers.ts:18-25` |
| renderer catch는 레지스트리가 파일·서수로 고정, 무음 catch 금지 | `reportSites.registry.test.ts:740-790` |
| alias→env 해석은 실행 경로에만 있음 | `adapters/claude/context-policy.ts:69-82` · `adapter.ts:521,1037,1076` |
| 어댑터 env 조회: spawn env가 있으면 그것만, 없으면 settings env → process env | `context-policy.ts:58-66` · `harness-config.ts:356-370` |
| runtime env는 spawn env에 병합된다 | `harness-config.ts:363-370` |
| live 모델 전환 불가 → 모델 변경은 respawn | `session-runtime.ts:270-272` · `runtime-entry.ts:74-75` |
| 메뉴는 `isCustom`/`alias==='custom'` 이면 auto 숨김, 그 외 `coercePermissionMode` 판정 | `modes.ts:78-88` |
| reducer 권한 정착은 `{alias: modelAlias, model: modelFamily}` | `chatReducer.ts:853-857,1616-1620,1661-1666` |
| `toAgentEnvironment` 는 `...model` 스프레드로 ParsedModel 필드를 통과 | `features/harnesses/common/models.ts:68-87` |
| Claude 어댑터는 `catalog` 를 갖지 않아 send 모델 목록 = 파서 결과 | `resolve-turn.ts:281-290` · `rg "catalog" adapters/claude/adapter.ts` → 0 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 부팅 게이트 밖 mount invoke | `App.tsx` 의 RootGate 바깥 Provider 5개 + TweakProvider의 mount effect를 따라감 | 4 | `sessionApi.cwd`(레이스) · `updateApi.state`(레이스) · `settingsApi.get`×2(조기 등록 — 비대상). `subscribe*` 3종은 listener |
| 권한 정착 호출부 | `rg -n "coercePermissionMode\(\|coerceAutoPermissionModeForModelName\(" app/src --glob '!*.test.*'` | 12 | 정의 2 · 내부 위임 1 · renderer 6(`chatReducer` 533·853·1491·1616·1661, `modes.ts:86`) · main 3(`send.ts:545,683`, `coordinator.ts:106`) |
| 권한 저장 호출부 | `rg -n "permissionModes\.setMode\(" app/src/main --glob '!*.test.*'` | 5 | `coordinator.ts:121` · `approval.ts:106` · `send.ts:551,689` · `permission-mode-observer.ts:22` |
| spawn 모델 기록 | `rg -n "spawnedModelValue = " app/src/main` | 2 | `session-runtime.ts:520`(기록) · `:784`(해제) |
| TurnRequest `model` 운반 | `rg -n "model: (resolved\|continuation)\.model\|\{ model \}" app/src/main/app --glob '!*.test.*'` | 4 | `send.ts:616` · `continuation.ts:46,79` · `chat-turn-continuation.ts:74` |
| renderer `setModel` 호출 | `rg -n "setModel\(" app/src/renderer/src/features/chat/components/Composer.tsx` | 4 | `:198,205,211,435` |
| `ANTHROPIC_DEFAULT_` 소비 | `rg -n "ANTHROPIC_DEFAULT_" app/src --glob '!*.test.*' -c` | 3파일 | `context-policy.ts`(1) · `model-parser.ts`(5) · `chatReducer.ts`(주석 1) |

### 수치 / 전칭 표현 검산

- 정규식 실측(`node -e`, 이번 세션): `haiku` false · `claudecode-haiku-5.5` true · `claude-haiku-5-5` true · `claude-haiku-4-5` true(major 4, minor 5 → `supportsAutoPermission` 은 >4.5라 false — 정규식 매치 ≠ 자격) · `us.anthropic.claude-opus-5-5-v1:0` true.
- "유일한 해석 함수" 반례: alias→env 해석은 `context-policy.ts:81` 1곳(`rg "ANTHROPIC_DEFAULT_\$\{"` → 1). 파서의 `ALIAS_ENV_KEY` 는 목록 후보 생성용이다.
- 문서 앵커 확인: `IPC_CONTRACT.md:607`(권한 모드 라이브 전환) · `:99`(`orca:agent:list`) · `provider-runtime.md:226` · `rendering.md:47` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, SD-02, AR-01, AR-02
- 부팅: ChatProvider/UpdateProvider effect가 mount 즉시 invoke → main 핸들러 미등록 → reject → (cwd) unhandled → 토스트 / (update) `actionError`.
- 권한 증거: 모든 정착이 `model` 문자열 하나를 증거로 쓴다. runtime 카탈로그 alias는 `model='haiku'` 라 증거가 안 된다.
- live 변경: coordinator가 `spawnedModel` 로 정착한 값을 live·저장·응답에 같이 쓴다 → 화면 강등.

```text
mount ──invoke──> main(미등록) ✗ → unhandled → 토스트
catalog['haiku'] → ParsedModel{model:'haiku'} → menu/reducer/send/coordinator: supportsAutoPermission('haiku') ✗
permissionSetMode(auto) → coerce(auto, spawnedModel=A) → live/저장/응답 = fallback → 칩 강등
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, SD-02, AR-01, AR-02
- 부팅: 두 mount 조회가 `bootApi.whenReady()` 를 먼저 기다린다. reject는 조회 없이 끝난다(D-002).
- 권한 증거: 파서가 bare alias 항목에 `resolvedModel`(env 해석 이름)을 붙인다. 정착은 `resolvedModel ?? model` 을 증거로 쓴다. main은 `resolve-turn` 이 고른 항목에서 `permissionModel` 을 얻어 send·연속 턴 정착과 `TurnRequest.permissionModel` 에 싣고, runtime이 `spawnedPermissionModel` 로 기록한다.
- live 변경: coordinator는 `selection = permissionModeForAgent(mode, kind)` 를 저장·응답한다. `coerce(selection, spawnedPermissionModel) === selection` 일 때만 live에 적용하고, 아니면 live를 건드리지 않는다(D-008). observer는 바꾸지 않는다.

```text
mount → await whenReady → invoke(등록됨) ✓
catalog['haiku'] + runtimeEnv → ParsedModel{model:'haiku', resolvedModel:'claude-haiku-5-5'}
   ├→ wire AgentModelView.resolvedModel → setModel(..., {resolvedModel}) → state.modelResolved → menu/reducer ✓
   └→ resolve-turn.permissionModel → send 정착 ✓ → TurnRequest.permissionModel → runtime.spawnedPermissionModel
permissionSetMode(auto) → selection=auto → spawn 증거가 auto를 받으면 live 적용, 아니면 live 미변경 · 저장/응답: auto → 칩 유지
다음 send → coerce(auto, 새 해소 모델) → 실행
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | alias 해석 = 어댑터 실행 경로 전용 | alias 해석 SSOT = `shared/harnesses/claude/model-policy.ts` `resolveClaudeModelAlias`; 어댑터·파서가 위임 | 복붙 규칙 금지 | MD-01 / VP-08 · `context-policy.ts`·`model-parser.ts` |
| data/control flow | mount 즉시 invoke | `whenReady` → invoke | 부트 레이스 | SD-01 / VP-04 · `chatStore.ts`·`updateStore.ts` |
| state/contract | `ParsedModel`·`AgentModelView` 에 증거 없음 | `resolvedModel?: string` 추가 · `TurnRequest.permissionModel?` · `RuntimeLiveTurn.spawnedPermissionModel?` · renderer state `modelResolved` | alias 증거 운반 | AR-01·AR-02 / VP-06·VP-07 |
| error/lifecycle | live 변경 = 정착값을 live·저장·응답에 | 선택 저장·응답, live는 그대로 받을 때만 | 답변 중 강등 · D-008 | SD-02 / VP-05·VP-10 |
| test seam/관측점 | `window.orca.boot` 미주입 하네스 | 보류 promise로 순서 관측 · coordinator `setup(kind, model, live, permissionModel)` | 순서·live 호출 여부 관측 | MD-03·MD-06 / VP-10·VP-13 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/harnesses/claude/model-policy.ts` | alias→env 해석 순수 함수 | `(model, lookup) → string` | 파서(main features) · `context-policy.ts`(adapters) |
| `features/harnesses/claude/model-parser.ts` | 목록 항목에 `resolvedModel` 부착 | settings env / runtimeEnv → `ParsedModel[]` | runtime-catalog · settings service |
| `features/harnesses/common/models.ts` | 선택 항목의 증거 이름 | `(models, family) → string \| undefined` | `resolve-turn.ts` |
| `shared/permission-mode.ts` | 증거 선택(`resolvedModel ?? model`) + 정착 | 기존 시그니처 + 선택 필드 | renderer·main |
| `features/approvals/coordinator.ts` | 선택 저장·응답, live 조건부 적용 | `{sessionId, mode}` → 선택 | IPC |
| renderer `chatStore`·`updateStore` | main-ready 대기 | — | Provider effect |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| SD-01·MD-06 / VP-01·VP-04·VP-13 — **EP-1** | 부팅 게이트 밖 mount invoke 중 `register(ctx)` 채널은 `whenReady` 이후 | D-001 | renderer | ① `chatStore.ts` `bootstrapChat` 의 `sessionApi.cwd` ② `updateStore.ts` `initUpdate` 의 `updateApi.state` (2) | `rg -n "sessionApi\.cwd\(\|updateApi\.state\(" app/src/renderer/src --glob '!*.test.*'` → 2 · 술어 = 레이스 sink · 범위 = renderer 전체 | 부팅 토스트/`actionError` 재발 |
| AR-01 / VP-02·VP-06 — **EP-2** | bare alias 항목의 `resolvedModel` = `resolveClaudeModelAlias(alias, lookup)` (해석이 원문과 다를 때만 존재) | D-003·D-007 | main 파서 → wire → renderer | ① `parseRuntimeModels`(lookup = `runtimeEnv`) ② `parseClaudeModels` 의 discovered 항목(lookup = settings `env`) ③ `toAgentEnvironment` 통과 ④ `AgentModelView.resolvedModel?` 타입 ⑤ `ClaudeModeControl` prop 타입·`modeMenuOptions` 입력 (5) | `rg -n "resolvedModel" app/src --glob '!*.test.*'` 결과가 ①~⑤ 파일 집합과 차집합 0 · 술어 = 증거 필드 · 범위 = producer→consumer 전 경로 | 메뉴 미노출 지속(AC5) |
| AR-02·MD-02·MD-05 / VP-02·VP-07·VP-09·VP-12 — **EP-3** | 모든 권한 정착은 증거 = `resolvedModel ?? model`(renderer) / `permissionModel`(main) | D-003 | renderer·main | ① `shared/permission-mode.ts` `coercePermissionMode` 증거 선택 ② `send.ts:545` ③ `send.ts:683`(연속 턴: `prepared.permissionModel`) ④ `send.ts:616` `TurnRequest.permissionModel` ⑤ `continuation.ts:46,79` + `chat-turn-continuation.ts:69-74`(`permissionModel ?? fallbackPermissionModel`) ⑥ `chatReducer` `SET_MODEL`(1661, `action.modelResolved`) ⑦ `SET_PERMISSION_MODE`(1616) ⑧ `SET_AGENT_KIND`(853) — ⑥⑦⑧은 `{alias, model: modelFamily, resolvedModel: modelResolved}` (8) | `rg -n "coercePermissionMode\(\|coerceAutoPermissionModeForModelName\(\|permissionModel" app/src --glob '!*.test.*'` · 비대상: `chatReducer.ts:533`(초기 null) · `:1491`(세션 로드 — `modelResolved` 초기화 후 Composer `SET_MODEL` 이 재정착, 아래 경계) | alias 턴이 화면/실행에서 강등 |
| MD-03 / VP-03·VP-10 — **EP-4** | live 변경: 저장·응답 = selection · live 적용은 `coerce(selection, spawnedPermissionModel ?? spawnedModel) === selection` 일 때만, 아니면 live 미호출 | D-008 | coordinator · runtime | ① `coordinator.ts` 저장(`setMode`)·응답 = selection ② live `setPermissionMode` 호출 조건 ③ `session-runtime.ts:520` `spawnedPermissionModelValue = req.permissionModel ?? req.model`, `:784` 해제 (3) | `rg -n "setMode\(sessionId\|setPermissionMode\(\|spawnedPermissionModel" app/src/main --glob '!*.test.*'` | 답변 중 칩 강등(AC9) / 5.5 alias live 미적용(AC10) |
| MD-01 / VP-08 — **EP-6** | `resolveClaudeModelAlias` | D-003 | shared | ① 함수 본문 ② `context-policy.ts` `resolveCliModel` 위임 (2) | `rg -n "ANTHROPIC_DEFAULT_\\$\{" app/src --glob '!*.test.*'` → 1(shared 안) | 해석 규칙 이원화 |
| R-04 / VP-16 — **EP-7** | 보내지 않은 칩 변경은 메모리에만 — 재진입은 유지, 재시작은 `last_model` | D-009 | renderer reducer · history writer | ① `chatReducer.ts` `LOAD_SESSION` `preserveLocalState` 분기(새 필드 `modelResolved` 포함 유지) ② 캐시 없는 `LOAD_SESSION` 분기(`modelResolved` 초기화) (2) — `last_model` 쓰기는 턴 영속 2자리뿐(변경 없음) | `rg -n "preserveLocalState" app/src/renderer/src/features/chat --glob '!*.test.*'` → 4(타입 1·분기 1·발신 2) | 재진입 시 선택 소실 / 재시작 시 미전송 선택 부활 |

**규칙 칸 분기 ↔ UT 입력** (EP-6 · EP-3 ① · EP-4 · EP-1 · EP-7) — rev.2에서 EP-5 폐기(D-008):

| 자리 | 규칙 분기 | 구별 입력 |
|---|---|---|
| EP-6 | (a) 정확한 계열 alias + env 값 → env 값 · (b) alias + env 없음/빈 문자열 → 원문 · (c) 대소문자·`[1m]` 접미(`Haiku[1m]`) → 계열 인식, env 값 반환 · (d) 비-alias(`claudecode-haiku-5.5`, `my-haiku`) → 원문 | `lookup` 가 `ANTHROPIC_DEFAULT_HAIKU_MODEL`='claude-haiku-5-5', `ANTHROPIC_DEFAULT_SONNET_MODEL`='claude-sonnet-5-5'(형제 구별) |
| EP-3 ① | (a) `resolvedModel` 자격 + `model` alias → auto · (b) `resolvedModel` 부재 + `model` alias → fallback · (c) `resolvedModel` 비자격(`claude-haiku-4-5`) + `model` 자격 → fallback(증거 우선순위) | 세 입력 × kind 2 |
| EP-4 | (a) spawn 증거가 선택을 그대로 받음 → live 1회 적용, 저장/응답=선택 · (b) 받지 못함 → live 호출 0, 저장/응답=선택 · (c) idle → 종전(`permissionModeForAgent`) · (d) (a)에서 SDK 실패 → `undefined`, 저장 0(종전) | (a) `spawnedModel`='haiku' + `spawnedPermissionModel`='claude-haiku-5-5' + auto / `claude-sonnet-4-5` + bypass · (b) `claude-sonnet-4-5` + auto(Work·Code) · (c) live 없음 · (d) reject |
| EP-1 | (a) ready 전 → 0회 · (b) ready resolve → 1회 · (c) ready reject → 0회·보고 0 · (d) ready 후 cwd reject → `chat.cwd.load-failed` 1회 | 보류 promise / resolve / reject / cwd reject |
| EP-7 | (a) 재진입(`preserveLocalState`, 같은 sessionId) → 네 필드 유지 · (b) 캐시 없는 로드 → `last_model` 기준 기본값, `modelResolved` null | (a) 칩을 `claude-haiku-5-5`·auto로 바꾼 state + `session.modelFamily='claude-sonnet-4-5'` · (b) 같은 session, `preserveLocalState` 없음 |

- 자리 목록은 위 검색 출력과 차집합 0이어야 한다.
- **선언 경계**: (1) alias 해석 lookup은 settings `env`·runtime `runtimeEnv` 레이어만 본다 — app/custom/process env 또는 adapter patch가 `ANTHROPIC_DEFAULT_*` 를 덮는 배포는 목록 판정에 반영되지 않는다(`harness-config.ts:363-370` 레이어 순서 실측). (2) 세션 로드(`chatReducer.ts:1491`) 직후 Composer의 `SET_MODEL` 이전 한 프레임은 `modelResolved=null` 로 판정한다 — `SET_MODEL` 이 `permissionModeExplicit=false` 상태에서 기본값으로 재정착한다(`chatReducer.ts:1661-1666`). (3) 부팅 게이트 밖 **신규** mount invoke를 막는 소스 가드는 두지 않는다 — 현재 트리의 대상은 EP-1 2자리뿐이다(§8 전수).
- 열린 입력 집합 판정 산출물: 해당 없음.
- 같은 규칙이 여러 레이어: alias 해석은 EP-6 SSOT 하나, 자격 판정은 `supportsAutoPermission` 하나. 파서·어댑터·정착부는 위임만 한다.
- 선택적 필드 의미: `resolvedModel` 부재 = "alias가 아니거나 env 미설정" — 증거는 `model` 로 폴백(fail-closed: alias는 자격 없음). `permissionModel` 부재 = `model` 사용. `spawnedPermissionModel` 부재 = `spawnedModel` 사용.
- 외부 SDK 경계: `setPermissionMode` 에는 기존대로 정규화 모드 → `toClaudePermissionMode`. 바뀌지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/harnesses/claude/model-policy.ts` | EP-6 | `resolveClaudeModelAlias(model, lookup)` 추가(정확한 계열 비교, `[1m]` 무시·대소문자 무시) | 순수 단위 |
| `app/src/main/adapters/claude/context-policy.ts` | EP-6 ② | `resolveCliModel` 의 alias 단계를 위 함수로 위임(동작 불변) | 기존 `context-policy.test.ts` |
| `app/src/main/features/harnesses/common/model-types.ts` · `shared/ipc.ts` | EP-2 ④ | `ParsedModel.resolvedModel?` · `AgentModelView.resolvedModel?` | typecheck + IT |
| `app/src/main/features/harnesses/claude/model-parser.ts` | EP-2 ①② | `normalizeModelEntries` 뒤 lookup으로 `resolvedModel` 부착(원문과 같으면 생략) | `model-parser.test.ts` |
| `app/src/main/features/harnesses/common/models.ts` | EP-2 ③ · AR-02 | `toAgentEnvironment` 통과 확인 · `permissionModelForFamily(models, family)` 추가(`modelNameForFamily` 와 같은 선택 규칙, 결과 `resolvedModel ?? modelIdentity`) | `models.test.ts` |
| `app/src/main/app/chat-turn/resolve-turn.ts` · `chat-turn-continuation.ts` · `continuation.ts` · `send.ts` | EP-3 ②~⑤ | `permissionModel` 반환·운반 · send/연속 턴 정착 입력 교체 | send·continuation 단위 |
| `app/src/main/adapters/common/turn.ts` · `contracts/ports.ts` · `features/sessions/session-runtime.ts` | EP-4 ③ | `TurnRequest.permissionModel?` · `RuntimeLiveTurn.spawnedPermissionModel?` · 기록/해제/getter | runtime 단위 |
| `app/src/main/features/approvals/coordinator.ts` | EP-4 ①② | selection 저장·응답 · live는 그대로 받을 때만 | `coordinator.permission.test.ts` |
| `app/src/shared/permission-mode.ts` | EP-3 ① | 입력 `{alias; model; resolvedModel?}` · 증거 = `resolvedModel ?? model` | 순수 단위 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | EP-3 ⑥⑦⑧ | state `modelResolved: string \| null`(초기 null) · `SET_MODEL.modelResolved?` · 세 정착 자리 입력 교체 · 세션 로드 시 null | reducer 단위 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | EP-1 ① · EP-3 | `bootstrapChat`: `bootApi.whenReady()` 후 `sessionApi.cwd()`; ready reject는 조용히 종료(CONSUMED), cwd reject는 `reportError('chat.cwd.load-failed','loadFailed')` · `setModel(…, options.resolvedModel)` | store 단위 |
| `app/src/renderer/src/features/update/store/updateStore.ts` | EP-1 ② | `initUpdate`: `whenReady` 를 try 밖에서 대기, reject면 반환 | store 단위 |
| `app/src/renderer/src/features/chat/components/Composer.tsx` · `harnesses/claude/composer/{Controls,modes}.ts(x)` | EP-2 ⑤ · EP-3 | `setModel` 4자리에 `{resolvedModel: model.resolvedModel}` · prop 타입 확장 | `modes.test.ts` |
| `app/src/renderer/src/shared/errors/reportSites.registry.test.ts` | 운영 gate | `chatStore.ts` 새 catch 행 추가·이후 서수/줄 갱신 · `updateStore.ts` 변경 시 동일 | 레지스트리 테스트 |
| 테스트 하네스(`chatStore.lastCwd.test.ts` 등 `bootstrapChat` 호출 3파일) | — | `window.orca.boot.whenReady` 주입 | — |

### 테스트 가능성

- electron/DB 분리: 대상 모듈 전부 이미 vitest 대상(순수 shared · coordinator는 `handle` 훅 주입 테스트 실재 `coordinator.permission.test.ts:1-60`).
- 기존 메커니즘 재사용: `bootApi.whenReady` 는 main `started` promise를 그대로 반환하므로 여러 번 invoke해도 같은 결과(`index.ts:306`).
- 순서 관측: 보류 promise를 `window.orca.boot.whenReady` 로 주입해 resolve 전 호출 수를 단언.

## 12. End-to-end 영향

### producer → consumer

```text
settings env / runtimeEnv → model-parser(resolvedModel) → toAgentEnvironment → orca:agent:list
   → Composer → setModel(resolvedModel) → state.modelResolved → modes/reducer 정착
   → resolve-turn(permissionModel) → send 정착 · TurnRequest.permissionModel → SessionRuntime → coordinator
```

- producer 기준: `resolvedModel` 은 해석이 원문과 다를 때만 존재.
- consumer 파생 규칙: 증거 = `resolvedModel ?? model`. 실행 문자열(`modelIdentity`)은 `resolvedModel` 을 쓰지 않는다(D-007).
- 파생 합성값이 정본을 우회하지 않는가: 자격 판정은 언제나 `supportsAutoPermission` 을 지난다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `chatStore.lastCwd.test.ts:28` 늦은 부트 조회 | cwd 시드가 `whenReady` 뒤로 밀림 — 사용자 선택 우선 규칙(`cwdSelectionRevision`) 유지 | AC1 + 기존 케이스 |
| `orca:agent:list` 소비자(OpenCode 메뉴 등) | 선택 필드 추가뿐 | AC4 |
| `IPC_CONTRACT.md:607` 소비자(renderer `synchronizePermissionMode`) | 응답이 선택값 — `APPLY_PERMISSION_MODE` 가 선택을 유지 | AC9 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 조회는 effect 1회. StrictMode 이중 mount에서 cleanup 뒤 늦게 끝난 cwd 조회는 기존 `cwdSelectionRevision` 비교만 거친다 — 추가 상태 없음.
- 취소/중단: 해당 없음.
- 종료/quit/crash: `spawnedPermissionModelValue` 는 `spawnedModelValue` 와 같은 지점(`:784`)에서 해제.
- retry/timeout/partial failure: coordinator SDK 실패 → `undefined`, 저장 0(종전 유지).
- **다중 저장소 쓰기**: coordinator — live SDK 적용 후 controller 저장. 순서·실패 의미는 종전과 같다(SDK 실패면 저장 0). 산출 문서 사본: 이 plan + `INDEX.md` 행(상태·다음 주체).

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 부팅 시 `boot:whenReady` invoke +2(cwd·update). 상한 고정.
- 새 출력: 모델 항목당 선택 문자열 1개.
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port: `RuntimeConfigAugmenter` 는 불변 — `runtimeEnv` 에 `ANTHROPIC_DEFAULT_*` 를 넣으면 이번 변경으로 자동 승인 자격이 생긴다.
- 구현 문서: `IPC_CONTRACT.md:99`(models 필드에 `resolvedModel?` 추가) · `:607`(저장·응답 = 선택, live는 spawn 모델이 선택을 그대로 받을 때만 적용) · `provider-runtime.md:226` 같은 문장 · `rendering.md:47`(env로 버전이 확인된 alias 포함).
- shape 검증: typecheck(`AgentModelView` 대입).
- semantics 검증: AC4·AC9.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| alias는 자동 승인 증거가 아니다 | `model-policy.ts:22-23,46-47` | D-003 | 유지 — env 해석값만 증거로 추가 |
| 버전 >4.5 · claude/claudecode 접두 | `model-policy.ts:42-58` · `rendering.md:47` | D-004 | 유지 |
| 지원 안 되는 자동 → Work default / Code accept_edits | 0215 D-010 `permission-mode.ts:25-28` | EP-4 (b) | 유지 |
| live 변경은 spawnedModel 정착값을 저장·응답 | `IPC_CONTRACT.md:607` · `provider-runtime.md:226` | D-008 | **변경** — 리포트 §2 + 사용자 정정(rev.2). 문서 같은 변경에서 갱신 |
| 사용자가 고른 승인 모드는 모델 전환으로 덮지 않는다 | `state.md:88` | D-008 | 유지(이번 변경이 live 경로까지 적용) |
| 모델 변경 = respawn | 0128 `session-runtime.ts:270-272` | D-008 근거 | 유지 |
| main-ready 필수 스텝 | 0109 `steps.ts:80-89` | D-002 | 유지 |
| settings 읽기 조기 등록 | 0244 `bootstrap.ts:446-452` | §8 비대상 | 유지 |
| 선택 식별자 = SDK 모델 문자열 | 0215 D-007 `model-identity.ts` | D-007 | 유지 |
| renderer 무음 catch 금지·레지스트리 | `reportSites.registry.test.ts` | §11 | 유지(레지스트리 갱신) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 진행 중 답변은 기존 모드인데 칩은 자동 승인 — 답변 중 승인 카드가 뜰 수 있음 | D-008: 칩은 다음 턴 설정이다(사용자 확정). AC13 실기에서 관측 |
| 레지스트리 서수 이동으로 무관 행 실패 | §11 레지스트리 갱신을 구현 범위에 포함 |

- 되돌리기 어려운 결정: 없음(선택 필드 추가·IPC 응답 의미 변경은 앱 내부 계약).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{harnesses/claude/model-policy.ts, permission-mode.ts, ipc.ts}`
- `app/src/main/adapters/{claude/context-policy.ts, common/turn.ts}` · `app/src/main/contracts/ports.ts`
- `app/src/main/features/{harnesses/claude/model-parser.ts, harnesses/common/{model-types,models}.ts, sessions/session-runtime.ts, approvals/coordinator.ts}`
- `app/src/main/app/{chat-turn/{send,resolve-turn,continuation}.ts, chat-turn-continuation.ts}`
- `app/src/renderer/src/features/{chat/{reducer/chatReducer.ts, store/chatStore.ts, components/Composer.tsx, harnesses/claude/composer/{Controls.tsx,modes.ts}}, update/store/updateStore.ts}` · `shared/errors/reportSites.registry.test.ts`
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md` · `docs/arch/frontend/rendering.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `src/main/AGENTS.md`(boundaries) · `src/renderer/AGENTS.md`.
- ABI/네트워크: egress 차단 시 DB 로드 5파일은 기준선 분리(`app/AGENTS.md` 서명).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: 코드 루프 `./node_modules/.bin/vitest run <suite>`.
- IMPL_DONE 전 마지막: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`.
- 사람 실기: AC13.

## READY self-review

- [x] Decision Ledger: D-001~D-004·D-007·D-008·D-009 ACTIVE, D-005·D-006 SUPERSEDED → D-008(rev.2).
- [x] Part I만으로 완료 상태가 설명된다(§1·§5 상태표).
- [x] 사용자 표현 원문 인용(§2), "커스텀 이름 항상 거부"는 실측으로 정정하되 요구 자체는 유지(§4).
- [x] 사용자 질의 0 — 비강등 해석이 유일함을 §4에 근거와 함께 적었다.
- [x] 수치 재측정: 정착 호출부 12 · 저장 5 · mount invoke 4(대상 2) · `setModel` 4 · TurnRequest model 4.
- [x] 저장소 규칙: boundaries(shared 위임만 추가) · 레지스트리 · 테스트 예산(타이머 없음). 후보 표 중 이번 파일과 겹치는 행 없음(`INDEX.md ## 새 handoff 후보` 확인).
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 가진다.
- [x] Baseline V, 모든 NEW/CHANGED node에 같은 레벨 REQUIRED pair, 영향받은 상위 node는 REGRESSION(VP-14·15).
- [x] pair마다 path·§10 자리·검색 명령·좌표, 적대 증거는 VP-03·06·07만(이유·자리). VP-11은 폐기 근거와 함께 SUPERSEDED.
- [x] 규칙 칸 분기 ↔ UT 입력 표.
- [x] 선언 경계 3건(측정 근거 포함).
- [x] 운영 gate 열거.
- [x] 사람 실기는 AC13(실제 SDK·로그)만.
- [x] structural proxy 단독 AC 없음 — EP-2 검색은 분모 고정용이고 판정은 AC4·AC5 행동 단언.
- [x] "X가 쓰인다" 불변식(증거 운반)은 VP-06·VP-07 제거 변이로, 자리 불변식(저장 vs live)은 VP-03 호출 대체·맞바꿈 변이로 잠근다.
- [x] 배타 상태: 선택/적용은 별도 변수, 선택 필드는 부재 의미를 §10에 고정.
- [x] producer/consumer · 문서 계약 end-to-end.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 메모에 적었다.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(r1)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: 해당 없음(r1)

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출** | … |
| **추가·수정 테스트의 subtree 규칙** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

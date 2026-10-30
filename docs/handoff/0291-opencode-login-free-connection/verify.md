# Verify — 0291-opencode-login-free-connection

## 메타

| 항목 | 값 |
|---|---|
| slug | `0291-opencode-login-free-connection` |
| 검증자 | Claude Code |
| 일자 | 2026-10-30 |
| 대상 커밋/range | `3fbdb75..69c32da` (r1 `69c32da`) |
| 구현 전 plan 기준 | `3fbdb75` (V1 설계, `Status: designed`) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `3fbdb75:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** — VP-17 root `PAIR_FAIL` 1건(EP-10 ② env 운반 항 미잠금). 나머지 기계 pair PASS, PLAN_GAP 0 |
| 자기 검증 여부 | **예** — r1 구현(`69c32da`)과 이번 검증이 같은 Claude 세션이다. 보고에 없는 적대 축 16건(X1~X16)과 §10 합계 독립 재계수를 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경은 메타 `상태` 1행과 `[구현자 기입]` 절뿐이다 — `git diff 3fbdb75 69c32da -- plan.md`의 hunk는 `@@ -12`(메타)·`@@ -759`(구현자 기입) 둘.
- 기준선은 diff로 성립한다 — 설계 `3fbdb75`와 구현 `69c32da`가 분리됐다.
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: 0건.
- 채점 기준: `3fbdb75`의 plan 원문 그대로.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 신규 handoff, 상속 V 없음 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | node 29 ↔ VP-01~VP-29, 레벨 일치 |
| 영향받은 INHERITED ↔ REGRESSION | 해당 없음 | Baseline. 다른 handoff 회귀는 R-06(VP-06)·R-12가 NEW로 닫는다 |
| §10 자리 목록·검색 재실행 차집합 | 유효 | Q2·Q5·Q6 재실행 — 목록 밖 운반 자리 0(§5 분모 표) |
| 선택 적대 증거·이유 | 유효 | 16건, 구조 proxy·배선·형제 슬롯·분기에만 선택 |
| SUPERSEDED pair 이관 | 해당 없음 | — |
| 운영 gate·범위 | 유효 | §7-A 6행, 기존 실패는 환경으로 분리 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-002·D-005·D-006 | connect 선언 행만 4상태·버튼 | `createLoginFreeConnections` → `AuthRuntime.snapshot` → `connectionInfo` → `providerRowMeta`·`ProviderAuthActions` |
| D-007·D-010 | 같은 설치 판정·1.x 판정, CLI 고정 인자 | `createHostHarnessPort` → `OpenCodeAdapter.listProviderModels` → `OpenCodeServerPool.listModels`(`server.ts:373`) |
| D-008·D-009 | 메모리만, 부팅마다 재확인 | 저장 포트 없음 · `bootstrap.ts:827-831` `run`의 `auth.connectAll()` |
| D-011·D-013 | 같은 결과면 교체 없음, augmenter가 결과를 읽음 | `login-free-connection.ts:141` canonical 비교 → `connectionValue` → augmenter |
| D-014·D-015 | OpenCode runtime 파서·settings 부재 `{}` | `parseOpenCodeRuntimeModels` · `loadOpenCodeProviderSettings` ENOENT |
| D-016~D-018 | placeholder·Orca 최상단·카드 순서 | `agentPlaceholder` · `orcaGroupFirst` · `orderAgentEnvironments` |
| D-019·D-020 | 채널 `orca:provider:connect`·이름 | `shared/ipc.ts:168` · handler · preload · `providerApi.connect` |
| D-021 | store 앱 수명 구독·최신 응답 | `createAgentStore` `ensureSubscribed`·`seq` |

```text
[연결 클릭 / 부팅 connectAll]
  → orca:provider:connect → AuthRuntime.connect → LoginFreeConnections(checking → run{signal,host})
  → host.installed / host.listModels → pool.listModels → execFile → parseOpenCodeModelListing
  → connected|failed → AuthChange → handler(push·invalidate·reconcile) → RuntimeModelCatalog
  → augmenter(connectionValue → runtimeModelsFromListing) → parseOpenCodeRuntimeModels → agent:list
  → agentStore(앱 수명 구독) → 엔진&모델(Claude → OpenCode) · 턴(merged 행 → catalog)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 타당 | run throw·timeout(120s race + abort)·직렬화 불가 → `failed`+사유. host 미주입 → `failed`(`login-free-connection.ts:103`) |
| false success | 없음 | 파서 해석 실패는 throw(`model-listing.ts:62-75`), 빈 목록 판정은 배포 몫 |
| partial failure/rollback | 타당 | 실패 시 `value`·`serialized` 삭제, 이전 valid면 revision+1(`:149-156`) |
| A 대신 B 구현 | 없음 | §1 표 경로가 Decision과 일치 |
| 증상만 제거 | 없음 | settings 부재는 ENOENT만 `{}`, JSON 오류는 throw 유지(`settings.ts:28-33`) |
| 최적화가 잃은 관측 | 없음 | 같은 결과 재연결은 `verified` 발행 — push는 남고 무효화만 생략(D-011) |
| worst-case 상한 | 유한 | CLI 60s·16MiB·연결 120s·메시지 500자·stderr 300자 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 3fbdb75..69c32da`

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 테스트 전용 신규 심볼 `orcaGroupFirst`·`createAgentStore`·`CONNECT_*_MESSAGE`·`OpenCodeCliError`·`OPENCODE_CLI_VERSION_MESSAGE` | 정상 | 전부 같은 파일 production에서 사용(`attachMenuModel.ts:199-202` · `agentStore.ts:76` · `login-free-connection.ts:103-126` · `server.ts:61·367`). 스크립트는 파일 밖 참조만 센다 |
| `connectionInfo`·`harnessRows`·`HarnessConfigApiDeps` 등 | 정상 | 기존 export, 같은 파일 내부 또는 배포 계약 타입 |
| 형제 정책 비대칭 | 없음 | 스크립트 출력 `(없음)` |
| 신규 등록값의 기존 소비처 | 무영향 | 새 cause 3종은 `runtime-model-startup.ts` 4갈래만 소비. 게이트·resume은 비-게이트 id 무시(plan §8) |
| producer ↔ consumer | 일치 | wire `connection`은 키 존재로 판별 — main `connection-views.ts:82`, renderer `providerAuthActionModel.ts:12`·`providerRows.ts:65·73` |
| 중복 구현 | SSOT 유지 | 1.x 판정 `isSupportedOpenCodeCliVersion` 1벌(start·listModels 공유) · 상수 snapshot `alwaysConnectedSnapshot` 1벌 · 기본 에이전트 `OPENCODE_DEFAULT_AGENTS` 1벌 |
| 가이드 레시피 ↔ 가상 배포 테스트 | **drift(경미)** | 가이드 `closed-network-extensions.md:946` `if (!listing?.length)` ↔ 테스트 `opencode-connection-deployment.test.ts:79` `if (!listing)`, 라벨 문자열도 다름. 호출·타입은 같다 → N1 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 oracle 좌표 실재: 42건 이름 검색 전부 실재. 구현자가 옮긴 4곳(`runtime.test.ts`→`login-free.test.ts`, `server.test.ts`→`server.list-models.test.ts`, `adapter.test.ts`→`adapter.list-models.test.ts`, `ExtensionsCatalogView.interaction`→`providerAuthWiring.render.test.ts:98-126`) 내용 확인.
- 가상 배포 AT의 조립: 실제 `createAuthRuntime`·`createHarnessRuntimeConfigService`·`createRuntimeModelCatalog`·`registerMiscHandlers`·`resolveTurnProvider`, fake는 `HostHarnessPort`뿐(`opencode-connection-deployment.test.ts:130-230`). `pushConnectionState`·`syncPlugins`는 noop — 관측 대상 아님.
- **선택된 적대 증거 재측정**: 등록 16건(배선 2건은 제거·빈 함수 두 형태로 = 18행) 전부 red.
- **자리 미지정 등록 변이**: VP-24 맞바꿈은 `providerRows.ts`의 두 표(라벨·tone) 각각에 심었다 — 둘 다 red.
- **이전 라운드 대조**: 해당 없음(첫 라운드).
- **자기검증 분모**: 보고에 없는 축 16건(X1~X16) — 같은 계약을 다른 자리에서 깨는 변이. **X1 못 잡음**. 추가로 §10 합계를 독립 재계수했다 → 자리 합 **93** ≠ 보고 `89/89`(N2).

**고장 이력**

범위: `MAIN` = `src/main/features/auth src/main/features/harnesses src/main/app src/main/adapters/opencode src/preload src/shared`(기준선 실패 9파일 제외, 260파일/2,601케이스). `REN` = `src/renderer/src`(391파일/3,193케이스). 변이 전 두 범위 모두 green.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M-S1 | `login-free-connection.ts:141` | 고정값 | 같은 결과 분기 `false &&` | MAIN | 신규 | 잡음 | `login-free-connection.test.ts:'같은 결과의 재연결은 revision…'` · 가상 배포 `'같은 결과의 재연결은 augmenter…'` | VP-13 등록 |
| M-S2 | `:134` | 다른 값 | `connection-started` credentialChanged true | MAIN | 신규 | 잡음 | 같은 파일 5케이스 | VP-13 등록 |
| M-S3 | `:159` | 고정값 | `connection-failed` credentialChanged 항상 true | MAIN | 신규 | 잡음 | `'실패는 메시지를 남기고…'` | VP-13 등록 |
| M-P1 | `resolve-turn.ts:277` | 호출 대체 | `toAgentEnvironments([selected]…)` 재조립 | MAIN | 신규 | 잡음 | `resolve-turn.runtime-catalog.test.ts:'OpenCode runtime key runs…'` · 가상 배포 성공 | VP-03 등록 |
| M-W1a | `bootstrap.ts:830` | 제거 | `void auth.connectAll()` 삭제 | MAIN | 신규 | 잡음 | `'Bootstrap run 콜백이…'` | VP-04 등록 |
| M-W1b | `bootstrap.ts:830` | 빈 값 | `void (() => {})`로 교체 | MAIN | 신규 | 잡음 | 같음 | VP-04 등록 |
| M-C1 | `Controls.tsx:218-219` | 다른 값 | 저장 effect가 표시값(`shown`) 저장 | REN | 신규 | 잡음 | composer 3파일 7케이스(`'shows placeholder agents…'` 포함) | VP-07 등록 |
| M-C2 | `Controls.tsx:24` | 제거 | placeholder prop 미전달 | REN | 신규 | 잡음 | `Module.integration.test.ts:'fills agents…'` 외 1 | VP-07 등록 |
| M-A1 | `runtime-model-startup.ts:67` | 호출 대체 | `auth.bind(id).snapshot()` | MAIN | 신규 | 잡음 | `'reads login-free and credential snapshots…'` | VP-16 등록 |
| M-R1 | `runtime-config.ts:159` | 제거 | `modelDetails` 전달 삭제 | MAIN | 신규 | 잡음 | `'passes augmenter modelDetails…'` · 가상 배포 성공 | VP-19 등록 |
| M-H1a | `bootstrap.ts:362` | 제거 | `loginFreeHost` 인자 삭제 | MAIN | 신규 | 잡음 | `'createAuthRuntime 호출은…'` | VP-20 등록 |
| M-H1b | `bootstrap.ts:362` | 빈 값 | `loginFreeHost: {}` | MAIN | 신규 | 잡음 | 같음 | VP-20 등록 |
| M-R2 | `catalog.ts:17` | 고정값 | 항상 `parseOpenCodeModels` | MAIN | 신규 | 잡음 | 4케이스(`catalog`·`misc`·`resolve-turn`·가상 배포) | VP-23 등록 |
| M-L1 | `providerRows.ts:43,46` | 맞바꿈 | idle↔failed 라벨 키 | REN | 신규 | 잡음 | `CustomizeList`·`ProviderDetail`·`providerRows` 4케이스 | VP-24 등록 |
| M-L2 | `providerRows.ts:52-53` | 맞바꿈 | connected↔failed tone | REN | 신규 | 잡음 | `providerRows`·`ProviderDetail` 2케이스 | VP-24 등록 |
| M-O1 | `attachMenuModel.ts:202` | 제거 | 플러그인 패널 Orca 정렬 삭제(native 먼저) | REN | 신규 | 잡음 | `Composer.native-menu.test.ts` 2 · `attachMenuModel.test.ts` | VP-26 등록 |
| M-E1 | `agentOrder.ts:15` | 호출 대체 | adapter 문자열 정렬 | REN | 신규 | 잡음 | `agentOrder.test.ts` · `AgentEnvironmentView.render.test.ts` | VP-27 등록 |
| M-G1 | `agentStore.ts:50` | 제거 | seq 비교 삭제 | REN | 신규 | 잡음 | `'ignores an older agent:list response…'` | VP-29 등록 |
| X1 | `server.ts:390` | 뒤집기 | env 병합 순서 → `{OPENCODE_DISABLE_PROJECT_CONFIG:'true', ...process.env, ...options.env}` | MAIN · **`src/main` 전체 506파일/5,388케이스** | 신규 | **못 잡음** | — 테스트 env에 같은 키가 없어 덮어쓰기가 관측되지 않는다 | EP-10 ② · VP-17 |
| X2 | `login-free-connection.ts:108` | 제거 | timeout의 `controller.abort` 삭제 | MAIN | 신규 | 잡음 | `'signal 을 무시한 run 도 시간 초과로…'` | EP-01·AC6 자기 축 |
| X3 | `connection-views.ts:86` | 빈 값 | `message: null` 고정 | MAIN | 신규 | 잡음 | `connection-views.test.ts` · 가상 배포 실패 2 | EP-12 ② |
| X4 | `runtime-listing.ts:52` | 제거 | variants 운반 삭제 | MAIN | 신규 | 잡음 | `runtime-listing.test.ts` · 가상 배포 성공 | EP-04 ⑥ |
| X5 | `ProviderAuthActions.tsx:53` | 고정값 | `busy={false}` | REN | 신규 | 잡음 | `ProviderDetail.render.test.ts:'colors the connection dot…'` | EP-12 ⑤ |
| X6 | `ProviderDetail.tsx:84` | 다른 값 | 사유 표시 조건 `failed`→`idle` | REN | 신규 | 잡음 | 같음 | EP-12 ⑥ |
| X7 | `harness-host.ts:17` | 제거 | `version` 운반 삭제 | MAIN | 신규 | 잡음 | `harness-host.test.ts:'installed uses…'` | EP-08 ④ |
| X8 | `server.ts:381` | 제거 | pool close signal 결합 삭제 | MAIN | 신규 | 잡음 | `'listModels aborts on caller signal and pool close'` | EP-10 ④ |
| X9 | `providerAuthActionModel.ts:19` | 맞바꿈 | connect↔reconnect 라벨 | REN | 신규 | 잡음 | `ProviderAuthActions.test.ts` · `ProviderDetail.render` | EP-12 ④ |
| X10 | `agentStore.ts:36` | 제거 | `subscribed = true` 삭제(중복 구독) | REN | 신규 | 잡음 | `'installs the provider subscription once…'` | EP-21 ① |
| X11 | `settings.ts:80` | 다른 값 | 기본 모델을 마지막 항목으로 | MAIN | 신규 | 잡음 | `settings.test.ts` · `registry.test.ts` | EP-05 ① |
| X12 | `server.ts:380` | 제거 | listModels의 1.x 판정 삭제 | MAIN | 신규 | 잡음 | `'listModels rejects unsupported versions…'` | EP-09 ② |
| X13 | `login-free.ts:35` | 고정값 | 포트 snapshot 항상 상수 | MAIN | 신규 | 잡음 | 가상 배포 6케이스 | EP-01 ② |
| X14 | `runtime.ts:315-317` | 고정값 | `AuthRuntime.snapshot` 로그인 프리 항상 상수 | MAIN | 신규 | 잡음 | `login-free.test.ts` 2 · 가상 배포 2 | EP-01 ③ |
| X15 | `login-free-connection.ts:178` | 제거 | `connectionValue` 상태 조건 삭제 | MAIN | 신규 | 잡음 | `'connectionValue는 connected일 때만…'` | EP-04 ① |
| X16 | `settings.ts:31` | 고정값 | 모든 읽기 오류를 `{}`로 | MAIN | 신규 | 잡음 | `'treats a missing settings file as an empty config'` | EP-07 ① |

- 검산: 시도 34 = 잡음 33 · 못 잡음 1(X1) · 동치 0. 등록 18행 + 자기 축 16행.
- 실행: `scratchpad/mut.sh`가 정확 문자열 1곳 치환 → vitest → 원복. 34건 모두 치환 1회 성공(`APPLY_FAIL` 0), 종료 후 `git status` 깨끗함.
- X1의 의미: 호출자 `env`(배포가 `listModels`에 넘기는 폐쇄망 환경값) 또는 호스트 `process.env`에 `OPENCODE_DISABLE_PROJECT_CONFIG`가 있으면 강제값을 덮어 프로젝트 설정이 섞인다 — §10 EP-10 `실패 의미` "프로젝트 설정 혼입". 현재 production 순서(`server.ts:390`)는 옳다. 운반 값(강제 키)이 형제 입력(호출자 env)과 충돌하지 않는 값으로만 주어져 좌표가 그 항을 닫지 않았다.
- 형제 슬롯 맞바꿈: VP-24 라벨·tone(M-L1·M-L2), 버튼 라벨(X9), 패널 순서(M-O1) — 전부 잡음.
- `N회` 관측 주체: augmenter `resolve` spy(가상 배포 `toHaveBeenCalledTimes(1)`) · run fake 호출 수(`'동시 두 번 호출은 run 을 한 번만…'`).
- 순서 관측: 리스너 → `connectAll`은 소스 가드(`run` 콜백 본문) + 기존 `runtime-model-startup.test.ts:220`.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|
| VP-21 | MD-01↔UT-01 | PASS | `login-free-connection.test.ts` 14케이스 · M-S1~3 · X2 · X15 | EP-01 3/3 · EP-02 3/3 |
| VP-22 | MD-02↔UT-02 | PASS | `model-listing.test.ts` 6 · `server.list-models.test.ts:'rejects provider id %j…'` | EP-11 2/2 |
| VP-23 | MD-03↔UT-03 | PASS | `settings.test.ts` 2 · `catalog.test.ts` · M-R2 · X11 · X16 | EP-05 · EP-06 · EP-07 |
| VP-24 | MD-04↔UT-04 | PASS | `providerRows.test.ts` · `ProviderAuthActions.test.ts` · M-L1·M-L2 · X9 | EP-12 ③④ |
| VP-25 | MD-05↔UT-05 | PASS | `agentSelection.test.ts:'uses provider catalog agents…'` | EP-18 ⑤ |
| VP-26 | MD-06↔UT-06 | PASS | `attachMenuModel.test.ts` 3 · M-O1 | EP-19 3/3 |
| VP-27 | MD-07↔UT-07 | PASS | `agentOrder.test.ts` · M-E1 | EP-20 ① |
| VP-28 | MD-08↔UT-08 | PASS | `runtime-listing.test.ts` 3 · X4 | EP-04 ⑤⑥ |
| VP-29 | MD-09↔UT-09 | PASS | `agentStore.test.ts` 2 · M-G1 · X10 | EP-21 ①② |
| VP-16 | AR-01↔IT-01 | PASS | `runtime-model-startup.test.ts:'reads login-free…'` · `login-free.test.ts:'snapshot은 두 체계와…'` · M-A1 · X13·X14 | EP-03 3/3 |
| **VP-17** | AR-02↔IT-02 | **PAIR_FAIL** | EP-10 ② env 강제 키 항 미잠금 — X1 못 잡음(`src/main` 5,388케이스 green). 나머지 자리 PASS(X7·X8·X12·M-H1) | EP-08 8/8 · EP-10 **3/4** |
| VP-18 | AR-03↔IT-03 | PASS | `connection-views.test.ts` · `providers.test.ts` 3 · `preload/index.test.ts` 신규 · X3 | EP-12 · EP-13 |
| VP-19 | AR-04↔IT-04 | PASS | `runtime-config.test.ts` · `registry.test.ts` · M-R1 | EP-04 · EP-05 |
| VP-20 | AR-05↔IT-05 | PASS | `deployment-wiring.test.ts` 능력 케이스 · 소스 가드 · M-H1a/b | EP-17 2/2 · EP-14 |
| VP-13 | SD-01↔ST-01 | PASS | VP-21과 공유 증거 + `login-free.test.ts:'연결 전이는 Auth change 로 흐르고…'` | EP-01 · EP-02 · EP-15 |
| VP-14 | SD-02↔ST-02 | PASS | 가상 배포 생명주기 3케이스(augmenter 호출 수·교체·삭제) | EP-03 · EP-04 |
| VP-15 | SD-03↔ST-03 | PASS | `agentStore.test.ts:'refreshes on provider pushes…'` | EP-21 |
| VP-01 | R-01↔AT-01 | PASS | `CustomizeList.render` · `ProviderDetail.render` · `providerAuthWiring.render.test.ts:98-126` · X5·X6 | EP-12 7/7 · EP-13 7/7 |
| VP-02 | R-02↔AT-02 | PASS | 가상 배포 `'연결 성공은…'`·`'설치되지 않은 호스트는…'` | EP-04 · EP-05 · EP-17 |
| VP-03 | R-03↔AT-03 | PASS | `resolve-turn.runtime-catalog` · `misc.runtime-catalog` · M-P1 | EP-06 3/3 · EP-07 1/1 |
| VP-04 | R-04↔AT-04 | PASS | 소스 가드 + 감도 9입력 · `runtime-model-startup.test.ts:220` · M-W1a/b | EP-14 2/2 |
| VP-05 | R-05↔AT-05 | BLOCKED_BY:VP-17 | 같은 좌표(`server.list-models.test.ts:'listModels runs the models command…'`)·같은 root | EP-08 · EP-09 2/2 · EP-10 3/4 |
| VP-06 | R-06↔AT-06 | PASS | 기존 케이스 무수정 green — `login-free-deployment.test.ts:339` 등(§7 주의) · 전체 vitest 8,213 pass | EP-01 · EP-16 4/4 |
| VP-07 | R-07↔AT-07 | PASS | `Module.integration`·`Controls.interaction` · M-C1·M-C2 | EP-18 5/5 |
| VP-08 | R-08↔AT-08 | PASS | `Composer.native-menu.test.ts:'…puts the Orcinus orca group first in both panels'` · M-O1 | EP-19 3/3 |
| VP-09 | R-09↔AT-09 | PASS | `AgentEnvironmentView.render.test.ts:'orders engine cards…'` · M-E1 | EP-20 2/2 |
| VP-10 | R-10↔AT-10 | PASS | `deployment-wiring.test.ts:528·537·552` · `gate:check-doc-inventory --check` ok | EP-16 4/4 · EP-22 14/14 |
| VP-11 | R-11↔AT-11 | 사람 실기 대기 | §19 체크리스트 — 기계 범위 밖 | 0 |
| VP-12 | R-12↔AT-12 | PASS | `useEngines.test.ts:'shows a runtime card added while…'` · `gate:rg subscribeAgents = 0` | EP-21 ③④ |

- root `PAIR_FAIL`: **VP-17** (EP-10 ②).
- 종속 `BLOCKED_BY`: VP-05 → VP-17 (같은 좌표·같은 원인, 부풀리지 않음).
- 실행 범위: 최초 검증 — REQUIRED 29 전건.
- 좌표의 실행 구간: 가상 배포 AT는 production 조립(`loginFreeHost`·augmenter·파서·settings loader)을 주입하고 host만 fake다. `server.list-models.test.ts`는 `runCli`만 주입해 `listModels` 본문 전 구간을 실행한다 — X1은 구간 안이지만 운반 값이 구별되지 않았다.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | VP-01·VP-18·VP-24 |
| AC4·AC5·AC6 | ✅ | VP-13·VP-21, X2(abort) 포함 |
| AC7·AC8 | ✅ | VP-04·VP-14·VP-16 |
| AC9 | ✅ | `harness-host.test.ts` 2 · X7 |
| **AC10** | ⚠️ | 동작은 맞다(`server.ts:385-395` argv·cwd·env 순서·한계). env 강제 키의 우선을 잠그는 단언이 없다(X1) |
| AC11·AC12·AC13·AC14 | ✅ | VP-22·VP-23·VP-03·VP-19·VP-28 |
| AC15 | ✅ | 가상 배포 2케이스. 레시피 문자열 drift는 N1 |
| AC16·AC17·AC18 | ✅ | VP-04·VP-10·VP-20·VP-06 |
| AC19·AC20·AC21·AC22 | ✅ | VP-07·VP-08·VP-09·VP-12·VP-29 |
| AC23 | ✅ | 문서 14곳 diff 존재 · inventory `--check` ok(116채널) |
| AC24 | ⚠️ | 사람 실기 |

- **합계 재측정**: ✅ 22 · ⚠️ 2 · ❌ 0 = 총 24. 자기보고 `23/24` → 불일치(AC10).
- **합계 사본 대조**: 구현 본문 `23` ↔ trailer `Criteria-Met: 23/24` ↔ INDEX 비고 `23/24` — 셋은 서로 일치.

### pair별 plan §10 강제 지점 분모

| EP | 목록 | 확인 | 목록 밖 / 고장 ID | 결과 |
|---|---|---|---|---|
| EP-01~EP-09 | 3·3·3·6·6·3·1·8·2 | 전부 좌표 실재·구간 안 | M-S·M-A1·M-R·X7·X12~X16 잡음 | PASS |
| **EP-10** | 4 | ①③④ 닫힘(X8 잡음), **② env 강제 키 미잠금** | X1 못 잡음 | **PAIR_FAIL(VP-17)** |
| EP-11~EP-14 | 2·7·7·2 | 전부 | X3·X5·X6·X9·M-L·M-W 잡음 | PASS |
| EP-15 | 2 | ① `rg` Q8 재실행 0줄 + 양성 `login-free.test.ts:'연결 경로는 디스크를…'` ② 저장 deps 부재 — 운반 값 없는 구조 자리, plan이 typecheck로 지정 | — | PASS |
| EP-16~EP-21 | 4·2·5·3·2·4 | 전부 | M-C·M-O1·M-E1·M-G1·X10 잡음 | PASS |
| EP-22 | 14 | 문서 14곳 diff · inventory ok | — | PASS |

- 자리 합: 3+3+3+6+6+3+1+8+2+4+2+7+7+2+2+4+2+5+3+2+4+14 = **93**. 구현 보고 합계 `89/89`는 행 값(동일 93)과 다르다 → N2.
- 검색 재실행: Q2·Q5·Q6 — 목록 밖 운반 자리 0. Q5의 `background-task.ts`·`CanonicalBackgroundContent.tsx` hit은 다른 `connection` 필드(백그라운드 작업 상태)다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| app lint | PASS | `npm run lint` 0 error / 2 warning(기존 `useVirtualizer`), 실행 후 `git status` 변화 0 |
| app typecheck | PASS | `npm run typecheck` 3분할 exit 0 |
| vitest(전체) | 환경 한계 분리 | 876파일 — 864 pass · 9 fail · 3 skip / 8,243케이스 — 8,213 pass · 21 fail · 9 skip. 같은 9파일·21케이스가 `3fbdb75` worktree에서도 실패(변경 무관, 0289 verify의 "Linux 전용 21 fail"과 같은 집합) |
| doc inventory | PASS | `check-doc-inventory --check` — generated ok(9 items, 116 channels)·prose ok·links ok |
| message-bus | PASS | `git log -1 --format='%(trailers:only=true)' 69c32da` → 6키 + Co-Authored-By·Claude-Session 파싱 |
| CI(windows) | 미관측 | 이 환경에서 실행 불가 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| 가이드 §4 연결 레시피 | 테스트가 같은 API(`connect.run`·`listedModelsOf`·`runtimeModelsFromListing`·`bindLoginFreePlugin`)를 실제 타입으로 컴파일 | 성공·미설치 실행 | PASS — 가드 조건·라벨 문자열 drift는 N1 |
| OpenCode CLI 출력 | v1.18.27 형상 fixture(`model-listing.test.ts`) | 깨진 블록 throw · 다른 provider 제외 | PASS(실제 CLI는 AC24) |

## 7. 숫자 / 상한 재측정

- §10 자리 합 93(보고 89) — N2.
- 선택 증거 16 = 보고 16. AC 24.
- 상한: CLI `timeout:60_000`·`maxBuffer:16MiB`(`server.list-models.test.ts` 단언) · 연결 120,000ms(fake timer 케이스) · 메시지 500자(`'빈 메시지는 기본 문구, 긴 메시지는 500자로…'`).

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| AC24 | 상태·라벨·tone·순서·파서·생명주기 전부(§5) | Windows 실제 OpenCode 1.x: 연결 → 초록·카드·턴 / 미설치·잘못된 provider → 빨강·사유 / 재시작 / white·dark / Composer placeholder·`+` 메뉴·엔진 순서 / T6 경로(plan §19) |

## 9. 게이트 재실행

- 명령: `cd app && npm run lint && npm run typecheck && ./node_modules/.bin/vitest run && node scripts/check-doc-inventory.mjs --check`. `npm test` 미사용.
- 기준선 대조: `git worktree add scratchpad/base 3fbdb75` + node_modules symlink → 실패 9파일 재실행 = 9 fail/21 케이스.
- 작업 트리 변화: 없음(lint autofix 0, 변이는 매번 원복, 최종 `git status` 깨끗함).
- 잔여물: scratchpad worktree는 검증 종료 시 제거한다. `node_modules/electron/path.txt`는 구현 턴 stub(미추적·ignore)로 그대로 둔다.

## 10. 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/vitest | 실행·산출 관측 | — | §5 gate |
| AC ↔ production path | 1:1 대조 | — | ✅22·⚠️2 |
| 레이어·문서 링크 | lint boundaries·inventory | — | PASS |
| 시각(theme·busy·점 색) | 상태·class는 render 테스트 | **AC24** | 대기 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude(검증) = 실제 상태. 대상 커밋 자리표시자 `(r1 구현 — 검증자 기입)` → `69c32da`(`git cat-file -t` = commit, origin 브랜치 HEAD와 일치)로 기입.
- 비고 5줄 이내: 구현 턴 비고 3줄 — 이번 갱신도 5줄 이내로 쓴다.
- trailer: 허용값·파싱 정상(§5 gate).
- `[구현자 기입]` 7필드: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals — 전부 표/목록으로 존재. 강제 지점 표는 22 EP 전 자리와 `남긴 곳` 열을 담는다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 | 반영 |
|---|---|---|
| 테스트 위치 4곳 이동 | 구현 세부 — 행동 단언 동일 확인(§4) | 없음 |
| 상태기계 의존 `publish`→`notify` | 타당 — artifact `.publish(` 스캔 오인 회피 | 없음 |
| 위생 테스트 3곳 선조치(오류 보고 등록부·Bootstrap fake·`.publish(` 스캔) | 타당 | 없음 |
| 잠재 문제 #1 재연결 checking 중 `connectionValue` undefined | 계약대로. 일반 재연결은 revision 불변이라 augmenter 미호출(VP-14) | 기록 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `listModels` env의 강제 `OPENCODE_DISABLE_PROJECT_CONFIG='true'` 우선을 잠그는 단언 없음 — X1(순서 뒤집기) `src/main` 5,388케이스 green | VP-17 · EP-10 ② · AC10 | **BLOCKING** (`PAIR_FAIL`) | 구현: `server.list-models.test.ts`에서 호출자 `env`(와 `process.env`)에 같은 키를 `'false'`로 넣고 결과 `'true'`를 단언. X1 재실행 red 확인 |
| N1 | 가이드 레시피 augmenter `if (!listing?.length)`·라벨 ↔ 가상 배포 `if (!listing)`·다른 라벨 — AC15 "그대로" 문자 불일치 | AC15 문서 shape | NON_BLOCKING | r2에서 테스트 레시피를 가이드 문자열과 맞추면 좋다 |
| N2 | 구현 보고 §10 합계 `89/89` — 행 합 93 | 자기보고 사본 | NON_BLOCKING | 다음 `[구현자 기입]`에서 93으로 |
| N3 | `runtimeModelsFromListing`의 `model.id in modelDetails`는 prototype 키(`constructor` 등)를 중복으로 본다 | 비귀속 | NON_BLOCKING | OpenCode id는 항상 `provider/model`이라 도달 불가 — 기록만 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 첫 라운드. 축은 0265 r2(운반 값이 형제와 충돌하지 않는 fixture라 항 제거·순서 변이가 green)와 같은 모양이다.
- 관련 plan 지침: §10 EP-10 ② 자리 고정·`실패 의미` "프로젝트 설정 혼입"이 있었다. 구현 보고는 "env 병합"을 운반 항으로 적었으나 구별 값은 `CORP_TOKEN_HINT`뿐이었다.
- 사용자 결정 변경: 없음.
- 반복 환경 한계: Electron 바이너리 403 · Linux 전용 21 fail(0289와 동일 집합).

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair 결과: PASS 26 · root PAIR_FAIL 1(VP-17) · BLOCKED_BY 1(VP-05) · 사람 실기 대기 1(VP-11).
- PLAN_GAP: 없음.
- Product/UX·ACTIVE Decision: 충족 — production 코드 결함은 찾지 못했다. 실패는 EP-10 ② 잠금 누락이다.
- AC: ✅22 · ⚠️2(AC10 잠금, AC24 실기) · ❌0.
- 운영 gate: lint·typecheck·inventory·trailer PASS. vitest 21 fail은 기준선과 동일.
- NON_BLOCKING: N1·N2·N3.
- 다음 단계: r2 구현 — D1 테스트 보강(코드 변경 불요 예상) 후 재검증. 재검증 범위는 VP-17·VP-05와 X1 재실행, 이번 `잡음` 33행 중 영향 행.

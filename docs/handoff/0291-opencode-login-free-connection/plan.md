# Plan — 0291-opencode-login-free-connection

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**
> 경로는 `app/src/` 기준이며 `app/src/` 접두를 생략한다(문서 경로는 저장소 루트 기준).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0291-opencode-login-free-connection` |
| 작성자 | Claude Code |
| 일자 | 2026-10-30 |
| 매핑 | 브랜치 `claude/opencode-auth-plugin-0xnv64` |
| 상태 | impl/IMPL_DONE |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Codex — 기능 구현(계약 + 인프라 + renderer). 버그 리포트(D-021)도 같은 라운드에 포함 |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제** — 폐쇄망 배포가 OpenCode LLM 설정을 로그인 프리 플러그인으로 제공하려 해도 mainline이 막는다.
  1. 로그인 프리 상태가 상수다 — `main/features/auth/login-free.ts:22-27`이 항상 `valid·verified`를 돌려줘 '연결'·초록/빨강을 표현할 자리가 없다.
  2. 배포 파일은 호스트 프로그램을 실행할 수 없다 — `child_process`는 Git·`opencode/v1/server.ts`·`features/plugins/**`만 허용한다(`app/eslint.config.mjs:242-256`).
  3. OpenCode runtime 카드가 동작하지 않는다 — Claude 파서 폴백(`main/app/harnesses/registry.ts:35-39`), 모델 덮어쓰기(`main/adapters/opencode/v1/catalog.ts:16`), 턴의 provenance 소실(`main/app/chat-turn/resolve-turn.ts:274`), settings 파일 부재 오류 토스트(`opencode/v1/settings.ts:25` → `features/harnesses/common/settings.ts:115-122`).
  4. (버그 리포트) 인증 직후 엔진&모델에 runtime 카드가 간헐적으로 없다 — agent 목록 갱신 구독이 화면 마운트 동안만 있고(`renderer/src/features/engine/common/hooks/useEngines.ts:31`·`renderer/src/shared/hooks/useAgents.ts:12`) 재진입은 캐시를 돌려주며(`renderer/src/shared/stores/agentStore.ts:41-45`) 동시 재조회의 순서를 보장하지 않는다(`agentStore.ts:22-27`).
- **완료 후 달라지는 것** — 폐쇄망 배포가 `app/deployment/` 파일만 채우면 플러그인 탭 '연결' → OpenCode 설치 확인·`opencode models <provider> --verbose --pure` → 초록/빨강 → 엔진&모델 읽기 전용 OpenCode 카드 → 그 카드로 OpenCode 턴이 이어진다. 기본 배포는 선언이 비어 화면·동작이 같다. 기타 3건(Composer 에이전트 기본값 · `+` 메뉴 Orca 최상단 · 엔진 카드 순서)이 함께 바뀐다.
- **성공을 한 문장으로** — 폐쇄망 배포는 mainline 코드를 고치지 않고 선언만으로 OpenCode 연결 플러그인과 그 읽기 전용 모델 카드를 제공한다.

## 2. 사용자 의도 / 요구 출처

라이브 세션(2026-10-30) 사용자 문장을 원문으로 인용한다.

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "폐쇄망에서 Opencode 인증 플러그인 지원을 위해 다음 처럼 수행할 것이다. 다음에 대해 구현했을때 mainline 에서 모두 원할하게 지원이 되어야 함." | T1 |
| 명시 요구 | "app/deployment/ 경로에서 아래처럼 인증로직 추가할 거다. — host pc에 opencode 설치가 돼있는 지 확인 (이것은 opencode 서버를 시작하는 조건이기도 하다)" | T1 |
| 명시 요구 | "인증 성공 시 model list (--pure) 호출하고 엔진&모델 페이지에 카탈로그 생성 및 저장할 것이다." | T1 |
| 명시 요구 | "인증된 상태로 재시작 시 model list 호출 -> 카탈로그가 있으면 read 후 차이점 비교 -> 차이 발생 시 덮어쓰기." | T1 |
| 명시 요구 | "nav->플러그인->플러그인 탭에서 로그인 프리 인증에 대해 다음 상태를 추가한다. 옵션으로 인증 혹은 연결 버튼을 제공(이것은 호스트 pc에서 동작하는 것. Idp/sp 인증같은 것이 아님. 더 좋은 텍스트가 있으면 추천하라). 클릭 시 부여된 로직을 수행할 수 있도록." | T1 |
| 명시 요구 | "Opencode의 연결 설정을 그대로 갖고 오기 때문에 따로 인증이 필요하진 않다. 버튼 클릭시 opencode.exe models <provider> --verbose  --pure 로 값을 받고, 잘 받아지면 플러그인 상태는 초록공. 아니면 빨간공으로 전환될 것. 유효하면 엔진&모델 카탈로그를 추가할 것임. 이 동작을 수행할 수 있도록 코드 인프라가 갖춰져야 함. 이 동작들을 제공하라는 것이 아니고 플러그인의 로그인 프리 상태가 언급된 상태를 가질 수 있어야 함." | T1 |
| 명시 요구 | "opencode 읽기 전용 엔진&모델 값으로 harness-runtime이 만들어 질 수 있어야 함. 현재는 claude만 지원되고 있음." | T1 |
| 명시 요구 | "opencode composer의 기본 agent를 build, plan으로 기본값으로 채워둬라. 실제 플러그인 로딩이 진행중일텐데 스피너 표시는 그대로 유지하며 조회 완료 시 에이전트 목록을 오버라이딩 하라. Agent의 목록을 비워두지 않게 하는 것이다." | T1 기타 |
| 명시 요구 | "컴포저 + 버튼 -> 스킬/플러그인에서 orcinus orca의 그룹메뉴는 항상 최상위에 둘 것 (nav->플러그인 페이지의 규칙과 같음)." | T1 기타 |
| 명시 요구 | "엔진&모델 페이지에서 카탈로그 카드 항목은 언제나 클로드, opencode 순서로 정렬할 것." | T1 기타 |
| 명시 위임 | "Builder, plan을 조회없이 기본으로 채워넣는게 거슬리면 이것도 opencode agent list --pure로 조회해서 채워도 좋음. 플러그인 버전과 병렬로 조회를 해서 플러그인 조회값으로 오버라이딩하는 방향으로 해도 됨. 너의 판단에 더 적합한 것을 선택하도롣" | T2 |
| 명시 선택 | 버튼 "연결 / 다시 연결" · 재시작 표시 "확인 끝날 때까지 숨김" · 연결 해제 "이번엔 제공하지 않음" · 저장 위치 "인메모리" | T3 (질의 답) |
| 명시 선택 | 재시작 때 연결 판단 → "연결 로직을 다시 수행." | T4 (질의 답) |
| 명시 선택 | "인메모리+읽기전용으로" | T5 |
| 버그 리포트 | "문제: RUNTIME_MODEL_CONTRIBUTION 에 등록된 harness 카드가 연결 화면애서 auth 인증 직후 엔진&모델 화면에 노출되지 않고 앱 재시작 후에만 노출된다." | T6 |
| 버그 리포트 | "원인(의심): … pushConmectionState()는 정상 발화하나(runtime-catalog.ts:129 -> runtime-model-startup.ts:101), 그 provider push를 agent:list 재조회로 잇는 subscribeAgents()가 화면 마운트 전용(agentStore.ts:53, consumer는 useEngines.ts:31)이라 인증을 수행한 /plugins 라우트엔 수신자가 없고, 엔잔 화면 재입구는 ensureLoaded()의 loaded:true 조기반환(agentStore.ts:41)으로 인증 전 캐시를 그대로 반환한다." | T6 |
| 버그 리포트 | "시나리오: 앱 실행 -> 플러그인(카탈로그) 화면에서 폐쇄망 llm 카드의 [연결] 로 인증 성공(초록 표시 확인) -> 엔진&모델 화면으로 이동 -> claude-<myengine> 카드 없음 -> 앱 재시작 후 엔진&모델 화면에서 카드 노출. 다만 이것은 간헐적 발생임." | T6 |
| 추론 의도 | mainline은 인프라·계약·문서·가상 배포 검증을 제공하고, 실제 OpenCode 플러그인 선언은 폐쇄망 배포가 채운다 | T1 "app/deployment/ … 추가할 거다" + "이 동작들을 제공하라는 것이 아니고" — 추론 |
| 추론 의도 | 설치 확인은 OpenCode 서버 시작·웜업이 이미 쓰는 판정을 배포에 그대로 노출한다(두 벌 판정 금지) | T1 "opencode 서버를 시작하는 조건이기도 하다" — 추론 |
| 추론 의도 | 연결 성공 = 배포 로직이 모델 목록을 받아 돌려준 것. 모델 조회 CLI는 연결 1회당 1회다 | T1 "버튼 클릭시 … 로 값을 받고, 잘 받아지면 … 초록공" — 추론 |
| 추론 의도 | 디스크 기억이 없으므로 재시작 때 connect를 선언한 대상 **전부**를 다시 확인한다 | T4·T5 귀결 — 추론 |
| 추론 의도 | "차이점 비교 → 덮어쓰기"는 같은 프로세스 안의 재연결 결과 비교다. 재시작 직후에는 비교할 메모리 결과가 없다 | T1 + T5 — 추론 |
| 추론 의도 | 버그는 OpenCode 연결에 한정되지 않고 runtime 카드 일반(게이트 기반 Claude 포함)의 renderer 목록 갱신 결함이다 | T6 "claude-<myengine>" — 추론 |

## 3. Decision Ledger

> 여러 턴의 합의를 누적한다. 최신 턴에 다시 언급되지 않았다는 이유로 ACTIVE 결정을 지우지 않는다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | mainline은 인프라만 제공한다 — 기본 배포의 `LOGIN_FREE_DEFINITIONS`·`RUNTIME_MODEL_CONTRIBUTIONS`·augmenter·연결 행은 빈 상태를 유지하고 가상 배포 테스트로 검증한다 | "이 동작들을 제공하라는 것이 아니고 … 상태를 가질 수 있어야 함" · 0248 D-011 | T1 | ACTIVE | — |
| D-002 | `LoginFreeDefinition.connect?`(선택)을 둔다 — 선언하면 플러그인 탭에 연결 버튼과 상태 4종이 생기고, 생략하면 지금처럼 항상 연결된 행이다 | "옵션으로 인증 혹은 연결 버튼을 제공", "로그인 프리 인증에 대해 다음 상태를 추가" | T1 | ACTIVE | — |
| D-003 | 연결은 호스트 PC 확인이다 — 자격증명 입력·저장·vault·게이트·부팅 `resume`에 들어가지 않는다 | "Idp/sp 인증같은 것이 아님", "따로 인증이 필요하진 않다" · 0248 D-003·D-016 | T1 | ACTIVE | — |
| D-004 | 버튼 문구는 미연결 `연결`, 연결됨·실패 `다시 연결`이며 확인 중에는 busy(비활성)다 | 질의 답 | T3 | ACTIVE | — |
| D-005 | 상태 문구·색: `연결 안 됨` slate · `확인 중…` amber · `연결됨` green · `연결 실패` red. 실패는 상세에 사유를 보인다 | "잘 받아지면 … 초록공. 아니면 빨간공" | T1·T3 | ACTIVE | — |
| D-006 | 연결 로직 = 배포의 `connect.run({ signal, host })` 1회 실행. 반환하면 성공이고 반환값이 연결 결과, throw면 실패다 | "클릭 시 부여된 로직을 수행", "값을 받고" | T1 | ACTIVE | — |
| D-007 | `host.installed`는 OpenCode 서버 시작·웜업과 같은 판정이고, `host.listModels`는 같은 실행 파일 해석·1.x 판정을 거친 `models <provider> --verbose --pure`다 | "이것은 opencode 서버를 시작하는 조건이기도 하다" | T1 | ACTIVE | — |
| D-008 | 인메모리 + 읽기 전용 — 연결 상태·결과·카탈로그를 디스크에 쓰지 않고, 엔진&모델 카드는 runtime read-only 행이다 | 질의 답 "인메모리" · "인메모리+읽기전용으로" · 0198 D-006 유지 | T3·T5 | ACTIVE | — |
| D-009 | 재시작 = 연결 로직 재수행. 부팅마다 connect 선언 대상 전부를 자동 확인한다 | 질의 답 "연결 로직을 다시 수행." + D-008(기억 없음) | T4 | ACTIVE | — |
| D-010 | 확인이 끝날 때까지 그 대상의 카드를 숨기고 실패면 계속 숨긴다(fail-closed) | 질의 답 · 0198 D-005 | T3 | ACTIVE | — |
| D-011 | 같은 프로세스의 재연결은 결과를 이전 결과와 비교한다 — 같으면 교체·무효화가 없고 다르면 덮어쓴다 | "차이점 비교 -> 차이 발생 시 덮어쓰기" + D-008 | T1·T5 | ACTIVE | — |
| D-012 | 연결 해제는 이번에 제공하지 않는다 | 질의 답 | T3 | ACTIVE | — |
| D-013 | runtime model contribution은 로그인 프리 id에도 묶인다 — valid·verified일 때만 행이 생기고, 결과는 augmenter가 `connectionValue`로 읽어 CLI를 다시 돌리지 않는다. 연결 버튼은 Harness resolve를 직접 부르지 않는다 | D-006·D-010 귀결 · 0188 "연결 버튼은 인증 행위만"(`handlers/providers.ts:52-54`) 유지 | 설계자 | ACTIVE | — |
| D-014 | OpenCode runtime 행 = `availableModels`(`provider/model`) + 선택 `modelDetails`(이름·variant). Claude·미등록 하네스 파서는 바뀌지 않는다 | "opencode 읽기 전용 엔진&모델 값으로 harness-runtime" · 0198 D-001 이름 유지 | T1 | ACTIVE | — |
| D-015 | OpenCode runtime 카드의 턴은 Orca settings 없이 호스트 OpenCode 설정을 그대로 쓴다(서버 config `{}`). settings 파일 부재는 오류가 아니다 | "Opencode의 연결 설정을 그대로 갖고 오기" | T1 | ACTIVE | — |
| D-016 | Composer 에이전트: authoritative 목록이 없는 동안(loading·error) 선택 provider 행의 정적 `agents`, 없으면 공유 기본 `build`·`plan`으로 메뉴와 버튼을 채운다. 스피너는 유지하고 조회 완료 시 교체한다. placeholder는 저장·전송 선택이 아니다(0287 D-002 유지). `opencode agent list --pure` 병렬 조회는 기각한다(§4) | "Agent의 목록을 비워두지 않게" + "너의 판단에 더 적합한 것을 선택" | T1·T2 | ACTIVE | — |
| D-017 | Composer `+` 메뉴의 스킬·플러그인 패널에서 `Orcinus orca` 그룹을 항상 맨 위에 둔다. 나머지 그룹의 상대 순서는 유지한다 | "orcinus orca의 그룹메뉴는 항상 최상위 (nav->플러그인 페이지의 규칙과 같음)" | T1 | ACTIVE | — |
| D-018 | 엔진&모델 카드는 Claude → OpenCode → 그 밖 순서이며 같은 하네스 안에서는 기존 순서를 유지한다 | "언제나 클로드, opencode 순서로 정렬" | T1 | ACTIVE | — |
| D-019 | 연결 실행은 새 채널 `orca:provider:connect`다. `login`·`reauth`·`revoke`는 로그인 프리에 계속 쓰지 않는다 | 전역 step 단일 슬롯(`ProviderStepInfo`)은 행별 진행을 표현하지 못하고 0248이 login 계열의 로그인 프리 거부를 잠갔다 | 설계자 | ACTIVE | — |
| D-020 | 이름(배포 소스·wire one-way door): `LoginFreeDefinition.connect` · `LoginFreeConnect.run` · `LoginFreeConnectContext{signal,host}` · `HostHarnessPort{installed,listModels}` · `HarnessListedModel{id,name?,variants?}` · `HarnessRuntimeConfig.modelDetails` · `AuthRuntime.{snapshot,connect,connectAll,connectionValue}` · cause `connection-started`·`connection-succeeded`·`connection-failed` · wire `ProviderInfo.connection{state,message}` · `ProviderConnectionState` `'idle'\|'checking'\|'connected'\|'failed'` · 채널 `orca:provider:connect` | 배포 소스·wire에 노출된다. 사용자 질의에서 이름 변경 요청 없음 | 설계자 | ACTIVE | — |
| D-021 | agent 목록 신선도: store가 앱 수명의 provider push 구독을 소유한다(첫 사용 시 1회 설치, 해제 없음). 화면별 구독을 없애고 재조회는 최신 요청만 반영한다 | 버그 리포트 원인 실측(§8) | T6 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-021 (신규 handoff).
- 다른 handoff 결정 변경(사용자 요구): 0248 D-008("로그인 프리는 상태 전이가 없다") → connect 선언 대상에 한해 D-002·D-005·D-011이 대체 · 0286 D-012("Composer 그룹 순서는 바꾸지 않는다") → D-017이 대체 · 0287 §5 상태표 "loading/error에서 이름이 없으면 '불러오는 중…'/'불러오기 실패'" 행 → D-016이 대체(첫 항목 저장 D-002는 유지).
- 유지: 0198 D-005·D-006, 0248 D-003·D-006·D-007·D-016·D-017, 0262 AC31(자동 카탈로그 갱신 유지 — D-021이 강화), 0188 "연결 버튼은 인증 행위만".
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001↔AC16 · D-002↔AC1·AC17 · D-003↔AC7·AC17 · D-004↔AC3 · D-005↔AC2 · D-006↔AC4·AC15 · D-007↔AC9·AC10 · D-008↔AC7·AC8 · D-009↔AC7 · D-010↔AC8 · D-011↔AC5·AC8 · D-012↔§6 비범위(연결 해제 액션을 요구하는 AC 0) · D-013↔AC8·AC14 · D-014↔AC12 · D-015↔AC13 · D-016↔AC19 · D-017↔AC20 · D-018↔AC21 · D-019↔AC3·AC17 · D-020↔AC14·AC15·AC23 · D-021↔AC22. 반대를 요구하는 AC 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | **타당** — 상태 상수·실행 경계·OpenCode runtime 3결함·renderer 갱신 결함이 모두 실재한다 | §1 문제 1~4의 `파일:줄` |
| 이미 기존 코드가 충족하는가 | 아니오 — 로그인 프리 id는 runtime reader에서 `none`이다 | `runtime-model-startup.ts:65` `auth.bind(authId).snapshot()` → store에 grant 없음 → `none` |
| 이미 충족하는가 (2) | 아니오 — runtime 카탈로그 reconcile은 `verified && valid`만 연다 | `runtime-catalog.ts:95` |
| 더 작은 해법 ① | 기각 — 배포가 `sources/settings/opencode/<p>/settings.json`을 써서 일반 카드로 만든다 | 편집 가능 카드가 되고 provider 정의를 서버 config로 주입해 호스트 설정을 덮는다. D-008(인메모리·읽기 전용) 위반 |
| 더 작은 해법 ② | 기각 — connect는 설치 확인만, 모델 조회는 augmenter가 한다 | 모델 조회가 실패해도 초록으로 남는다("잘 받아지면 초록공" 위반) |
| 더 작은 해법 ③ | 기각 — connect와 augmenter가 각각 CLI를 돈다 | 클릭 1회에 `opencode models` 2회. 폐쇄망 models.dev 대기가 두 배가 된다 |
| T2 대안(`opencode agent list --pure`) | **기각** — CLI 출력이 `name (mode)` + 권한 JSON이고 `hidden`을 싣지 않아 내장 hidden primary(`compaction`·`title`·`summary`)가 섞인다. subagent도 포함하고 JSON 출력 옵션이 없다 | OpenCode v1.18.27 `packages/opencode/src/cli/cmd/agent.ts` `list` · `src/agent/agent.ts` 내장 7종 |
| T2 대안 대신 쓰는 근거 | main 정적 카탈로그가 이미 `build`·`plan`을 기본 primary로 만든다 | `opencode/v1/catalog.ts:10-11` → `agent:list`의 `AgentEnvironment.agents` |
| 선행 자료 대조 | 일치 — "로그인 프리 포트는 항상 valid" | `docs/arch/backend/auth.md` §4.1 ↔ `login-free.ts:22-27`. 이번 변경으로 connect 선언 대상만 바뀐다 |
| 선행 자료 대조 (2) | 일치 — runtime 카탈로그는 프로세스 메모리 read-only | `auth.md` §6.1 ↔ `runtime-catalog.ts:63-64` |
| 버그 원인 대조 | **사용자 의심 일치 + 원인 1개 추가** | push 구독자 2곳만(`useEngines.ts:31`·`useAgents.ts:12`), 조기 반환 `agentStore.ts:43`. 추가: `refresh`에 순서 보장 없음(`:22-27`) — 동시 push의 이전 응답이 최신 목록을 덮을 수 있다 |
| ACTIVE 결정·기존 채택 결정과 충돌 | 3건 변경(사용자 요구) · 나머지 유지 | §3 갱신 메모 · §16 |

- 사용자에게 올린 결정: 버튼 문구·재시작 표시·연결 해제·저장 위치(T3), 재시작 판단(T4), 저장 방식(T5) — 모두 닫힘.
- 코드 조사로 닫은 사실: OpenCode `models [provider]`는 `providerID/modelID` 줄을 쓰고 `--verbose`는 그 뒤에 모델 객체를 `JSON.stringify(model, null, 2)`로 쓴다. 미등록 provider는 `Provider not found`로 실패한다. `--pure`는 "Run without external plugins" 전역 플래그다(v1.18.27 `cli.mdx`·`cli/cmd/models.ts`).
- 코드 조사로 닫은 사실 (2): 게이트(`features/gate/index.ts:138-140`)·부팅 복원(`app/auth-resume.ts:243-245`)·일일 게이트는 비-게이트 id 변화를 무시한다. `AuthChange` 구독은 production에서 `runtime-model-startup.ts:120-121` 한 파일뿐이다(`no-stray-auth-subscribe.test.ts`).

## 5. 동작 / 사용자 흐름

```text
[부팅] createAuthRuntime(…, loginFreeHost) — connect 선언 대상은 idle(연결 안 됨)
  → deploy 무효화 · Auth 리스너 설치 → run 콜백: authResume.run() + auth.connectAll()
  → 대상마다 checking(확인 중…) → 배포 run({signal, host})
       host.installed('opencode')  · host.listModels('opencode', provider)  → 결과 반환
  → 성공: connected(연결됨) · 결과는 메모리 · AuthChange → 카탈로그 reconcile
       → augmenter가 connectionValue로 availableModels·modelDetails → 읽기 전용 OpenCode 카드
  ↘ 실패: failed(연결 실패 + 사유) · 카드 없음
[플러그인 탭 '연결'/'다시 연결'] → orca:provider:connect → 같은 run
  → 결과가 같으면 교체 없음 · 다르면 덮어쓰기 · 실패면 카드 제거
[엔진&모델] → 최신 agent:list → Claude → OpenCode 순서 카드
[OpenCode 턴] → 그 카드 선택 → 캐시된 runtime config · 호스트 OpenCode 설정 + 선택 모델
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 부팅 직후(선언 있음) | 대상 idle → `connectAll` | `연결 안 됨` → `확인 중…`(amber, 버튼 busy) · 카드 없음 |
| run 성공(첫 성공·결과 변경) | connected · revision+1 · `connection-succeeded`(credentialChanged) | `연결됨`(green) · 카드 생김(읽기 전용) · 같은 id 도구 Plugin이면 등록 |
| `다시 연결` 확인 중 | checking · 이전 valid·verified 유지 | `확인 중…` · 버튼 busy · 카드 유지 |
| 재연결 결과 같음 | connected · revision 불변 · cause `verified` | `연결됨` · 카드·실행 cache 그대로 |
| 재연결 결과 다름 | revision+1 · 결과 교체 | 카드 모델 교체 |
| run throw · timeout · 직렬화 불가 결과 | failed · 사유 · 연결됐었으면 revision+1 | `연결 실패`(red) + 사유 · 카드 사라짐 · `다시 연결` |
| OpenCode 미설치·1.x 아님·provider 없음 | 배포 run 또는 `listModels`가 throw | `연결 실패` + 그 메시지 |
| 앱 재시작 | 메모리 소멸 → 부팅 행으로 | 다시 `확인 중…` → 결과 |
| connect 무선언 로그인 프리 | 기존 그대로 | `연결됨`(항상) · 버튼 없음 |
| 동시 클릭 · 부팅 확인 중 클릭 | 같은 실행 공유(single-flight) | 실행 1회 |
| 앱 종료 | OpenCode server pool `close()`가 CLI를 abort | 상태 무관 |
| 다른 화면에서 인증·연결 성공 후 엔진&모델 진입 | store 앱 수명 구독이 push마다 agent:list 재조회 | 카드가 바로 보인다(재시작 불필요) |

### 파생 UX / 엣지케이스

- loading / empty / error: 플러그인 탭 로딩·빈 목록 문구 불변. 실패 사유는 상세 머리 아래 `text-bad` 한 줄(입력 폼 실패 문구와 같은 자리 규칙, `ProviderDetail.tsx:237`).
- cancel / retry / close / restart: 취소 버튼 없음. 재시도 = `다시 연결`. 재시작은 D-009.
- concurrency / multi-session: 대상별 single-flight. 대상끼리는 병렬. 진행 중 결과는 다음 결과가 덮는다(뒤 응답 무시 없음 — 같은 실행만 존재).
- keyboard / a11y / theme: 기존 `Button`(`busy`→`aria-busy`·disabled)과 `Dot` tone(`red` 포함, `shared/ui/Status.tsx:1-13`)을 쓴다. white/dark는 사람 실기(AC24).
- 외부환경/폐쇄망: models.dev 대기·프록시는 배포가 `listModels`의 `env`로 넘긴다(§15). CLI는 60초, 연결 전체는 120초에서 끊는다.
- Composer: placeholder `build`·`plan`은 버튼·메뉴에만 보이고 전송 선택이 아니다 — 사용자 config가 `default_agent`를 바꿨다면 로딩 중 전송은 OpenCode 기본 에이전트로 돈다(§17).

## 6. 범위 / 비범위

- **범위**: 로그인 프리 연결 계약·상태기계·`AuthRuntime` 확장 · 호스트 하네스 능력(OpenCode 설치 확인·모델 목록 CLI·파서) · runtime 카탈로그의 로그인 프리 연결 결합 · OpenCode runtime 행(파서·provenance·settings 부재) · augmenter `modelDetails`·helper · wire `connection`·채널 `orca:provider:connect`·preload·renderer 상태·버튼 · Composer 에이전트 placeholder · `+` 메뉴 Orca 최상단 · 엔진 카드 순서 · agent store 신선도(버그) · 문서·ADR·가이드 레시피 · 가상 배포 테스트.
- **비범위**: 실제 폐쇄망 OpenCode 선언(D-001) · 연결 해제(D-012) · 디스크 영속(D-008) · `/` 자동완성 그룹 순서(T1은 `+` 메뉴만) · `--pure`가 빼는 외부 플러그인 제공 모델 · Claude 하네스 모델 목록 CLI · 기존 canonical JSON 사본 3곳 통합(0290 영역).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 연결 해제 | 아니오 — `AuthRuntime`에 메서드·채널 하나 추가 | 후속 handoff 후보 |
| `/` 자동완성 Orca 최상단 | 아니오 — 순수 함수 하나 | 사용자 요청 시 |
| 기존 canonical JSON 3사본 통합 | 아니오 | 0290 또는 후속 |
| 이름·wire 필드·채널(D-020) | **예** — 배포 소스·wire | 지금 확정 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | connect 선언 로그인 프리 행만 wire `connection:{state,message}`를 싣는다. `status`는 idle·failed·첫 checking에서 `none`, connected·재연결 checking에서 `valid`다. connect 무선언 로그인 프리·자격증명 행에는 `connection` 키가 없다 | `connection-views.test.ts` 신규 — 4상태 + 무선언 + 자격증명 행 exact | `auth.snapshot`/포트 snapshot → `connectionInfo` → `orca:provider:list`·`state` |
| R-01 | AT-01 / AC2 | 목록 trailing·상세 머리: idle `연결 안 됨`(slate) · checking `확인 중…`(amber) · connected `연결됨`(green) · failed `연결 실패`(red) + 상세 사유. 종류는 `기본 제공`. 무선언 로그인 프리 표시는 불변 | `providerRows.test.ts` 4상태 statusKey·tone · `ProviderDetail.render.test.ts` Dot class·사유 · `CustomizeList.render.test.ts` trailing | provider state → `CustomizeList`·`ProviderDetail` |
| R-01 | AT-01 / AC3 | 버튼: idle `연결`, connected·failed `다시 연결`, checking 같은 라벨 + busy. 클릭 → `providerApi.connect({providerId})` → `orca:provider:connect` → `auth.connect(id)` → 최종 `{state,message}`. 채널 등록 = provider 도메인 전수 | `ProviderAuthActions.test.ts`·`.render.test.ts` · `ExtensionsCatalogView.interaction.test.ts` 클릭 → hook · 신규 `useProviders.test.ts` hook → api · `providers.test.ts` EXPECTED·반환 · `preload/index.test.ts` 브리지 | 버튼 → hook → preload → handler → `AuthRuntime.connect` |
| SD-01 | ST-01 / AC4 | idle에서 `connect()` → `connection-started`(credentialChanged false) → `run({signal, host})` → 결과 저장 → `connection-succeeded`(credentialChanged true). snapshot `{status:'valid', verified:true, credentialRevision:1, connection:{state:'connected'}}`, `connectionValue()` = 반환값(undefined는 null). run context 키는 정확히 `signal`·`host` | 신규 `login-free-connection.test.ts` 성공 케이스 · `runtime.test.ts` context 케이스 | `AuthRuntime.connect` → `createLoginFreeConnections` → publish |
| SD-01 | ST-01 / AC5 | connected에서 재연결: 확인 중에도 `valid·verified` 유지. 결과의 canonical JSON이 같으면 revision 불변·cause `verified`·credentialChanged false, 다르면 revision+1·`connection-succeeded`·credentialChanged true·결과 교체 | 신규 `login-free-connection.test.ts` 재연결 3케이스 | 같음 |
| SD-01 | ST-01 / AC6 | run throw → failed + 메시지(빈 메시지는 기본 문구, 500자 상한). 이전 connected면 revision+1·credentialChanged true·`connectionValue` undefined, idle이면 credentialChanged false. 직렬화 불가 결과(cycle·BigInt)는 실패. 동시 2회 호출 = run 1회. signal을 무시한 run도 120초 뒤 failed(시간 초과 문구)이고 그 signal은 abort된다. connect 무선언·자격증명·미등록 id의 `connect` → throw | 신규 `login-free-connection.test.ts` 실패·동시·timeout(fake timer)·직렬화 · `runtime.test.ts` throw 3종 | 같음 |
| R-04 | AT-04 / AC7 | 새 runtime의 connect 대상은 전부 idle이고 연결 경로가 디스크를 쓰지 않는다(grant persistence `save`·vault 쓰기 0, 로그인 프리 저장 포트 없음). Bootstrap은 리스너 설치 뒤 `run` 콜백에서 `authResume.run()`과 `auth.connectAll()`을 부른다. `connectAll` = 선언 대상 전부 병렬, 실패 흡수 | `login-free-connection.test.ts` connectAll · `runtime.test.ts` 디스크 0 · 신규 bootstrap 소스 가드(양성 + 감도) | `Bootstrap.start` → `startRuntimeModelCatalogAfterDeploy` → `run` |
| SD-02 | ST-02 / AC8 | 로그인 프리 연결 id에 묶인 contribution 행은 idle·첫 checking·failed에 없고 connected에서 생긴다(`source:'runtime'`·`readOnly:true`). 재연결 checking 동안 유지, 같은 결과면 augmenter 재호출 0, 다른 결과면 runtime cache 무효화 뒤 새 모델, 실패면 사라진다. reader는 `auth.snapshot(authId)`로 두 체계를 읽는다 | 신규 `opencode-connection-deployment.test.ts` 생명주기 · `runtime-model-startup.test.ts` reader 케이스 갱신 · `runtime-catalog.test.ts` 신규 | `AuthChange` → handler → invalidate·reconcile → `RuntimeModelCatalog` → `agent:list` |
| R-05 | AT-05 / AC9 | `host.installed('opencode')`는 `registry.get('opencode').isInstalled()`(웜업·서버 시작과 같은 판정) 결과를 돌려주고, 미등록 하네스는 `{installed:false}`다. `host.listModels('opencode', p, {signal, env?})`는 adapter `listProviderModels`로 위임하고 구현 없는 하네스는 "지원하지 않는다"로 reject한다 | 신규 `harness-host.test.ts` · `adapter.test.ts` 위임 케이스 | `createHostHarnessPort` → `AdapterRegistry.get` → `OpenCodeAdapter` |
| R-05 | AT-05 / AC10 | `OpenCodeServerPool.listModels(provider)`는 서버와 같은 `executable()`과 같은 1.x 판정 함수를 쓰고 `execFile(exe, ['models', provider, '--verbose', '--pure'], {cwd: 홈, env: process.env + 호출자 env + OPENCODE_DISABLE_PROJECT_CONFIG='true', windowsHide:true, timeout:60s, maxBuffer:16MiB, signal: 호출자 ∪ pool close})`다. provider id는 `^[A-Za-z0-9][A-Za-z0-9._-]*$`만 허용(실행 0회로 거부). 1.x 아님·실행 파일 없음은 서버 start와 같은 문구 | `server.test.ts` 신규 4케이스(`runCli` seam) | `OpenCodeAdapter.listProviderModels` → pool |
| MD-02 | UT-02 / AC11 | 파서: `provider/model` 줄 + 0열 `{`…`}` JSON 블록 → `{id, name?, variants?}`(variants는 `disabled:true` 제외). 요청 provider와 다른 접두 행 제외, JSON 없는 줄은 id만, 깨진 블록은 throw, 빈 출력은 `[]` | 신규 `model-listing.test.ts` — v1.18.27 출력 형상 fixture | `listModels` 내부 |
| MD-03 | UT-03 / AC12 | OpenCode runtime 파서: `availableModels` 순서 보존, `provider/model` 아닌 항목 제외, alias = `modelDetails[id].name ?? modelId`, `providerId`, `variants`, `isCustom:true`, `oneMillionContext:false`, 첫 항목 default. `parseHarnessRuntimeModels`는 opencode에 이 파서, claude·미등록은 기존 Claude 파서 | `opencode/v1/settings.test.ts` 신규 · `app/harnesses/registry.test.ts` 신규 + 기존 legacy 케이스 | `RuntimeModelCatalog.reconcile` → `parseHarnessRuntimeModels` |
| R-03 | AT-03 / AC13 | OpenCode runtime 키의 `agent:list` 행은 runtime 모델과 `agents`(build·plan)를 유지한다. resolve-turn은 merged 행의 실제 provenance를 `adapter.catalog`에 넘겨 선택 모델 `provider/model`로 실행하고 `providerSettings.settings`는 `{}`다. settings.json 없는 OpenCode 키 resolve의 `providers.settings.resolve-failed` 보고는 0 | `misc.runtime-catalog.test.ts`·`resolve-turn.runtime-catalog.test.ts`·`opencode/v1/catalog.test.ts`·`opencode/v1/settings.test.ts` 신규 | `agent:list` · `resolveTurnProvider` → `OpenCodeAdapter.catalog` → turn |
| MD-08 | UT-08 / AC14 | augmenter 결과 `modelDetails`가 `HarnessRuntimeConfig`에 실린다. `HarnessConfigApiDeps.auth`는 `bind`·`connectionValue`만 노출한다(login·revoke·resume·subscribe 불가). `listedModelsOf(unknown)`는 형상이 틀리면 undefined, `runtimeModelsFromListing(listing)` → `{availableModels, modelDetails}` | `runtime-config.test.ts` 신규 · 신규 `runtime-listing.test.ts` · `deployment-wiring.test.ts` 능력 케이스 갱신 | augmenter → `HarnessRuntimeConfigService.compute` |
| R-02 | AT-02 / AC15 | 가이드 §4 레시피를 그대로 컴파일한 가상 배포에서 connect 성공 → 연결 행 `connection.state:'connected'`·`status:'valid'`, `agent:list`에 read-only OpenCode 카드(이름·variants), resolve-turn 모델 = 선택 id. 미설치 host → `failed`·사유·카드 없음 | 신규 `opencode-connection-deployment.test.ts` | 선언 → `createAuthRuntime` → 연결 행 → 카탈로그 → `agent:list`·턴 |
| R-10 | AT-10 / AC16 | 기본 배포 불변: production `LOGIN_FREE_DEFINITIONS`·`RUNTIME_MODEL_CONTRIBUTIONS` 빈 배열, augmenter `{}`, 연결 행 gate·plugin만. Bootstrap 소스 가드: `createAuthRuntime(…)`에 `loginFreeHost: createHostHarnessPort(this.registry)`, `run` 콜백에 `auth.connectAll()` — 누락·빈 함수·주석·문자열은 배선으로 세지 않는다 | `deployment-wiring.test.ts`·`login-free-deployment.test.ts` 기존 · `opencode-connection-deployment.test.ts` 신규 가드 | `app/deployment/*` · `bootstrap.ts` |
| R-06 | AT-06 / AC17 | 0248 회귀: connect 무선언 로그인 프리 snapshot은 항상 `{valid, verified:true, credentialRevision:0}`·`connection` 없음·AuthChange 0·첫 sync 도구 등록·request 정책 불변. 자격증명 binder·secret reader·게이트 선택은 로그인 프리 id를 해석하지 않고 login·reauth는 `unknown_provider`, revoke는 change 0 | 기존 케이스 무수정 green(§7 주의) | 기존 경로 |
| R-06 | AT-06 / AC18 | runtime 카탈로그 회귀: 게이트 기반 Claude contribution(availableModels·`ANTHROPIC_MODEL`)·settings 병합·충돌 키 fail-closed·턴 cache-only·OpenCode settings 행 모델·agents 파싱 불변 | 기존 케이스 무수정 green(§7 주의) | 기존 경로 |
| R-07 | AT-07 / AC19 | authoritative 목록이 없을 때(loading·error) 메뉴 = 선택 provider 행 `agents`(행 없으면 `OPENCODE_DEFAULT_AGENTS` = build·plan), 버튼 = 기존 선택 또는 placeholder 첫 항목, loading 스피너 유지. placeholder는 `harnessAgent`에 저장되지 않는다. 목록이 오면 교체·첫 항목 저장(0287 D-002)·유효한 수동 선택 보존. authoritative 빈 목록은 `에이전트 없음` | `Controls.interaction.test.ts` 기존 케이스 대체 · `Module.integration.test.ts` 신규(`OpenCodeModeControl` 경유) · `agentSelection.test.ts` 신규 | Composer → `OpenCodeModeControl` → `OpenCodeAgentControl` |
| R-08 | AT-08 / AC20 | `+` 메뉴 스킬·플러그인 패널 모두 `Orcinus orca` 그룹이 첫 그룹이다. 나머지 그룹 상대 순서·항목 id 불변, Orca 그룹이 없으면 기존 순서 | `attachMenuModel.test.ts` 기존 2케이스 대체 + 신규 · `Composer.native-menu.test.ts` 렌더 순서 | `AttachMenu` → `buildAttachMenu` → `CascadeMenu` |
| R-09 | AT-09 / AC21 | 엔진&모델 카드: Claude → OpenCode → 그 밖 adapter, 같은 하네스 안 입력 순서 유지, 개수 불변 | 신규 `agentOrder.test.ts` · `AgentEnvironmentView.render.test.ts` 신규 | `useEngines` → `AgentEnvironmentView` |
| R-12 | AT-12 / AC22 | 목록을 한 번 읽은 뒤에는 화면 마운트와 무관하게 provider push마다 `agent:list`를 다시 읽는다. 늦게 도착한 이전 응답은 최신 목록을 덮지 않는다. 플러그인 탭에서 인증·연결 후 엔진&모델 진입 시 runtime 카드가 보인다 | 신규 `agentStore.test.ts` · `useEngines.test.ts` 기존 구독 해제 단언 대체 + 신규 시나리오 | `providerApi.onState` → `agentStore.refresh` → 소비 화면 |
| R-10 | AT-10 / AC23 | 문서가 D-002~D-021을 서술한다 — §18 목록 전부, `check-doc-inventory --check` green | 문서 diff 대조 + `node scripts/check-doc-inventory.mjs --check` | 문서 |
| R-11 | AT-11 / AC24 | **사람 실기**(Windows 실제 OpenCode, 로컬 임시 배포·커밋 금지): 연결 → 초록·카드·턴 / 미설치·잘못된 provider → 빨강·사유 / 재시작 → 확인 중 → 결과 / white·dark 상태 점·버튼 / Composer placeholder·`+` 메뉴·엔진 카드 순서 | 사람 실기 — `npm run dev` | 실제 앱 |

### AC 검증 주의사항

- **기존 테스트 재사용(케이스 존재 확인)**: `login-free.test.ts:59`·`:162`·`:181`·`:243`·`:297`(0248 AC4·AC5·AC6·AC9) · `login-free-deployment.test.ts:229`·`:246`·`:270`·`:339`·`:386` · `providers.test.ts:33`·`:39` · `runtime-catalog.test.ts`·`misc.runtime-catalog.test.ts`·`resolve-turn.runtime-catalog.test.ts:28`·`:66`·`:135`·`:195` · `app/harnesses/registry.test.ts:122`(legacy → Claude 파서) · `opencode/v1/catalog.test.ts:6` · `useEngines.test.ts:73` · `Controls.interaction.test.ts:55`·`:198` · `attachMenuModel.test.ts:34`·`:282` — 이번 세션에 실재를 확인했다.
- **대체되는 기존 단언 4건**: `Controls.interaction.test.ts:198`('…without a synthetic default…' — D-016) · `attachMenuModel.test.ts:34`·`:282`(Claude/native가 Orca보다 앞 — D-017) · `useEngines.test.ts:83`(`api.unsubscribe` 1회 — D-021) · `providers.test.ts:33`(6종 — D-019). 대체 케이스는 같은 파일에서 새 계약을 양성으로 단언한다.
- **사람 실기**: AC24만이다 — 실제 OpenCode CLI·Windows 프로세스·테마 시각. 상태 파생·라벨·순서·파서는 전부 순수/통합 테스트로 내렸다.
- **N회 기준(AC5·AC8 "augmenter 재호출 0")**: sink는 `RuntimeConfigAugmenter.resolve`다. production 호출부는 `HarnessRuntimeConfigService.compute`(`runtime-config.ts:148`) 1곳이고, 그 호출은 `resolve()` cache miss일 때만 일어난다. 같은 결과 재연결은 revision이 같아 `RuntimeModelCatalog.reconcile`이 `resolvedRevision` 비교(`runtime-catalog.ts:103`)로 resolve를 부르지 않는다. 관측은 augmenter fake의 호출 수다.
- **N회 기준(AC4·AC6 "run 1회")**: sink는 `LoginFreeConnect.run`이고 production 호출부는 `createLoginFreeConnections`의 실행 1곳이다. 진입은 `connect`(IPC·`connectAll`) 하나라 single-flight 관측은 run fake 호출 수다.
- **0건 기준(AC7 디스크 0)**: 허용 대상은 기존 grant·OAuth 저장(`store-file.ts`)이고 제거 대상은 로그인 프리 연결의 쓰기다. 음성(`login-free-connection.ts`에 저장 포트·`electron-store` import 0)과 양성(새 runtime이 idle에서 시작) 둘로 잠근다.
- **순서 기준(AC7)**: 리스너 설치 → `connectAll` 순서는 기존 `runtime-model-startup.test.ts:220`('installs both Auth listeners before running the real resume callback') 형식으로 `run` 콜백 안에서 관측한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — 신규 handoff이고 상속할 명시 V가 없다. 다른 handoff가 잠근 동작은 R-06·R-12의 회귀 노드(NEW)로 다시 닫는다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01 | R/AT | §7 AC1~AC3 — 플러그인 탭 연결 상태·버튼 | NEW | — |
| R-02 / AT-02 | R/AT | §7 AC15 — 연결 → 읽기 전용 OpenCode 카드(가상 배포) | NEW | — |
| R-03 / AT-03 | R/AT | §7 AC13 — OpenCode runtime 카드의 턴 | NEW | — |
| R-04 / AT-04 | R/AT | §7 AC7 — 부팅 재확인 | NEW | — |
| R-05 / AT-05 | R/AT | §7 AC9·AC10 — 호스트 설치 확인·모델 조회 | NEW | — |
| R-06 / AT-06 | R/AT | §7 AC17·AC18 — 0248·runtime 카탈로그 회귀 | NEW | — |
| R-07 / AT-07 | R/AT | §7 AC19 — Composer 에이전트 placeholder | NEW | — |
| R-08 / AT-08 | R/AT | §7 AC20 — `+` 메뉴 Orca 최상단 | NEW | — |
| R-09 / AT-09 | R/AT | §7 AC21 — 엔진 카드 순서 | NEW | — |
| R-10 / AT-10 | R/AT | §7 AC16·AC23 — 기본 배포·문서 | NEW | — |
| R-11 / AT-11 | R/AT | §7 AC24 — 사람 실기 | NEW | — |
| R-12 / AT-12 | R/AT | §7 AC22 — agent 목록 신선도(버그) | NEW | — |
| SD-01 / ST-01 | SD/ST | §5 상태표 · §13 — 연결 수명주기(idle→checking→connected/failed, 재연결 diff, connectAll, single-flight, timeout) | NEW | — |
| SD-02 / ST-02 | SD/ST | §9 · §13 — 연결에 묶인 runtime 카탈로그 수명주기 | NEW | — |
| SD-03 / ST-03 | SD/ST | §9 · §13 — agent store 앱 수명 구독·최신 응답 | NEW | — |
| AR-01 / IT-01 | AR/IT | §9·§10 — Auth 연결 상태 → `AuthChange` 소비자·snapshot reader | NEW | — |
| AR-02 / IT-02 | AR/IT | §9·§10 — 호스트 능력 경로(Bootstrap → registry → adapter → pool → CLI) | NEW | — |
| AR-03 / IT-03 | AR/IT | §9·§10 — wire `connection`·채널 `orca:provider:connect` | NEW | — |
| AR-04 / IT-04 | AR/IT | §9·§10 — OpenCode runtime 행(augmenter → config → 파서 → 카탈로그 → `agent:list`·턴) | NEW | — |
| AR-05 / IT-05 | AR/IT | §9·§15 — 배포 계약(선언 → Bootstrap → deps → 행·augmenter) | NEW | — |
| MD-01 / UT-01 | MD/UT | §10·§11 — 연결 상태기계 `createLoginFreeConnections` | NEW | — |
| MD-02 / UT-02 | MD/UT | §11 — CLI 출력 파서·provider id 검사 | NEW | — |
| MD-03 / UT-03 | MD/UT | §11 — OpenCode runtime 파서·카탈로그 모델 보존·settings 부재 | NEW | — |
| MD-04 / UT-04 | MD/UT | §11 — renderer 행 메타·액션 모델 | NEW | — |
| MD-05 / UT-05 | MD/UT | §11 — 에이전트 placeholder 해석 | NEW | — |
| MD-06 / UT-06 | MD/UT | §11 — `+` 메뉴 Orca 우선 정렬 | NEW | — |
| MD-07 / UT-07 | MD/UT | §11 — 엔진 카드 정렬 | NEW | — |
| MD-08 / UT-08 | MD/UT | §11 — listing helper·`modelDetails` 전달 | NEW | — |
| MD-09 / UT-09 | MD/UT | §11 — agent store 재조회 순서 guard | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | provider state → `CustomizeList`·`ProviderDetail` → `ProviderAuthActions` → 클릭 → `useProviders.connect` | `CustomizeList.render.test.ts:'shows the host connection state of login-free rows'` · `ProviderDetail.render.test.ts:'colors the connection dot and shows the failure reason'` · `ExtensionsCatalogView.interaction.test.ts:'connects the selected login-free row'` | not selected — 렌더 텍스트·class·호출 인자를 직접 관측 | EP-12 (7) · EP-13 (7) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 가이드 레시피 선언 → `createAuthRuntime` → `connect` → `AuthChange` → 카탈로그 → `agent:list` · 연결 행 | 신규 `opencode-connection-deployment.test.ts:'연결 성공은 초록 행·읽기 전용 OpenCode 카드·턴 모델로 이어진다'` · `:'설치되지 않은 호스트는 빨간 행이고 카드가 없다'` | not selected — 실제 runtime·카탈로그·핸들러 조립의 결과 관측 | EP-04 (6) · EP-05 (6) · EP-17 (2) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `resolveTurnProvider` → `harnessRuntime.cached` → `prepareConfiguredHarnessInput` → `OpenCodeAdapter.catalog` → model | `resolve-turn.runtime-catalog.test.ts:'OpenCode runtime key runs the selected runtime model with host settings'` · `misc.runtime-catalog.test.ts:'agent:list keeps OpenCode runtime models and primary agents'` | required — 변이 M-P1: `resolve-turn.ts` adapter.catalog 인자를 `toAgentEnvironments([selected]…)`로 되돌림 → red | EP-06 (3) · EP-07 (1) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `Bootstrap.start` → `startRuntimeModelCatalogAfterDeploy` → `createRuntimeModelAuthResume.run` → `auth.connectAll()` | 신규 `opencode-connection-deployment.test.ts:'Bootstrap run 콜백이 리스너 설치 뒤 connectAll을 부른다'`(소스 가드) · `runtime-model-startup.test.ts:220` | required — 배선 존재: `run`에서 `auth.connectAll()` 제거·`() => {}` 교체 시 가드 red(감도 케이스) | EP-14 (2) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `createHostHarnessPort` → `registry.get` → `isInstalled`·`listProviderModels` → `OpenCodeServerPool.listModels` → `runCli` | 신규 `harness-host.test.ts:'installed uses the adapter install state and missing harnesses are not installed'` · `:'listModels delegates to the adapter and rejects unsupported harnesses'` · `server.test.ts:'listModels runs the models command with the server executable'` | not selected — 인자·반환을 직접 관측 | EP-08 (8) · EP-09 (2) · EP-10 (4) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 기존 경로 | §7 주의사항의 기존 케이스 무수정 green | not selected — 기존 행동 단언 | EP-01 (3) · EP-16 (4) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | Composer → `OpenCodeModeControl`(agents prop + catalog snapshot) → `OpenCodeAgentControl` → `chatActions.setHarnessOptions` | `Module.integration.test.ts:'fills agents from the provider catalog while the runtime list loads and overrides it on arrival'` · `Controls.interaction.test.ts:'shows placeholder agents with the loading spinner without storing them'` | required — 변이 M-C1: placeholder를 `harnessAgent`에 저장하도록 effect 변경 → red · M-C2: `OpenCodeModeControl`이 placeholder를 넘기지 않음 → red | EP-18 (5) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | `ComposerInputController` → `AttachMenu` → `buildAttachMenu` → `CascadeMenu` | `Composer.native-menu.test.ts:'puts the Orcinus orca group first in both panels for %s'` | not selected — 하위 VP-26이 맞바꿈 변이 보유 | EP-19 (3) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | `useEngines` → `AgentEnvironmentView` → `Card` | `AgentEnvironmentView.render.test.ts:'orders engine cards Claude, OpenCode, then others'` | not selected — 하위 VP-27이 변이 보유 | EP-20 (2) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | `app/deployment/*` production export · 문서 | `deployment-wiring.test.ts:528`·`:537`·`:552` · `login-free-deployment.test.ts:339` · `gate:node scripts/check-doc-inventory.mjs --check` | not selected | EP-16 (4) · EP-22 (14) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | 실제 앱 | 사람 실기 체크리스트(§19) | not selected — 사람 | 0 — 사람 실기 |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | provider push → `agentStore` 구독 → `refresh` → `useEngines` 재진입 | `useEngines.test.ts:'shows a runtime card added while the engine page was unmounted'` | not selected — 하위 VP-29가 변이 보유 | EP-21 (4) |
| VP-13 | SD-01 ↔ ST-01 | REQUIRED | `AuthRuntime.connect` → `createLoginFreeConnections` → run → publish → snapshot | `login-free-connection.test.ts` 전 케이스(§11 목록) | required — 변이 M-S1: 같은 결과에도 revision+1 → red · M-S2: `connection-started`를 credentialChanged true로 → red · M-S3: idle 실패를 credentialChanged true로 → red | EP-01 (3) · EP-02 (3) · EP-15 (2) |
| VP-14 | SD-02 ↔ ST-02 | REQUIRED | `AuthChange` → `createRuntimeModelAuthChangeHandler` → invalidate·reconcile → 카탈로그 행 | `opencode-connection-deployment.test.ts:'부팅 직후 확인 전에는 카드가 없고 확인이 끝나면 생긴다'` · `:'같은 결과의 재연결은 augmenter를 다시 부르지 않는다'` · `:'다른 결과는 카드 모델을 교체하고 실패는 카드를 지운다'` | not selected — 행 존재·모델·호출 수 직접 관측 | EP-03 (3) · EP-04 (6) |
| VP-15 | SD-03 ↔ ST-03 | REQUIRED | 첫 `ensureLoaded` → 구독 설치 → push → `refresh` → set | `agentStore.test.ts:'refreshes on provider pushes after the first read even with no mounted consumer'` | not selected — VP-29가 변이 보유 | EP-21 (4) |
| VP-16 | AR-01 ↔ IT-01 | REQUIRED | `AuthRuntime.snapshot`·publish → reader·handler → push·syncPlugins·invalidate·reconcile | `runtime-model-startup.test.ts:'reads login-free and credential snapshots through auth.snapshot on every call'`(87 대체) · `runtime.test.ts:'snapshot은 두 체계와 미등록 id를 같은 형상으로 읽는다'` | required — 변이 M-A1: reader를 `auth.bind(id).snapshot()`로 되돌림 → red | EP-03 (3) |
| VP-17 | AR-02 ↔ IT-02 | REQUIRED | Bootstrap `loginFreeHost` → `createLoginFreeConnections` run context → host → adapter → pool | `runtime.test.ts:'connect 실행 context는 signal과 주입한 host만 갖는다'` · `adapter.test.ts:'listProviderModels delegates to the server pool'` · `server.test.ts` 4케이스 | not selected | EP-08 (8) · EP-10 (4) |
| VP-18 | AR-03 ↔ IT-03 | REQUIRED | snapshot → `connectionInfo` → wire · renderer → preload → `orca:provider:connect` → handler | `connection-views.test.ts:'carries connection only for connect-declared login-free rows'` · `providers.test.ts:'provider 채널 전수를 등록한다'`·`:'connect는 최종 연결 상태를 돌려준다'` · `preload/index.test.ts` 표 행 | not selected — EXPECTED exact 집합이 추가·누락 둘 다 red | EP-12 (7) · EP-13 (7) |
| VP-19 | AR-04 ↔ IT-04 | REQUIRED | augmenter → `compute` → `HarnessRuntimeConfig.modelDetails` → `parseHarnessRuntimeModels` → 카탈로그 → `agent:list`·턴 | `runtime-config.test.ts:'passes augmenter modelDetails through to the cached config'` · `registry.test.ts:'parses opencode runtime configs with the OpenCode parser'` | required — 변이 M-R1: `compute`에서 `modelDetails` 누락 → 카드 alias가 id로 바뀌어 red | EP-04 (6) · EP-05 (6) |
| VP-20 | AR-05 ↔ IT-05 | REQUIRED | `app/deployment/*` deps 타입 → Bootstrap 호출 | `deployment-wiring.test.ts:'config API deps 로는 login/revoke/resume/subscribe 에 도달할 수 없다'`(갱신) · 신규 `:'연결 행 deps는 bindLoginFreePlugin을 쓴다'` · `opencode-connection-deployment.test.ts` 소스 가드 | required — `loginFreeHost` 인자 제거·`{}` 교체 시 가드 red(감도 케이스) | EP-17 (2) · EP-14 (2) |
| VP-21 | MD-01 ↔ UT-01 | REQUIRED | `createLoginFreeConnections` | VP-13과 같은 파일·케이스 | VP-13의 M-S1~M-S3 | EP-01 (3) · EP-02 (3) |
| VP-22 | MD-02 ↔ UT-02 | REQUIRED | `parseOpenCodeModelListing` · `assertOpenCodeProviderId` | 신규 `model-listing.test.ts` 6케이스(§11) | not selected — 입력별 결과 직접 관측 | EP-11 (2) |
| VP-23 | MD-03 ↔ UT-03 | REQUIRED | `parseOpenCodeRuntimeModels` · `openCodeCatalog` · `loadOpenCodeProviderSettings` | `settings.test.ts:'builds OpenCode runtime rows from availableModels and modelDetails'`·`:'treats a missing settings file as an empty config'` · `catalog.test.ts:'keeps runtime entry models and still lists primary agents'` | required — 변이 M-R2: `openCodeCatalog` 분기를 항상 `parseOpenCodeModels`로 → red | EP-05 (6) · EP-06 (3) · EP-07 (1) |
| VP-24 | MD-04 ↔ UT-04 | REQUIRED | `providerRowMeta` · `providerAuthActionKind` · `connectionTone` | `providerRows.test.ts:'maps each host connection state to its label and tone'` · `ProviderAuthActions.test.ts:'offers connect, reconnect and busy for connect-declared rows'` | required — 형제 맞바꿈: `idle`↔`failed` 라벨 키 교체·`connected`↔`failed` tone 교체 → red | EP-12 (7) |
| VP-25 | MD-05 ↔ UT-05 | REQUIRED | `agentPlaceholder` · `resolveAgentSelection` | `agentSelection.test.ts:'uses provider catalog agents, then the shared defaults, only without an authoritative list'` | not selected — 입력별 결과 직접 관측 | EP-18 (5) |
| VP-26 | MD-06 ↔ UT-06 | REQUIRED | `orcaGroupFirst` → 스킬·플러그인 패널 | `attachMenuModel.test.ts:'puts the Orcinus orca group first in the skills panel'`·`:'puts the Orcinus orca group before native plugins for %s'` | required — 형제 맞바꿈: 플러그인 패널 native 블록을 Orca 앞으로 되돌림 → red | EP-19 (3) |
| VP-27 | MD-07 ↔ UT-07 | REQUIRED | `orderAgentEnvironments` | 신규 `agentOrder.test.ts:'ranks claude, opencode, then unknown adapters and keeps order within a harness'` | required — 변이: rank를 adapter 문자열 정렬로 교체 → `legacy`가 `opencode` 앞이라 red | EP-20 (2) |
| VP-28 | MD-08 ↔ UT-08 | REQUIRED | `listedModelsOf` · `runtimeModelsFromListing` | 신규 `runtime-listing.test.ts` 3케이스(§11) | not selected | EP-04 (6) |
| VP-29 | MD-09 ↔ UT-09 | REQUIRED | `createAgentStore.refresh` 순서 guard · 1회 설치 | `agentStore.test.ts:'ignores an older agent:list response that resolves after a newer one'` · `:'installs the provider subscription once and never removes it'` | required — 변이 M-G1: seq 비교 제거 → red | EP-21 (4) |

`§10 강제 지점 전수`의 N은 §10 `언제 강제`에 고정한 자리 목록의 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint | `app/**` 수정 — boundaries·harness-boundary·`child_process` 경계(새 파일은 `server.ts`만 실행) | `cd app && npm run lint` | 현재 변경이 유발한 error |
| app typecheck | 계약 타입·`AuthRuntime` 전체 fake 갱신 | `cd app && npm run typecheck` | 현재 변경이 유발한 error |
| 관련 vitest | §11 목록 스위트 | `cd app && ./node_modules/.bin/vitest run <§19 목록>` | 신규·대체·회귀 케이스 red. DB ABI 서명 실패는 환경(`app/AGENTS.md`) |
| 문서 인벤토리 | IPC 채널 +1, 문서 링크 | `cd app && node scripts/check-doc-inventory.mjs` 재생성 후 `--check` | 불일치·깨진 링크 |
| message-bus | handoff 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0 |
| CI | windows-latest 통합 | `.github/workflows/ci.yml` | 현재 변경이 유발한 실패 |

> 보안·데이터 무결성(호스트 실행 인자·디스크 0)은 D-007·D-008과 EP-10·EP-15에 귀속한다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 로그인 프리 포트 snapshot은 상수 `{valid, verified:true, credentialRevision:0}`이다 | `main/features/auth/login-free.ts:22-27` |
| 로그인 프리 선언은 `id·label·origin?`뿐이다 | `main/contracts/auth.ts:335-342` |
| runtime 카탈로그 reader는 `auth.bind(id).snapshot()` — 로그인 프리 id는 store에 grant가 없어 `none` | `main/app/runtime-model-startup.ts:62-66` · `main/features/auth/runtime.ts:202-206`·`:138-150` |
| reconcile은 `verified && status==='valid'`일 때만 resolve한다 | `main/features/harnesses/common/runtime-catalog.ts:95-99` |
| 같은 revision이면 resolve를 건너뛴다 | `runtime-catalog.ts:103` |
| 카탈로그 변화는 `onChange` = `pushConnectionState`로 방송된다 | `runtime-catalog.ts:129` · `main/app/bootstrap.ts:655-661` |
| `AuthChange` 소비 4갈래(push·plugin sync·invalidate·reconcile) | `runtime-model-startup.ts:91-111` |
| contribution 키 무효화는 authId 일치 contribution을 자동 포함한다 | `runtime-model-startup.ts:37-57` |
| runtime 파서는 하네스 모듈 `parseRuntimeModels`, 없으면 Claude 폴백 — OpenCode 모듈에 없다 | `main/app/harnesses/registry.ts:35-39` · `main/app/harnesses/opencode/module.ts:20-41` |
| Claude runtime 파서는 family 분류·`ANTHROPIC_MODEL`을 쓴다 | `main/features/harnesses/claude/model-parser.ts:103-111` |
| OpenCode adapter `catalog`는 config로 모델을 다시 만든다 — runtime 행 config `{}` → 모델 0 | `main/adapters/opencode/v1/catalog.ts:5-17` · `adapter.ts:244-247` |
| `agent:list`는 merged 행(실제 `source`)을 `adapter.catalog`에 넘긴다 | `main/app/handlers/misc.ts:43-80` |
| resolve-turn은 `toAgentEnvironments([selected])`로 다시 만들어 `source:'settings'`가 된다 | `main/app/chat-turn/resolve-turn.ts:228-235`·`:272-280` · `models.ts:90-102` |
| OpenCode settings 로더는 파일이 없으면 throw → `reportError`(토스트) | `adapters/opencode/v1/settings.ts:22-28` · `features/harnesses/common/settings.ts:115-122` · `infra/error-report/index.ts:28-48` |
| Claude 로더는 파일 부재를 `{}`로 둔다 | `adapters/claude/settings.ts:88-94` |
| OpenCode 실행 파일 해석·설치 판정·1.x 판정 | `adapters/opencode/v1/server.ts:29-52`·`:112-119`·`:205-212` |
| 웜업의 서버 시작 전제 = `isInstalled()` | `main/app/opencode-warmup.ts:42` · `bootstrap.ts:862-869` |
| `child_process` 허용 파일 | `app/eslint.config.mjs:242-256` · `docs/arch/backend/security.md` §1.10 |
| 서버 cwd는 홈, 전역 리소스 조회는 `OPENCODE_DISABLE_PROJECT_CONFIG=true` | `opencode/v1/native-storage.ts:24-26` · `configured-resources.ts:167-168` |
| OpenCode 서버 config는 `OPENCODE_CONFIG_CONTENT`로 전달(호스트 전역 설정에 병합) | `opencode/v1/native-storage.ts:6-15` |
| 연결 행 조립 deps의 auth는 `bind`만 | `main/app/deployment/connections.ts:39-45` |
| config API augmenter deps는 `bind`만 | `main/app/deployment/harness-runtime.ts:50-52` |
| wire 상태는 `none·valid·expired·unknown`, step은 전역 1슬롯 | `shared/ipc.ts:1831`·`:1859-1873` |
| `Dot` tone에 `red`가 이미 있다 · `Button`에 `busy`가 있다 | `renderer/src/shared/ui/Status.tsx:1-13` · `shared/ui/Button.tsx:29`·`:106-116` |
| 로그인 프리 행 메타·액션 | `renderer/.../skills/lib/providerRows.ts:35-42` · `components/customize/providerAuthActionModel.ts:11-13` · `ProviderDetail.tsx:17`·`:62` |
| i18n `skills.provider.connect: '연결'`은 정의만 있고 미사용 | `renderer/src/shared/i18n/resources/ko.ts` `provider.connect` · 0290 `baseline/i18n-unreferenced.txt:15` |
| OpenCode 에이전트 컨트롤은 authoritative 값이 없으면 빈 메뉴 | `renderer/.../opencode/composer/Controls.tsx:14-23`·`:196-230` · `agentSelection.ts:3-11` |
| main 정적 OpenCode 카탈로그는 `build`·`plan`을 기본 primary로 넣는다 | `adapters/opencode/v1/catalog.ts:9-13` |
| `+` 메뉴 플러그인 패널은 native 그룹을 Orca 앞에 `unshift`한다 · 스킬 패널은 처음 나온 순서 | `renderer/.../chat/lib/attachMenuModel.ts:175-183` · `:92-123` |
| 플러그인 페이지 스킬 순서는 Orca 우선 | `renderer/.../skills/lib/catalogOrder.ts:4-18` |
| 엔진 카드는 store 순서 그대로 · `agent:list` 순서 = settings(어댑터 디렉토리 정렬) → runtime 추가 | `AgentEnvironmentView.tsx:123` · `features/harnesses/common/settings.ts:200-205` · `models.ts:104-122` |
| agent store: 조기 반환 · push 구독 2곳 · 재조회 순서 guard 없음 | `renderer/src/shared/stores/agentStore.ts:22-27`·`:41-45`·`:53-55` · `useEngines.ts:31` · `useAgents.ts:12` · `SettingsModal.tsx:45-51` |
| 외부 CLI — `models [provider]` 출력: `provider/model` 줄, `--verbose`는 각 줄 뒤 `JSON.stringify(model, null, 2)`. 미등록 provider는 `Provider not found` 실패 | OpenCode v1.18.27 `packages/opencode/src/cli/cmd/models.ts` · `packages/web/src/content/docs/cli.mdx` |
| 외부 CLI — 모델 객체 필드 `id·providerID·name·variants?(Record)·status·limit·cost…` | v1.18.27 `packages/opencode/src/provider/provider.ts` `Model` |
| 외부 CLI — `--pure` = "Run without external plugins"(전역) | v1.18.27 `cli.mdx` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `AuthChange` production 구독 파일 | `rg -n "\bauth\s*\.\s*subscribe\s*\(" app/src/main -g '!*.test.ts'` | 1 | `runtime-model-startup.ts` — 새 cause도 이 helper만 소비 |
| `AuthRuntime` 전체 객체 fake | `rg -n "const auth: AuthRuntime = \{\|\): AuthRuntime \{" app/src/main -g '*.test.ts'` | 2 | `auth-resume.test.ts:146` · `connection-views.test.ts:34` — 새 메서드 4개 추가 필요(typecheck가 잡는다) |
| `AuthRuntime` 구현 | `rg -n "const runtime: AuthRuntime" app/src/main` | 1 | `features/auth/runtime.ts:257` |
| `adapter.catalog(` 호출부 | `rg -n "\.catalog\(" app/src/main -g '!*.test.ts'` | 2 | `handlers/misc.ts` · `chat-turn/resolve-turn.ts` |
| `catalog` 구현 adapter | `rg -n "catalog: NonNullable<SessionAdapter\['catalog'\]>" app/src/main` | 1 | OpenCode만 |
| `parseRuntimeModels` 제공 모듈 | `rg -n "parseRuntimeModels" app/src/main/app/harnesses -g '!*.test.ts'` | 2 | contract + Claude 모듈 |
| `agentStore` push 구독 설치 | `rg -n "subscribeAgents\(\)" app/src/renderer/src -g '!*.test.ts'` | 2 | `useEngines.ts:31` · `useAgents.ts:12` |
| `ensureLoaded` 소비 | `rg -n "ensureLoaded" app/src/renderer/src -g '!*.test.ts'` | 4파일 | store · `useAgents` · `useEngines` · `SettingsModal` |
| provider 채널 | `rg -n "'orca:provider:" app/src/shared/ipc.ts` | 6 | +1(`connect`) |
| canonical JSON 사본 | `rg -n "function canonical(ize)?\(" app/src/main` | 3 | 새 사본 금지 — `shared/obj.ts`에 1벌 추가해 신규 코드만 사용 |

### 수치 / 전칭 표현 검산

- 재측정 수치: provider 채널 6(`providers.test.ts:22-29` EXPECTED와 일치) · `child_process` 허용 파일 3 경로 패턴 + 테스트 2(`eslint.config.mjs:245-250`).
- "유일한 구독" 반례 검색: 위 표 `auth.subscribe` 1건 — 반례 0.
- "OpenCode만 catalog 구현" 반례: `rg -n "catalog\s*[:=]" app/src/main/adapters/claude` → 0.
- 문서 앵커 확인: `auth.md` §4.1·§6.1·§7·§9·§10·§11 · `security.md` §1.10 · 가이드 §3·§4 `### 로그인 프리 Plugin 레시피` · `IPC_CONTRACT.md:507`("6채널") — 실재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`·`SD-02`·`SD-03`·`AR-01`~`AR-05`
- 현재 책임 소유자: 로그인 프리 상태 = 상수(`login-free.ts`) · runtime 카탈로그 = Auth snapshot 구독(`runtime-catalog.ts`) · 호스트 실행 = OpenCode 서버 pool 내부 전용 · agent 목록 갱신 = 화면별 구독.
- 현재 entry → flow → consumer: 배포가 로그인 프리 id에 contribution을 묶어도 reader가 `none`을 읽어 행이 영원히 없다. OpenCode contribution은 Claude 파서로 해석되고 `catalog`가 모델을 지운다.
- 현재 오류 경로: runtime-only OpenCode 키 resolve마다 `providers.settings.resolve-failed` 토스트.
- 문제의 직접 원인: (a) 상태 없는 로그인 프리 (b) 실행 경계 (c) OpenCode runtime 3결함 (d) 화면 수명 구독·순서 guard 부재.

```text
LOGIN_FREE(no state) ──x── RuntimeModelCatalog(snapshot none) ──x── agent:list(no row)
OpenCode contribution → Claude parser → openCodeCatalog(config {}) → models [] → 턴 model 없음
provider push ──(엔진/Composer 마운트 때만)──> agentStore.refresh   ensureLoaded → 캐시
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 위와 같음.
- 변경 후 책임 소유자: 연결 상태기계 = `features/auth/login-free-connection.ts`(Auth 소유, 메모리) · 연결 로직 = 배포 `connect.run` · 호스트 능력 = `app/harness-host.ts` → `SessionAdapter.listProviderModels` → `OpenCodeServerPool.listModels` · 결과 → 카탈로그 = 배포 augmenter(`connectionValue`) · agent 목록 신선도 = `agentStore` 단독.
- 유지: `AuthChange` 4갈래 소비, `RuntimeModelCatalog` fail-closed·revision 비교, augmenter 확장점, `createPluginBinding` 경로, 게이트·vault·resume 분리.
- 제거/대체: 화면별 `subscribeAgents()`(제거) · `openCodeCatalog`의 runtime 행 모델 재계산(분기로 대체) · resolve-turn의 provenance 재조립(merged 행 전달로 대체).

```text
[click 연결 / boot connectAll]
  → orca:provider:connect → AuthRuntime.connect → LoginFreeConnections(checking → run → connected|failed)
       run({signal, host}) → host.installed('opencode') · host.listModels('opencode', p)
                                 └ registry.get → OpenCodeAdapter.listProviderModels → pool.listModels → execFile → parse
  → AuthChange(snapshot, connection-*) → handler → push · syncPlugins · invalidate(keys) · reconcile
  → RuntimeModelCatalog → harnessRuntime.resolve → augmenter(connectionValue) → {availableModels, modelDetails}
  → parseOpenCodeRuntimeModels → read-only 행 → agent:list(merged, 실제 source) → OpenCodeAdapter.catalog(모델 유지)
  → provider push → agentStore(앱 수명 구독, 최신 응답만) → 엔진&모델 (Claude → OpenCode 정렬)
[턴] resolveTurnProvider → cached config(settings {}) → catalog(source runtime) → model provider/model
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 로그인 프리 상태 상수 | connect 선언 대상만 `LoginFreeConnections`가 상태 소유 | D-002·D-005 | SD-01/VP-13 · `login-free-connection.ts` |
| 책임/소유권 | 호스트 실행은 서버 pool 내부 | 고정 2질의(`--version`·`models`)를 `HostHarnessPort`로 배포에 노출 | D-007 | AR-02/VP-17 · `harness-host.ts`·`server.ts` |
| data/control flow | 로그인 프리 → 카탈로그 경로 없음 | snapshot·`AuthChange` → 기존 4갈래 · augmenter가 `connectionValue` | D-013 | SD-02/VP-14 · `opencode-connection-deployment.test.ts` |
| data/control flow | push 구독 = 화면 마운트 | store 앱 수명 구독 + 최신 응답 | D-021 | SD-03/VP-15·VP-29 · `agentStore.ts` |
| state/contract | wire 상태 4종만 | `ProviderInfo.connection` + 채널 `connect` | D-019·D-020 | AR-03/VP-18 · `shared/ipc.ts` |
| state/contract | runtime config에 모델 메타 없음 | `modelDetails` 선택 필드 | D-014 | AR-04/VP-19 · `harness-config.ts` |
| error/lifecycle | settings 부재 = 오류 토스트 | OpenCode 로더 ENOENT = `{}` | D-015 | MD-03/VP-23 · `settings.ts` |
| error/lifecycle | — | 연결 실패 사유·timeout·single-flight·pool close abort | D-005·D-006 | SD-01/VP-13 |
| test seam/관측점 | — | `runCli` 주입 · 순수 파서 · 상태기계 순수 모듈 · store factory | §11 | MD-01·MD-02·MD-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | 연결 선언·context·상태·cause·`AuthRuntime` 확장 타입 | 타입만 | 배포 · features/auth · app |
| `features/auth/login-free-connection.ts` | 상태기계·single-flight·timeout·결과 비교·발행 | definitions·host·publish → `LoginFreeConnections` | `features/auth/runtime.ts` |
| `features/auth/runtime.ts` | 두 체계 snapshot·connect 위임·포트 연결 | deps.`loginFreeHost` | Bootstrap |
| `app/harness-host.ts` | registry → `HostHarnessPort` | registry → port | Bootstrap |
| `adapters/opencode/v1/server.ts` | 실행 파일·1.x·`models` CLI 실행 | provider·signal·env → listing | `OpenCodeAdapter` |
| `adapters/opencode/v1/model-listing.ts` | verbose 출력 파서·provider id 검사(순수) | stdout → `HarnessListedModel[]` | `server.ts` |
| `adapters/opencode/v1/settings.ts` | OpenCode runtime 파서·로더 ENOENT | config → rows | implementation → `app/harnesses/opencode/module.ts` |
| `features/harnesses/common/runtime-listing.ts` | 결과 검증·augmenter 결과 변환(순수) | unknown/listing → `{availableModels, modelDetails}` | 배포 augmenter |
| `app/connection-views.ts` | wire `connection` 매핑 | snapshot → `ProviderInfo` | handlers·push |
| renderer `providerRows`·`providerAuthActionModel` | 상태 → 라벨·tone·버튼 종류(순수) | `ProviderInfo` → meta | `CustomizeList`·`ProviderDetail`·`ProviderAuthActions` |
| renderer `agentStore` | agent 목록 SSOT·앱 수명 구독·최신 응답 | `agentApi.list`·`providerApi.onState` | `useAgents`·`useEngines`·`SettingsModal` |

## 10. 계약 / 타입 / 강제 지점

### 계약 형상 (정본은 구현 코드)

```ts
// contracts/auth.ts
export interface LoginFreeDefinition {
  id: AuthId; label: string; origin?: string
  connect?: LoginFreeConnect            // 선언하면 연결 버튼·상태. 생략하면 항상 연결
  methods?: never; probe?: never
}
export interface LoginFreeConnect { run(context: LoginFreeConnectContext): Promise<unknown> }
export interface LoginFreeConnectContext { signal: AbortSignal; host: HostHarnessPort }
export type LoginFreeConnectionState = ProviderConnectionState            // 'idle'|'checking'|'connected'|'failed'
export interface LoginFreeConnectionStatus { state: LoginFreeConnectionState; message?: string }
// AuthSnapshot: + connection?: LoginFreeConnectionStatus  (connect 선언 대상에만)
// AuthSnapshotChangeCause: + 'connection-started' | 'connection-succeeded' | 'connection-failed'
// AuthRuntime: + snapshot(authId) · connect(authId) · connectAll() · connectionValue(authId)

// adapters/common/harness-config.ts
export interface HarnessListedModel { id: string; name?: string; variants?: readonly string[] }
export type HarnessModelDetail = Omit<HarnessListedModel, 'id'>
export interface HostHarnessPort {
  installed(harnessId: Backend): Promise<{ installed: boolean; version?: string }>
  listModels(harnessId: Backend, provider: string,
             options: { signal: AbortSignal; env?: Readonly<Record<string, string>> }): Promise<readonly HarnessListedModel[]>
}
// HarnessRuntimeConfig: + modelDetails?: Readonly<Record<string, HarnessModelDetail>>
// RuntimeConfigAugmenter.resolve 결과: + modelDetails?
// SessionAdapter: + listProviderModels?(provider, options): Promise<HarnessListedModel[]>
// OpenCodeServer: + listModels?(provider, options)

// shared/ipc.ts
export type ProviderConnectionState = 'idle' | 'checking' | 'connected' | 'failed'
export interface ProviderConnectionInfo { state: ProviderConnectionState; message: string | null }
// ProviderInfo: + connection?: ProviderConnectionInfo ·  CHANNELS.providerConnect = 'orca:provider:connect'
// shared/protocol.ts: ProviderConnectRequestSchema = z.object({ providerId: <ProviderRevokeRequestSchema와 같은 문자열 규칙> })
```

### 자리 검색 (후보) — 저장소 루트에서 실행

검색은 후보를 넓게 반환하고, 분모는 아래 표의 고정 자리다. hit 수를 자리 수로 쓰지 않으며 표 밖 운반 자리가 나오면 `[구현자 기입]`에 적는다.

```text
Q1 연결 상태·발행     rg -n "connection|'connection-(started|succeeded|failed)'|snapshot\(" app/src/main/features/auth app/src/main/contracts/auth.ts app/src/main/app/connection-views.ts app/src/main/app/runtime-model-startup.ts -g '!*.test.ts'
Q2 결과·모델 운반     rg -n "connectionValue|modelDetails|availableModels|listedModelsOf|runtimeModelsFromListing" app/src/main -g '!*.test.ts'
Q3 OpenCode runtime   rg -n "parseRuntimeModels|parseOpenCodeRuntimeModels|\.catalog\(|openCodeCatalog\(|loadOpenCodeProviderSettings" app/src/main -g '!*.test.ts'
Q4 호스트 실행        rg -n "listProviderModels|listModels|loginFreeHost|isInstalled\(|execFile|'models'|--pure|--verbose|OPENCODE_DISABLE_PROJECT_CONFIG|1\\\.\\\\d" app/src/main -g '!*.test.ts'
Q5 wire·IPC           rg -n "\.connection\b|connection\?:|providerConnect|provider\.connect|providerApi\.connect|onConnect" app/src/shared app/src/preload app/src/main/app app/src/renderer/src -g '!*.test.ts'
Q6 부팅·기본 배포     rg -n "connectAll|createHostHarnessPort|LOGIN_FREE_DEFINITIONS|RUNTIME_MODEL_CONTRIBUTIONS" app/src/main -g '!*.test.ts'
Q7 renderer 기타      rg -n "OPENCODE_DEFAULT_AGENTS|placeholder|orcaGroupFirst|unshift|orderAgentEnvironments|subscribeAgents|onState|ensureLoaded" app/src/shared/harness.ts app/src/main/adapters/opencode/v1/catalog.ts app/src/renderer/src -g '!*.test.ts'
Q8 디스크 0(음성)     rg -n "electron-store|createRecordPersistence|writeFile" app/src/main/features/auth/login-free-connection.ts app/src/main/features/auth/login-free.ts
```

### 고정 자리 목록

| EP · V | 계약/필드 | 자리 (분모) | 언제 강제 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 · SD-01/VP-06·13·21 | snapshot이 연결 상태를 따른다(무선언은 상수) | ① `login-free-connection.ts` 상태 → snapshot 생성 ② `login-free.ts` 포트 `snapshot()` 위임(무선언은 `alwaysConnectedSnapshot`) ③ `runtime.ts` `AuthRuntime.snapshot(authId)` 체계 분기 — **3** | snapshot 읽기마다 | ① `login-free-connection.test.ts` 성공·실패 ② `login-free.test.ts:'connect 선언 포트는 연결 상태를, 무선언 포트는 상수를 돌려준다'` ③ `runtime.test.ts:'snapshot은 두 체계와 미등록 id를…'` | 카드·도구가 연결과 무관하게 열리거나 닫힌다 |
| EP-02 · SD-01/VP-13·21 | 발행 cause·credentialChanged | ① 시작 `connection-started`/false ② 성공 `connection-succeeded`/true 또는 같은 결과 `verified`/false ③ 실패 `connection-failed`/이전 valid 여부 — **3**(모두 `login-free-connection.ts`) | 전이마다 | `login-free-connection.test.ts` 성공·재연결·실패 케이스의 수신 change 배열 exact | 무효화 과다(재spawn) 또는 누락(낡은 카드) |
| EP-03 · AR-01/VP-14·16 | 소비자가 두 체계 snapshot을 읽는다 | ① `runtime-model-startup.ts` `createRuntimeModelSnapshotReader` → `auth.snapshot` ② `bootstrap.ts` `runtimeModelSnapshotOf` 1벌(기존 가드) ③ `runtime-catalog.ts:95` 유효성 판정(기존) — **3** | reconcile·attach마다 | ① `runtime-model-startup.test.ts:'reads login-free and credential snapshots…'` ② `no-stray-auth-subscribe.test.ts` SHARED_READER_BUILD(기존) ③ `opencode-connection-deployment.test.ts:'부팅 직후 확인 전에는 카드가 없고…'` | 로그인 프리 카드가 영원히 안 생긴다 |
| EP-04 · AR-04/VP-02·14·19·28 | 결과 → `HarnessRuntimeConfig` | ① `login-free-connection.ts` `value()` (connected만) ② `runtime.ts` `connectionValue` ③ `HarnessConfigApiDeps.auth` 타입 ④ `runtime-config.ts` `compute` `modelDetails` 전달 ⑤ `runtime-listing.ts` `listedModelsOf` ⑥ `runtimeModelsFromListing` — **6** | augmenter resolve마다 | ①② `login-free-connection.test.ts:'connectionValue는 connected일 때만 결과를 준다'` ③ `deployment-wiring.test.ts` 능력 케이스 ④ `runtime-config.test.ts:'passes augmenter modelDetails…'` ⑤⑥ `runtime-listing.test.ts` | 실패 뒤에도 옛 결과로 카드·턴이 열린다, 또는 이름·variant 소실 |
| EP-05 · MD-03/VP-02·19·23 | OpenCode runtime 행 형상 | ① `opencode/v1/settings.ts` `parseOpenCodeRuntimeModels` ② `implementation.ts` 계약 `parseRuntimeModels` ③ `v1/index.ts` 매핑 ④ `adapters/opencode/index.ts` export ⑤ `app/harnesses/opencode/module.ts` `parseRuntimeModels` ⑥ `app/harnesses/registry.ts` 디스패치(기존) — **6** | reconcile 파싱마다 | ① `settings.test.ts:'builds OpenCode runtime rows…'` ②~⑥ `registry.test.ts:'parses opencode runtime configs with the OpenCode parser'` | OpenCode 카드가 Claude alias·모델 형식으로 깨진다 |
| EP-06 · R-03/VP-03·23 | runtime 행 모델 보존 | ① `opencode/v1/catalog.ts` `models` 분기(`entry.source==='runtime'`) ② `resolve-turn.ts` `adapter.catalog` 인자 = merged 행 ③ `handlers/misc.ts` `agent:list` 인자 = merged 행(기존) — **3** | `agent:list`·턴마다 | ① `catalog.test.ts:'keeps runtime entry models…'` ② `resolve-turn.runtime-catalog.test.ts:'OpenCode runtime key runs the selected runtime model…'` ③ `misc.runtime-catalog.test.ts:'agent:list keeps OpenCode runtime models…'` | 카드 모델 0·턴이 OpenCode 기본 모델로 돈다 |
| EP-07 · MD-03/VP-03·23 | settings 부재는 오류가 아님 | ① `loadOpenCodeProviderSettings` ENOENT → `{settings:{}}`(다른 읽기·JSON 오류는 throw 유지) — **1** | settings resolve마다 | `settings.test.ts:'treats a missing settings file as an empty config'` + `misc.runtime-catalog.test.ts` 보고 spy 0 | 부팅·연결마다 설정 오류 토스트 |
| EP-08 · AR-02/VP-05·17 | 호스트 능력 경로 | ① contracts `LoginFreeConnectContext.host` ② `login-free-connection.ts` run context 조립 ③ `bootstrap.ts` `loginFreeHost: createHostHarnessPort(this.registry)` ④ `harness-host.ts` installed ⑤ `harness-host.ts` listModels ⑥ `SessionAdapter.listProviderModels` 선언 ⑦ `OpenCodeAdapter.listProviderModels` ⑧ `OpenCodeServer.listModels` 계약 — **8** | 연결마다 | ② `runtime.test.ts:'connect 실행 context는 signal과 주입한 host만…'` ③ 소스 가드 ④⑤ `harness-host.test.ts` ⑥⑦ `adapter.test.ts:'listProviderModels delegates…'` ⑧ `server.test.ts` | 배포가 설치 확인·모델 조회를 못 부른다 |
| EP-09 · AR-02/VP-05 | 서버 시작 조건 SSOT | ① `server.ts` `start()` 1.x 판정 ② `server.ts` `listModels` 1.x 판정 — 둘 다 `assertOpenCodeCliVersion` 호출 — **2** | 서버 시작·모델 조회마다 | `server.test.ts:'listModels rejects unsupported versions and missing executables like start'` + 기존 start 케이스 | 서버는 거부하는데 연결은 초록 |
| EP-10 · AR-02/VP-05·17 | CLI 인자·환경·한계 | ① argv `['models', provider, '--verbose', '--pure']` ② env(`process.env`+호출자 env+`OPENCODE_DISABLE_PROJECT_CONFIG='true'`)·cwd 홈 ③ `timeout`·`maxBuffer`·`windowsHide` ④ signal = 호출자 ∪ pool close — **4**(모두 `server.ts listModels`) | 실행마다 | `server.test.ts:'listModels runs the models command…'`(①②③) · `:'listModels aborts on caller signal and pool close'`(④) | 다른 명령 실행·프로젝트 설정 혼입·무한 대기·종료 후 잔류 |
| EP-11 · MD-02/VP-22 | 출력 해석·provider 검사 SSOT | ① `model-listing.ts` `parseOpenCodeModelListing` ② `assertOpenCodeProviderId` — 각각 `server.ts`에서만 호출 — **2** | 실행 전·후 | `model-listing.test.ts` 6케이스 | 형식 변화가 부분 목록으로 조용히 통과 |
| EP-12 · AR-03/VP-01·18·24 | wire `connection` 생산·소비 | ① `shared/ipc.ts` `ProviderInfo.connection?` ② `connection-views.ts` `connectionInfo` ③ `providerRows.ts` statusKey·tone ④ `providerAuthActionModel.ts` `'connect'` ⑤ `ProviderAuthActions.tsx` 라벨·busy ⑥ `ProviderDetail.tsx` Dot·사유 ⑦ `CustomizeList.tsx` trailing(메타 경유) — **7** | 렌더·방송마다 | ② `connection-views.test.ts` ③④ `providerRows.test.ts`·`ProviderAuthActions.test.ts` ⑤ `ProviderAuthActions.render.test.ts` ⑥ `ProviderDetail.render.test.ts` ⑦ `CustomizeList.render.test.ts` | 버튼·색이 상태와 어긋난다 |
| EP-13 · AR-03/VP-01·18 | 연결 요청 경로 | ① `CHANNELS.providerConnect` ② `ProviderConnectRequestSchema` ③ `handlers/providers.ts` handle ④ `preload/index.ts` `provider.connect` ⑤ `shared/api/ipc.ts` `providerApi.connect` ⑥ `useProviders.connect` ⑦ `ExtensionsCatalogView` → `ProviderDetail` `onConnect` — **7** | 클릭마다 | ①③ `providers.test.ts` ②③ `providers.test.ts:'connect는 최종 연결 상태를 돌려준다'` ④ `preload/index.test.ts` ⑤⑥ `useProviders.test.ts` ⑦ `ExtensionsCatalogView.interaction.test.ts` | invoke가 영영 pending이거나 버튼이 무동작 |
| EP-14 · R-04/VP-04·20 | 부팅 재확인 배선 | ① `bootstrap.ts` `run` 콜백의 `auth.connectAll()` ② `runtime.ts` `connectAll` → `LoginFreeConnections.connectAll` — **2** | 부팅 | ① 소스 가드(양성+감도) ② `login-free-connection.test.ts:'connectAll…'` | 재시작 뒤 카드가 안 생긴다(D-009 위반) |
| EP-15 · SD-01/VP-13 | 디스크 0 | ① `login-free-connection.ts` 저장 포트·`electron-store` import 0(Q8) ② `CreateAuthRuntimeDeps`에 로그인 프리 저장 deps 없음 — **2** | 빌드 | ① `gate:Q8 = 0` + 양성 `runtime.test.ts:'디스크…'` ② typecheck(구조) | D-008 위반 — 사용자 디스크에 포맷이 생긴다 |
| EP-16 · R-06·R-10/VP-06·10 | 기본 배포 비어 있음 | ① `LOGIN_FREE_DEFINITIONS=[]` ② `RUNTIME_MODEL_CONTRIBUTIONS=[]` ③ augmenter factory `{}` ④ `createConnectionSources` gate·plugin만 — **4** | 빌드 | `login-free-deployment.test.ts:339` · `deployment-wiring.test.ts:528`·`:537`·`:552` | OSS 빌드에 행·CLI 실행이 생긴다 |
| EP-17 · AR-05/VP-02·20 | 배포 능력 타입 | ① `ConnectionDeploymentDeps.auth: Pick<AuthRuntime,'bind'\|'bindLoginFreePlugin'>` ② `HarnessConfigApiDeps.auth: Pick<AuthRuntime,'bind'\|'connectionValue'>` — **2** | typecheck | `deployment-wiring.test.ts` 능력 케이스 2개 | 배포가 `bootstrap.ts`를 고쳐야 한다 |
| EP-18 · R-07/VP-07·25 | 에이전트 placeholder | ① `shared/harness.ts` `OPENCODE_DEFAULT_AGENTS` ② `opencode/v1/catalog.ts` 기본 primary가 ①을 쓴다 ③ `Controls.tsx` `OpenCodeModeControl` placeholder 산출 ④ `OpenCodeAgentControl` 옵션·표시값 ⑤ 저장 effect(placeholder 제외) — **5** | 렌더마다 | ①② `catalog.test.ts:6`(기존 exact agents) ③ `Module.integration.test.ts` ④⑤ `Controls.interaction.test.ts:'shows placeholder agents…'` · `agentSelection.test.ts` | 로딩 중 빈 목록 또는 placeholder가 전송 선택으로 저장 |
| EP-19 · R-08/VP-08·26 | Orca 최상단 | ① `orcaGroupFirst`(순수) ② 스킬 패널 적용 ③ 플러그인 패널 적용(native 블록을 Orca 뒤로) — **3** | 메뉴 조립마다 | ①② `attachMenuModel.test.ts:'puts the Orcinus orca group first in the skills panel'` ③ `:'…before native plugins for %s'` | Claude/OpenCode 그룹이 Orca 위 |
| EP-20 · R-09/VP-09·27 | 엔진 카드 순서 | ① `agentOrder.ts` `orderAgentEnvironments`(rank = `HARNESS_IDS` 순서) ② `AgentEnvironmentView.tsx` 렌더 목록 — **2** | 렌더마다 | ① `agentOrder.test.ts` ② `AgentEnvironmentView.render.test.ts:'orders engine cards…'` | runtime Claude 카드가 OpenCode 뒤 |
| EP-21 · R-12/VP-12·15·29 | agent 목록 신선도 | ① `agentStore.ts` 첫 사용 시 앱 수명 구독 1회 설치 ② `refresh` 최신 요청만 반영 ③ `useAgents.ts` 화면 구독 제거 ④ `useEngines.ts` 화면 구독 제거 — **4** | push·재조회마다 | ①② `agentStore.test.ts` 3케이스 ③④ `useEngines.test.ts:'shows a runtime card added while the engine page was unmounted'` · `gate:rg -n "subscribeAgents" app/src/renderer/src -g '!*.test.ts' = 0` | 인증 후 카드가 재시작 전까지 안 보인다(T6) |
| EP-22 · R-10/VP-10 | 문서 사본 | ① `auth.md` ② `security.md` §1.10 ③ 가이드 ④ `IPC_CONTRACT.md` ⑤ `GLOSSARY.md` ⑥ ADR-010 ⑦ `decisions/README.md` ⑧ `docs/INDEX.md` ⑨ `adapters.md` ⑩ `rendering.md` ⑪ `design-components.md` ⑫ `ux-domains.md` ⑬ `state.md` ⑭ `generated/inventory.md` — **14** (+ handoff `plan.md`·`INDEX.md` 상태 사본 2) | 커밋 | `gate:node scripts/check-doc-inventory.mjs --check` + verify 문서 대조 | 문서끼리 다른 계약을 말한다 |

- 같은 규칙이 여러 레이어에 있는 경우: wire 연결 상태 union은 `shared/ipc.ts` `ProviderConnectionState`가 정본이고 `contracts/auth.ts`는 별칭한다(`AuthStatus = ProviderGrantStatus` 선례, `contracts/auth.ts:405`). 1.x 판정은 `assertOpenCodeCliVersion` 1벌(EP-09). 기본 에이전트 이름은 `OPENCODE_DEFAULT_AGENTS` 1벌(EP-18). canonical JSON은 `shared/obj.ts` `canonicalJson` 1벌을 신규 코드만 쓴다.
- "다른 게이트가 막는다"를 적은 칸: EP-15 ②의 typecheck(구조) — 측정: `CreateAuthRuntimeDeps`에 필드를 더하지 않는 한 저장 경로를 넘길 자리가 없다. 저장 시도는 ①의 음성 검색이 맡고 양성은 `runtime.test.ts`가 맡는다.
- 선택적 필드 의미: `LoginFreeDefinition.connect` — `undefined` = 무선언(항상 연결, 0248 그대로). `AuthSnapshot.connection` — 무선언 로그인 프리·자격증명은 `undefined`. `ProviderInfo.connection` — 같은 규칙, renderer는 키 존재로만 판단한다. `CreateAuthRuntimeDeps.loginFreeHost` — `undefined`면 connect가 "호스트 확인 능력이 연결되지 않았습니다"로 실패한다(fail-closed, Bootstrap은 EP-08 ③이 강제). `HarnessRuntimeConfig.modelDetails` — `undefined` = 이름·variant 없음(alias = model id).
- 외부 SDK·CLI 경계: OpenCode CLI 출력은 문서화된 machine 형식이 아니다(`--verbose`는 사람이 읽는 pretty JSON). 파서는 v1.18.27 실제 형상을 fixture로 잠그고 해석 실패는 부분 목록 대신 throw다(EP-11).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/ipc.ts` | wire | `ProviderConnectionState` · `ProviderConnectionInfo` · `ProviderInfo.connection?` · `CHANNELS.providerConnect` · `ProviderConnectRequest` | typecheck |
| `shared/protocol.ts` | zod | `ProviderConnectRequestSchema`(revoke와 같은 문자열 규칙) | `providers.test.ts` |
| `shared/obj.ts` | 순수 | `canonicalJson(value): string` — 키 정렬 JSON, 직렬화 불가면 throw | `obj.test.ts` 신규 케이스 |
| `shared/harness.ts` | 상수 | `OPENCODE_DEFAULT_AGENTS = ['build', 'plan'] as const` | — |
| `main/contracts/auth.ts` | 계약 | §10 형상(`connect`·context·상태·cause·`AuthSnapshot.connection`·`AuthRuntime` 4메서드). `LoginFreeConnectionState = ProviderConnectionState` | typecheck · `@ts-expect-error`(능력 케이스) |
| `main/adapters/common/harness-config.ts` | 계약 | `HarnessListedModel`·`HarnessModelDetail`·`HostHarnessPort`·`HarnessRuntimeConfig.modelDetails?` | typecheck |
| `main/adapters/common/types.ts` | 포트 | `SessionAdapter.listProviderModels?(provider, options)` | typecheck |
| **신규** `main/features/auth/login-free-connection.ts` | 상태기계 | `LOGIN_FREE_CONNECT_TIMEOUT_MS = 120_000` · `createLoginFreeConnections({definitions, host?, publish, timeoutMs?, logger?})` → `{has, snapshot, connect, connectAll, value}`. 전이 규칙은 §5 표·AC4~AC6. 메시지 500자 상한, 빈 메시지 = `연결을 확인하지 못했습니다.`, timeout = `연결 확인 시간이 초과되었습니다.` | 순수 — fake run·host·publish·fake timer |
| `main/features/auth/login-free.ts` | 포트 | `alwaysConnectedSnapshot(authId)` export(상수 SSOT) · `createLoginFreePluginAuth(definition, {sender, logger?, connection?})` — `connection` 있으면 snapshot 위임 | `login-free.test.ts` |
| `main/features/auth/runtime.ts` | 조립 | `CreateAuthRuntimeDeps.loginFreeHost?` · connect 선언 정의로 `createLoginFreeConnections` 생성(publish = 기존 `publish`) · `bindLoginFreePlugin`에 connection 연결 · `snapshot`·`connect`(무선언·자격증명·미등록은 throw)·`connectAll`·`connectionValue` | `runtime.test.ts` |
| **신규** `main/app/harness-host.ts` | 조립 | `createHostHarnessPort(registry: Pick<AdapterRegistry,'get'>): HostHarnessPort` | `harness-host.test.ts` |
| `main/app/bootstrap.ts` | 배선 | `createAuthRuntime({…, loginFreeHost: createHostHarnessPort(this.registry)})` · `createRuntimeModelAuthResume({ …, run: () => { void authResume.run(); void auth.connectAll() } })` | 소스 가드 |
| `main/app/runtime-model-startup.ts` | 읽기 | `createRuntimeModelSnapshotReader(auth: Pick<AuthRuntime,'snapshot'>)` → `auth.snapshot(authId)` (호출 형태 `createRuntimeModelSnapshotReader(auth)` 유지 — `no-stray-auth-subscribe.test.ts` SHARED_READER_BUILD) | `runtime-model-startup.test.ts` |
| `main/app/connection-views.ts` | wire | `connectionInfo`가 `snapshot.connection` → `{state, message: message ?? null}`. 없으면 키 없음 | `connection-views.test.ts` |
| `main/app/handlers/providers.ts` | IPC | `handle(CHANNELS.providerConnect, ProviderConnectRequestSchema, 'reject', async (req) => toWire(await auth.connect(req.providerId)))` — 주석의 "연결 버튼은 인증 행위만" 규칙에 connect가 배포 확인만 한다는 문장 추가 | `providers.test.ts` |
| `main/app/deployment/connections.ts` | 배포 계약 | `ConnectionDeploymentDeps.auth: Pick<AuthRuntime,'bind'\|'bindLoginFreePlugin'>` · 주석에 가이드 §4 연결 레시피 링크 | `deployment-wiring.test.ts` |
| `main/app/deployment/harness-runtime.ts` | 배포 계약 | `HarnessConfigApiDeps.auth: Pick<AuthRuntime,'bind'\|'connectionValue'>` · 주석에 로그인 프리 연결 결과 레시피 링크. 기본 배열·factory는 비어 있음 유지 | `deployment-wiring.test.ts` |
| `main/app/deployment/auth-definitions.ts` | 배포 계약 | 주석만 — `connect` 선언 위치·레시피 링크. 배열은 `[]` 유지 | `login-free-deployment.test.ts:339` |
| `main/features/harnesses/common/runtime-config.ts` | 서비스 | augmenter 결과 타입·`compute`에 `ifPresent('modelDetails', …)` | `runtime-config.test.ts` |
| **신규** `main/features/harnesses/common/runtime-listing.ts` | 순수 | `listedModelsOf(value: unknown): HarnessListedModel[] \| undefined` · `runtimeModelsFromListing(listing)` → `{availableModels, modelDetails}` | `runtime-listing.test.ts` |
| `main/adapters/opencode/implementation.ts` | 계약 | `OpenCodeServer.listModels?` · `OpenCodeImplementation.parseRuntimeModels` | typecheck |
| `main/adapters/opencode/v1/server.ts` | 실행 | `assertOpenCodeCliVersion(version)`(start와 공유, 문구 동일) · `listModels(provider, {signal, env?})` · deps `runCli?`(기본 `execFile` 래퍼) · `CLI_TIMEOUT_MS = 60_000` · `CLI_MAX_BUFFER = 16 * 1024 * 1024` · 비정상 종료는 stderr 마지막 비어 있지 않은 줄(300자)을 담은 `OpenCode 모델 목록을 가져오지 못했습니다: …` | `server.test.ts`(`runCli`·`executable`·`readVersion` 주입) |
| **신규** `main/adapters/opencode/v1/model-listing.ts` | 순수 | `assertOpenCodeProviderId(provider)` · `parseOpenCodeModelListing(stdout, provider)` | `model-listing.test.ts` |
| `main/adapters/opencode/v1/adapter.ts` | 위임 | `listProviderModels(provider, options)` → `this.servers.listModels`(없으면 throw) | `adapter.test.ts` |
| `main/adapters/opencode/v1/catalog.ts` | 행 | 기본 primary를 `OPENCODE_DEFAULT_AGENTS`로 · `models: entry.source === 'runtime' ? entry.models : parseOpenCodeModels(config)` | `catalog.test.ts` |
| `main/adapters/opencode/v1/settings.ts` | 파서·로더 | `parseOpenCodeRuntimeModels(config)`(행 생성 helper를 `parseOpenCodeModels`와 공유) · 로더 ENOENT → `{settings:{}}` | `settings.test.ts` |
| `main/adapters/opencode/v1/index.ts`·`adapters/opencode/index.ts` | export | `parseRuntimeModels` 매핑·`parseOpenCodeRuntimeModels` export | typecheck |
| `main/app/harnesses/opencode/module.ts` | 조립 | `parseRuntimeModels: parseOpenCodeRuntimeModels` | `registry.test.ts` |
| `main/app/chat-turn/resolve-turn.ts` | 턴 | merged `AgentEnvironment`를 보존해 선택 행 그대로 `adapter.catalog`에 넘긴다(`toAgentEnvironments` 재조립 제거) | `resolve-turn.runtime-catalog.test.ts` |
| `preload/index.ts` · 타입 선언 | 브리지 | `provider.connect(req)` | `preload/index.test.ts` |
| `renderer/src/shared/api/ipc.ts` | api | `providerApi.connect` | `useProviders.test.ts` |
| `renderer/src/shared/stores/agentStore.ts` | store | `createAgentStore({list, subscribe})` factory + 모듈 인스턴스. 첫 `refresh`/`ensureLoaded`에서 구독 1회 설치(해제 없음). `refresh`는 단조 seq로 최신 응답만 set. `subscribeAgents` 제거 | `agentStore.test.ts` |
| `renderer/src/shared/hooks/useAgents.ts` · `features/engine/common/hooks/useEngines.ts` | hook | `useEffect(() => subscribeAgents(), [])` 제거 | `useEngines.test.ts` |
| `renderer/.../skills/hooks/useProviders.ts` | hook | `connect(providerId)` — 실패는 `reportError` | 신규 `useProviders.test.ts` |
| `renderer/.../skills/lib/providerRows.ts` | 순수 | 로그인 프리 + `connection` → statusKey(`status.none`·`status.checking`·`status.valid`·`status.failed`) · `connectionTone(provider)` | `providerRows.test.ts` |
| `renderer/.../customize/providerAuthActionModel.ts` | 순수 | `'connect'` 종류 + `connectActionLabel`(idle → `connect`, 그 외 → `reconnect`) | `ProviderAuthActions.test.ts` |
| `renderer/.../customize/ProviderAuthActions.tsx` | UI | `'connect'` → `Button variant="primary" size="small" busy={checking}` `data-action="provider-connect"` · `onConnect` prop | `.render.test.ts` |
| `renderer/.../customize/ProviderDetail.tsx` | UI | Dot tone = `connectionTone` · failed 사유 `text-bad` · `onConnect` 전달 | `ProviderDetail.render.test.ts` |
| `renderer/.../customize/ExtensionsCatalogView.tsx` | 조립 | `onConnect={() => void providers.connect(selectedProvider.id)}` | `ExtensionsCatalogView.interaction.test.ts` |
| `renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | `skills.provider.status.checking`(확인 중…/Checking…) · `status.failed`(연결 실패/Connection failed) · `provider.reconnect`(다시 연결/Reconnect). `provider.connect`는 재사용 | `resources.test.ts`(ko·en 패리티) |
| `renderer/.../opencode/composer/agentSelection.ts` | 순수 | `agentPlaceholder(providerKey, environments)` → 행 `agents` 또는 `OPENCODE_DEFAULT_AGENTS` | `agentSelection.test.ts` |
| `renderer/.../opencode/composer/Controls.tsx` | UI | `OpenCodeModeControl`이 `agents`·`providerKey`로 placeholder를 만들어 넘긴다 · `OpenCodeAgentControl({placeholder})` — 옵션 = `agents ?? placeholder`, 표시값 = `resolved` 또는(authoritative 아님) placeholder 첫 이름, 저장 effect는 `resolved`만 | `Controls.interaction.test.ts`·`Module.integration.test.ts` |
| `renderer/.../chat/lib/attachMenuModel.ts` | 순수 | `orcaGroupFirst(items)` — `skills:orca`/`plugins:orca` heading 블록을 맨 앞으로. 플러그인 패널 native 블록은 Orca 뒤에 붙인다 | `attachMenuModel.test.ts` |
| **신규** `renderer/.../engine/common/lib/agentOrder.ts` · `AgentEnvironmentView.tsx` | 순수·UI | `orderAgentEnvironments(agents)` · 렌더 전 정렬 | `agentOrder.test.ts`·`.render.test.ts` |

### 테스트 가능성

- electron 의존과 분리한 **별도 순수 파일**: `login-free-connection.ts`(electron·fs import 0) · `model-listing.ts` · `runtime-listing.ts` · `agentOrder.ts` · `agentSelection.ts`. `server.ts`는 `child_process`를 물므로 `runCli`·`executable`·`readVersion` 주입으로만 테스트한다(기존 seam 선례 `server.test.ts:78-90`).
- 기존 메커니즘 재사용 적합성: `AuthChange` 4갈래는 cause와 `credentialChanged`만 보므로 새 cause 3종이 그대로 흐른다(`runtime-model-startup.ts:91-111`). runtime 카탈로그의 revision 비교가 D-011 "같으면 교체 없음"을 실행 무효화까지 보장한다(`runtime-catalog.ts:103`).
- 순서 관측: 리스너 설치 → `connectAll`은 `run` 콜백 안이며 소스 가드(양성 + 감도)와 `runtime-model-startup.test.ts:220` 형식으로 잠근다.
- 가상 배포(`opencode-connection-deployment.test.ts`) 조립: 실제 `createAuthRuntime`(fake persistence·vault — 기존 `login-free-deployment.test.ts` 선례) + 실제 `createHarnessRuntimeConfigService`·`createRuntimeModelCatalog`·`createRuntimeModelAuthChangeHandler` + 실제 `registerMiscHandlers`(`misc.runtime-catalog.test.ts` 선례) + fake `HostHarnessPort`. production 조립이 주입하는 의존성(`loginFreeHost`·augmenter·`parseHarnessRuntimeModels`)을 빼지 않는다.

## 12. End-to-end 영향

### producer → consumer

```text
배포 connect.run → LoginFreeConnections(state·value) → AuthSnapshot/AuthChange
  → connectionInfo(wire connection) → renderer 행·버튼
  → handler(push·syncPlugins·invalidate·reconcile) → RuntimeModelCatalog → agent:list → agentStore → 엔진 화면·Composer
  → augmenter(connectionValue) → HarnessRuntimeConfig(availableModels·modelDetails) → 파서 → 행 → 턴
```

- producer 기준: 연결 상태·결과의 정본은 `LoginFreeConnections` 한 곳이다. 카탈로그 행은 그 결과를 augmenter가 변환한 파생값이다.
- consumer 파생 규칙: renderer는 `connection.state`로 라벨·tone·버튼을, `status`로 도구 비활성 안내를 정한다(`ProviderDetail.tsx:145`).
- 합성값의 정본 우회: 없음 — 카드 모델은 연결 결과를 다시 읽지 않고 `HarnessRuntimeConfig` cache만 읽는다(턴은 `cached()`만, `resolve-turn.ts:263-266`).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `createRuntimeModelAuthChangeHandler` | 새 cause 3종 — push·reconcile은 항상, sync·invalidate는 credentialChanged일 때만 | AC4·AC8 |
| `gate.noteLoginCommit` | `credential-committed`만 기록 — 새 cause 무시 | AC17 |
| `authResume.onGateChange` | 게이트 id만 반응 | AC17 |
| `createPluginBinding.sync` | connect 선언 id의 도구는 `valid`일 때만 등록 | AC4·AC17 |
| `RuntimeModelCatalogBridge.attach` | 부팅 attach 때 idle snapshot → 행 없음 | AC8 |
| `OpenCodeWarmup` | 같은 `isInstalled` 사용 — 변경 없음 | AC9 |
| `agent:list` 소비(엔진·Composer·설정 모달) | store 앱 수명 구독으로 push마다 재조회 | AC22 |
| `AuthRuntime` 전체 fake 2곳 | 새 메서드 4개 추가 | typecheck |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `createAuthRuntime`이 connect 선언 정의마다 idle 상태를 만든다. 부팅 `run` 콜백이 `connectAll()`을 부른다(await 안 함).
- 취소/중단: 사용자 취소 없음. 실행마다 AbortController — timeout(120초) 때 abort하고 결과를 기다리지 않는다(race). CLI는 호출자 signal 또는 pool `close()`(앱 종료)에 죽는다.
- 종료/quit: `registry.close()` → `OpenCodeServerPool.close()` → `shutdown.abort()`가 진행 중 `models` 실행을 끝낸다. 연결 상태는 메모리라 정리할 디스크 상태가 없다.
- retry/timeout/partial failure: 재시도 = 사용자 `다시 연결`. 부분 결과 없음 — 파서 실패는 throw → failed.
- cleanup/rollback: 실패 시 결과·직렬화본을 지우고 revision을 올려 카드·cache를 무효화한다.
- **다중 저장소 쓰기**: 해당 없음 — 연결 상태·결과·카탈로그는 프로세스 메모리 한 곳이다(D-008). **문서 산출물 사본**: 이 `plan.md` 메타 상태와 `docs/handoff/INDEX.md` 행 — §10 EP-22에 둘 다 지점으로 둔다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 연결 1회당 `opencode --version` 0~1회(실행 파일 identity cache, `server.ts:84-93`) + `opencode models` 1회. 부팅 = connect 선언 대상 수 × 1. 기본 배포 0.
- 새 출력 상한: CLI stdout `maxBuffer` 16MiB. v1.18.27 모델 객체 pretty JSON은 모델당 수 KB이고 provider당 수백 모델이면 MB 단위 미만이다. 초과는 throw(부분 목록 금지).
- 메모리: 연결 결과(id·name·variants)와 canonical JSON 1벌을 대상별로 1개만 든다.
- agent store: push 1회 = `agent:list` 1회(화면 구독 중복 제거로 마운트 2곳일 때 2회 → 1회). 이전 응답은 버린다.
- 최적화로 잃는 부수 효과: 같은 결과 재연결에서 revision을 올리지 않으므로 runtime cache·세션이 재spawn되지 않는다 — 의도(D-011). 회귀 테스트는 VP-14 '같은 결과의 재연결은 augmenter를 다시 부르지 않는다'.

## 15. 외부 구현 포트 / 문서 계약

- 외부(배포)가 구현하는 것: `LoginFreeDefinition.connect.run` · `RUNTIME_MODEL_CONTRIBUTIONS` 항목 · config API augmenter · `harnessRows` 행.
- 구현 문서: `docs/guides/closed-network-extensions.md` §4 `### 로그인 프리 연결 Plugin 레시피`(신규) + §3 단계표 6-a 갱신.
- **shape 검증**: 아래 예제를 `opencode-connection-deployment.test.ts`가 그대로 옮겨 실제 타입으로 컴파일한다(0207 가이드 예제 선례 `deployment-wiring.test.ts:627`·`:645`).
- **semantics 검증**: 같은 테스트가 성공(초록·카드·턴 모델)과 실패(미설치 → 빨강·카드 없음)를 실행한다.

```ts
// app/deployment/auth-definitions.ts
export const OPENCODE_LLM = {
  id: 'opencode-llm',
  label: '사내 OpenCode LLM',
  connect: {
    async run({ host, signal }) {
      if (!(await host.installed('opencode')).installed) throw new Error('OpenCode가 설치되어 있지 않습니다.')
      const models = await host.listModels('opencode', 'corp', { signal })
      if (models.length === 0) throw new Error('corp provider에 사용할 수 있는 모델이 없습니다.')
      return models
    }
  }
} satisfies LoginFreeDefinition
export const LOGIN_FREE_DEFINITIONS: readonly LoginFreeDefinition[] = [OPENCODE_LLM]

// app/deployment/harness-runtime.ts
export const OPENCODE_CORP_KEY = 'opencode-corp'
export const RUNTIME_MODEL_CONTRIBUTIONS: readonly RuntimeModelContribution[] = [
  { authId: OPENCODE_LLM.id, key: OPENCODE_CORP_KEY, harnessId: 'opencode', modelProviderId: 'corp' }
]
export function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  return {
    [OPENCODE_CORP_KEY]: {
      async resolve() {
        const listing = listedModelsOf(deps.auth.connectionValue(OPENCODE_LLM.id))
        if (!listing?.length) throw new Error('사내 OpenCode LLM이 연결되지 않았습니다.')
        return { runtimeEnv: {}, ...runtimeModelsFromListing(listing) }
      }
    }
  }
}

// app/deployment/connections.ts — createConnectionSources 본문
return [
  ...gateRows(deps.gateMembers),
  ...harnessRows([{
    auth: deps.auth.bindLoginFreePlugin(OPENCODE_LLM.id),
    harnessModelProviderKey: OPENCODE_CORP_KEY,
    catalog: { icon: 'memory', title: { ko: '사내 OpenCode LLM', en: 'Corporate OpenCode LLM' } }
  }]),
  ...pluginRows(deps.plugins)
]
```

- 가이드에 함께 적는 의미: 결과는 JSON 직렬화 가능해야 하고 비밀을 담지 않는다(메모리·로그 안전) · 같은 결과면 교체되지 않는다 · 재시작마다 다시 실행된다 · 폐쇄망 환경값(프록시·`OPENCODE_DISABLE_MODELS_FETCH` 등)은 `listModels`의 `env`로 넘긴다 · 연결 해제는 없다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 로그인 프리는 상태 전이가 없다 | 0248 D-008 · ADR-006 · `auth.md` §4.1 | §3 D-002·D-005·D-011, §10 EP-01·EP-02 | **변경(사용자 요구 T1)** — connect 선언 대상만. 무선언은 유지(AC17). ADR-010이 근거 |
| 로그인 프리는 vault·게이트·resume에 들어가지 않는다 | 0248 D-003·D-016 | D-003, EP-15 | 유지 |
| 로그인 프리 요청 정책(헤더 통과·origin 고정) | 0248 D-007 | — | 유지(AC17) |
| 연결 버튼은 인증 행위만 하고 Harness resolve를 부르지 않는다 | 0188 · `handlers/providers.ts:52-54` | D-013, §11 providers 행 | 유지 — connect는 배포 확인만, resolve는 `AuthChange` 경유 |
| runtime 카탈로그: 별도 영속 상태 없음 · fail-closed · read-only | 0198 D-005·D-006 | D-008·D-010 | 유지 |
| `availableModels: string[]` 이름 | 0198 D-001 | D-014 | 유지 — `modelDetails`는 선택 추가 |
| `AuthChange` 구독 1파일·reader 1벌·주입 형태 | 0198 D-010 · 0202 D4 · `no-stray-auth-subscribe.test.ts` | §11 runtime-model-startup·bootstrap 행 | 유지 — 메서드 이름 `snapshot`은 `snapshotOf:` 주입 규칙과 겹치지 않는다 |
| 기본 배포 선언 비어 있음 | 0248 D-011 · 0237 D-030 | D-001, EP-16 | 유지 |
| Composer 그룹 순서는 바꾸지 않는다 | 0286 D-012 · `rendering.md:231` | D-017 | **변경(사용자 요구 T1)** |
| 에이전트 loading/error 라벨 | 0287 §5 상태표 | D-016 | **변경(사용자 요구 T1)** — placeholder가 있으면 이름을 보인다 |
| authoritative 첫 에이전트 저장 · 고정 이름 추정 금지 | 0287 D-002 | D-016, EP-18 ⑤ | 유지 — placeholder는 저장·전송하지 않는다 |
| 엔진 카탈로그 자동 갱신 · 새로고침 버튼 없음 | 0262 AC31 | D-021 | 유지(강화) |
| `child_process` 허용 파일 · 공용 호스트 실행기 금지 | 0248 D-009 · `security.md` §1.10 | D-007, EP-10 | 유지 — `server.ts` 안 고정 질의 2종이며 임의 인자 실행기가 아니다 |
| 하네스 형제 import 금지 | `scripts/harness-boundary.mjs` | §11 파일 배치 | 유지 — OpenCode 전용은 `opencode/` 아래, 공통은 하네스 이름을 import하지 않는다 |
| 0290 `/simplify` READY — `AgentEnvironmentView.tsx`·`bootstrap.ts`·`opencode/v1/adapter.ts`·`shared/harness.ts` 수정 예정 | `0290 plan` WP-4·WP-7·WP-9 | §17 | 유지 — 순서 리스크로 기록 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| OpenCode CLI 출력 형식이 버전마다 바뀐다(`--verbose`는 machine 계약이 아니다) | 파서 실패는 throw → 빨강 + 사유. v1.18.27 형상을 fixture로 잠근다. JSON 없는 줄은 id만으로 동작 |
| 폐쇄망 `opencode models`가 models.dev 대기로 느리다 | CLI 60초·연결 120초 상한 · 배포가 `env`로 플래그 전달(§15) |
| 로딩 중 전송은 placeholder `build`가 아니라 OpenCode `default_agent`로 돈다 | placeholder는 표시만(0287 D-002 유지). 기본 설정에서는 `build`가 default라 같다. 차이는 사용자 config가 `default_agent`를 바꾼 경우뿐 |
| 연결 해제가 없어 카드를 지울 수 없다 | D-012 사용자 결정. 후속 handoff 후보 |
| 0290과 같은 파일 동시 수정 | 0290이 먼저 들어가면 rebase로 `AgentEnvironmentView.tsx`(로고 위임)·`bootstrap.ts`·`shared/harness.ts`(`shortLabel`) 충돌을 푼다. 계약 충돌은 없다 |
| agent store 앱 수명 구독이 push마다 `agent:list`를 부른다 | 화면 구독 2벌이 1벌이 되어 마운트 중 비용은 줄고, 비마운트 중 push 1회당 1회가 는다. `agent:list`는 network 0(augmenter는 cache) |

- 되돌리기 어려운 결정: D-020 이름·wire·채널. 디스크 포맷은 만들지 않는다(D-008).
- 신규 의존성: 없음 — `node:child_process`(기존 허용 파일), zod·zustand(채택).

## 18. 영향 받는 파일 / 문서

- 코드: §11 표 전부.
- 테스트(신규): `features/auth/login-free-connection.test.ts` · `app/harness-host.test.ts` · `adapters/opencode/v1/model-listing.test.ts` · `features/harnesses/common/runtime-listing.test.ts` · `app/deployment/opencode-connection-deployment.test.ts` · `renderer/src/shared/stores/agentStore.test.ts` · `renderer/.../skills/hooks/useProviders.test.ts` · `renderer/.../engine/common/lib/agentOrder.test.ts`.
- 테스트(갱신): `login-free.test.ts` · `runtime.test.ts` · `runtime-model-startup.test.ts` · `runtime-catalog.test.ts` · `runtime-config.test.ts` · `connection-views.test.ts` · `providers.test.ts` · `deployment-wiring.test.ts` · `server.test.ts` · `adapter.test.ts` · `catalog.test.ts` · `opencode/v1/settings.test.ts` · `app/harnesses/registry.test.ts` · `misc.runtime-catalog.test.ts` · `resolve-turn.runtime-catalog.test.ts` · `auth-resume.test.ts`·`connection-views.test.ts`(fake) · `preload/index.test.ts` · `providerRows.test.ts` · `ProviderAuthActions.test.ts`·`.render.test.ts` · `ProviderDetail.render.test.ts` · `CustomizeList.render.test.ts` · `ExtensionsCatalogView.interaction.test.ts` · `Controls.interaction.test.ts` · `Module.integration.test.ts` · `agentSelection.test.ts` · `attachMenuModel.test.ts` · `Composer.native-menu.test.ts` · `AgentEnvironmentView.render.test.ts` · `useEngines.test.ts` · `shared/obj.test.ts`.
- 문서: `docs/arch/backend/auth.md`(§1·§2·§3 모듈 표·§4.1·§6.1·§7·§9·§10·§11) · `docs/arch/backend/security.md` §1.10 · `docs/arch/backend/adapters.md`(OpenCode 모델 목록 질의) · `docs/guides/closed-network-extensions.md`(§0 라우팅·§3 단계 6-a·§4 연결 레시피) · `docs/IPC_CONTRACT.md`(`orca:provider:connect` 행·`provider:list` `connection`·507행 "6채널") · `docs/GLOSSARY.md`(로그인 프리·PluginAuth 행) · **신규** `docs/decisions/010-login-free-host-connection.md` + `docs/decisions/README.md` 목록 + `docs/INDEX.md` 라우팅 · `docs/arch/frontend/rendering.md:231`("Composer 그룹의 기존 순서는 유지한다" → Orca 최상단) · `design-components.md`(AttachMenu·AgentEnvironmentView·ProviderDetail·ProviderAuthActions 행) · `ux-domains.md`(`+` 메뉴·엔진 카드 순서) · `docs/arch/frontend/state.md`(agent store 구독 소유) · `docs/generated/inventory.md`(재생성).

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드 · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 환경 제약: 이 세션 저장소에 `node_modules`가 없다 — `cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall Electron ABI 실패는 무시). DB 로드 스위트는 대상이 아니다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트(ABI 중립): `cd app && ./node_modules/.bin/vitest run src/main/features/auth src/main/features/harnesses src/main/app/deployment src/main/app/runtime-model-startup.test.ts src/main/app/no-stray-auth-subscribe.test.ts src/main/app/harness-host.test.ts src/main/app/connection-views.test.ts src/main/app/handlers/providers.test.ts src/main/app/handlers/misc.runtime-catalog.test.ts src/main/app/chat-turn/resolve-turn.runtime-catalog.test.ts src/main/app/harnesses/registry.test.ts src/main/adapters/opencode/v1 src/preload src/shared src/renderer/src/shared/stores src/renderer/src/features/skills src/renderer/src/features/engine src/renderer/src/features/chat/lib src/renderer/src/features/chat/harnesses/opencode/composer src/renderer/src/features/chat/harnesses/common/composer`.
- 문서: `cd app && node scripts/check-doc-inventory.mjs && node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC24): Windows · 실제 OpenCode 1.x · 로컬 임시 배포(§15 예제, **커밋 금지**) — ① 플러그인 탭 `연결` → `확인 중…` → `연결됨`(초록) → 엔진&모델 읽기 전용 카드(Claude 카드 뒤) → 새 OpenCode 채팅에서 카드 모델로 응답 ② 실행 파일 경로를 틀리게 → `연결 실패`(빨강) + 사유 ③ provider id를 미등록 값으로 → 빨강 + `Provider not found` ④ 재시작 → `확인 중…` → 결과 ⑤ white·dark 두 테마의 점·버튼 ⑥ 로딩 중 Composer 에이전트 메뉴 `build`·`plan` + 스피너 ⑦ `+` 메뉴 두 패널의 Orca 최상단 ⑧ 다른 화면에서 Composer를 연 뒤 플러그인 탭에서 연결 → 엔진&모델에 카드(T6 재현 경로).

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — T1~T6 → D-001~D-021, 다른 handoff 변경 3건은 갱신 메모·§16.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1·§5 상태표.
- [x] 조건절·이유절을 재해석하지 않았다 — §2 원문 인용. "카탈로그 생성 및 저장"은 T5 "인메모리+읽기전용"으로 사용자가 직접 좁혔다.
- [x] Product/UX 핵심 동작이 AC와 Technical Design에 연결된다 — §7 경로 칸 ↔ §9 TO-BE ↔ §11.
- [x] AS-IS와 TO-BE가 같은 비교 축으로 있다 — §9 Delta 9행.
- [x] Delta 각 행이 파일·AC로 이어진다 — Delta 표 오른쪽 칸.
- [x] 사라진 책임: 화면별 agent 구독(제거, D-021) · runtime 행 모델 재계산(분기 대체) · provenance 재조립(제거).
- [x] 수치·전칭·외부 규약·앵커·기존 테스트를 실측했다 — §8 전수 조사·검산 · §7 주의사항 케이스 줄 번호.
- [x] 각 AC가 행동 단언·검증 수단·프로덕션 경로를 가진다 — AC1~AC24.
- [x] Baseline V — 상속 V 없음.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair — VP-01~VP-29.
- [x] INHERITED node 없음(Baseline) — 다른 handoff 동작은 R-06 회귀 노드로 닫는다.
- [x] 각 pair의 경로·§10 자리·oracle 좌표가 있고 적대 증거는 구조 proxy·배선·형제 슬롯·분기 pair만 선택했다(VP-03·04·07·13·16·19·20·23·24·26·27·29).
- [x] 운영 gate 열거 — §7-A 표, 관련 없는 기존 실패는 환경으로 분리.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC24는 실제 CLI·OS·테마뿐.
- [x] semantic 목표를 structural proxy만으로 검증하지 않는다 — 소스 가드(EP-14·EP-08 ③)는 감도 케이스 + 가상 배포 행동 테스트와 짝.
- [x] "X가 쓰인다" 장치는 X를 지우면 실패한다 — EP-14 가드 감도, EP-21 음성 검색은 `useEngines.test.ts` 양성 시나리오와 짝, EP-15 음성은 `runtime.test.ts` 양성과 짝. 자리 맞바꿈: VP-24(라벨·tone)·VP-26(패널 순서).
- [x] 정책 파라미터 단위: timeout ms(120_000·60_000)·바이트(16MiB)·메시지 문자 수(500·300). 상태는 단일 union(`ProviderConnectionState`) — 불가능 조합 없음.
- [x] 참조 구현 coverage: 상태 union 4종 전부 AC1·AC2·AC3 표에 있다. cause union 3종 전부 AC4~AC6.
- [x] 신규 모듈마다 레이어·강제 지점·seam — §9 책임 표 · §10 · §11.
- [x] producer/consumer · 등록자/기존 소비자 · 외부 포트 문서까지 닫힘 — §12 · §15.
- [x] worst-case: §14 CLI 상한·요청 수. one-way door: D-020.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다 — `npm test` 미사용, vitest 직접.
- [x] 본문 완성 후 교차검증 — §3 갱신 메모 `ACTIVE 결정 ↔ AC` 충돌 0. 같은 대상 교차: 상태 4종 문구(§5·AC2·§11 i18n) 일치 · timeout(§5·AC6·§11·§13) 120초 일치 · CLI 인자(§2·AC10·EP-10·§15) 일치.
- [x] 산출물 문장 규칙 — 판정 먼저, 표 위주, Part I은 관측·Part II는 경로.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-001~D-021 · §11 파일 표 전부를 그대로 구현했다. 구현 주체는 사용자 요청(`/handoff-impl 0291 구현해줘`)으로 Claude가 맡았다.
- 이견 / 현실성 문제: 없음 — PLAN_GAP 0. 아래 「설계 대비 명시적 차이」는 전부 구현 세부(테스트 위치·이름 충돌 회피)다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-06·13·21 | EP-01 snapshot | 3 | 3/3 | ① `login-free-connection.test.ts:'idle → checking → connected 로 전이하고 결과를 보관한다'` ② `login-free.test.ts:'connect 선언 포트는 연결 상태를, 무선언 포트는 상수를 돌려준다'` ③ `login-free.test.ts:'snapshot은 두 체계와 미등록 id를 같은 형상으로 읽는다'` | 무선언 상수 vs 선언 idle(`none`)·connected(`valid`, rev 1) | 없음 |
| VP-13·21 | EP-02 cause·credentialChanged | 3 | 3/3 | `login-free-connection.test.ts` 성공·같은 결과·다른 결과·실패 케이스의 change 배열 exact | started/false · succeeded/true · verified/false · failed/이전 valid | 없음 |
| VP-14·16 | EP-03 reader | 3 | 3/3 | ① `runtime-model-startup.test.ts:'reads login-free and credential snapshots through auth.snapshot on every call'` ② `no-stray-auth-subscribe.test.ts`(기존, green) ③ `opencode-connection-deployment.test.ts:'부팅 직후 확인 전에는 카드가 없고 확인이 끝나면 생긴다'` | fake `bind`는 none, `snapshot`은 connected — 둘이 구별된다 | 없음 |
| VP-02·14·19·28 | EP-04 결과 → config | 6 | 6/6 | ①② `login-free-connection.test.ts:'connectionValue는 connected일 때만 결과를 준다'` ③ `deployment-wiring.test.ts:'config API deps 로는 login/revoke/resume/subscribe 에 도달할 수 없다'`(갱신 — `connectionValue` 허용·`connect` `@ts-expect-error`) ④ `runtime-config.test.ts:'passes augmenter modelDetails through to the cached config'` ⑤⑥ `runtime-listing.test.ts` 3케이스 | 이름 `A 모델`·variant `high`(기본값 없음과 구별) | 없음 |
| VP-02·19·23 | EP-05 OpenCode 행 | 6 | 6/6 | ① `settings.test.ts:'builds OpenCode runtime rows from availableModels and modelDetails'` ②~⑥ `registry.test.ts:'parses opencode runtime configs with the OpenCode parser'`(Claude 파서 spy 호출 0) | `not-qualified` 항목 제외·alias `B 모델` | 없음 |
| VP-03·23 | EP-06 runtime 모델 보존 | 3 | 3/3 | ① `catalog.test.ts:'keeps runtime entry models and still lists primary agents'` ② `resolve-turn.runtime-catalog.test.ts:'OpenCode runtime key runs the selected runtime model with host settings'` ③ `misc.runtime-catalog.test.ts:'agent:list keeps OpenCode runtime models and primary agents'` | settings `{}`라 재계산이면 모델 0 | 없음 |
| VP-03·23 | EP-07 settings 부재 | 1 | 1/1 | `settings.test.ts:'treats a missing settings file as an empty config'` + `opencode-connection-deployment.test.ts:'연결 성공은…'`의 `reportError` 호출 0 | 부재 → `{}`, 깨진 JSON·디렉터리 → throw | 없음 |
| VP-05·17 | EP-08 호스트 능력 | 8 | 8/8 | ①② `login-free.test.ts:'connect 실행 context는 signal과 주입한 host만 갖는다'` ③ `opencode-connection-deployment.test.ts:'createAuthRuntime 호출은 서버 시작과 같은 호스트 능력을 넘긴다'` ④⑤ `harness-host.test.ts` 2케이스 ⑥⑦ `adapter.list-models.test.ts:'listProviderModels delegates to the server pool'` ⑧ `server.list-models.test.ts:'listModels runs the models command with the server executable'` | host 객체 identity·인자 `{signal, env:{A:'1'}}` | 없음 |
| VP-05 | EP-09 1.x 판정 공유 | 2 | 2/2 | `server.list-models.test.ts:'listModels rejects unsupported versions and missing executables like start'`(같은 pool에서 `acquire`도 같은 문구) + 기존 `server.test.ts` 버전 케이스 | `2.0.0` → 두 경로 같은 메시지, CLI 실행 0 | 없음 |
| VP-05·17 | EP-10 CLI 인자·환경·한계 | 4 | 4/4 | ①②③ `server.list-models.test.ts:'listModels runs the models command…'` ④ `:'listModels aborts on caller signal and pool close'` | argv exact·cwd 홈·env 병합·60s·16MiB·signal 두 축 | 없음 |
| VP-22 | EP-11 파서·id 검사 | 2 | 2/2 | `model-listing.test.ts` 6케이스 + `server.list-models.test.ts:'rejects provider id %j without running'` | disabled variant 제외·다른 provider 제외·깨진 블록 throw | 없음 |
| VP-01·18·24 | EP-12 wire connection | 7 | 7/7 | ② `connection-views.test.ts:'carries connection only for connect-declared login-free rows'` ③④ `providerRows.test.ts:'maps each host connection state to its label and tone'` · `ProviderAuthActions.test.ts:'offers connect, reconnect and busy for connect-declared rows'` ⑤⑥ `ProviderDetail.render.test.ts:'colors the connection dot and shows the failure reason'` ⑦ `CustomizeList.render.test.ts:'shows the host connection state of login-free rows — %s'` ① typecheck만(타입 선언) | 4상태별 라벨·tone 모두 서로 다름 | ① 타입 선언 자리 — 직접 oracle은 ②가 운반 값을 관측 |
| VP-01·18 | EP-13 연결 요청 경로 | 7 | 7/7 | ①③ `providers.test.ts:'provider 채널 전수를 등록한다'`·`:'등록 집합이 CHANNELS 의 provider 도메인 전수와 일치한다'` ②③ `:'connect는 최종 연결 상태를 돌려준다'`(빈 id reject) ④⑤ `preload/index.test.ts:'carries the login-free connect request and its final state through the actual preload'` ⑥ `useProviders.test.ts:'connect sends the provider id and reports a rejected request'` ⑦ `providerAuthWiring.render.test.ts`(ProviderDetail→Actions `onConnect` 전달 + ExtensionsCatalogView→`providers.connect('jira-dc')`) | id `opencode-llm`·`jira-dc` | 없음 |
| VP-04·20 | EP-14 부팅 재확인 | 2 | 2/2 | ① `opencode-connection-deployment.test.ts:'Bootstrap run 콜백이 리스너 설치 뒤 connectAll을 부른다'` + 감도 `:'가드는 누락·빈 함수·주석·문자열을 배선으로 세지 않는다'` ② `login-free-connection.test.ts:'connectAll 은 선언 대상 전부를 병렬로 확인하고 실패를 흡수한다'` | — | 없음 |
| VP-13 | EP-15 디스크 0 | 2 | 2/2 | ① `gate:rg Q8 = 0`(재실행 0줄) + `login-free-connection.test.ts:'저장 포트를 갖지 않는다…'` + 양성 `login-free.test.ts:'연결 경로는 디스크를 쓰지 않는다…'`(vault raw 0·grant `{}`·재생성 runtime idle) ② typecheck(구조) | — | ② 구조 — §10이 typecheck로 지정 |
| VP-06·10 | EP-16 기본 배포 비어 있음 | 4 | 4/4 | `login-free-deployment.test.ts:339` · `deployment-wiring.test.ts:528`·`:537`·`:552`(기존, 무수정 green) | 배열·factory 변경 0 | 없음 |
| VP-02·20 | EP-17 배포 능력 타입 | 2 | 2/2 | ① `opencode-connection-deployment.test.ts` 레시피 `connectionRows(deps: ConnectionDeploymentDeps)`가 `bindLoginFreePlugin` 사용 + `connections.test.ts` ② `deployment-wiring.test.ts` 능력 케이스 | — | 없음 |
| VP-07·25 | EP-18 placeholder | 5 | 5/5 | ①② `catalog.test.ts:6`·`:'keeps runtime entry models…'`(agents build·plan) ③ `Module.integration.test.ts:'fills agents from the provider catalog while the runtime list loads and overrides it on arrival'` ④⑤ `Controls.interaction.test.ts:'shows placeholder agents with the loading spinner without storing them'` · `agentSelection.test.ts:'uses provider catalog agents, then the shared defaults…'` | 행 agents `corp-build`(기본 build와 구별) | 없음 |
| VP-08·26 | EP-19 Orca 최상단 | 3 | 3/3 | ① `attachMenuModel.test.ts:'puts the Orcinus orca group first in the skills panel'` ② `:'merges groups that share a title…'`(Orca 먼저로 대체) ③ `:'puts the Orcinus orca group before native plugins for %s'` + `Composer.native-menu.test.ts:'shows all source groups directly for %s … — puts the Orcinus orca group first in both panels'` | — | 없음 |
| VP-09·27 | EP-20 카드 순서 | 2 | 2/2 | ① `agentOrder.test.ts` ② `AgentEnvironmentView.render.test.ts:'orders engine cards Claude, OpenCode, then others'` | legacy가 문자열 정렬이면 opencode 앞 | 없음 |
| VP-12·15·29 | EP-21 agent 신선도 | 4 | 4/4 | ①② `agentStore.test.ts` 3케이스 ③④ `useEngines.test.ts:'shows a runtime card added while the engine page was unmounted'` + `gate:rg subscribeAgents = 0`(재실행 0줄) | — | 없음 |
| VP-10 | EP-22 문서 사본 | 14 | 14/14 | `gate:node scripts/check-doc-inventory.mjs --check` green(채널 116) + diff: auth.md·security.md §1.10·adapters.md·가이드(§0 행·§3 6-a·§4 연결 레시피)·IPC_CONTRACT(신규 행·`provider:list`·"6채널" 제거)·GLOSSARY 34·35·ADR-010·decisions/README·docs/INDEX·rendering.md·design-components.md·ux-domains.md·state.md·generated/inventory.md | — | handoff 사본 2(plan 메타·INDEX)도 이번 커밋에서 갱신 |

- 합계: §10 자리 89 / 닫은 자리 89. 자리 검색 Q4·Q6·Q7·Q8을 재실행해 목록과 차집합 0(Q4 hit 파일 8개 전부 EP-08 목록의 자리).
- §10 자리 목록 밖에서 본 운반 자리: ⓐ `shared/errors/reportSites.registry.test.ts` — 새 renderer 오류 보고 자리(`useProviders.connect` catch)를 등록부에 추가 ⓑ `bootstrap.harness.test.ts`·`bootstrap.opencode-warmup.test.ts`의 `AuthRuntime` 부분 fake에 `snapshot`·`connectAll` 추가 ⓒ `bootstrap.artifacts.test.ts`의 `.publish(` 스캔이 상태기계 의존 `publish`를 artifact 발행으로 오인해 의존 이름을 `notify`로 바꿨다.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `CustomizeList.render.test.ts:'shows the host connection state…'` · `ProviderDetail.render.test.ts:'colors the connection dot…'` · `providerAuthWiring.render.test.ts`(ExtensionsCatalogView→connect) | not selected |
| VP-02 | REQUIRED | SELF_PASS | `opencode-connection-deployment.test.ts:'연결 성공은 초록 행·읽기 전용 OpenCode 카드·턴 모델로 이어진다'`·`:'설치되지 않은 호스트는 빨간 행이고 카드가 없다'` | not selected |
| VP-03 | REQUIRED | SELF_PASS | `resolve-turn.runtime-catalog.test.ts:'OpenCode runtime key runs…'` · `misc.runtime-catalog.test.ts:'agent:list keeps…'` | M-P1 red 1 |
| VP-04 | REQUIRED | SELF_PASS | `opencode-connection-deployment.test.ts:'Bootstrap run 콜백이…'` · `runtime-model-startup.test.ts:220` | `connectAll()` 제거 red 1 · 감도 케이스 5종 green(배선으로 세지 않음) |
| VP-05 | REQUIRED | SELF_PASS | `harness-host.test.ts` 2 · `server.list-models.test.ts` 5 | not selected |
| VP-06 | REQUIRED | SELF_PASS | 기존 케이스 무수정 green(전체 vitest 8,213 pass) | not selected |
| VP-07 | REQUIRED | SELF_PASS | `Module.integration.test.ts:'fills agents…'` · `Controls.interaction.test.ts:'shows placeholder agents…'` | M-C1 red 2 · M-C2 red 2 |
| VP-08 | REQUIRED | SELF_PASS | `Composer.native-menu.test.ts:'… puts the Orcinus orca group first in both panels'` | not selected (VP-26) |
| VP-09 | REQUIRED | SELF_PASS | `AgentEnvironmentView.render.test.ts:'orders engine cards…'` | not selected (VP-27) — 추가로 뷰 정렬 제거 red 1 |
| VP-10 | REQUIRED | SELF_PASS | `deployment-wiring.test.ts:528`·`:537`·`:552` · `login-free-deployment.test.ts:339` · `gate:check-doc-inventory --check` | not selected |
| VP-11 | REQUIRED | SELF_BLOCKED | 사람 실기(§19) — Windows·실제 OpenCode 필요 | — |
| VP-12 | REQUIRED | SELF_PASS | `useEngines.test.ts:'shows a runtime card added while the engine page was unmounted'` | not selected (VP-29) |
| VP-13 | REQUIRED | SELF_PASS | `login-free-connection.test.ts` 14케이스 | M-S1 red 1 · M-S2 red 4 · M-S3 red 1 |
| VP-14 | REQUIRED | SELF_PASS | `opencode-connection-deployment.test.ts` 생명주기 3케이스 | not selected |
| VP-15 | REQUIRED | SELF_PASS | `agentStore.test.ts:'refreshes on provider pushes after the first read…'` | not selected |
| VP-16 | REQUIRED | SELF_PASS | `runtime-model-startup.test.ts:'reads login-free and credential snapshots through auth.snapshot…'` · `login-free.test.ts:'snapshot은 두 체계와…'` | M-A1 red 1 |
| VP-17 | REQUIRED | SELF_PASS | `login-free.test.ts:'connect 실행 context는…'` · `adapter.list-models.test.ts` · `server.list-models.test.ts` | not selected — 추가로 runtime의 host 미전달 red 4 |
| VP-18 | REQUIRED | SELF_PASS | `connection-views.test.ts:'carries connection only…'` · `providers.test.ts` 3 · `preload/index.test.ts` 신규 | not selected |
| VP-19 | REQUIRED | SELF_PASS | `runtime-config.test.ts:'passes augmenter modelDetails…'` · `registry.test.ts:'parses opencode runtime configs…'` | M-R1 red 2 |
| VP-20 | REQUIRED | SELF_PASS | `deployment-wiring.test.ts` 능력 케이스 · 소스 가드 | `loginFreeHost` 제거 red 1 · 감도(`{}`·주석·문자열) green |
| VP-21 | REQUIRED | SELF_PASS | VP-13과 같음 | VP-13의 M-S1~3 |
| VP-22 | REQUIRED | SELF_PASS | `model-listing.test.ts` 6 | not selected |
| VP-23 | REQUIRED | SELF_PASS | `settings.test.ts` 2 · `catalog.test.ts:'keeps runtime entry models…'` | M-R2 red 2 |
| VP-24 | REQUIRED | SELF_PASS | `providerRows.test.ts` · `ProviderAuthActions.test.ts` 신규 | idle↔failed 라벨 맞바꿈 red 4 · connected↔failed tone 맞바꿈 red 2 |
| VP-25 | REQUIRED | SELF_PASS | `agentSelection.test.ts:'uses provider catalog agents…'` | not selected |
| VP-26 | REQUIRED | SELF_PASS | `attachMenuModel.test.ts` 신규 2 + 대체 1 | 플러그인 패널 native 먼저 red 4 · 스킬 패널 정렬 제거 red 1 |
| VP-27 | REQUIRED | SELF_PASS | `agentOrder.test.ts` | adapter 문자열 정렬 red 2 |
| VP-28 | REQUIRED | SELF_PASS | `runtime-listing.test.ts` 3 | not selected |
| VP-29 | REQUIRED | SELF_PASS | `agentStore.test.ts:'ignores an older agent:list response…'`·`:'installs the provider subscription once…'` | M-G1 red 1 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M-S1 같은 결과도 revision+1 | VP-13 | 최초 | `login-free-connection.test.ts` 1 | 잡음 |
| M-S2 `connection-started` credentialChanged true | VP-13 | 최초 | 같은 파일 4 | 잡음 |
| M-S3 idle 실패도 credentialChanged true | VP-13 | 최초 | 같은 파일 1 | 잡음 |
| M-P1 resolve-turn이 `toAgentEnvironments([selected])`로 재조립 | VP-03 | 최초 | `resolve-turn.runtime-catalog.test.ts` 1 | 잡음 |
| bootstrap `void auth.connectAll()` 제거 | VP-04 | 최초 | `opencode-connection-deployment.test.ts` 1 | 잡음 |
| M-C1 표시값(placeholder 포함)을 저장 | VP-07 | 최초 | composer 2 | 잡음 |
| M-C2 `OpenCodeModeControl`이 placeholder 미전달 | VP-07 | 최초 | composer 2 | 잡음 |
| M-A1 reader를 `bind(id).snapshot()`로 되돌림 | VP-16 | 최초 | `runtime-model-startup.test.ts` 1 | 잡음 |
| M-R1 `compute`의 `modelDetails` 누락 | VP-19 | 최초 | 2 | 잡음 |
| bootstrap `loginFreeHost` 인자 제거 | VP-20 | 최초 | 소스 가드 1 | 잡음 |
| M-R2 catalog가 항상 `parseOpenCodeModels` | VP-23 | 최초 | 2 | 잡음 |
| idle↔failed 라벨 맞바꿈 | VP-24 | 최초 | skills 4 | 잡음 |
| connected↔failed tone 맞바꿈 | VP-24 | 최초 | skills 2 | 잡음 |
| 플러그인 패널 Orca 정렬 제거(native 먼저) | VP-26 | 최초 | chat 4 | 잡음 |
| adapter 문자열 정렬 | VP-27 | 최초 | engine 2 | 잡음 |
| M-G1 seq 비교 제거 | VP-29 | 최초 | `agentStore.test.ts` 1 | 잡음 |
| (새 oracle) 소스 가드 감도: 누락·빈 함수·주석·문자열·호출 밖 | VP-04·20 새 배선 oracle | 최초 | 가드 함수가 9입력 모두 배선 아님으로 판정 | 잡음(방향 확인) |
| (새 oracle) 디스크 0 음성 스캔 | EP-15 | 최초 | 양성 짝 `login-free.test.ts:'연결 경로는 디스크를 쓰지 않는다…'` | 음성+양성 짝 |

- **분모 검산**: 선택 증거 16(M-S1~3·M-P1·VP-04·M-C1·M-C2·M-A1·M-R1·VP-20·M-R2·VP-24×2·VP-26·VP-27·M-G1) · 인용 변이 0 · 새 oracle 2 = 표 행 18. 추가로 표 밖 자율 변이 3(스킬 패널 정렬 제거 red 1 · 뷰 정렬 제거 red 1 · runtime host 미전달 red 4) 전부 잡음.
- **덮개 회귀**: 해당 없음(첫 라운드). 대체한 기존 단언 4건은 같은 파일에서 새 계약을 양성 단언한다(`Controls.interaction`·`attachMenuModel` 2·`useEngines` unsubscribe→`not.toHaveBeenCalled`·`providers` 6종→전수).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — `확인 중…`·`연결 실패`·`다시 연결`은 `ProviderDetail`·`CustomizeList`가, 실패 사유는 상세 `text-bad`가 렌더(render 테스트 관측) | 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — `agentStore` factory화는 정리 코드가 없다(구독 해제 없음이 계약) | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 미설치·provider 없음·CLI 실패·파싱 실패·직렬화 불가·시간 초과 → 전부 `failed` 행. host 미주입 → `failed`(fail-closed) | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 연결 실패는 빨강+사유. IPC 자체 reject는 `skills.providers.connect-failed` 토스트(등록부 `T-provider-connect`) | 토스트 title은 기존 `loadFailed`를 재사용 — 전용 문구가 필요하면 후속 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | `agentStore` seq guard(M-G1 잡음). 연결 상태는 main 단일 상태기계 push라 renderer 역전 없음 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 재연결 확인 중(`checking`)에는 `connectionValue`가 `undefined`다 — 그 사이 settings 배포 무효화로 augmenter가 다시 불리면 카드가 잠시 실패할 수 있다 | 계약(§10 "connected가 아니면 undefined") 그대로 두고 보고만 한다. 일반 재연결은 revision 불변이라 augmenter를 부르지 않는다(VP-14 관측) | `login-free-connection.ts` `value()` |
| 2 | Electron 바이너리가 없는 환경에서는 electron을 import하는 스위트가 로드되지 않는다 | 로컬 `node_modules/electron/path.txt` stub(커밋 안 함)으로 로드해 실행 — CI(windows)에서는 무관 | 환경 |

### 설계 대비 명시적 차이

- 테스트 위치: plan이 `runtime.test.ts`로 지정한 런타임 연결 케이스는 로그인 프리 fixture가 있는 `login-free.test.ts`에, `server.test.ts`·`adapter.test.ts` 케이스는 새 `server.list-models.test.ts`·`adapter.list-models.test.ts`에, `ExtensionsCatalogView.interaction.test.ts` 케이스는 기존 sink 단언이 있는 `providerAuthWiring.render.test.ts`에 두었다. `runtime-catalog.test.ts`는 갱신하지 않고 `registry.test.ts`·가상 배포 테스트가 같은 경로를 관측한다. 행동 단언은 plan 그대로다.
- 이름: 상태기계 의존 `publish` → `notify`(artifact 발행 스캔 오인 회피). 시간 상한은 `createLoginFreeConnections({timeoutMs?})`에서만 바꿀 수 있고 `CreateAuthRuntimeDeps`에는 노출하지 않는다(production은 `LOGIN_FREE_CONNECT_TIMEOUT_MS`).
- `Composer.native-menu.test.ts`는 새 케이스 대신 기존 케이스 이름 뒤에 plan의 이름을 붙이고 순서 단언을 바꿨다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 메커니즘 대체 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src` 수정 73 · 신규 15(구현 5·테스트 10) · `docs` 수정 13(handoff 사본 2 제외) · 신규 ADR 1 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(전체) · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs` + `--check` |
| **관측한 게이트 산출**(exit code 아님) | lint 0 error / 2 warning(기존 `useVirtualizer` 2건) · typecheck error 0 · vitest 876파일 중 864 pass·9 fail·3 skip / 8,243케이스 중 8,213 pass·21 fail·9 skip · scripts 144 pass 0 fail · doc-inventory 채널 116·prose ok·links ok |
| 환경 기인 실패(분리) | 21 fail = 변경 전 코드(stash)로 같은 9파일·21케이스 재현: `adapters/claude/{adapter.native-plugins,native-resources,project-reconciliation}` · `adapters/opencode/v1/{adapter.instances,adapter.persistent,adapter}` · `app/{composer-catalog,composer-preparation-service}` · `handlers/session-resources.claude-assembly`(`Composer directory must be absolute` 등). better-sqlite3는 `npm rebuild`(Node ABI)로 로드 |
| V-pair 자기확인 | SELF_PASS 28 · SELF_BLOCKED 1(VP-11 사람 실기) |
| 강제 지점 전수 | 89/89 (EP-01~EP-22) |
| **AC 자기보고**(`Criteria-Met`) | AC1~AC23 ✅ (행별 좌표는 위 강제 지점 표) · AC24 ⚠️ 사람 실기 대기 |
| **합계 검산** | ✅ 23 · ⚠️ 1 · ❌ 0 = 총 24 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 첫 라운드.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan §10이 열거하지 않은 기존 위생 테스트 3곳(오류 보고 등록부·Bootstrap 부분 fake·artifact `.publish(` 스캔)이 새 코드에 반응했다 — 모두 구현 세부로 선조치.
- 반복해서 부딪히는 환경 한계: Electron 바이너리 403(`path.txt` 부재) · better-sqlite3 ABI.
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `listModels` env의 강제 `OPENCODE_DISABLE_PROJECT_CONFIG='true'` 우선을 잠그는 단언이 없다 — 병합 순서를 뒤집은 X1이 `src/main` 5,388케이스 green(r1 verify §4) | VP-17 · §10 EP-10 ② · AC10 | `server.list-models.test.ts`에서 호출자 `env`(와 `process.env`)에 같은 키 `'false'`를 넣고 `'true'`를 단언. X1 red 확인 | BLOCKING(`PAIR_FAIL`) | open |
| N1 | 가상 배포 레시피의 augmenter 가드(`!listing`)·라벨이 가이드 §4(`!listing?.length`)와 문자 불일치 | AC15 | 테스트 레시피를 가이드 문자열에 맞춘다 | NON_BLOCKING | open |
| N2 | 구현 보고 §10 합계 `89/89` — 행 합 93 | 자기보고 사본 | 다음 `[구현자 기입]`에서 93으로 | NON_BLOCKING | open |
| N3 | `runtimeModelsFromListing`의 `in` 검사는 prototype 키를 중복으로 본다 — OpenCode id(`provider/model`)로는 도달 불가 | 비귀속 | 기록만 | NON_BLOCKING | 기록 |

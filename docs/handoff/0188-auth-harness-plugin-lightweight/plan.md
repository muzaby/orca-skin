# Plan — 0188-auth-harness-plugin-lightweight

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0188-auth-harness-plugin-lightweight` |
| 작성자 | Claude Code |
| 일자 | 2026-08-14 |
| 매핑 | Phase A(이동) → Phase B(소비 역전) → Phase C(호환 layer 제거) — 각 phase = 게이트 통과 커밋 1건 |
| 구현 주체 | **Claude 직접** (비기능 = 구조 리팩터링, `../AGENTS.md §역할 분담`) |
| 상태 | DRAFT → READY |
| 입력 정본 | [`proposal.md`](proposal.md) (사용자 첨부 제안서, 저장소에 보존) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: `app/src/main/features/providers/` 한 슬라이스가 서로 다른 네 책임을 `Provider` 계약 하나에 모으고 있다 — ① 인증 lifecycle ② Harness+ModelProvider 설정/모델 해석 ③ Confluence Plugin 기능·도구 ④ 다른 feature 를 위한 범용 소비 표면. `Provider.kind`(`gate|llm|service`)·`Provider.llm`·`Provider.tools`·`ProviderApi.materialize()` 가 그 집적의 이름이다. 인증 코어가 소비자의 제품 분류와 subprocess 환경변수 형상까지 알고 있다.
- **두 번째 문제(제안서 §AS-IS)**: 현재 `Provider.llm = {adapter, provider, envKey}` 는 credential **한 값**만 표현한다. 폐쇄망에서 OAuth token 은 실제 LLM token 이 아니고, OAuth 로 config API 를 한 번 더 불러 받은 URL·모델 식별자·실행 token 을 Harness 환경변수로 바꿔야 한다. 현재 계약으로는 표현할 수 없다.
- **완료 후 달라지는 것**: 인증만 공통(`AuthRuntime`)으로 남고, 인증 이후의 endpoint 선택·요청·응답 변환·캐시·도구 구성·Harness 환경변수 조립은 각 소비 feature 와 배포 모듈이 직접 소유한다. `features/providers/` 는 사라지고 `features/{auth,gate,harnesses,plugins,usage}` + `app/deployment/` 로 나뉜다.
- **성공을 사용자 관점에서 한 문장으로**: 화면·클릭·IPC 왕복·DB 는 하나도 달라지지 않은 채로, 폐쇄망 배포가 "OAuth 로 config API 를 불러 URL·모델·토큰을 한꺼번에 Harness 에 싣는" 구성을 **작은 배포 모듈 하나**로 쓸 수 있게 된다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "제안서를 토대로 핸드오프 188을 구현하라" | 2026-08-14 사용자 턴 |
| 명시 요구 | 제안서 본문 전체가 구현 지침이다 — "독자: Orca-skin `main` 브랜치의 코드·레이어 규칙을 이미 아는 구현 에이전트" | [`proposal.md`](proposal.md) 머리말 |
| 명시 요구 | "별도 피드백·보완 문서는 이 문서의 입력 증거일 뿐 구현 정본이 아니다. 구현 에이전트는 이 문서와 현재 `main` 코드만 사용" | [`proposal.md`](proposal.md) 머리말 |
| 명시 요구 | "이 제안이 채택되어 구현되면 현재 아키텍처 문서, 용어집과 폐쇄망 확장 가이드를 같은 변경에서 갱신한다" | [`proposal.md`](proposal.md) 머리말 |
| 추론 의도 | 제안서의 `수용 기준`·`검증 지침` 절이 이 handoff 의 AC 원천이다 — 별도 제품 결정 없이 그대로 승계한다(추론: 제안서가 "구현 지침" 을 자칭하고 사용자가 그것을 근거로 구현을 지시했다) | 설계자 해석 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 제안서(`proposal.md`)가 이번 작업의 구현 정본이다. 다른 초안·피드백 문서의 예시를 조합하지 않는다 | 제안서가 여러 검토 결과를 병합한 "유일한 구현 제안서" 라고 스스로 선언 | 사용자 턴 + 제안서 머리말 | ACTIVE | — |
| D-002 | 인증만 공통화한다. 인증 이후의 endpoint·요청 파라미터·응답 변환·캐시·주기 실행·도구 구성·Harness env 조립은 **소비 feature 가 직접 소유** | 공통화의 대상은 실제로 여러 기능이 똑같이 필요로 하는 인증 lifecycle 과 안전한 전송뿐 | 제안서 §결론·§문제 진단 | ACTIVE | — |
| D-003 | `ProviderPlatform` 을 더 범용 플랫폼으로 확장하지 않는다. `ProviderPlatformV2`·contribution registry·operation catalog·응답 매핑 DSL·환경변수 DSL 을 만들지 않는다 | 같은 집적의 재생산 | 제안서 §결론·§구현자가 만들면 안 되는 것 | ACTIVE | — |
| D-004 | 용어: **Harness**(Claude/OpenCode) · **Model** · **ModelProvider**(anthropic/openai/bedrock/vertex) · **Auth** · **Plugin** · **HarnessPlugin**/`ClaudeHarnessPlugin`. 신규 코드에서 `Engine` 어휘 금지, `ExclusivePlugin` 금지, 제품명 prefix 금지 | 같은 `provider` 라는 이름이 ModelProvider 설정과 인증 대상을 동시에 가리키던 것이 문제의 절반 | 제안서 §확정 용어 | ACTIVE | — |
| D-005 | 기존 `orca.json`·`orca:*` IPC namespace·설치된 package id·DB `backend`/`engine`/`adapter`/`provider_key`·`Provider.id`→`AuthId`·vault key prefix 는 **호환성 식별자로 유지**한다. 구조 리팩터링을 이유로 개명하지 않는다 | vault namespace·MCP `${BINDING:<id>}`·저장된 grant·사용자 MCP 설정이 걸려 있다. 개명은 별도 secret migration + rollback 계획이 필요 | 제안서 §확정 용어·§보안 불변식 | ACTIVE | — |
| D-006 | `AuthDefinition` 에 `kind`·`tools`·`llm`·`usage`·`envKey` 를 두지 않는다. Auth 코어는 자신이 Gate 에 쓰이는지 모른다 | 인증 코어가 소비자의 제품 분류를 알면 안 된다 | 제안서 §TO-BE 책임 경계 | ACTIVE | — |
| D-007 | Gate 는 `features/gate/` 의 별도 정책 feature 다. `status==='valid'` 뿐 아니라 `verified===true` 까지 요구하고, gate 용 정의는 `AuthDefinition & { probe: AuthProbe }` 로 compile-time 제한 + 부팅 composition 에서 probe 없는 gate 를 fail-closed | 복원된 grant 만으로 gate 가 영구 통과하던 과거 회귀를 되살리지 않는다 | 제안서 §Gate | ACTIVE | — |
| D-008 | `AuthChange` 는 renderer 갱신 이벤트와 실행 credential invalidation 을 한 boolean 으로 뭉개지 않는다. `kind:'step'` / `kind:'snapshot' + cause + credentialChanged` 로 가르고, **Harness cache 무효화·Plugin tool sync 는 `credentialChanged:true` 에서만** 일어난다 | UI step·`verified`-only 변화가 network·runtime revision 을 유발하면 안 된다 | 제안서 §AuthRuntime 소비 규칙 표 | ACTIVE | — |
| D-009 | 재인증은 새 인증의 probe 성공 전까지 기존 Grant·vault 값·`credentialRevision` 을 보존한다 | 실패한 재인증이 기존 자격증명을 파괴하면 안 된다 | 제안서 §AuthRuntime | ACTIVE | — |
| D-010 | `materialize()` 를 제거한다. 일반 소비는 `BoundAuth.request()` 를 쓰고, raw credential 은 **trusted-main 전용 `AuthSecretReader`** 로 격리한다. MCP·특정 Harness augmenter 에는 AuthId 를 닫은 closure 만 전달한다. RouterContext·renderer IPC·일반 feature 에는 넣지 않는다 | 환경변수 이름·ModelProvider URL·서비스별 header 조립은 Auth 의 지식이 아니다 | 제안서 §AuthRuntime·§보안 불변식 | ACTIVE | — |
| D-011 | raw cookie 목록을 일반 포트로 내보내지 않는다. session 기반 호출은 `BoundAuth.request()` 가 같은 Electron partition 을 쓰는 것으로 충분 | 보안 표면 확대 | 제안서 §AuthRuntime | ACTIVE | — |
| D-012 | Auth 등록 위치는 `app/deployment/auth-definitions.ts` build-time 상수. 기본 `main` 의 **빈 선언에 예시 Auth 를 추가하거나 가짜 사내 URL 을 넣지 않는다.** 리팩터링 전 GUI 에 없던 Usage 전용 row 도 만들지 않는다 | 현재 `GATE_PROVIDERS`/`LLM_PROVIDERS`/`SERVICE_PROVIDERS` 가 모두 빈 배열이다 | 제안서 §Auth 등록 위치 | ACTIVE | — |
| D-013 | Harness 영역은 별도 `HarnessModelProviderDefinition[]`·definition registry 를 만들지 않는다. `sources/settings/<harness>/<modelProvider>/` 디렉터리가 선택 가능한 entry 와 Model 목록의 SSOT 로 남고, 필요한 key 에만 optional `RuntimeConfigAugmenter` 를 붙인다 | 두 번째 ModelProvider 플랫폼을 만들지 않는다 | 제안서 §Harness + ModelProvider | ACTIVE | — |
| D-014 | `HarnessRuntimeConfigService` 는 key 별 **현재 세대 하나**(generation + sourceRevision + cached value + in-flight)만 소유한다. 세대를 cache key 로 쌓는 Map 을 만들지 않는다 | 이전 secret 이 메모리에 남는다 | 제안서 §Cache와 stale commit 차단 | ACTIVE | — |
| D-015 | generation fence: 시작 시 generation·sourceRevision 을 캡처하고, 완료 시 generation 이 바뀌었으면 cache 에도 현재 caller 에도 반환하지 않고 **bounded retry** 후 명시적 stale-config 오류. 401/403 강등 요청은 자동 재시도하지 않는다 | 재인증 중 시작된 옛 config 요청이 무효화 뒤 완료되어 낡은 token 을 되살리는 것을 막는다 | 제안서 §Cache와 stale commit 차단 | ACTIVE | — |
| D-016 | single-flight 는 같은 key·generation·sourceRevision 만 공유하고 **service-owned signal** 을 쓴다. 개별 caller 의 `AbortSignal` 은 그 caller 의 대기만 취소한다. invalidation 만 공유 작업을 abort 한다 | 한 caller 취소가 다른 caller 의 정상 resolve 를 취소하면 안 된다 | 제안서 §Cache·§성능 계약 | ACTIVE | — |
| D-017 | `settings.json`(=`options.settings`)과 `options.env` 의 **두 주입 채널을 유지**한다. 적용 우선순위 = `runtime augmenter env > 선택된 Harness+ModelProvider settings 의 env > app env > 상속된 process env`. 구현 전에 `options.settings.env` vs `options.env` 실제 충돌 동작을 characterization test 로 고정한 뒤 제안서의 결정표를 적용한다. 디스크 `settings.json` 은 수정하지 않는다 | 하나로 평탄화하면 Claude settings 우선순위가 바뀔 수 있다 | 제안서 §settings와 env 전달 | ACTIVE | — |
| D-018 | Auth 에서 얻은 secret 과 config API 의 LLM token 은 `options.settings` 나 argv 에 복제하지 않고 **`options.env` 에만** 둔다 | 0028 결정(설정 파일에 토큰 기록 금지) 유지 | 제안서 §settings와 env 전달 | ACTIVE | — |
| D-019 | 최초 사용자 turn 은 runtime config 를 **한 번** resolve 하고 `PreparedHarnessConfig` 를 한 번 만든다. 그 turn 의 chat Harness 와 title generation 은 같은 prepared snapshot 을 쓴다 | 같은 턴 안에서 두 번 조회하면 값이 갈릴 수 있다 | 제안서 §settings와 env 전달 | ACTIVE | — |
| D-020 | 자동 continuation 은 **continuation 마다 전체 runtime config 를 한 번 다시 resolve**(warm cache 허용)하고 같은 continuation 의 listen/flush 가 그 결과 하나를 공유한다. `buildListenRequest()` 와 `buildFlushRequest()` 가 **둘 다** `providerSettings` 와 `env` 를 같은 값으로 전달한다(현재 listen 이 env 를 생략하는 형상을 유지하지 않는다) | settings 만 새로 보고 dynamic env 는 최초 값으로 두는 비대칭 금지 | 제안서 §settings와 env 전달 | ACTIVE | — |
| D-021 | ~~`runtimeConfigFingerprint` 는 native settings 와 최종 env 를 함께 접는다~~ | — | 제안서 §settings와 env 전달 | **SUPERSEDED** | D-038 |
| D-038 | fingerprint 는 **최종 env 만** 접는다(`runtimeEnvFingerprint`). settings 축은 `providerSettingsChangedSinceSpawn` 이 **0125 의 보수적 null 의미론과 함께** 계속 소유한다. 원문·secret·fingerprint 를 로그/DB 에 남기지 않는다. boundary·Model·Runtime Tool revision 판정도 별도 유지 | r1 처럼 둘을 합치면 ① settings 변화가 두 입력에 동시에 나타나 판정이 겹치고 ② **`settings: {...}` → `undefined`(loader 일시 실패)를 변화로 읽어 settings 없이 respawn** 한다 — 0125 는 그 경우를 no-op 으로 못 박았다 | r2 리뷰 + `runtime-boundary.ts` 실측 | ACTIVE | D-021 대체 |
| D-039 | Usage 후보 key 의 정본이 `Provider.llm` 선언 → **settings 디렉터리 열거**로 바뀐다. **이것은 이동이 아니라 의미 변경**이며 `supports()` 가 유일한 게이트가 된다 | D-006 이 `Provider.llm` 을 지워 구 배열이 존재하지 않는다(호환 경로 없음). `supports()` 는 fetch 이전에 평가되고 `supports:false` 를 실패로 세지 않으므로, 후보를 넓혀도 효과 집합은 `후보 ∩ supports` 로 배포가 계속 통제한다 | r2 리뷰 + `features/usage/jobs.ts:79-81` 실측 | ACTIVE | — |
| D-040 | Claude Harness 가 로드하는 package renderer는 **둘 다** `features/extensions/harness-plugins/` 에 둔다 (`claude.ts`=orca package · `claude-user-skills.ts`=사용자 skills 래퍼) | 같은 축의 산출물이 두 디렉터리로 갈리면 다음 renderer 가 어디로 갈지 규칙이 없다 | r2 리뷰 | ACTIVE | — |
| D-041 | env 우선순위는 `runtimeEnv > settings env > app env > process env` 다. 구현은 `baseEnv → appEnv → settings env → runtimeEnv` 순으로 얹는다(나중이 이긴다) | `orca.json` 의 app env 는 **전역 폴백**, ModelProvider settings 는 **그 ModelProvider 전용 설정**이다. 폴백이 전용을 이기면 게이트웨이를 바꿔도 URL·모델 변수가 따라오지 않는다. r2 구현은 app 을 settings 뒤에 얹어 이 관계를 뒤집었다 | r3 리뷰 §2 + `prepared-config.ts` 실측 | ACTIVE | D-018 을 정정(우선순위 계약 자체는 불변, 구현 순서만) |
| D-042 | `options.env` 를 만드는 턴에는 settings 의 **`env` 블록을 통째로** in-memory 사본에서 걷어낸다(충돌 키만이 아니라) | 충돌 키만 지우면 settings·app env 양쪽에 있는 키가 두 채널에 동시에 남아 최종 값이 SDK 내부 우선순위에 달린다 — "어느 채널이 우선해도 결과가 하나" 계약이 깨진다. `options.env` 를 만들지 않는 턴에는 settings 를 건드리지 않아 정적 배포 경로는 0188 이전과 동일 | r3 리뷰 §2 | ACTIVE | — |
| D-043 | `runtimeEnvFingerprint` 는 canonical form 자체가 아니라 **프로세스 수명 랜덤 키의 HMAC-SHA256 digest** 다 | 비교에만 쓰이는데도 spawn 기록부(`SessionRuntime`)가 세션 수명 내내 들고 있다 — canonical form 이면 secret 평문의 장기 보존처가 하나 늘고 heap dump·크래시 리포트로 샌다. 키가 프로세스마다 새로 뽑히므로 값이 밖으로 나가도 되돌릴 수 없고, 같은 프로세스 안에서는 비교가 정확하다 | r3 리뷰 §4 (Security) | ACTIVE | D-020 의 "로그·DB 에 남기지 않는다" 를 메모리 표면까지 확장 |
| D-044 | 배포 factory 4종은 **Bootstrap 이 조립한 능력을 인자로 받는다** — `createPluginBindings(deps)`·`createRuntimeConfigAugmenters(deps)`·`createConnectionSources(deps)`·`createUsageFetcher(deps)`. 카탈로그 row 조립은 `app/deployment/connections.ts` 가 소유하고 `gateRows()`·`pluginRows()` 를 조각으로 노출한다 | 인자 없는 factory 는 배포가 선언을 채울 때 범용 `bootstrap.ts` 를 열게 만든다 — "배포가 고치는 파일은 `app/deployment/` 묶음뿐"(D-035) 이 성립하지 않는다. 특히 `ConnectionViewSource` 의 `harness`·`usage` category 는 만들 자리가 아예 없어, 그 두 인증을 선언한 배포는 **카탈로그 행이 없어 로그인이 불가능**했다 | r3 리뷰 §1 | ACTIVE | D-035 를 구체화 |
| D-045 | 기본 배포가 비어 있어 실행되지 않는 경로는 **비어 있지 않은 가상 배포 fixture** 로 태운다 (`app/deployment/deployment-wiring.test.ts`). fixture 의 인자 타입은 **실제 deps 인터페이스**를 쓴다 — 인라인 타입이면 배포 factory 의 능력이 줄어도 테스트가 통과한다(r4) | 기본 선언이 `[]` 인 동안 CI green 은 "배포 경로가 옳다" 를 전혀 뜻하지 않는다 — r2 는 그 상태로 D-044 의 두 결함을 통과시켰다. Bootstrap 이 넘기는 의존성 형태를 재현해 Plugin·Harness·Usage·카탈로그를 끝까지 확인한다 | r3 리뷰 필수 수정 5 · r4 D12 | ACTIVE | — |
| D-046 | **강등 통지는 실제 전이를 따른다.** `AuthStore.markExpired()` 가 "이번 호출이 만료 전이를 만들었는가" 를 돌려주고, 호출부가 그 값으로 발행 여부(`resume`)와 `credentialChanged`(요청 경로)를 정한다 | 같은 강등을 두 지점이 관측하면(401 요청 경로 + `resume`, 또는 동시 요청 두 건) 전이는 한 번인데 통지가 두 번 나갔다. 두 번째는 revision 이 그대로라 `credentialChanged:true` 와 어긋나고 — D-037 이 시계 만료에서 고친 바로 그 불일치다 — 부팅 방송 상한 `1 + K`(0187 D2)를 `1 + 2K` 로 늘렸다. 판정은 store 가 갖고 통지는 호출부가 정하는 것이 두 축을 겹치지 않게 두는 방법이다 | r4 자체 검증 | ACTIVE | D-037 을 만료 전 강등까지 확장 · 0187 D2 유지 |
| D-047 | **후보 자격증명은 확인 전에 어디에도 커밋하지 않는다.** probe 는 `CandidateCredential` 을 요청 인자로 싣고, store·vault 쓰기는 성공 후 한 번만 일어난다. 재인증 rollback(`captureForRollback`/`rollback`/`AuthRollbackPoint`)은 **제거**한다 | 커밋-후-되돌림은 원리적으로 불완전했다: ① probe 왕복 동안 검증 안 된 후보 secret 과 올라간 revision 이 전역 노출 ② 후보의 401 이 낸 강등 이벤트는 상태를 되돌려도 **취소되지 않아** Plugin 도구가 회수된 채로 남았다 ③ rollback 좌표에 `expirySettled` 가 빠져 되살린 grant 의 자연 만료가 영구히 정착되지 않았다 ④ probe 중 종료되면 vault 에 후보 값이 남았다. 되돌림을 고치는 대신 **되돌릴 중간 상태를 만들지 않는다** — 넷이 함께 사라진다 | r5 리뷰 §1 P1 ×2 | ACTIVE | D-009 를 SUPERSEDE(보존 목적은 유지, 수단을 교체) |
| D-048 | **Harness 두 주입 방식의 권한 분리를 타입으로 강제한다.** `HarnessConfigApiDeps{auth}` 와 `HarnessDirectCredentialDeps{secretFor}` 로 deps 를 쪼개고 factory 도 둘로 나눈다 | r4 까지는 deps 하나가 둘 다 줬고 경계는 **주석에만** 있었다 — config API factory 가 raw secret 을 읽고 direct credential factory 가 API 요청을 낼 수 있었다. 지키라고 적어 둔 규칙을 타입이 전혀 막지 않으면 그것은 계약이 아니라 희망이다 | r5 리뷰 §1 P1 | ACTIVE | D-044 를 구체화 |
| D-049 | **`markExpired()` 는 `credentialChanged` 와 `snapshotChanged` 를 분리해 돌려주고, 둘 다 false 면 방송하지 않는다** | r4 는 boolean 하나여서 호출부가 "전이 없음" 을 "알릴 것 없음" 으로도 "false 로 알림" 으로도 읽을 수 있었다. 동시 401 두 건에서 두 번째가 GUI 방송을 한 번 더 냈다 — 상태는 한 번만 달라졌는데 | r5 리뷰 §3 | ACTIVE | D-046 을 두 축으로 정밀화 |
| D-050 | **커밋은 자기 시도가 아직 최신일 때만 일어난다.** `LoginService` 가 Auth 마다 시도 세대를 두고(로그인 진입·`revoke` 가 올린다) `settleGrant` 가 커밋 직전에 확인한다 | 미커밋(D-047)은 probe *중* 노출을 없앴지만 **커밋 시점은 여전히 `await` 뒤**다. 그 사이 폼 재제출·해제가 끼어들면 늦게 끝난 옛 후보가 새 후보를 덮거나 해제한 Auth 가 되살아났다. **`credentialRevision` 은 fence 에 넣지 않는다** — 넣으면 probe 도중 401 강등이 일어난 재인증이 커밋되지 못하는데, 그 강등이야말로 재인증을 하는 이유다 | r6 리뷰 §1 | ACTIVE | D-047 을 보완 |
| D-051 | **direct credential factory 는 selector 가 아니라 닫힌 closure map 을 받는다.** 배포가 `DIRECT_CREDENTIAL_AUTH_IDS` 로 선언하고 Bootstrap 이 그 id 만큼만 closure 를 만든다. 두 방식이 같은 Harness key 를 보강하면 합류점이 throw | `secretFor: (authId) => …` 는 *고르는 함수* 라 factory 가 임의 Auth 의 secret 을 고를 수 있다 — 제안서의 "특정 AuthId 를 닫은 `() => string \| null` 만 전달" 을 만족하지 않는다. key 충돌도 r5 는 주석으로만 "진단한다" 하고 실제로는 조용히 덮었다 | r6 리뷰 §1 | ACTIVE | D-048 을 제안서 계약까지 끌어올림 |
| D-052 | **만료 1회성의 기준은 정착 집합 하나다.** `settleExpiry()`·`markExpired()` 가 같은 `expirySettled` 를 본다. vault 쓰기는 **메타 → 값 → index** 순서 | `expiresAt <= now` 를 중복 판정에 쓰면 **요청이 도는 동안 만료된** 경우가 통째로 빠진다(시작 때 valid → `settleExpiry` 통과, 401 때 이미 만료 → 여기서도 접힘). vault 는 값을 먼저 쓰면 메타 실패 시 grant 가 옛 값을 가리키는데 그 키에 검증 안 된 새 값이 앉는다 | r6 리뷰 §1·§3 | ACTIVE | D-046/D-049 를 정밀화 |
| ~~D-053~~ | **자격증명 쓰기는 staged → promote 2단이고, `put()` 은 영속을 먼저 한다.** 중단된 promote 는 다음 부팅의 `restore()` 가 마저 옮긴다 | 키가 둘 이상이면(access+refresh) "하나만 새 값" 상태가 생긴다 — r6 의 순서 교정은 단일 키만 덮었다. 암호화가 실패할 수 있는 단계를 staging 으로 몰아 정식 키를 손대기 전에 실패시킨다. `put()` 이 메모리를 먼저 바꾸면 저장 실패 시 **디스크에 없는 상태를 화면과 Harness cache 가 믿는다**(예외 때문에 snapshot 도 안 나간다) | r7 리뷰 §1 | SUPERSEDED (D-056) | D-052 를 다중 키·영속까지 확장 |
| D-054 | **확인 결과는 `settled \| rejected \| superseded` 3분기다.** superseded 는 pending·step·이벤트를 아무것도 바꾸지 않는다. Renderer 도 자기보다 뒤에 시작된 요청이 있으면 invoke 응답을 버린다 | `rejected` 와 `superseded` 를 `null` 하나로 합치면 호출부가 거부 폼을 다시 열어, **이미 성공한 새 로그인이나 해제 직후 화면을 늦게 끝난 옛 시도가 덮는다**. 세대 fence(D-050)는 커밋만 막았지 화면은 막지 못했다 | r7 리뷰 §1 | ACTIVE | D-050 을 화면까지 확장 |
| D-055 | **합류 규칙(`mergeAugmenters`)을 export 해 테스트가 production 코드를 부른다** | 기본 배포는 두 factory 가 다 비어 있어 `createRuntimeConfigAugmenters` 만으로는 충돌 규칙이 실행되지 않는다. 테스트가 규칙을 자기 안에 다시 구현하면 production 가드를 지워도 통과한다 — r6 이 정확히 그 상태였다(verify SKILL §2 가 금지한 형태) | r7 리뷰 §2 | ACTIVE | D-051 의 검증 수단 |
| D-056 | **자격증명 교체는 고정 키 덮어쓰기가 아니라 포인터 교체다.** 새 값은 `provider:<authId>:<authKind>@<세대>` 새 키에 쓰고, `Grant` 저장이 곧 커밋이다. 아무도 가리키지 않는 키는 부팅 sweep(`AuthStore.restore`)이 치운다 | vault 와 grant 는 별개 저장소이고 원자적으로 함께 쓸 수 없다 — 고정 키를 덮어쓰면 어떤 순서로 배열해도 "vault=새 값 / 영속 grant=옛 값" 창이 남는다(r7 의 2단 쓰기도 promote↔저장 사이에 남았고 실측 재현됐다). 포인터 교체는 실패 지점과 무관하게 옛 쌍 또는 새 쌍 하나만 관측되게 한다. `Grant.vaultKey` 가 포인터이므로 **기존 설치와 호환**된다 | r7 리뷰 §1·§3-1 + 실측 재현 | ACTIVE | **D-053 을 SUPERSEDE**(staged→promote 2단 폐기, `stage`/`promoteStaged`/`discardStaged` 제거) |
| D-057 | **`GrantPersistencePort.save()` 는 내구 저장 여부를 boolean 으로 보고한다.** 메모리 폴백은 "영속 성공" 이 아니다 — `false` 를 받은 로그인은 새 값을 이번 프로세스에서 쓰되 **옛 세대 키를 지우지 않는다** | production adapter 가 쓰기 오류를 삼키고 `void` 를 돌려줘 호출부의 `catch` 가 실제 디스크 실패를 한 번도 보지 못했다. 던지지 않는 이유는 키체인이 잠긴 머신에서 앱이 죽으면 안 되기 때문이고, 그렇다고 성공으로 접으면 옛 키를 지워 **재시작 후 아무것도 가리키지 않는 grant** 가 된다 | r7 리뷰 §1·§3-2 | ACTIVE | D-053 의 `put()` 영속 우선은 유지 |
| D-058 | **세대 확인은 결과 해석보다 먼저이고, `await` 가 있는 모든 자리에 있다** — probe 뒤(성공·실패 양쪽) · 실행기 뒤(`absorb` 의 `code-required`·`failed` 포함) · 부팅 복원 probe 뒤(`resume` 은 새 시도를 열지 않고 현재 세대만 비교) · 401 강등(`markExpired(authId, observedRevision)`) | r7 은 성공 분기에서만 확인해, 늦게 끝난 옛 시도의 401 이 거부 폼을 다시 열었다(`status=none` 인데 `input-required`). 401 은 **요청을 보낸 그 세대**에 대한 서버 판정이므로, 요청이 도는 사이 재인증됐다면 새 값을 내리는 근거가 못 된다 — 이 축이 없으면 방금 성공한 로그인이 옛 probe 의 401 로 즉시 `expired` 가 된다 | r7 리뷰 §1·§3-3 + 실측 재현 | ACTIVE | D-054 를 확장(3분기는 유지) |
| D-059 | **회귀 테스트는 자기가 주장하는 production 경로에 실제로 진입했는지까지 단언한다** | r7 의 "refresh 저장 실패" 테스트는 PAT 전용 선언에 OAuth 실행기를 주입해 **token 경로에 도달조차 못 한 채** 통과했다. 경로 진입을 세는 단언(실행기 호출 횟수)이 있으면 그 형태가 성립하지 않는다 — D-055 의 "테스트가 production 을 부른다" 와 같은 축의 후속 | r7 리뷰 §2 | ACTIVE | D-055 의 후속 |
| D-060 | **`GrantPersistencePort.load()` 는 `{records, authoritative}` 를 돌려주고, vault 고아 sweep 은 `authoritative` 일 때만 돈다.** 저장소를 못 열었거나 레코드를 **하나라도** 형상 오류로 버렸으면 `false` 다 | production adapter 는 실패해도 앱이 뜨도록 빈 맵으로 강등하는데, r8 의 sweep 이 그 빈 맵을 "영속된 grant 가 없다" 는 권위 있는 사실로 읽었다 — grant 파일만 손상되고 secret 파일은 멀쩡한 흔한 경우에 **부팅 한 번으로 자격증명이 복구 불가능하게 삭제**된다. 버린 레코드의 `vaultKey` 는 읽을 수 없으므로 부분 파싱도 같은 문제다. 고아 정리는 미뤄도 되는 위생 작업이고, 잘못 지운 secret 은 복구되지 않는다 | r8 재리뷰 §2 + 실측 재현 | ACTIVE | D-056 의 sweep 을 제한 |
| D-061 | **해제(`revoke`)는 fail-closed 다.** 다음 grant map 의 내구 저장이 성립한 뒤에만 메모리·vault·snapshot 을 바꾸고, 실패는 던져 IPC 응답을 실패로 만든다 | r8 은 `flush()` 결과를 버리고 무조건 `revoked` 를 냈다. 저장이 실패하면 secret 은 지워지는데 디스크의 grant 는 남고, **session grant 는 vault 값이 없어 아무것도 사라지지 않은 채** 화면만 '해제됨' 이 된다 — 재시작하면 grant 가 복원되고 cookie 가 살아 있어 probe 가 통과, 사용자가 끊은 연결이 되살아난다. 추가·교체와 달리 해제는 degrade 로 접을 수 없다 | r8 재리뷰 §2 + 실측 재현 | ACTIVE | D-057 의 정책을 연산별로 분화 |
| D-062 | **해제가 성립하면 cookie jar 도 비운다** — `BrowserSessionPort.clear(handleId, {scope:'origin', origin})`. best-effort 이며 해제 자체를 되돌리지 않는다 | grant 만 지우면 서버 쪽 로그인은 살아 있다 — 같은 `sessionGroup` 의 다른 Auth 가 그 쿠키로 계속 통과하고, 어떤 이유로든 grant 가 되살아나면 probe 가 그대로 성공한다. `BrowserSessionStore.clear()` 는 있었으나 포트에 노출되지도 호출되지도 않았다. scope 가 `'origin'` 인 이유는 공유 그룹을 통째로 비우면 같은 그룹의 다른 연결이 끊기기 때문 | r8 재리뷰 §2 | ACTIVE | — |
| D-063 | **영속 실패 신호는 boolean 하나로 통일한다**(구현이 던지면 `AuthStore` 가 `false` 로 정규화). **정책은 실패 신호가 아니라 연산이 정한다** — 추가·교체 = degrade-open(옛 세대 키 보존), 해제 = fail-closed | r8 은 포트 주석이 "실패 시 throw" 인데 production adapter 는 `false` 를 돌려줬고, 두 신호에 서로 다른 정책(로그인 거부 / degrade)이 붙어 같은 조건이 두 갈래로 처리됐다. 갈라지는 축은 **무엇을 하려 했는가**여야 한다 — 추가를 fail 시키면 멀쩡한 로그인이 일시적 디스크 문제로 막히고, 해제를 degrade 하면 끊은 연결이 되살아난다 | r8 재리뷰 §2 | ACTIVE | D-057 을 정정·구체화 |
| D-022 | Model 선택 UI 는 현재처럼 settings.json 에서 파생한다. runtime API 가 돌려주는 모델 환경변수는 **실행 구성에만** 반영하고 카탈로그 Model 목록에 반영하지 않는다 | 카탈로그 반영은 별도 제품 결정 | 제안서 §Harness + ModelProvider | ACTIVE | — |
| D-023 | Confluence 는 `features/plugins/confluence/` 의 독립 Plugin 이다. Runtime Tool 서버는 **한 번만** 만들고 Bootstrap 이 인증 상태에 따라 같은 인스턴스를 add/remove 한다. `verified`-only snapshot 과 UI step 은 sync 하지 않는다 | 매 sync 마다 재생성하면 handler identity 가 달라져 registry revision 이 오르고 persistent runtime 이 respawn 한다 | 제안서 §Plugin과 Usage | ACTIVE | — |
| D-024 | GUI `ProviderInfo.tools` 는 cached descriptor 의 **완전 도구 이름을 유지**한다. Auth 가 invalid 여도 빈 배열로 바꾸지 않고 `status` 로 비활성을 나타낸다. 실제 Harness 노출만 Runtime Tool Registry 에서 회수 | active registry 목록으로 DTO tools 를 만들면 현재 UX 가 깨진다 | 제안서 §Plugin과 Usage | ACTIVE | — |
| D-025 | Plugin(제품 단위)과 HarnessPlugin(Harness 가 직접 로드하는 package)을 합치지 않는다. `features/extensions/claude-plugin-package.ts` → `features/extensions/harness-plugins/claude.ts`, `ClaudeHarnessPlugin` 어휘로 정리하되 manifest 의 기존 package id 는 유지 | lifecycle 과 소비자가 다르다 | 제안서 §Plugin과 HarnessPlugin은 합치지 않는다 | ACTIVE | — |
| D-026 | Usage 는 현재 `UsageFetcher` 경계를 유지하고 폐쇄망 구현을 `app/deployment/usage-fetcher.ts` 에 둔다. `supports(key)` 는 배포 지원 여부이지 Auth 상태가 아니다 — 미인증에서 `supports:false` 로 숨기지 않고 `fetchUsage()` 가 Auth 오류를 전파한다. 재인증·해제가 저장된 마지막 snapshot 을 삭제하지 않는다 | Main 정본·renderer mirror·cron·DB cache 의미 유지 | 제안서 §Plugin과 Usage | ACTIVE | — |
| D-027 | 부팅 순서: Auth/Gate/Plugin tool server/Connection handler 를 **DB 초기화 앞**에 두고 초기 tool sync 와 listener 를 resume 보다 먼저 완료한다. gate Auth 를 순차 resume 한 뒤 gate 통과 시 나머지 Auth 만 한 번 병렬 resume 한다. UsageTracker·Harness settings/runtime config 는 기존대로 DB 뒤 | renderer 가 부팅 완료 전에 연결 상태를 invoke 한다 | 제안서 §Bootstrap 비교 | ACTIVE | — |
| D-028 | remaining resume 의 성공 `verified` 변화는 마지막 full-state push **한 번**으로 합치고, 즉시 강등 `K` 건을 포함한 전체 방송 상한을 현재와 같은 `1 + K` 로 유지한다. `emitVerifiedChange:false` 가 credential-effective change 까지 숨기면 안 된다 | 현재 sweep 의 상한(0187 D2)을 악화시키지 않는다 | 제안서 §Bootstrap 비교·§수용 기준 | ACTIVE | — |
| D-029 | 카탈로그 DTO 는 `app/connection-views.ts` 가 `ConnectionViewSource` 배열에서 조립한다. 기존 `ProviderInfo` 전 필드 + `ProviderPlatformState.step` 을 모두 채우고 renderer 에 새 `connection` kind 를 추가하지 않는다. compat 매핑 `gate→gate, harness→llm, plugin→service, usage→service`. row 순서·개수 보존, `authId` 유일 | wire 와 화면을 동시에 바꾸지 않는다 | 제안서 §카탈로그 view 조립 | ACTIVE | — |
| D-030 | shared `ProviderKind`·`ProviderInfo`·`ProviderPlatformState`·`AgentEnvironment` 와 현재 IPC schema/channel 은 **별도 UI migration 전까지 compatibility 계약으로 유지**한다. 신규 domain 코드 안쪽에서는 `ProviderKind` 를 쓰지 않는다 | UI/UX 불변 범위 | 제안서 §UI/UX 불변식·§수용 기준 | ACTIVE | — |
| D-031 | 새 DB migration 을 만들지 않는다. 기존 `provider_key` 값을 새 도메인 key 로 읽는 boundary 만 유지 | 이번 변경은 소프트웨어 책임 재배치이며 데이터 의미를 바꾸지 않는다 | 제안서 §구현자가 만들면 안 되는 것 | ACTIVE | — |
| D-032 | 신규 production dependency 를 추가하지 않는다 | 제안서 §수용 기준(보안·호환성) | 제안서 | ACTIVE | — |
| D-033 | 기존 테스트를 단순 삭제해 green 을 만들지 않는다. 이동한 책임에 맞춰 경로/이름을 바꾸고 같은 행동을 계속 검증한다 | 제안서 §검증 지침 | 제안서 | ACTIVE | — |
| D-034 | 구현은 Phase A(이동) → Phase B(소비 역전) → Phase C(제거) 3커밋. 각 phase 가 lint/typecheck/test 를 독립적으로 통과한다. Phase A 와 B 사이에서 `features/providers` 와 새 디렉터리를 **동시에 장기 운영하지 않는다** | 제안서 §구현 순서 | 제안서 | ACTIVE | — |
| D-035 | 같은 변경에서 `docs/arch/`·GLOSSARY·폐쇄망 확장 가이드·IPC 문서를 실제 코드에 맞게 갱신한다 | 제안서 머리말·Phase C | 제안서 | ACTIVE | — |
| D-036 | `AuthSecretReader.read` 는 **동기** 계약을 유지한다 (MCP resolver 가 동기) | 제안서 §AuthRuntime 코드블록 주석 | 제안서 | ACTIVE | — |
| D-037 | 시간 기반 만료는 기존 snapshot/request/resume 판정 지점에서 처음 관측될 때 한 번 전이한다. 이 리팩터링을 이유로 polling 을 추가하지 않는다 | 제안서 §AuthRuntime | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-037 (신규 handoff — 제안서에서 전량 추출).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0028(토큰을 settings.json 에 쓰지 않는다) · 0117(`settingSources: ['project','local']`) · 0173(main 원격 요청 = Chromium `net.fetch`) · 0174(probe 는 `finalUrl` 까지 본다) · 0181(gate 는 probe 필수) · 0182(session group 부팅 등록) · 0183(사용량 선언 슬롯 금지) · 0186(Usage main 정본) · 0187 D2(부팅 방송 상한 `1 + K`). 각각 D-005·D-007·D-018·D-026·D-028 로 본 plan 에 명시 승계했다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** | 원인은 "`Provider` 하나가 gate/llm/service 분류 + env 형상 + tool factory 를 함께 안다" 이고, 제안서의 제거 대상(`kind`·`llm`·`tools`·`materialize`)이 정확히 그 필드들이다. `contracts/provider.ts:197-216` 실측 |
| 이미 기존 코드가 충족하는가 | **아니오** | `Provider.llm` 은 `{adapter, provider, envKey}` 3필드뿐이고 `ProviderApiImpl.materialize()` 는 `{[envKey]: secret}` 한 쌍만 만든다(`auth/api.ts:236-259`). URL·모델 변수·flag 를 인증 결과에서 파생할 표면이 없다 |
| 더 작은 해법이 있는가 | **부분적으로 있으나 요구와 다르다** | `Provider.llm.envKey` 를 `env: Record<string,string>` 으로 넓히기만 해도 정적 다중 env 는 되지만, "OAuth 로 config API 를 부른 뒤 응답을 env 로" 는 안 된다(비동기·캐시·만료가 필요). 제안서가 요구하는 것은 계약 확장이 아니라 **소유권 이동**이다 |
| "제거" 요구인가 "이동" 요구인가 | **명시적으로 이동 + 제거가 섞여 있고 제안서가 구분한다** | 제거: `Provider.kind/llm/tools`, `ProviderApi.materialize`, `ProviderPlatform`, `features/providers/` 디렉터리, `ServiceToolRegistrar` 범용 registrar. 이동: auth/gate/harness/confluence 구현. 재해석하지 않는다 |
| 선행 자료의 주장을 코드와 대조했는가 | **대조했고 1건 정정** | 제안서 §AS-IS 는 `UsageFetcher` 를 "목표 구조의 선례" 라 했다 — `features/usage/fetcher.ts:48-55` 실측 일치. 반면 제안서 §Bootstrap AS-IS 의 `provider IPC 등록 + resume` 순서는 실제로 `registerProviderHandlers` → `void providers.resume()` → `attachTokenSource` 순이다(`app/bootstrap.ts:350-358`) — TO-BE 배선에서 이 순서를 그대로 보존한다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | **충돌 없음, 단 1건 주의** | 0183 이 "`Provider.usage` 슬롯을 두지 않는다" 를 잠갔고(`contracts/provider.ts:218-221`) 제안서도 같은 금지를 유지한다(D-026). 0187 D2 가 부팅 방송 상한 `1 + K` 를 잠갔고(`auth/login.ts:158-167`) 제안서 §수용 기준이 같은 상한을 요구한다(D-028) |
| eslint boundaries 를 위반하는가 | **위반하지 않는다** | 신규 `app/deployment/` 는 `app` 레이어 하위 디렉터리라 boundaries 의 `app` element 에 매칭된다. `features/harnesses` 가 `adapters/harness-config.ts` 를 import 하는 것은 하향 방향이라 허용(`src/main/AGENTS.md §레이어 DAG`) |

- **사용자에게 올릴 결정**: **없음.** 제안서가 모든 갈림길에 값을 명시했고(용어·디렉터리·우선순위·cache 정책·금지 목록), 남은 것은 코드 조사로 닫힌다. 단 아래 1건은 *구현 중 실측으로* 닫는다.
- **구현 중 실측으로 닫는 항목**: `options.settings.env` 와 `options.env` 중 무엇이 이기는지(D-017). 제안서가 두 결과 각각의 조립 방법을 이미 결정표로 줬으므로 사용자 결정이 아니라 **characterization test 대상**이다.
- **코드 조사로 닫은 사실**: ① 세 배포 선언 배열이 전부 빈 배열이다(`declarations/{sso,llm,service}.ts`) → 기본 빌드의 관측 동작 변화는 0이어야 한다. ② `buildTurnEnv` 만이 credential 을 subprocess 로 나르는 유일한 seam 이다(`chat-turn/turn-setup.ts:86-100`). ③ listen request 는 현재 `env` 를 싣지 않는다(`chat-turn/continuation.ts:32-41`) — 제안서가 지적한 그대로다. ④ spawn 기록은 `providerSettings`·`model`·`runtimeToolsRevision` 3종뿐이고 env 는 기록하지 않는다(`session-runtime.ts:345-347`).

## 5. 동작 / 사용자 흐름

이 리팩터링은 **화면 재설계가 아니다.** 사용자가 관측하는 흐름은 변경 전후가 같아야 한다.

```text
[앱 시작]
  → 창이 열리고 renderer 가 연결 상태를 1회 invoke (DB 초기화 대기 없음)
  → gate Auth 순차 resume ("resuming" 표시)
  → gate 통과 → 나머지 Auth 1회 병렬 resume → 성공분 full-state push 1회
  ↘ gate 실패 → 로그인 화면에 수동 로그인 버튼

[카탈로그에서 연결/재인증/해제 클릭]
  → AuthRuntime 의 login/reauth/revoke 만 실행
  → 상태 push → 같은 mapper 가 ProviderPlatformState 재조립
  ↘ 실패 → 같은 폼 재표시 또는 failed step
  (Plugin fetch · Usage refresh · Harness config resolve 를 호출하지 않는다)

[chat 턴 전송]
  → settings SSOT 에서 Harness+ModelProvider+Model 선택
  → HarnessRuntimeConfig 1회 resolve (정적 구성이면 network 0)
  → PreparedHarnessConfig 조립 + fingerprint 비교
  → 같으면 persistent runtime 재사용, 다르면 respawn
  → title generation 과 chat 이 같은 snapshot 사용

[자동 continuation]
  → 전체 runtime config 1회 재resolve (warm cache 허용)
  → listen/flush 가 같은 결과 공유, fingerprint 변경이면 continuation 전 teardown
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 입력 form / OAuth code 대기 / `resuming` / 실패 message | GUI push O · Gate 재평가 O · Plugin tool sync **X** · Harness invalidate **X** | 화면만 갱신. 도구 목록·실행 구성 불변 |
| 기존 Grant 의 probe 성공으로 `verified` 만 변경 | GUI push O · Gate 재평가 O · Plugin sync **X** · Harness invalidate **X** | 게이트가 열린다. runtime tool revision 불변 |
| credential commit / revoke / expiry / 401·403 강등 | GUI push O · Gate O · Plugin sync O · **영향 key 만** Harness invalidate | 도구가 나타나거나 사라지고, 다음 턴이 새 실행 구성으로 spawn |
| 재인증 실패 | 기존 Grant·vault·`credentialRevision` 그대로 | 이전 자격증명으로 계속 쓸 수 있다 |
| settings.json 외부 편집 | 다음 resolve 의 mtime 검사 → 새 `sourceRevision` → cache miss | 다음 턴에 새 settings 적용 |
| 앱 내 settings CRUD/deploy | 즉시 `invalidateAll()` + runtime config invalidate | 다음 턴에 새 settings 적용 |
| 무효화 중 완료된 옛 in-flight resolve | cache commit 차단 + 최신 세대 bounded retry | 낡은 token 이 되살아나지 않는다. 소진 시 명시적 stale-config 오류 |
| 한 caller 의 취소 | 그 caller 의 대기만 종료 | 같은 single-flight 를 기다리는 다른 caller 는 정상 resolve |

### 파생 UX / 엣지케이스

- **loading/empty/error**: gate 의 초기 상태·resume 표시·인증 방식 선택·입력 form·우회 debug 동작 전부 현행 유지.
- **cancel/retry/restart**: 재인증 실패 시 같은 폼 재표시, OAuth·browser-session 실패는 `failed` step. 앱 재시작 시 grant 복원만으로 gate 를 열지 않는다.
- **concurrency**: 같은 key·generation·sourceRevision 의 동시 첫 조회만 single-flight 로 합친다.
- **폐쇄망/오프라인**: 정적 구성에서 추가 network 호출 0. 미인증 augmenter 는 fail-closed(빈 문자열 치환 금지, `null`/미주입).
- **a11y/theme/markup**: markup·CSS class·i18n 문구·클릭 횟수·IPC 왕복 패턴 불변.

## 6. 범위 / 비범위

- **범위**: `app/src/main/` 의 `contracts`·`features/providers`·`features/extensions`(HarnessPlugin packaging 위치)·`adapters/provider-config.ts`·`app/bootstrap.ts`·`app/context.ts`·`app/handlers/providers.ts`·`app/chat-turn/**`·`app/chat-turn-continuation.ts`·`features/sessions`(respawn 입력)·`features/usage`(fetcher 배선) + 관련 테스트 + `docs/arch/backend/providers.md`·`docs/GLOSSARY.md`·`docs/guides/closed-network-extensions.md`·`docs/IPC_CONTRACT.md`·`src/main/AGENTS.md`·`docs/generated/inventory.md`.
- **비범위**(제안서 §비범위 그대로): LLM request broker / subprocess env secret 비노출 · runtime 동적 Plugin 설치 · UI 디자인·카탈로그 정보구조·문구 변경 · Usage 계산식·DB schema·원격 endpoint 명세 변경 · 동적 API 가 반환한 Model 목록의 카탈로그 실시간 반영 · 전체 저장소의 레거시 IPC/DB 식별자 일괄 개명.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| shared `ProviderKind`/`ProviderInfo`/채널 개명 | **예 — 공개 IPC 계약** | 그래서 **지금 바꾸지 않는다**(D-030). UI migration 을 별도 handoff 로 남기고 compat boundary 를 명시 문서화 |
| vault key prefix / `AuthId` 문자열 개명 | **예 — 저장된 secret** | 지금 바꾸지 않는다(D-005). 변경하려면 secret migration + rollback 설계가 선행 |
| DB `provider_key` 컬럼 의미 정리 | 예 — 데이터 | 지금 바꾸지 않는다(D-031). boundary 변환만 |
| LLM request broker | 아니오 | 후속 |

> 비범위가 범위의 실행을 막지 않는지 확인: 사람 실기(폐쇄망 gate 로그인·Plugin 인증·Harness turn·Usage refresh)는 실배포 환경이 필요하지만, **기본 빌드의 빈 선언 상태에서 자동 검증 가능한 경로**(구조·타입·wire 동등성·cache/fence/fingerprint 단위 테스트)로 AC 대부분을 닫는다. 실서버 없이 닫히지 않는 항목만 §7 에서 사람 실기로 분류한다.

## 7. Acceptance Criteria — 제품 계약

> AC 수는 25건이다(설계 시점 24건 + r3 의 AC25). 25건 초과 분할 검토 결과: **분할하지 않는다** — 제안서 §구현 순서가 "Phase A 와 B 사이에서 두 디렉터리를 동시에 장기 운영하지 않는다" 를 명시했고, Phase 를 handoff 로 쪼개면 그 금지를 지킬 수 없다. 대신 각 AC 에 Phase 를 태깅해 커밋 단위 검증을 가능하게 한다.

| # | Phase | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| AC1 | A/C | `app/src/main/features/providers/` 디렉터리가 존재하지 않고, 저장소 어디에도 그 경로를 import 하는 코드가 없다 | `test -d` 부재 + `rg "features/providers"` 가 `docs/archive/`·`git log`·본 handoff 문서를 제외하고 0건. lint(boundaries)·typecheck 통과 | 빌드 |
| AC2 | B | Auth 계약(`contracts/auth.ts`)에 `kind`·`llm`·`tools`·`usage`·`envKey` 식별자가 없다 | 타입 정의 grep 0건 + typecheck. `AuthDefinition` 의 키 목록을 단언하는 타입 테스트 | 빌드 |
| AC3 | A/B | Gate 는 `features/gate/` 에 있고 `features/auth/**` 가 `features/gate` 를, `features/auth/**` 가 `features/{harnesses,plugins,usage}` 를 import 하지 않는다 | import 방향 grep 0건 + eslint boundaries(feature 교차 import error) | 빌드 |
| AC4 | B | Gate 는 `status==='valid' && verified===true` 를 모두 요구하고, probe 없는 gate 정의는 컴파일되지 않으며 부팅 composition 에서도 fail-closed 된다 | 순수 단위 테스트: `{valid, verified:false}` → `passed:false`; `{valid, verified:true}` → `passed:true`; probe 없는 gate 후보 배열 → gate 미통과 + 진단. 타입 레벨은 `AuthDefinition & { probe: AuthProbe }` 대입 실패를 typecheck 로 | 부팅 gate 평가 → renderer gate 화면 |
| AC5 | B | `BoundAuth` 에 raw credential 조회 표면이 없고, `AuthSecretReader` 는 composition 결과에만 존재하며 `RouterContext`·renderer IPC·일반 feature dependency 에 없다 | `BoundAuth` 인터페이스 멤버 단언 + `rg "secretReader"` 결과가 composition 파일과 MCP/augmenter closure 배선에만 존재. `RouterContext` 타입에 부재 | MCP `${BINDING:<id>}` 해석 · Harness direct-credential augmenter |
| AC6 | B | Auth event 가 `step` 과 `snapshot` 을 구분하고, snapshot 이 `cause`·`credentialChanged`·`credentialRevision` 을 싣는다. UI step 과 `verified`-only 변화는 `credentialChanged:false` 이고 `credentialRevision` 을 올리지 않는다 | 단위 테스트: 입력 form emit → `kind:'step'`; resume 성공 → `snapshot`·`cause:'verified'`·`credentialChanged:false`·revision 불변; credential commit → `credentialChanged:true`·revision +1; 같은 상태 재관측 → revision 불변 | Auth listener → Harness invalidate / Plugin sync |
| AC7 | B | 실패한 재인증이 기존 Grant·vault 값·`credentialRevision` 을 보존한다 | 단위 테스트: 유효 grant 상태에서 reauth → probe 실패 → `snapshot().status` 와 `credentialRevision` 이 이전과 동일, vault 의 이전 값 유지 | 카탈로그 [재인증] 버튼 |
| AC8 | B | `AuthenticatedRequest`/`AuthenticatedResponse` 가 binary body·`maxBytes`·`finalUrl`·headers·redirect 중 Grant 변경 감지·origin 재검사·`AbortSignal` 전달·401/403 강등을 모두 보존한다 | 기존 `auth/api.test.ts`(325줄, 케이스 존재 확인함)를 이동·개명해 같은 단언을 유지 + policy/redirect 테스트 통과 | Confluence 첨부 다운로드 · probe |
| AC9 | B | ModelProvider 선택 목록이 기존 settings entry 열거에서만 나오고, 별도 definition 배열/registry 가 없다 | `rg "HarnessModelProviderDefinition"` 0건 + `orca:agent:list` 페이로드가 settings 디렉터리 열거에서 파생됨을 단언하는 기존 테스트 유지 | 설정 화면 Harness/Model 선택 |
| AC10 | B | `llm.ts` 대체 모듈(`app/deployment/harness-runtime.ts`)의 augmenter 가 API key 한 값뿐 아니라 URL·Model 변수·flag·실행 token 을 포함한 **전체 `runtimeEnv` overlay** 를 반환할 수 있다 | 문서 예제를 그대로 대입한 typecheck 픽스처 + 단위 테스트: 다중 키 overlay 를 반환하는 augmenter → `HarnessRuntimeConfig.runtimeEnv` 에 전부 실림 | 폐쇄망 배포 빌드 |
| AC11 | B | 정적 구성(augmenter 없음)에서 추가 network 호출이 0이고, warm cache 조회가 기존 settings mtime stat 외에 network·vault·추가 file 접근을 만들지 않는다 | 단위 테스트: 주입된 fetch/vault/fs 스파이의 호출 수를 세대별로 단언(augmenter 미등록 key → fetch 0, vault 0). warm hit 2회차 → stat 만 증가 | 매 chat 턴 hot path |
| AC12 | B | settings 파일 외부 편집(mtime 변화)이 runtime config cache miss 로 이어진다 | 단위 테스트: 같은 key 를 두 번 resolve, 사이에 mtime 변경 → augmenter 재호출 + 새 `sourceRevision` | 사용자가 에디터로 settings.json 수정 |
| AC13 | B | 무효화 중 완료된 옛 in-flight resolve 가 cache 에 commit 되지 않고 현재 caller 에도 반환되지 않으며, bounded retry 소진 시 명시적 stale-config 오류로 끝난다. 401/403 로 Auth 가 강등된 요청은 자동 재시도하지 않는다 | 결정론적 단위 테스트: augmenter 를 수동 resolve 가능한 deferred 로 주입 → resolve 시작 → `invalidate()` → deferred 완료 → ① cache 비어 있음 ② 첫 caller 가 옛 값을 받지 않음 ③ 재시도 횟수 상한 후 named error | 재인증 도중 진행 중이던 턴 |
| AC14 | B | 같은 key·generation·sourceRevision 의 동시 요청만 single-flight 를 공유하고, 한 caller 의 `AbortSignal` abort 가 다른 caller 의 resolve 를 취소하지 않는다. invalidation 만 공유 operation 을 abort 한다 | 단위 테스트: caller A·B 동시 resolve(augmenter 호출 1회 단언) → A 의 signal abort → B 가 정상 값 수신. 별도 케이스: invalidate → 공유 signal 이 aborted | 동시 턴 · continuation |
| AC15 | B | `runtimeEnv` · settings env · app env · process env 의 최종 subprocess 값이 제안서 우선순위(`augmenter > settings env > app env > process env`)를 만족하고, 동적 값과 충돌하지 않는 기존 settings env 의 최종 값은 변경 전과 같다. 디스크 `settings.json` 은 수정되지 않는다 | ① characterization test 로 SDK 의 `options.settings.env` vs `options.env` 실제 우선순위를 먼저 고정 ② 그 결과에 맞춘 adapter-local 조립의 최종 `options` 스냅샷을 단언(충돌 키/비충돌 키 각각) ③ 조립 전후 settings 파일 mtime·내용 불변 단언 | chat 턴 spawn |
| AC16 | B | Auth 에서 얻은 secret 과 config API 의 LLM token 이 `options.env` 에만 있고 `options.settings`·argv 에 복제되지 않으며, 원문·fingerprint 가 로그·DB 에 남지 않는다 | 단위 테스트: 조립 결과 `options.settings` 문자열에 secret 미포함, argv 미포함. 로그 스파이에 secret/fingerprint 문자열 부재 | chat 턴 spawn |
| AC17 | B | 같은 turn 의 title generation 과 chat Harness 가 같은 prepared snapshot 을 쓰고, runtime config resolve 가 그 turn 에 1회만 일어난다 | 단위 테스트: resolve 스파이 호출 1회 + title 경로와 chat 경로가 동일 객체 참조를 받음 | chat 턴 + 자동 제목 |
| AC18 | B | 자동 continuation 이 continuation 마다 전체 runtime config 를 1회 재resolve 하고, 같은 continuation 의 listen 과 flush 가 **둘 다** 그 결과의 `providerSettings` 와 `env` 를 같은 값으로 전달한다 | 단위 테스트: `prepareAutomaticContinuation` 결과를 `buildListenRequest`/`buildFlushRequest` 에 넣어 두 request 의 `env`·`providerSettings` 가 동일. continuation 2회 → resolve 2회 | 자동 연속 턴 |
| AC19 | B | Auth·settings 가 바뀌지 않으면 persistent runtime 을 재사용하고, token·URL·모델 환경변수가 바뀌면 다음 turn/continuation 이 stale subprocess 를 재사용하지 않는다. 기존 boundary·model·settings·runtime tool revision 판정은 그대로 남고 **새 입력과 축이 겹치지 않는다** (r2 개정 — D-038) | 순수 respawn 판정 테스트: 동일 env fingerprint → `shouldRespawn:false`; env 만 다른 fingerprint → `true`; 기존 4개 입력의 개별 true 케이스가 여전히 `true`. 추가로 **settings 해석 실패 턴이 respawn 을 유발하지 않는다**(비-env settings) | chat 턴 · continuation |
| AC20 | B | Plugin 도구가 valid 상태에서만 registry 에 등록되고 해제·만료·401/403 에서 회수되며, 반복 sync 가 runtime tool revision 을 올리지 않는다. `verified`-only/step 변화에는 sync 가 일어나지 않는다 | 단위 테스트: 같은 상태로 sync 3회 → registry revision 불변 + 동일 server 인스턴스 identity; `credentialChanged:false` change → sync 미호출(스파이) | Auth 상태 변화 → 다음 spawn 의 도구 목록 |
| AC21 | B | 카탈로그가 Auth invalid 상태에서도 cached descriptor 의 완전 도구 이름을 계속 표시하고, 실제 Harness 노출만 회수된다 | 단위 테스트: revoke 후 view mapper 결과의 `tools` 배열이 비지 않고 이전과 동일, 동시에 registry 에서는 제거됨 | 카탈로그 상세 화면 |
| AC22 | B/C | `ProviderInfo` 의 `id·label·kind·origin·auth·status·activeAuthKind·principal·expiresAt·tools` 전 필드와 `ProviderPlatformState.step` 이 새 mapper 결과에서 유지되고, row 순서·개수가 보존되며 `authId` 가 중복되지 않는다. renderer 에 새 kind 가 없다 | 단위 테스트: 대표 view source 배열 → 기존 DTO 와 필드별 동등성 단언 + `kind` 값 집합이 `{gate,llm,service}` 부분집합 + authId 유일성 | `orca:provider:list` / `orca:provider:state` |
| AC23 | B/C | 부팅에서 connection handler·Auth listener·cached Plugin tool server 초기 sync 가 비동기 resume 전에 완료되고, gate Auth 를 순차 resume 한 뒤 나머지 Auth 만 1회 병렬 resume 하며, 전체 상태 방송 횟수가 즉시 강등 `K` 건 포함 최대 `1 + K` 다 | 순서 관측 가능한 테스트 하네스: 각 단계가 공유 로그 배열에 이름을 push → 순서 단언. 방송 스파이 호출 수 = `1 + K`(K=0,1,2 케이스) | 앱 시작 → 로그인 화면 |
| AC24 | C | 새 DB migration 이 없고 기존 세션의 `provider_key` 를 계속 해석하며, 신규 production dependency 가 없다. 아키텍처·용어집·폐쇄망 가이드·IPC 문서가 실제 코드와 일치한다 | `check-migrations-appendonly.mjs` + `package.json` dependencies diff 0 + `check-doc-inventory.mjs --check` 통과 + 문서의 `features/providers` 서술 잔재 0건 | 릴리스 빌드 |
| AC25 | C | (r3 신설) 비어 있지 않은 가상 배포 4종(gate·harness·plugin·usage)이 `app/deployment/` 의 factory 인자만으로 조립되고, Plugin 도구 등록/회수 · augmenter 두 방식 · `UsageFetcher` · 카탈로그 4행이 모두 성립한다. 배포는 `bootstrap.ts` 를 열지 않는다 | `deployment-wiring.test.ts`: factory 는 주입 인자(`AuthRuntime`·`RuntimeToolSink`·AuthId 를 닫은 secret closure)만 쓰고, 카탈로그 row 의 `id`·`kind`·`tools.length` 를 순서까지 단언 | 폐쇄망 배포 빌드 |

### AC 검증 주의사항

- **기존 테스트 재사용**: 케이스 존재를 실측 확인했다 — `features/providers/auth/api.test.ts`(325줄: request/redirect/401 강등/binary), `auth/login.test.ts`(859줄: credential/oauth/session/resume/sweep), `auth/policy.test.ts`(235줄), `gate/gate.test.ts`(134줄: 진리표), `provider-settings.test.ts`(289줄: mtime cache), `service/index.test.ts`(148줄: tool sync 멱등), `provider-boundary.test.ts`, `claude-model-parser.test.ts`. **전부 이동·개명해 같은 행동을 계속 단언한다**(D-033).
- **사람 실기 항목**: 폐쇄망 실서버의 gate 로그인·Plugin 인증·실제 Harness turn·Usage refresh. 순수 로직(우선순위 병합·fence·fingerprint·view mapping·gate 진리표)은 **전부 단위 테스트로 내렸다** — 사람 실기로 미루지 않는다.
- **N회/순서 기준의 관측 지점**: 방송 횟수는 `pushConnectionState`/broadcast 스파이의 **총 호출 수**로 센다(호출 지점 grep 아님). 부팅 순서는 주입된 단계 로거 배열로 관측한다. resolve 횟수는 augmenter 스파이의 호출 수로 센다.
- **총량/0건 기준 분해**: AC1 의 `rg "features/providers"` 는 ① 현재 코드 ② 테스트 ③ current-state 문서를 대상으로 하고, `docs/archive/`·`docs/handoff/<과거 NNNN>/`·본 handoff 문서·`git log` 는 **이력이므로 제외**한다. AC2 의 식별자 grep 은 `contracts/auth.ts` 내부로 한정한다(`ProviderKind` 는 shared 에 compat 으로 남으므로 전역 0건이 아니다).
- **structural proxy 회피**: AC17 은 "resolve 1회" 라는 수치만 보지 않고 **title 경로와 chat 경로가 동일 객체를 받는지**를 함께 단언한다. AC20 은 "revision 불변" 과 **동일 인스턴스 identity** 를 함께 단언한다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `Provider` 계약이 `kind`·`probe`·`tools`·`llm` 을 한 인터페이스에 갖는다 | `app/src/main/contracts/provider.ts:197-216` |
| `ProviderApi` 3표면 = `request`/`materialize`/`token` | `app/src/main/contracts/provider.ts:259-267` |
| `materialize()` 는 `{[llm.envKey]: secret}` env 한 쌍 + header 를 만든다 | `app/src/main/features/providers/auth/api.ts:236-259` |
| `llmEnvFor()` 가 `materialize().env` 를 그대로 턴 env 로 흘린다 | `app/src/main/features/providers/llm/index.ts:35-43` |
| 턴 env 조립 = app env(`${VAR}` 확장) + credentials, `mergeEnvLayers(undefined, …)` | `app/src/main/app/chat-turn/turn-setup.ts:86-100` |
| settings 는 별도 채널(`options.settings` = `adaptSettings(JSON.stringify)`)로 간다 | `app/src/main/adapters/claude-adapt.ts:82-84`, `adapters/claude.ts:262·381` |
| `settingSources: ['project','local']` 고정(0117) | `app/src/main/adapters/claude-adapt.ts:92-94` |
| spawn 기록은 `providerSettings`·`model`·`runtimeToolsRevision` 3종. **env 는 기록하지 않는다** | `app/src/main/features/sessions/session-runtime.ts:345-347` |
| respawn 판정 입력 4종 | `app/src/main/features/sessions/respawn-policy.ts:1-19` |
| listen request 가 `env` 를 싣지 않는다 | `app/src/main/app/chat-turn/continuation.ts:32-41` |
| settings cache = `providerKey → {settings, mtimeMs, srcPath}` + list/adapters cache, `invalidateAll()` | `app/src/main/features/providers/provider-settings.ts:60-140` |
| `ServiceToolRegistrar` 가 provider 당 tool server 를 1회 만들어 캐시(identity 유지) | `app/src/main/features/providers/service/index.ts:37-100` |
| 부팅: provider 플랫폼 → 핸들러 등록 → `void resume()` → `attachTokenSource` → DB → … → settings service → scaffold → deploy → `invalidateAll()` | `app/src/main/app/bootstrap.ts:345-532` |
| resume 순서 = gate 순차 → `sweepPlugins()` 병렬 + 통지 1회 (`1 + K`) | `app/src/main/features/providers/auth/login.ts:134-180` |
| `onProviderChange` 하나가 tool sync + broadcast 를 함께 수행 | `app/src/main/app/bootstrap.ts:259-263` |
| gate 진리표(선언 0 + prod = 통과, DEV = 항상 게이트, `valid && verified`) | `app/src/main/features/providers/gate/index.ts` |
| `UsageFetcher` 는 `supports`/`fetchUsage` 2메서드 구조적 포트, 현재 `undefined` 주입 | `app/src/main/features/usage/fetcher.ts:48-55`, `app/src/main/app/bootstrap.ts:408` |
| 레이어 DAG + feature 교차 import 금지를 eslint boundaries 가 강제. `src/main` 최상위는 `{app, contracts, adapters, features, infra}` 만 | `app/src/main/AGENTS.md §레이어 DAG`, `§두 가지 강제 규칙` |
| main 전역 `fetch` 금지 가드가 테스트로 존재 | `app/src/main/infra/net/no-node-fetch.test.ts` (`src/main/AGENTS.md §원격 요청`) |
| 문서 수치는 `docs/generated/inventory.md` 가 소유하고 CI 가 강제 | `app/scripts/check-doc-inventory.mjs`, root `AGENTS.md` 원칙 4 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `features/providers` 디렉터리 파일 | `find src/main/features/providers -type f` | **41** (구현 27 · 테스트 14) | Phase A 이동 대상 전량 |
| `features/providers` 를 import 하는 파일 | `rg "features/providers" src/ --files-with-matches` | **본문에서 재측정 대상** — bootstrap·context·chat-turn 4종·chat-turn-continuation·handlers/providers·handlers/misc·handlers/engine·title-generation 등 | Phase A 에서 전부 전환 |
| `ProviderApi.materialize` 소비처 | `rg "materialize"` | `contracts/provider.ts` 선언 · `auth/api.ts` 구현 · `llm/index.ts` 소비 · `platform.ts` 주석 · `auth/api.test.ts` | 제거 시 영향 범위가 좁다 |
| `ProviderApi.token` 소비처 | `rg "attachTokenSource\|api.token"` | bootstrap 1곳 + mcp store | `AuthSecretReader` closure 로 대체 |
| `declarations` 소비처 | `rg "declarations\("` | `bootstrap.ts`(usage 주석·usage jobs providerKeys) · `turn-setup.ts`(llmEnvFor) · `platform.ts` | Phase B 에서 전부 소멸 |
| respawn 판정 호출처 | `rg "decideRespawn"` | `chat-turn/runtime-entry.ts` · `chat-turn-continuation.ts` + 테스트 | fingerprint 입력 추가 지점 2곳 |
| `providerSettings` 를 나르는 요청 필드 | `rg "providerSettings" src/main` | adapters/turn·types · session-runtime · title-generation · chat-turn 4종 | `PreparedHarnessConfig` 분해 지점 |
| shared `ProviderKind`/`ProviderInfo` 소비 | `rg "ProviderKind\|ProviderInfo" src/` | shared/ipc·protocol + main platform/handlers + renderer providers feature | compat boundary 경계 확정 |

> **구현 착수 시 위 표의 N 을 다시 센다**(파일 이동 중 값이 변한다). 총계는 내역 합과 검산하고, 결과를 `[구현자 기입] 구현 보고` 에 남긴다.

### 수치 / 전칭 표현 검산

- 재측정 수치: `features/providers` 파일 41개(`find | wc -l` = 41), 구현 27 + 테스트 14 = 41 ✓.
- 인벤토리 영향: `main 수직 슬라이스` 는 현재 **9**(`docs/generated/inventory.md`). `providers` 제거 + `auth`·`gate`·`harnesses`·`plugins` 추가 → **12** 로 바뀐다. `main contracts 모듈` 은 현재 **5**(`provider` → `auth` 로 이름만 교체, 수 불변). **두 값 모두 생성물이므로 스크립트 재실행으로 갱신하고 본문에 옮겨 적지 않는다**(root `AGENTS.md` 원칙 4).
- "유일한/항상/절대" 반례 검색: ① "credential 을 subprocess 로 나르는 유일한 seam = `buildTurnEnv`" → `rg "materialize"` 로 반례 없음 확인(다른 호출자 0). ② "main 에서 전역 `fetch` 를 부르는 파일은 `net-fetch.ts` 하나" → 기존 가드 테스트가 강제(`no-node-fetch.test.ts`). ③ "배포 선언 3종이 전부 빈 배열" → 세 파일 말미 `= []` 실측.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `src/main/AGENTS.md` 의 `§레이어 DAG`·`§두 가지 강제 규칙`·`§원격 요청은 Chromium 스택으로만` 실재 확인. `docs/arch/backend/providers.md`·`docs/guides/closed-network-extensions.md`·`docs/GLOSSARY.md`·`docs/IPC_CONTRACT.md` 파일 실재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- **현재 책임 소유자**: `features/providers` 한 슬라이스가 인증 lifecycle · gate 판정 · Harness settings/모델 해석 · Confluence 기능 · GUI DTO 조립 · LLM env 물질화를 전부 갖는다. `ProviderPlatform` 이 그 앞의 단일 facade 다.
- **현재 entry → flow → state → consumer**:

```text
[bootstrap.createProviderPlatform]
  → declaredProviders() 한 배열 (gate|llm|service 가 같은 타입)
  → ProviderRegistry(검사) → ProviderStore(grant 복원) → ProviderApiImpl → ServiceToolRegistrar → ProviderPlatform
  → registerProviderHandlers(platform) → void platform.resume() → mcp.attachTokenSource(api.token)
  → [DB] → ProviderSettingsService → scaffold → deploy → invalidateAll()
  → RouterContext { providers, providerSettings }

[chat:send]
  → resolveTurnProvider(ctx)      : settings 열거 + mtime cache resolve → providerSettings/model/titleModel
  → buildTurnEnv(ctx, providerKey): appEnv 확장 + llmEnvFor(api.materialize) → turnEnv
  → 두 값이 **서로 다른 경로**로 TurnRequest.providerSettings / TurnRequest.env 에 실림
  → acquireTurnRuntime: decideRespawn(boundary, model, providerSettingsChanged, toolsRevision)
  → adapter.sendMessage → options.settings(JSON) + options.env

[자동 continuation]
  → prepareAutomaticContinuation: resolveProvider 재호출(= settings 만 신선)
  → buildListenRequest: providerSettings O, **env X**
  → buildFlushRequest : base spread 라 **옛 env** 유지
```

- **현재 오류/취소/정리 경로**: `ProviderApiImpl` 이 401/403 을 보면 `store.markExpired` + `onChange`(tool sync + broadcast). `LoginService.resume()` 이 gate 순차 → `sweepPlugins()` 병렬 + 통지 1회. settings cache 는 mtime 으로만 무효화되고 `invalidateAll()` 이 앱 CRUD/deploy 후 호출된다.
- **문제의 직접 원인 / 구조적 제약**:
  1. `Provider.llm.envKey` 가 credential **한 값** 만 표현 → URL·모델 변수·flag 를 인증 결과에서 파생할 수 없다.
  2. `Provider.kind`·`tools` 때문에 Auth 코어가 소비자의 제품 분류와 도구 기여를 안다.
  3. 실행 credential 변화와 UI 변화가 `onChange()` 하나로 뭉쳐 있어, 입력 form 한 번에도 tool sync 가 돈다.
  4. spawn 기록에 env 가 없어 **credential 만 바뀐 경우 respawn 이 일어나지 않는다**(stale subprocess 재사용).
  5. continuation 이 settings 만 새로 보고 env 는 갱신하지 않는 비대칭.

### TO-BE — 변경 후 목표 구조와 동작 경로

- **변경 후 책임 소유자**:

```text
AuthRuntime (features/auth)      : 로그인·재인증·해제 · Grant/vault/cookie jar · 인증된 요청 · secret 없는 상태
AuthSecretReader (trusted main)  : MCP binding / Harness direct-credential 에 한한 raw 조회 (동기)
Gate (features/gate)             : 필수 Auth 의 valid + verified 만 소비하는 앱 접근 정책
Harnesses (features/harnesses)   : settings entry 열거·해석 · Model 해석 · runtime config(cache/fence/expiry) · respawn 경계
Plugins (features/plugins/*)     : Confluence REST·Markdown·Runtime Tool 구성
Usage (features/usage)           : UsageSnapshot 의 의미와 합성
app/deployment/*                 : 배포별 concrete (auth 정의 · gate membership · augmenter · plugin · usage fetcher)
app/connection-views.ts          : Auth descriptor/snapshot + 표시정보 → 기존 ProviderInfo DTO 매핑
Bootstrap                        : 위 객체 생성 + 좁은 포트 연결만
```

- **변경 후 entry → flow → state → consumer**:

```text
[Bootstrap.start]
  ├─ [DB 이전] RuntimeToolRegistry + createAuthRuntime(AUTH_DEFINITIONS) → { runtime: auth, secretReader }
  │   └─ mcp.attachTokenSource((id) => secretReader.read(id))
  ├─ [DB 이전] gate = createGate([...]) · plugin concrete 1회 생성 + 초기 tool sync
  │   └─ registerConnectionHandlers({ auth, gate, connections }) → pushConnectionState
  │   └─ auth.subscribe(...)  ← listener 를 resume 보다 먼저
  │   └─ void resumeAuthInCurrentOrder()   (gate 순차 → gate 통과 시 remaining 1회 병렬 → push 1회)
  ├─ [DB 이후] HarnessSettingsService + createHarnessRuntimeConfigService({settings, augmenters})
  │   └─ auth.subscribe(credentialChanged → harnessRuntime.invalidate(고정 key))
  ├─ scaffold → deploy → harnessSettings.invalidateAll() + harnessRuntime.invalidate(undefined, 'settings-deploy')
  ├─ usageFetcher = createCorpUsageFetcher(usageAuth) → UsageTracker
  └─ RouterContext { auth, gate, harnessRuntime, ... }   (secretReader 없음)

[chat:send]
  → settings SSOT 선택 (Harness + ModelProvider + Model)
  → harnessRuntime.resolve(entry)  →  HarnessRuntimeConfig { settings, runtimeEnv, validUntil }   ← 턴당 1회
  → Harness별 spawn preparation    →  PreparedHarnessConfig { providerSettings, env, runtimeEnvFingerprint }
  → decideRespawn(boundary, model, settingsChanged, toolsRevision, **fingerprintChanged**)
  → TurnRequest.providerSettings / TurnRequest.env (두 채널 유지) + title 경로에 같은 snapshot

[자동 continuation]
  → 전체 runtime config 1회 재resolve(warm cache 허용) → PreparedHarnessConfig 1개
  → buildListenRequest / buildFlushRequest 가 **둘 다** 같은 providerSettings + env 사용
  → fingerprint 가 spawn 값과 다르면 continuation 전 teardown
```

- **변경 후 오류/취소/정리 경로**: 401/403 → Auth 강등 → `credentialChanged:true` snapshot → ① GUI push ② Gate 재평가 ③ Plugin tool 회수 ④ 영향 Harness key invalidate(공유 in-flight abort + cached value 제거). caller 취소는 자기 대기만 종료. invalidation 중 완료된 옛 resolve 는 fence 로 폐기 + bounded retry.
- **유지하는 기존 메커니즘**: settings mtime cache · `listCache`/`adaptersCache` · `RuntimeToolRegistry` identity 비교 · `BrowserSessionStore`(infra) · Chromium `net.fetch` 전송 스택 · redirect 홉별 정책 검사 · gate 진리표(DEV 항상 게이트 포함) · `UsageFetcher` 포트 · 기존 IPC 채널/DTO.
- **제거/대체하는 메커니즘**: `Provider.kind/llm/tools` · `ProviderApi.materialize` · `ProviderPlatform` facade · `ServiceToolRegistrar` 범용 registrar(→ Plugin 별 작은 helper) · `declarations/` 단일 진입점(→ `app/deployment/` 분할) · `llmEnvFor`(→ augmenter).

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `features/providers` 1슬라이스가 인증+Harness+Plugin+GUI 조립 | `features/{auth,gate,harnesses,plugins}` + `app/deployment/` + `app/connection-views.ts` | 인증만 공통화(D-002) | `§11` 파일표 · AC1·AC3 |
| Auth 계약 | `Provider{kind,probe,tools,llm}` | `AuthDefinition{id,label,origin,methods,probe?}` | 소비 kind/기여 슬롯 제거(D-006) | `contracts/auth.ts` · AC2 |
| 소비 표면 | `ProviderApi{request,materialize,token}` | `BoundAuth{authId,snapshot,request}` + trusted-main `AuthSecretReader{read}` | secret 표면 축소(D-010) | `features/auth/{authenticated-request,secret-access}.ts` · AC5·AC8 |
| 이벤트 | `onChange()` 단일 콜백 | `AuthChange = step | snapshot(cause, credentialChanged)` + `credentialRevision` | UI 변화와 실행 credential 변화 분리(D-008) | `features/auth/runtime.ts` · AC6·AC7·AC20 |
| Gate | `platform.state()` 안에서 `registry.byKind('gate')` 로 평가 | `features/gate` 가 주입된 `BoundAuth[]` 만 소비, membership 은 `app/deployment/gate-auth.ts` | Auth 가 gate 를 모른다(D-007) | `features/gate/index.ts` · AC4 |
| Harness 실행 구성 | `materialize().env` 한 쌍 + settings 별도 경로 | `HarnessRuntimeConfig{settings, runtimeEnv, validUntil}` + optional `RuntimeConfigAugmenter` | 전체 env overlay 표현(D-013) | `features/harnesses/runtime-config.ts` · AC10·AC11 |
| cache/무효화 | settings mtime cache 만 | + key 별 `generation + sourceRevision + value + in-flight` 세대 1개, selective invalidate | stale token 재유입 차단(D-014·D-015·D-016) | `features/harnesses/runtime-config.ts` · AC12·AC13·AC14 |
| spawn 입력 | `providerSettings` + `env` 를 서로 다른 경로가 조립 | `PreparedHarnessConfig{providerSettings, env, runtimeEnvFingerprint}` 하나로 조립 | title/chat/continuation 동일 snapshot(D-019·D-020) | `adapters` spawn preparation · AC15·AC17·AC18 |
| respawn 판정 | boundary·model·settings·toolsRevision 4입력 | + `runtimeEnvFingerprint` 변경(5번째 입력, 기존 4개 유지) | env credential 교체를 판정(D-021) | `features/sessions/respawn-policy.ts` · AC19 |
| Plugin 도구 | `ServiceToolRegistrar.sync(providers[])` 범용 | Plugin 별 `syncXTools()` helper + 동일 server 인스턴스 | 범용 registrar 금지(D-023) | `app/deployment/plugins.ts` · AC20·AC21 |
| GUI DTO | `ProviderPlatform.info()` | `app/connection-views.ts` 의 `ConnectionViewSource[]` → 기존 DTO | wire 불변 + 내부 분리(D-029·D-030) | AC22 |
| 부팅 순서 | platform → handlers → resume → mcp → DB → settings | Auth/Gate/Plugin/handlers/listener → resume → DB → harness settings/runtime | 첫 invoke 가 DB 를 기다리지 않는다(D-027·D-028) | `app/bootstrap.ts` · AC23 |
| test seam/관측점 | `ProviderApiImpl` 스텁 · `ProviderSettingsService` 실디스크 | + augmenter 스파이 · deferred resolve · 단계 로거 · broadcast 스파이 | fence/순서/횟수 관측(D-015·D-028) | AC13·AC14·AC23 |
| 삭제 vs 이동 | — | **삭제**: `Provider.kind/llm/tools`, `materialize`, `ProviderPlatform`, `ServiceToolRegistrar`, `declarations/index.ts`, `llm/index.ts`(`llmEnvFor`). **이동**: auth/**, gate/**, settings·model·env·boundary·write, confluence/**, claude-plugin-package | — | — | `§11` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `contracts/auth.ts` | Auth 타입 계약 (AuthDefinition·AuthMethod·Grant·AuthenticatedRequest/Response·AuthProbe·AuthSnapshot·AuthChange·BoundAuth·AuthRuntime·AuthSecretReader) | 타입 전용 | features/auth · features/gate · app |
| `features/auth/runtime.ts` | `createAuthRuntime()` — registry·store·login·request 를 묶어 `{runtime, secretReader}` 반환 | deps(persistence·vault·sessions·fetchImpl·logger) → `AuthRuntime` + `AuthSecretReader` | app/bootstrap |
| `features/auth/authenticated-request.ts` | 정책 → credential 주입 → 전송 → redirect 재검사 → 401/403 강등 | `AuthenticatedRequest` → `AuthenticatedResponse` | features/auth 내부, `BoundAuth.request` |
| `features/auth/secret-access.ts` | AuthId → raw secret (동기, trusted-main 전용) | `AuthId` → `string | null` | `createAuthRuntime` 결과에서만 |
| `features/gate/index.ts` | `createGate(members: readonly BoundAuth[])` + 순수 `evaluateGate` | snapshot 집합 + bypass → `ProviderGateState` | app/bootstrap · connection-views |
| `features/harnesses/settings-entries.ts` | settings 디렉터리 열거(Harness/ModelProvider entry + Model) | fs → `HarnessModelProviderEntry[]` | features/harnesses 내부 · handlers |
| `features/harnesses/settings.ts` | native settings 해석 + mtime cache + `sourceRevision` | entry → `ResolvedHarnessSettings` | runtime-config · app |
| `features/harnesses/runtime-config.ts` | settings resolve + optional augmenter + cache/generation fence/single-flight/expiry | entry → `HarnessRuntimeConfig` | app/chat-turn |
| `features/harnesses/runtime-boundary.ts` | respawn 경계 판정(순수) | 이전/현재 key·settings·fingerprint → boolean | app/chat-turn · continuation |
| `features/plugins/confluence/**` | Confluence REST·Markdown·도구 구성 | `request` 포트 + 옵션 → `RuntimeToolServer` | app/deployment/plugins.ts |
| `app/deployment/*.ts` | 배포별 concrete (build-time) | — | app/bootstrap |
| `app/connection-views.ts` | `ConnectionViewSource[]` → `ProviderInfo[]`/`ProviderPlatformState` | view source + auth descriptor/snapshot | app/handlers/providers |
| `adapters/harness-config.ts` | Harness native settings 타입·loader 시그니처 (adapter 포트) | — | features/harnesses · adapters |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `AuthId` 유일성·케밥 소문자·bare origin | `features/auth/registry.ts` | registry 등록 검사 | `createAuthRuntime` 시점 | 그 정의 하나만 거부, 사유 로그 (기존 동작 유지) |
| gate 정의는 probe 필수 | ① 타입 `AuthDefinition & { probe: AuthProbe }` ② `app/deployment/gate-auth.ts` 배열의 원소 타입 ③ 부팅 composition 의 런타임 fail-closed | 컴파일러 + composition | 빌드 + 부팅 | 컴파일 실패 / gate 미통과 |
| `credentialRevision` 단조 증가 | `features/auth/store.ts`(메모리) | Auth runtime | credential commit·revoke·expiry·401/403 | 같은 상태 재관측으로 증가하면 불필요 respawn |
| `credentialChanged` | `features/auth/runtime.ts` 의 change 생성부 | Auth runtime | 모든 snapshot emit | `true` 오발행 = 불필요 network/respawn, `false` 누락 = stale token 사용 |
| `HarnessModelProviderKey` = `${HarnessId}-${string}` | `contracts` 또는 `features/harnesses` 의 `harnessModelProviderKey()` 헬퍼 1곳 | 헬퍼 | 키 생성 시 | 문자열 join 이 흩어지면 조인이 갈린다 |
| `ResolvedHarnessSettings.sourceRevision` | `features/harnesses/settings.ts` | settings service | resolve 시 | adapter 에 새어 나가면 `options.settings` 오염 → **adapter 에는 `settings` 만 전달**(강제: 조립 함수가 `settings` 만 읽는다) |
| `RuntimeConfigAugmenter` 결과 검증 | 배포 모듈의 parse 함수 | 배포 | resolve 시 | 필수 값 누락/빈 문자열이면 부분 env 를 cache 하지 말고 resolve 실패 |
| `runtimeEnvFingerprint`(HMAC digest) | spawn preparation 1곳 | adapter-local | 조립 시 | 계산 위치가 둘이면 같은 입력이 다른 값을 낳는다 |
| `UsageSnapshot.baselineUsable` | 배포 mapper | 배포 | 매핑 시 | **미지정 = false(fail-closed)** — watermark 확인된 경우만 true |
| compat `ProviderKind` 매핑 | `app/connection-views.ts` 1곳 | mapper | DTO 조립 시 | 신규 kind 추가 = renderer 계약 위반 |

- **같은 규칙의 SSOT**: origin 검사는 `features/auth/policy.ts` 의 `isAllowedOrigin` 하나를 계속 쓴다(probe·redirect·browser-session 공용, 현재도 그렇다). 도구 완전 이름은 `adapters/runtime-tool-policy.ts` 의 `runtimeToolFullName` 하나를 계속 쓴다.
- **선택적 필드 의미**: `AuthSnapshot.verified` 는 boolean(미정 없음). `HarnessRuntimeConfig.validUntil` 미지정 = 명시 무효화 전까지 cache 가능. `UsageSnapshot.baselineUsable` 미지정 = false. `RuntimeConfigAugmenters` 의 key 부재 = 정적 구성(augmenter 없음).
- **외부 SDK 경계**: `@anthropic-ai/claude-*` SDK 의 `Options.settings` 는 **JSON 문자열**, `Options.env` 는 `Record<string,string>` 이며 지정 시 subprocess env 를 **대체**한다(`mergeEnvLayers` 가 그래서 process env 스냅샷 위에 얹는다). 이 성질은 characterization test 로 다시 고정한다(AC15).

## 11. 구현 설계

### Phase A — 이동 (동작 불변)

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `contracts/provider.ts` → `contracts/auth.ts` | Auth 타입 계약 | `git mv` 후 Auth 어휘로 개명(`Provider`→`AuthDefinition` 등은 Phase B). Phase A 에서는 **파일 위치와 이름만** | typecheck |
| `adapters/provider-config.ts` → `adapters/harness-config.ts` | Harness native settings 포트 | `git mv` + 타입명 `ProviderSettings`→`HarnessNativeSettings`, `ResolvedProviderSettings`→`ResolvedHarnessSettings`(alias 없이 전량 전환) | typecheck |
| `features/providers/auth/**` → `features/auth/**` | 인증 | `git mv`. `specs/browser-session.ts` 의 `SessionRunner` 를 `browser-session/runner.ts` 로 분리하고 포트·헬퍼는 `specs/browser-session.ts` 에 남긴다 | 기존 테스트 동반 이동 |
| `features/providers/gate/**` → `features/gate/**` | gate 판정 | `git mv` | `gate.test.ts` 동반 |
| `features/providers/{provider-registry,provider-settings,claude-model-parser,model-resolve,env-merge,provider-boundary,engine-write}.ts` → `features/harnesses/{settings-entries,settings,claude/model-parser,models,env,runtime-boundary,settings-write}.ts` | Harness 설정/모델 | `git mv` + import 전환. 배럴 re-export 는 **유지하지 않는다** — 소비처를 직접 전환한다(Phase C 에서 지울 임시 표면을 만들지 않기 위함) | 기존 테스트 동반 |
| `features/providers/service/confluence/**` → `features/plugins/confluence/**` | Plugin | `git mv` | 기존 테스트 동반 |
| `features/extensions/claude-plugin-package.ts` → `features/extensions/harness-plugins/claude.ts` | ClaudeHarnessPlugin packaging | `git mv` + 심볼 `orcaPluginRoot`→`builtInHarnessPluginRoot`, 렌더 함수→`renderClaudeHarnessPlugin`. **manifest package id 문자열은 불변** | `claude-plugin.test.ts`·`deployer.test.ts` |
| 소비처 전량 | import 경로 | `bootstrap.ts`·`context.ts`·`handlers/{providers,misc,engine}.ts`·`chat-turn/**`·`chat-turn-continuation.ts`·`features/chat/title-generation.ts`·`features/sessions/**` | lint·typecheck |

### Phase B — 소비 역전

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `contracts/auth.ts` | Auth 계약 확정 | `AuthDefinition`(kind/tools/llm 없음)·`AuthMethod`(구 `AuthSpec`)·`AuthProbe`·`AuthSnapshot`·`AuthSnapshotChangeCause`·`AuthChange`·`AuthDescriptor`·`BoundAuth`·`AuthRuntime`·`AuthSecretReader`·`AuthenticatedRequest/Response` | 타입 테스트 |
| `features/auth/runtime.ts` (신규) | `createAuthRuntime()` | registry·store·login·request 조립, change 분류(step/snapshot+cause+credentialChanged), `credentialRevision` 관리, `resume(authId, {exposeStep, emitVerifiedChange})` | 순수 단위(전송·vault 는 주입) |
| `features/auth/authenticated-request.ts` | 구 `api.ts` 의 `request` | `materialize`·`token` 제거, 나머지 표면·정책·강등 보존 | 구 `api.test.ts` 이동 |
| `features/auth/secret-access.ts` (신규) | `AuthSecretReader` | `store.secret(authId)` 동기 조회만 | 단위 |
| `features/auth/store.ts` | grant + verified + revision | `credentialRevision` 추가(메모리 단조), 기존 fence 메서드 유지 | 단위 |
| `features/gate/index.ts` | gate 정책 | `createGate(members)` 추가(순수 `evaluateGate` 유지), `AuthDefinition & {probe}` 타입 제약 + 런타임 fail-closed | `gate.test.ts` 확장 |
| `features/harnesses/runtime-config.ts` (신규) | 동적 실행 구성 | `HarnessRuntimeConfigService` — settings resolve + optional augmenter + `generation/sourceRevision/value/in-flight` 1세대 + fence + single-flight + expiry(clock skew 여유) + `invalidate(key?, reason?)` | **순수 파일**(fs·network 주입) |
| `features/harnesses/runtime-boundary.ts` | respawn 경계 | 기존 2함수 유지 + fingerprint 비교 추가 | 순수 |
| `features/sessions/respawn-policy.ts` | 판정 | `runtimeConfigChanged` 입력 1개 추가(기존 4개 유지) | 순수 |
| `features/sessions/session-runtime.ts` | spawn 기록 | `spawnedRuntimeConfigFingerprint` 기록 + teardown 시 초기화 | 기존 테스트 확장 |
| `adapters/` spawn preparation (Claude) | 두 채널 조립 | `PreparedHarnessConfig` 생성: settings/env 우선순위 적용(D-017 결정표) + canonical fingerprint. **secret 은 env 에만** | characterization + 조립 단위 테스트 |
| `app/deployment/auth-definitions.ts` (신규) | Auth 정의 | 기본 빌드는 **빈 배열**(D-012). 현재 3선언 파일의 주석 레시피를 Auth 어휘로 옮겨 보존 | typecheck 픽스처 |
| `app/deployment/gate-auth.ts` (신규) | 필수 gate membership | 객체 참조 목록 | typecheck |
| `app/deployment/harness-runtime.ts` (신규) | augmenter 배선 | 기본 빌드는 빈 매핑. config-API 방식과 direct-credential 방식을 **서로 다른 factory** 로 분리(같은 factory 가 둘 다 받지 않는다) | 문서 예제 typecheck + 단위 |
| `app/deployment/plugins.ts` (신규) | Plugin concrete | Confluence 조립 + `syncConfluenceTools` helper | 단위 |
| `app/deployment/usage-fetcher.ts` (신규) | Usage concrete | `createCorpUsageFetcher(auth)` 형태 문서화 + 기본 빌드 미주입 | 단위 |
| `app/connection-views.ts` (신규) | GUI DTO 조립 | `ConnectionViewSource` union → `ProviderInfo[]` + `ProviderPlatformState`. compat kind 매핑 | 순수 단위 |
| `app/handlers/providers.ts` | IPC | `ProviderPlatform` 대신 `{auth, gate, connections}` 를 받는 `registerConnectionHandlers` | 기존 `providers.test.ts` 개정 |
| `app/bootstrap.ts` | 배선 | 제안서 §Bootstrap TO-BE 순서 그대로 | 단계 로거 하네스 |
| `app/context.ts` | RouterContext | `providers`/`providerSettings` → `auth`/`gate`/`harnessRuntime`. `secretReader` 없음. 미주입 = fail-closed 유지 | typecheck |
| `app/chat-turn/turn-setup.ts`·`resolve-turn.ts`·`turn-context.ts`·`send.ts` | 턴 조립 | `buildTurnEnv` → `PreparedHarnessConfig` 경유. title/chat 동일 snapshot | 단위 |
| `app/chat-turn-continuation.ts`·`chat-turn/continuation.ts`·`runtime-entry.ts` | continuation | 전체 재resolve + listen/flush 양쪽 env 전달 + fingerprint respawn | 순수 단위 |

### Phase C — 제거 + 문서

| 변경/신규 파일 | 책임 | 변경 내용 |
|---|---|---|
| `features/providers/` | — | 비었는지 확인 후 디렉터리 삭제 |
| `features/providers/{platform,llm,service/index,declarations}` | — | 소비 제거 후 삭제 |
| `docs/arch/backend/providers.md` | 아키텍처 | Auth/Gate/Harness/Plugin 4구획으로 재서술. current state 만(델타 이력 금지) |
| `docs/GLOSSARY.md` | 용어 | Harness·Model·ModelProvider·Auth·Plugin·HarnessPlugin 추가, Engine 어휘 정리 |
| `docs/guides/closed-network-extensions.md` | 절차 | 레시피를 `app/deployment/*` 기준으로 개정 (Auth 정의 · augmenter 2방식 · Plugin · Usage fetcher) |
| `docs/IPC_CONTRACT.md` | 계약 | compat boundary 명시(채널·DTO 불변, 내부 소유자만 변경) |
| `src/main/AGENTS.md` | 레이어 가이드 | 슬라이스 표 갱신 + `app/deployment/` 설명 |
| `docs/generated/inventory.md` | 생성물 | 스크립트 재실행 |
| `docs/handoff/INDEX.md` | 보드 | 상태 갱신 |

### 테스트 가능성

- **electron 비의존 분리**: `features/harnesses/runtime-config.ts` 는 fs·network 를 **주입**받는다(`settings` 서비스 포트 + augmenter). `features/auth/**` 는 현재와 같이 `fetchImpl`·`BrowserSessionPort`·`Vault` 주입 구조를 유지해 vitest 대상으로 남는다. Electron 을 무는 파일은 `infra/net/*`·`infra/browser-session.ts` 3개 그대로(`src/main/AGENTS.md`).
- **fence 관측 seam**: augmenter 를 `Deferred` 로 주입해 "resolve 시작 → invalidate → 완료" 순서를 결정론적으로 만든다. 타이머·실시간 대기를 쓰지 않는다.
- **순서 관측**: bootstrap 의 각 단계를 주입 가능한 `onStep(name)` 로 관측한다(테스트 전용 옵션이 아니라 이미 있는 `bootReport.stepSync` 를 확장 활용).
- **방송 횟수 관측**: `broadcastProviderState`(또는 후속 `pushConnectionState`)를 주입 포트로 받아 **총 호출 수**를 센다.
- **characterization**: `options.settings.env` vs `options.env` 우선순위는 SDK 를 실제로 태우는 대신, 현재 adapter 가 만드는 `options` 객체를 캡처해 **SDK 가 받는 입력** 을 고정하고, 우선순위 실측은 SDK 문서/타입 + 기존 `claude-settings.test.ts`·`claude-adapt.test.ts` 의 단언과 대조해 결정표 분기를 고른다. 실측이 불가능하면 **`options.env` 우선 분기**(제안서 결정표 2행)를 택한다 — 그쪽이 settings env 를 in-memory copy 에서 제거해 이중 적용을 원천 차단하므로 fail-safe 다. 선택 근거를 코드 주석과 `[구현자 기입]` 에 남긴다.

## 12. End-to-end 영향

### producer → consumer

```text
AuthRuntime(snapshot/change)
  → app listener 3종 ─┬→ connection-views mapper → ProviderInfo/ProviderPlatformState → renderer
                      ├→ Plugin tool sync → RuntimeToolRegistry → 다음 spawn 의 도구 목록
                      └→ harnessRuntime.invalidate(고정 key) → 다음 resolve → PreparedHarnessConfig → spawn

HarnessSettings(mtime/sourceRevision) ─┐
RuntimeConfigAugmenter(runtimeEnv)     ─┴→ HarnessRuntimeConfig → PreparedHarnessConfig(fingerprint)
                                              → TurnRequest{providerSettings, env} → adapter options
                                              → SessionRuntime spawn 기록 → respawn 판정
```

- **producer 기준**: Auth 는 "실행 credential 또는 그 사용 가능성이 실제로 바뀌었는가" 만 `credentialChanged:true` 로 선언한다.
- **consumer 파생 규칙**: Harness 는 `credentialChanged:true` + **자기 고정 key** 일 때만 invalidate. Plugin 은 `credentialChanged:true` + **자기 authId** 일 때만 sync. 모든 Plugin/ModelProvider 를 재스캔하지 않는다.
- **파생 가능한 합성값이 정본을 우회하지 않는가**: `runtimeEnvFingerprint` 는 respawn 판정에만 쓰고 진단 데이터로 노출하지 않는다. GUI `tools` 는 **cached descriptor** 에서 파생하고 active registry 목록에서 만들지 않는다(D-024).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| renderer 첫 `orca:provider:state` invoke | DB 앞 등록 유지 필요 — 뒤로 밀면 로그인 화면이 빈 채로 멈춘다 | AC23 |
| `RuntimeToolRegistry` revision | 초기 sync 가 resume 보다 늦으면 첫 턴 도구 스냅샷이 달라진다 | AC20·AC23 |
| `mcp.attachTokenSource` | `api.token` → `secretReader.read` 로 교체. 주입 전 배포 설정은 fail-closed 유지 | AC5 |
| `registerUsageJobs(providerKeys)` | 현재 `declarations('llm')` 에서 파생 → settings entry key 로 전환 | AC26 없음 → AC9·AC24 로 커버(열거 SSOT 유지) |
| `registerSettingsReactions(settings, {providers, broadcastProviderState, cost})` | `providers` → 새 push 포트로 교체 | AC22 |
| `handlers/misc.ts`(agent:list)·`handlers/engine.ts`(CRUD → invalidateAll) | 새 서비스 이름으로 전환 + `harnessRuntime.invalidate` 동반 호출 | AC12 |
| `features/chat/title-generation.ts` | `providerSettings` 필드명 유지하되 값 출처가 prepared snapshot | AC17 |

## 13. Lifecycle / 오류 / 정리

- **생성/시작**: `createAuthRuntime` → grant 복원(선언에 없는 id 는 삭제하지 않고 로그) → 세션 group 등록(로그인 전, 0182 유지) → handlers/listener/초기 tool sync → `void resumeAuthInCurrentOrder()`.
- **취소/중단**: caller `AbortSignal` 은 자기 대기만 취소(D-016). `invalidate()` 는 service-owned controller 를 best-effort abort 하고 **abort 성공 여부와 무관하게** completion fence 를 검사한다(D-015).
- **종료/quit/crash**: 기존 shutdown 순서 유지(`Scheduler.stopAll()` → `closeDb`). 세대 상태는 메모리 전용이라 별도 정리 불필요. cached value 는 invalidate 시 즉시 제거되어 이전 secret 이 메모리에 남지 않는다(D-014).
- **retry/timeout/partial failure**: probe 타임아웃 15초 유지. augmenter 실패는 부분 env 를 cache 하지 않고 resolve 실패. stale 재시도는 bounded(소진 시 named error). 401/403 강등 요청은 자동 재시도하지 않는다.
- **cleanup/rollback**: 재인증 실패 시 기존 grant 보존(D-009). Phase 별 커밋이 독립적으로 green 이므로 phase 단위 revert 가 가능하다.

## 14. 성능 / 상한 / 최적화

- **새 요청 수**: 정적 구성 = **0**(augmenter 미등록 key 는 network 를 만들지 않는다). 동적 구성 = `key 당 세대당 1회` × single-flight 로 합쳐진 동시 요청. worst case 는 `영향받은 key 수 × (1 + bounded retry 상한)`; retry 상한을 상수로 고정한다.
- **턴 hot path**: 기존 settings mtime `stat` 1회 외에 동적 layer 가 network·vault·추가 file 접근을 만들지 않는다(warm cache). fingerprint 계산은 이미 메모리에 조립된 settings+env 에 대한 canonical 직렬화 1회이며, 같은 prepared 입력을 재사용할 때는 계산값도 재사용한다.
- **부팅 방송 상한**: `1 + K` 유지(D-028). 악화 금지.
- **구조적 목표**: "슬라이스 수" 같은 수치 목표를 세우지 않는다 — 인벤토리가 생성물이다(root `AGENTS.md` 원칙 4). 유일한 구조 목표는 **`features/providers/` 부재**(AC1)이고, `§11` 의 파일 이동표가 그 달성 경로다.
- **캐시로 잃는 부수 효과**: ① warm cache 는 외부 파일 편집을 요청 한가운데서 감지하지 않는다 — 다음 resolve 의 mtime 검사에서 발견한다(제안서 명시, AC12 가 그 시점을 고정). ② 요청당 1회 credential 해석(0187)은 그대로 유지하고 홉별 grant fence 도 유지한다(AC8).

## 15. 외부 구현 포트 / 문서 계약

- **외부/배포가 구현할 port/schema/config**: `AuthDefinition[]`(+ gate 용 `& {probe}`) · `RuntimeConfigAugmenters` · Plugin 조립 + tool sync helper · `UsageFetcher`.
- **구현 문서**: `docs/guides/closed-network-extensions.md` 를 `app/deployment/*` 기준으로 개정(D-035).
- **shape 검증**: 가이드의 각 레시피 코드블록을 **실제 타입에 대입하는 typecheck 픽스처**로 고정한다(AC10). 제안서가 준 `CLAUDE_CORP_KEY`/`createRuntimeConfigAugmenters`/`createCorpUsageFetcher` 예제 형태를 그대로 통과시킨다.
- **semantics 검증**: ① `supports()` 는 배포 지원 여부이지 Auth 상태가 아니다 — 미인증에서도 `true` 를 유지하고 `fetchUsage()` 가 오류를 전파한다(AC 없이 넘어가지 않도록 단위 테스트로 고정). ② augmenter 는 필수 값 누락 시 **실패**하고 부분 env 를 반환하지 않는다. ③ config-API augmenter 에는 `AuthSecretReader` 를 전달하지 않는다(AC5). ④ direct-credential augmenter 에만 AuthId 를 닫은 `readSecret()` 을 전달한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0028 — 토큰을 settings.json 에 쓰지 않는다 | `features/providers/llm/index.ts` 헤더 주석 · `adapters/claude-adapt.ts` | D-018 · §10 · AC16 | **유지** |
| 0117 — `settingSources: ['project','local']` | `adapters/claude-adapt.ts:86-94` | §8 · AC15 | **유지** |
| 0118/0125 — provider 경계·settings 제자리 수정 respawn | `provider-boundary.ts` | D-021 · AC19 (기존 판정 유지 + fingerprint 추가) | **유지 + 확장** |
| 0128 — 모델 변경 respawn | `runtime-entry.ts:66-67` | AC19 | **유지** |
| 0173 — main 원격 요청은 Chromium 스택 | `src/main/AGENTS.md §원격 요청` | §13 · 보안 불변식 | **유지** |
| 0174 — probe 는 `finalUrl` 까지 본다 | `auth/login.ts:237-253` | AC8 | **유지** |
| 0180/0181 — 런타임 동적 로딩 없음, 배포는 build-time 선언 | `auth/registry.ts` 헤더 | D-012 · §15 | **유지** |
| 0181 — gate 는 probe 필수 | `auth/registry.ts` `missing_probe` | D-007 · AC4 (타입 + 런타임 이중화로 **강화**) | **유지 + 강화** |
| 0182 — 세션 group 을 로그인 전에 등록 | `bootstrap.ts:238` | §13 | **유지** |
| 0183 — 사용량 선언 슬롯 금지 | `contracts/provider.ts:218-221` | D-026 | **유지** |
| 0186 — Usage main 정본 + renderer mirror | `features/usage/**` | D-026 | **유지** |
| 0187 D2 — 부팅 방송 상한 `1 + K` | `auth/login.ts:158-167` | D-028 · AC23 | **유지** |
| 0187 — 요청당 credential 1회 해석 + 홉별 grant fence | `auth/api.ts:88-96`, `store.ts` | AC8 · §14 | **유지** |
| root `AGENTS.md` 원칙 4 — 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` | §8 검산 · §14 · AC24 | **유지** |
| `src/main/AGENTS.md` — `src/main` 최상위는 5디렉터리 | `src/main/AGENTS.md` | `app/deployment/` 는 `app` 하위라 위반 아님 | **유지** |
| `docs/arch/` 는 현재 상태만 서술 | root `AGENTS.md` 원칙 5 | Phase C 문서 갱신 | **유지** |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 41파일 이동 + 계약 개명이 한 번에 들어가 리뷰·revert 가 어렵다 | Phase 3커밋 분리(D-034). 각 커밋이 독립 green |
| `options.settings.env` vs `options.env` 우선순위 오판 → 폐쇄망에서 잘못된 base URL/토큰 사용 | characterization 먼저(AC15). 실측 불가 시 **fail-safe 분기**(settings env 를 in-memory copy 에서 제거) 채택 + 근거 기록 |
| fingerprint 도입이 **상시 respawn** 을 유발해 성능 저하 | fingerprint 를 실제 adapter 입력(settings + 최종 env)에서만 계산하고, 같은 prepared 입력이면 계산값 재사용. 정상 steady state 재사용을 AC19 로 고정 |
| generation fence 구현 누락 시 stale token 이 조용히 살아난다 | deferred 기반 결정론 테스트(AC13)를 **구현과 같은 커밋**에 넣는다 |
| listen request 에 env 를 새로 싣는 변경이 살아 있는 채널의 동작을 바꾼다 | env 는 spawn-bound 라 살아 있는 채널의 push 에는 재주입되지 않는다. **새 spawn 이 필요한 분기에서 fresh env 가 빠지지 않게** 하는 것이 목적임을 코드 주석에 고정(D-020) |
| 이동 중 테스트를 지워 green 을 만드는 유혹 | D-033 + AC 가 행동 단언을 요구. verify 가 테스트 수·케이스 존재를 대조 |
| 기본 빌드가 빈 선언이라 동적 경로가 프로덕션에서 한 번도 안 돈다 | 그래서 AC10·AC13·AC14·AC15 를 **단위 테스트로** 닫는다. 폐쇄망 실기는 별도 사람 실기 항목 |

- **되돌리기 어려운 결정**: 없음(식별자·스키마·IPC 채널을 동결했다 — D-005·D-030·D-031). **vault key 는 prefix `provider:` 만 동결이다** — r8 이후 새로 쓰는 키에는 세대 접미사 `@<세대>` 가 붙고, `Grant.vaultKey` 가 포인터라 세대 없는 옛 키를 가리키는 grant 도 그대로 읽힌다(D-056).
- **신규 의존성**: **없음**(D-032). 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts` (← `provider.ts`)
- `app/src/main/adapters/harness-config.ts` (← `provider-config.ts`), `adapters/claude*.ts`(spawn preparation)
- `app/src/main/features/auth/**`, `features/gate/**`, `features/harnesses/**`, `features/plugins/confluence/**`, `features/extensions/harness-plugins/claude.ts`
- `app/src/main/features/sessions/{respawn-policy,session-runtime}.ts`, `features/usage/**`(배선), `features/chat/title-generation.ts`
- `app/src/main/app/{bootstrap,context,connection-views,chat-turn-continuation}.ts`, `app/chat-turn/**`, `app/handlers/{providers,misc,engine}.ts`, `app/settings-reactions.ts`
- `app/src/main/app/deployment/{auth-definitions,gate-auth,harness-runtime,plugins,connections,usage-fetcher}.ts` (신규) + `deployment-wiring.test.ts`(가상 배포 통합, r3)
- 삭제: `app/src/main/features/providers/**`
- `docs/arch/backend/providers.md`, `docs/GLOSSARY.md`, `docs/guides/closed-network-extensions.md`, `docs/IPC_CONTRACT.md`, `app/src/main/AGENTS.md`, `docs/generated/inventory.md`, `docs/handoff/INDEX.md`

## 19. 게이트

- **적용할 하위 가이드**: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md §두 가지 강제 규칙`.
- **ABI/네트워크 제약**: `npm test` 는 `pretest` 에서 better-sqlite3 ABI 를 요구할 수 있다. DB 동작이 필요 없는 이번 변경의 대다수 suite 는 `npx vitest run <경로>` 로 직접 돌린다. Electron 을 무는 모듈은 테스트가 직접 import 하지 않는다.
- **기본 정적 게이트**:

```bash
cd app
npm run lint
npm run typecheck
node scripts/check-doc-inventory.mjs --check
node scripts/check-migrations-appendonly.mjs
```

- **관련 테스트**: 이동·개명된 auth/gate/harness/plugin suite 전량 + 신규 runtime-config(fence·single-flight·expiry)·connection-views·respawn·continuation·spawn preparation 테스트. 가능하면 `npm test` 전체, ABI 실패 시 `npx vitest run` 으로 비-DB suite 를 돌리고 **baseline 과 변경 영향을 분리해 보고**한다(제안서 §검증 지침).
- **사람 실기**: 폐쇄망 실배포에서 gate 로그인 · Plugin 인증 · Harness turn · Usage refresh.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다. (신규 handoff — 제안서에서 D-001~D-037 추출, SUPERSEDED 없음)
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다. (§4 에서 "이동 vs 제거" 를 명시 구분)
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 Delta 마지막 행에 명시했다.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다. (§8 검산)
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 사람 실기로 미룬 순수 로직이 없다. (§7 주의사항)
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다. (AC17·AC20 이중 단언)
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다. (§10·§11)
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다. (§12)
- [x] producer/consumer 양쪽 의미를 확인했다. (§12)
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다. (§14·§17)
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다. (§19)
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했다. (§16)

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰

- **동의 / 그대로 진행**: 책임 경계(§9 Delta 전 행) · Decision Ledger 37건 · AC 25건(설계 시점 24건 + r3 의 AC25). 제안서가
  값을 명시한 자리(용어·디렉터리·우선순위·cache 정책·금지 목록)는 재해석 없이 그대로 구현했다.
- **이견 / 현실성 문제**: 없음. 단 아래 §[구현자 기입] 놓친 잠재 문제의 5건은 설계가 예상하지
  못한 자리였고, 전부 **구현 세부 보완**으로 선조치했다(제품 의도·AC·ACTIVE Decision 불변).
- **ACTIVE Decision 과 충돌하는 설계 발견**: 없음.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **Phase A 가 lint 를 통과할 수 없다.** plan §11 은 Phase A 이후 `features/providers/` 에 `platform.ts`·`llm/`·`service/index.ts`·`declarations/` 를 남긴다고 했는데, `auth`·`gate` 가 다른 슬라이스로 나간 순간 그것들이 **feature 교차 import** 가 되어 `boundaries/dependencies` error 다. | ✅ 네 모듈을 Phase A 에서 **컴포지션 루트(`app/`)로 당겼다** — Phase B 가 어차피 지울 자리이고, app 은 전부 import 할 수 있다. 결과적으로 `features/providers/` 가 Phase A 에서 이미 사라져 D-034("두 디렉터리를 동시에 장기 운영하지 않는다")를 더 강하게 만족한다. | `app/eslint.config.mjs` boundaries 규칙 · Phase A 커밋 `2bebd67` |
| 2 | **AC4·AC23 이 electron 을 무는 파일 안에 갇힌다.** gate fail-closed 와 resume 순서를 `bootstrap.ts` 의 private 메서드로 두면 사람 실기로만 확인된다(vitest 가 electron 을 못 문다). | ✅ 두 정책을 순수 모듈로 뽑았다 — `features/gate/selectGateMembers()` · `app/auth-resume.ts`. bootstrap 은 호출과 진단 로그만 갖는다. 각각 `gate.test.ts`(+9건)·`auth-resume.test.ts`(12건)가 순서·방송 횟수를 단언한다. | plan §11 "테스트 가능성" 의 순수 seam 요구 |
| 3 | **`fingerprintOf` 가 feature 교차를 만든다.** 조립부(`features/harnesses`)와 spawn 기록부(`features/sessions`)가 같은 함수를 써야 하는데 feature 끼리는 import 금지다. | ✅ `harnessConfigFingerprint` 를 **adapters 레이어**(`adapters/harness-config.ts`)로 올렸다. 값 자체가 "adapter 입력의 형상" 이라 포트가 제 자리이고, 두 feature 가 하향 방향으로 같은 SSOT 를 쓴다. | `src/main/AGENTS.md §레이어 DAG` |
| 4 | **재인증 실패가 이전 자격증명을 파괴하고 있었다.** D-009/AC7 은 "실패해도 보존" 인데, 0181 구현은 값형에서 probe **전에** vault 를 덮어쓴 뒤 실패 시 `revoke()` 로 지웠다 — 그 사실이 코드 주석에 이미 적혀 있었다("이전 자격증명은 … 복구되지 않는다"). 설계가 이것을 "이미 되는 것" 으로 전제했다. | ✅ `AuthStore.captureForRollback()/rollback()` + `login.ts` 의 vault 값 복구를 신설해 **실제로** 보존하게 했다. `credentialRevision` 도 함께 되돌려 실패한 재인증이 Harness cache 를 비우지 않는다. `runtime.test.ts` 가 세 축(값·revision·status)을 단언한다. | 구 `login.ts:331` 주석 실측 |
| 5 | **시간 기반 만료가 상태를 정착시키지 않는다.** `status()` 는 순수 조회라 `expiresAt` 경과를 매번 다시 계산할 뿐이어서, `verified` 가 남고 `credentialRevision` 도 그대로였다 — gate 가 열린 채로, Harness cache 가 죽은 토큰을 warm hit 로 돌려주는 창이 생긴다. | ✅ `AuthStore.settleExpiry()` 를 두고 `AuthRuntime.snapshot()` 이 그 전이를 **처음 관측한 지점에서 한 번** 확정하게 했다(D-037 의 "polling 추가 금지" 유지). | `store.ts` `status()` 실측 |

> 위 5건 모두 구현 세부·명백한 엣지 누락이라 선조치했다. 제품 의도·신규 의존성·ACTIVE
> Decision·AC 를 바꾼 것은 없다.

### 설계 대비 명시적 차이 2건 (보고)

- **Phase A 의 범위가 넓어졌다.** plan §11 은 harness-config 타입 renaming 만 Phase A 로 잡았지만,
  실제로는 이동한 모듈의 **심볼 renaming 전부**(`HarnessSettingsService`·`HarnessModelProviderEntry`·
  `settings-write` 의 Engine 어휘·`renderClaudeHarnessPlugin`)를 Phase A 에서 함께 했다. 같은
  기계적 변환이라 Phase B 의 계약 변경 diff 와 섞이지 않게 하는 편이 읽기 쉬웠다.
- **`options.settings.env` vs `options.env` 우선순위 실측은 하지 않았다.** SDK 내부 동작이라
  버전에 따라 바뀔 수 있어, plan §11 이 지정한 **fail-safe 분기**(제안서 결정표 2행)를 택했다 —
  충돌 키를 settings 사본에서 제거하므로 **어느 쪽이 이기든 결과가 하나**다. 근거는
  `prepared-config.ts` 헤더 주석과 `prepared-config.test.ts` 의 "충돌 키 제거" 케이스에 있다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Phase A 95파일(이동 51 · 전환 44) · Phase B 83파일 · Phase C 문서 12파일 |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-migrations-appendonly.mjs` |
| 게이트 결과 (r9 실측) | **전부 green** — typecheck 3/3 · lint 0 error(1 warning = 기존 `useTranscriptVirtualizer` react-compiler) · vitest **201 파일 / 1,887 테스트 전부 통과**(egress 가 열려 있어 DB suite 포함 신규 red 0) · script test 49/49 · doc-inventory(생성물·prose·링크) ok · migrations append-only ok |
| 테스트 보존 감사 (r2) | 삭제 4파일의 단언을 전수 대조했다. **대체됨**: `service-tools`(4) · `plugin-tools`(3/5) · `turn-setup`(4/5) → 현 `plugins.test.ts`·`prepared-config.test.ts`. **대체 대상 아님**: `llm-env`(5) — `Provider.llm` 조인 규칙 자체가 계약에서 사라졌다. **누락 3건은 r2 에서 신설**(D2). 남은 삭제/skip 0 |
| ABI 환경 | 이 세션은 egress 가 열려 있어 `npm ci` 가 성공했고 **DB suite 를 포함해 전부 green** 이다 — `app/AGENTS.md` 가 경고하는 baseline red 5파일이 이번에는 없다 |
| 블로커 / 역질문 | 없음 |
| r3 반영 | 리뷰 5건을 전부 코드에서 재확인한 뒤 고쳤다 — 배포 factory 인자화(D6) · `connections.ts` 신설(D7) · env 우선순위 정정(D8) · 만료 정착 경로·세대(D9) · fingerprint digest 화(D10). 신설 `deployment-wiring.test.ts` 6건 + 기존 fingerprint/expiry 테스트 개정 |
| r10 반영 | **PR #336 REQUEST CHANGES 4건 + 독립 진단 2건.** 리뷰 주장을 먼저 코드에서 전수 대조했다 — P1 2건·P2 2건 중 **3건 전면 확인, 1건은 하위 항목 하나가 반론**(`settings-write` 의 사용자 문구는 제안서 §비범위 "문구 변경" 이라 유지도 계약 위반이 아니다. 위험이 0 이라 사용자 결정으로 수용해 바꿨다). 리뷰가 짚지 않은 **D37·D38 을 독립 진단으로 추가** 발견했다 — 둘 다 `main` 대비 실제 회귀이고 D38 은 퍼포먼스 회귀(불필요 respawn)다. 신설 회귀 **+23**, 전부 mutation 으로 가드 의존성을 확인했다. 미충족으로 남는 것: 리뷰 조건 4번의 `verify.md`/PASS(사용자 결정으로 다음 턴) |
| r9 반영 | 재리뷰 P1 2건을 **실측 재현한 뒤** 고쳤다 — 저장소 장애를 빈 저장소로 오인한 sweep(D29, **r8 회귀**) · 영속 실패를 무시한 해제(D30) · 갈라져 있던 포트 계약(D31) · 리베이스 후 문서 ancestry(D32). 신설 회귀 **+6**, 전부 mutation 으로 가드 의존성을 확인했다 |
| r8 반영 | PR #338 재리뷰 3건을 **전부 실측 재현한 뒤** 고쳤다 — 교체 원자성(D22/D25/D26: 포인터 교체 + 내구 저장 보고 + staging 제거) · fence 전면화(D23/D27: probe·실행기·resume·401 강등 4지점) · 테스트 공백(D28: 경로 진입 단언 + mutation 확인). 신설 회귀 **+11**, 실패 지점마다 "옛 값 전체 / 새 값 전체" 중 하나만 관측되는지 단언한다 |
| 대상 커밋 | Phase A `2bebd67` · Phase B `2b274ef` · Phase C `110a1a9` · r2 `d197f0d` · r3 `511ad32` · r4 `ed33531` · r5 `05aeab6` · r6 `ceaf7ba` · r7 `64f0c47` · r8 `2f4e804` · r9 `92120de` · r10 `c01d017` |
| 게이트 결과 (r10 실측) | `npm run lint` **0 error**(1 warning = 기존 `useTranscriptVirtualizer` react-compiler) · `npm run typecheck` **3/3** · `vitest run` **197파일 / 1,866테스트 통과**. **5파일 / 44테스트 실패는 baseline 이다** — `better-sqlite3` 가 Electron ABI(140)로 빌드돼 있어 Node(127) vitest 가 로드하지 못한다(`chat-turn.continuity` · `extensions/builder` · `orchestration/fork` · `db/migrate` · `db/queries`). **변경분을 stash 하고 같은 5파일을 돌려 44 failed / 1 passed 로 동일함을 확인**했다 — 이번 변경과 무관하다. `npm test` 는 Node ABI 재빌드를 유발하고 그 뒤 dev/build 용 Electron ABI 재빌드가 필요하므로 의도적으로 돌리지 않았다(`app/AGENTS.md` 제약 환경 게이트). doc-inventory · migrations append-only 모두 exit 0. 세션 시작 시 `cheerio`/`turndown` 3종이 `node_modules` 에서 빠져 있어 typecheck 가 실패했는데, 선언된 의존성이라 `npm install` 로 복구했고 `package.json`·`package-lock.json` 은 바뀌지 않았다 |
| r10 mutation 확인 | 신설 회귀 전부에 대해 수정을 되돌리면 실패하는지 확인했다 — `wellFormed` 가드 제거 → 5 fail · `vault.delete` try/catch 제거 → 1 fail · cookie fence `await` 제거 → 1 fail · `titleSettings` 전달 제거 → 1 fail · `runtimeEnvChangedSinceSpawn` 의 `resolved == null` 가드 제거 → 1 fail · `prepareUnresolvedHarnessConfig` 의 두 인자 제거 → 2 fail |
| 리베이스 해시 매핑 (r9) | 브랜치가 리베이스되면서 r4–r7 의 해시가 바뀌었다. 이전 기록이 가리키던 값 → 현재 ancestry: `5d11041`→`ed33531`(r4) · `40fcf11`→`05aeab6`(r5) · `8b0e4af`→`ceaf7ba`(r6) · `2e9a4be`→`64f0c47`(r7). 커밋 **내용**은 같고 부모만 달라졌다 — 옛 해시는 이 저장소에서 더 이상 조회되지 않으므로 본 표는 현재 값을 쓴다 |

### 전수 재측정 (plan §8 요구)

| 대상 | 값 | 비고 |
|---|---|---|
| 이동 전 `features/providers` 파일 | 41 (구현 27 + 테스트 14) | plan §8 값과 일치 |
| Phase A 이후 `features/providers` | **0** — 디렉터리 부재 | AC1 |
| 신규 main 슬라이스 | `auth`·`gate`·`harnesses`·`plugins` (9 → 12) | `docs/generated/inventory.md` 재생성 |
| contracts 모듈 | 5 (이름만 `provider` → `auth`) | 동상 |
| `materialize` 잔존 | 0 | `rg materialize src/` |
| `AUTH_DEFINITIONS`·`GATE_AUTH_DEFINITIONS` 기본값 | `[]` (D-012) | 가짜 사내 URL 미도입 |
| 신규 production dependency | 0 | `package.json` diff 없음 |
| 새 DB migration | 0 | append-only 가드 통과 |

### AC 대조

| AC | 결과 | 근거 |
|---|---|---|
| AC1 | ✅ | `features/providers/` 부재. 코드·current-state 문서에 잔존 참조 0(renderer feature `providers` 는 별개 이름) |
| AC2 | ✅ | `contracts/auth.ts` 에 `kind`·`llm`·`tools`·`usage`·`envKey` 없음 |
| AC3 | ✅ | lint boundaries 통과. `features/auth` → gate/harnesses/plugins import 0 |
| AC4 | ✅ | `gate.test.ts` — `selectGateMembers` 3건 + `createGate` 5건(valid만/blocked fail-closed/bypass 포함) |
| AC5 | ✅ | `BoundAuth` 멤버 3종뿐. `secretReader` 는 `bootstrap.ts` 와 MCP closure 에만. `RouterContext` 에 부재 |
| AC6 | ✅ | `runtime.test.ts` 6건 — step/snapshot 분류·`cause`·`credentialChanged`·revision 단조·재관측 불변 |
| AC7 | ✅ | `runtime.test.ts` 2건 — 실패 reauth 의 vault 값·status·revision 보존 / 성공 시 교체 |
| AC8 | ✅ | `authenticated-request.test.ts`·`policy.test.ts` 이동·개명 후 동일 단언 유지(binary·maxBytes·finalUrl·redirect fence·401 강등) |
| AC9 | ✅ | `HarnessModelProviderDefinition` 0건. `settings.test.ts` 가 디렉터리 열거 파생을 계속 단언 |
| AC10 | ✅ | `runtime-config.test.ts` 다중 키 overlay + `harness-runtime.ts` 문서 예제 형상 |
| AC11 | ✅ | `runtime-config.test.ts` — augmenter 미등록 시 settings 해석 1회뿐 · warm cache 재호출 0 |
| AC12 | ✅ | `runtime-config.test.ts` — `sourceRevision` 변화 → augmenter 재호출 |
| AC13 | ✅ | `runtime-config.test.ts` — deferred fence(옛 값 미반환·cache 미commit) + bounded retry 소진 시 `StaleHarnessConfigError` |
| AC14 | ✅ | `runtime-config.test.ts` — single-flight 1회 · caller abort 격리 · invalidation 만 공유 signal abort |
| AC15 | ✅ | `prepared-config.test.ts` 8건 — 4층 우선순위 · 충돌 키 제거 · 원본 불변 · 참조 유지 · 비문자열 배제 |
| AC16 | ✅ | `prepared-config.test.ts` — token 이 settings 직렬화에 부재 · `sourceRevision` 미혼입 |
| AC17 | ✅ | `resolveTurnProvider` 가 `prepared` 한 벌을 만들고 `send.ts` 가 chat·title 에 같은 객체의 `providerSettings`·`env` 를 **둘 다** 전달. **r10**: r9 까지 근거가 산문뿐이라 `titleSettings` 가 항상 `undefined` 인 것을 놓쳤다(D37) — `turn-context.test.ts` 가 두 채널 동시 전달을 단언하고, 입력을 required 로 바꿔 누락이 컴파일에서 깨진다 |
| AC18 | ✅ | `continuation.test.ts` "listen·flush 의 spawn 입력 대칭" + `chat-turn-continuation.test.ts` |
| AC19 | ✅ | `respawn-policy.test.ts`(기존 4입력 + `runtimeEnvChanged`) · `prepared-config.test.ts` fingerprint 3건 · `chat-turn-continuation.test.ts` 3건. **r10**: 해석 실패 턴이 fingerprint 를 값으로 내 채널을 내리던 것을 고쳤다(D38) — `runtime-boundary.test.ts` 의 `runtimeEnvChangedSinceSpawn` 3건이 null 의미론을, `prepared-config.test.ts` 3건이 `prepareUnresolvedHarnessConfig` 를 잠근다 |
| AC20 | ✅ | `deployment/plugins.test.ts` — 상태별 add/remove · 반복 sync revision 불변 |
| AC21 | ✅ | `deployment/plugins.test.ts` — invalid 에서도 `toolNames()` 유지, registry 는 회수 |
| AC22 | ✅ | `connection-views.test.ts` 8건 — 전 필드 동등성 · compat kind 매핑 · row 순서/개수 · authId 유일성 |
| AC23 | ✅ | `auth-resume.test.ts` 12건 — 게이트 우선 · 나머지 병렬 · `1 + K`(K=0,2) · 중복 batch 방지 |
| AC24 | ✅ | migration 0 · dependency 0 · doc-inventory 3종 통과 · `arch/backend/auth.md` 재작성 + GLOSSARY·가이드·IPC·AGENTS 갱신 |
| AC25 | ✅ | `deployment-wiring.test.ts` 6건 — 주입 인자만으로 조립 · 도구 등록/회수 · augmenter 2방식 · `UsageFetcher` · 카탈로그 4행(`id`·`kind`·`tools.length` 순서 단언). **r4**: fixture 4종의 인자를 실제 deps 인터페이스로 못 박아 배포 능력 축소가 컴파일에서 깨지게 했다(D12) |

**사람 실기 잔여**: 폐쇄망 실배포에서 gate 로그인 · Plugin 인증 · 실제 Harness turn · Usage
refresh. 기본 빌드는 선언이 비어 있어 이 경로가 프로덕션에서 돌지 않으므로, 위 AC 는 전부
단위 테스트로 닫았다.

**r10 이후에도 열려 있는 것**: PR #336 리뷰의 승인 전 재검증 조건 4번 중 **`verify.md`/PASS
산출물**. 조건의 앞부분(Engine 잔재·AC 개수 정리)은 D36·D32 로 닫았으나, 정식
`handoff-verify` 수행과 `verify.md` 작성은 **사용자 결정으로 다음 턴에 남긴다**. 따라서 INDEX
상태는 `impl/IMPL_DONE (r10)` 이고 trailer 는 `Verified-By: pending` 이다 — 닫힌 것으로
보고하지 않는다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **respawn 판정이 겹치고 0125 의 null 보수성을 뒤집었다.** r1 fingerprint 가 `{settings, env}` 를 함께 접어 ① `providerSettingsChanged` 와 같은 사실을 두 입력이 말하고 ② settings loader 가 **일시 실패한 턴마다** 채널을 내리고 settings 없이 respawn 했다 | r2 리뷰 §9 + `runtime-boundary.ts` 실측 | ✅ **해결** — fingerprint 를 **env-only** 로 좁히고(`harnessEnvFingerprint`) settings 축은 기존 함수가 계속 소유. 두 입력이 겹치지 않는 축을 하나씩 본다. 회귀 2건 신설(비-env settings 실패=no-op / env 항목이 있었으면 실제로 달라짐) | 해결 |
| D2 | **삭제한 테스트 4건 중 3개 단언이 대체되지 않았다.** `unknown_provider` 회귀(도구 호출이 자기 Auth 로 나가는가) · `unknown`(복호화 실패) 상태의 도구 회수 · 미인증 fail-closed | r2 리뷰 §5 + 삭제 파일 `git show` 대조 | ✅ **해결** — `deployment/plugins.test.ts` 2건 + `runtime-config.test.ts` 2건 신설(총 +9 테스트). `llm-env.test.ts` 의 조인 규칙은 `Provider.llm` 과 함께 사라져 대체 대상이 아님 | 해결 |
| D3 | **Usage 후보 집합 변경이 표 한 줄로만 기록됐다.** 파일 이동이 아니라 의미 변경인데 Decision 도 코드 주석도 그 사실을 말하지 않았다 | r2 리뷰 §2 | ✅ **해결** — D-039 신설 + `bootstrap.ts` 에 구/현 집합과 `supports()` 게이트 근거를 명시 | 해결 |
| D4 | **`claude-user-skills-plugin.ts` 가 이동에서 빠졌다.** 같은 Claude Harness package renderer 인데 `features/extensions/` 에 남았다 | r2 리뷰 §4 | ✅ **해결** — `harness-plugins/claude-user-skills.ts` 로 이동(D-040) | 해결 |
| D5 | **plan-only 커밋(`f76e960`)에 `Status: implemented` 를 달았다.** 그 시점 상태는 plan/READY 였다 | r2 리뷰 §11 | ⚠️ **fix-forward** — 푸시된 이력이라 rewrite 하지 않는다. 이후 커밋의 trailer 는 실제 상태와 맞고, plan 커밋은 `Status` 를 생략하는 것이 맞다는 규칙을 여기 남긴다 | 기록 |
| D6 | **배포 확장점이 실제로 배선되지 않았다.** `createPluginBindings()`·`createRuntimeConfigAugmenters()`·`createUsageFetcher()` 가 인자를 받지 않아, 가이드대로 구현하면 배포가 범용 `bootstrap.ts` 를 고쳐야 했다 | r3 리뷰 §1 | ✅ **해결** — 세 factory 에 deps 인터페이스를 두고 `bootstrap.ts` 가 `auth`·`registry`·`secretFor` 를 주입(D-044) | 해결 |
| D7 | **`harness`·`usage` 카탈로그 row 를 만들 자리가 없었다.** `ConnectionViewSource` 는 네 category 를 지원하는데 조립이 `bootstrap.ts` 안의 gate·plugin 두 줄뿐이라, 그 두 인증을 선언한 배포는 연결 탭에 행이 없어 **로그인 자체가 불가능**했다 | r3 리뷰 §1 | ✅ **해결** — `app/deployment/connections.ts` 신설(`createConnectionSources` + `gateRows`/`pluginRows` 조각). 가이드 레시피 B 에 row 추가 단계를 명시 | 해결 |
| D8 | **env 우선순위가 거꾸로 구현됐다.** 계약은 `runtimeEnv > settings env > app env > process env` 인데 구현은 app 을 settings 뒤에 얹어 전역 폴백이 ModelProvider 전용 설정을 덮었다. 게다가 테스트가 그 뒤집힌 순서를 고정하고 있었다 | r3 리뷰 §2 | ✅ **해결** — spread 순서를 `baseEnv → appEnv → settings env → runtimeEnv` 로 정정하고(D-041) settings 의 `env` 블록을 통째로 hoist 하도록 바꿨다(D-042). 테스트 단언도 계약 쪽으로 뒤집었다 | 해결 |
| D9 | **시간 기반 만료가 request·resume 에서 정착하지 않았고, 정착해도 세대가 안 올랐다.** D-037 이 "관측 지점에서 한 번" 을 말했지만 실제로는 `snapshot()` 만 걸려 있었고, 1회성을 `markExpired()` 의 조기 반환에 기대 `credentialRevision` 증가까지 함께 건너뛰었다 — `credentialChanged:true` 인데 세대는 그대로인 change 가 나가 Harness cache 가 무시한다 | r3 리뷰 §3 | ✅ **해결** — 정착 집합(`expirySettled`)으로 1회성을 분리해 revision 은 항상 올리고, `authenticated-request.ts`·`login.ts:resume()` 에도 `settleExpiry()` 를 걸었다. 집합은 `put`·`revoke`·`restore` 에서 비운다 | 해결 |
| D10 | **fingerprint 가 env 평문을 장기 보존했다.** 비교값인데 `SessionRuntime` 이 세션 수명 내내 canonical form 을 들고 있어 secret 노출면이 하나 늘었다 | r3 리뷰 §4 (Security) | ✅ **해결** — 프로세스 수명 랜덤 키의 HMAC-SHA256 digest 로 바꿨다(D-043). 프로세스 내 비교 정확성은 그대로 | 해결 |
| D11 | **강등 통지가 전이보다 많이 나갔다 — D9 의 나머지 절반.** r3 은 시계 만료(`settleExpiry`)만 boolean 으로 갈랐고 `markExpired()` 는 `void` 로 남겼다. 그래서 401 probe 로 실패한 `resume()` 한 번이 credential-effective change 를 **두 번** 냈다 — 요청 경로가 강등하며 `unauthorized` 를 내고, `resume()` 이 이미 만료된 grant 에 `markExpired()` 를 다시 불러(조기 반환, revision 불변) `expired` 를 또 냈다. **두 번째는 `credentialChanged:true` 인데 revision 이 그대로**여서 r3 이 D9 에서 고쳤다고 한 바로 그 불일치가 다른 경로로 남아 있었고, 부팅 방송 상한이 `1 + K`(0187 D2) 에서 **`1 + 2K`** 로 늘고 Harness cache 가 실패 멤버마다 한 번 더 비었다 (재현: `runtime.test.ts` r4 블록 — 수정 전 2건/revision 둘 다 1) | r4 자체 검증 (PR #336 필수 수정 4의 잔여) | ✅ **해결** — `markExpired()` 가 **실제 전이를 만들었는가**를 돌려주고(D-046) 통지가 그 값을 따른다. `resume()` 은 전이가 있었을 때만 `expired` 를 내고(401 은 요청 경로가 이미 냈다), 요청 경로는 통지는 유지하되 `credentialChanged` 를 전이 여부로 싣는다 — 전이가 없어도 `verified` 는 풀리므로 화면은 갱신돼야 한다. 회귀 4건 신설 | 해결 |
| D12 | **AC25 fixture 가 자기 인자 타입을 스스로 정의했다.** 배포 factory 를 흉내 낸 함수들이 인라인 타입(`{auth, registry}` 등)을 써서, 테스트가 잠그는 사실이 "이 fixture 가 스스로 정한 인자로 조립된다" 로 좁아졌다 — 정작 D6 이 요구한 **"Bootstrap 이 주입하는 능력만으로 배포가 조립된다"** 를 타입으로 고정하지 못했다 | r4 자체 검증 (필수 수정 5의 잔여) | ✅ **해결** — fixture 4종의 인자를 실제 `PluginDeploymentDeps`·`HarnessRuntimeDeploymentDeps`·`UsageDeploymentDeps`·`ConnectionDeploymentDeps` 로 못 박았다. 배포 factory 의 능력이 줄면 이 파일이 컴파일에서 깨진다 | 해결 |
| D13 | **재인증이 원자적이지 않았다.** 후보 grant 를 전역 store 에 먼저 커밋하고 probe 해서, 왕복 동안 다른 소비자가 검증되지 않은 secret 과 올라간 revision 을 읽었다. 401 이면 강등 이벤트가 나갔고 rollback 은 **이미 나간 이벤트를 취소하지 못해** Plugin 도구가 회수된 채로 남았다. probe 중 종료 시 vault 에 후보 값이 남는 crash window 도 있었다 | r5 리뷰 §1 | ✅ **해결** — 후보를 `CandidateCredential` 로 요청에 실어 store·vault 를 거치지 않게 하고, 커밋을 성공 후 1회로 모았다(D-047). 회귀 4건 | 해결 |
| D14 | **rollback 좌표에 `expirySettled` 가 없었다.** 후보의 401 이 그 집합을 오염시켜, 되살린 token 이 나중에 자연 만료돼도 `settleExpiry` 가 정착됐다고 판단하고 건너뛰었다 — 상태는 `expired` 인데 `verified:true` 로 남아 Plugin 회수·Harness 무효화가 영구히 빠졌다 | r5 리뷰 §1 | ✅ **해결** — rollback 자체를 제거해 구조적으로 소멸(D-047). "되살린 grant 의 자연 만료" 회귀 신설 | 해결 |
| D15 | **config-API/direct-credential 권한 분리가 주석에만 있었다.** 단일 deps 가 `auth` 와 `secretFor` 를 함께 줘, 어느 factory 든 두 능력을 다 쓸 수 있었다 | r5 리뷰 §1 | ✅ **해결** — deps·factory 를 둘로 분리하고 Bootstrap 이 각각 좁은 능력만 넘긴다(D-048). 가이드 §4 표·예제도 갱신 | 해결 |
| D16 | **신규 테스트가 주장한 두 경로를 실제로 검증하지 않았다.** ⓐ 배포 fixture 가 production factory 를 부르지 않고 동명 로컬 재구현을 단언 ⓑ "두 번째 401" 테스트가 두 번째 요청을 보내지 않았다(이미 만료돼 `resume` 이 조기 반환) | r5 리뷰 §2 | ✅ **해결** — production export 를 직접 부르는 describe 신설(기본 배포 계약 4건) + deferred fetch 로 **실제 동시 401** 두 건을 띄우는 테스트로 교체 | 해결 |
| D17 | **현행 문서가 코드와 충돌했다.** 가이드가 삭제된 `contracts/provider.ts` 를 정본으로 지목하고 "Plugin 은 코드 개념이 아니다" 라고 설명(0188 이 `features/plugins/` 를 만들었다). GLOSSARY·`runtime-ipc.md` 의 fingerprint 는 settings+env 라고 서술(구현은 최종 env 만 HMAC digest) | r5 리뷰 §2 | ✅ **해결** — 정본 경로·Plugin 3레지스터·fingerprint 서술과 심볼명(`harnessEnvFingerprint`)을 코드에 맞췄다. 리뷰가 짚지 않은 `runtime-ipc.md:49` 의 같은 drift 도 함께 | 해결 |
| D18 | **probe 성공 이후 커밋이 원자적이지도 경쟁으로부터 보호되지도 않았다.** 두 `continue()` 가 겹치면 늦게 끝난 옛 후보가 이겼고, probe 중 `revoke()` 해도 probe 가 200 이면 후보가 커밋돼 해제한 Auth 가 되살아났다 | r6 리뷰 §1 | ✅ **해결** — Auth 별 시도 세대 fence(D-050). 회귀 2건(겹친 재인증·probe 중 해제) | 해결 |
| D19 | **vault 다단계 쓰기 중 실패가 값만 바꿔 놓았다.** 메타 저장이 실패하면 요청은 throw 하는데 raw secret 은 후보로 바뀌고 revision 은 0인 상태가 남았다 | r6 리뷰 §1 | ✅ **해결** — `vault.set` 순서를 **메타 → 값 → index** 로 바꿔 어느 단계에서 실패해도 값 키는 이전 것이 남게 했다(D-052) + `settleGrant` 가 쓰기 실패를 로그인 실패로 접고 best-effort 복구. 회귀 1건 | 해결 |
| D20 | **Harness 권한 분리가 제안서 계약보다 넓었다.** direct factory 가 `secretFor(authId)` selector 를 받아 임의 Auth 의 secret 을 고를 수 있었고, key 충돌은 주석만 "진단한다" 하고 실제로는 조용히 덮었다 | r6 리뷰 §1 | ✅ **해결** — `DIRECT_CREDENTIAL_AUTH_IDS` 선언 + Bootstrap 이 그 id 로 닫은 closure map 만 전달, 충돌은 throw(D-051). 회귀 1건 | 해결 |
| D21 | **요청 중 시계 만료가 누락됐고, 그것을 잡는다던 테스트가 주장을 검증하지 못했다.** `markExpired` 가 `expiresAt <= now` 로 중복 판정해 요청 중 만료가 다음 `snapshot()` 까지 미뤄졌다. r5 의 자연 만료 테스트는 첫 `resume()` 이 401 이라 grant 를 미리 만료시켜 아무것도 묻지 못했다 | r6 리뷰 §1·§3 | ✅ **해결** — 중복 판정 기준을 `expirySettled` 로 통일(D-052) + 요청 중 만료 회귀 신설 + 자연 만료 테스트를 **probe 성공 → 재인증만 실패** 로 다시 씀 | 해결 |
| D22 | **자격증명 교체가 실패 원자적이지 않았다.** access 를 정식 키에 쓴 뒤 refresh 쓰기가 실패하면 `new-access + old-refresh` 가 남았고(로그인은 실패·revision 0), `store.put()` 은 메모리·revision 을 먼저 바꾼 뒤 영속해 저장 실패 시 디스크에 없는 상태가 메모리에 남았다 | r7 리뷰 §1 | ⚠️ **r7 의 해결은 불완전했다 → r8 에서 재해결.** staged→promote 는 **promote 와 grant 저장 사이**에 같은 창을 남겼고(실측 재현: 저장 실패 시 `visibleSecret=new` / `persisted grant=old`), production persistence 가 쓰기 오류를 삼켜 `catch` 가 그 실패를 보지도 못했다. r8: **포인터 교체**(D-056) + **내구 저장 보고**(D-057). 회귀 5건(교체 실패·영속 실패·degraded·커밋 전/후 크래시) | 해결 (r8) |
| D23 | **superseded 시도가 UI 상태를 덮어썼다.** 세대 불일치와 probe 거부가 모두 `null` 로 합쳐져, 늦게 끝난 첫 요청이 `currentStep` 을 거부 폼으로 되돌렸고 해제 후에도 폼이 다시 열렸다. Renderer 도 늦은 invoke 응답을 그대로 반영했다 | r7 리뷰 §1 | ⚠️ **r7 의 해결은 성공 분기만 덮었다 → r8 에서 재해결.** 세대 확인이 probe **실패** 분기 뒤에 있어 stale 401 이 그대로 거부 폼을 열었고(`status=none` + `input-required` 실측 재현), OAuth/세션의 `code-required`·`failed` 와 부팅 복원 probe, 401 강등에는 fence 자체가 없었다. r8: **`await` 4지점 전부**에 fence(D-058). 회귀 4건 | 해결 (r8) |
| D24 | **collision 회귀 테스트가 production 코드를 검증하지 않았다.** 테스트가 `merge()` 를 자기 안에 재구현해 실제 가드를 지워도 통과했다 — r5 가 verify SKILL §2 에 금지 규칙으로 적어 둔 바로 그 형태 | r7 리뷰 §2 | ✅ **해결** — `mergeAugmenters` 를 export 하고 테스트가 그것을 직접 부른다(D-055) | 해결 |
| D25 | **production persistence 가 디스크 쓰기 오류를 삼켰다.** `save()` 가 `void` 라 호출부는 "저장됨" 과 "삼켜진 실패" 를 구분할 수 없었고, `login.ts` 의 `catch` 는 실제 배포에서 한 번도 도달하지 않는 죽은 코드였다 | r7 리뷰 §1 | ✅ **해결** — `save(): boolean` 으로 내구 저장을 **보고**하게 하고(D-057), degraded 면 옛 세대 키를 남긴다. 회귀 1건 | 해결 |
| D26 | **`restore()` 가 staged 값을 commit 의사 확인 없이 무조건 promote 했다.** staged 영역에는 새 `Grant` 도 phase 도 없어 "확인까지 끝난 값" 인지 판별할 근거가 아예 없었다 — stage 직후 크래시하면 미커밋 secret 이 자동 승격됐다 | r7 리뷰 §1 | ✅ **해결** — staging 자체를 제거하고 포인터 교체로 바꿔(D-056) 무조건 promote 가 **구조적으로 소멸**했다. 부팅은 이제 승격이 아니라 **고아 sweep** 을 한다 | 해결 |
| D27 | **`markExpired` 가 관측 세대를 보지 않았다.** 401 은 요청을 보낸 그 자격증명에 대한 판정인데, 요청이 도는 사이 재인증이 끝나면 그 401 이 **방금 성공한 새 자격증명**을 `expired` 로 강등했다(부팅 복원 probe 에서 실측) | r7 리뷰 §1·§3-3 확장 | ✅ **해결** — `markExpired(authId, observedRevision)` + 요청 경로가 전송 직전 세대를 적어 둔다(D-058). 회귀 1건(두 가드를 각각 지우면 실패하는지 mutation 확인) | 해결 |
| D28 | **신규 회귀 테스트가 주장한 경로에 진입하지 않았다.** "refresh 저장 실패" 는 PAT 전용 선언에 OAuth 실행기를 주입해 token 경로를 실행하지 않았고, "영속 실패" 는 secret 보존을 단언하지 않아 혼합 상태를 놓쳤다. **D16(r5)·D24(r7)와 같은 실패가 세 라운드 연속 재발**했다 | r7 리뷰 §2 | ✅ **해결** — 실행기 호출 횟수 단언으로 경로 진입을 못 박고(D-059), 신규 회귀 전부를 `createAuthRuntime` production 경로로 태웠다. 새 단언은 가드를 지우면 실패하는지 mutation 으로 확인했다 | 해결 |
| D29 | **부팅 sweep 이 grant 저장소 장애를 '정상적인 빈 저장소' 로 오인해 vault 를 통째로 지울 수 있었다.** r8 이 도입한 sweep 의 회귀다 — `load()` 가 파일 개방·파싱 실패를 빈 맵으로 강등하는데 sweep 이 그것을 권위 있는 없음으로 읽었다 | r8 재리뷰 §2 | ✅ **해결** — `load()` 가 `{records, authoritative}` 를 돌려주고 sweep 은 authoritative 일 때만 돈다(D-060). 회귀 3건(못 읽음 / 부분 파싱 / 정상 sweep 은 여전히 돈다) | 해결 |
| D30 | **`revoke()` 가 영속 실패를 무시하고 성공을 발행했다.** session grant 는 vault 값이 없어 아무것도 사라지지 않은 채 화면만 해제되고, 재시작하면 연결이 되살아난다. `BrowserSessionStore.clear()` 도 포트에 노출·호출되지 않아 쿠키가 그대로 남았다 | r8 재리뷰 §2 | ✅ **해결** — 해제를 fail-closed 로(D-061) + 해제 성립 후 origin scope 쿠키 정리(D-062). 회귀 3건 | 해결 |
| D31 | **포트 계약이 문서와 구현으로 갈라져 있었다.** 주석은 "실패 시 throw", production adapter 는 `false` 반환. 그 둘에 서로 다른 정책이 붙어 같은 "내구 저장 실패" 가 로그인에서는 거부로, vault 경로에서는 degrade 로 처리됐다 | r8 재리뷰 §2 | ✅ **해결** — 신호는 boolean 하나로 정규화하고 정책은 연산이 정한다(D-063). r8 의 "영속 실패 = 로그인 거부" 테스트를 **degrade-open + 옛 secret 보존** 단언으로 다시 썼다 | 해결 |
| D32 | **리베이스로 r4–r7 해시가 바뀌었는데 handoff 기록이 옛 해시를 가리켰다.** `AC 24건` 잔재·존재하지 않는 `runtimeConfigFingerprint` 명칭·'vault key 전체 동결'(r8 에서 세대 접미사 도입) 서술도 남아 있었다 | r8 재리뷰 §2 | ⚠️ **부분 해결 → r10 에서 마감.** 해시 매핑과 3건은 고쳤으나 §7 머리말의 `AC 수가 24건이다` 가 남아 구현 보고의 "AC 25건" 과 모순됐다. r10 에서 25건으로 정정 | 해결 (r10) |
| D33 | **손상된 grant 파일이 여전히 authoritative 로 판정됐다.** r9 의 `dropped` 는 **레코드 단위**만 셌다. `parseRecordMap` 이 `!isRecord(raw)` 에서 `{records:{}, dropped:0}` 을 돌려주므로 `grants: []`·`null`·`"x"`·숫자가 **키 부재(정상적인 신규 설치)와 글자까지 같은 값**을 냈고, `load()` 의 `authoritative: dropped === 0` 이 그것을 권위 있는 "빈 저장소" 로 읽어 vault 고아 sweep 이 **멀쩡한 secret 을 전부 삭제**할 수 있었다. D-060 이 막으려던 바로 그 사고가 한 단계 위에 남아 있었다 | PR #336 리뷰 P1 + `store-file.ts:74,173` 실측 | ✅ **해결** — `undefined`(키 부재)만 정상적인 빈 값으로 인정하고 그 밖의 비-객체 top-level 은 `wellFormed:false`. 판정 규칙을 `isAuthoritative()` 하나로 모으고, 순수 부분을 `store-parse.ts` 로 분리해 신설 `store-parse.test.ts` 13건이 **parser 를 직접 부른다**(D-055/D-059 — r9 까지 `authoritative` 단언 11건이 전부 결과를 주입해 이 경로에 진입한 적이 없었다) | 해결 |
| D34 | **durable commit 이후 vault 실패가 메모리를 갈라 놨다.** `AuthStore.revoke()` 가 `persist` 성공 뒤 `vault.delete()` 를 가드 없이 부르고 그 다음에야 메모리를 바꿨다. `Vault.delete` 는 secret store 쓰기 3회 + index 재작성이라 던질 수 있고, 던지면 **디스크는 해제됐는데 이 프로세스의 grant 는 살아 있다** — 화면·Plugin 도구는 연결된 채로 남고 사용자는 "해제 실패" 를 본 뒤 재시작하면 해제돼 있다. `save():false` 를 성공으로 오인하던 r8 문제와 **방향만 반대인** 같은 split-brain | PR #336 리뷰 P1 + `store.ts:220-233`·`vault.ts:122-126` 실측 | ✅ **해결** — 경계를 **내구 저장 하나**로 못 박았다. 저장 전이면 아무것도 안 바뀌고(D-061 fail-closed 유지), 저장 후면 vault 정리 성공 여부와 무관하게 해제가 확정된다. 남은 키는 아무 grant 도 가리키지 않으므로 다음 부팅의 sweep(D33 이 다시 신뢰 가능하게 만든 그것)이 치운다. 회귀 1건 | 해결 |
| D35 | **비동기 쿠키 정리가 다음 로그인의 쿠키를 지울 수 있었다.** `LoginService.revoke()` 는 `clearSessionCookies` 를 fire-and-forget 으로 띄우는데 `BrowserSessionPort.clear` 는 실제로 비동기다. 해제 직후 재인증하면 그 삭제가 **방금 받은 쿠키**를 뒤늦게 지운다(같은 `sessionGroup`·같은 origin 이라 scope 를 좁혀도 걸린다). D-050 의 attempt 세대는 **커밋 축만** 막아 이 축에 닿지 않았다 | PR #336 리뷰 P2 + `login.ts:235-254`·`browser-session.ts:161-176` 실측 | ✅ **해결** — `sessionGroup` 별 in-flight clear promise 를 추적하고 `runSession` 이 창을 열기 전에 소진한다. 세대 비교로 "늦은 것을 무시" 하는 방식은 여기서 성립하지 않는다 — 무시할 결과가 아니라 **이미 실행 중인 부작용**이기 때문이다. 회귀 1건(실제 `SessionRunner` 를 태워 경로 진입까지 단언) | 해결 |
| D36 | **용어 잔재.** GLOSSARY 가 `Harness`(신규)와 `Engine`(현재 설계 용어)을 **동시에** 정의했고, `settings-write.ts` 의 사용자 노출 오류 2건이 `engine` 어휘였다 | PR #336 리뷰 P2 + `GLOSSARY.md:70` 실측 | ✅ **해결** — `Engine` 행을 *폐기 어휘 → Harness* 로 표시하고 남은 `engine` 문자열이 전부 compat boundary(채널·DTO key·`dist/<engine>/`)임을 명시. 가드 메시지 2건은 Harness 어휘로. **`engine:` 필드/키와 `orca:engine:*` 채널은 그대로**(D-005). 신규 슬라이스(`features/{auth,gate,plugins}`·`app/deployment`)는 `engine` 0건임을 재확인 | 해결 |
| D37 | **자동 제목 생성이 `providerSettings` 를 잃었다.** 0188 이 `ResolvedTurnProvider` 를 `{providerKey, prepared, …}` 로 바꾸면서 `BuildTurnContextInput.resolved` 에 남은 `providerSettings?` 가 **아무도 채우지 않는 죽은 optional** 이 됐다 — 구조적 타이핑이라 typecheck 가 잡지 못했고 `titleSettings` 는 항상 `undefined` 였다(`main` 에서는 채워졌다). 제목 생성이 `options.settings` 없이 돌았고, app env·settings env 가 없는 정적 배포에서는 **settings·env 둘 다** 없이 돌았다. AC17 은 ✅ 였지만 근거가 산문뿐이라 이것을 잡지 못했다 | r10 독립 진단 + `turn-context.ts:67-71,105` 실측 (외부 리뷰 미포착) | ✅ **해결** — 죽은 optional 을 **제거**하고 `titleEnv` 와 같은 층위의 **required** 입력 `titleSettings` 로 올렸다(구멍이 다시 열리면 컴파일에서 깨진다). `send.ts` 가 `prepared.providerSettings` 를 함께 넘긴다. 회귀 2건 | 해결 |
| D38 | **entry 를 못 고른 턴이 app env 를 잃고 채널을 respawn 했다.** `emptyPrepared()` 가 ① `appEnv` 를 넘기지 않아 orca.json `env` 레이어가 통째로 빠지고(0188 이전에는 `buildTurnEnv()` 가 entry 선택과 무관하게 불렸다) ② `harnessEnvFingerprint(undefined)` 라는 **정의된 값**을 냈다. `SessionRuntime` 은 spawn 마다 fingerprint 를 기록하므로 "spawn 기록 없으면 no-op" 가드는 콜드 스타트에서만 걸렸고, 해석 실패 턴이 곧 `runtimeEnvChanged:true` → **살아 있는 persistent channel teardown**. D-038 이 settings 축에서 못 박은 0125 보수적 null 의미론이 env 축에만 빠져 있었다 — 제안서 §성능 계약("Auth·settings 가 바뀌지 않으면 persistent runtime 재사용") 위반 | r10 독립 진단 + `turn-setup.ts:66,104`·`session-runtime.ts:355` 실측 (외부 리뷰 미포착) | ✅ **해결** — `runtimeEnvFingerprint` 를 `string \| undefined` 로 넓혀 **"비었다" 와 "모른다" 를 가르고**, 판정을 `runtimeEnvChangedSinceSpawn()` 순수 함수로 뽑아 두 호출부가 같은 규칙을 쓰게 했다(양쪽 중 하나라도 `undefined` 면 no-op). 조립 규칙은 `prepareUnresolvedHarnessConfig()` 로 내려 electron 을 물지 않는 자리에 두고 테스트가 production 진입점을 직접 부른다. 회귀 6건 | 해결 |
| D39 | **해제 영속 실패가 사용자에게 보이지 않는다.** D-061 이 `LoginService.revoke()` 에 사용자용 한국어 문구(`연결 해제를 저장하지 못했습니다…`)를 담아 던지고 IPC 는 `'reject'` 로 거절하는데, renderer 소비처가 `onRevoke={() => void providers.revoke(...)}` 라 그 rejection 을 버린다 — 사용자는 버튼을 눌러도 아무 일이 없고 문구를 보지 못한다(unhandled rejection). **핵심 계약은 지켜진다**(상태가 안 바뀌어 행이 '연결됨' 으로 남으므로 false success 없음). fire-and-forget 형태는 login/submit/reauth 도 같은 **0188 이전부터의 패턴**이라 이번 회귀는 아니다. 남은 것은 *문구를 만든 producer* 와 *그것을 버리는 consumer* 의 불일치다 | verify r1 §13 + `useProviders.ts:91-96`·`ExtensionsCatalogView.tsx:142` 실측 | ⏸ **제품 결정 대기** — 오류 표면 추가는 §6 비범위("UI 문구 변경")에 걸린다. 해결안으로 위장하지 않고 사용자에게 올린다 | 열림 |
| D40 | **저장소 루트에 미추적 `package-lock.json` 스텁이 남았다.** 루트에는 `package.json` 이 없는데 94바이트 lockfile 이 생겼다 — r10 세션이 의존성을 복구하며 루트에서 `npm install` 을 돌린 부산물이다. 커밋·게이트 영향은 0(`app/package.json` diff 0)이지만 `.gitignore` 대상이 아니라 `git add -A` 에 딸려 들어갈 수 있다 | verify r1 §11 작업 트리 위생 | 삭제 또는 `.gitignore` 추가. 트리비얼이라 `Handoff: none` 카브아웃 범위 | 열림 |

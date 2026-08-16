# Audit — 0188 사후 감사 (제안 충실도 · 성능 · UI/UX · 경량화)

> 설계 정본은 [`plan.md`](plan.md). 감사 대상은 **0188** (`docs/archive/handoffs/INDEX-history.md` 의
> `0188-auth-harness-plugin-lightweight`, verify/PASS).

## 이 문서의 성격

| 항목 | 값 |
|---|---|
| 대상 커밋 범위 | `ad10f6c..dff06a0` (app 139파일 · +8,561/−3,407) |
| 채점 기준 | **`0188/proposal.md` 원문**. `0188/plan.md`·`verify.md` 의 주장은 증거로 쓰지 않았다 |
| 증거 | 현재 워킹트리 코드 + `git show ad10f6c:<path>` 대조 |
| 게이트 재실행 | **하지 않았다** — 이 감사는 `app/**` 를 바꾸지 않고, 이 환경은 `app/node_modules` 부재로 lint/typecheck/vitest 실행 자체가 불가하다 |
| 한계 | 0188 도 이 감사도 Claude Code 가 수행했다. 채점 기준을 제안서 원문으로 잠그고 코드를 직접 읽어 완화했으나 **독립 감사자가 아니다** |

**수치의 성격**: 아래 줄 수·파일 수는 *이 커밋 범위의 관측*이다. "현재 몇 개인가" 의 정본은
[`docs/generated/inventory.md`](../../generated/inventory.md) 이며 이 문서는 그것을 대체하지 않는다
(root [`AGENTS.md`](../../../AGENTS.md) 원칙 4).

### 채점 기준의 타당성 — `proposal.md` 가 맞는가

맞다. 0188 자신이 그렇게 선언했다(전수 실측).

| 확인 | 결과 |
|---|---|
| `proposal.md` 의 출처 | 0188 `plan.md` 와 **같은 커밋**(`ad10f6c`, plan/READY)에 함께 들어왔다. 사후 첨부가 아니다 |
| `plan.md` 가 그것을 언급하는가 | **68회**. 메타 표에 `입력 정본 \| proposal.md (사용자 첨부 제안서, 저장소에 보존)` 로 1급 선언 |
| 구현 정본으로 잠갔는가 | `plan.md` **D-001**: "제안서(`proposal.md`)가 이번 작업의 구현 정본이다. 다른 초안·피드백 문서의 예시를 조합하지 않는다" (ACTIVE) |
| AC 의 원천을 무엇으로 밝혔는가 | `plan.md §2`: "**제안서의 `수용 기준`·`검증 지침` 절이 이 handoff 의 AC 원천이다 — 별도 제품 결정 없이 그대로 승계한다**" |

따라서 `proposal.md` 대조는 외부 기준을 들이대는 것이 아니라 **0188 이 스스로 선언한 계약을
그대로 채점하는 것**이다.

### 채점은 3층이다 (r2 개정 — 초안의 결함)

**제안서 하나만으로 채점하면 안 된다.** 0188 은 10라운드를 돌며 **ACTIVE Decision 63건**을 쌓았고,
그중 일부는 제안서를 정당하게 구체화·대체한다 — 출처가 **제안서 / 외부 리뷰 / 사용자**로 갈린다.
게다가 어떤 "이탈" 은 **0188 이전부터 그랬던 것**이라 0188 이 만든 변화가 아니다.

| 층 | 질문 | 근거 | 실패 의미 |
|---|---|---|---|
| 1 | code 가 `proposal.md` 와 다른가 | 제안서 원문 | 여기서 같으면 통과 |
| 2 | 다르면, **ACTIVE Decision 이 승인했는가 — 출처는 누구인가** | `0188/plan.md §3` (D-001~D-063) | 승인됐으면 이탈이 아니다 |
| 3 | 그래도 다르면, **0188 이 만든 변화인가** | `git show ad10f6c:<path>` | 원래 그랬으면 0188 의 회귀가 아니다 |

`plan.md` 는 제안서 요구를 **AC 표와 Decision Ledger 두 곳**에 나눠 담았다. **이 감사의 초안은 AC
표만 봤고, 그 때문에 2건을 오판하고 3건을 부정확하게 적었다** — 전문은 아래 [정정 이력](#정정-이력)
에 남긴다. 아래 축 1 은 3층으로 다시 채점한 결과다.

---

## 축 1 — 제안 충실도

> 구조 좌표: [`plan.md §9.2`](plan.md#92-축--구조-표면-매핑) · 배포 확장점 인벤토리는 `plan.md §9.4`.

**판정: 충실. 3층 채점 후 실질 이탈 3건(F1~F3) + 검증 공백 1건(F4).**

제안 §금지표 **22행 전부 미위반** — 이름만 바꾼 통합 facade · `HarnessModelProviderDefinition[]` ·
PluginHost/ConnectorRegistry · operation/endpoint registry · JSON path 범용 mapper · 새 DB migration 이
**하나도 만들어지지 않았다**(전수 grep). 구조 재배치는 제안대로 이뤄졌다.

> 아래 각 항목의 **층** 열은 [3층 채점](#채점은-3층이다-r2-개정--초안의-결함) 중 어디서 갈렸는지다.
> 2층·3층에서 해소된 것은 이탈이 아니다.

| # | 층 | 문제 | 원인 | 방안 |
|---|---|---|---|---|
| F1 | 1·2 통과 실패 | **spawn 입력 조립**이 `features/harnesses/prepared-config.ts` 에 있고 호출은 `app/chat-turn/turn-setup.ts:84` 다. 제안은 adapter-local 을 지정했고 **0188 자신의 `plan.md:452`("`adapters/` spawn preparation … `PreparedHarnessConfig` 생성")도 그렇게 적었다**. 이를 승인한 Decision 은 없다 | `turn-setup.ts` 가 electron 을 물어 vitest 가 import 하지 못한다 → 테스트 가능성을 위한 의도적 이탈(근거는 `prepared-config.ts:153`) | adapter 에 얇은 조립 진입점을 두고 순수부는 현 위치 유지, 또는 이탈을 Decision 으로 승격. **범위 주의**: fingerprint **SSOT 는 계약대로 adapter-local 이 맞다**(`plan.md:415` 요구 → `adapters/harness-config.ts:68`). 이탈은 조립 위치 하나뿐이다 |
| F2 | 1·2 통과 실패 | 배포 factory 가 `BoundAuth` 가 아니라 `AuthRuntime` **전체**를 받는다 — `app/deployment/harness-runtime.ts:97`(`HarnessConfigApiDeps`), 주입 `app/bootstrap.ts:441`. 같은 패턴이 `deployment/usage-fetcher.ts:40`·`deployment/plugins.ts:67` | 제안은 4곳에서 좁힌다(`proposal.md:523`·`:750`·`:1135`·`:1378`). **D-048**(출처 `r5 리뷰 §1 P1`)이 `HarnessConfigApiDeps{auth}` 를 정의했지만 **타입을 지정하지 않았다**. 결정적으로, 형제 축인 **D-051**(출처 `r6 리뷰 §1`)은 제안서 원문을 다시 꺼내 direct-credential 쪽을 "닫힌 closure map" 으로 **좁혔다** — 같은 라운드가 한쪽만 제안서로 되돌리고 다른 쪽은 두었다 | 세 deps 타입을 `BoundAuth`(또는 필요한 `request` 만)로 좁힌다. **단순 누락이 아니라 비대칭**이다. secret 표면은 넓어지지 않았다(`AuthSecretReader` 미전달); 넓어진 것은 배포가 `login`/`revoke`/`resume`/`subscribe` 를 쥔다는 점이다 |
| F3 | 2층에서 **악화** | SDK `options.settings.env` vs `options.env` 의 **characterization test 가 없다**(전 테스트 트리 grep 0건) | **AC15① 미이행이 아니라 ACTIVE Decision 미이행이다.** `D-017`(출처 제안서)이 "구현 전에 … characterization test 로 고정한 뒤 제안서의 결정표를 적용한다" 를 명시하고 **`상태=ACTIVE` · `대체 관계=—`** 다. `D-042`(env 블록 통째 hoist)가 접근을 바꿨으나 **D-017 을 SUPERSEDED 로 은퇴시키지 않았다** | 테스트 1건 추가 + **Ledger 정합성 정리**(D-042 가 D-017 을 대체했어야 한다). 지금은 SDK 가 `options.env` 를 무시하는 방향으로 바뀌어도 잡을 테스트가 없다 |

### F4 — 제안 요구는 Decision 으로 승계됐으나, 그중 일부에 **검증 수단(AC)이 없다**

`plan.md §2` 는 "제안서의 `수용 기준`·`검증 지침` 절이 이 handoff 의 AC 원천이다 — 별도 제품 결정
없이 그대로 승계한다" 라고 선언했다. 제안 수용기준 **36불릿**(구조 11 · 동작·성능 17 ·
보안·호환성 8)을 AC 25건에 1:1 매핑한 뒤, **AC 에 없는 것은 다시 Decision Ledger 와 baseline 으로
내려보냈다**.

| AC 에 없는 요구 | 2층 — 승인 Decision (출처) | 3층 — baseline | 코드 상태 |
|---|---|---|---|
| config API augmenter 에는 `BoundAuth` 만 (`:1378`) | **없음** (D-048 은 타입 미지정) | — | **미준수 → F2** |
| `AgentEnvironment` 도 compat boundary 에만 (`:1344`) | **D-030** (제안서) — 이름까지 그대로 담았다 | `toAgentEnvironments` 는 0188 **이전에도** `features/providers/model-resolve.ts:51` 에 있었다 | **충족** (r2 정정) |
| OAuth/session token 과 config API LLM token 별도 취급 (보안 §3) | **D-048** (r5 리뷰) — 두 deps 타입 분리 | — | 구조적 충족. 기본 배포가 비어 런타임 실증 불가 |
| Usage 정본·mirror·cron·수동 refresh·DB cache 유지 (`:1373`) | **D-026** (제안서) — 이유 칸이 이 문장을 그대로 적었다 | — | 충족 — `features/usage/` diff 가 주석 1줄 |
| Harness/Plugin/Usage 상호 직접 import 금지 (구조 §7) | 저장소 규칙 — `plan.md §8` 이 `app/src/main/AGENTS.md §레이어 DAG` + eslint boundaries 로 기록 | — | 충족 |
| Usage·Confluence response mapping 위치 (구조 §10) | **D-026 · D-023** (제안서) | — | 충족 |

**결론**: AC 에 없던 6건 중 **5건은 Decision 또는 저장소 규칙이 승계했고, 실제 이탈은 1건(F2)뿐**이다.
남는 사실은 *승계 실패* 가 아니라 **검증 공백** 이다 — Decision 은 "무엇을 지킬지" 를 적지만
누가 그것을 확인하는지는 정하지 않는다. D-030·D-026 은 지켜졌으나 그것은 **AC 가 확인한 결과가
아니라 코드가 우연히 안 바뀐 결과**다.

> 방법: 36불릿 → AC1~25 수동 1:1 매핑 → AC 미대응분을 D-001~D-063 전수 대조 → 남은 것을
> `git show ad10f6c:` baseline 대조. 초안은 첫 단계에서 멈춰 2건을 오판했다([정정 이력](#정정-이력)).

### 부수 (낮음)

| 항목 | 층 | 실측 |
|---|---|---|
| RouterContext | 1 | 제안은 `providerSettings` 를 `harnessRuntime` 으로 **교체**한다고 썼으나 실제는 rename 후 존치 + 신규 2필드(`app/context.ts`). 열거·CRUD invalidate 소비자가 남아 불가피해 보이나 "실행 구성 입구는 하나" 라는 의도는 절반만 달성 |
| `PreparedHarnessConfig.runtimeConfigFingerprint` | 2 (해소) | env 전용 `runtimeEnvFingerprint`(optional)로 축소 — **D-021 → D-038 로 SUPERSEDED 된 정식 개정**이다. 근거도 정당하다(settings 축의 0125 null 의미론을 뒤집지 않기 위함, `adapters/harness-config.ts:41`) |

---

## 축 2 — 성능

> 구조 좌표: [`plan.md §9.3`](plan.md#93-제어-흐름-4개--발견을-화살표에-못박는다) — P1~P6 이 부팅·턴·자격증명 흐름의 어느 단계인지 화살표로 고정돼 있다.

**판정: 0187 이 만든 개선 4건은 전부 보존. 0188 이 새로 얹은 비용 6건 — 낭비형 2 / 대가형 4.**

정적·기본 배포에서는 **턴당 파일 I/O 증가 0**이고 vault 접근은 오히려 **−1**이다(구 `llmEnvFor`
경로 소멸). 성능 저하는 **폐쇄망 형상**(settings env 블록 + orca.json env 또는 augmenter)에 집중된다.

### 0187 개선의 보존 (실측)

| 0187 개선 | 현재 |
|---|---|
| `secret()` 이 vault 를 1회만 읽는다(만료 판정을 읽기 **전**에) | 유지 — `features/auth/store.ts:415` |
| 요청당 credential 1회 해석, 홉은 메모리 fence | 유지 — `features/auth/authenticated-request.ts:146`(carrier 1회), 홉 루프는 `isCurrentUnexpiredGrant` 만 |
| 부팅 resume 병렬 + 방송 1회 | 유지 — `app/auth-resume.ts:68`(`Promise.all`) + `pushConnectionState()` 호출 1곳 |
| OAuth pending 스토어 지연 개방 | 유지·확대 — `features/auth/store-file.ts:56`(`open()` 이 첫 load/save 에서만) |

### 낭비형 — 오작동 없음, CPU 만 먹는다. 각각 한 파일에서 닫힌다

| # | 문제 | 원인 | 방안 |
|---|---|---|---|
| P1 | env fingerprint 를 spawn 마다 **2회** 계산한다 | `features/harnesses/prepared-config.ts:149` 가 계산한 값을 `features/sessions/session-runtime.ts:355` 가 버리고 `harnessEnvFingerprint(req.env)` 로 재계산한다. `TurnRequest` 에 fingerprint 를 나를 필드가 없어 **재사용이 구조적으로 불가능**하다 — 0188 plan §14 의 "같은 prepared 입력을 재사용할 때는 계산값도 재사용한다" 미이행. **2회 계산을 승인한 Decision 은 없다**(D-038·D-043 은 범위와 표현만 정한다) | `TurnRequest` 에 fingerprint 필드를 추가하고 `SessionRuntime` 은 받은 값을 기록한다. **두 값은 항상 일치하므로 상시 respawn 은 없다** — `req.env` 는 `prepared.env` 의 얕은 복사이고 canonicalize 가 키를 정렬한다 |
| P2 | `providerSettingsChangedSinceSpawn` 의 참조 비교 fast path 가 깨져 매 턴 `JSON.stringify` 2회로 간다 | **`D-042`(env 블록을 통째로 걷어낸다)의 미기록 부작용이다** — 결정 자체는 정당했고(두 채널에 같은 키가 남는 것을 막는다) 부작용만 아무도 적지 않았다. `prepared-config.ts:131` 의 `withoutEnvBlock` 이 settings 에 `env` 블록이 **있으면** 매 턴 새 객체를 만든다. 그래서 `features/harnesses/runtime-boundary.ts:24` 의 `spawned.settings === resolved.settings` 가 항상 빠져나간다. 0125 가 그 파일에 못 박은 "상시 경로는 참조 비교 1회" 가 사라졌다 | 조립 결과를 캐시해 같은 입력이면 같은 참조를 돌려준다. **조건**: settings env 블록 + (orca.json env 또는 augmenter) — 폐쇄망 표준 형상에서만 발생한다 |

### 대가형 — 되돌리면 0188 이 고친 결함이 되살아난다

각 비용을 **승인한 ACTIVE Decision** 을 함께 적는다 — 드리프트가 아니라 결정이다.

| # (승인 결정) | 신규 비용 | 맞바꾼 것 |
|---|---|---|
| P3 (**D-020**) | continuation 마다 `process.env` 전량 복사 + 4계층 병합 + canonical 직렬화 + HMAC (`app/chat-turn-continuation.ts:61` → `chat-turn/turn-setup.ts:84`). 0188 이전 continuation 은 `env` 필드 자체가 없었다 | continuation 의 env 신선도 — 옛 토큰으로 연속 턴이 도는 문제 |
| P4 (**D-060**) | 부팅 vault sweep 상시 비용: 고아 0건이어도 index 읽기 +1 · 복호화 +1 (`features/auth/store.ts:165`). 고아 N건이면 읽기 +4N / 쓰기 +3N | 세대 키 고아 정리. `authoritative:false` 면 조기 return 하므로 손상 상황에서는 비용도 0이다 |
| P5 (**D-056**) | 재인증 1회당 vault 연산 1벌 → 2벌 (신규 키 set + 옛 키 `discardKeys`, `features/auth/login.ts:510`). hot path 아님 | 자격증명 교체 원자성 — 이전 구현은 고정 키를 덮어써 실패 시 옛 값이 파괴됐다 |
| P6 (**D-038**) | 동적 배포에서 토큰 회전(`validUntil − 30s`)마다 fingerprint 변화 → 채널 respawn. **기본/정적 배포에서는 발생하지 않는다**(augmenter 가 `{}` 를 반환) | 죽은 토큰으로 살아 있는 채널이 계속 도는 문제 |

### 개선 여지 (0188 회귀는 아님)

`app/bootstrap.ts:367` 의 Auth listener 가 `credentialChanged` 가드보다 **앞**에서 무조건
`pushConnectionState()` 를 부른다 — 입력 폼 여는 step 변화에도 전체 상태를 재생성한다. 0188 이
`credentialChanged` 축을 만들고도 방송에는 적용하지 않았다. **pre-0188 도 동일**하므로 회귀가
아니라 남아 있는 최적화 여지다.

---

## 축 3 — UI/UX

> 구조 좌표: [`plan.md §9.3`](plan.md#93-제어-흐름-4개--발견을-화살표에-못박는다) (c)해제·(d)카탈로그 흐름.

**판정: 불변식 대부분 유지. 회귀 1건(U1) + 미기록 1건(U2) + Decision 강제 지점 부분 적용 1건(U3).**

> 초안은 U2 를 "비범위 침범 3건", U3 를 "정보성" 으로 적었다. 2층 채점에서 **U2 는 2건이 승인된 변경**으로, **U3 는 오히려 Decision 미충족**으로 바뀌었다.

### 유지 (실측)

| 제안 불변식 | 결과 |
|---|---|
| 새 `connection` kind 추가 금지 | ✅ 0건. `shared/ipc.ts` 의 `ProviderKind = 'gate' \| 'llm' \| 'service'` 무변경 |
| polling 추가 금지 | ✅ 0건. renderer 는 초기 invoke 1회 + push 구독 |
| markup / CSS class / 클릭 횟수 / IPC 왕복 | ✅ 무변경. renderer diff 2파일이고 실질 변경은 훅 내부뿐 |
| i18n 사전 | ✅ `app/src/shared/i18n/` diff 0 |
| `ProviderInfo` 전 필드 + `ProviderPlatformState.step` | ✅ 10필드 + step 전부 동치 (`app/connection-views.ts:54`) |
| `ProviderFailureReason` 집합 | ✅ 동일 |
| gate 초기 상태·resume 표시·방식 선택·form·debug 우회 | ✅ 진리표 동일. `evaluateGate` 에 `blocked` 인자만 추가됐고 기본 배포는 `GATE_AUTH_DEFINITIONS = []` 라 미사용 |

### 회귀

| # | 문제 | 원인 | 방안 (D-004: 이번엔 기록만) |
|---|---|---|---|
| U1 (중) | 해제 영속 실패가 화면에서 **"아무 일도 안 일어남"** 으로 보인다. main 이 만든 한국어 메시지가 어디에도 표시되지 않는다 | `features/auth/login.ts:228` 이 사용자용 메시지를 담아 throw → `app/handlers/providers.ts:67` 이 `'reject'` 로 거절 → 그런데 `renderer/.../hooks/useProviders.ts:91-96` 의 `revoke` 에 try/catch 가 없고 `.../ExtensionsCatalogView.tsx:142` 가 `void providers.revoke(...)` 로 rejection 을 버린다 = **unhandled rejection** | 오류 표면 추가. 단 제안 §비범위 "UI 문구 변경" 에 걸려 **사용자 결정 사항**이다. **핵심 계약은 지켜진다** — 상태가 바뀌지 않아 행이 '연결됨' 으로 남으므로 false success 는 없다. ⚠️ **0188 `verify.md` 의 D39 와 동일 항목이며 새 발견이 아니다** |
| U2 (낮음) | 사용자 대면 한국어 문구 변경 — 초안은 3건을 "제안 §비범위 침범" 으로 적었으나 **2건은 승인된 변경이다** | `features/harnesses/settings-write.ts` 2건(`'claude engine 만 …'`→`'claude Harness 만 …'` · `'유효하지 않은 engine key …'`→`'… Harness key …'`)은 **PR #336 외부 리뷰 P2 지적 → 사용자 결정으로 수용**했다(`0188/plan.md` r10 반영 행 · 파생이슈 D36). 남는 것은 `features/auth/login.ts:375` **1건**(`'등록되지 않은 provider 입니다'`→`'… Auth 입니다'`) | 이 1건도 위반 단정이 아니다 — **D-004**(신규 코드에서 Auth 어휘) 와 제안 §비범위("기존 renderer 표시 문구는 바꾸지 않는다") 사이의 **회색지대**이고, 실제 문제는 **어디에도 기록되지 않았다**는 점이다. 도달 조건이 미등록 id 호출이라 정상 UI 에서 실질 도달은 어렵다 |
| U3 (**D-054 부분 적용**) | 0188 이 신설한 "늦게 온 응답 폐기" 가드가 소비처 2곳 중 1곳에만 있다 | **정보성이 아니라 ACTIVE Decision 의 강제 지점 미충족이다.** `D-054`(출처 r6~r7 리뷰)가 "**Renderer 도 자기보다 뒤에 시작된 요청이 있으면 invoke 응답을 버린다**" 를 명시했는데 `renderer/.../hooks/useProviders.ts:57` 만 닫혔고 `renderer/.../hooks/useProviderGate.ts:48` 은 열려 있다 | 가드를 게이트 훅에도 적용한다. **현재 실피해는 없다** — main 의 `supersededStep()`(`features/auth/login.ts:176`)이 현재값을 그대로 돌려주므로 덮어쓰기가 일어나지 않는다(실측). 남는 것은 계약이 한 지점만 닫혔다는 사실이다 |

### 정보성 관측 2건

- `AuthRuntime.snapshot()` 이 `store.settleExpiry()` 부수효과를 갖는다(`features/auth/runtime.ts:119`).
  읽기 IPC(`providerList`/`providerState`) 한 번이 push 방송과 도구 회수를 유발할 수 있다.
  `expirySettled` 가 1회성을 보장해 루프는 없고, 제안이 금지한 polling 을 피하기 위한 의도적 설계다.
- 재인증 실패 시 row 가 **'연결됨' 으로 남는다**(구 동작은 '연결 안 됨' 으로 떨어졌다). AC7·D-047 이
  의도한 개선이지만 같은 상황의 **화면 관측이 달라진 것**은 사실이다.

---

## 축 4 — 경량화

> 구조 좌표: [`plan.md §9.1`](plan.md#91-as-is--감사-대상-구조-0188-이-만든-것) 슬라이스 지도 + `§9.4` 확장점 인벤토리.

**판정: 미달.** 결합 축은 달성했으나 볼륨·개념·간접층 축은 전부 반대 방향이다.
(판정 기준에 볼륨을 포함하는 것은 이번 턴 사용자 결정 — [`plan.md`](plan.md) D-002.)

| 축 | 목표 | 실측 | 판정 |
|---|---|---|---|
| 계약 결합 | 소비 슬롯 제거 | `Provider.kind`/`.llm`/`.tools` 와 `ProviderPlatform` 파사드 제거. feature → feature 교차 import 0(외부 importer 는 전부 `app/` 컴포지션 루트) | **달성** |
| 코드량 | 감소 | main 프로덕션 `.ts` **24,249 → 26,480 (+2,231, +9.2%)**. 내역: Phase A~C +1,325 · 외부리뷰 r2~r10 +906 (테스트는 별도 +2,161) | **미달** |
| 같은 자리 대조 | 감소 | 구 `features/providers/` 35파일 5,068줄(주석 제외 3,400) → 신 `features/{auth,gate,harnesses,plugins}` 34파일 **6,171줄(주석 제외 4,017)** = **+21.8% / +18.6%**. Confluence(순수 rename, −3.5%)를 빼면 **인증 코어만 +30%**. `auth/login.ts` 476→795 · `auth/store.ts` 186→437 | **미달** |
| 파일 수 | — | 35 → **42 (+20%)** (슬라이스 밖 신설 `app/deployment/` 6 + `connection-views.ts`·`auth-resume.ts` 2 포함) | 증가 |
| 개념 수 | 감소 | 제거 10(`Provider.kind`·`.llm`·`.tools`·`ProviderPlatform`·`ServiceToolRegistrar`·`registry.byKind`·`captureForRollback`/`rollback`·`sweepPlugins`·`missing_probe` 검사·`declarations/` 3분할) vs 신설 20+ | **미달** |
| 간접층 | "추상화는 같은 중복이 실제로 반복될 때만 추출한다" (제안 §구현자가 만들면 안 되는 것 말미) | **기본 배포 구현체 0개**인 추상: `RuntimeConfigAugmenter(s)` · `PluginBinding` 계열 · `UsageFetcher` 배포 factory · `ConnectionViewSource` 의 `harness`/`usage` category · `HarnessConfigApiDeps`/`HarnessDirectCredentialDeps`. `app/deployment/` 529줄 중 실행코드 130줄. `features/harnesses/runtime-config.ts` 266줄은 augmenter 0개라 generation·single-flight·stale-retry 가 **기본 빌드에서 도달 불가** | **미달** |

> **이 구조는 드리프트가 아니라 결정이다** — `D-044`(배포 factory 4종을 인자화, 출처 r3 리뷰) · `D-045`(가상 배포 fixture, r3) · `D-048`(두 주입 방식 타입 분리, r5) · `D-051`(닫힌 closure map, r6) 이 각각 승인했다. 볼륨 판정(D-002)은 유지하되, **누가 결정했는가**를 함께 읽어야 공정하다: 배포 확장점은 외부 리뷰가 "배포가 `bootstrap.ts` 를 열게 만든다" 는 실제 결함을 지적해 만들어졌다.
>
> "구현체 0개" 는 **기본 배포 기준**이다. `app/deployment/deployment-wiring.test.ts` 가 가상 배포로
> 그 경로들을 실제로 태우므로(AC25) "테스트조차 없다" 는 뜻이 아니다.

### 반대 논거 (판정과 함께 읽어야 한다)

1. **순증의 큰 몫은 강건화이지 낭비가 아니다.** r4~r10 이 추가한 `generation` ·
   `credentialRevision` · `expirySettled` · `authoritative` · `versionedVaultKey` 는 각각 **실측된
   결함**에 대응한다 — 확인 전 커밋, 만료 미정착, 손상된 저장소를 빈 저장소로 오인한 sweep,
   교체 중 자격증명 파괴. 그 대가로 `auth/login.ts` 와 `auth/store.ts` 가 커졌다.
2. **제안서·plan 어디에도 LOC 목표가 없었다.** plan §14 는 "슬라이스 수 같은 수치 목표를 세우지
   않는다" 를 명시적으로 적었고, 제안 §최종 판정도 줄여야 할 것을 "**결합**" 으로 규정했다.
   따라서 볼륨 축의 "미달" 은 **원 계약 위반이 아니라 이번 감사 기준(D-002)에 따른 판정**이다.

### 축소 후보 (후속 검토 대상)

| 대상 | 근거 |
|---|---|
| `app/deployment/harness-runtime.ts` | 163줄 중 **122줄이 주석**(예제 레시피). 가이드 문서로 옮길 여지 |
| `features/harnesses/runtime-config.ts` | 266줄 전체가 augmenter 0개 상태에서 도달 불가 경로. 폐쇄망 배포가 실제로 생기기 전까지의 비용 |
| `features/auth/login.ts` | 795줄에 resume/login/continue/reauth/revoke 가 동거. 저장소 3위 크기 |

---

## 종합

| 축 | 판정 | 즉시 볼 것 |
|---|---|---|
| 제안 충실도 | **충실** (이탈 3건 + 검증 공백) | **F3** — `D-017` 이 ACTIVE 인데 미이행이고 `D-042` 가 은퇴시키지도 않았다(Ledger 정합성). F4 는 승계 실패가 아니라 **검증 공백**으로 축소됐다 |
| 성능 | **0187 보존, 신규 비용 6건** | P1 · P2 — 오작동 없이 CPU 만 먹고 각각 한 파일에서 닫힌다 |
| UI/UX | **부분 회귀 3건** | U1 — 기본 빌드에서 사용자가 실제로 만날 수 있는 유일한 회귀. 단 0188 D39 의 재확인 |
| 경량화 | **미달** | 간접층 — 배포 확장점 529줄과 `runtime-config.ts` 266줄이 기본 빌드에서 도달 불가 |

**0188 파생 이슈와의 중복** (plan D-007):

| 0188 verify | 이번 감사 | 관계 |
|---|---|---|
| D39 (해제 실패 UX, 제품 결정 대기) | U1 | **동일 항목의 재확인.** 새 발견이 아니다 |
| D40 (루트 미추적 `package-lock.json`) | — | 이번 감사 범위 밖(작업 트리 위생) |

**다음 단계**: F1~F3 · P1~P2 · U2~U3 의 시정 여부를 결정한다. **F3(D-017 은퇴 누락)과 U3(D-054 부분 적용)은 Decision Ledger 정합성 문제라 코드 수정 없이도 정리할 수 있다.** 시정한다면 별도 핸드오프(0190)로
설계한다 — 이 감사는 코드를 바꾸지 않았다.

**절차에 남길 것 — 이 감사 자신의 실패에서**: 초안은 축 1 을 `code ↔ proposal.md` **1층**으로만
채점해 **2건을 오판**했다(`AgentEnvironment` · `ResolvedHarnessSettings` 명명 — 둘 다 0188 이전부터
그랬거나 Decision 이 승계한 것이었다). 원인은 지침에 없다는 것이다: **`handoff-verify` 는 "AC 와
production path 를 대조하라" 고만 하고, 외부 입력 정본이 있는 handoff 에서 ① ACTIVE Decision Ledger
와 ② 변경 전 baseline 을 함께 보라고 요구하지 않는다.** 지침 자체의 개선이므로
[`handoff-review`](../../../.agents/skills/handoff-review/SKILL.md) 대상이며, 이 감사는 그 신호만 남긴다.

---

## 정정 이력

초안(커밋 `9a2980a`·`57f75bd`)은 축 1 을 제안서 1층으로만 채점했다. 사용자가 "구현 과정에서
변수명·모듈명이 사용자 제안으로 바뀌었을 수 있다" 고 지적해 3층으로 다시 채점했다. **이미 push 된
문서이므로 조용히 덮지 않고 초안 주장을 함께 남긴다.**

### 철회 2건 — 오판

| 초안 주장 | 실측 | 놓친 층 |
|---|---|---|
| `AgentEnvironment` 가 compat boundary 밖(feature)에서 생성 → **미준수** | **철회.** `toAgentEnvironments` 는 0188 **이전에도** `features/providers/model-resolve.ts:51` 에 있었다 — 같은 줄번호, 순수 이동(→ `features/harnesses/models.ts:51`). `D-030`(제안서) 이 요구를 이름까지 승계했고 `models.ts:56` 이 **"0188 D-030"** 을 인용하며 wire 필드명을 유지한다 | 2·3층 |
| `ResolvedHarnessSettings` 필드가 제안의 `key` 가 아니라 `providerKey`+`provider` → **제안과 다름** | **철회.** 0188 이전 `ResolvedProviderSettings` 가 이미 `providerKey`·`provider`·`settings` 였다(`ad10f6c:app/src/main/adapters/provider-config.ts:11-14`). `D-005`(호환성 식별자 유지) + Phase A 기계적 rename 범위 | 2·3층 |

### 정정 3건

| 초안 | 개정 |
|---|---|
| F1 "조립이 adapter 를 떠났다" (과대) | fingerprint **SSOT 는 계약대로 adapter-local 이 맞다**. 이탈은 **조립 위치 하나**. 대신 제안서만이 아니라 **`0188/plan.md:452` 에도 어긋난다**는 사실을 추가 |
| F4 "제안 6건이 AC 로 승계되지 않았다" | **틀렸다.** 6건 중 5건은 Decision(D-030·D-026·D-023·D-048) 또는 저장소 규칙이 승계했다. 실제 이탈은 **1건(F2)**. 남는 사실은 승계 실패가 아니라 **검증 공백** |
| U2 "문구 3건이 비범위 침범" | `settings-write` 2건은 **외부 리뷰 지적 → 사용자 결정으로 수용**(D36). 남는 것은 `login.ts:375` 1건이고 그것도 **회색지대 + 미기록** |

### 강화 3건 — 3층 채점이 오히려 무겁게 만든 것

| 초안 | 개정 |
|---|---|
| F3 "AC15① 미이행" | **ACTIVE Decision `D-017` 미이행** — `상태=ACTIVE`·`대체 관계=—` 인데 `D-042` 가 접근을 바꾸고도 은퇴시키지 않았다. **Ledger 정합성 결함** |
| F2 "AC 번역 누락" | **비대칭**이다 — `D-051` 이 형제 축(direct credential)에서는 제안서 원문을 다시 꺼내 좁혔는데 config API 쪽은 두었다 |
| U3 "정보성" | **`D-054` 강제 지점 2곳 중 1곳만 닫힘** — Decision 이 renderer 가드를 명시적으로 요구한다 |

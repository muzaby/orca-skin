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

---

## 축 1 — 제안 충실도

**판정: 충실. 실질 이탈 3건.**

제안 §수용기준 **구조 12건 중 11충족 / 1부분**, **보안·호환성 9건 중 7충족 / 1이탈 / 1미검증**,
**§구현자가 만들면 안 되는 것 22행 전부 미위반**. 가장 위험한 축 — 이름만 바꾼 통합 facade ·
`HarnessModelProviderDefinition[]` · PluginHost/ConnectorRegistry · operation/endpoint registry ·
JSON path 범용 mapper · 새 DB migration — 은 **하나도 만들어지지 않았다**(전수 grep).

| # | 문제 | 원인 | 방안 |
|---|---|---|---|
| F1 | spawn 입력 조립이 adapter 밖에 있다. 제안은 adapter-local 을 지정했으나 실제 조립은 `app/src/main/features/harnesses/prepared-config.ts`, 호출은 `app/src/main/app/chat-turn/turn-setup.ts:84`. `adapters/claude.ts` 는 여전히 `settings`·`env` 두 채널을 무비판 전달한다 | `turn-setup.ts` 가 electron 을 물어 vitest 가 import 하지 못한다 → **테스트 가능성을 위한 의도적 이탈**. 근거가 코드에 있다(`prepared-config.ts:153`) | adapter 에 얇은 조립 진입점을 두고 순수부는 현 위치 유지. 또는 이탈을 명시 결정으로 승격해 제안과의 차이를 문서에 남긴다. **부작용**: adapter 를 우회해 spawn 입력을 만드는 경로가 하나 더 생겨, 향후 다른 Harness adapter 가 자기 조립 규칙을 넣을 자리가 없다 |
| F2 | 배포 factory 가 `BoundAuth` 가 아니라 `AuthRuntime` **전체**를 받는다 — `app/src/main/app/deployment/harness-runtime.ts:97`(`HarnessConfigApiDeps`), 주입은 `app/src/main/app/bootstrap.ts:441`. 같은 패턴이 `deployment/usage-fetcher.ts:40`·`deployment/plugins.ts:67` | 제안 §보안·호환성 의 "config API augmenter 에는 `BoundAuth` 만 전달" 이 **plan 의 AC 로 번역되지 않았다** — AC5 는 `AuthSecretReader` 부재만 단언한다. 번역 누락이 그대로 구현 이탈이 됐다 | 세 deps 타입을 `BoundAuth`(또는 필요한 `request` 만)로 좁힌다. **secret 표면은 넓어지지 않았다**(`AuthSecretReader` 는 전달되지 않는다). 넓어진 것은 배포가 `login`/`revoke`/`resume`/`subscribe` 를 쥔다는 점이다 |
| F3 | SDK `options.settings.env` vs `options.env` 의 **characterization test 가 없다**(전 테스트 트리 grep 0건) | 제안과 plan AC15 ① 이 "실제 우선순위를 먼저 고정한 뒤 결정표를 적용" 을 요구했으나, 구현은 "settings 의 env 블록을 통째로 hoist" 라는 제3의 fail-safe 를 택했다(`prepared-config.ts:76`). 결과는 안전하지만 SDK 동작이 코드로 고정되지 않았다 | SDK 실동작을 고정하는 테스트 1건 추가. 지금은 SDK 가 `options.env` 를 무시하는 방향으로 바뀌어도 잡을 테스트가 없다 |

### 부수 (낮음)

| 항목 | 실측 |
|---|---|
| `ResolvedHarnessSettings` 필드명 | 제안의 `key` 가 아니라 `providerKey`+`provider`(`adapters/harness-config.ts:17`). wire/DB 호환 문자열 유지 목적 |
| `AgentEnvironment` 생성 위치 | compat boundary 밖 — `features/harnesses/models.ts:51`. 제안 §구조 의 "compat boundary 에만" 문구와 어긋난다 |
| RouterContext | 제안은 `providerSettings` 를 `harnessRuntime` 으로 **교체**한다고 썼으나 실제는 rename 후 존치 + 신규 2필드(`app/context.ts`) |
| `PreparedHarnessConfig.runtimeConfigFingerprint` | env 전용 `runtimeEnvFingerprint`(optional)로 축소. **plan D-038/AC19 가 승인한 개정**이며 근거가 정당하다(settings 축의 0125 null 의미론을 뒤집지 않기 위함, `adapters/harness-config.ts:41`) |

---

## 축 2 — 성능

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
| P1 | env fingerprint 를 spawn 마다 **2회** 계산한다 | `features/harnesses/prepared-config.ts:149` 가 계산한 값을 `features/sessions/session-runtime.ts:355` 가 버리고 `harnessEnvFingerprint(req.env)` 로 재계산한다. `TurnRequest` 에 fingerprint 를 나를 필드가 없어 **재사용이 구조적으로 불가능**하다 — 0188 plan §14 의 "같은 prepared 입력을 재사용할 때는 계산값도 재사용한다" 미이행 | `TurnRequest` 에 fingerprint 필드를 추가하고 `SessionRuntime` 은 받은 값을 기록한다. **두 값은 항상 일치하므로 상시 respawn 은 없다** — `req.env` 는 `prepared.env` 의 얕은 복사이고 canonicalize 가 키를 정렬한다 |
| P2 | `providerSettingsChangedSinceSpawn` 의 참조 비교 fast path 가 깨져 매 턴 `JSON.stringify` 2회로 간다 | `prepared-config.ts:131` 의 `withoutEnvBlock` 이 settings 에 `env` 블록이 **있으면** 매 턴 새 객체를 만든다. 그래서 `features/harnesses/runtime-boundary.ts:24` 의 `spawned.settings === resolved.settings` 가 항상 빠져나간다. 0125 가 그 파일에 못 박은 "상시 경로는 참조 비교 1회" 가 사라졌다 | 조립 결과를 캐시해 같은 입력이면 같은 참조를 돌려준다. **조건**: settings env 블록 + (orca.json env 또는 augmenter) — 폐쇄망 표준 형상에서만 발생한다 |

### 대가형 — 되돌리면 0188 이 고친 결함이 되살아난다

| # | 신규 비용 | 맞바꾼 것 |
|---|---|---|
| P3 | continuation 마다 `process.env` 전량 복사 + 4계층 병합 + canonical 직렬화 + HMAC (`app/chat-turn-continuation.ts:61` → `chat-turn/turn-setup.ts:84`). 0188 이전 continuation 은 `env` 필드 자체가 없었다 | continuation 의 env 신선도 — 옛 토큰으로 연속 턴이 도는 문제 |
| P4 | 부팅 vault sweep 상시 비용: 고아 0건이어도 index 읽기 +1 · 복호화 +1 (`features/auth/store.ts:165`). 고아 N건이면 읽기 +4N / 쓰기 +3N | 세대 키 고아 정리. `authoritative:false` 면 조기 return 하므로 손상 상황에서는 비용도 0이다 |
| P5 | 재인증 1회당 vault 연산 1벌 → 2벌 (신규 키 set + 옛 키 `discardKeys`, `features/auth/login.ts:510`). hot path 아님 | 자격증명 교체 원자성 — 이전 구현은 고정 키를 덮어써 실패 시 옛 값이 파괴됐다 |
| P6 | 동적 배포에서 토큰 회전(`validUntil − 30s`)마다 fingerprint 변화 → 채널 respawn. **기본/정적 배포에서는 발생하지 않는다**(augmenter 가 `{}` 를 반환) | 죽은 토큰으로 살아 있는 채널이 계속 도는 문제 |

### 개선 여지 (0188 회귀는 아님)

`app/bootstrap.ts:367` 의 Auth listener 가 `credentialChanged` 가드보다 **앞**에서 무조건
`pushConnectionState()` 를 부른다 — 입력 폼 여는 step 변화에도 전체 상태를 재생성한다. 0188 이
`credentialChanged` 축을 만들고도 방송에는 적용하지 않았다. **pre-0188 도 동일**하므로 회귀가
아니라 남아 있는 최적화 여지다.

---

## 축 3 — UI/UX

**판정: 불변식 대부분 유지. 회귀 3건 — 중 1 · 낮음 1 · 정보성 1.**

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
| U2 (낮음) | 사용자 대면 한국어 문구 **3건** 변경 — 제안 §비범위("버튼/문구 변경") 침범 | `features/auth/login.ts:375` `'등록되지 않은 provider 입니다'` → `'등록되지 않은 Auth 입니다'` · `features/harnesses/settings-write.ts` `'claude engine 만 …'` → `'claude Harness 만 …'` · `'유효하지 않은 engine key …'` → `'유효하지 않은 Harness key …'` | 0188 `plan.md` r10 기록은 **settings-write 2건만** 인정했고 `login.ts` 1건은 어디에도 기록이 없다 → 기록 보정. 도달 조건이 미등록 id 호출이라 정상 UI 에서 실질 도달은 어렵다 |
| U3 (정보성) | 0188 이 신설한 "늦게 온 응답 폐기" 시퀀스 가드가 소비처 2곳 중 1곳에만 있다 | `renderer/.../hooks/useProviders.ts:57` 에는 있고 `renderer/.../hooks/useProviderGate.ts:48` 에는 없다 — 불변식 전수 적용 누락 | main 의 `supersededStep()`(`features/auth/login.ts:176`)이 현재값을 그대로 돌려주므로 **실제 덮어쓰기는 없다**(실측). 남는 것은 계약 비대칭뿐 |

### 정보성 관측 2건

- `AuthRuntime.snapshot()` 이 `store.settleExpiry()` 부수효과를 갖는다(`features/auth/runtime.ts:119`).
  읽기 IPC(`providerList`/`providerState`) 한 번이 push 방송과 도구 회수를 유발할 수 있다.
  `expirySettled` 가 1회성을 보장해 루프는 없고, 제안이 금지한 polling 을 피하기 위한 의도적 설계다.
- 재인증 실패 시 row 가 **'연결됨' 으로 남는다**(구 동작은 '연결 안 됨' 으로 떨어졌다). AC7·D-047 이
  의도한 개선이지만 같은 상황의 **화면 관측이 달라진 것**은 사실이다.

---

## 축 4 — 경량화

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
| 제안 충실도 | **충실** (이탈 3건) | F2 — 제안 → plan AC 번역 누락이 그대로 구현 이탈이 된 사례 |
| 성능 | **0187 보존, 신규 비용 6건** | P1 · P2 — 오작동 없이 CPU 만 먹고 각각 한 파일에서 닫힌다 |
| UI/UX | **부분 회귀 3건** | U1 — 기본 빌드에서 사용자가 실제로 만날 수 있는 유일한 회귀. 단 0188 D39 의 재확인 |
| 경량화 | **미달** | 간접층 — 배포 확장점 529줄과 `runtime-config.ts` 266줄이 기본 빌드에서 도달 불가 |

**0188 파생 이슈와의 중복** (plan D-007):

| 0188 verify | 이번 감사 | 관계 |
|---|---|---|
| D39 (해제 실패 UX, 제품 결정 대기) | U1 | **동일 항목의 재확인.** 새 발견이 아니다 |
| D40 (루트 미추적 `package-lock.json`) | — | 이번 감사 범위 밖(작업 트리 위생) |

**다음 단계**: F1~F3 · P1~P2 · U2~U3 의 시정 여부를 결정한다. 시정한다면 별도 핸드오프(0190)로
설계한다 — 이 감사는 코드를 바꾸지 않았다.

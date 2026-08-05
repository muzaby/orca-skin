# Plan — 0172-multi-provider-login-chain

## 메타

| 항목 | 값 |
|---|---|
| slug | `0172-multi-provider-login-chain` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PHASES Phase 4 (인증 플랫폼 계열 0157→0160→0161→0164 후속) / PR: 브랜치 `claude/multi-provider-login-chain-a97lf7` |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "authpluginpackage 하나에 provider 2개 등록은 가능하지만 두 provider 를 하나의 로그인 체인으로 자동 실행하는 것은 core 가 지원하지 않고 있음. 하나의 패키지에 플러그인이 다수일 경우, 논리적으로 하나로 지원해야함." + 순서: provider1 begin→성공 binding **보류** → provider2 begin→성공 보류 → 전체성공 → `authenticated:true` / **하나 실패 → 전체 login 실패 및 잔여 세션 정리** | 라이브 세션 요청 (2026-08-05) |
| 명시 요구 | "핸드오프 작성 및 구현까지 하라" — 구현 주체 = Claude (환경에 Codex 부재, 0165~0167 선례) | 동상 |
| 명시 결정 | ⓐ 체인 범위 = **패키지 단위** ⓑ 멤버 결정 = **암묵**(manifest 선언 순서 중 `targets` 에 `application` 포함) ⓒ 로그인 화면에 **진행 표시**(step DTO 에 optional 필드 추가) | 라이브 세션 `AskUserQuestion` 응답 3/3 (2026-08-05) |
| 추론 의도 | 체인은 **앱 로그인(`target.kind==='application'`)에만** 적용한다 — connector 연결은 사용자가 PAT/ID·비밀번호 중 하나를 *고르는* 흐름이라 순차 강제가 의미를 뒤집는다 (추론). | `plugin-host.ts:185` 는 연결 1건당 binding 1개를 전제 |

## Context (왜)

`AuthPluginPackage` 하나에 auth provider 를 여러 개 등록하는 것 자체는 이미 된다 —
`AuthRegistry.register` 가 패키지 단위로 `providers[]` 를 받고 manifest 선언과 1:1 대조한다
(`registry.ts:43-67`). 그러나 **둘을 하나의 로그인으로 이어 실행하는 코드가 없다.** 두 지점이 원인이다:

| 지점 | 현행 | 결과 |
|---|---|---|
| `app/src/renderer/src/features/auth/store.ts:65` | `state.providers.find((p) => p.targets.includes('application'))` | 앱 로그인은 등록 순서상 **첫 provider 하나만** 실행된다 |
| `app/src/main/features/auth-platform/bindings.ts:56-59` | `create()` 가 같은 target 의 기존 binding 을 **교체** | 수동으로 순차 로그인해도 두 번째 binding 이 첫 번째를 지운다. 게다가 축출된 binding 의 `auth:binding:<id>:` vault 는 아무도 지우지 않아 secret 이 남는다 |

의도한 결과: 한 패키지가 선언한 application provider N개가 **하나의 논리 로그인**이 된다 —
전부 성공해야 `authenticated:true`, 하나라도 실패하면 로그인 전체가 실패하고 그때까지 만들어진
보류 자원(vault secret · browser session)이 정리된다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 원인 2개를 코드로 확정** | `store.ts:65`(첫 provider 만) + `bindings.ts:56-59`(같은 target 교체). 증상("체인이 안 돈다")과 원인이 일치하고, 원인은 renderer 선택 로직 **하나가 아니라 둘**이다 — renderer 만 고치면 두 번째 binding 이 첫 번째를 조용히 지운다 |
| 이미 있는 것 아닌가 | **없음** | `rg 'chain\|sequence\|multi.?provider' src/main/features/auth-platform` → 0건. `AuthStep` 6분기 어디에도 "다음 provider" 개념이 없다(`contracts/auth-plugin.ts:138-150`) |
| 더 작은 해법이 있는가 (core 변경 없이) | **성립 불가 — 근거 있음** | 패키지가 "내부에서 두 방식을 순차 실행하는 provider 하나"를 만드는 길을 먼저 따졌다. `AuthBindingDraft.artifact` 가 **단수**라(`contracts/auth-plugin.ts:128-134`) browser session handle 과 vault credential 을 한 binding 으로 표현할 수 없고, connector 는 `binding.artifact.kind` 로 갈라 주입한다(`broker.ts:292-303`). 두 인증의 산출물이 서로 다른 artifact 종류면 합칠 수 없다 → core 지원이 맞다 |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음** | 이번 요구는 선행 보고서 인용 없이 사용자 실사용에서 나왔다. 대신 `docs/etc/study/orca/` 의 AUTH-PLAT-002/008/010/014 를 이번 설계가 위반하지 않는지 역으로 대조했다(§기존 결정 표) |
| 기존 채택 결정을 뒤집는가 | **1건 부분 뒤집음** | `bindings.ts:56` 의 "한 대상에 두 인증이 공존하면 모호" — §기존 결정 표에서 처리 |

- **사용자에게 올릴 것**(단독 결정 불가): 없음 — 3건은 착수 전 `AskUserQuestion` 으로 확정받았다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 앱 로그인 게이트는 `required = providersForTarget('application').length > 0`, `authenticated = findApplicationBinding()?.status === 'valid'` — application binding **1개**를 전제한다 | `app/src/main/features/auth-platform/broker.ts:107-119` |
| `BindingStore.create` 는 같은 target 의 기존 binding 을 **삭제 후** 삽입한다. 삭제된 binding 의 vault 는 정리되지 않는다(`logout` 경로에서만 `clearAll`) | `bindings.ts:56-61` ↔ `broker.ts:245` |
| transaction 키 = `${providerId}|${targetKey(target)}`, `dispose()` 가 **현재 providerId 로 키를 재계산**한다 → 체인에서 현재 멤버가 바뀌면 키가 어긋나 `byKey` 에 유령 엔트리가 남는다 | `transactions.ts:54,112-113` |
| `runGuarded` 는 `signal.aborted` 면 provider 를 **아예 부르지 않는다**(취소 후 부수효과 방지). 롤백을 tx signal 로 돌리면 정리가 통째로 건너뛰어진다 | `transactions.ts:129-130` |
| provider 가 봉인한 secret 은 tx 네임스페이스(`…tx:<txid>:`)에 있다가 `done` 시 binding 네임스페이스로 이관된다 | `broker.ts:467-479, 571-573` |
| `provider.logout(ctx, ref)` 는 ⓐ static/basic → `ctx.vault` 삭제 ⓑ ADFS → `ref.artifact.handleId` + `ref.target.kind==='application' ? 'group' : 'origin'`. **binding id 를 안 본다** → 보류분도 합성 ref 로 정리 가능 | `providers/static-credential.ts:147` · `basic-credential.ts:134` · `corp-adfs-wia.ts:138-146` |
| manifest 의 `contributes.authProviders` 배열은 등록 시 구현과 **전 필드 대조**된다(0164 D4) → 선언 순서를 체인 순서의 진실원으로 삼아도 구현과 갈릴 수 없다 | `registry.ts:160-169, 309-321` |
| 응답 DTO 는 zod 검증 대상이 아니다(요청만 검증) → `AuthStepInfo` 에 optional 필드 추가는 스키마 변경 0, **채널 수 82 불변** | `app/src/main/app/handlers/auth.ts:31-48` · `shared/protocol.ts:232-249` |
| 등록된 auth provider 전수: **3종**(`static-credential`·`basic-credential`·`corp-adfs-wia`), 그중 `begin()` 이 즉시 `done` 을 낼 수 있는 것은 ADFS 1종(브라우저 플로우) | `rg 'createAdfsWiaProvider\|createStaticCredentialProvider\|createBasicCredentialProvider' src/main --files-with-matches` |
| `AuthStep` union 전수 **6분기**(`collect`·`browser`·`device_code`·`done`·`failed`·`not_supported`) — 체인 전이가 6분기 전부를 다뤄야 한다 | `contracts/auth-plugin.ts:138-150` |
| i18n 은 ko/en 리프 키 패리티 + 보간 플레이스홀더 일치가 위생 테스트로 강제된다 | `renderer/src/shared/i18n/resources/resources.test.ts:30-45` |
| main 레이어 DAG: `features/auth-platform` 은 `contracts`·`infra`·`shared` 만 의존 가능(교차 feature 금지) | `app/src/main/AGENTS.md` §레이어 DAG · `app/eslint.config.mjs` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 패키지가 application provider 2개를 선언하면 `loginChainFor` 가 **manifest 선언 순서**로 2개를 돌려준다 | `registry.test.ts::"loginChainFor 는 manifest 선언 순서로 체인을 만든다"` | `bootstrap.ts:214` 등록 → `broker.begin` |
| 2 | `targets:['connector']` 인 provider 는 application 체인에서 빠진다 | `registry.test.ts::"connector 전용 provider 는 체인 멤버가 아니다"` | 동상 |
| 3 | 멤버1 이 `done` 을 내면 renderer 에는 `done` 이 아니라 **멤버2 의 step** 이 반환된다 | `broker.test.ts::"체인 중간 done 은 노출되지 않는다"` | `handlers/auth.ts:34` → `broker.continue` |
| 4 | 전체 성공 시 application binding 이 2개(root + `parentBindingId`=root 인 child) 생기고 `status().authenticated === true` | `broker.test.ts::"체인 전체 성공이면 binding 2개와 authenticated"` | `authStatus` → renderer 게이트 |
| 5 | 멤버2 실패 시 binding 0개 · `authenticated:false` · **멤버1 의 `logout` 이 호출된다** | `broker.test.ts::"멤버 하나가 실패하면 전체 실패한다"` | 동상 |
| 6 | 멤버2 실패 뒤 secret store 에 그 로그인의 잔여 키가 **0개**다 | `broker.test.ts::"실패 후 vault 잔여가 없다"` (`store.raw.size === 0`) | 동상 |
| 7 | 멤버1(ADFS) 성공 후 멤버2 가 실패하면 browser session 이 `scope:'group'` 으로 정리된다 | `broker.test.ts::"실패 시 세션 그룹까지 정리한다"` (`sessions.cleared`) | 동상 |
| 8 | 체인 진행 중 타임아웃되면 보류분이 같은 규칙으로 정리되고 `authenticated:false` 가 유지된다 | `broker.test.ts::"타임아웃이 보류분을 정리한다"` (fake timers) | `TransactionStore` 타이머 → `onCancelled` |
| 9 | 재로그인이 성공하면 이전 체인의 binding 이 **전부** 사라지고 그 binding vault 도 비워진다 | `broker.test.ts::"재로그인은 이전 체인을 통째로 축출한다"` | `broker.begin` 재진입 |
| 10 | 멤버 하나가 `expired` 가 되면 `authenticated:false` 로 떨어진다 | `broker.test.ts::"멤버 하나가 만료되면 인증이 풀린다"` | `authStatus` (`refreshBinding` → `reauth_required`) |
| 11 | application provider 가 1개인 패키지는 기존과 **같은 결과**를 낸다 — `begin`→`continue` 로 binding 1개와 `done` | `broker.test.ts` 기존 케이스 전부 green (수정 없이) | 기존 경로 |
| 12 | connector target 의 `begin` 은 지정한 provider **하나만** 실행하고 binding 1개를 만든다 | `broker.test.ts::"connector target 은 체인을 타지 않는다"` | `PluginHost.connect` 흐름 |
| 13 | 체인 중간 step DTO 에 `chain:{index,total,label}` 이 실린다 (index 1-based) | `broker.test.ts::"체인 진행 정보를 step 에 싣는다"` | `handlers/auth.ts` → store |
| 13-b | 체인이 **아닌** 단일 provider 로그인의 step 에는 `chain` 필드가 **없다**(미지정 케이스) | `broker.test.ts::"단일 provider step 에는 chain 이 없다"` | 동상 |
| 14 | 순수 매핑이 `chain` 을 store 필드로 노출하고, step 이 바뀌면 폼 입력 초기화 키(`stepKey`)가 바뀐다 | `renderer/src/features/auth/state-mapping.test.ts::"chain 진행 정보 매핑"` · `::"stepKey 는 멤버마다 달라진다"` | `AuthView` 렌더 |
| 15 | ko/en 카탈로그에 `login.chainProgress` 가 있고 두 언어의 플레이스홀더가 일치한다 | `resources.test.ts` (기존 위생 테스트) | `AuthView` |
| 16 | 2단계 로그인 화면이 "1/2 · <라벨>" 로 보이고, 2단계 폼이 **빈 값**으로 뜬다 | **사람 실기** — `modules/index.ts` 에 application provider 2개(예: `createStaticCredentialProvider` 를 `targets:['application']` 로 2개) 짜리 임시 패키지를 등록하고 `npm run dev` → 로그인 화면에서 1단계 제출 후 화면 확인 | `AuthView` (임시 패키지 등록은 §범위 안 — 코어 수정 없이 `modules/index.ts` 한 줄) |

## 범위 / 비범위

- **범위**: 체인 해석(registry) · 체인 transaction(transactions) · 원자 커밋/축출(bindings) ·
  오케스트레이션과 롤백(broker) · 진행 표시 DTO + renderer 표기 · 문서(IPC_CONTRACT · modules/AGENTS).
- **비범위**:
  - **패키지가 2개 이상일 때 어느 체인으로 로그인할지 사용자가 고르는 UI** — 현행처럼 첫 체인(등록 순서)의 헤드를 쓴다.
  - **binding 영속 정책 자체** — 0170 이 선택 주입 영속으로 이미 바꿨다. 체인은 그 위에서 돌 뿐 정책을 건드리지 않는다.
  - **축출된 app binding 의 child connector binding 정리** — 현행 동작(고아로 남음) 유지.
  - **체인 도중 사용자 취소 버튼** — 현재 UI 에 취소 버튼 자체가 없다(`AuthView.tsx` 는 로그인 버튼 하나).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 다중 패키지 체인 선택 UI | 아니오 — `AuthProviderInfo` 에 이미 `pluginId` 가 있어 renderer 선택만 바꾸면 된다. 식별자·스키마 신설 없음 |
| child connector binding 정리 | 아니오 — `dependentsOf` 가 이미 있어 축출 시 호출만 추가하면 된다. 다만 `onBindingsEnded` 통지 순서를 정해야 해서 별건으로 둔다 |
| 명시적 `loginChain` manifest 필드 | **묻고 결정함** — 사용자 확정으로 암묵 방식 채택. 나중에 명시 필드를 *추가*하는 것은 additive 라 가능(암묵이 기본값) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `TransactionStore`(타임아웃·취소) · `BindingStore`(cascade·`parentBindingId`) ·
  `createCredentialVault`(네임스페이스 vault) · `runGuarded`(throw 격리) · `AuthProviderV1` 5메서드.
- 전제: 체인 멤버는 **같은 target**(`application:orca`)을 공유한다 — `targetKey` 가 같으므로 transaction 키는 헤드 providerId 로만 갈린다.
- **신규 의존성: 없음.**

## 설계

### 1. 체인 해석 — `features/auth-platform/registry.ts`

```ts
// 같은 pluginId 의 manifest 가 선언한 application-target provider 들 = 하나의 로그인 체인.
loginChainFor(providerId: string): AuthProviderV1[]
```

- provider 미등록 → `[]`. `targets` 에 `application` 이 없으면 `[provider]`(체인 아님).
- 순서 = `manifests.get(pluginId).contributes.authProviders` 배열 순서. 그 배열은 등록 시 구현과
  전 필드 대조되므로(`registry.ts:160-169`) 선언 순서를 진실원으로 삼아도 구현과 갈릴 수 없다.
- 선언됐지만 미등록인 id 는 건너뛴다(등록 all-or-nothing 이라 실제로는 발생 불가한 방어).

### 2. 체인을 아는 transaction — `transactions.ts`

- `Transaction.key: string` 추가 — `dispose()` 가 현재 `providerId` 로 키를 재계산하지 않는다.
- `Transaction.chain?: ChainState` — `{ members: readonly string[]; index: number; staged: StagedBinding[] }`.
- `StagedBinding = { providerId: string; pluginId: string; draft: AuthBindingDraft }`.
- `advance(id, nextProviderId, timeoutMs?)` — `providerId`·`chain.index` 갱신 + **타임아웃 재시작**
  (멤버마다 자기 예산. 2단계 대화형이 하나의 300s 를 나눠 쓰지 않게).

### 3. 원자 커밋 — `bindings.ts`

```ts
createMany(inputs): { created: AuthBindingInfo[]; evicted: AuthBindingInfo[] }
create(input)                       // = createMany([input]).created[0] — 기존 의미 무변경
applicationBindings(): AuthBindingInfo[]
```

- 축출: 같은 target 의 **모든** 기존 binding(체인 길이가 줄어도 잔여가 안 남는다). 목록을 돌려줘
  broker 가 vault 를 지운다 — 현행은 교체 시 secret 이 남는다.
- 삽입: 첫 입력 = root, 나머지 `parentBindingId = root.id`(명시값 존중).
- `findApplicationBinding()` = application binding 중 `parentBindingId` 없는 것 우선(= root).

### 4. 오케스트레이션 — `broker.ts`

```
begin(providerId, target)
  members = target.kind === 'application' ? registry.loginChainFor(providerId) : [provider]
  tx = transactions.begin({ providerId: members[0].id, chain: {members, index:0, staged:[]} })
  → members[0].begin(ctx) → applyStep()

applyStep(provider, tx, step)             // AuthStep 6분기 전수 처리
  done             → stage()  → 남은 멤버 있으면 advance → next.begin() → applyStep 재귀
                              → 마지막이면 commitChain()
  failed           → rollbackChain() → 기존 실패 처리
  not_supported    → rollbackChain() → 기존 policy_denied 처리
  collect/browser/device_code → 기존 처리 + chainProgress 부착
```

- **보류(stage)**: binding id 를 만들지 않는다. secret 은 그 멤버의 tx 네임스페이스에 그대로 둔다.
- **커밋**: `createMany(staged)` → 멤버별 `adoptTransactionSecret` → **축출분 vault `clearAll`** →
  `finish` → publish → `{kind:'done', binding: root}`. 중간 `done` 은 renderer 로 나가지 않는다
  (나가면 store 가 `/new` 로 이동한다 — `store.ts:139-141`).
- **롤백**: 보류분 **역순**으로 `provider.logout(ctx, stagedRef)` → 그 tx 네임스페이스 `clearAll`.
  ctx 는 그 멤버의 tx vault prefix 로 만들고 **새 `AbortController`** 를 쓴다(tx signal 은 이미
  abort 됐을 수 있고 `runGuarded` 가 provider 를 안 부른다 — `transactions.ts:129-130`).
  `stagedRef` = `{ id: 'staged:<txid>:<providerId>', target, mechanism, artifact, expiresAt? }` —
  logout 구현 3종이 `binding.id` 를 쓰지 않음을 확인했다(§자료조사).
- **취소·타임아웃**: `TransactionStore.onCancelled`(sync)에서 `void rollbackChain(tx).then(publish)`.
- **`status()`**: `authenticated = applicationBindings().length > 0 && 전부 valid`,
  `identity` = root 우선, 없으면 principal 을 가진 첫 application binding.

### 5. 진행 표시

- `shared/ipc.ts`: `AuthChainProgress = { index: number; total: number; label: string }`(1-based),
  `AuthStepInfo` 의 `collect`·`browser`·`device_code` 에 `chain?: AuthChainProgress` (**additive-optional**).
- `docs/IPC_CONTRACT.md` 의 `orca:auth:{status,begin,continue}` 행에 필드 설명 추가(채널 수 82 불변).
- renderer: 순수 매핑 `features/auth/state-mapping.ts` 분리 → store 가 소비, `AuthView` 가
  `login.chainProgress`(`{{index}}/{{total}} · {{label}}`) 렌더 + `stepKey` 변화 시 로컬 입력 초기화.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `registry.loginChainFor` (기존 파일 메서드) | 패키지 manifest → 체인 | main `features` | 순수 단위 — registry 만으로 구성 가능 |
| `transactions.ChainState`/`advance` | 체인 진행 상태·타임아웃 재시작 | main `features` | 순수 단위 + fake timers |
| `bindings.createMany` | 원자 커밋·축출 | main `features` | 순수 단위(외부 의존 0) |
| `broker` 체인 오케스트레이션 | stage/commit/rollback | main `features` | 기존 `broker.test.ts` 하네스(가짜 SecretStore + 가짜 browserSessions) — electron 비의존 |
| `renderer/features/auth/state-mapping.ts` | `AuthPlatformState`→store 패치 순수 변환 | renderer `features` | 순수 단위(`window.orca` 비의존 — 그래서 store 에서 **떼어낸다**) |

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| "같은 target 에 대한 기존 binding 은 교체한다 — 한 대상에 두 인증이 공존하면 어느 것이 쓰이는지 모호해진다" | `bindings.ts:56-57` (코드 주석) | §설계 3 "첫 입력 = root, 나머지 `parentBindingId`" | **부분 뒤집음** — 같은 target 에 N binding 을 허용하되 모호성은 root/child 로 없앤다. "무엇이 쓰이나" 의 답은 여전히 하나(root) |
| ~~binding 비영속~~ → **선택 주입 영속** (0170 이 뒤집음) | `bindings.ts:12-19` (main) | §설계 3 "`createMany` 는 배치 끝에 `flush()` 1회" | **정정 승계** — 설계 시점의 "비영속 유지" 는 리베이스로 무효가 됐다. 체인 커밋도 저장을 거치되 **배치 끝에 한 번**만 부른다(멤버마다 부르면 실패한 로그인이 반쯤 저장된 채 다음 부팅으로 넘어간다). 앱 binding 은 0170 의 `restore()` 가 필터링하므로 재시작 후 게이트 자동 통과는 없다 |
| transaction `(providerId,target)` 당 1건 · 재진입 시 명시 취소 | `transactions.ts:9` | §설계 2 "키는 헤드 providerId" | 유지 — 키를 헤드로 고정해 의미 보존. 재진입 취소가 곧 이전 체인 롤백 트리거 |
| AUTH-PLAT-002 5메서드 required · 미지원은 `not_supported` | `contracts/auth-plugin.ts:20-23` | §설계 4 "not_supported → rollbackChain" | 유지 — 체인 멤버의 `not_supported` 도 표준 실패로 수렴 |
| AUTH-PLAT-008 결과에 raw secret 금지 | `contracts/auth-plugin.ts:24-26` | §설계 4 "보류: binding id 를 만들지 않는다" | 유지 — 보류분도 `AuthBindingDraft`(handle 만) |
| AUTH-PLAT-010 connector 해제가 공유 세션을 통째로 날리지 않는다 | `broker.ts:224-225` | §설계 4 롤백 "`stagedRef.target` = application → `scope:'group'`" | 유지 — 체인 롤백은 **application** target 이라 group 정리가 의도된 동작 |
| AUTH-PLAT-014 ABI additive-optional-only | `contracts/auth-plugin.ts:14-18` | §설계 5 "additive-optional" | 유지 — `AuthProviderV1` 무변경, 기존 provider 재작성 0 |
| 등록 all-or-nothing · 중복 provider id 거부 | `registry.ts:6-8,41-42` | §설계 1 | 무변경 |
| 런타임 동적 로딩 금지(빌드타임 플러그인) | `contracts/auth-plugin.ts:7-12` | §설계 1 "manifest 선언 순서" | 유지 — 체인은 빌드타임 manifest 에서만 나온다 |
| "서비스 연결 전용 provider 는 `targets:['connector']` 로 좁혀라"(0164 D1) | `modules/AGENTS.md` §게이트 경고 | §설계 1 · 문서 갱신 | **강화** — 이제 `application` 선언은 게이트를 켤 뿐 아니라 **체인 멤버**가 된다. AGENTS.md 에 한 줄 추가 |
| main 레이어 DAG(features 는 contracts/infra/shared 만) | `app/src/main/AGENTS.md` · `eslint.config.mjs` | §설계 전반 | 준수 — 변경은 전부 `features/auth-platform` 내부 + `shared/ipc.ts` 타입 |
| i18n ko/en 리프 패리티·플레이스홀더 일치 위생 테스트 | `resources.test.ts:30-45` | §설계 5 i18n | 준수 — 두 카탈로그 동시 추가(AC15) |
| IPC 변경은 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` 원칙 5 | §설계 5 | 준수 — 채널 수 82 불변, 3개 행의 DTO 설명 갱신 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **2단계 폼이 설명 없이 나타남** → 진행 표시(`1/2 · 라벨`) + 로컬 입력 초기화. 두 멤버가 같은
  필드 이름(`credential`)을 쓰면 초기화 없이는 1단계 값이 그대로 보인다.
- **재진입(사용자가 로그인 버튼을 다시 누름)** → 같은 키의 transaction 이 `superseded` 로 취소되고
  그 체인의 보류분이 롤백된다. 롤백은 비동기라 새 체인의 stage 와 겹칠 수 있는데, 네임스페이스가
  `tx:<txid>:` 로 갈려 서로를 지우지 않는다.
- **타임아웃**: 멤버마다 예산이 재시작된다. 만료 시 `state.errorMessage='timeout'`(기존 동작) + 롤백.
- **앱 종료(`shutdown`)**: `cancelAll('shutdown')` → 각 체인 롤백이 시작된다. 프로세스가 먼저 죽으면
  vault 잔여가 남을 수 있으나 secret store 는 앱 재시작 시 tx 네임스페이스를 다시 쓰지 않는다
  (`tx:<txid>:` 는 프로세스마다 새 id) — **재시작 후 고아 키**가 남는 것은 현행과 동일한 성질이다.
- **체인 중간 멤버가 `browser` step 을 반환**(ADFS 처럼 begin 안에서 끝나지 않는 변형): 진행 표시를
  단 채로 renderer 가 대기하고, `continue` 가 그 멤버로 라우팅된다(`tx.providerId` = 현재 멤버).
- **application provider 0개**: `required:false` — 체인 코드가 아예 진입하지 않는다(현행 보존).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 롤백이 async 인데 취소 콜백은 sync → 롤백 완료 전에 다음 로그인이 시작될 수 있다 | 네임스페이스가 `tx:<txid>:` 로 갈려 교차 삭제가 불가능하다. 완료 후 `publish()` 로 상태만 재동기화 |
| 멤버 `logout` 이 throw 하면 그 뒤 멤버 정리가 끊길 수 있다 | 멤버마다 `runGuarded` 로 격리하고, provider 실패와 무관하게 **broker 소유 vault 는 항상 지운다**(`logout()` 의 기존 방침 승계 — `broker.ts:244-245`) |
| `authenticated` 가 "전부 valid" 로 바뀌어 기존 1-provider 배포의 판정이 달라질 위험 | application binding 이 1개면 `every` 는 기존 `=== 'valid'` 와 동치. AC11 이 기존 케이스 무수정 green 을 요구한다 |
| 체인 재귀(`applyStep`→`begin`→`applyStep`)의 깊이 | 멤버 수만큼(현실적으로 2~3). 멤버 수는 manifest 선언 길이로 유한 |

- 되돌리기 어려운 결정: `AuthStepInfo.chain` **필드 이름**(renderer/문서 소비자 생김) — 사용자 확정 항목.
- 단독 결정 금지 항목(Open Question): 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/{registry,transactions,bindings,broker}.ts` (+ 각 `*.test.ts`)
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/auth/{store.ts,state-mapping.ts(신규),components/AuthView.tsx}` (+ `state-mapping.test.ts` 신규)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `app/src/main/features/auth-platform/modules/AGENTS.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/IPC_CONTRACT.md` (§2 auth 도메인 8채널 — §6 변경 절차)
- `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` (AUTH-PLAT-002/008/010/014)
- `docs/handoff/0157-*` (인증 플랫폼 도입) · `0160`·`0164` (Confluence 패키지·게이트 사고)

## 게이트

- `cd app && npm run lint && npm run typecheck` (ABI 중립) +
  `./node_modules/.bin/vitest run src/main/features/auth-platform/ src/renderer/src/features/auth/ src/renderer/src/shared/i18n/`
- 전체 `npm test` 는 마지막 1회. egress 차단 시 DB 로드 스위트 실패는 알려진 베이스라인으로 분리 보고.
- 신규 테스트: registry 체인 해석 · bindings 원자 커밋 · broker 체인 성공/실패/취소/재로그인 · renderer 순수 매핑.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 원문 인용 + 추론은 추론으로 표기했다.
- [x] 자료조사 — 발견 11건 전부 `파일:라인` 레퍼런스.
- [x] 의존 기술 — 신규 의존성 0(명시).
- [x] 파생 UX — 재진입·타임아웃·shutdown·중간 browser step·provider 0개까지 펼쳤다.
- [x] 리스크 — 비동기 롤백 경합·판정 변경 위험을 적고 완화책을 붙였다.
- [x] **요구 비판적 검토** 5질문 답변 완료, 요구 범위 축소 0.
- [x] `검증 수단` 칸 빈 곳 0 (AC16 만 "사람 실기 + 실행 경로" 명시).
- [x] 부정형 기준 0 — AC11 은 "기존 케이스 green" 이라는 **실행 가능한 양성 판정**으로 썼다.
- [x] AC 상호 모순 점검 — AC4(binding 2개) ↔ AC11(1개 provider 는 1개) 은 전제가 다르고, AC13 ↔ AC13-b 가 지정/미지정을 나눈다.
- [x] 수치 직접 측정 — provider 3종 · `AuthStep` 6분기 · IPC 82채널(문서 표 확인) 전부 이번 세션 grep.
- [x] 신규 모듈 테스트 방법 + renderer 순수부 seam(`state-mapping.ts`) 명시.
- [x] 전수 조사 N 수치 — provider 3 · AuthStep 6 · logout 구현 3.
- [x] 각 AC 에 프로덕션 도달 경로 기재.
- [x] "사람 실기" AC16 의 실행 경로가 비범위에 막히지 않는다(임시 패키지 등록은 코어 수정 없음).
- [x] 미지정 케이스 AC 존재(AC13-b).
- [x] 제약 필드 강제 지점 — `targets` 는 `loginChainFor` 가(체인 편입), manifest 선언은 registry 가(등록 시) 강제.
- [x] 참조 구현 대비 union 전수 — `AuthStep` 6분기 전부 §설계 4 에 나열.
- [x] 미룬 항목 일방향 여부 답변 완료(§범위 표).
- [x] 관문 4 — 기존 결정 표를 본문 완성 후 채웠고, 인용 경로를 전부 열어 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: 세 갈래 판단이 구현에서 그대로 맞았다.
  ⓐ §설계 2 의 "transaction 키를 헤드로 고정" — `dispose()` 가 현재 `providerId` 로 키를 재계산하는
  코드는 체인에서 반드시 어긋난다(멤버가 바뀌므로). `key` 필드 없이 짰으면 재로그인 시 이미 없는
  id 를 취소하려 드는 유령 엔트리가 남았다.
  ⓑ §설계 4 의 "롤백은 새 AbortController" — 타임아웃 테스트가 이것을 정확히 증명했다. tx signal 로
  돌렸다면 `runGuarded` 의 `signal.aborted` 조기 반환(`transactions.ts:129-130`) 때문에 **정리가
  필요한 바로 그 경로에서** provider.logout 이 한 번도 불리지 않는다.
  ⓒ §설계 3 의 root/child — `dependentsOf` 가 이미 있어 체인 로그아웃 cascade 가 코드 추가 0으로 성립했다.
- **이견 / 우려**: AC11 의 문구("기존 케이스 전부 green — 수정 없이")가 **성립하지 않았다**. 이유는
  회귀가 아니라 fixture 의 의미다 — 아래 P1.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| P1 | **기존 broker 테스트 fixture 가 한 패키지에 application provider 2개를 담고 있었다**(`corp` = pat + adfs). 새 의미에서 그 패키지는 **2단계 체인**이라, "둘 중 아무거나로 로그인" 을 검증하던 기존 테스트의 전제가 무너진다. AC11 은 이 fixture 를 예상하지 못했다 | ✅ 구현함 — fixture 를 **패키지 2개**(`corp`=pat / `corp-adfs`=adfs)로 나눴다. **단언은 한 줄도 바꾸지 않았다** — 패키지 경계만 각 테스트의 원래 의도(독립된 두 인증)에 맞췄고, 46개 기존 케이스가 그대로 green 이다. AC11 의 *의미*(1-member 패키지는 기존과 동일)는 지켜졌고 *문구*(수정 없이)는 지켜지지 않았다 | `broker.test.ts:30-74` · 이 사실 자체가 "한 패키지 다중 application provider" 가 지금까지 **의미 없는 조합**이었다는 방증이다 |
| P2 | 진행 표시에 맞춰 폼을 비우는 것을 `useEffect(() => setInput({}), [stepKey])` 로 짜면 **lint error** 다(`react-hooks/set-state-in-effect` — cascading render) | ✅ 구현함 — 입력 폼을 `AuthStepForm` 으로 떼고 `key={stepKey}` 로 **remount** 시킨다. 상태 초기화의 정석 패턴이고 effect 가 사라진다 | `AuthView.tsx:51` · `npm run lint` |
| P3 | AC10(멤버 만료) 을 static credential 로는 만들 수 없다 — 그 provider 의 `refresh` 는 `not_supported` 라 binding status 가 안 바뀐다 | ✅ 구현함 — 테스트 멤버에 `refreshReauth` 옵션을 두어 `reauth_required` 를 반환시키고, root 는 `valid` 인데 인증이 풀리는 것까지 단언했다 | `broker.test.ts::"멤버 하나가 만료되면 인증이 풀린다"` |
| P4 | 축출된 binding 의 vault 를 아무도 지우지 않는 **기존 누수**(0157 부터). 체인은 축출 대상이 N개라 누수가 배로 는다 | ✅ 구현함 — `createMany` 가 축출분을 돌려주고 `commitChain` 이 그 네임스페이스를 `clearAll` 한다. 재로그인 테스트가 옛 secret 부재를 단언한다 | `bindings.ts` `createMany` · `broker.test.ts::"재로그인은 이전 체인을 통째로 축출한다"` |
| P5 | **기존 배포 영향** — 이미 한 패키지에 application provider 2개를 선언한 배포가 있다면 이제 강제 체인이 된다 | ⚠️ 보고만(동작 변화 없음으로 판정) — 이전에는 renderer 가 **첫 provider 만** 실행해 두 번째는 앱 로그인에서 도달 불가였다. 잃는 동작이 없다. 저장소 동봉 패키지(Confluence)는 application provider **0개**라 영향 없음(실측) | `store.ts:65`(구) · `modules/confluence/index.ts:139-162` |
| P7 | **리베이스 발견** — main 의 `0170-auth-binding-restore` 가 binding 레코드를 영속화했다(`BindingStore` 에 `BindingPersistence` 주입 + 모든 변경 경로에서 `flush()`, id 충돌 회피 루프). `createMany` 가 `create()` 자리를 차지하므로 그 둘을 물려받지 않으면 **connector 로그인이 디스크에 안 남아 0170 이 조용히 죽고**, id 가 복원 레코드와 겹치면 새 binding 이 남의 vault 네임스페이스를 물려받는다 | ✅ 구현함 — id 뽑기를 `mintId()` 로 추출해 `createMany` 가 쓰고, `flush()` 는 **배치 끝에 한 번**(멤버마다 부르면 실패한 로그인이 반쯤 저장된다). 회귀 2건 신설: 체인 커밋의 저장 스냅샷 · **application 체인 레코드는 복원되지 않는다**(0170 의 "앱 게이트 자동 통과 금지" 가 멤버 N개에서도 유효한지) | `bindings.ts` `mintId`·`createMany` · `bindings.test.ts::"체인 커밋이 저장을 한 번만 부르고…"` · `broker-restore.test.ts::"application 체인 레코드는 복원하지 않고…"` |
| P6 | 체인 중간에서 사용자가 로그인 버튼을 다시 눌러 재진입하면 이전 체인이 `superseded` 로 취소되고 롤백이 **비동기로** 돈다 — 새 체인의 stage 와 시간상 겹칠 수 있다 | ✅ 설계대로 안전 — 네임스페이스가 `tx:<txid>:` 로 갈려 서로의 secret 을 지울 수 없다. 롤백 완료 후 `publish()` 로 상태만 재동기화한다 | `broker.ts` 취소 콜백 · `txPrefixOf` |

## [구현자 기입] 구현 체크리스트

- [x] `registry.loginChainFor` — manifest 선언 순서 · connector 전용 제외 · 패키지 경계
- [x] `transactions` — `key` 고정 · `ChainState`/`StagedBinding` · `advance`(타임아웃 재시작)
- [x] `bindings.createMany` — root/child · 같은 target 전량 축출 · `applicationBindings`
- [x] `broker` — stage → advance → commit / rollback(역순·새 controller) / 취소·타임아웃 롤백
- [x] `status().authenticated` = application binding 전부 valid · identity root 우선
- [x] `AuthStepInfo.chain` additive-optional + renderer 진행 표시 + 폼 초기화(remount)
- [x] i18n ko/en `login.chainProgress`
- [x] 문서 — `IPC_CONTRACT.md` 3행 · `modules/AGENTS.md` 체인 규칙

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main `features/auth-platform/{registry,transactions,bindings,broker}.ts` · `shared/{ipc,protocol}.ts` · renderer `features/auth/{store.ts,state-mapping.ts(신규),components/AuthView.tsx}` · `shared/i18n/resources/{ko,en}.ts` · 테스트 4종(`registry`·`bindings`·`broker`·`state-mapping(신규)`) · 문서 2종 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint ✅ **0 error**(잔여 warning 1건은 기존 `useTranscriptVirtualizer` 의 라이브러리 경고) · typecheck ✅ **3/3**(node·web·test) · vitest ✅ **1908/1908 통과**(파일 202/203) |
| 알려진 환경 실패 | `src/main/app/chat-turn.continuity.test.ts` **1파일**이 import 단계에서 실패 — `Electron failed to install correctly`(설치 시 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`). **변경 무관 확인**: `git stash` 로 이번 변경을 뺀 상태에서도 동일하게 실패한다(실측). better-sqlite3 는 `npm rebuild`(Node ABI) 후 DB 스위트 전부 green |
| 신규 테스트 | 체인 11건(broker) · 체인 해석 4건(registry) · 원자 커밋 4건(bindings) · 순수 매핑 8건(renderer) = **27건** |
| 블로커 / 역질문 | 없음. AC16(사람 실기)만 미확인 — 이 환경에서 `npm run dev`(Electron 바이너리 필요)가 불가하다 |
| 대상 커밋 | 아래 구현 커밋 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|

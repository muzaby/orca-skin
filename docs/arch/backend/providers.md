# Provider 플랫폼 (인증) — 정본

> 인증·플러그인 스택의 **구조 정본**. 0180 이 무엇을 왜 지웠고, 0181 이 그 자리에 무엇을 세웠으며,
> 그것을 **어떻게 등록하고 어떻게 쓰는가** 를 한 문서에서 다룬다.
>
> - 최종 업데이트: 2026-08-10 (handoff `0180-auth-plugin-teardown` → `0181-provider-platform`)
> - **구조 서술은 여기, 실행 절차는 [`guides/closed-network-extensions.md`](../../guides/closed-network-extensions.md)** (폐쇄망 배포자용 단계별 안내).
> - 채널 계약은 [`IPC_CONTRACT.md §2.13-c`](../../IPC_CONTRACT.md), 자격증명 경계는 [`security.md §1.4-b`](./security.md), 용어는 [`GLOSSARY.md`](../../GLOSSARY.md).
> - **계약 정본은 코드다** — `app/src/main/contracts/provider.ts`. 이 문서와 어긋나면 코드가 진실이다.

---

## 1. 왜 지웠나 — 0180 의 진단

0157~0178 이 세 라운드에 걸쳐 인증 플랫폼을 고쳤고, 0178 만으로도 1,603줄을 지웠다. 그런데도 같은
불만("어설픈 재사용, 과한 플랫폼화")이 반복됐다. 0180 의 진단은 **남은 복잡도가 양이 아니라 축의
교차**라는 것이었다:

```
AuthMechanism × AuthTargetKind × CredentialPresentation      ← 계약 3중 교차
        ×  PluginHost / ConnectionRegistry / TransactionStore / loginChain
```

무너진 근본 원인은 **프로토콜 enum 을 1급 축으로 둔 것**이다:

| 구조적 결함 | 결과 |
|---|---|
| 인증 방식이 **별도 레지스트리**에 있고 대상이 **id 로 참조**(`acceptedMethods`) | 참조 무결성 검증(`validateCrossReferences`)·미존재 참조·**등록 순서 의존**이 딸려왔다 |
| 등록이 **패키지 단위 all-or-nothing** | `baseUrl` 하나에 경로가 붙으면 그 패키지의 provider·connector 가 통째로 사라졌다(0164) |
| 앱 로그인과 서비스 연결이 `AuthTarget.kind` 로 갈리고 binding 이 `parentBindingId` 로 엮임 | logout cascade·부분 인증·체인 상태가 곱해졌다 |

**게다가 실사용이 거의 0 이었다** — `SSO_CONFIG=null` 이라 ADFS 가 등록된 적이 없고, OAuth
code→token 코어 구현이 없었으며(PKCE **0건**), connector 서버 목록은 빈 배열이었다. 즉 *동작하지
않는 복잡도* 였다.

### 지운 것 (0180 실측)

| 대상 | 규모 |
|---|---|
| `features/auth-platform/` prod | **4,569줄** |
| `features/connectors/` | 768줄 |
| `infra/auth/` (인증 6모듈) | 1,114줄 |
| 계약 3종 (`auth-method`·`internal-api`·`connector`) | 297줄 |
| `app/handlers/{auth,plugins}.ts` | 262줄 |
| renderer `features/auth` 외 | 445줄 |
| 테스트 | **35파일 삭제** |
| **합계** | **145파일 · −16,971줄** |

IPC **82 → 71 채널**(auth 7 + plugin 4) · contracts **9 → 6** · 슬라이스 **11 → 9** · settings **20 → 18 키**.

### 지우지 않은 것 — 이름만 `auth` 였던 4종

0180 이 명시적으로 살려 둔 것들이다. **다음 작업자가 다시 지우지 않도록** 여기 남긴다:

1. **`infra/auth/net-{fetch,request,response}.ts`** — 이름만 auth, 실은 main 전체의 **유일한 원격
   전송 스택**(updater·usage 가 쓴다). `infra/net/` 으로 **이설**했다.
2. **runtime-tool 포트**(`RuntimeToolRegistry`·`adapters/runtime-tools.ts`) — 기여자만 0 이 됐고
   배선은 살아 있었다. 0181 의 `Provider.tools` 가 그 자리를 다시 채운다.
3. **`contracts/usage-source.ts`** — `sources?` 가 optional 이라 주입만 끊으면 폴백으로 생존.
4. **`adapters/error-classifier.ts` 의 `auth_error`** — 이름만 auth, 코드 경로 무관.

> **Confluence 순수 변환기 576줄은 "이동" 이 아니라 삭제했다.** 옮겨두면 소비자 0인 코드가 남아
> 그 작업이 없애려던 냄새를 만든다. 0181 이 `git show 8965fa7:…` 로 **그대로 복원**했다(좌표를
> 0180 plan 에 기록해 뒀기에 가능했다).

---

## 2. 무엇을 세웠나 — 0181 의 축

**축은 하나다: `Provider` 선언.** 폴더링과 타입을 **프로토콜이 아니라 관계**로 가른다
(아티팩트 `d801bbaf` 의 관찰 — "opencode 레포엔 `idp/`·`oauth/`·`sso/`·`saml/` 폴더가 하나도 없다").

| `kind` | 관계 | 신원(principal) | 예 |
|---|---|---|---|
| `gate` | 사내 IdP ↔ Orca (앱 로그인) | ✓ 있음 | ADFS/WIA |
| `llm` | Orca ↔ 모델 게이트웨이 | ✗ (토큰만) | 사내 LLM 게이트웨이 |
| `service` | Orca ↔ 사내 REST | ✗ (토큰만) | Confluence |

```ts
// app/src/main/contracts/provider.ts — 배포가 채우는 유일한 선언
interface Provider {
  id: string                        // 케밥. vault 네임스페이스이자 ${BINDING:<id>} 참조 대상
  label: string
  kind: 'gate' | 'llm' | 'service'  // ★ 관계. 프로토콜이 아니다
  origin: string                    // 나갈 수 있는 origin (경로 없음)
  auth: readonly AuthSpec[]         // ★ 복수 — 선언 순서가 GUI 선택지 순서
  tools?: (api: ProviderApi) => RuntimeToolServer      // kind:'service'
  llm?: { adapter: string; provider: string; envKey: string }  // kind:'llm'
}
```

### 왜 이 형태가 구 구조의 폭발을 막는가

| 구 구조 | 0181 | 결과 |
|---|---|---|
| 방식이 별도 레지스트리 + id 참조 | **`AuthSpec` 을 선언 안에 인라인** | 참조가 없으므로 **무결성 검증 자체가 성립하지 않는다**. `validateCrossReferences`·등록 순서 의존이 코드로 쓸 자리가 없다 |
| `bindingId`·`parentBindingId`·cascade | **`providerId → Grant` 단일 맵** | logout cascade 개념이 사라졌다 |
| 패키지 단위 all-or-nothing 등록 | **선언 단위 거부** | 하나가 잘못돼도 나머지는 등록된다 |
| `AuthTarget.kind` 로 앱/서비스 분기 | **`Provider.kind` 하나** | 앱 로그인·서비스 연결·LLM 자격증명이 **같은 6채널·같은 GUI** 를 쓴다 |

**런타임 검사는 둘뿐이다** — 중복 `id`, `origin` 형태(`registry.ts`, 94줄).

### `AuthSpec` — 5분기

```ts
type AuthSpec =
  | { kind: 'api-key'  } & CredentialSpecBase   // ─┐
  | { kind: 'password' } & CredentialSpecBase   //  ├ 코어 구현. 배포는 fields + present 만 선언
  | { kind: 'pat'      } & CredentialSpecBase   // ─┘
  | { kind: 'oauth'; present; authorize(ctx): Promise<OAuthStart> }   // 표준 code→token
  | { kind: 'browser-session'; config: BrowserSessionConfig }         // ADFS/WIA
```

**`auth` 가 배열인 것이 이 개정의 핵심**(사용자 결정 2026-08-10): 빌트인 구현자가 여러 방식을
선언하고 **사용자가 GUI 에서 고른다**. `auth.length === 1` 이면 선택 단계를 건너뛴다.

> 이것은 0180 이 없앤 `acceptedMethods` 교차의 **부활이 아니다**. 되살아난 것은 교차가 아니라
> **배열**이다 — 구 폭발은 *방식이 별도 레지스트리에 있고 대상이 id 로 참조*해서 생겼고, 여기서는
> 인라인이라 참조가 없다.

### `Grant` — 인증의 결과물

```ts
type Grant =
  | { kind: 'secret';  vaultKey }                              // api-key · password · pat
  | { kind: 'token';   vaultKey; refreshKey? }                 // oauth · 세션 교환
  | { kind: 'session'; sessionGroup }                          // browser-session (값이 아니라 cookie jar)
// 공통: authKind · principalId? · createdAt · expiresAt?
```

`expiresAt` 은 **토큰이 선언한 만료와 401 관측에 의한 강등이 같은 필드를 쓴다** — UI 와 게이트가
"지금 못 쓴다" 를 한 가지 방식으로 읽게 하기 위함이다.

---

## 3. 모듈 지도

> ⚠️ **`features/providers/` 에는 세입자가 둘이다.** 아래 트리에 적힌 것(0181 인증 플랫폼) 옆에
> 구 LLM 설정 슬라이스(`provider-registry.ts`·`claude-model-parser.ts`·`provider-settings.ts`·
> `engine-write.ts` — `sources/settings/<adapter>/<provider>/` 열거와 모델 해석
> provider)가 **그대로 공존**한다. 0181 은 새 슬라이스를 만들지 않고 이 디렉토리 안에 세웠다.
> 이름만 같고 서로 import 하지 않는다 — 파일을 더할 때 어느 쪽인지 먼저 가른다.

```
app/src/main/
├── contracts/provider.ts              # 계약 정본 (198줄) — Provider·AuthSpec·Grant·ProviderApi
├── features/providers/                # ★ 아래는 0181 인증 플랫폼만. 구 LLM 설정 슬라이스는 생략
│   ├── declarations/                  # ★ 배포가 고치는 유일한 곳
│   │   ├── index.ts  sso.ts  llm.ts  service.ts
│   ├── auth/
│   │   ├── registry.ts    (94)        # 등록 + 검사 2종
│   │   ├── store.ts       (127)       # providerId → Grant, 상태 판정, 401 강등
│   │   ├── store-file.ts  (141)       # electron-store 영속 (grant + OAuth pending)
│   │   ├── login.ts       (292)       # AuthSpec 분기 실행 · pending 1건 · 재인증
│   │   ├── oauth.ts       (159)       # ★ 순수 — PKCE S256 · state 발급/보관/대조 · 콜백 파싱
│   │   ├── oauth-runner.ts(222)       # redirect 3분기 (창·리스너는 포트 주입)
│   │   ├── policy.ts       (92)       # ★ 순수 — origin · 절대 URL · 예약 헤더 · grant 상태
│   │   ├── present.ts      (65)       # Presentation 적용 (자격증명을 요청에 넣는 유일한 지점)
│   │   ├── api.ts         (211)       # ProviderApi 구현 — request/materialize/token
│   │   └── specs/{credential,browser-session}.ts
│   ├── gate/index.ts       (38)       # ★ 순수 — 게이트 진리표
│   ├── llm/index.ts        (43)       # ★ 순수 — 디렉토리 열거 ↔ 선언 조인
│   ├── service/index.ts    (59)       # 도구 등록/회수 (grant 상태 추종)
│   │   └── confluence/                # 0160 복원 **8모듈** — 순수 변환 3(storage-to-markdown ·
│   │                                   #   search-render · limit) + base-path · rest · connector ·
│   │                                   #   download-store · tools. 테스트 144건이 이식 직후 전량 green
│   └── platform.ts        (105)       # 파사드 — IPC 핸들러가 보는 표면
├── infra/
│   ├── vault.ts            (99)       # safeStorage 네임스페이스 뷰
│   ├── browser-session.ts (368)       # Electron Session · 로그인 창       ← electron
│   ├── browser-session-policy.ts (137)# ★ 순수 — probe 체인 · origin · ERR_ABORTED
│   ├── loopback-callback.ts(86)       # OAuth 루프백 1회성 리스너 (node http)
│   └── net/transport.ts   (129)       # 전송 조각 · 상한 검사
└── app/
    ├── handlers/providers.ts (50)     # IPC 6채널
    └── usage-source.ts     (113)      # ProviderApi → UsageSourcePort 어댑터
```

renderer: `app/GateFrame.tsx`(142) · `features/providers/hooks/useProviderGate.ts`(77) ·
`features/skills/{lib/providerRows.ts(70), hooks/useProviders.ts(71), components/customize/ProviderDetail.tsx(202)}`.

### 레이어 규칙 — electron 을 무는 곳을 좁힌다

`electron` 을 import 하는 파일은 테스트가 직접 import 하면 **즉시 죽는다**(P29 — `vitest.config.ts`
에 electron alias 없음). 그래서 **판정은 순수 모듈로 떼고 배선만 남긴다**:

| electron 의존 | 순수부 | 주입 포트 |
|---|---|---|
| `infra/browser-session.ts` | `browser-session-policy.ts` | `BrowserSessionPort`(feature 가 받는다) |
| `infra/net/net-{fetch,request}.ts` | `net-response.ts` | `fetchImpl: typeof fetch` (**기본값 금지**) |
| — (`oauth-runner` 는 electron 미의존) | `oauth.ts` | `AuthWindowPort`·`openExternal`·`listen` |

**`features/providers` 는 다른 feature 를 import 하지 않는다.** 교차가 필요한 곳은 컴포지션 루트가
주입한다 — `UsageSourcePort`(app/usage-source.ts) · `RuntimeToolSink`(bootstrap) · MCP 토큰 소스
(`McpStore.attachTokenSource`).

---

## 4. 라이프사이클

### 4.1 부팅 — DB 보다 **먼저**

```
Bootstrap.start()
  ├─ SecretStore
  ├─ createProviderPlatform()          ← ① 선언 등록 → **세션 group 등록** → grant 복원 → 로그인 서비스
  ├─ registerProviderHandlers()        ← ② IPC 6채널 조기 등록
  ├─ mcp.attachTokenSource()           ← ③ ${BINDING:} 토큰 소스
  ├─ serviceTools.sync()               ← ④ 이미 인증된 service 도구 등록
  └─ initDb() … (나머지 부팅)
```

**세션 group 은 로그인 전에 등록된다** (0182 — `registerDeclaredSessions`). 0181 은
`SessionRunner.login` 에서만 등록해서, 재시작 후 쿠키(파티션)와 grant(파일)가 살아 있어도 group 만
미등록이라 `acquire()` 가 raw `Error` 를 던졌다. `ProviderPolicyError` 가 아니라 **401 강등 경로도
타지 않아** 재인증 지점이 뜨지 않았고, ④ 가 `status==='valid'` 를 보고 도구를 등록하므로
*모델에는 보이는데 부르면 죽는* 형태가 됐다. 등록은 파티션 핸들 생성뿐이라 네트워크·창이 없다.
입력은 `registry.list()`(등록 검사를 통과한 것)라 **거부된 선언의 jar 는 만들어지지 않는다**.

**왜 DB 보다 앞인가**: 창은 `start()` 완료 전에 열리고(0109) renderer 는 오픈 직후 게이트 판정을
위해 `orca:provider:state` 를 invoke 한다. 그 첫 invoke 가 부팅 완료를 기다리면 화면이 빈 채로
멈춘다. **게이트 판정에는 DB 가 필요 없다** — grant 는 파일 + vault 에만 산다.

부팅 단계는 `critical: true` 다 — 게이트를 판정할 수 없으면 로그인 강제 빌드가 무인증으로 열린다.
회복 가능한 사고(영속 파일을 못 여는 경우)는 팩토리 안에서 **메모리 폴백**으로 흡수한다.

### 4.2 로그인

```
orca:provider:login { providerId, authKind?, input? }
   └─ LoginService.begin()
        ├─ 방식 미지정 → 선언 배열의 첫 방식
        ├─ api-key/password/pat : 1회차 → fields 반환(input-required)
        │                          2회차 → compose → vault 봉인 → Grant{secret}
        ├─ oauth  : PKCE·state 발급 → 영속 → redirect 분기
        │             ├ loopback : 기본 브라우저 + 127.0.0.1 리스너 → 콜백 → state 대조 → exchange
        │             ├ window   : 앱 내부 창 → isDone(url) → state 대조 → exchange
        │             └ manual   : code-required → 사용자 붙여넣기 → orca:provider:continue
        └─ browser-session : 로그인 창 → doneUrlPrefix → probe 재확인
                                └ config.exchange 있으면 세션 쿠키로 토큰까지 → Grant{token}
```

**주목할 규칙 넷:**

1. **입력 폼은 신뢰된 prompt 다** — provider 가 만든 임의 UI 가 아니라 Orca 가 `fields` 선언을
   렌더링한다.
2. **`doneUrlPrefix` 도달만으로 성공을 선언하지 않는다** — 로그인 폼이 같은 접두사로 200 을 주는
   배포가 있어 `authenticationProbeUrl` 로 한 번 더 확인한다(0157 D1 의 목적, 0174 가 판별자를
   "체인의 최종 origin" 으로 교정).
3. **PKCE·`state` 는 코어가 갖는다** — 배포 선언은 `ctx.pkce()`·`ctx.state()` 가 준 값을 URL 에
   싣기만 한다. 각자에게 맡기면 한 곳만 빼먹어도 조용히 취약해지고, code 가로채기와 CSRF 는 둘 다
   "동작은 하는" 상태라 테스트로도 안 잡힌다.
4. **`state` 는 파일에 보관한다** — 루프백 콜백은 사용자의 브라우저가 **앱 밖에서** 완료시킨다.
   그 사이 앱이 재시작되면 메모리 대조가 성립하지 않고, 대조 실패는 곧 로그인 실패다(TTL 10분,
   provider 당 1건, 1회용).

### 4.3 재인증 — 성공해야 교체된다

`reauth` 는 **기존 grant 를 먼저 지우지 않는다.** 새 인증이 성공해야 교체되고, 실패하면 이전
자격증명으로 계속 쓸 수 있다. 입력형에서 "성공" 은 곧 vault 쓰기라, `compose` 가 거부하면 vault 에
손도 대지 않는다.

### 4.4 만료·해제

| 사건 | 동작 |
|---|---|
| `expiresAt` 경과 | 상태가 `expired` — grant 는 **남는다**(무엇을 다시 인증해야 하는지 화면이 보여줘야 한다) |
| 요청이 **401/403** | `markExpired()` 로 강등 + state push + service 도구 회수 |
| vault 복호화 실패 | `unknown` — **부재와 구분한다**(키체인 잠김을 "인증 안 됨" 으로 뭉개면 조용한 미인증 진행이 된다) |
| `orca:provider:revoke` | grant + vault 값·metadata·index 삭제 |
| 선언에서 provider 가 사라짐 | **고아 grant** — 조용히 무시하고 로그만 남긴다(삭제하지 않는다. 선언이 일시적으로 빠진 빌드에서 재로그인을 강요하지 않기 위해) |

---

## 5. 등록하는 법

**고치는 파일은 `features/providers/declarations/` 셋뿐이다.** 기본 배포는 전부 비어 있다 — 그래서
OSS/dev 빌드는 로그인 화면 없이 열리고 도구·자격증명 주입도 일어나지 않는다.

| 파일 | 기본값 | 채우면 |
|---|---|---|
| `sso.ts` | `null` | 로그인 게이트가 **강제**된다 |
| `llm.ts` | `[]` | 선택된 provider 의 자격증명이 subprocess env 로 주입된다 |
| `service.ts` | `[]` | 인증된 연결의 도구가 LLM 에 노출된다 |

```ts
// declarations/service.ts — 최소 예
export const SERVICE_PROVIDERS: Provider[] = [
  {
    id: 'confluence',                        // ⚠️ 한 번 정하면 유지 (vault 키·${BINDING:} 참조 대상)
    label: 'Confluence',
    kind: 'service',
    origin: 'https://wiki.example.corp',     // 경로·후행 슬래시 금지
    auth: [
      patSpec({
        label: '개인 액세스 토큰(PAT)',
        fieldLabel: '개인 액세스 토큰',
        present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
      })
    ],
    tools: (api) => createConfluenceToolServer(/* … */)
  }
]
```

**등록 검사 2종과 그 결과:**

| 검사 | 어기면 | 진단 |
|---|---|---|
| 중복 `id` | **뒤에 온 선언만** 거부 | `providers.declaration.rejected{reason:'duplicate_id'}` |
| `origin` 형태(경로·쿼리·후행 슬래시 금지) | 그 선언만 거부 | `…{reason:'invalid_origin'}` |

> **런타임 동적 로딩은 없다.** 배포는 선언 파일을 고쳐 다시 빌드한다. Electron main 에서 임의 코드
> 실행은 filesystem·cookie·vault 전권을 주는 것과 같고 타입 검증도 성립하지 않는다.

배포자용 **단계별 절차와 필드별 주의사항**은 [`guides/closed-network-extensions.md`](../../guides/closed-network-extensions.md) 가 정본이다 — 레시피 4종으로 갈라져 있다:

| 하려는 일 | 절 |
|---|---|
| 로그인 게이트 추가 (ADFS/WIA · 세션→토큰 교환) | §2 |
| LLM provider 추가 (API key · PAT · OAuth code→token) | §3 |
| 사내 서비스 provider + 내장 도구 | §4 |
| MCP 서버 추가 (재빌드 없음 · `${BINDING:}`) | §5 |
| **개발 중 게이트를 보고 고치는 법** (DEV 게이트·우회 토글·파일 지도) | **§6** |
| 검증 명령 · 배포 체크리스트 · 트러블슈팅 | §8 · §9 |

---

## 6. 쓰는 법 — 소비 표면 넷

앱 안의 다른 모듈이 인증을 쓰는 **단일 포트**는 `ProviderApi` 하나다. 소비 슬라이스는
`Pick<ProviderApi, …>` 로 좁혀 받는다.

```ts
interface ProviderApi {
  request(providerId, req, signal?): Promise<ProviderResponse>
  materialize(providerId): { env?; headers? } | null   // 미인증이면 null
  token(providerId): string | null                     // MCP ${BINDING:} 용 (동기)
}
```

### 6.1 사내 REST 호출 — `request`

정책 통과 → 자격증명 주입 → 전송 → redirect 재검사 → 401 강등. **하나라도 걸리면 요청이 나가지
않는다:**

| 규칙 | 이유 |
|---|---|
| 절대 URL·`//host` 금지 (`path` 는 origin 기준 상대) | 선언된 origin 을 우회하는 경로 |
| 예약 헤더(`authorization`·`cookie`·`proxy-authorization`) 덮어쓰기 금지 | 주입을 무력화하거나 다른 provider 를 흉내내는 경로 |
| grant 가 `valid` 가 아니면 차단 | 미인증 요청 누출 방지 |
| redirect 는 **홉마다 정책 재검사**, allowlist 밖이면 중단 | 자격증명이 통제 밖 origin 으로 실려 나가는 것을 막는다 |

### 6.2 LLM 자격증명 — `materialize().env`

> **주입 지점을 실측이 정정했다.** 0180 plan 은 "`${...}` 확장 경로에 주입" 이라고 적었지만
> **LLM settings 는 `${VAR}` 를 확장하지 않는다**(`adapters/claude-settings.ts` — 0028 이 폐지).
> 실제 seam 은 `buildTurnEnv` 가 만드는 **subprocess `Options.env`** 다.

```
chat:send → resolve-turn → buildTurnEnv(ctx, providerKey)
              ├ appEnv() ${VAR} 확장            (기존)
              └ llmEnvFor(api, declarations, providerKey)   (0181)
                    └ 미인증이면 {} → 그 키를 **드롭**
```

- `sources/settings/<adapter>/<provider>/` **디렉토리 = 열거 SSOT 는 깨지 않는다** — 모델 목록·기본
  provider 선택·respawn 판정이 전부 여기 걸려 있다. **조인만** 한다(`llm.{adapter,provider}` → `<adapter>-<provider>`).
- **빈 문자열 치환 금지.** 인증된 것처럼 보이는 요청이 나가면 서버가 401 대신 이상한 오류를 준다.
- 같은 키를 `orca.json` 전역 env 와 provider 가 모두 선언하면 **인증된 값이 이긴다**.

### 6.3 MCP — `token()` / `${BINDING:<providerId>}`

`mcp.json` 의 `${BINDING:wiki}` 가 `ProviderApi.token('wiki')` 로 해소된다. 미인증이면 `null` →
미해결 → `expand.ts` 가 **그 서버를 통째로 드롭**한다(fail-closed).

**세션 grant(쿠키)는 값이 아니므로 `null` 이다** — SSO 는 MCP 로 반출되지 않는다(0178 사용자 결정:
MCP 는 별도 프로세스라 토큰이 기동 시점에 고정된다). MCP 에는 PAT·ID/비밀번호·토큰을 쓴다.

### 6.4 사용량 표본 — `UsageSourcePort`

`features/usage` 는 `features/providers` 를 직접 import 할 수 없으므로(슬라이스 교차 금지) 컴포지션
루트의 `app/usage-source.ts` 가 어댑터를 만들어 주입한다. **미인증은 오류가 아니라 `not_connected`
다** — 부팅 직후·사내망 밖·로그아웃 후의 정상 상태다.

### 6.5 런타임 도구 — `Provider.tools`

grant 상태 하나가 등록 여부를 정한다:

```
valid                      → registry.add(server)    → 다음 spawn 부터 모델이 본다
none · expired · unknown   → registry.remove(id)     → 스냅샷에서 사라진다
```

> ⚠️ **조립 결과를 캐시한다.** `RuntimeToolRegistry` 의 동등성 검사는 **handler identity** 까지 본다
> (실행 값이라 복사하지 않는다). `tools(api)` 를 sync 마다 다시 부르면 형상이 같아도 revision 이
> 올라 다음 턴이 런타임을 재spawn 한다. `ServiceToolRegistrar` 가 providerId 별로 한 번만 만든다.

---

## 7. 게이트

```
부팅 실패 → BootFailureFrame
부팅 미완료 → BootScreen
게이트 미판정(gate=null) → BootScreen        ← fail-closed
게이트 미통과 → GateFrame
통과 → AppLayout
```

| 판정 | 규칙 |
|---|---|
| **prod** · `kind:'gate'` 선언 **0개** | **통과**(`required:false`) — OSS/기본 배포가 로그인 화면에 갇히지 않게 하는 안전장치. 회귀로 고정 |
| **DEV** · 선언 **0개** | **차단**(`alwaysRequired`) — 폐쇄망 실값이 없어도 로그인 화면을 보고 고칠 수 있어야 한다. **탈출구는 우회 토글 하나뿐**이다(0089/0130 의 동작 복원) |
| 선언 N · 전부 `valid` | 통과 |
| 선언 N · 하나라도 아님 | 차단 — 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다 |
| `Settings.authBypass` (**DEV 전용**) | 통과 + `bypassed:true`. prod 번들에서는 `import.meta.env.DEV` 가 false 로 접혀 분기 자체가 사라진다 |
| **판정 전** | **통과시키지 않는다** — main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다 |

> **게이트는 UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다. 로그인 화면은
> 창 컨트롤(닫기)을 항상 살려 둬 재시도 루프에 갇히지 않게 한다.
>
> ⚠️ **DEV 를 prod 와 같은 규칙으로 두면 로그인 화면이 사라진다.** 0181 이 처음 그렇게 만들었고,
> 기본 빌드는 게이트 선언이 0개라 *화면에 도달할 방법 자체가 없었다* — 우회 토글을 켜도 우회할
> 게이트가 없어 아무 일도 일어나지 않았다. `alwaysRequired` 는 **호출부(bootstrap)가
> `import.meta.env.DEV` 를 넣는다**; 순수 모듈이 빌드 모드를 직접 읽으면 테스트가 그것에 묶인다.
> 빈 멤버 배열에 `every` 를 그대로 쓰면 DEV 게이트가 즉시 열리므로 **멤버 수를 함께 본다**(회귀 고정).

로그인 화면은 `app/GateFrame.tsx`(셸) + `features/providers/components/GateLogin.tsx`(랜딩 —
Orca 제목·오르카 이미지·입력 카드·검정 로그인 버튼)이다. 구 `LoginFrame`+`AuthView` 를 provider
축에 맞춰 복원한 것이라 **화면은 0180 이전과 같다**. 필드가 없어도 버튼은 항상 있다 — ADFS/WIA
같은 브라우저 플로우는 입력 없이 `login()` 하나로 끝나므로 **필드 유무가 곧 플로우 종류**다.

### 7.1 신원(principal) — 게이트를 통과한 뒤 사이드바가 보여 주는 것 (0182)

`Grant.principalId` → `ProviderInfo.principal` → `orca:provider:state` → 사이드바 하단 버튼.
**출처는 인증 방식마다 다르다**:

| 방식 | principal 출처 |
|---|---|
| `password` | `compose` 가 입력한 아이디를 그대로 싣는다 |
| `browser-session` | `config.exchange.principalPath` (교환 응답) → 없으면 `config.whoami` (세션 쿠키로 1회 조회) |
| `oauth` | 선언의 `exchange()` 가 `TokenValue.principalId` 를 채우면 |
| `api-key` · `pat` | **없다** — 값이 계정에 묶이지 않는다 |

- **조회 실패는 로그인 실패가 아니다.** principal 은 표시용이라 못 읽어도 grant 는 커밋된다 —
  그러지 않으면 "이름을 못 읽어서 로그인이 안 되는" 상태가 된다. 사유는
  `providers.session.whoami.failed` 가 `valuePath` 와 함께 남기고 **값은 로그에 싣지 않는다**.
- **probe 를 재사용하지 않는다.** `probe()` 는 판정만 돌려주도록 본문을 버리고, 리다이렉트 체인의
  **마지막 홉** 응답이라 신원 문서라는 보장이 없다. 같은 jar 로 `send()` 를 한 번 더 부른다.
- **게이트가 여럿이면** 선언 순서상 principal 을 가진 **첫 게이트**를 쓴다
  (`renderer/features/providers/lib/principal.ts` — 순수 함수, 0·1·N 케이스가 테스트로 고정).
- **principal 이 없는 정상 경우 3종**(DEV 선언 0 · 우회 ON · api-key/pat)에는 폴백 라벨이 뜬다.

---

## 8. GUI

| 표면 | 위치 | 비고 |
|---|---|---|
| 로그인 게이트 화면 | `app/GateFrame.tsx` | `WinControls`(app)를 쓰므로 app 레이어. 상태·액션은 `features/providers/hooks/useProviderGate` |
| 연결 탭 (카탈로그 3번째) | `features/skills/**` | 앱 로그인·모델·사내 서비스가 `kind` 별 그룹으로 **한 화면**에 |
| 방식 선택 | `providerRows.needsAuthChoice()` | `auth` **선언 순서**가 선택지 순서. 길이 1이면 단계 생략 |
| 재인증 / 해제 | `providerRows.canReauth()`·`canRevoke()` | 인증 이력이 있을 때만(만료·복호화 실패 포함 — 빠져나갈 길이 있어야 한다) |
| 추가 버튼 | **없음** | provider 는 빌드타임 선언이라 UI 로 추가할 수 없다 |
| **로그인 우회 토글 (DEV)** | `features/providers/components/ProviderDebugSection.tsx` | 디버그 패널의 "로그인" 그룹. **게이트 화면(`GateFrame`)과 메인 셸(`OverlayLayer`) 양쪽에 마운트된다** — 아래 주의 |

> ⚠️ **우회 토글은 게이트 화면에도 떠야 한다.** 메인 셸에만 두면 정작 게이트에 막혔을 때 손이
> 닿지 않는다 — *우회가 필요한 상황이 곧 우회 스위치에 도달할 수 없는 상황*이 된다. 구
> `LoginFrame` 이 디버그 패널을 직접 마운트했던 이유가 그것이고, 0181 이 `GateFrame` 에서 같은
> 배선을 되살렸다. 두 패널이 상태를 공유하도록 값은 `store/bypassStore.ts` 가 갖는다.
>
> 토글은 `Settings.authBypass` 를 쓰고, **`settings:set` 핸들러가 그 키의 변경을 보면 provider
> 상태를 push 한다**(`app/handlers/settings.ts`) — 그래야 재시작 없이 게이트가 열린다. 설정만
> 저장하고 끝내면 "토글은 켜졌는데 화면은 그대로" 가 되어 토글이 고장 난 것처럼 보인다.

---

## 9. 채널 (요약 — 정본은 [`IPC_CONTRACT.md §2.13-c`](../../IPC_CONTRACT.md))

| 채널 | 방향 | 용도 |
|---|---|---|
| `orca:provider:list` | invoke | 등록된 provider + grant 상태 |
| `orca:provider:state` | **invoke + send** | 게이트 판정용 스냅샷 / 이후 변화 push. **같은 객체를 나르므로 한 채널** |
| `orca:provider:login` | invoke | 인증 시작 → `ProviderStepInfo` |
| `orca:provider:continue` | invoke | 대화형 단계 잇기(입력·OAuth code) |
| `orca:provider:reauth` | invoke | 재인증(기존 grant 유지) |
| `orca:provider:revoke` | invoke | 해제 |

**응답 DTO 에 raw secret 이 없다** — 상태·만료·표시용 `principal` 만 나간다.

---

## 10. 뒤집으면 안 되는 결정

| 결정 | 왜 |
|---|---|
| **`Provider.id` 는 한 번 정하면 유지** | vault 네임스페이스(`provider:<id>:<authKind>`)이자 `${BINDING:<id>}` 참조 대상. 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다 |
| **vault 키 형식 `provider:<id>:<authKind>`** | 사용자 디스크에 남고 다음 버전이 읽는다. 구 형식(`authBinding:<id>:secret`)은 읽지 않는다(0180 에서 재로그인 요구로 결정) |
| **채널명 6개** | preload·renderer 계약 |
| **게이트 선언 0 → 통과** | 이걸 뒤집으면 기본 빌드가 영영 열리지 않는다 |
| **미인증 → `null`/드롭(빈 문자열 치환 금지)** | 조용한 미인증 진행 = 진단 불가능한 실패 |
| **`fetchImpl` 기본값 금지** | 기본값은 곧 조용한 Node 스택 복귀 → 사내 프록시·사설 CA 에서만 실패한다 |
| **런타임 동적 로딩 금지** | main 에서 임의 코드 실행 = 전권 |

---

## 11. 비범위 (의도적으로 안 만든 것)

| 항목 | 이유 |
|---|---|
| 자동 토큰 refresh | 만료는 `expired` 강등 + 재인증으로 다룬다. grant 에 `expiresAt`·`refreshKey` 자리는 있으므로 나중에 로직만 얹는다. 구 구조에서 `refresh` 는 3/3 이 `not_supported` 였다 |
| RFC 8414 discovery · RFC 7591 동적 클라이언트 등록 | 상대가 전부 **고정**이라 불필요 |
| SSO → MCP 직접 전달 | 별도 프로세스라 토큰이 기동 시점에 고정된다(0178 사용자 결정) |
| MCP 서버 구현 | 별도 프로젝트 |
| manifest·ABI·conformance·transaction store·loginChain·cascade | **요구에 없었다.** 0157 이 얹었다가 0180 이 지운 것들 — 만들지 않는 것이 설계다 |

---

## 12. 참고

- 핸드오프: [`handoff/0180-auth-plugin-teardown/plan.md`](../../handoff/0180-auth-plugin-teardown/plan.md)(제거 인벤토리·복원 좌표 `8965fa7`) · [`handoff/0181-provider-platform/plan.md`](../../handoff/0181-provider-platform/plan.md)(설계·인수 기준 15건·구현 보고)
- 절차: [`guides/closed-network-extensions.md`](../../guides/closed-network-extensions.md)
- 경계: [`security.md §1.4-b`](./security.md)(자격증명 3계층 + raw secret 노출 3곳) · [`§1.7`](./security.md)(게이트) · [`§1.8`·`§1.9`](./security.md)(전송 스택)
- 채널: [`IPC_CONTRACT.md §2.13-c`](../../IPC_CONTRACT.md) · 용어: [`GLOSSARY.md`](../../GLOSSARY.md)

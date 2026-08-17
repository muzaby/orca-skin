# 폐쇄망(사내) 배포 — 로그인 게이트·확장 추가 가이드

회사 폐쇄망에 Orca 를 배포할 때, 코어를 고치지 않고 **로그인 게이트·LLM 자격증명·사내 서비스
도구**를 붙이는 방법의 정본. 대상 독자는 **Orca 내부 구조를 모르는 외부 에이전트/사내 개발자**다 —
각 절은 순서대로 실행 가능한 단계로 쓴다.

> **구조·설계 근거는 [`arch/backend/auth.md`](../arch/backend/auth.md) 가 정본이다.**
> 이 문서는 *무엇을 어떤 순서로 하는가* 만 다룬다(구조 서술 = `arch/`, 실행 절차 = `guides/`).
> 계약의 형상은 `app/src/main/contracts/auth.ts` 가 진실 — 예제와 어긋나면 코드가 이긴다.
>
> **0180/0181 요약**: 0157 이 세운 4축 구조(`AuthMethod` × `Connector` × `Binding` × `PluginHost`)는
> 0180 에서 전면 제거됐고, 0181 이 **축 하나**로 다시 세웠다. 구 문서의
> `contracts/auth-method.ts`·`contracts/connector.ts`·`acceptedMethods`·`bindingId` 는
> **더 이상 존재하지 않는다** — 어디서 보더라도 인용하지 마라.

---

## 0. 무엇을 추가하려는가 — 라우팅

### "플러그인" 이라는 말부터 푼다

0157~0178 에는 *provider·connector 를 묶는 빌드타임 패키지* 라는 뜻의 **플러그인**이 있었다.
**0180 이 그것을 지웠고, 0188 이 같은 이름을 다른 뜻으로 되살렸다** — 지금 **Plugin 은 제품 기능
단위**(`features/plugins/<name>/`)이고 등록은 `app/deployment/plugins.ts` 가 한다(Confluence 가
그 예다). 그 밖의 두 용례는 UI 우산어(`nav.plugins` 카탈로그 탭)와 Claude Code 플랫폼 배포
산출물(`ORCA_PLUGIN_NAME`)이다([`GLOSSARY.md`](../GLOSSARY.md) `Plugin` 표제어).

세 뜻이 한 단어를 쓰므로 **문맥 없이 서로 대체하지 않는다.**

따라서 **"플러그인을 추가한다" 는 요청은 아래 넷 중 하나로 번역해야 한다.** 번역하지 않고
착수하면 없는 개념을 찾아 헤매게 된다.

### 라우팅 표

| 하려는 일 | 레시피 | 축 | 재빌드 | 요청 주체 |
|---|---|---|---|---|
| 앱을 열 때 사내 로그인을 **강제**한다 (ADFS/WIA) | **[A — §2](#2-레시피-a--로그인-게이트-추가-kindgate)** | `AuthDefinition` + `gate-auth.ts` membership | 필요 | — |
| 사내 **모델 게이트웨이**에 자격증명을 붙인다 | **[B — §3](#3-레시피-b--llm-provider-추가-kindllm)** | `AuthDefinition` + `harness-runtime.ts` augmenter | 필요 | Orca(발급) → Harness(사용) |
| 인증이 필요한 **내장 도구**를 모델에 노출한다 (Confluence 등) | **[C — §4](#4-레시피-c--사내-서비스-provider--내장-도구-kindservice)** | `AuthDefinition` + `plugins.ts` binding | 필요 | **Orca** (`BoundAuth.request`) |
| 그 외 모든 서비스 연동 | **[D — §5](#5-레시피-d--mcp-서버-추가-재빌드-없음)** | MCP 서버 | **불필요** | claude CLI |

**"재빌드 없이 서비스를 추가하고 싶다" → 레시피 D(MCP) 를 쓴다.** 인증이 필요한 MCP 서버는
`mcp.json` 에서 `${BINDING:<providerId>}` 로 provider 의 토큰을 참조할 수 있다(값 소유는 Orca
vault 가 유지, §5).

> **런타임 임의 코드 로딩은 금지한다** — Electron main 에서 임의 코드 실행은 filesystem·cookie·vault
> 전권을 주는 것과 같고 타입 검증도 성립하지 않는다. 이 정책은 0188 에서도 유지된다.
> A·B·C 는 전부 **빌드타임 선언**이고, UI 에 "추가" 버튼이 없는 이유가 이것이다.

---

## 1. 공통 사전 지식 (레시피 A·B·C 공통)

### 1.1 고치는 파일은 `app/deployment/` 묶음뿐이다

```
app/src/main/app/deployment/
├── auth-definitions.ts  ← 인증 대상 전부 (기본값: [])        → 레시피 A·B·C 공통 1단계
├── gate-auth.ts         ← 그중 앱 로그인 게이트 membership   → 레시피 A
├── harness-runtime.ts   ← Harness 실행 구성 augmenter        → 레시피 B
├── plugins.ts           ← Plugin 도구 조립·가시성            → 레시피 C
├── connections.ts       ← 카탈로그 row 조립(gate·harness·plugin·usage)
└── usage-fetcher.ts     ← 원격 사용량 concrete               → 레시피 E
```

기본 배포는 전부 비어 있다. 그래서 OSS/prod 기본 빌드는 **로그인 화면 없이 열리고** 도구·자격증명
주입도 일어나지 않는다. (**dev 빌드는 다르다 — §6 을 반드시 읽는다.**)

> **레시피 정본은 이 문서다** (0190). `app/deployment/*.ts` 주석은 *틀리면 조용히 실패하는*
> 불변식만 남기고 여기를 가리킨다 — 같은 예제를 두 곳에 두었더니 실제로 세 군데가 갈렸다.

**factory 는 Bootstrap 이 넘긴 인자만으로 조립한다.** 네 factory 의 시그니처는 이렇다:

| 파일 | factory | 받는 것 |
|---|---|---|
| `plugins.ts` | `createPluginBindings(deps)` | `auth: AuthBinder` · `registry: RuntimeToolSink` · `logger?` |
| `harness-runtime.ts` | `createConfigApiAugmenters(deps)` | `auth: AuthBinder` **만** |
| `harness-runtime.ts` | `createDirectCredentialAugmenters(deps)` | `secrets: Record<AuthId, () => string \| null>` **만** (선언한 id 만) |
| `connections.ts` | `createConnectionSources(deps)` | `auth` · `gateMembers` · `plugins` |
| `usage-fetcher.ts` | `createUsageFetcher(deps)` | `auth: AuthBinder` |

`AuthBinder` 는 `Pick<AuthRuntime,'bind'>` 다 (0190) — 배포는 자기 AuthId 를 골라
`BoundAuth.request` 를 쓸 뿐이고 `login`·`revoke`·`resume`·`subscribe` 에는 **도달하지 못한다**
(컴파일 강제). 인증 lifecycle 은 IPC 핸들러와 부팅 복원이 소유한다.

**`bootstrap.ts` 는 열지 않는다.** 필요한 능력이 인자에 없으면 그것부터 이 표에 추가한다 —
부팅 파일을 배포마다 고치기 시작하면 이 디렉토리를 둔 이유가 없어진다.

**Harness 인증과 Usage 인증도 카탈로그에 행이 있어야 로그인할 수 있다.** `connections.ts` 가
`gateRows()`·`pluginRows()` 를 조각으로 노출하므로, 배포는 그 사이에 `{category:'harness', …}`·
`{category:'usage', …}` 를 직접 끼워 넣는다(§3·§5-b 예제).

동작 확인의 살아 있는 예제는 `app/deployment/deployment-wiring.test.ts` 다 — 비어 있지 않은 가상
배포 4종으로 Bootstrap→Plugin/Harness/Usage/카탈로그를 끝까지 태운다. 새 배포를 짜기 전에 이
파일을 먼저 읽으면 각 factory 가 실제로 무엇을 받아 무엇을 돌려주는지 한눈에 보인다.

### 1.2 인증 선언과 "무엇에 쓰는가" 는 다른 파일이다 (0188)

`AuthDefinition` 에는 **`kind`·`tools`·`llm`·`usage`·`envKey` 가 없다.** 인증 대상을 한 번 선언하고,
그것을 무엇에 쓸지는 옆 파일이 정한다.

| 무엇을 정하나 | 어디에 | 어떻게 |
|---|---|---|
| 인증 대상 자체 (id·origin·방식·probe) | `auth-definitions.ts` | `AuthDefinition` 상수 + `AUTH_DEFINITIONS` 배열 |
| 앱 로그인 강제 | `gate-auth.ts` | 위 상수를 **객체 참조**로 `GATE_AUTH_DEFINITIONS` 에 담는다 |
| Harness 실행 구성 | `harness-runtime.ts` | 선택된 key 에 `RuntimeConfigAugmenter` 를 붙인다 |
| 모델에 노출할 도구 | `plugins.ts` | Plugin 모듈로 tool server 를 만들고 binding 을 돌려준다 |
| 원격 사용량 | `usage-fetcher.ts` | `UsageFetcher` 구현을 돌려준다 |

**AuthId 문자열을 각 파일에 다시 적지 않는다** — `auth-definitions.ts` 가 export 한 상수의 `.id` 를
재사용한다. 어긋나면 도구는 모델에 보이는데 인증 대상을 못 찾는다.

⚠️ **`features/harnesses/` 와 혼동하지 않는다.** 그쪽은 `sources/settings/<harness>/<modelProvider>/`
트리를 열거·해석하는 슬라이스이고 **인증 선언이 아니다**. 이 가이드에서 "인증 대상을 추가한다" 는
`app/deployment/auth-definitions.ts` 를 뜻한다.

### 1.3 등록 시 검사는 셋뿐이다

| 검사 | 규칙 | 어기면 |
|---|---|---|
| **중복 `id`** | AuthId 는 유일해야 한다 | 뒤에 온 선언만 거부(앞의 것은 살아 있다) |
| **`id` 형태** | 케밥 소문자(`a-z0-9-`) | 그 선언만 거부 |
| **`origin` 형태** | scheme+host(+port). **경로·쿼리·후행 슬래시 금지** | 그 선언만 거부 |

거부는 **그 선언 하나만** 떨어뜨린다(구 구조의 패키지 단위 all-or-nothing 아님). 사유는
`auth.declaration.rejected` 로그로 남는다 — 선언했는데 화면에 안 보이면 여기부터 본다.

**게이트의 `probe` 검사는 등록이 아니라 소비 측에 있다** (0188) — Auth 코어는 자신이 gate 에
쓰이는지 모른다. `GATE_AUTH_DEFINITIONS` 의 원소 타입이 compile time 에 `probe` 를 강제하고,
부팅 composition 이 runtime 에서도 확인해 **확인할 수 없는 gate 가 있으면 게이트를 닫아 둔다**
(`auth.gate.blocked` 로그).

### 1.4 `AuthId` 는 한 번 정하면 바꾸지 않는다

vault 네임스페이스(`provider:<id>:<authKind>@<세대>` — **prefix 는 호환성 때문에 유지된다**. 세대는 로그인마다 새로 뽑히고 `Grant` 가 포인터를 갖는다)이자
`${BINDING:<id>}` 참조 대상이고, 내장 도구 서버 이름(`<id>-tools` → 모델이 보는
`mcp__<id>-tools__<tool>`)의 뿌리다. 바꾸면 저장된
자격증명을 읽지 못하고 사용자가 적은 MCP 설정과 도구 이름이 함께 깨진다.

케밥 소문자는 **권고가 아니라 검사다**(§1.3). 범위 밖 문자를 쓰면 등록·로그인·vault 저장은 전부
통과하는데 도구 노출과 `${BINDING:}` 치환만 조용히 깨지기 때문이다.

> 지금 어떤 id 로 등록돼 있고 그 도구가 모델에게 어떤 이름으로 보이는지는 **GUI 연결 탭의 상세
> 패널**이 그대로 보여 준다(식별자 · 노출 도구). 선언과 화면이 어긋나면 거기서 잡힌다.

### 1.4-b `probe` — 인증됐는지 한 번 물어보는 곳

```ts
probe: { path: '/rest/api/user/current' }   // origin 기준 상대 경로. 2xx = 인증됨
```

**선언하면 통과해야만 연결이 성립한다** — 로그인 직후에도, 부팅 복원에서도, 방식과 무관하게.
미선언이면 값이 입력된 것만으로 "연결됨" 이 되고, 서버가 그 PAT 를 이미 회수했는지는 실제 도구
호출이 401 을 받을 때에야 드러난다. gate 로 쓸 Auth 는 필수다(§1.3).

| 항목 | 규칙 |
|---|---|
| 판정 | **2xx** 이고 리다이렉트 체인의 **최종 URL 이 `Provider.origin` 으로 복귀**할 것 |
| 왜 최종 origin 까지 보나 | 미인증 SSO 는 IdP 로그인 폼을 **200** 으로 준다. status 만 보면 인증됨으로 오독한다(0174 실기) |
| 언제 도나 | ① grant 커밋 직후 ② 부팅 복원(gate 순차) ③ 게이트 통과 직후(나머지 Auth 1회 병렬) |
| 실패하면 | 로그인 중이면 되돌리고(입력형은 같은 폼에 사유 표시), 부팅이면 `expired` 로 강등 — grant 는 남겨 재인증 지점을 보여 준다 |
| 진단 | `auth.probe.result{ok,status,returned}` · `auth.probe.failed{reason}` |

> ⚠️ **한계 하나.** 인증 실패를 `200` + 로그인 HTML 로 주면서 리다이렉트도 하지 않는 배포는
> 통과한다(상태코드와 최종 origin 만 본다).
>
> ✅ **0188 에서 닫힌 것**: 재인증이 probe 에서 떨어지면 **이전 자격증명이 복구된다**. vault 값·
> grant·`verified`·`credentialRevision` 을 쓰기 전에 떠 두고 실패 시 되돌린다 — 실패한 재인증
> 한 번이 멀쩡히 살아 있던 연결을 끊지 않는다.

### 1.5 `present` — 자격증명을 요청에 싣는 방법

세 레시피가 공유하는 선언이다. **방식(`kind`)에서 추론하지 않는다** — 같은 PAT 를 서비스별로
Bearer 로도, Basic password 로도, `PRIVATE-TOKEN` 헤더로도 붙이기 때문이다.

```ts
present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
```

| 필드 | 값 |
|---|---|
| `location` | `header` · `query` · `cookie` |
| `name` | 헤더/쿼리/쿠키 이름 |
| `scheme` | `bearer` · `basic`(값이 이미 `user:pass` 형태) · `token` · `raw`(값 그대로). 생략 가능 |

### 1.6 `sessionGroup` — 폐쇄망 도메인의 공통 설정

여러 사내 도메인이 **같은 SSO 세션**을 쓰는 것이 폐쇄망의 기본 형태다. 그 축은 `sessionGroup`
하나다 — 같은 문자열을 선언한 provider 들은 Electron 파티션 `persist:auth.<group>` 을 공유하며,
이것은 복사가 아니라 **같은 cookie jar 그 자체**다.

```ts
gate    : { sessionGroup: 'corp', allowedOrigins: ['https://adfs…', 'https://portal…'] }
service : { sessionGroup: 'corp', allowedOrigins: ['https://wiki…'] }
//          ↑ 같은 값 = 같은 jar. SSO 쿠키가 wiki 리다이렉트에서 재사용된다.
```

| 대상 | 공유되나 |
|---|---|
| cookie jar | **공유** — 같은 파티션 그 자체 |
| `allowedOrigins` | **합집합**으로 넓어진다 (각자 자기 호스트만 적어도 된다) |
| **grant** | **공유되지 않는다** — provider 단위다 |

마지막 행이 중요하다. jar 가 살아 있어도 각 provider 는 한 번은 로그인 흐름을 거쳐야
`valid` 가 된다. 다만 쿠키가 이미 있으면 창이 곧바로 `doneUrlPrefix` 로 떨어지는 **무마찰 왕복**이다.

> **부팅 시 등록된다** (0182). 선언된 group 은 `bootstrap.createProviderPlatform` 이
> `registerDeclaredSessions` 로 **로그인 전에** 등록한다. 0181 은 로그인 실행부에서만 등록해서,
> 재시작 후 쿠키·grant 가 살아 있어도 group 이 미등록이라 요청이 `등록되지 않은 session group`
> 으로 죽었다 — 401 강등 경로도 타지 않아 재인증 지점조차 뜨지 않았다.
> **등록 검사에서 거부된 선언의 jar 는 만들어지지 않는다**(입력이 `registry.list()` 다).

### 1.7 SP 를 부르는 네 순간, 그리고 다른 레이어에서 쓰는 법

앱이 사내 SP 를 부르는 순간은 넷이고, **전송은 이미 한 벌**이다 — `AuthenticatedRequester.transport()`
가 세션 grant 를 만나면 `BrowserSessionStore.send()` 로 위임한다.

| SP 호출 | 시점 | 통로 | 경로 표기 | 게이트 |
|---|---|---|---|---|
| whoami — 누구인가 | 로그인 중 | `sessions.send()` | origin 상대 | `allowedOrigins` |
| exchange — 토큰 승격 | 로그인 중 | `sessions.send()` | origin 상대 | `allowedOrigins` |
| **probe — 인증됐나** | **grant 커밋 직후 · 부팅 복원** | 인증된 요청 | origin 상대 | `checkOutboundRequest` 전부 |
| 그 외 API (도구·사용량…) | 로그인 후 | `BoundAuth.request()` | origin 상대 | `checkOutboundRequest` 전부 |

> **probe 는 grant 를 커밋한 *뒤* 돈다.** `checkOutboundRequest` 가 `grantStatus !== 'valid'` 를
> 거부하므로 커밋 전에는 요청 자체가 나가지 않는다. 순서를 뒤집으면(커밋 → 확인 → 실패 시
> 되돌림) 검증 경로와 사용 경로가 **글자까지 같아지고**, 후보 자격증명을 위한 전송 경로를 한 벌
> 더 만들 필요가 없다. 확인이 끝나기 전에는 renderer 로 아무것도 쏘지 않는다 — 떨어질
> 자격증명에도 게이트가 한 순간 열렸다 닫히기 때문이다.
>
> whoami·exchange 는 여전히 커밋 **전**이라 `sessions.send()` 를 쓴다.

**API 마다 선언하지 않는다.** `request` 는 origin 상대 경로면 무엇이든 받는다 — operation
레지스트리가 없다(배포가 선언 두 곳을 맞추지 않게 하려는 결정). 그래서 "SP 의 여러 기능" 은
선언 문제가 아니라 **그 경로들을 누가 소유하느냐**의 문제다. Confluence 가 정본 패턴이다:

| 층 | 파일 | 성격 |
|---|---|---|
| 요청 빌더 | `service/<sp>/rest.ts` | **순수** — 경로·컨텍스트 prefix·인코딩·특수 헤더. 네트워크 0 |
| 오케스트레이션 | `service/<sp>/connector.ts` | 좁힌 포트만 받는다 |
| 노출 표면 | `service/<sp>/tools.ts` | 정책 SSOT |

**소비자가 포트를 받는 방법은 위치에 따라 셋이다.**

| 소비자 위치 | 방법 | 선례 |
|---|---|---|
| `features/plugins/*` 안 | 직접 받는다 | `ConfluenceContext { request, signal?, logger }` |
| **다른 feature 슬라이스** | 소비 측이 **필요한 메서드만 담은 구조적 포트**를 선언하고 컴포지션 루트가 어댑터를 주입 (`src/main/AGENTS.md` §해소책 1+3) — 절차·예제는 **§5-b** | `features/usage/fetcher.ts` 의 `UsageFetcher` (0186) — 타입만 있는 파일이고, 주입은 `app/bootstrap.ts` 가 한다 |
| **renderer** | 전용 도메인 IPC 채널을 만든다 — 범용 프록시 채널은 **없고, 없는 것이 맞다** | `app/handlers/*` |

포트는 항상 좁혀 받는다. `providerId` 까지 클로저로 굳히면 `materialize`·`token` 같은 **값 표면**이
딸려오지 않는다:

```ts
request: (req, signal) => api.request('confluence', req, signal)
```

**요청 하나에 걸리는 규칙** — 어기면 요청 자체가 나가지 않는다(`BoundAuth.request`): 절대 URL·프로토콜 상대 금지 ·
예약 헤더(`authorization`·`cookie`·`proxy-authorization`) 금지 · grant 가 `valid` 가 아니면 차단 ·
컨텍스트 경로는 호출자가 prefix(`normalizeBasePath()` 재사용) · `query` 는 `path` 와 분리 ·
바이트가 필요하면 `responseType:'binary'` + `maxBytes` · redirect 는 홉마다 재검사 ·
401/403 은 자동 `expired` 강등 · `signal` 전파.

---

## 2. 레시피 A — 로그인 게이트 추가 (구 `kind:'gate'`)

사내 IdP 에 로그인해야 앱이 열리게 한다. 인증 방식은 `browser-session` — Electron 창으로 IdP 에
로그인하고 그 partition(cookie jar)을 이후 요청에 재사용한다.

### 단계

| # | 하는 일 | 고치는 파일 / 확인 지점 |
|---|---|---|
| 1 | `AuthDefinition` 상수를 선언하고 `AUTH_DEFINITIONS` 에 넣는다 | `app/src/main/app/deployment/auth-definitions.ts` |
| 2 | **`origin` 을 정한다** — `exchange.path` 가 붙는 기준이고 등록 검사의 대상이다. 로그인 시작 IdP 가 아니라 **probe·토큰 교환이 사는 호스트**로 잡는다(아래 주의) | 같은 파일 |
| 3 | `probe.path` 를 정하고 `config` 4필드를 채운다 (`sessionGroup`·`loginUrl`·`doneUrlPrefix`·`allowedOrigins`) | 같은 파일. **파일 헤더 주석에 같은 레시피가 들어 있다** — 거기서 시작하는 편이 빠르다 |
| 4 | **그 상수를 `GATE_AUTH_DEFINITIONS` 에 객체 참조로 담는다** — 이 단계를 빼면 인증 대상일 뿐 게이트가 아니다 | `app/src/main/app/deployment/gate-auth.ts`. 타입이 `GateAuthDefinition` 이라 `probe` 를 빠뜨리면 **컴파일이 안 된다** |
| 5 | 토큰까지 필요하면 `config.exchange` 를 더한다 | §2-b |
| 6 | `npm run typecheck` → `./node_modules/.bin/vitest run src/main/features/auth src/main/features/gate` | 형상·회귀 |
| 7 | `npm run dev` 로 로그인 왕복을 실기한다 | **§6** (dev 게이트 동작이 prod 와 다르다) |

### 선언 예제

```ts
// app/deployment/auth-definitions.ts
export const CORP_SSO_AUTH = {
  id: 'corp-sso',
  label: '사내 로그인',
  origin: 'https://portal.example.corp',      // ← 2단계. 경로·후행 슬래시 금지
  probe: { path: '/api/me' },                 // ← gate 는 필수. 로그인 직후와 부팅이 같이 쓴다
  methods: [
    {
      kind: 'browser-session',
      label: '통합 인증(WIA)',
      config: {
        sessionGroup: 'corp',
        loginUrl: 'https://adfs.example.corp/adfs/ls/?wa=wsignin1.0',
        doneUrlPrefix: 'https://portal.example.corp/home',
        allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
      }
    }
  ]
} satisfies GateAuthDefinition

export const AUTH_DEFINITIONS: readonly AuthDefinition[] = [CORP_SSO_AUTH]
```

```ts
// app/deployment/gate-auth.ts — 4단계. **문자열이 아니라 객체 참조**다.
import { CORP_SSO_AUTH } from './auth-definitions'

export const GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = [CORP_SSO_AUTH]
```

> ⚠️ **`origin` 은 로그인 시작 주소(IdP)가 아니다.** `loginUrl` 은 절대 URL 이라 어디를 가리켜도
> 되지만, **`probe.path`·`exchange.path`·`whoami.path` 는 `AuthDefinition.origin` 기준 상대 경로로
> 해석된다.** 토큰 교환이 portal 에 있는데 `origin` 을 ADFS 로 두면 그 요청들이 엉뚱한 호스트로
> 나간다. probe 판정도 "체인이 `origin` 으로 복귀했는가" 이므로 `origin` 이 어긋나면 인증이
> 영영 성립하지 않는다.

### 필드별 의미 · 흔한 실수

| 필드 | 의미 | 흔한 실수 |
|---|---|---|
| `sessionGroup` | cookie jar 이름. **같은 값을 쓰는 Auth 들이 jar 를 공유**한다 | 서비스마다 다르게 주면 SSO 재사용이 안 된다 |
| `loginUrl` | 창이 처음 여는 주소 | — |
| `doneUrlPrefix` | 이 접두사에 도달하면 로그인 완료로 **간주**한다 | 이것만으로 성공을 선언하지 않는다 — 확정은 `AuthDefinition.probe` 다 |
| `probe.path`(선언 최상위) | 완료를 **실제 요청으로** 재확인하는 endpoint. **origin 상대** | 로그인 폼이 200 으로 뜨는 배포에서 오판을 막는 지점. gate membership 에 담으려면 필수(컴파일 강제) |
| `allowedOrigins` | 창이 오갈 수 있는 origin **전수**. 서브도메인 자동 허용 없음 | 하나 빠지면 로그인 중간에 차단된다 — 로그가 막힌 origin 을 지목한다 |
| `whoami` (0182) | `{ path, valuePath }` — 로그인한 계정을 읽어 **사이드바 하단에 표시**한다. 생략하면 조회 요청이 아예 나가지 않고 폴백 라벨(`developer`)이 뜬다 | **`path` 는 origin 기준 상대 경로다** — 위 세 URL 이 절대 URL 이라 여기도 절대 URL 로 적기 쉽다(아래 주의) |

**`whoami` 를 왜 probe 로 대신하지 않는가.** `probe.path` 가 흔히 `/api/me` 라 같은 응답에 계정이
들어 있지만, probe 는 **판정만** 본다(상태코드 + 최종 origin) — 리다이렉트 체인을 따라간 끝의
본문이라 신원 문서라는 보장이 없다. 그래서 같은 cookie jar 로 한 번 더 부른다(`whoami.path` 에
probe 와 **같은 endpoint** 를 적어도 된다 — 요청은 두 번 나가지만 "판정" 과 "신원" 의 의미가
선언에서 갈린다).

> ⚠️ **경로 표기는 `loginUrl`·`doneUrlPrefix` 만 절대 URL 이고 나머지(`probe.path`·`whoami.path`·
> `exchange.path`)는 전부 origin 상대다.** 앞의 둘은 창이 여는 주소라 IdP 를 가리켜야 하고,
> 나머지는 `BoundAuth.request` 가 그대로 쓰는데 그쪽은 절대 경로를 `absolute_path` 로 거부한다.

**신원 조회 실패는 로그인 실패가 아니다.** principal 은 표시용이라, 못 읽었다고 인증을 되돌리면
"이름을 못 읽어서 로그인이 안 되는" 상태가 된다. 실패하면 grant 는 그대로 커밋되고 화면만 폴백
라벨을 쓴다. 사유는 `providers.session.whoami.failed` 로그가 `valuePath` 와 함께 남긴다
(**값은 로그에 싣지 않는다** — 계정 식별자는 개인정보다).

**게이트가 여럿이면 전부 통과해야 앱이 열린다** — 로그인이 체인이라 멤버 하나만 풀려도 인증이
아니다. 게이트 화면은 선언 순서대로 순차 진행하고 "n/N" 진행 표시를 낸다.

### 2-b. 세션으로 토큰까지 받기 ("둘 다 필요")

쿠키 세션만으로는 부족하고 **토큰이 필요한 대상**이 있으면 `config.exchange` 를 더한다. 게이트
세션이 성립한 뒤 그 cookie jar 로 사내 API 를 불러 토큰을 받아 grant 를 승격한다.

```ts
config: {
  …,
  exchange: {
    path: '/api/token',         // provider.origin 기준 상대 경로 (2단계 주의 참고)
    valuePath: 'data.token',    // 응답 JSON 에서 토큰을 꺼낼 점 경로
    expiresAtPath: 'data.exp',  // 선택. 초·밀리초·ISO 를 모두 흡수한다
    principalPath: 'data.mail'  // 선택(0182). 같은 응답에 계정이 실려 오면 여기서 꺼낸다
  }
}
```

값을 못 찾으면 `providers.session.exchange.no-token` 로그가 **`valuePath` 를 그대로 찍는다** —
경로 오타는 로그에서 바로 보인다.

**`principalPath` 가 있으면 `whoami` 를 부르지 않는다** (추가 왕복 0). 교환 응답이 이미 신원을
말했는데 한 번 더 묻지 않는다. 둘 다 선언해 두면 교환이 신원을 안 주는 배포에서만 `whoami` 로
넘어간다.

---

## 3. 레시피 B — Harness 실행 구성 추가 (구 `kind:'llm'`)

사내 모델 게이트웨이의 URL·모델 식별자·실행 token 을 subprocess 환경변수로 주입한다.

**0188 에서 달라진 것**: 구 `llm: { adapter, provider, envKey }` 는 credential **한 값**만 표현했다.
이제 배포가 붙이는 것은 선택된 key 의 **`RuntimeConfigAugmenter`** 이고, 그 결과는 환경변수
**overlay 전체**다 — token 뿐 아니라 URL·모델 변수·flag 를 함께 담는다.

### 단계

| # | 하는 일 | 고치는 파일 / 확인 지점 |
|---|---|---|
| 1 | 대상 게이트웨이의 디렉토리가 있는지 확인한다 — `~/.config/orca/sources/settings/<harness>/<modelProvider>/` | **디렉토리가 열거 SSOT 다.** 없으면 augmenter 를 붙여도 선택되지 않는다 |
| 2 | 인증 대상을 선언한다 (`AuthDefinition` — `envKey` 는 적지 않는다) | `app/deployment/auth-definitions.ts` |
| 3 | 인증 방식을 고른다 — 입력 수집형(§3-a) · OAuth(§3-b) · 또는 **둘 다 `methods` 배열에** | 같은 파일 |
| 4 | 1단계 key 에 augmenter 를 붙인다. **config API 방식과 direct credential 방식은 서로 다른 factory 다**(§3-c) | `app/deployment/harness-runtime.ts` |
| 5 | 그 Auth 가 바뀌면 무효화할 key 를 `AUTH_INVALIDATED_HARNESS_KEYS` 에 적는다 | 같은 파일. 안 적으면 재인증 뒤에도 옛 token 이 warm cache 로 남는다 |
| 6 | **카탈로그 row 를 추가한다** — `{category:'harness', auth, harnessModelProviderKey}` | `app/deployment/connections.ts`. **안 하면 연결 탭에 행이 없어 인증 자체가 불가능하다** |
| 7 | `npm run typecheck` → `./node_modules/.bin/vitest run src/main/features/harnesses src/main/features/auth src/main/app/deployment` | 형상·cache·fence·배선 회귀 |
| 8 | 실기: 연결 탭에서 인증 → 새 채팅 전송 → 게이트웨이 로그에 요청이 도달하는지 | 사람 실기 |

**주입 규칙 4가지** (어기면 진단이 어려워진다):

- secret 은 **`options.env` 에만** 실린다. `settings.json` 은 여전히 verbatim 이고 Orca 가 그
  파일에 토큰을 쓰지 않는다(0028 결정 유지,
  [`arch/backend/security.md`](../arch/backend/security.md)).
- **미인증이면 실패시킨다** — 빈 문자열로 치환하지 않는다. 인증된 것처럼 보이는 요청이 나가면
  서버가 401 대신 이상한 오류를 준다.
- 우선순위는 `augmenter env > settings env > app env > process env` 다. **settings env 가 app env 를
  이긴다** — `orca.json` 의 app env 는 전역 폴백이고 ModelProvider settings 는 그 ModelProvider
  전용 설정이다. 폴백이 전용을 이기면 게이트웨이를 바꿔도 URL·모델 변수가 따라오지 않는다.
- `options.env` 를 만드는 턴에는 settings 의 **`env` 블록이 통째로** in-memory 사본에서 빠지고 그
  값이 `options.env` 로 hoist 된다 — 같은 키가 두 채널에 동시에 남지 않으므로 SDK 가 어느 채널을
  우선하든 결과가 하나다. 디스크 `settings.json` 은 그대로다.
- 필수 값이 하나라도 없거나 빈 문자열이면 **부분 env 를 cache 하지 말고 resolve 를 실패시킨다**.
  반쯤 채워진 환경으로 spawn 하면 증상이 원인에서 멀어진다.

### 3-a. API key · ID/비밀번호 · PAT — 코어 구현

배포가 채우는 것은 **라벨과 `present` 뿐**이다. 입력 폼·vault 봉인·재인증은 코어가 한다.

```ts
import { apiKeySpec, passwordSpec, patSpec } from '../../features/auth/specs/credential'

apiKeySpec({
  label: 'API 키',
  fieldLabel: 'API 키',
  present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
})
```

| 팩토리 | 필드 | 언제 |
|---|---|---|
| `apiKeySpec({label, fieldLabel, present})` | 단일 값 | 서비스가 발급한 opaque 값(애플리케이션에 묶임) |
| `patSpec({label, fieldLabel, present})` | 단일 값 | 값의 모양은 같아도 **발급 주체·회수 절차·만료 정책이 다르다** — 표시·감사가 이 구분을 쓴다 |
| `passwordSpec({label, present})` | 아이디 + 비밀번호(고정) | 서버가 `base64(user:pass)` 를 받는 경우. 필드 라벨은 코어가 정한다 |

### 3-b. OAuth code→token

표준 OAuth 를 쓰는 대상이 있으면 `authorize(ctx)` 하나만 채운다. **PKCE 와 `state` 는 코어가
발급·보관·대조한다** — 배포는 코어가 준 값을 authorize URL 에 싣기만 한다.

```ts
{
  kind: 'oauth',
  label: '사내 계정으로 로그인',
  present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
  async authorize(ctx) {
    const pkce = ctx.pkce()
    const redirectUri = ctx.loopbackRedirectUri(9321)
    const url = new URL('https://llm.example.corp/oauth/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', 'orca-desktop')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', ctx.state())
    url.searchParams.set('code_challenge', pkce.challenge)
    url.searchParams.set('code_challenge_method', pkce.method)
    return {
      url: url.toString(),
      redirect: { kind: 'loopback', port: 9321 },
      exchange: async (code, verifier) => {
        // 코어가 보관하던 verifier 를 넘겨준다 — 따로 저장하지 마라.
        const res = await fetch('https://llm.example.corp/oauth/token', { … })
        const body = await res.json()
        return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
      }
    }
  }
}
```

**SP 명세에 `state` 가 없으면 `ctx.state()` 를 부르지 않는다.** 부르지 않으면 인가 요청에 state 가
실리지 않고, 코어는 콜백에서 state 를 **요구하지 않는다**(대신 진행 중인 인가 1건으로 대조한다 —
manual 분기와 같은 규칙). 반대로 한 번이라도 부르면 콜백이 **같은 값을 돌려줘야** 하고, 없거나
다르면 거부된다. 즉 `ctx.state()` 호출 자체가 "이 SP 는 state 를 echo 한다" 는 선언이다.

**redirect 3분기 — 무엇을 고를 것인가:**

| 분기 | 언제 | 주의 |
|---|---|---|
| `loopback` (권장) | IdP 가 `http://127.0.0.1:<port>/callback` 을 등록해 준다 | 사용자의 **기본 브라우저**가 흐름을 처리한다(주소창·인증서를 직접 본다). RFC 8252 |
| `window` | 루프백 redirect 를 등록해주지 않는 폐쇄망 IdP | 앱 내부 창. `isDone(url)` 이 참인 URL 에서 code 를 뽑는다 |
| `manual` | 리다이렉트를 아예 못 쓰는 환경 | 사용자가 브라우저에서 받은 code 를 붙여 넣는다(`orca:provider:continue`) |

**코어가 보장하는 것** — 배포가 다시 구현하지 마라:

- `code_challenge` = S256(`verifier`), `plain` 은 지원하지 않는다.
- `state` 를 **실었을 때** 불일치·누락 콜백은 **거부**하고 pending 을 소비한다(재사용 불가).
- pending 은 **파일에 보관**돼 앱이 재시작돼도 콜백 대조가 성립한다(TTL 10분).
- Auth 당 진행 중 인가는 1건이다.

### 3-c. augmenter 두 방식 — 한 factory 가 둘 다 받지 않는다

```text
config API 방식      BoundAuth.request → OAuth/session 으로 API 접근 → 응답의 실제 LLM token·URL·Model
direct credential    닫힌 readSecret() → 사용자가 입력한 API key/token 을 runtimeEnv 에 직접 배치
```

**이 경계는 타입이 강제한다.** OAuth access token(=API 접근 권한)과 응답의 실제 LLM token 은 다른
값이고, 한 factory 가 둘 다 손에 쥐면 그 경계가 흐려진다. 그래서 deps 가 둘로 갈라져 있다 —
`HarnessConfigApiDeps` 는 `auth` 만, `HarnessDirectCredentialDeps` 는 `secrets` 만 갖는다.
config API factory 에서 `deps.secrets` 를 부르면 **컴파일이 실패한다**.

direct credential 방식을 쓰려면 `DIRECT_CREDENTIAL_AUTH_IDS` 에 그 AuthId 를 **먼저 선언한다** —
Bootstrap 은 그 목록만큼만 닫힌 closure 를 만들고, 선언하지 않은 Auth 는 `deps.secrets` 에 키
자체가 없다. 고르는 함수(selector)를 넘기지 않는 이유가 이것이다.

두 방식이 **같은 Harness key 를 보강하면 부팅에서 throw** 한다 — 조용히 하나가 이기면 실행
중에는 어느 쪽이 적용됐는지 알 수 없다.

```ts
// app/deployment/harness-runtime.ts — config API 방식
export const CLAUDE_CORP_KEY = providerKeyOf('claude', 'corp')

export function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  const corpAuth = deps.auth.bind(CORP_LLM_AUTH.id)
  return {
    [CLAUDE_CORP_KEY]: {
      async resolve(_input, signal) {
        if (corpAuth.snapshot().status !== 'valid') {
          throw new Error('corp model provider authentication required')
        }
        const response = await corpAuth.request({ path: '/api/llm/config' }, signal)
        if (!response.ok) throw new Error(`llm config request failed: ${response.status}`)
        const config = parseCorpLlmConfig(response.body)   // 매핑은 이 배포 모듈이 소유한다
        return {
          runtimeEnv: {
            ANTHROPIC_AUTH_TOKEN: config.llmToken,
            ANTHROPIC_BASE_URL: config.url,
            ANTHROPIC_DEFAULT_OPUS_MODEL: config.models.opus,
            ANTHROPIC_DEFAULT_SONNET_MODEL: config.models.sonnet,
            ANTHROPIC_DEFAULT_HAIKU_MODEL: config.models.haiku
          },
          validUntil: config.expiresAt
        }
      }
    }
  }
}
```

direct credential 방식은 Bootstrap 이 넘긴 **AuthId 를 닫은 closure** 하나만 받는다:

```ts
export function createDirectCredentialAugmenter(readSecret: () => string | null) {
  return {
    async resolve() {
      const token = readSecret()
      if (token === null) throw new Error('model provider credential is not available')
      return { runtimeEnv: { ANTHROPIC_AUTH_TOKEN: token } }
    }
  }
}
```

**성능 계약** — augmenter 를 붙였다고 매 턴 원격을 부르지 않는다. `HarnessRuntimeConfigService` 가
key 별 현재 세대 하나를 cache 하고, 같은 key·generation·sourceRevision 의 동시 요청은 single-flight
로 합친다. 무효화는 **`credentialChanged:true` Auth change · 명시 refresh · settings 변경 · 응답
만료** 에서만 일어난다. 자세한 규칙은 [`arch/backend/auth.md`](../arch/backend/auth.md) §6.3.

---

## 4. 레시피 C — Plugin + 내장 도구 (구 `kind:'service'`)

인증된 연결이 LLM 에 런타임 도구를 노출한다. Auth 가 `valid` 일 때만 등록되고, 해제·만료·401
강등 시 도구가 스냅샷에서 사라진다.

### 단계

| # | 하는 일 | 고치는 파일 / 확인 지점 |
|---|---|---|
| 1 | 인증 대상을 선언한다 | `app/deployment/auth-definitions.ts` |
| 2 | `origin` 에 **컨텍스트 경로를 넣지 않는다**(등록 검사에 걸린다). 컨텍스트 경로는 Plugin 옵션 `apiBasePath` 로 넘긴다 | 같은 파일 |
| 3 | 인증 방식을 선언한다(대개 `patSpec` 1종 — 길이 1이면 GUI 선택 단계가 생략된다) | 같은 파일 |
| 4 | **`probe` 를 선언한다** (§1.4-b). 없으면 값 입력만으로 "연결됨" 이 되고 회수된 PAT 를 못 걸러낸다 | 같은 파일 |
| 5 | `createPluginBindings()` 에서 tool server 를 **한 번** 만들고 binding 을 돌려준다 | `app/deployment/plugins.ts` |
| 6 | `npm run typecheck` → `./node_modules/.bin/vitest run src/main/features/plugins src/main/app/deployment` | |
| 7 | 실기: 연결 탭에서 인증 → 상세 패널의 **식별자·노출 도구**가 선언과 같은지 → **새 채팅**에서 도구가 보이는지(등록은 다음 spawn 부터 반영된다) | 사람 실기 |

```ts
// app/deployment/auth-definitions.ts
export const CONFLUENCE_AUTH = {
  id: 'confluence',
  label: 'Confluence',
  origin: 'https://wiki.example.corp',   // 컨텍스트 경로는 여기 넣지 않는다
  probe: { path: '/confluence/rest/api/user/current' },
  methods: [
    patSpec({
      label: '개인 액세스 토큰(PAT)',
      fieldLabel: '개인 액세스 토큰',
      present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
    })
  ]
} satisfies AuthDefinition
```

```ts
// app/deployment/plugins.ts — 서버는 **부팅에서 1회** 만들고 sync 는 add/remove 만 한다.
export function createPluginBindings(deps: {
  auth: AuthBinder
  registry: RuntimeToolSink
}): PluginBinding[] {
  const confluenceAuth = deps.auth.bind(CONFLUENCE_AUTH.id)
  const server = confluenceTools(
    {
      authId: confluenceAuth.authId,
      label: CONFLUENCE_AUTH.label,
      origin: CONFLUENCE_AUTH.origin,
      request: (req, signal) => confluenceAuth.request(req, signal)
    },
    { apiBasePath: '/confluence' }
  )
  return [createPluginBinding({ auth: confluenceAuth, server, registry: deps.registry })]
}
```

> ⚠️ **tool server 를 sync 마다 다시 만들지 마라.** `RuntimeToolRegistry` 의 동등성 검사는 handler
> identity 까지 본다 — 매번 새로 만들면 형상이 같아도 revision 이 올라 다음 턴이 런타임을
> 재spawn 한다. 조립 결과에 요청 시점 상태를 굽지도 마라(자격증명은 `request` 가 호출 시점에 붙인다).
>
> ⚠️ **AuthId 를 손으로 다시 적지 마라.** 구 레시피는 같은 문자열을 네 곳에 쓰게 했고, 하나라도
> 어긋나면 **도구는 모델에 보이는데 호출할 때마다 죽었다.** 컴파일러도 등록 검사도 잡지 못한다 —
> 그래서 `CONFLUENCE_AUTH.id` 를 재사용한다.
>
> ⚠️ **GUI 도구 목록은 Auth 가 invalid 여도 비지 않는다.** cached descriptor 에서 이름을 만들고
> `status` 로 비활성을 안내한다 — active registry 로 목록을 만들면 미인증에서 도구가 사라진다.

### `BoundAuth.request` 가 강제하는 것 (어기면 요청 자체가 나가지 않는다)

- **절대 URL·프로토콜 상대 경로 금지** — `path` 는 origin 기준 상대 경로다.
- **예약 헤더 금지** — `authorization` · `cookie` · `proxy-authorization` 을 덮어쓸 수 없다.
- **미인증 차단** — grant 가 `valid` 가 아니면 전송하지 않는다.
- **redirect 는 홉마다 재검사** — allowlist 밖 `Location` 은 따라가지 않는다.
- **401/403 → grant 를 `expired` 로 강등** — 화면에 재인증 지점이 생긴다.

---

## 5. 레시피 D — MCP 서버 추가 (재빌드 없음)

재빌드가 필요 없는 유일한 경로다. 앱 UI(카탈로그 MCP 탭)에서 런타임에 추가하고, 인증이 필요하면
`${BINDING:<providerId>}` 로 provider 토큰을 참조한다.

| # | 하는 일 |
|---|---|
| 1 | 토큰을 줄 Auth 를 먼저 준비한다(레시피 B 또는 C — `${BINDING:}` 은 **선언된 AuthId** 를 참조한다) |
| 2 | 그 Auth 를 연결 탭에서 인증한다 |
| 3 | `mcp.json` 에 서버를 추가하고 헤더/env 에 `${BINDING:<id>}` 를 쓴다 |
| 4 | 새 채팅에서 서버가 붙었는지 확인한다 |

```json
{ "mcpServers": { "wiki": { "url": "https://wiki.example.corp/mcp",
  "headers": { "Authorization": "Bearer ${BINDING:confluence}" } } } }
```

- 해당 Auth 가 **미인증이면 참조가 미해결로 남고 그 서버는 배포에서 통째로 빠진다**
  (fail-closed). 빈 문자열로 채우지 않는다.
- **세션 grant(쿠키)는 값이 아니므로 `null` 이다** — SSO 는 MCP 로 반출되지 않는다(0178 결정).
  MCP 에는 PAT·ID/비밀번호·토큰을 쓴다.
- 해석된 값은 `dist/plugins/orca/.mcp.json` 에 평문으로 렌더된다(문서화된 예외 1,
  [`arch/backend/security.md §1.4-b`](../arch/backend/security.md)) — claude CLI 가 그 파일을 읽어
  서버를 spawn 하기 때문이다.

> **PAT 인증 MCP 를 붙이는 길은 셋이고, 성격이 다르다.** ⓐ **내장 도구**(레시피 C) — `present`
> 선언이 적용되고 값이 디스크에 안 나가며 401 강등·재인증 UI 가 붙는다 ⓑ **이 레시피(`${BINDING:}`)**
> — Auth 와 PAT 를 공유하지만 `AuthSecretReader.read()` 가 raw 값만 주므로 헤더 형식은 손으로 적는다
> ⓒ **MCP 자체 인증**(카탈로그 모달에 값 입력) — 재빌드가 없지만 Auth 와 무관하다.
> 같은 PAT 를 도구와 MCP 가 함께 쓸 것이면 ⓐ 를 먼저 검토한다.

---

## 5-b. 레시피 E — SP API 를 주기적으로 부르기 (cron)

사내 SP 를 **앱이 알아서 주기적으로** 부르게 한다(사용량 조회·목록 동기화·헬스체크 등).

> **선언에 슬롯이 없다 (0183 r2 · 0188 유지).** 예전에는 사용량 전용 슬롯이 있었으나(정적 모듈
> 폴더 → 잠시 선언 필드) 둘 다 제거됐다. **SP API 는 어느 feature 에서든 `BoundAuth.request`
> 로 부를 수 있으므로 전용 슬롯이 필요 없다.** 주기 호출은 *선언*이 아니라 **코드**로 쓴다 —
> 아래 단계가 그 절차다. `auth-definitions.ts` 는 **무엇을 부를 수 있는가**(대상·origin·인증)만
> 말하고, **언제·무엇을 부르는가**는 소비 feature 와 컴포지션 루트가 갖는다.

### 단계

| # | 하는 일 | 고치는 파일 |
|---|---|---|
| 1 | 부를 대상 Auth 를 선언한다(레시피 B 또는 C) | `app/deployment/auth-definitions.ts` |
| 2 | 할 일을 함수로 쓴다 — 그 기능을 **쓰는 feature 안에** 둔다 | `features/<슬라이스>/…` |
| 3 | 그 함수가 SP 를 부를 통로를 **좁힌 포트로 받는다**(`BoundAuth` 하나 — AuthId 를 다시 적을 자리가 없다) | 같은 파일 |
| 4 | **컴포지션 루트가** 잡을 등록하고 concrete 를 주입한다 | `app/src/main/app/bootstrap.ts` |
| 5 | 주기를 정한다 — 코어 고정형(`schedule`) 또는 설정 노출형(`Settings.scheduler`) | `bootstrap.ts` / `src/shared/protocol.ts` |

### 예제 — 컴포지션 루트에서 등록한다

```ts
// app/src/main/app/bootstrap.ts — Scheduler 생성 직후(다른 잡 등록과 같은 자리)
const gateway = auth.bind('corp-gateway')   // AuthId — auth-definitions.ts 에 선언한 값
scheduler.register('corp-quota-sync', async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000) // 상한은 호출자가 건다
  try {
    const res = await gateway.request(
      { path: '/api/quota', method: 'GET', headers: { accept: 'application/json' } },
      controller.signal
    )
    if (!res.ok) return                     // 미인증·사내망 밖은 **정상 상태**다. 다음 틱을 기다린다
                                            // ↑ 삼키면 `schedule_runs` 에 success 가 남는다(아래 주의)
    // …res.body 를 해석해 쓰는 쪽에 넘긴다
  } finally {
    clearTimeout(timer)
  }
})
scheduler.schedule('corp-quota-sync', { enabled: true, cron: '*/5 * * * *' })
```

### cron 을 어디에 적나 — 두 층

| 층 | 어디에 적나 | 언제 쓰나 | 선례 |
|---|---|---|---|
| **코어 고정형** | `bootstrap.ts` 의 `scheduler.schedule(key, { cron })` | 배포가 바꿀 일이 없는 주기 | 위 예제 |
| **설정 노출형** | `src/shared/protocol.ts` 의 `SchedulerSettingsSchema` 에 그룹을 더하고, `Scheduler.applySettings()` 에 한 줄 | 사용자가 켜고 끄거나 주기를 바꿔야 할 때 | `usageRecompute`(cron) · `updateCheck`(intervalMs, 0156) |

설정 노출형은 `settings:set` 이 들어올 때마다 `applySettings` 가 다시 돌아 **즉시 반영**된다
(`app/handlers/settings.ts`). 스펙이 그대로면 재생성하지 않으므로 interval 잡의 카운트다운이
설정 쓰기마다 0으로 돌아가지 않는다.

### 필드별 의미 · 흔한 실수

| 항목 | 의미 | 흔한 실수 |
|---|---|---|
| `register(key, action)` | 잡 이름 ↔ 할 일. **`schedule` 보다 먼저** 불러야 한다 | 미등록 key 로 `schedule` 하면 **throw** 한다(`Scheduler job is not registered`) |
| `schedule(key, spec)` | `spec` = `{ cron: '분 시 일 월 요일' }` 또는 `{ intervalMs }` (+ `enabled?`) | 둘을 같이 주지 않는다. cron 은 **벽시계 정렬**, interval 은 **`schedule()` 호출 시각 anchor**("앱 시작 후 N시간") |
| cron 표현식 | 표준 5필드 | 잘못된 식은 **등록 시점에 던진다**(`assertValidCron`) — 조용히 안 뜨는 잡을 만들지 않으려는 결정이다. `enabled:false` 라도 검증은 먼저 돈다 |
| `path` | **origin 기준 상대 경로** | 절대 URL 은 정책이 `absolute_path` 로 거부한다. 컨텍스트 경로(`/confluence`)는 호출자가 prefix |
| 인증 실패 | grant 가 `valid` 가 아니면 요청이 **차단**된다 | 오류로 올리지 마라 — 부팅 직후·사내망 밖·로그아웃 후의 **정상 상태**다. 401/403 은 자동 `expired` 강등 → 카탈로그에 재인증 지점이 뜬다 |
| `signal` | 타임아웃·취소는 **호출자 몫** | 엔진이 대신 걸어주지 않는다. `AbortController` 를 만들어 넘긴다 |

- **주기는 선언에 두지 않는다.** 배포마다 주기가 갈리면 원격 부하를 예측할 수 없다.
- **앱이 떠 있을 때만 발화한다** — croner 는 in-app 스케줄러다(0091). 종료 시
  `Scheduler.stopAll()` 이 `closeDb` 보다 먼저 돈다.
- 겹치면 뒤 발화는 **`skipped`** 로 기록되고, 성공/실패는 `schedule_runs` 테이블에 남는다
  (`DbRunRecorder`).
- **삼킨 실패는 `success` 로 남는다.** action 이 던지지 않으면 `Scheduler.invoke` 가
  `schedule_runs` 에 `success` 를 적는다 — 위 예제처럼 `return` 으로 넘어가면 **상시 실패를
  나중에 확인할 경로가 없다**. 원장에 남기려면 ⓐ 대상별로 격리해 나머지를 계속 돌리고
  ⓑ **틱 끝에서 한 번 던진다**. 코어의 `usage-fetch`(`features/usage/jobs.ts`)가 그 형태다.

### 다른 feature 슬라이스에서 부를 때

`features/*` 는 `features/auth` 를 **직접 import 할 수 없다**(수직 슬라이스 교차 금지).
그래서 소비 측은 **필요한 메서드만 담은 구조적 포트**를 선언하고, 컴포지션 루트가 concrete 를
주입한다(`app/src/main/AGENTS.md` §해소책 1+3).

```ts
// features/<슬라이스>/quota.ts — AuthId 를 클로저로 굳혀 인증 표면 전체가 딸려오지 않게
export interface QuotaPort {
  fetch(signal?: AbortSignal): Promise<{ ok: boolean; body: string }>
}

// app/bootstrap.ts
const gateway = auth.bind('corp-gateway')
const quota: QuotaPort = {
  fetch: (signal) => gateway.request({ path: '/api/quota' }, signal)
}
```

renderer 에서 SP 를 부르려면 **전용 도메인 IPC 채널**을 만든다 — 범용 프록시 채널은 없고,
없는 것이 맞다(`app/handlers/*` 참조).

### 살아 있는 선례 — 사용량 fetcher (0186)

코어에 **주입 지점만 있고 구현은 배포가 채우는** 형태의 실제 사례다. 세 파일만 보면 된다:

| 파일 | 무엇 |
|---|---|
| `features/usage/fetcher.ts` | `UsageFetcher` 포트 + `UsageSnapshot` — **타입뿐**. 응답 JSON→스냅샷 매핑은 코어에 두지 않는다(배포가 소유) |
| `features/usage/jobs.ts` | `registerUsageJobs()` — 잡 등록. **fetcher 가 없으면 원격 잡을 등록조차 하지 않는다** |
| `app/deployment/usage-fetcher.ts` | `createUsageFetcher(deps)` — 기본값 `undefined`. 배포가 이 자리를 채운다 (0188 이전에는 `bootstrap.ts` 의 상수였다) |

```ts
// app/deployment/usage-fetcher.ts — 배포가 이 자리를 채운다
import { CLAUDE_CORP_KEY } from './harness-runtime'

export function createUsageFetcher(deps: UsageDeploymentDeps): UsageFetcher | undefined {
  const corpUsage = deps.auth.bind('corp-usage')     // AuthId 를 여기서 한 번 닫는다
  return {
    // 이 배포가 그 key 의 원격 사용량을 지원하는가. 조회·갱신 양쪽의 단일 게이트다.
    // **Auth 상태가 아니다** — 미인증이어도 true 로 두고 아래에서 오류를 전파한다.
    supports: (providerKey) => providerKey === CLAUDE_CORP_KEY,
    fetchUsage: async (providerKey, signal) => {
      const res = await corpUsage.request({ path: '/api/usage' }, signal)
      if (!res.ok) throw new Error(`usage request failed: ${res.status}`)   // 이번 틱 실패
      return toSnapshot(providerKey, res.body)   // 매핑은 배포 소유
    }
  }
}
```

인증받을 수 있으려면 이 Auth 도 **카탈로그에 행이 있어야 한다** — `app/deployment/connections.ts`
에 `{category:'usage', auth: deps.auth.bind('corp-usage')}` 를 더한다.

**두 멤버는 서로 다른 것을 표현한다 — 섞으면 조용히 틀린다.** `supports` 는 *능력*, 반환값은
*이번 호출의 결과*다. 계약의 정본은 `features/usage/fetcher.ts` 와 `features/usage/tracker.ts` 다:

| 이 배포가 주는 것 | 코어가 하는 일 |
|---|---|
| `supports === false` | 원격 미지원 — **과거에 받아둔 캐시 행이 있어도 무시**하고 로컬 집계 + 사용자 설정 한도로 접는다 |
| `supports === true` + 스냅샷 | 갱신 성공 — 스냅샷을 캐시에 upsert 하고 그 provider 뷰만 push 한다 |
| `supports === true` + `null` 또는 throw | **이번 갱신 실패** — 주기 잡은 그 provider 만 건너뛰고 나머지를 계속 갱신하지만(격리), 실패가 하나라도 있으면 **틱 끝에서 잡 자체가 실패**해 `schedule_runs` 에 `error` 로 남는다. 설정 탭의 수동 동기화는 그대로 실패로 되돌려준다 |

- **`null` 을 "정상" 의 뜻으로 쓰지 않는다.** 미인증·사내망 밖은 *상태로는* 정상이지만 **이번
  갱신은 실패한 것**이라, 지원 provider 가 `null` 을 주면 코어가 실패로 올린다. "이 배포는 원래
  이 provider 를 안 부른다" 는 뜻이라면 `null` 이 아니라 **`supports` 를 `false`** 로 답한다.
- **`baselineUsable` 은 함부로 켜지 않는다.** 응답의 `as_of` 가 *billing aggregation watermark*
  임을 확인했을 때만 `true` 로 채운다. 단순 "응답 생성 시각" 이면 원격이 이미 센 턴이 로컬 증분에
  또 더해져 **같은 턴이 두 번 계상**된다. 미지정이면 코어가 기준선을 쓰지 않고 **한도만** 원격에서
  가져가므로, 확신이 없으면 비워 두는 쪽이 옳다.
- **`providerKey` 와 `Provider.id` 는 다른 축이다.** 사용량은 `${adapter}-${provider}` 합성 키를
  쓰고 Auth 는 `AuthId` 를 쓴다. 두 좌표를 잇는 곳은 `app/deployment/harness-runtime.ts` 의
  augmenter 배선 하나뿐이다 — AuthId → key 조인 registry 를 새로 만들지 않는다.

---

## 6. 개발 중 확인하는 법 — DEV 게이트 · 우회 토글

**여기를 건너뛰면 "로그인 화면이 안 뜬다"·"우회 토글이 안 먹는다" 로 시간을 버린다.**
0181 의 마지막 두 수정(5단계-c·d)이 이 동작을 0180 이전으로 되돌려 놓았다.

### 6.1 dev 는 prod 와 다르게 판정한다

| 빌드 | gate membership 0개 | membership N개 |
|---|---|---|
| **prod** | **통과** — OSS/기본 배포가 로그인 화면에 갇히지 않게 하는 안전장치 | 전부 `valid` 여야 통과 |
| **DEV** (`npm run dev`) | **차단** — 로그인 화면을 항상 볼 수 있어야 한다 | 전부 `valid` 여야 통과 |

전체 진리표는 [`arch/backend/auth.md §7`](../arch/backend/auth.md) 이 정본이다. 절차상
알아야 할 것은 하나 — **`npm run dev` 는 선언이 비어 있어도 로그인 화면에서 시작한다.** 그 빌드의
**탈출구는 우회 토글 하나뿐**이다(로그인할 상대가 없으므로 화면이 그 사실을 안내한다).

주입 지점: `app/src/main/app/bootstrap.ts` 가 `alwaysRequired: import.meta.env.DEV` 를 넣는다.
판정 모듈(`features/gate/index.ts`)은 빌드 모드를 직접 읽지 않는다 — 순수하게 남겨
테스트가 빌드 모드에 묶이지 않게 하기 위함이다.

### 6.2 우회 토글

| 항목 | 값 |
|---|---|
| 위치 | 디버그 패널 → **"로그인" 그룹** (`renderer/features/providers/components/ProviderDebugSection.tsx`) |
| 마운트 | **게이트 화면(`GateFrame`)과 메인 셸(`OverlayLayer`) 양쪽** |
| 저장 | `Settings.authBypass` (main 이 SSOT, renderer 는 `store/bypassStore.ts` 미러) |
| 반영 | **즉시** — `settings:set` 핸들러가 이 키의 변경을 보면 provider 상태를 push 한다 |
| prod | 없음 — `import.meta.env.DEV` 가 false 로 접혀 디버그 패널도 분기도 사라진다 |

> **게이트 화면에도 떠야 하는 이유**: 메인 셸에만 두면 정작 게이트에 막혔을 때 스위치에 손이
> 닿지 않는다 — *우회가 필요한 상황이 곧 우회 스위치에 도달할 수 없는 상황*이 된다.
> 토글 옆의 상태 표시("게이트: 없음/통과/차단")로 *선언이 0개라 안 뜨는 것* 과 *로그인이 안 된 것*
> 을 구분한다.

### 6.3 로그인한 계정이 사이드바에 뜨는지 확인 (0182)

게이트를 통과하면 **사이드바 하단 사용자 버튼**에 계정이 뜬다. 확인 순서:

| # | 하는 일 | 기대 |
|---|---|---|
| 1 | 디버그 패널에서 우회 토글을 **끄고** 게이트 로그인 | 로그인 성공 |
| 2 | 사이드바 하단 버튼과 그 팝오버 헤더를 본다 | `whoami.valuePath` 가 가리킨 값(대개 email) |
| 3 | 우회 토글을 **켜고** 재기동 | 폴백 라벨 `developer` |

**principal 이 없는 것이 정상인 경우가 셋이다** — 게이트 선언 0개(DEV) · 우회 토글 ON ·
신원을 주지 않는 인증 방식(`api-key`·`pat`). 셋 다 폴백 라벨이 뜬다.

**게이트가 여럿이면** 선언 순서상 principal 을 가진 **첫 게이트**를 보여 준다
(`features/providers/lib/principal.ts` — 순수 함수라 규칙이 테스트로 고정돼 있다).

### 6.4 게이트 화면을 고칠 때 건드리는 파일

| 대상 | 파일 |
|---|---|
| 판정 규칙 (순수) | `app/src/main/features/gate/index.ts` |
| 판정 입력 주입 (`bypass`·`alwaysRequired`) | `app/src/main/app/bootstrap.ts` |
| **세션 group 부팅 등록** (0182) | `app/src/main/features/auth/session-policies.ts` |
| **신원 조회** (probe 뒤 whoami) | `app/src/main/features/auth/browser-session/runner.ts` |
| 상태 push 배선 | `app/src/main/app/handlers/settings.ts` |
| 게이트 셸 (타이틀바·디버그 패널 마운트) | `app/src/renderer/src/app/GateFrame.tsx` |
| 로그인 랜딩 (Orca 제목·이미지·입력 카드·버튼) | `app/src/renderer/src/features/providers/components/GateLogin.tsx` |
| 상태·액션 훅 | `app/src/renderer/src/features/providers/hooks/useProviderGate.ts` |
| **신원 선택 규칙 (순수)** | `app/src/renderer/src/features/providers/lib/principal.ts` |
| **사이드바 표시** | `app/src/renderer/src/app/SidebarUserButton.tsx` |
| 우회 토글 상태 | `app/src/renderer/src/features/providers/store/bypassStore.ts` |
| 방식 선택 규칙 (게이트 ↔ 카탈로그 공용) | `app/src/renderer/src/shared/config/providerAuth.ts` |

**필드가 없어도 로그인 버튼은 항상 있다** — ADFS/WIA 같은 브라우저 플로우는 입력 없이 `login()`
하나로 끝나므로 **필드 유무가 곧 플로우 종류**다. 랜딩을 고칠 때 이 불변식을 깨지 마라.

---

## 7. GUI 에서 보이는 모습

| 표면 | 어디 | 비고 |
|---|---|---|
| **로그인 게이트 화면** | 앱 진입 시 (`GateFrame`) | 창 컨트롤(닫기)은 항상 살아 있다 — 재시도 루프에 갇히지 않게 |
| **연결 탭** | 설정 카탈로그의 세 번째 탭 | 앱 로그인·모델·사내 서비스가 `kind` 별 그룹으로 한 화면에 |
| **방식 선택** | 연결 탭 · 게이트 화면 | `auth` 배열의 **선언 순서**가 선택지 순서. 길이 1이면 단계를 건너뛴다 |
| **재인증** | 연결 탭 | 기존 자격증명을 **유지한 채** 새 인증을 시도하고 **성공해야 교체**된다 |
| **해제** | 연결 탭 | grant + vault 값·metadata·index 를 함께 지운다 |
| **추가 버튼** | **없음** | provider 는 빌드타임 선언이라 UI 로 추가할 수 없다(§0) |
| **우회 토글** | 디버그 패널 "로그인" 그룹 (**DEV 전용**) | §6.2 |

---

## 8. 검증 · 배포 체크리스트

### 8.1 선언을 고친 뒤 (기계 게이트)

`app/` 에서 실행한다. **`npm test` 는 쓰지 않는다** — better-sqlite3 ABI 를 Node 로 뒤집어 이후
`npm run dev`/`build` 를 깨뜨린다([`app/AGENTS.md`](../../app/AGENTS.md) ABI 가이드).

| # | 명령 | 통과 기준 |
|---|---|---|
| 1 | `npm run typecheck` | exit 0 — 선언이 `Provider` 형상을 만족 |
| 2 | `npm run lint` | error 0 (boundaries 위반 0) |
| 3 | `./node_modules/.bin/vitest run src/main/features/auth src/main/features/gate src/main/features/harnesses src/main/features/plugins src/main/app` | green |

관련 회귀 테스트(게이트·인증을 고쳤다면 함께 본다): `features/gate/gate.test.ts` ·
`auth/registry.test.ts` · `auth/login.test.ts` · `auth/oauth.test.ts` · `auth/policy.test.ts` ·
`auth/specs/browser-session.test.ts` · `llm/llm.test.ts` · `app/handlers/settings.test.ts` ·
`app/handlers/providers.test.ts` · renderer `features/auth/store/bypassStore.test.ts`.

### 8.2 배포 (사람 실기)

1. `declarations/{sso,llm,service}.ts` 를 채웠고 `id` 는 **한 번 정하고 유지**한다(§1.4).
2. `origin` 에 경로·후행 슬래시가 없는지 확인한다(있으면 그 선언이 거부된다).
3. `allowedOrigins` 에 로그인 왕복이 지나는 origin 을 **전부** 넣는다.
4. `npm run build:win` 으로 배포본을 만든다(릴리스 절차는 [`release-operations.md`](./release-operations.md)).
5. 실기: 로그인 화면 → 사내 로그인 → 메인 UI 진입 → 연결 탭에서 상태·재인증·해제 확인.
6. 로그(`~/.config/orca/logs/`)에서 `providers.*` 이벤트로 거부·실패 사유를 확인한다.

---

## 9. 자주 막히는 곳

| 증상 | 원인 | 확인 지점 |
|---|---|---|
| dev 에서 로그인 화면이 **안 뜬다** | 우회 토글이 켜져 있다 | 디버그 패널 "로그인" 그룹 (§6.2) |
| 우회 토글을 켰는데 **화면이 그대로** | 상태 push 경로가 끊겼다 | `app/handlers/settings.ts` — `authBypass` 변경 시 provider 상태 broadcast |
| 우회 토글이 **보이지 않는다** | prod 빌드다 | prod 에는 디버그 패널 자체가 없다 (§6.2) |
| 선언했는데 provider 가 **목록에 없다** | 등록 거부(중복 `id` 또는 `origin` 형태) | 로그 `providers.declaration.rejected` 의 `reason` |
| 로그인 창이 **중간에 멈춘다** | `allowedOrigins` 누락 | 로그가 막힌 origin 을 지목한다 |
| `doneUrlPrefix` 에 닿았는데 **실패**로 끝난다 | probe 가 미인증을 봤다(로그인 폼이 200 으로 뜨는 배포) | 로그 `providers.session.probe.unauthenticated` |
| 토큰 교환이 **값을 못 찾는다** | `valuePath` 오타 또는 응답 구조 상이 | 로그 `providers.session.exchange.no-token` 이 `valuePath` 를 찍는다 |
| 토큰 교환이 **엉뚱한 호스트로** 나간다 | `origin` 을 IdP 로 잡았다 | §2 2단계 주의 |
| 사이드바 이름이 **`developer` 로 남는다** | ⓐ `whoami` 미선언 ⓑ `valuePath` 오타·응답 구조 상이 ⓒ 우회 토글 ON ⓓ 신원을 안 주는 방식(`api-key`·`pat`) | ⓑ는 로그 `providers.session.whoami.failed` 가 `valuePath` 를 찍는다. ⓒⓓ는 **정상**이다 (§6.3) |
| 사이드바에 **엉뚱한 계정**이 뜬다 | 게이트가 여럿이고 앞선 선언이 principal 을 갖고 있다 | 선언 순서 = 표시 우선순위 (§6.3) |
| **재시작하면** 세션 provider 호출이 죽는다 (`등록되지 않은 session group`) | 부팅 등록이 빠졌다 — 0182 이전 동작 | `bootstrap.createProviderPlatform` 의 `registerDeclaredSessions` (§1.6) |
| 도구가 **모델에 안 보인다** | grant 가 `valid` 가 아니거나 아직 재spawn 전이다 | 연결 탭 상태 → **새 채팅**에서 재확인 |
| MCP 서버가 **통째로 빠진다** | `${BINDING:}` 미해결(fail-closed) | 해당 provider 인증 상태 · 세션 grant 는 `null` 이다 |
| LLM 요청이 **인증 없이** 나간다 | `envKey` 오타 또는 `llm.{adapter,provider}` 조인 실패 | `sources/settings/<adapter>/<provider>/` 디렉토리 존재 여부 |
| 업데이트 후 **저장된 로그인이 사라졌다** | `AuthId` 를 바꿨다 | vault 네임스페이스가 `AuthId` 로 갈린다 (§1.4) |
| 주기 잡이 **영영 발화하지 않는다** | ⓐ cron 식 오타 ⓑ `enabled:false` ⓒ `register` 보다 `schedule` 을 먼저 불렀다 | ⓐⓒ는 **등록 시점에 throw** 한다(`assertValidCron` · `Scheduler job is not registered`) — 부팅 로그를 본다 (§5-b) |
| 주기 잡이 **겹쳐서 도는 것 같다** | 앞 발화가 아직 안 끝났다 | 겹친 발화는 실행되지 않고 `schedule_runs` 에 **`skipped`** 로 남는다 (§5-b) |
| 앱을 껐더니 **잡이 안 돈다** | croner 는 **in-app 스케줄러**다 | 설계상 그렇다 — OS 스케줄러가 아니다 (§5-b) |

---

## 10. 폐쇄망 빌드 · 자동 업데이트 피드

provider 선언과 별개로, **배포본 자체를 폐쇄망에서 만들고 갱신하는** 절차다.
(0130/0133 에 세운 내용 — 0181 문서 재작성 때 유실됐던 것을 복원했다.)

- **빌드는 회사가 수행한다**(선언이 컴파일 타임 코드이므로): 사내 npm 미러/오프라인 캐시로
  `npm ci` → `npm run build:win`(electron-builder, publish 없음).
- 외부 네트워크 의존은 그 외에 없다 — LLM 백엔드는 provider `settings.json` 의
  `ANTHROPIC_BASE_URL` 등으로 사내 게이트웨이를 가리킨다(TRD §6.8 레시피 표).

**자동 업데이트**: 피드가 설정되지 않으면 updater 는 이미 noop 으로 저하된다
(`feed-not-configured`, `app/src/main/app/updater.ts`) — 외부 GitHub Releases 피드는 폐쇄망에서
자연히 불능이다. 사내 피드는 `orca.json` 의 `update` 로 **코드 수정 없이** 지정한다
(스키마·조립 정본: `infra/config/orca-file.ts` · `app/updater-feed.ts`).

| provider | `orca.json` 예 | 언제 |
|---|---|---|
| `s3` (권장 — MinIO/S3-호환) | `{ "update": { "provider": "s3", "bucket": "orca-updates", "endpoint": "http://minio.internal:9000", "path": "win" } }` | `endpoint` 를 주면 electron-updater 가 `${endpoint}/${bucket}[/${path}]` 를 base URL 로 삼는다(사내 MinIO). 생략하면 AWS S3(`region` 사용) |
| `generic` | `{ "update": { "provider": "generic", "url": "https://updates.internal/orca/" } }` | 임의 HTTPS 정적 호스트 |
| `github` | `{ "update": { "provider": "github", "owner": "infra", "repo": "orca", "host": "github.company.com" } }` | 사내 GitHub Enterprise. base URL 이 다르면 `host`(필요 시 `protocol`)로 지정 |
| 비활성 | `{ "update": { "enabled": false } }` | 업데이터 전체를 끈다 |

- 어느 쪽이든 `latest.yml` · installer(`*-setup.exe`) · `.blockmap` 셋을 올린다.
- ⚠️ electron-updater 런타임은 s3 버킷을 **익명 GET(공개 읽기) 정적 HTTP** 로 취급한다(AWS 서명을
  하지 않는다) — 버킷/prefix 를 사내에서 anonymous read 로 노출하거나 리버스 프록시로 서빙해야
  한다. **비밀·토큰은 저장하지 않는다.**
- 산출물 업로드는 회사 배포 절차의 몫이다(electron-builder `publish` 를 사내 타깃으로 바꾸거나,
  `--publish never` 빌드 후 수동 업로드). 릴리스 실행·롤백 절차는
  [`release-operations.md`](./release-operations.md).

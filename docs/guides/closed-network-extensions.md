# 폐쇄망(사내) 배포 — 외부확장 구현 가이드 (0130 → 0157 → **0181 전면 재작성**)

회사 폐쇄망에 Orca 를 배포할 때, 코어를 고치지 않고 **로그인 게이트·LLM 자격증명·사내 서비스
도구**를 붙이는 방법의 정본. 대상 독자는 Orca 내부 구조를 모르는 외부 에이전트/사내 개발자다.

> **0180/0181 요약**: 0157 이 세운 4축 구조(`AuthMethod` × `Connector` × `Binding` × `PluginHost`)는
> 0180 에서 전면 제거됐고, 0181 이 **축 하나**로 다시 세웠다. 이 문서가 서술하는 것은 그 새 구조다.
> 구 문서의 `contracts/auth-method.ts`·`contracts/connector.ts`·`acceptedMethods`·`bindingId` 는
> **더 이상 존재하지 않는다** — 어디서 보더라도 인용하지 마라.

## 0. 확장 모델 — 무엇을 어디에 붙이는가

축은 "선언형이냐 코드냐" 가 아니라 **"빌드 타임 내장이냐 런타임 MCP 냐"** 다.

| 확장 대상 | 추가 방식 | 재빌드 | 요청 주체 |
|---|---|---|---|
| 앱 로그인 게이트 (ADFS/WIA) | **`Provider{kind:'gate'}` 선언** (§2) | 필요 | — |
| LLM 게이트웨이 자격증명 (API key · OAuth) | **`Provider{kind:'llm'}` 선언** (§3) | 필요 | Orca(발급) → claude CLI(사용) |
| 인증이 필요한 **내장 도구** (Confluence 등) | **`Provider{kind:'service'}` 선언 + `tools`** (§4) | 필요 | **Orca** (`ProviderApi.request`) |
| 그 외 모든 서비스 연동 | **MCP 서버** (앱 UI 에서 런타임 추가) | **불필요** | claude CLI |

**"재빌드 없이 서비스를 추가하고 싶다" → MCP 를 쓴다.** 인증이 필요한 MCP 서버는 `mcp.json` 에서
`${BINDING:<providerId>}` 로 provider 의 토큰을 참조할 수 있다(값 소유는 Orca vault 가 유지, §5).

**런타임 임의 코드 로딩은 금지한다** — Electron main 에서 임의 코드 실행은 filesystem·cookie·vault
전권을 주는 것과 같고 타입 검증도 성립하지 않는다. 이 정책은 0181 에서도 유지된다.

## 1. 고치는 파일은 `features/providers/declarations/` 뿐이다

```
app/src/main/features/providers/declarations/
├── index.ts     ← 세 배열을 합친다 (보통 손대지 않는다)
├── sso.ts       ← 게이트 1개 또는 null   (기본값: null = 게이트 없음)
├── llm.ts       ← LLM provider 배열      (기본값: [])
└── service.ts   ← 사내 서비스 배열       (기본값: [])
```

기본 배포는 셋 다 비어 있다. 그래서 OSS/dev 빌드는 **로그인 화면 없이 열리고**(게이트 선언 0 →
통과) 도구·자격증명 주입도 일어나지 않는다.

### 등록 시 검사는 둘뿐이다

| 검사 | 규칙 | 어기면 |
|---|---|---|
| **중복 `id`** | provider id 는 유일해야 한다 | 뒤에 온 선언만 거부(앞의 것은 살아 있다) |
| **`origin` 형태** | scheme+host(+port). **경로·쿼리·후행 슬래시 금지** | 그 선언만 거부 |

거부는 **그 선언 하나만** 떨어뜨린다(구 구조의 패키지 단위 all-or-nothing 아님). 사유는
`providers.declaration.rejected` 로그로 남는다.

> ⚠️ **`Provider.id` 는 한 번 정하면 바꾸지 않는다.** vault 네임스페이스
> (`provider:<id>:<authKind>`)이자 `${BINDING:<id>}` 참조 대상이다. 바꾸면 저장된 자격증명을
> 읽지 못하고 사용자가 적은 MCP 설정이 깨진다.

## 2. 로그인 게이트 (`kind:'gate'`)

`sso.ts` 의 `SSO_PROVIDER` 를 채운다. 인증 방식은 `browser-session` — Electron 창으로 사내 IdP 에
로그인하고 그 partition(cookie jar)을 이후 요청에 재사용한다.

```ts
export const SSO_PROVIDER: Provider | null = {
  id: 'corp-sso',
  label: '사내 로그인',
  kind: 'gate',
  origin: 'https://portal.example.corp',
  auth: [
    {
      kind: 'browser-session',
      label: '통합 인증(WIA)',
      config: {
        sessionGroup: 'corp',
        loginUrl: 'https://adfs.example.corp/adfs/ls/?wa=wsignin1.0',
        doneUrlPrefix: 'https://portal.example.corp/home',
        authenticationProbeUrl: 'https://portal.example.corp/api/me',
        allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
      }
    }
  ]
}
```

| 필드 | 의미 | 흔한 실수 |
|---|---|---|
| `sessionGroup` | cookie jar 이름. **같은 값을 쓰는 provider 들이 jar 를 공유**한다 | 서비스마다 다르게 주면 SSO 재사용이 안 된다 |
| `loginUrl` | 창이 처음 여는 주소 | — |
| `doneUrlPrefix` | 이 접두사에 도달하면 로그인 완료로 **간주**한다 | 이것만으로 성공을 선언하지 않는다(아래 probe) |
| `authenticationProbeUrl` | 완료를 **실제 요청으로** 재확인하는 endpoint | 로그인 폼이 200 으로 뜨는 배포에서 오판을 막는 지점 |
| `allowedOrigins` | 창이 오갈 수 있는 origin **전수**. 서브도메인 자동 허용 없음 | 하나 빠지면 로그인 중간에 차단된다 — 로그가 막힌 origin 을 지목한다 |

**게이트가 여럿이면 전부 통과해야 앱이 열린다** — 로그인이 체인이라 멤버 하나만 풀려도 인증이
아니다. dev 빌드에서는 디버그 패널의 `authBypass` 로 건너뛸 수 있다(prod 번들에는 그 분기가 없다).

### 2-b. 세션으로 토큰까지 받기 ("둘 다 필요")

쿠키 세션만으로는 부족하고 **토큰이 필요한 대상**이 있으면 `config.exchange` 를 더한다. 게이트
세션이 성립한 뒤 그 cookie jar 로 사내 API 를 불러 토큰을 받아 grant 를 승격한다.

```ts
config: {
  …,
  exchange: {
    path: '/api/token',        // provider.origin 기준 상대 경로
    valuePath: 'data.token',   // 응답 JSON 에서 토큰을 꺼낼 점 경로
    expiresAtPath: 'data.exp'  // 선택. 초·밀리초·ISO 를 모두 흡수한다
  }
}
```

## 3. LLM provider (`kind:'llm'`)

`llm.ts` 배열을 채운다. `llm.{adapter,provider}` 가 `sources/settings/<adapter>/<provider>/`
디렉토리와의 **조인 좌표**이고, `llm.envKey` 는 자격증명을 실을 subprocess 환경변수 이름이다.

```ts
{
  id: 'corp-gateway',
  label: '사내 모델 게이트웨이',
  kind: 'llm',
  origin: 'https://llm.example.corp',
  llm: { adapter: 'claude', provider: 'corp', envKey: 'ANTHROPIC_AUTH_TOKEN' },
  auth: [ /* 아래 §3-a·§3-b */ ]
}
```

- 주입은 **`Options.env` 한 레이어에서만** 일어난다. `settings.json` 은 여전히 verbatim 이고
  Orca 가 그 파일에 토큰을 쓰지 않는다(0028 결정 유지, `arch/backend/security.md §1.4-b`).
- **미인증이면 그 키를 넣지 않는다**(빈 문자열 치환 금지). 인증된 것처럼 보이는 요청이 나가면
  서버가 401 대신 이상한 오류를 주고 진단이 어려워진다.

### 3-a. API key · ID/비밀번호 · PAT — 코어 구현

배포가 채우는 것은 **라벨과 `present`(요청에 싣는 방법)뿐**이다. 입력 폼·vault 봉인·재인증은 코어가 한다.

```ts
import { apiKeySpec, passwordSpec, patSpec } from '../auth/specs/credential'

apiKeySpec({
  label: 'API 키',
  fieldLabel: 'API 키',
  present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
})
```

`present.scheme`: `bearer` · `basic`(값이 이미 `user:pass` 형태) · `token` · `raw`(값 그대로).
`present.location`: `header` · `query` · `cookie`.

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

**redirect 3분기 — 무엇을 고를 것인가:**

| 분기 | 언제 | 주의 |
|---|---|---|
| `loopback` (권장) | IdP 가 `http://127.0.0.1:<port>/callback` 을 등록해 준다 | 사용자의 **기본 브라우저**가 흐름을 처리한다(주소창·인증서를 직접 본다). RFC 8252 |
| `window` | 루프백 redirect 를 등록해주지 않는 폐쇄망 IdP | 앱 내부 창. `isDone(url)` 이 참인 URL 에서 code 를 뽑는다 |
| `manual` | 리다이렉트를 아예 못 쓰는 환경 | 사용자가 브라우저에서 받은 code 를 붙여 넣는다 |

**코어가 보장하는 것** — 배포가 다시 구현하지 마라:
- `code_challenge` = S256(`verifier`), `plain` 은 지원하지 않는다.
- `state` 불일치 콜백은 **거부**하고 pending 을 소비한다(재사용 불가).
- pending 은 **파일에 보관**돼 앱이 재시작돼도 콜백 대조가 성립한다(TTL 10분).
- provider 당 진행 중 인가는 1건이다.

## 4. 사내 서비스 provider (`kind:'service'`)

`service.ts` 배열을 채우고 `tools` 로 런타임 도구를 노출한다. grant 가 `valid` 일 때만 등록되고,
해제·만료·401 강등 시 도구가 스냅샷에서 사라진다.

```ts
{
  id: 'confluence',
  label: 'Confluence',
  kind: 'service',
  origin: 'https://wiki.example.corp',   // 컨텍스트 경로는 여기 넣지 않는다(아래)
  auth: [ patSpec({ … }) ],
  tools: (api) => {
    const runtime = createConfluenceRuntime({
      id: 'confluence',
      label: 'Confluence',
      baseUrl: 'https://wiki.example.corp',
      apiBasePath: '/confluence'          // 컨텍스트 경로는 요청 path 앞에 붙는다
    })
    return createConfluenceToolServer('confluence', 'Confluence', runtime, {
      request: (req, signal) => api.request('confluence', req, signal),
      logger: () => undefined
    })
  }
}
```

`ProviderApi.request` 가 강제하는 것(어기면 요청 자체가 나가지 않는다):
- **절대 URL·프로토콜 상대 경로 금지** — `path` 는 origin 기준 상대 경로다.
- **예약 헤더 금지** — `authorization` · `cookie` · `proxy-authorization` 을 덮어쓸 수 없다.
- **미인증 차단** — grant 가 `valid` 가 아니면 전송하지 않는다.
- **redirect 는 홉마다 재검사** — allowlist 밖 `Location` 은 따라가지 않는다.
- **401/403 → grant 를 `expired` 로 강등** — 화면에 재인증 지점이 생긴다.

## 5. MCP 서버에서 provider 토큰 쓰기

`mcp.json` 에서 `${BINDING:<providerId>}` 로 참조한다.

```json
{ "mcpServers": { "wiki": { "url": "https://wiki.example.corp/mcp",
  "headers": { "Authorization": "Bearer ${BINDING:confluence}" } } } }
```

- 해당 provider 가 **미인증이면 참조가 미해결로 남고 그 서버는 배포에서 통째로 빠진다**
  (fail-closed). 빈 문자열로 채우지 않는다.
- 세션 grant(쿠키)는 값이 아니므로 `null` 이다 — **SSO 는 MCP 로 반출되지 않는다**(0178 결정).
  MCP 에는 PAT·ID/비밀번호·토큰을 쓴다.
- 해석된 값은 `dist/plugins/orca/.mcp.json` 에 평문으로 렌더된다(문서화된 예외 1,
  `arch/backend/security.md §1.4-b`) — claude CLI 가 그 파일을 읽어 서버를 spawn 하기 때문이다.

## 6. GUI 에서 보이는 모습

- **연결 탭** — 설정 카탈로그의 세 번째 탭(`skills.rail.providers`). 앱 로그인·모델·사내 서비스가
  `kind` 별 그룹으로 한 화면에 모인다.
- **방식 선택** — `auth` 배열의 **선언 순서**가 GUI 선택지 순서다. 길이가 1이면 선택 단계를
  건너뛴다(폐쇄망 배포의 게이트는 대개 1종이라 사용자는 선택 화면을 보지 않는다).
- **재인증** — 기존 자격증명을 **유지한 채** 새 인증을 시도하고 성공해야 교체된다. 실패하면
  이전 것으로 계속 쓸 수 있다.
- **추가 버튼 없음** — provider 는 빌드타임 선언이라 UI 로 추가할 수 없다.

## 7. 배포 체크리스트

1. `declarations/{sso,llm,service}.ts` 를 채운다. `id` 는 **한 번 정하고 유지**한다.
2. `origin` 에 경로·후행 슬래시가 없는지 확인한다(있으면 그 선언이 거부된다).
3. `allowedOrigins` 에 로그인 왕복이 지나는 origin 을 **전부** 넣는다.
4. `npm run build:win` 으로 배포본을 만든다(릴리스 절차는 `guides/release-operations.md`).
5. 실기: 로그인 화면 → 사내 로그인 → 메인 UI 진입, 연결 탭에서 상태·재인증·해제 확인.
6. 로그(`~/.config/orca/logs/`)에서 `providers.*` 이벤트로 거부 사유를 확인한다.

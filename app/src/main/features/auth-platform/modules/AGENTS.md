# `features/auth-platform/modules/` — 사내 대상 opt-in 레지스트리

폐쇄망(사내) 배포가 **코어를 거의 건드리지 않고** 자기 사내 API 대상(connector)을 붙이는 자리다.

**인증 방식은 여기 없다** (0178). 방식의 정본은 [`../methods/index.ts`](../methods/index.ts) 의
내장 목록이고, 대상은 그중 무엇을 받아들이는지만 `acceptedMethods` 로 선언한다. 0178 이전에는
모듈마다 자기 provider 를 만들어 붙였고, 그래서 위키와 사용량이 글자까지 같은 PAT·ID/비밀번호
구현을 각각 한 벌씩 들고 있었다.

## 활성화 절차

1. `modules/<회사명>/` 디렉토리를 만들고 `ConnectorPackage` 를 export 한다.
2. `modules/index.ts` 의 `CONNECTOR_PACKAGES` 배열에 한 줄 추가한다.

```ts
export const CONNECTOR_PACKAGES = [
  createConfluencePackage(CONFLUENCE_SERVERS),
  createUsageConnectorPackage(USAGE_CONNECTORS)
] satisfies readonly ConnectorPackage[]
```

사내 SSO 는 별도다 — [`../methods/sso.ts`](../methods/sso.ts) **한 파일**에 주소를 채우면
브라우저 세션 방식이 내장 목록에 들어가고, 대상은 `acceptedMethods` 에 그 id 를 적는다.

**동봉된 패키지**: [`confluence/`](confluence/AGENTS.md) — Confluence Data Center ·
[`usage/`](usage/AGENTS.md) — 범용 usage connector(설정 하나가 서버 하나).
**서버 목록의 정본은 각 모듈의 `servers.ts`** 다 — 배포는 그 파일만 고친다. 신규 설치의 기본값은
빈 배열이라 connector 0개로 부팅한다.

## 인증 4종 ↔ 사용처 3종 (사용자 정리 2026-08-06)

배포가 실제로 쓰는 것은 아래가 전부다. **표에 없는 조합을 만들기 전에 사용자에게 확인한다** —
인증 방식은 늘리기 쉽고, 늘어난 뒤에는 무엇이 실제로 쓰이는지 아무도 모른다(0178 이 걷어낸
1,603줄이 정확히 그렇게 쌓였다).

**인증 방식 4종** — `methods/index.ts` 의 내장 목록:

| 방식 | id | 앱 로그인 게이트 |
|---|---|---|
| SSO (ADFS) | `methods/sso.ts` 에 적은 id | **켠다** (유일) |
| ID/비밀번호 | `credential-basic` | 안 켠다 |
| PAT | `credential-pat` | 안 켠다 |
| 인증 토큰 | `credential-auth-token` | 안 켠다 |

**사용처 3종** — 각각이 어느 인증 위에 서는가:

| 사용처 | 인증 | 소비 경로 | 소유 |
|---|---|---|---|
| 컨플루언스 검색 | ID/비밀번호 · PAT | 내장 도구 → `ctx.request` → REST | **저장소 동봉** (`confluence/`) |
| LLM 모델 토큰 발급 | SSO → **세션 쿠키** | `ctx.request` → REST | **폐쇄망 구현자** — 코어는 진입점만 준다 |
| 비용 추적 | SSO → **code → token** | `ctx.request` → REST | **폐쇄망 구현자** — 코어는 진입점만 준다 |

**사용자 결정 (2026-08-06)**: 뒤 둘은 실제 폐쇄망 환경에서 구현자가 확장한다. 코어는 **기본 함수와
진입점만** 제공하고 사내 주소·응답 형태를 추측하지 않는다.

> **세션 쿠키와 code→token 은 다른 흐름이다.** 앞은 브라우저 세션을 그대로 실어 보내고(값 주입
> 없음, `browserSessions.send`), 뒤는 SSO 로 authorization code 를 받아 토큰으로 **교환**한 뒤
> 그 토큰을 vault 에 봉인해 헤더에 싣는다(`ctx.fetch` → `ctx.vault.set`). 반출 성질도 갈린다 —
> 쿠키는 값이 아니라 MCP 로 나가지 않고, 교환 토큰은 값이라 나간다.

### 진입점으로 붙이는 법 — `sso → code → token`

인증 방식 하나를 `methods/<회사>/` 에 두고 `AUTH_METHODS` 에 한 줄 더하면 끝난다. **코어는 고치지
않는다** — 아래 골격이 `extension-points.test.ts` 에서 실제로 돌아가는 형태 그대로다.

```ts
async authenticate(ctx) {
  const handleId = await ctx.browserSessions.acquire('corp')
  const { finalUrl } = await ctx.browserSessions.openLoginWindow(handleId, {
    url: `${SSO}/authorize`, isDone: (url) => url.includes('code=')
  })
  const code = new URL(finalUrl).searchParams.get('code')
  if (code === null) return { kind: 'failed', reason: 'invalid_credentials' }

  const res = await ctx.fetch(`${API}/oauth/token`, {   // ← 교환. 선언한 origin 으로만 나간다
    method: 'POST', body: JSON.stringify({ code })
  })
  const { access_token, expires_in } = await res.json()

  ctx.vault.set('secret', access_token, { kind: 'auth_token', createdAt: ctx.clock() })
  return { kind: 'authenticated', record: {
    mechanism: 'auth_token',
    artifact: { kind: 'vault_credential', handleId: 'secret', credentialKind: 'auth_token' },
    expiresAt: ctx.clock() + expires_in * 1000        // ← status() 가 이 값으로 판정한다
  }}
}
```

- **`allowedOrigins` 에 로그인 origin 과 교환 창구 origin 을 둘 다 적는다.** 미선언 origin 은
  `ctx.fetch` 가 요청 자체를 만들지 않는다 — 자격증명이 그리로 나가지 않는다.
- **만료는 `expiresAt` + `status()` 로 표현한다.** 코어의 `revalidate` 가 그 판정을 레코드에
  반영하고 화면까지 알린다(0178 3b) — 만료를 쫓는 코드를 구현자가 또 쓰지 않는다.
- **교환 실패는 `failed` 로 돌려준다.** 레코드가 만들어지지 않고, 보류 자원은 코어가 정리한다.
- 대상(`modules/<회사>/`)은 `acceptedMethods: ['<그 방식 id>']` 와 `presentation`(보통
  `Authorization: Bearer`)만 선언하면 된다.

### 진입점으로 붙이는 법 — `sso → 세션 쿠키`

교환이 없다. 로그인으로 만든 레코드의 artifact 가 `browser_session` 이면 코어가 **값을 주입하지
않고** 그 세션의 cookie jar 로 보낸다. 구현자가 쓸 것은 `browserSessions.acquire` ·
`openLoginWindow` · `probe` 셋뿐이고, 요청은 대상 선언만 있으면 `ctx.request` 로 나간다.

## 형태 강제는 타입 시스템이 한다 (0178)

`satisfies` 가 컴파일 타임에 형태를 확정한다. 그래서 **manifest 도,
`apiVersion` ABI 도, 선언↔구현 대조도, conformance 하네스도 없다** — 전부 타입이 이미 참으로
만든 명제를 런타임에 재확인하던 것이라 0178 에서 걷어냈다(선언을 두 벌 적게 만들던 `declare.ts`
파생 helper 도 함께 사라졌다).

런타임에 남는 판정은 **타입으로 표현할 수 없는 둘**뿐이다 — 중복 id 거부, origin 형태 검사.
근거는 [`../registry.ts`](../registry.ts) 헤더.

> **앱 로그인 게이트는 인증 방식이 켠다.** `required` 는 `methodsForTarget('application').length > 0`
> 이고, prod `RootGate` 는 그 값으로 앱 전체를 막는다(DEV 는 bypass 라 개발 중에는 안 보인다).
> 내장 자격증명 2종은 `targets: ['connector']` 라 게이트를 켜지 않는다 — 게이트를 켜는 것은
> `methods/sso.ts` 를 채웠을 때의 브라우저 세션 방식뿐이다(0164 verify D1 의 재발 방지).

> **`targets: ['application']` 선언은 곧 "로그인 체인 멤버"다** (0172). 같은 `groupId` 의
> application 방식이 둘 이상이면 그것들은 **하나의 논리 로그인**이 된다 — **등록 배열 순서**대로
> 실행되고, **전부 성공해야** `authenticated:true` 이며, 하나라도 실패하면 로그인 전체가 실패하고
> 그때까지 만들어진 보류 자원(vault secret·browser session)이 정리된다.
> "둘 중 아무거나로 로그인" 을 표현하려면 **그룹을 나눈다**.

## 패키지 공용 헬퍼 — 복사하지 말고 import 한다

| 파일 | 쓰임 |
|---|---|
| [`base-path.ts`](base-path.ts) | `normalizeBasePath` — 컨텍스트 경로(`/confluence`·`/api`)의 선두·꼬리 슬래시 정규화. |

## 규칙

- **대상 하나 = 서버 하나 = 고정 origin = 활성 연결 하나.** 주소는 코드 레벨(`servers.ts`)에서
  온다 — UI 추가 경로는 0178 에서 제거했다.
- **호출 표면은 `ctx.request({ target, … })` 하나다.** 대상 이름 하나만 알면 되고 `bindingId` 를
  들고 다니지 않는다 — 인증 레코드를 찾아 헤더·쿠키를 붙이는 일은 `InternalApi` 구현이 한다.
- **`id` 는 한 번 정하면 유지한다.** 도구 이름(`mcp__<server>__<tool>`)·승인 키·다운로드 경로가
  여기서 파생되고, 그 값들은 대화 기록과 승인 이력에 남는다. 주소가 바뀌면 `baseUrl` 만 고친다.
- **받아들일 인증 방식은 `acceptedMethods` 로 선언한다** — 내장 id(`credential-pat`·
  `credential-basic`) 또는 `methods/sso.ts` 에 적은 SSO id. 존재하지 않는 id 를 적으면 등록의
  교차 참조 검사가 잡는다.
- **인증 방식이 둘 이상이면 `presentations` 로 mechanism 별 표현을 선언한다.** `presentation` 하나로는
  PAT(Bearer)와 ID/비밀번호(Basic)를 함께 표현할 수 없다. 선언하지 않은 mechanism 은 기본
  `presentation` 으로 되돌아간다. ID/비밀번호는 `scheme:'BasicPair'`(secret 자체가 `user:pass`) —
  `'Basic'` 은 사용자명이 빈 값인 PAT-as-password 형식이라 다르다.
- **바이너리를 받으려면 `responseType:'binary'` 를 선언한다.** 미지정은 `'text'` 이고 그 경로는
  `res.text()` 라 이미지·PDF 가 손상된다. `maxBytes` 로 상한을 함께 건다.
- **도구 handler 는 `RuntimeToolResult`(MCP 형상 — `{ content: [{ type:'text', text }], isError? }`)를
  반환한다.** `ctx.invoke` 가 준 `ConnectorResult` 를 그대로 반환하지 마라 — `content` 가 없으면
  모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로 뒤집힌다.
- 연결이 끊긴 뒤의 `ctx.invoke` 는 **던진다.** 잡아서 성공으로 바꾸지 마라 — SDK 가 `isError` 로 변환한다.
- **빌드 타임 코드다.** 런타임 동적 로딩(임의 경로 `require()`/`import()`)은 금지 — 근거는
  `contracts/auth-method.ts` 헤더. "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
- **secret 은 `ctx.vault` 에만.** binding 결과·로그·renderer 응답에 값을 싣지 않는다.
- **선언한 origin 밖으로 못 나간다.** `allowedOrigins` 미선언 origin 요청·redirect 는 거부된다.
- **등록 실패는 화면에 뜬다.** 등록은 패키지 단위 **all-or-nothing** 이라 `baseUrl` 하나가 경로를
  달고 있으면 그 패키지의 대상이 **전부** 사라진다. 사유는 `orca:plugin:diagnostics`
  로 나가 플러그인 탭 배너에 뜬다 — 조용히 없어지지 않는다.

## 게이트

`cd app && npm run lint && npm run typecheck`.

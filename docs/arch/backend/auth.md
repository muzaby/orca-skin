# Auth · Gate · Harness · Plugin — 구조 정본

> 인증 스택과 그 **소비 경계**의 구조 정본. 무엇이 인증을 소유하고, 인증 이후의 실행 구성·도구·
> 사용량은 누가 소유하며, 그 사이를 무엇이 잇는가를 한 문서에서 다룬다.
>
> - **구조 서술은 여기, 실행 절차는 [`guides/closed-network-extensions.md`](../../guides/closed-network-extensions.md)** (폐쇄망 배포자용 단계별 안내).
> - 채널 계약은 [`IPC_CONTRACT.md`](../../IPC_CONTRACT.md), 자격증명 경계는 [`security.md`](./security.md), 용어는 [`GLOSSARY.md`](../../GLOSSARY.md).
> - **계약 정본은 코드다** — `app/src/main/contracts/auth.ts`. 이 문서와 어긋나면 코드가 진실이다.
> - Decision rationale: [ADR-004](../../decisions/004-provider-single-axis.md) — 왜 프로토콜이 아니라 관계를 축으로 삼았는가.

---

## 1. 하나의 문장

**Auth 는 인증하고 인증된 능력만 제공한다. Harness·Plugin·Usage 는 자기 API 와 반환값을 직접
해석한다. Bootstrap 은 구체 구현을 연결하되 제품 기능을 대신 구현하지 않는다.**

이 세 문장이 아래 모든 경계의 근거다.

---

## 2. 책임 지도

```text
AuthRuntime  (features/auth)
  ├─ 로그인 · 재인증 · 해제
  ├─ Grant · vault · cookie jar
  ├─ 인증된 요청 (origin·redirect·예약 header·응답 크기 정책)
  └─ secret 없는 상태 설명과 변화 통지

AuthSecretReader  (trusted main 전용)
  └─ MCP binding · Harness direct-credential 에 한한 raw 조회

Gate  (features/gate)
  └─ 필수 Auth 의 valid + verified 만 소비하는 앱 접근 정책

소비 feature
  ├─ Harness (features/harnesses) : settings 열거·해석 · Model 해석 · 실행 구성 · respawn 경계
  ├─ Plugin  (features/plugins/*) : REST · 변환 · Runtime Tool 구성
  └─ Usage   (features/usage)     : UsageSnapshot 의 의미와 합성

app/deployment/*  : 배포별 concrete (build-time TypeScript)
app/connection-views.ts : Auth descriptor/snapshot → 기존 GUI DTO
Bootstrap        : 위 객체를 생성하고 좁은 포트로 연결만 함
```

### 2.1 Auth 계약에 없는 것

`AuthDefinition` 에는 **`kind`·`tools`·`llm`·`usage`·`envKey` 가 없다.** 이 선언을 읽고 "이 Auth 가
무엇에 쓰이는가" 를 알 수 없는 것이 정상이다.

| 없어진 슬롯 | 지금 누가 아는가 |
|---|---|
| `kind: 'gate'\|'llm'\|'service'` | `app/deployment/gate-auth.ts` 가 gate membership 을 **객체 참조**로 갖는다 |
| `llm: { adapter, provider, envKey }` | `features/harnesses/runtime-config.ts` + `app/deployment/harness-runtime.ts` |
| `tools: (ctx) => RuntimeToolServer` | Plugin 모듈이 자기 도구를 만들고 `app/deployment/plugins.ts` 가 등록/회수한다 |
| `ProviderApi.materialize()` | 없앴다 — 일반 소비는 `BoundAuth.request()`, raw 는 `AuthSecretReader` |

**왜 없애야 했나**: 인증 코어가 소비자의 제품 분류와 subprocess 환경변수 형상을 알면, 소비 기능이
하나 늘 때마다 인증 계약이 자란다. 그리고 `envKey` 는 credential **한 값**만 표현해서, "OAuth 로
config API 를 불러 URL·모델 식별자·실행 token 을 한꺼번에 받는" 폐쇄망 요구를 담지 못했다.

---

## 3. 모듈 지도

| 경로 | 책임 |
|---|---|
| `contracts/auth.ts` | 타입 계약 — `AuthDefinition`·`AuthMethod`·`AuthProbe`·`Grant`·`AuthenticatedRequest/Response`·`AuthSnapshot`·`AuthChange`·`BoundAuth`·`AuthRuntime`·`AuthSecretReader` |
| `adapters/harness-config.ts` | 실행 구성 계약 + spawn 입력 조립 — `options.settings` / `options.env` 두 채널과 env fingerprint(`PreparedHarnessConfig`). feature 가 아니라 어댑터 포트다 |
| `features/auth/runtime.ts` | `createAuthRuntime()` — registry·store·요청·로그인을 묶고 `{ runtime, secretReader }` 반환 |
| `features/auth/registry.ts` | 빌드타임 선언 검사 (중복 id · bare origin). **gate probe 검사는 여기 없다** |
| `features/auth/store.ts` | `authId → Grant` 단일 맵 + `verified` + `credentialRevision` + 만료 정착 집합 |
| `features/auth/authenticated-request.ts` | 정책 → credential 주입 → 전송 → redirect 재검사 → 강등(401/403 · 세션의 origin 미복귀) |
| `features/auth/secret-access.ts` | trusted-main raw 조회 (동기) |
| `features/auth/login.ts` | `AuthMethod` 분기 실행 · 후보 probe → 성공 시 1회 커밋 · 단일 Auth `resume` |
| `features/auth/browser-session/runner.ts` | 브라우저 세션 로그인 흐름 (창 → final URL 의 인가 코드 → 토큰 교환 · whoami) |
| `features/auth/specs/` | 선언 헬퍼(값 입력형) + 브라우저 세션 포트·응답 해석 |
| `features/gate/index.ts` | `evaluateGate`(순수 진리표) · `createGate` · `selectGateMembers`(fail-closed) |
| `features/harnesses/settings-entries.ts` | `sources/settings/<harness>/<modelProvider>/` 열거 |
| `features/harnesses/settings.ts` | native settings 해석 + mtime cache + `sourceRevision` |
| `features/harnesses/runtime-config.ts` | 동적 실행 구성 — augmenter · 세대 cache · fence · single-flight · expiry |
| `features/harnesses/runtime-boundary.ts` | respawn 경계 판정(순수) |
| `features/plugins/confluence/` | Confluence REST · Markdown 변환 · 첨부 · Runtime Tool |
| `app/deployment/` | 배포별 concrete — `auth-definitions`·`gate-auth`·`harness-runtime`·`plugins`·`connections`·`usage-fetcher` |
| `app/connection-views.ts` | view source → 기존 `ProviderInfo`/`ProviderPlatformState` |
| `app/auth-resume.ts` | 부팅 복원 순서(게이트 우선 → 나머지 병렬 → push 1회) |

`app/deployment/` 는 **런타임 동적 plugin 디렉터리가 아니다.** 배포별 TypeScript 가 compile time 에
조립되는 컴포지션 루트의 일부다. 런타임 동적 코드 로딩은 없다.

**배포 factory 는 인자를 받고, 그 인자는 필요한 능력만 담는다.** `createPluginBindings(deps)`·
`createConfigApiAugmenters(deps)`·`createDirectCredentialAugmenters(deps)`·`createUsageFetcher(deps)`·
`createConnectionSources(deps)` 는 `bootstrap.ts` 가 조립한 능력(`AuthBinder`·`RuntimeToolSink`·
AuthId 를 닫은 secret closure·gate 멤버·plugin 바인딩)을 받아 쓴다. **`AuthBinder` 는
`Pick<AuthRuntime,'bind'>` 다** — 배포는 자기 AuthId 를 골라 `BoundAuth.request` 를 쓸 뿐,
`login`·`continue`·`reauth`·`revoke`·`resume`·`subscribe` 에는 도달하지 못한다(컴파일 강제).
인증 lifecycle 은 IPC 핸들러와 부팅 복원이 소유한다. **Harness 의 두 방식은 deps 가
갈라져 있다** — config API 는 `auth` 만, direct credential 은 **배포가 `DIRECT_CREDENTIAL_AUTH_IDS`
에 선언한 id 로 미리 닫힌 closure map**(`secrets`)만 받아, 한 factory 가 API 접근 권한과 raw secret
을 동시에 쥘 수 없고 선언하지 않은 Auth 의 secret 에는 도달할 수도 없다. 두 방식이 같은 Harness
key 를 보강하면 합류점이 **throw** 한다. 인자 없는 factory 로 두면 배포가 자기 선언을 채울 때 범용 `bootstrap.ts` 를 고쳐야 하고,
"배포가 손대는 파일은 `app/deployment/` 묶음뿐" 이라는 이 디렉토리의 존재 이유가 무너진다.
기본 배포는 선언이 비어 있어 이 경로가 CI 에서 한 번도 실행되지 않으므로,
`deployment-wiring.test.ts` 가 **비어 있지 않은 가상 배포**로 Bootstrap→Plugin/Harness/Usage/
카탈로그를 끝까지 태운다.

---

## 4. 상태와 변화

### 4.1 `AuthSnapshot`

| 필드 | 의미 |
|---|---|
| `status` | `none \| valid \| expired \| unknown` — wire 호환 어휘 |
| `verified` | **이번 실행에서 실제로 확인됐는가.** 복원된 grant 는 `valid` 지만 `verified:false` 다 |
| `credentialRevision` | 실행 credential 이 **실제로 바뀐** 횟수. 메모리 단조, 영속하지 않는다 |
| `activeMethod` · `principalId` · `expiresAt` | 표시용. secret 은 없다 |

`verified` 를 두는 이유: grant 는 디스크에서 복원되는 *기록*이고, `kind:'session'` grant 는 vault 도
만료도 없이 기록만으로 `valid` 가 된다. 그것만 보던 동안 한 번 로그인에 성공한 id 는 영구히 통과
상태가 됐다 — 쿠키가 죽어도 마찬가지라 사실상 우회 토글을 켠 것과 같았다. **디스크에 남기는 순간
그 영구 bypass 가 돌아온다.**

### 4.2 `AuthChange` — 화면 갱신과 실행 무효화를 뭉개지 않는다

| Auth 변화 | GUI push | Gate 재평가 | Plugin tool sync | Harness invalidate |
|---|---:|---:|---:|---:|
| 입력 form · OAuth code 대기 · `resuming` · 오류 message | O | O | **X** | **X** |
| 기존 Grant 의 probe 성공으로 `verified` 만 변경 | O | O | **X** | **X** |
| credential commit · revoke · expiry · 401/403 강등 | O | O | O | **영향 key 만** O |

`kind:'step'` 은 화면 단계, `kind:'snapshot'` 은 인증 상태다. snapshot 은 `cause` 와
**`credentialChanged`** 를 함께 싣고, 소비자는 그 boolean 하나만 본다 — `cause → boolean` 기본
매핑은 `features/auth/runtime.ts` 한 곳에 있다.

**`cause` 가 답을 못 내는 경우가 하나 있다**: 같은 강등을 두 지점이 관측할 때다(§4.4). 그때는
전이를 관측한 호출부가 `credentialChanged` 를 명시로 싣고, `cause` 매핑은 기본값으로만 쓰인다 —
`cause` 는 *무엇을 봤는가* 이고 `credentialChanged` 는 *실행 credential 이 실제로 달라졌는가* 라서,
둘이 항상 같은 값이 아니다.

이 구분이 없으면 소비자는 두 가지 중 하나로 몰린다: 매 change 마다 무효화하거나(불필요한
network·respawn), 아무것도 안 하거나(stale token 사용).

### 4.3 재인증은 확인이 끝나야 무언가를 바꾼다

`reauth` 는 기존 grant 를 먼저 지우지 않는다. 더 강하게, **확인이 끝날 때까지 아무것도 쓰지
않는다** — 후보 자격증명은 `CandidateCredential` 로 probe 요청에만 실리고 store·vault 는 그것을
모른다. 성공하면 vault 쓰기 → `store.put` 이 한 번에 일어나고, 실패하면 되돌릴 것이 없다.

되돌림(rollback)이 아니라 **미커밋**인 이유는 되돌림이 원리적으로 닫히지 않기 때문이다.

| 커밋-후-되돌림이 못 막는 것 | 미커밋에서 사라지는 이유 |
|---|---|
| probe 왕복 동안 검증 안 된 secret·revision 이 전역 노출 | 전역에 올라간 적이 없다 |
| 후보의 401 이 낸 강등 이벤트 — 상태는 되돌려도 **이벤트는 취소되지 않아** Plugin 도구가 회수된 채로 남는다 | 후보 요청은 강등하지 않는다 |
| 되돌림 좌표에서 빠진 상태(예: 만료 정착 집합)가 남아 이후 전이를 건너뛴다 | 좌표 자체가 없다 |
| probe 중 앱 종료 → vault 에 후보 값 잔존 | vault 는 성공 후에만 쓴다 |

**실패한 재인증은 실행 credential 을 바꾸지 않았으므로 Harness cache 를 무효화할 이유도 없다** —
이제 그것이 규칙이 아니라 구조다.

#### 커밋은 자기 시도가 아직 최신일 때만 일어난다

미커밋이어도 **커밋 시점**은 여전히 `await` 뒤다. 그 사이 사용자가 폼을 다시 내거나 연결을
해제할 수 있으므로, `LoginService` 는 Auth 마다 **시도 세대**를 두고 커밋 직전에 확인한다.
로그인 진입(`begin`·`reauth`·`continue`)과 `revoke` 가 세대를 올린다.

| 상황 | 세대 fence 가 없으면 | 있으면 |
|---|---|---|
| 폼을 두 번 제출 | 늦게 끝난 옛 후보가 새 후보를 덮는다 | 옛 후보의 커밋이 버려진다 |
| probe 중 [연결 해제] | 해제한 Auth 가 커밋으로 되살아난다 | 커밋이 버려져 해제 상태가 유지된다 |

**결과는 3분기다** — `settled` · `rejected` · `superseded`. `rejected`(서버가 후보를 거부)와
`superseded`(그 사이 다른 시도가 시작됨)를 하나로 합치면, 호출부가 거부 폼을 다시 열어 **이미
성공한 새 로그인이나 해제 직후 화면을 늦게 끝난 옛 시도가 덮어쓴다**. superseded 는 pending·step·
이벤트를 **아무것도 건드리지 않는다.**

**세대 확인은 결과 해석보다 먼저다.** 성공 분기에서만 확인하면 늦게 끝난 옛 시도의 401 이 그대로
거부 폼을 열어, 해제 직후에도 `status=none` 인데 `input-required` 인 모순이 생긴다. 확인 지점은
`await` 가 있는 모든 자리다:

| 자리 | 확인하는 것 |
|---|---|
| probe 왕복 뒤 (`settleGrant`) | 성공·실패 **양쪽** 해석 전에 |
| 실행기 왕복 뒤 (`absorb`) | OAuth `begin`/`complete`·브라우저 세션 `login` 의 `code-required`·`failed` 포함 |
| 부팅 복원 probe 뒤 (`resume`) | 새 시도를 **열지 않고** 현재 세대만 비교한다 — 복원이 사용자의 로그인을 무효화하면 안 된다 |
| 요청 실패 강등 (`markExpired(authId, observedRevision)`) | 서버의 거부는 **요청을 보낸 그 세대**에 대한 판정이다. 요청이 도는 사이 재인증됐다면 새 값을 내리는 근거가 못 된다 |

Renderer 도 같은 순서를 지킨다(`useProviders`) — invoke 응답은 probe 왕복만큼 늦게 오므로,
자기보다 뒤에 시작된 요청이 있으면 그 응답을 버린다. **다만 renderer 가드는 invoke 응답만 막는다** —
Main 이 이미 발행한 push 는 막지 못하므로 위 네 지점이 본체다.

**`credentialRevision` 은 fence 에 넣지 않는다.** 넣으면 probe 도중 401 강등이 일어난 재인증이
커밋되지 못한다 — 그 강등이야말로 재인증을 하는 이유다. 세대는 "이 로그인이 아직 사용자가
원하는 그 로그인인가" 만 묻는다.

#### 자격증명 교체는 덮어쓰기가 아니라 포인터 교체다

**vault 와 grant 는 서로 다른 저장소이고 둘을 원자적으로 함께 쓸 방법이 없다.** 고정 키를
덮어쓰는 설계는 그래서 어떻게 배열해도 창이 남는다 — 먼저 쓴 쪽이 성공하고 나중 쪽이 실패하면
"vault=새 값 / grant=옛 값" 또는 그 반대가 된다.

그래서 **새 자격증명은 항상 새 키에 쓰고, grant 를 저장하는 것이 곧 커밋**이다.

```text
vault.set(새 세대 키…)   실패 → 방금 쓴 키를 지운다 → 옛 키 그대로, 로그인 실패
store.put(새 grant)      persistence.save() 먼저, 메모리·revision publish 는 그 다음
  · durable === true   → 옛 세대 키를 지운다
  · durable === false  → 옛 세대 키를 **남긴다** (아래)
```

- 키 형식은 `provider:<authId>:<authKind>@<세대>` 다. 세대는 로그인마다 새로 뽑는다.
- **기존 설치와 호환된다** — `Grant.vaultKey` 가 포인터이므로 세대 없는 옛 키를 가리키는 grant 도
  그대로 읽힌다. 재인증할 때 세대 키로 옮겨간다.
- access + refresh 처럼 키가 둘이어도 **둘 다 아직 아무도 안 보는 자리**에 쓴다. 한쪽이 실패하면
  grant 는 옛 쌍을 계속 가리키므로 `new-access + old-refresh` 같은 혼합이 만들어질 자리가 없다.
- 실패·크래시 지점이 어디든 관측 가능한 상태는 **옛 grant→옛 키** 또는 **새 grant→새 키** 둘
  중 하나다. 어느 쪽도 쓰이지 않는 키는 다음 부팅의 sweep 이 치운다(`AuthStore.restore()` — 기준은
  선언이 아니라 **영속된 grant 전체**다. 선언에서 잠시 빠진 Auth 의 값을 지우지 않기 위함이다).
- `put()` 이 영속을 먼저 하는 이유: 반대로 하면 저장 실패 시 메모리에는 새 secret 과 올라간
  revision 이 남는데 디스크에는 없고, 예외 때문에 snapshot 도 나가지 않는다 — 재시작하면 사라질
  상태를 화면과 Harness cache 가 믿는다.

#### 영속 실패는 삼키지 않고 **보고**하고, 정책은 연산이 정한다

`GrantPersistencePort.save()` 는 **내구 저장 성공 여부를 돌려준다.** 예전에는 production adapter 가
디스크 쓰기 오류를 삼키고 `void` 를 반환해, 호출부의 `catch` 가 실제 실패를 한 번도 보지 못했다.

파일을 못 열거나 쓰기가 거부되면 이 프로세스는 메모리 사본으로 계속 동작한다(키체인이 잠긴
머신에서 앱이 죽으면 안 된다). **그 상태를 "영속 성공" 으로 접지 않는다.** 구현이 던져도 되고,
`AuthStore` 가 그것을 `false` 로 정규화한다 — **호출부가 보는 신호는 boolean 하나뿐이다.**

무엇을 할지는 실패 신호가 아니라 **연산**이 정한다:

| 연산 | 정책 | 이유 |
|---|---|---|
| 추가·교체 (`put`) | **degrade-open** — 이번 프로세스는 새 값으로 동작하고 **옛 세대 키를 남긴다** | 재시작하면 직전 정상 상태로 돌아갈 뿐이라 잃는 것이 없다. 옛 키를 지우면 돌아온 옛 grant 가 아무것도 가리키지 않는다 |
| 해제 (`revoke`) | **fail-closed** — 아무것도 바꾸지 않고 **실패시킨다** | 진행하면 secret 은 지워지는데 디스크의 grant 는 남는다. session grant 는 vault 값도 없어 **아무것도 사라지지 않은 채** 화면만 '해제됨' 이 되고, 재시작하면 cookie 가 살아 있어 probe 가 통과 — **사용자가 끊은 연결이 되살아난다** |

두 신호(throw/`false`)에 서로 다른 정책을 붙이면 같은 조건이 두 갈래로 처리된다. 갈라지는 축은
**무엇을 하려 했는가**여야 한다.

#### 해제는 cookie jar 까지 비운다

session grant 를 지우는 것만으로는 **서버 쪽 로그인이 그대로 살아 있다.** 해제가 내구적으로
성립한 뒤 `BrowserSessionPort.clear()` 로 해당 origin 의 쿠키를 비운다(best-effort — 해제 자체는
이미 성립했으므로 되돌리지 않는다). scope 는 `'origin'` 이다: 한 연결을 끊었다고 공유
`sessionGroup` 을 통째로 비우면 같은 그룹의 다른 연결까지 끊긴다.

#### 부팅 sweep 은 "전부 안다" 를 확인하고 돈다

`load()` 는 `{ records, authoritative }` 를 돌려준다. `authoritative` 는 **저장소를 열고 끝까지
읽었는가**이며, 레코드를 하나라도 형상 오류로 버렸으면 `false` 다(버린 레코드의 `vaultKey` 를
읽을 수 없으므로 "영속된 grant 전체" 를 안다고 말할 수 없다).

**`false` 면 sweep 을 건너뛴다.** 이 구분이 없으면 grant 파일 하나가 손상됐을 때 빈 맵이
"영속된 grant 가 없다" 로 읽혀, 멀쩡한 secret 파일의 자격증명이 **부팅 한 번에 전부 삭제된다.**
고아 정리는 미뤄도 되는 위생 작업이고, 잘못 지운 secret 은 복구되지 않는다.

### 4.4 만료는 관측 지점에서 한 번 전이한다

`status()` 는 순수 조회라 `expiresAt <= now` 를 매번 다시 계산할 뿐 상태를 정착시키지 않는다.
`AuthStore.settleExpiry()` 가 **snapshot·request·resume 이 이미 지나는 자리에서** 그 전이를 한 번
확정하고, runtime 이 그때만 `cause:'expired'` change 를 낸다. **polling 을 새로 만들지 않는다.**

1회성의 기준은 **정착 집합 하나**다 — `settleExpiry()` 와 `markExpired()` 가 같은 집합을 본다.
`expiresAt <= now` 비교를 중복 판정에 쓰면 **요청이 도는 동안 시계가 지나 만료된** 경우가 통째로
빠진다: 요청 시작 때는 valid 라 `settleExpiry` 가 그냥 지나갔고, 401 이 왔을 때는 이미
`expiresAt <= now` 라 "이미 정착됨" 으로 접혀, 전이가 다음 `snapshot()` 까지 미뤄진다.

1회성은 `markExpired()` 의 조기 반환이 아니라 **별도 정착 집합**이 보장한다. 조기 반환에 기대면
`verified` 만 풀리고 `credentialRevision` 은 그대로여서 `credentialChanged:true` 인데 세대는 안 오른
change 가 나간다 — Harness cache 가 그 change 를 무시한다. 정착 집합은 grant 가 교체(`put`)·
해제(`revoke`)·복원(`restore`)되면 비워지므로, 재인증 후 다시 만료되면 전이가 정상적으로 한 번 더
일어난다.

### 4.5 강등 통지는 전이를 따른다 — 관측 횟수가 아니라

만료 **전**의 강등(요청 실패, probe 실패)도 같은 문제를 갖는다. 한 번의 강등을 두 지점이 볼 수
있기 때문이다 — 요청 경로가 실패를 보고 강등한 뒤 `resume()` 이 그 실패를 다시 강등으로 처리하거나,
동시에 떠 있던 두 요청이 각각 401 을 받는 경우다.

그래서 **`AuthStore.markExpired()` 가 "이번 호출이 전이를 만들었는가" 를 돌려주고, 통지가 그 값을
따른다**:

`markExpired()` 는 두 축을 따로 돌려준다.

| 반환 | 뜻 | 소비 |
|---|---|---|
| `credentialChanged` | 실행 credential 이 달라졌다(revision 이 올랐다) | Harness cache 무효화 · Plugin 도구 재sync |
| `snapshotChanged` | 밖에서 보이는 상태가 하나라도 달라졌다(`verified` 만 풀린 경우 포함) | GUI 방송 |

| 관측 지점 | 전이를 만들었을 때 | 전이가 없을 때 |
|---|---|---|
| 요청 경로 (401/403 · 세션 grant 의 origin 미복귀) | `cause:'unauthorized'` · `credentialChanged:true` | `snapshotChanged` 면 `credentialChanged:false` 로 통지, **둘 다 false 면 방송하지 않는다** |
| `resume()` probe 실패 | `cause:'expired'` · `credentialChanged:true` | **통지하지 않는다** (요청 경로가 이미 냈다) |

**요청 경로가 강등하는 조건은 둘이다.** 401/403 은 서버가 자격증명을 명시적으로 거부한 것이고,
**세션 grant 의 origin 미복귀**는 SSO 가 미인증을 200 으로 말하는 형태다 — 세션이 죽으면 IdP
로그인 폼이 200 으로 오므로 status 만 보면 그 200 을 성공으로 읽고, 세션 Auth 가 영원히 `valid` 인
채 모든 요청이 로그인 폼을 받는다(§4.6). 판정은 `probeOk` 와 **같은 구현**(`isAllowedOrigin`)을
쓴다 — 두 벌이면 하필 "인증됐는가" 가 갈린다. 값형 grant 에는 적용하지 않는다: 그쪽 체인은
`definition.origin` 하나로 묶여 있어 밖에서 끝날 수 없다.

두 축을 가른 이유: `markExpired()` 는 전이가 없어도 `verified` 는 푼다 — 그때는 화면만 갱신하면
된다. 반대로 **아무것도 안 바뀐** 호출(동시 401 두 건 중 두 번째)은 방송할 것도 없다. boolean
하나로는 이 셋을 구분할 수 없다.

이 규칙이 없으면 실패 멤버 하나가 credential-effective change 를 두 번 내고, 두 번째는
`credentialRevision` 이 그대로여서 §4.4 가 시계 만료에서 막은 불일치가 그대로 재현된다. 부팅
방송 상한(§5.2)의 강등 항 `K` 도 함께 두 배가 된다.

### 4.6 browser-session 은 두 가지 grant 를 만든다

같은 방식(`kind:'browser-session'`)이 `config.exchange` 의 유무로 서로 다른 grant 를 낸다. 이것이
이 방식의 유일한 분기이고, 나머지 규칙은 전부 여기서 파생된다.

| `config.exchange` | grant | 자격증명을 나르는 것 | 만료를 관측하는 방법 |
|---|---|---|---|
| 미선언 | `kind:'session'` | cookie jar (partition) | 401/403 **또는 origin 미복귀**(§4.5) |
| 선언 | `kind:'token'` (`authKind:'browser-session'`) | `exchange.present` 로 실린 토큰 | 401/403 · 토큰이 선언한 시계 만료 |

**토큰의 출처는 교환 응답 JSON 하나다.** 로그인 창이 `doneUrlPrefix` 에 도달하면 그 final URL 에서
인가 코드를 꺼내(`exchange.code.urlParam`, 미지정이면 `'code'`) 같은 세션으로 교환한다 — 쿠키를 읽어
토큰을 만드는 경로는 없다(`features/auth/no-cookie-token.test.ts` 가 기계 강제). 코드를 돌려주지
않는 SP 는 `exchange` 자체를 선언하지 않고 세션 grant 로 끝낸다.

**교환 요청은 `POST` + `application/json` 하나다.** 전송 형상은 코어가 고정하고, 선언이 정하는
것은 이름뿐이다 — 코드를 final URL 어디서 꺼내(`code.urlParam`) 본문에 무슨 이름으로
(`code.bodyField`) 무엇과 함께(`code.extraFields`) 실을 것인가. 같은 이름이 겹치면 **실제 인가 코드가 이긴다**. 코드가
본문에만 실리므로 프록시·서버 액세스 로그에 인가 코드가 남을 경로가 없다. 폼 본문만 받는 SP 는
교환이 415/405 로 끝난다 — 그때는 선언이 아니라 코어를 넓힌다.

**전송은 `sessions.send()` 다** — 파티션·쿠키를 유지하는 유일한 경로다(`netFetch` 는 세션 인자 없이
나가고 `createSender` 는 `credentials:'omit'` 을 박는다). "쿠키에서 파싱하지 않는다" 는 토큰의
*출처* 에 대한 제약이지 *전송* 에 대한 제약이 아니다.

**`present` 는 필수다.** 이 파일의 "kind 에서 추론하지 않는다" 규칙(§2.1 의 계약 축)이
browser-session 에도 그대로 걸린다 — 빠지면 교환이 만든 token grant 를 어디에도 실을 수 없어
모든 요청이 `grant_not_valid` 로 죽고, `probe` 를 선언한 배포는 로그인 자체가 `probe_failed` 로
끝난다. 타입이 필수로 강제하므로 런타임에 그 상태가 만들어질 자리가 없다.

**refresh token 은 저장만 한다.** `exchange.refreshTokenPath` 를 선언하면 값이 vault 에 봉인되고
`Grant.refreshKey` 가 생기지만, 그것으로 갱신하지는 않는다 — §5.2 의 refresh 대상이 `authKind` 를
함께 보는 이유가 여기다.

---

## 5. 게이트

```
부팅 실패 → BootFailureFrame
부팅 미완료 → BootScreen
게이트 미판정(gate=null) → BootScreen        ← fail-closed
게이트 미통과 → GateFrame
통과 → AppLayout
```

| 판정 | 규칙 |
|---|---|
| **prod** · gate 선언 **0개** | **통과**(`required:false`) — OSS/기본 배포가 로그인 화면에 갇히지 않게 하는 안전장치 |
| **DEV** · 선언 **0개** | **차단**(`alwaysRequired`) — 폐쇄망 실값이 없어도 로그인 화면을 보고 고칠 수 있어야 한다. **탈출구는 우회 토글 하나뿐** |
| 선언 N · 전부 `valid` **+ `verified`** | 통과 |
| 선언 N · 하나라도 아님 | 차단 — 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다 |
| 선언 N · 복원됐지만 **미확인** | 차단 — 자동 로그인이 확인할 때까지 |
| **확인할 수 없는 gate 선언이 하나라도 있음** | 차단 — probe 가 없거나 등록에서 떨어진 정의(§5.1) |
| `Settings.authBypass` (**DEV 전용**) | 통과 + `bypassed:true`. prod 번들에서는 분기 자체가 사라진다 |
| **판정 전** | **통과시키지 않는다** |

> **게이트는 UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다.
>
> ⚠️ **DEV 를 prod 와 같은 규칙으로 두면 로그인 화면이 사라진다.** 기본 빌드는 gate 선언이 0개라
> *화면에 도달할 방법 자체가 없어진다*. `alwaysRequired` 는 **호출부(bootstrap)가
> `import.meta.env.DEV` 를 넣는다**; 순수 모듈이 빌드 모드를 직접 읽으면 테스트가 그것에 묶인다.
> 빈 멤버 배열에 `every` 를 그대로 쓰면 DEV 게이트가 즉시 열리므로 **멤버 수를 함께 본다**.

### 5.1 gate membership 의 이중 강제

**Auth 는 자신이 gate 에 쓰이는지 모른다.** 그 지식은 `app/deployment/gate-auth.ts` 하나에 있고,
강제는 두 겹이다:

1. **compile time** — 배열 원소 타입이 `GateAuthDefinition = AuthDefinition & { probe: AuthProbe }`.
2. **runtime** — `selectGateMembers()` 가 probe 없는 정의와 등록에서 떨어진 정의를 `blocked` 로
   가르고, 그 수가 0이 아니면 게이트를 **닫아 둔다**.

두 번째가 필요한 이유: 멤버에서 빼기만 하면 `members.length === 0` 이 되어 prod gate 가
`required:false` 로 **열린다**. 그것이 곧 "확인 없이 통과하는 게이트" 다.

### 5.2 부팅 복원 순서

```text
gate Auth 를 순차 확인 (resuming step 노출)
  → 통과하면 GUI 는 대기 화면으로 — 아래가 끝날 때까지 메인 셸을 띄우지 않는다
  → 나머지 Auth 중 status='valid' 인 것만 1회 병렬 확인 (step 미노출)
  → 확인할 후보가 있었으면 성공한 verified 변화를 마지막 full-state push 한 번으로 합친다
  → 성공한 verified Auth 는 UI 방송과 별도로 runtime model catalog 재조정에 연결한다
  → status='expired' 인 나머지 Auth 를 순차로 회복 — refresh 1회 → 실패면 재로그인
    (회복이 만든 change 도 아래 change 구독을 통해 방송된다)
  → 복원 종료를 알리는 push 1회 (대기 화면이 걷힌다)
```

**순서가 규칙인 이유**: 사내 서비스는 대개 게이트와 같은 cookie jar 를 쓴다(`sessionGroup` 공유).
로그인 전에 물으면 살아 있는 연결도 미인증으로 떨어지고, 한 번 강등되면 요청 정책이 막아 스스로
회복하지 못한다(회복은 재인증뿐).

**방송 상한**: 복원 절차가 **스스로 내는** push 는 `P + 1` 이다. `P` 는 **probe 후보가 있으면 1,
없으면 0** 이다 — batch push 는 후보가 있을 때만 나가고, 성공한 확인들은 그 한 번으로 합쳐진다.
`+1` 은 **복원 종료 push** 이고 시도가 0건이어도 붙는다 — 게이트가 열린 시점에 `resuming: true` 가
이미 나갔으므로 그것을 거둬야 한다.

**그 밖의 방송은 `AuthChange` 하나당 1회다** — 같은 push 클로저를 change 구독이 함께 쓴다. 실패
강등 `K` 가 여기이고 즉시 나간다(미루면 죽은 연결의 도구가 남은 probe 의 타임아웃만큼 화면에
남는다). **회복이 내는 change 도 같은 경로다** — refresh 가 성공하면 커밋과 종료 step 이, 재로그인이
돌면 그 흐름의 step 이 각각 방송된다. 그래서 **부팅 방송 총량은 상수가 아니다** — 조건 없이 셀 수
있는 것은 위 `P + 1` 뿐이다.

**강등된 나머지 Auth 의 자동 재로그인** (0193): probe 실패는 `expired` 강등으로 끝나고 요청 정책이
그 뒤를 막아 스스로 회복하지 못하는데, 나머지 Auth 는 대개 게이트와 cookie jar 를 공유하므로 그
자리에서 다시 로그인하면 살아나는 경우가 많다. 규칙은 넷이다:

| 축 | 규칙 | 이유 |
|---|---|---|
| 대상 | 그 시점 `status='expired'` 인 나머지 Auth 전부 — 방금 강등된 것과 **부팅 시점에 이미 만료였던 것** | 만료 grant 는 `status!=='valid'` 라 probe 후보에 들어오지 못한다. 후보 배열을 회복 대상으로 쓰면 앱이 꺼진 사이 만료된 경우가 통째로 빠진다 |
| 수단 | refresh 1회 → 실패·불가면 재로그인 | refresh 는 창을 열지 않아 성공하면 사용자가 아무것도 보지 못한다 |
| 재로그인 대상 | `methods` 의 첫 방식이 `browser-session`·`oauth` 인 것만 | 입력형은 입력 없이 부르면 네트워크를 타지 않고 전역 `input-required` step 만 남긴다 |
| refresh 대상 | grant 가 `token`+`refreshKey` 이고 `authKind='oauth'` 이며 선언이 `refresh` 를 구현한 것. **`methods[0]` 를 보지 않는다** | 재로그인 게이트가 입력형을 막는 이유(전역 입력 폼)가 refresh 에는 성립하지 않는다 — 창·폼·step 을 만들지 않는다 |
| refresh 에서 빠지는 것 | `authKind='browser-session'` 인 token grant — **`refreshKey` 가 있어도** 빠진다 | 세션 교환이 만든 토큰은 `oauth` 선언과 계보가 다르다. `refreshKey` 유무로만 판정하면 §4.6 의 `refreshTokenPath` 를 선언한 배포가 oauth 선언의 `refresh` 로 갱신돼 자격증명 계보가 섞인다 |
| 횟수 | Auth 당 최대 3회 | 로그인 자체가 probe 를 포함하므로 확인 왕복은 그만큼 늘어난다 |
| 계속 조건 | 확인 실패(`probe_failed`)만 다음 시도로 잇는다 | 취소·창 닫기·code 입력 대기는 사용자를 기다리는 상태다 — 닫은 창을 다시 열지 않는다 |
| 동시성 | probe 는 병렬, 재로그인은 **순차** | `browser-session` 은 실제로 보이는 창을 열어서 병렬이면 창이 동시에 여러 개 뜬다 |

refresh token 의 만료는 `Grant.refreshExpiresAt` 이 갖는다 — **없으면 "모른다" 지 "만료 없음" 이
아니라서** 일단 시도하고 실패로 판정한다. 값이 있고 지났으면 왕복 없이 바로 재로그인한다. 갱신된
토큰도 평소 로그인과 같은 커밋 경로를 탄다 — `probe` 를 통과해야 하고, access·refresh 를 둘 다 새
세대 키에 쓴 뒤 grant 저장이 곧 커밋이다.

**회전하지 않는 응답의 승계**: RFC 6749 §6 은 새 refresh token 발급을 선택으로 두므로, 응답에
refresh token 이 없으면 **보내던 값을 그대로 다음 세대 키에 옮겨 적는다** — "없음" 으로 커밋하면
갱신 한 번에 회복 능력을 잃고 두 번째 만료부터 로그인 창밖에 길이 없다. 만료도 함께 옮기되 응답이
새 만료를 줬으면 그것이 이긴다(회전 없이 만료만 늘리는 서버가 있다). **옛 키를 계속 가리키지 않는
이유**는 되돌리기다 — 커밋 실패 시 정리는 "새 자격증명이 이름 붙인 자리는 전부 버려도 된다" 를
전제하므로, 옛 키를 공유하면 그 정리가 살아 있는 grant 의 refresh 자리를 지운다. 이 승계는 **갱신
경로에만** 있다: 최초 로그인·재인증은 새 인가라 옛 refresh token 이 다른 계보다.

**갱신 커밋의 필드 규칙**: 갱신은 grant 를 응답에서 새로 조립하지 않고 **옛 grant 에 대한 delta**
로 만든다 — 응답이 말하지 않은 필드가 조용히 사라지지 않게 하기 위함이다. 규칙은 필드마다 하나다:
`principalId` 는 승계(계정 신원은 갱신으로 바뀌지 않는다) · `refreshToken`·`refreshExpiresAt` 은
위 승계 규칙 · **`expiresAt` 은 응답 전용**(강등이 옛 값을 `now` 로 못 박으므로 승계하면 갱신 직후
만료로 태어난다). 규칙을 적는 자리는 `features/auth/login.ts` 의 조립 리터럴 하나이고, `Grant` 에
필드가 늘면 거기서 컴파일이 깨진다.

**대기 화면** (0194): 게이트 통과부터 위 전부가 끝날 때까지 renderer 는 메인 셸을 띄우지 않는다.
`ProviderPlatformState.resuming` 이 그 신호이고, 값은 `app/auth-resume.ts` 가 **파생**한다
(`!배치종료 && gateOpen()`). 별도 플래그를 두면 방송 구독자와 배치 시작 구독자의 등록 순서에 정답이
생기고, 순서가 뒤집히면 `{passed:true, resuming:false}` 가 한 번 나가 메인 셸이 한 프레임 뜬다.
`gateOpen()` 재사용이 우회 빌드의 잠김도 함께 막는다 — 우회로 통과한 빌드는 배치를 아예 돌리지
않으므로 대기 화면에 갇히면 안 된다.

매 시도 직전에 상태를 다시 읽어 `expired` 일 때만 진행한다 — 그 사이 사용자가 해제했거나(`none`)
직접 로그인을 시작했으면(`valid`) 건드리지 않는다. gate Auth 자신의 복원 실패는 대상이 아니다:
사용자가 로그인 화면에서 직접 로그인한다.

이 정책은 `app/auth-resume.ts` 가 갖는다 — electron 을 물지 않아 순서와 방송 횟수를 단위 테스트로
관측할 수 있다.

---

## 6. Harness 실행 구성

### 6.1 사용자 설정 열거의 SSOT 는 디렉터리다

사용자가 CRUD하는 Harness + ModelProvider 목록은 `sources/settings/<harness>/<modelProvider>/`
가 소유한다. 인증된 Harness가 반환한 `availableModels: string[]`은 예외로, Gate 로그인 성공 때
`RuntimeModelCatalog`가 프로세스 메모리에 read-only 항목으로 투영한다.

runtime contribution은 Gate 로그인당 한 번 resolve해 cache한다. 새 세션과 턴은 cache만 읽고,
revoke·만료·unauthorized·재인증은 해당 cache를 제거하거나 새 세대의 결과로 교체한다.

`sources/settings/` 에 디렉터리가 있다는 것과 그 Harness 를 **실행할 수 있다**는 것은 다르다.
후자의 SSOT 는 `AdapterRegistry`/`SessionAdapter` 다.

### 6.2 동적 보강은 optional 이다

```ts
type RuntimeConfigAugmenters = Readonly<
  Partial<Record<HarnessModelProviderKey, RuntimeConfigAugmenter>>
>
```

이 매핑은 catalog 가 아니다. entry 를 열거하지도 선택하지도 않고, **이미 선택된 key 에 동적 보강
코드가 있는지만** 조회한다. key 가 없으면 기존 settings 와 app env 만으로 동작하며 **network 는 0**
이다.

augmenter 의 결과는 **전체 `runtimeEnv` overlay**와 선택적 `availableModels: string[]`이다. 후자는
subprocess env로 직렬화하지 않고 runtime model catalog에만 투영한다. 두 credential 방식은
**서로 다른 factory** 로 분리한다:

```text
config API 방식      BoundAuth.request → OAuth/session 으로 API 접근 → 응답의 LLM token·URL·Model
direct credential    닫힌 readSecret() → 사용자가 입력한 API key 를 runtimeEnv 에 직접 배치
```

config API augmenter 에는 `AuthSecretReader` 를 **주지 않는다** — OAuth access token 과 응답의 실제
LLM token 을 오인할 여지를 배선에서 제거한다.

### 6.3 cache 는 key 당 한 세대만 갖는다

```text
generation + sourceRevision + cached value + in-flight operation
```

| 규칙 | 이유 |
|---|---|
| `credentialChanged:true` change · 명시 refresh · settings CRUD/deploy 만 generation 을 올린다 | UI step 과 `verified`-only 변화가 network 를 유발하면 안 된다 |
| 세대를 cache **key** 로 쌓지 않는다 | 이전 secret 이 메모리에 남는다 |
| settings 수정은 `sourceRevision` 변화로 miss 가 된다 | 앱 CRUD 는 즉시 invalidate, 외부 편집은 다음 resolve 의 mtime 검사에서 발견 |
| 실행 중 resolve 는 시작 generation 을 캡처하고, 완료 시 달라졌으면 **cache 에도 caller 에도** 주지 않는다 | 재인증 중 시작된 옛 요청이 낡은 token 을 되살리면 fingerprint 도 옛 값과 같아 stale subprocess 가 재사용된다 |
| stale 재시도는 bounded — 소진하면 명시적 오류 | 연속 재인증에서 무한 루프를 만들지 않는다 |
| 같은 key·generation·sourceRevision 만 single-flight 를 공유하고 **service-owned signal** 을 쓴다 | 한 caller 의 취소가 다른 caller 의 정상 resolve 를 끌고 죽으면 안 된다 |
| `validUntil` 은 clock skew 여유를 두고 판정한다 | 만료 직전 값을 warm hit 로 돌려주지 않는다 |

### 6.4 두 주입 채널과 fingerprint

`options.settings`(native settings JSON)와 `options.env`(subprocess env)는 **둘 다 유지한다.** 하나로
평탄화하면 Harness settings 우선순위가 바뀐다.

```text
runtime config augmenter env
  > 선택된 Harness + ModelProvider settings 의 env
  > app env
  > 상속된 process env
```

`options.env` 를 만드는 턴에는 `prepareHarnessConfig()` 가 settings 의 **`env` 블록을 통째로**
in-memory 사본에서 걷어내고 그 값을 위 순서로 `options.env` 에 hoist 한다 — 충돌 키만 지우면
settings 와 app env 양쪽에 있는 키가 두 채널에 동시에 남아 최종 값이 SDK 내부 우선순위에 달린다.
전부 걷어내야 "어느 채널이 우선해도 결과가 하나" 가 성립한다.

`options.env` 를 만들지 않는 턴(정적 배포 + app env 없음)에는 settings 채널을 건드리지 않는다.
단 네 레이어의 최종 `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` 값이 정확히 `1`이면 Claude Code 가
프로세스 시작 시 provider 를 판정하므로, 정적 배포여도 settings env 전체를 `options.env` 로
hoist 한다. 상속 process env 에서 활성화된 경우도 같고, 상위 레이어의 명시적 `0`은 하위 `1`을
덮는다. **디스크 `settings.json` 은 수정하지 않는다.**

**순서가 곧 우선순위다.** 구현은 `baseEnv → appEnv → settings env → runtimeEnv` 로 얹는다(나중이
이긴다). app 을 settings 뒤에 얹으면 전역 폴백이 ModelProvider 전용 설정을 덮어, 게이트웨이를
바꿔도 URL·모델 변수가 따라오지 않는다.

Auth 에서 얻은 secret 과 config API 의 LLM token 은 `options.settings` 나 argv 에 복제하지 않고
**`options.env` 에만** 둔다. 하네스 런타임 `runtimeEnv` 가 제공하는 API base URL·auth token·model
등도 같은 spawn 환경을 쓰며, 위 우선순위의 최상위에서 settings/app/process 값을 덮는다.

`runtimeEnvFingerprint` 는 adapter 에 실제로 전달하는 **최종 env** 를 key 정렬 canonical form 으로
접고 **프로세스 수명 랜덤 키로 HMAC-SHA256 한 digest** 다. `providerSettingsChangedSinceSpawn`
만으로는 **`options.env` 의 credential 교체를 판정하지 못하기 때문**이다.

**digest 여야 하는 이유**: 이 값은 비교에만 쓰이는데도 spawn 기록부(`SessionRuntime`)가 세션
수명 내내 들고 있다. canonical form 을 그대로 두면 secret 평문이 장기 보존되는 자리가 하나
늘어난다 — heap dump·크래시 리포트·디버거로 새는 경로다. 키는 프로세스마다 새로 뽑으므로 값이
프로세스 밖으로 나가도 되돌릴 수 없고, 같은 프로세스 안에서는 비교가 정확히 성립한다.

**settings 를 함께 접지 않는다.** respawn 판정은 서로 겹치지 않는 축을 하나씩 본다:

| 축 | 소유자 | null 의미론 |
|---|---|---|
| settings blob | `providerSettingsChangedSinceSpawn` | 어느 한쪽 부재 = **보수적 no-op**(0125) |
| 최종 env | `runtimeEnvFingerprint` 비교 | spawn 기록 부재 = no-op(콜드 스타트) |
| boundary · Model · Runtime Tool revision | 각자 기존 판정 | — |

둘을 하나의 fingerprint 로 합치면 settings 변화가 두 입력에 동시에 나타나고, 무엇보다 **settings
loader 가 일시 실패한 턴**(`settings: {...}` → `undefined`)을 변화로 읽어 채널을 내리고 settings
없이 respawn 한다 — 0125 가 no-op 으로 못 박은 경우다. settings 에 `env` 블록이 있었다면 최종
env 가 실제로 달라지므로 그때는 env 축이 정확히 잡아낸다.

**원문·secret·fingerprint 를 로그나 DB 에 남기지 않는다.**

### 6.5 턴과 continuation

- 최초 사용자 turn 은 runtime config 를 **한 번** resolve 하고 `PreparedHarnessConfig` 를 한 번
  만든다. 그 turn 의 chat Harness 와 title generation 은 같은 snapshot 을 쓴다.
- 자동 continuation 은 **continuation 마다 전체 config 를 한 번 다시 resolve** 한다(warm cache 허용).
  같은 continuation 의 listen/flush 는 그 결과 하나를 공유하고, **둘 다** `providerSettings` 와
  `env` 를 같은 값으로 전달한다.
- fingerprint 가 spawn 당시 값과 다르면 continuation 전에 channel 을 teardown 한다.

Model 선택 UI 는 settings 항목과 인증된 runtime model contribution을 합성한 catalog에서 파생한다.
runtime API의 `availableModels`는 read-only 항목으로 합성되며, 실행 구성은 같은 runtime cache
snapshot을 읽는다.

---

## 7. Plugin

Plugin 은 GUI 카탈로그에 표시되는 제품 기능 단위다. Plugin 모듈은 `BoundAuth.request` 와 자기
옵션만 받고, **raw credential 을 보지 않는다.**

- Runtime Tool 서버는 부팅에서 **한 번만** 만들고 이후 sync 는 add/remove 만 한다.
  `RuntimeToolRegistry` 의 동등성 검사가 handler identity 까지 보기 때문이다 — 매번 새로 만들면
  형상이 같아도 revision 이 올라 다음 턴이 런타임을 재spawn 한다.
- sync 는 **`credentialChanged:true` 인 자기 Auth 의 change 에서만** 일어난다.
- GUI `tools` 는 **cached descriptor** 에서 나온다. Auth 가 invalid 여도 목록을 비우지 않고 `status`
  로 비활성을 안내한다 — active registry 로 목록을 만들면 미인증 상태에서 도구가 통째로 사라진다.

### 7.1 Plugin 과 HarnessPlugin 은 다른 것이다

```text
Plugin         Orca GUI 가 표시·인증·관리하고 Runtime Tool 등을 제공   (features/plugins/*)
HarnessPlugin  Harness 규약에 맞춰 렌더한 package 를 Harness 가 직접 로드 (features/extensions/harness-plugins/*)
```

이름에 plugin 이 들어갈 뿐 lifecycle 과 소비자가 다르다. 둘을 같은 디렉터리에 넣지 않는다.

---

## 8. Usage

`features/usage/UsageFetcher` 경계를 유지한다. 폐쇄망 구현은 `app/deployment/usage-fetcher.ts` 에
둔다 — Auth 는 endpoint 를 모르고, Harness 모듈도 Usage endpoint 를 모른다.

- `supports(key)` 는 **이 배포가 그 key 의 원격 사용량을 지원하는가** 이지 현재 Auth 상태가 아니다.
  미인증·만료에서 `supports:false` 로 숨기지 말고 `fetchUsage()` 가 Auth 오류를 전파하게 한다.
- `baselineUsable` 은 `asOf` 가 **billing aggregation watermark** 임을 배포가 확인한 경우에만 true 다.
  미지정은 false 로 접힌다(fail-closed) — 아니면 같은 턴이 두 번 더해진다.
- 재인증·해제는 저장된 마지막 `UsageSnapshot` 을 임의로 삭제하지 않는다.

---

## 9. GUI 와 wire

renderer 는 여전히 한 DTO 에서 `gate | llm | service` 분류·인증 상태·노출 도구를 함께 받는다.
내부 책임을 갈랐다고 화면과 wire 를 동시에 바꾸지 않는다.

`app/connection-views.ts` 가 `ConnectionViewSource[]` 를 기존 DTO 로 매핑한다:

| view category | wire `ProviderKind` |
|---|---|
| `gate` | `gate` |
| `harness` | `llm` |
| `plugin` | `service` |
| `usage` | `service` |

- row 의 **순서와 개수를 보존**하고 `authId` 는 중복되지 않는다. 하나의 Auth 를 여러 feature 가
  써도 `BoundAuth` 만 재사용하고 GUI row 를 복제하지 않는다.
- label·origin·인증 방식 입력 필드는 `auth.describe()` 에서, 상태는 `auth.snapshot()` 에서 읽는다 —
  view source 에 다시 적지 않는다.
- **renderer 에 새 kind 를 추가하지 않는다.** 신규 도메인 코드 안쪽에서는 `ProviderKind` 를 쓰지
  않는다 — 이 표가 유일한 접점이다.
- 연결 버튼은 `login`/`reauth`/`revoke` 만 부른다. Plugin fetch·Usage refresh·Harness config resolve 를
  호출하지 않는다.

배열 조립은 **`app/deployment/connections.ts`** 가 소유한다(`createConnectionSources(deps)`).
Bootstrap 은 gate 멤버와 plugin binding 을 넘기고 결과를 그대로 IPC 에 태울 뿐이다. 조립을
`bootstrap.ts` 안에 두면 harness·usage row 를 더하려는 배포가 범용 부팅 파일을 고쳐야 한다 —
그래서 `gateRows()`·`pluginRows()` 를 조각으로 노출해 배포가 순서를 직접 정한다.

`ConnectionViewSource` 는 main 전용이며 IPC 를 통과하지 않는다. behavior contribution registry 도
아니다 — Bootstrap 이 만든 객체 참조를 배열로 묶기 때문에 별도 cross-reference validator 가 필요
없다(참조가 곧 무결성이다).

---

## 10. 부팅 순서

```text
Bootstrap.start
  ├─ [DB 이전] RuntimeToolRegistry + createAuthRuntime(AUTH_DEFINITIONS)
  │   └─ mcp.attachTokenSource((id) => secretReader.read(id))
  ├─ [DB 이전] Gate + Plugin concrete 1회 생성 + 초기 tool sync
  │   ├─ Auth change listener
  │   ├─ connection IPC 조기 등록
  │   └─ gate-first / remaining-parallel async resume
  ├─ [DB 이후] HarnessSettingsService + HarnessRuntimeConfigService
  │   └─ Auth change → 고정 key 만 invalidate
  ├─ 기존 settings scaffold → deploy
  │   └─ 두 cache 를 함께 invalidate
  ├─ UsageFetcher concrete → UsageTracker
  └─ RouterContext 에 auth + gate + harnessRuntime 주입 (secretReader 는 넣지 않는다)
```

**Auth/Gate/Plugin tool server/connection handler 를 DB 뒤로 미루지 않는다.** renderer 는 부팅 완료
전에 연결 상태를 invoke 하고, 복원된 Auth 의 도구 이름과 초기 가시성도 첫 snapshot 에 필요하다.
이 순서를 바꾸면 로그인 화면이 빈 상태로 멈추거나 첫 턴의 도구 snapshot 이 달라진다.

Bootstrap 은 endpoint path·response body·Confluence CQL·UsageSnapshot mapping·Harness 환경변수 이름을
**알면 안 된다.** concrete factory 를 부르고 결과 포트를 주입하는 것까지만 한다.

---

## 11. 뒤집으면 안 되는 결정

| 결정 | 이유 |
|---|---|
| `AuthId` · vault key **prefix** · `orca:provider:*` 채널 · DB `provider_key` 는 그대로다 | 저장된 grant·사용자 MCP 설정·기존 세션이 걸려 있다. 개명하려면 secret migration + rollback 계획이 선행한다 |
| 자격증명은 **고정 키를 덮어쓰지 않는다** — 새 값은 새 세대 키에, 커밋은 `Grant` 저장으로 | vault 와 grant 를 원자적으로 함께 쓸 방법이 없다. 덮어쓰면 "vault=새 값 / grant=옛 값" 창이 반드시 생긴다(§4.3). 동결된 것은 prefix 이고 세대 접미사는 그 안에 있다 |
| 영속 실패를 성공으로 접지 않는다 | 옛 키를 지워도 된다는 잘못된 근거가 되어, 재시작 후 아무것도 가리키지 않는 grant 를 만든다 |
| **해제는 fail-closed, 추가·교체는 degrade-open** | 방향이 다르다 — 해제를 degrade 하면 사용자가 끊은 연결이 재시작 후 되살아나고, 추가를 fail 시키면 멀쩡한 로그인이 일시적 디스크 문제로 막힌다 |
| 읽기 실패를 "없음" 으로 읽지 않는다 (`authoritative`) | vault sweep 이 그 위에서 돈다. grant 파일 손상 하나가 멀쩡한 secret 전부를 지우는 경로가 된다 |
| Auth 계약에 소비 슬롯을 되살리지 않는다 | 같은 집적이 재생산된다 |
| `AuthSecretReader` 를 RouterContext·renderer·일반 feature 에 넣지 않는다 | bound request 로 충분한 소비자까지 secret 표면을 넓힌다 |
| raw cookie 목록을 일반 포트로 내보내지 않는다 | 같은 partition 의 bound request 로 충분하다 |
| main 원격 요청은 Chromium 스택(`net.fetch`)만 쓴다 | Node 스택은 OS 프록시·사설 CA 를 보지 못한다 |
| generation fence 없는 수동 cache 무효화를 만들지 않는다 | 무효화 전 in-flight 결과가 낡은 token 을 되살린다 |
| Plugin tool server 를 sync 마다 재생성하지 않는다 | handler identity 가 달라져 respawn 이 늘어난다 |
| 런타임 동적 TypeScript/JavaScript 로딩을 추가하지 않는다 | 배포 모듈은 build-time code 다 |

---

## 12. 의도적으로 만들지 않은 것

`ProviderPlatformV2`(또는 이름만 바꾼 통합 facade) · `HarnessModelProviderDefinition[]` catalog ·
operation/endpoint registry · JSON path 기반 범용 response mapper · 환경변수별 schema/registry ·
PluginHost/ConnectorRegistry/ContributionRegistry · AuthId → feature contribution registry ·
LLM request broker(subprocess env secret 비노출은 별도 설계).

환경변수 주입에는 기존과 같은 한계가 있다 — Harness subprocess 에 토큰을 넣으면 Harness 와 Bash
도구가 그 값을 읽을 수 있다. 모델로부터 secret 을 숨기려면 요청 broker 가 필요하며, 디렉터리
리팩터링으로 해결되지 않는다.

---

## 13. 참고

- 실행 절차: [`guides/closed-network-extensions.md`](../../guides/closed-network-extensions.md)
- 자격증명 경계: [`security.md`](./security.md)
- 채널 계약: [`IPC_CONTRACT.md`](../../IPC_CONTRACT.md)
- 용어: [`GLOSSARY.md`](../../GLOSSARY.md)
- 레이어 규칙: [`app/src/main/AGENTS.md`](../../../app/src/main/AGENTS.md)
